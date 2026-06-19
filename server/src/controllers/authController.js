import bcrypt from "bcrypt";
import db from "../config/db.js";
import logger from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";



export const register = async (req, res, next) => {
    try {
        const { name, email, password, phone, address } = req.body;

        const userExists = await db("users").where({ email: email.toLowerCase() }).first();

        if (userExists) {
            throw new ApiError(409, "A user with this email address already exists");
        }

        // 1. Hash the password before saving to the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. Insert with the hashed password
        const [newUserId] = await db("users").insert({
            name: name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: phone,
            address: address
        });

        // 3. Send structured success response
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                id: newUserId,
                name: name,
                email: email.toLowerCase()
            }
        });

    } catch (error) {
        // Passes database and hashing errors to the global error handler
        next(error); 
    }
};

export const login = async(req, res, next) => {
    const { email, password} = req.body;
    res.json({
        message: "Login successfull",
        email: email
    })
}
