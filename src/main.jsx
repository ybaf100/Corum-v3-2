import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { SITE_TITLE, SITE_VERSION } from "./config";
import { useMaps } from "./useMaps";
import {
  getLengthBackgroundColor,
  getLengthTextColor,
  getMapKey,
  getRatingColor,
  getRatingTextColor,
  getTier,
  includesSearch,
} from "./utils";
import "./styles.css";

function subscribe(callback) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHash() {
  return window.location.hash || "#/";
}

function useHashRoute() {
  return useSyncExternalStore(subscribe, getHash, getHash);
}



const NAV_ITEMS = [
  { key: "home", label: "홈", href: "#/" },
  { key: "list", label: "리스트", href: "#/list" },
];

function getActiveNavKey(route) {
  return route === "/list" || route.startsWith("/maps/") ? "list" : "home";
}

function NavTabs({ route }) {
  const value = getActiveNavKey(route);
  const containerRef = React.useRef(null);
  const labelRefs = React.useRef(new Map());
  const [indicator, setIndicator] = React.useState({ x: 0, width: 0, ready: false });

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    const activeLabel = labelRefs.current.get(value);

    if (!container || !activeLabel) return;

    setIndicator({
      x: activeLabel.offsetLeft,
      width: activeLabel.offsetWidth,
      ready: true,
    });
  }, [value]);

  const toggleRoute = () => {
    window.location.hash = value === "home" ? "#/list" : "#/";
  };

  React.useLayoutEffect(() => {
    updateIndicator();

    const container = containerRef.current;
    if (!container) return undefined;

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateIndicator);
      resizeObserver.observe(container);
      labelRefs.current.forEach((label) => resizeObserver.observe(label));
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <button
      ref={containerRef}
      className={`nav nav-toggle ${indicator.ready ? "indicator-ready" : ""}`}
      type="button"
      onClick={toggleRoute}
      aria-label={value === "home" ? "리스트로 이동" : "홈으로 이동"}
      style={{
        "--nav-indicator-x": `${indicator.x}px`,
        "--nav-indicator-width": `${indicator.width}px`,
      }}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {NAV_ITEMS.map((item) => (
        <span
          key={item.key}
          ref={(element) => {
            if (element) labelRefs.current.set(item.key, element);
            else labelRefs.current.delete(item.key);
          }}
          className={`nav-label ${value === item.key ? "active" : ""}`}
          aria-hidden="true"
        >
          {item.label}
        </span>
      ))}
    </button>
  );
}

function Layout({ children, route }) {
  return (
    <div className="site-shell">
      <header className="site-header-wrap">
        <div className="site-header">
          <a className="brand brand-button" href="#/" aria-label={`${SITE_TITLE} 홈`}>
            <span>{SITE_TITLE}</span>
            {SITE_VERSION && <small>{SITE_VERSION}</small>}
          </a>

          <NavTabs route={route} />
        </div>
      </header>

      <main className="content">{children}</main>

      <footer className="footer">
        <strong>{SITE_TITLE}</strong>
        <span>Geometry Dash custom ranking archive</span>
      </footer>
    </div>
  );
}

