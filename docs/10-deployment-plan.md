# 10 -- Deployment Plan (this project)

## 1. Prereqs
- Node 20+, Ollama (`ollama serve`, `ollama pull qwen2.5:14b`), `OPENROUTER_API_KEY`.

## 2. Env
```
OPENROUTER_API_KEY=
JEV_MODEL=typesafe/jev-1.13
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
```

## 3. Run (after scaffold)
```
npm install
npm run build
node dist/cli.js init my-app
node dist/cli.js chat
node dist/cli.js generate --all
```

## 4. Ops
- Pin `JEV_MODEL` minor version; `~typesafe/jev-latest` only for experiments.
- Monitor `decisions.log.json: usage.cost` (pennies per run, ~450 tokens/call).
- No secrets in repo; key server-side only. No browser exposure.
