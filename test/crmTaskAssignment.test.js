import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaskAssigneeForEdit } from '../src/utils/crmTaskAssignment.js';

test('editing an unassigned task keeps it unassigned', () => {
  assert.equal(getTaskAssigneeForEdit({ assignedTo: null }), '');
  assert.equal(getTaskAssigneeForEdit({}), '');
});

test('editing a task preserves its persisted assignee ID', () => {
  assert.equal(getTaskAssigneeForEdit({ assignedTo: ' agent-id ' }), 'agent-id');
});
