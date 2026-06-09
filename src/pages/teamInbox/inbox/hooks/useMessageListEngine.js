import { useCallback, useMemo, useState } from 'react';
import { mergeMessagePreservingReplyContext } from '../../replyMessageMergeUtils';

const toCleanString = (value = '') => String(value || '').trim();

const getMessageIdentityKeys = (message = {}) => {
  const keys = [];
  const messageId = toCleanString(message?._id || message?.id);
  if (messageId) keys.push(`id:${messageId}`);

  const whatsappMessageId = toCleanString(message?.whatsappMessageId);
  if (whatsappMessageId) keys.push(`wa:${whatsappMessageId}`);

  const pipelineRequestId = toCleanString(message?.mediaPipelineRequestId);
  if (pipelineRequestId) keys.push(`media:${pipelineRequestId}`);

  return keys;
};

const getIdentityCandidates = (value = '') => {
  const normalized = toCleanString(value);
  if (!normalized) return [];
  return Array.from(
    new Set([normalized, `id:${normalized}`, `wa:${normalized}`, `media:${normalized}`])
  );
};

const getMessageIdentityKey = (message = {}) => {
  return getMessageIdentityKeys(message)[0] || '';
};

const getStorageKey = (message = {}, fallbackIndex = 0) => {
  const identityKey = getMessageIdentityKey(message);
  if (identityKey) return identityKey;
  return `fallback:${fallbackIndex}:${toCleanString(message?.timestamp || message?.createdAt || Date.now())}`;
};

const getMessageSortTimestamp = (message = {}) => {
  const rawTimestamp = message?.timestamp || message?.whatsappTimestamp || message?.createdAt || Date.now();
  const parsedTimestamp = new Date(rawTimestamp);
  const numericTimestamp = parsedTimestamp.valueOf();
  return Number.isFinite(numericTimestamp) ? numericTimestamp : 0;
};

const buildLookupMap = (byId = new Map(), order = []) => {
  const lookup = new Map();
  (Array.isArray(order) ? order : []).forEach((messageId) => {
    const message = byId.get(messageId);
    if (!message) return;
    lookup.set(messageId, message);
    getMessageIdentityKeys(message).forEach((identityKey) => {
      if (!lookup.has(identityKey)) {
        lookup.set(identityKey, message);
      }
    });
  });
  return lookup;
};

const getInsertIndex = (order = [], byId = new Map(), incomingMessage = {}) => {
  const incomingIdentity = getMessageIdentityKey(incomingMessage);
  if (!incomingIdentity) return order.length;

  const incomingTimestamp = getMessageSortTimestamp(incomingMessage);
  for (let index = 0; index < order.length; index += 1) {
    const messageId = order[index];
    const currentMessage = byId.get(messageId);
    if (!currentMessage) continue;

    const currentTimestamp = getMessageSortTimestamp(currentMessage);
    if (currentTimestamp < incomingTimestamp) continue;
    if (currentTimestamp > incomingTimestamp) return index;

    const currentIdentity =
      getMessageIdentityKey(currentMessage) ||
      toCleanString(currentMessage?._id || currentMessage?.id || currentMessage?.whatsappMessageId);
    if (currentIdentity.localeCompare(incomingIdentity) > 0) {
      return index;
    }
  }

  return order.length;
};

const buildStoreFromArray = (messages = []) => {
  const byId = new Map();
  const order = [];

  (Array.isArray(messages) ? messages : []).forEach((message) => {
    const storageKey = getStorageKey(message, order.length);

    const previous = byId.get(storageKey);
    const nextMessage = previous
      ? mergeMessagePreservingReplyContext(previous, message)
      : message;

    if (byId.has(storageKey)) {
      const existingIndex = order.indexOf(storageKey);
      if (existingIndex >= 0) order.splice(existingIndex, 1);
    }

    byId.set(storageKey, nextMessage);
    order.push(storageKey);
  });

  return {
    byId,
    order,
    lookup: buildLookupMap(byId, order)
  };
};

