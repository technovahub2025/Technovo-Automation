const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

export const normalizeError = (error, fallbackMessage = "Something went wrong") => {
  if (error instanceof Error) {
    return error;
  }

  const responseData = error?.response?.data;
  const responseMessage =
    typeof responseData === "string"
      ? responseData
      : responseData?.error || responseData?.message || "";
  const rawMessage =
    error?.message ||
    responseMessage ||
    error?.error ||
    (typeof error === "string" ? error : "") ||
    fallbackMessage;

  const normalizedMessage = String(rawMessage || fallbackMessage).trim() || fallbackMessage;
  const normalizedError = new Error(normalizedMessage);

  if (error && typeof error === "object") {
    normalizedError.name = error.name || normalizedError.name;
    normalizedError.code = error.code;
    normalizedError.status = error?.response?.status ?? error?.status ?? null;
    normalizedError.response = error.response;
    normalizedError.request = error.request;
    normalizedError.config = error.config;
    normalizedError.details = error;
    if (!normalizedMessage && safeStringify(error)) {
      normalizedError.message = safeStringify(error);
    }
  }

  return normalizedError;
};

export const normalizeErrorMessage = (error, fallbackMessage = "Something went wrong") =>
  normalizeError(error, fallbackMessage).message;
