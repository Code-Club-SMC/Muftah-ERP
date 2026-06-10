import { redirect } from "@tanstack/react-router";
import { canAccessPath, getFirstAccessiblePath } from "@/lib/rbac";
import { getViewerAccessFn } from "@/server-functions/auth/get-viewer-access-fn";
import { getOrderBookerPortalAccessFn } from "@/server-functions/sales/order-booker-self-service-fn";

type ViewerAccess = NonNullable<Awaited<ReturnType<typeof getViewerAccessFn>>>;

export function resolveOrderBookerFallbackPath(viewerAccess: ViewerAccess) {
  const candidates = [
    viewerAccess.defaultLandingPath,
    "/user-management",
    "/dashboard",
    "/sales/orders",
    "/sales/customers",
    "/finance/accounts",
    "/operator",
    "/reports",
    getFirstAccessiblePath(viewerAccess.permissions),
    "/",
  ];

  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate) || candidate.startsWith("/order-booker")) {
      continue;
    }

    seen.add(candidate);

    if (candidate === "/" || canAccessPath(candidate, viewerAccess.permissions)) {
      return candidate;
    }
  }

  return "/";
}

export async function ensureOrderBookerPortalRouteAccess() {
  const viewerAccess = await getViewerAccessFn();

  if (!viewerAccess) {
    throw redirect({
      to: "/login",
    });
  }

  const portalAccess = await getOrderBookerPortalAccessFn();

  if (!portalAccess.allowed) {
    throw redirect({
      to: resolveOrderBookerFallbackPath(viewerAccess),
    });
  }

  return portalAccess.profile;
}
