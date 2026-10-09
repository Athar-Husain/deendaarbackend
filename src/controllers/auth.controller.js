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
import { buildAuthState } from "../utils/authState.js";

import { ACCOUNT_STATUS, ROLES } from "../constants/index.js";
import { AUTH } from "../constants/messages.js";

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

// const ROLES = { APPLICANT: "applicant", ORGANIZATION: "organization" };
const OTP_EXPIRY_MINUTES = 10;

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();
const normalizeMobile = (mobile) => String(mobile || "").trim();
const trimString = (v) => (typeof v === "string" ? v.trim() : "");

const buildTokenPayload = (doc, role, restricted) => ({
  id: doc._id.toString(),
  role,
  restricted,
});

const throwAuthError = (statusCode, code, message) => {
  const err = new ApiError(statusCode, message);
  err.code = code;
  throw err;
};

/**
 * Always select OTP fields + password when needed.
 */
const findUserWithSecrets = (Model, email) =>
  Model.findOne({ email: normalizeEmail(email) }).select(
    "+password +otpCode +otpExpires",
  );

/**
 * Generate, save (as OTP), and email.
 */
const generateAndSendOtp = async (user, purpose = "email_verification") => {
  const otp = generateOtp(6);
  user.otpCode = otp;
  user.otpExpires = otpExpiry(OTP_EXPIRY_MINUTES);
  user.otpPurpose = purpose;
  await user.save();
  await sendOtpEmail(user.email, otp);
  return otp;
};

const isOtpValid = (user, otp) => {
  const normalized = String(otp || "").trim();
  const expired = !user.otpExpires || user.otpExpires < new Date();
  const invalid = !user.otpCode || user.otpCode !== normalized;
  return !expired && !invalid;
};

const clearOtp = (user) => {
  user.otpCode = undefined;
  user.otpExpires = undefined;
  user.otpPurpose = undefined;
};

/**
 * Blocked / suspended checks (approval is no longer a login gate).
 */
const validateNotBlockedOrSuspended = (user, role) => {
  if (user.blocked) {
    throwAuthError(
      403,
      "ACCOUNT_BLOCKED",
      role === ROLES.ORGANIZATION
        ? "Your organization account has been blocked."
        : "Your account has been blocked.",
    );
  }
  if (user.suspended) {
    throwAuthError(
      403,
      "ACCOUNT_SUSPENDED",
      role === ROLES.ORGANIZATION
        ? "Your organization account has been suspended."
        : "Your account has been suspended.",
    );
  }
};

/**
 * Successful login — issues restricted or full token.
 */
const sendLoginResponse = (res, user, role) => {
  const state = buildAuthState(user, role);

  const tokens = issueTokens(buildTokenPayload(user, role, state.restricted));

  return res.json(
    new ApiResponse(
      200,
      {
        user: user.toSafeJSON(),
        role,
        restricted: state.restricted,
        capabilities: state.capabilities,
        nextStep: state.nextStep,
        profileComplete: state.profileComplete,
        status: user.status,
        ...tokens,
      },
      state.approved
        ? "Login successful"
        : "Login successful. Please upload your documents for admin approval.",
    ),
  );
};

/**
 * Unverified email path — resend OTP and stop login.
 */
const handleUnverifiedLogin = async (user, role) => {
  await generateAndSendOtp(user, "login_verification");

  logger.info("Login verification OTP sent", {
    role,
    userId: user._id.toString(),
    email: user.email,
  });

  throwAuthError(
    403,
    "EMAIL_NOT_VERIFIED",
    AUTH.EMAIL_NOT_VERIFIED || "Please verify your email OTP first.",
  );
};

/* ------------------------------------------------------------------ */
/* APPLICANT SIGNUP                                                   */
/* ------------------------------------------------------------------ */

