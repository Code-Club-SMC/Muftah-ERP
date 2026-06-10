import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartonKeys } from "../api/carton.query-keys";

import {
  topUpCartonFn,
  removePacksFromCartonFn,
  setCartonCountFn,
  bulkAdjustCartonsFn,
  executeBulkCartonOperationFn,
  mergeCartonsFn,
  repackCartonFn,
  retireCartonFn,
  closeBatchFn,
  reopenBatchFn,
  addCartonsFn,
  transferPacksFn,
  dispatchCartonsFn,
  processReturnFn,
  applyQcHoldFn,
  releaseQcHoldFn,
  getCartonByIdFn,
  getCartonsByBatchFn,
  getBatchKpisFn,
  getCartonAuditLogFn,
  getBatchAuditLogFn,
  getCartonsByRecipeFn,
  getProductionRunsByRecipeFn,
  getRecipeKpisFn,
  getIntegrityAlertsFn,
  runIntegrityCheckFn,
  updateIntegrityAlertFn,
  createStockCountFn,
  getStockCountSessionFn,
  updateStockCountLineFn,
  submitStockCountFn,
  approveStockCountFn,
} from "@/server-functions/manufacturing/cartons";

// ---------------------------------------------------------------------------
// Scenario 1 — Top-Up
// ---------------------------------------------------------------------------
export function useTopUpCarton(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { delta: number; reason?: string }) =>
      topUpCartonFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(batchId) });
      toast.success("Carton updated successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to top up carton.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 2 — Remove Packs
// ---------------------------------------------------------------------------
export function useRemovePacks(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { delta: number; reason: "QC_FAIL" | "DAMAGED" | "TRANSFER" | "OTHER"; notes?: string }) =>
      removePacksFromCartonFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(batchId) });
      toast.success("Packs removed successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove packs.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 3 — Set Count Override
// ---------------------------------------------------------------------------
export function useSetCartonCount(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { newCount: number; reason: string }) =>
      setCartonCountFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(batchId) });
      toast.success("Carton count updated.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to override count.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 4 — Bulk Adjust
// ---------------------------------------------------------------------------
export function useBulkAdjust() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { cartonIds: string[]; delta: number; strategy: "SKIP" | "CAP"; reason: string }) =>
      bulkAdjustCartonsFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.all() });
      toast.success("Bulk adjust completed.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Bulk adjust failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 6 — Merge
// ---------------------------------------------------------------------------
export function useMergeCartons(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sourceCartonIds: string[]; destinationCartonId: string }) =>
      mergeCartonsFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(batchId) });
      toast.success("Cartons merged successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Merge failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 7 — Repack
// ---------------------------------------------------------------------------
export function useRepackCarton(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { newCapacity: number; justification: string }) =>
      repackCartonFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      toast.success("Carton repacked successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Repack failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 8 — Retire
// ---------------------------------------------------------------------------
export function useRetireCarton(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { reason: "LOST" | "DESTROYED" | "CONDEMNED" | "OTHER"; notes?: string }) =>
      retireCartonFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(batchId) });
      toast.success("Carton retired.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Retire failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 9 — Close Batch
// ---------------------------------------------------------------------------
export function useCloseBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { productionRunId: string; acknowledgeShortfall?: boolean }) =>
      closeBatchFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.all() });
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      toast.success("Batch closed successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to close batch.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 10 — Reopen Batch
// ---------------------------------------------------------------------------
export function useReopenBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { productionRunId: string; reopenReason: string; force?: boolean }) =>
      reopenBatchFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.all() });
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      toast.success("Batch reopened.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reopen batch.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 11 — Add Cartons
// ---------------------------------------------------------------------------
export function useAddCartons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { productionRunId: string; count: number; zone?: string }) =>
      addCartonsFn({ data: payload }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(variables.productionRunId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(variables.productionRunId) });
      toast.success("Cartons added to batch.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add cartons.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 13 — Transfer
// ---------------------------------------------------------------------------
export function useTransferPacks(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sourceCartonId: string; destinationCartonId: string; packCount: number }) =>
      transferPacksFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(batchId) });
      toast.success("Packs transferred successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Transfer failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenarios 14/15 — Dispatch
// ---------------------------------------------------------------------------
export function useDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { lines: Array<{ cartonId: string; packsToDispatch: number }>; dispatchedBy: string; orderId?: string }) =>
      dispatchCartonsFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.all() });
      toast.success("Cartons dispatched.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Dispatch failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 16 — Returns
// ---------------------------------------------------------------------------
export function useProcessReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { dispatchOrderId: string; lines: Array<{ cartonId: string; packsReturned: number; condition: "GOOD" | "DAMAGED"; destinationCartonId?: string }>; notes?: string }) =>
      processReturnFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.all() });
      toast.success("Return processed successfully.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Return processing failed.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 17 — QC Hold
// ---------------------------------------------------------------------------
export function useApplyQcHold(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { reason: string; expiresAt?: string }) =>
      applyQcHoldFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      toast.success("QC hold applied.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to apply hold.");
    },
  });
}

