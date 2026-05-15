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

$packageJson = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$codexHomeResolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodexHome)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $codexHomeResolved "backup-codex-app-autonomous-$timestamp"
$manifestPath = Join-Path $codexHomeResolved "codex-app-autonomous-manifest.json"
$report = New-Object System.Collections.Generic.List[string]
$manifestFiles = New-Object System.Collections.Generic.List[object]

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

function Get-Sha256File {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-Sha256Text {
    param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $utf8NoBom.GetBytes($Text)
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Text
    )
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function ConvertTo-CodexRelative {
    param([string]$Path)
    return $Path.Substring($codexHomeResolved.Length).TrimStart('\', '/').Replace('\', '/')
}

function Add-ManifestFile {
    param(
        [string]$Path,
        [string]$Hash,
        [string]$Kind = "file"
    )
    $manifestFiles.Add([ordered]@{
        path = ConvertTo-CodexRelative -Path $Path
        kind = $Kind
        sha256 = $Hash
    }) | Out-Null
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

function Copy-TemplateFile {
    param(
        [string]$Source,
        [string]$Destination
    )
    if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
        Backup-IfExists -Path $Destination
    }
    Add-Report "copy: $Source -> $Destination"
    Ensure-Parent -Path $Destination
    Add-ManifestFile -Path $Destination -Hash (Get-Sha256File -Path $Source)
    if (-not $DryRun) {
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
}

function Copy-TemplateTree {
    param(
        [string]$SourceDir,
        [string]$DestinationDir
    )
    Get-ChildItem -LiteralPath $SourceDir -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
        Copy-TemplateFile -Source $_.FullName -Destination (Join-Path $DestinationDir $relative)
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
    $block = "$begin`n$sourceText`n$end`n"
    if (-not (Test-Path -LiteralPath $Destination)) {
        Add-Report "write merged AGENTS.md: $Destination"
        Ensure-Parent -Path $Destination
        Add-ManifestFile -Path $Destination -Hash (Get-Sha256Text -Text $block) -Kind "managed-block"
        if (-not $DryRun) {
            Write-Utf8NoBom -Path $Destination -Text $block
        }
        return
    }

    Backup-IfExists -Path $Destination
    $current = Get-Content -LiteralPath $Destination -Raw
    if ($current.Contains($begin) -and $current.Contains($end)) {
        $pattern = [regex]::Escape($begin) + ".*?" + [regex]::Escape($end)
        $next = [regex]::Replace($current, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block.TrimEnd() }, [System.Text.RegularExpressions.RegexOptions]::Singleline)
        Add-Report "replace managed AGENTS.md block: $Destination"
    } else {
        $next = $current.TrimEnd() + "`n`n" + $block
        Add-Report "append managed AGENTS.md block: $Destination"
    }
    Add-ManifestFile -Path $Destination -Hash (Get-Sha256Text -Text $next) -Kind "managed-block"
    if (-not $DryRun) {
        Write-Utf8NoBom -Path $Destination -Text $next
    }
}

if ($PSCmdlet.ShouldProcess($codexHomeResolved, "install Codex App autonomous run templates")) {
    Add-Report "target: $codexHomeResolved"
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $codexHomeResolved | Out-Null
    }

    foreach ($item in @("agents", "hooks", "rules", "skills")) {
        Copy-TemplateTree -SourceDir (Join-Path $templateRoot $item) -DestinationDir (Join-Path $codexHomeResolved $item)
    }

    $agentsDestination = Join-Path $codexHomeResolved "AGENTS.md"
    if ($Merge) {
        Merge-AgentsMd -Source (Join-Path $templateRoot "AGENTS.md") -Destination $agentsDestination
    } else {
        Copy-TemplateFile -Source (Join-Path $templateRoot "AGENTS.md") -Destination $agentsDestination
    }

    $hooksTemplate = Get-Content -LiteralPath (Join-Path $templateRoot "hooks.json.template") -Raw
    $escapedHome = $codexHomeResolved.Replace("\", "\\")
    $hooksJson = $hooksTemplate.Replace("{{CODEX_HOME_WINDOWS_ESCAPED}}", $escapedHome)
    $hooksPath = Join-Path $codexHomeResolved "hooks.json"
    if ((Test-Path -LiteralPath $hooksPath) -and -not $Force) {
        Backup-IfExists -Path $hooksPath
    }
    Add-Report "render hooks.json: $hooksPath"
    Ensure-Parent -Path $hooksPath
    Add-ManifestFile -Path $hooksPath -Hash (Get-Sha256Text -Text $hooksJson) -Kind "generated"
    if (-not $DryRun) {
        Write-Utf8NoBom -Path $hooksPath -Text $hooksJson
    }

    Add-Report "write manifest: $manifestPath"
    $reportPath = Join-Path $codexHomeResolved "codex-app-autonomous-install-report.md"
    $reportText = "# Codex App Autonomous Install Report`n`n" + (($report | ForEach-Object { "- $_" }) -join "`n") + "`n"
    $reportHash = Get-Sha256Text -Text $reportText
    $hooksEntry = $manifestFiles | Where-Object { $_.path -eq "hooks.json" } | Select-Object -First 1
    $allFiles = New-Object System.Collections.Generic.List[object]
    foreach ($file in $manifestFiles) {
        $allFiles.Add($file) | Out-Null
    }
    $allFiles.Add([ordered]@{
        path = ConvertTo-CodexRelative -Path $reportPath
        kind = "generated"
        sha256 = $reportHash
    }) | Out-Null
    $manifest = [ordered]@{
        name = "codex-app-autonomous-runs"
        version = $packageJson.version
        installed_at = (Get-Date).ToUniversalTime().ToString("o")
        codex_home = $codexHomeResolved
        rendered_hooks_sha256 = $hooksEntry.sha256
        files = $allFiles.ToArray()
    }
    if ($DryRun) {
        Write-Output $reportText
        Write-Output "Manifest preview: $($allFiles.Count) managed file entries"
        return
    }
    Write-Utf8NoBom -Path $reportPath -Text $reportText
    Write-Utf8NoBom -Path $manifestPath -Text (($manifest | ConvertTo-Json -Depth 8) + "`n")
    Write-Output "Installed Codex App autonomous run templates to: $codexHomeResolved"
    Write-Output "Install report: $reportPath"
    Write-Output "Manifest: $manifestPath"
    Write-Output "Backups, if any, were written to: $backupRoot"
    Write-Output "Open Codex App settings and trust the installed hooks."
}
