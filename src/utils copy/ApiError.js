
// backend/src/utils/ApiError.js
const ApiError = (message, statusCode) => {
  const error = new Error(message); // Create a new error
  error.statusCode = statusCode; // Attach the status code
  error.name = "ApiError"; // Optionally give the error a name
  return error; // Return the error object
};

export default ApiError;
