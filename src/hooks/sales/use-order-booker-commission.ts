import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCommissionTiersFn,
  getOrderBookerCommissionTiersFn,
  createCommissionTierFn,
  updateCommissionTierFn,
  deleteCommissionTierFn,
  getCommissionRecordsFn,
  getCommissionSummaryFn,
} from "@/server-functions/sales/order-booker-commission-fn";

export function useGetCommissionTiers() {
  return useQuery({
    queryKey: ["commissionTiers"],
    queryFn: () => getCommissionTiersFn({ data: {} }),
  });
}

export function useGetOrderBookerCommissionTiers(orderBookerId: string) {
  return useQuery({
    queryKey: ["commissionTiers", orderBookerId],
    queryFn: () => getOrderBookerCommissionTiersFn({ data: { orderBookerId } }),
    enabled: !!orderBookerId,
  });
}

export function useCreateCommissionTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCommissionTierFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissionTiers"] });
    },
  });
}

export function useUpdateCommissionTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateCommissionTierFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissionTiers"] });
    },
  });
}

export function useDeleteCommissionTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCommissionTierFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissionTiers"] });
    },
  });
}

export function useGetCommissionRecords(orderBookerId: string, fromDate?: string, toDate?: string, status?: "accrued" | "paid" | "reversed") {
  return useQuery({
    queryKey: ["commissionRecords", orderBookerId, fromDate, toDate, status],
    queryFn: () => getCommissionRecordsFn({ data: { orderBookerId, fromDate, toDate, status } }),
    enabled: !!orderBookerId,
  });
}

export function useGetCommissionSummary(orderBookerId: string, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["commissionSummary", orderBookerId, fromDate, toDate],
    queryFn: () => getCommissionSummaryFn({ data: { orderBookerId, fromDate, toDate } }),
    enabled: !!orderBookerId && !!fromDate && !!toDate,
  });
}
