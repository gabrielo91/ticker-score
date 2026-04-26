#!/usr/bin/env tsx
/**
 * check-constitution-drift.ts
 *
 * Scans governance files for stale references to the DarkScore Constitution.
 * The source of truth is `.specify/memory/constitution.md` — its version
 * header declares the current version and the C-range (e.g. "C1–C13").
 * Any other file referencing an out-of-date C-range or rule count is drift.
 *
 * Exits 0 on clean, 1 on any drift detected. No external deps.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CONSTITUTION_PATH = ".specify/memory/constitution.md";

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

interface ConstitutionMeta {
  version: number;
  maxRule: number;
}

function parseConstitution(): ConstitutionMeta {
  const src = readFileSync(CONSTITUTION_PATH, "utf8");
  const versionMatch = src.match(
    /\*\*Version\*\*:\s*([0-9]+)\s*\(C1[-–]C([0-9]+)\)/,
  );
  if (!versionMatch) {
    throw new Error(
      `Cannot find version header in ${CONSTITUTION_PATH}. ` +
        `Expected '**Version**: N (C1–CM)'.`,
    );
  }
  const version = Number(versionMatch[1]);
  const maxRule = Number(versionMatch[2]);
  if (!Number.isFinite(version) || !Number.isFinite(maxRule)) {
    throw new Error(`Invalid version/maxRule parsed from ${CONSTITUTION_PATH}.`);
  }
  return { version, maxRule };
}

const SKIP_DIRS = new Set(["node_modules", "dist", ".next", "build", ".turbo"]);

function walk(dir: string, suffix: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, suffix, out);
    } else if (full.endsWith(suffix)) {
      out.push(full);
    }
  }
}

function collectTargets(): string[] {
  const files = new Set<string>();
  files.add("AGENTS.md");
  const collected: string[] = [];
  walk("packages", "CONSTITUTION.md", collected);
  walk("apps", "CONSTITUTION.md", collected);
  walk(".specify/specs", "spec.md", collected);
  for (const f of collected) files.add(f);
  return [...files].sort();
}

interface Drift {
  file: string;
  line: number;
  found: string;
  expected: string;
}

// Matches "C1-C11", "C1–C13" (en dash), case-insensitive on the C.
const RANGE_RE = /\bC1\s*[-–]\s*C([0-9]+)\b/g;
// Matches "<word>-rule" e.g. "thirteen-rule", "twelve-rule".
const WORD_RULE_RE = /\b([a-z]+)-rule\b/gi;
// Matches "<word> rules" e.g. "eleven rules", "thirteen rules".
const WORD_RULES_RE = /\b([a-z]+)\s+rules\b/gi;

function checkFile(file: string, meta: ConstitutionMeta): Drift[] {
  const out: Drift[] = [];
  let src: string;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const m of line.matchAll(RANGE_RE)) {
      const n = Number(m[1]);
      if (n !== meta.maxRule) {
        out.push({
          file,
          line: i + 1,
          found: m[0],
          expected: `C1–C${meta.maxRule}`,
        });
      }
    }
    for (const m of line.matchAll(WORD_RULE_RE)) {
      const word = (m[1] ?? "").toLowerCase();
      const n = NUMBER_WORDS[word];
      if (n !== undefined && n !== meta.maxRule) {
        out.push({
          file,
          line: i + 1,
          found: m[0],
          expected: `${wordFor(meta.maxRule)}-rule`,
        });
      }
    }
    for (const m of line.matchAll(WORD_RULES_RE)) {
      const word = (m[1] ?? "").toLowerCase();
      const n = NUMBER_WORDS[word];
      if (n !== undefined && n !== meta.maxRule) {
        out.push({
          file,
          line: i + 1,
          found: m[0],
          expected: `${wordFor(meta.maxRule)} rules`,
        });
      }
    }
  }
  return out;
}

function wordFor(n: number): string {
  for (const [w, v] of Object.entries(NUMBER_WORDS)) {
    if (v === n) return w;
  }
  return String(n);
}

function main(): void {
  const meta = parseConstitution();
  const targets = collectTargets();
  const drifts: Drift[] = [];
  for (const f of targets) drifts.push(...checkFile(f, meta));

  if (drifts.length === 0) {
    console.log(
      `check-constitution-drift: OK — version ${meta.version} (C1–C${meta.maxRule}), ${targets.length} file(s) scanned.`,
    );
    process.exit(0);
  }

  console.error(
    `check-constitution-drift: ${drifts.length} drift(s) (current: C1–C${meta.maxRule}):\n`,
  );
  for (const d of drifts) {
    const rel = relative(process.cwd(), d.file);
    console.error(
      `  DRIFT: ${rel}:${d.line} — found "${d.found}", expected "${d.expected}"`,
    );
  }
  console.error("");
  process.exit(1);
}

main();

