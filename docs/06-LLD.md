# 06 -- LLD (Low Level Design)

## 1. Purpose
- Detail the internals of each `05-HLD.md` container: modules, interfaces, data models, error paths. Must be implementable without revisiting architecture.

## 2. Inputs
- `05-HLD.md` + Jev decisions + `04-TRD.md`. Any HLD `TODO` must be resolved first - LLD never overrides HLD silently (raise an ADR instead).

## 3. Required sections (per module)
1. **Interface** - functions/endpoints, request/response shapes, auth scope. Use tables, not prose.
2. **Data model** - entities, keys, indexes, retention. Mark PII/secrets fields and redaction rule (`<redacted>` in logs/docs).
3. **Logic** - happy path + edge cases + failure mapping (retry, idempotency, DLQ). Numbered steps with `->` for handoffs.
4. **Validation** - input schemas (Zod/equivalent), limits, rate rules.
5. **Security notes** - per-module threats + mitigations, linked to `09-security-guardrails.md` policy (no exploit code, defensive-only for security tooling).
6. **Test hooks** - unit/integration points feeding `12-qa-checklist.md`.

## 4. Rules
- One module per section; each section ends with `Trace: HLD-<container> / TRD-<req> / Jev-<questionId>`.
- No new tech choices here - if code needs a library the HLD/TRD missed, send it back to Jev `choice` and record in `08-ADR.md`.
- Keep ASCII only: `-` for lists, `--` for breaks, `->` for flows.
