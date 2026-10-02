// backend/src/validations/applicant.validation.js

import Joi from "joi";
import { JOB_ROLES, LANGUAGES } from "../constants/index.js";

export const updateProfile = Joi.object({
  name: Joi.string().min(2).max(100),
  fatherName: Joi.string().max(100).allow(""),
  dob: Joi.date().iso().allow(null),
  gender: Joi.string().valid("male", "female", "").allow(null),
  whatsapp: Joi.string().max(20).allow(""),
  language: Joi.string().valid(...LANGUAGES),
});

export const updateAddress = Joi.object({
  country: Joi.string().max(100).allow(""),
  state: Joi.string().max(100).allow(""),
  district: Joi.string().max(100).allow(""),
  fullAddress: Joi.string().max(500).allow(""),
  pinCode: Joi.string().max(20).allow(""),
});

export const updateQualifications = Joi.object({
  hafiz: Joi.boolean(),
  qari: Joi.boolean(),
  aalim: Joi.boolean(),
  mufti: Joi.boolean(),
  others: Joi.array().items(Joi.string().max(100)).max(20),
});

export const updateSkills = Joi.object({
  roles: Joi.array()
    .items(Joi.string().valid(...JOB_ROLES))
    .max(JOB_ROLES.length),
  experienceYears: Joi.number().integer().min(0).max(80),
  previousOrganizations: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().max(150).allow(""),
        role: Joi.string().max(100).allow(""),
        from: Joi.date().iso().allow(null),
        to: Joi.date().iso().allow(null),
      }),
    )
    .max(20),
});

export const updatePreferences = Joi.object({
  preferredRole: Joi.string()
    .valid(...JOB_ROLES, "")
    .allow(null),
  expectedSalary: Joi.number().min(0).max(10000000),
  preferredLocation: Joi.string().max(150).allow(""),
  accommodationRequired: Joi.boolean(),
});

export const fcmToken = Joi.object({
  fcmToken: Joi.string().max(500).required(),
});

// 🌟 Add this default export so `import v from ...` works smoothly in your routes
export default {
  updateProfile,
  updateAddress,
  updateQualifications,
  updateSkills,
  updatePreferences,
  fcmToken,
};
