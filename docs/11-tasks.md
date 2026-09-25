# 11 -- Tasks (v0.1 -> v0.4)

- [x] v0.1 skeleton: `cli/repl`, `ollamaClient` (4k ctx, think off), `files.ts`, `.env.example` (templates pending)
- [x] v0.2 Jev layer: `jevClient + taxonomy(dynamic, per-axis) + policy + guard(triage)`, `decisions.log.json`, OpenRouter integration, live `chat` interview (verified on llama3.2:3b)
- [x] v0.2 remaining: `decisions --dir` readout with confidences + cost (verified live); done: required `--dir`, repo-root guard, resume/new prompt, `--fresh`, `reset` command, piped-stdin hardening
- [x] v0.3 full SDLC: `generate` pipeline (12 templates, ordered, rolling summaries, low-conf flags, TODO on missing -- verified live for BRD/PRD/SRS with chaining); `revise` with diff preview + confirm + .bak (verified live)
- [ ] v0.3 remaining: full `--all` long-run on bigger hardware (same code path, ~30+ min on 8GB laptop); model-echo hardening ongoing
- [ ] v0.4 polish: `/model` via `ollama list`, offline Ollama-judge fallback, cost display, `doctor` command, tests (Zod schema, sandbox escape, refusal)

Review gate: user reviews `docs/` now before any `src/` code.
