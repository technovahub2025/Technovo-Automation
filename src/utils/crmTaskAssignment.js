export const getTaskAssigneeForEdit = (task = {}) => String(task?.assignedTo || '').trim();
