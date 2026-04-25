#!/usr/bin/env tsx
/**
 * check-no-any.ts
 *
 * Enforces Constitution C3 (no escape hatches): scans .ts/.tsx in packages/
 * and apps/ for `: any`, `as any`, `<any>`, `@ts-ignore`, `@ts-expect-error`.
 * Excludes node_modules, .d.ts, dist/, .next/, build/.
 *
 * Exits 0 on clean, 1 on any violation. No external deps.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["packages", "apps"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", "build", ".turbo"]);
const SOURCE_EXT = /\.(ts|tsx)$/;
const DECL_EXT = /\.d\.ts$/;

interface Rule {
  readonly name: string;
  readonly re: RegExp;
}

// Patterns are intentionally conservative: each rule has a clear "this is the
// thing C3 forbids" mapping. Word boundaries / surrounding punctuation prevent
// matching identifiers like `anyOf` or `Many`.
const RULES: ReadonlyArray<Rule> = [
  { name: "': any' annotation", re: /:\s*any(?![A-Za-z0-9_])/g },
  { name: "'as any' assertion", re: /\bas\s+any(?![A-Za-z0-9_])/g },
  { name: "'<any>' generic", re: /<\s*any\s*>/g },
  { name: "'any[]' array type", re: /\bany\s*\[\s*\]/g },
  { name: "'@ts-ignore' directive", re: /@ts-ignore\b/g },
  { name: "'@ts-expect-error' directive", re: /@ts-expect-error\b/g },
];

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function walk(dir: string, out: string[]): void {
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
      walk(full, out);
    } else if (SOURCE_EXT.test(name) && !DECL_EXT.test(name)) {
      out.push(full);
    }
  }
}

const DIRECTIVE_RE = /@ts-(?:ignore|expect-error)\b/;

function scan(file: string): Violation[] {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const out: Violation[] = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    // `@ts-ignore` / `@ts-expect-error` are always violations regardless of
    // surrounding syntax — they only ever appear in comments.
    const directiveHit = DIRECTIVE_RE.exec(raw);
    if (directiveHit) {
      const name = directiveHit[0].includes("expect-error")
        ? "'@ts-expect-error' directive"
        : "'@ts-ignore' directive";
      out.push({ file, line: i + 1, rule: name, text: raw.trim() });
    }
    // For the type-shape rules, ignore content inside `// ...`, `/* ... */`,
    // and JSDoc to avoid false positives on documentation examples.
    const code = stripCommentsAndStrings(raw, { inBlock });
    inBlock = code.inBlock;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(code.out)) {
        out.push({ file, line: i + 1, rule: rule.name, text: raw.trim() });
      }
    }
  }
  return out;
}

function stripCommentsAndStrings(
  line: string,
  state: { inBlock: boolean },
): { out: string; inBlock: boolean } {
  let out = "";
  let i = 0;
  let block = state.inBlock;
  while (i < line.length) {
    if (block) {
      if (line[i] === "*" && line[i + 1] === "/") {
        out += "  ";
        i += 2;
        block = false;
        continue;
      }
      out += " ";
      i++;
      continue;
    }
    if (line[i] === "/" && line[i + 1] === "*") {
      out += "  ";
      i += 2;
      block = true;
      continue;
    }
    if (line[i] === "/" && line[i + 1] === "/") {
      out += " ".repeat(line.length - i);
      break;
    }
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i];
      out += " ";
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === "\\" && i + 1 < line.length) {
          out += "  ";
          i += 2;
          continue;
        }
        out += " ";
        i++;
      }
      if (i < line.length) {
        out += " ";
        i++;
      }
      continue;
    }
    out += line[i];
    i++;
  }
  return { out, inBlock: block };
}

function main(): void {
  const files: string[] = [];
  for (const r of ROOTS) walk(r, files);

  const violations = files.flatMap(scan);

  if (violations.length === 0) {
    console.log("check-no-any: OK — no 'any'/escape-hatch violations.");
    process.exit(0);
  }

  console.error(`check-no-any: ${violations.length} violation(s):\n`);
  for (const v of violations) {
    const rel = relative(process.cwd(), v.file);
    console.error(`  VIOLATION: ${rel}:${v.line} — contains ${v.rule}`);
    console.error(`    > ${v.text}`);
  }
  console.error("");
  process.exit(1);
}

main();

