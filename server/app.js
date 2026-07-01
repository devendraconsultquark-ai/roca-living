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
import landlordRouter from './src/routes/landlordRoutes.js';
import propertyRouter from './src/routes/propertyRoutes.js';
import tenancyRouter from './src/routes/tenancyRoutes.js';
import accountingRouter from './src/routes/accountingRoutes.js';
import statementRouter from './src/routes/statementRoutes.js';
import depositRouter from './src/routes/depositRoutes.js';
import maintenanceRouter from './src/routes/maintenanceRoutes.js';
import utilityRouter from './src/routes/utilityRoutes.js';
import inspectionRouter from './src/routes/inspectionRoutes.js';
import agentRouter from './src/routes/agentRoutes.js';
import onboardingRouter from './src/routes/onboardingRoutes.js';
import reportRouter from './src/routes/reportRoutes.js';
import documentRouter from './src/routes/documentRoutes.js';
import invoiceRouter from './src/routes/invoiceRoutes.js';
import settingsRouter from './src/routes/settingsRoutes.js';
import previewRouter from './src/routes/previewRoutes.js';


const app = express();
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Portal-Name'],
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
  max: 500, // limit each IP to 100 requests per window
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}));

// Strict rate limiting for sensitive auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 5 requests per 15 minutes
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);

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
app.use('/api/v1/landlords', landlordRouter);
app.use('/api/v1/properties', propertyRouter);
app.use('/api/v1/tenancies', tenancyRouter);
app.use('/api/v1/accounting', accountingRouter);
app.use('/api/v1/statements', statementRouter);
app.use('/api/v1/deposits', depositRouter);
app.use('/api/v1/maintenance', maintenanceRouter);
app.use('/api/v1/utilities', utilityRouter);
app.use('/api/v1/inspections', inspectionRouter);
app.use('/api/v1/agents', agentRouter);
app.use('/api/v1/onboarding', onboardingRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/v1/documents', documentRouter);
app.use('/api/v1/invoices', invoiceRouter);
app.use('/api/v1/settings', settingsRouter);


// DEV-ONLY: Live HTML preview for PDF templates — never mounted in production
if (!isProd) {
  app.use('/preview', previewRouter);
}

app.use(notFound);
app.use(errorHandler);


export { app };