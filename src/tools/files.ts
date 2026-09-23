import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Workdir-sandboxed file tools. Every write stays inside `workdir`.
// Rejects path escapes (`..` leaving the root, absolute paths outside it).

export function resolveInWorkdir(workdir: string, target: string): string {
  const root = path.resolve(workdir);
  const resolved = path.resolve(root, target);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`Access denied: ${target} escapes workdir ${root}`);
  }
  return resolved;
}

export function ensureDir(workdir: string, dir: string): string {
  const resolved = resolveInWorkdir(workdir, dir);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

// Atomic write: tmp file + rename, so interrupted runs never leave half files.
export function writeFileAtomic(
  workdir: string,
  target: string,
  content: string
): string {
  const resolved = resolveInWorkdir(workdir, target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const tmp = `${resolved}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, resolved);
  return resolved;
}

// Backup existing file to <name>.bak before overwrite. Returns backup path or null.
export function backupIfExists(workdir: string, target: string): string | null {
  const resolved = resolveInWorkdir(workdir, target);
  if (!fs.existsSync(resolved)) return null;
  const backup = `${resolved}.bak`;
  fs.copyFileSync(resolved, backup);
  return backup;
}

export function readFile(workdir: string, target: string): string {
  const resolved = resolveInWorkdir(workdir, target);
  return fs.readFileSync(resolved, "utf8");
}

export function listFiles(workdir: string, dir = "."): string[] {
  const resolved = resolveInWorkdir(workdir, dir);
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(path.join(current, entry.name), rel);
      } else {
        out.push(rel);
      }
    }
  };
  walk(resolved, dir === "." ? "" : dir);
  return out.sort();
}

export function defaultWorkdir(): string {
  return process.cwd();
}

export function platformInfo(): string {
  return `${os.platform()} ${os.arch()} | node ${process.version}`;
}
