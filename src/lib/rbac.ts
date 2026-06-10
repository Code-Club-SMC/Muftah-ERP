import type { NavigationItem } from "./constants";

export const SYSTEM_ROLE_SLUGS = [
  "super-admin",
  "admin",
  "finance-manager",
  "operator",
  "order-booker",
] as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

export const MODULE_KEYS = [
  "dashboard",
  "manufacturing",
  "inventory",
  "suppliers",
  "sales",
  "order-booker",
  "finance",
  "hr",
  "operator",
  "user-management",
  "rbac",
  "reports",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const PERMISSION_KEYS = [
  "dashboard.view",
  "manufacturing.view",
  "manufacturing.manage",
  "manufacturing.run.read",
  "manufacturing.run.manage",
  "manufacturing.carton.topup",
  "manufacturing.carton.remove",
  "manufacturing.carton.override",
  "manufacturing.carton.bulk",
  "manufacturing.carton.merge",
  "manufacturing.carton.repack",
  "manufacturing.carton.retire",
  "manufacturing.batch.close",
  "manufacturing.batch.reopen",
  "manufacturing.carton.add",
  "manufacturing.carton.transfer",
  "manufacturing.dispatch",
  "manufacturing.returns",
  "manufacturing.qc.hold",
  "manufacturing.qc.release",
  "manufacturing.stock-count",
  "manufacturing.stock-count.approve",
  "manufacturing.integrity.check",
  "manufacturing.integrity.alerts",
  "manufacturing.audit.export",
  "inventory.view",
  "inventory.manage",
  "suppliers.view",
  "suppliers.manage",
  "sales.view",
  "sales.manage",
  "sales.people.view",
  "sales.people.manage",
  "sales.config.view",
  "sales.config.manage",
      "sales.overview",
      "sales.orders.view",
      "sales.orders.manage",
      "sales.recovery.view",
      "sales.recovery.manage",
      "finance.view",
  "finance.manage",
  "hr.view",
  "hr.manage",
  "operator.view",
  "operator.run.read",
  "operator.run.log",
  "operator.run.complete",
  "operator.run.fail",
  "user-management.view",
  "user-management.users.manage",
  "user-management.roles.manage",
  "reports.view",
  "order-booker.view",
  "order-booker.orders.manage",
  "order-booker.trips.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionDefinition = {
  key: PermissionKey;
  moduleKey: ModuleKey;
  label: string;
  description: string;
  kind: "route" | "action";
  routePattern?: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "dashboard.view",
    moduleKey: "dashboard",
    label: "View dashboard",
    description: "Open the operational dashboard.",
    kind: "route",
    routePattern: "/dashboard",
  },
  {
    key: "manufacturing.view",
    moduleKey: "manufacturing",
    label: "View manufacturing",
    description: "Open manufacturing overview routes.",
    kind: "route",
    routePattern: "/manufacturing",
  },
  {
    key: "manufacturing.manage",
    moduleKey: "manufacturing",
    label: "Manage manufacturing",
    description: "Create and update manufacturing records.",
    kind: "action",
  },
  {
    key: "manufacturing.run.read",
    moduleKey: "manufacturing",
    label: "View production run detail",
    description: "Open the manufacturing production run detail route.",
    kind: "route",
    routePattern: "/manufacturing/productions/$runId",
  },
  {
    key: "manufacturing.run.manage",
    moduleKey: "manufacturing",
    label: "Manage production runs",
    description: "Start, cancel, and administer production runs.",
    kind: "action",
  },
  {
    key: "manufacturing.carton.topup",
    moduleKey: "manufacturing",
    label: "Top-up cartons",
    description: "Add packs to partial cartons.",
    kind: "action",
  },
  {
    key: "manufacturing.carton.remove",
    moduleKey: "manufacturing",
    label: "Remove packs from cartons",
    description: "Remove packs from cartons.",
    kind: "action",
  },
  {
    key: "manufacturing.carton.override",
    moduleKey: "manufacturing",
    label: "Override carton pack count",
    description: "Set a carton to an exact pack count (supervisor+).",
    kind: "action",
  },
  {
    key: "manufacturing.carton.bulk",
    moduleKey: "manufacturing",
    label: "Bulk adjust cartons",
    description: "Apply bulk adjustments to multiple cartons at once.",
    kind: "action",
  },
  {
    key: "manufacturing.carton.merge",
    moduleKey: "manufacturing",
    label: "Merge cartons",
    description: "Merge packs from multiple partial cartons into one.",
    kind: "action",
  },
  {
    key: "manufacturing.carton.repack",
    moduleKey: "manufacturing",
    label: "Repack cartons",
    description: "Change a carton's capacity (manager+).",
    kind: "action",
  },
  {
    key: "manufacturing.carton.retire",
    moduleKey: "manufacturing",
    label: "Retire cartons",
    description: "Retire damaged or lost cartons from inventory.",
    kind: "action",
  },
  {
    key: "manufacturing.batch.close",
    moduleKey: "manufacturing",
    label: "Close production batches",
    description: "Seal all cartons and close a production run.",
    kind: "action",
  },
  {
    key: "manufacturing.batch.reopen",
    moduleKey: "manufacturing",
    label: "Reopen production batches",
    description: "Reopen a closed production run for corrections (admin only).",
    kind: "action",
  },
  {
    key: "manufacturing.carton.add",
    moduleKey: "manufacturing",
    label: "Add cartons to batch",
    description: "Add supplementary cartons to a production run.",
    kind: "action",
  },
  {
    key: "manufacturing.carton.transfer",
    moduleKey: "manufacturing",
    label: "Transfer packs between cartons",
    description: "Move packs from one carton to another.",
    kind: "action",
  },
  {
    key: "manufacturing.dispatch",
    moduleKey: "manufacturing",
    label: "Dispatch cartons",
    description: "Dispatch cartons for delivery.",
    kind: "action",
  },
  {
    key: "manufacturing.returns",
    moduleKey: "manufacturing",
    label: "Process returns",
    description: "Process returned dispatched packs (good or damaged).",
    kind: "action",
  },
  {
    key: "manufacturing.qc.hold",
    moduleKey: "manufacturing",
    label: "Apply QC hold",
    description: "Place a carton on QC hold.",
    kind: "action",
  },
  {
    key: "manufacturing.qc.release",
    moduleKey: "manufacturing",
    label: "Release QC hold",
    description: "Clear or condemn a carton on QC hold (manager+).",
    kind: "action",
  },
  {
    key: "manufacturing.stock-count",
    moduleKey: "manufacturing",
    label: "Conduct stock count",
    description: "Create and enter physical stock count sessions.",
    kind: "action",
  },
  {
    key: "manufacturing.stock-count.approve",
    moduleKey: "manufacturing",
    label: "Approve stock counts",
    description: "Approve or reject flagged stock count lines (manager+).",
    kind: "action",
  },
  {
    key: "manufacturing.integrity.check",
    moduleKey: "manufacturing",
    label: "Run integrity checks",
    description: "Run on-demand integrity checks (admin only).",
    kind: "action",
  },
  {
    key: "manufacturing.integrity.alerts",
    moduleKey: "manufacturing",
    label: "View integrity alerts",
    description: "View and manage integrity alert status.",
    kind: "route",
    routePattern: "/manufacturing/integrity",
  },
  {
    key: "manufacturing.audit.export",
    moduleKey: "manufacturing",
    label: "Export audit logs",
    description: "Export carton audit logs as CSV (supervisor+).",
    kind: "action",
  },
  {
    key: "inventory.view",
    moduleKey: "inventory",
    label: "View inventory",
    description: "Open inventory and factory floor routes.",
    kind: "route",
    routePattern: "/inventory",
  },
  {
    key: "inventory.manage",
    moduleKey: "inventory",
    label: "Manage inventory",
    description: "Create and update inventory resources.",
    kind: "action",
  },
  {
    key: "suppliers.view",
    moduleKey: "suppliers",
    label: "View suppliers",
    description: "Open supplier management routes.",
    kind: "route",
    routePattern: "/suppliers",
  },
  {
    key: "suppliers.manage",
    moduleKey: "suppliers",
    label: "Manage suppliers",
    description: "Create, update, and delete supplier records.",
    kind: "action",
  },
  {
    key: "sales.view",
    moduleKey: "sales",
    label: "View sales",
    description: "Open customer and invoice routes.",
    kind: "route",
    routePattern: "/sales",
  },
  {
    key: "sales.manage",
    moduleKey: "sales",
    label: "Manage sales",
    description: "Create invoices and maintain customer data.",
    kind: "action",
  },
  {
    key: "sales.people.view",
    moduleKey: "sales",
    label: "View sales people",
    description: "Open sales people routes.",
    kind: "route",
    routePattern: "/sales/people",
  },
  {
    key: "sales.people.manage",
    moduleKey: "sales",
    label: "Manage sales people",
    description: "Create and update sales people.",
    kind: "action",
  },
  {
    key: "sales.config.view",
    moduleKey: "sales",
    label: "View sales configurations",
    description: "Open sales configuration routes.",
    kind: "route",
    routePattern: "/sales/configurations",
  },
  {
    key: "sales.config.manage",
    moduleKey: "sales",
    label: "Manage sales configurations",
    description: "Update pricing, rates, and rules.",
    kind: "action",
  },
  {
    key: "sales.overview",
    moduleKey: "sales",
    label: "View sales overview",
    description: "Open sales dashboard and reports.",
    kind: "route",
    routePattern: "/sales/overview",
  },
  {
    key: "sales.orders.view",
    moduleKey: "sales",
    label: "View orders",
    description: "Open order booker order routes.",
    kind: "route",
    routePattern: "/sales/orders",
  },
  {
    key: "sales.orders.manage",
    moduleKey: "sales",
    label: "Manage orders",
    description: "Create and update orders.",
    kind: "action",
  },
  {
    key: "sales.recovery.view",
    moduleKey: "sales",
    label: "View credit recovery",
    description: "Open credit recovery routes.",
    kind: "route",
    routePattern: "/sales/recovery",
  },
  {
    key: "sales.recovery.manage",
    moduleKey: "sales",
    label: "Manage credit recovery",
    description: "Assign recovery people, log attempts, escalate.",
    kind: "action",
  },
  {
    key: "finance.view",
    moduleKey: "finance",
    label: "View finance",
    description: "Open finance reporting routes.",
    kind: "route",
    routePattern: "/finance",
  },
  {
    key: "finance.manage",
    moduleKey: "finance",
    label: "Manage finance",
    description: "Create and update financial records.",
    kind: "action",
  },
  {
    key: "hr.view",
    moduleKey: "hr",
    label: "View HR & payroll",
    description: "Open HR and payroll routes.",
    kind: "route",
    routePattern: "/hr",
  },
  {
    key: "hr.manage",
    moduleKey: "hr",
    label: "Manage HR & payroll",
    description: "Create and update HR and payroll records.",
    kind: "action",
  },
  {
    key: "operator.view",
    moduleKey: "operator",
    label: "View operator interface",
    description: "Open the operator interface.",
    kind: "route",
    routePattern: "/operator",
  },
  {
    key: "operator.run.read",
    moduleKey: "operator",
    label: "View operator run detail",
    description: "Open the operator production run screen.",
    kind: "route",
    routePattern: "/operator/$runId",
  },
  {
    key: "operator.run.log",
    moduleKey: "operator",
    label: "Log production progress",
    description: "Record operator run progress.",
    kind: "action",
  },
  {
    key: "operator.run.complete",
    moduleKey: "operator",
    label: "Complete production runs",
    description: "Mark a run as completed from operator workflows.",
    kind: "action",
  },
  {
    key: "operator.run.fail",
    moduleKey: "operator",
    label: "Fail production runs",
    description: "Mark a run as failed from operator workflows.",
    kind: "action",
  },
  {
    key: "user-management.view",
    moduleKey: "user-management",
    label: "View user management",
    description: "Open the user management control plane.",
    kind: "route",
    routePattern: "/user-management",
  },
  {
    key: "user-management.users.manage",
    moduleKey: "user-management",
    label: "Manage users",
    description: "Create users, rotate passwords, ban, unban, and remove users.",
    kind: "action",
  },
  {
    key: "user-management.roles.manage",
    moduleKey: "rbac",
    label: "Manage roles and access",
    description: "Create, update, archive, and delete roles and permissions.",
    kind: "action",
  },
  {
    key: "reports.view",
    moduleKey: "reports",
    label: "View reports",
    description: "Open the reports module and generate operational reports.",
    kind: "route",
    routePattern: "/reports",
  },
  {
    key: "order-booker.view",
    moduleKey: "order-booker",
    label: "Access order booker portal",
    description: "Open the self-service order booker portal.",
    kind: "route",
    routePattern: "/order-booker",
  },
  {
    key: "order-booker.orders.manage",
    moduleKey: "order-booker",
    label: "Manage own orders",
    description: "Create and view own orders in the portal.",
    kind: "action",
  },
  {
    key: "order-booker.trips.manage",
    moduleKey: "order-booker",
    label: "Manage own trips",
    description: "Log and view own trips in the portal.",
    kind: "action",
  },
];

