export const activityCreatorId = (record = {}) => {
  const creator = record.createdById || record.createdBy;
  return String(creator?._id || creator?.id || creator || '').trim();
};

export const activityCreatorLabel = (record = {}, byId = new Map()) =>
  byId.get(activityCreatorId(record))?.label || record.createdByName ||
  record.createdBy?.username || record.createdBy?.name ||
  (typeof record.createdBy === 'string' && !/^[a-f\d]{24}$/i.test(record.createdBy) ? record.createdBy : '') ||
  record.createdByEmail || 'Unknown creator';

export const resolveActivityCreator = (record, creators) => {
  const byId = new Map(creators.map((creator) => [creator.value, creator]));
  const creator = byId.get(activityCreatorId(record));
  const name = activityCreatorLabel(record, byId);
  return {
    ...record,
    createdBy: name,
    createdByName: name,
    // The current workspace owner is the non-agent entry in this directory.
    // Make its role explicit so the table can label admin and agent rows alike.
    createdByWorkspaceRole: creator
      ? (creator.isAgent ? 'agent' : 'admin')
      : record.createdByWorkspaceRole,
  };
};