const replaceLookupEntries = (lookup = new Map(), messageKey = '', previousMessage = null, nextMessage = null) => {
  const nextLookup = new Map(lookup);
  const previousIdentityKeys = previousMessage ? getMessageIdentityKeys(previousMessage) : [];
  const nextIdentityKeys = nextMessage ? getMessageIdentityKeys(nextMessage) : [];

  if (messageKey) {
    nextLookup.delete(messageKey);
  }

  previousIdentityKeys.forEach((identityKey) => {
    if (!nextIdentityKeys.includes(identityKey)) {
      nextLookup.delete(identityKey);
    }
  });

  if (nextMessage) {
    if (messageKey) {
      nextLookup.set(messageKey, nextMessage);
    }
    nextIdentityKeys.forEach((identityKey) => {
      nextLookup.set(identityKey, nextMessage);
    });
  }

  return nextLookup;
};

const findExistingMessageKey = (store = {}, incomingMessage = {}) => {
  const identities =
    typeof incomingMessage === 'string'
      ? getIdentityCandidates(incomingMessage)
      : getMessageIdentityKeys(incomingMessage);
  for (const identityKey of identities) {
    const directMatch = store.byId?.get(identityKey);
    if (directMatch) return identityKey;
    const lookupMatch = store.lookup?.get(identityKey);
    if (lookupMatch) {
      const directKey =
        getMessageIdentityKey(lookupMatch) ||
        getStorageKey(lookupMatch, Array.isArray(store.order) ? store.order.length : 0);
      if (directKey && store.byId?.has(directKey)) {
        return directKey;
      }
    }
  }
  return '';
};

const insertMessageIntoStore = (store, incomingMessage = {}) => {
  const identityKey = getStorageKey(incomingMessage, Array.isArray(store.order) ? store.order.length : 0);

  const previous = store.byId.get(identityKey);
  const nextMessage = previous
    ? mergeMessagePreservingReplyContext(previous, incomingMessage)
    : incomingMessage;

  const nextById = new Map(store.byId);
  nextById.set(identityKey, nextMessage);

  const nextOrder = (Array.isArray(store.order) ? store.order : []).filter((key) => key !== identityKey);
  const insertIndex = getInsertIndex(nextOrder, nextById, nextMessage);
  nextOrder.splice(insertIndex, 0, identityKey);

  return {
    byId: nextById,
    order: nextOrder,
    lookup: buildLookupMap(nextById, nextOrder)
  };
};

const upsertMessageIntoStore = (store, incomingMessage = {}) => {
  const existingKey = findExistingMessageKey(store, incomingMessage);
  const identityKey =
    existingKey || getStorageKey(incomingMessage, Array.isArray(store.order) ? store.order.length : 0);

  const previous = store.byId.get(identityKey) || store.lookup?.get(getMessageIdentityKey(incomingMessage));
  const nextMessage = previous
    ? mergeMessagePreservingReplyContext(previous, incomingMessage)
    : incomingMessage;

  const nextById = new Map(store.byId);
  nextById.set(identityKey, nextMessage);

  const nextOrder = Array.isArray(store.order) ? [...store.order] : [];
  if (!existingKey) {
    const insertIndex = getInsertIndex(nextOrder, nextById, nextMessage);
    nextOrder.splice(insertIndex, 0, identityKey);
  }

  return {
    byId: nextById,
    order: nextOrder,
    lookup: replaceLookupEntries(store.lookup, identityKey, previous, nextMessage)
  };
};

