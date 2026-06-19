import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import db from "./src/config/db.js";
import logger from "./src/utils/logger.js";
import notFound from "./src/middlewares/notFound.js";
import errorHandler from "./src/middlewares/errorHandler.js";
import authRouter from "./src/routes/authRoutes.js";

const app = express();
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
if (isProd && allowedOrigins.length === 0) {
  logger.error("WARNING: ALLOWED_ORIGINS env variable is missing or empty in production!");
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or curl requests (no origin header)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !isProd) {
      return callback(null, true);
    } else {
      return callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Payload compression
app.use(compression());

// HTTP Request logging
app.use(morgan(isProd ? 'combined' : 'dev', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}));

app.use(cookieParser());

// Parse body payload size limits
app.use(express.json({ limit: '10kb' }));

// Health Check endpoint
app.get('/health', async (req, res) => {
  try {
    // Ping DB using Knex to verify database health
    await db.raw('SELECT 1');
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
  } catch (err) {
    logger.error(`Health check failed: ${err.message}`);
    res.status(500).json({ status: 'DOWN', reason: err.message });
  }
});


app.get('/', (req, res) => res.json({ success: true, message: 'Roca Living API' }));


// Routes
app.use("/api/v1/auth", authRouter);

app.use(notFound);
app.use(errorHandler);


export { app };