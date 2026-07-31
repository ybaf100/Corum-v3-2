import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCorumApiUrl } from "./config";
import { getCsmpProgress } from "./csmp";

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeScoreRecord(record) {
  if (!record || typeof record !== "object") return null;

  const scoredPercent = toNonNegativeNumber(
    record.scoredPercent ?? record.initialPercent,
  );
  const scoredRank = toNonNegativeNumber(record.scoredRank ?? record.rank);
  const scoredMinimumRecord = toNonNegativeNumber(
    record.scoredMinimumRecord ?? record.minimumRecord,
  );

  return {
    levelId: String(record.levelId || "").trim(),
    title: String(record.title || "").trim(),
    rank: toNonNegativeNumber(record.rank),
    currentRank: toNonNegativeNumber(record.currentRank),
    tier: String(record.tier || "").trim(),
    currentTier: String(record.currentTier || "").trim(),
    rating: String(record.rating || "").trim(),
    percent: toNonNegativeNumber(record.percent),
    scoredPercent,
    scoredRank,
    scoredMinimumRecord,
    initialPercent: scoredPercent,
    minimumRecord: scoredMinimumRecord,
    score: toNonNegativeNumber(record.score),
    scoringVersion: String(record.scoringVersion || "").trim(),
    scoreLockedAt: String(record.scoreLockedAt || "").trim(),
    clearedAt: String(record.clearedAt || "").trim(),
    status: String(record.status || "unverified").trim().toLowerCase(),
  };
}

function normalizePlayer(entry, csmpStages) {
  const records = Array.isArray(entry?.records)
    ? entry.records
        .map(normalizeScoreRecord)
        .filter((record) => record?.levelId)
    : [];
  const bestRecord = normalizeScoreRecord(entry?.bestRecord) || records[0] || null;

  return {
    rank: Math.max(1, Math.trunc(toNonNegativeNumber(entry?.rank) || 1)),
    accountId: String(entry?.accountId || "").trim(),
    player: String(entry?.player || "").trim(),
    score: toNonNegativeNumber(entry?.score),
    recordCount: Math.trunc(toNonNegativeNumber(entry?.recordCount)),
    completions: Math.trunc(toNonNegativeNumber(entry?.completions)),
    bestRecord,
    records,
    csmp: getCsmpProgress(
      records.length > 0 ? records : bestRecord ? [bestRecord] : [],
      csmpStages,
    ),
  };
}

function getApiError(payload, response) {
  if (payload?.error?.message) return String(payload.error.message);
  if (payload?.message) return String(payload.message);
  if (!response.ok) return `HTTP ${response.status}`;
  return "점수 API가 요청을 처리하지 못했습니다.";
}

export function useScores(csmpStages = []) {
  const [rawPlayers, setRawPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");

    try {
      const url = new URL(await getCorumApiUrl());
      url.searchParams.set("action", "scores");
      url.searchParams.set("limit", "500");
      url.searchParams.set("_", String(Date.now()));

      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !Array.isArray(payload.players)) {
        throw new Error(getApiError(payload, response));
      }

      if (requestRef.current !== requestId) return;

      setRawPlayers(payload.players);
      setGeneratedAt(String(payload.generatedAt || ""));
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setRawPlayers([]);
      setGeneratedAt("");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "플레이어 점수를 불러오지 못했습니다.",
      );
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  const players = useMemo(
    () =>
      rawPlayers
        .map((entry) => normalizePlayer(entry, csmpStages))
        .filter((player) => player.player && player.score > 0),
    [rawPlayers, csmpStages],
  );

  return { players, loading, error, generatedAt, reload: load };
}
