import { ForgotIllustration } from "@/components/illustrations/Forgotllustration";
import { LoginIllustration } from "@/components/illustrations/LoginIllustration";
import { ResetIllustration } from "@/components/illustrations/Resetllustration";
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import type { FunctionComponent } from "react";
import { getViewerAccessFn } from "@/server-functions/auth/get-viewer-access-fn";

export const Route = createFileRoute("/_authLayout")({
  beforeLoad: async () => {
    const viewerAccess = await getViewerAccessFn();

    if (viewerAccess) {
      throw redirect({
        to: viewerAccess.defaultLandingPath,
      });
    }
  },
  component: RouteComponent,
});

type IllustrationComponent = FunctionComponent<{ className?: string }>;

interface AuthRouteConfig {
  title: string;
  description: string;
  illustration: IllustrationComponent;
}

const authRoutesConfig: Record<string, AuthRouteConfig> = {
  "/login": {
    title: "Welcome Back to Muftah Chemical PVT LTD (S-WASH)",
    description:
      "Enter your system credentials below to access the administrative dashboard.",
    illustration: LoginIllustration,
  },
  "/forgot-password": {
    title: "Account Recovery",
    description:
      "If you've forgotten your password, enter your registered email address to receive instructions.",
    illustration: ForgotIllustration,
  },
  "/reset-password": {
    title: "Establish New Credentials",
    description:
      "Please define a unique and robust password for your system account.",
    illustration: ResetIllustration,
  },
};

// ─── Layout ───────────────────────────────────────────────────────────────────

function RouteComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const config = authRoutesConfig[pathname];

  // If the pathname has no matching config (e.g. a sub-route), just render the
  // outlet without the split-screen chrome.
  if (!config) return <Outlet />;

  const Illustration = config.illustration;

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-background">
      {/* ── Illustration Column (Left) ── */}
      <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-10 p-12 relative bg-muted/20 border-r border-border/50">
        {/* Subtle grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Glow blob */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-emerald-500/5 blur-3xl"
        />

        <Illustration className="relative z-10 size-60 text-emerald-600/60 dark:text-emerald-500/40" />

        <div className="relative z-10 max-w-sm space-y-3 text-center">
          <h1 className="text-[1.65rem] font-extrabold tracking-tight leading-snug text-foreground">
            {config.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {config.description}
          </p>
        </div>

        {/* Bottom wordmark / brand lock-up */}
        <p className="absolute bottom-6 text-xs font-medium text-muted-foreground/50  uppercase">
          Muftah Chemical PVT LTD (S-WASH) &mdash; Secure Access
        </p>
      </div>

      {/* ── Form Column (Right) ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        {/* Mobile-only brand header */}
        <div className="md:hidden mb-8 text-center space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {config.title}
          </h2>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>

        <div className="w-full max-w-[520px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
