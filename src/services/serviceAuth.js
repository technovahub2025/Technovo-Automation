const registeredAxiosInstances = new WeakSet();

const resolveLoginPath = () => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}/login`;
};

export const clearStoredAuthSession = () => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  localStorage.removeItem(tokenKey);
  localStorage.removeItem("authToken");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const isUnauthorizedError = (error) => {
  const status = Number(error?.response?.status || 0);
  if (status === 401) return true;
  const message = String(error?.message || "").toLowerCase();
  return message.includes("unauthorized") || message.includes("expired token");
};

export const handleUnauthorizedServiceError = (error, fallback = "Your session expired. Please login again.") => {
  if (!isUnauthorizedError(error)) return false;

  clearStoredAuthSession();
  sessionStorage.setItem("auth_expired_notice", fallback);

  if (typeof window !== "undefined") {
    const loginPath = resolveLoginPath();
    const currentPath = window.location.pathname;
    if (currentPath !== loginPath) {
      window.location.href = loginPath;
    }
  }

  return true;
};

export const registerUnauthorizedAxiosInterceptor = (
  axiosInstance,
  { onUnauthorized, message } = {}
) => {
  if (
    !axiosInstance ||
    !axiosInstance.interceptors ||
    !axiosInstance.interceptors.response ||
    registeredAxiosInstances.has(axiosInstance)
  ) {
    return axiosInstance;
  }

  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (isUnauthorizedError(error) && !error?.config?.skipAuthRedirect) {
        if (typeof onUnauthorized === "function") {
          try {
            onUnauthorized(error);
          } catch {
            // Ignore cleanup callback failures and continue redirect handling.
          }
        }
        handleUnauthorizedServiceError(error, message);
      }
      return Promise.reject(error);
    }
  );

  registeredAxiosInstances.add(axiosInstance);
  return axiosInstance;
};

export default handleUnauthorizedServiceError;
