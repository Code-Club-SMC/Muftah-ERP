import { UserEditorDialog } from "./user-editor-dialog";
import { RoleEditorDialog } from "./role-editor-dialog";
import { ManagedUser, UserDialogState, RoleDialogState } from "./types";
import { useDeferredValue, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ArchiveRestore,
  Eye,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundPen,
  Users,
  Search,
  KeyRound,
  Layers,
  BadgeCheck,
  MonitorDot,
  ChevronRight,
  Landmark,
  Link2,
} from "lucide-react";
import { motion } from "framer-motion";
import { adminGetUsersFn } from "@/server-functions/user-management/super-admin-get-users-fn";
import { DataTable } from "@/components/custom/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";
import { UserSessionsDialog } from "./user-sessions-dialog";

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  color: string;
  iconBg?: string;
  delay?: number;
}

function StatCard({ title, value, description, icon, color, iconBg, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-card border border-border/60 rounded-xl p-5 hover:border-border transition-colors group overflow-hidden"
    >
      {/* Soft background glow */}
      <div className={cn("absolute top-0 right-0 size-28 rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2", color)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground/70">{description}</p>
        </div>
        <div className={cn("p-2.5 rounded-lg", iconBg ?? (color + "/15"))}>
          <div className="text-foreground/60">{icon}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ── User Avatar ───────────────────────────────────────────────────────────────
function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const colors = [
    "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  ];
  const colorIdx = name.charCodeAt(0) % colors.length;

  return (
    <div className={cn("size-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0", colors[colorIdx])}>
      {initials}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export const UsersTable = () => {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminGetUsersFn(),
  });
  const { archiveRole, banUser, deleteRole, removeUser, unbanUser } = useUsers();

  const [activeTab, setActiveTab] = useState("users");
  const [userSearch, setUserSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "restricted">("all");
  const [userDialog, setUserDialog] = useState<UserDialogState | null>(null);
  const [roleDialog, setRoleDialog] = useState<RoleDialogState | null>(null);
  const [sessionsUser, setSessionsUser] = useState<ManagedUser | null>(null);
  const [previewRoleId, setPreviewRoleId] = useState<string>(data.roles[0]?.id ?? "");
  const deferredUserSearch = useDeferredValue(userSearch);
  const deferredRoleSearch = useDeferredValue(roleSearch);

  const filteredUsers = useMemo(() => {
    return data.users.filter((user) => {
      const q = deferredUserSearch.toLowerCase();
      const matchesSearch =
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.roleAssignment?.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !user.banned) ||
        (statusFilter === "restricted" && user.banned);
      return matchesSearch && matchesStatus;
    });
  }, [data.users, deferredUserSearch, statusFilter]);

  const filteredRoles = useMemo(() => {
    return data.roles.filter((role) => {
      const q = deferredRoleSearch.toLowerCase();
      return (
        role.name.toLowerCase().includes(q) ||
        role.slug.toLowerCase().includes(q) ||
        role.description.toLowerCase().includes(q)
      );
    });
  }, [data.roles, deferredRoleSearch]);

  const previewRole = data.roles.find((r) => r.id === previewRoleId) ?? data.roles[0] ?? null;

  const userColumns = useMemo<ColumnDef<ManagedUser>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-3 py-0.5">
              <UserAvatar name={user.name} />
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-tight">{user.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{user.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = row.original.roleAssignment;
          return role ? (
            <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border shadow-none h-5", role.toneClassName)}>
              {role.name}{role.isArchived ? " · archived" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-none h-5 text-muted-foreground">
              Unassigned
            </Badge>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "size-1.5 rounded-full",
              row.original.banned ? "bg-destructive" : "bg-emerald-500"
            )} />
            <span className={cn("text-[12px] font-medium", row.original.banned ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
              {row.original.banned ? "Restricted" : "Active"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60 shadow-lg">
                  <DropdownMenuItem
                    className="rounded-lg text-[13px] gap-2.5 cursor-pointer"
                    onClick={() => setUserDialog({ mode: "edit", user })}
                  >
                    <UserRoundPen className="size-3.5 text-muted-foreground" />
                    Edit user
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-lg text-[13px] gap-2.5 cursor-pointer"
                    onClick={() => setSessionsUser(user)}
                  >
                    <MonitorDot className="size-3.5 text-muted-foreground" />
                    View sessions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-lg text-[13px] gap-2.5 cursor-pointer"
                    onClick={() =>
                      user.banned
                        ? unbanUser.mutate({ userId: user.id })
                        : banUser.mutate({ userId: user.id, reason: "Restricted by super admin" })
                    }
                  >
                    {user.banned ? (
                      <><ShieldCheck className="size-3.5 text-emerald-500" /> Restore access</>
                    ) : (
                      <><ShieldAlert className="size-3.5 text-amber-500" /> Restrict access</>
                    )}
                  </DropdownMenuItem>
                  {user.id !== data.currentUserId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="rounded-lg text-[13px] gap-2.5 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => removeUser.mutate({ userId: user.id })}
                      >
                        <Trash2 className="size-3.5" />
                        Delete user
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [banUser, data.currentUserId, removeUser, unbanUser],
  );

  return (
    <>
      <div className="space-y-6">

        {/* ── PAGE HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage team members, roles, and access permissions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleDialog({ mode: "create" })}
              className="h-9 rounded-lg text-[13px] font-medium border-border/70 gap-2"
            >
              <Layers className="size-3.5" />
              New role
            </Button>
            <Button
              size="sm"
              onClick={() => setUserDialog({ mode: "create" })}
              className="h-9 rounded-lg text-[13px] font-medium gap-2"
            >
              <UserPlus className="size-3.5" />
              Invite user
            </Button>
          </div>
        </motion.div>

        {/* ── STAT CARDS ── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total users"
            value={data.users.length}
            description="Across all roles"
            icon={<Users className="size-4" />}
            color="bg-blue-500"
            iconBg="bg-blue-500/15"
            delay={0}
          />
          <StatCard
            title="Active roles"
            value={data.roles.filter((r) => !r.isArchived).length}
            description="Currently in use"
            icon={<KeyRound className="size-4" />}
            color="bg-violet-500"
            iconBg="bg-violet-500/15"
            delay={0.05}
          />
          <StatCard
            title="Archived roles"
            value={data.roles.filter((r) => r.isArchived).length}
            description="Retired & inactive"
            icon={<Archive className="size-4" />}
            color="bg-amber-500"
            iconBg="bg-amber-500/15"
            delay={0.1}
          />
          <StatCard
            title="Permissions"
            value={data.permissions.length}
            description="Configurable nodes"
            icon={<ShieldCheck className="size-4" />}
            color="bg-emerald-500"
            iconBg="bg-emerald-500/15"
            delay={0.15}
          />
        </div>

        {/* ── MAIN PANEL ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-card border border-border/60 rounded-xl overflow-hidden"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Tab bar + filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-border/40 bg-muted/5">
              <TabsList>
                <TabsTrigger value="users" className="gap-2">
                  Users
                  <span className="bg-muted-foreground/10 text-muted-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {data.users.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="access">Permissions</TabsTrigger>
              </TabsList>

              {/* Filters */}
              <div className="flex items-center gap-2 pb-3 sm:pb-0">
                {activeTab === "users" && (
                  <>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                      <SelectTrigger className="h-8 w-[130px] rounded-lg border-border/60 bg-background text-[12px] font-medium shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60 shadow-lg">
                        <SelectItem value="all" className="text-[12px] rounded-lg">All status</SelectItem>
                        <SelectItem value="active" className="text-[12px] rounded-lg text-emerald-600 dark:text-emerald-400">Active</SelectItem>
                        <SelectItem value="restricted" className="text-[12px] rounded-lg text-destructive">Restricted</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users..."
                        className="h-8 w-[200px] pl-8 rounded-lg border-border/60 bg-background text-[12px] shadow-none"
                      />
                    </div>
                  </>
                )}
                {activeTab === "roles" && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      placeholder="Search roles..."
                      className="h-8 w-[200px] pl-8 rounded-lg border-border/60 bg-background text-[12px] shadow-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── USERS TAB ── */}
            <TabsContent value="users" className="p-0 m-0">
              {data.onboardingOrderBookers.length > 0 && (
                <div className="border-b border-border/40 bg-amber-50/60 px-4 py-3 dark:bg-amber-500/10">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-foreground">
                      Order bookers pending credential setup
                    </p>
                    <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
                      {data.onboardingOrderBookers.length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.onboardingOrderBookers.slice(0, 10).map((ob) => (
                      <Button
                        key={ob.id}
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full border-border/70 bg-background px-3 text-[11px]"
                        onClick={() =>
                          setUserDialog({
                            mode: "create",
                            seedOrderBooker: ob,
                          })
                        }
                      >
                        <Link2 className="mr-1 size-3" />
                        {ob.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <DataTable
                columns={userColumns}
                data={filteredUsers}
                showSearch={false}
                showViewOptions={false}
                pageSize={8}
                className="rounded-none border-none bg-transparent shadow-none"
              />
            </TabsContent>

            {/* ── ROLES TAB ── */}
            <TabsContent value="roles" className="p-4 m-0">
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredRoles.map((role, i) => (
                  <motion.div
                    key={role.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04, ease: "easeOut" }}
                    className="group relative bg-background border border-border/60 rounded-xl p-5 hover:border-border hover:shadow-sm transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border shadow-none h-5", role.toneClassName)}>
                            {role.name}
                          </Badge>
                          {role.isSystem && (
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium shadow-none h-5 text-muted-foreground border-border">
                              System
                            </Badge>
                          )}
                          {role.isArchived && (
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-medium shadow-none h-5 border-amber-300/60 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                              Archived
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground/60">{role.slug}</p>
                        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                          {role.description || "No description provided."}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-foreground tabular-nums">{role.assignmentCount}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">members</p>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                        <Landmark className="size-3 text-primary" />
                        {role.defaultLandingPath}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] font-mono text-foreground/70">
                        {role.permissionKeys.includes("*") ? "Full access" : `${role.permissionKeys.length} permissions`}
                      </span>
                    </div>

                    {/* Action row */}
                    <div className="mt-3 flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => { setPreviewRoleId(role.id); setActiveTab("access"); }}
                      >
                        <Eye className="size-3.5" />
                        Inspect
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => setRoleDialog({ mode: "edit", role })}
                      >
                        <UserRoundPen className="size-3.5" />
                        Edit
                      </Button>
                      {!role.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground gap-1.5"
                          onClick={() => archiveRole.mutate({ roleId: role.id, isArchived: !role.isArchived })}
                        >
                          {role.isArchived
                            ? <><ArchiveRestore className="size-3.5 text-emerald-500" /> Restore</>
                            : <><Archive className="size-3.5 text-amber-500" /> Archive</>}
                        </Button>
                      )}
                      {!role.isSystem && role.assignmentCount === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-[12px] font-medium text-destructive hover:text-destructive gap-1.5"
                          onClick={() => deleteRole.mutate({ roleId: role.id })}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* ── ACCESS / PERMISSIONS TAB ── */}
            <TabsContent value="access" className="p-4 m-0">
              <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
                {/* Role selector */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground px-1 mb-3">Select a role to inspect</p>
                  {data.roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setPreviewRoleId(role.id)}
                      className={cn(
                        "w-full rounded-xl border px-3.5 py-3 text-left transition-all flex items-center justify-between group",
                        previewRole?.id === role.id
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 bg-background hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <div>
                        <Badge className={cn("rounded-full px-2 py-0 text-[10px] font-medium border shadow-none h-4.5 mb-1", role.toneClassName)}>
                          {role.name}
                        </Badge>
                        <p className="text-[10px] font-mono text-muted-foreground">{role.slug}</p>
                      </div>
                      <ChevronRight className={cn("size-3.5 transition-colors", previewRole?.id === role.id ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground")} />
                    </button>
                  ))}
                </div>

                {/* Permission matrix */}
                {previewRole && (
                  <motion.div
                    key={previewRole.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    {/* Role info card */}
                    <div className="bg-background border border-border/60 rounded-xl p-5">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium border shadow-none h-5", previewRole.toneClassName)}>
                              {previewRole.name}
                            </Badge>
                            {previewRole.isSystem && (
                              <Badge variant="outline" className="rounded-full px-2 text-[10px] font-medium shadow-none h-5 text-muted-foreground">
                                System role
                              </Badge>
                            )}
                          </div>
                          <p className="text-[13px] text-muted-foreground max-w-lg">{previewRole.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-[12px] font-medium border-border/70 gap-1.5 shrink-0"
                          onClick={() => setRoleDialog({ mode: "edit", role: previewRole })}
                        >
                          <UserRoundPen className="size-3.5" />
                          Edit role
                        </Button>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border/40 grid sm:grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <Landmark className="size-3 text-primary" /> Default landing
                          </p>
                          <p className="text-[12px] font-mono font-medium text-foreground">{previewRole.defaultLandingPath}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <BadgeCheck className="size-3 text-primary" /> Accessible routes
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {previewRole.accessiblePaths.map((path) => (
                              <span key={path} className="inline-block bg-background border border-border/60 rounded-md px-1.5 py-0.5 text-[10px] font-mono text-foreground/70">
                                {path}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Permission nodes */}
                    <div className="bg-background border border-border/60 rounded-xl p-5">
                      <p className="text-[12px] font-semibold text-foreground mb-4">Permission nodes</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {data.permissions.map((permission) => {
                          const enabled = previewRole.permissionKeys.includes("*") || previewRole.permissionKeys.includes(permission.key);
                          return (
                            <div
                              key={permission.key}
                              className={cn(
                                "rounded-lg border px-3.5 py-3 flex items-start gap-3 transition-opacity",
                                enabled
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-border/40 bg-muted/20 opacity-40"
                              )}
                            >
                              <div className={cn(
                                "size-2 rounded-full mt-1.5 shrink-0",
                                enabled ? "bg-primary" : "bg-muted-foreground/30"
                              )} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <span className="text-[12px] font-medium text-foreground">{permission.label}</span>
                                  <span className="text-[9px] font-mono text-muted-foreground/60 bg-muted rounded px-1 py-0.5">{permission.key}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{permission.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <UserEditorDialog dialogState={userDialog} open={!!userDialog} onOpenChange={(open) => !open && setUserDialog(null)} roles={data.roles} />
      <RoleEditorDialog dialogState={roleDialog} open={!!roleDialog} onOpenChange={(open) => !open && setRoleDialog(null)} permissions={data.permissions} landingPathOptions={data.landingPathOptions} />
      <UserSessionsDialog sessionsUser={sessionsUser} onOpenChange={(open) => !open && setSessionsUser(null)} />
    </>
  );
};
