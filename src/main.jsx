import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { SITE_TITLE, SITE_VERSION } from "./config";
import { useMaps } from "./useMaps";
import { getLengthBackgroundColor, getLengthTextColor, getMapKey, getRatingColor, getRatingTextColor, getTier, includesSearch } from "./utils";
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

function Layout({ children }) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#/">
          <span className="brand-title">{SITE_TITLE}</span>
          {SITE_VERSION && <span className="brand-version">{SITE_VERSION}</span>}
        </a>
        <nav className="nav">
          <a href="#/">홈</a>
          <a href="#/list">리스트</a>
          <a href="#/about">정보</a>
        </nav>
      </header>
      <main className="content">{children}</main>
      <footer className="footer">{SITE_TITLE}</footer>
    </div>
  );
}

function Home({ maps }) {
  const topMap = maps[0];

  return (
    <section className="hero">
      <p className="eyebrow">corum list</p>
      <h1>{SITE_TITLE}</h1>
      <p className="hero-text">코럼 v3</p>
      <div className="hero-actions">
        <a className="primary-button" href="#/list">리스트로 이동하기</a>
      </div>

      <div className="summary-grid">
        <SummaryCard label="전체 맵" value={`${maps.length}개`} />
        <SummaryCard label="현재 1위" value={topMap ? topMap.title : "없음"} />
        <SummaryCard label="현재 1위 구간" value={topMap ? getTier(topMap.rank) : "없음"} />
      </div>
    </section>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  if (!shouldUseTopThumbnail(item)) return [];

  const sources = [];
  const explicit = String(item.thumbnail || "").trim();
  const levelId = String(item.levelId || "").trim();
  const orderId = String(item.orderId || "").trim();
  const titleSlug = slugifyImageName(item.title);
  const extensions = ["png", "jpg", "jpeg", "webp"];

  if (explicit) sources.push(explicit);

  for (const ext of extensions) {
    if (levelId) sources.push(`./images/${levelId}.${ext}`);
  }

  for (const ext of extensions) {
    if (orderId) sources.push(`./images/${orderId}.${ext}`);
  }

  for (const ext of extensions) {
    if (titleSlug) sources.push(`./images/${titleSlug}.${ext}`);
  }

  return [...new Set(sources)];
}

function ThumbnailBackground({ item }) {
  const sources = useMemo(() => getThumbnailSources(item), [item]);
  const [sourceIndex, setSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setSourceIndex(0);
  }, [item.levelId, item.orderId, item.title, item.thumbnail]);

  if (!shouldUseTopThumbnail(item) || sources.length === 0 || sourceIndex >= sources.length) {
    return null;
  }

  return (
    <img
      className="thumbnail-bg-image"
      src={sources[sourceIndex]}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setSourceIndex((current) => current + 1)}
    />
  );
}

function getRankBackgroundClass(rank) {
  const value = Number(rank);
  if (value >= 11 && value <= 25) return "rank-bg-extended";
  if (value >= 26) return "rank-bg-legacy";
  return "";
}

