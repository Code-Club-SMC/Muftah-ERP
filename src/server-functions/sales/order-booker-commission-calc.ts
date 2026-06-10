import { db } from "@/db";
import { commissionTiers, commissionRecords, orderBookers } from "@/db/schemas/sales-erp-schema";
import { eq, and, isNull } from "drizzle-orm";

export async function calculateCommissionForOrder(
  tx: any,
  orderBookerId: string,
  orderId: string,
  fulfilledAmount: number,
) {
  const dbOrTx = tx || db;

  // 1. Try order-booker-specific tiers first
  let tiers = await dbOrTx.query.commissionTiers.findMany({
    where: and(
      eq(commissionTiers.orderBookerId, orderBookerId),
      eq(commissionTiers.isActive, true),
    ),
    orderBy: [commissionTiers.minAmount],
  });

  // 2. Fall back to global tiers if no booker-specific tiers
  if (tiers.length === 0) {
    tiers = await dbOrTx.query.commissionTiers.findMany({
      where: and(
        isNull(commissionTiers.orderBookerId),
        eq(commissionTiers.isActive, true),
      ),
      orderBy: [commissionTiers.minAmount],
    });
  }

  let totalCommission = 0;
  let appliedRate = 0;

  for (const tier of tiers) {
    const min = parseFloat(tier.minAmount);
    const max = tier.maxAmount ? parseFloat(tier.maxAmount) : Infinity;
    const rate = parseFloat(tier.rate);

    if (fulfilledAmount > min) {
      const bandAmount = Math.min(fulfilledAmount, max) - min;
      if (bandAmount > 0) {
        totalCommission += Math.round(bandAmount * rate * 100) / 10000;
        appliedRate = rate;
      }
    }
  }

  // If no tiers match, fall back to flat commissionRate on orderBooker
  if (totalCommission === 0) {
    const ob = await dbOrTx.query.orderBookers.findFirst({
      where: eq(orderBookers.id, orderBookerId),
    });
    if (ob && ob.commissionRate) {
      const flatRate = parseFloat(ob.commissionRate);
      totalCommission = Math.round(fulfilledAmount * flatRate * 100) / 10000;
      appliedRate = flatRate;
    }
  }

  await dbOrTx
    .insert(commissionRecords)
    .values({
      orderBookerId,
      orderId,
      fulfilledAmount: fulfilledAmount.toString(),
      appliedRate: appliedRate.toString(),
      commissionAmount: totalCommission.toFixed(2),
      status: "accrued",
    })
    .onConflictDoNothing({
      target: [commissionRecords.orderBookerId, commissionRecords.orderId],
    });

  const record = await dbOrTx.query.commissionRecords.findFirst({
    where: and(
      eq(commissionRecords.orderBookerId, orderBookerId),
      eq(commissionRecords.orderId, orderId),
    ),
  });

  return record;
}
