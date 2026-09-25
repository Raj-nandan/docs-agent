import pc from "picocolors";
import { confirm, input, select } from "@inquirer/prompts";

// Colors + interactive prompts for the chat REPL.
// picocolors auto-disables when output is piped, so logs stay clean there.
// Inquirer needs a real TTY; every helper falls back to plain-text readline
// (via the injected ask fn) when stdin/stdout is piped, e.g. scripted runs.

// ---- Role colors (TTY-only, honoring NO_COLOR; piped output stays clean) ----
const COLORS_ON =
  Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.NO_COLOR;
const plain = (s: string): string => s;

export const paint = {
  info: COLORS_ON ? (s: string): string => pc.dim(s) : plain,
  question: COLORS_ON ? (s: string): string => pc.bold(pc.cyan(s)) : plain,
  pick: COLORS_ON ? (s: string): string => pc.green(s) : plain,
  detail: COLORS_ON ? (s: string): string => pc.dim(s) : plain,
  prob: COLORS_ON ? (s: string): string => pc.yellow(s) : plain,
  warn: COLORS_ON ? (s: string): string => pc.yellow(s) : plain,
  block: COLORS_ON ? (s: string): string => pc.red(s) : plain,
  ok: COLORS_ON ? (s: string): string => pc.green(s) : plain,
};

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

// Plain-text answer resolution shared by both picker modes:
// number -> ranked option, exact/partial id match, else custom note.
export function resolvePick(ids: string[], winner: string, answer: string): string {
  if (!answer) return winner;
  const n = Number(answer);
  if (Number.isInteger(n) && n >= 1 && n <= ids.length) return ids[n - 1];
  const lower = answer.toLowerCase();
  const exact = ids.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  const partial = ids.find(
    (id) => id.toLowerCase().includes(lower) || lower.includes(id.toLowerCase())
  );
  if (partial) return partial;
  return `custom: ${answer}`;
}

export interface PickOption {
  id: string;
  prob?: number;
  description: string;
  why?: string;
  whenNot?: string;
}

const QUIT_VALUE = "__quit__";
const CUSTOM_VALUE = "__custom__";
const HELP_VALUE = "__help__";

// Returns the winning option id, "custom: ...", or null on quit.
export async function askPick(
  axis: string,
  options: PickOption[],
  winner: string,
  confidence: number,
  // readline fallback for piped stdin; returns null on EOF.
  textAsk: (prompt: string) => Promise<string | null>,
  onHelp: () => void
): Promise<string | null> {
  const ids = options.map((o) => o.id);

  if (!isInteractive()) {
    console.log(paint.question(`\n${axis} (Jev pick: ${winner}, confidence ${confidence.toFixed(2)}):`));
    options.forEach((o, i) => {
      const p = typeof o.prob === "number" ? ` (${o.prob.toFixed(2)})` : "";
      console.log(`${i + 1}) ${paint.pick(o.id)}${paint.prob(p)} -- ${o.description}`);
      if (o.why) console.log(paint.detail(`   tradeoff: ${o.why}`));
      if (o.whenNot) console.log(paint.detail(`   avoid when: ${o.whenNot}`));
    });
    const raw = (await textAsk(`Pick for ${axis} [Enter=${winner}]: `)) ?? "";
    const answer = raw.trim();
    if (!answer) return winner;
    if (answer.toLowerCase() === "/quit" || answer.toLowerCase() === "/exit" || answer.toLowerCase() === "/q") {
      return null;
    }
    if (/^\/help$/i.test(answer)) {
      onHelp();
      const retry = (await textAsk(`Pick for ${axis} [Enter=${winner}]: `)) ?? "";
      return resolvePick(ids, winner, retry.trim());
    }
    return resolvePick(ids, winner, answer);
  }

  const choices = options.map((o, i) => ({
    name: `${i + 1}) ${o.id}${typeof o.prob === "number" ? ` (${o.prob.toFixed(2)})` : ""} -- ${o.description}`,
    value: o.id,
    description: [o.why && `tradeoff: ${o.why}`, o.whenNot && `avoid when: ${o.whenNot}`]
      .filter(Boolean)
      .join(" | "),
  }));
  const answer: string = await select({
    message: `Pick ${axis} (Jev: ${winner}, confidence ${confidence.toFixed(2)})`,
    choices: [
      ...choices,
      { name: "Custom answer...", value: CUSTOM_VALUE },
      { name: "Show help", value: HELP_VALUE },
      { name: "Quit interview", value: QUIT_VALUE },
    ],
  });
  if (answer === QUIT_VALUE) return null;
  if (answer === HELP_VALUE) {
    onHelp();
    return askPick(axis, options, winner, confidence, textAsk, onHelp);
  }
  if (answer === CUSTOM_VALUE) {
    const text = await input({ message: `Custom answer for ${axis}:` });
    return resolvePick(ids, winner, text.trim());
  }
  return answer;
}

export async function askConfirm(
  message: string,
  textAsk: (prompt: string) => Promise<string | null>
): Promise<boolean> {
  if (!isInteractive()) {
    const ok = (await textAsk(`${message} (y/n) `)) ?? "n";
    return /^y(es)?$/i.test(ok.trim());
  }
  return confirm({ message, default: false });
}

// Resume-or-start-new gate for a saved brief.
// Returns "resume", "new", or null on quit. Empty piped input resumes
// (preserves old headless behavior).
export async function askResume(
  brief: string,
  textAsk: (prompt: string) => Promise<string | null>
): Promise<"resume" | "new" | null> {
  const short = brief.length > 80 ? brief.slice(0, 77) + "..." : brief;
  if (!isInteractive()) {
    const raw = (await textAsk(`Saved brief: "${short}". Resume it? [resume/new]: `)) ?? "";
    const t = raw.trim().toLowerCase();
    if (!t || t === "resume" || t === "r" || t.startsWith("y")) return "resume";
    if (t === "new" || t === "n") return "new";
    if (t === "/quit" || t === "/exit" || t === "/q") return null;
    return "resume";
  }
  const answer: string = await select({
    message: `Saved brief: "${short}"`,
    choices: [
      { name: "Resume this brief", value: "resume" },
      { name: "Start a new brief", value: "new" },
      { name: "Quit", value: "quit" },
    ],
  });
  if (answer === "quit") return null;
  return answer as "resume" | "new";
}
