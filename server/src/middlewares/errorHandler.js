import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(err);

  // Upload refused by multer (too big, too many files): tell the user why.
  if (err.name === 'MulterError') {
    err.statusCode = 400;
    err.isOperational = true;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'The file is too big.';
  }

  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  let message = err.message;
  // Mask internal (non-operational) error details unless explicitly in development,
  // so an unset/misconfigured NODE_ENV defaults to the safe (masked) behaviour.
  if (!err.isOperational && !isDev) {
    message = "Something went wrong";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.errors && {errors: err.errors}),
    ...(isDev && {stack: err.stack}) // only expose stack traces in development
  });
};

export default errorHandler;