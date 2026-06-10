import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDiscountRulesFn,
  createDiscountRuleFn,
  deleteDiscountRuleFn,
  getApplicableDiscountFn,
  getDistributorDiscountRulesFn,
} from "@/server-functions/sales/discount-rules-fn";

export const discountKeys = {
  all: ["discount-rules"] as const,
  list: (filters?: { customerId?: string; recipeId?: string }) =>
    [...discountKeys.all, "list", filters] as const,
  applicable: (customerId: string, recipeId: string, quantity: number) =>
    [...discountKeys.all, "applicable", customerId, recipeId, quantity] as const,
  distributor: (customerId: string) =>
    [...discountKeys.all, "distributor", customerId] as const,
};

export function useGetDiscountRules(filters?: { customerId?: string; recipeId?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: discountKeys.list(filters),
    queryFn: () => getDiscountRulesFn({ data: filters || {} }),
  });
}

export function useCreateDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDiscountRuleFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discountKeys.all });
    },
  });
}

export function useDeleteDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscountRuleFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discountKeys.all });
    },
  });
}

export function useGetApplicableDiscountRule(customerId: string, recipeId: string, quantity: number, enabled = true) {
  return useQuery({
    queryKey: discountKeys.applicable(customerId, recipeId, quantity),
    queryFn: () => getApplicableDiscountFn({ data: { customerId, recipeId, quantity } }),
    enabled: enabled && !!customerId && !!recipeId && quantity > 0,
  });
}

export function useGetDistributorDiscountRules(customerId: string, enabled = true) {
  return useQuery({
    queryKey: discountKeys.distributor(customerId),
    queryFn: () => getDistributorDiscountRulesFn({ data: { customerId } }),
    enabled: enabled && !!customerId,
  });
}
