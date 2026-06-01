[CmdletBinding()]
param(
  [switch]$Write
)

$ErrorActionPreference = "Stop"

function Step($Message) {
  Write-Host "[hypercode-sync] $Message"
}

function Run($Command) {
  Step $Command
  if (-not $Write) {
    return
  }
  Invoke-Expression $Command
}

$status = git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "git status failed"
}

if ($status) {
  throw "Working tree is not clean. Commit or stash local changes before syncing upstream."
}

$upstream = git remote get-url upstream 2>$null
if (-not $upstream) {
  throw "Missing upstream remote. Configure it first, then rerun this script."
}

$branch = "sync/opencode-upstream-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$upstreamDefault = (git remote show upstream | Select-String "HEAD branch").ToString().Split(":")[-1].Trim()
if (-not $upstreamDefault) {
  $upstreamDefault = "dev"
}

Step "Mode: $(if ($Write) { 'write' } else { 'dry-run' })"
Step "Upstream: $upstream"
Step "Upstream default branch: $upstreamDefault"
Step "Sync branch: $branch"

Run "git fetch upstream"
Run "git switch -c $branch"
Run "git merge upstream/$upstreamDefault"
Run "node scripts/rebrand-opencode-to-hypercode.mjs --write"

Step "Recommended verification after merge:"
Step "  bun typecheck (run from affected package directories)"
Step "  bun test (run from affected package directories)"
Step "This script never pushes, deletes branches, or auto-resolves conflicts."
