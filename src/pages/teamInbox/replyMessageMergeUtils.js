const toCleanString = (value = '') => String(value || '').trim();

const getMessageIdentityKey = (message = {}) => {
  const messageId = toCleanString(message?._id || message?.id);
  if (messageId) return `id:${messageId}`;

  const whatsappMessageId = toCleanString(message?.whatsappMessageId);
  if (whatsappMessageId) return `wa:${whatsappMessageId}`;

  return '';
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
