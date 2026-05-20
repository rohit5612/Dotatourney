import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const BRAND_SHORT = "BPC League";
const BRAND_FULL = "Bharat Pro Circuit League";
const BRAND_LINE = `${BRAND_SHORT} — ${BRAND_FULL}`;
const DEFAULT_TOURNAMENT_NAME = BRAND_LINE;

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
            <td style="padding:0 28px 24px;background:linear-gradient(90deg,#c9782e 0%,#1a6b5c 100%);">
              <p style="margin:24px 0 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${BRAND_SHORT}</p>
              <h1 style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#fff;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 32px;">
              ${innerHtml}
              <p style="margin:28px 0 0;font-size:12px;color:#71717a;border-top:1px solid #27272f;padding-top:16px;">
                This message was sent by <strong style="color:#e9a84a;">${BRAND_LINE}</strong> tournament admin tools.
                <br /><a href="${app}" style="color:#5eead4;text-decoration:none;">Open panel</a>
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
    <tr><td bgcolor="#c9782e" style="border-radius:8px;text-align:center;">
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
  const options = {
    from,
    to,
    subject: `${prefix}${subject}`.trim(),
    text,
    html,
  };
  if (env.emailReplyTo) {
    options.replyTo = env.emailReplyTo;
  }
  await transport.sendMail(options);
}

/**
 * @param {{ to: string; registerUrl: string; expiresAt: string }} params
 */
export async function sendAdminInviteEmail({ to, registerUrl, expiresAt }) {
  const expiresDate = new Date(expiresAt);
  const expiresUtc = expiresDate.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const hours = env.adminInviteExpiryHours;
  const hoursLabel = hours === 1 ? "1 hour" : `${hours} hours`;

  const subject = `You're invited — ${BRAND_SHORT} admin access`;
  const text = [
    `You've been invited to join ${BRAND_LINE} as an administrator.`,
    ``,
    `Complete registration (valid until ${expiresUtc}, about ${hoursLabel} from when this was sent):`,
    registerUrl,
    ``,
    `If you didn't expect this, you can ignore this email.`,
  ].join("\n");

  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">You've been invited to join <strong style="color:#fff;">${BRAND_LINE}</strong> as an administrator.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Use the secure link below to set your name and password. The link stops working after the expiry time.</p>
    ${buttonHtml(registerUrl, "Complete registration")}
    <p style="margin:0;font-size:13px;color:#71717a;">Expires: <strong style="color:#a1a1aa;">${expiresUtc}</strong> (~${hoursLabel})</p>
    <p style="margin:16px 0 0;font-size:13px;color:#52525b;">If you didn't request this, you can safely ignore this message.</p>
  `;
  const html = baseEmailWrapper({
    title: "Admin invitation",
    preheader: `Complete your ${BRAND_SHORT} admin registration.`,
    innerHtml,
  });

  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; name: string }} params
 */
export async function sendAdminApprovedEmail({ to, name }) {
  const loginUrl = `${env.appUrl.replace(/\/$/, "")}/admin`;
  const subject = `Access approved — ${BRAND_SHORT} admin panel`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your ${BRAND_LINE} administrator account has been approved.`,
    `You can sign in here: ${loginUrl}`,
    ``,
    `— ${BRAND_LINE}`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your administrator access is now active. Sign in with the email address you registered.</p>
    ${buttonHtml(loginUrl, "Sign in to admin panel")}
  `;
  const html = baseEmailWrapper({
    title: "You're approved",
    preheader: `Your ${BRAND_SHORT} admin access is ready.`,
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; name: string }} params
 */
export async function sendAdminRejectedEmail({ to, name }) {
  const subject = `Admin registration update — ${BRAND_SHORT}`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your request for ${BRAND_LINE} administrator access was not approved at this time.`,
    `If you think this is a mistake, reply to your tournament organizer or superadmin contact.`,
    ``,
    `— ${BRAND_LINE}`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your administrator registration was <strong style="color:#f87171;">not approved</strong> at this time.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">If you believe this is an error, contact your tournament organizer.</p>
  `;
  const html = baseEmailWrapper({
    title: "Registration not approved",
    preheader: `Your ${BRAND_SHORT} admin request was not approved.`,
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; name: string }} params
 */
export async function sendAdminRevokedEmail({ to, name }) {
  const subject = `Admin access revoked — ${BRAND_SHORT}`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your ${BRAND_LINE} administrator access has been revoked. You can no longer sign in to the admin panel.`,
    `Contact your superadmin if you need access again.`,
    ``,
    `— ${BRAND_LINE}`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your <strong style="color:#fbbf24;">administrator access has been revoked</strong>. Active sessions have been invalidated.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">If you need access again, ask a superadmin to send a new invitation.</p>
  `;
  const html = baseEmailWrapper({
    title: "Access revoked",
    preheader: `Your ${BRAND_SHORT} admin access has been removed.`,
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

export async function sendPlayerRegistrationOtpEmail({ to, name, tournamentName, otp, expiresMinutes = 15 }) {
  const subject = `Your verification code — ${tournamentName || DEFAULT_TOURNAMENT_NAME}`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your verification code for ${tournamentName || DEFAULT_TOURNAMENT_NAME} registration is: ${otp}`,
    `It expires in about ${expiresMinutes} minutes.`,
    ``,
    `If you did not start a registration, ignore this email.`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Use this code to verify your email for <strong style="color:#fff;">${escapeHtml(tournamentName || DEFAULT_TOURNAMENT_NAME)}</strong>:</p>
    <p style="margin:20px 0;font-size:28px;letter-spacing:0.2em;font-weight:700;color:#e9a84a;text-align:center;">${escapeHtml(otp)}</p>
    <p style="margin:0;font-size:13px;color:#71717a;">Expires in about ${expiresMinutes} minutes.</p>
  `;
  const html = baseEmailWrapper({
    title: "Verify your email",
    preheader: `Your code: ${otp}`,
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

function summaryTableHtml(reg) {
  const rows = [
    ["Registration ID", reg.publicCode || "—"],
    ["Name", reg.name],
    ["Email", reg.email],
    ["Phone", reg.phoneNumber || "—"],
    ["Roles", (reg.roles || []).join(", ")],
    ["MMR", reg.mmr != null ? String(reg.mmr) : "—"],
    ["Steam", reg.steamName || "—"],
    ["Discord", reg.discordHandle || "—"],
  ];
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #27272f;color:#a1a1aa;font-size:13px;">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #27272f;color:#e4e4e7;font-size:13px;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;">${body}</table>`;
}

