/**
 * @file error.js
 *
 * Custom error class to use for throwing errors.
 *
 * @author Will Pringle <will@distributive.network>
 * @date November 2023
 */

'use strict';

/**
 * Custom class for http errors.
 * @constructor
 * @param {string} message - The error message.
 * @param {number} statusCode - The HTTP status code for the response.
 */
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

