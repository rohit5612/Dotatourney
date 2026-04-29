import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.emailUser,
        pass: env.emailPass,
      },
    });
  }
  return transporter;
}

function baseEmailWrapper({ title, preheader, innerHtml }) {
  const app = env.appUrl.replace(/\/$/, "");
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;background:#0c0c10;color:#e4e4e7;font-family:Inter,Segoe UI,system-ui,sans-serif;line-height:1.5;">
  <span style="display:none;max-height:0;overflow:hidden">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#1a0a0c 0%,#0c0c10 40%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#121218;border:1px solid #2a2a32;border-radius:12px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.45);">
          <tr>
            <td style="padding:0 28px 24px;background:linear-gradient(90deg,#b81414 0%,#8b0f0f 100%);">
              <p style="margin:24px 0 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.85);">The Forge</p>
              <h1 style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#fff;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 32px;">
              ${innerHtml}
              <p style="margin:28px 0 0;font-size:12px;color:#71717a;border-top:1px solid #27272f;padding-top:16px;">
                This message was sent by <strong style="color:#ec1313;">The Forge</strong> tournament admin tools.
                <br /><a href="${app}" style="color:#ec1313;text-decoration:none;">Open panel</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td bgcolor="#ec1313" style="border-radius:8px;text-align:center;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
}

async function sendMail({ to, subject, text, html }) {
  if (env.emailSkipSend) {
    console.warn("[email] EMAIL_SKIP_SEND is set; not sending:", subject);
    return;
  }
  const transport = getTransporter();
  const from = env.emailFrom || env.emailUser;
  const prefix = env.emailSubjectPrefix ? `${env.emailSubjectPrefix} ` : "";
  await transport.sendMail({
    from,
    to,
    subject: `${prefix}${subject}`.trim(),
    text,
    html,
  });
}

/**
 * @param {{ to: string; registerUrl: string; expiresAt: string }} params
 */
export async function sendAdminInviteEmail({ to, registerUrl, expiresAt }) {
  const expiresDate = new Date(expiresAt);
  const expiresUtc = expiresDate.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const hours = env.adminInviteExpiryHours;
  const hoursLabel = hours === 1 ? "1 hour" : `${hours} hours`;

  const subject = "You're invited — The Forge admin access";
  const text = [
    `You've been invited to join The Forge as an administrator.`,
    ``,
    `Complete registration (valid until ${expiresUtc}, about ${hoursLabel} from when this was sent):`,
    registerUrl,
    ``,
    `If you didn't expect this, you can ignore this email.`,
  ].join("\n");

  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">You've been invited to join <strong style="color:#fff;">The Forge</strong> as an administrator.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Use the secure link below to set your name and password. The link stops working after the expiry time.</p>
    ${buttonHtml(registerUrl, "Complete registration")}
    <p style="margin:0;font-size:13px;color:#71717a;">Expires: <strong style="color:#a1a1aa;">${expiresUtc}</strong> (~${hoursLabel})</p>
    <p style="margin:16px 0 0;font-size:13px;color:#52525b;">If you didn't request this, you can safely ignore this message.</p>
  `;
  const html = baseEmailWrapper({
    title: "Admin invitation",
    preheader: "Complete your Forge admin registration.",
    innerHtml,
  });

  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; name: string }} params
 */
export async function sendAdminApprovedEmail({ to, name }) {
  const loginUrl = `${env.appUrl.replace(/\/$/, "")}/admin`;
  const subject = "Access approved — The Forge admin panel";
  const text = [
    `Hi ${name},`,
    ``,
    `Your Forge administrator account has been approved.`,
    `You can sign in here: ${loginUrl}`,
    ``,
    `— The Forge`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your administrator access is now active. Sign in with the email address you registered.</p>
    ${buttonHtml(loginUrl, "Sign in to admin panel")}
  `;
  const html = baseEmailWrapper({
    title: "You're approved",
    preheader: "Your Forge admin access is ready.",
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; name: string }} params
 */
export async function sendAdminRejectedEmail({ to, name }) {
  const subject = "Admin registration update — The Forge";
  const text = [
    `Hi ${name},`,
    ``,
    `Your request for Forge administrator access was not approved at this time.`,
    `If you think this is a mistake, reply to your tournament organizer or superadmin contact.`,
    ``,
    `— The Forge`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your administrator registration was <strong style="color:#f87171;">not approved</strong> at this time.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">If you believe this is an error, contact your tournament organizer.</p>
  `;
  const html = baseEmailWrapper({
    title: "Registration not approved",
    preheader: "Your Forge admin request was not approved.",
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; name: string }} params
 */
export async function sendAdminRevokedEmail({ to, name }) {
  const subject = "Admin access revoked — The Forge";
  const text = [
    `Hi ${name},`,
    ``,
    `Your Forge administrator access has been revoked. You can no longer sign in to the admin panel.`,
    `Contact your superadmin if you need access again.`,
    ``,
    `— The Forge`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your <strong style="color:#fbbf24;">administrator access has been revoked</strong>. Active sessions have been invalidated.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">If you need access again, ask a superadmin to send a new invitation.</p>
  `;
  const html = baseEmailWrapper({
    title: "Access revoked",
    preheader: "Your Forge admin access has been removed.",
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