function Home({ maps }) {
  const topMap = maps[0];
  const topFive = maps.filter((item) => item.rank >= 1 && item.rank <= 5);
  const mainCount = maps.filter((item) => item.rank >= 1 && item.rank <= 10).length;
  const extendedCount = maps.filter((item) => item.rank >= 11 && item.rank <= 25).length;
  const legacyCount = maps.filter((item) => item.rank >= 26).length;

  return (
    <>
      <section className="home-hero">
        <div className="hero-copy hero-copy-minimal">
          <div className="hero-actions">
            <a className="primary-button light-button" href="#/list">
              전체 리스트 보기 <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="hero-feature">
          {topMap ? (
            <a className={`hero-map-card ${getRankBorderClass(topMap.rank)}`} href={`#/maps/${getMapKey(topMap)}`}>
              <ThumbnailBackground item={topMap} eager />
              <div className="hero-map-overlay" />
              <div className="hero-map-topline">
                <span className="index-chip">CURRENT #1</span>
                <span className="corner-arrow"><ArrowIcon /></span>
              </div>
              <div className="hero-map-content">
                <div className="badge-row">
                  <RatingBadge rating={topMap.rating} compact />
                  <LengthBadge length={topMap.length} compact />
                </div>
                <h2>{topMap.title}</h2>
                <p>by {topMap.creator || "Unknown"}</p>
              </div>
            </a>
          ) : (
            <div className="hero-map-card hero-map-empty">
              <div className="hero-map-content">
                <span className="index-chip">CURRENT #1</span>
                <h2>등록된 맵이 없습니다.</h2>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="stats-rail" aria-label="리스트 통계">
        <StatItem label="TOTAL MAPS" value={maps.length} suffix="maps" />
        <StatItem label="MAIN" value={mainCount} suffix="1–10" />
        <StatItem label="EXTENDED" value={extendedCount} suffix="11–25" />
        <StatItem label="LEGACY" value={legacyCount} suffix="26+" />
      </section>

      {topFive.length > 0 && (
        <section className="home-top-section">
          <SectionHeading
            kicker="FEATURED RANKING"
            title="현재 TOP 5"
            action={<a className="inline-link" href="#/list">전체 순위 <ArrowIcon /></a>}
          />
          <div className="home-top-grid">
            {topFive.map((item) => <TopPreviewCard key={getMapKey(item)} item={item} />)}
          </div>
        </section>
      )}
    </>
  );
}

function StatItem({ label, value, suffix }) {
  return (
    <div className="stat-item">
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        <small>{suffix}</small>
      </div>
    </div>
  );
}

function SectionHeading({ kicker, title, action }) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function TopPreviewCard({ item }) {
  return (
    <a className={`top-preview top-preview-${item.rank} ${getRankBorderClass(item.rank)}`} href={`#/maps/${getMapKey(item)}`}>
      <ThumbnailBackground item={item} />
      <div className="top-preview-overlay" />
      <div className="top-preview-head">
        <span>TOP {item.rank}</span>
        <ArrowIcon />
      </div>
      <div className="top-preview-content">
        <h3>{item.title}</h3>
        <p>{item.creator || "Unknown"}</p>
      </div>
    </a>
  );
}

function shouldUseTopThumbnail(item) {
  return Number(item.rank) >= 1 && Number(item.rank) <= 5;
}

function slugifyImageName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getThumbnailSources(item) {
  const sources = [];
  const explicit = String(item.thumbnail || "").trim();
  const levelId = String(item.levelId || "").trim();
  const orderId = String(item.orderId || "").trim();
  const titleSlug = slugifyImageName(item.title);
  const extensions = ["png", "jpg", "jpeg", "webp"];

  if (explicit) sources.push(explicit);
  for (const ext of extensions) if (levelId) sources.push(`./images/${levelId}.${ext}`);
  for (const ext of extensions) if (orderId) sources.push(`./images/${orderId}.${ext}`);
  for (const ext of extensions) if (titleSlug) sources.push(`./images/${titleSlug}.${ext}`);

  return [...new Set(sources)];
}

function ThumbnailBackground({ item, eager = false }) {
  const sources = useMemo(() => getThumbnailSources(item), [item]);
  const [sourceIndex, setSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setSourceIndex(0);
  }, [item.levelId, item.orderId, item.title, item.thumbnail]);

  if (!shouldUseTopThumbnail(item) || sources.length === 0 || sourceIndex >= sources.length) return null;

  return (
    <img
      className="thumbnail-bg-image"
      src={sources[sourceIndex]}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      onError={() => setSourceIndex((current) => current + 1)}
    />
  );
}

function RankingThumbnail({ item }) {
  const sources = useMemo(() => getThumbnailSources(item), [item]);
  const [sourceIndex, setSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setSourceIndex(0);
  }, [item.levelId, item.orderId, item.title, item.thumbnail]);

  const source = sources[sourceIndex];

  return (
    <div className={`ranking-thumbnail ${source ? "has-image" : "is-placeholder"}`}>
      {source ? (
        <img
          src={source}
          alt={`${item.title} 썸네일`}
          loading="lazy"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <div className="ranking-thumbnail-placeholder" aria-hidden="true">
          <strong>{String(item.rank).padStart(2, "0")}</strong>
          <span>NO IMAGE</span>
        </div>
      )}
      <span className="ranking-thumbnail-shade" aria-hidden="true" />
    </div>
  );
}

