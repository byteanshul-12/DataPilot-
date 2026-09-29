// Outgoing email service integrating Resend API with logging and simulation fallback.
import { env } from '../config/env.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const from = env.SMTP_FROM || 'onboarding@resend.dev';
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(`[EmailService] No RESEND_API_KEY configured. Simulating email dispatch to: ${to} | Subject: "${subject}"`);
    console.log(`[EmailService - SIMULATED BODY]\n${text || html}`);
    return { success: true, id: `sim_${Date.now()}` };
  }

  try {
    const payload: Record<string, any> = {
      from,
      to: [to],
      subject,
    };
    if (html) payload.html = html;
    if (text) payload.text = text;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[EmailService] Resend API error (${res.status}): ${errorText}`);
      // Return simulated success in dev if domain is restricted (e.g. Resend free testing limitation)
      return { success: false, error: errorText };
    }

    const data = (await res.json()) as { id: string };
    console.log(`[EmailService] Live email dispatched successfully via Resend. ID: ${data.id} to ${to}`);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function sendVerificationEmail({ to, url }: { to: string; url: string }) {
  const subject = 'Verify your email - DataPilot';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Welcome to DataPilot!</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Please verify your email address to complete your registration and activate your account.</p>
      <div style="margin: 32px 0;">
        <a href="${url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Verify Email Address</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser: <br/><a href="${url}" style="color: #2563eb;">${url}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you did not sign up for DataPilot, you can safely ignore this email.</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text: `Verify your DataPilot email: ${url}` });
}

export async function sendPasswordResetEmail({ to, url }: { to: string; url: string }) {
  const subject = 'Reset your password - DataPilot';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">We received a request to reset your password for DataPilot. Click the button below to choose a new password.</p>
      <div style="margin: 32px 0;">
        <a href="${url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser: <br/><a href="${url}" style="color: #2563eb;">${url}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This link will expire soon. If you did not request a password reset, please ignore this email.</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text: `Reset your DataPilot password: ${url}` });
}
