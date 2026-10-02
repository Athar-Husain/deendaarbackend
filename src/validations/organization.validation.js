import Joi from "joi";
import { ORG_TYPES, LANGUAGES } from "../constants/index.js";

export const updateProfile = Joi.object({
  name: Joi.string().min(2).max(150),
  type: Joi.string().valid(...ORG_TYPES),
  contactPerson: Joi.string().max(150).allow(""),
  language: Joi.string().valid(...LANGUAGES),
});

export const updateAddress = Joi.object({
  country: Joi.string().max(100).allow(""),
  state: Joi.string().max(100).allow(""),
  district: Joi.string().max(100).allow(""),
  fullAddress: Joi.string().max(500).allow(""),
  pinCode: Joi.string().max(20).allow(""),
});

export const fcmToken = Joi.object({
  fcmToken: Joi.string().max(500).required(),
});

export default {
  updateProfile,
  updateAddress,
  fcmToken,
};
