import { globSync, readFileSync, statSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Violation = { file: string; line: number; rule: string };

export function checkSource(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const add = (rule: string, position: number) =>
    violations.push({ file, line: source.slice(0, position).split("\n").length, rule });
  const scan = (rule: string, expression: RegExp) => {
    for (const match of source.matchAll(expression)) add(rule, match.index);
  };
  const inSrc = file.startsWith("src/");
  if (inSrc && /\.tsx?$/.test(file)) {
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\s*\(/.test(node.text))
          add("colour literal", node.getStart(tree));
      }
      let module: string | undefined;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        module = node.moduleSpecifier.text;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) module = argument.text;
      }
      if (module) {
        if (
          file.startsWith("src/domain/") &&
          /^(?:next|react|drizzle-orm)(?:\/|$)|^@\/(?:server|app|components|config)(?:\/|$)|^node:/.test(
            module,
          )
        ) {
          if (!(file === "src/domain/audit.ts" && module === "node:crypto"))
            add("domain dependency", node.getStart(tree));
        }
        if (file.startsWith("src/lib/") && /^(?:next(?:\/|$)|@\/server(?:\/|$))/.test(module))
          add("lib dependency", node.getStart(tree));
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    scan(
      "default palette",
      /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|placeholder|accent|caret|shadow)-(?:white|black)\b/g,
    );
    if (file !== "src/lib/clock.ts")
      scan("current time outside clock", /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(\s*\)/g);
  }
  if (inSrc) scan("audit immutability", /\b(?:update|delete)\s*\(\s*auditLog\b/g);
  if (file.startsWith("src/server/") && !/^import ["']server-only["'];/.test(source))
    add("server-only guard", 0);
  if (file === "src/proxy.ts")
    scan("proxy database dependency", /(?:@\/server\/db|\.\/server\/db)/g);
  if (inSrc) scan("unsafe HTML", /dangerouslySetInnerHTML/g);
  if (file.startsWith("src/domain/")) {
    scan("domain numeric parsing", /\b(?:Number|parseFloat|parseInt)\s*\(/g);
    scan("domain console", /\bconsole\s*\./g);
    scan("domain randomness", /\bMath\s*\.\s*random\s*\(/g);
  }
  if (inSrc || file === "next.config.ts")
    scan("forbidden caching", /["']use cache["']|unstable_cache|force-static|cacheComponents/g);
  if (inSrc && file.endsWith(".tsx")) scan("emoji", /\p{Extended_Pictographic}/gu);
  return violations;
}

it("source obeys all architecture guards", () => {
  const files = [...globSync("src/**/*"), "next.config.ts"].filter((file) =>
    statSync(file).isFile(),
  );
  const errors = files.flatMap((file) => checkSource(file, readFileSync(file, "utf8")));
  expect(errors.map(({ file, line, rule }) => `${file}:${line} — ${rule}`).join("\n")).toBe("");
});

describe("guard self-tests", () => {
  it("requires the server-only guard at the beginning of every server module", () => {
    expect(checkSource("src/server/x.ts", "export const x = 1;")[0]?.rule).toBe(
      "server-only guard",
    );
    expect(checkSource("src/server/x.ts", 'import "server-only";\nexport const x = 1;')).toEqual(
      [],
    );
  });
  it.each([
    ["audit immutability", "src/server/x.ts", 'import "server-only"; db.update(auditLog);'],
    ["audit immutability", "src/x.ts", "db.delete(auditLog);"],
    ["proxy database dependency", "src/proxy.ts", 'import db from "@/server/db/client";'],
    ["colour literal", "src/components/bad.tsx", 'const x = <div style={{color: "#fff"}} />;'],
    [
      "default palette",
      "src/components/bad.tsx",
      'const x = <div className="hover:bg-slate-500" />;',
    ],
    ["current time outside clock", "src/lib/bad.ts", "const now = new Date();"],
    [
      "unsafe HTML",
      "src/components/bad.tsx",
      'const x = <div dangerouslySetInnerHTML={{__html: "bad"}} />;',
    ],
    ["domain dependency", "src/domain/bad.ts", 'import { cookies } from "next/headers";'],
    ["lib dependency", "src/lib/bad.ts", 'import { db } from "@/server/db";'],
    ["forbidden caching", "next.config.ts", "export default { cacheComponents: true };"],
    ["emoji", "src/components/bad.tsx", "const x = <p>\u{1F600}</p>;"],
    ["domain numeric parsing", "src/domain/bad.ts", "const x = Number(1n);"],
    ["domain console", "src/domain/bad.ts", "console.log('bad');"],
    ["domain randomness", "src/domain/bad.ts", "Math.random();"],
  ])("detects %s", (rule, file, source) =>
    expect(checkSource(file, `\n${source}`)).toContainEqual({ file, line: 2, rule }));
  it.each([
    "rgb(0,0,0)",
    "rgba(0,0,0,1)",
    "hsl(0,0%,0%)",
    "hsla(0,0%,0%,1)",
    "oklch(0 0 0)",
    "#12345678",
  ])("rejects colour syntax %s", (value) =>
    expect(checkSource("src/lib/x.ts", `const x = "${value}";`)).toHaveLength(1));
  it.each(["Date.now()", "new Date( )"])("detects current time %s", (source) =>
    expect(checkSource("src/lib/x.ts", source)[0]?.rule).toBe("current time outside clock"));
  it.each([
    "react",
    "drizzle-orm",
    "@/server/db",
    "@/app/page",
    "@/components/ui/button",
    "@/config/navigation",
    "node:fs",
  ])("rejects domain import %s", (module) =>
    expect(checkSource("src/domain/x.ts", `import x from "${module}";`)[0]?.rule).toBe(
      "domain dependency",
    ));
  it("checks dynamic imports and permits narrow exceptions", () => {
    expect(checkSource("src/domain/x.ts", 'import("node:fs")')[0]?.rule).toBe("domain dependency");
    expect(checkSource("src/domain/audit.ts", 'import { createHash } from "node:crypto";')).toEqual(
      [],
    );
    expect(checkSource("src/lib/clock.ts", "new Date(); Date.now();")).toEqual([]);
    expect(checkSource("src/lib/x.ts", 'const at = new Date("2026-09-25"); // #fff')).toEqual([]);
    expect(
      checkSource("src/components/x.tsx", '<div className="bg-atlas-green text-ink" />'),
    ).toEqual([]);
  });
});
