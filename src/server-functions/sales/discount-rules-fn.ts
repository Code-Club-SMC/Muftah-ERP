/**
 * Enhanced Discount Rules Server Functions
 * Supports: free units, discount cartons, percentage off, all-items or per-recipe
 */

import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { discountRules } from "@/db/schemas/sales-erp-schema";
import { customers } from "@/db/schemas/sales-schema";
import { recipes } from "@/db/schemas/inventory-schema";
import { requireSalesViewMiddleware, requireSalesManageMiddleware } from "@/lib/middlewares";
import { z } from "zod";
import { eq, and, gte, lte, or, isNull, desc } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// CREATE DISCOUNT RULE
// ═══════════════════════════════════════════════════════════════════════════
export const createDiscountRuleFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      customerId: z.string().min(1),
      recipeId: z.string().optional(), // undefined/null = applies to all items
      ruleType: z.enum(["free_units", "discount_cartons", "percentage_off"]),
      quantityThreshold: z.number().int().nonnegative().default(0),
      freeUnits: z.number().int().nonnegative().default(0),
      discountCartons: z.number().int().nonnegative().default(0),
      discountPercent: z.number().nonnegative().default(0),
      effectiveFrom: z.string().optional(),
      effectiveTo: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, data.customerId),
    });
    if (!customer) throw new Error("Distributor not found");

    // Validate recipe exists if specified
    if (data.recipeId) {
      const recipe = await db.query.recipes.findFirst({
        where: eq(recipes.id, data.recipeId),
      });
      if (!recipe) throw new Error("Recipe not found");
    }

    // Validate rule-specific fields
    if (data.ruleType === "free_units" && data.freeUnits === 0) {
      throw new Error("Free units must be greater than 0 for free_units rule type");
    }
    if (data.ruleType === "discount_cartons" && data.discountCartons === 0) {
      throw new Error("Discount cartons must be greater than 0 for discount_cartons rule type");
    }
    if (data.ruleType === "percentage_off" && data.discountPercent === 0) {
      throw new Error("Discount percent must be greater than 0 for percentage_off rule type");
    }

    const [newRule] = await db
      .insert(discountRules)
      .values({
        customerId: data.customerId,
        recipeId: data.recipeId || null,
        ruleType: data.ruleType,
        quantityThreshold: data.quantityThreshold,
        freeUnits: data.freeUnits,
        discountCartons: data.discountCartons,
        discountPercent: data.discountPercent.toString(),
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        isActive: true,
      })
      .returning();

    return newRule;
  });

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE DISCOUNT RULE
// ═══════════════════════════════════════════════════════════════════════════
export const updateDiscountRuleFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) =>
    z.object({
      id: z.string().min(1),
      ruleType: z.enum(["free_units", "discount_cartons", "percentage_off"]).optional(),
      quantityThreshold: z.number().int().nonnegative().optional(),
      freeUnits: z.number().int().nonnegative().optional(),
      discountCartons: z.number().int().nonnegative().optional(),
      discountPercent: z.number().nonnegative().optional(),
      effectiveFrom: z.string().optional(),
      effectiveTo: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const existing = await db.query.discountRules.findFirst({
      where: eq(discountRules.id, data.id),
    });
    if (!existing) throw new Error("Discount rule not found");

    const updateData: any = {};
    if (data.ruleType !== undefined) updateData.ruleType = data.ruleType;
    if (data.quantityThreshold !== undefined) updateData.quantityThreshold = data.quantityThreshold;
    if (data.freeUnits !== undefined) updateData.freeUnits = data.freeUnits;
    if (data.discountCartons !== undefined) updateData.discountCartons = data.discountCartons;
    if (data.discountPercent !== undefined) updateData.discountPercent = data.discountPercent.toString();
    if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
    if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(discountRules)
      .set(updateData)
      .where(eq(discountRules.id, data.id))
      .returning();

    return updated;
  });

