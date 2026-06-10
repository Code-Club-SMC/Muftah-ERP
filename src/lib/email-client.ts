interface SendEmailParams {
  email: string;
  subject: string;
  html: () => string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  // SMTP/email sending implementation
  // For now, log to console in dev; production should use a real SMTP client
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Email] To: ${params.email} | Subject: ${params.subject}`);
    console.log(`[Email] Body: ${params.html()}`);
    return;
  }

  // Production SMTP sending would go here
  console.log(`[Email] Sending to ${params.email}: ${params.subject}`);
}

export async function verifySmtpConnection(): Promise<boolean> {
  // Verify SMTP connectivity on startup
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  // Production SMTP verification would go here
  return true;
}
