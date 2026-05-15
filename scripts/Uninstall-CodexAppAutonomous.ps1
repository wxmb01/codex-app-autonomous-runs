[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$CodexHome = (Join-Path $env:USERPROFILE ".codex"),
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$codexHomeResolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodexHome)
$manifestPath = Join-Path $codexHomeResolved "codex-app-autonomous-manifest.json"
$begin = "<!-- codex-app-autonomous-runs:begin -->"
$end = "<!-- codex-app-autonomous-runs:end -->"

$fallbackTargets = @(
    "agents\autonomous_reviewer.toml",
    "agents\project_completeness_reviewer.toml",
    "agents\security_reviewer.toml",
    "agents\test_coverage_reviewer.toml",
    "agents\architecture_reviewer.toml",
    "agents\ui_artifact_reviewer.toml",
    "hooks\pre_tool_use_policy.py",
    "hooks\stop_continue_guard.py",
    "rules\autonomous-safety.rules",
    "skills\timed-autonomous-run",
    "codex-app-autonomous-install-report.md"
)

function Resolve-ManagedTarget {
    param([string]$RelativePath)
    $full = [System.IO.Path]::GetFullPath((Join-Path $codexHomeResolved ($RelativePath -replace '/', '\')))
    $prefix = $codexHomeResolved.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (($full -ne $codexHomeResolved) -and (-not $full.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Refusing to remove path outside Codex home: $RelativePath"
    }
    return $full
}

function Get-Sha256File {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Remove-ManagedPath {
    param(
        [string]$Path,
        [string]$Reason = "remove"
    )
    Write-Output "- ${Reason}: $Path"
    if (-not $DryRun -and $PSCmdlet.ShouldProcess($Path, "remove installed Codex App autonomous file")) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Remove-ManagedAgentsBlock {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    $current = Get-Content -LiteralPath $Path -Raw
    if ((-not $current.Contains($begin)) -or (-not $current.Contains($end))) {
        Write-Output "- skip modified/user-owned AGENTS.md: $Path"
        return
    }
    $pattern = "`n?" + [regex]::Escape($begin) + ".*?" + [regex]::Escape($end) + "`n?"
    $next = [regex]::Replace($current, $pattern, "`n", [System.Text.RegularExpressions.RegexOptions]::Singleline)
    $next = ([regex]::Replace($next, "`n{3,}", "`n`n")).Trim()
    if ($next) {
        Write-Output "- remove managed AGENTS.md block: $Path"
        if (-not $DryRun -and $PSCmdlet.ShouldProcess($Path, "remove managed AGENTS.md block")) {
            [System.IO.File]::WriteAllText($Path, $next + "`n", [System.Text.UTF8Encoding]::new($false))
        }
    } else {
        Remove-ManagedPath -Path $Path -Reason "remove empty AGENTS.md"
    }
}

function Uninstall-FromManifest {
    param([object]$Manifest)
    $entries = @($Manifest.files) | Sort-Object { $_.path.Length } -Descending
    foreach ($entry in $entries) {
        $full = Resolve-ManagedTarget -RelativePath $entry.path
        if (-not (Test-Path -LiteralPath $full)) {
            continue
        }
        if (($entry.kind -eq "managed-block") -and ($entry.path -eq "AGENTS.md")) {
            Remove-ManagedAgentsBlock -Path $full
            continue
        }
        $currentHash = Get-Sha256File -Path $full
        if ($currentHash -ne $entry.sha256) {
            Write-Output "- skip modified/user-owned: $full"
            continue
        }
        Remove-ManagedPath -Path $full
    }
    if (Test-Path -LiteralPath $manifestPath) {
        Remove-ManagedPath -Path $manifestPath -Reason "remove manifest"
    }
    Remove-EmptyManagedDirectories
}

function Uninstall-Fallback {
    foreach ($target in $fallbackTargets) {
        $full = Resolve-ManagedTarget -RelativePath $target
        if (Test-Path -LiteralPath $full) {
            Remove-ManagedPath -Path $full
        }
    }
    Remove-ManagedAgentsBlock -Path (Resolve-ManagedTarget -RelativePath "AGENTS.md")
    $hooksPath = Resolve-ManagedTarget -RelativePath "hooks.json"
    if (Test-Path -LiteralPath $hooksPath) {
        Write-Output "- skip modified/user-owned hooks.json without manifest: $hooksPath"
    }
    Remove-EmptyManagedDirectories
}

function Remove-EmptyManagedDirectories {
    foreach ($target in @(
        "skills\timed-autonomous-run\schemas",
        "skills\timed-autonomous-run",
        "skills",
        "rules",
        "hooks",
        "agents"
    )) {
        $full = Resolve-ManagedTarget -RelativePath $target
        if (-not (Test-Path -LiteralPath $full -PathType Container)) {
            continue
        }
        $children = Get-ChildItem -LiteralPath $full -Force -ErrorAction SilentlyContinue
        if ($children) {
            continue
        }
        Write-Output "- remove empty directory: $full"
        if (-not $DryRun -and $PSCmdlet.ShouldProcess($full, "remove empty managed directory")) {
            Remove-Item -LiteralPath $full -Force
        }
    }
}

Write-Output "# Codex App Autonomous Uninstall Plan"
Write-Output ""

if (Test-Path -LiteralPath $manifestPath) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    Uninstall-FromManifest -Manifest $manifest
} else {
    Uninstall-Fallback
}

$backups = Get-ChildItem -LiteralPath $codexHomeResolved -Directory -Filter "backup-codex-app-autonomous-*" -ErrorAction SilentlyContinue
if ($backups) {
    Write-Output ""
    Write-Output "Backups remain available:"
    $backups | ForEach-Object { Write-Output "- $($_.FullName)" }
}

if ($DryRun) {
    Write-Output ""
    Write-Output "Dry run only. No files were removed."
}
