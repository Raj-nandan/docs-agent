import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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

// Null-safe prompt: piped/closed stdin yields null instead of throwing
// ERR_USE_AFTER_CLOSE, so scripted runs degrade to defaults.
async function ask(rl: Interface, prompt: string): Promise<string | null> {
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

export async function startChat(workdir: string): Promise<void> {
  const rl = createInterface({ input, output });
  console.log("docs-agent chat -- describe your project in 2-5 sentences. (/help, /quit)");

  try {
    let state = loadProjectState(workdir);

    let brief = state.brief;
    if (!isUsableBrief(brief)) {
      if (brief) {
        console.log(`Saved brief looks invalid ("${brief}"). Let's set a new one.`);
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
          console.log("Type a 2-5 sentence project description (commands start with /, descriptions don't).");
          continue;
        }
        if (t.length < 10) {
          console.log("Too short -- describe the idea in 2-5 sentences.");
          continue;
        }
        brief = t;
        break;
      }
      state.brief = brief;
      saveProjectState(workdir, state);
    } else {
      console.log(`Loaded brief: ${brief}`);
    }

    // ---- Triage (domain + risk + harm) ----
    console.log("Running triage...");
    const hasJevKey = Boolean(config.openrouterApiKey);
    if (!hasJevKey) {
      console.log("No OPENROUTER_API_KEY -- Ollama-judge fallback, decisions marked unverified.");
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
        `Blocked: this looks like ${worst.key} (p=${worst.noul.toFixed(2)}). ` +
          "I can't help with malware, offensive hacking, weapons, or illicit builds. " +
          "I can help with a defensive alternative instead -- e.g. a secure-coding guide or detection runbook."
      );
      return;
    }
    if (worst && worst.verdict === "confirm") {
      const ok =
        (await ask(
          rl,
          `Flagged as possibly ${worst.key} (p=${worst.noul.toFixed(2)}). Proceed with defensive-only scope? (y/n) `
        )) ?? "n";
      if (!/^y(es)?$/i.test(ok.trim())) {
        console.log("Stopped. Nothing generated.");
        return;
      }
    }

    console.log(
      `Domain: ${triage.domain} (confidence ${triage.domainConfidence.toFixed(2)}) | ` +
        `complexity ${triage.complexity.toFixed(1)} | security ${triage.security.toFixed(1)}` +
        (triage.unverified ? " | unverified" : "")
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
    console.log(`Proposing options for: ${axes.join(", ")}...`);
    const candidates = await proposeCandidates(brief, triage.domain, axes, (axis, done, total) =>
      console.log(`  [${done}/${total}] ${axis} done`)
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

    // ---- Per-axis questions, ranked best-first ----
    for (const axis of rankedAxes) {
      const c = order.get(axis) as AxisCandidates;
      const rank = winners.get(axis) as { winner: string; probs: Record<string, number>; confidence: number };
      const sorted = [...c.options].sort(
        (a, b) => (rank.probs[b.id] ?? 0) - (rank.probs[a.id] ?? 0)
      );
      console.log(`\n${axis} (Jev pick: ${rank.winner}, confidence ${rank.confidence.toFixed(2)}):`);
      sorted.forEach((o, i) => {
        const p = rank.probs[o.id];
        const bits = [`${i + 1}) ${o.id}${typeof p === "number" ? ` (${p.toFixed(2)})` : ""} -- ${o.description}`];
        if (o.why) bits.push(`   tradeoff: ${o.why}`);
        if (o.whenNot) bits.push(`   avoid when: ${o.whenNot}`);
        console.log(bits.join("\n"));
      });
      const raw = (await ask(rl, `Pick for ${axis} [Enter=${rank.winner}]: `)) ?? "";
      const answer = raw.trim();
      if (!answer) {
        state.answers[axis] = rank.winner;
      } else if (isQuit(answer)) {
        console.log("Leaving interview. Progress saved.");
        saveProjectState(workdir, state);
        return;
      } else if (/^\/help$/i.test(answer)) {
        printHelp();
        const retry =
          (await ask(rl, `Pick for ${axis} [Enter=${rank.winner}]: `)) ?? "";
        state.answers[axis] = resolvePick(sorted.map((o) => o.id), rank.winner, retry.trim());
      } else {
        state.answers[axis] = resolvePick(
          sorted.map((o) => o.id),
          rank.winner,
          answer
        );
      }
      state.jevDecisions[axis] = state.answers[axis];
      saveProjectState(workdir, state);
    }

    console.log("\nDecisions saved to projectState.json:");
    for (const axis of rankedAxes) console.log(`- ${axis}: ${state.answers[axis]}`);
    console.log("Next: `generate --all` drafts the 12 docs (v0.3).");
  } finally {
    rl.close();
  }
}

function resolvePick(ids: string[], winner: string, answer: string): string {
  if (!answer) return winner;
  const n = Number(answer);
  if (Number.isInteger(n) && n >= 1 && n <= ids.length) return ids[n - 1];
  const lower = answer.toLowerCase();
  const exact = ids.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  const partial = ids.find((id) => id.toLowerCase().includes(lower) || lower.includes(id.toLowerCase()));
  if (partial) return partial;
  return `custom: ${answer}`;
}
