import { paint } from "../repl/ui";

// Pretty-printer for decisions.log.json entries (triage + ranking).
// Entries are defensive-parsed: a corrupt entry never breaks the readout.

export interface HarmEntry {
  key?: unknown;
  noul?: unknown;
  verdict?: unknown;
}

export interface ChoiceEntry {
  type?: unknown;
  choice?: unknown;
  confidence?: unknown;
  probabilities?: unknown;
}

export interface LogEntry {
  ts?: unknown;
  kind?: unknown;
  model?: unknown;
  unverified?: unknown;
  domain?: unknown;
  answers?: unknown;
  usage?: unknown;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = "?"): string {
  return typeof v === "string" ? v : fallback;
}

function formatProbs(probs: unknown): string {
  if (!probs || typeof probs !== "object") return "";
  const rows = Object.entries(probs as Record<string, unknown>)
    .map(([k, v]) => ({ k, v: num(v) }))
    .sort((a, b) => b.v - a.v);
  return rows.map(({ k, v }) => `${k}: ${v.toFixed(2)}`).join(", ");
}

function formatTriage(e: LogEntry): string[] {
  const a = (e.answers ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  lines.push(
    `  domain: ${paint.pick(str(a.domain ?? e.domain, "?"))}`
  );
  const parts: string[] = [];
  if (typeof a.complexity === "number") parts.push(`complexity ${a.complexity.toFixed(1)}`);
  if (typeof a.security === "number") parts.push(`security ${a.security.toFixed(1)}`);
  if (parts.length) lines.push(`  ${parts.join(" | ")}`);
  const harm = Array.isArray(a.harm) ? (a.harm as HarmEntry[]) : [];
  for (const h of harm) {
    const n = num(h.noul);
    const verdict = str(h.verdict, n > 0.75 ? "block" : n >= 0.45 ? "confirm" : "allow");
    const colored = verdict === "block" ? paint.block(verdict) : verdict === "confirm" ? paint.warn(verdict) : verdict;
    lines.push(`  harm ${str(h.key)}=${paint.prob(n.toFixed(2))} ${colored}`);
  }
  return lines;
}

function formatRanking(e: LogEntry): string[] {
  const a = (e.answers ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  for (const [axis, raw] of Object.entries(a)) {
    const ans = (raw ?? {}) as ChoiceEntry;
    if (ans.type !== "choice") {
      lines.push(`  ${axis}: ${str(ans.choice, JSON.stringify(raw))}`);
      continue;
    }
    const conf = num(ans.confidence);
    const confNote = conf < 0.45 ? paint.warn(" (low -- confirm with user)") : conf < 0.65 ? paint.warn(" (medium)") : "";
    lines.push(
      `  ${axis}: ${paint.pick(str(ans.choice))} (conf ${paint.prob(conf.toFixed(2))})${confNote}`
    );
    const probs = formatProbs(ans.probabilities);
    if (probs) lines.push(paint.detail(`    {${probs}}`));
  }
  return lines;
}

function entryCost(e: LogEntry): number {
  const u = (e.usage ?? {}) as Record<string, unknown>;
  return num(u.cost);
}

export function formatDecisionsLog(dir: string, entries: LogEntry[]): string {
  const out: string[] = [];
  out.push(paint.info(`Decisions for ${dir} (${entries.length} ${entries.length === 1 ? "entry" : "entries"}):`));
  entries.forEach((e, i) => {
    const kind = str(e.kind, "unknown");
    const model = str(e.model, "?") + (e.unverified === true ? paint.warn(" [unverified]") : "");
    out.push(`\n[${i + 1}] ${str(e.ts, "no-ts")} ${kind} (${model})`);
    if (kind === "triage") out.push(...formatTriage(e));
    else if (kind === "ranking") out.push(...formatRanking(e));
    else out.push(`  ${JSON.stringify(e.answers ?? {})}`);
    const cost = entryCost(e);
    if (cost > 0) out.push(paint.detail(`  cost $${cost.toFixed(8)}`));
  });
  const total = entries.reduce((s, e) => s + entryCost(e), 0);
  out.push(`\nTotal Jev cost: ${paint.prob(`$${total.toFixed(8)}`)} across ${entries.length} call(s).`);
  return out.join("\n");
}
