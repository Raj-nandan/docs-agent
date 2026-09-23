# 12 -- QA Checklist

- [ ] Brief -> ranked options shown best->least with tradeoffs, never hardcoded stack
- [ ] Every stack pick has Jev `choice + probabilities + confidence` in `decisions.log.json`
- [ ] Low confidence (`<0.65`) forces user confirm; never silent auto-apply
- [ ] Harm brief (malware/hack/weapon/fraud prompt) blocked before generation, redacted log
- [ ] Dual-use cyber brief -> defensive-only docs, no exploits
- [ ] Missing decision -> `TODO(decision:<axis>)`, no hallucinated stack
- [ ] HLD containers all trace to TRD/Jev; LLD modules all carry `Trace: HLD-<container> / TRD-<req> / Jev-<questionId>`
- [ ] Writes sandboxed to workdir, `..` rejected, diff preview + `.bak`
- [ ] No `OPENROUTER_API_KEY` -> warning + Ollama-judge `unverified` mode, pipeline still runs
- [ ] Ollama down -> clear `doctor` message; Jev 401/402 -> top-up hint
- [ ] Cost per run visible via `decisions` command