export const applicantSignup = asyncHandler(async (req, res) => {
  const {
    mobile,
    email,
    password,
    name,
    language,
    country,
    state,
    city,
    pincode,
    fullAddress,
  } = req.body;

  const trimmedCountry = trimString(country);

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);
  const trimmedName = trimString(name);
  const trimmedState = trimString(state);
  const trimmedCity = trimString(city);
  const trimmedPincode = trimString(pincode);

  if (!trimmedName) throw new ApiError(400, "Organization name is required.");
  if (!trimmedCountry) throw new ApiError(400, "Country is required.");
  if (!trimmedState) throw new ApiError(400, "State is required.");
  if (!trimmedCity) throw new ApiError(400, "City is required.");
  if (!trimmedPincode) throw new ApiError(400, "Pincode is required.");

  const [existingEmail, existingMobile] = await Promise.all([
    Applicant.findOne({ email: normalizedEmail }).select(
      "+otpCode +otpExpires",
    ),
    Applicant.findOne({ mobile: normalizedMobile }),
  ]);

  if (existingEmail) {
    if (existingEmail.emailVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    await generateAndSendOtp(existingEmail, "email_verification");

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

  if (existingMobile) {
    throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
  }

  const otp = generateOtp(6);

  // const applicant = await Applicant.create({
  //   mobile: normalizedMobile,
  //   email: normalizedEmail,
  //   password,
  //   name,
  //   language: language || "en",
  //   otpCode: otp,
  //   otpExpires: otpExpiry(OTP_EXPIRY_MINUTES),
  //   otpPurpose: "email_verification",
  //   emailVerified: false,
  // });

  const applicant = await Applicant.create({
    name: trimmedName,
    mobile: normalizedMobile,
    email: normalizedEmail,
    password,
    address: {
      country: trimmedCountry,
      state: trimmedState,
      city: trimmedCity,
      pincode: trimmedPincode,
      district: "",
      fullAddress: fullAddress,
    },
    language: language || "en",
    otpCode: otp,
    otpExpires: otpExpiry(OTP_EXPIRY_MINUTES),
    otpPurpose: "email_verification",
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

/* ------------------------------------------------------------------ */
/* APPLICANT OTP VERIFICATION                                         */
/* ------------------------------------------------------------------ */

export const applicantVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({ email: normalizedEmail }).select(
    "+otpCode +otpExpires",
  );

  if (!applicant) throw new ApiError(404, "Applicant not found");

  if (applicant.emailVerified) {
    const state = buildAuthState(applicant, ROLES.APPLICANT);
    return res.json(
      new ApiResponse(
        200,
        {
          user: applicant.toSafeJSON(),
          role: ROLES.APPLICANT,
          emailVerified: true,
          restricted: state.restricted,
          capabilities: state.capabilities,
          nextStep: state.nextStep,
        },
        "Email is already verified.",
      ),
    );
  }

  if (!isOtpValid(applicant, otp)) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  applicant.emailVerified = true;
  clearOtp(applicant);
  await applicant.save();

  const state = buildAuthState(applicant, ROLES.APPLICANT);

  return res.json(
    new ApiResponse(
      200,
      {
        user: applicant.toSafeJSON(),
        role: ROLES.APPLICANT,
        emailVerified: true,
        restricted: state.restricted,
        capabilities: state.capabilities,
        nextStep: state.nextStep,
      },
      "Email verified successfully. Please log in to upload your documents.",
    ),
  );
});

/* ------------------------------------------------------------------ */
/* APPLICANT RESEND OTP                                               */
/* ------------------------------------------------------------------ */

export const applicantResendOtp = asyncHandler(async (req, res) => {
  const { email, purpose = "email_verification" } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const applicant = await Applicant.findOne({ email: normalizedEmail }).select(
    "+otpCode +otpExpires",
  );

  if (!applicant) throw new ApiError(404, "Applicant not found");

  if (applicant.emailVerified && purpose === "email_verification") {
    throwAuthError(400, "EMAIL_ALREADY_VERIFIED", "Email already verified.");
  }

  await generateAndSendOtp(applicant, purpose);

  return res.json(
    new ApiResponse(200, { sent: true }, "OTP resent successfully."),
  );
});

/* ------------------------------------------------------------------ */
/* APPLICANT LOGIN                                                    */
/* ------------------------------------------------------------------ */

export const applicantLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const applicant = await findUserWithSecrets(Applicant, email);
  if (!applicant) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  const valid = await applicant.comparePassword(password);
  if (!valid) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  if (!applicant.emailVerified) {
    await handleUnverifiedLogin(applicant, ROLES.APPLICANT);
  }

  validateNotBlockedOrSuspended(applicant, ROLES.APPLICANT);

  return sendLoginResponse(res, applicant, ROLES.APPLICANT);
});

/* ------------------------------------------------------------------ */
/* ORGANIZATION SIGNUP                                                */
/* ------------------------------------------------------------------ */

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

  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);
  const trimmedName = trimString(name);
  const trimmedType = trimString(type);
  const trimmedCountry = trimString(country);

  console.log("trimmedCountry", trimmedCountry);
  const trimmedState = trimString(state);
  const trimmedCity = trimString(city);
  const trimmedPincode = trimString(pincode);

  if (!trimmedName) throw new ApiError(400, "Organization name is required.");
  if (!trimmedType) throw new ApiError(400, "Organization type is required.");
  if (!trimmedCountry) throw new ApiError(400, "Country is required.");
  if (!trimmedState) throw new ApiError(400, "State is required.");
  if (!trimmedCity) throw new ApiError(400, "City is required.");
  if (!trimmedPincode) throw new ApiError(400, "Pincode is required.");

  const [existingEmail, existingMobile] = await Promise.all([
    Organization.findOne({ email: normalizedEmail }).select(
      "+otpCode +otpExpires",
    ),
    Organization.findOne({ mobile: normalizedMobile }),
  ]);

  if (existingEmail) {
    if (existingEmail.otpVerified) {
      throwAuthError(409, "EMAIL_EXISTS", AUTH.EMAIL_EXISTS);
    }

    if (
      existingMobile &&
      existingMobile._id.toString() !== existingEmail._id.toString()
    ) {
      throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
    }

    await generateAndSendOtp(existingEmail, "email_verification");

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

  if (existingMobile) {
    throwAuthError(409, "MOBILE_EXISTS", AUTH.MOBILE_EXISTS);
  }

  const otp = generateOtp(6);

  const organization = await Organization.create({
    name: trimmedName,
    type: trimmedType,
    mobile: normalizedMobile,
    email: normalizedEmail,
    address: {
      country: trimmedCountry,
      state: trimmedState,
      city: trimmedCity,
      pincode: trimmedPincode,
      district: "",
      fullAddress: "",
    },
    password,
    language: language || "en",
    otpCode: otp,
    otpExpires: otpExpiry(OTP_EXPIRY_MINUTES),
    otpPurpose: "email_verification",
    otpVerified: false,
  });

  await sendOtpEmail(organization.email, otp);

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

/* ------------------------------------------------------------------ */
/* ORGANIZATION OTP VERIFICATION                                      */
/* ------------------------------------------------------------------ */

export const orgVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const organization = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!organization) throw new ApiError(404, "Organization not found.");

  if (organization.otpVerified) {
    const state = buildAuthState(organization, ROLES.ORGANIZATION);
    return res.json(
      new ApiResponse(
        200,
        {
          user: organization.toSafeJSON(),
          role: ROLES.ORGANIZATION,
          otpVerified: true,
          restricted: state.restricted,
          capabilities: state.capabilities,
          nextStep: state.nextStep,
        },
        "OTP is already verified.",
      ),
    );
  }

  if (!isOtpValid(organization, otp)) {
    throwAuthError(400, "OTP_INVALID", AUTH.OTP_INVALID);
  }

  organization.otpVerified = true;
  clearOtp(organization);
  await organization.save();

  const state = buildAuthState(organization, ROLES.ORGANIZATION);

  return res.json(
    new ApiResponse(
      200,
      {
        user: organization.toSafeJSON(),
        role: ROLES.ORGANIZATION,
        otpVerified: true,
        restricted: state.restricted,
        capabilities: state.capabilities,
        nextStep: state.nextStep,
      },
      "OTP verified successfully. Please log in to upload your documents.",
    ),
  );
});

