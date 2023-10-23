// custom error class to use for throwing errors
class ApiError extends Error
{
  constructor(message, statusCode)
  {
    super(message);
    this.statusCode = statusCode;
    this.isCustom = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
exports.HttpError = ApiError;

