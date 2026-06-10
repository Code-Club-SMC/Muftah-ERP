import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus, UserRoundPen } from "lucide-react";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
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
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";

import { UserDialogState, ManagedRole, LandingPathPill } from "./types";

export function UserEditorDialog({
  dialogState,
  open,
  onOpenChange,
  roles,
}: {
  dialogState: UserDialogState | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: ManagedRole[];
}) {
  const { createUser, setRole, setUserPassword, updateUser } = useUsers();
  const isEditing = dialogState?.mode === "edit";
  const availableRoles = roles.filter(
    (role) => !role.isArchived || role.slug === dialogState?.user?.roleAssignment?.slug,
  );

  const [formState, setFormState] = useState(() => ({
    name:
      dialogState?.mode === "edit"
        ? dialogState.user.name
        : dialogState?.seedOrderBooker?.name ?? "",
    email: dialogState?.mode === "edit" ? dialogState.user.email : "",
    password: "",
    roleSlug:
      dialogState?.mode === "edit"
        ? dialogState.user.roleAssignment?.slug ?? availableRoles[0]?.slug ?? "operator"
        : dialogState?.seedOrderBooker
          ? "order-booker"
          : availableRoles[0]?.slug ?? "operator",
    orderBookerId:
      dialogState?.mode === "create"
        ? (dialogState.seedOrderBooker?.id ?? "")
        : "",
  }));

  const submitting =
    createUser.isPending ||
    setRole.isPending ||
    setUserPassword.isPending ||
    updateUser.isPending;

  const syncFormState = () => {
    setFormState({
      name:
        dialogState?.mode === "edit"
          ? dialogState.user.name
          : dialogState?.seedOrderBooker?.name ?? "",
      email: dialogState?.mode === "edit" ? dialogState.user.email : "",
      password: "",
      roleSlug:
        dialogState?.mode === "edit"
          ? dialogState.user.roleAssignment?.slug ?? availableRoles[0]?.slug ?? "operator"
          : dialogState?.seedOrderBooker
            ? "order-booker"
            : availableRoles[0]?.slug ?? "operator",
      orderBookerId:
        dialogState?.mode === "create"
          ? (dialogState.seedOrderBooker?.id ?? "")
          : "",
    });
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      syncFormState();
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    syncFormState();
  }, [dialogState]);

  const handleSubmit = async () => {
    if (!formState.name.trim() || !formState.email.trim()) {
      return;
    }

    if (!isEditing) {
      await createUser.mutateAsync({
        name: formState.name.trim(),
        email: formState.email.trim().toLowerCase(),
        password: formState.password,
        roleSlug: formState.roleSlug,
        orderBookerId:
          formState.roleSlug === "order-booker" && formState.orderBookerId
            ? formState.orderBookerId
            : undefined,
      });
      close(false);
      return;
    }

    const promises: Promise<unknown>[] = [];

    if (
      formState.name.trim() !== dialogState.user.name ||
      formState.email.trim().toLowerCase() !== dialogState.user.email
    ) {
      promises.push(
        updateUser.mutateAsync({
          userId: dialogState.user.id,
          name: formState.name.trim(),
          email: formState.email.trim().toLowerCase(),
        }),
      );
    }

    if (formState.roleSlug !== dialogState.user.roleAssignment?.slug) {
      promises.push(
        setRole.mutateAsync({
          userId: dialogState.user.id,
          roleSlug: formState.roleSlug,
        }),
      );
    }

    if (formState.password.trim()) {
      promises.push(
        setUserPassword.mutateAsync({
          userId: dialogState.user.id,
          password: formState.password,
        }),
      );
    }

    await Promise.all(promises);
    close(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={close}
      title={isEditing ? "Refine User Access" : "Create Managed User"}
      description={
        isEditing
          ? "Update identity, access, and recovery settings without leaving the control center."
          : "Create an account and attach it to an active RBAC role in a single flow."
      }
      className="min-w-6xl w-full border-border/60 bg-card/95 p-0 shadow-none0_30px_80px_-45px_rgba(15,23,42,0.7)]"
      icon={isEditing ? UserRoundPen : UserPlus}
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-muted-foreground">
                Full Name
              </span>
              <Input
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Abdul Rehman"
                className="h-11 rounded-none border-border/60 bg-background/80 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-muted-foreground">
                Email
              </span>
              <Input
                type="email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="operator@company.com"
                className="h-11 rounded-none border-border/60 bg-background/80 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-muted-foreground">
                Role Assignment
              </span>
              <Select
                value={formState.roleSlug}
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    roleSlug: value,
                  }))
                }
              >
                <SelectTrigger className="h-11 w-full rounded-none border-border/60 bg-background/80 px-4 text-sm">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.slug}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-2">
              <span className="text-muted-foreground">
                {isEditing ? "Rotate Password" : "Initial Password"}
              </span>
              <Input
                type="password"
                value={formState.password}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder={isEditing ? "Leave blank to keep current" : "Minimum 8 characters"}
                className="h-11 rounded-none border-border/60 bg-background/80 text-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-none border border-border/60 bg-linear-to-br from-primary/10 via-background to-background p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-none bg-primary/15 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Access Snapshot</p>
              <p className="text-xs text-muted-foreground">
                Preview the operating lane this user will enter after sign-in.
              </p>
            </div>
          </div>

          {roles
            .filter((role) => role.slug === formState.roleSlug)
            .map((role) => (
              <div key={role.id} className="mt-5 space-y-4">
                <Badge className={cn("h-6 rounded-none px-3 text-[10px] font-bold uppercase", role.toneClassName)}>
                  {role.name}
                </Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {role.description || "No role description has been written yet."}
                </p>
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Landing
                  </p>
                  <LandingPathPill path={role.defaultLandingPath} />
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Reachable Modules
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {role.accessiblePaths.slice(0, 6).map((path) => (
                      <Badge key={path} variant="outline" className="h-6 rounded-none px-3 text-[10px]">
                        {path}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
        <Button variant="outline" onClick={() => close(false)} className="rounded-none px-5">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !formState.name.trim() ||
            !formState.email.trim() ||
            (!isEditing && formState.password.trim().length < 8)
          }
          className="rounded-none px-5"
        >
          {submitting ? "Saving..." : isEditing ? "Save Access" : "Create User"}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
