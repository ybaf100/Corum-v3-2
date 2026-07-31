import assert from "node:assert/strict";
import {
  formatCorumScore,
  getBestPlayerRecords,
  getCorumBaseScore,
  getFrozenOrEstimatedScore,
  getCorumRecordScore,
} from "../src/scoring.js";

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );
};

closeTo(getCorumBaseScore(1), 350);
closeTo(getCorumBaseScore(2), 300);
closeTo(getCorumBaseScore(5), 220);
closeTo(getCorumBaseScore(6), 200);
closeTo(getCorumBaseScore(10), 140);
closeTo(getCorumBaseScore(11), 130);
closeTo(getCorumBaseScore(25), 50);
closeTo(getCorumBaseScore(26), 45);
closeTo(getCorumBaseScore(40), 45 * Math.pow(0.94, 14));

closeTo(getCorumRecordScore(6, 100, 60), 200);
closeTo(getCorumRecordScore(6, 60, 60), 20);
closeTo(getCorumRecordScore(6, 59, 60), 0);
closeTo(getCorumRecordScore(6, 99, 60), 200 * Math.pow(5, 39 / 40) / 10);
closeTo(getCorumRecordScore(6, 99, ""), 0);
closeTo(getCorumRecordScore(6, 100, ""), 200);

assert.equal(formatCorumScore(getCorumBaseScore(40)), "18.92");
closeTo(
  getFrozenOrEstimatedScore({ percent: 100, score: 20 }, 1, 100),
  20,
);
closeTo(
  getFrozenOrEstimatedScore({ percent: 100 }, 1, 100),
  350,
);
closeTo(
  getFrozenOrEstimatedScore({ percent: 100, score: null }, 1, 100),
  350,
);

const deduplicated = getBestPlayerRecords([
  { accountId: "1", player: "Player", percent: 70, clearedAt: "2026-01-01T00:00:00Z" },
  { accountId: "1", player: "Player", percent: 80, clearedAt: "2026-01-02T00:00:00Z" },
  { accountId: "2", player: "Other", percent: 90, clearedAt: "2026-01-02T00:00:00Z" },
  { accountId: "3", player: "Rejected", percent: 100, status: "rejected" },
]);

assert.equal(deduplicated.length, 2);
assert.equal(deduplicated.find((record) => record.accountId === "1")?.percent, 80);

console.log("Corum scoring validation passed.");
