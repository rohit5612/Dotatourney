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

/**
 * @param {{ to: string; registerUrl: string; expiresAt: string }} params
 */
export async function sendAdminInviteEmail({ to, registerUrl, expiresAt }) {
  if (env.emailSkipSend) {
    console.warn("[email] EMAIL_SKIP_SEND is set; not sending invite email");
    return;
  }

  const transport = getTransporter();
  const expiresDate = new Date(expiresAt);
  const expiresUtc = expiresDate.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  const hours = env.adminInviteExpiryHours;
  const hoursLabel = hours === 1 ? "1 hour" : `${hours} hours`;
  const prefix = env.emailSubjectPrefix ? `${env.emailSubjectPrefix} ` : "";
  const subject = `${prefix}Admin invitation`.trim();
  const from = env.emailFrom || env.emailUser;

  const text = [
    `You have been invited to register as an admin.`,
    ``,
    `Open this link to complete registration (valid until ${expiresUtc} — about ${hoursLabel} from when it was sent):`,
    registerUrl,
    ``,
    `If you did not expect this message, you can ignore it.`,
  ].join("\n");

  const html = `
    <p>You have been invited to register as an admin.</p>
    <p><a href="${registerUrl}">Complete your registration</a></p>
    <p style="color:#555;font-size:14px">This link expires at <strong>${expiresUtc}</strong> (about ${hoursLabel} from when the invite was sent).</p>
    <p style="color:#555;font-size:14px">If you did not expect this message, you can ignore it.</p>
  `;

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
