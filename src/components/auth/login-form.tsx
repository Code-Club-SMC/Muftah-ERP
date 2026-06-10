import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Loader2, Mail, LockKeyhole } from "lucide-react";
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
import { resolvePostLoginDestinationFn } from "@/server-functions/auth/resolve-post-login-destination-fn";
import { loginSchema } from "@/lib/validators";
import { FormWrapper } from "../custom/form-wrapper";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { PasswordInput } from "../custom/password-input";

type LoginFormProps = {
  redirectTo?: string;
};

export const LoginForm = ({ redirectTo }: LoginFormProps) => {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        const { error } = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        });

        if (error) {
          toast.error(error.message || "Credential verification failed.");
          return;
        }

        toast.success("Authentication successful.");
        const destination = await resolvePostLoginDestinationFn({
          data: {
            redirectTo,
          },
        });

        window.location.href = destination;
      });
    },
  });

  return (
    <FormWrapper>
      <Card className="relative border-0 sm:border sm:border-border/40 shadow-none sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:sm:shadow-[0_8px_30px_rgb(0,0,0,0.1)] sm:rounded-2xl bg-transparent sm:bg-card overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent hidden sm:block" />

        <CardHeader className="space-y-2 pt-10 pb-6 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in to your account
          </CardTitle>
          <CardDescription className="text-[14px]">
            Welcome back! Please enter your details.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 sm:px-10 pb-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup className="space-y-5">
              <form.Field name="email">
                {(field) => {
                  const errors = field.state.meta.errors;
                  const isInvalid = errors && errors.length > 0;
                  return (
                    <Field className="space-y-2">
                      <FieldLabel className="text-[13px] font-medium text-foreground/90 flex items-center gap-2">
                        <Mail className="size-3.5 text-muted-foreground/70" />
                        Email Address
                      </FieldLabel>
                      <Input
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="name@company.com"
                        className="h-11 bg-muted/30 border-border/50 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-lg text-[14px]"
                        autoFocus
                      />
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="password">
                {(field) => {
                  const errors = field.state.meta.errors;
                  const isInvalid = errors && errors.length > 0;
                  return (
                    <Field className="space-y-2">
                      <div className="flex items-center justify-between">
                        <FieldLabel className="text-[13px] font-medium text-foreground/90 flex items-center gap-2">
                          <LockKeyhole className="size-3.5 text-muted-foreground/70" />
                          Password
                        </FieldLabel>
                        <Link
                          to="/forgot-password"
                          className="text-[13px] font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <PasswordInput
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="••••••••"
                        className="h-11 bg-muted/30 border-border/50 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 transition-all rounded-lg text-[14px]"
                      />
                      {isInvalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.Field>

              <div className="pt-1">
                <Button
                  variant="default"
                  disabled={isPending}
                  type="submit"
                  className="w-full h-11 font-medium text-[14px] rounded-lg  active:scale-[0.98] transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </div>

              <div className="text-center text-[13px] text-muted-foreground pt-2">
                Account access is provisioned by your super admin.
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </FormWrapper>
  );
};