export function useReleaseQcHold(cartonId: string, batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { outcome: "CLEARED" | "CONDEMNED"; notes?: string }) =>
      releaseQcHoldFn({ data: { ...payload, cartonId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.detail(cartonId) });
      queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(batchId) });
      toast.success("QC hold released.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to release hold.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 12 — Batch KPIs
// ---------------------------------------------------------------------------
export function useBatchKpis(productionRunId: string) {
  return useQuery({
    queryKey: cartonKeys.batchKpis(productionRunId),
    queryFn: () => getBatchKpisFn({ data: { productionRunId } }),
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Scenario 18 — Stock Count
// ---------------------------------------------------------------------------
export function useCreateStockCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { batchId?: string; sku?: string; notes?: string }) =>
      createStockCountFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.stockSessions() });
      toast.success("Stock count session created.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create stock count.");
    },
  });
}

export function useStockCountSession(sessionId: string) {
  return useQuery({
    queryKey: cartonKeys.stockSessionDetail(sessionId),
    queryFn: () => getStockCountSessionFn({ data: { sessionId } }),
    enabled: !!sessionId,
  });
}

export function useUpdateStockCountLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { lineId: string; physicalCount: number }) =>
      updateStockCountLineFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.stockSessions() });
    },
  });
}

export function useSubmitStockCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      submitStockCountFn({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.stockSessions() });
      toast.success("Stock count submitted for approval.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit stock count.");
    },
  });
}

export function useApproveStockCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sessionId: string; approvedLines: Array<{ lineId: string; approved: boolean }> }) =>
      approveStockCountFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.stockSessions() });
      toast.success("Stock count approved.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve stock count.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 19 — Integrity Alerts
// ---------------------------------------------------------------------------
export function useIntegrityAlerts() {
  return useQuery({
    queryKey: cartonKeys.integrityAlerts(),
    queryFn: () => getIntegrityAlertsFn({ data: {} }),
  });
}

export function useRunIntegrityCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId?: string) => runIntegrityCheckFn({ data: { batchId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.integrityAlerts() });
      toast.success("Integrity check completed.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Integrity check failed.");
    },
  });
}

export function useUpdateIntegrityAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { alertId: string; status: "ACKNOWLEDGED" | "RESOLVED"; resolution?: string }) =>
      updateIntegrityAlertFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartonKeys.integrityAlerts() });
      toast.success("Alert updated.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update alert.");
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 20 — Audit Log
// ---------------------------------------------------------------------------
export function useCartonAuditLog(cartonId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: [...cartonKeys.auditLog(cartonId), { page, limit }],
    queryFn: () => getCartonAuditLogFn({ data: { cartonId, page, limit } }),
    enabled: !!cartonId,
  });
}

export function useBatchAuditLog(productionRunId: string, page = 1, limit = 50) {
  return useQuery({
    queryKey: [...cartonKeys.batchAuditLog(productionRunId), { page, limit }],
    queryFn: () => getBatchAuditLogFn({ data: { productionRunId, page, limit } }),
    enabled: !!productionRunId,
  });
}

// ---------------------------------------------------------------------------
// Carton details + batch carton list
// ---------------------------------------------------------------------------
export function useCartonDetail(cartonId: string) {
  return useQuery({
    queryKey: cartonKeys.detail(cartonId),
    queryFn: () => getCartonByIdFn({ data: { cartonId } }),
    enabled: !!cartonId,
  });
}

export function useBatchCartons(productionRunId: string) {
  return useQuery({
    queryKey: cartonKeys.byBatch(productionRunId),
    queryFn: () => getCartonsByBatchFn({ data: { productionRunId } }),
    enabled: !!productionRunId,
  });
}

export function useRecipeCartons(recipeId: string, page = 1, limit = 100, warehouseId?: string, status?: string) {
  return useQuery({
    queryKey: ["cartons", "recipe", recipeId, warehouseId, status, { page, limit }],
    queryFn: () => getCartonsByRecipeFn({ data: { recipeId, warehouseId, status, page, limit } }),
    enabled: !!recipeId,
  });
}

export function useRecipeKpis(recipeId: string, warehouseId?: string) {
  return useQuery({
    queryKey: ["cartons", "recipe-kpis", recipeId, warehouseId],
    queryFn: () => getRecipeKpisFn({ data: { recipeId, warehouseId } }),
    enabled: !!recipeId,
    refetchInterval: 30_000,
  });
}

export function useProductionRunsByRecipe(recipeId: string, warehouseId?: string) {
  return useQuery({
    queryKey: ["production-runs", "recipe", recipeId, warehouseId],
    queryFn: () => getProductionRunsByRecipeFn({ data: { recipeId, warehouseId } }),
    enabled: !!recipeId,
  });
}

export function useBulkCartonOperation(productionRunId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      operationType: "RETIRE" | "TOP_UP" | "REMOVE" | "OVERRIDE" | "REPACK" | "QC_HOLD" | "RELEASE_HOLD";
      cartonIds: string[];
      payload?: any;
    }) => executeBulkCartonOperationFn({ data }),
    onSuccess: () => {
      toast.success("Bulk operation executed successfully.");
      if (productionRunId) {
        queryClient.invalidateQueries({ queryKey: cartonKeys.byBatch(productionRunId) });
        queryClient.invalidateQueries({ queryKey: cartonKeys.batchKpis(productionRunId) });
      } else {
        queryClient.invalidateQueries({ queryKey: cartonKeys.all() });
      }
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to execute bulk operation.");
    },
  });
}