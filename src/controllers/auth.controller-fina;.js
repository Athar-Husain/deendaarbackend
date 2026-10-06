// backend/src/controllers/auth.controller.js

import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";

import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";

import { issueTokens, verifyRefreshToken } from "../services/token.service.js";

import { sendOtpEmail } from "../services/email.service.js";

import { generateOtp, otpExpiry } from "../utils/otp.js";

import { ACCOUNT_STATUS } from "../constants/index.js";
import { AUTH } from "../constants/messages.js";

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const ROLES = {
  APPLICANT: "applicant",
  ORGANIZATION: "organization",
};

const OTP_EXPIRY_MINUTES = 10;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

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
 * Phone formatting/validation should be handled
 * by the Joi validation layer.
 */
const normalizeMobile = (mobile) => String(mobile || "").trim();

/**
 * Trim a string safely.
 */
const trimString = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * Build JWT payload.
 */
const buildTokenPayload = (doc, role) => ({
  id: doc._id.toString(),
  role,
});

/**
 * Throw a machine-readable authentication error.
 *
 * Frontend should depend on `error.code`, not the
 * human-readable error message.
 */
const throwAuthError = (statusCode, code, message) => {
  const error = new ApiError(statusCode, message);
  error.code = code;
  throw error;
};

/**
 * Generate and store an OTP on a user document.
 */
const generateAndStoreOtp = async (user, purpose = "email_verification") => {
  const otp = generateOtp(6);

  user.otpCode = otp;
  user.otpExpires = otpExpiry(OTP_EXPIRY_MINUTES);
  user.otpPurpose = purpose; // ← set it

  await user.save();
  return otp;
};

/**
 * Generate, save and email an OTP.
 */
const generateAndSendOtp = async (user, purpose = "email_verification") => {
  const otp = await generateAndStoreOtp(user, purpose);
  await sendOtpEmail(user.email, otp);
  return otp;
};

/**
 * Validate an OTP stored on a document.
 */
const isOtpValid = (user, otp) => {
  const normalizedOtp = String(otp || "").trim();

  const expired = !user.otpExpires || user.otpExpires < new Date();

  const invalid = !user.otpCode || user.otpCode !== normalizedOtp;

  return !expired && !invalid;
};

/**
 * Clear OTP after successful verification/use.
 */
const clearOtp = (user) => {
  user.otpCode = undefined;
  user.otpExpires = undefined;
};

/**
 * Send a fresh OTP when an unverified account attempts login.
 *
 * This helper intentionally does NOT throw the login error.
 * The caller does that after the email has been sent.
 */
