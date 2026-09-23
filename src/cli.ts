#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "./config";
import { startChat } from "./repl";
import { ensureDir, writeFileAtomic } from "./tools/files";
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
  .option("--dir <path>", "Project directory holding projectState.json", ".")
  .action(async (opts: { dir: string }) => {
    await startChat(path.resolve(process.cwd(), opts.dir));
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
  .description("Show Jev decision log (planned, v0.2)")
  .action(() => {
    console.log("`decisions` lands in v0.2 with decisions.log.json. See docs/13-jev-taxonomy.md.");
  });

program.parseAsync(process.argv);
