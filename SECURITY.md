# Security Policy

## Scope

This repository contains Codex App configuration templates, hooks, rules, and
reviewer agent prompts. It does not provide a hosted service.

## Reporting Security Issues

Open a private security advisory on GitHub if available. If not, create an issue
with a minimal description and avoid posting secrets, tokens, private keys, or
private repository content.

## Default Guardrails

The templates are designed for high automation while blocking especially dangerous
actions:

- package publishing
- production deploys
- infrastructure changes
- Kubernetes/Helm changes
- destructive Git cleanup
- recursive force deletion
- secrets/private key writes
- destructive database operations

Normal local engineering work is intentionally allowed.

## User Responsibility

Hooks can run outside the sandbox. Review every hook before trusting it in Codex
App, and keep your own secrets out of repositories and progress logs.
