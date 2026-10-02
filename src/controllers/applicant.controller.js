// src/controllers/applicant.controller.js
import Applicant from "../models/Applicant.model.js";
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
  const fields = [
    "name",
    "fatherName",
    "dob",
    "gender",
    "whatsapp",
    "language",
  ];
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

export const updateQualifications = asyncHandler(async (req, res) => {
  req.user.qualifications = {
    ...req.user.qualifications.toObject(),
    ...req.body,
  };
  await req.user.save();
  res.json(
    new ApiResponse(200, req.user.qualifications, "Qualifications updated"),
  );
});

export const updateSkills = asyncHandler(async (req, res) => {
  const fields = ["roles", "experienceYears", "previousOrganizations"];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) req.user[f] = req.body[f];
  });
  await req.user.save();
  res.json(
    new ApiResponse(
      200,
      {
        roles: req.user.roles,
        experienceYears: req.user.experienceYears,
        previousOrganizations: req.user.previousOrganizations,
      },
      "Skills updated",
    ),
  );
});

export const updatePreferences = asyncHandler(async (req, res) => {
  req.user.preferences = { ...req.user.preferences.toObject(), ...req.body };
  await req.user.save();
  res.json(new ApiResponse(200, req.user.preferences, "Preferences updated"));
});

export const uploadDocuments = asyncHandler(async (req, res) => {
  const files = req.files || {};
  const updates = {};

  const uploadOne = async (file, folder) => {
    const result = await uploadBuffer(file.buffer, folder, "auto");
    return result.url;
  };

  if (files.profilePhoto?.[0]) {
    updates["documents.profilePhoto"] = await uploadOne(
      files.profilePhoto[0],
      `${UPLOAD_FOLDERS.APPLICANT}/${req.user._id}/photo`,
    );
  }
  if (files.idProof?.[0]) {
    updates["documents.idProof"] = await uploadOne(
      files.idProof[0],
      `${UPLOAD_FOLDERS.APPLICANT}/${req.user._id}/id`,
    );
  }
  if (files.cv?.[0]) {
    updates["documents.cv"] = await uploadOne(
      files.cv[0],
      `${UPLOAD_FOLDERS.APPLICANT}/${req.user._id}/cv`,
    );
  }
  if (files.certificates?.length) {
    const urls = [];
    for (const f of files.certificates) {
      urls.push(
        await uploadOne(f, `${UPLOAD_FOLDERS.APPLICANT}/${req.user._id}/certs`),
      );
    }
    updates["documents.certificates"] = [
      ...(req.user.documents?.certificates || []),
      ...urls,
    ];
  }

  if (!Object.keys(updates).length) {
    throw new ApiError(400, "No files uploaded");
  }

  await Applicant.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true },
  );
  const fresh = await Applicant.findById(req.user._id);
  res.json(new ApiResponse(200, fresh.documents, "Documents uploaded"));
});

export const updateFcmToken = asyncHandler(async (req, res) => {
  req.user.fcmToken = req.body.fcmToken;
  await req.user.save();
  res.json(new ApiResponse(200, null, "FCM token saved"));
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

export const myNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({
    recipient: req.user._id,
    recipientModel: "Applicant",
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
