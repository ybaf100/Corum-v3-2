import assert from "node:assert/strict";
import {
  CSMP_STAGES,
  getCompletedCsmpMapKeys,
  getCsmpProgress,
  getCsmpStageForMapTitle,
} from "../src/csmp.js";

function clear(title, overrides = {}) {
  return {
    title,
    percent: 100,
    status: "unverified",
    ...overrides,
  };
}

function clearsFor(stageKey, count) {
  const stage = CSMP_STAGES.find((entry) => entry.key === stageKey);
  return stage.maps.slice(0, count).map((title) => clear(title));
}

const empty = getCsmpProgress([]);
assert.equal(empty.current, null);
assert.equal(empty.next.name, "White");
assert.equal(empty.next.completed, 0);

const white = getCsmpProgress(clearsFor("white", 4));
assert.equal(white.current.name, "White");
assert.equal(white.next.name, "Aqua");

const outOfOrderAqua = getCsmpProgress(clearsFor("aqua", 5));
assert.equal(outOfOrderAqua.current, null);
assert.equal(outOfOrderAqua.next.name, "White");

const aqua = getCsmpProgress([
  ...clearsFor("white", 4),
  ...clearsFor("aqua", 5),
]);
assert.equal(aqua.current.name, "Aqua");
assert.equal(aqua.next.name, "Bronze");

const bronze = getCsmpProgress([
  ...clearsFor("white", 4),
  ...clearsFor("aqua", 5),
  ...clearsFor("bronze", 5),
]);
assert.equal(bronze.current.name, "Bronze");

const gold = getCsmpProgress(
  CSMP_STAGES.flatMap((stage) => stage.maps.map((title) => clear(title))),
);
assert.equal(gold.current.name, "Gold");
assert.equal(gold.next, null);
assert.equal(gold.completedAll, true);

const rejectedAndIncomplete = getCsmpProgress([
  clear("Fuselage V"),
  clear("Vertex Vacancy"),
  clear("NAVOTI", { status: "rejected" }),
  clear("Easyacti", { percent: 99 }),
]);
assert.equal(rejectedAndIncomplete.current, null);
assert.equal(rejectedAndIncomplete.next.completed, 2);

const normalizedTitles = getCsmpProgress([
  clear("  fuselage-v  "),
  clear("VERTEX   VACANCY"),
  clear("navoti"),
  clear("EASYACTI"),
]);
assert.equal(normalizedTitles.current.name, "White");

assert.equal(getCsmpStageForMapTitle("  DEGRADE-X ").name, "Gold");
assert.equal(getCsmpStageForMapTitle("not a csmp map"), null);
assert.deepEqual(
  [...getCompletedCsmpMapKeys([
    clear("NAVOTI"),
    clear("Easyacti", { percent: 98 }),
    clear("Vertex Vacancy", { status: "rejected" }),
  ])],
  ["navoti"],
);

console.log("CSMP progression validation passed.");
