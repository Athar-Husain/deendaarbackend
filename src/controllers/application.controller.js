// src/controllers/application.controller.js
import Application from "../models/Application.model.js";
import Job from "../models/Job.model.js";
import Applicant from "../models/Applicant.model.js";
import Notification from "../models/Notification.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import {
  JOB_STATUS,
  APPLICATION_STATUS,
  NOTIFICATION_TYPES,
} from "../constants/index.js";
import { sendPush } from "../services/push.service.js";
import { APPLICATION, RESOURCE } from "../constants/messages.js";

export const apply = asyncHandler(async (req, res) => {
  const { jobId, note } = req.body;
  const job = await Job.findById(jobId);
  if (!job) throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  if (job.status !== JOB_STATUS.OPEN)
    throw new ApiError(400, APPLICATION.JOB_CLOSED);

  const existing = await Application.findOne({
    job: jobId,
    applicant: req.user._id,
  });
  if (existing) throw new ApiError(409, APPLICATION.ALREADY_APPLIED);

  const app = await Application.create({
    job: job._id,
    applicant: req.user._id,
    organization: job.organization,
    note: note || "",
  });

  await Job.updateOne({ _id: job._id }, { $inc: { applicantsCount: 1 } });

  await Notification.create({
    recipient: job.organization,
    recipientModel: "Organization",
    title: "New application received",
    body: `${req.user.name || "An applicant"} applied to ${job.title}`,
    type: NOTIFICATION_TYPES.APPLICATION,
    data: { applicationId: app._id.toString(), jobId: job._id.toString() },
  });

  res.status(201).json(new ApiResponse(201, app, "Application submitted"));
});

export const myApplications = asyncHandler(async (req, res) => {
  const items = await Application.find({ applicant: req.user._id })
    .populate({
      path: "job",
      populate: { path: "organization", select: "name type address" },
    })
    .sort({ createdAt: -1 });
  res.json(new ApiResponse(200, items, "Applications fetched"));
});

export const applicantsForJob = asyncHandler(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.jobId,
    organization: req.user._id,
  });
  if (!job) throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);

  const { page, limit, skip } = getPagination(req.query);
  const filter = { job: job._id };
  if (req.query.status) filter.status = req.query.status;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate(
        "applicant",
        "name fatherName gender experienceYears qualifications roles documents address preferences",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  let items = applications;
  if (req.query.minExperience !== undefined) {
    const min = Number(req.query.minExperience);
    items = items.filter((a) => (a.applicant?.experienceYears || 0) >= min);
  }
  if (req.query.qualification) {
    const q = req.query.qualification;
    items = items.filter((a) => a.applicant?.qualifications?.[q]);
  }
  if (req.query.district) {
    const d = new RegExp(`^${req.query.district}$`, "i");
    items = items.filter((a) => d.test(a.applicant?.address?.district || ""));
  }

  res.json(
    new ApiResponse(
      200,
      paginatedResponse(items, total, page, limit),
      "Applicants fetched",
    ),
  );
});

export const updateStatus = asyncHandler(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.id,
    organization: req.user._id,
  }).populate("job", "title");
  if (!application) throw new ApiError(404, "Application not found");

  application.status = req.body.status;
  if (req.body.note) application.note = req.body.note;
  await application.save();

  const applicant = await Applicant.findById(application.applicant).select(
    "fcmToken",
  );
  await Notification.create({
    recipient: application.applicant,
    recipientModel: "Applicant",
    title: `Application ${req.body.status}`,
    body: `Your application for ${application.job?.title || "a job"} was ${req.body.status}`,
    type: NOTIFICATION_TYPES.APPLICATION,
    data: { applicationId: application._id.toString() },
  });
  if (applicant?.fcmToken) {
    await sendPush(
      applicant.fcmToken,
      `Application ${req.body.status}`,
      `Your application was ${req.body.status}`,
      { applicationId: application._id.toString() },
    );
  }

  res.json(new ApiResponse(200, application, "Application status updated"));
});

export const getOne = asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id)
    .populate("job")
    .populate("applicant", "-password");
  if (!app) throw new ApiError(404, "Application not found");

  const isOwnerApplicant =
    req.role === "applicant" && app.applicant._id.equals(req.user._id);
  const isOwnerOrg =
    req.role === "organization" && app.organization.equals(req.user._id);
  if (!isOwnerApplicant && !isOwnerOrg && req.role !== "admin") {
    throw new ApiError(403, "Not allowed");
  }

  res.json(new ApiResponse(200, app, "Application fetched"));
});

