# 05 -- HLD (High Level Design)

## 1. Purpose
- Translate `04-TRD.md` constraints and Jev stack picks into a system architecture any domain (web, mobile, AIML, DevOps, security tooling) can implement.
- Stays component-level: boxes, responsibilities, data flow. No class or schema detail (that is `06-LLD.md`).

## 2. Inputs
- `projectState.json` (brief, domain, constraints) + Jev `choice` winners per axis + `score` levels (complexity, security criticality, scale).
- If a Jev decision is missing -> mark section `TODO(decision:<axis>)`, never invent a stack.

## 3. Required sections (per generated project)
1. **Context** - users, external systems, trust boundaries.
2. **Containers** - frontend, backend/API, workers (e.g. inference, scanners), data stores, infra (CI/CD, observability). One paragraph each: responsibility + why this choice fits scalability/security.
3. **Data flow** - request path end-to-end with numbered steps using `->` (e.g. `client -> api -> queue -> worker -> db`). Call out auth enforcement points and PII handling.
4. **NFR mapping** - table: requirement from TRD -> architectural answer (caching, replication, encryption, rate limits).
5. **Repo layout** - map Jev `repo_layout` pick (monorepo-turborepo, polyrepo, single) to folder topology.
6. **Decision refs** - header block listing Jev question IDs + winner + confidence.

## 4. Per-domain notes
- AIML: separate training vs serving paths, GPU scheduling, model registry, eval gate.
- DevOps: pipeline stages, promotion policy, rollback, secret handling.
- Security tooling: defensive-only scope, read-only scanners by default, audit log, least privilege.
- Web/mobile: BFF vs direct API, offline/sync strategy, push vs poll.

## 5. Exit criteria
- Every container traceable to a TRD constraint or Jev decision. Reviewer can challenge any box via `08-ADR.md`.
