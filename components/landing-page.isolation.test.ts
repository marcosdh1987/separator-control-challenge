import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const landingSource = ts.createSourceFile(
  "landing-page.tsx",
  readFileSync(resolve(process.cwd(), "components/landing-page.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const directImports = landingSource.statements
  .filter(ts.isImportDeclaration)
  .map((statement) => statement.moduleSpecifier)
  .filter(ts.isStringLiteral)
  .map((specifier) => specifier.text);

function createsWorker(source: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Worker") found = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("landing presentation isolation", () => {
  it("has no direct simulation runtime, Worker, or dashboard dependency", () => {
    expect(directImports).toContain("./process-hero");
    expect(directImports).not.toContain("@/hooks/use-simulation");
    expect(directImports).not.toContain("@/components/game-dashboard");
    expect(createsWorker(landingSource)).toBe(false);
  });
});
