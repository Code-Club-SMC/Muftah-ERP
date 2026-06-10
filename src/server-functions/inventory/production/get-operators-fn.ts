import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import { user } from "@/db/schemas/auth-schema";
import { requireManufacturingViewMiddleware } from "@/lib/middlewares";

export const getOperatorsFn = createServerFn()
  .middleware([requireManufacturingViewMiddleware])
  .handler(async () => {
    // Return all users for now. You could filter by role if needed.
    const operators = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
      })
      .from(user);
    
    return operators;
  });
