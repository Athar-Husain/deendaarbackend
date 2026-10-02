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
} from "../services/email.service.js";
import { sendOtpSms } from "../services/sms.service.js";
import { generateOtp, otpExpiry } from "../utils/otp.js";
import { AUTH } from "../constants/messages.js";

const buildTokenPayload = (doc, role) => ({
  id: doc._id.toString(),
  role,
});

export const applicantSignup = asyncHandler(async (req, res) => {
  const { mobile, email, password, name, language } = req.body;

  const existing = await Applicant.findOne({ $or: [{ email }, { mobile }] });
  if (existing) {
    if (existing.email === email) throw new ApiError(409, AUTH.EMAIL_EXISTS);
    throw new ApiError(409, AUTH.MOBILE_EXISTS);
  }

  const verificationToken = crypto.randomBytes(24).toString("hex");
  const applicant = await Applicant.create({
    mobile,
    email,
    password,
    name,
    language: language || "en",
    emailVerificationToken: verificationToken,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(email, verificationToken);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        id: applicant._id,
        email: applicant.email,
        emailVerified: applicant.emailVerified,
      },
      "Signup successful. Please check your email to verify your account.",
    ),
  );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const applicant = await Applicant.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpires");

  if (!applicant)
    throw new ApiError(400, "Invalid or expired verification token");

  applicant.emailVerified = true;
  applicant.emailVerificationToken = undefined;
  applicant.emailVerificationExpires = undefined;
  await applicant.save();

  res.json(new ApiResponse(200, null, "Email verified successfully"));
});

export const applicantLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const applicant = await Applicant.findOne({ email }).select("+password");
  if (!applicant) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  const ok = await applicant.comparePassword(password);
  if (!ok) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  if (!applicant.emailVerified)
    throw new ApiError(403, AUTH.EMAIL_NOT_VERIFIED);

  const tokens = issueTokens(buildTokenPayload(applicant, "applicant"));
  res.json(
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

export const orgSignup = asyncHandler(async (req, res) => {
  const { name, type, mobile, email, password, language } = req.body;

  const existing = await Organization.findOne({ $or: [{ email }, { mobile }] });
  if (existing) {
    if (existing.email === email) throw new ApiError(409, AUTH.EMAIL_EXISTS);
    throw new ApiError(409, AUTH.MOBILE_EXISTS);
  }

  const otp = generateOtp(6);
  const org = await Organization.create({
    name,
    type,
    mobile,
    email,
    password,
    language: language || "en",
    otpCode: otp,
    otpExpires: otpExpiry(10),
  });

  await sendOtpSms(mobile, otp);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        id: org._id,
        email: org.email,
        otpVerified: false,
      },
      "Signup successful. Please verify OTP sent to your mobile.",
    ),
  );
});

export const orgVerifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const org = await Organization.findOne({ email }).select(
    "+otpCode +otpExpires",
  );
  if (!org) throw new ApiError(404, "Organization not found");

  if (
    !org.otpCode ||
    org.otpCode !== otp ||
    !org.otpExpires ||
    org.otpExpires < new Date()
  ) {
    throw new ApiError(400, AUTH.OTP_INVALID);
  }

  org.otpVerified = true;
  org.otpCode = undefined;
  org.otpExpires = undefined;
  await org.save();

  const tokens = issueTokens(buildTokenPayload(org, "organization"));
  res.json(
    new ApiResponse(
      200,
      {
        user: org.toSafeJSON(),
        role: "organization",
        ...tokens,
      },
      "OTP verified. Your account is pending admin approval.",
    ),
  );
});

export const orgResendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const org = await Organization.findOne({ email });
  if (!org) throw new ApiError(404, "Organization not found");
  if (org.otpVerified) throw new ApiError(400, "OTP already verified");

  const otp = generateOtp(6);
  org.otpCode = otp;
  org.otpExpires = otpExpiry(10);
  await org.save();

  await sendOtpSms(org.mobile, otp);
  res.json(new ApiResponse(200, null, "OTP resent successfully"));
});

export const orgLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const org = await Organization.findOne({ email }).select("+password");
  if (!org) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  const ok = await org.comparePassword(password);
  if (!ok) throw new ApiError(401, AUTH.INVALID_CREDENTIALS);

  if (!org.otpVerified) throw new ApiError(403, "Please verify your OTP first");

  const tokens = issueTokens(buildTokenPayload(org, "organization"));
  res.json(
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

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  let user = await Applicant.findOne({ email });
  let model = Applicant;
  if (!user) {
    user = await Organization.findOne({ email });
    model = Organization;
  }

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
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(email, token);
  res.json(
    new ApiResponse(
      200,
      null,
      "If the email exists, a reset link has been sent",
    ),
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  let user = await Applicant.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    user = await Organization.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");
  }

  if (!user) throw new ApiError(400, "Invalid or expired reset token");

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json(new ApiResponse(200, null, "Password reset successful"));
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new ApiError(401, AUTH.TOKEN_EXPIRED);
  }

  const tokens = issueTokens({ id: decoded.id, role: decoded.role });
  res.json(new ApiResponse(200, tokens, "Token refreshed"));
});

export const me = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(
      200,
      { user: req.user.toSafeJSON(), role: req.role },
      "Profile fetched",
    ),
  );
});
