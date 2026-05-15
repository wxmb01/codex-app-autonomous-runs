[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$CodexHome = (Join-Path $env:USERPROFILE ".codex"),
    [switch]$Force,
    [switch]$Merge,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$templateRoot = Join-Path $repoRoot "templates\codex"
if (-not (Test-Path -LiteralPath $templateRoot)) {
    throw "Template root not found: $templateRoot"
}

$codexHomeResolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodexHome)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $codexHomeResolved "backup-codex-app-autonomous-$timestamp"
$report = New-Object System.Collections.Generic.List[string]

function Add-Report {
    param([string]$Line)
    $report.Add($Line) | Out-Null
}

function Ensure-Parent {
    param([string]$Path)
    $parent = Split-Path -Parent $Path
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
}

function Backup-IfExists {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        $relative = $Path.Substring($codexHomeResolved.Length).TrimStart('\', '/')
        $dest = Join-Path $backupRoot $relative
        Add-Report "backup: $Path -> $dest"
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
            Copy-Item -LiteralPath $Path -Destination $dest -Recurse -Force
        }
    }
}

function Copy-TemplatePath {
    param(
        [string]$Source,
        [string]$Destination
    )
    if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
        Backup-IfExists -Path $Destination
    }
    Add-Report "copy: $Source -> $Destination"
    Ensure-Parent -Path $Destination
    if (-not $DryRun) {
        Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
    }
}

function Merge-AgentsMd {
    param(
        [string]$Source,
        [string]$Destination
    )
    $begin = "<!-- codex-app-autonomous-runs:begin -->"
    $end = "<!-- codex-app-autonomous-runs:end -->"
    $sourceText = Get-Content -LiteralPath $Source -Raw
    $block = @"
$begin
$sourceText
$end
"@
    if (-not (Test-Path -LiteralPath $Destination)) {
        Add-Report "write merged AGENTS.md: $Destination"
        Ensure-Parent -Path $Destination
        if (-not $DryRun) {
            Set-Content -LiteralPath $Destination -Value $block -Encoding UTF8
        }
        return
    }

    Backup-IfExists -Path $Destination
    $current = Get-Content -LiteralPath $Destination -Raw
    if ($current.Contains($begin) -and $current.Contains($end)) {
        $pattern = [regex]::Escape($begin) + ".*?" + [regex]::Escape($end)
        $next = [regex]::Replace($current, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block }, "Singleline")
        Add-Report "replace managed AGENTS.md block: $Destination"
    } else {
        $next = $current.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
        Add-Report "append managed AGENTS.md block: $Destination"
    }
    if (-not $DryRun) {
        Set-Content -LiteralPath $Destination -Value $next -Encoding UTF8
    }
}

if ($PSCmdlet.ShouldProcess($codexHomeResolved, "install Codex App autonomous run templates")) {
    Add-Report "target: $codexHomeResolved"
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $codexHomeResolved | Out-Null
    }

    foreach ($item in @("agents", "hooks", "rules", "skills")) {
        Copy-TemplatePath -Source (Join-Path $templateRoot $item) -Destination (Join-Path $codexHomeResolved $item)
    }

    $agentsDestination = Join-Path $codexHomeResolved "AGENTS.md"
    if ($Merge) {
        Merge-AgentsMd -Source (Join-Path $templateRoot "AGENTS.md") -Destination $agentsDestination
    } else {
        Copy-TemplatePath -Source (Join-Path $templateRoot "AGENTS.md") -Destination $agentsDestination
    }

    $hooksTemplate = Get-Content -LiteralPath (Join-Path $templateRoot "hooks.json.template") -Raw
    $escapedHome = $codexHomeResolved.Replace("\", "\\")
    $hooksJson = $hooksTemplate.Replace("{{CODEX_HOME_WINDOWS_ESCAPED}}", $escapedHome)
    $hooksPath = Join-Path $codexHomeResolved "hooks.json"
    if ((Test-Path -LiteralPath $hooksPath) -and -not $Force) {
        Backup-IfExists -Path $hooksPath
    }
    Add-Report "render hooks.json: $hooksPath"
    if (-not $DryRun) {
        Set-Content -LiteralPath $hooksPath -Value $hooksJson -Encoding UTF8
    }

    $reportPath = Join-Path $codexHomeResolved "codex-app-autonomous-install-report.md"
    $reportText = "# Codex App Autonomous Install Report`r`n`r`n" + (($report | ForEach-Object { "- $_" }) -join "`r`n") + "`r`n"
    if ($DryRun) {
        Write-Output $reportText
        return
    }
    Set-Content -LiteralPath $reportPath -Value $reportText -Encoding UTF8
    Write-Output "Installed Codex App autonomous run templates to: $codexHomeResolved"
    Write-Output "Install report: $reportPath"
    Write-Output "Backups, if any, were written to: $backupRoot"
    Write-Output "Open Codex App settings and trust the installed hooks."
}
