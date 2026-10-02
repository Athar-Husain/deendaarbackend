// backend/src/utils/ApiResponse.js

const ApiResponse = (statusCode, data, message = "Success") => {
  return {
    statusCode,
    data,
    message,
    success: statusCode < 400,
  };
};

export default ApiResponse;
