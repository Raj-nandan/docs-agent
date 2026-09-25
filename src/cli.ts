#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import { formatDecisionsLog, type LogEntry } from "./decisions/logView";
import { startChat } from "./repl";
import { ensureDir, resolveInWorkdir, writeFileAtomic } from "./tools/files";
import { listLocalModels, pingOllama } from "./writers/ollamaClient";

const program = new Command();

program
  .name("docs-agent")
  .description("CLI agent: Jev decides, Ollama writes - full SDLC docs from a brief")
  .version("0.1.0");

program
  .command("init <name>")
  .description("Scaffold a new project folder with docs/, projectState.json, decisions.log.json")
  .action((name: string) => {
    const root = path.resolve(process.cwd(), name);
    if (fs.existsSync(root)) {
      console.error(`Exists already: ${root}`);
      process.exitCode = 1;
      return;
    }
    ensureDir(process.cwd(), name);
    ensureDir(root, "docs");
    writeFileAtomic(
      root,
      "projectState.json",
      JSON.stringify({ brief: "", domain: null, constraints: {}, answers: {}, jevDecisions: {} }, null, 2) + "\n"
    );
    writeFileAtomic(root, "decisions.log.json", "[]\n");
    console.log(`Created ${root}`);
    console.log(`Next (run from this repo root): node dist/cli.js chat --dir ${name}`);
  });

program
  .command("status")
  .description("Health check for Ollama + Jev key presence")
  .action(async () => {
    const ollamaUp = await pingOllama();
    let models: string[] = [];
    if (ollamaUp) {
      try {
        models = await listLocalModels();
      } catch {
        models = [];
      }
    }
    const modelNote = !ollamaUp
      ? " (Ollama down)"
      : models.length === 0
        ? " (list unavailable)"
        : models.includes(config.ollamaModel)
          ? " (found locally)"
          : ` (NOT found locally - try: ollama pull ${config.ollamaModel})`;
    console.log(`Ollama: ${ollamaUp ? `up at ${config.ollamaHost}` : `DOWN at ${config.ollamaHost} (try: ollama serve)`}`);
    console.log(`Ollama model: ${config.ollamaModel}${modelNote}`);
    if (models.length) console.log(`Local models: ${models.join(", ")}`);
    console.log(`Jev model: ${config.jevModel}`);
    console.log(`OpenRouter key: ${config.openrouterApiKey ? "set" : "MISSING (Ollama-judge fallback, decisions unverified)"}`);
  });

program
  .command("doctor")
  .description("Alias of status with fix hints")
  .action(async () => {
    await program.parseAsync(["node", "docs-agent", "status"], { from: "user" });
    console.log("Hints: `ollama serve`, `ollama pull <model>`, set OPENROUTER_API_KEY in .env.");
  });

program
  .command("chat")
  .description("Interview REPL: brief -> triage -> ranked options -> saved state")
  .requiredOption("--dir <path>", "Project directory holding projectState.json")
  .option("--fresh", "Wipe previous interview state and start over")
  .action(async (opts: { dir: string; fresh?: boolean }) => {
    await startChat(path.resolve(process.cwd(), opts.dir), { fresh: Boolean(opts.fresh) });
  });

program
  .command("reset")
  .description("Wipe interview state (projectState.json + decisions.log.json) for a fresh start")
  .requiredOption("--dir <path>", "Project directory to reset")
  .action((opts: { dir: string }) => {
    const dir = path.resolve(process.cwd(), opts.dir);
    let removed = 0;
    for (const f of ["projectState.json", "decisions.log.json"]) {
      const p = resolveInWorkdir(dir, f);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        removed++;
      }
    } 
    console.log(`Reset ${dir} (removed ${removed} file(s)).`);
  });

program
  .command("generate")
  .description("Draft docs in pipeline order (planned, v0.3)")
  .option("--all", "Generate the full 12-doc set")
  .option("--doc <id>", "Generate one doc, e.g. --doc 04-TRD")
  .action(() => {
    console.log("`generate` lands in v0.3 (pipeline + templates). See docs/11-tasks.md.");
  });

program
  .command("revise <file> <instruction>")
  .description("Rewrite a doc with diff preview (planned, v0.3)")
  .action(() => {
    console.log("`revise` lands in v0.3. See docs/05-FDD.md section 4.");
  });

program
  .command("decisions")
  .description("Show Jev decision log with confidences and cost")
  .requiredOption("--dir <path>", "Project directory holding decisions.log.json")
  .option("--json", "Print the raw log JSON")
  .action((opts: { dir: string; json?: boolean }) => {
    const dir = path.resolve(process.cwd(), opts.dir);
    const file = resolveInWorkdir(dir, "decisions.log.json");
    if (!fs.existsSync(file)) {
      console.log(`No decisions.log.json in ${dir}. Run chat first.`);
      return;
    }
    let entries: LogEntry[];
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      entries = Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
    } catch {
      console.log(`Cannot parse ${file}. It may be corrupt.`);
      return;
    }
    if (!entries.length) {
      console.log("Decision log is empty. Run chat first.");
      return;
    }
    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }
    console.log(formatDecisionsLog(dir, entries));
  });

program.parseAsync(process.argv);
