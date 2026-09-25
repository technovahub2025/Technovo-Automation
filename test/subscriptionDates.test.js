import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionEndDate, toDateInput } from '../src/utils/subscriptionDates.js';

test('billing cycles clamp month ends and leap years', () => {
  assert.equal(subscriptionEndDate('2026-09-25', 'monthly'), '2026-10-25');
  assert.equal(subscriptionEndDate('2026-09-25', 'yearly'), '2027-09-25');
  assert.equal(subscriptionEndDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(subscriptionEndDate('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(subscriptionEndDate('2028-02-29', 'yearly'), '2029-02-28');
  assert.equal(subscriptionEndDate('2026-12-31', 'monthly'), '2027-01-31');
  assert.equal(subscriptionEndDate('', 'monthly'), '');
  assert.equal(toDateInput('invalid'), '');
});