export async function sendPlayerRegistrationVerifiedEmail({ to, name, tournamentName, registration, continueUrl }) {
  const code = registration?.publicCode || "";
  const subject = `Registration ID ${code} — ${tournamentName || DEFAULT_TOURNAMENT_NAME}`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your registration ID is: ${code}`,
    `Continue registration and submit payment proof here:`,
    continueUrl,
    ``,
    `— ${tournamentName || DEFAULT_TOURNAMENT_NAME}`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your email is verified. Save your <strong style="color:#e9a84a;">registration ID: ${escapeHtml(code)}</strong> — you will need it with your email to continue if you leave this page.</p>
    ${summaryTableHtml(registration)}
    ${buttonHtml(continueUrl, "Continue registration")}
  `;
  const html = baseEmailWrapper({
    title: "Email verified",
    preheader: `Your ID: ${code}`,
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

export async function sendPlayerRegistrationSubmittedEmail({ to, name, tournamentName, publicCode }) {
  const subject = `Registration received — ${tournamentName || DEFAULT_TOURNAMENT_NAME}`;
  const text = [
    `Hi ${name},`,
    ``,
    `We received your registration (ID ${publicCode}). It is under review.`,
    `You will get another email when it is approved or rejected.`,
    ``,
    `— ${tournamentName || DEFAULT_TOURNAMENT_NAME}`,
  ].join("\n");
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">We received your payment proof for registration <strong style="color:#fff;">${escapeHtml(publicCode)}</strong>. Admins will review it shortly.</p>
    <p style="margin:16px 0 0;font-size:14px;color:#71717a;">You will receive another email when your registration is approved or rejected.</p>
  `;
  const html = baseEmailWrapper({
    title: "Under review",
    preheader: "Your registration is being reviewed.",
    innerHtml,
  });
  await sendMail({ to, subject, text, html });
}

/** @returns {{ title: string; subject: string; textBody: string; htmlParagraphs: string; footerHtml: string }} */
function buildPlayerRegistrationStatusEmailContent({
  name,
  tournamentName,
  publicCode,
  registrationStatus,
  paymentStatus,
}) {
  const tour = tournamentName || DEFAULT_TOURNAMENT_NAME;
  const code = publicCode || "";
  const reg = registrationStatus || "pending";
  const pay = paymentStatus || "unpaid";
  const isRefunded = pay === "refunded";
  const isRejected = reg === "rejected" || isRefunded;
  const isApproved = reg === "approved" && !isRefunded;
  const isWaitlisted = reg === "waitlisted" && !isRefunded;

  const textLines = [];
  const htmlParagraphs = [];

  if (isApproved) {
    textLines.push(`Great news — registration ${code} is approved.`);
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Great news — registration <strong style="color:#4ade80;">${escapeHtml(code)}</strong> is <strong style="color:#4ade80;">approved</strong>.</p>`,
    );
  } else if (isWaitlisted) {
    textLines.push(`Registration ${code} is waitlisted. Watch your email and Discord for updates.`);
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Registration <strong style="color:#fbbf24;">${escapeHtml(code)}</strong> is <strong>waitlisted</strong>. Stay tuned for updates.</p>`,
    );
  } else if (isRejected) {
    textLines.push(`Registration ${code} was not approved for this tournament.`);
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Registration <strong style="color:#f87171;">${escapeHtml(code)}</strong> was <strong>not approved</strong> for this tournament.</p>`,
    );
  }

  if (pay === "paid" && !isRefunded) {
    textLines.push("Your payment has been confirmed.");
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Your <strong style="color:#4ade80;">payment</strong> for this registration has been confirmed.</p>`,
    );
  } else if (pay === "unpaid" && isApproved) {
    textLines.push("Payment is still pending — submit payment proof per tournament instructions.");
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Payment is still <strong>unpaid</strong>. Submit payment proof per tournament instructions.</p>`,
    );
  } else if (pay === "unpaid" && !isRejected && !isApproved && !isWaitlisted) {
    textLines.push(`Payment for registration ${code} is marked unpaid.`);
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Payment for registration <strong style="color:#fff;">${escapeHtml(code)}</strong> is marked <strong>unpaid</strong>.</p>`,
    );
  } else if (isRefunded) {
    textLines.push(`Payment for registration ${code} has been refunded.`);
    htmlParagraphs.push(
      `<p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">Payment for registration <strong style="color:#f87171;">${escapeHtml(code)}</strong> has been <strong>refunded</strong>.</p>`,
    );
  }

  let title;
  let subject;
  if (isApproved) {
    title = "Approved";
    subject = `Registration approved — ${tour}`;
  } else if (isWaitlisted) {
    title = "Waitlisted";
    subject = `Registration waitlisted — ${tour}`;
  } else if (isRejected) {
    title = "Not approved";
    subject = `Registration update — ${tour}`;
  } else if (pay === "paid") {
    title = "Payment confirmed";
    subject = `Payment confirmed — ${tour}`;
  } else if (pay === "unpaid") {
    title = "Payment update";
    subject = `Payment update — ${tour}`;
  } else {
    title = "Registration update";
    subject = `Registration update — ${tour}`;
  }

  let footerHtml = "";
  if (isApproved) {
    textLines.push("Follow Discord announcements for next steps.");
    footerHtml =
      '<p style="margin:16px 0 0;font-size:14px;color:#71717a;">Follow Discord announcements for next steps.</p>';
  } else if (isRejected) {
    textLines.push("Contact organizers on Discord if you have questions.");
    footerHtml =
      '<p style="margin:16px 0 0;font-size:14px;color:#71717a;">Contact organizers on Discord if you have questions.</p>';
  }

  const textBody = [`Hi ${name},`, "", ...textLines, "", `— ${tour}`].join("\n");
  return { title, subject, textBody, htmlParagraphs, footerHtml };
}

export async function sendPlayerRegistrationDecisionEmail({
  to,
  name,
  tournamentName,
  publicCode,
  decision,
  registrationStatus,
  paymentStatus,
}) {
  const reg = registrationStatus ?? decision ?? "pending";
  const pay = paymentStatus ?? "unpaid";
  const { title, subject, textBody, htmlParagraphs, footerHtml } = buildPlayerRegistrationStatusEmailContent({
    name,
    tournamentName,
    publicCode,
    registrationStatus: reg,
    paymentStatus: pay,
  });
  const innerHtml = `
    <p style="margin:0;font-size:15px;color:#d4d4d8;">Hi <strong style="color:#fff;">${escapeHtml(name)}</strong>,</p>
    ${htmlParagraphs.join("")}
    ${footerHtml}
  `;
  const html = baseEmailWrapper({
    title,
    preheader: subject,
    innerHtml,
  });
  await sendMail({ to, subject, text: textBody, html });
}
