// backend/src/controllers/auth.controller.js

import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";

import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

import { issueTokens, verifyRefreshToken } from "../services/token.service.js";

import { sendOtpEmail } from "../services/email.service.js";

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
 * Frontend should use this code instead of depending on
 * human-readable error messages.
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
 * Normalize mobile.
 *
 * Phone formatting should still be handled by the validation layer.
 */
const normalizeMobile = (mobile) => String(mobile || "").trim();

/**
 * Trim a string safely.
 */
const trimString = (value) => (typeof value === "string" ? value.trim() : "");

/*
|--------------------------------------------------------------------------
| APPLICANT SIGNUP
|--------------------------------------------------------------------------
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
     *
     * This is a real existing account.
     */
    if (existingEmail.emailVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    /*
     * Email exists but is still waiting for OTP verification.
     *
     * Do not allow the mobile to belong to another applicant.
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
     * Do NOT overwrite:
     * - password
     * - name
     * - mobile
     * - language
     *
     * Only generate and send a fresh OTP.
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

  const otpInvalid =
    !applicant.otpCode || applicant.otpCode !== String(otp).trim();

  if (otpInvalid || otpExpired) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * Mark email verified.
   */
  applicant.emailVerified = true;

  /*
   * OTP cannot be reused.
   */
  applicant.otpCode = undefined;
  applicant.otpExpires = undefined;

  await applicant.save();

  /*
   * Do not issue tokens here.
   *
   * Email verification and admin approval
   * are separate steps.
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
| Kept for backwards compatibility if an old client still calls it.
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

export const applicantLoginold = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log("applicantLogin req.body", req.body);

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
    const otp = generateOtp(6);

    existingEmail.otpCode = otp;
    existingEmail.otpExpires = otpExpiry(10);

    await existingEmail.save();

    await sendOtpEmail(existingEmail.email, otp);
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
   * Email verification
   * ------------------------------------------------------------
   *
   * If email is not verified:
   * 1. Generate a new OTP
   * 2. Store OTP + expiry
   * 3. Send OTP to applicant email
   * 4. Stop login with EMAIL_NOT_VERIFIED
   * ------------------------------------------------------------
   */

  if (!applicant.emailVerified) {
    const otp = generateOtp(6);

    applicant.otpCode = otp;
    applicant.otpExpires = otpExpiry(10);

    await applicant.save();

    await sendOtpEmail(applicant.email, otp);

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
|
| Organization signup uses EMAIL OTP.
|
| IMPORTANT:
| Organization type is intentionally NOT checked against a
| static ORG_TYPES constant.
|
| The admin panel controls the available organization types.
|
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

  console.log("req body in orgSignup", req.body);

  /*
   * ------------------------------------------------------------
   * Normalize values
   * ------------------------------------------------------------
   */

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  const trimmedName = trimString(name);
  const trimmedType = trimString(type);
  const trimmedCountry = trimString(country);
  const trimmedState = trimString(state);
  const trimmedCity = trimString(city);
  const trimmedPincode = trimString(pincode);

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

  if (!trimmedCountry) {
    throw new ApiError(400, "Country is required");
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
     * Mobile cannot belong to another organization.
     */
    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    /*
     * Existing pending organization.
     *
     * Do not overwrite the existing profile/password.
     *
     * Only issue and send a new email OTP.
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

  /*
   * IMPORTANT:
   *
   * Your Organization model currently defines location as:
   *
   * address: {
   *   country,
   *   state,
   *   district,
   *   city,
   *   fullAddress,
   *   pincode
   * }
   *
   * Therefore country/state/city/pincode must be stored
   * inside `address`.
   *
   * Putting them directly on the organization document would
   * be ignored by Mongoose strict mode.
   */

  const org = await Organization.create({
    name: trimmedName,

    /*
     * Dynamic organization type.
     *
     * No static ORG_TYPES enum here.
     * The value comes from the admin-managed organization
     * type configuration.
     */
    type: trimmedType,

    /*
     * Location.
     */
    address: {
      country: trimmedCountry,
      state: trimmedState,
      city: trimmedCity,
      pincode: trimmedPincode,

      /*
       * Existing Organization model fields.
       */
      district: "",
      fullAddress: "",
    },

    /*
     * Contact.
     */
    mobile: normalizedMobile,
    email: normalizedEmail,

    /*
     * Authentication.
     *
     * Organization.model.js hashes this password
     * using the pre-save hook.
     */
    password,

    language: language || "en",

    /*
     * Email OTP.
     */
    otpCode: otp,
    otpExpires: otpExpiry(10),

    otpVerified: false,
  });

  /*
   * ------------------------------------------------------------
   * Send email OTP
   * ------------------------------------------------------------
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

  const otpInvalid = !org.otpCode || org.otpCode !== String(otp).trim();

  if (otpInvalid || otpExpired) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * ------------------------------------------------------------
   * Mark email verified
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
   * Do not issue tokens.
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
|
| EMAIL ONLY
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

  /*
   * IMPORTANT:
   *
   * Organization OTP is now always sent by EMAIL.
   *
   * Do NOT use sendOtpSms here.
   */
  await sendOtpEmail(org.email, otp);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "OTP resent successfully to your email",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION LOGIN
|--------------------------------------------------------------------------
*/

export const orgLoginold = asyncHandler(async (req, res) => {
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
   * Email verification comes before approval.
   * ------------------------------------------------------------
   */

  if (!org.otpVerified) {
    throwAuthError(
      403,
      "EMAIL_NOT_VERIFIED",
      AUTH.EMAIL_NOT_VERIFIED || "Please verify your email OTP first.",
    );
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
   * Email verification
   * ------------------------------------------------------------
   *
   * If email is not verified:
   * 1. Generate a new OTP
   * 2. Store OTP + expiry
   * 3. Send OTP to organization email
   * 4. Stop login with EMAIL_NOT_VERIFIED
   * ------------------------------------------------------------
   */

  if (!org.otpVerified) {
    const otp = generateOtp(6);

    org.otpCode = otp;
    org.otpExpires = otpExpiry(10);

    await org.save();

    await sendOtpEmail(org.email, otp);

    throwAuthError(
      403,
      "EMAIL_NOT_VERIFIED",
      AUTH.EMAIL_NOT_VERIFIED || "Please verify your email OTP first.",
    );
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
|
| Email OTP only.
|
| Flow:
|
| 1. User enters email.
| 2. Backend finds Applicant or Organization.
| 3. Backend generates 6-digit OTP.
| 4. OTP is stored in otpCode/otpExpires.
| 5. OTP is sent to email.
| 6. Frontend opens reset-password screen.
|
| We intentionally do NOT use resetPasswordToken anymore.
|--------------------------------------------------------------------------
*/

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = normalizeEmail(email);

  let user = await Applicant.findOne({
    email: normalizedEmail,
  });

  let role = "applicant";

  if (!user) {
    user = await Organization.findOne({
      email: normalizedEmail,
    });

    role = "organization";
  }

  /*
   * Do not reveal whether an email exists.
   */
  if (!user) {
    return res.json(
      new ApiResponse(
        200,
        null,
        "If the email exists, a password reset OTP has been sent.",
      ),
    );
  }

  /*
   * Generate password reset OTP.
   *
   * We reuse the same OTP fields used for email verification.
   */
  const otp = generateOtp(6);

  user.otpCode = otp;
  user.otpExpires = otpExpiry(10);

  await user.save();

  /*
   * Send OTP to email.
   */
  await sendOtpEmail(user.email, otp);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
        role,
        email: user.email,
      },
      "If the email exists, a password reset OTP has been sent.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
|
| Email OTP only.
|
| Request:
|
| {
|   email: "user@example.com",
|   otp: "123456",
|   password: "newPassword"
| }
|
|--------------------------------------------------------------------------
*/

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otp || "").trim();

  /*
   * ------------------------------------------------------------
   * Find user
   * ------------------------------------------------------------
   */

  let user = await Applicant.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!user) {
    user = await Organization.findOne({
      email: normalizedEmail,
    }).select("+otpCode +otpExpires");
  }

  if (!user) {
    throwAuthError(
      400,
      "OTP_INVALID",
      AUTH.OTP_INVALID || "Invalid or expired OTP.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Validate OTP
   * ------------------------------------------------------------
   */

  const otpExpired = !user.otpExpires || user.otpExpires < new Date();

  const otpInvalid = !user.otpCode || user.otpCode !== normalizedOtp;

  if (otpInvalid || otpExpired) {
    throwAuthError(
      400,
      "OTP_INVALID",
      AUTH.OTP_INVALID || "Invalid or expired OTP.",
    );
  }

  /*
   * ------------------------------------------------------------
   * Update password
   * ------------------------------------------------------------
   *
   * We intentionally let the model pre-save hook hash
   * the password.
   * ------------------------------------------------------------
   */

  user.password = password;

  /*
   * OTP becomes invalid immediately after successful reset.
   */
  user.otpCode = undefined;
  user.otpExpires = undefined;

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
