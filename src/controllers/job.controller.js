import Job from "../models/Job.model.js";
import Application from "../models/Application.model.js";
import Applicant from "../models/Applicant.model.js";
import Notification from "../models/Notification.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { JOB_STATUS, NOTIFICATION_TYPES } from "../constants/index.js";
import { sendPush } from "../services/push.service.js";
import { RESOURCE } from "../constants/messages.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, {
    page: 1,
    limit: 20,
    maxLimit: 100,
  });

  const q = req.query;

  const filter = { status: JOB_STATUS.OPEN };

  if (q.role) {
    filter.role = q.role;
  }

  if (q.country) {
    filter["location.country"] = new RegExp(`^${q.country}$`, "i");
  }

  if (q.state) {
    filter["location.state"] = new RegExp(`^${q.state}$`, "i");
  }

  if (q.district) {
    filter["location.district"] = new RegExp(`^${q.district}$`, "i");
  }

  if (q.minSalary || q.maxSalary) {
    filter.salary = {};

    if (q.minSalary) {
      filter.salary.$gte = q.minSalary;
    }

    if (q.maxSalary) {
      filter.salary.$lte = q.maxSalary;
    }
  }

  if (q.search) {
    filter.$text = { $search: q.search };
  }

  let query = Job.find(filter)
    .populate("organization", "name type address")
    .sort({ createdAt: -1 });

  if (q.orgType) {
    query = query.populate({
      path: "organization",
      match: { type: q.orgType },
      select: "name type address",
    });
  }

  const [rawItems, total] = await Promise.all([
    query.skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);

  const items = q.orgType
    ? rawItems.filter((job) => job.organization)
    : rawItems;

  res.json(
    new ApiResponse(
      200,
      paginatedResponse(items, total, page, limit),
      "Jobs fetched",
    ),
  );
});

export const getOne = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id).populate(
    "organization",
    "name type address contactPerson",
  );

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  res.json(new ApiResponse(200, job, "Job fetched"));
});

export const create = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    organization: req.user._id,
    status: JOB_STATUS.PENDING,
  };

  const job = await Job.create(payload);

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        job,
        "Job created successfully and pending admin approval",
      ),
    );
});

export const update = asyncHandler(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.id,
    organization: req.user._id,
  });

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  Object.assign(job, req.body);

  await job.save();

  res.json(new ApiResponse(200, job, "Job updated"));
});

export const changeStatus = asyncHandler(async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.id,
    organization: req.user._id,
  });

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  job.status = req.body.status;

  await job.save();

  res.json(new ApiResponse(200, job, "Job status updated"));
});

export const moderate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const job = await Job.findById(id).populate("organization", "name");

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  const previousStatus = job.status;

  job.status = status;

  await job.save();

  if (status === JOB_STATUS.OPEN && previousStatus !== JOB_STATUS.OPEN) {
    (async () => {
      try {
        const match = {
          status: "approved",
          blocked: false,
          "preferences.preferredRole": job.role,
        };

        const applicants = await Applicant.find(match)
          .select("_id fcmToken")
          .limit(500);

        await Notification.insertMany(
          applicants.map((applicant) => ({
            recipient: applicant._id,
            recipientModel: "Applicant",
            title: "New job matching your preference",
            body: `${job.title} posted near ${
              job.location?.district || job.location?.country || "your location"
            }`,
            type: NOTIFICATION_TYPES.JOB,
            data: {
              jobId: job._id.toString(),
            },
          })),
          { ordered: false },
        ).catch(() => {});

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
        // Best effort notification.
      }
    })();
  }

  res.json(
    new ApiResponse(200, job, "Job moderation status updated successfully"),
  );
});

/**
 * Organization's jobs.
 *
 * Each job also contains:
 * - applicantsCount
 * - shortlistedCount
 *
 * These values are calculated from Application documents,
 * making Application the source of truth.
 */
export const myJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {
    organization: req.user._id,
  };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    Job.aggregate([
      {
        $match: filter,
      },

      {
        $lookup: {
          from: "applications",
          localField: "_id",
          foreignField: "job",
          as: "jobApplications",
        },
      },

      {
        $addFields: {
          applicantsCount: {
            $size: "$jobApplications",
          },

          shortlistedCount: {
            $size: {
              $filter: {
                input: "$jobApplications",
                as: "application",
                cond: {
                  $eq: ["$$application.status", "shortlisted"],
                },
              },
            },
          },
        },
      },

      {
        $project: {
          jobApplications: 0,
        },
      },

      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $skip: skip,
      },

      {
        $limit: limit,
      },
    ]),

    Job.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(
      200,
      paginatedResponse(items, total, page, limit),
      "My jobs",
    ),
  );
});

export const remove = asyncHandler(async (req, res) => {
  const job = await Job.findOneAndDelete({
    _id: req.params.id,
    organization: req.user._id,
  });

  if (!job) {
    throw new ApiError(404, RESOURCE.JOB_NOT_FOUND);
  }

  await Application.deleteMany({
    job: job._id,
  });

  res.json(new ApiResponse(200, null, "Job removed"));
});