export const PERMISSION_DEFINITION_MAP = Object.fromEntries(
  PERMISSION_DEFINITIONS.map((permission) => [permission.key, permission]),
) as Record<PermissionKey, PermissionDefinition>;

export type AppRoleSeed = {
  slug: SystemRoleSlug;
  name: string;
  description: string;
  isSystem: true;
  isArchived: false;
  priority: number;
  defaultLandingPath: string;
  permissionKeys: PermissionKey[] | ["*"];
};

export const SYSTEM_ROLE_SEEDS: AppRoleSeed[] = [
  {
    slug: "super-admin",
    name: "Super Admin",
    description: "Owns identity, roles, permissions, and every operational module.",
    isSystem: true,
    isArchived: false,
    priority: 100,
    defaultLandingPath: "/user-management",
    permissionKeys: ["*"],
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Runs day-to-day business modules without access to role governance.",
    isSystem: true,
    isArchived: false,
    priority: 80,
    defaultLandingPath: "/dashboard",
    permissionKeys: [
      "dashboard.view",
      "manufacturing.view",
      "manufacturing.manage",
      "manufacturing.run.read",
      "manufacturing.run.manage",
      "inventory.view",
      "inventory.manage",
      "suppliers.view",
      "suppliers.manage",
      "sales.view",
      "sales.manage",
      "sales.people.view",
      "sales.people.manage",
      "sales.config.view",
      "sales.config.manage",
      "sales.overview",
      "sales.orders.view",
      "sales.orders.manage",
      "sales.recovery.view",
      "sales.recovery.manage",
      "finance.view",
      "finance.manage",
      "hr.view",
      "hr.manage",
      "operator.view",
      "operator.run.read",
      "operator.run.log",
      "operator.run.complete",
      "operator.run.fail",
      "reports.view",
    ],
  },
  {
    slug: "finance-manager",
    name: "Finance Manager",
    description: "Owns finance and customer-facing sales operations.",
    isSystem: true,
    isArchived: false,
    priority: 60,
    defaultLandingPath: "/finance/accounts",
    permissionKeys: [
      "sales.view",
      "sales.manage",
      "sales.people.view",
      "sales.people.manage",
      "sales.config.view",
      "sales.config.manage",
      "sales.overview",
      "sales.orders.view",
      "sales.orders.manage",
      "sales.recovery.view",
      "sales.recovery.manage",
      "finance.view",
      "finance.manage",
    ],
  },
  {
    slug: "operator",
    name: "Operator",
    description: "Operates active production runs from the operator interface only.",
    isSystem: true,
    isArchived: false,
    priority: 20,
    defaultLandingPath: "/operator",
    permissionKeys: [
      "operator.view",
      "operator.run.read",
      "operator.run.log",
      "operator.run.complete",
      "operator.run.fail",
    ],
  },
  {
    slug: "order-booker",
    name: "Order Booker",
    description: "Self-service portal for order bookers to manage orders, trips, and view commissions.",
    isSystem: true,
    isArchived: false,
    priority: 10,
    defaultLandingPath: "/order-booker",
    permissionKeys: [
      "order-booker.view",
      "order-booker.orders.manage",
      "order-booker.trips.manage",
      "sales.orders.view",
    ],
  },
];

