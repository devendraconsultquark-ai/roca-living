import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";

export const protect = (portal) => async (req, res, next) => {
  try {
    let token;
    const activePortal = portal || req.query.portal || req.headers['x-portal-name'];
    
    if (activePortal === "admin") {
      token = req.cookies?.jwt_admin;
    } else if (activePortal === "landlord") {
      token = req.cookies?.jwt_landlord;
    } else {
      // reads either cookie for general protected routes like /me
      token = req.cookies?.jwt_admin || req.cookies?.jwt_landlord;
    }

    if (!token) {
      throw new ApiError(401, "Not authenticated");
    }

    let decoded;
    try {
      // Pin the algorithm so a token can't be verified under an unexpected one.
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      throw new ApiError(401, "Session expired, please login again");
    }

    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};
