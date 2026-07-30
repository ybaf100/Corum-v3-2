export const CORUM_SCORING_VERSION = "corum-v1";

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeCorumMinimumRecord(value) {
  const minimumRecord = toFiniteNumber(value);
  return minimumRecord !== null && minimumRecord >= 1 && minimumRecord <= 100
    ? minimumRecord
    : 100;
}

export function getCorumBaseScore(rank) {
  const normalizedRank = Math.trunc(Number(rank));

  if (!Number.isFinite(normalizedRank) || normalizedRank < 1) return 0;

  if (normalizedRank === 1) {
    return 350;
  }

  if (normalizedRank <= 5) {
    return 300 * Math.pow(220 / 300, (normalizedRank - 2) / 3);
  }

  if (normalizedRank <= 10) {
    return 200 * Math.pow(140 / 200, (normalizedRank - 6) / 4);
  }

  if (normalizedRank <= 25) {
    return 130 * Math.pow(50 / 130, (normalizedRank - 11) / 14);
  }

  return 45 * Math.pow(0.94, normalizedRank - 26);
}

export function getCorumRecordScore(rank, progress, minimumRecord) {
  const baseScore = getCorumBaseScore(rank);
  const normalizedProgress = toFiniteNumber(progress);
  const normalizedMinimum = normalizeCorumMinimumRecord(minimumRecord);

  if (
    !baseScore ||
    normalizedProgress === null ||
    normalizedProgress < normalizedMinimum
  ) {
    return 0;
  }

  if (normalizedProgress >= 100) {
    return baseScore;
  }

  return (
    baseScore *
    Math.pow(
      5,
      (normalizedProgress - normalizedMinimum) / (100 - normalizedMinimum),
    ) /
    10
  );
}

export function formatCorumScore(value) {
  const score = toFiniteNumber(value);
  return (score === null ? 0 : Math.max(score, 0)).toFixed(2);
}

function getRecordIdentity(record) {
  const accountId = String(record?.accountId || "").trim();
  if (accountId) return `account:${accountId}`;

  return `player:${String(record?.player || "").trim().toLocaleLowerCase()}`;
}

function getRecordTimestamp(record) {
  return Date.parse(record?.clearedAt) || 0;
}

export function getBestPlayerRecords(records) {
  const bestByPlayer = new Map();

  for (const record of records || []) {
    const player = String(record?.player || "").trim();
    const percent = toFiniteNumber(record?.percent);
    if (!player || percent === null) continue;
    if (String(record?.status || "").trim().toLowerCase() === "rejected") continue;

    const identity = getRecordIdentity(record);
    const current = bestByPlayer.get(identity);

    if (
      !current ||
      percent > current.percent ||
      (percent === current.percent &&
        getRecordTimestamp(record) > getRecordTimestamp(current))
    ) {
      bestByPlayer.set(identity, record);
    }
  }

  return [...bestByPlayer.values()];
}