// ═══════════════════════════════════════════════════════════════════════════
// DELETE DISCOUNT RULE
// ═══════════════════════════════════════════════════════════════════════════
export const deleteDiscountRuleFn = createServerFn()
  .middleware([requireSalesManageMiddleware])
  .inputValidator((input: any) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    await db.delete(discountRules).where(eq(discountRules.id, data.id));
    return { success: true };
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET DISCOUNT RULES
// ═══════════════════════════════════════════════════════════════════════════
export const getDiscountRulesFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      customerId: z.string().optional(),
      recipeId: z.string().optional(),
      ruleType: z.enum(["free_units", "discount_cartons", "percentage_off"]).optional(),
      includeInactive: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const conditions: any[] = [];

    if (data.customerId) {
      conditions.push(eq(discountRules.customerId, data.customerId));
    }
    if (data.recipeId) {
      conditions.push(
        or(
          eq(discountRules.recipeId, data.recipeId),
          isNull(discountRules.recipeId), // Include "all items" rules
        ),
      );
    }
    if (data.ruleType) {
      conditions.push(eq(discountRules.ruleType, data.ruleType));
    }
    if (!data.includeInactive) {
      conditions.push(eq(discountRules.isActive, true));
      const now = new Date();
      conditions.push(
        and(
          lte(discountRules.effectiveFrom, now),
          or(
            isNull(discountRules.effectiveTo),
            gte(discountRules.effectiveTo, now),
          ),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db.query.discountRules.findMany({
      where: whereClause,
      with: {
        customer: { columns: { id: true, name: true, customerType: true } },
        recipe: { columns: { id: true, name: true } },
      },
      orderBy: [desc(discountRules.quantityThreshold)],
    });
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET APPLICABLE DISCOUNT FOR INVOICE ITEM
// Returns all applicable rules for a line item (including global rules)
// ═══════════════════════════════════════════════════════════════════════════
export const getApplicableDiscountFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      customerId: z.string(),
      recipeId: z.string(),
      quantity: z.number().int().nonnegative(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const now = new Date();

    const rules = await db.query.discountRules.findMany({
      where: and(
        eq(discountRules.customerId, data.customerId),
        eq(discountRules.isActive, true),
        lte(discountRules.effectiveFrom, now),
        or(
          isNull(discountRules.effectiveTo),
          gte(discountRules.effectiveTo, now),
        ),
        or(
          eq(discountRules.recipeId, data.recipeId), // Specific to this recipe
          isNull(discountRules.recipeId), // OR applies to all recipes
        ),
      ),
    });

    // Filter rules where threshold is met
    const applicableRules = rules
      .filter((r) => data.quantity >= r.quantityThreshold)
      .sort((a, b) => b.quantityThreshold - a.quantityThreshold);

    // Calculate benefits for each applicable rule
    const results = applicableRules.map((rule) => {
      const multiplier = Math.floor(data.quantity / rule.quantityThreshold);
      
      switch (rule.ruleType) {
        case "free_units":
          return {
            rule,
            benefit: {
              type: "free_units" as const,
              freeUnits: multiplier * rule.freeUnits,
            },
          };
        case "discount_cartons":
          return {
            rule,
            benefit: {
              type: "discount_cartons" as const,
              discountCartons: multiplier * rule.discountCartons,
            },
          };
        case "percentage_off":
          return {
            rule,
            benefit: {
              type: "percentage_off" as const,
              percent: Number(rule.discountPercent),
            },
          };
        default:
          return { rule, benefit: { type: "none" as const } };
      }
    });

    return { rules: results };
  });

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL ACTIVE RULES FOR DISTRIBUTOR (bulk fetch for invoice creation)
// ═══════════════════════════════════════════════════════════════════════════
export const getDistributorDiscountRulesFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({
      customerId: z.string(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const now = new Date();

    return await db.query.discountRules.findMany({
      where: and(
        eq(discountRules.customerId, data.customerId),
        eq(discountRules.isActive, true),
        lte(discountRules.effectiveFrom, now),
        or(
          isNull(discountRules.effectiveTo),
          gte(discountRules.effectiveTo, now),
        ),
      ),
      with: {
        recipe: { columns: { id: true, name: true } },
      },
    });
  });
