import { useCallback, useEffect, useRef, useState } from "react";
import { getCorumApiUrl } from "./config";
import { normalizeCsmpConfig } from "./csmp";

function getApiError(payload, response) {
  if (payload?.error?.message) return String(payload.error.message);
  if (payload?.message) return String(payload.message);
  if (!response.ok) return `HTTP ${response.status}`;
  return "CSMP 설정 API가 요청을 처리하지 못했습니다.";
}

export function useCsmp() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");

    try {
      const url = new URL(await getCorumApiUrl());
      url.searchParams.set("action", "csmp");
      url.searchParams.set("_", String(Date.now()));

      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload.tiers)) {
        throw new Error(getApiError(payload, response));
      }
      if (requestRef.current !== requestId) return;

      setStages(normalizeCsmpConfig(payload));
      setWarnings(
        Array.isArray(payload.warnings)
          ? payload.warnings.map(String).filter(Boolean)
          : [],
      );
      setGeneratedAt(String(payload.generatedAt || ""));
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setStages([]);
      setWarnings([]);
      setGeneratedAt("");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "CSMP 설정을 불러오지 못했습니다.",
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

  return { stages, loading, error, warnings, generatedAt, reload: load };
}
