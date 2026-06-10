import { timingSafeEqual } from "node:crypto";

const BOOTSTRAP_SECRET_HEADER = "x-bootstrap-secret";
const BOOTSTRAP_SECRET_ENV_KEY = "ADMIN_BOOTSTRAP_SECRET";
const PUBLIC_SIGNUP_ENV_KEY = "ALLOW_PUBLIC_SIGNUP";

function normalizeBoolean(value?: string) {
  return value?.trim().toLowerCase() === "true";
}

export function getBootstrapSecretHeader() {
  return BOOTSTRAP_SECRET_HEADER;
}

export function getBootstrapSecret() {
  const value = process.env[BOOTSTRAP_SECRET_ENV_KEY]?.trim();
  return value && value.length > 0 ? value : null;
}

export function isPublicSignupEnabled() {
  return normalizeBoolean(process.env[PUBLIC_SIGNUP_ENV_KEY]);
}

export function hasValidBootstrapSecret(request: Request) {
  const configuredSecret = getBootstrapSecret();
  const providedSecret = request.headers.get(BOOTSTRAP_SECRET_HEADER)?.trim();

  if (!configuredSecret || !providedSecret) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredSecret, "utf8");
  const providedBuffer = Buffer.from(providedSecret, "utf8");

  if (configuredBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}
