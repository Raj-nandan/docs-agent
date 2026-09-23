import { config } from "../config";

// Minimal client for a local Ollama instance.
// Single default model (config.ollamaModel). Docs use low temperature,
// chat uses a higher one. No streaming in v1.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}

function baseUrl(): string {
  return config.ollamaHost.replace(/\/$/, "");
}

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(
      `Cannot reach Ollama at ${baseUrl()}. Is it running? Try: ollama serve. (${String(err)})`
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(path: string, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(
      `Cannot reach Ollama at ${baseUrl()}. Is it running? Try: ollama serve. (${String(err)})`
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const json = await postJson<{ message?: { content?: string }; response?: string }>(
    "/api/chat",
    {
      model: opts.model ?? config.ollamaModel,
      messages,
      stream: false,
      // No reasoning traces: faster + keeps strict-JSON replies clean.
      think: false,
      options: { temperature: opts.temperature ?? 0.7, num_ctx: config.ollamaNumCtx },
    },
    opts.timeoutMs ?? 300000
  );
  return json.message?.content ?? json.response ?? "";
}

export async function generateDoc(
  systemPrompt: string,
  userPrompt: string,
  opts: ChatOptions = {}
): Promise<string> {
  const text = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, ...opts }
  );
  return sanitizeMarkdown(text);
}

// Strip common model chatter/fences so saved files hold only the artifact.
export function sanitizeMarkdown(text: string): string {
  let out = text.trim();
  const fence = out.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fence) out = fence[1].trim();
  out = out.replace(/^(Here is|Below is|Sure, here).*?\n+/i, "");
  return out.trim() + "\n";
}

export async function listLocalModels(timeoutMs = 10000): Promise<string[]> {
  const json = await getJson<{ models?: Array<{ name?: string }> }>(
    "/api/tags",
    timeoutMs
  );
  return (json.models ?? []).map((m) => m.name ?? "").filter(Boolean);
}

export async function pingOllama(timeoutMs = 10000): Promise<boolean> {
  try {
    await getJson("/api/version", timeoutMs);
    return true;
  } catch {
    return false;
  }
}
