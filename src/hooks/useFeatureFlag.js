import { useContext, useMemo } from "react";
import { AuthContext } from "../pages/authcontext";

const normalizeFlags = (flags) => {
  if (!flags || typeof flags !== "object") return {};
  return flags;
};

const useFeatureFlag = (flagKey, defaultValue = true) => {
  const { user } = useContext(AuthContext);

  return useMemo(() => {
    const flags = normalizeFlags(user?.featureFlags);
    if (!flagKey) return flags;
    if (Object.prototype.hasOwnProperty.call(flags, flagKey)) {
      return Boolean(flags[flagKey]);
    }
    return defaultValue;
  }, [user, flagKey, defaultValue]);
};

export default useFeatureFlag;
