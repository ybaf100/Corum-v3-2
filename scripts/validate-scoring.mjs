import assert from "node:assert/strict";
import fs from "node:fs";
import {
  formatCorumScore,
  getBestPlayerRecords,
  getCorumBaseScore,
  getFrozenOrEstimatedScore,
  getCorumRecordScore,
  pinVerifierRecord,
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

const automaticVerifier = pinVerifierRecord(deduplicated, "Verifier", "12345");
assert.equal(automaticVerifier.length, 3);
assert.equal(automaticVerifier[0].player, "Verifier");
assert.equal(automaticVerifier[0].percent, 100);
assert.equal(automaticVerifier[0].status, "verified");
assert.equal(automaticVerifier[0].isVerifierRecord, true);
assert.equal(automaticVerifier[0].levelId, "12345");

const submittedVerifier = pinVerifierRecord(
  [
    { player: "Other", percent: 100 },
    {
      recordId: "submitted",
      player: "verifier",
      percent: 75,
      attempts: 20,
      status: "unverified",
      score: 10,
    },
  ],
  "Verifier",
  "12345",
);
assert.equal(submittedVerifier.length, 2);
assert.equal(submittedVerifier[0].recordId, "submitted");
assert.equal(submittedVerifier[0].attempts, 20);
assert.equal(submittedVerifier[0].percent, 100);
assert.equal(submittedVerifier[0].score, null);
assert.equal(submittedVerifier[1].player, "Other");

assert.deepEqual(
  pinVerifierRecord([{ player: "Other", percent: 100 }], "Unknown", "12345"),
  [{ player: "Other", percent: 100 }],
);

const mainSource = fs.readFileSync(
  new URL("../src/main.jsx", import.meta.url),
  "utf8",
);
const scoreHookSource = fs.readFileSync(
  new URL("../src/useScores.js", import.meta.url),
  "utf8",
);

assert.match(mainSource, /href=\{getPlayerProfileHref\(record\)\}/);
assert.match(mainSource, /scoringRecords\.filter\(\(record\) => !record\.isVerifierRecord\)/);
assert.match(mainSource, /scoringRecords\.filter\(\(record\) => record\.isVerifierRecord\)/);
assert.match(mainSource, /className="player-profile-verifier-records"/);
assert.match(mainSource, /player-profile-verified-tag">VERIFIED/);
assert.match(mainSource, /registrationStatus === "temporary"/);
assert.match(scoreHookSource, /registrationStatus:/);

console.log("Corum scoring validation passed.");
