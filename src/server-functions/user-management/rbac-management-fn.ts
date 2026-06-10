import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  appRolePermissions,
  appRoles,
  db,
  employees,
  orderBookers,
  userRoleAssignments,
} from "@/db";
import {
  ensureRbacSeeded,
  getRoleAssignmentCounts,
  getRolePermissionKeys,
  resolveUserRole,
  syncUserRoleAssignment,
} from "@/lib/authz.server";
import { auth } from "@/lib/auth";
import {
  canAccessPath,
  getFirstAccessiblePath,
  LANDING_PATH_OPTIONS,
  LEGACY_ROLE_FALLBACKS,
  PERMISSION_DEFINITIONS,
  PERMISSION_KEYS,
  ROLE_BADGE_STYLES,
  SYSTEM_ROLE_SLUGS,
} from "@/lib/rbac";
import {
  requireUserManagementRolesManageMiddleware,
  requireUserManagementUsersManageMiddleware,
} from "@/lib/middlewares";

const adminApi = auth.api as Record<string, (...args: any[]) => Promise<any>>;

const roleSlugSchema = z
  .string()
  .min(2, "Role slug is required")
  .max(64, "Role slug must be 64 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens only.",
  );

const permissionSchema = z.enum(PERMISSION_KEYS);

const roleFormSchema = z.object({
  roleId: z.string().optional(),
  name: z.string().min(2, "Role name is required").max(60),
  slug: roleSlugSchema,
  description: z.string().max(240).default(""),
  defaultLandingPath: z.string().min(1, "Choose a landing page"),
  permissionKeys: z.array(permissionSchema).default([]),
});

const assignRoleSchema = z.object({
  userId: z.string(),
  roleSlug: roleSlugSchema,
});

const managedUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleSlug: roleSlugSchema,
  orderBookerId: z.string().optional(),
});

const updateManagedUserSchema = z.object({
  userId: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
});

