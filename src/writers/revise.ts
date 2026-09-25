import { createTwoFilesPatch } from "diff";
import { askConfirm, paint } from "../repl/ui";
import { backupIfExists, readFile, writeFileAtomic } from "../tools/files";
import { generateDoc } from "./ollamaClient";
import { DOC_WRITER_SYSTEM } from "./templates";

// Revise loop: read -> Ollama rewrite with instruction -> unified diff
// preview -> confirm -> backup + write. Returns whether anything changed.

export interface ReviseResult {
  written: boolean;
  message: string;
}

export async function reviseDoc(
  workdir: string,
  target: string,
  instruction: string,
  textAsk: (prompt: string) => Promise<string | null>
): Promise<ReviseResult> {
  let oldText: string;
  try {
    oldText = readFile(workdir, target);
  } catch {
    return { written: false, message: `Cannot read ${target} in ${workdir}.` };
  }

  let newText = await generateDoc(
    DOC_WRITER_SYSTEM,
    `Revise the markdown document below per this instruction: ${instruction}\n` +
      "Rules: keep the document's sections and decisions table unless told otherwise. " +
      "Ground changes in the existing text; new facts become TODO(need:<what>). " +
      "Do NOT repeat the --- DOCUMENT --- separator in your output. " +
      "ASCII only. Output ONLY the revised document.\n\n--- DOCUMENT ---\n" +
      oldText
  );
  // The small model sometimes echoes the separator; strip it deterministically.
  newText = newText.replace(/^--- DOCUMENT ---\s*\n/, "");

  if (newText.trim() === oldText.trim()) {
    return { written: false, message: "Model returned no changes." };
  }

  console.log(createTwoFilesPatch(target, target, oldText, newText));

  const ok = await askConfirm(`Apply these changes to ${target}?`, textAsk);
  if (!ok) {
    return { written: false, message: "Discarded. Nothing written." };
  }
  backupIfExists(workdir, target);
  writeFileAtomic(workdir, target, newText);
  return { written: true, message: `Updated ${target} (previous version kept as ${target}.bak).` };
}

export function paintResult(res: ReviseResult): string {
  return res.written ? paint.ok(res.message) : paint.info(res.message);
}
