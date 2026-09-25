<!-- MODEL INSTRUCTIONS: Output ONLY the finished markdown document, no chatter, no fences. Security-first: every section needs concrete controls, not vague advice. Scale controls to the security score in prior context. Defensive-only: no exploit code, payloads, or evasion. Replace every placeholder. ASCII only. -->
# Security Plan -- {{project_name}}

> Date: {{date}} | Domain: {{domain}}

## 1. Threat model
<!-- Top threats per STRIDE-lite (spoofing, tampering, info disclosure, abuse); one line each. -->

## 2. Authentication and authorization
<!-- Enforce the decided auth: flows, token/session handling, secret storage (never in code/logs). -->

## 3. Data protection
<!-- Encryption in transit/at rest, PII minimization, retention + deletion, backup policy. -->

## 4. Abuse and misuse
<!-- Rate limiting, spam/fraud controls, audit logging, incident response sketch. -->

## Appendix: inputs used
### Brief
{{brief}}

### Decisions
{{decisions_table}}

### Prior context
{{prior_summaries}}
