export function normalizeCsmpMapTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeLevelId(value) {
  const levelId = String(value || "").trim();
  return /^\d+$/.test(levelId) ? levelId : "";
}

function slugify(value, fallback) {
  const key = String(value || "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return key || fallback;
}

function normalizeColor(value) {
  const color = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : "#888888";
}

function normalizeIconFile(value) {
  const iconFile = String(value || "").trim();
  return /^[A-Za-z0-9_. -]+\.(?:png|jpe?g|webp)$/i.test(iconFile)
    ? iconFile
    : "";
}

function normalizeCsmpMap(map) {
  if (!map || typeof map !== "object") return null;

  const levelId = normalizeLevelId(map.levelId);
  const alternateLevelId = normalizeLevelId(map.alternateLevelId);
  const title = String(map.title || "").trim();
  if (!levelId && !title) return null;

  return {
    levelId,
    alternateLevelId:
      alternateLevelId && alternateLevelId !== levelId ? alternateLevelId : "",
    title,
    rank: Number.isFinite(Number(map.rank)) ? Number(map.rank) : 0,
  };
}

export function getCsmpMapKey(map) {
  const levelId = normalizeLevelId(map?.levelId);
  if (levelId) return `id:${levelId}`;

  const titleKey = normalizeCsmpMapTitle(map?.title);
  return titleKey ? `title:${titleKey}` : "";
}

export function normalizeCsmpConfig(payload) {
  const rawTiers = Array.isArray(payload?.tiers) ? payload.tiers : [];
  const usedKeys = new Set();

  return rawTiers
    .map((rawTier, index) => {
      if (!rawTier || typeof rawTier !== "object") return null;

      const name = String(rawTier.name || "").trim();
      if (!name) return null;

      const baseKey = slugify(rawTier.key || name, `tier-${index + 1}`);
      let key = baseKey;
      let suffix = 2;
      while (usedKeys.has(key)) {
        key = `${baseKey}-${suffix}`;
        suffix += 1;
      }
      usedKeys.add(key);

      const seenMaps = new Set();
      const maps = (Array.isArray(rawTier.maps) ? rawTier.maps : [])
        .map(normalizeCsmpMap)
        .filter((map) => {
          if (!map) return false;
          const mapKey = getCsmpMapKey(map);
          if (!mapKey || seenMaps.has(mapKey)) return false;
          seenMaps.add(mapKey);
          return true;
        });
      const requiresAll = Boolean(rawTier.requiresAll);
      const parsedRequired = Math.trunc(Number(rawTier.required));
      const required = requiresAll
        ? maps.length
        : Number.isFinite(parsedRequired) && parsedRequired > 0
          ? parsedRequired
          : maps.length;

      return {
        order: Number.isFinite(Number(rawTier.order))
          ? Number(rawTier.order)
          : index + 1,
        key,
        name,
        iconFile: normalizeIconFile(rawTier.iconFile),
        color: normalizeColor(rawTier.color),
        requiresAll,
        required,
        maps,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);
}

const stageLookupCache = new WeakMap();

function buildStageLookups(stages) {
  if (Array.isArray(stages) && stageLookupCache.has(stages)) {
    return stageLookupCache.get(stages);
  }

  const byLevelId = new Map();
  const byTitle = new Map();

  for (const stage of stages || []) {
    for (const map of stage.maps || []) {
      if (map.levelId) byLevelId.set(map.levelId, stage);
      if (map.alternateLevelId) byLevelId.set(map.alternateLevelId, stage);
      const titleKey = normalizeCsmpMapTitle(map.title);
      if (titleKey) byTitle.set(titleKey, stage);
    }
  }

  const lookups = { byLevelId, byTitle };
  if (Array.isArray(stages)) stageLookupCache.set(stages, lookups);
  return lookups;
}

export function getCsmpStageForMap(map, stages) {
  const { byLevelId, byTitle } = buildStageLookups(stages);
  const levelIds = [map?.levelId, map?.alternateLevelId]
    .map(normalizeLevelId)
    .filter(Boolean);

  for (const levelId of levelIds) {
    const stage = byLevelId.get(levelId);
    if (stage) return stage;
  }

  return byTitle.get(normalizeCsmpMapTitle(map?.title)) || null;
}

export function getCsmpStageForMapTitle(value, stages) {
  return getCsmpStageForMap({ title: value }, stages);
}

export function getCompletedCsmpMapKeys(records, stages) {
  const completed = new Set();

  for (const record of records || []) {
    const status = String(record?.status || "unverified").trim().toLowerCase();
    if (status === "rejected" || Number(record?.percent) < 100) continue;

    const stage = getCsmpStageForMap(record, stages);
    if (!stage) continue;

    const configuredMap = stage.maps.find((map) => {
      const recordIds = [record?.levelId, record?.alternateLevelId]
        .map(normalizeLevelId)
        .filter(Boolean);
      if (recordIds.includes(map.levelId) || recordIds.includes(map.alternateLevelId)) {
        return true;
      }
      return (
        normalizeCsmpMapTitle(map.title) === normalizeCsmpMapTitle(record?.title)
      );
    });

    const mapKey = getCsmpMapKey(configuredMap || record);
    if (mapKey) completed.add(mapKey);
  }

  return completed;
}

export function getCsmpProgress(records, stages = []) {
  const completedMapKeys = getCompletedCsmpMapKeys(records, stages);
  const stageProgress = stages.map((stage, index) => {
    const completedMaps = stage.maps.filter((map) =>
      completedMapKeys.has(getCsmpMapKey(map)),
    );
    const remainingMaps = stage.maps.filter(
      (map) => !completedMapKeys.has(getCsmpMapKey(map)),
    );

    return {
      ...stage,
      index,
      completed: completedMaps.length,
      completedMaps,
      remainingMaps,
      complete:
        stage.maps.length > 0 && completedMaps.length >= stage.required,
    };
  });

  let current = null;
  for (const stage of stageProgress) {
    if (!stage.complete) break;
    current = stage;
  }

  const nextIndex = current ? current.index + 1 : 0;

  return {
    current,
    next: stageProgress[nextIndex] || null,
    stages: stageProgress,
    completedAll:
      stageProgress.length > 0 && current?.key === stageProgress.at(-1)?.key,
  };
}

export function getCsmpTotalMapCount(stages) {
  return new Set(
    (stages || []).flatMap((stage) => stage.maps.map(getCsmpMapKey)),
  ).size;
}

function hexToRgb(color) {
  const value = normalizeColor(color).slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColor(color, target, ratio) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  return rgbToHex(
    sourceRgb.map((channel, index) =>
      channel + (targetRgb[index] - channel) * ratio,
    ),
  );
}

function getReadableTextColor(color) {
  const channels = hexToRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return whiteContrast > blackContrast ? "#FFFFFF" : "#111111";
}

export function getCsmpStyle(stage) {
  if (!stage) return undefined;
  const color = normalizeColor(stage.color);
  return {
    "--csmp-fill": color,
    "--csmp-border": mixColor(color, "#000000", 0.35),
    "--csmp-text": getReadableTextColor(color),
    "--csmp-heading-text": mixColor(color, "#000000", 0.62),
    "--csmp-soft": mixColor(color, "#FFFFFF", 0.88),
  };
}
