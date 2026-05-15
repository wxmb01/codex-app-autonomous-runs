# Installation

## Requirements

- Codex App
- PowerShell on Windows for the included installer
- Node.js only for running this repository's validation tests

## Preview

```powershell
.\scripts\Install-CodexAppAutonomous.ps1 -Merge -DryRun
```

## Install

```powershell
.\scripts\Install-CodexAppAutonomous.ps1 -Merge
```

The installer copies templates into your Codex home, backs up existing files that
would be replaced, and renders `hooks.json` with your local Codex home path.

After installing, open Codex App settings and trust the installed hooks.

## Cross-Platform Node Installer

```bash
node scripts/install.mjs --merge --dry-run
node scripts/install.mjs --merge
```

## Uninstall

```powershell
.\scripts\Uninstall-CodexAppAutonomous.ps1 -DryRun
.\scripts\Uninstall-CodexAppAutonomous.ps1
```

Or:

```bash
node scripts/uninstall.mjs --dry-run
node scripts/uninstall.mjs
```

## Validate This Repository

```powershell
npm test
```
