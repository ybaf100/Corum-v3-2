import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { SITE_TITLE, SITE_VERSION } from "./config";
import {
  getCompletedCsmpMapKeys,
  getCsmpMapKey,
  getCsmpStageForMap,
  getCsmpStyle,
  getCsmpTotalMapCount,
  normalizeCsmpMapTitle,
} from "./csmp";
import { useCsmp } from "./useCsmp";
import { useMaps } from "./useMaps";
import { useRecords } from "./useRecords";
import { useScores } from "./useScores";
import {
  CORUM_SCORING_VERSION,
  formatCorumScore,
  getBestPlayerRecords,
  getCorumBaseScore,
  getFrozenOrEstimatedScore,
  pinVerifierRecord,
} from "./scoring";
import {
  getLengthBackgroundColor,
  getLengthTextColor,
  getDisplayedLevelId,
  getMapKey,
  getRatingColor,
  getRatingTextColor,
  getTier,
  includesSearch,
} from "./utils";
import "./styles.css";
import darkThemeCss from "./dark-theme.css?inline";

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

const THEME_STORAGE_KEY = "corum-theme";

function getInitialTheme() {
  if (typeof document === "undefined") return "light";

  const bootstrappedTheme = document.documentElement.dataset.theme;
  if (bootstrappedTheme === "dark" || bootstrappedTheme === "light") {
    return bootstrappedTheme;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  } catch {
    // localStorage가 차단된 환경에서는 시스템 설정을 사용한다.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = React.useState(getInitialTheme);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    let darkStyle = document.getElementById("corum-dark-theme");
    if (!darkStyle) {
      darkStyle = document.createElement("style");
      darkStyle.id = "corum-dark-theme";
      darkStyle.textContent = darkThemeCss;
      document.head.appendChild(darkStyle);
    }
    darkStyle.media = theme === "dark" ? "all" : "not all";

    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute("content", theme === "dark" ? "#07080d" : "#f4f4f1");

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 저장할 수 없어도 현재 탭의 테마 전환은 유지한다.
    }
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}

const NAV_ITEMS = [
  { key: "home", label: "홈", href: "#/" },
  { key: "list", label: "리스트", href: "#/list" },
  { key: "players", label: "점수", href: "#/players" },
  { key: "csmp", label: "CSMP", href: "#/csmp" },
  { key: "roulette", label: "룰렛", href: "#/roulette" },
];

function getActiveNavKey(route) {
  if (route === "/roulette") return "roulette";
  if (route === "/csmp") return "csmp";
  if (route === "/players" || route.startsWith("/players/")) return "players";
  if (route === "/list" || route.startsWith("/maps/")) return "list";
  return "home";
}

