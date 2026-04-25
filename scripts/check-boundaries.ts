#!/usr/bin/env tsx
/**
 * check-boundaries.ts
 *
 * Enforces Constitution C4 + C11: every `@darkscore/*` import in packages/ and
 * apps/ must be in the allowed-dependency map derived from the L2 Container
 * diagram. Exits 0 on clean, 1 on any violation.
 *
 * No external dependencies — Node fs/path only.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

type PackageName =
  | "@darkscore/types"
  | "@darkscore/cache"
  | "@darkscore/db"
  | "@darkscore/data-providers"
  | "@darkscore/scoring-engine"
  | "@darkscore/web";

const ALLOWED: Record<PackageName, ReadonlyArray<PackageName>> = {
  "@darkscore/types": [],
  "@darkscore/cache": ["@darkscore/types"],
  "@darkscore/db": ["@darkscore/types"],
  "@darkscore/data-providers": ["@darkscore/types", "@darkscore/cache"],
  "@darkscore/scoring-engine": ["@darkscore/types"],
  "@darkscore/web": [
    "@darkscore/types",
    "@darkscore/cache",
    "@darkscore/db",
    "@darkscore/data-providers",
    "@darkscore/scoring-engine",
  ],
};

const PACKAGE_ROOTS: Array<{ dir: string; pkg: PackageName }> = [
  { dir: "packages/types", pkg: "@darkscore/types" },
  { dir: "packages/cache", pkg: "@darkscore/cache" },
  { dir: "packages/db", pkg: "@darkscore/db" },
  { dir: "packages/data-providers", pkg: "@darkscore/data-providers" },
  { dir: "packages/scoring-engine", pkg: "@darkscore/scoring-engine" },
  { dir: "apps/web", pkg: "@darkscore/web" },
];

const SKIP_DIRS = new Set(["node_modules", "dist", ".next", "build", ".turbo"]);
const SOURCE_EXT = /\.(ts|tsx)$/;
const DECL_EXT = /\.d\.ts$/;

// Match `from '@darkscore/<name>'`, `from "@darkscore/<name>"`, dynamic
// import('@darkscore/<name>'), and require('@darkscore/<name>'). The package
// name segment stops at `/` or the closing quote so subpath imports are also
// captured (e.g. '@darkscore/db/schema').
const IMPORT_RE =
  /(?:from|import|require)\s*\(?\s*['"](@darkscore\/[a-z0-9-]+)(?:\/[^'"]*)?['"]/g;

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

function packageOfFile(file: string): PackageName | null {
  const rel = relative(process.cwd(), file);
  for (const root of PACKAGE_ROOTS) {
    if (rel === root.dir || rel.startsWith(root.dir + sep)) return root.pkg;
  }
  return null;
}

interface Violation {
  file: string;
  line: number;
  importer: PackageName;
  imported: string;
  allowed: ReadonlyArray<PackageName>;
}

function check(file: string, importer: PackageName): Violation[] {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const out: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(line)) !== null) {
      const imported = m[1] as string;
      if (imported === importer) continue;
      const allowed = ALLOWED[importer];
      if (!(allowed as ReadonlyArray<string>).includes(imported)) {
        out.push({ file, line: i + 1, importer, imported, allowed });
      }
    }
  }
  return out;
}

function main(): void {
  const violations: Violation[] = [];
  for (const root of PACKAGE_ROOTS) {
    const files: string[] = [];
    walk(root.dir, files);
    for (const f of files) {
      const pkg = packageOfFile(f);
      if (!pkg) continue;
      violations.push(...check(f, pkg));
    }
  }

  if (violations.length === 0) {
    console.log("check-boundaries: OK — no @darkscore/* import violations.");
    process.exit(0);
  }

  console.error(`check-boundaries: ${violations.length} violation(s):\n`);
  for (const v of violations) {
    const rel = relative(process.cwd(), v.file);
    const allowList =
      v.allowed.length === 0 ? "nothing" : v.allowed.join(", ");
    console.error(
      `  VIOLATION: ${rel}:${v.line} — ${v.importer} imports ${v.imported} ` +
        `— not allowed (${v.importer} may only import: ${allowList})`,
    );
  }
  console.error("");
  process.exit(1);
}

main();

