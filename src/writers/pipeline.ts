import * as fs from "node:fs";
import * as path from "node:path";
import { loadProjectState } from "../state/store";
import { backupIfExists, ensureDir, resolveInWorkdir, writeFileAtomic } from "../tools/files";
import { chat as ollamaChat, generateDoc } from "./ollamaClient";
import {
  decisionsTable,
  DOC_SET,
  findDocSpec,
  loadTemplate,
  renderTemplate,
  SUMMARIZER_SYSTEM,
  DOC_WRITER_SYSTEM,
  type DocSpec,
} from "./templates";

// Ordered doc generation with rolling summaries (fits small-model context).
// --doc generates one spec (still chained on existing docs/ files);
// without docId the full DOC_SET runs in order.

export interface GenerateReport {
  generated: string[];
  warnings: string[];
  dir: string;
}

interface RankingAnswer {
  confidence?: unknown;
}

function readRankingConfidences(workdir: string): Record<string, number> {
  try {
    const file = resolveInWorkdir(workdir, "decisions.log.json");
    if (!fs.existsSync(file)) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) return {};
    const rankings = parsed.filter(
      (e) => typeof e === "object" && e !== null && (e as { kind?: unknown }).kind === "ranking"
    );
    if (!rankings.length) return {};
    const answers = (rankings[rankings.length - 1] as { answers?: unknown }).answers;
    if (!answers || typeof answers !== "object") return {};
    const out: Record<string, number> = {};
    for (const [axis, raw] of Object.entries(answers as Record<string, unknown>)) {
      const c = (raw as RankingAnswer | null)?.confidence;
      if (typeof c === "number" && Number.isFinite(c)) out[axis] = c;
    }
    return out;
  } catch {
    return {};
  }
}

async function summarize(text: string): Promise<string> {
  const capped = text.length > 6000 ? text.slice(0, 6000) : text;
  const out = await ollamaChat(
    [
      { role: "system", content: SUMMARIZER_SYSTEM },
      { role: "user", content: capped },
    ],
    { temperature: 0.1 }
  );
  return out.trim();
}

function contextBlock(summaries: Array<{ title: string; text: string }>): string {
  if (!summaries.length) return "(none yet)";
  const joined = summaries.map((s) => `### ${s.title}\n${s.text}`).join("\n\n");
  // Keep the tail (most recent docs matter most) inside a small budget.
  const budget = 3000;
  return joined.length > budget ? "...(earlier trimmed)\n" + joined.slice(-budget) : joined;
}

export async function generateDocs(
  workdir: string,
  opts: { docId?: string } = {}
): Promise<GenerateReport> {
  const state = loadProjectState(workdir);
  if (!state.brief || state.brief.trim().length < 10) {
    throw new Error("No usable brief in projectState.json. Run chat first.");
  }

  let specs: DocSpec[];
  if (opts.docId) {
    const spec = findDocSpec(opts.docId);
    if (!spec) {
      throw new Error(
        `Unknown doc: ${opts.docId}. Valid: ${DOC_SET.map((d) => d.id).join(", ")}`
      );
    }
    specs = [spec];
  } else {
    specs = DOC_SET;
  }

  ensureDir(workdir, "docs");
  const confidences = readRankingConfidences(workdir);
  const projectName = path.basename(path.resolve(workdir));
  const date = new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];
  if (!Object.keys(state.answers).length) {
    warnings.push("No Jev decisions recorded -- docs will carry TODOs. Run chat first for best results.");
  }
  for (const [axis, c] of Object.entries(confidences)) {
    if (c < 0.45) warnings.push(`${axis}: low Jev confidence (${c.toFixed(2)}) -- flagged for human review.`);
  }

  const selected = new Set(specs.map((s) => s.id));
  const summaries: Array<{ title: string; text: string }> = [];
  const generated: string[] = [];

  for (const spec of DOC_SET) {
    const target = resolveInWorkdir(workdir, `docs/${spec.file}`);
    if (!selected.has(spec.id)) {
      // Not selected: fold existing file into context if present.
      if (fs.existsSync(target)) {
        try {
          summaries.push({ title: spec.title, text: await summarize(fs.readFileSync(target, "utf8")) });
        } catch {
          // Unreadable prior doc: skip it, keep going.
        }
      }
      continue;
    }
    const prompt = renderTemplate(loadTemplate(spec.id), {
      project_name: projectName,
      date,
      brief: state.brief,
      domain: state.domain ?? "unknown",
      decisions_table: decisionsTable(state.answers, confidences),
      prior_summaries: contextBlock(summaries),
    });
    const text = await generateDoc(DOC_WRITER_SYSTEM, prompt);
    backupIfExists(workdir, `docs/${spec.file}`);
    writeFileAtomic(workdir, `docs/${spec.file}`, text);
    generated.push(`docs/${spec.file}`);
    try {
      summaries.push({ title: spec.title, text: await summarize(text) });
    } catch {
      summaries.push({ title: spec.title, text: "(summary unavailable)" });
    }
  }

  return { generated, warnings, dir: path.resolve(workdir) };
}
