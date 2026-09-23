# docs-agent -- Overview

> Status: DRAFT for review. No code yet.

## What
CLI agent that turns a brief project idea into a full SDLC doc set (`BRD -> PRD -> SRS -> TRD -> HLD -> LLD -> FDD -> ADR -> Security -> Deployment -> Tasks -> QA`).

## Why
Writing code with AI is easy if `.md` context per stage is well-defined. Writing those `.md` files is hectic. This agent automates it.

## How -- Jev decides, Ollama writes
- **Ollama (local, single default model e.g. `llama3.2:3b`):** conversation + markdown generation. Private, free, offline-capable.
- **Jev via OpenRouter (`typesafe/jev-1.13`, `POST /api/alpha/decisions`):** typed decisions only -- `choice / score / noul` + probabilities + confidence. No prose. Used for every branch: tech stack, repo layout, auth, infra, risk gates.
- **Rule:** Ollama proposes candidates, Jev disposes. Never parse prose to decide.

## Locked choices
- Lang: **Node.js + TypeScript**
- Jev access: **OpenRouter API key**
- Ollama: **single default model**, switch via `/model`, discover via `ollama list`
- Doc scope: **full SDLC set**

## Flow
1. `init` -> scaffold `docs/`
2. `chat` -> user describes idea briefly
3. Build `projectState.json` -> Jev triage (domain, risk, harm)
4. Ollama proposes 3-5 ranked options per axis best->least -> Jev `choice` picks winner
5. If `confidence < 0.65` -> ask user with ranked options, else auto-apply
6. Ollama generates docs with Jev decisions as hard constraints
7. `revise <file> "<instruction>"` -> diff preview -> confirm

See: `01-BRD.md`, `02-PRD.md`, `03-SRS.md`, `04-TRD.md`, `05-HLD.md`, `06-LLD.md`, `13-jev-taxonomy.md`, `14-system-prompts.md`, `09-security-guardrails.md`.
