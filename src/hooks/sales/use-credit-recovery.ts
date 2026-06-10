import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDueTodaySlipsFn,
  getRecoveryQueueFn,
  getRecoverySummaryFn,
  assignRecoveryPersonFn,
  updateRecoveryStatusFn,
  createRecoveryAttemptFn,
  getRecoveryAttemptsFn,
  escalateRecoveryFn,
} from "@/server-functions/sales/credit-recovery-fn";
import { toast } from "sonner";

export const recoveryKeys = {
  all: ["credit-recovery"] as const,
  dueToday: (params: { page: number; limit: number }) =>
    [...recoveryKeys.all, "due-today", params] as const,
  queue: (params: {
    recoveryStatus?: string;
    assignedToId?: string;
    escalationLevel?: number;
    page: number;
    limit: number;
  }) => [...recoveryKeys.all, "queue", params] as const,
  summary: () => [...recoveryKeys.all, "summary"] as const,
  attempts: (slipId: string) => [...recoveryKeys.all, "attempts", slipId] as const,
};

export function useGetDueTodaySlips(page = 1, limit = 50) {
  return useQuery({
    queryKey: recoveryKeys.dueToday({ page, limit }),
    queryFn: () => getDueTodaySlipsFn({ data: { page, limit } }),
  });
}

export function useGetRecoveryQueue(filters: {
  recoveryStatus?: string;
  assignedToId?: string;
  escalationLevel?: number;
  page: number;
  limit: number;
}) {
  return useQuery({
    queryKey: recoveryKeys.queue(filters),
    queryFn: () => getRecoveryQueueFn({ data: filters }),
  });
}

export function useGetRecoverySummary() {
  return useQuery({
    queryKey: recoveryKeys.summary(),
    queryFn: () => getRecoverySummaryFn({ data: {} }),
  });
}

export function useGetRecoveryAttempts(slipId: string) {
  return useQuery({
    queryKey: recoveryKeys.attempts(slipId),
    queryFn: () => getRecoveryAttemptsFn({ data: { slipId } }),
    enabled: !!slipId,
  });
}

export function useAssignRecoveryPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slipId: string; recoveryAssignedToId?: string }) =>
      assignRecoveryPersonFn({ data }),
    onSuccess: () => {
      toast.success("Recovery person assigned");
      qc.invalidateQueries({ queryKey: recoveryKeys.all });
      qc.invalidateQueries({ queryKey: ["slip-lookup"] });
      qc.invalidateQueries({ queryKey: ["overdue-slips"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to assign"),
  });
}

export function useUpdateRecoveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slipId: string; recoveryStatus: string }) =>
      updateRecoveryStatusFn({ data }),
    onSuccess: () => {
      toast.success("Recovery status updated");
      qc.invalidateQueries({ queryKey: recoveryKeys.all });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });
}

export function useCreateRecoveryAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      slipId: string;
      assignedToId?: string;
      attemptMethod: string;
      attemptOutcome: string;
      amountPromised?: number;
      promisedDate?: Date;
      notes?: string;
    }) => createRecoveryAttemptFn({ data }),
    onSuccess: () => {
      toast.success("Recovery attempt logged");
      qc.invalidateQueries({ queryKey: recoveryKeys.all });
    },
    onError: (err: any) => toast.error(err.message || "Failed to log attempt"),
  });
}

export function useEscalateRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slipId: string) => escalateRecoveryFn({ data: { slipId } }),
    onSuccess: () => {
      toast.success("Escalated successfully");
      qc.invalidateQueries({ queryKey: recoveryKeys.all });
    },
    onError: (err: any) => toast.error(err.message || "Failed to escalate"),
  });
}


