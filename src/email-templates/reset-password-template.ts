interface ResetPasswordTemplateParams {
  url: string;
  user: { name?: string | null; email: string };
}

export function resetPasswordTemplate({
  url,
  user,
}: ResetPasswordTemplateParams): string {
  const name = user.name || user.email;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Password</title>
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 500px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111;">Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>You requested a password reset for your Titan ERP account.</p>
    <p>
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
        Reset Password
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();
}
