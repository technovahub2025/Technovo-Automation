const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1)$/i;

const toCleanString = (value = "") => String(value || "").trim();

const toParsedUrl = (value = "") => {
  const normalized = toCleanString(value);
  if (!normalized) return null;

  try {
    return new URL(
      /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`
    );
  } catch {
    return null;
  }
};

export const DEFAULT_PUBLIC_OPTIN_KEY = toCleanString(
  import.meta.env.VITE_WHATSAPP_OPTIN_PUBLIC_KEY
);

export const isPlaceholderPublicKey = (value = "") => {
  const normalized = toCleanString(value).toLowerCase();
  if (!normalized) return true;
  return (
    normalized === "whatsapp_optin_public_key" ||
    normalized.includes("placeholder") ||
    normalized.includes("your_public_key") ||
    normalized.includes("your_public_optin_key")
  );
};

export const resolvePreferredPublicKey = (...candidates) => {
  const normalizedCandidates = candidates
    .map((candidate) => toCleanString(candidate))
    .filter(Boolean);

  const firstUsableCandidate = normalizedCandidates.find(
    (candidate) => !isPlaceholderPublicKey(candidate)
  );

  return firstUsableCandidate || normalizedCandidates[0] || "";
};

export const shouldIncludePublicKeyInUrl = (value = "") =>
  !isPlaceholderPublicKey(value);

export const isLocalHostUrl = (value = "") => {
  const parsed = toParsedUrl(value);
  if (!parsed) return false;
  return LOCAL_HOST_PATTERN.test(toCleanString(parsed.hostname));
};

export const canUseLocalDevOptInFallback = ({
  pageUrl = "",
  endpointUrl = "",
  backendUrl = ""
} = {}) => {
  const pageIsLocal = isLocalHostUrl(pageUrl);
  const backendIsLocal =
    isLocalHostUrl(endpointUrl) || isLocalHostUrl(backendUrl);

  return pageIsLocal && backendIsLocal;
};

export const syncPublicKeySearchParam = (searchParams, value = "") => {
  if (!searchParams || typeof searchParams.set !== "function") return;

  const normalized = toCleanString(value);
  if (shouldIncludePublicKeyInUrl(normalized)) {
    searchParams.set("publicKey", normalized);
    return;
  }

  if (typeof searchParams.delete === "function") {
    searchParams.delete("publicKey");
  }
};

