# 01 -- BRD (Business Requirements Document)

## 1. Problem
Developers lack consistent, stage-specific `.md` context (BRD/PRD/TRD...). Writing them manually is slow and inconsistent, leading to insecure / unscalable builds.

## 2. Objectives
- O1: From a 2-5 sentence brief, produce review-ready SDLC docs in `docs/`.
- O2: Every technical choice traceable to a calibrated Jev decision + probability.
- O3: Local-first writing (Ollama) -- no source idea leaves machine except Jev state via OpenRouter.
- O4: Refuse harmful requests (malware, hacking, weapons, fraud, CSAM, doxxing).

## 3. Users
- Primary: solo dev / small team starting new project (web, mobile, AIML, DevOps, security tooling).
- Secondary: reviewer / architect auditing decisions.

## 4. Scope
- In: CLI REPL, dynamic candidate proposal, Jev ranking, doc generation, revise loop, audit log.
- Out (v1): code generation, shell execution, web fetch, multi-model routing, GUI.

## 5. Success metrics
- Full doc set generated in <10 min on laptop Ollama.
- 100% of stack choices have `decisions.log.json` entry with `choice + confidence`.
- 100% of harm probes blocked before generation.
- User accepts top-1 Jev pick >=70% of time, else picks from ranked list.

## 6. Constraints
- Node 20+, Ollama running locally, `OPENROUTER_API_KEY` for Jev.
- Jev context 32k tokens (state + questions). Output tokens free, input $0.042/M.
- No hardcoded stacks -- options generated per domain.