export const LEGACY_ROLE_FALLBACKS: Record<string, SystemRoleSlug> = {
  "super-admin": "super-admin",
  admin: "admin",
  "finance-manager": "finance-manager",
  operator: "operator",
  "order-booker": "order-booker",
};

export const ROUTE_PERMISSION_RULES: Array<{
  matcher: RegExp;
  permissions: PermissionKey[];
}> = [
  {
    matcher: /^\/dashboard(?:\/.*)?$/,
    permissions: ["dashboard.view"],
  },
  {
    matcher: /^\/manufacturing\/productions\/[^/]+$/,
    permissions: ["manufacturing.run.read"],
  },
  {
    matcher: /^\/manufacturing(?:\/.*)?$/,
    permissions: ["manufacturing.view"],
  },
  {
    matcher: /^\/inventory(?:\/.*)?$/,
    permissions: ["inventory.view"],
  },
  {
    matcher: /^\/suppliers(?:\/.*)?$/,
    permissions: ["suppliers.view"],
  },
  {
    matcher: /^\/sales\/people(?:\/.*)?$/,
    permissions: ["sales.people.view"],
  },
  {
    matcher: /^\/sales\/configurations(?:\/.*)?$/,
    permissions: ["sales.config.view"],
  },
  {
    matcher: /^\/sales\/overview(?:\/.*)?$/,
    permissions: ["sales.overview"],
  },
  {
    matcher: /^\/sales\/orders(?:\/.*)?$/,
    permissions: ["sales.orders.view"],
  },
  {
    matcher: /^\/sales\/recovery(?:\/.*)?$/,
    permissions: ["sales.recovery.view"],
  },
  {
    matcher: /^\/sales(?:\/.*)?$/,
    permissions: ["sales.view"],
  },
  {
    matcher: /^\/finance(?:\/.*)?$/,
    permissions: ["finance.view"],
  },
  {
    matcher: /^\/hr(?:\/.*)?$/,
    permissions: ["hr.view"],
  },
  {
    matcher: /^\/operator\/[^/]+$/,
    permissions: ["operator.run.read"],
  },
  {
    matcher: /^\/operator(?:\/.*)?$/,
    permissions: ["operator.view"],
  },
  {
    matcher: /^\/user-management(?:\/.*)?$/,
    permissions: ["user-management.view", "user-management.roles.manage"],
  },
  {
    matcher: /^\/reports(?:\/.*)?$/,
    permissions: ["reports.view"],
  },
  {
    matcher: /^\/order-booker(?:\/.*)?$/,
    permissions: ["order-booker.view"],
  },
];

