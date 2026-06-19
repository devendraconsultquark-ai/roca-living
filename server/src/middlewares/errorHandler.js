import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(err);

  const statusCode = err.statusCode || 500;

  let message = err.message;
  if(!err.isOperational && process.env.NODE_ENV === 'production'){
    message = "Something went wrong";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.errors && {errors: err.errors}),
    ...(process.env.NODE_ENV !== 'production' && {stack: err.stack})
  });
};

export default errorHandler;