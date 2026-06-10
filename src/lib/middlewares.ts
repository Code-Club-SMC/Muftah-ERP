import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  getAuthContext,
  requirePermission,
} from "./authz.server";
import type { PermissionKey } from "./rbac";
import { UnauthorizedError } from "./errors";

const getRequestHref = () => getRequest()?.url ?? undefined;

export const authContextMiddleware = createMiddleware().server(
  async ({ next }) => {
    const authContext = await getAuthContext();

    return await next({
      context: authContext
        ? {
            authContext,
            session: authContext.session,
          }
        : {
            authContext: null,
            session: null,
          },
    });
  },
);

export const requireAuthMiddleware = createMiddleware()
  .middleware([authContextMiddleware])
  .server(async ({ next, context }) => {
    if (!context.authContext?.session) {
      throw redirect({
        to: "/login",
        search: getRequestHref()
          ? {
              redirect: getRequestHref(),
            }
          : undefined,
      });
    }

    return await next({
      context: {
        authContext: context.authContext,
        session: context.authContext.session,
      },
    });
  });

export const createPermissionMiddleware = (permission: PermissionKey) =>
  createMiddleware()
    .middleware([requireAuthMiddleware])
    .server(async ({ next, context }) => {
      if (!context.authContext) {
        throw new UnauthorizedError();
      }

      requirePermission(context.authContext, permission);

      return await next({
        context: {
          authContext: context.authContext,
          session: context.session,
        },
      });
    });

export const requireAdminMiddleware = createMiddleware()
  .middleware([requireAuthMiddleware])
  .server(async ({ next, context }) => {
    const roleSlug = context.authContext?.role.slug;

    if (roleSlug !== "admin" && roleSlug !== "super-admin") {
      throw redirect({
        to: context.authContext?.defaultLandingPath ?? "/dashboard",
      });
    }

    return await next({
      context: {
        authContext: context.authContext,
        session: context.session,
      },
    });
  });

export const requireSuperAdminMiddleware = createMiddleware()
  .middleware([requireAuthMiddleware])
  .server(async ({ next, context }) => {
    if (context.authContext?.role.slug !== "super-admin") {
      throw redirect({
        to: context.authContext?.defaultLandingPath ?? "/dashboard",
      });
    }

    return await next({
      context: {
        authContext: context.authContext,
        session: context.session,
      },
    });
  });

export const requireDashboardViewMiddleware = createPermissionMiddleware(
  "dashboard.view",
);
export const requireManufacturingViewMiddleware = createPermissionMiddleware(
  "manufacturing.view",
);
export const requireManufacturingManageMiddleware = createPermissionMiddleware(
  "manufacturing.manage",
);
export const requireManufacturingRunReadMiddleware = createPermissionMiddleware(
  "manufacturing.run.read",
);
export const requireManufacturingRunManageMiddleware =
  createPermissionMiddleware("manufacturing.run.manage");
export const requireInventoryViewMiddleware = createPermissionMiddleware(
  "inventory.view",
);
export const requireInventoryManageMiddleware = createPermissionMiddleware(
  "inventory.manage",
);
export const requireSuppliersViewMiddleware = createPermissionMiddleware(
  "suppliers.view",
);
export const requireSuppliersManageMiddleware = createPermissionMiddleware(
  "suppliers.manage",
);
export const requireSalesViewMiddleware = createPermissionMiddleware("sales.view");
export const requireSalesManageMiddleware = createPermissionMiddleware(
  "sales.manage",
);
export const requireSalesPeopleViewMiddleware = createPermissionMiddleware(
  "sales.people.view",
);
export const requireSalesPeopleManageMiddleware = createPermissionMiddleware(
  "sales.people.manage",
);
export const requireSalesConfigViewMiddleware = createPermissionMiddleware(
  "sales.config.view",
);
export const requireSalesConfigManageMiddleware = createPermissionMiddleware(
  "sales.config.manage",
);
export const requireSalesOverviewMiddleware = createPermissionMiddleware(
  "sales.overview",
);
export const requireSalesOrdersViewMiddleware = createPermissionMiddleware(
  "sales.orders.view",
);
export const requireSalesOrdersManageMiddleware = createPermissionMiddleware(
  "sales.orders.manage",
);
export const requireSalesRecoveryViewMiddleware = createPermissionMiddleware(
  "sales.recovery.view",
);
export const requireSalesRecoveryManageMiddleware = createPermissionMiddleware(
  "sales.recovery.manage",
);
export const requireFinanceViewMiddleware = createPermissionMiddleware(
  "finance.view",
);
export const requireFinanceManageMiddleware = createPermissionMiddleware(
  "finance.manage",
);
export const requireHrViewMiddleware = createPermissionMiddleware("hr.view");
export const requireHrManageMiddleware = createPermissionMiddleware("hr.manage");
export const requireOperatorViewMiddleware = createPermissionMiddleware(
  "operator.view",
);
export const requireOperatorRunReadMiddleware = createPermissionMiddleware(
  "operator.run.read",
);
export const requireOperatorRunLogMiddleware = createPermissionMiddleware(
  "operator.run.log",
);
export const requireOperatorRunCompleteMiddleware = createPermissionMiddleware(
  "operator.run.complete",
);
export const requireOperatorRunFailMiddleware = createPermissionMiddleware(
  "operator.run.fail",
);
export const requireUserManagementViewMiddleware = createPermissionMiddleware(
  "user-management.view",
);
export const requireUserManagementUsersManageMiddleware =
  createPermissionMiddleware("user-management.users.manage");
