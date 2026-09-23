# 07 -- FDD (Functional Design Document)

## 1. Discovery loop
- Input: 2-5 sentence brief. Ollama extracts `domain guess + constraints + unknowns`.
- Jev confirms domain (`choice: web|mobile|aiml|devops|security|data|iot|other`) + risk scores.
- Per axis, Ollama proposes candidates JSON (3-5, best->least). Example AIML axis `compute`: `torchtitan-gpu / triton-tensorrt / ollama-cpu / sagemaker` each with `why/scalability/security/cost/whenNot`.
- Jev `choice` per axis in **one batched call** (questions share state, run parallel). Display ranked with `probabilities`.

## 2. Question UX
- Ask 1-2 axes at a time. Format: `Q: Backend? 1) FastAPI (0.71) -- best for ML serving... 2) NestJS (0.22)... 3) Go-Gin (0.07)... [recommend 1, confirm?]`
- Never ask open-ended stack questions without options.

## 3. Generation order + chaining
`BRD -> PRD -> SRS -> TRD -> HLD -> LLD -> FDD -> ADR -> security -> deployment -> tasks -> QA`. Each prompt receives prior summaries (trimmed to fit Ollama context), plus full `jevDecisions`.

## 4. Revise
`read -> Ollama rewrite with instruction -> unified diff -> confirm -> write + .bak`.
