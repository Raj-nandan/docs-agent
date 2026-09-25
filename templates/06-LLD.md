<!-- MODEL INSTRUCTIONS: Output ONLY the finished markdown document, no chatter, no fences. Detail HLD containers: interfaces, models, logic, validation. No new tech choices -- anything missing goes back as TODO(decision:<axis>). End each module with a Trace line. Replace every placeholder. ASCII only. -->
# Low Level Design -- {{project_name}}

> Date: {{date}} | Domain: {{domain}}

## 1. Modules
<!-- One subsection per module: interface (endpoints/functions + shapes), data model (entities/keys, mark PII), logic (happy path + edge + failure handling), validation rules. -->

## 2. Error handling
<!-- Error taxonomy + retry/idempotency/DLQ policy per module. -->

## 3. Security notes
<!-- Per-module threats + mitigations. Defensive-only: no exploit code. -->

## 4. Traceability
<!-- One line per module: Trace: HLD-<container> / TRD-<req> / Jev-<questionId>. -->

## Appendix: inputs used
### Brief
{{brief}}

### Decisions
{{decisions_table}}

### Prior context
{{prior_summaries}}
