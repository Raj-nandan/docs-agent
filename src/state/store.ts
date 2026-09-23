import * as fs from "node:fs";
import { resolveInWorkdir, writeFileAtomic } from "../tools/files";

// Persistent per-project state: the brief, Jev outcomes, and user picks.
// Stored as <projectDir>/projectState.json. Decisions audit goes to decisions.log.json.

export interface ProjectState {
  brief: string;
  domain: string | null;
  constraints: Record<string, unknown>;
  answers: Record<string, string>;
  jevDecisions: Record<string, unknown>;
}

export function emptyState(): ProjectState {
  return { brief: "", domain: null, constraints: {}, answers: {}, jevDecisions: {} };
}

export function loadProjectState(workdir: string): ProjectState {
  const file = resolveInWorkdir(workdir, "projectState.json");
  if (!fs.existsSync(file)) return emptyState();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<ProjectState>;
    return {
      brief: typeof parsed.brief === "string" ? parsed.brief : "",
      domain: typeof parsed.domain === "string" ? parsed.domain : null,
      constraints:
        parsed.constraints && typeof parsed.constraints === "object"
          ? (parsed.constraints as Record<string, unknown>)
          : {},
      answers:
        parsed.answers && typeof parsed.answers === "object"
          ? (parsed.answers as Record<string, string>)
          : {},
      jevDecisions:
        parsed.jevDecisions && typeof parsed.jevDecisions === "object"
          ? (parsed.jevDecisions as Record<string, unknown>)
          : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveProjectState(workdir: string, state: ProjectState): void {
  writeFileAtomic(workdir, "projectState.json", JSON.stringify(state, null, 2) + "\n");
}

export function appendDecisionLog(workdir: string, entry: Record<string, unknown>): void {
  const file = resolveInWorkdir(workdir, "decisions.log.json");
  let log: unknown[] = [];
  if (fs.existsSync(file)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(parsed)) log = parsed;
    } catch {
      log = [];
    }
  }
  log.push({ ts: new Date().toISOString(), ...entry });
  writeFileAtomic(workdir, "decisions.log.json", JSON.stringify(log, null, 2) + "\n");
}
