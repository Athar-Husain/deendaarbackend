import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model.js";
import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";
import Job from "../models/Job.model.js";
import Application from "../models/Application.model.js";
import Notification from "../models/Notification.model.js";
import Role from "../models/Role.model.js";
import Category from "../models/Category.model.js";
import Location from "../models/Location.model.js";
import Complaint from "../models/Complaint.model.js";
import Conversation from "../models/Conversation.model.js";
import Message from "../models/Message.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { NOTIFICATION_TYPES, ACCOUNT_STATUS, JOB_STATUS } from "../constants/index.js";
import { sendPush } from "../services/push.service.js";
import { sendAccountStatusEmail } from "../services/email.service.js";
import { issueTokens } from "../services/token.service.js";

// -------- Auth --------
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select("+password");
  if (!admin) throw new ApiError(401, "Invalid credentials");
  const ok = await admin.comparePassword(password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  admin.lastLoginAt = new Date();
  await admin.save();

  const tokens = issueTokens({ id: admin._id.toString(), role: "admin" });
  res.json(
    new ApiResponse(
      200,
      {
        user: admin.toSafeJSON(),
        role: "admin",
        ...tokens,
      },
      "Login successful",
    ),
  );
});

export const me = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(
      200,
      { user: req.user.toSafeJSON(), role: "admin" },
      "Profile",
    ),
  );
});

// -------- Dashboard --------
export const stats = asyncHandler(async (req, res) => {
  const [
    totalApplicants,
    totalOrganizations,
    pendingApplicants,
    pendingOrganizations,
    activeJobs,
    totalApplications,
    openComplaints,
  ] = await Promise.all([
    Applicant.countDocuments({}),
    Organization.countDocuments({}),
    Applicant.countDocuments({ status: ACCOUNT_STATUS.PENDING }),
    Organization.countDocuments({ status: ACCOUNT_STATUS.PENDING }),
    Job.countDocuments({ status: "open" }),
    Application.countDocuments({}),
    Complaint.countDocuments({ status: "open" }),
  ]);

  res.json(
    new ApiResponse(
      200,
      {
        totalApplicants,
        totalOrganizations,
        pendingApplicants,
        pendingOrganizations,
        activeJobs,
        totalApplications,
        openComplaints,
      },
      "Dashboard stats",
    ),
  );
});

// -------- Applicants --------
export const listApplicants = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.blocked !== undefined) filter.blocked = req.query.blocked;
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(req.query.search, "i") },
      { email: new RegExp(req.query.search, "i") },
      { mobile: new RegExp(req.query.search, "i") },
    ];
  }
  const [items, total] = await Promise.all([
    Applicant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Applicant.countDocuments(filter),
  ]);
  res.json(
    new ApiResponse(
      200,
      paginatedResponse(
        items.map((i) => i.toSafeJSON()),
        total,
        page,
        limit,
      ),
      "Applicants",
    ),
  );
});

export const getApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id);
  if (!applicant) throw new ApiError(404, "Applicant not found");
  res.json(new ApiResponse(200, applicant.toSafeJSON(), "Applicant detail"));
});

export const approveApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id);
  if (!applicant) throw new ApiError(404, "Applicant not found");

  applicant.status = ACCOUNT_STATUS.APPROVED;
  applicant.statusNote = req.body.note || "";
  await applicant.save();

  await Notification.create({
    recipient: applicant._id,
    recipientModel: "Applicant",
    title: "Account approved",
    body: "Your account has been approved. You can now apply to jobs.",
    type: NOTIFICATION_TYPES.APPROVAL,
  });
  if (applicant.fcmToken) {
    await sendPush(
      applicant.fcmToken,
      "Account Approved",
      "You can now apply to jobs",
      {},
    );
  }
  sendAccountStatusEmail(
    applicant.email,
    "approved",
    applicant.statusNote,
  ).catch(() => {});

  res.json(new ApiResponse(200, applicant.toSafeJSON(), "Applicant approved"));
});

