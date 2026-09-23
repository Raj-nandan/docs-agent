# 02 -- PRD (Product Requirements Document)

## 1. CLI commands (v1)
- `init <name>` -- scaffold `<name>/docs/`, `projectState.json`, `decisions.log.json`
- `chat` -- REPL: free brief -> clarifying questions with ranked options -> generate
- `generate --all | --doc <id>` -- run pipeline in order
- `revise <path> "<instruction>"` -- rewrite with diff preview + confirm
- `decisions` -- show last Jev answers + cost; `status` -- Ollama/Jev health

## 2. UX rules
- Discovery: Ollama asks max 1-2 questions at a time, each with **ranked options best->least** + 1-line tradeoff (scalability/security/cost). Always include `confidence` and `probabilities` from Jev when available.
- Thresholds: `confidence >=0.65` auto-apply; `0.45-0.65` recommend + confirm; `<0.45` must ask. Noul `>0.75` block, `0.45-0.75` human confirm.
- Every generated doc header includes: `Decision refs` (Jev question IDs + winner + confidence) so reviewer can trace.
- No shell execution in v1. File writes sandboxed to project `workdir`, atomic + `.bak`, diff preview.

## 3. Doc set (full, ordered)
1. `01-BRD.md` 2. `02-PRD.md` 3. `03-SRS.md` 4. `04-TRD.md` 5. `05-HLD.md` 6. `06-LLD.md`
7. `07-FDD.md` 8. `08-ADR.md` 9. `09-security-guardrails.md` 10. `10-deployment-plan.md` 11. `11-tasks.md` 12. `12-qa-checklist.md`
- Each stage injects prior docs as context. If a decision is missing -> write `TODO(decision:<axis>)`, never hallucinate stack.

## 4. Non-functional
- Offline degrade: no `OPENROUTER_API_KEY` -> `Ollama-judge mode` with warning, same Zod schema, marked `unverified`.
- Latency: Jev 70-500ms; Ollama doc ~30-120s per file on 14b laptop model.
- Privacy: brief sent to Jev trimmed to need-to-know; full docs never sent to Jev, only to local Ollama.
