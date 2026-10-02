// backend/src/middleware/validate.middleware.js
import ApiError from "../utils/ApiError.js";
import { GENERIC } from "../constants/messages.js";

const validate =
  (schema, property = "body") =>
  (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = error.details.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));

      return next(new ApiError(400, GENERIC.VALIDATION_ERROR, errors));
    }

    // Express 5 makes req.query a getter-only property, so we cannot reassign it directly.
    if (property === "query") {
      // Clear out old keys and safely assign new validated/converted values
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      Object.assign(req.query, value);
    } else {
      req[property] = value;
    }

    next();
  };

export { validate };
