<!-- MODEL INSTRUCTIONS: Output ONLY the finished markdown document, no chatter, no fences. Component-level only: boxes, responsibilities, data flow. No classes/schemas (that is LLD). Use -> for flows. Replace every placeholder. Unknowns -> TODO(need:<what>). ASCII only. -->
# High Level Design -- {{project_name}}

> Date: {{date}} | Domain: {{domain}}

## 1. Context
<!-- Users, external systems, trust boundaries. -->

## 2. Containers
<!-- One subsection per container (frontend, API, workers, stores, infra): responsibility + why this choice fits. -->

## 3. Data flow
<!-- Numbered end-to-end steps with -> (client -> api -> worker -> db). Mark auth enforcement + PII touchpoints. -->

## 4. NFR mapping
<!-- Table: TRD requirement -> architectural answer (caching, replication, encryption, rate limits). -->

## 5. Repo layout
<!-- Map the decided repo_layout to folder topology. -->

## Appendix: inputs used
### Brief
{{brief}}

### Decisions
{{decisions_table}}

### Prior context
{{prior_summaries}}
