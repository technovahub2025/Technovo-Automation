import test from "node:test";
import assert from "node:assert/strict";
import { mergeBroadcastProgress } from "../src/utils/broadcastProgress.js";

test("fresh counts replace stale percentages and preserve other stats", () => {
  const broadcast = { recipientCount: 10, sentCount: 1, successfulPercentage: 10, readPercentage: 10,
    stats: { sent: 10, delivered: 5, read: 1, replied: 0, failed: 0 } };
  const next = mergeBroadcastProgress(broadcast, { read: 4, replied: 2 });
  assert.equal(next.successfulPercentage, 100);
  assert.equal(next.readPercentage, 40);
  assert.equal(next.repliedPercentage, 20);
  assert.equal(next.stats.delivered, 5);
  assert.equal(next.sentCount, 10);
  assert.equal(broadcast.stats.read, 1);
});

test("progress handles zero counts, corrections and invalid values", () => {
  assert.equal(mergeBroadcastProgress({ recipientCount: 0 }, {}).readPercentage, 0);
  const next = mergeBroadcastProgress({ recipientCount: 2, readPercentage: 100 }, { sent: 5, read: 0, failed: -1, replied: NaN });
  assert.equal(next.successfulPercentage, 100);
  assert.equal(next.readPercentage, 0);
  assert.equal(next.stats.failed, 0);
  assert.equal(next.stats.replied, 0);
});
