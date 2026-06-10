import { eq } from "drizzle-orm";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import {
  appPermissions,
  appRolePermissions,
  appRoles,
  db,
  user,
  userRoleAssignments,
} from "@/db";
import { auth } from "./auth";

// Extract transaction type from db.transaction callback parameter
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import {
  canAccessPath,
  getFirstAccessiblePath,
  hasPermission,
  LEGACY_ROLE_FALLBACKS,
  PERMISSION_DEFINITIONS,
  type PermissionKey,
  SYSTEM_ROLE_SEEDS,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "./rbac";
import { ForbiddenError } from "./errors";

export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export type ResolvedRole = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isArchived: boolean;
  isSystem: boolean;
  defaultLandingPath: string;
  priority: number;
};

export type AuthContext = {
  session: AuthSession;
  role: ResolvedRole;
  permissions: Set<string>;
  permissionList: string[];
  defaultLandingPath: string;
};

const roleSeedMap = new Map(SYSTEM_ROLE_SEEDS.map((role) => [role.slug, role]));

let seedPromise: Promise<void> | null = null;

async function upsertRoleSeed(
  tx: Tx,
  roleSeed: (typeof SYSTEM_ROLE_SEEDS)[number],
) {
  const [roleRecord] = await tx
    .insert(appRoles)
    .values({
      slug: roleSeed.slug,
      name: roleSeed.name,
      description: roleSeed.description,
      isSystem: true,
      isArchived: false,
      priority: roleSeed.priority,
      defaultLandingPath: roleSeed.defaultLandingPath,
    })
    .onConflictDoUpdate({
      target: appRoles.slug,
      set: {
        isSystem: true,
        isArchived: false,
        updatedAt: new Date(),
      },
    })
    .returning();

  return roleRecord;
}

export async function ensureRbacSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await db.transaction(async (tx) => {
        for (const permission of PERMISSION_DEFINITIONS) {
          await tx
            .insert(appPermissions)
            .values({
              key: permission.key,
              moduleKey: permission.moduleKey,
              label: permission.label,
              description: permission.description,
              kind: permission.kind,
              routePattern: permission.routePattern ?? null,
            })
            .onConflictDoUpdate({
              target: appPermissions.key,
              set: {
                moduleKey: permission.moduleKey,
                label: permission.label,
                description: permission.description,
                kind: permission.kind,
                routePattern: permission.routePattern ?? null,
                updatedAt: new Date(),
              },
            });
        }

        const permissionRecords = await tx.query.appPermissions.findMany();
        const permissionIdByKey = new Map(
          permissionRecords.map((permission) => [permission.key, permission.id]),
        );

        for (const roleSeed of SYSTEM_ROLE_SEEDS) {
          const roleRecord = await upsertRoleSeed(tx, roleSeed);
          const existingPermissionCount = await tx.query.appRolePermissions.findMany({
            where: eq(appRolePermissions.roleId, roleRecord.id),
            columns: {
              roleId: true,
            },
          });

          if (roleSeed.permissionKeys[0] === "*") {
            continue;
          }

          if (existingPermissionCount.length > 0) {
            continue;
          }

          const permissionIds = roleSeed.permissionKeys
            .map((permissionKey) => permissionIdByKey.get(permissionKey))
            .filter(Boolean) as string[];

          if (permissionIds.length > 0) {
            await tx.insert(appRolePermissions).values(
              permissionIds.map((permissionId) => ({
                roleId: roleRecord.id,
                permissionId,
              })),
            );
          }
        }
      });
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  await seedPromise;
}

function getHeaders() {
  return getRequestHeaders();
}

function isActiveBan(authUser: {
  banned: boolean | null;
  banExpires: Date | null;
}) {
  if (!authUser.banned) {
    return false;
  }

  return !authUser.banExpires || authUser.banExpires > new Date();
}

export async function getSessionFromRequest() {
  return auth.api.getSession({
    headers: getHeaders(),
  });
}

async function getRoleBySlug(slug: string) {
  return db.query.appRoles.findFirst({
    where: eq(appRoles.slug, slug),
  });
}

