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

    req[property] = value;
    next();
  };

export { validate };