const patchMessageIntoStore = (store, messageIdentity = {}, patch = {}) => {
  const targetMessage = typeof messageIdentity === 'object' && messageIdentity ? messageIdentity : null;
  const lookupCandidates =
    typeof messageIdentity === 'string'
      ? getIdentityCandidates(messageIdentity)
      : getMessageIdentityKeys(messageIdentity);

  let messageKey = lookupCandidates.find((candidate) => store.byId?.has(candidate)) || '';
  let existingMessage = messageKey ? store.byId.get(messageKey) : null;

  if (!existingMessage) {
    const lookupMatchKey = lookupCandidates.find((candidate) => store.lookup?.has(candidate)) || '';
    existingMessage = lookupMatchKey ? store.lookup.get(lookupMatchKey) : null;
    if (existingMessage) {
      messageKey =
        getMessageIdentityKey(existingMessage) ||
        getStorageKey(existingMessage, Array.isArray(store.order) ? store.order.length : 0);
    }
  }

  if (!existingMessage && targetMessage) {
    messageKey = findExistingMessageKey(store, targetMessage);
    existingMessage = messageKey ? store.byId.get(messageKey) || store.lookup?.get(messageKey) : null;
  }

  if (!existingMessage || !messageKey) return store;

  const nextMessage =
    typeof patch === 'function'
      ? patch(existingMessage)
      : {
          ...existingMessage,
          ...(patch || {})
        };

  if (!nextMessage || nextMessage === existingMessage) return store;

  const nextById = new Map(store.byId);
  nextById.set(messageKey, nextMessage);

  return {
    byId: nextById,
    order: store.order,
    lookup: replaceLookupEntries(store.lookup, messageKey, existingMessage, nextMessage)
  };
};

const removeMessageFromStore = (store, messageId = '') => {
  const normalizedMessageId = toCleanString(messageId);
  if (!normalizedMessageId) return store;
  const identityCandidates = getIdentityCandidates(normalizedMessageId);

  const nextById = new Map(store.byId);
  const nextLookup = new Map(store.lookup);
  let removed = false;
  (Array.isArray(store.order) ? store.order : []).forEach((key) => {
    const message = store.byId.get(key);
    const identityKeys = getMessageIdentityKeys(message);
    const rawKeys = [key, ...identityKeys];
    const matched =
      rawKeys.some((candidate) => identityCandidates.includes(candidate)) ||
      identityKeys.some((candidate) => identityCandidates.includes(candidate.replace(/^(id|wa|media):/, '')));
    if (matched) {
      nextById.delete(key);
      nextLookup.delete(key);
      identityKeys.forEach((identityKey) => nextLookup.delete(identityKey));
      removed = true;
    }
  });
  if (!removed) return store;

  const nextOrder = (Array.isArray(store.order) ? store.order : []).filter((key) => nextById.has(key));

  return {
    byId: nextById,
    order: nextOrder,
    lookup: nextLookup
  };
};

export const useMessageListEngine = (initialMessages = []) => {
  const [store, setStore] = useState(() => buildStoreFromArray(initialMessages));

  const setMessages = useCallback((nextValue) => {
    setStore((prevStore) => {
      const prevArray = prevStore.order.map((messageId) => prevStore.byId.get(messageId)).filter(Boolean);
      const nextArray =
        typeof nextValue === 'function' ? nextValue(prevArray) : Array.isArray(nextValue) ? nextValue : [];
      return buildStoreFromArray(nextArray);
    });
  }, []);

  const appendMessageUnique = useCallback((incomingMessage) => {
    if (!incomingMessage) return;
    setStore((prevStore) => insertMessageIntoStore(prevStore, incomingMessage));
  }, []);

  const upsertMessage = useCallback((incomingMessage) => {
    if (!incomingMessage) return;
    setStore((prevStore) => upsertMessageIntoStore(prevStore, incomingMessage));
  }, []);

  const patchMessage = useCallback((messageIdentity, patch) => {
    if (!messageIdentity) return;
    setStore((prevStore) => patchMessageIntoStore(prevStore, messageIdentity, patch));
  }, []);

  const removeMessage = useCallback((messageId) => {
    setStore((prevStore) => removeMessageFromStore(prevStore, messageId));
  }, []);

  const messages = useMemo(
    () => store.order.map((messageId) => store.byId.get(messageId)).filter(Boolean),
    [store]
  );

  return {
    messages,
    setMessages,
    appendMessageUnique,
    upsertMessage,
    patchMessage,
    removeMessage,
    messageLookupMap: store.lookup,
    messageOrder: store.order
  };
};
