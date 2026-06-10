import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserCircle, Mail, KeyRound, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const addUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleSlug: z.enum(["operator", "finance-manager", "super-admin", "admin"]),
});

const roleOptions = [
  { value: "operator", label: "Operator" },
  { value: "finance-manager", label: "Finance Manager" },
  { value: "admin", label: "Admin" },
  { value: "super-admin", label: "Super Admin" },
] as const;

type Props = { onSuccess: () => void };

export const AddUserForm = ({ onSuccess }: Props) => {
  const { createUser } = useUsers();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleSlug: "operator" as "operator" | "finance-manager" | "super-admin" | "admin",
    },
    validators: { onSubmit: addUserSchema },
    onSubmit: async ({ value }) => {
      createUser.mutate(value, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          onSuccess();
        },
        onError: (error: any) => {
          console.error(error);
          toast.error(error.message);
        },
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4 pt-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <form.Field name="name">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field className="space-y-1.5">
                <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                  <UserCircle className="size-3.5 text-muted-foreground/70" />
                  Full Name
                </FieldLabel>
                <Input
                  placeholder="e.g. Abdul Rehman"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoFocus
                  className={cn(
                    "h-9 text-[13px]",
                    hasError && "border-destructive/60 focus-visible:ring-destructive/30",
                  )}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        </form.Field>

        {/* Email */}
        <form.Field name="email">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field className="space-y-1.5">
                <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground/70" />
                  Email Address
                </FieldLabel>
                <Input
                  type="email"
                  placeholder="employee@company.dev"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={cn(
                    "h-9 text-[13px]",
                    hasError && "border-destructive/60 focus-visible:ring-destructive/30",
                  )}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        </form.Field>

        {/* Password */}
        <form.Field name="password">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field className="space-y-1.5">
                <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-muted-foreground/70" />
                  Password
                </FieldLabel>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={cn(
                    "h-9 text-[13px]",
                    hasError && "border-destructive/60 focus-visible:ring-destructive/30",
                  )}
                />
                <p className="text-[11px] text-muted-foreground/55">Minimum 8 characters.</p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        </form.Field>

        {/* Role */}
        <form.Field name="roleSlug">
          {(field) => (
            <Field className="space-y-1.5">
              <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-muted-foreground/70" />
                System Role
              </FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(val: any) => field.handleChange(val)}
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-[13px]">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/55">Determines access level and permissions.</p>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>

      <div className="pt-2 border-t border-border/60">
        <Button
          type="submit"
          disabled={createUser.isPending}
          className="w-full h-9 text-[13px] font-medium"
        >
          {createUser.isPending ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create User"
          )}
        </Button>
      </div>
    </form>
  );
};
