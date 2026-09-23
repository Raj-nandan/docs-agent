import * as fs from "node:fs";
import * as path from "node:path";

export interface AgentConfig {
  openrouterApiKey: string;
  jevModel: string;
  ollamaHost: string;
  ollamaModel: string;
  ollamaNumCtx: number;
}

// Minimal .env loader (no dependency). process.env always wins.
function loadDotEnvFile(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", "..", ".env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    break;
  }
}

loadDotEnvFile();

export const config: AgentConfig = {
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  jevModel: process.env.JEV_MODEL ?? "typesafe/jev-1.13",
  ollamaHost: process.env.OLLAMA_HOST ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5:14b",
  ollamaNumCtx: Number(process.env.OLLAMA_NUM_CTX ?? 8192),
};

export function requireJevKey(): string {
  if (!config.openrouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is missing. Set it in .env (see .env.example) or run in Ollama-judge mode."
    );
  }
  return config.openrouterApiKey;
}