const setPasswordSchema = z.object({
  userId: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const banUserSchema = z.object({
  userId: z.string(),
  reason: z.string().optional(),
  duration: z.number().optional(),
});

const toggleArchiveRoleSchema = z.object({
  roleId: z.string(),
  isArchived: z.boolean(),
});

const deleteRoleSchema = z.object({
  roleId: z.string(),
});

const revokeSessionSchema = z.object({
  sessionToken: z.string(),
});

const revokeAllSessionsSchema = z.object({
  userId: z.string(),
});

function slugifyRoleName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getAdminMethod<T extends keyof typeof adminApi>(...names: T[]) {
  for (const name of names) {
    const candidate = adminApi[name];
    if (typeof candidate === "function") {
      return candidate;
    }
  }

  throw new Error(`Better Auth admin API method not found: ${names.join(", ")}`);
}

async function listRolesWithMeta() {
  await ensureRbacSeeded();

  const roles = await db.query.appRoles.findMany({
    orderBy: [desc(appRoles.priority), asc(appRoles.name)],
  });

  const countsByRoleId = await getRoleAssignmentCounts();

  return Promise.all(
    roles.map(async (role) => {
      const permissionSet = await getRolePermissionKeys(role.id, role.slug);
      const permissionList = Array.from(permissionSet);

      return {
        ...role,
        permissionKeys: permissionList,
        assignmentCount: countsByRoleId[role.id] ?? 0,
        accessiblePaths: LANDING_PATH_OPTIONS.filter((path) =>
          canAccessPath(path, permissionSet),
        ),
        toneClassName:
          ROLE_BADGE_STYLES[role.slug] ??
          "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
      };
    }),
  );
}

function resolveLandingPath(
  requestedPath: string,
  permissionKeys: Iterable<string>,
  _roleSlug?: string,
) {
  if (
    LANDING_PATH_OPTIONS.includes(requestedPath as (typeof LANDING_PATH_OPTIONS)[number]) &&
    canAccessPath(requestedPath, permissionKeys)
  ) {
    return requestedPath;
  }

  return getFirstAccessiblePath(permissionKeys);
}

async function replaceRolePermissions(roleId: string, permissionKeys: string[]) {
  await db
    .delete(appRolePermissions)
    .where(eq(appRolePermissions.roleId, roleId));

  if (permissionKeys.length === 0) {
    return;
  }

  const permissions = await db.query.appPermissions.findMany({
    where: (permission, { inArray }) => inArray(permission.key, permissionKeys),
  });

  if (permissions.length > 0) {
    await db.insert(appRolePermissions).values(
      permissions.map((permission) => ({
        roleId,
        permissionId: permission.id,
      })),
    );
  }
}

export const getUserManagementOverviewFn = createServerFn()
  .middleware([requireUserManagementRolesManageMiddleware])
  .handler(async ({ context }) => {
    await ensureRbacSeeded();

    const listUsers = getAdminMethod("listUsers");
    const headers = getRequestHeaders();
    const usersResponse = await listUsers({
      headers,
      query: {
        limit: 200,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });

    const roles = await listRolesWithMeta();
    const rolesBySlug = new Map(roles.map((role) => [role.slug, role]));
    const assignments = await db.query.userRoleAssignments.findMany({
      with: {
        role: true,
      },
    });
    const assignmentByUserId = new Map(
      assignments.map((assignment) => [assignment.userId, assignment.role]),
    );

    const users = await Promise.all(
      (usersResponse.users ?? []).map(async (currentUser: any) => {
        const assignedRole =
          assignmentByUserId.get(currentUser.id) ??
          rolesBySlug.get(
            LEGACY_ROLE_FALLBACKS[currentUser.role ?? ""] ?? "admin",
          ) ??
          (await resolveUserRole(currentUser.id, currentUser.role));

        return {
          ...currentUser,
          roleAssignment: assignedRole
            ? {
                id: assignedRole.id,
                slug: assignedRole.slug,
                name: assignedRole.name,
                isSystem: assignedRole.isSystem,
                isArchived: assignedRole.isArchived,
                defaultLandingPath: assignedRole.defaultLandingPath,
                toneClassName:
                  ROLE_BADGE_STYLES[assignedRole.slug] ??
                  "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
              }
            : null,
        };
      }),
    );

    const onboardingOrderBookers = await db.query.orderBookers.findMany({
      where: (ob, { and, isNull, eq }) =>
        and(isNull(ob.userId), eq(ob.status, "active")),
      orderBy: [asc(orderBookers.name)],
    });

    const employeeIds = onboardingOrderBookers
      .map((ob) => ob.employeeId)
      .filter((id): id is string => Boolean(id));
    const employeeStatusById = new Map<string, string>();

    if (employeeIds.length > 0) {
      const employeeRows = await db.query.employees.findMany({
        where: (employee, { inArray }) => inArray(employee.id, employeeIds),
        columns: {
          id: true,
          status: true,
        },
      });

      for (const employee of employeeRows) {
        employeeStatusById.set(employee.id, employee.status);
      }
    }

    return {
      currentUserId: context.session.user.id,
      users,
      onboardingOrderBookers: onboardingOrderBookers.map((ob) => ({
        id: ob.id,
        name: ob.name,
        phone: ob.phone,
        assignedArea: ob.assignedArea,
        employeeId: ob.employeeId,
        employeeStatus: ob.employeeId
          ? (employeeStatusById.get(ob.employeeId) ?? null)
          : null,
      })),
      roles,
      permissions: PERMISSION_DEFINITIONS,
      landingPathOptions: [...LANDING_PATH_OPTIONS],
    };
  });

export const createRoleFn = createServerFn()
  .middleware([requireUserManagementRolesManageMiddleware])
  .inputValidator(roleFormSchema.omit({ roleId: true }))
  .handler(async ({ data }) => {
    await ensureRbacSeeded();

    const slug = slugifyRoleName(data.slug || data.name);
    if (!slug) {
      throw new Error("Role slug is required.");
    }

    if (SYSTEM_ROLE_SLUGS.includes(slug as (typeof SYSTEM_ROLE_SLUGS)[number])) {
      throw new Error("This slug is reserved for a system role.");
    }

    const safeLandingPath = resolveLandingPath(data.defaultLandingPath, data.permissionKeys);

    const [role] = await db
      .insert(appRoles)
      .values({
        slug,
        name: data.name.trim(),
        description: data.description.trim(),
        isSystem: false,
        isArchived: false,
        priority: 10,
        defaultLandingPath: safeLandingPath,
      })
      .returning();

    await replaceRolePermissions(role.id, data.permissionKeys);

    return role;
  });

export const updateRoleFn = createServerFn()
  .middleware([requireUserManagementRolesManageMiddleware])
  .inputValidator(roleFormSchema.extend({ roleId: z.string() }))
  .handler(async ({ data }) => {
    await ensureRbacSeeded();

    const currentRole = await db.query.appRoles.findFirst({
      where: eq(appRoles.id, data.roleId),
    });

    if (!currentRole) {
      throw new Error("Role not found.");
    }

    const slug = currentRole.isSystem ? currentRole.slug : slugifyRoleName(data.slug);
    const normalizedPermissions =
      currentRole.slug === "super-admin" ? ["*"] : data.permissionKeys;
    const safeLandingPath = resolveLandingPath(
      data.defaultLandingPath,
      normalizedPermissions,
      currentRole.slug,
    );

    await db
      .update(appRoles)
      .set({
        name: currentRole.slug === "super-admin" ? currentRole.name : data.name.trim(),
        slug,
        description: data.description.trim(),
        defaultLandingPath: safeLandingPath,
        updatedAt: new Date(),
      })
      .where(eq(appRoles.id, currentRole.id));

    if (currentRole.slug !== "super-admin") {
      await replaceRolePermissions(currentRole.id, normalizedPermissions);
    }

    return { success: true };
  });

export const archiveRoleFn = createServerFn()
  .middleware([requireUserManagementRolesManageMiddleware])
  .inputValidator(toggleArchiveRoleSchema)
  .handler(async ({ data }) => {
    await ensureRbacSeeded();

    const role = await db.query.appRoles.findFirst({
      where: eq(appRoles.id, data.roleId),
    });

    if (!role) {
      throw new Error("Role not found.");
    }

    if (role.isSystem || role.slug === "super-admin") {
      throw new Error("System roles cannot be archived.");
    }

    await db
      .update(appRoles)
      .set({
        isArchived: data.isArchived,
        updatedAt: new Date(),
      })
      .where(eq(appRoles.id, role.id));

    return { success: true };
  });

export const deleteRoleFn = createServerFn()
  .middleware([requireUserManagementRolesManageMiddleware])
  .inputValidator(deleteRoleSchema)
  .handler(async ({ data }) => {
    await ensureRbacSeeded();

    const role = await db.query.appRoles.findFirst({
      where: eq(appRoles.id, data.roleId),
    });

    if (!role) {
      throw new Error("Role not found.");
    }

    if (role.isSystem || role.slug === "super-admin") {
      throw new Error("System roles cannot be deleted.");
    }

    const assignmentCount = await db.query.userRoleAssignments.findMany({
      where: eq(userRoleAssignments.roleId, role.id),
      columns: {
        roleId: true,
      },
    });

    if (assignmentCount.length > 0) {
      throw new Error("This role is still assigned to users. Archive it instead.");
    }

    await db.delete(appRoles).where(eq(appRoles.id, role.id));

    return { success: true };
  });

export const assignUserRoleFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(assignRoleSchema)
  .handler(async ({ data, context }) => {
    const role = await db.query.appRoles.findFirst({
      where: eq(appRoles.slug, data.roleSlug),
    });

    if (!role) {
      throw new Error("Selected role could not be found.");
    }

    if (role.isArchived) {
      throw new Error("Archived roles cannot be assigned to new users.");
    }

    await syncUserRoleAssignment(data.userId, role.slug, context.session.user.id);

    return { success: true };
  });

export const createManagedUserFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(managedUserSchema)
  .handler(async ({ data, context }) => {
    const role = await db.query.appRoles.findFirst({
      where: eq(appRoles.slug, data.roleSlug),
    });

    if (!role) {
      throw new Error("Selected role could not be found.");
    }

    if (role.isArchived) {
      throw new Error("Archived roles cannot be assigned to new users.");
    }

    let pendingOrderBooker:
      | {
          id: string;
          status: string;
          userId: string | null;
          employeeId: string | null;
        }
      | null = null;

    if (data.orderBookerId) {
      pendingOrderBooker = await db.query.orderBookers.findFirst({
        where: eq(orderBookers.id, data.orderBookerId),
        columns: {
          id: true,
          status: true,
          userId: true,
          employeeId: true,
        },
      }) ?? null;

      if (!pendingOrderBooker) {
        throw new Error("Selected order booker profile was not found.");
      }

      if (pendingOrderBooker.userId) {
        throw new Error("Selected order booker profile is already linked to a user.");
      }

      if (pendingOrderBooker.status !== "active") {
        throw new Error("Selected order booker profile is inactive.");
      }

      if (pendingOrderBooker.employeeId) {
        const employee = await db.query.employees.findFirst({
          where: eq(employees.id, pendingOrderBooker.employeeId),
          columns: {
            status: true,
          },
        });

        if (!employee || employee.status !== "active") {
          throw new Error("Selected order booker is not an active employee.");
        }
      }
    }

    const createUser = getAdminMethod("createUser");
    const result = await createUser({
      headers: getRequestHeaders(),
      body: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        role: role.slug,
      },
    });

    const createdUserId = result?.user?.id ?? result?.id;
    if (!createdUserId) {
      throw new Error("User was created but no user id was returned.");
    }

    await syncUserRoleAssignment(createdUserId, role.slug, context.session.user.id);

    if (pendingOrderBooker) {
      await db
        .update(orderBookers)
        .set({
          userId: createdUserId,
        })
        .where(eq(orderBookers.id, pendingOrderBooker.id));
    }

    return { success: true };
  });

export const updateManagedUserFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(updateManagedUserSchema)
  .handler(async ({ data }) => {
    const updateUser = getAdminMethod("adminUpdateUser", "updateUser");
    await updateUser({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
        data: {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
        },
      },
    });

    return { success: true };
  });

export const setManagedUserPasswordFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(setPasswordSchema)
  .handler(async ({ data }) => {
    const setUserPassword = getAdminMethod("setUserPassword");
    await setUserPassword({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
        newPassword: data.password,
      },
    });

    return { success: true };
  });

