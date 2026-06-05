const normalizeUserId = (user = {}) =>
  String(user?._id || user?.id || user?.userId || "").trim();

export const getStoredWorkspaceUser = () => {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export const resolveAgentAccessState = (user = {}) => {
  if (typeof user?.isEnabled === "boolean") {
    return user.isEnabled;
  }

  const normalizedRole = String(user?.role || "").toLowerCase();
  if (["superadmin", "admin", "manager"].includes(normalizedRole)) {
    return true;
  }

  if (
    typeof user?.canAccessAgentManagement === "boolean" ||
    typeof user?.canAccessUserManagement === "boolean"
  ) {
    return Boolean(user.canAccessAgentManagement || user.canAccessUserManagement);
  }

  if (normalizedRole === "superadmin") {
    return true;
  }

  const appearsToOwnWorkspace =
    Boolean(user?.companyId) && !user?.createdBy && !user?.ownerId && !user?.parentUserId;
  if (appearsToOwnWorkspace) {
    return true;
  }

  return false;
};

export const resolveAgentWorkspaceState = (user = {}) => {
  const normalizedRole = String(user?.role || "").toLowerCase();
  const normalizedCompanyRole = String(user?.companyRole || "").toLowerCase();
  const hasWorkspaceManagementAccess =
    ["superadmin", "admin", "manager"].includes(normalizedRole) || normalizedCompanyRole === "admin";

  if (hasWorkspaceManagementAccess) {
    return false;
  }

  const appearsToOwnWorkspace =
    Boolean(user?.companyId) && !user?.createdBy && !user?.ownerId && !user?.parentUserId;
  if (appearsToOwnWorkspace) {
    return false;
  }

  return Boolean(
    user?.isAgentWorkspace === true ||
      normalizedRole === "agent" ||
      normalizedRole === "user" ||
      normalizedCompanyRole === "agent" ||
      normalizedCompanyRole === "user" ||
      (normalizedCompanyRole === "user" && Boolean(user?.createdBy || user?.ownerId || user?.parentUserId)) ||
      String(user?.workspaceAccessState || "").trim() === "agent_workspace"
  );
};

export const resolveWorkspaceManagementAccessState = (user = {}) => {
  const normalizedRole = String(user?.role || "").toLowerCase();
  const normalizedCompanyRole = String(user?.companyRole || "").toLowerCase();

  if (["superadmin", "admin", "manager"].includes(normalizedRole)) {
    return true;
  }

  if (normalizedCompanyRole === "admin") {
    return true;
  }

  return false;
};

export const resolveWorkspaceSettingsAccessState = (user = {}) =>
  resolveWorkspaceManagementAccessState(user) && user?.isEnabled !== false;

export const resolveWorkspaceOwnerId = (user = {}) =>
  String(user?.createdBy || user?.ownerId || user?.parentUserId || normalizeUserId(user)).trim();

export const resolveWorkspaceUserId = (user = {}) => normalizeUserId(user);

export const buildWorkspaceOwnershipPayload = (user = getStoredWorkspaceUser(), payload = {}, options = {}) => {
  const normalizedUser = user || {};
  if (!resolveAgentWorkspaceState(normalizedUser)) {
    return payload;
  }

  const workspaceUserId = resolveWorkspaceUserId(normalizedUser);
  if (!workspaceUserId) {
    return payload;
  }

  const scopeType = String(options?.scopeType || "createdBy").trim();
  const nextPayload = {
    ...payload,
    createdBy: workspaceUserId,
    ownerId: workspaceUserId,
    agentId: workspaceUserId
  };

  if (scopeType === "assignedTo" || options?.includeAssignedTo === true) {
    nextPayload.assignedTo = workspaceUserId;
  }

  if (String(normalizedUser?.companyId || "").trim()) {
    nextPayload.companyId = String(normalizedUser.companyId).trim();
  }

  if (String(normalizedUser?.createdBy || "").trim()) {
    nextPayload.parentUserId = String(normalizedUser.createdBy).trim();
  }

  return nextPayload;
};

export const buildWorkspaceQueryScope = (user = getStoredWorkspaceUser(), options = {}) => {
  const normalizedUser = user || {};
  if (!resolveAgentWorkspaceState(normalizedUser)) {
    return {};
  }

  const workspaceUserId = resolveWorkspaceUserId(normalizedUser);
  if (!workspaceUserId) {
    return {};
  }

  const scopeType = String(options?.scopeType || "createdBy").trim();
  const baseScope = {
    createdBy: workspaceUserId,
    ownerId: workspaceUserId,
    agentId: workspaceUserId
  };

  if (scopeType === "assignedTo" || options?.includeAssignedTo === true) {
    baseScope.assignedTo = workspaceUserId;
  }

  if (String(normalizedUser?.companyId || "").trim()) {
    baseScope.companyId = String(normalizedUser.companyId).trim();
  }

  return baseScope;
};

export const buildAgentAccessPayload = (user = {}) => {
  const isEnabled = resolveAgentAccessState(user);
  const hasWorkspaceManagementAccess = resolveWorkspaceManagementAccessState(user);
  const isAgentWorkspace = hasWorkspaceManagementAccess ? false : resolveAgentWorkspaceState(user);
  const workspaceOwnerId = resolveWorkspaceOwnerId(user);

  return {
    isEnabled,
    canAccessUserManagement: hasWorkspaceManagementAccess,
    canAccessAgentManagement: hasWorkspaceManagementAccess,
    isAgentWorkspace,
    workspaceOwnerId
  };
};
