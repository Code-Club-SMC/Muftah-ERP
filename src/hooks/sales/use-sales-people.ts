import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSalesmenFn,
  createSalesmanFn,
  updateSalesmanFn,
  getOrderBookersFn,
  createOrderBookerFn,
  updateOrderBookerFn,
  getOrderBookerDetailFn,
  getCustomersByTypeFn,
} from "@/server-functions/sales/sales-config-fn";
import { createCustomerFn } from "@/server-functions/sales/customers-fn";

export const salesPeopleKeys = {
  all: ["sales-people"] as const,
  salesmen: () => [...salesPeopleKeys.all, "salesmen"] as const,
  orderBookers: () => [...salesPeopleKeys.all, "order-bookers"] as const,
  orderBookerDetail: (id: string) => [...salesPeopleKeys.all, "order-booker", id] as const,
  distributors: (page?: number, limit?: number) =>
    [...salesPeopleKeys.all, "distributors", page, limit] as const,
  retailers: (page?: number, limit?: number) =>
    [...salesPeopleKeys.all, "retailers", page, limit] as const,
  customers: () => [...salesPeopleKeys.all, "customers"] as const,
};

// ── Salesmen ──
export function useGetSalesmen() {
  return useQuery({
    queryKey: salesPeopleKeys.salesmen(),
    queryFn: () => getSalesmenFn(),
  });
}

export function useCreateSalesman() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSalesmanFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesPeopleKeys.salesmen() });
    },
  });
}

export function useUpdateSalesman() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSalesmanFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesPeopleKeys.salesmen() });
    },
  });
}

// ── Order Bookers ──
export function useGetOrderBookers() {
  return useQuery({
    queryKey: salesPeopleKeys.orderBookers(),
    queryFn: () => getOrderBookersFn(),
  });
}

export function useGetOrderBookerDetail(id: string) {
  return useQuery({
    queryKey: salesPeopleKeys.orderBookerDetail(id),
    queryFn: () => getOrderBookerDetailFn({ data: { id } }),
    enabled: !!id,
  });
}

export function useCreateOrderBooker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrderBookerFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesPeopleKeys.orderBookers() });
    },
  });
}

export function useUpdateOrderBooker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateOrderBookerFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesPeopleKeys.orderBookers() });
    },
  });
}

// ── Customers by Type ──
export function useGetDistributors(page = 1, limit = 20) {
  return useQuery({
    queryKey: salesPeopleKeys.distributors(page, limit),
    queryFn: () => getCustomersByTypeFn({ data: { customerType: "distributor", page, limit } }),
  });
}

export function useGetRetailers(page = 1, limit = 20) {
  return useQuery({
    queryKey: salesPeopleKeys.retailers(page, limit),
    queryFn: () => getCustomersByTypeFn({ data: { customerType: "retailer", page, limit } }),
  });
}

// ── Customers ──
export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCustomerFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesPeopleKeys.distributors() });
      qc.invalidateQueries({ queryKey: salesPeopleKeys.retailers() });
      qc.invalidateQueries({ queryKey: salesPeopleKeys.customers() });
    },
  });
}
