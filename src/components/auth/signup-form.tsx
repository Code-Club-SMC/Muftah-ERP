import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Loader2, Mail, LockKeyhole, ShieldCheck, User } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { signupSchema } from "@/lib/validators";
import { FormWrapper } from "../custom/form-wrapper";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import {
  PasswordInput,
  PasswordInputStrengthChecker,
} from "../custom/password-input";

export const SignupForm = () => {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: signupSchema,
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        const { error } = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: value.fullName,
        });

        if (error) {
          toast.error(error.message || "Failed to create account.");
          return;
        }

        toast.success("Account created successfully.");
        window.location.href = "/login";
      });
    },
  });

  // ✅ FormWrapper kept.
  // ✅ Removed the outer <div className="w-full max-w-[400px] mx-auto animate-in ...">
  //    that was wrapping FormWrapper — it was fighting with AuthLayout's own
  //    max-w-[420px] container, causing unpredictable width/overflow behavior.
  //    AuthLayout already handles centering and max-width for the form column.
  return (
    <FormWrapper>
      <Card className="relative border-0 sm:border sm:border-border/40 shadow-none sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:sm:shadow-[0_8px_30px_rgb(0,0,0,0.1)] sm:rounded-2xl bg-transparent sm:bg-card overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden sm:block" />

        <CardHeader className="space-y-1 pt-6 pb-4 text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Create an account
          </CardTitle>
          <CardDescription className="text-[13px]">
            Enter your details below to get started.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 sm:px-6 pb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup className="space-y-3">
              {/* Full Name */}
              <form.Field name="fullName">
                {(field) => {
                  const errors = field.state.meta.errors;
                  const isInvalid = errors && errors.length > 0;
                  return (
                    <Field className="space-y-1">
                      <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                        <User className="size-3 text-muted-foreground/70" />
                        Full Name
                      </FieldLabel>
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="John Doe"
                        className="h-9 bg-muted/30 border-border/50 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-lg text-[13px]"
                        autoFocus
                      />
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Email */}
              <form.Field name="email">
                {(field) => {
                  const errors = field.state.meta.errors;
                  const isInvalid = errors && errors.length > 0;
                  return (
                    <Field className="space-y-1">
                      <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                        <Mail className="size-3 text-muted-foreground/70" />
                        Email Address
                      </FieldLabel>
                      <Input
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="name@company.com"
                        className="h-9 bg-muted/30 border-border/50 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-lg text-[13px]"
                      />
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Password */}
              <form.Field name="password">
                {(field) => {
                  const errors = field.state.meta.errors;
                  const isInvalid = errors && errors.length > 0;
                  return (
                    <Field className="space-y-1">
                      <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                        <LockKeyhole className="size-3 text-muted-foreground/70" />
                        Password
                      </FieldLabel>
                      <PasswordInput
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="h-9 bg-muted/30 border-border/50 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-lg text-[13px]"
                      >
                        <PasswordInputStrengthChecker />
                      </PasswordInput>
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Confirm Password */}
              <form.Field name="confirmPassword">
                {(field) => {
                  const errors = field.state.meta.errors;
                  const isInvalid = errors && errors.length > 0;
                  return (
                    <Field className="space-y-1">
                      <FieldLabel className="text-[12.5px] font-medium text-foreground/80 flex items-center gap-1.5">
                        <ShieldCheck className="size-3 text-muted-foreground/70" />
                        Confirm Password
                      </FieldLabel>
                      <PasswordInput
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="h-9 bg-muted/30 border-border/50 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-lg text-[13px]"
                      />
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Submit */}
              <div className="pt-1">
                <Button
                  type="submit"
                  className="w-full h-9 font-medium text-[13px] rounded-lg  active:scale-[0.98] transition-all"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </div>

              <p className="text-center text-[12.5px] text-muted-foreground pt-1">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </FormWrapper>
  );
};
