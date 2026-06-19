import { ApiError } from "../utils/ApiError.js";

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errorMessages = result.error.issues.map(err => ({
      field: err.path[0],
      message: err.message
    }));

    return next(new ApiError(400, "Validation failed", errorMessages));
    };

  // Replace body with validated/sanitized data
  req.body = result.data;
  
  next();
};