export const MODULE_PERMISSION_GROUPS: Record<
  ModuleKey,
  { view?: PermissionKey; manage?: PermissionKey; accent: string }
> = {
  dashboard: { view: "dashboard.view", accent: "violet" },
  manufacturing: {
    view: "manufacturing.view",
    manage: "manufacturing.manage",
    accent: "amber",
  },
  inventory: { view: "inventory.view", manage: "inventory.manage", accent: "cyan" },
  suppliers: { view: "suppliers.view", manage: "suppliers.manage", accent: "orange" },
  sales: { view: "sales.view", manage: "sales.manage", accent: "emerald" },
  "order-booker": {
    view: "order-booker.view",
    manage: "order-booker.orders.manage",
    accent: "lime",
  },
  finance: { view: "finance.view", manage: "finance.manage", accent: "sky" },
  hr: { view: "hr.view", manage: "hr.manage", accent: "rose" },
  operator: { view: "operator.view", manage: "operator.run.log", accent: "yellow" },
  "user-management": {
    view: "user-management.view",
    manage: "user-management.users.manage",
    accent: "fuchsia",
  },
  rbac: { manage: "user-management.roles.manage", accent: "indigo" },
  reports: { view: "reports.view", accent: "teal" },
};

export const ROLE_BADGE_STYLES: Record<string, string> = {
  "super-admin":
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  admin: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "finance-manager":
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  operator:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "order-booker":
    "border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-300",
};

