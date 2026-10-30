import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

let vite;
let createInboxDataActions;
let whatsappService;
let teamInboxSessionCache;
let originalGetMessagesPage;

before(async () => {
  vite = await createServer({
    configFile: path.resolve(process.cwd(), 'vite.config.js'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent'
  });
  ({ createInboxDataActions } = await vite.ssrLoadModule('/src/pages/teamInbox/inboxDataActions.js'));
  ({ whatsappService } = await vite.ssrLoadModule('/src/services/whatsappService.js'));
  teamInboxSessionCache = await vite.ssrLoadModule('/src/pages/teamInbox/teamInboxSessionCache.js');
  originalGetMessagesPage = whatsappService.getMessagesPage;
});

after(async () => {
  if (whatsappService && originalGetMessagesPage) {
    whatsappService.getMessagesPage = originalGetMessagesPage;
  }
  await vite?.close();
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createHarness = (responses = []) => {
  const pendingResponses = [...responses];
  const state = {
    selectedConversationId: '',
    messages: [],
    hasMore: false,
    loading: false,
    olderLoading: false,
    threadCacheInfo: null
  };
  const activeMessagesConversationIdRef = { current: '' };
  const messageLoadRequestIdRef = { current: 0 };
  const messageLoadAbortControllerRef = { current: null };
  const messageCacheRef = { current: new Map() };
  const messagePaginationCacheRef = { current: new Map() };
  const messageLoadPromiseMapRef = { current: new Map() };
  const requestLog = [];

  whatsappService.getMessagesPage = (conversationId, options) => {
    requestLog.push({ conversationId, options });
    const response = pendingResponses.shift() || deferred();
    return response.promise;
  };

  const actions = createInboxDataActions({
    currentUserId: 'switch-test-user',
    currentUserDisplayName: 'Test Agent',
    currentUserInternalRole: 'agent',
    normalizeConversation: (value) => value,
    selectedWhatsAppState: { freeformAllowed: true },
    setLoading: () => {},
    setConversations: () => {},
    setMessages: (value) => {
      state.messages = typeof value === 'function' ? value(state.messages) : value;
    },
    setMessagesLoading: (value) => { state.loading = value; },
    setMessagesOlderLoading: (value) => { state.olderLoading = value; },
    setMessagesHasMore: (value) => { state.hasMore = value; },
    setThreadCacheInfo: (value) => { state.threadCacheInfo = value; },
    setInboxDebugInfo: () => {},
    selectedConversation: null,
    messages: state.messages,
    sendingMessage: false,
    messageInput: '',
    setSendingMessage: () => {},
    setMessageInput: () => {},
    upsertMessage: () => {},
    patchMessage: () => {},
    removeMessage: () => {},
    getConversationIdValue: (conversation) => conversation?._id || conversation?.id || '',
    conversationId: '',
    isRealName: () => true,
    getPhoneLookupKeys: () => [],
    setContactNameMap: () => {},
    activeMessagesConversationIdRef,
    messageLoadRequestIdRef,
    messageLoadAbortControllerRef,
    messageCacheRef,
    messagePaginationCacheRef,
    messageLoadPromiseMapRef,
    conversationLoadPromiseMapRef: { current: new Map() },
    conversationPageMetaRef: { current: {} },
    conversationLoadRequestIdRef: { current: 0 },
    threadCacheDisplaySourceRef: { current: 'unknown' },
    threadFreshSyncAtRef: { current: 0 },
    setConversationPageMeta: () => {},
    notifyActionFeedback: () => {},
    confirmAction: async () => true
  });

  // Mirrors TeamInbox's layout-effect handoff: invalidate the previous request,
  // associate the active ID, and synchronously select only that thread's cache.
  const selectConversation = (conversationId) => {
    const previousConversationId = activeMessagesConversationIdRef.current;
    if (previousConversationId === conversationId) return;
    state.selectedConversationId = conversationId;
    activeMessagesConversationIdRef.current = conversationId;
    messageLoadRequestIdRef.current += 1;
    messageLoadAbortControllerRef.current?.abort();
    messageLoadAbortControllerRef.current = null;
    if (previousConversationId) {
      messageLoadPromiseMapRef.current.delete(previousConversationId);
      for (const key of messageLoadPromiseMapRef.current.keys()) {
        if (key.startsWith(`${previousConversationId}::older::`)) {
          messageLoadPromiseMapRef.current.delete(key);
        }
      }
    }
    state.messages = messageCacheRef.current.get(conversationId) || [];
    state.hasMore = Boolean(messagePaginationCacheRef.current.get(conversationId)?.hasMore);
    state.loading = state.messages.length === 0;
    state.olderLoading = false;
  };

  return {
    actions,
    state,
    requestLog,
    refs: { activeMessagesConversationIdRef, messageLoadRequestIdRef, messageLoadAbortControllerRef, messageCacheRef, messagePaginationCacheRef, messageLoadPromiseMapRef },
    selectConversation
  };
};

const responseFor = (conversationId, suffix = 'new') => ({
  ok: true,
  data: [{ _id: `${conversationId}-${suffix}`, conversationId, text: `${conversationId} message` }],
  meta: { hasMore: false, nextCursor: null, limit: 20 }
});

test('late Customer A response cannot replace Customer B (critical race)', async () => {
  const responseA = deferred();
  const responseB = deferred();
  const harness = createHarness([responseA, responseB]);

  harness.selectConversation('customer-A');
  const loadA = harness.actions.loadMessages('customer-A', { reason: 'selection_load' });
  const signalA = harness.requestLog[0].options.signal;

  harness.selectConversation('customer-B');
  const loadB = harness.actions.loadMessages('customer-B', { reason: 'selection_load' });
  assert.equal(signalA.aborted, true, 'switching away aborts A request');

  responseB.resolve(responseFor('customer-B'));
  await loadB;
  responseA.resolve(responseFor('customer-A'));
  await loadA;

  assert.equal(harness.state.selectedConversationId, 'customer-B');
  assert.deepEqual(harness.state.messages.map((message) => message.conversationId), ['customer-B']);
  assert.equal(harness.refs.messageCacheRef.current.has('customer-A'), false);
});

test('Customer A resolving before B also cannot change the selected thread', async () => {
  const responseA = deferred();
  const responseB = deferred();
  const harness = createHarness([responseA, responseB]);

  harness.selectConversation('customer-A');
  const loadA = harness.actions.loadMessages('customer-A');
  harness.selectConversation('customer-B');
  const loadB = harness.actions.loadMessages('customer-B');

  responseA.resolve(responseFor('customer-A'));
  await loadA;
  assert.deepEqual(harness.state.messages, [], 'no A messages render while B is selected');

  responseB.resolve(responseFor('customer-B'));
  await loadB;
  assert.equal(harness.state.selectedConversationId, 'customer-B');
  assert.deepEqual(harness.state.messages.map((message) => message.conversationId), ['customer-B']);
});

test('rapid switching across 10 conversations accepts only the final response', async () => {
  const responses = Array.from({ length: 10 }, () => deferred());
  const harness = createHarness(responses);
  const loads = [];

  for (let index = 0; index < 10; index += 1) {
    const conversationId = `customer-${index}`;
    harness.selectConversation(conversationId);
    loads.push(harness.actions.loadMessages(conversationId));
  }

  for (let index = 8; index >= 0; index -= 1) {
    responses[index].resolve(responseFor(`customer-${index}`));
    await loads[index];
    assert.equal(harness.state.selectedConversationId, 'customer-9');
    assert.ok(harness.state.messages.every((message) => message.conversationId === 'customer-9'));
  }
  responses[9].resolve(responseFor('customer-9'));
  await loads[9];

  assert.deepEqual(harness.state.messages.map((message) => message.conversationId), ['customer-9']);
  assert.equal(harness.refs.messageCacheRef.current.has('customer-0'), false);
});

test('pagination response is rejected after switching conversations', async () => {
  const olderResponse = deferred();
  const harness = createHarness([olderResponse]);
  const initialMessages = Array.from({ length: 20 }, (_, index) => ({ _id: `A-${index}`, conversationId: 'A' }));
  harness.refs.activeMessagesConversationIdRef.current = 'A';
  harness.state.selectedConversationId = 'A';
  harness.state.messages = initialMessages;
  harness.refs.messageCacheRef.current.set('A', initialMessages);
  harness.refs.messagePaginationCacheRef.current.set('A', { hasMore: true, nextCursor: 'A-oldest', limit: 20 });

  const olderLoad = harness.actions.loadMessages('A', { loadOlder: true });
  assert.equal(harness.requestLog[0].options.cursor, 'A-oldest');
  harness.selectConversation('B');
  olderResponse.resolve({
    ok: true,
    data: [{ _id: 'A-older', conversationId: 'A', text: 'old page' }],
    meta: { hasMore: false, nextCursor: null, limit: 20 }
  });
  await olderLoad;

  assert.equal(harness.state.selectedConversationId, 'B');
  assert.deepEqual(harness.state.messages, []);
  assert.deepEqual(harness.refs.messageCacheRef.current.get('A'), initialMessages);
});

test('old request cleanup cannot delete a newer request for the same conversation', async () => {
  const first = deferred();
  const responseB = deferred();
  const second = deferred();
  const harness = createHarness([first, responseB, second]);

  harness.selectConversation('A');
  const firstLoad = harness.actions.loadMessages('A');
  harness.selectConversation('B');
  const bLoad = harness.actions.loadMessages('B');
  harness.selectConversation('A');
  const secondLoad = harness.actions.loadMessages('A');
  const secondPromise = harness.refs.messageLoadPromiseMapRef.current.get('A');
  assert.ok(secondPromise);

  first.resolve(responseFor('A', 'old'));
  await firstLoad;
  assert.equal(harness.refs.messageLoadPromiseMapRef.current.get('A'), secondPromise);

  responseB.resolve(responseFor('B'));
  second.resolve(responseFor('A', 'new'));
  await secondLoad;
  await bLoad;
  assert.deepEqual(harness.state.messages.map((message) => message._id), ['A-new']);
});

test('persistent cache keeps each conversation separate and restores its own messages', () => {
  const currentUserId = `rapid-switch-cache-${Date.now()}`;
  teamInboxSessionCache.clearTeamInboxThreadCache({ currentUserId });
  teamInboxSessionCache.writeTeamInboxThreadCache({
    currentUserId,
    conversationId: 'A',
    messages: [{ _id: 'A-1', conversationId: 'A', text: 'A cached' }],
    meta: { hasMore: true, nextCursor: 'A-next' }
  });
  teamInboxSessionCache.writeTeamInboxThreadCache({
    currentUserId,
    conversationId: 'B',
    messages: [{ _id: 'B-1', conversationId: 'B', text: 'B cached' }],
    meta: { hasMore: false }
  });

  const cachedA = teamInboxSessionCache.readTeamInboxThreadCache({ currentUserId, conversationId: 'A' });
  const cachedB = teamInboxSessionCache.readTeamInboxThreadCache({ currentUserId, conversationId: 'B' });
  assert.deepEqual(cachedA.messages.map((message) => message.conversationId), ['A']);
  assert.deepEqual(cachedB.messages.map((message) => message.conversationId), ['B']);
  assert.equal(cachedA.meta.nextCursor, 'A-next');
  teamInboxSessionCache.clearTeamInboxThreadCache({ currentUserId });
});

test('switching from a 1000-message thread shows only the next conversation cache immediately', () => {
  const harness = createHarness();
  const thousandA = Array.from({ length: 1000 }, (_, index) => ({
    _id: `A-${index}`,
    conversationId: 'A',
    text: 'Customer A message'
  }));
  const cachedB = Array.from({ length: 20 }, (_, index) => ({
    _id: `B-${index}`,
    conversationId: 'B',
    text: 'Customer B message'
  }));
  harness.refs.messageCacheRef.current.set('A', thousandA);
  harness.refs.messageCacheRef.current.set('B', cachedB);

  harness.selectConversation('A');
  assert.equal(harness.state.messages.length, 1000);
  harness.selectConversation('B');

  assert.equal(harness.state.selectedConversationId, 'B');
  assert.equal(harness.state.messages.length, 20);
  assert.ok(harness.state.messages.every((message) => message.conversationId === 'B'));
  assert.equal(harness.state.loading, false);
});

test('Team Inbox selection and Socket.IO source retain active-thread guards and listener cleanup', async () => {
  const teamInboxSource = await fs.readFile(path.resolve('src/pages/TeamInbox.jsx'), 'utf8');
  const realtimeSource = await fs.readFile(path.resolve('src/pages/teamInbox/useInboxRealtimeEffects.js'), 'utf8');
  assert.match(teamInboxSource, /activeMessagesConversationIdRef\.current = nextConversationId/);
  assert.match(teamInboxSource, /messageLoadAbortControllerRef\.current\.abort\(\)/);
  assert.match(teamInboxSource, /messageCacheRef\.current\.get\(nextConversationId\)/);
  assert.match(realtimeSource, /if \(conversationId && activeId && !isActiveThreadEvent\)/);
  assert.match(realtimeSource, /webSocketService\.on\('new_message', handleNewMessage\)/);
  assert.match(realtimeSource, /webSocketService\.off\('new_message', handleNewMessage\)/);
  assert.match(realtimeSource, /webSocketService\.off\('message_received', handleNewMessage\)/);
});
