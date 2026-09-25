<!-- MODEL INSTRUCTIONS: Output ONLY the finished markdown document, no chatter, no fences. Concrete runbook style: commands, env vars (no real secrets -- use <redacted>/placeholders), and rollback. Replace every placeholder. ASCII only. -->
# Deployment Plan -- {{project_name}}

> Date: {{date}} | Domain: {{domain}}

## 1. Target and topology
<!-- Enforce the decided deploy target + repo layout: what runs where. -->

## 2. Environments
<!-- dev/staging/prod: differences, promotion rule, seed data. -->

## 3. Release steps
<!-- Numbered steps: build -> migrate -> deploy -> verify. Include health checks. -->

## 4. Rollback and ops
<!-- Rollback procedure, monitoring, alerting, backups, secret rotation. -->

## Appendix: inputs used
### Brief
{{brief}}

### Decisions
{{decisions_table}}

### Prior context
{{prior_summaries}}