export const rejectApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id);
  if (!applicant) throw new ApiError(404, "Applicant not found");

  applicant.status = ACCOUNT_STATUS.REJECTED;
  applicant.statusNote = req.body.note || "";
  await applicant.save();

  await Notification.create({
    recipient: applicant._id,
    recipientModel: "Applicant",
    title: "Account rejected",
    body: applicant.statusNote || "Your account was rejected by admin",
    type: NOTIFICATION_TYPES.APPROVAL,
  });
  if (applicant.fcmToken) {
    await sendPush(
      applicant.fcmToken,
      "Account Rejected",
      applicant.statusNote || "",
      {},
    );
  }
  sendAccountStatusEmail(
    applicant.email,
    "rejected",
    applicant.statusNote,
  ).catch(() => {});

  res.json(new ApiResponse(200, applicant.toSafeJSON(), "Applicant rejected"));
});

export const requestUpdateApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id);
  if (!applicant) throw new ApiError(404, "Applicant not found");

  applicant.status = ACCOUNT_STATUS.UPDATE_REQUESTED;
  applicant.statusNote =
    req.body.note || "Please update your profile/documents";
  await applicant.save();

  await Notification.create({
    recipient: applicant._id,
    recipientModel: "Applicant",
    title: "Update requested",
    body: applicant.statusNote,
    type: NOTIFICATION_TYPES.APPROVAL,
  });

  res.json(new ApiResponse(200, applicant.toSafeJSON(), "Update requested"));
});

export const blockApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id);
  if (!applicant) throw new ApiError(404, "Applicant not found");
  applicant.blocked = !!req.body.blocked;
  await applicant.save();
  res.json(
    new ApiResponse(200, applicant.toSafeJSON(), "Applicant block updated"),
  );
});

export const suspendApplicant = asyncHandler(async (req, res) => {
  const applicant = await Applicant.findById(req.params.id);
  if (!applicant) throw new ApiError(404, "Applicant not found");
  applicant.suspended = !!req.body.suspended;
  await applicant.save();
  res.json(
    new ApiResponse(200, applicant.toSafeJSON(), "Applicant suspend updated"),
  );
});

// -------- Organizations --------
export const listOrganizations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(req.query.search, "i") },
      { email: new RegExp(req.query.search, "i") },
    ];
  }
  const [items, total] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Organization.countDocuments(filter),
  ]);
  res.json(
    new ApiResponse(
      200,
      paginatedResponse(
        items.map((i) => i.toSafeJSON()),
        total,
        page,
        limit,
      ),
      "Organizations",
    ),
  );
});

export const getOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");
  res.json(new ApiResponse(200, org.toSafeJSON(), "Organization detail"));
});

export const approveOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");

  org.status = ACCOUNT_STATUS.APPROVED;
  org.statusNote = req.body.note || "";
  await org.save();

  await Notification.create({
    recipient: org._id,
    recipientModel: "Organization",
    title: "Account approved",
    body: "Your organization account is approved. You can post jobs now.",
    type: NOTIFICATION_TYPES.APPROVAL,
  });
  if (org.fcmToken) {
    await sendPush(
      org.fcmToken,
      "Organization Approved",
      "You can post jobs now",
      {},
    );
  }
  sendAccountStatusEmail(org.email, "approved", org.statusNote).catch(() => {});

  res.json(new ApiResponse(200, org.toSafeJSON(), "Organization approved"));
});

export const rejectOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");

  org.status = ACCOUNT_STATUS.REJECTED;
  org.statusNote = req.body.note || "";
  await org.save();

  await Notification.create({
    recipient: org._id,
    recipientModel: "Organization",
    title: "Account rejected",
    body: org.statusNote || "Your account was rejected",
    type: NOTIFICATION_TYPES.APPROVAL,
  });
  sendAccountStatusEmail(org.email, "rejected", org.statusNote).catch(() => {});

  res.json(new ApiResponse(200, org.toSafeJSON(), "Organization rejected"));
});

export const blockOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");
  org.blocked = !!req.body.blocked;
  await org.save();
  res.json(
    new ApiResponse(200, org.toSafeJSON(), "Organization block updated"),
  );
});

export const suspendOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, "Organization not found");
  org.suspended = !!req.body.suspended;
  await org.save();
  res.json(
    new ApiResponse(200, org.toSafeJSON(), "Organization suspend updated"),
  );
});

// -------- Jobs --------
// export const listJobs = asyncHandler(async (req, res) => {
//   const { page, limit, skip } = getPagination(req.query);
//   const filter = {};
//   if (req.query.status) filter.status = req.query.status;
//   if (req.query.search) filter.title = new RegExp(req.query.search, "i");