export const LANDING_PATH_OPTIONS = [
  "/user-management",
  "/dashboard",
  "/manufacturing/productions",
  "/manufacturing/recipes",
  "/inventory/warehouses",
  "/inventory/factory-floor",
  "/suppliers",
  "/sales/new-invoice",
  "/sales/customers",
  "/order-booker",
  "/finance/accounts",
  "/finance/expenses",
  "/finance/ledger",
  "/hr/employees",
  "/hr/attendance",
  "/hr/approvals",
  "/hr/payroll",
  "/operator",
  "/reports",
] as const;

export function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  return pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
}

export function hasPermission(
  grantedPermissions: Iterable<string>,
  permission: PermissionKey,
) {
  const set = grantedPermissions instanceof Set
    ? grantedPermissions
    : new Set(grantedPermissions);
  return set.has("*") || set.has(permission);
}

export function canAccessPath(
  pathname: string,
  grantedPermissions: Iterable<string>,
) {
  const normalizedPathname = normalizePathname(pathname);
  const permissionSet = grantedPermissions instanceof Set
    ? grantedPermissions
    : new Set(grantedPermissions);

  const rule = ROUTE_PERMISSION_RULES.find(({ matcher }) =>
    matcher.test(normalizedPathname),
  );

  if (!rule) {
    return true;
  }

  return rule.permissions.some((permission) =>
    hasPermission(permissionSet, permission),
  );
}

export function getAccessibleNavigationItems(
  items: NavigationItem[],
  grantedPermissions: Iterable<string>,
): NavigationItem[] {
  return items.reduce<NavigationItem[]>((acc, item) => {
    const childItems = item.items
      ? getAccessibleNavigationItems(item.items, grantedPermissions)
      : undefined;
    const canOpenSelf = canAccessPath(item.url, grantedPermissions);

    if (canOpenSelf || (childItems && childItems.length > 0)) {
      acc.push({
        ...item,
        items: childItems,
      });
    }

    return acc;
  }, []);
}

export function getFirstAccessiblePath(grantedPermissions: Iterable<string>) {
  const permissionSet = grantedPermissions instanceof Set
    ? grantedPermissions
    : new Set(grantedPermissions);

  const preferredPaths = [
    "/user-management",
    "/dashboard",
    "/finance/accounts",
    "/sales/customers",
    "/order-booker",
    "/operator",
    "/manufacturing/productions",
    "/inventory/warehouses",
    "/hr/employees",
    "/suppliers",
  ];

  return (
    preferredPaths.find((path) => canAccessPath(path, permissionSet)) ?? "/"
  );
}