function NavTabs({ route }) {
  const value = getActiveNavKey(route);
  const containerRef = React.useRef(null);
  const linkRefs = React.useRef(new Map());
  const [indicator, setIndicator] = React.useState({ x: 0, width: 0, ready: false });

  const updateIndicator = React.useCallback(() => {
    const activeLink = linkRefs.current.get(value);

    if (!containerRef.current || !activeLink) return;

    setIndicator({
      x: activeLink.offsetLeft,
      width: activeLink.offsetWidth,
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
      linkRefs.current.forEach((link) => resizeObserver.observe(link));
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <nav
      ref={containerRef}
      className={`nav nav-links ${indicator.ready ? "indicator-ready" : ""}`}
      aria-label="주요 페이지"
      style={{
        "--nav-indicator-x": `${indicator.x}px`,
        "--nav-indicator-width": `${indicator.width}px`,
      }}
    >
      <span className="nav-indicator" aria-hidden="true" />

      {NAV_ITEMS.map((item) => (
        <a
          key={item.key}
          ref={(element) => {
            if (element) linkRefs.current.set(item.key, element);
            else linkRefs.current.delete(item.key);
          }}
          className={`nav-link ${value === item.key ? "active" : ""}`}
          href={item.href}
          aria-current={value === item.key ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
      title={isDark ? "라이트 모드" : "다크 모드"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      <span>{isDark ? "LIGHT" : "DARK"}</span>
    </button>
  );
}

function Layout({ children, route, theme, onToggleTheme }) {
  return (
    <div className="site-shell">
      <header className="site-header-wrap">
        <div className="site-header">
          <a className="brand brand-button" href="#/" aria-label={`${SITE_TITLE} 홈`}>
            <span>{SITE_TITLE}</span>
            {SITE_VERSION && <small>{SITE_VERSION}</small>}
          </a>

          <div className="header-actions">
            <NavTabs route={route} />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
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

function SkeletonBlock({ className = "" }) {
  return (
    <span
      className={`skeleton-block${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    />
  );
}

function SkeletonScreen({ className = "", label, children }) {
  return (
    <section
      className={`page-skeleton${className ? ` ${className}` : ""}`}
      aria-busy="true"
      aria-label={label}
    >
      <span className="visually-hidden">{label}</span>
      {children}
    </section>
  );
}

function SkeletonHeading() {
  return (
    <div className="skeleton-heading">
      <SkeletonBlock className="skeleton-kicker" />
      <SkeletonBlock className="skeleton-title" />
      <SkeletonBlock className="skeleton-copy-line" />
    </div>
  );
}

function SkeletonStats({ className = "", label = "통계를 불러오는 중" }) {
  return (
    <div
      className={`skeleton-stats${className ? ` ${className}` : ""}`}
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div className="skeleton-stat" key={index}>
          <SkeletonBlock className="skeleton-label" />
          <SkeletonBlock className="skeleton-number" />
        </div>
      ))}
    </div>
  );
}

function SkeletonRankingRows({ count = 6 }) {
  return (
    <div className="skeleton-ranking-list">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-ranking-row" key={index}>
          <SkeletonBlock className="skeleton-rank" />
          <SkeletonBlock className="skeleton-thumbnail" />
          <div className="skeleton-ranking-copy">
            <SkeletonBlock className="skeleton-row-title" />
            <div className="skeleton-chip-row">
              <SkeletonBlock className="skeleton-chip" />
              <SkeletonBlock className="skeleton-chip is-wide" />
              <SkeletonBlock className="skeleton-chip" />
            </div>
          </div>
          <div className="skeleton-ranking-people">
            <SkeletonBlock className="skeleton-label" />
            <SkeletonBlock className="skeleton-copy-line is-short" />
            <SkeletonBlock className="skeleton-label" />
            <SkeletonBlock className="skeleton-copy-line is-short" />
          </div>
          <SkeletonBlock className="skeleton-circle" />
        </div>
      ))}
    </div>
  );
}

function SkeletonPlayerRows({ count = 6 }) {
  return (
    <div className="skeleton-player-list">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-player-row" key={index}>
          <SkeletonBlock className="skeleton-rank" />
          <div className="skeleton-player-identity">
            <SkeletonBlock className="skeleton-avatar" />
            <div>
              <SkeletonBlock className="skeleton-row-title" />
              <SkeletonBlock className="skeleton-copy-line is-short" />
            </div>
          </div>
          <div className="skeleton-player-best">
            <SkeletonBlock className="skeleton-label" />
            <SkeletonBlock className="skeleton-copy-line" />
          </div>
          <div className="skeleton-player-counts">
            <SkeletonBlock className="skeleton-number is-small" />
            <SkeletonBlock className="skeleton-number is-small" />
          </div>
          <SkeletonBlock className="skeleton-score" />
        </div>
      ))}
    </div>
  );
}

function RecordRowsSkeleton({ count = 4 }) {
  return (
    <div
      className="skeleton-record-list"
      aria-busy="true"
      aria-label="기록을 불러오는 중"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-record-row" key={index}>
          <SkeletonBlock className="skeleton-rank" />
          <div className="skeleton-player-identity">
            <SkeletonBlock className="skeleton-avatar" />
            <div>
              <SkeletonBlock className="skeleton-row-title" />
              <SkeletonBlock className="skeleton-copy-line is-short" />
            </div>
          </div>
          <SkeletonBlock className="skeleton-percent" />
          <div className="skeleton-record-metrics">
            {Array.from({ length: 4 }, (_, metricIndex) => (
              <SkeletonBlock
                className="skeleton-copy-line is-short"
                key={metricIndex}
              />
            ))}
          </div>
          <SkeletonBlock className="skeleton-chip is-wide" />
        </div>
      ))}
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <SkeletonScreen className="skeleton-home-page" label="홈 데이터를 불러오는 중">
      <div className="skeleton-home-hero">
        <div className="skeleton-home-copy">
          <SkeletonBlock className="skeleton-button" />
        </div>
        <div className="skeleton-home-feature">
          <SkeletonBlock className="skeleton-feature-card" />
        </div>
      </div>
      <SkeletonStats />
      <SkeletonHeading />
      <div className="skeleton-feature-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock className="skeleton-feature-tile" key={index} />
        ))}
      </div>
    </SkeletonScreen>
  );
}

function ListPageSkeleton() {
  return (
    <SkeletonScreen className="skeleton-list-page" label="리스트를 불러오는 중">
      <div className="skeleton-toolbar">
        <SkeletonBlock className="skeleton-search" />
        <SkeletonBlock className="skeleton-tabs" />
        <SkeletonBlock className="skeleton-refresh" />
      </div>
      <SkeletonBlock className="skeleton-rating-panel" />
      <div className="skeleton-table-head">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock className="skeleton-label" key={index} />
        ))}
      </div>
      <SkeletonRankingRows />
    </SkeletonScreen>
  );
}

function PlayerLeaderboardSkeleton() {
  return (
    <SkeletonScreen className="skeleton-players-page" label="플레이어 랭킹을 불러오는 중">
      <div className="skeleton-players-hero">
        <SkeletonHeading />
      </div>
      <SkeletonStats />
      <div className="skeleton-board">
        <div className="skeleton-board-heading">
          <SkeletonHeading />
          <SkeletonBlock className="skeleton-refresh" />
        </div>
        <SkeletonPlayerRows />
      </div>
      <SkeletonBlock className="skeleton-score-scale" />
    </SkeletonScreen>
  );
}

function CsmpPageSkeleton() {
  return (
    <SkeletonScreen className="skeleton-csmp-page" label="CSMP 데이터를 불러오는 중">
      <div className="skeleton-csmp-hero">
        <SkeletonHeading />
        <div className="skeleton-csmp-search">
          <SkeletonBlock className="skeleton-label" />
          <SkeletonBlock className="skeleton-search" />
          <SkeletonBlock className="skeleton-copy-line" />
        </div>
        <div className="skeleton-csmp-progression">
          {Array.from({ length: 5 }, (_, index) => (
            <SkeletonBlock className="skeleton-csmp-step" key={index} />
          ))}
        </div>
      </div>
      <div className="skeleton-csmp-stage-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="skeleton-csmp-stage" key={index}>
            <div className="skeleton-csmp-stage-head">
              <SkeletonBlock className="skeleton-avatar" />
              <SkeletonBlock className="skeleton-row-title" />
              <SkeletonBlock className="skeleton-chip" />
            </div>
            {Array.from({ length: index === 0 || index === 3 ? 4 : 6 }, (_, rowIndex) => (
              <SkeletonBlock
                className="skeleton-csmp-map"
                key={rowIndex}
              />
            ))}
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}

function RoulettePageSkeleton() {
  return (
    <SkeletonScreen className="skeleton-roulette-page" label="룰렛 데이터를 불러오는 중">
      <div className="skeleton-roulette-heading">
        <SkeletonHeading />
        <SkeletonBlock className="skeleton-chip is-wide" />
      </div>
      <div className="skeleton-slot-machine">
        <SkeletonBlock className="skeleton-slot-marquee" />
        <div className="skeleton-slot-body">
          <div className="skeleton-reels">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonBlock className="skeleton-reel" key={index} />
            ))}
          </div>
          <SkeletonBlock className="skeleton-lever" />
        </div>
      </div>
      <div className="skeleton-roulette-result">
        <SkeletonBlock className="skeleton-thumbnail" />
        <div>
          <SkeletonBlock className="skeleton-row-title" />
          <SkeletonBlock className="skeleton-copy-line" />
          <SkeletonBlock className="skeleton-chip-row-block" />
        </div>
      </div>
    </SkeletonScreen>
  );
}

function MapDetailPageSkeleton() {
  return (
    <section
      className="detail-page detail-page-banner skeleton-detail-page"
      aria-busy="true"
      aria-label="맵 상세 정보를 불러오는 중"
    >
      <a className="back-link" href="#/list">← 전체 리스트</a>
      <SkeletonBlock className="skeleton-detail-banner" />
      <div className="skeleton-detail-facts">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton-detail-fact" key={index}>
            <SkeletonBlock className="skeleton-label" />
            <SkeletonBlock className="skeleton-number is-small" />
          </div>
        ))}
      </div>
      <div className="skeleton-board">
        <div className="skeleton-board-heading">
          <SkeletonHeading />
          <SkeletonBlock className="skeleton-refresh" />
        </div>
        <RecordRowsSkeleton count={4} />
      </div>
    </section>
  );
}

function PlayerProfileSkeleton() {
  return (
    <section
      className="player-profile-page skeleton-profile-page"
      aria-busy="true"
      aria-label="플레이어 프로필을 불러오는 중"
    >
      <a className="player-profile-back" href="#/players">
        <span aria-hidden="true">←</span>
        종합 순위로 돌아가기
      </a>
      <div className="skeleton-profile-hero">
        <div className="skeleton-player-identity">
          <SkeletonBlock className="skeleton-profile-avatar" />
          <div>
            <SkeletonBlock className="skeleton-kicker" />
            <SkeletonBlock className="skeleton-profile-name" />
            <SkeletonBlock className="skeleton-chip-row-block" />
          </div>
        </div>
        <SkeletonBlock className="skeleton-profile-score" />
      </div>
      <SkeletonStats />
      <SkeletonBlock className="skeleton-profile-best" />
      <div className="skeleton-board">
        <div className="skeleton-board-heading">
          <SkeletonHeading />
          <SkeletonBlock className="skeleton-chip is-wide" />
        </div>
        <RecordRowsSkeleton count={5} />
      </div>
    </section>
  );
}

function RoutePageSkeleton({ route }) {
  if (route === "/list") return <ListPageSkeleton />;
  if (route === "/players") return <PlayerLeaderboardSkeleton />;
  if (route.startsWith("/players/")) return <PlayerProfileSkeleton />;
  if (route === "/csmp") return <CsmpPageSkeleton />;
  if (route === "/roulette") return <RoulettePageSkeleton />;
  if (route.startsWith("/maps/")) return <MapDetailPageSkeleton />;
  return <HomePageSkeleton />;
}

function Home({ maps, loading = false }) {
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

        <div
          className={`hero-feature${loading ? " is-loading" : ""}`}
          aria-busy={loading || undefined}
        >
          {loading ? (
            <SkeletonBlock className="skeleton-feature-card" />
          ) : topMap ? (
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

      {loading ? (
        <SkeletonStats className="home-stats-skeleton" label="리스트 통계를 불러오는 중" />
      ) : (
        <section className="stats-rail" aria-label="리스트 통계">
          <StatItem label="TOTAL MAPS" value={maps.length} suffix="maps" />
          <StatItem label="MAIN" value={mainCount} suffix="1–10" />
          <StatItem label="EXTENDED" value={extendedCount} suffix="11–25" />
          <StatItem label="LEGACY" value={legacyCount} suffix="26+" />
        </section>
      )}

      <section className="home-top-section">
        <SectionHeading
          kicker="FEATURED RANKING"
          title="현재 TOP 5"
          action={<a className="inline-link" href="#/list">전체 순위 <ArrowIcon /></a>}
        />
        {loading ? (
          <div className="skeleton-feature-grid home-feature-skeleton" aria-busy="true" aria-label="TOP 5를 불러오는 중">
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonBlock className="skeleton-feature-tile" key={index} />
            ))}
          </div>
        ) : topFive.length > 0 ? (
          <div className="home-top-grid">
            {topFive.map((item) => <TopPreviewCard key={getMapKey(item)} item={item} />)}
          </div>
        ) : (
          <div className="empty-state home-empty-state">
            <span>NO MAPS</span>
            <h2>등록된 맵이 없습니다.</h2>
          </div>
        )}
      </section>
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

function CsmpRankIcon({ rank, showcase = false }) {
  const sources = useMemo(
    () => {
      if (!rank) return [];
      const preferred = rank.iconFile
        ? [`./images/csmp/${rank.iconFile}`]
        : [];
      const fallbackName = rank.iconName || rank.name;
      return [
        ...preferred,
        ...["png", "jpg", "jpeg", "webp"].map(
          (extension) => `./images/csmp/${fallbackName}.${extension}`,
        ),
      ].filter((source, index, values) => values.indexOf(source) === index);
    },
    [rank],
  );
  const [sourceIndex, setSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setSourceIndex(0);
  }, [rank?.key]);

  if (!rank) return null;

  const source = sources[sourceIndex];

  return (
    <span
      className={`csmp-rank-icon csmp-${rank.key}${showcase ? " is-showcase" : ""}`}
      style={getCsmpStyle(rank)}
      role="img"
      aria-label={`CSMP ${rank.name} 랭크`}
      title={`CSMP ${rank.name}`}
    >
      {source ? (
        <img
          src={source}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <span aria-hidden="true">{rank.name.charAt(0)}</span>
      )}
    </span>
  );
}

function CsmpMapBadge({ stage }) {
  if (!stage) return null;

  return (
    <span
      className={`csmp-map-badge csmp-${stage.key}`}
      style={getCsmpStyle(stage)}
    >
      CSMP {stage.name}
    </span>
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

function RatingRangeFilter({ value, onChange, resultCount, totalCount, loading = false }) {
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
            {loading ? (
              <SkeletonBlock className="skeleton-rating-count" />
            ) : (
              <><strong>{resultCount}</strong> / {totalCount}</>
            )}
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

function getRandomIndex(length) {
  if (length <= 1) return 0;

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % length;
  }

  return Math.floor(Math.random() * length);
}

function getRouletteCandidates(maps) {
  return maps.filter((item) => {
    const rank = Number(item.rank);
    return Number.isInteger(rank) && rank >= 1 && rank <= 999;
  });
}

function waitForRoulette(milliseconds, timerSet, token, tokenRef) {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      timerSet.current.delete(timer);
      resolve(token === tokenRef.current);
    }, milliseconds);

    timerSet.current.add(timer);
  });
}

function RouletteMapCard({ item, preview = false }) {
  const rankNumber = String(item.rank).padStart(3, "0");
  const displayedLevelId = getDisplayedLevelId(item);

  return (
    <article
      className={`roulette-result-card ${getRankBorderClass(item.rank)} ${
        preview ? "is-live-preview" : ""
      }`}
    >
      <div className="roulette-result-rank">
        <span>{preview ? "CURRENT RANK" : "WINNING RANK"}</span>
        <strong>#{rankNumber}</strong>
        <small>{getTier(item.rank)}</small>
      </div>

      <RankingThumbnail item={item} />

      <div className="roulette-result-copy">
        <p className="section-kicker">
          {preview ? "CURRENT MAP" : "SELECTED MAP"}
        </p>
        <h2>{item.title}</h2>
        <p>
          by <strong>{item.creator || "Unknown"}</strong>
          <span aria-hidden="true"> · </span>
          verified by <strong>{item.verifier || "Unknown"}</strong>
        </p>

        <div className="badge-row">
          <RatingBadge rating={item.rating} compact />
          <LengthBadge length={item.length} compact />
          <span className="neutral-badge">ID {displayedLevelId}</span>
        </div>
      </div>

      {preview ? null : (
        <a
          className="roulette-detail-link"
          href={`#/maps/${getMapKey(item)}`}
        >
          상세 보기 <ArrowIcon />
        </a>
      )}
    </article>
  );
}

function RoulettePage({ maps, loading = false }) {
  const candidates = useMemo(() => getRouletteCandidates(maps), [maps]);
  const [digits, setDigits] = React.useState(["0", "0", "0"]);
  const [stoppedReels, setStoppedReels] = React.useState([true, true, true]);
  const [phase, setPhase] = React.useState("idle");
  const [spinning, setSpinning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [targetDigits, setTargetDigits] = React.useState(null);
  const [settlingReel, setSettlingReel] = React.useState(-1);
  const [leverPull, setLeverPull] = React.useState(0);
  const [livePreviewDigits, setLivePreviewDigits] = React.useState(["0", "0", "0"]);

  const timeoutIds = React.useRef(new Set());
  const spinToken = React.useRef(0);
  const reelTrackRefs = React.useRef([]);
  const reelFrameRefs = React.useRef([null, null, null]);
  const reelMotionRefs = React.useRef([
    { position: 20, velocity: 0, lastTime: 0 },
    { position: 20, velocity: 0, lastTime: 0 },
    { position: 20, velocity: 0, lastTime: 0 },
  ]);
  const leverDragRef = React.useRef({
    active: false,
    pointerId: null,
    startY: 0,
    progress: 0,
  });
  const leverTriggerRef = React.useRef(false);
  const liveDigitsRef = React.useRef(["0", "0", "0"]);
  const livePreviewTimerRef = React.useRef(null);
  const livePreviewLastPublishRef = React.useRef(0);

  const clearAnimations = React.useCallback(() => {
    timeoutIds.current.forEach((timer) => window.clearTimeout(timer));
    timeoutIds.current.clear();

    reelFrameRefs.current.forEach((frameId, index) => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      reelFrameRefs.current[index] = null;
    });

    if (livePreviewTimerRef.current !== null) {
      window.clearTimeout(livePreviewTimerRef.current);
      livePreviewTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      spinToken.current += 1;
      clearAnimations();
    },
    [clearAnimations],
  );

  const setDigit = React.useCallback((index, value) => {
    setDigits((current) => {
      const next = [...current];
      next[index] = String(value);
      return next;
    });
  }, []);

  const publishLivePreviewDigits = React.useCallback(() => {
    livePreviewLastPublishRef.current = performance.now();
    livePreviewTimerRef.current = null;
    setLivePreviewDigits([...liveDigitsRef.current]);
  }, []);

  const updateLiveDigit = React.useCallback(
    (index, position) => {
      const centeredDigit = String(
        ((Math.round(position) % 10) + 10) % 10,
      );

      if (liveDigitsRef.current[index] === centeredDigit) return;

      const nextDigits = [...liveDigitsRef.current];
      nextDigits[index] = centeredDigit;
      liveDigitsRef.current = nextDigits;

      const elapsed =
        performance.now() - livePreviewLastPublishRef.current;
      const publishInterval = 95;

      if (elapsed >= publishInterval) {
        publishLivePreviewDigits();
        return;
      }

      if (livePreviewTimerRef.current !== null) return;

      livePreviewTimerRef.current = window.setTimeout(() => {
        publishLivePreviewDigits();
      }, publishInterval - elapsed);
    },
    [publishLivePreviewDigits],
  );

  const applyReelPosition = React.useCallback(
    (index, position, motion = 1) => {
      const track = reelTrackRefs.current[index];
      if (!track) return;

      track.style.setProperty("--reel-position", position.toFixed(5));
      track.style.setProperty(
        "--reel-motion",
        String(Math.max(0, Math.min(1, motion))),
      );
      updateLiveDigit(index, position);
    },
    [updateLiveDigit],
  );

  const cancelReelFrame = React.useCallback((index) => {
    const frameId = reelFrameRefs.current[index];
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      reelFrameRefs.current[index] = null;
    }
  }, []);

  const startContinuousReel = React.useCallback(
    (index, velocity, token) => {
      cancelReelFrame(index);

      const motionState = reelMotionRefs.current[index];
      motionState.velocity = velocity;
      motionState.lastTime = performance.now();

      const frame = (now) => {
        if (token !== spinToken.current) return;

        const elapsed = Math.min((now - motionState.lastTime) / 1000, 0.04);
        motionState.lastTime = now;
        motionState.position += motionState.velocity * elapsed;

        // The strip repeats every ten cells, so this reset is visually seamless.
        if (motionState.position >= 30) motionState.position -= 10;

        applyReelPosition(index, motionState.position, 1);
        reelFrameRefs.current[index] = window.requestAnimationFrame(frame);
      };

      reelFrameRefs.current[index] = window.requestAnimationFrame(frame);
    },
    [applyReelPosition, cancelReelFrame],
  );

  const settleReel = React.useCallback(
    (index, targetDigit, duration, minimumTurns, token) =>
      new Promise((resolve) => {
        cancelReelFrame(index);
        setSettlingReel(index);

        const motionState = reelMotionRefs.current[index];
        const startPosition = motionState.position;
        const startVelocity = Math.max(0.01, motionState.velocity);
        const durationSeconds = duration / 1000;
        const numericTarget = Number(targetDigit);

        // With constant deceleration, distance is v0 * T / 2.
        const naturalStopPosition =
          startPosition + (startVelocity * durationSeconds) / 2;
        const minimumTarget = startPosition + minimumTurns * 10;

        const firstTargetAtOrAfter = (position) =>
          Math.ceil((position - numericTarget) / 10) * 10 + numericTarget;

        const lowerCandidate = firstTargetAtOrAfter(
          Math.max(minimumTarget, naturalStopPosition - 5),
        );
        const upperCandidate = lowerCandidate + 10;

        const targetPosition =
          Math.abs(lowerCandidate - naturalStopPosition) <=
          Math.abs(upperCandidate - naturalStopPosition)
            ? lowerCandidate
            : upperCandidate;

        const naturalDistance = (startVelocity * durationSeconds) / 2;
        const endpointCorrection =
          targetPosition - (startPosition + naturalDistance);
        const startedAt = performance.now();

        const frame = (now) => {
          if (token !== spinToken.current) {
            resolve(false);
            return;
          }

          const progress = Math.min((now - startedAt) / duration, 1);

          // Constant-deceleration baseline:
          // x(u) = x0 + v0*T*(u - u²/2)
          const decelerationBase =
            startPosition +
            startVelocity *
              durationSeconds *
              (progress - (progress * progress) / 2);

          // Quintic smoothstep has zero first/second derivatives at both ends,
          // so correcting to the exact digit never creates a visible jerk.
          const smoothCorrection =
            progress * progress * progress *
            (10 + progress * (-15 + progress * 6));

          const position =
            decelerationBase + endpointCorrection * smoothCorrection;
          const remainingMotion = Math.pow(1 - progress, 1.15);

          motionState.position = position;
          motionState.velocity = startVelocity * (1 - progress);
          applyReelPosition(index, position, remainingMotion);

          if (progress < 1) {
            reelFrameRefs.current[index] = window.requestAnimationFrame(frame);
            return;
          }

          // The repeated strip is already exactly on the winning cell.
          // Reset to the equivalent middle copy only after all motion is zero.
          motionState.position = 20 + numericTarget;
          motionState.velocity = 0;
          applyReelPosition(index, motionState.position, 0);
          reelFrameRefs.current[index] = null;

          setDigit(index, numericTarget);
          setStoppedReels((current) => {
            const next = [...current];
            next[index] = true;
            return next;
          });
          setSettlingReel(-1);
          resolve(true);
        };

        reelFrameRefs.current[index] = window.requestAnimationFrame(frame);
      }),
    [applyReelPosition, cancelReelFrame, setDigit],
  );

  const spinRoulette = React.useCallback(async () => {
    if (spinning || candidates.length === 0) return;

    clearAnimations();
    const token = spinToken.current + 1;
    spinToken.current = token;

    const selectedMap = candidates[getRandomIndex(candidates.length)];
    const nextTargetDigits = String(selectedMap.rank)
      .padStart(3, "0")
      .slice(-3)
      .split("");

    const startingDigits = [...digits];
    liveDigitsRef.current = startingDigits;
    setLivePreviewDigits(startingDigits);
    livePreviewLastPublishRef.current = performance.now();

    setSpinning(true);
    setResult(null);
    setTargetDigits(nextTargetDigits);
    setSettlingReel(-1);
    setPhase("hundreds");
    setStoppedReels([false, false, false]);

    reelMotionRefs.current.forEach((motionState, index) => {
      motionState.position = 20 + Number(digits[index]);
      applyReelPosition(index, motionState.position, 1);
    });

    startContinuousReel(0, 11.8, token);
    startContinuousReel(1, 12.9, token);
    startContinuousReel(2, 14.1, token);

    let stillCurrent = await waitForRoulette(820, timeoutIds, token, spinToken);
    if (!stillCurrent) return;

    stillCurrent = await settleReel(0, nextTargetDigits[0], 1500, 1.2, token);
    if (!stillCurrent) return;

    setPhase("tens");
    stillCurrent = await waitForRoulette(140, timeoutIds, token, spinToken);
    if (!stillCurrent) return;

    stillCurrent = await settleReel(1, nextTargetDigits[1], 2050, 1.7, token);
    if (!stillCurrent) return;

    setPhase("ones");
    stillCurrent = await waitForRoulette(180, timeoutIds, token, spinToken);
    if (!stillCurrent) return;

    stillCurrent = await settleReel(2, nextTargetDigits[2], 4800, 2.8, token);
    if (!stillCurrent) return;

    setResult(selectedMap);
    setPhase("complete");
    setSpinning(false);
  }, [
    applyReelPosition,
    candidates,
    clearAnimations,
    digits,
    settleReel,
    spinning,
    startContinuousReel,
  ]);

  const setLeverProgress = React.useCallback((progress) => {
    const normalized = Math.max(0, Math.min(1, progress));
    leverDragRef.current.progress = normalized;
    setLeverPull(normalized);
  }, []);

  const triggerLeverSpin = React.useCallback(
    ({ alreadyPulled = false } = {}) => {
      if (
        spinning ||
        candidates.length === 0 ||
        leverTriggerRef.current
      ) {
        return;
      }

      leverTriggerRef.current = true;

      const startSpin = () => {
        spinRoulette();

        const releaseTimer = window.setTimeout(() => {
          timeoutIds.current.delete(releaseTimer);
          setLeverProgress(0);
        }, 430);
        timeoutIds.current.add(releaseTimer);

        const unlockTimer = window.setTimeout(() => {
          timeoutIds.current.delete(unlockTimer);
          leverTriggerRef.current = false;
        }, 1500);
        timeoutIds.current.add(unlockTimer);
      };

      if (alreadyPulled) {
        setLeverProgress(1);

        const bottomHoldTimer = window.setTimeout(() => {
          timeoutIds.current.delete(bottomHoldTimer);
          startSpin();
        }, 360);
        timeoutIds.current.add(bottomHoldTimer);
        return;
      }

      // Keyboard/tap activation performs a complete physical pull first.
      setLeverProgress(1);

      const pullTimer = window.setTimeout(() => {
        timeoutIds.current.delete(pullTimer);
        startSpin();
      }, 760);
      timeoutIds.current.add(pullTimer);
    },
    [candidates.length, setLeverProgress, spinRoulette, spinning],
  );

  const beginLeverPull = React.useCallback(
    (event) => {
      if (spinning || candidates.length === 0) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      leverDragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startY: event.clientY,
        progress: 0,
      };
      setLeverProgress(0);
    },
    [candidates.length, setLeverProgress, spinning],
  );

  const moveLeverPull = React.useCallback(
    (event) => {
      const drag = leverDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      event.preventDefault();
      const distance = Math.max(0, event.clientY - drag.startY);
      setLeverProgress(distance / 156);
    },
    [setLeverProgress],
  );

  const finishLeverPull = React.useCallback(
    (event) => {
      const drag = leverDragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const progress = drag.progress;
      leverDragRef.current.active = false;

      // A full pull triggers the spin. A simple tap also performs a complete pull.
      if (progress >= 0.58) {
        triggerLeverSpin({ alreadyPulled: true });
      } else if (progress < 0.07) {
        triggerLeverSpin();
      } else {
        setLeverProgress(0);
      }
    },
    [setLeverProgress, triggerLeverSpin],
  );

  const cancelLeverPull = React.useCallback(() => {
    leverDragRef.current.active = false;
    setLeverProgress(0);
  }, [setLeverProgress]);

  const handleLeverKey = React.useCallback(
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      triggerLeverSpin();
    },
    [triggerLeverSpin],
  );

  const singleDigitFocus =
    phase === "ones" &&
    targetDigits?.[0] === "0" &&
    targetDigits?.[1] === "0";

  const livePreviewActive = spinning && stoppedReels[0];
  const livePreviewRankText = livePreviewDigits.join("");
  const livePreviewRank = Number(livePreviewRankText);
  const livePreviewMap = useMemo(
    () =>
      livePreviewActive
        ? candidates.find(
            (item) => Number(item.rank) === livePreviewRank,
          ) || null
        : null,
    [candidates, livePreviewActive, livePreviewRank],
  );

  const reelCells = Array.from({ length: 80 }, (_, index) => index % 10);

  return (
    <section
      className={`roulette-page ${
        singleDigitFocus ? "is-single-digit-focus-page" : ""
      }`}
    >
      {singleDigitFocus ? (
        <div className="roulette-focus-overlay" aria-hidden="true" />
      ) : null}

      <header className="roulette-heading">
        <div>
          <p className="section-kicker">DEMON ROULETTE</p>
          <h1>데몬 리스트 슬롯머신</h1>
          <p>등록된 맵 가운데 하나를 무작위로 추첨합니다.</p>
        </div>
        <span className={`roulette-map-count${loading ? " is-loading" : ""}`}>
          {loading ? <SkeletonBlock className="skeleton-roulette-count" /> : `${candidates.length} MAPS`}
        </span>
      </header>

      <article
        className={`slot-machine ${spinning ? "is-spinning" : ""} ${
          phase === "ones" ? "is-final-reel" : ""
        } ${singleDigitFocus ? "is-single-digit-focus" : ""}`}
      >
        <div className="slot-machine-marquee">
          <span>RANDOM DEMON SELECTOR</span>
          <div aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>

        <div className="slot-machine-body">
          <div className="slot-machine-display">
            <div
              className="slot-reels"
              aria-label={spinning ? "슬롯 숫자 회전 중" : `현재 숫자 ${digits.join("")}`}
            >
              {digits.map((digit, index) => (
                <div
                  className={`slot-reel ${
                    spinning && !stoppedReels[index] ? "is-rolling" : ""
                  } ${settlingReel === index ? "is-decelerating" : ""} ${
                    stoppedReels[index] ? "is-stopped" : ""
                  }`}
                  key={index}
                  style={{ "--reel-index": index }}
                >
                  <div
                    className="slot-reel-track"
                    ref={(element) => {
                      reelTrackRefs.current[index] = element;
                    }}
                    style={{
                      "--reel-position": 20 + Number(digit),
                      "--reel-motion": 0,
                    }}
                    aria-hidden="true"
                  >
                    {reelCells.map((cellDigit, cellIndex) => (
                      <span key={cellIndex}>{cellDigit}</span>
                    ))}
                  </div>

                  <span className="slot-reel-speed-lines" aria-hidden="true" />
                  <span className="slot-reel-window" aria-hidden="true" />
                </div>
              ))}
            </div>

            <div className="slot-machine-number-line">
              <span>RANK</span>
              <strong>{spinning ? "•••" : digits.join("")}</strong>
            </div>
          </div>

          <button
            className={`slot-lever ${leverPull > 0.04 ? "is-dragging" : ""}`}
            type="button"
            disabled={loading || spinning || candidates.length === 0}
            onPointerDown={beginLeverPull}
            onPointerMove={moveLeverPull}
            onPointerUp={finishLeverPull}
            onPointerCancel={cancelLeverPull}
            onLostPointerCapture={cancelLeverPull}
            onKeyDown={handleLeverKey}
            aria-label={
              loading
                ? "맵 데이터를 불러오는 중"
                : spinning
                ? "슬롯머신 추첨 중"
                : "레버 손잡이를 아래로 당겨 맵 추첨"
            }
            style={{
              "--lever-pull": leverPull,
            }}
          >
            <span className="slot-lever-housing" aria-hidden="true">
              <span className="slot-lever-groove" />
              <span className="slot-lever-spring" />
              <span className="slot-lever-carriage" />
              <span className="slot-lever-arm">
                <span className="slot-lever-knob" />
              </span>
            </span>

            <span className="slot-lever-copy">
              <strong>{spinning ? "SPINNING" : "PULL"}</strong>
              <small>{spinning ? "추첨 중" : "아래로 당기기"}</small>
            </span>
          </button>
        </div>
      </article>

      <section className="roulette-result-section" aria-live="polite">
        {loading ? (
          <div className="skeleton-roulette-result roulette-data-skeleton" aria-busy="true" aria-label="룰렛 맵을 불러오는 중">
            <SkeletonBlock className="skeleton-thumbnail" />
            <div>
              <SkeletonBlock className="skeleton-row-title" />
              <SkeletonBlock className="skeleton-copy-line" />
              <SkeletonBlock className="skeleton-chip-row-block" />
            </div>
          </div>
        ) : result ? (
          <RouletteMapCard item={result} />
        ) : livePreviewActive ? (
          livePreviewMap ? (
            <RouletteMapCard item={livePreviewMap} preview />
          ) : (
            <div
              className="roulette-live-empty"
              aria-label={`현재 ${livePreviewRankText}위에 등록된 맵이 없습니다.`}
            />
          )
        ) : (
          <div className="roulette-result-placeholder">
            <span>RESULT</span>
            <h2>아직 추첨된 맵이 없습니다.</h2>
            <p>오른쪽 레버를 아래로 당기면 슬롯이 돌아갑니다.</p>
          </div>
        )}
      </section>

    </section>
  );
}

function ListPage({ maps, initialQuery = "", loading = false, csmpStages = [] }) {
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
        loading={loading}
      />

      {(loading || filteredMaps.length > 0) && (
        <section className="ranking-section">
          <div className="ranking-table-head" aria-hidden="true">
            <span>RANK</span>
            <span>PREVIEW</span>
            <span>MAP</span>
            <span>CREATOR / VERIFIER</span>
            <span>DETAIL</span>
          </div>
          {loading ? (
            <SkeletonRankingRows />
          ) : (
            <div className="ranking-list">
              {filteredMaps.map((item) => (
                <RankingRow
                  key={getMapKey(item)}
                  item={item}
                  query={query}
                  csmpStages={csmpStages}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && filteredMaps.length === 0 && (
        <div className="empty-state">
          <span>NO RESULTS</span>
          <h2>검색 결과가 없습니다.</h2>
          <p>검색어, 순위 구간 또는 난이도 범위를 변경해 보세요.</p>
        </div>
      )}
    </section>
  );
}

function FeaturedMapCard({ item, csmpStages = [] }) {
  const csmpStage = getCsmpStageForMap(item, csmpStages);

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
        <div className="featured-map-title-line">
          <h2>{item.title}</h2>
          <CsmpMapBadge stage={csmpStage} />
        </div>
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

function RankingRow({ item, query, csmpStages = [] }) {
  const baseScore = getCorumBaseScore(item.rank);
  const csmpStage = getCsmpStageForMap(item, csmpStages);
  const displayedLevelId = getDisplayedLevelId(item);
  const minimumRecord = Number(item.minimumRecord);
  const showsMinimumRecord =
    Number.isFinite(minimumRecord) && minimumRecord >= 1 && minimumRecord < 100;

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
        {showsMinimumRecord && (
          <small
            className="ranking-minimum-record"
            title={`최소 등재 기록 ${minimumRecord}%`}
          >
            {minimumRecord}%
          </small>
        )}
      </div>

      <RankingThumbnail item={item} />

      <div className="ranking-map-copy">
        <div className="ranking-map-title-line">
          <h2><HighlightText text={item.title} query={query} /></h2>
          <CsmpMapBadge stage={csmpStage} />
        </div>
        <div className="badge-row">
          <RatingBadge rating={item.rating} compact query={query} />
          <LengthBadge length={item.length} compact query={query} />
          <span className="neutral-badge">
            ID <HighlightText text={displayedLevelId} query={query} />
          </span>
          <span className="map-score-badge">
            <small>100%</small>
            <strong>{formatCorumScore(baseScore)} PTS</strong>
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

function MapDetailPage({ maps, mapKey, loading = false }) {
  const decodedKey = decodeURIComponent(mapKey || "");
  const item = maps.find(
    (map) =>
      String(map.levelId) === decodedKey ||
      String(map.alternateLevelId) === decodedKey ||
      String(map.orderId) === decodedKey ||
      map.title === decodedKey,
  );

  if (loading) return <MapDetailPageSkeleton />;

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
            <span className="mono map-code-stack">
              <span>
                <small>대표</small>
                {item.levelId || "-"}
              </span>
              {item.alternateLevelId ? (
                <span className="is-alternate">
                  <small>대체</small>
                  {item.alternateLevelId}
                </span>
              ) : null}
            </span>
          </div>
          <div className="map-detail-fact">
            <span>최소 등록 기록</span>
            <strong>{item.minimumRecord}%</strong>
          </div>
          <div className="map-detail-fact map-detail-score">
            <span>100% 배점</span>
            <strong>{formatCorumScore(getCorumBaseScore(item.rank))} PTS</strong>
          </div>
        </div>
      </article>

      <RecordLeaderboard
        levelId={item.levelId}
        rank={item.rank}
        minimumRecord={item.minimumRecord}
        verifier={item.verifier}
      />
    </section>
  );
}

function getRecordStatusLabel(status) {
  if (status === "verified") return "검증됨";
  if (status === "rejected") return "반려됨";
  return "미검증";
}

function getSafeProofUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function formatRecordDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPlayTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "-";

  const totalSeconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function RecordLeaderboard({ levelId, rank, minimumRecord, verifier }) {
  const { records, loading, error, reload } = useRecords(levelId);
  const sortedRecords = useMemo(
    () => {
      const bestRecords = getBestPlayerRecords(records).sort((left, right) => {
        const percentDifference = (right.percent ?? -1) - (left.percent ?? -1);
        if (percentDifference !== 0) return percentDifference;

        const scoreDifference =
          getFrozenOrEstimatedScore(right, rank, minimumRecord) -
          getFrozenOrEstimatedScore(left, rank, minimumRecord);
        if (scoreDifference !== 0) return scoreDifference;

        const rightTime = Date.parse(right.clearedAt) || 0;
        const leftTime = Date.parse(left.clearedAt) || 0;
        return rightTime - leftTime;
      });

      return pinVerifierRecord(bestRecords, verifier, levelId);
    },
    [records, rank, minimumRecord, verifier, levelId],
  );

  return (
    <section className="record-board" aria-labelledby="record-board-title">
      <div className="record-board-heading">
        <div>
          <p className="section-kicker">CORUM RECORDS</p>
          <h2 id="record-board-title">등재 기록</h2>
          <p className="record-board-description">
            등록 기준 <strong>{minimumRecord}%</strong> 이상 · 최고 기록 갱신 시 점수 재확정
          </p>
        </div>

        <div className="record-board-heading-actions">
          <span className="record-count">
            {sortedRecords.length} RECORD{sortedRecords.length === 1 ? "" : "S"}
          </span>
          <button
            type="button"
            className={`record-refresh${loading ? " is-loading" : ""}`}
            onClick={reload}
            disabled={loading}
            aria-label="기록 새로고침"
          >
            <RefreshIcon />
            <span>{loading ? "불러오는 중" : "새로고침"}</span>
          </button>
        </div>
      </div>

      {loading && records.length === 0 ? (
        <RecordRowsSkeleton count={4} />
      ) : error ? (
        <div className="record-state is-error">
          <strong>기록을 불러오지 못했습니다.</strong>
          <p>{error}</p>
          <button type="button" onClick={reload}>다시 시도</button>
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="record-state">
          <strong>아직 등재된 기록이 없습니다.</strong>
          <p>등록 기준을 달성한 뒤 게임 내 왼쪽 전송 버튼을 누르면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="record-list">
          {sortedRecords.map((record, index) => {
            const proofUrl = getSafeProofUrl(record.proofUrl);
            const recordScore = getFrozenOrEstimatedScore(
              record,
              rank,
              minimumRecord,
            );
            const statusClass =
              record.status === "verified"
                ? "is-verified"
                : record.status === "rejected"
                  ? "is-rejected"
                  : "is-unverified";

            return (
              <article
                className={`record-row${record.isVerifierRecord ? " is-verifier-record" : ""}`}
                key={record.recordId || `${record.levelId}-${record.player}-${record.clearedAt}-${index}`}
              >
                <span className="record-position">#{index + 1}</span>

                <div className="record-player">
                  <span className="record-avatar" aria-hidden="true">
                    {(record.player || "?").charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>
                      <span className="record-player-name">{record.player}</span>
                      {record.isVerifierRecord && (
                        <em className="record-verifier-badge">VERIFIER</em>
                      )}
                    </strong>
                    <span>{formatRecordDate(record.clearedAt)}</span>
                  </div>
                </div>

                <div className="record-percent">
                  <span>BEST</span>
                  <strong>{record.percent ?? "-"}%</strong>
                  <em>{formatCorumScore(recordScore)} PTS</em>
                </div>

                <div className="record-metrics">
                  <p><span>ATTEMPTS</span><strong>{record.attempts ?? "-"}</strong></p>
                  <p><span>JUMPS</span><strong>{record.jumps ?? "-"}</strong></p>
                  <p><span>PLAY TIME</span><strong>{formatPlayTime(record.playTimeMs)}</strong></p>
                  <p><span>PLATFORM</span><strong>{record.platform || "-"}</strong></p>
                </div>

                <div className="record-actions">
                  <span className={`record-status ${statusClass}`}>
                    {getRecordStatusLabel(record.status)}
                  </span>
                  {proofUrl && (
                    <a href={proofUrl} target="_blank" rel="noreferrer">
                      증거 보기 <ArrowIcon />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getPlayerProfileHref(player) {
  const accountId = String(player?.accountId || "").trim();
  if (accountId) {
    return `#/players/account/${encodeURIComponent(accountId)}`;
  }

  return `#/players/name/${encodeURIComponent(String(player?.player || "").trim())}`;
}

function decodeRouteComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function ScoreScaleCard() {
  return (
    <section className="score-scale-card" aria-label="코럼 점수 구간">
      <div className="score-scale-head">
        <span>SCORING MODEL</span>
        <strong>{CORUM_SCORING_VERSION}</strong>
      </div>
      <div className="score-scale-list">
        <p><span>TOP 1</span><strong>350.00</strong></p>
        <p><span>TOP 2–5</span><strong>300 → 220</strong></p>
        <p><span>MAIN 6–10</span><strong>200 → 140</strong></p>
        <p><span>EXTENDED 11–25</span><strong>130 → 50</strong></p>
        <p><span>LEGACY 26+</span><strong>45 × 0.94ⁿ</strong></p>
      </div>
    </section>
  );
}

function CsmpPage({
  maps,
  mapsLoading = false,
  csmpStages = [],
  csmpLoading = false,
  csmpError = "",
  reloadCsmp,
}) {
  const {
    players,
    loading: playersLoading,
    error: playersError,
  } = useScores(csmpStages);
  const [playerQuery, setPlayerQuery] = React.useState("");
  const [submittedQuery, setSubmittedQuery] = React.useState("");
  const mapsByIdentity = useMemo(
    () => {
      const lookup = new Map();
      maps.forEach((map) => {
        const mapKey = getCsmpMapKey(map);
        if (mapKey) lookup.set(mapKey, map);
        if (map.alternateLevelId) {
          lookup.set(getCsmpMapKey({ levelId: map.alternateLevelId }), map);
        }
        const titleKey = normalizeCsmpMapTitle(map.title);
        if (titleKey) lookup.set(`title:${titleKey}`, map);
      });
      return lookup;
    },
    [maps],
  );
  const selectedPlayer = useMemo(() => {
    const normalizedQuery = submittedQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return null;

    return (
      players.find(
        (player) => player.player.trim().toLocaleLowerCase() === normalizedQuery,
      ) || null
    );
  }, [players, submittedQuery]);
  const selectedPlayerRecords = useMemo(() => {
    if (!selectedPlayer) return [];
    if (selectedPlayer.records.length > 0) return selectedPlayer.records;
    return selectedPlayer.bestRecord ? [selectedPlayer.bestRecord] : [];
  }, [selectedPlayer]);
  const completedMapKeys = useMemo(
    () => getCompletedCsmpMapKeys(selectedPlayerRecords, csmpStages),
    [selectedPlayerRecords, csmpStages],
  );
  const totalCsmpMaps = useMemo(
    () => getCsmpTotalMapCount(csmpStages),
    [csmpStages],
  );
  const playerNotFound =
    Boolean(submittedQuery) &&
    !playersLoading &&
    !playersError &&
    !selectedPlayer;

  const submitPlayerSearch = (event) => {
    event.preventDefault();
    setSubmittedQuery(playerQuery.trim());
  };

  if (csmpLoading && csmpStages.length === 0) {
    return <CsmpPageSkeleton />;
  }

  if (csmpError) {
    return (
      <section className="csmp-page">
        <div className="record-state is-error">
          <strong>CSMP 설정을 불러오지 못했습니다.</strong>
          <p>{csmpError}</p>
          {reloadCsmp && <button type="button" onClick={reloadCsmp}>다시 시도</button>}
        </div>
      </section>
    );
  }

  if (csmpStages.length === 0) {
    return (
      <section className="csmp-page">
        <div className="record-state">
          <strong>설정된 CSMP 티어가 없습니다.</strong>
          <p>스프레드시트의 CSMP Tiers 탭에서 티어를 추가해 주세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="csmp-page">
      <header className="csmp-hero">
        <div className="csmp-hero-top">
          <div className="csmp-hero-copy">
            <p className="section-kicker">CORUM SIGNATURE MAP PROGRESSION</p>
            <h1>CSMP</h1>
            <p>
              지정된 시그니처 맵의 100% 기록으로 랭크를 올리는 순차 진행
              시스템입니다. 이전 랭크를 달성해야 다음 단계가 해금됩니다.
            </p>
          </div>

          <form className="csmp-player-search" onSubmit={submitPlayerSearch}>
            <label htmlFor="csmp-player-name">PLAYER PROGRESS</label>
            <div className="csmp-player-search-control">
              <SearchIcon />
              <input
                id="csmp-player-name"
                type="search"
                value={playerQuery}
                onChange={(event) => setPlayerQuery(event.target.value)}
                placeholder="Geometry Dash 닉네임"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={playersLoading || !playerQuery.trim()}
              >
                {playersLoading ? "LOADING" : "SEARCH"}
              </button>
            </div>

            {playersLoading && players.length === 0 ? (
              <div className="csmp-search-loading-copy">
                <p className="csmp-search-message">
                  닉네임을 검색하면 랭크별 클리어 현황을 표시합니다.
                </p>
                <span
                  className="csmp-search-loading"
                  aria-busy="true"
                  aria-label="플레이어 데이터를 불러오는 중"
                >
                  <SkeletonBlock className="skeleton-csmp-search-line" />
                </span>
              </div>
            ) : playersError ? (
              <p className="csmp-search-message is-error">{playersError}</p>
            ) : playerNotFound ? (
              <p className="csmp-search-message is-error">
                “{submittedQuery}” 플레이어를 찾을 수 없습니다.
              </p>
            ) : selectedPlayer ? (
              <div
                className="csmp-player-result"
                style={getCsmpStyle(selectedPlayer.csmp.current)}
              >
                <div>
                  <span>PLAYER FOUND</span>
                  <strong>{selectedPlayer.player}</strong>
                </div>
                <p>
                  <strong>
                    CSMP {selectedPlayer.csmp.current?.name || "Unranked"}
                  </strong>
                  <span>{completedMapKeys.size}/{totalCsmpMaps} CLEARED</span>
                </p>
                <small>
                  {selectedPlayer.csmp.next
                    ? `NEXT ${selectedPlayer.csmp.next.name.toUpperCase()} · ${selectedPlayer.csmp.next.completed}/${selectedPlayer.csmp.next.required}`
                    : "ALL RANKS COMPLETED"}
                </small>
              </div>
            ) : (
              <p className="csmp-search-message">
                닉네임을 검색하면 랭크별 클리어 현황을 표시합니다.
              </p>
            )}
          </form>
        </div>

        <div className="csmp-progression" aria-label="CSMP 랭크 진행 순서">
          {csmpStages.map((stage, index) => (
            <React.Fragment key={stage.key}>
              <div
                className={`csmp-progression-step csmp-${stage.key}`}
                style={getCsmpStyle(stage)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.name}</strong>
              </div>
              {index < csmpStages.length - 1 && (
                <ArrowIcon />
              )}
            </React.Fragment>
          ))}
        </div>
      </header>

      <div className="csmp-stage-grid">
        {csmpStages.map((stage, index) => {
          const requiresAll = stage.requiresAll;
          const playerStage = selectedPlayer?.csmp.stages.find(
            (progress) => progress.key === stage.key,
          );

          return (
            <article
              className={`csmp-stage-card csmp-${stage.key}`}
              key={stage.key}
              style={getCsmpStyle(stage)}
            >
              <div className="csmp-stage-heading">
                <CsmpRankIcon rank={stage} showcase />
                <div>
                  <span>STEP {String(index + 1).padStart(2, "0")}</span>
                  <h2>{stage.name}</h2>
                </div>
                <strong>
                  {selectedPlayer
                    ? `${playerStage?.completed || 0}/${stage.maps.length} CLEAR`
                    : requiresAll
                      ? `ALL ${stage.maps.length}`
                      : `${stage.required} OF ${stage.maps.length}`}
                </strong>
              </div>

              <ol className="csmp-map-list">
                {stage.maps.map((csmpMap) => {
                  const title = csmpMap.title;
                  const titleKey = normalizeCsmpMapTitle(title);
                  const csmpMapKey = getCsmpMapKey(csmpMap);
                  const map =
                    mapsByIdentity.get(csmpMapKey) ||
                    mapsByIdentity.get(`title:${titleKey}`);
                  const isCleared = selectedPlayer
                    ? completedMapKeys.has(csmpMapKey)
                    : null;
                  const content = (
                    <>
                      <span className="csmp-map-title">{title}</span>
                      <div className="csmp-map-meta">
                        {mapsLoading ? (
                          <SkeletonBlock className="skeleton-csmp-map-rank" />
                        ) : map ? (
                          <small>#{map.rank}</small>
                        ) : null}
                        {selectedPlayer && (
                          <em>{isCleared ? "CLEARED" : "UNCLEARED"}</em>
                        )}
                      </div>
                    </>
                  );

                  return (
                    <li
                      className={
                        selectedPlayer
                          ? isCleared
                            ? "is-cleared"
                            : "is-uncleared"
                          : ""
                      }
                      key={csmpMapKey || title}
                    >
                      {map ? (
                        <a href={`#/maps/${getMapKey(map)}`}>{content}</a>
                      ) : (
                        <div>{content}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PlayerLeaderboardPage({ csmpStages = [], csmpLoading = false }) {
  const {
    players,
    loading: scoresLoading,
    error,
    generatedAt,
    reload,
  } = useScores(csmpStages);
  const loading = scoresLoading || csmpLoading;
  const totalRecords = useMemo(
    () => players.reduce((sum, player) => sum + player.recordCount, 0),
    [players],
  );
  const totalCompletions = useMemo(
    () => players.reduce((sum, player) => sum + player.completions, 0),
    [players],
  );

  return (
    <section className="players-page">
      <div className="players-hero">
        <div className="players-hero-copy">
          <p className="section-kicker">CORUM PLAYER RANKING</p>
          <h1>플레이어 점수</h1>
          <p>
            각 맵의 현재 순위와 최고 기록을 기준으로 계산합니다. 기록을 갱신하면
            같은 플레이어와 맵의 기존 점수 대신 새 최고 기록만 반영됩니다.
          </p>
        </div>
      </div>

      {loading && players.length === 0 ? (
        <SkeletonStats className="players-summary-skeleton" label="플레이어 점수 통계를 불러오는 중" />
      ) : (
        <div className="players-summary" aria-label="플레이어 점수 통계">
          <StatItem label="RANKED PLAYERS" value={players.length} suffix="players" />
          <StatItem label="SCORING RECORDS" value={totalRecords} suffix="best runs" />
          <StatItem label="FULL CLEARS" value={totalCompletions} suffix="100%" />
          <StatItem
            label="TOP SCORE"
            value={players.length > 0 ? formatCorumScore(players[0].score) : "0.00"}
            suffix="pts"
          />
        </div>
      )}

      <section className="players-board" aria-labelledby="players-board-title">
        <div className="players-board-heading">
          <div>
            <p className="section-kicker">LIVE STANDINGS</p>
            <h2 id="players-board-title">종합 순위</h2>
            <p>
              최소 등록 기록 이상인 미반려 기록을 합산합니다.
              {generatedAt && ` · ${formatRecordDate(generatedAt)} 기준`}
            </p>
          </div>

          <button
            type="button"
            className={`record-refresh${loading ? " is-loading" : ""}`}
            onClick={reload}
            disabled={loading}
          >
            <RefreshIcon />
            <span>{loading ? "불러오는 중" : "새로고침"}</span>
          </button>
        </div>

        {loading && players.length === 0 ? (
          <SkeletonPlayerRows />
        ) : error ? (
          <div className="record-state is-error">
            <strong>점수를 불러오지 못했습니다.</strong>
            <p>{error}</p>
            <button type="button" onClick={reload}>다시 시도</button>
          </div>
        ) : players.length === 0 ? (
          <div className="record-state">
            <strong>아직 점수를 받은 플레이어가 없습니다.</strong>
            <p>등록 기준 이상인 기록이 전송되면 이곳에 자동으로 표시됩니다.</p>
          </div>
        ) : (
          <div className="player-score-list">
            {players.map((player) => {
              const bestRecord = player.bestRecord;

              return (
                <article
                  className={`player-score-row player-score-rank-${Math.min(player.rank, 4)}`}
                  key={`${player.rank}-${player.player}`}
                >
                  <span className="player-score-position">#{player.rank}</span>

                  <a
                    className="player-score-identity"
                    href={getPlayerProfileHref(player)}
                    aria-label={`${player.player} 프로필 보기`}
                  >
                    <span className="player-score-avatar-stack">
                      <span className="player-score-avatar" aria-hidden="true">
                        {player.player.charAt(0).toUpperCase()}
                      </span>
                      <CsmpRankIcon rank={player.csmp.current} />
                    </span>
                    <div>
                      <strong>{player.player}</strong>
                      <span>{player.recordCount} scoring record{player.recordCount === 1 ? "" : "s"}</span>
                    </div>
                  </a>

                  <div className="player-best-record">
                    <span>BEST MAP</span>
                    {bestRecord?.levelId ? (
                      <a href={`#/maps/${encodeURIComponent(bestRecord.levelId)}`}>
                        <strong>#{bestRecord.rank} {bestRecord.title || bestRecord.levelId}</strong>
                        <small>{bestRecord.percent}% · {formatCorumScore(bestRecord.score)} PTS</small>
                      </a>
                    ) : (
                      <strong>-</strong>
                    )}
                  </div>

                  <div className="player-score-counts">
                    <p><span>MAPS</span><strong>{player.recordCount}</strong></p>
                    <p><span>100%</span><strong>{player.completions}</strong></p>
                  </div>

                  <div className="player-score-total">
                    <span>TOTAL SCORE</span>
                    <strong>{formatCorumScore(player.score)}</strong>
                    <small>PTS</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ScoreScaleCard />
    </section>
  );
}

function PlayerProfilePage({
  identityType,
  identityValue,
  csmpStages = [],
  csmpLoading = false,
}) {
  const {
    players,
    loading: scoresLoading,
    error,
    generatedAt,
    reload,
  } = useScores(csmpStages);
  const loading = scoresLoading || csmpLoading;
  const decodedIdentity = decodeRouteComponent(identityValue).trim();
  const player = useMemo(() => {
    if (identityType === "account") {
      return players.find(
        (entry) => String(entry.accountId || "").trim() === decodedIdentity,
      );
    }

    const normalizedName = decodedIdentity.toLocaleLowerCase();
    return players.find(
      (entry) => entry.player.toLocaleLowerCase() === normalizedName,
    );
  }, [decodedIdentity, identityType, players]);
  const scoringRecords = useMemo(() => {
    if (!player) return [];

    const records =
      player.records.length > 0
        ? player.records
        : player.bestRecord
          ? [player.bestRecord]
          : [];

    return [...records].sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.rank !== right.rank) return left.rank - right.rank;
      return right.percent - left.percent;
    });
  }, [player]);

  if (loading && !player) {
    return <PlayerProfileSkeleton />;
  }

  if (error) {
    return (
      <section className="player-profile-page">
        <a className="player-profile-back" href="#/players">← 종합 순위로 돌아가기</a>
        <div className="record-state is-error player-profile-state">
          <strong>플레이어 프로필을 불러오지 못했습니다.</strong>
          <p>{error}</p>
          <button type="button" onClick={reload}>다시 시도</button>
        </div>
      </section>
    );
  }

  if (!player) {
    return (
      <section className="player-profile-page">
        <a className="player-profile-back" href="#/players">← 종합 순위로 돌아가기</a>
        <div className="record-state player-profile-state">
          <strong>해당 플레이어를 찾을 수 없습니다.</strong>
          <p>플레이어의 점수 기록이 변경되었거나 순위에서 제외되었을 수 있습니다.</p>
        </div>
      </section>
    );
  }

  const bestRecord = scoringRecords[0] || player.bestRecord;
  const currentCsmpRank = player.csmp.current;
  const nextCsmpRank = player.csmp.next;

  return (
    <section className="player-profile-page">
      <a className="player-profile-back" href="#/players">
        <span aria-hidden="true">←</span>
        종합 순위로 돌아가기
      </a>

      <header
        className={`player-profile-hero player-profile-rank-${Math.min(player.rank, 4)}`}
      >
        <div className="player-profile-identity">
          <span className="player-profile-avatar" aria-hidden="true">
            {player.player.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="section-kicker">CORUM PLAYER PROFILE</p>
            <h1>{player.player}</h1>
            <div
              className={`player-profile-csmp csmp-${
                currentCsmpRank?.key || "unranked"
              }`}
              style={getCsmpStyle(currentCsmpRank)}
            >
              <span>CSMP RANK</span>
              <strong>{currentCsmpRank?.name || "Unranked"}</strong>
              <small>
                {nextCsmpRank
                  ? `NEXT ${nextCsmpRank.name.toUpperCase()} · ${nextCsmpRank.completed}/${nextCsmpRank.required}`
                  : "ALL RANKS COMPLETED"}
              </small>
            </div>
            <p>
              {player.accountId
                ? `GD ACCOUNT ${player.accountId}`
                : "GEOMETRY DASH PLAYER"}
              {generatedAt && ` · ${formatRecordDate(generatedAt)} 기준`}
            </p>
          </div>
        </div>

        <div className="player-profile-score">
          <span>GLOBAL RANK</span>
          <strong>#{player.rank}</strong>
          <div>
            <b>{formatCorumScore(player.score)}</b>
            <small>PTS</small>
          </div>
        </div>
      </header>

      <div className="players-summary player-profile-summary" aria-label="플레이어 통계">
        <StatItem label="TOTAL SCORE" value={formatCorumScore(player.score)} suffix="pts" />
        <StatItem label="GLOBAL RANK" value={`#${player.rank}`} suffix="overall" />
        <StatItem label="SCORING MAPS" value={player.recordCount} suffix="maps" />
        <StatItem label="FULL CLEARS" value={player.completions} suffix="100%" />
      </div>

      {bestRecord?.levelId && (
        <a
          className={`player-profile-best ${getRankBorderClass(bestRecord.rank)}`}
          href={`#/maps/${encodeURIComponent(bestRecord.levelId)}`}
        >
          <div>
            <span>HIGHEST VALUE RECORD</span>
            <strong>#{bestRecord.rank} {bestRecord.title || bestRecord.levelId}</strong>
            <small>
              {bestRecord.percent}% · 등록 기준 {bestRecord.minimumRecord || 100}%
            </small>
          </div>
          <div>
            <strong>{formatCorumScore(bestRecord.score)}</strong>
            <span>PTS</span>
          </div>
        </a>
      )}

      <section className="player-profile-records" aria-labelledby="player-records-title">
        <div className="players-board-heading">
          <div>
            <p className="section-kicker">SCORING HISTORY</p>
            <h2 id="player-records-title">등재 맵 기록</h2>
            <p>각 맵의 최근 최고 기록 갱신 시 확정된 점수를 반영합니다.</p>
          </div>
          <span className="player-profile-record-count">
            {scoringRecords.length} MAP{scoringRecords.length === 1 ? "" : "S"}
          </span>
        </div>

        {scoringRecords.length === 0 ? (
          <div className="record-state">
            <strong>표시할 상세 기록이 없습니다.</strong>
          </div>
        ) : (
          <div className="player-profile-record-list">
            {scoringRecords.map((record, index) => {
              const statusClass =
                record.status === "verified"
                  ? "is-verified"
                  : record.status === "rejected"
                    ? "is-rejected"
                    : "is-unverified";

              return (
                <article
                  className={`player-profile-record-row ${getRankBorderClass(record.rank)}`}
                  key={`${record.levelId}-${record.clearedAt || index}`}
                >
                  <span className="player-profile-map-rank">#{record.rank}</span>

                  <div className="player-profile-map">
                    <span>{record.tier || getTier(record.rank)}</span>
                    <a href={`#/maps/${encodeURIComponent(record.levelId)}`}>
                      {record.title || record.levelId}
                    </a>
                    <small>{formatRecordDate(record.clearedAt)}</small>
                  </div>

                  <div className="player-profile-progress">
                    <span>BEST</span>
                    <strong>{record.percent}%</strong>
                    <small>MIN {record.minimumRecord || 100}%</small>
                  </div>

                  <span className={`record-status ${statusClass}`}>
                    {getRecordStatusLabel(record.status)}
                  </span>

                  <div className="player-profile-record-score">
                    <strong>{formatCorumScore(record.score)}</strong>
                    <span>PTS</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
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

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 15.4A8 8 0 0 1 8.6 4a7.7 7.7 0 1 0 11.4 11.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  const hash = useHashRoute();
  const { maps, loading, error } = useMaps();
  const {
    stages: csmpStages,
    loading: csmpLoading,
    error: csmpError,
    reload: reloadCsmp,
  } = useCsmp();
  const { theme, toggleTheme } = useTheme();

  const rawRoute = hash.replace(/^#/, "") || "/";
  const [route, queryString = ""] = rawRoute.split("?");
  const searchParams = new URLSearchParams(queryString);
  const initialQuery = searchParams.get("q") || "";
  const mapMatch = route.match(/^\/maps\/(.+)$/);
  const playerMatch = route.match(/^\/players\/(account|name)\/(.+)$/);
  const routeNeedsMaps =
    route === "/" ||
    route === "/list" ||
    route === "/csmp" ||
    route === "/roulette" ||
    Boolean(mapMatch);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [route, queryString]);

  let page = null;
  if (error && routeNeedsMaps) page = <div className="error-state"><strong>데이터를 불러오지 못했습니다.</strong><p>{error}</p></div>;
  else if (route === "/") page = <Home maps={maps} loading={loading} />;
  else if (route === "/list") page = (
    <ListPage
      maps={maps}
      initialQuery={initialQuery}
      loading={loading}
      csmpStages={csmpStages}
    />
  );
  else if (route === "/players") page = (
    <PlayerLeaderboardPage
      csmpStages={csmpStages}
      csmpLoading={csmpLoading}
    />
  );
  else if (route === "/csmp") page = (
    <CsmpPage
      maps={maps}
      mapsLoading={loading}
      csmpStages={csmpStages}
      csmpLoading={csmpLoading}
      csmpError={csmpError}
      reloadCsmp={reloadCsmp}
    />
  );
  else if (playerMatch) {
    page = (
      <PlayerProfilePage
        identityType={playerMatch[1]}
        identityValue={playerMatch[2]}
        csmpStages={csmpStages}
        csmpLoading={csmpLoading}
      />
    );
  }
  else if (route === "/roulette") page = <RoulettePage maps={maps} loading={loading} />;
  else if (mapMatch) page = <MapDetailPage maps={maps} mapKey={mapMatch[1]} loading={loading} />;
  else page = <Home maps={maps} loading={loading} />;

  return (
    <Layout route={route} theme={theme} onToggleTheme={toggleTheme}>
      {page}
    </Layout>
  );
}

createRoot(document.getElementById("root")).render(<App />);