//   const [items, total] = await Promise.all([
//     Job.find(filter)
//       .populate("organization", "name type")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit),
//     Job.countDocuments(filter),
//   ]);
//   res.json(
//     new ApiResponse(200, paginatedResponse(items, total, page, limit), "Jobs"),
//   );
// });

// export const getJob = asyncHandler(async (req, res) => {
//   const job = await Job.findById(req.params.id).populate(
//     "organization",
//     "name type address contactPerson",
//   );
//   if (!job) throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
//   res.json(new ApiResponse(200, job, "Job fetched"));
// });

// export const moderateJob = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   const job = await Job.findById(id).populate("organization", "name");
//   if (!job) throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);

//   const previousStatus = job.status;
//   job.status = status;
//   await job.save();

//   // If the job is newly approved, notify matching applicants
//   if (status === JOB_STATUS.OPEN && previousStatus !== JOB_STATUS.OPEN) {
//     (async () => {
//       try {
//         const match = {
//           status: "approved",
//           blocked: false,
//           "preferences.preferredRole": job.role,
//         };
//         const applicants = await Applicant.find(match)
//           .select("_id fcmToken")
//           .limit(500);

//         await Notification.insertMany(
//           applicants.map((a) => ({
//             recipient: a._id,
//             recipientModel: "Applicant",
//             title: "New job matching your preference",
//             body: `${job.title} posted near ${job.location?.district || job.location?.country || "your location"}`,
//             type: NOTIFICATION_TYPES.JOB,
//             data: { jobId: job._id.toString() },
//           })),
//           { ordered: false },
//         ).catch(() => {});

//         await Promise.all(
//           applicants
//             .filter((a) => a.fcmToken)
//             .map((a) =>
//               sendPush(a.fcmToken, "New job posted", job.title, {
//                 jobId: job._id.toString(),
//               }),
//             ),
//         );
//       } catch (_) {
//         /* silent — best-effort */
//       }
//     })();
//   }

//   res.json(
//     new ApiResponse(200, job, "Job moderation status updated successfully"),
//   );
// });

// export const removeJob = asyncHandler(async (req, res) => {
//   const job = await Job.findById(req.params.id);
//   if (!job) throw new ApiError(404, "Job not found");
//   job.status = "removed";
//   await job.save();
//   res.json(new ApiResponse(200, job, "Job removed"));
// });

// const ADMIN_JOB_STATUSES = ["pending", "open", "rejected", "closed"];

// -------- Jobs --------

export const listJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.search) {
    filter.title = new RegExp(req.query.search, "i");
  }

  const [items, total] = await Promise.all([
    Job.find(filter)
      .populate("organization", "name type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Job.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(200, paginatedResponse(items, total, page, limit), "Jobs"),
  );
});

export const getJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id).populate(
    "organization",
    "name type address contactPerson",
  );

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  res.json(new ApiResponse(200, job, "Job fetched"));
});

/**
 * Change job status from admin panel.
 *
 * Allowed statuses:
 * pending
 * open
 * rejected
 * closed
 *
 * "removed" is handled separately by removeJob().
 */