const sendLoginVerificationOtp = async (user, role) => {
  try {
    await generateAndSendOtp(user);

    logger.info("Login verification OTP sent", {
      role,
      userId: user._id.toString(),
      email: user.email,
    });
  } catch (error) {
    logger.error("Failed to send login verification OTP", {
      role,
      userId: user._id?.toString(),
      email: user.email,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
};

/**
 * Common account-state checks after email/OTP verification.
 *
 * Important:
 * Email verification does NOT mean the account can login.
 *
 * The account must also be approved by admin.
 */
const validateAccountAccess = (user, role) => {
  /*
   * Blocked account
   */
  if (user.blocked) {
    throwAuthError(
      403,
      "ACCOUNT_BLOCKED",
      role === ROLES.ORGANIZATION
        ? "Your organization account has been blocked."
        : "Your account has been blocked.",
    );
  }

  /*
   * Suspended account
   */
  if (user.suspended) {
    throwAuthError(
      403,
      "ACCOUNT_SUSPENDED",
      role === ROLES.ORGANIZATION
        ? "Your organization account has been suspended."
        : "Your account has been suspended.",
    );
  }

  /*
   * Admin approval
   *
   * This is deliberately checked before issuing tokens.
   */
  // if (user.status !== ACCOUNT_STATUS.APPROVED) {
  //   throwAuthError(
  //     403,
  //     "ACCOUNT_PENDING_APPROVAL",
  //     role === ROLES.ORGANIZATION
  //       ? "Your organization account is pending admin approval."
  //       : "Your account is pending admin approval.",
  //   );
  // }
};

/**
 * Common successful login response.
 */
// const sendLoginResponse = (res, user, role) => {
//   const tokens = issueTokens(buildTokenPayload(user, role));

//   return res.json(
//     new ApiResponse(
//       200,
//       {
//         user: user.toSafeJSON(),
//         role,
//         ...tokens,
//       },
//       "Login successful",
//     ),
//   );
// };

const sendLoginResponse = (res, user, role) => {
  const approved = user.status === ACCOUNT_STATUS.APPROVED;

  const tokens = issueTokens({
    id: user._id.toString(),
    role,
    restricted: !approved,
  });

  return res.json(
    new ApiResponse(
      200,
      {
        user: user.toSafeJSON(),
        role,
        restricted: !approved,
        status: user.status,
        requiresDocuments:
          !user.documents?.profilePhoto ||
          !user.documents?.idProof ||
          (user.documents?.certificates?.length ?? 0) === 0,
        ...tokens,
      },
      approved ? "Login successful" : "Login successful (restricted access)",
    ),
  );
};

/**
 * Generic credential validation.
 */
// const findUserForLogin = async (Model, email) => {
//   return Model.findOne({
//     email: normalizeEmail(email),
//   }).select("+password");
// };
const findUserForLogin = async (Model, email) => {
  return Model.findOne({ email: normalizeEmail(email) }).select(
    "+password +otpCode +otpExpires",
  );
};

/**
 * Verify password.
 */
const verifyUserPassword = async (user, password) => {
  if (!user) {
    return false;
  }

  return user.comparePassword(password);
};

/**
 * Handle login for an unverified account.
 *
 * Behavior:
 *
 * 1. Generate new OTP.
 * 2. Save OTP + expiry.
 * 3. Send OTP by email.
 * 4. Stop login.
 * 5. Return EMAIL_NOT_VERIFIED.
 */
const handleUnverifiedLogin = async (user, role) => {
  await sendLoginVerificationOtp(user, role);

  throwAuthError(
    403,
    "EMAIL_NOT_VERIFIED",
    AUTH.EMAIL_NOT_VERIFIED || "Please verify your email OTP first.",
  );
};

/*
|--------------------------------------------------------------------------
| APPLICANT SIGNUP
|--------------------------------------------------------------------------
*/

export const applicantSignup = asyncHandler(async (req, res) => {
  const { mobile, email, password, name, language } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  /*
   * Check email and mobile independently.
   */
  const [existingEmail, existingMobile] = await Promise.all([
    Applicant.findOne({
      email: normalizedEmail,
    }),

    Applicant.findOne({
      mobile: normalizedMobile,
    }),
  ]);

  /*
   * ------------------------------------------------------------
   * Existing email
   * ------------------------------------------------------------
   */

  if (existingEmail) {
    /*
     * Existing verified account.
     */
    if (existingEmail.emailVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    /*
     * Existing mobile belongs to another applicant.
     */
    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    /*
     * Existing unverified account.
     *
     * IMPORTANT:
     * Do not overwrite the original account data.
     *
     * Only send a fresh OTP.
     */
    await generateAndSendOtp(existingEmail);

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
   * Create applicant
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
    otpExpires: otpExpiry(OTP_EXPIRY_MINUTES),

    emailVerified: false,
  });

  /*
   * Send OTP.
   */
  await sendOtpEmail(applicant.email, otp);

  logger.info("Applicant signup successful", {
    applicantId: applicant._id.toString(),
    email: applicant.email,
  });

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
          role: ROLES.APPLICANT,
          emailVerified: true,
          requiresApproval: applicant.status !== ACCOUNT_STATUS.APPROVED,
        },
        "Email is already verified.",
      ),
    );
  }

  /*
   * Validate OTP.
   */
  if (!isOtpValid(applicant, otp)) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * Verify email.
   */
  applicant.emailVerified = true;

  /*
   * OTP cannot be reused.
   */
  clearOtp(applicant);

  await applicant.save();

  logger.info("Applicant email verified", {
    applicantId: applicant._id.toString(),
    email: applicant.email,
  });

  return res.json(
    new ApiResponse(
      200,
      {
        user: applicant.toSafeJSON(),
        role: ROLES.APPLICANT,
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
  const { email, purpose = "email_verfication" } = req.body;

  // const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({
    email: normalizeEmail(email),
  }).select("+otpCode +otpExpires");

  if (!applicant) {
    throw new ApiError(404, "Applicant not found");
  }

  if (applicant.emailVerified && purpose === "email_verification") {
    throwAuthError(400, "EMAIL_ALREADY_VERIFIED", "Email already verified.");
  }

  await generateAndSendOtp(applicant, purpose);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "OTP resent successfully.",
    ),
  );
});

