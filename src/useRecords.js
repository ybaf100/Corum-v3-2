import { useCallback, useEffect, useRef, useState } from "react";
import { getCorumApiUrl } from "./config";

function toNonNegativeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toOptionalNonNegativeNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  return toNonNegativeNumber(value);
}

function normalizeRecord(record) {
  const scoredPercent = toOptionalNonNegativeNumber(
    record?.scoredPercent ?? record?.initialPercent,
  );
  const scoredRank = toOptionalNonNegativeNumber(
    record?.scoredRank ?? record?.registeredRank,
  );
  const scoredMinimumRecord = toOptionalNonNegativeNumber(
    record?.scoredMinimumRecord ?? record?.registeredMinimumRecord,
  );

  return {
    recordId: String(record?.recordId || "").trim(),
    levelId: String(record?.levelId || "").trim(),
    accountId: String(record?.accountId || "").trim(),
    player: String(record?.player || "").trim(),
    percent: toNonNegativeNumber(record?.percent),
    clearedAt: String(record?.clearedAt || "").trim(),
    attempts: toNonNegativeNumber(record?.attempts),
    jumps: toNonNegativeNumber(record?.jumps),
    playTimeMs: toNonNegativeNumber(record?.playTimeMs),
    platform: String(record?.platform || "").trim(),
    status: String(record?.status || "unverified").trim().toLowerCase(),
    proofUrl: String(record?.proofUrl || "").trim(),
    modVersion: String(record?.modVersion || "").trim(),
    scoredPercent,
    scoredRank,
    scoredMinimumRecord,
    initialPercent: scoredPercent,
    registeredRank: scoredRank,
    registeredMinimumRecord: scoredMinimumRecord,
    score: toOptionalNonNegativeNumber(record?.score),
    scoringVersion: String(record?.scoringVersion || "").trim(),
    scoreLockedAt: String(record?.scoreLockedAt || "").trim(),
  };
}

function getApiError(payload, response) {
  if (payload?.error?.message) return String(payload.error.message);
  if (payload?.message) return String(payload.message);
  if (!response.ok) return `HTTP ${response.status}`;
  return "기록 API가 요청을 처리하지 못했습니다.";
}

export function useRecords(levelId) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(Boolean(levelId));
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const normalizedLevelId = String(levelId || "").trim();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!normalizedLevelId) {
      setRecords([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const url = new URL(await getCorumApiUrl());
      url.searchParams.set("action", "clears");
      url.searchParams.set("levelId", normalizedLevelId);
      url.searchParams.set("limit", "200");
      url.searchParams.set("_", String(Date.now()));

      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !Array.isArray(payload.records)) {
        throw new Error(getApiError(payload, response));
      }

      if (requestRef.current !== requestId) return;

      setRecords(
        payload.records
          .map(normalizeRecord)
          .filter((record) => record.levelId === normalizedLevelId && record.player),
      );
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setRecords([]);
      setError(loadError instanceof Error ? loadError.message : "기록을 불러오지 못했습니다.");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [levelId]);

  useEffect(() => {
    load();

    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  return { records, loading, error, reload: load };
}
