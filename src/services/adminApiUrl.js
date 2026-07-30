const toCleanString = (value) => String(value || "").trim();

const normalizeAdminApiUrl = (value) => toCleanString(value).replace(/\/+$/, "");

export const resolveAdminApiUrl = () => {
  const envUrl = normalizeAdminApiUrl(
    import.meta.env.VITE_ADMIN_API_URL ||
      import.meta.env.VITE_ADMIN_BACKEND_URL ||
      import.meta.env.VITE_ADMIN_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      ""
  );

  return envUrl;
};

export default resolveAdminApiUrl;