function ListPage({ maps }) {
  const [query, setQuery] = React.useState("");
  const filteredMaps = useMemo(() => maps.filter((item) => includesSearch(item, query)), [maps, query]);

  return (
    <section>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">map ranking</p>
          <h1>코럼리스트</h1>
        </div>
        <div className="count-pill">{filteredMaps.length} / {maps.length}</div>
      </div>

      <input
        className="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="맵 제목, 제작자, Verifier, 코드 검색"
      />

      <div className="list">
        {filteredMaps.map((item) => (
          <a
            className={`map-card ${shouldUseTopThumbnail(item) ? "map-card-featured" : ""} ${getRankBackgroundClass(item.rank)}`}
            key={`${item.levelId}-${item.orderId}-${item.title}`}
            href={`#/maps/${getMapKey(item)}`}
          >
            <ThumbnailBackground item={item} />
            <div className="rank-box">
              <strong>#{item.rank}</strong>
              <span>{getTier(item.rank)}</span>
            </div>
            <div className="map-main">
              <h2>{item.title}</h2>
              <div className="meta-line">
                <RatingBadge rating={item.rating} />
                <LengthBadge length={item.length} />
                <span>ID {item.levelId || "-"}</span>
              </div>
              <div className="creator-line">
                <span>by {item.creator || "Unknown"}</span>
                <span>verified by {item.verifier || "Unknown"}</span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {filteredMaps.length === 0 && <div className="empty-box">검색 결과가 없음.</div>}
    </section>
  );
}

function MapDetailPage({ maps, mapKey }) {
  const decodedKey = decodeURIComponent(mapKey || "");
  const item = maps.find((map) => String(map.levelId) === decodedKey || String(map.orderId) === decodedKey || map.title === decodedKey);

  if (!item) {
    return (
      <section>
        <h1>존재하지 않는 맵</h1>
        <p className="muted">주소가 잘못됐거나 시트에서 해당 맵을 찾을 수 없음.</p>
        <a className="primary-button" href="#/list">리스트로 돌아가기</a>
      </section>
    );
  }

  return (
    <section>
      <a className="back-link" href="#/list">← 리스트로 돌아가기</a>
      {shouldUseTopThumbnail(item) ? (
        <div className="detail-hero-bg">
          <ThumbnailBackground item={item} />
          <div className="detail-header detail-header-panel">
            <p className="eyebrow">{getTier(item.rank)}</p>
            <h1>#{item.rank} {item.title}</h1>
            <p className="muted">by {item.creator || "Unknown"}, verified by {item.verifier || "Unknown"}</p>
          </div>
        </div>
      ) : (
        <div className={`detail-header detail-header-card ${getRankBackgroundClass(item.rank)}`}>
          <p className="eyebrow">{getTier(item.rank)}</p>
          <h1>#{item.rank} {item.title}</h1>
          <p className="muted">by {item.creator || "Unknown"}, verified by {item.verifier || "Unknown"}</p>
        </div>
      )}

      <div className="detail-grid">
        <Info label="순위" value={`#${item.rank}`} />
        <Info label="순번" value={item.orderId || "-"} />
        <Info label="Rating" value={<RatingBadge rating={item.rating} />} />
        <Info label="맵 길이" value={<LengthBadge length={item.length} />} />
        <Info label="맵 코드" value={item.levelId || "-"} />
        <Info label="제작자" value={item.creator || "-"} />
        <Info label="Verifier" value={item.verifier || "-"} />
      </div>
    </section>
  );
}

function RatingBadge({ rating }) {
  const displayRating = rating || "-";

  return (
    <span
      className="rating-badge"
      style={{
        backgroundColor: getRatingColor(displayRating),
        color: getRatingTextColor(displayRating),
      }}
    >
      Rating {displayRating}
    </span>
  );
}

function LengthBadge({ length }) {
  const displayLength = length || "길이 미입력";

  return (
    <span
      className="length-badge"
      style={{
        backgroundColor: getLengthBackgroundColor(displayLength),
        color: getLengthTextColor(displayLength),
      }}
    >
      {displayLength}
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AboutPage() {
  return (
    <section>
      <p className="eyebrow">about</p>
      <h1>정보</h1>
      <div className="text-card">
        <p>
          순위 구간: TOP 1~TOP 5, 6~10위 Main, 11~25위 Extended, 26위 이후 Legacy
        </p>
      </div>
    </section>
  );
}

function App() {
  const hash = useHashRoute();
  const { maps, loading, error } = useMaps();

  const route = hash.replace(/^#/, "") || "/";
  const mapMatch = route.match(/^\/maps\/(.+)$/);

  let page = null;

  if (loading) page = <div className="loading">데이터를 불러오는 중...</div>;
  else if (error) page = <div className="error-box">{error}</div>;
  else if (route === "/") page = <Home maps={maps} />;
  else if (route === "/list") page = <ListPage maps={maps} />;
  else if (route === "/about") page = <AboutPage />;
  else if (mapMatch) page = <MapDetailPage maps={maps} mapKey={mapMatch[1]} />;
  else page = <MapDetailPage maps={maps} mapKey="" />;

  return <Layout>{page}</Layout>;
}

createRoot(document.getElementById("root")).render(<App />);