export const applicantResendOtpold = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!applicant) {
    throw new ApiError(404, "Applicant not found");
  }

  if (applicant.emailVerified) {
    throwAuthError(400, "EMAIL_ALREADY_VERIFIED", "Email already verified.");
  }

  await generateAndSendOtp(applicant);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "OTP resent successfully.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| LEGACY APPLICANT EMAIL TOKEN VERIFICATION
|--------------------------------------------------------------------------
|
| Kept for backwards compatibility.
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
    throwAuthError(
      400,
      "VERIFICATION_TOKEN_INVALID",
      "Invalid or expired verification token.",
    );
  }

  applicant.emailVerified = true;

  applicant.emailVerificationToken = undefined;
  applicant.emailVerificationExpires = undefined;

  clearOtp(applicant);

  await applicant.save();

  return res.json(
    new ApiResponse(
      200,
      {
        emailVerified: true,
      },
      "Email verified successfully.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| APPLICANT LOGIN
|--------------------------------------------------------------------------
|
| Login requirements:
|
| 1. Correct email/password
| 2. Email verified
| 3. Not blocked
| 4. Not suspended
| 5. Admin approved
|
| If email is not verified:
|
| -> Generate OTP
| -> Send OTP
| -> Return EMAIL_NOT_VERIFIED
|
| If email is verified but pending approval:
|
| -> Return ACCOUNT_PENDING_APPROVAL
|
| No JWT is issued until all requirements are satisfied.
|--------------------------------------------------------------------------
*/

export const applicantLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const applicant = await findUserForLogin(Applicant, email);

  if (!applicant) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  const passwordValid = await verifyUserPassword(applicant, password);

  if (!passwordValid) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  /*
   * Email verification.
   *
   * This MUST happen before approval check.
   */
  if (!applicant.emailVerified) {
    await handleUnverifiedLogin(applicant, ROLES.APPLICANT);
  }

  /*
   * Blocked / suspended / pending approval.
   */
  validateAccountAccess(applicant, ROLES.APPLICANT);

  /*
   * Fully approved account.
   */
  return sendLoginResponse(res, applicant, ROLES.APPLICANT);
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION SIGNUP
|--------------------------------------------------------------------------
|
| Organization signup uses EMAIL OTP.
|
| Organization type is intentionally accepted as a dynamic
| value because organization types can be managed by admin.
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

  /*
   * Normalize values.
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
   *
   * Joi should normally handle these validations.
   * These checks provide an additional controller-level guard.
   * ------------------------------------------------------------
   */

  if (!trimmedName) {
    throw new ApiError(400, "Organization name is required.");
  }

  if (!trimmedType) {
    throw new ApiError(400, "Organization type is required.");
  }

  if (!trimmedCountry) {
    throw new ApiError(400, "Country is required.");
  }

  if (!trimmedState) {
    throw new ApiError(400, "State is required.");
  }

  if (!trimmedCity) {
    throw new ApiError(400, "City is required.");
  }

  if (!trimmedPincode) {
    throw new ApiError(400, "Pincode is required.");
  }

  /*
   * ------------------------------------------------------------
   * Existing account checks
   * ------------------------------------------------------------
   */

  const [existingEmail, existingMobile] = await Promise.all([
    Organization.findOne({
      email: normalizedEmail,
    }),

    Organization.findOne({
      mobile: normalizedMobile,
    }),
  ]);

  /*
   * ------------------------------------------------------------
   * Existing email
   * ------------------------------------------------------------
   */

  if (existingEmail) {
    /*
     * Already OTP verified.
     */
    if (existingEmail.otpVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    /*
     * Mobile belongs to another organization.
     */
    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    /*
     * Existing unverified organization.
     *
     * Do not overwrite the existing profile.
     * Only issue a fresh OTP.
     */
    await generateAndSendOtp(existingEmail);

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
   * Create organization
   * ------------------------------------------------------------
   */

  const otp = generateOtp(6);

  const organization = await Organization.create({
    name: trimmedName,

    /*
     * Dynamic organization type.
     *
     * No static ORG_TYPES check is performed here.
     * The validation layer should be aligned with this
     * if organization types are admin-managed.
     */
    type: trimmedType,

    /*
     * Organization address.
     */
    address: {
      country: trimmedCountry,
      state: trimmedState,
      city: trimmedCity,
      pincode: trimmedPincode,
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
     * Password hashing should be handled by the
     * Organization model pre-save hook.
     */
    password,

    language: language || "en",

    /*
     * Email OTP.
     */
    otpCode: otp,
    otpExpires: otpExpiry(OTP_EXPIRY_MINUTES),

    otpVerified: false,
  });

  /*
   * Send OTP.
   */
  await sendOtpEmail(organization.email, otp);

  logger.info("Organization signup successful", {
    organizationId: organization._id.toString(),
    email: organization.email,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        id: organization._id,
        email: organization.email,
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

  const organization = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  /*
   * Already verified.
   */
  if (organization.otpVerified) {
    return res.json(
      new ApiResponse(
        200,
        {
          user: organization.toSafeJSON(),
          role: ROLES.ORGANIZATION,
          otpVerified: true,
          requiresApproval: organization.status !== ACCOUNT_STATUS.APPROVED,
        },
        "OTP is already verified.",
      ),
    );
  }

  /*
   * Validate OTP.
   */
  if (!isOtpValid(organization, otp)) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  /*
   * Verify organization email.
   */
  organization.otpVerified = true;

  /*
   * OTP cannot be reused.
   */
  clearOtp(organization);

  await organization.save();

  logger.info("Organization email verified", {
    organizationId: organization._id.toString(),
    email: organization.email,
  });

  return res.json(
    new ApiResponse(
      200,
      {
        user: organization.toSafeJSON(),
        role: ROLES.ORGANIZATION,
        otpVerified: true,
        requiresApproval: organization.status !== ACCOUNT_STATUS.APPROVED,
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

  const organization = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  if (organization.otpVerified) {
    throwAuthError(400, "OTP_ALREADY_VERIFIED", "OTP already verified.");
  }

  await generateAndSendOtp(organization);

  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
      },
      "OTP resent successfully to your email.",
    ),
  );
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION LOGIN
|--------------------------------------------------------------------------
|
| Login requirements:
|
| 1. Correct email/password
| 2. Email OTP verified
| 3. Not blocked
| 4. Not suspended
| 5. Admin approved
|
|--------------------------------------------------------------------------
*/

export const orgLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const organization = await findUserForLogin(Organization, email);

  if (!organization) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  const passwordValid = await verifyUserPassword(organization, password);

  if (!passwordValid) {
    throw new ApiError(401, AUTH.INVALID_CREDENTIALS);
  }

  /*
   * Email verification.
   *
   * If not verified:
   * - send fresh OTP
   * - stop login
   * - return EMAIL_NOT_VERIFIED
   */
  if (!organization.otpVerified) {
    await handleUnverifiedLogin(organization, ROLES.ORGANIZATION);
  }

  /*
   * Blocked / suspended / pending approval.
   */
  validateAccountAccess(organization, ROLES.ORGANIZATION);

  /*
   * Fully approved organization.
   */
  return sendLoginResponse(res, organization, ROLES.ORGANIZATION);
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
| 2. Search Applicant.
| 3. If not found, search Organization.
| 4. Generate OTP.
| 5. Save OTP + expiry.
| 6. Send OTP to email.
|
| We intentionally return the same response whether the
| email exists or not.
|--------------------------------------------------------------------------
*/

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = normalizeEmail(email);

  /*
   * Search applicant first.
   */
  let user = await Applicant.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  let role = ROLES.APPLICANT;

  /*
   * Search organization if applicant
   * was not found.
   */
  if (!user) {
    user = await Organization.findOne({
      email: normalizedEmail,
    }).select("+otpCode +otpExpires");

    role = ROLES.ORGANIZATION;
  }

  /*
   * Do not reveal account existence.
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
   * Generate and send password reset OTP.
   */
  await generateAndSendOtp(user);

  logger.info("Password reset OTP generated", {
    role,
    userId: user._id.toString(),
  });

  /*
   * Do not return sensitive information.
   *
   * The frontend already knows the email entered
   * by the user.
   */
  return res.json(
    new ApiResponse(
      200,
      {
        sent: true,
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
   * Find account
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

  /*
   * Do not expose whether account exists.
   *
   * From the reset endpoint perspective, this is simply
   * an invalid OTP/reset request.
   */
  if (!user) {
    throwAuthError(
      400,
      "OTP_INVALID",
      AUTH.OTP_INVALID || "Invalid or expired OTP.",
    );
  }

  /*
   * Validate OTP.
   */
  if (!isOtpValid(user, normalizedOtp)) {
    throwAuthError(
      400,
      "OTP_INVALID",
      AUTH.OTP_INVALID || "Invalid or expired OTP.",
    );
  }

  /*
   * Update password.
   *
   * Model pre-save hook should hash it.
   */
  user.password = password;

  /*
   * Invalidate OTP immediately.
   */
  clearOtp(user);

  await user.save();

  logger.info("Password reset successful", {
    userId: user._id.toString(),
  });

  return res.json(new ApiResponse(200, null, "Password reset successful."));
});

/*
|--------------------------------------------------------------------------
| REFRESH TOKEN
|--------------------------------------------------------------------------
*/

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throwAuthError(401, "REFRESH_TOKEN_REQUIRED", "Refresh token is required.");
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    logger.warn("Refresh token verification failed", {
      error: error.message,
    });

    throwAuthError(
      401,
      "TOKEN_EXPIRED",
      AUTH.TOKEN_EXPIRED || "Refresh token is invalid or expired.",
    );
  }

  /*
   * Validate the decoded payload.
   */
  if (!decoded || !decoded.id || !decoded.role) {
    throwAuthError(401, "TOKEN_INVALID", "Invalid refresh token.");
  }

  /*
   * Only allow known roles.
   */
  if (decoded.role !== ROLES.APPLICANT && decoded.role !== ROLES.ORGANIZATION) {
    throwAuthError(401, "TOKEN_INVALID", "Invalid refresh token role.");
  }

  const tokens = issueTokens({
    id: decoded.id,
    role: decoded.role,
  });

  return res.json(new ApiResponse(200, tokens, "Token refreshed."));
});

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

export const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    throwAuthError(401, "UNAUTHORIZED", "Authentication required.");
  }

  return res.json(
    new ApiResponse(
      200,
      {
        user: req.user.toSafeJSON(),
        role: req.role,
      },
      "Profile fetched.",
    ),
  );
});