export async function resolveUserRole(userId: string, legacyRole?: string | null) {
  await ensureRbacSeeded();

  const assignment = await db.query.userRoleAssignments.findFirst({
    where: eq(userRoleAssignments.userId, userId),
    with: {
      role: true,
    },
  });

  if (assignment?.role) {
    return assignment.role;
  }

  const fallbackSlug = legacyRole ? LEGACY_ROLE_FALLBACKS[legacyRole] : undefined;
  const safeFallbackSlug: SystemRoleSlug = fallbackSlug ?? "admin";
  const fallbackRole = await getRoleBySlug(safeFallbackSlug);

  if (!fallbackRole) {
    throw new Error(`RBAC seed is missing fallback role "${safeFallbackSlug}"`);
  }

  await db
    .insert(userRoleAssignments)
    .values({
      userId,
      roleId: fallbackRole.id,
    })
    .onConflictDoNothing();

  return fallbackRole;
}

export async function getRolePermissionKeys(roleId: string, roleSlug: string) {
  const roleSeed = roleSeedMap.get(roleSlug as SystemRoleSlug);
  if (roleSeed?.permissionKeys[0] === "*") {
    return new Set<string>(["*"]);
  }

  const grantedPermissions = await db
    .select({
      key: appPermissions.key,
    })
    .from(appRolePermissions)
    .innerJoin(
      appPermissions,
      eq(appRolePermissions.permissionId, appPermissions.id),
    )
    .where(eq(appRolePermissions.roleId, roleId));

  return new Set(grantedPermissions.map((permission) => permission.key));
}

export async function getAuthContext() {
  const session = await getSessionFromRequest();

  if (!session?.session) {
    return null;
  }

  const authUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: {
      banned: true,
      banExpires: true,
    },
  });

  if (!authUser || isActiveBan(authUser)) {
    return null;
  }

  const role = await resolveUserRole(session.user.id, session.user.role);
  const permissions = await getRolePermissionKeys(role.id, role.slug);
  const permissionList = Array.from(permissions);

  return {
    session,
    role,
    permissions,
    permissionList,
    defaultLandingPath: role.defaultLandingPath,
  } satisfies AuthContext;
}

export async function requireSession(location?: { href?: string; pathname?: string }) {
  const authContext = await getAuthContext();

  if (!authContext) {
    throw redirect({
      to: "/login",
      search: location?.href
        ? {
            redirect: location.href,
          }
        : undefined,
    });
  }

  return authContext;
}

export function requirePermission(authContext: AuthContext, permission: PermissionKey) {
  if (!hasPermission(authContext.permissions, permission)) {
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }

  return authContext;
}

export async function requirePermissionFromRequest(permission: PermissionKey) {
  const authContext = await requireSession();
  return requirePermission(authContext, permission);
}

export async function enforcePathAccess(pathname: string) {
  const authContext = await requireSession();

  if (!canAccessPath(pathname, authContext.permissions)) {
    throw redirect({
      to: authContext.defaultLandingPath,
    });
  }

  return authContext;
}

export async function resolvePostLoginDestination(redirectTo?: string | null) {
  const authContext = await requireSession();

  const requestedPath = redirectTo
    ? (() => {
        try {
          const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost";
          const url = new URL(redirectTo, baseUrl);
          return `${url.pathname}${url.search}`;
        } catch {
          return redirectTo;
        }
      })()
    : null;

  if (requestedPath && canAccessPath(requestedPath, authContext.permissions)) {
    return requestedPath;
  }

  if (
    authContext.defaultLandingPath &&
    canAccessPath(authContext.defaultLandingPath, authContext.permissions)
  ) {
    return authContext.defaultLandingPath;
  }

  return getFirstAccessiblePath(authContext.permissions);
}

export async function syncUserRoleAssignment(
  userId: string,
  roleSlug: string,
  assignedByUserId?: string,
) {
  await ensureRbacSeeded();

  const role = await getRoleBySlug(roleSlug);
  if (!role) {
    throw new Error("Selected role could not be found.");
  }

  await db
    .insert(userRoleAssignments)
    .values({
      userId,
      roleId: role.id,
      assignedByUserId,
    })
    .onConflictDoUpdate({
      target: userRoleAssignments.userId,
      set: {
        roleId: role.id,
        assignedByUserId,
        updatedAt: new Date(),
      },
    });

  await db.update(user).set({ role: role.slug }).where(eq(user.id, userId));

  return role;
}

export async function getRoleAssignmentCounts() {
  const counts = await db
    .select({
      roleId: userRoleAssignments.roleId,
      userId: userRoleAssignments.userId,
    })
    .from(userRoleAssignments);

  return counts.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.roleId] = (acc[entry.roleId] ?? 0) + 1;
    return acc;
  }, {});
}

export function isSystemRoleSlug(roleSlug: string) {
  return SYSTEM_ROLE_SLUGS.includes(roleSlug as SystemRoleSlug);
}
