# 11 -- Tasks (v0.1 -> v0.4)

- [x] v0.1 skeleton: `cli/repl`, `ollamaClient` (4k ctx, think off), `files.ts`, `.env.example` (templates pending)
- [x] v0.2 Jev layer: `jevClient + taxonomy(dynamic, per-axis) + policy + guard(triage)`, `decisions.log.json`, OpenRouter integration, live `chat` interview (verified on llama3.2:3b)
- [ ] v0.2 remaining: `decisions` command reader
- [ ] v0.3 full SDLC: `generate` pipeline (all 12 docs), templates, chaining, `revise` diff flow, confidence escalation UX, `TODO` on missing
- [ ] v0.4 polish: `/model` via `ollama list`, offline Ollama-judge fallback, cost display, `doctor` command, tests (Zod schema, sandbox escape, refusal)

Review gate: user reviews `docs/` now before any `src/` code.
