import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const darkStyles = await readFile(
  new URL("../src/dark-theme.css", import.meta.url),
  "utf8",
);

for (const component of [
  "MapDetailPageSkeleton",
  "PlayerProfileSkeleton",
  "SkeletonStats",
  "SkeletonRankingRows",
  "SkeletonPlayerRows",
  "RecordRowsSkeleton",
]) {
  assert.match(main, new RegExp(`function ${component}\\(`));
}

assert.ok(
  !main.includes("if (loading) page = <RoutePageSkeleton route={route} />;"),
  "The app must not replace a whole route with a loading skeleton.",
);
assert.ok(main.includes('<Home maps={maps} loading={loading} />'));
assert.ok(main.includes("<ListPage"));
assert.ok(main.includes("csmpStages={csmpStages}"));
assert.ok(main.includes("<CsmpPage"));
assert.ok(main.includes("csmpLoading={csmpLoading}"));
assert.ok(main.includes("return <CsmpPageSkeleton />;"));
assert.ok(main.includes('<RoulettePage maps={maps} loading={loading} />'));
assert.ok(main.includes('className="players-summary-skeleton"'));
assert.ok(main.includes("<SkeletonPlayerRows />"));
assert.ok(main.includes("<ScoreScaleCard />"));
assert.ok(main.includes('className="skeleton-rating-count"'));
assert.ok(main.includes('className="skeleton-csmp-map-rank"'));
assert.ok(styles.includes("@keyframes skeletonSweep"));
assert.ok(styles.includes("@media (max-width: 720px)"));
assert.ok(styles.includes("Section-only loading states"));
assert.ok(darkStyles.includes("--skeleton-base: #1b1e2a"));

console.log("Section-only skeleton UI validation passed.");