export const banManagedUserFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(banUserSchema)
  .handler(async ({ data }) => {
    const banUser = getAdminMethod("banUser");
    const revokeUserSessions = getAdminMethod("revokeUserSessions");
    await banUser({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
        banReason: data.reason,
        banExpiresIn: data.duration,
      },
    });
    await revokeUserSessions({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
      },
    });

    return { success: true };
  });

export const unbanManagedUserFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const unbanUser = getAdminMethod("unbanUser");
    await unbanUser({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
      },
    });

    return { success: true };
  });

export const removeManagedUserFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const removeUser = getAdminMethod("removeUser", "deleteUser");
    await removeUser({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
      },
    });

    return { success: true };
  });

export const managedListUserSessionsFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const listUserSessions = getAdminMethod("listUserSessions");
    return listUserSessions({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
      },
    });
  });

export const revokeManagedUserSessionFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(revokeSessionSchema)
  .handler(async ({ data }) => {
    const revokeUserSession = getAdminMethod("revokeUserSession");
    await revokeUserSession({
      headers: getRequestHeaders(),
      body: {
        sessionToken: data.sessionToken,
      },
    });

    return { success: true };
  });

export const revokeManagedUserSessionsFn = createServerFn()
  .middleware([requireUserManagementUsersManageMiddleware])
  .inputValidator(revokeAllSessionsSchema)
  .handler(async ({ data }) => {
    const revokeUserSessions = getAdminMethod("revokeUserSessions");
    await revokeUserSessions({
      headers: getRequestHeaders(),
      body: {
        userId: data.userId,
      },
    });

    return { success: true };
  });
