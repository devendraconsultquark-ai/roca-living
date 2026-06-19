import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Pretty print format for local development console
const textFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const isProd = process.env.NODE_ENV === 'production';

// Production: Output structured JSON to console (for Datadog, CloudWatch, ELK, etc.)
// Development: Output pretty-printed colorized text to console
const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    isProd ? json() : combine(colorize(), textFormat)
  ),
  transports: [
    new winston.transports.Console()
  ],
});

export default logger;
