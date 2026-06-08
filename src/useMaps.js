import { useEffect, useState } from "react";
import { CSV_URL } from "./config";
import { parseCsv, sortByRank } from "./utils";

export function useMaps() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const csvUrl = CSV_URL.includes("?") ? `${CSV_URL}&v=${Date.now()}` : `${CSV_URL}?v=${Date.now()}`;
        const response = await fetch(csvUrl, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`CSV 요청 실패: ${response.status}`);
        }

        const csvText = await response.text();
        const parsed = sortByRank(parseCsv(csvText));

        if (!cancelled) setMaps(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { maps, loading, error };
}