function getRankBorderClass(rank) {
  const value = Number(rank);
  if (value === 1) return "rank-border-gold";
  if (value === 2) return "rank-border-silver";
  if (value === 3) return "rank-border-bronze";
  if (value === 4 || value === 5) return "rank-border-top-lime";
  if (value >= 6 && value <= 10) return "rank-border-main-aqua";
  if (value >= 11 && value <= 25) return "rank-border-extended-magenta";
  return "";
}

function getRankSizeClass(rank) {
  const value = Number(rank);
  if (value === 1) return "rank-size-first";
  if (value === 2 || value === 3) return "rank-size-podium";
  return "rank-size-standard";
}

function getRankBackgroundClass(rank) {
  const value = Number(rank);
  if (value >= 11 && value <= 25) return "rank-bg-extended";
  if (value >= 26) return "rank-bg-legacy";
  return "rank-bg-main";
}

function getFilterKey(rank) {
  const value = Number(rank);
  if (value <= 10) return "main";
  if (value <= 25) return "extended";
  return "legacy";
}

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "main", label: "Main" },
  { key: "extended", label: "Extended" },
  { key: "legacy", label: "Legacy" },
];

const RATING_SCALE = [
  "0",
  "Tiny",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "18+",
  "19",
  "19+",
  "20.0",
  "20.1",
  "20.2",
  "20.3",
  "20.4",
  "20.5",
  "20.6",
  "20.7",
  "20.8",
  "20.9",
  "21",
  "21+",
];

const RATING_RANGE_MAX = RATING_SCALE.length - 1;
const RATING_RANGE_GRADIENT = `linear-gradient(90deg, ${RATING_SCALE.map(
  (rating, index) => `${getRatingColor(rating)} ${(index / RATING_RANGE_MAX) * 100}%`,
).join(", ")})`;

function normalizeRatingForRange(value) {
  const rating = String(value || "").trim();
  if (/^20(?:\.0+)?$/.test(rating)) return "20.0";
  return rating;
}

function getRatingRangeIndex(value) {
  return RATING_SCALE.indexOf(normalizeRatingForRange(value));
}

function isRatingInsideRange(value, firstIndex, secondIndex) {
  const index = getRatingRangeIndex(value);
  const rangeStart = Math.min(firstIndex, secondIndex);
  const rangeEnd = Math.max(firstIndex, secondIndex);

  // -1, -2, UnVF 등 특수 등급은 슬라이더가 전체 범위일 때만 유지한다.
  if (index === -1) {
    return rangeStart === 0 && rangeEnd === RATING_RANGE_MAX;
  }

  return index >= rangeStart && index <= rangeEnd;
}

