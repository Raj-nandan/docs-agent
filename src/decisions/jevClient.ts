import { z } from "zod";
import { config, requireJevKey } from "../config";

// Typed client for the OpenRouter Decisions API (Jev).
// POST https://openrouter.ai/api/alpha/decisions
// { model, state, questions } -> { answers, usage }
// Jev returns typed answers only: choice | score | noul. No prose.

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// ---- Question schemas (what we send) ----

export const NoulQuestionSchema = z.object({
  type: z.literal("noul"),
  instructions: z.string().min(1),
  criteria: z
    .object({ true: z.string(), false: z.string() })
    .partial()
    .optional(),
});

export const ChoiceQuestionSchema = z.object({
  type: z.literal("choice"),
  instructions: z.string().min(1),
  criteria: z.record(z.string(), z.string()).refine((c) => {
    const keys = Object.keys(c);
    return keys.length >= 2 && keys.length <= 255;
  }, "choice needs 2-255 criteria options"),
});

export const ScoreQuestionSchema = z.object({
  type: z.literal("score"),
  instructions: z.string().min(1),
  criteria: z.array(z.string()).refine((c) => c.length >= 2 && c.length <= 10, {
    message: "score needs 2-10 ordered levels, low to high",
  }),
});

export const QuestionSchema = z.union([
  NoulQuestionSchema,
  ChoiceQuestionSchema,
  ScoreQuestionSchema,
]);

export type Question = z.infer<typeof QuestionSchema>;
export type QuestionMap = Record<string, Question>;

// State can be text, an object, or an array (per Jev spec).
export type JevState = string | Record<string, unknown> | unknown[];

// ---- Answer schemas (what Jev returns) ----

export const NoulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number().min(0).max(1),
});

export const ChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
});

export const ScoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
  legend: z.record(z.string(), z.string()).optional(),
});

export const AnswerSchema = z.union([
  NoulAnswerSchema,
  ChoiceAnswerSchema,
  ScoreAnswerSchema,
]);

export type Answer = z.infer<typeof AnswerSchema>;

export const DecisionsResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  provider: z.string().optional(),
  answers: z.record(z.string(), AnswerSchema),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .passthrough()
    .optional(),
});

export type DecisionsResponse = z.infer<typeof DecisionsResponseSchema>;

export interface DecideOptions {
  model?: string;
  timeoutMs?: number;
  siteUrl?: string;
  siteName?: string;
}

export async function decide(
  state: JevState,
  questions: QuestionMap,
  opts: DecideOptions = {}
): Promise<DecisionsResponse> {
  const apiKey = requireJevKey();
  const parsedQuestions: QuestionMap = {};
  for (const [id, q] of Object.entries(questions)) {
    parsedQuestions[id] = QuestionSchema.parse(q);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (opts.siteUrl) headers["HTTP-Referer"] = opts.siteUrl;
  if (opts.siteName) headers["X-Title"] = opts.siteName;

  const res = await fetch(DECISIONS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: opts.model ?? config.jevModel,
      state,
      questions: parsedQuestions,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("Jev rejected the key (401). Check OPENROUTER_API_KEY.");
    }
    if (res.status === 402) {
      throw new Error("Jev out of credits (402). Top up your OpenRouter account.");
    }
    throw new Error(`Jev request failed: ${res.status} ${body.slice(0, 300)}`);
  }

  const json: unknown = await res.json();
  return DecisionsResponseSchema.parse(json);
}

// ---- Policy helpers (see docs/02-PRD.md) ----

export function noulVerdict(noul: number): "allow" | "confirm" | "block" {
  if (noul > 0.75) return "block";
  if (noul >= 0.45) return "confirm";
  return "allow";
}

export function confidenceVerdict(confidence: number): "apply" | "confirm" | "ask" {
  if (confidence >= 0.65) return "apply";
  if (confidence >= 0.45) return "confirm";
  return "ask";
}
