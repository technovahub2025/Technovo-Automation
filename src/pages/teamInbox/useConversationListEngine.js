import { useCallback, useMemo, useState } from 'react';
import {
  getConversationIdValue,
  getConversationSortTimestamp,
  mergeConversationRecords,
  normalizeConversation
} from './teamInboxUtils';

const toConversationId = (conversation) => getConversationIdValue(conversation);

const buildLookupMap = (byId = new Map(), order = []) => {
  const lookup = new Map();

  (Array.isArray(order) ? order : []).forEach((conversationId) => {
    const conversation = byId.get(conversationId);
    if (!conversation) return;

    lookup.set(conversationId, conversation);

    const summaryId = String(conversation?.summaryId || '').trim();
    if (summaryId && !lookup.has(summaryId)) {
      lookup.set(summaryId, conversation);
    }
  });

  return lookup;
};

const getInsertIndex = (order = [], byId = new Map(), incomingConversation = {}) => {
  const incomingConversationId = toConversationId(incomingConversation);
  if (!incomingConversationId) return 0;

  const incomingTimestamp = getConversationSortTimestamp(incomingConversation);
  if (!Number.isFinite(incomingTimestamp) || incomingTimestamp <= 0) {
    return order.length;
  }

  for (let index = 0; index < order.length; index += 1) {
    const conversationId = order[index];
    const currentConversation = byId.get(conversationId);
    if (!currentConversation) continue;

    const currentTimestamp = getConversationSortTimestamp(currentConversation);
    if (currentTimestamp < incomingTimestamp) {
      return index;
    }

    if (currentTimestamp === incomingTimestamp) {
      const currentId = String(conversationId || '');
      if (currentId.localeCompare(incomingConversationId) < 0) {
        return index;
      }
    }
  }

  return order.length;
};

const insertConversationIntoStore = (store, incomingConversation = {}) => {
  const normalized = normalizeConversation(incomingConversation || {});
  const conversationId = toConversationId(normalized);
  if (!conversationId) return store;

  const previous = store.byId.get(conversationId);
  const nextConversation = previous
    ? mergeConversationRecords(previous, normalized)
    : normalized;

  const nextById = new Map(store.byId);
  nextById.set(conversationId, nextConversation);

  const nextOrder = (Array.isArray(store.order) ? store.order : []).filter(
    (id) => id !== conversationId
  );
  const insertIndex = getInsertIndex(nextOrder, nextById, nextConversation);
  nextOrder.splice(insertIndex, 0, conversationId);

  return {
    byId: nextById,
    order: nextOrder,
    lookup: buildLookupMap(nextById, nextOrder)
  };
};

const patchConversationInStore = (
  store,
  conversationId = '',
  patch = {},
  { reorder = false } = {}
) => {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) return store;

  const existingConversation = store.byId.get(normalizedConversationId);
  if (!existingConversation) return store;

  const nextConversation =
    typeof patch === 'function'
      ? normalizeConversation(patch(existingConversation))
      : mergeConversationRecords(existingConversation, patch);

  const nextById = new Map(store.byId);
  nextById.set(normalizedConversationId, nextConversation);

  let nextOrder = Array.isArray(store.order) ? [...store.order] : [];
  if (reorder) {
    nextOrder = nextOrder.filter((id) => id !== normalizedConversationId);
    const insertIndex = getInsertIndex(nextOrder, nextById, nextConversation);
    nextOrder.splice(insertIndex, 0, normalizedConversationId);
  }

  return {
    byId: nextById,
    order: nextOrder,
    lookup: buildLookupMap(nextById, nextOrder)
  };
};

const removeConversationFromStore = (store, conversationId = '') => {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) return store;
  if (!store.byId.has(normalizedConversationId)) return store;

  const nextById = new Map(store.byId);
  nextById.delete(normalizedConversationId);

  const nextOrder = (Array.isArray(store.order) ? store.order : []).filter(
    (id) => id !== normalizedConversationId
  );

  return {
    byId: nextById,
    order: nextOrder,
    lookup: buildLookupMap(nextById, nextOrder)
  };
};

const buildStoreFromArray = (conversations = []) => {
  let store = {
    byId: new Map(),
    order: [],
    lookup: new Map()
  };

  (Array.isArray(conversations) ? conversations : []).forEach((conversation) => {
    store = insertConversationIntoStore(store, conversation);
  });

  return store;
};

export const useConversationListEngine = (initialConversations = []) => {
  const [store, setStore] = useState(() => buildStoreFromArray(initialConversations));

  const setConversations = useCallback((nextValue) => {
    setStore((prevStore) => {
      const prevArray = prevStore.order.map((conversationId) => prevStore.byId.get(conversationId)).filter(Boolean);
      const nextArray =
        typeof nextValue === 'function' ? nextValue(prevArray) : Array.isArray(nextValue) ? nextValue : [];
      return buildStoreFromArray(nextArray);
    });
  }, []);

  const conversations = useMemo(
    () => store.order.map((conversationId) => store.byId.get(conversationId)).filter(Boolean),
    [store]
  );

  const upsertConversation = useCallback((incomingConversation) => {
    setStore((prevStore) => insertConversationIntoStore(prevStore, incomingConversation));
  }, []);

  const patchConversation = useCallback((conversationId, patch, options = {}) => {
    setStore((prevStore) => patchConversationInStore(prevStore, conversationId, patch, options));
  }, []);

  const removeConversation = useCallback((conversationId) => {
    setStore((prevStore) => removeConversationFromStore(prevStore, conversationId));
  }, []);

  return {
    conversations,
    setConversations,
    upsertConversation,
    patchConversation,
    removeConversation,
    conversationByIdMap: store.byId,
    conversationLookupMap: store.lookup,
    conversationOrder: store.order
  };
};
