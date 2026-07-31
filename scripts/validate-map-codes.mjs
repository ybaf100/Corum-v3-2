import assert from "node:assert/strict";
import { getDisplayedLevelId, parseCsv } from "../src/utils.js";

const maps = parseCsv([
  "순위,맵 제목,맵 코드,대체 맵 코드",
  "1,Alternate map,111111,222222",
  "2,Same map,333333,333333",
  "3,Primary only,444444,",
].join("\n"));

assert.equal(maps[0].alternateLevelId, "222222");
assert.equal(getDisplayedLevelId(maps[0]), "222222");

assert.equal(maps[1].alternateLevelId, "");
assert.equal(getDisplayedLevelId(maps[1]), "333333");

assert.equal(maps[2].alternateLevelId, "");
assert.equal(getDisplayedLevelId(maps[2]), "444444");

console.log("Map code display validation passed.");
