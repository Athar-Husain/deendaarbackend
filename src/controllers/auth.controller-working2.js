// backend/src/controllers/auth.controller.js
import crypto from "crypto";
import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { issueTokens, verifyRefreshToken } from "../services/token.service.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOtpEmail,
} from "../services/email.service.js";
import { sendOtpSms } from "../services/sms.service.js";
import { generateOtp, otpExpiry } from "../utils/otp.js";
import { ACCOUNT_STATUS } from "../constants/index.js";
import { AUTH } from "../constants/messages.js";

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

/**
 * Build JWT payload.
 */
const buildTokenPayload = (doc, role) => ({
  id: doc._id.toString(),
  role,
});

/**
 * Attach a machine-readable error code.
 *
 * The frontend can use this code instead of depending on
 * the human-readable error message.
 */
const throwAuthError = (statusCode, code, message) => {
  const error = new ApiError(statusCode, message);
  error.code = code;
  throw error;
};

/**
 * Normalize email consistently before querying MongoDB.
 */
const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

/**
 * Normalize mobile without changing the actual number format.
 *
 * We only remove surrounding whitespace here because the mobile
 * validation layer should remain responsible for phone formatting.
 */
const normalizeMobile = (mobile) => String(mobile || "").trim();

/*
|--------------------------------------------------------------------------
| APPLICANT SIGNUP
|--------------------------------------------------------------------------
*/

/**
 * Applicant signup.
 *
 * Behavior:
 *
 * 1. No existing email/mobile:
 *    - Create account
 *    - emailVerified = false
 *    - Generate OTP
 *    - Send OTP
 *
 * 2. Existing email + email not verified:
 *    - Do NOT create another account
 *    - Generate a fresh OTP
 *    - Replace old OTP
 *    - Send OTP again
 *    - Return the existing user
 *
 * 3. Existing email + email verified:
 *    - Reject with EMAIL_EXISTS
 *
 * 4. Existing mobile belonging to another account:
 *    - Reject with MOBILE_EXISTS
 */
export const applicantSignup = asyncHandler(async (req, res) => {
  const { mobile, email, password, name, language } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  const existingEmail = await Applicant.findOne({
    email: normalizedEmail,
  });

  const existingMobile = await Applicant.findOne({
    mobile: normalizedMobile,
  });

  /*
   * ------------------------------------------------------------
   * Existing email
   * ------------------------------------------------------------
   */
  if (existingEmail) {
    /*
     * Email is already verified.
     * This is a real existing account.
     */
    if (existingEmail.emailVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    /*
     * Email exists but is still waiting for OTP verification.
     *
     * If the mobile belongs to another account, don't allow
     * the pending email account to be used with that mobile.
     */
    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    /*
     * Existing pending account.
     *
     * We deliberately do NOT overwrite:
     * - password
     * - name
     * - mobile
     * - language
     *
     * This prevents a second signup attempt from modifying
     * an existing account.
     */
    const otp = generateOtp(6);

    existingEmail.otpCode = otp;
    existingEmail.otpExpires = otpExpiry(10);

    await existingEmail.save();

    await sendOtpEmail(existingEmail.email, otp);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: existingEmail._id,
          email: existingEmail.email,
          emailVerified: false,
          requiresVerification: true,
          existingPendingAccount: true,
        },
        "An unverified account already exists. A new OTP has been sent to your email.",
      ),
    );
  }

  /*
   * ------------------------------------------------------------
   * Existing mobile
   * ------------------------------------------------------------
   */
  if (existingMobile) {
    throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
  }

  /*
   * ------------------------------------------------------------
   * New applicant
   * ------------------------------------------------------------
   */

  const otp = generateOtp(6);

  const applicant = await Applicant.create({
    mobile: normalizedMobile,
    email: normalizedEmail,
    password,
    name,
    language: language || "en",

    otpCode: otp,
    otpExpires: otpExpiry(10),

    emailVerified: false,
  });

  await sendOtpEmail(applicant.email, otp);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        id: applicant._id,
        email: applicant.email,
        emailVerified: false,
        requiresVerification: true,
        existingPendingAccount: false,
      },
      "Signup successful. Please verify the OTP sent to your email.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| APPLICANT OTP VERIFICATION
|--------------------------------------------------------------------------
*/

