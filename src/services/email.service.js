import nodemailer from "nodemailer";
import { smtp } from "../config/env.js";
import logger from "../utils/logger.js";

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!smtp.host || !smtp.user || !smtp.pass) {
    logger.warn("SMTP not configured - email sending disabled");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  if (!transporter) {
    logger.warn(`Email skipped (no SMTP). To=${to} Subject=${subject}`);
    return null;
  }

  const info = await transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    html,
    text,
  });

  logger.info(`Email sent to ${to}: ${info.messageId}`);

  return info;
};

const sendVerificationEmail = async (to, token) => {
  const subject = "Verify your DEENDAAR account";
  const link = `deendaar://verify-email?token=${token}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Welcome to DEENDAAR</h2>
      <p>Please verify your email address to activate your account.</p>
      <p>
        <a href="${link}" style="background:#0d6e6e;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px">
          Verify Email
        </a>
      </p>
      <p>Verification token: <b>${token}</b></p>
      <p>If you did not register, please ignore this email.</p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Verify your DEENDAAR account. Token: ${token}`,
  });
};

const sendPasswordResetEmail = async (to, token) => {
  const subject = "DEENDAAR password reset";
  const link = `deendaar://reset-password?token=${token}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Password Reset</h2>
      <p>Use the link below to reset your password. This link expires in 30 minutes.</p>
      <p>
        <a href="${link}" style="background:#0d6e6e;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px">
          Reset Password
        </a>
      </p>
      <p>Reset token: <b>${token}</b></p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Reset your password. Token: ${token}`,
  });
};

const sendAccountStatusEmail = async (to, status, note = "") => {
  const subject = `DEENDAAR account ${status}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Account Status Update</h2>
      <p>Your account status is now: <b>${status}</b></p>
      ${note ? `<p>Note: ${note}</p>` : ""}
    </div>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Your account status: ${status}. ${note}`,
  });
};

export {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountStatusEmail,
};
