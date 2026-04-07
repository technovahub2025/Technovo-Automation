export const GOOGLE_OAUTH_SUCCESS_TYPE = "google_oauth_success";
export const GOOGLE_OAUTH_ERROR_TYPE = "google_oauth_error";

const toSafeString = (value) => String(value || "").trim();
const toOrigin = (value) => {
  const raw = toSafeString(value);
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
};

export const resolveGoogleOAuthEvent = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { type: "ignore", message: "" };
  }

  if (payload.type === GOOGLE_OAUTH_SUCCESS_TYPE) {
    return {
      type: "success",
      message: "Google Calendar connected successfully."
    };
  }

  if (payload.type === GOOGLE_OAUTH_ERROR_TYPE) {
    return {
      type: "error",
      message: toSafeString(payload.error) || "Google Calendar connection failed."
    };
  }

  return { type: "ignore", message: "" };
};

export const isOAuthPopupOpen = (popupWindow) =>
  Boolean(popupWindow && popupWindow.closed === false);

export const buildGoogleOAuthTrustedOrigins = ({
  windowOrigin = "",
  apiBaseUrl = ""
} = {}) => {
  const trusted = new Set();
  const normalizedWindowOrigin = toOrigin(windowOrigin);
  const normalizedApiOrigin = toOrigin(apiBaseUrl);

  if (normalizedWindowOrigin) trusted.add(normalizedWindowOrigin);
  if (normalizedApiOrigin) trusted.add(normalizedApiOrigin);

  return Array.from(trusted);
};

export const isGoogleOAuthEventOriginTrusted = (eventOrigin, trustedOrigins = []) => {
  const normalizedEventOrigin = toOrigin(eventOrigin);
  if (!normalizedEventOrigin) return false;

  return trustedOrigins.some((origin) => toOrigin(origin) === normalizedEventOrigin);
};
