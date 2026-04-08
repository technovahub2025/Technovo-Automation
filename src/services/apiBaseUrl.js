const LOCAL_BACKEND_FALLBACK = "http://localhost:3001";

const toCleanString = (value) => String(value || "").trim();

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(toCleanString(value));

export const normalizeApiBaseUrl = (value) => {
  const raw = toCleanString(value);
  if (!raw) return "";
  const normalized = raw.replace(/\/+$/, "");
  return normalized.replace(/\/api$/i, "");
};

export const resolveApiBaseUrl = ({ override } = {}) => {
  const normalizedOverride = normalizeApiBaseUrl(override);
  if (normalizedOverride) return normalizedOverride;

  const explicitBase = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (explicitBase) return explicitBase;

  const explicitApiUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
  if (explicitApiUrl) return explicitApiUrl;

  if (typeof window === "undefined") {
    return LOCAL_BACKEND_FALLBACK;
  }

  const hostname = toCleanString(window.location.hostname);
  const isLocalFrontend = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
  if (isLocalFrontend) {
    return LOCAL_BACKEND_FALLBACK;
  }

  // Same-origin fallback should target the host origin only.
  // Frontend route basenames like /nexion are not API prefixes.
  return toCleanString(window.location.origin);
};

export const buildApiUrl = (path = "") => {
  const inputPath = toCleanString(path);
  if (!inputPath) return resolveApiBaseUrl();
  if (isAbsoluteUrl(inputPath)) return inputPath;

  let normalizedPath = inputPath.startsWith("/") ? inputPath : `/${inputPath}`;
  if (!/^\/api(\/|$)/i.test(normalizedPath)) {
    normalizedPath = `/api${normalizedPath}`;
  }
  return `${resolveApiBaseUrl()}${normalizedPath}`;
};

export default resolveApiBaseUrl;
