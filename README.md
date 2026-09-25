# docs-agent

> CLI agent that turns a short project brief into a full SDLC doc set. **Jev decides, Ollama writes.**

Writing code with AI is easy when every stage has well-defined `.md` context (BRD, PRD, TRD, HLD, LLD, ...). Writing those files by hand is the hectic part. `docs-agent` automates it: you describe the idea in plain words, it asks ranked questions, then drafts, writes, and revises the docs.

## How it works

- **Ollama (local)** does conversation + markdown generation. Private, free, offline-capable. Single default model (e.g. `qwen2.5:14b`), switchable with `/model`.
- **Jev via OpenRouter (`typesafe/jev-1.13`)** makes every branching decision as typed answers -- `choice` (pick a stack), `score` (complexity/risk on a scale), `noul` (yes/no probability) -- with probabilities + confidence. No prose to parse.
- **Rule:** Ollama proposes 3-5 candidates per axis ordered best -> least (with scalability/security tradeoffs). Jev picks the winner. Low confidence (< 0.65) -> the CLI asks you with ranked options instead of guessing.
- **No hardcoded stacks.** Options are generated per domain (web, mobile, AIML, DevOps, security tooling, data, IoT), so any project field works.

```
brief -> Jev triage (domain, risk, harm) -> Ollama candidates -> Jev choice
  -> Ollama drafts docs -> diff preview -> confirm -> docs/ on disk
```

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) running locally (`ollama serve`) with at least one model, e.g.
  `ollama pull llama3.2:3b`
- An [OpenRouter](https://openrouter.ai) API key (for Jev). Without it the CLI runs in
  degraded `Ollama-judge` mode and marks decisions `unverified`.

## Quickstart

```bash
npm install
npm run build


cp .env.example .env   # then set OPENROUTER_API_KEY and OLLAMA_MODEL

node dist/cli.js status
node dist/cli.js init my-app
node dist/cli.js chat --dir my-app
node dist/cli.js generate --all
```

## Configuration (.env)

```
OPENROUTER_API_KEY=      # required for Jev decisions
JEV_MODEL=typesafe/jev-1.13
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_NUM_CTX=4096       # lower (e.g. 2048) if Ollama OOMs on small machines
```

## Commands

| Command | What it does |
|---|---|
| `init <name>` | Scaffold `<name>/docs/`, `projectState.json`, `decisions.log.json` |
| `chat --dir <path>` | Interview REPL: brief -> triage -> ranked options (arrow-key picker) -> saved state. `--dir` is required; never run from the agent repo root |
| `chat --dir <path> --fresh` | Same, but wipe previous interview state first |
| `reset --dir <path>` | Wipe `projectState.json` + `decisions.log.json` for a fresh start |
| `generate --all \| --doc <id>` | Draft docs in pipeline order (planned, v0.3) |
| `revise <file> "<instruction>"` | Rewrite a doc with diff preview + confirm (planned, v0.3) |
| `decisions --dir <path>` | Show Jev answers, confidences, distributions, and total cost (`--json` for raw log) |
| `status` / `doctor` | Health check for Ollama + Jev key |

## Doc set (generated per project, in order)

`BRD -> PRD -> SRS -> TRD -> HLD -> LLD -> FDD -> ADR -> Security -> Deployment -> Tasks -> QA`

Full definitions live in this repo's [`docs/`](docs/00-overview.md) folder -- the same set this
agent produces for your projects.

## Guardrails

1. **Jev pre-triage** runs before any generation: `noul` checks for malware/hacking,
   weapons/harm, and illicit requests. Score `> 0.75` blocks, `0.45-0.75` needs human confirm.
2. **Refusal + safe-complete** with a lawful defensive alternative. Prompt-injection
   phrasing ("ignore instructions", roleplay, obfuscation) does not bypass it.
3. **Sandboxed files** -- writes stay inside the project `workdir`, atomic + `.bak`,
   diff preview before overwrite. No shell execution in v1.
4. **Audit** -- every Jev call is appended to `decisions.log.json` with probabilities and cost.
   Cyber topics are defensive-only (logging, detection, hardening -- never exploits).

## Project structure

```
docs-agent/
  docs/                  # design docs for this project (BRD..QA + taxonomy + prompts)
  templates/             # per-doc generation templates (planned, v0.3)
  src/
    cli.ts               # commander entry: init/chat/generate/revise/decisions/status
    config.ts            # env loading + defaults
    decisions/jevClient.ts  # OpenRouter Decisions API + Zod-validated answers
    writers/ollamaClient.ts # local Ollama chat/generate + model discovery
    tools/files.ts       # workdir-sandboxed mkdir/write/edit
  .env.example
```

## Decision policy (thresholds)

- `choice/score confidence >= 0.65` -- auto-apply. `0.45-0.65` -- recommend + confirm. `< 0.45` -- must ask.
- `noul > 0.75` -- block (harm gates). `0.45-0.75` -- human confirm. `< 0.45` -- allow.
- Missing decision -> write `TODO(decision:<axis>)`, never hallucinate a stack.

## Cost notes

Jev input is ~$0.042/M tokens, outputs free. A typical 3-question call is ~450 tokens
(fractions of a cent) and answers in 70-500ms. Every response logs `usage.cost`.

## Roadmap

- [x] Design docs (`docs/`, 12 docs + taxonomy + prompts)
- [x] v0.1 skeleton: CLI + Ollama (4k ctx, think off) + file tools (templates pending)
- [x] v0.2 Jev layer: dynamic per-axis taxonomy + policy + triage guard + `decisions.log.json` + live `chat` interview (verified on llama3.2:3b)
- [x] Interview UX: required `--dir`, repo-root guard, resume/new prompt, `--fresh`, `reset`, arrow-key picker, role colors
- [x] `decisions --dir` readout with confidences and cost
- [ ] v0.3 full pipeline: all 12 docs, templates, chaining, `revise` flow
- [ ] v0.4 polish: `/model` picker, cost display, tests

## Style

While writing docs use `-` for hyphen, `--` for em-dash, `->` for arrow
(hyphen + greater-than). ASCII only. See `AGENTS.md`.

## License

TBD -- pick one (e.g. MIT) before first public push.