/* ------------------------------------------------------------------ */
/* ORGANIZATION RESEND OTP                                            */
/* ------------------------------------------------------------------ */

export const orgResendOtp = asyncHandler(async (req, res) => {
  const { email, purpose = "email_verification" } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const organization = await Organization.findOne({
    email: normalizedEmail,
  }).select("+otpCode +otpExpires");

  if (!organization) throw new ApiError(404, "Organization not found.");

  if (organization.otpVerified && purpose === "email_verification") {
    throwAuthError(400, "OTP_ALREADY_VERIFIED", "OTP already verified.");
  }

  await generateAndSendOtp(organization, purpose);

  return res.json(
    new ApiResponse(
      200,
      { sent: true },
      "OTP resent successfully to your email.",
    ),
  );
});

/* ------------------------------------------------------------------ */
/* ORGANIZATION LOGIN                                                 */
/* ------------------------------------------------------------------ */

export const orgLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const organization = await findUserWithSecrets(Organization, email);
  if (!organization) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  const valid = await organization.comparePassword(password);
  if (!valid) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  if (!organization.otpVerified) {
    await handleUnverifiedLogin(organization, ROLES.ORGANIZATION);
  }

  validateNotBlockedOrSuspended(organization, ROLES.ORGANIZATION);

  return sendLoginResponse(res, organization, ROLES.ORGANIZATION);
});

