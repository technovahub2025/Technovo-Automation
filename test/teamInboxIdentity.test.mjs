import test from 'node:test';
import assert from 'node:assert/strict';

import {
  doesConversationMatchSearch,
  findConversationByContactIdentity,
  getPhoneLookupKeys,
  matchesPhoneLookup
} from '../src/pages/teamInbox/teamInboxIdentityUtils.js';
import { filterConversations } from '../src/pages/teamInbox/teamInboxDisplayUtils.js';

test('getPhoneLookupKeys keeps full and last-10-digit phone variants', () => {
  assert.deepEqual(getPhoneLookupKeys('+91 98765-43210'), ['919876543210', '9876543210']);
});

test('matchesPhoneLookup matches formatted phone numbers consistently', () => {
  assert.equal(matchesPhoneLookup('+91 98765 43210', '9876543210'), true);
  assert.equal(matchesPhoneLookup('+1 (555) 123-4567', '5551234567'), true);
  assert.equal(matchesPhoneLookup('+1 (555) 123-4567', '1112223333'), false);
});

test('doesConversationMatchSearch matches mapped display names and normalized phone queries', () => {
  const conversation = {
    contactPhone: '+91 98765 43210',
    lastMessagePreviewText: 'Need pricing details'
  };

  assert.equal(
    doesConversationMatchSearch({
      conversation,
      searchTerm: 'nandha',
      getConversationDisplayName: () => 'Nandha'
    }),
    true
  );

  assert.equal(
    doesConversationMatchSearch({
      conversation,
      searchTerm: '9876543210',
      getConversationDisplayName: () => 'Nandha'
    }),
    true
  );
});

test('findConversationByContactIdentity prefers normalized phone matches and falls back to exact names', () => {
  const conversations = [
    { _id: 'a', contactPhone: '+91 98765 43210', contactId: { name: '' } },
    { _id: 'b', contactPhone: '+1 555 000 1111', contactId: { name: 'Support Desk' } }
  ];

  assert.equal(
    findConversationByContactIdentity({
      conversations,
      phoneNumber: '9876543210',
      contactName: '',
      getConversationDisplayName: () => ''
    })?._id,
    'a'
  );

  assert.equal(
    findConversationByContactIdentity({
      conversations,
      phoneNumber: '',
      contactName: 'Support Desk',
      getConversationDisplayName: (conversation) => conversation?.contactId?.name || ''
    })?._id,
    'b'
  );
});

test('filterConversations includes mapped display names in search results', () => {
  const conversations = [
    {
      _id: '1',
      contactPhone: '+91 98765 43210',
      lastMessagePreviewText: 'Need pricing details',
      unreadCount: 0
    },
    {
      _id: '2',
      contactPhone: '+1 555 000 1111',
      contactId: { name: 'Support Desk' },
      lastMessagePreviewText: 'Resolved',
      unreadCount: 0
    }
  ];

  const filtered = filterConversations({
    conversations,
    searchTerm: 'nandha',
    conversationFilter: 'all',
    getUnreadCount: (conversation) => Number(conversation?.unreadCount || 0),
    getConversationDisplayName: (conversation) =>
      String(conversation?._id || '') === '1'
        ? 'Nandha'
        : String(conversation?.contactId?.name || '').trim()
  });

  assert.deepEqual(
    filtered.map((conversation) => conversation._id),
    ['1']
  );
});
