import * as fs from "node:fs";
import * as path from "node:path";

// Doc set + template loading/rendering for the generate pipeline.
// Templates live in <repo-root>/templates (resolves from both src/ and dist/).

export interface DocSpec {
  id: string;
  file: string;
  title: string;
}

export const DOC_SET: DocSpec[] = [
  { id: "01-BRD", file: "01-BRD.md", title: "Business Requirements Document" },
  { id: "02-PRD", file: "02-PRD.md", title: "Product Requirements Document" },
  { id: "03-SRS", file: "03-SRS.md", title: "Software Requirements Specification" },
  { id: "04-TRD", file: "04-TRD.md", title: "Technical Requirements Document" },
  { id: "05-HLD", file: "05-HLD.md", title: "High Level Design" },
  { id: "06-LLD", file: "06-LLD.md", title: "Low Level Design" },
  { id: "07-FDD", file: "07-FDD.md", title: "Functional Design Document" },
  { id: "08-ADR", file: "08-ADR.md", title: "Architecture Decision Records" },
  { id: "09-SEC", file: "09-security-plan.md", title: "Security Plan" },
  { id: "10-DEP", file: "10-deployment-plan.md", title: "Deployment Plan" },
  { id: "11-TASK", file: "11-tasks.md", title: "Task Breakdown" },
  { id: "12-QA", file: "12-qa-checklist.md", title: "QA Checklist" },
];

export function findDocSpec(id: string): DocSpec | null {
  const norm = id.trim().toUpperCase();
  return DOC_SET.find((d) => d.id === norm || d.file.toLowerCase() === id.trim().toLowerCase()) ?? null;
}

export function templatesDir(): string {
  // Works from src/ (tsx dev), dist/writers/ (built), or any cwd:
  // walk upward for templates/01-BRD.md, then try cwd.
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "templates", "01-BRD.md"))) {
      return path.join(dir, "templates");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const cwdGuess = path.join(process.cwd(), "templates");
  if (fs.existsSync(path.join(cwdGuess, "01-BRD.md"))) return cwdGuess;
  throw new Error(`templates/ directory not found (searched upward from ${__dirname} and in cwd).`);
}

export function loadTemplate(id: string): string {
  const spec = findDocSpec(id);
  if (!spec) throw new Error(`Unknown doc id: ${id}. Valid: ${DOC_SET.map((d) => d.id).join(", ")}`);
  const file = path.join(templatesDir(), `${spec.id}.md`);
  if (!fs.existsSync(file)) throw new Error(`Template missing: ${file}`);
  return fs.readFileSync(file, "utf8");
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  const leftover = out.match(/\{\{[a-z_]+\}\}/);
  if (leftover) throw new Error(`Unfilled template token: ${leftover[0]}`);
  return out;
}

// Markdown table of decided axes for prompt injection + doc reuse.
export function decisionsTable(
  answers: Record<string, string>,
  confidences: Record<string, number> = {}
): string {
  const axes = Object.keys(answers);
  if (!axes.length) return "(no decisions yet -- interview with `chat` first)";
  const rows = axes.map((axis) => {
    const conf = confidences[axis];
    const flag =
      typeof conf === "number"
        ? conf < 0.45
          ? " (LOW -- confirm with user)"
          : conf < 0.65
            ? " (medium)"
            : ""
        : "";
    return `| ${axis} | ${answers[axis]} | ${typeof conf === "number" ? conf.toFixed(2) + flag : "n/a"} |`;
  });
  return ["| Axis | Decision | Confidence |", "|---|---|---|", ...rows].join("\n");
}

// System prompt for all doc-writing calls (from docs/14-system-prompts.md).
export const DOC_WRITER_SYSTEM = [
  "You are a senior BA and architect drafting SDLC documents.",
  "Output ONLY the finished markdown document: no chatter, no fences, no explanations.",
  "Follow the template's section structure exactly. HTML comments (<!-- ... -->) are instructions for you and must NOT appear in the output.",
  "Ground every statement in the brief, prior context, and decided stack. Never invent stack choices.",
  "Missing information becomes TODO(need:<what>), never a hallucinated fact.",
  "ASCII only: - for lists, -- for breaks, -> for flows.",
  "Defensive-only for security topics: no exploit code, payloads, or evasion.",
].join(" ");

// Short compression prompt for chaining: keeps prior docs inside small-model context.
export const SUMMARIZER_SYSTEM = [
  "You compress a finished SDLC document into ~10 dense lines for use as context",
  "when drafting later documents. Output ONLY the summary lines, no chatter.",
  "Keep: key decisions, entities, numbers, constraints, open TODOs. Drop prose.",
].join(" ");
