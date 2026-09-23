import { decide, type QuestionMap } from "./jevClient";
import { chat as ollamaChat } from "../writers/ollamaClient";

// First Jev call for every brief: domain + risk scores + harm triage.
// One batched request, questions evaluated in parallel against the same state.

// Pull the first {...} object out of a model reply (tolerates fences/chatter).
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const src = (fenced ? fenced[1] : text).trim();
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("No JSON object found in model reply.");
  }
  return JSON.parse(src.slice(start, end + 1));
}

export const TRIAGE_QUESTIONS: QuestionMap = {
  domain: {
    type: "choice",
    instructions: "Which domain best fits this project brief?",
    criteria: {
      web: "Browser app with frontend and backend.",
      mobile: "iOS/Android mobile app.",
      aiml: "ML training, inference, or LLM app.",
      devops: "CI/CD, infrastructure, observability.",
      security: "Defensive security tooling, audit, hardening.",
      data: "Data pipelines, analytics, ETL.",
      iot: "Edge, embedded, or IoT system.",
      other: "None of the above fit.",
    },
  },
  complexity: {
    type: "score",
    instructions: "How complex is this project to engineer?",
    criteria: [
      "Weekend MVP, single dev",
      "Small team app",
      "Production system with integrations",
      "Distributed system at scale",
    ],
  },
  security_criticality: {
    type: "score",
    instructions: "How security-critical is this project?",
    criteria: [
      "Public toy, no accounts or PII",
      "Accounts and personal data",
      "Payments or PII at scale",
      "Regulated, health, or critical infrastructure",
    ],
  },
  is_malware_hacking: {
    type: "noul",
    instructions:
      "Does the brief request malware, hacking, auth bypass, exploits, DDoS, or phishing?",
    criteria: {
      true: "Requests or implies offensive capability.",
      false: "Benign or purely defensive work.",
    },
  },
  is_weapon_harm: {
    type: "noul",
    instructions: "Does the brief request weapons, CBRN, violence, or self-harm content?",
    criteria: {
      true: "Harmful physical-world request.",
      false: "No such request.",
    },
  },
  is_illicit: {
    type: "noul",
    instructions: "Does the brief request fraud, theft, CSAM, doxxing, or stalking?",
    criteria: {
      true: "Illicit request.",
      false: "No illicit request.",
    },
  },
};

export type HarmVerdict = "allow" | "confirm" | "block";

export function harmVerdict(noul: number): HarmVerdict {
  if (noul > 0.75) return "block";
  if (noul >= 0.45) return "confirm";
  return "allow";
}

export interface HarmFlag {
  key: string;
  noul: number;
  verdict: HarmVerdict;
}

export interface TriageResult {
  domain: string;
  domainConfidence: number;
  complexity: number;
  security: number;
  harm: HarmFlag[];
  highestHarm: number;
  model: string;
  unverified: boolean;
}

const HARM_KEYS = ["is_malware_hacking", "is_weapon_harm", "is_illicit"];

function clamp01(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export async function runTriage(brief: string): Promise<TriageResult> {
  const res = await decide({ brief }, TRIAGE_QUESTIONS);
  const a = res.answers;

  let domain = "other";
  let domainConfidence = 0;
  const domainAns = a.domain;
  if (domainAns && domainAns.type === "choice") {
    domain = domainAns.choice;
    domainConfidence = domainAns.confidence;
  }

  const complexityAns = a.complexity;
  const complexity =
    complexityAns && complexityAns.type === "score" ? complexityAns.score : 1;
  const securityAns = a.security_criticality;
  const security =
    securityAns && securityAns.type === "score" ? securityAns.score : 0;

  const harm: HarmFlag[] = HARM_KEYS.map((key) => {
    const ans = a[key];
    const noul = ans && ans.type === "noul" ? ans.noul : 0;
    return { key, noul, verdict: harmVerdict(noul) };
  });

  return {
    domain,
    domainConfidence,
    complexity,
    security,
    harm,
    highestHarm: Math.max(...harm.map((h) => h.noul)),
    model: res.model,
    unverified: false,
  };
}

// Fallback when OPENROUTER_API_KEY is missing: local model judges, flagged unverified.
export async function runTriageOllama(brief: string): Promise<TriageResult> {
  const raw = await ollamaChat(
    [
      {
        role: "system",
        content: "You are a triage classifier. Reply with STRICT JSON only, no prose.",
      },
      {
        role: "user",
        content:
          'Classify this project brief. Reply ONLY with JSON: {"domain":"web|mobile|aiml|devops|security|data|iot|other","complexity":1-4,"security":0-3,"is_malware_hacking":0-1,"is_weapon_harm":0-1,"is_illicit":0-1}\n' +
          `Brief: ${brief}`,
      },
    ],
    { temperature: 0.1 }
  );
  const p = extractJsonObject(raw) as Record<string, unknown>;
  const harm: HarmFlag[] = HARM_KEYS.map((key) => {
    const noul = clamp01(p[key]);
    return { key, noul, verdict: harmVerdict(noul) };
  });
  const domain = typeof p.domain === "string" ? p.domain : "other";
  return {
    domain,
    domainConfidence: 0,
    complexity: typeof p.complexity === "number" ? p.complexity : 1,
    security: typeof p.security === "number" ? p.security : 0,
    harm,
    highestHarm: Math.max(...harm.map((h) => h.noul)),
    model: "ollama-judge",
    unverified: true,
  };
}
