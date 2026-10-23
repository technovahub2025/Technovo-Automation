export const getTaskAssigneeForEdit = (task = {}) => String(task?.assignedTo || '').trim();

export const normalizeTaskUserId = (value) => {
  const raw = value && typeof value === 'object'
    ? value.userId || value.id || value._id || value.agentId || ''
    : value;
  return String(raw || '').trim().toLowerCase();
};

export const resolveAuthenticatedTaskUserId = (user = {}) => normalizeTaskUserId(user);

export const isCurrentTaskUser = (user, currentUserId) => {
  const userId = normalizeTaskUserId(user);
  const authenticatedId = normalizeTaskUserId(currentUserId);
  return Boolean(userId && authenticatedId && userId === authenticatedId);
};

export const getTaskUserDisplayLabel = (user = {}, currentUserId = '') => {
  const name = String(
    user?.name || user?.displayName || user?.fullName || user?.username || user?.email || ''
  ).trim();
  const label = name || normalizeTaskUserId(user) || 'Unknown user';
  return isCurrentTaskUser(user, currentUserId) ? `${label} (Me)` : label;
};

export const isActiveTaskAssignee = (user = {}) =>
  user?.isEnabled !== false && user?.isActive !== false;
