$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$artifacts = Join-Path $root ".artifacts"
$venv = Join-Path $artifacts "pyinstaller-venv"
$python = Join-Path $venv "Scripts\python.exe"
$work = Join-Path $artifacts "pyinstaller-build"
$dist = Join-Path $root "dist"
$source = Join-Path $root "license_generator.py"
$requirements = Join-Path $root "requirements-build.txt"
$executable = Join-Path $dist "HyperCodeLicenseGenerator.exe"

New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

if (-not (Test-Path -LiteralPath $python)) {
  python -m venv $venv
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create the Python virtual environment."
  }
}

& $python -m pip install --disable-pip-version-check -r $requirements
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install PyInstaller."
}

& $python -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --windowed `
  --name HyperCodeLicenseGenerator `
  --distpath $dist `
  --workpath $work `
  --specpath $artifacts `
  $source
if ($LASTEXITCODE -ne 0) {
  throw "Failed to build HyperCodeLicenseGenerator.exe."
}

if (-not (Test-Path -LiteralPath $executable)) {
  throw "Build completed, but the executable was not found: $executable"
}

Write-Host "Build succeeded: $executable"