function FilterTabs({ value, onChange }) {
  const containerRef = React.useRef(null);
  const buttonRefs = React.useRef(new Map());
  const [indicator, setIndicator] = React.useState({ x: 0, width: 0, ready: false });

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current.get(value);

    if (!container || !activeButton) return;

    setIndicator({
      x: activeButton.offsetLeft,
      width: activeButton.offsetWidth,
      ready: true,
    });
  }, [value]);

  React.useLayoutEffect(() => {
    updateIndicator();

    const container = containerRef.current;
    if (!container) return undefined;

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateIndicator);
      resizeObserver.observe(container);
      buttonRefs.current.forEach((button) => resizeObserver.observe(button));
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={`filter-tabs ${indicator.ready ? "indicator-ready" : ""}`}
      role="tablist"
      aria-label="순위 구간 필터"
      style={{
        "--filter-indicator-x": `${indicator.x}px`,
        "--filter-indicator-width": `${indicator.width}px`,
      }}
    >
      <span className="filter-indicator" aria-hidden="true" />
      {FILTERS.map((item) => (
        <button
          key={item.key}
          ref={(element) => {
            if (element) buttonRefs.current.set(item.key, element);
            else buttonRefs.current.delete(item.key);
          }}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          className={value === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function RatingRangeFilter({ value, onChange, resultCount, totalCount }) {
  const [firstIndex, secondIndex] = value;
  const [activeHandle, setActiveHandle] = React.useState("second");

  const firstPercent = (firstIndex / RATING_RANGE_MAX) * 100;
  const secondPercent = (secondIndex / RATING_RANGE_MAX) * 100;
  const rangeStart = Math.min(firstIndex, secondIndex);
  const rangeEnd = Math.max(firstIndex, secondIndex);
  const rangeStartPercent = (rangeStart / RATING_RANGE_MAX) * 100;
  const rangeEndPercent = (rangeEnd / RATING_RANGE_MAX) * 100;

  const firstRole = firstIndex <= secondIndex ? "MIN" : "MAX";
  const secondRole = firstIndex <= secondIndex ? "MAX" : "MIN";
  const isDefault = rangeStart === 0 && rangeEnd === RATING_RANGE_MAX;

  const updateFirstHandle = (event) => {
    onChange([Number(event.target.value), secondIndex]);
  };

  const updateSecondHandle = (event) => {
    onChange([firstIndex, Number(event.target.value)]);
  };

  const resetRange = () => {
    onChange([0, RATING_RANGE_MAX]);
    setActiveHandle("second");
  };

  return (
    <section className="rating-filter-panel" aria-labelledby="rating-filter-title">
      <div className="rating-filter-header">
        <div>
          <span className="rating-filter-kicker">DIFFICULTY RANGE</span>
          <h2 id="rating-filter-title">난이도 범위</h2>
        </div>

        <div className="rating-filter-actions">
          <span className="rating-result-count">
            <strong>{resultCount}</strong> / {totalCount}
          </span>
          <button type="button" onClick={resetRange} disabled={isDefault}>
            초기화
          </button>
        </div>
      </div>

      <div
        className="rating-range-slider"
        style={{
          "--rating-min-position": `${firstPercent}%`,
          "--rating-max-position": `${secondPercent}%`,
          "--rating-range-start": `${rangeStartPercent}%`,
          "--rating-range-end": `${rangeEndPercent}%`,
          "--rating-range-gradient": RATING_RANGE_GRADIENT,
          "--rating-min-color": getRatingColor(RATING_SCALE[firstIndex]),
          "--rating-max-color": getRatingColor(RATING_SCALE[secondIndex]),
          "--rating-min-text-color": getRatingTextColor(RATING_SCALE[firstIndex]),
          "--rating-max-text-color": getRatingTextColor(RATING_SCALE[secondIndex]),
        }}
      >
        <div className="rating-range-track-shell">
          <div className="rating-range-track">
            <span className="rating-range-mask left" />
            <span className="rating-range-mask right" />
            <span className="rating-range-active" />
          </div>

          <span className="rating-handle-visual minimum" aria-hidden="true">
            <small>{firstRole}</small>
            <strong>{RATING_SCALE[firstIndex]}</strong>
          </span>
          <span className="rating-handle-visual maximum" aria-hidden="true">
            <small>{secondRole}</small>
            <strong>{RATING_SCALE[secondIndex]}</strong>
          </span>

          <input
            className="rating-range-input minimum"
            type="range"
            min="0"
            max={RATING_RANGE_MAX}
            value={firstIndex}
            onChange={updateFirstHandle}
            onPointerDown={() => setActiveHandle("first")}
            onFocus={() => setActiveHandle("first")}
            aria-label={`${firstRole === "MIN" ? "최소" : "최대"} 난이도 ${RATING_SCALE[firstIndex]}`}
            style={{ zIndex: activeHandle === "first" ? 8 : 5 }}
          />
          <input
            className="rating-range-input maximum"
            type="range"
            min="0"
            max={RATING_RANGE_MAX}
            value={secondIndex}
            onChange={updateSecondHandle}
            onPointerDown={() => setActiveHandle("second")}
            onFocus={() => setActiveHandle("second")}
            aria-label={`${secondRole === "MIN" ? "최소" : "최대"} 난이도 ${RATING_SCALE[secondIndex]}`}
            style={{ zIndex: activeHandle === "second" ? 8 : 6 }}
          />
        </div>

        <div className="rating-range-landmarks" aria-hidden="true">
          <span>0</span>
          <span>10</span>
          <span>18+</span>
          <span>20.5</span>
          <span>21+</span>
        </div>
      </div>
    </section>
  );
}

function ListPage({ maps, initialQuery = "" }) {
  const [query, setQuery] = React.useState(initialQuery);
  const [filter, setFilter] = React.useState("all");
  const [ratingRange, setRatingRange] = React.useState([0, RATING_RANGE_MAX]);

  React.useEffect(() => {
    setQuery(initialQuery);
    setFilter("all");
    setRatingRange([0, RATING_RANGE_MAX]);
  }, [initialQuery]);
  const [refreshing, setRefreshing] = React.useState(false);

  const refreshList = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => window.location.reload(), 220);
  };

  const filteredMaps = useMemo(
    () =>
      maps.filter(
        (item) =>
          includesSearch(item, query) &&
          (filter === "all" || getFilterKey(item.rank) === filter) &&
          isRatingInsideRange(item.rating, ratingRange[0], ratingRange[1]),
      ),
    [maps, query, filter, ratingRange],
  );


  return (
    <section className="list-page">
      <div className="list-toolbar">
        <label className="search-shell">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="맵 제목, 제작자, Verifier, 코드 검색"
          />
        </label>

        <FilterTabs value={filter} onChange={setFilter} />

        <button
          className={`refresh-button ${refreshing ? "is-refreshing" : ""}`}
          type="button"
          onClick={refreshList}
          disabled={refreshing}
          aria-label="리스트 새로고침"
        >
          <RefreshIcon />
          <span>{refreshing ? "새로고침 중" : "새로고침"}</span>
        </button>
      </div>

      <RatingRangeFilter
        value={ratingRange}
        onChange={setRatingRange}
        resultCount={filteredMaps.length}
        totalCount={maps.length}
      />

      {filteredMaps.length > 0 && (
        <section className="ranking-section">
          <div className="ranking-table-head" aria-hidden="true">
            <span>RANK</span>
            <span>PREVIEW</span>
            <span>MAP</span>
            <span>CREATOR / VERIFIER</span>
            <span>DETAIL</span>
          </div>
          <div className="ranking-list">
            {filteredMaps.map((item) => (
              <RankingRow key={getMapKey(item)} item={item} query={query} />
            ))}
          </div>
        </section>
      )}

      {filteredMaps.length === 0 && (
        <div className="empty-state">
          <span>NO RESULTS</span>
          <h2>검색 결과가 없습니다.</h2>
          <p>검색어, 순위 구간 또는 난이도 범위를 변경해 보세요.</p>
        </div>
      )}
    </section>
  );
}

function FeaturedMapCard({ item }) {
  return (
    <a className={`featured-map-card featured-rank-${item.rank} ${getRankBorderClass(item.rank)}`} href={`#/maps/${getMapKey(item)}`}>
      <ThumbnailBackground item={item} />
      <div className="featured-map-overlay" />
      <div className="featured-map-header">
        <div>
          <strong>#{item.rank}</strong>
          <span>{getTier(item.rank)}</span>
        </div>
        <span className="corner-arrow"><ArrowIcon /></span>
      </div>
      <div className="featured-map-content">
        <div className="badge-row">
          <RatingBadge rating={item.rating} compact />
          <LengthBadge length={item.length} compact />
        </div>
        <h2>{item.title}</h2>
        <p>by {item.creator || "Unknown"} · verified by {item.verifier || "Unknown"}</p>
      </div>
    </a>
  );
}

function HighlightText({ text, query }) {
  const value = String(text ?? "");
  const search = String(query ?? "").trim();

  if (!search) return value;

  const lowerValue = value.toLocaleLowerCase();
  const lowerSearch = search.toLocaleLowerCase();
  const pieces = [];
  let cursor = 0;

  while (cursor < value.length) {
    const matchIndex = lowerValue.indexOf(lowerSearch, cursor);

    if (matchIndex === -1) {
      pieces.push(value.slice(cursor));
      break;
    }

    if (matchIndex > cursor) {
      pieces.push(value.slice(cursor, matchIndex));
    }

    const matchedText = value.slice(matchIndex, matchIndex + search.length);
    pieces.push(
      <mark className="search-highlight" key={`${matchIndex}-${pieces.length}`}>
        {matchedText}
      </mark>,
    );

    cursor = matchIndex + search.length;
  }

  return pieces.length > 0 ? pieces : value;
}

function RankingRow({ item, query }) {
  return (
    <a
      className={`ranking-row ${getRankSizeClass(item.rank)} ${getRankBackgroundClass(item.rank)} ${getRankBorderClass(item.rank)}`}
      href={`#/maps/${getMapKey(item)}`}
    >
      <div className="ranking-position">
        <strong>
          <HighlightText text={String(item.rank).padStart(2, "0")} query={query} />
        </strong>
        <span>{getTier(item.rank)}</span>
      </div>

      <RankingThumbnail item={item} />

      <div className="ranking-map-copy">
        <h2><HighlightText text={item.title} query={query} /></h2>
        <div className="badge-row">
          <RatingBadge rating={item.rating} compact query={query} />
          <LengthBadge length={item.length} compact query={query} />
          <span className="neutral-badge">
            ID <HighlightText text={item.levelId || "-"} query={query} />
          </span>
        </div>
      </div>

      <div className="ranking-people">
        <p>
          <span>CREATOR</span>
          <strong><HighlightText text={item.creator || "Unknown"} query={query} /></strong>
        </p>
        <p>
          <span>VERIFIER</span>
          <strong><HighlightText text={item.verifier || "Unknown"} query={query} /></strong>
        </p>
      </div>

      <span className="row-arrow"><ArrowIcon /></span>
    </a>
  );
}

function MapDetailPage({ maps, mapKey }) {
  const decodedKey = decodeURIComponent(mapKey || "");
  const item = maps.find(
    (map) => String(map.levelId) === decodedKey || String(map.orderId) === decodedKey || map.title === decodedKey,
  );

  if (!item) {
    return (
      <section className="not-found">
        <p className="section-kicker">404 / MAP NOT FOUND</p>
        <h1>존재하지 않는 맵</h1>
        <p>주소가 잘못됐거나 시트에서 해당 맵을 찾을 수 없습니다.</p>
        <a className="primary-button dark-button" href="#/list">리스트로 돌아가기</a>
      </section>
    );
  }

  const mediaClass = shouldUseTopThumbnail(item) ? "with-image" : getRankBackgroundClass(item.rank);

  return (
    <section className="detail-page detail-page-banner">
      <a className="back-link" href="#/list">← 전체 리스트</a>

      <article className={`map-detail-card ${getRankBorderClass(item.rank)}`}>
        <div className={`map-detail-banner ${mediaClass}`}>
          {shouldUseTopThumbnail(item) ? (
            <ThumbnailBackground item={item} eager />
          ) : (
            <div className="map-detail-placeholder" aria-hidden="true" />
          )}

          <div className="map-detail-gradient" />

          <div className="map-detail-topline">
            <span className="map-rank-pill">#{item.rank}</span>
            <span className="map-tier-pill">{getTier(item.rank)}</span>
          </div>

          <div className="map-detail-heading">
            <div className="detail-badges detail-badges-overlay">
              <RatingBadge rating={item.rating} />
              <LengthBadge length={item.length} />
            </div>
            <h1>{item.title}</h1>
            <p>
              by{" "}
              <a
                className="person-search-link"
                href={`#/list?q=${encodeURIComponent(item.creator || "Unknown")}`}
                title={`${item.creator || "Unknown"} 제작 맵 검색`}
              >
                {item.creator || "Unknown"}
              </a>
              <span aria-hidden="true"> · </span>
              verified by{" "}
              <a
                className="person-search-link"
                href={`#/list?q=${encodeURIComponent(item.verifier || "Unknown")}`}
                title={`${item.verifier || "Unknown"} 검증 맵 검색`}
              >
                {item.verifier || "Unknown"}
              </a>
            </p>
          </div>
        </div>

        <div className="map-detail-facts">
          <div className="map-detail-fact">
            <span>현재 순위</span>
            <strong>#{item.rank}</strong>
          </div>
          <div className="map-detail-fact">
            <span>리스트 구간</span>
            <strong>{getTier(item.rank)}</strong>
          </div>
          <div className="map-detail-fact">
            <span>순번</span>
            <strong>{item.orderId || "-"}</strong>
          </div>
          <div className="map-detail-fact">
            <span>맵 코드</span>
            <strong className="mono">{item.levelId || "-"}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}

function RatingBadge({ rating, compact = false, query = "" }) {
  const displayRating = rating || "-";
  return (
    <span
      className={`data-badge rating-badge ${compact ? "compact" : ""}`}
      style={{ backgroundColor: getRatingColor(displayRating), color: getRatingTextColor(displayRating) }}
    >
      <small>RATING</small><HighlightText text={displayRating} query={query} />
    </span>
  );
}

function LengthBadge({ length, compact = false, query = "" }) {
  const displayLength = length || "길이 미입력";
  return (
    <span
      className={`data-badge length-badge ${compact ? "compact" : ""}`}
      style={{ backgroundColor: getLengthBackgroundColor(displayLength), color: getLengthTextColor(displayLength) }}
    >
      <small>LENGTH</small><HighlightText text={displayLength} query={query} />
    </span>
  );
}

function Info({ label, value, emphasize = false, mono = false }) {
  return (
    <div className={`info-card ${emphasize ? "emphasize" : ""}`}>
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function App() {
  const hash = useHashRoute();
  const { maps, loading, error } = useMaps();

  const rawRoute = hash.replace(/^#/, "") || "/";
  const [route, queryString = ""] = rawRoute.split("?");
  const searchParams = new URLSearchParams(queryString);
  const initialQuery = searchParams.get("q") || "";
  const mapMatch = route.match(/^\/maps\/(.+)$/);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [route, queryString]);

  let page = null;
  if (loading) page = <div className="loading-state"><span /><p>리스트 데이터를 불러오는 중</p></div>;
  else if (error) page = <div className="error-state"><strong>데이터를 불러오지 못했습니다.</strong><p>{error}</p></div>;
  else if (route === "/") page = <Home maps={maps} />;
  else if (route === "/list") page = <ListPage maps={maps} initialQuery={initialQuery} />;
  else if (mapMatch) page = <MapDetailPage maps={maps} mapKey={mapMatch[1]} />;
  else page = <Home maps={maps} />;

  return <Layout route={route}>{page}</Layout>;
}

createRoot(document.getElementById("root")).render(<App />);
