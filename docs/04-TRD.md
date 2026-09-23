# 04 -- TRD (Technical Requirements Document)

## 1. Stack (this project)
- Runtime: Node 20+, TypeScript strict, ESM. Libs: `commander, @inquirer/prompts, chalk, ollama, zod, fs-extra`.
- No framework tax: plain `fetch` to OpenRouter + Ollama. No LangChain in v1.

## 2. Module map
```
src/cli.ts -> src/repl.ts -> src/orchestrator.ts (DISCOVER->DECIDE->DRAFT->REVIEW)
src/decisions/{jevClient.ts, taxonomy.ts, policy.ts, guard.ts}
src/writers/{ollamaClient.ts, prompts.ts, pipeline.ts}
src/tools/files.ts  src/state/store.ts  src/config.ts
```

## 3. Key flows
- **Dynamic decide:** `brief -> Jev domain triage -> Ollama candidates(JSON) -> Jev choice (batched, parallel) -> policy -> store`. Pin `JEV_MODEL=typesafe/jev-1.13` (dated snapshot in response is expected).
- **Draft:** `projectState + jevDecisions + template -> Ollama (temp 0.2) -> sanitize (strip chatter/fences) -> atomic write`.
- **Triage:** Jev nouls run *before* any generation; block short-circuits pipeline.

## 4. Error handling
- Jev 401/402 -> tell user to set/top-up `OPENROUTER_API_KEY`, offer Ollama-judge fallback.
- Jev timeout -> once, then fallback + mark `unverified`.
- Ollama down -> `doctor` hint (`ollama serve`, `ollama pull <model>`).
- Probabilities vary run-to-run -> threshold on bands, never exact equality.

## 5. Project structure (to scaffold after review)
```
docs-agent/ docs/ templates/ src/ .env.example  projectState.json  decisions.log.json
```
