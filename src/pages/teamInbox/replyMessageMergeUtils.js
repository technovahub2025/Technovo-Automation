const toCleanString = (value = '') => String(value || '').trim();

const getMessageIdentityKey = (message = {}) => {
  const messageId = toCleanString(message?._id || message?.id);
  if (messageId) return `id:${messageId}`;

  const whatsappMessageId = toCleanString(message?.whatsappMessageId);
  if (whatsappMessageId) return `wa:${whatsappMessageId}`;

  return '';
};

const getMessageSortTimestamp = (message = {}) => {
  const rawTimestamp =
    message?.timestamp || message?.whatsappTimestamp || message?.createdAt || Date.now();
  const parsedTimestamp = new Date(rawTimestamp);
  const numericTimestamp = parsedTimestamp.valueOf();
  return Number.isFinite(numericTimestamp) ? numericTimestamp : 0;
};

export const mergeMessagePreservingReplyContext = (existingMessage = {}, incomingMessage = {}) => {
  const merged = {
    ...existingMessage,
    ...incomingMessage
  };

  const incomingReplyTo =
    incomingMessage?.replyTo && typeof incomingMessage.replyTo === 'object'
      ? incomingMessage.replyTo
      : null;
  const existingReplyTo =
    existingMessage?.replyTo && typeof existingMessage.replyTo === 'object'
      ? existingMessage.replyTo
      : null;

  if (incomingReplyTo || existingReplyTo) {
    merged.replyTo = incomingReplyTo || existingReplyTo;
  }

  const replyToMessageId = toCleanString(
    incomingMessage?.replyToMessageId ||
      incomingMessage?.replyTo?._id ||
      incomingMessage?.replyTo?.id ||
      existingMessage?.replyToMessageId ||
      existingMessage?.replyTo?._id ||
      existingMessage?.replyTo?.id
  );
  if (replyToMessageId) {
    merged.replyToMessageId = replyToMessageId;
  }

  const whatsappContextMessageId = toCleanString(
    incomingMessage?.whatsappContextMessageId || existingMessage?.whatsappContextMessageId
  );
  if (whatsappContextMessageId) {
    merged.whatsappContextMessageId = whatsappContextMessageId;
  }

  return merged;
};

export const mergeFetchedMessagesPreservingReplyContext = (
  existingMessages = [],
  fetchedMessages = []
) => {
  const existingByIdentity = new Map();
  (Array.isArray(existingMessages) ? existingMessages : []).forEach((message) => {
    const identityKey = getMessageIdentityKey(message);
    if (!identityKey) return;
    existingByIdentity.set(identityKey, message);
  });

  return (Array.isArray(fetchedMessages) ? fetchedMessages : []).map((message) => {
    const identityKey = getMessageIdentityKey(message);
    if (!identityKey || !existingByIdentity.has(identityKey)) {
      return message;
    }
    return mergeMessagePreservingReplyContext(existingByIdentity.get(identityKey), message);
  });
};

export const mergeOrderedMessagesPreservingReplyContext = (...messageLists) => {
  const mergedByIdentity = new Map();
  const fallbackMessages = [];

  messageLists.forEach((messages = []) => {
    (Array.isArray(messages) ? messages : []).forEach((message = {}) => {
      const identityKey = getMessageIdentityKey(message);
      if (!identityKey) {
        fallbackMessages.push(message);
        return;
      }

      const existingMessage = mergedByIdentity.get(identityKey);
      mergedByIdentity.set(
        identityKey,
        existingMessage
          ? mergeMessagePreservingReplyContext(existingMessage, message)
          : message
      );
    });
  });

  return [...mergedByIdentity.values(), ...fallbackMessages].sort((leftMessage, rightMessage) => {
    const timestampDifference =
      getMessageSortTimestamp(leftMessage) - getMessageSortTimestamp(rightMessage);
    if (timestampDifference !== 0) return timestampDifference;

    const leftIdentity =
      getMessageIdentityKey(leftMessage) ||
      toCleanString(leftMessage?._id || leftMessage?.id || leftMessage?.whatsappMessageId);
    const rightIdentity =
      getMessageIdentityKey(rightMessage) ||
      toCleanString(rightMessage?._id || rightMessage?.id || rightMessage?.whatsappMessageId);
    return leftIdentity.localeCompare(rightIdentity);
  });
};
