# 09 -- Security Plan + Guardrails (blocking)

> User requirement: user must not be able to request harm, hacking, or immoral/unethical builds.

## 1. Layer 1 -- Jev pre-triage (before any Ollama generation)
- `state` = raw user brief (trimmed). Questions (one batched call):
  - `noul is_malware_hacking`: malware, RAT, keylogger, exploit, auth bypass, DDoS, phishing, ransomware
  - `noul is_weapon_harm`: weapons, CBRN, violence, self-harm
  - `noul is_illicit`: fraud, theft, CSAM, doxxing, stalking, privacy invasion
  - `score severity` [benign, dual-use, directly harmful]
- Policy: any noul `>0.75` or severity high -> **block + safe-complete**, no partial instructions. `0.45-0.75` -> warn + require explicit defensive-only reframe or human confirm. `<0.45` -> allow.
- Dual-use (esp. cyber): only **defensive/blue-team** docs allowed (logging, detection, hardening). No exploit code, payloads, evasion.

## 2. Layer 2 -- Ollama system refusal
- Hard rule in every prompt (see `14-system-prompts.md`): refuse blocked categories, offer lawful alternative. No `ignore previous instructions` bypass. No base64/translation tricks -- triage on normalized text.

## 3. Layer 3 -- Tool sandbox
- `workdir`-only writes, deny `..` escape. No shell exec, no network fetch in v1. Atomic writes + `.bak`. Never write secrets/keys into docs (redact to `<redacted>`).

## 4. Layer 4 -- Audit
- `decisions.log.json` appends every triage + decision with `usage.cost`. Blocked prompts stored redacted. `09-security-guardrails.md` per generated project must include abuse/misuse + mitigations section.
- Jailbreak attempts (`DAN`, `do anything now`, roleplay to evade) treated as `is_illicit >=0.75` -> block.
