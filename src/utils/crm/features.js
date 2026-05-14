const toBooleanFlag = (value, fallback = false) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const isCrmFeatureEnabled = (flagName, fallback = false) => {
  const normalizedFlag = String(flagName || "").trim();
  if (!normalizedFlag) return fallback;

  try {
    const stored = localStorage.getItem(`crmFeature.${normalizedFlag}`);
    if (stored !== null) return toBooleanFlag(stored, fallback);
  } catch {
    // Ignore storage access errors.
  }

  const envName = `VITE_${normalizedFlag.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
  return toBooleanFlag(import.meta.env[envName], fallback);
};
