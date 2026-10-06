// backend/src/services/email.service.js

import nodemailer from "nodemailer";

import { smtp, nodeEnv } from "../config/env.js";
import logger from "../utils/logger.js";

let transporter = null;

/*
|--------------------------------------------------------------------------
| SMTP TRANSPORTER
|--------------------------------------------------------------------------
*/

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

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

/*
|--------------------------------------------------------------------------
| SEND MAIL
|--------------------------------------------------------------------------
|
| DEVELOPMENT:
|   Do NOT send email.
|   Log recipient + subject + content to terminal.
|
| PRODUCTION:
|   Send through SMTP.
|--------------------------------------------------------------------------
*/

const sendMail = async ({ to, subject, html, text }) => {
  /*
  |--------------------------------------------------------------------------
  | DEVELOPMENT MODE
  |--------------------------------------------------------------------------
  */

  if (nodeEnv != 'production') {
    logger.info(
      [
        "",
        "==================== DEV EMAIL ====================",
        `To: ${to}`,
        `Subject: ${subject}`,
        "",
        text || "No text content",
        "====================================================",
        "",
      ].join("\n"),
    );

    return {
      development: true,
      messageId: "development-email",
      accepted: [to],
    };
  }

  /*
  |--------------------------------------------------------------------------
  | PRODUCTION MODE
  |--------------------------------------------------------------------------
  */

  const transporter = getTransporter();

  if (!transporter) {
    logger.error(
      `Production email could not be sent because SMTP is not configured. To=${to} Subject=${subject}`,
    );

    throw new Error("Email service is not configured.");
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

/*
|--------------------------------------------------------------------------
| OTP EMAIL
|--------------------------------------------------------------------------
*/

const sendOtpEmail = async (to, otp) => {
  const subject = "DEENDAAR - Email Verification OTP";

  const html = `
    <div
      style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 24px;
        color: #1f2937;
        background: #ffffff;
      "
    >
      <div
        style="
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 28px;
          background: #ffffff;
        "
      >
        <h2
          style="
            margin: 0 0 12px;
            color: #0d6e6e;
            font-size: 24px;
          "
        >
          Verify your DEENDAAR account
        </h2>

        <p
          style="
            margin: 0 0 20px;
            color: #4b5563;
            font-size: 15px;
            line-height: 1.6;
          "
        >
          Use the verification code below to verify your email address.
        </p>

        <div
          style="
            margin: 24px 0;
            padding: 20px;
            text-align: center;
            background: #f5f7fa;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
          "
        >
          <div
            style="
              font-size: 32px;
              line-height: 1.2;
              font-weight: 700;
              letter-spacing: 8px;
              color: #0d6e6e;
            "
          >
            ${otp}
          </div>
        </div>

        <p
          style="
            margin: 0 0 12px;
            color: #374151;
            font-size: 14px;
          "
        >
          This OTP is valid for
          <strong>10 minutes</strong>.
        </p>

        <p
          style="
            margin: 0;
            color: #6b7280;
            font-size: 13px;
            line-height: 1.6;
          "
        >
          If you did not create a DEENDAAR account, you can safely ignore
          this email.
        </p>
      </div>

      <p
        style="
          margin: 20px 0 0;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        "
      >
        © DEENDAAR
      </p>
    </div>
  `;

  const text = [
    "Verify your DEENDAAR account",
    "",
    `Your email verification OTP is: ${otp}`,
    "",
    "This OTP is valid for 10 minutes.",
    "",
    "If you did not create a DEENDAAR account, you can safely ignore this email.",
  ].join("\n");

  /*
  |--------------------------------------------------------------------------
  | DEVELOPMENT
  |--------------------------------------------------------------------------
  |
  | sendMail() handles the development logging.
  | No actual email is sent.
  |--------------------------------------------------------------------------
  */

  return sendMail({
    to,
    subject,
    html,
    text,
  });
};

/*
|--------------------------------------------------------------------------
| LEGACY VERIFICATION EMAIL
|--------------------------------------------------------------------------
*/

const sendVerificationEmail = async (to, token) => {
  const subject = "Verify your DEENDAAR account";
  const link = `deendaar://verify-email?token=${token}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Welcome to DEENDAAR</h2>

      <p>
        Please verify your email address to activate your account.
      </p>

      <p>
        <a
          href="${link}"
          style="
            background:#0d6e6e;
            color:#fff;
            padding:10px 18px;
            text-decoration:none;
            border-radius:6px;
            display:inline-block;
          "
        >
          Verify Email
        </a>
      </p>

      <p>
        Verification token: <b>${token}</b>
      </p>

      <p>
        If you did not register, please ignore this email.
      </p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Verify your DEENDAAR account. Token: ${token}`,
  });
};

/*
|--------------------------------------------------------------------------
| PASSWORD RESET EMAIL
|--------------------------------------------------------------------------
*/

const sendPasswordResetEmail = async (to, token) => {
  const subject = "DEENDAAR password reset";
  const link = `deendaar://reset-password?token=${token}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Password Reset</h2>

      <p>
        Use the link below to reset your password.
        This link expires in 30 minutes.
      </p>

      <p>
        <a
          href="${link}"
          style="
            background:#0d6e6e;
            color:#fff;
            padding:10px 18px;
            text-decoration:none;
            border-radius:6px;
            display:inline-block;
          "
        >
          Reset Password
        </a>
      </p>

      <p>
        Reset token: <b>${token}</b>
      </p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Reset your password. Token: ${token}`,
  });
};

/*
|--------------------------------------------------------------------------
| ACCOUNT STATUS EMAIL
|--------------------------------------------------------------------------
*/

const sendAccountStatusEmail = async (to, status, note = "") => {
  const subject = `DEENDAAR account ${status}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Account Status Update</h2>

      <p>
        Your account status is now:
        <b>${status}</b>
      </p>

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
  sendOtpEmail,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountStatusEmail,
};
