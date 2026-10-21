import { appUrl } from "./env";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends an email through Resend when RESEND_API_KEY and EMAIL_FROM are set.
 * Otherwise the message is printed to the server log (useful in development).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.info(
      `[email] RESEND_API_KEY/EMAIL_FROM not set, printing instead of sending.\n` +
        `  To: ${message.to}\n  Subject: ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
}

/** Sends an email but never throws: email problems must not break the main flow. */
export async function sendEmailSafely(message: EmailMessage): Promise<void> {
  try {
    await sendEmail(message);
  } catch (err) {
    console.error("[email] failed to send", { to: message.to, subject: message.subject, err });
  }
}

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`).join("");
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-weight:700;font-size:18px;margin:0 0 24px;color:#4f46e5">AEOGo</p>
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${button}
</div>
<p style="font-size:12px;color:#64748b;margin-top:24px">You're receiving this because you have an AEOGo account.</p>
</div></body></html>`;
}

export function passwordResetEmail(to: string, name: string, resetUrl: string): EmailMessage {
  return {
    to,
    subject: "Reset your AEOGo password",
    text: `Hi ${name},\n\nUse the link below to reset your AEOGo password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: layout(
      "Reset your password",
      [
        `Hi ${escapeHtml(name)},`,
        "Click the button below to choose a new password. This link expires in 1 hour.",
        "If you didn't request a password reset, you can safely ignore this email.",
      ],
      { label: "Reset password", url: resetUrl },
    ),
  };
}

export function automationStartedEmail(to: string, name: string, domain: string, websiteId: string): EmailMessage {
  const url = `${appUrl()}/dashboard/websites/${websiteId}`;
  return {
    to,
    subject: `AEO automation started for ${domain}`,
    text: `Hi ${name},\n\nThanks for subscribing! We've started auditing ${domain}. Your first AEO report will be ready in a few minutes:\n\n${url}`,
    html: layout(
      `We're optimizing ${domain}`,
      [
        `Hi ${escapeHtml(name)},`,
        `Thanks for subscribing! Our crawler has started auditing <strong>${escapeHtml(domain)}</strong> for AI answer engines like ChatGPT, Perplexity and Google AI Overviews.`,
        "Your first report, including AI-written fixes, will be ready in a few minutes.",
      ],
      { label: "View progress", url },
    ),
  };
}

export function auditReadyEmail(
  to: string,
  name: string,
  domain: string,
  websiteId: string,
  score: number,
  pages: number,
  issueCount: number,
): EmailMessage {
  const url = `${appUrl()}/dashboard/websites/${websiteId}`;
  return {
    to,
    subject: `Your AEO report for ${domain} is ready (score ${score}/100)`,
    text: `Hi ${name},\n\nYour AEO audit for ${domain} is complete.\n\nScore: ${score}/100\nPages crawled: ${pages}\nIssues found: ${issueCount}\n\nSee your fixes: ${url}`,
    html: layout(
      `Your AEO report for ${domain} is ready`,
      [
        `Hi ${escapeHtml(name)},`,
        `We crawled <strong>${pages}</strong> pages and found <strong>${issueCount}</strong> issues. Your AEO score is <strong>${score}/100</strong>.`,
        "Open your dashboard to review the AI-written fixes we prepared for you.",
      ],
      { label: "View report", url },
    ),
  };
}

export function paymentIssueEmail(to: string, name: string, domain: string): EmailMessage {
  const url = `${appUrl()}/dashboard/billing`;
  return {
    to,
    subject: `Action needed: payment issue for ${domain}`,
    text: `Hi ${name},\n\nWe couldn't process the latest payment for your ${domain} plan, so automation is paused. Update your payment method to resume:\n\n${url}`,
    html: layout(
      "We couldn't process your payment",
      [
        `Hi ${escapeHtml(name)},`,
        `The latest payment for <strong>${escapeHtml(domain)}</strong> failed, so AEO automation is paused.`,
        "Update your payment method to resume monitoring and fixes.",
      ],
      { label: "Update payment method", url },
    ),
  };
}
