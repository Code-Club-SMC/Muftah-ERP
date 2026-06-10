import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { recipes } from "@/db/schemas/inventory-schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireSalesViewMiddleware } from "@/lib/middlewares";

export const getRecipesByProductFn = createServerFn()
  .middleware([requireSalesViewMiddleware])
  .inputValidator((input: any) =>
    z.object({ productId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    return await db.query.recipes.findMany({
      where: eq(recipes.productId, data.productId),
      columns: {
        id: true,
        name: true,
        containersPerCarton: true,
        estimatedCostPerContainer: true,
      },
    });
  });
