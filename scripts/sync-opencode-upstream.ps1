[CmdletBinding()]
param(
  [ValidateSet("Plan", "Prepare", "Validate", "Measure")]
  [string]$Mode = "Plan",
  [string]$UpstreamUrl = "https://github.com/anomalyco/opencode.git",
  [string]$UpstreamRef = "dev",
  [string]$UpstreamVersion,
  [string]$UpstreamCommit,
  [string]$BaselineRef = "HEAD",
  [string]$CurrentRef = "HEAD",
  [string]$BranchName,
  [switch]$RunPackageValidation,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Step($Message) {
  Write-Host "[hypercode-sync] $Message"
}

function Invoke-Git([string[]]$Arguments) {
  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed"
  }
  return $output
}

function Require-Repository {
  Invoke-Git @("rev-parse", "--show-toplevel") | Out-Null
}

function Require-Ref([string]$Ref, [string]$Label) {
  & git cat-file -e "$Ref^{commit}"
  if ($LASTEXITCODE -ne 0) {
    throw "$Label is not a locally resolvable commit: $Ref"
  }
}

function Measure-ForkTax {
  Require-Ref $UpstreamCommit "UpstreamCommit"
  Require-Ref $CurrentRef "CurrentRef"

  $modified = @(Invoke-Git @("diff", "--name-only", "--diff-filter=MT", $UpstreamCommit, $CurrentRef))
  $production = @(
    $modified | Where-Object {
      $_ -match "^(packages|sdks)/[^/]+/src/" -and $_ -notmatch "(^|/)test(s)?/"
    }
  )
  $core = @($modified | Where-Object { $_ -match "^(packages/core/src|packages/opencode/src)/" })
  $technical = 0

  Invoke-Git @(
    "diff",
    "--diff-filter=MT",
    "--numstat",
    $UpstreamCommit,
    $CurrentRef,
    "--",
    "packages/core/src",
    "packages/opencode/src"
  ) | ForEach-Object {
    $parts = $_ -split "`t"
    if ($parts[0] -match "^\d+$" -and $parts[1] -match "^\d+$") {
      $technical += [int]$parts[0] + [int]$parts[1]
    }
  }

  return [ordered]@{
    upstreamCommit = $UpstreamCommit
    currentRef = $CurrentRef
    modifiedUpstreamFiles = $modified.Count
    productionPaths = $production.Count
    corePatchPaths = $core.Count
    technicalSurface = $technical
  }
}

function Show-Plan {
  $status = @(Invoke-Git @("status", "--porcelain"))
  $version = if ($UpstreamVersion) { $UpstreamVersion } else { "<required-for-prepare>" }
  $commit = if ($UpstreamCommit) { $UpstreamCommit } else { "<required-for-prepare>" }
  $token = $version -replace "[^0-9A-Za-z]+", ""
  $branch = if ($BranchName) { $BranchName } else { "opencode-sync-$token" }

  Step "Mode: read-only plan"
  Step "Current branch: $(Invoke-Git @('branch', '--show-current'))"
  Step "Current HEAD: $(Invoke-Git @('rev-parse', 'HEAD'))"
  Step "Working tree: $(if ($status.Count) { 'DIRTY' } else { 'CLEAN' })"
  Step "Upstream: $UpstreamUrl"
  Step "Target ref: $UpstreamRef"
  Step "Target version: $version"
  Step "Target commit: $commit"
  Step "Sync branch: $branch"
  Step "Create a preservation stash before using -Mode Prepare with an exact version and commit."
}

function Prepare-Sync {
  if (-not $UpstreamVersion) {
    throw "Prepare mode requires -UpstreamVersion"
  }
  if (-not $UpstreamCommit) {
    throw "Prepare mode requires an exact -UpstreamCommit"
  }
  if (Invoke-Git @("status", "--porcelain")) {
    throw "Working tree is dirty. Create a preservation stash before preparing the sync."
  }

  $versionToken = $UpstreamVersion -replace "[^0-9A-Za-z]+", ""
  $syncBranch = if ($BranchName) { $BranchName } else { "opencode-sync-$versionToken" }
  if ($syncBranch -match "/" -or ($syncBranch -split "-").Count -gt 3) {
    throw "The sync branch must contain no slash and at most three hyphen-separated words."
  }

  Require-Ref $BaselineRef "BaselineRef"
  $auditRef = "refs/audit/opencode-$versionToken"
  Step "Fetch $UpstreamRef from $UpstreamUrl into $auditRef"
  Invoke-Git @("fetch", "--no-tags", $UpstreamUrl, "+$UpstreamRef`:$auditRef") | Out-Null
  $resolved = (Invoke-Git @("rev-parse", $auditRef)).Trim()
  if ($resolved -ne $UpstreamCommit) {
    throw "Upstream commit mismatch: expected $UpstreamCommit, resolved $resolved"
  }

  Step "Create sync branch $syncBranch with rollback boundary $BaselineRef"
  Invoke-Git @("switch", "-c", $syncBranch, $BaselineRef) | Out-Null
  Step "Merge the exact upstream commit with --no-ff --no-commit; conflicts require manual decisions"
  & git merge --no-ff --no-commit $resolved
  if ($LASTEXITCODE -ne 0) {
    Step "Merge stopped with conflicts. Record the conflict ledger; do not auto-select ours or theirs."
    exit 2
  }
  Step "Merge is prepared but uncommitted. Resolve conflicts, commit the merge, then run -Mode Validate."
}

function Validate-Sync {
  $unmerged = @(Invoke-Git @("diff", "--name-only", "--diff-filter=U"))
  if ($unmerged.Count) {
    throw "Unresolved conflicts remain: $($unmerged -join ', ')"
  }
  if (-not $UpstreamCommit) {
    throw "Validate mode requires -UpstreamCommit"
  }

  Step "Check rebrand drift"
  & node scripts/rebrand-opencode-to-hypercode.mjs --dry-run
  if ($LASTEXITCODE -ne 0) {
    throw "Rebrand validation failed"
  }
  & git diff --check
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check failed"
  }

  $measurement = Measure-ForkTax
  Step "Fork Tax: modified=$($measurement.modifiedUpstreamFiles), production=$($measurement.productionPaths), core=$($measurement.corePatchPaths), technical=$($measurement.technicalSurface)"

  if (-not $RunPackageValidation) {
    Step "Package validation was not run. Add -RunPackageValidation when required."
    return
  }

  Push-Location packages/opencode
  try {
    & bun test test/server/httpapi-branding.test.ts test/server/httpapi-public-openapi.test.ts test/server/httpapi-query-schema-drift.test.ts test/server/httpapi-sdk.test.ts
    if ($LASTEXITCODE -ne 0) {
      throw "packages/opencode targeted tests failed"
    }
    & bun typecheck
    if ($LASTEXITCODE -ne 0) {
      throw "packages/opencode typecheck failed; compare it with the known failure ledger"
    }
  } finally {
    Pop-Location
  }
}

Require-Repository

if ($Mode -eq "Measure") {
  if (-not $UpstreamCommit) {
    throw "Measure mode requires -UpstreamCommit"
  }
  $measurement = Measure-ForkTax
  if ($Json) {
    [Console]::Out.Write(($measurement | ConvertTo-Json -Compress))
    exit 0
  }
  $measurement.GetEnumerator() | ForEach-Object { Step "$($_.Key): $($_.Value)" }
  exit 0
}

if ($Mode -eq "Prepare") {
  Prepare-Sync
  exit 0
}

if ($Mode -eq "Validate") {
  Validate-Sync
  exit 0
}

Show-Plan
