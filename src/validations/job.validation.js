// backend/src/validations/job.validation.js
import Joi from "joi";
import { JOB_ROLES, JOB_STATUS } from "../constants/index.js";

export const create = Joi.object({
  title: Joi.string().min(2).max(150).required(),
  role: Joi.string()
    .valid(...JOB_ROLES)
    .required(),
  salary: Joi.number().min(0).max(10000000).default(0),
  location: Joi.object({
    country: Joi.string().max(100).allow(""),
    state: Joi.string().max(100).allow(""),
    district: Joi.string().max(100).allow(""),
    fullAddress: Joi.string().max(500).allow(""),
  }).default({}),
  accommodation: Joi.boolean().default(false),
  requirements: Joi.object({
    hafiz: Joi.boolean().default(false),
    qari: Joi.boolean().default(false),
    aalim: Joi.boolean().default(false),
    mufti: Joi.boolean().default(false),
    notes: Joi.string().max(1000).allow(""),
  }).default({}),
  description: Joi.string().max(5000).allow(""),
});

export const update = create.fork(["title", "role"], (schema) =>
  schema.optional(),
);

export const changeStatus = Joi.object({
  status: Joi.string()
    .valid(JOB_STATUS.CLOSED, JOB_STATUS.OPEN, JOB_STATUS.REMOVED)
    .required(),
});

export const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid(...JOB_ROLES),
  country: Joi.string().max(100),
  state: Joi.string().max(100),
  district: Joi.string().max(100),
  minSalary: Joi.number().min(0),
  maxSalary: Joi.number().min(0),
  orgType: Joi.string().valid(
    "masjid",
    "madrasa_boys",
    "madrasa_girls",
    "school",
  ),
  search: Joi.string().max(150),
  status: Joi.string().valid(...Object.values(JOB_STATUS)),
});
