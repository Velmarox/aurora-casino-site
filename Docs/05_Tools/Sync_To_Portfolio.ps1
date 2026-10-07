<#
    Sync_To_Portfolio.ps1
    ---------------------------------------------------------------------------
    Copies this repo's demo build into the Merwin Web Designz portfolio repo,
    where it is published at merwinwebdesignz.com/demo/aurora.

    Why this exists: the demo has to live in the portfolio repo, because a
    Firebase Hosting deploy replaces every file on a site and merwinwebdesignz.com
    is a different Firebase project. Hand-copying a 24-file tree is how files get
    missed, so this does it in one command.

    WHAT IT DOES NOT DO: commit, push, or deploy. It only moves files. You review
    the diff in the portfolio repo and push when you are happy. That is deliberate
    — pushing there publishes your live business site.

    Usage, from the root of this repo:
        pwsh Docs/05_Tools/Sync_To_Portfolio.ps1
        pwsh Docs/05_Tools/Sync_To_Portfolio.ps1 -WhatIf    # show, change nothing
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    # Override if the portfolio repo ever moves.
    [string]$PortfolioRepo = "C:\Users\Administrator\Documents\MWD Studio\2 Active\Jamie Web Portfolio\Merwin_Web_Designz_v2.2.1",

    # Folder name under /demo/ on the portfolio site.
    [string]$ClientFolder = "aurora"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$source   = Join-Path $repoRoot "public\demo\$ClientFolder"
$dest     = Join-Path $PortfolioRepo "public\demo\$ClientFolder"

# --- checks before touching anything ---------------------------------------
if (-not (Test-Path $source)) {
    throw "Source not found: $source`nRun this from the repo that contains public\demo\$ClientFolder."
}
if (-not (Test-Path $PortfolioRepo)) {
    throw "Portfolio repo not found: $PortfolioRepo`nPass -PortfolioRepo with the right path."
}
if (-not (Test-Path (Join-Path $PortfolioRepo '.git'))) {
    throw "$PortfolioRepo is not a git repo. Refusing to copy into it blind."
}

Write-Host ""
Write-Host "  from : $source"
Write-Host "  to   : $dest"
Write-Host ""

# --- copy -------------------------------------------------------------------
# /MIR mirrors, so files deleted here are deleted there too. That is what makes
# this a sync rather than an ever-growing pile. It only ever touches the one
# client folder, never the rest of the portfolio.
$roboArgs = @($source, $dest, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/NS', '/NC')
if ($WhatIfPreference) { $roboArgs += '/L' }

& robocopy @roboArgs | Out-Null
$code = $LASTEXITCODE

# Robocopy exit codes: 0-7 are success, 8+ are real failures.
if ($code -ge 8) { throw "robocopy failed with exit code $code" }

if ($WhatIfPreference) {
    Write-Host "  -WhatIf: nothing was changed." -ForegroundColor Yellow
} else {
    $files = (Get-ChildItem $dest -Recurse -File).Count
    Write-Host "  Synced. $files files now in $ClientFolder." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Next, in the portfolio repo:" -ForegroundColor Cyan
Write-Host "    git status                      # check only /demo/$ClientFolder changed"
Write-Host "    git add public/demo/$ClientFolder"
Write-Host "    git commit -m `"Update $ClientFolder demo`""
Write-Host "    git push                        # this publishes your live site"
Write-Host ""
