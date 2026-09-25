import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import { decide, type QuestionMap } from "./decisions/jevClient";
import {
  AXIS_QUESTIONS,
  axesForDomain,
  proposeCandidates,
  type AxisCandidates,
} from "./decisions/candidates";
import { runTriage, runTriageOllama } from "./decisions/triage";
import { appendDecisionLog, loadProjectState, saveProjectState } from "./state/store";
import { askConfirm, askPick, askResume, paint } from "./repl/ui";
import { resolveInWorkdir } from "./tools/files";

// Interview REPL: brief -> Jev triage -> Ollama candidates -> Jev ranking ->
// user picks per axis (ranked best-first) -> state saved for `generate`.

const QUIT = new Set(["/quit", "/exit", "/q"]);

function isQuit(text: string): boolean {
  return QUIT.has(text.trim().toLowerCase());
}

function isUsableBrief(brief: string): boolean {
  const t = brief.trim();
  return t.length >= 10 && !t.startsWith("/");
}

// Null-safe prompt. Piped stdin is slurped up front: back-to-back
// rl.question calls race with pipe close and can exit silently,
// so scripted runs serve answers from a queue instead.
let scriptedQueue: string[] | null = null;

async function readPipedLines(): Promise<string[]> {
  if (process.stdin.isTTY) return [];
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string | Buffer) => {
      data += chunk.toString();
    });
    process.stdin.on("end", () => resolve(data.split(/\r?\n/)));
    process.stdin.on("error", () => resolve([]));
  });
}

async function ask(rl: Interface, prompt: string): Promise<string | null> {
  if (scriptedQueue !== null) {
    output.write(prompt);
    const line = scriptedQueue.shift();
    return line === undefined ? null : line;
  }
  try {
    return await rl.question(prompt);
  } catch {
    return null;
  }
}

function printHelp(): void {
  console.log("Commands: /help (this), /quit (leave).");
  console.log("Answer picks with a number, an option id, or Enter to accept the top pick.");
  console.log("Any other text is saved as a custom note for that axis.");
}

// True when dir is the docs-agent repo itself (has our package + sources).
// Chat state must live in a project folder, never here.
function isAgentRepoDir(dir: string): boolean {
  const pkgFile = path.join(dir, "package.json");
  if (!fs.existsSync(pkgFile)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")) as { name?: unknown };
    return (
      pkg.name === "docs-agent" &&
      (fs.existsSync(path.join(dir, "src", "cli.ts")) ||
        fs.existsSync(path.join(dir, "src", "repl.ts")))
    );
  } catch {
    return false;
  }
}

