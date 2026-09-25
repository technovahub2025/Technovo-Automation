import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getActivitySections } from '../src/utils/activitySections.js';

test('activity sections cover all primary work modules', () => {
  for (const route of ['/broadcast', '/templates', '/contacts', '/inbox', '/crm/pipeline', '/crm/tasks', '/crm/deals', '/crm/meetings', '/ads-manager', '/meta-ads-manager', '/whatsapp-workflow', '/voice-broadcast', '/voice-automation/inbound', '/voice-automation/outbound', '/voice-automation/outbound/schedules', '/voice-automation/history', '/missedcalls/calls', '/email-automation/dashboard']) {
    assert.ok(getActivitySections(route)?.length, route);
  }
  assert.equal(getActivitySections('/templates/create'), null);
  assert.equal(getActivitySections('/settings/agent-management'), null);
  assert.equal(getActivitySections('/inbox/contact-id')[0].kind, 'messages');
});
