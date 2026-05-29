export const createConversationStoreState = (conversations = []) => ({
  byId: new Map(),
  order: [],
  lookup: new Map(),
  conversations: Array.isArray(conversations) ? conversations : []
});
