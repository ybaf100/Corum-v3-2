import { useCallback, useEffect, useRef, useState } from "react";
import { CORUM_API_URL } from "./config";

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeBestRecord(record) {
  if (!record || typeof record !== "object") return null;

  return {
    levelId: String(record.levelId || "").trim(),
    title: String(record.title || "").trim(),
    rank: toNonNegativeNumber(record.rank),
    percent: toNonNegativeNumber(record.percent),
    score: toNonNegativeNumber(record.score),
  };
}

function normalizePlayer(entry) {
  return {
    rank: Math.max(1, Math.trunc(toNonNegativeNumber(entry?.rank) || 1)),
    player: String(entry?.player || "").trim(),
    score: toNonNegativeNumber(entry?.score),
    recordCount: Math.trunc(toNonNegativeNumber(entry?.recordCount)),
    completions: Math.trunc(toNonNegativeNumber(entry?.completions)),
    bestRecord: normalizeBestRecord(entry?.bestRecord),
  };
}

function getApiError(payload, response) {
  if (payload?.error?.message) return String(payload.error.message);
  if (payload?.message) return String(payload.message);
  if (!response.ok) return `HTTP ${response.status}`;
  return "점수 API가 요청을 처리하지 못했습니다.";
}

export function useScores() {
  const [players, setPlayers] = useState([]);
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
      const url = new URL(CORUM_API_URL);
      url.searchParams.set("action", "scores");
      url.searchParams.set("limit", "500");
      url.searchParams.set("_", String(Date.now()));

      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !Array.isArray(payload.players)) {
        throw new Error(getApiError(payload, response));
      }

      if (requestRef.current !== requestId) return;

      setPlayers(
        payload.players
          .map(normalizePlayer)
          .filter((player) => player.player && player.score > 0),
      );
      setGeneratedAt(String(payload.generatedAt || ""));
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setPlayers([]);
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

  return { players, loading, error, generatedAt, reload: load };
}