export const applicantVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!applicant) {
    throw new ApiError(404, "Applicant not found");
  }

  /*
   * Already verified.
   */
  if (applicant.emailVerified) {
    return res.json(
      new ApiResponse(
        200,
        {
          user: applicant.toSafeJSON(),
          role: "applicant",
          emailVerified: true,
          requiresApproval: applicant.status !== ACCOUNT_STATUS.APPROVED,
        },
        "Email is already verified.",
      ),
    );
  }

  /*
   * OTP validation.
   */
  const otpExpired = !applicant.otpExpires || applicant.otpExpires < new Date();

  const otpInvalid = !applicant.otpCode || applicant.otpCode !== otp;

  if (otpInvalid || otpExpired) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * Mark email verified.
   */
  applicant.emailVerified = true;

  /*
   * OTP must never remain usable after successful verification.
   */
  applicant.otpCode = undefined;
  applicant.otpExpires = undefined;

  await applicant.save();

  /*
   * IMPORTANT:
   *
   * We do NOT issue login tokens here.
   *
   * Email verification and admin approval are separate steps.
   */
  return res.json(
    new ApiResponse(
      200,
      {
        user: applicant.toSafeJSON(),
        role: "applicant",
        emailVerified: true,
        requiresApproval: applicant.status !== ACCOUNT_STATUS.APPROVED,
      },
      "Email verified successfully. Your account is pending admin approval.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| APPLICANT RESEND OTP
|--------------------------------------------------------------------------
*/

export const applicantResendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!applicant) {
    throw new ApiError(404, "Applicant not found");
  }

  if (applicant.emailVerified) {
    throwAuthError(400, "EMAIL_ALREADY_VERIFIED", "Email already verified");
  }

  const otp = generateOtp(6);

  applicant.otpCode = otp;
  applicant.otpExpires = otpExpiry(10);

  await applicant.save();

  await sendOtpEmail(applicant.email, otp);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "OTP resent successfully",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| LEGACY APPLICANT EMAIL TOKEN VERIFICATION
|--------------------------------------------------------------------------
|
| Kept because the project already contains this endpoint.
|
*/

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const applicant = await Applicant.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: {
      $gt: new Date(),
    },
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!applicant) {
    throw new ApiError(400, "Invalid or expired verification token");
  }

  applicant.emailVerified = true;

  applicant.emailVerificationToken = undefined;
  applicant.emailVerificationExpires = undefined;

  applicant.otpCode = undefined;
  applicant.otpExpires = undefined;

  await applicant.save();

  return res.json(
    new ApiResponse(
      200,
      {
        emailVerified: true,
      },
      "Email verified successfully",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| APPLICANT LOGIN
|--------------------------------------------------------------------------
*/

export const applicantLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!applicant) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  const passwordValid = await applicant.comparePassword(password);

  if (!passwordValid) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  /*
   * ------------------------------------------------------------
   * Email verification comes before approval.
   * ------------------------------------------------------------
   */
  if (!applicant.emailVerified) {
    throwAuthError(403, "EMAIL_NOT_VERIFIED", AUTH.EMAIL_NOT_VERIFIED);
  }

  /*
   * ------------------------------------------------------------
   * Blocked account
   * ------------------------------------------------------------
   */
  if (applicant.blocked) {
    throwAuthError(403, "ACCOUNT_BLOCKED", "Your account has been blocked.");
  }

  /*
   * ------------------------------------------------------------
   * Suspended account
   * ------------------------------------------------------------
   */
  if (applicant.suspended) {
    throwAuthError(
      403,
      "ACCOUNT_SUSPENDED",
      "Your account has been suspended.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Admin approval
   * ------------------------------------------------------------
   */
  if (applicant.status !== ACCOUNT_STATUS.APPROVED) {
    throwAuthError(
      403,
      "ACCOUNT_PENDING_APPROVAL",
      "Your account is pending admin approval.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Fully approved applicant
   * ------------------------------------------------------------
   */
  const tokens = issueTokens(buildTokenPayload(applicant, "applicant"));

  return res.json(
    new ApiResponse(
      200,
      {
        user: applicant.toSafeJSON(),
        role: "applicant",
        ...tokens,
      },
      "Login successful",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION SIGNUP
|--------------------------------------------------------------------------
*/

/**
 * Organization signup is also idempotent.
 *
 * Organization OTP is sent through SMS.
 */
export const orgSignupold = asyncHandler(async (req, res) => {
  const { name, type, mobile, email, password, language } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  const existingEmail = await Organization.findOne({
    email: normalizedEmail,
  });

  const existingMobile = await Organization.findOne({
    mobile: normalizedMobile,
  });

  /*
   * ------------------------------------------------------------
   * Existing email
   * ------------------------------------------------------------
   */
  if (existingEmail) {
    /*
     * Fully verified organization.
     */
    if (existingEmail.otpVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    /*
     * The mobile cannot belong to a different organization.
     */
    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    /*
     * Existing organization is still waiting for OTP.
     *
     * Do not overwrite its existing profile/password.
     */
    const otp = generateOtp(6);

    existingEmail.otpCode = otp;
    existingEmail.otpExpires = otpExpiry(10);

    await existingEmail.save();

    await sendOtpEmail(existingEmail.mobile, otp);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: existingEmail._id,
          email: existingEmail.email,
          otpVerified: false,
          requiresVerification: true,
          existingPendingAccount: true,
        },
        "An unverified organization already exists. A new OTP has been sent.",
      ),
    );
  }

  /*
   * ------------------------------------------------------------
   * Existing mobile
   * ------------------------------------------------------------
   */
  if (existingMobile) {
    throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
  }

  /*
   * ------------------------------------------------------------
   * New organization
   * ------------------------------------------------------------
   */

  const otp = generateOtp(6);

  const org = await Organization.create({
    name,
    type,
    mobile: normalizedMobile,
    email: normalizedEmail,
    password,
    language: language || "en",

    otpCode: otp,
    otpExpires: otpExpiry(10),

    otpVerified: false,
  });

  await sendOtpSms(org.mobile, otp);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        id: org._id,
        email: org.email,
        otpVerified: false,
        requiresVerification: true,
        existingPendingAccount: false,
      },
      "Signup successful. Please verify the OTP sent to your mobile.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION SIGNUP
|--------------------------------------------------------------------------
*/

export const orgSignup = asyncHandler(async (req, res) => {
  const {
    name,
    type,
    country,
    state,
    city,
    pincode,
    mobile,
    email,
    password,
    language,
  } = req.body;

  // console.log("req body in orgSignup", req.body)
  console.log("req body in orgSignup", req.body);

  /*
   * ------------------------------------------------------------
   * Normalize values
   * ------------------------------------------------------------
   */

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedType = typeof type === "string" ? type.trim() : "";
  const trimmedCountry = typeof country === "string" ? country.trim() : "";
  const trimmedState = typeof state === "string" ? state.trim() : "";
  const trimmedCity = typeof city === "string" ? city.trim() : "";
  const trimmedPincode = typeof pincode === "string" ? pincode.trim() : "";

  /*
   * ------------------------------------------------------------
   * Basic validation
   * ------------------------------------------------------------
   */

  if (!trimmedName) {
    throw new ApiError(400, "Organization name is required");
  }

  if (!trimmedType) {
    throw new ApiError(400, "Organization type is required");
  }

  if (!trimmedState) {
    throw new ApiError(400, "State is required");
  }

  if (!trimmedCity) {
    throw new ApiError(400, "City is required");
  }

  if (!trimmedPincode) {
    throw new ApiError(400, "Pincode is required");
  }

  /*
   * ------------------------------------------------------------
   * Find existing accounts
   * ------------------------------------------------------------
   */

  const existingEmail = await Organization.findOne({
    email: normalizedEmail,
  });

  const existingMobile = await Organization.findOne({
    mobile: normalizedMobile,
  });

  /*
   * ------------------------------------------------------------
   * Existing email
   * ------------------------------------------------------------
   */

  if (existingEmail) {
    /*
     * Fully verified organization.
     */
    if (existingEmail.otpVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    /*
     * The mobile cannot belong to a different organization.
     */
    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    /*
     * Existing organization is still waiting for OTP.
     *
     * IMPORTANT:
     * Do not overwrite the existing profile/password.
     *
     * We only generate a fresh OTP and resend it.
     */

    const otp = generateOtp(6);

    existingEmail.otpCode = otp;
    existingEmail.otpExpires = otpExpiry(10);

    await existingEmail.save();

    /*
     * OTP is sent to EMAIL.
     *
     * The old code incorrectly used:
     *
     * sendOtpEmail(existingEmail.mobile, otp)
     *
     * which passed a mobile number to an email function.
     */

    await sendOtpEmail(existingEmail.email, otp);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: existingEmail._id,
          email: existingEmail.email,
          otpVerified: false,
          requiresVerification: true,
          existingPendingAccount: true,
        },
        "An unverified organization already exists. A new OTP has been sent to your email.",
      ),
    );
  }

  /*
   * ------------------------------------------------------------
   * Existing mobile
   * ------------------------------------------------------------
   */

  if (existingMobile) {
    throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
  }

  /*
   * ------------------------------------------------------------
   * New organization
   * ------------------------------------------------------------
   */

  const otp = generateOtp(6);

  const org = await Organization.create({
    name: trimmedName,

    /*
     * Organization type
     *
     * Example:
     * "masjid"
     * "ngo"
     * "school"
     */
    type: trimmedType,

    /*
     * Location
     *
     * Frontend sends:
     *
     * country: "India"
     * state: "Uttar Pradesh"
     * city: "Lucknow"
     * pincode: "226001"
     */
    country: trimmedCountry,
    state: trimmedState,
    city: trimmedCity,
    pincode: trimmedPincode,

    /*
     * Contact
     */
    mobile: normalizedMobile,
    email: normalizedEmail,

    /*
     * Authentication
     *
     * Your Organization model should hash the password
     * using its pre-save hook if that is how your current
     * model is implemented.
     */
    password,

    language: language || "en",

    /*
     * OTP
     */
    otpCode: otp,
    otpExpires: otpExpiry(10),

    otpVerified: false,
  });

  /*
   * ------------------------------------------------------------
   * Send OTP
   * ------------------------------------------------------------
   *
   * Frontend currently tells the user:
   * "We'll send a 6-digit OTP to your email."
   *
   * Therefore use email here.
   */

  await sendOtpEmail(org.email, otp);

  /*
   * ------------------------------------------------------------
   * Response
   * ------------------------------------------------------------
   */

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        id: org._id,
        email: org.email,
        otpVerified: false,
        requiresVerification: true,
        existingPendingAccount: false,
      },
      "Signup successful. Please verify the OTP sent to your email.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION OTP VERIFICATION
|--------------------------------------------------------------------------
*/

export const orgVerifyOtpold = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const org = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  /*
   * Already verified.
   */
  if (org.otpVerified) {
    return res.json(
      new ApiResponse(
        200,
        {
          user: org.toSafeJSON(),
          role: "organization",
          otpVerified: true,
          requiresApproval: org.status !== ACCOUNT_STATUS.APPROVED,
        },
        "OTP is already verified.",
      ),
    );
  }

  /*
   * OTP validation.
   */
  const otpExpired = !org.otpExpires || org.otpExpires < new Date();

  const otpInvalid = !org.otpCode || org.otpCode !== otp;

  if (otpInvalid || otpExpired) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * Mark OTP as verified.
   */
  org.otpVerified = true;

  /*
   * OTP cannot be reused.
   */
  org.otpCode = undefined;
  org.otpExpires = undefined;

  await org.save();

  /*
   * Do not issue tokens here.
   *
   * Organization still needs admin approval.
   */
  return res.json(
    new ApiResponse(
      200,
      {
        user: org.toSafeJSON(),
        role: "organization",
        otpVerified: true,
        requiresApproval: org.status !== ACCOUNT_STATUS.APPROVED,
      },
      "OTP verified successfully. Your organization is pending admin approval.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION OTP VERIFICATION
|--------------------------------------------------------------------------
*/

export const orgVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const org = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  /*
   * ------------------------------------------------------------
   * Organization not found
   * ------------------------------------------------------------
   */

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  /*
   * ------------------------------------------------------------
   * Already verified
   * ------------------------------------------------------------
   */

  if (org.otpVerified) {
    return res.json(
      new ApiResponse(
        200,
        {
          user: org.toSafeJSON(),
          role: "organization",
          otpVerified: true,
          requiresApproval: org.status !== ACCOUNT_STATUS.APPROVED,
        },
        "OTP is already verified.",
      ),
    );
  }

  /*
   * ------------------------------------------------------------
   * OTP validation
   * ------------------------------------------------------------
   */

  const otpExpired = !org.otpExpires || org.otpExpires < new Date();

  const otpInvalid = !org.otpCode || org.otpCode !== otp;

  if (otpInvalid || otpExpired) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * ------------------------------------------------------------
   * Mark OTP as verified
   * ------------------------------------------------------------
   */

  org.otpVerified = true;

  /*
   * OTP cannot be reused.
   */

  org.otpCode = undefined;
  org.otpExpires = undefined;

  await org.save();

  /*
   * ------------------------------------------------------------
   * Do not issue tokens here.
   *
   * Organization still needs admin approval.
   * ------------------------------------------------------------
   */

  return res.json(
    new ApiResponse(
      200,
      {
        user: org.toSafeJSON(),
        role: "organization",
        otpVerified: true,
        requiresApproval: org.status !== ACCOUNT_STATUS.APPROVED,
      },
      "OTP verified successfully. Your organization is pending admin approval.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION RESEND OTP
|--------------------------------------------------------------------------
*/

export const orgResendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const org = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  if (org.otpVerified) {
    throwAuthError(400, "OTP_ALREADY_VERIFIED", "OTP already verified");
  }

  const otp = generateOtp(6);

  org.otpCode = otp;
  org.otpExpires = otpExpiry(10);

  await org.save();

  await sendOtpSms(org.mobile, otp);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "OTP resent successfully",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION LOGIN
|--------------------------------------------------------------------------
*/

export const orgLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const org = await Organization.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!org) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  const passwordValid = await org.comparePassword(password);

  if (!passwordValid) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  /*
   * ------------------------------------------------------------
   * OTP verification comes before approval.
   * ------------------------------------------------------------
   */
  if (!org.otpVerified) {
    throwAuthError(403, "EMAIL_NOT_VERIFIED", "Please verify your OTP first.");
  }

  /*
   * ------------------------------------------------------------
   * Blocked account
   * ------------------------------------------------------------
   */
  if (org.blocked) {
    throwAuthError(
      403,
      "ACCOUNT_BLOCKED",
      "Your organization account has been blocked.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Suspended account
   * ------------------------------------------------------------
   */
  if (org.suspended) {
    throwAuthError(
      403,
      "ACCOUNT_SUSPENDED",
      "Your organization account has been suspended.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Admin approval
   * ------------------------------------------------------------
   */
  if (org.status !== ACCOUNT_STATUS.APPROVED) {
    throwAuthError(
      403,
      "ACCOUNT_PENDING_APPROVAL",
      "Your organization account is pending admin approval.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Fully approved organization
   * ------------------------------------------------------------
   */
  const tokens = issueTokens(buildTokenPayload(org, "organization"));

  return res.json(
    new ApiResponse(
      200,
      {
        user: org.toSafeJSON(),
        role: "organization",
        ...tokens,
      },
      "Login successful",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = normalizeEmail(email);

  let user = await Applicant.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    user = await Organization.findOne({
      email: normalizedEmail,
    });
  }

  /*
   * Always return the same public response whether the
   * email exists or not.
   */
  if (!user) {
    return res.json(
      new ApiResponse(
        200,
        null,
        "If the email exists, a reset link has been sent",
      ),
    );
  }

  const token = crypto.randomBytes(32).toString("hex");

  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);

  await user.save({
    validateBeforeSave: false,
  });

  await sendPasswordResetEmail(normalizedEmail, token);

  return res.json(
    new ApiResponse(
      200,
      null,
      "If the email exists, a reset link has been sent",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
*/

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let user = await Applicant.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: {
      $gt: new Date(),
    },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    user = await Organization.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {
        $gt: new Date(),
      },
    }).select("+resetPasswordToken +resetPasswordExpires");
  }

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  user.password = password;

  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  return res.json(new ApiResponse(200, null, "Password reset successful"));
});

/*
|--------------------------------------------------------------------------
| REFRESH TOKEN
|--------------------------------------------------------------------------
*/

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, AUTH.TOKEN_EXPIRED);
  }

  const tokens = issueTokens({
    id: decoded.id,
    role: decoded.role,
  });

  return res.json(new ApiResponse(200, tokens, "Token refreshed"));
});

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

export const me = asyncHandler(async (req, res) => {
  return res.json(
    new ApiResponse(
      200,
      {
        user: req.user.toSafeJSON(),
        role: req.role,
      },
      "Profile fetched",
    ),
  );
});
