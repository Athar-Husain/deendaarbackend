import Joi from "joi";

export const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(
    "pending",
    "approved",
    "rejected",
    "update_requested",
  ),
  search: Joi.string().max(150),
  blocked: Joi.boolean(),
});

export const statusAction = Joi.object({
  note: Joi.string().max(1000).allow(""),
});

export const blockAction = Joi.object({
  blocked: Joi.boolean().required(),
  reason: Joi.string().max(500).allow(""),
});

export const suspendAction = Joi.object({
  suspended: Joi.boolean().required(),
  reason: Joi.string().max(500).allow(""),
});

export const complaintStatus = Joi.object({
  status: Joi.string().valid("open", "resolved", "dismissed").required(),
});

export const contentItem = Joi.object({
  key: Joi.string().max(100).required(),
  labelEn: Joi.string().max(150).required(),
  labelUr: Joi.string().max(150).allow(""),
  labelAr: Joi.string().max(150).allow(""),
  active: Joi.boolean().default(true),
});

export const locationItem = Joi.object({
  country: Joi.string().max(100).required(),
  state: Joi.string().max(100).allow(""),
  district: Joi.string().max(100).allow(""),
  active: Joi.boolean().default(true),
});

export const complaintCreate = Joi.object({
  target: Joi.string().length(24).hex().required(),
  targetModel: Joi.string()
    .valid("Applicant", "Organization", "Job")
    .required(),
  reason: Joi.string().max(200).required(),
  details: Joi.string().max(2000).allow(""),
});

export default {
  login,
  listQuery,
  statusAction,
  blockAction,
  suspendAction,
  complaintStatus,
  contentItem,
  locationItem,
  complaintCreate,
};
