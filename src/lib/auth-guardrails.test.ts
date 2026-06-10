import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth hardening guardrails", () => {
  it("does not leave the operator lookup endpoint auth-only", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/server-functions/inventory/production/get-operators-fn.ts"),
      "utf8",
    );

    expect(source).toContain("requireManufacturingViewMiddleware");
    expect(source).not.toContain(".middleware([requireAuthMiddleware])");
  });

  it("uses explicit permission middleware for carton read and integrity endpoints", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/server-functions/manufacturing/cartons/get-cartons-fn.ts"),
      "utf8",
    );

    expect(source).toContain("requireManufacturingViewMiddleware");
    expect(source).toContain("requireIntegrityAlertsMiddleware");
    expect(source).toContain("requireIntegrityCheckMiddleware");
    expect(source).not.toContain(".middleware([requireAuthMiddleware])");
  });
});