/* ------------------------------------------------------------------ */
/* FORGOT PASSWORD                                                    */
/* ------------------------------------------------------------------ */

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  let user = await Applicant.findOne({ email: normalizedEmail }).select(
    "+otpCode +otpExpires",
  );
  let role = ROLES.APPLICANT;

  if (!user) {
    user = await Organization.findOne({ email: normalizedEmail }).select(
      "+otpCode +otpExpires",
    );
    role = ROLES.ORGANIZATION;
  }

  if (!user) {
    return res.json(
      new ApiResponse(
        200,
        null,
        "If the email exists, a password reset OTP has been sent.",
      ),
    );
  }

  await generateAndSendOtp(user, "password_reset");

  logger.info("Password reset OTP generated", {
    role,
    userId: user._id.toString(),
  });

  return res.json(
    new ApiResponse(
      200,
      { sent: true },
      "If the email exists, a password reset OTP has been sent.",
    ),
  );
});

/* ------------------------------------------------------------------ */
/* RESET PASSWORD                                                     */
/* ------------------------------------------------------------------ */

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otp || "").trim();

  let user = await Applicant.findOne({ email: normalizedEmail }).select(
    "+otpCode +otpExpires",
  );
  if (!user) {
    user = await Organization.findOne({ email: normalizedEmail }).select(
      "+otpCode +otpExpires",
    );
  }

  if (!user || !isOtpValid(user, normalizedOtp)) {
    throwAuthError(
      400,
      "OTP_INVALID",
      AUTH.OTP_INVALID || "Invalid or expired OTP.",
    );
  }

  user.password = password;
  clearOtp(user);
  await user.save();

  return res.json(new ApiResponse(200, null, "Password reset successful."));
});

/* ------------------------------------------------------------------ */
/* REFRESH TOKEN                                                      */
/* ------------------------------------------------------------------ */

