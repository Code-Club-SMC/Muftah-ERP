import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMyOrdersFn,
  createMyOrderFn,
  getMyTripsFn,
  createMyTripFn,
  getMyCommissionFn,
  getMyProfileFn,
} from "@/server-functions/sales/order-booker-self-service-fn";

// ═══════════════════════════════════════════════════════════════════════════
// Query Key Factory
// ═══════════════════════════════════════════════════════════════════════════

export const orderBookerKeys = {
  all: ["order-booker"] as const,
  orders: (params?: Record<string, any>) => [...orderBookerKeys.all, "orders", params ?? {}] as const,
  trips: (params?: Record<string, any>) => [...orderBookerKeys.all, "trips", params ?? {}] as const,
  commission: (params?: Record<string, any>) => [...orderBookerKeys.all, "commission", params ?? {}] as const,
  profile: () => [...orderBookerKeys.all, "profile"] as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// Shared defaults for self-service queries
// ═══════════════════════════════════════════════════════════════════════════

const LIST_DEFAULTS = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: 2,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 5000),
  placeholderData: (prev: any) => prev,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════════════════════════════════

export function useMyOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: orderBookerKeys.orders(params),
    queryFn: () => getMyOrdersFn({ data: params ?? {} }),
    ...LIST_DEFAULTS,
  });
}

export function useCreateMyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMyOrderFn,
    onSuccess: () => {
      toast.success("Order created");
      qc.invalidateQueries({ queryKey: orderBookerKeys.orders() });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create order");
    },
    retry: 1,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Trips
// ═══════════════════════════════════════════════════════════════════════════

export function useMyTrips(params?: {
  page?: number;
  limit?: number;
  vehicleType?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: orderBookerKeys.trips(params),
    queryFn: () => getMyTripsFn({ data: params ?? {} }),
    ...LIST_DEFAULTS,
  });
}

export function useCreateMyTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMyTripFn,
    onSuccess: () => {
      toast.success("Trip logged");
      qc.invalidateQueries({ queryKey: orderBookerKeys.trips() });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log trip");
    },
    retry: 1,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Commission
// ═══════════════════════════════════════════════════════════════════════════

export function useMyCommission(params?: {
  page?: number;
  limit?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: orderBookerKeys.commission(params),
    queryFn: () => getMyCommissionFn({ data: params ?? {} }),
    ...LIST_DEFAULTS,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════════════════

export function useMyProfile() {
  return useQuery({
    queryKey: orderBookerKeys.profile(),
    queryFn: () => getMyProfileFn(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
}
