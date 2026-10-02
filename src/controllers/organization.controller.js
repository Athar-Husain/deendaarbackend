// src/controllers/organization.controller.js
import Organization from "../models/Organization.model.js";
import Job from "../models/Job.model.js";
import Application from "../models/Application.model.js";
import Notification from "../models/Notification.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadBuffer } from "../services/upload.service.js";
import { UPLOAD_FOLDERS } from "../constants/index.js";

export const getProfile = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, req.user.toSafeJSON(), "Profile fetched"));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const fields = ["name", "type", "contactPerson", "language"];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) req.user[f] = req.body[f];
  });
  await req.user.save();
  res.json(new ApiResponse(200, req.user.toSafeJSON(), "Profile updated"));
});

export const updateAddress = asyncHandler(async (req, res) => {
  req.user.address = { ...req.user.address.toObject(), ...req.body };
  await req.user.save();
  res.json(new ApiResponse(200, req.user.address, "Address updated"));
});

export const uploadDocuments = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length)
    throw new ApiError(400, "No files uploaded");
  const urls = [];
  for (const f of req.files) {
    const result = await uploadBuffer(
      f.buffer,
      `${UPLOAD_FOLDERS.ORGANIZATION}/${req.user._id}`,
      "auto",
    );
    urls.push(result.url);
  }
  req.user.documents = [...req.user.documents, ...urls];
  await req.user.save();
  res.json(new ApiResponse(200, req.user.documents, "Documents uploaded"));
});

export const updateFcmToken = asyncHandler(async (req, res) => {
  req.user.fcmToken = req.body.fcmToken;
  await req.user.save();
  res.json(new ApiResponse(200, null, "FCM token saved"));
});

export const dashboardStats = asyncHandler(async (req, res) => {
  const [activeJobs, totalApplicants, shortlisted] = await Promise.all([
    Job.countDocuments({ organization: req.user._id, status: "open" }),
    Application.countDocuments({ organization: req.user._id }),
    Application.countDocuments({
      organization: req.user._id,
      status: "shortlisted",
    }),
  ]);
  res.json(
    new ApiResponse(
      200,
      { activeJobs, totalApplicants, shortlisted },
      "Stats fetched",
    ),
  );
});

export const myNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({
    recipient: req.user._id,
    recipientModel: "Organization",
  })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(new ApiResponse(200, items, "Notifications fetched"));
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { read: true } },
  );
  res.json(new ApiResponse(200, null, "Marked read"));
});
