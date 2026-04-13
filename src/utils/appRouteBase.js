const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

export const normalizeAppRouteBase = (value) => {
  const raw = String(value || "").trim();

  if (!raw || raw === "/" || raw === "./" || raw === ".") {
    return "/";
  }

  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

export const detectAppRouteBase = (pathname) => {
  const currentPath =
    String(
      pathname ||
        (typeof window !== "undefined" ? window.location.pathname : "/")
    ).trim() || "/";

  if (currentPath === "/nexion" || currentPath.startsWith("/nexion/")) {
    return "/nexion";
  }

  return "/";
};

export const getAppRouteBase = (pathname) => {
  const configuredBase = normalizeAppRouteBase(import.meta.env.VITE_APP_BASENAME);
  return configuredBase !== "/" ? configuredBase : detectAppRouteBase(pathname);
};

export const stripAppRouteBase = (pathname, base = getAppRouteBase(pathname)) => {
  const currentPath = String(pathname || "/") || "/";
  const normalizedBase = normalizeAppRouteBase(base);

  if (normalizedBase === "/") {
    return currentPath;
  }

  if (currentPath === normalizedBase) {
    return "/";
  }

  if (currentPath.startsWith(`${normalizedBase}/`)) {
    return currentPath.slice(normalizedBase.length) || "/";
  }

  return currentPath;
};

export const toAppPath = (path, base = getAppRouteBase()) => {
  if (isAbsoluteUrl(path)) {
    return String(path);
  }

  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${String(path || "")}`;
  const normalizedBase = normalizeAppRouteBase(base);

  if (normalizedBase === "/") {
    return normalizedPath;
  }

  if (
    normalizedPath === normalizedBase ||
    normalizedPath.startsWith(`${normalizedBase}/`)
  ) {
    return normalizedPath;
  }

  return `${normalizedBase}${normalizedPath}`;
};
