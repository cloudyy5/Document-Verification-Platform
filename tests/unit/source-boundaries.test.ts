import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const originalRoot = path.join(
  root,
  "Document_Verification_Platform_v1.0.2",
  "document-verification-platform-v1.0.2",
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(filename)
      : /\.tsx?$/.test(entry.name)
        ? [filename]
        : [];
  });
}

function inspectModule(filename: string) {
  const content = readFileSync(filename, "utf8");
  const sourceFile = ts.createSourceFile(
    filename,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  const first = sourceFile.statements[0];
  const isClient = Boolean(
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use client",
  );
  const isServerAction = Boolean(
    first &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use server",
  );
  return { imports, isClient, isServerAction, content };
}

function resolveLocalImport(importer: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(importer), specifier)
      : undefined;
  if (!base) return undefined;
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].find((candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate));
}

describe("preservasi paket sumber", () => {
  it("menjaga seluruh dokumentasi, gambar, dan SQL asli byte-identik", () => {
    const manifest = JSON.parse(
      readFileSync(
        path.join(root, "docs/original-files.sha256.json"),
        "utf8",
      ).replace(/^\uFEFF/, ""),
    ) as { path: string; sha256: string }[];
    expect(manifest.length).toBeGreaterThan(30);
    for (const file of manifest) {
      const filename = path.join(originalRoot, file.path);
      expect(existsSync(filename), file.path).toBe(true);
      expect(
        createHash("sha256")
          .update(readFileSync(filename))
          .digest("hex")
          .toUpperCase(),
        file.path,
      ).toBe(file.sha256);
    }
  });

  it("menyalin token dan migration tanpa mengubah sumber kebijakan", () => {
    expect(
      readFileSync(path.join(sourceRoot, "styles/design-tokens.css")),
    ).toEqual(readFileSync(path.join(originalRoot, "DESIGN_TOKENS.css")));
    for (const filename of readdirSync(
      path.join(originalRoot, "supabase/migrations"),
    )) {
      expect(
        readFileSync(path.join(root, "supabase/migrations", filename)),
        filename,
      ).toEqual(
        readFileSync(path.join(originalRoot, "supabase/migrations", filename)),
      );
    }
  });
});

describe("batas server dan browser", () => {
  it("menandai modul yang memegang secret sebagai server-only", () => {
    for (const filename of [
      "lib/env/server.ts",
      "lib/supabase/privileged.ts",
      "lib/supabase/server.ts",
    ]) {
      const inspected = inspectModule(path.join(sourceRoot, filename));
      expect(inspected.imports, filename).toContain("server-only");
      expect(inspected.isClient, filename).toBe(false);
    }
  });

  it("tidak membolehkan import transitif server-only dari komponen client", () => {
    const files = sourceFiles(sourceRoot);
    const modules = new Map(
      files.map((filename) => [filename, inspectModule(filename)]),
    );
    for (const [entrypoint, entry] of modules) {
      if (!entry.isClient) continue;
      const pending = [entrypoint];
      const visited = new Set<string>();
      while (pending.length) {
        const filename = pending.pop()!;
        if (visited.has(filename)) continue;
        visited.add(filename);
        const inspected = modules.get(filename);
        if (!inspected) continue;
        // Next.js turns an imported `use server` module into an RPC reference.
        // Its implementation stays on the server; ordinary imports remain checked.
        if (filename !== entrypoint && inspected.isServerAction) continue;
        expect(
          inspected.imports,
          `${path.relative(root, entrypoint)} -> ${path.relative(root, filename)}`,
        ).not.toContain("server-only");
        for (const specifier of inspected.imports) {
          const resolved = resolveLocalImport(filename, specifier);
          if (resolved) pending.push(resolved);
        }
      }
    }
  });

  it("hanya membaca dua variabel publik yang diizinkan dalam modul env browser", () => {
    const { content } = inspectModule(
      path.join(sourceRoot, "lib/env/public.ts"),
    );
    const accessed = Array.from(
      content.matchAll(/process\.env\.([A-Z_]+)/g),
      (match) => match[1],
    );
    expect(new Set(accessed)).toEqual(
      new Set([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ]),
    );
    expect(content).not.toMatch(/process\.env\[/);
  });
});
