import { useForm } from "@tanstack/react-form";
import { Loader2, Eye, EyeOff, Hash, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const editUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  roleSlug: z.enum(["admin", "finance-manager", "operator", "super-admin"]),
  password: z.string().refine((val) => val === "" || val.length >= 8, {
    message: "Password must be at least 8 characters",
  }),
});

const roleColors: Record<string, string> = {
  "super-admin": "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  admin: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "finance-manager": "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  operator: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    banned: boolean;
    image?: string | null;
  };
  onSuccess: () => void;
};

export const EditUserForm = ({ user, onSuccess }: Props) => {
  const { setRole, updateUser, setUserPassword } = useUsers();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      roleSlug: user.role as "admin" | "finance-manager" | "operator" | "super-admin",
      password: "",
    },
    validators: { onSubmit: editUserSchema },
    onSubmit: async ({ value }) => {
      const promises: Promise<any>[] = [];

      if (value.roleSlug !== user.role) {
        promises.push(setRole.mutateAsync({ userId: user.id, roleSlug: value.roleSlug }));
      }
      if (value.name !== user.name || value.email !== user.email)
        promises.push(updateUser.mutateAsync({ userId: user.id, name: value.name, email: value.email }));
      if (value.password && value.password.length >= 8)
        promises.push(setUserPassword.mutateAsync({ userId: user.id, password: value.password }));

      await Promise.all(promises);
      onSuccess();
    },
  });

  const isSubmitting = setRole.isPending || updateUser.isPending || setUserPassword.isPending;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}
      className="space-y-4 pt-1"
    >
      {/* User meta strip */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <Hash className="size-3 text-muted-foreground/40 shrink-0" />
          <span className="font-mono text-[10.5px] text-muted-foreground/55 truncate">{user.id}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={cn("text-[10px] font-semibold h-5 px-2 capitalize", roleColors[user.role])}
          >
            {user.role.replace("-", " ")}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold h-5 px-2",
              user.banned
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
            )}
          >
            {user.banned ? "Banned" : "Active"}
          </Badge>
        </div>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <form.Field name="name">
          {(field) => (
            <Field className="space-y-1.5">
              <FieldLabel className="text-[12.5px] font-medium text-foreground/80">Full Name</FieldLabel>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="h-9 text-[13px]"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-[11px] text-destructive">{field.state.meta.errors.join(", ")}</p>
              )}
            </Field>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <Field className="space-y-1.5">
              <FieldLabel className="text-[12.5px] font-medium text-foreground/80">Email Address</FieldLabel>
              <Input
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="h-9 text-[13px]"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-[11px] text-destructive">{field.state.meta.errors.join(", ")}</p>
              )}
            </Field>
          )}
        </form.Field>

        <form.Field name="roleSlug">
          {(field) => (
            <Field className="space-y-1.5">
              <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-muted-foreground/60" />
                System Role
              </FieldLabel>
              <Select value={field.state.value} onValueChange={(val: any) => field.handleChange(val)}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator" className="text-[13px]">Operator</SelectItem>
                  <SelectItem value="finance-manager" className="text-[13px]">Finance Manager</SelectItem>
                  <SelectItem value="admin" className="text-[13px]">Admin</SelectItem>
                  <SelectItem value="super-admin" className="text-[13px]">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <Field className="space-y-1.5">
              <FieldLabel className="text-[12.5px] font-medium text-foreground/80">
                New Password
                <span className="ml-1.5 text-[10px] text-muted-foreground/50 font-normal italic">optional</span>
              </FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Leave blank to keep current"
                  className="h-9 pr-9 text-[13px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-9 text-muted-foreground/50 hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/55">Minimum 8 characters.</p>
              {field.state.meta.errors.length > 0 && (
                <p className="text-[11px] text-destructive">{field.state.meta.errors.join(", ")}</p>
              )}
            </Field>
          )}
        </form.Field>
      </div>

      <div className="pt-1 border-t border-border/60">
        <Button type="submit" disabled={isSubmitting} className="w-full h-9 text-[13px] font-medium">
          {isSubmitting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
};
