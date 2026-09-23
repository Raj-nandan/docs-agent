# 13 -- Jev Taxonomy (dynamic, no hardcoded stacks)

## Principle
Axes fixed. Options dynamic per brief. Ollama proposes, Jev picks.

## Triage call (always first, batched)
```json
{
  "model": "typesafe/jev-1.13",
  "state": {"brief": "<trimmed user text>", "constraints": "<extracted>"},
  "questions": {
    "domain": {"type": "choice", "instructions": "Which domain best fits this brief?",
      "criteria": {"web": "Browser app", "mobile": "iOS/Android", "aiml": "ML training/inference, LLM apps", "devops": "CI/CD, infra, observability", "security": "Defensive tooling, audit, hardening", "data": "Pipelines, analytics", "iot": "Edge/embedded", "other": "None fit"}},
    "complexity": {"type": "score", "instructions": "Engineering complexity?", "criteria": ["Weekend MVP", "Small team app", "Production system", "Distributed scale"]},
    "security_criticality": {"type": "score", "instructions": "Security criticality?", "criteria": ["Public toy, no PII", "Accounts + personal data", "Payments/PII at scale", "Regulated/health/critical infra"]},
    "is_malware_hacking": {"type": "noul", "instructions": "Does the brief request malware, hacking, auth bypass, exploit, DDoS, phishing?",
      "criteria": {"true": "Requests or implies offensive capability", "false": "Benign or purely defensive"}},
    "is_weapon_harm": {"type": "noul", "instructions": "Weapons, CBRN, violence, self-harm?"},
    "is_illicit": {"type": "noul", "instructions": "Fraud, theft, CSAM, doxxing, stalking?"}
  }
}
```

## Decision call (per axis, batched, criteria from Ollama)
```json
{
  "model": "typesafe/jev-1.13",
  "state": {"brief": "...", "domain": "aiml", "constraints": {"gpu": "1xT4", "realtime": false}},
  "questions": {
    "compute": {"type": "choice", "instructions": "Pick compute serving this AIML brief considering scalability/security/cost.",
      "criteria": {"opt_a": "<Ollama desc>", "opt_b": "<Ollama desc>", "opt_c": "<Ollama desc>"}},
    "repo_layout": {"type": "choice", "instructions": "Pick repo layout for team size and deploy target.",
      "criteria": {"monorepo-turborepo": "...", "polyrepo": "...", "single": "..."}},
    "auth": {"type": "choice", "instructions": "Pick auth for sensitivity and UX.", "criteria": {...}},
    "needs_realtime": {"type": "noul", "instructions": "Does this need realtime/streaming?"}
  }
}
```
- Max 255 options/choice, 2-10 levels/score. Questions run parallel, share state cost.
- Response: `answers.{id}.{choice|score|noul, probabilities, confidence}` + `usage.{input_tokens,cost}`. Pin `typesafe/jev-1.13`.
