import { toAppPath } from "./appRouteBase.js";

export const buildPublicOptInSuccessRedirectUrl = (origin = "") => {
  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) return "";
  return `${normalizedOrigin}${toAppPath("/whatsapp-opt-in/success")}`;
};

export const buildPublicOptInLandingUrl = (origin = "", baseUrl = "", options = {}) => {
  const normalizedOrigin = String(origin || "").trim();
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!normalizedOrigin || !normalizedBaseUrl) return "";

  let url;
  try {
    url = /^https?:\/\//i.test(normalizedBaseUrl)
      ? new URL(normalizedBaseUrl)
      : new URL(
          `${normalizedOrigin}${normalizedBaseUrl.startsWith("/") ? "" : "/"}${normalizedBaseUrl}`
        );
  } catch {
    return "";
  }

  const successRedirect = buildPublicOptInSuccessRedirectUrl(normalizedOrigin);
  if (successRedirect && !url.searchParams.get("successRedirect")) {
    url.searchParams.set("successRedirect", successRedirect);
  }

  const backendUrl = String(options?.backendUrl || "").trim();
  if (backendUrl && !url.searchParams.get("backendUrl")) {
    url.searchParams.set("backendUrl", backendUrl);
  }

  return url.toString();
};

export const buildPublicOptInDemoUrl = (origin = "", options = {}) => {
  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) return "";

  const {
    basePath = "",
    backendUrl = "",
    publicKey = "",
    userId = "",
    companyId = "",
    name = "",
    phone = "",
    email = "",
    source = "manual_share",
    scope = "marketing",
    proofId = ""
  } = options || {};

  let url;
  try {
    const normalizedPath = String(basePath || "").trim();
    url = new URL(
      `${normalizedOrigin}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}/whatsapp-opt-in-demo`
    );
  } catch {
    return "";
  }

  if (backendUrl) url.searchParams.set("backendUrl", String(backendUrl).trim());
  if (publicKey) url.searchParams.set("publicKey", String(publicKey).trim());
  if (userId) url.searchParams.set("userId", String(userId).trim());
  if (companyId) url.searchParams.set("companyId", String(companyId).trim());
  if (name) url.searchParams.set("name", String(name).trim());
  if (phone) url.searchParams.set("phone", String(phone).trim());
  if (email) url.searchParams.set("email", String(email).trim());
  if (source) url.searchParams.set("source", String(source).trim());
  if (scope) url.searchParams.set("scope", String(scope).trim());
  if (proofId) url.searchParams.set("proofId", String(proofId).trim());

  return url.toString();
};
