// GitHub Pages에서 가장 쉽게 쓰려면 아래 값만 직접 수정하면 됨.
// Google Sheet를 CSV로 '웹에 게시'한 링크를 넣어라.
const MANUAL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzHKOAa1pnP8TCB3d22TZwM5G3BgQSZhiFloApWA6mMptX6PdU_q6bKj8fs9IhpujO9WZ8Cln7e6vW/pub?output=csv";
const MANUAL_SITE_TITLE = "코럼 v3";
const MANUAL_SITE_VERSION = "";

export const SITE_TITLE = import.meta.env.VITE_SITE_TITLE || MANUAL_SITE_TITLE;
export const SITE_VERSION = import.meta.env.VITE_SITE_VERSION || MANUAL_SITE_VERSION;

export const CSV_URL =
  import.meta.env.VITE_SHEET_CSV_URL && import.meta.env.VITE_SHEET_CSV_URL.trim().length > 0
    ? import.meta.env.VITE_SHEET_CSV_URL.trim()
    : MANUAL_CSV_URL.trim().length > 0
      ? MANUAL_CSV_URL.trim()
      : "./data/maps.csv";

export const CORUM_ENDPOINT_CONFIG_URL =
  `${import.meta.env.BASE_URL}corum-endpoint.json`;

let corumApiUrlPromise = null;

function validateCorumApiUrl(value) {
  const url = String(value || "").trim();
  if (
    !url.startsWith("https://script.google.com/macros/s/") ||
    !url.endsWith("/exec")
  ) {
    throw new Error("corum-endpoint.json의 apiUrl이 올바른 Apps Script /exec 주소가 아닙니다.");
  }
  return url;
}

export function getCorumApiUrl() {
  const environmentUrl = String(import.meta.env.VITE_CORUM_API_URL || "").trim();
  if (environmentUrl) {
    return Promise.resolve(validateCorumApiUrl(environmentUrl));
  }

  if (!corumApiUrlPromise) {
    corumApiUrlPromise = fetch(CORUM_ENDPOINT_CONFIG_URL, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API 주소 설정을 불러오지 못했습니다. (HTTP ${response.status})`);
        }
        const payload = await response.json();
        return validateCorumApiUrl(payload?.apiUrl);
      })
      .catch((error) => {
        corumApiUrlPromise = null;
        throw error;
      });
  }

  return corumApiUrlPromise;
}
