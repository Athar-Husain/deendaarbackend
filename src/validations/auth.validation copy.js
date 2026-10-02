import Joi from "joi";
import { JOB_ROLES, ORG_TYPES, LANGUAGES } from "../constants/index.js";

const MOBILE_REGEX = /^[+]?[0-9]{7,15}$/;

export const applicantSignup = Joi.object({
  mobile: Joi.string().pattern(MOBILE_REGEX).required().messages({
    "string.pattern.base": "Mobile number is invalid",
  }),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).required(),
  name: Joi.string().min(2).max(100).required(),
  language: Joi.string()
    .valid(...LANGUAGES)
    .default("en"),
});

export const orgSignup = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  type: Joi.string()
    .valid(...ORG_TYPES)
    .required(),
  mobile: Joi.string().pattern(MOBILE_REGEX).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).required(),
  language: Joi.string()
    .valid(...LANGUAGES)
    .default("en"),
});

export const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const verifyOtp = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required(),
});

export const verifyEmail = Joi.object({
  token: Joi.string().required(),
});

export const forgotPassword = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(64).required(),
});

export const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});

export const rolesEnum = Joi.string().valid(...JOB_ROLES);
