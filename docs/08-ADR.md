# 08 -- ADR (Architecture Decision Records)

## ADR-001: Jev decides, Ollama writes
- Context: Chat LLMs give uncalibrated prose for decisions; parsing is brittle.
- Decision: TypeSafe Jev (`choice/score/noul` + probabilities) for all branches; Ollama for prose.
- Consequence: Fast (70-500ms), cheap ($0.042/M in), typed, auditable.

## ADR-002: Dynamic criteria, fixed axes
- Context: Projects span web/mobile/AIML/DevOps/cyber; hardcoded stacks fail.
- Decision: Axes fixed (`compute/data/backend/frontend/infra/auth/repo_layout`), option values generated per brief by Ollama, ranked by Jev.
- Consequence: Covers any domain; requires candidate-JSON validation.

## ADR-003: Jev via OpenRouter
- Context: Need no-waitlist access + unified billing.
- Decision: `POST https://openrouter.ai/api/alpha/decisions`, `model=typesafe/jev-1.13`, `OPENROUTER_API_KEY`. Pin minor version in prod.
- Consequence: Same shape as TypeSafe direct; response `model` has dated suffix (expected); `usage.cost` logged.

## ADR-004: Single Ollama model
- Context: Simplicity for v1.
- Decision: One default (`qwen2.5:14b` or `llama3.1:8b`), temp split (0.7 chat / 0.2 docs). No router in v1.
- Consequence: Easy `/model` switch; revisit two-tier later.
