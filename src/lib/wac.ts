/**
 * Weighted Average Cost (WAC) utility module.
 *
 * Provides pure functions for computing actual production run costs,
 * WAC blending when finished goods are received into inventory,
 * and yield variance analysis.
 *
 * All formulas are documented inline with the business reasoning.
 */

/**
 * Result of calculating actual run costs from production materials used.
 */
export type ActualRunCostResult = {
	totalProductionCost: number;
	actualCostPerPack: number;
	actualCostPerCarton: number;
	actualPacksProduced: number;
	actualCartonsProduced: number;
	actualLooseUnitsProduced: number;
	yieldVarianceCartons: number;
};

/**
 * Calculate the actual per-unit cost of a completed production run.
 *
 * This uses the ACTUAL total production cost (already accumulated on the run
 * from chemicals deducted at start + packaging deducted during progress/completion)
 * divided by ACTUAL output quantities — never planned/target quantities.
 *
 * @param totalProductionCost - From productionRuns.totalProductionCost
 * @param actualPacksProduced - Total containers actually produced (= completedUnits)
 * @param actualCartonsProduced - Full cartons produced
 * @param actualLooseUnitsProduced - Loose containers (not in cartons)
 * @param plannedCartonsProduced - The planned carton target from run creation
 * @returns Cost breakdown and variance metrics
 */
export function calculateActualRunCost(
	totalProductionCost: number,
	actualPacksProduced: number,
	actualCartonsProduced: number,
	actualLooseUnitsProduced: number,
	plannedCartonsProduced: number,
): ActualRunCostResult {
	const actualCostPerPack =
		actualPacksProduced > 0 ? totalProductionCost / actualPacksProduced : 0;

	// For loose-only products (no cartons), actualCostPerCarton is 0
	// since there are no cartons to cost against.
	const actualCostPerCarton =
		actualCartonsProduced > 0
			? totalProductionCost / actualCartonsProduced
			: 0;

	const yieldVarianceCartons = plannedCartonsProduced - actualCartonsProduced;

	return {
		totalProductionCost,
		actualCostPerPack,
		actualCostPerCarton,
		actualPacksProduced,
		actualCartonsProduced,
		actualLooseUnitsProduced,
		yieldVarianceCartons,
	};
}

/**
 * Compute the new Weighted Average Cost per pack when new production output
 * is received into existing inventory.
 *
 * WAC Formula:
 *   newWAC = (currentUnits × currentWAC + addedUnits × addedCostPerPack)
 *            / (currentUnits + addedUnits)
 *
 * If current inventory is zero (first run or stock fully depleted),
 * the WAC is simply the added cost per pack — no blending needed.
 *
 * @param currentTotalUnits - Current total units in stock (cartons × packsPerCarton + loose)
 * @param currentWACPerPack - Current WAC per pack from finishedGoodsStock
 * @param addedUnits - Units being added from the new production run
 * @param addedCostPerPack - Actual cost per pack of the new production run
 * @returns The new blended WAC per pack
 */
export function calculateNewWAC(
	currentTotalUnits: number,
	currentWACPerPack: number,
	addedUnits: number,
	addedCostPerPack: number,
): number {
	if (currentTotalUnits <= 0) {
		return addedCostPerPack;
	}

	if (addedUnits <= 0) {
		return currentWACPerPack;
	}

	const newValue = currentTotalUnits * currentWACPerPack + addedUnits * addedCostPerPack;
	const newTotalUnits = currentTotalUnits + addedUnits;

	return newValue / newTotalUnits;
}

/**
 * Compute the WAC per carton from WAC per pack and containers per carton.
 *
 * For loose-only products (containersPerCarton = 0), returns 0
 * since there are no cartons.
 */
export function calculateWACPerCarton(
	wacPerPack: number,
	containersPerCarton: number,
): number {
	if (!containersPerCarton || containersPerCarton <= 0) {
		return 0;
	}
	return wacPerPack * containersPerCarton;
}

/**
 * Calculate the total number of units for a finished goods stock record.
 * Handles both carton-based and loose-only products.
 */
export function calculateTotalUnits(
	quantityCartons: number,
	quantityContainers: number,
	containersPerCarton: number,
): number {
	if (containersPerCarton && containersPerCarton > 0) {
		return quantityCartons * containersPerCarton + quantityContainers;
	}
	return quantityContainers;
}

/**
 * Recalculate totalInventoryValue after inventory changes.
 * This prevents floating-point drift by computing value from WAC × units.
 */
export function calculateTotalInventoryValue(
	totalUnits: number,
	wacPerPack: number,
): number {
	return totalUnits * wacPerPack;
}

/**
 * Compute Weighted Average Cost at destination when finished goods
 * are transferred between warehouses.
 *
 * Destination blend formula:
 *   newDestWAC = (destUnits × destWAC + transferredUnits × sourceWAC)
 *                / (destUnits + transferredUnits)
 *
 * Source WAC per unit stays the same — only the quantity changes at source.
 */
export function calculateTransferDestinationWAC(
	destTotalUnits: number,
	destWACPerPack: number,
	transferredUnits: number,
	sourceWACPerPack: number,
): number {
	if (destTotalUnits <= 0) {
		// Destination has no existing stock — WAC becomes the source's WAC
		return sourceWACPerPack;
	}

	if (transferredUnits <= 0) {
		return destWACPerPack;
	}

	const destValue = destTotalUnits * destWACPerPack;
	const transferredValue = transferredUnits * sourceWACPerPack;

	return (destValue + transferredValue) / (destTotalUnits + transferredUnits);
}