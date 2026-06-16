# AGENTS

This file contains project-specific rules for `/Users/kaya.matsumoto/projects/whatif/imagine`.

## GitHub Account

For this repository, use the personal GitHub account only.

- GitHub host: `github.com`
- GitHub account: `matsumotokaya`

Do not use the WealthPark account `kayamatsumoto` in this repository.

Before `git push`, PR creation, or `gh` operations:
- check `git remote -v`
- check `gh auth status`
- confirm `gh auth status` shows `matsumotokaya`

## Dev Server

- Start: `npm run dev`
- Local URL: http://localhost:5173 (Vite default)

## MCP Usage

When working in this project, do not call the AWS MCP.

Supabase MCP may be used when it is relevant to the task.

## Delegation Policy

When subagents are available, keep the main agent in an orchestrator role.

- Use the strongest available model for planning, review, and integration.
- Use a stronger coding subagent for substantive implementation or research when needed (for example GPT-5.5 / GPT-5.4 class).
- Use the cheapest capable subagent for lightweight work such as git push, small code edits, file moves, and simple investigation (for example GPT-5.4 mini class).
- When the main agent is operating on a frontier model, default lightweight delegated tasks to a GPT-5.4 mini class worker unless the task clearly needs a stronger model.