export async function startChat(
  workdir: string,
  opts: { fresh?: boolean } = {}
): Promise<void> {
  if (isAgentRepoDir(workdir)) {
    console.log(paint.block(`Refusing: ${workdir} looks like the docs-agent repo itself.`));
    console.log(paint.info("Run chat against a project folder: node dist/cli.js chat --dir my-app"));
    return;
  }

  const rl = createInterface({ input, output });
  scriptedQueue = process.stdin.isTTY ? null : await readPipedLines();
  console.log(paint.info("docs-agent chat -- describe your project in 2-5 sentences. (/help, /quit)"));

  try {
    let state = loadProjectState(workdir);

    if (opts.fresh) {
      for (const f of ["projectState.json", "decisions.log.json"]) {
        const p = resolveInWorkdir(workdir, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      state = loadProjectState(workdir);
      console.log(paint.info("Fresh start -- previous interview state cleared."));
    }

    let brief = state.brief;
    if (isUsableBrief(brief)) {
      const resume = await askResume(brief, (prompt) => ask(rl, prompt));
      if (resume === null) {
        console.log("Bye.");
        return;
      }
      if (resume === "new") {
        state = { brief: "", domain: null, constraints: {}, answers: {}, jevDecisions: {} };
        brief = "";
      } else {
        console.log(`Loaded brief: ${brief}`);
      }
    }
    if (!isUsableBrief(brief)) {
      if (brief) {
        console.log(paint.warn(`Saved brief looks invalid ("${brief}"). Let's set a new one.`));
        state = { brief: "", domain: null, constraints: {}, answers: {}, jevDecisions: {} };
      }
      while (true) {
        const rawBrief = await ask(rl, "Brief> ");
        if (rawBrief === null || isQuit(rawBrief)) {
          console.log("Bye.");
          return;
        }
        const t = rawBrief.trim();
        if (/^\/help$/i.test(t)) {
          printHelp();
          continue;
        }
        if (!t || t.startsWith("/")) {
          console.log(paint.warn("Type a 2-5 sentence project description (commands start with /, descriptions don't)."));
          continue;
        }
        if (t.length < 10) {
          console.log(paint.warn("Too short -- describe the idea in 2-5 sentences."));
          continue;
        }
        brief = t;
        break;
      }
      state.brief = brief;
      saveProjectState(workdir, state);
    }

    // ---- Triage (domain + risk + harm) ----
    console.log(paint.info("Running triage..."));
    const hasJevKey = Boolean(config.openrouterApiKey);
    if (!hasJevKey) {
      console.log(paint.warn("No OPENROUTER_API_KEY -- Ollama-judge fallback, decisions marked unverified."));
    }
    const triage = hasJevKey ? await runTriage(brief) : await runTriageOllama(brief);
    appendDecisionLog(workdir, {
      kind: "triage",
      model: triage.model,
      unverified: triage.unverified,
      domain: triage.domain,
      answers: {
        domain: triage.domain,
        complexity: triage.complexity,
        security: triage.security,
        harm: triage.harm,
      },
    });

    const worst = triage.harm.reduce((a, b) => (b.noul > a.noul ? b : a), triage.harm[0]);
    if (worst && worst.verdict === "block") {
      console.log(
        paint.block(
          `Blocked: this looks like ${worst.key} (p=${worst.noul.toFixed(2)}). ` +
            "I can't help with malware, offensive hacking, weapons, or illicit builds. " +
            "I can help with a defensive alternative instead -- e.g. a secure-coding guide or detection runbook."
        )
      );
      return;
    }
    if (worst && worst.verdict === "confirm") {
      const proceed = await askConfirm(
        `Flagged as possibly ${worst.key} (p=${worst.noul.toFixed(2)}). Proceed with defensive-only scope?`,
        (prompt) => ask(rl, prompt)
      );
      if (!proceed) {
        console.log("Stopped. Nothing generated.");
        return;
      }
    }

    console.log(
      `Domain: ${paint.pick(triage.domain)} (confidence ${paint.prob(triage.domainConfidence.toFixed(2))}) | ` +
        `complexity ${triage.complexity.toFixed(1)} | security ${triage.security.toFixed(1)}` +
        (triage.unverified ? paint.warn(" | unverified") : "")
    );
    state.domain = triage.domain;
    state.jevDecisions = {
      ...state.jevDecisions,
      domain: triage.domain,
      complexity: triage.complexity,
      security: triage.security,
    };
    saveProjectState(workdir, state);

    // ---- Candidates (Ollama invents, ordered best-first) ----
    const axes = axesForDomain(triage.domain);
    console.log(paint.info(`Proposing options for: ${axes.join(", ")}...`));
    const candidates = await proposeCandidates(brief, triage.domain, axes, (axis, done, total) =>
      console.log(paint.detail(`  [${done}/${total}] ${axis} done`))
    );

    // ---- Ranking (Jev picks the winner per axis, one batched call) ----
    const order = new Map<string, AxisCandidates>();
    for (const c of candidates) order.set(c.axis, c);
    const rankedAxes = axes.filter((a) => order.has(a));

    const winners = new Map<string, { winner: string; probs: Record<string, number>; confidence: number }>();
    if (hasJevKey) {
      const questions: QuestionMap = {};
      for (const axis of rankedAxes) {
        const c = order.get(axis) as AxisCandidates;
        const criteria: Record<string, string> = {};
        for (const o of c.options) criteria[o.id] = o.description;
        questions[axis] = {
          type: "choice",
          instructions: AXIS_QUESTIONS[axis] ?? `Pick the best ${axis} for this brief.`,
          criteria,
        };
      }
      const res = await decide({ brief, domain: triage.domain }, questions);
      appendDecisionLog(workdir, { kind: "ranking", model: res.model, answers: res.answers, usage: res.usage });
      for (const axis of rankedAxes) {
        const ans = res.answers[axis];
        const fallback = (order.get(axis) as AxisCandidates).options[0].id;
        if (ans && ans.type === "choice") {
          winners.set(axis, { winner: ans.choice, probs: ans.probabilities, confidence: ans.confidence });
        } else {
          winners.set(axis, { winner: fallback, probs: {}, confidence: 0 });
        }
      }
    } else {
      for (const axis of rankedAxes) {
        const c = order.get(axis) as AxisCandidates;
        winners.set(axis, { winner: c.options[0].id, probs: {}, confidence: 0 });
      }
    }

    // ---- Per-axis questions, ranked best-first (arrow-key picker on TTY) ----
    for (const axis of rankedAxes) {
      const c = order.get(axis) as AxisCandidates;
      const rank = winners.get(axis) as { winner: string; probs: Record<string, number>; confidence: number };
      const sorted = [...c.options].sort(
        (a, b) => (rank.probs[b.id] ?? 0) - (rank.probs[a.id] ?? 0)
      );
      const pick = await askPick(
        axis,
        sorted.map((o) => ({
          id: o.id,
          prob: rank.probs[o.id],
          description: o.description,
          why: o.why,
          whenNot: o.whenNot,
        })),
        rank.winner,
        rank.confidence,
        (prompt) => ask(rl, prompt),
        printHelp
      );
      if (pick === null) {
        console.log(paint.info("Leaving interview. Progress saved."));
        saveProjectState(workdir, state);
        return;
      }
      state.answers[axis] = pick;
      state.jevDecisions[axis] = pick;
      saveProjectState(workdir, state);
    }

    console.log(paint.ok("\nDecisions saved to projectState.json:"));
    for (const axis of rankedAxes) console.log(`- ${axis}: ${paint.pick(state.answers[axis])}`);
    console.log(paint.info("Next: `generate --all` drafts the 12 docs (v0.3)."));
  } finally {
    rl.close();
  }
}
