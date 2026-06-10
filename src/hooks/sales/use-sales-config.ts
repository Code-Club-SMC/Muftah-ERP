import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecipePricesFn,
  upsertRecipePriceFn,
} from "@/server-functions/sales/sales-config-fn";

export const configKeys = {
  all: ["sales-config"] as const,
  recipePrices: () => [...configKeys.all, "recipe-prices"] as const,
};

export function useGetRecipePrices() {
  return useQuery({
    queryKey: configKeys.recipePrices(),
    queryFn: () => getRecipePricesFn(),
  });
}

export function useUpsertRecipePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertRecipePriceFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: configKeys.recipePrices() });
    },
  });
}
