import { describe, expect, it } from "vitest";
import {
  LANDING_PATH_OPTIONS,
  canAccessPath,
  getFirstAccessiblePath,
} from "./rbac";

describe("rbac route rules", () => {
  it("checks specific sales routes before the generic sales matcher", () => {
    expect(canAccessPath("/sales/orders", ["sales.view"])).toBe(false);
    expect(canAccessPath("/sales/orders", ["sales.orders.view"])).toBe(true);
    expect(canAccessPath("/sales/recovery", ["sales.view"])).toBe(false);
    expect(canAccessPath("/sales/recovery", ["sales.recovery.view"])).toBe(true);
    expect(canAccessPath("/sales/people", ["sales.view"])).toBe(false);
    expect(canAccessPath("/sales/people", ["sales.people.view"])).toBe(true);
  });

  it("surfaces order booker as a first-class landing path", () => {
    expect(LANDING_PATH_OPTIONS).toContain("/order-booker");
    expect(canAccessPath("/order-booker", ["order-booker.view"])).toBe(true);
    expect(getFirstAccessiblePath(["order-booker.view"])).toBe("/order-booker");
  });
});
