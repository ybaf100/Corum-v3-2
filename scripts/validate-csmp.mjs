import assert from "node:assert/strict";
import {
  getCompletedCsmpMapKeys,
  getCsmpMapKey,
  getCsmpProgress,
  getCsmpStageForMap,
  getCsmpStyle,
  getCsmpTotalMapCount,
  normalizeCsmpConfig,
} from "../src/csmp.js";

const payload = {
  tiers: [
    {
      order: 1,
      key: "red",
      name: "Red",
      iconFile: "White.png",
      color: "#EF4444",
      requiresAll: true,
      required: 4,
      maps: [
        { levelId: "1", alternateLevelId: "101", title: "Fuselage V", rank: 35 },
        { levelId: "2", title: "Vertex Vacancy", rank: 36 },
        { levelId: "3", title: "NAVOTI", rank: 40 },
        { levelId: "4", title: "Easyacti", rank: 41 },
      ],
    },
    {
      order: 2,
      key: "aqua",
      name: "Aqua",
      iconFile: "Aqua.png",
      color: "#63E7EC",
      requiresAll: false,
      required: 2,
      maps: [
        { levelId: "5", title: "Magasiga", rank: 22 },
        { levelId: "6", title: "Actinum", rank: 23 },
        { levelId: "7", title: "C R Y", rank: 24 },
      ],
    },
    {
      order: 3,
      key: "gold",
      name: "Gold",
      iconFile: "Gold.png",
      color: "#F3D45E",
      requiresAll: true,
      required: 1,
      maps: [{ levelId: "8", title: "Trinitic Circles", rank: 1 }],
    },
  ],
};

const stages = normalizeCsmpConfig(payload);

function clear(map, overrides = {}) {
  return {
    levelId: map.levelId,
    title: map.title,
    percent: 100,
    status: "unverified",
    ...overrides,
  };
}

function clearsFor(stageKey, count) {
  const stage = stages.find((entry) => entry.key === stageKey);
  return stage.maps.slice(0, count).map((map) => clear(map));
}

assert.equal(stages.length, 3);
assert.equal(stages[0].name, "Red");
assert.equal(stages[0].iconFile, "White.png");
assert.equal(stages[0].required, 4);
assert.equal(stages[1].required, 2);
assert.equal(getCsmpTotalMapCount(stages), 8);

const empty = getCsmpProgress([], stages);
assert.equal(empty.current, null);
assert.equal(empty.next.name, "Red");

const red = getCsmpProgress(clearsFor("red", 4), stages);
assert.equal(red.current.name, "Red");
assert.equal(red.next.name, "Aqua");

const outOfOrderAqua = getCsmpProgress(clearsFor("aqua", 2), stages);
assert.equal(outOfOrderAqua.current, null);
assert.equal(outOfOrderAqua.next.name, "Red");

const aqua = getCsmpProgress(
  [...clearsFor("red", 4), ...clearsFor("aqua", 2)],
  stages,
);
assert.equal(aqua.current.name, "Aqua");
assert.equal(aqua.next.name, "Gold");

const completed = getCsmpProgress(
  stages.flatMap((stage) => stage.maps.map((map) => clear(map))),
  stages,
);
assert.equal(completed.current.name, "Gold");
assert.equal(completed.next, null);
assert.equal(completed.completedAll, true);

const rejectedAndIncomplete = getCsmpProgress(
  [
    clear(stages[0].maps[0]),
    clear(stages[0].maps[1]),
    clear(stages[0].maps[2], { status: "rejected" }),
    clear(stages[0].maps[3], { percent: 99 }),
  ],
  stages,
);
assert.equal(rejectedAndIncomplete.next.completed, 2);

const primaryAndAlternateDuplicate = getCompletedCsmpMapKeys(
  [
    clear(stages[0].maps[0]),
    clear(stages[0].maps[0], { levelId: "101" }),
    { title: "A non-CSMP map", percent: 100, status: "verified" },
  ],
  stages,
);
assert.equal(primaryAndAlternateDuplicate.size, 1);
assert.deepEqual([...primaryAndAlternateDuplicate], [getCsmpMapKey(stages[0].maps[0])]);

assert.equal(getCsmpStageForMap({ levelId: "101" }, stages).name, "Red");
assert.equal(getCsmpStageForMap({ title: "  trinitic-circles " }, stages).name, "Gold");
assert.equal(getCsmpStageForMap({ title: "not a csmp map" }, stages), null);

const withAddedTier = normalizeCsmpConfig({
  tiers: [
    ...payload.tiers,
    {
      order: 4,
      name: "Diamond",
      iconFile: "Diamond.webp",
      color: "#123456",
      requiresAll: false,
      required: 1,
      maps: [{ levelId: "9", title: "New Map", rank: 2 }],
    },
  ],
});
assert.equal(withAddedTier.at(-1).name, "Diamond");
assert.equal(withAddedTier.at(-1).iconFile, "Diamond.webp");

const withRemovedTier = normalizeCsmpConfig({ tiers: payload.tiers.slice(0, 2) });
assert.equal(withRemovedTier.length, 2);
assert.equal(getCsmpStageForMap({ levelId: "8" }, withRemovedTier), null);

const zeroMapStage = normalizeCsmpConfig({
  tiers: [{ order: 1, name: "Empty", color: "#000000", requiresAll: true, maps: [] }],
});
assert.equal(getCsmpProgress([], zeroMapStage).current, null);
assert.equal(getCsmpStyle(stages[0])["--csmp-text"], "#111111");
assert.equal(getCsmpStyle({ color: "#111111" })["--csmp-text"], "#FFFFFF");

console.log("Dynamic CSMP configuration and progression validation passed.");
