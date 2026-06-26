import { BrevoClient } from '@getbrevo/brevo';

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY!,
});

export async function sendOTPEmail(toEmail: string, otp: string): Promise<void> {
  await client.transactionalEmails.sendTransacEmail({
    subject: 'Your Password Reset OTP',
    to: [{ email: toEmail }],
    sender: { email: process.env.EMAIL_FROM!, name: 'Loan Management System' },
    htmlContent: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1a1a1a;margin-bottom:8px;">Loan Management System</h2>
        <p style="color:#6b7280;margin-bottom:24px;">Your one-time password</p>
        <div style="background:#f9fafb;border-radius:8px;padding:24px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#1a1a1a;">
          ${otp}
        </div>
        <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
          This OTP expires in 10 minutes. Do not share it with anyone.
        </p>
      </div>
    `,
  });
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}