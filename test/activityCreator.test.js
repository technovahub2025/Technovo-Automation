import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActivityCreator, activityCreatorLabel } from '../src/utils/activityCreator.js';

const creators = [
  { value: 'admin-id', label: 'Qtech services', isAgent: false },
  { value: 'agent-id', label: 'lirisha', isAgent: true },
];

test('admin display and filter use the agent name despite stale saved labels', () => {
  const broadcast = { createdById: 'agent-id', createdBy: 'Qtech services', createdByName: 'Qtech services' };
  const resolved = resolveActivityCreator(broadcast, creators);
  assert.equal(resolved.createdByName, 'lirisha');
  assert.equal(resolved.createdBy, 'lirisha');
  assert.equal(resolved.createdByWorkspaceRole, 'agent');
  assert.equal(activityCreatorLabel(broadcast, new Map(creators.map(c => [c.value, c]))), 'lirisha');
  assert.equal(broadcast.createdByName, 'Qtech services');
});

test('keeps stored agent name before directory loads and does not assign agents to admin broadcasts', () => {
  assert.equal(resolveActivityCreator({ createdById: 'agent-id', createdByName: 'lirisha' }, []).createdByName, 'lirisha');
  assert.equal(resolveActivityCreator({ createdById: 'admin-id', createdByName: 'Qtech services' }, creators).createdByName, 'Qtech services');
  assert.equal(resolveActivityCreator({ createdById: { _id: 'agent-id' } }, creators).createdByName, 'lirisha');
});

test('known workspace owner is labelled as admin in the all-creators list', () => {
  const resolved = resolveActivityCreator({ createdById: 'admin-id', createdByName: 'Qtech services' }, creators);
  assert.equal(resolved.createdByName, 'Qtech services');
  assert.equal(resolved.createdByWorkspaceRole, 'admin');
});
