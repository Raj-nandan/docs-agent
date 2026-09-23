import { chat as ollamaChat } from "../writers/ollamaClient";
import { extractJsonObject } from "./triage";

// Stage 2 of deciding: Ollama invents the options (3 per axis, best first),
// Jev picks the winner. Axes are fixed, option values are per-brief -
// never hardcoded stacks, works for any domain.

export interface CandidateOption {
  id: string;
  description: string;
  why?: string;
  scalability?: number;
  security?: number;
  cost?: string;
  whenNot?: string;
}

export interface AxisCandidates {
  axis: string;
  options: CandidateOption[];
}

export const AXIS_QUESTIONS: Record<string, string> = {
  frontend: "Pick the frontend approach serving this brief (scalability, security, cost).",
  backend: "Pick the backend framework serving this brief (scalability, security, cost).",
  data: "Pick the data store serving this brief (scale, integrity, ops cost).",
  auth: "Pick the auth approach for this sensitivity and UX.",
  compute: "Pick the compute/serving approach for this workload (scale, cost, ops).",
  deploy: "Pick the deployment target for this scale and ops burden.",
  repo_layout: "Pick the repo layout for this team size and deploy target.",
};

const DOMAIN_AXES: Record<string, string[]> = {
  web: ["frontend", "backend", "data", "auth", "deploy"],
  mobile: ["frontend", "backend", "data", "auth"],
  aiml: ["compute", "data", "backend", "deploy"],
  devops: ["compute", "deploy", "repo_layout", "data"],
  security: ["backend", "data", "deploy", "auth"],
  data: ["compute", "data", "backend", "deploy"],
  iot: ["compute", "backend", "data", "deploy"],
  other: ["backend", "data", "deploy", "auth"],
};

export function axesForDomain(domain: string): string[] {
  return DOMAIN_AXES[domain] ?? DOMAIN_AXES.other;
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalize(payload: unknown): AxisCandidates[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { axes?: unknown }).axes)) {
    throw new Error("Candidates JSON has no axes array.");
  }
  const axes = (payload as { axes: unknown[] }).axes.map((entry) => {
    const e = entry as { axis?: unknown; options?: unknown };
    if (typeof e.axis !== "string" || !Array.isArray(e.options) || e.options.length < 2) {
      throw new Error(`Axis entry invalid: ${JSON.stringify(entry).slice(0, 120)}`);
    }
    const options = e.options.slice(0, 5).map((o, i) => {
      const opt = o as Partial<CandidateOption>;
      const id = typeof opt.id === "string" && opt.id.trim() ? slugify(opt.id) : `option-${i + 1}`;
      if (typeof opt.description !== "string" || !opt.description.trim()) {
        throw new Error(`Option missing description on axis ${e.axis}.`);
      }
      return {
        id,
        description: opt.description.trim(),
        why: typeof opt.why === "string" ? opt.why.trim() : undefined,
        scalability: typeof opt.scalability === "number" ? opt.scalability : undefined,
        security: typeof opt.security === "number" ? opt.security : undefined,
        cost: typeof opt.cost === "string" ? opt.cost.trim() : undefined,
        whenNot: typeof opt.whenNot === "string" ? opt.whenNot.trim() : undefined,
      };
    });
    return { axis: e.axis, options };
  });
  if (!axes.length) throw new Error("Candidates JSON has no axes.");
  return axes;
}

export async function proposeCandidates(
  brief: string,
  domain: string,
  axes: string[],
  onProgress?: (axis: string, done: number, total: number) => void
): Promise<AxisCandidates[]> {
  // One small call per axis: on CPU-only laptops a single giant prompt
  // is slower than several short ones (less KV cache, shorter outputs).
  const out: AxisCandidates[] = [];
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i];
    const question = AXIS_QUESTIONS[axis] ?? `Pick the best ${axis} for this brief.`;
    const userPrompt =
      `Project brief: ${brief}\nDomain: ${domain}\nAxis: ${axis} -- ${question}\n\n` +
      `Propose exactly 3 options as STRICT JSON only, no prose outside the JSON:\n` +
      `{"axis":"${axis}","options":[{"id":"<lowercase-hyphen-id>","description":"<one line: what it is and why it fits>","why":"<scalability/security tradeoff, under 20 words>","whenNot":"<when NOT to use, under 15 words>"}]}\n` +
      `Rules: order best-first by scalability+security for THIS brief. Modern, maintained options only (no EOL versions).`;
    const system = "You are a staff architect. Reply with STRICT JSON only, no prose.";
    const attempt = (extra: string): Promise<string> =>
      ollamaChat(
        [
          { role: "system", content: system },
          { role: "user", content: userPrompt + extra },
        ],
        { temperature: 0.5 }
      );
    let raw: string;
    try {
      // Output must start with { and end with } -- no other text.
      raw = await attempt("\nOutput must start with { and end with }. No other text.");
      out.push(...normalize({ axes: [extractJsonObject(raw)] }));
    } catch {
      // Retry resends the FULL task (calls are stateless) with a stricter reminder.
      raw = await attempt(
        "\nYour last reply was not valid JSON. Reply again with ONLY the JSON object, nothing else."
      );
      out.push(...normalize({ axes: [extractJsonObject(raw)] }));
    }
    onProgress?.(axis, i + 1, axes.length);
  }
  return out;
}
