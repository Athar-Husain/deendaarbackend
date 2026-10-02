import Notification from "../models/Notification.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const recipientModelFor = (role) => {
  if (role === "applicant") return "Applicant";
  if (role === "organization") return "Organization";
  return "Admin";
};

export const list = asyncHandler(async (req, res) => {
  const items = await Notification.find({
    recipient: req.user._id,
    recipientModel: recipientModelFor(req.role),
  })
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(new ApiResponse(200, items, "Notifications fetched"));
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    recipientModel: recipientModelFor(req.role),
    read: false,
  });
  res.json(new ApiResponse(200, { count }, "Unread count"));
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { read: true } },
  );
  res.json(new ApiResponse(200, null, "Marked read"));
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    {
      recipient: req.user._id,
      recipientModel: recipientModelFor(req.role),
      read: false,
    },
    { $set: { read: true } },
  );
  res.json(new ApiResponse(200, null, "All marked read"));
});