export const requireUserManagementRolesManageMiddleware =
  createPermissionMiddleware("user-management.roles.manage");

// Carton management permissions
export const requireCartonTopupMiddleware = createPermissionMiddleware(
  "manufacturing.carton.topup",
);
export const requireCartonRemoveMiddleware = createPermissionMiddleware(
  "manufacturing.carton.remove",
);
export const requireCartonOverrideMiddleware = createPermissionMiddleware(
  "manufacturing.carton.override",
);
export const requireCartonBulkMiddleware = createPermissionMiddleware(
  "manufacturing.carton.bulk",
);
export const requireCartonMergeMiddleware = createPermissionMiddleware(
  "manufacturing.carton.merge",
);
export const requireCartonRepackMiddleware = createPermissionMiddleware(
  "manufacturing.carton.repack",
);
export const requireCartonRetireMiddleware = createPermissionMiddleware(
  "manufacturing.carton.retire",
);
export const requireBatchCloseMiddleware = createPermissionMiddleware(
  "manufacturing.batch.close",
);
export const requireBatchReopenMiddleware = createPermissionMiddleware(
  "manufacturing.batch.reopen",
);
export const requireCartonAddMiddleware = createPermissionMiddleware(
  "manufacturing.carton.add",
);
export const requireCartonTransferMiddleware = createPermissionMiddleware(
  "manufacturing.carton.transfer",
);
export const requireDispatchMiddleware = createPermissionMiddleware(
  "manufacturing.dispatch",
);
export const requireReturnsMiddleware = createPermissionMiddleware(
  "manufacturing.returns",
);
export const requireQcHoldMiddleware = createPermissionMiddleware(
  "manufacturing.qc.hold",
);
export const requireQcReleaseMiddleware = createPermissionMiddleware(
  "manufacturing.qc.release",
);
export const requireStockCountMiddleware = createPermissionMiddleware(
  "manufacturing.stock-count",
);
export const requireStockCountApproveMiddleware = createPermissionMiddleware(
  "manufacturing.stock-count.approve",
);
export const requireIntegrityCheckMiddleware = createPermissionMiddleware(
  "manufacturing.integrity.check",
);
export const requireIntegrityAlertsMiddleware = createPermissionMiddleware(
  "manufacturing.integrity.alerts",
);
export const requireAuditExportMiddleware = createPermissionMiddleware(
  "manufacturing.audit.export",
);
export const requireReportsViewMiddleware = createPermissionMiddleware(
  "reports.view",
);
export const requireOrderBookerViewMiddleware = createPermissionMiddleware(
  "order-booker.view",
);
export const requireOrderBookerOrdersManageMiddleware = createPermissionMiddleware(
  "order-booker.orders.manage",
);
export const requireOrderBookerTripsManageMiddleware = createPermissionMiddleware(
  "order-booker.trips.manage",
);

export const requireNoAuthMiddleware = createMiddleware()
  .middleware([authContextMiddleware])
  .server(async ({ next, context }) => {
    if (context.authContext?.session) {
      throw redirect({
        to: context.authContext.defaultLandingPath,
      });
    }

    return await next();
  });
