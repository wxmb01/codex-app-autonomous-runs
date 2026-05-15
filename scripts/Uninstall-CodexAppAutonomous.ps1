[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$CodexHome = (Join-Path $env:USERPROFILE ".codex"),
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$codexHomeResolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodexHome)
$targets = @(
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
    "hooks.json",
    "codex-app-autonomous-install-report.md"
)

Write-Output "# Codex App Autonomous Uninstall Plan"
foreach ($target in $targets) {
    $full = Join-Path $codexHomeResolved $target
    if (Test-Path -LiteralPath $full) {
        Write-Output "- remove: $full"
        if (-not $DryRun -and $PSCmdlet.ShouldProcess($full, "remove installed Codex App autonomous file")) {
            Remove-Item -LiteralPath $full -Recurse -Force
        }
    }
}

$backups = Get-ChildItem -LiteralPath $codexHomeResolved -Directory -Filter "backup-codex-app-autonomous-*" -ErrorAction SilentlyContinue
if ($backups) {
    Write-Output ""
    Write-Output "Backups remain available:"
    $backups | ForEach-Object { Write-Output "- $($_.FullName)" }
}