export const refreshold = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throwAuthError(401, "REFRESH_TOKEN_REQUIRED", "Refresh token is required.");
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    logger.warn("Refresh token verification failed", { error: err.message });
    throwAuthError(
      401,
      "TOKEN_EXPIRED",
      "Refresh token is invalid or expired.",
    );
  }

  if (
    !decoded?.id ||
    (decoded.role !== ROLES.APPLICANT && decoded.role !== ROLES.ORGANIZATION)
  ) {
    throwAuthError(401, "TOKEN_INVALID", "Invalid refresh token.");
  }

  // Re-derive `restricted` from the live user record so approval is fresh.
  const Model = decoded.role === ROLES.APPLICANT ? Applicant : Organization;
  const user = await Model.findById(decoded.id);
  if (!user) throwAuthError(401, "TOKEN_INVALID", "User not found.");

  const state = buildAuthState(user, decoded.role);

  const tokens = issueTokens({
    id: user._id.toString(),
    role: decoded.role,
    restricted: state.restricted,
  });

  return res.json(new ApiResponse(200, tokens, "Token refreshed."));
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throwAuthError(401, "REFRESH_TOKEN_REQUIRED", "Refresh token is required.");
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    logger.warn("Refresh token verification failed", {
      error: err.message,
    });

    throwAuthError(
      401,
      "TOKEN_EXPIRED",
      "Refresh token is invalid or expired.",
    );
  }

  // Support applicant, organization and admin refresh tokens.
  if (
    !decoded?.id ||
    ![ROLES.APPLICANT, ROLES.ORGANIZATION, ROLES.ADMIN].includes(decoded.role)
  ) {
    throwAuthError(401, "TOKEN_INVALID", "Invalid refresh token.");
  }

  // Select the correct model based on the role in the refresh token.
  let Model;

  switch (decoded.role) {
    case ROLES.APPLICANT:
      Model = Applicant;
      break;

    case ROLES.ORGANIZATION:
      Model = Organization;
      break;

    case ROLES.ADMIN:
      Model = Admin;
      break;

    default:
      throwAuthError(401, "TOKEN_INVALID", "Invalid token role.");
  }

  const user = await Model.findById(decoded.id);

  if (!user) {
    throwAuthError(401, "TOKEN_INVALID", "User not found.");
  }

  // Admins are not restricted by applicant/organization approval.
  let restricted = false;

  if (decoded.role !== ROLES.ADMIN) {
    const state = buildAuthState(user, decoded.role);
    restricted = state.restricted;
  }

  const tokens = issueTokens({
    id: user._id.toString(),
    role: decoded.role,
    restricted,
  });

  return res.json(new ApiResponse(200, tokens, "Token refreshed."));
});

/* ------------------------------------------------------------------ */
/* CURRENT USER                                                       */
/* ------------------------------------------------------------------ */

export const meold = asyncHandler(async (req, res) => {
  if (!req.user)
    throwAuthError(401, "UNAUTHORIZED", "Authentication required.");

  const state = buildAuthState(req.user, req.role);

  return res.json(
    new ApiResponse(
      200,
      {
        user: req.user.toSafeJSON(),
        role: req.role,
        restricted: state.restricted,
        capabilities: state.capabilities,
        nextStep: state.nextStep,
        profileComplete: state.profileComplete,
      },
      "Profile fetched.",
    ),
  );
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user)
    throwAuthError(401, "UNAUTHORIZED", "Authentication required.");

  if (req.role === ROLES.ADMIN) {
    res.json(
      new ApiResponse(
        200,
        { user: req.user.toSafeJSON(), role: req.role },
        "Profile fetched",
      ),
    );
  }

  const state = buildAuthState(req.user, req.role);

  return res.json(
    new ApiResponse(
      200,
      {
        user: req.user.toSafeJSON(),
        role: req.role,
        restricted: state.restricted,
        capabilities: state.capabilities,
        nextStep: state.nextStep,
        profileComplete: state.profileComplete,
      },
      "Profile fetched.",
    ),
  );
});

/* ------------------------------------------------------------------ */
/* LEGACY EMAIL-TOKEN VERIFY (kept for backwards compat)              */
/* ------------------------------------------------------------------ */

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const applicant = await Applicant.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!applicant) {
    throwAuthError(
      400,
      "VERIFICATION_TOKEN_INVALID",
      "Invalid or expired token.",
    );
  }

  applicant.emailVerified = true;
  clearOtp(applicant);
  await applicant.save();

  return res.json(
    new ApiResponse(
      200,
      { emailVerified: true },
      "Email verified successfully.",
    ),
  );
});
