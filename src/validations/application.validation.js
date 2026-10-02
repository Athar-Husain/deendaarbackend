import Joi from "joi";

export const apply = Joi.object({
  jobId: Joi.string().length(24).hex().required(),
  note: Joi.string().max(2000).allow(""),
});

export const listApplicants = Joi.object({
  status: Joi.string().valid("applied", "shortlisted", "rejected"),
  minExperience: Joi.number().min(0),
  qualification: Joi.string().valid("hafiz", "qari", "aalim", "mufti"),
  district: Joi.string().max(100),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const updateStatus = Joi.object({
  status: Joi.string().valid("shortlisted", "rejected").required(),
  note: Joi.string().max(1000).allow(""),
});

export default {
  apply,
  listApplicants,
  updateStatus,
};