export const moderateJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("staust", req)
  console.log("staust", req.body)
  const { status } = req.body;


  if (!status) {
    throw new ApiError(400, "Job status is required");
  }

  const allowedStatuses = Object.values(JOB_STATUS);

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid job status. Allowed statuses: ${allowedStatuses.join(", ")}`,
    );
  }

  const job = await Job.findById(id).populate("organization", "name");

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  if (job.status === JOB_STATUS.REMOVED) {
    throw new ApiError(400, "Removed jobs cannot have their status changed");
  }

  const previousStatus = job.status;

  if (previousStatus === status) {
    return res.json(new ApiResponse(200, job, `Job is already ${status}`));
  }

  job.status = status;
  await job.save();

  // Notify matching applicants when job becomes open
  if (status === JOB_STATUS.OPEN && previousStatus !== JOB_STATUS.OPEN) {
    (async () => {
      try {
        const applicants = await Applicant.find({
          status: ACCOUNT_STATUS.APPROVED,
          blocked: false,
          "preferences.preferredRole": job.role,
        })
          .select("_id fcmToken")
          .limit(500);

        if (applicants.length > 0) {
          await Notification.insertMany(
            applicants.map((applicant) => ({
              recipient: applicant._id,
              recipientModel: "Applicant",
              title: "New job matching your preference",
              body: `${job.title} posted near ${
                job.location?.district ||
                job.location?.country ||
                "your location"
              }`,
              type: NOTIFICATION_TYPES.JOB,
              data: {
                jobId: job._id.toString(),
              },
            })),
            { ordered: false },
          ).catch(() => {});
        }

        await Promise.all(
          applicants
            .filter((applicant) => applicant.fcmToken)
            .map((applicant) =>
              sendPush(applicant.fcmToken, "New job posted", job.title, {
                jobId: job._id.toString(),
              }),
            ),
        );
      } catch (_) {
        // Notification failure should not affect job moderation.
      }
    })();
  }

  res.json(
    new ApiResponse(
      200,
      {
        ...job.toObject(),
        previousStatus,
        newStatus: status,
      },
      `Job status changed from ${previousStatus} to ${status}`,
    ),
  );
});

/**
 * Remove job.
 *
 * This is kept separate because removing a job
 * is a destructive admin action.
 */
export const removeJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  // Already removed
  if (job.status === JOB_STATUS.REMOVED) {
    return res.json(new ApiResponse(200, job, "Job is already removed"));
  }

  const previousStatus = job.status;

  job.status = JOB_STATUS.REMOVED;

  await job.save();

  res.json(
    new ApiResponse(
      200,
      {
        ...job.toObject(),
        previousStatus,
        newStatus: "removed",
      },
      "Job removed successfully",
    ),
  );
});

// -------- Content --------
export const listRoles = asyncHandler(async (req, res) => {
  const items = await Role.find().sort({ key: 1 });
  res.json(new ApiResponse(200, items, "Roles"));
});

export const upsertRole = asyncHandler(async (req, res) => {
  const role = await Role.findOneAndUpdate({ key: req.body.key }, req.body, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  res.json(new ApiResponse(200, role, "Role saved"));
});

export const deleteRole = asyncHandler(async (req, res) => {
  await Role.findByIdAndDelete(req.params.id);
  res.json(new ApiResponse(200, null, "Role deleted"));
});

export const listCategories = asyncHandler(async (req, res) => {
  const items = await Category.find().sort({ key: 1 });
  res.json(new ApiResponse(200, items, "Categories"));
});

export const upsertCategory = asyncHandler(async (req, res) => {
  const item = await Category.findOneAndUpdate(
    { key: req.body.key },
    req.body,
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json(new ApiResponse(200, item, "Category saved"));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json(new ApiResponse(200, null, "Category deleted"));
});

export const listLocations = asyncHandler(async (req, res) => {
  const items = await Location.find().sort({
    country: 1,
    state: 1,
    district: 1,
  });
  res.json(new ApiResponse(200, items, "Locations"));
});

export const upsertLocation = asyncHandler(async (req, res) => {
  const item = await Location.findOneAndUpdate(
    {
      country: req.body.country,
      state: req.body.state || "",
      district: req.body.district || "",
    },
    req.body,
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json(new ApiResponse(200, item, "Location saved"));
});

export const deleteLocation = asyncHandler(async (req, res) => {
  await Location.findByIdAndDelete(req.params.id);
  res.json(new ApiResponse(200, null, "Location deleted"));
});

// -------- Complaints --------
export const listComplaints = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Complaint.countDocuments(filter),
  ]);
  res.json(
    new ApiResponse(
      200,
      paginatedResponse(items, total, page, limit),
      "Complaints",
    ),
  );
});

export const updateComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true },
  );
  if (!complaint) throw new ApiError(404, "Complaint not found");
  res.json(new ApiResponse(200, complaint, "Complaint updated"));
});

// -------- Public content (for mobile) --------
export const publicContent = asyncHandler(async (req, res) => {
  const [roles, categories, locations] = await Promise.all([
    Role.find({ active: true }),
    Category.find({ active: true }),
    Location.find({ active: true }),
  ]);
  res.json(new ApiResponse(200, { roles, categories, locations }, "Content"));
});
