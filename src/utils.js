const HEADER_MAP = {
  "순위": "rank",
  "rank": "rank",
  "Rank": "rank",

  "순번": "orderId",
  "orderId": "orderId",
  "Order": "orderId",

  "맵 제목": "title",
  "맵제목": "title",
  "제목": "title",
  "title": "title",
  "Title": "title",

  "Rating": "rating",
  "rating": "rating",
  "레이팅": "rating",

  "맵 길이": "length",
  "맵길이": "length",
  "길이": "length",
  "Length": "length",
  "length": "length",

  "맵 코드": "levelId",
  "맵코드": "levelId",
  "levelId": "levelId",
  "Level ID": "levelId",
  "ID": "levelId",

  "제작자": "creator",
  "creator": "creator",
  "Creator": "creator",

  "Verifier": "verifier",
  "verifier": "verifier",
  "검증자": "verifier",

  "최소 등록 가능 기록": "minimumRecord",
  "최소등록가능기록": "minimumRecord",
  "최소 등록 기록": "minimumRecord",
  "최소등록기록": "minimumRecord",
  "Minimum Record": "minimumRecord",
  "Min Record": "minimumRecord",
  "minimumRecord": "minimumRecord",

  "썸네일": "thumbnail",
  "thumbnail": "thumbnail",
  "Thumbnail": "thumbnail",
  "THUMBNAIL": "thumbnail",
  "이미지": "thumbnail",
  "image": "thumbnail",
  "Image": "thumbnail",
};

export const RATING_COLORS = {
  "Tiny": "#ff6fff",
  "1": "#0099ff",
  "2": "#00bbff",
  "3": "#00ddff",
  "4": "#00ffff",
  "5": "#00ffaa",
  "6": "#00ff00",
  "7": "#66ff00",
  "8": "#99ff00",
  "9": "#ccff00",
  "10": "#ffff00",
  "11": "#ffdd00",
  "12": "#ffcc00",
  "13": "#ffaa00",
  "14": "#ff8800",
  "15": "#ff6600",
  "16": "#ff4400",
  "17": "#ff0000",
  "18": "#cc0000",
  "18+": "#a61c00",
  "19": "#660000",
  "19+": "#460c00",
  "20.0": "#360900",
  "20.1": "#240600",
  "20.2": "#130400",
  "20.3": "#000000",
  "20.4": "#0a031f",
  "20.5": "#11072d",
  "20.6": "#180b3b",
  "20.7": "#180b3b",
  "20.8": "#261358",
  "20.9": "#2d1766",
  "21": "#351c75",
  "21+": "#4511c9",
  "-1": "#4c1130",
  "-2": "#434343",
  "UnVF": "#4f71a3",
  "0": "#e8eaed",
  "Rating": "#e8eaed",
};

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveHeaderKey(header) {
  const normalized = normalizeHeader(header);
  const compact = normalized.replace(/\s+/g, "");

  return HEADER_MAP[normalized] || HEADER_MAP[compact] || normalized;
}

export function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map(resolveHeaderKey);

  return rows
    .slice(1)
    .map((cells) => {
      const item = {};
      headers.forEach((key, index) => {
        item[key] = String(cells[index] || "").trim();
      });

      return normalizeMapItem(item);
    })
    .filter((item) => item.title);
}

function normalizeMapItem(item) {
  const thumbnail =
    item.thumbnail ||
    item["썸네일"] ||
    item["Thumbnail"] ||
    item["thumbnail"] ||
    item["이미지"] ||
    item["image"] ||
    "";

  return {
    rank: toNumber(item.rank),
    orderId: String(item.orderId || "").trim(),
    title: String(item.title || "").trim(),
    rating: normalizeRating(item.rating),
    length: String(item.length || "").trim(),
    levelId: String(item.levelId || "").trim(),
    creator: String(item.creator || "").trim(),
    verifier: String(item.verifier || "").trim(),
    minimumRecord: normalizeMinimumRecord(item.minimumRecord),
    thumbnail: String(thumbnail).trim(),
  };
}

function normalizeRating(value) {
  const rating = String(value || "").trim();
  if (/^20(?:\.0+)?$/.test(rating)) return "20.0";
  return rating;
}

function toNumber(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeMinimumRecord(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/%$/, "")
    .trim();
  const parsed = Number(text);

  return text && Number.isFinite(parsed) && parsed >= 1 && parsed <= 100
    ? parsed
    : 100;
}

export function sortByRank(items) {
  return [...items].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return Number(a.orderId || 0) - Number(b.orderId || 0);
  });
}

export function getTier(rank) {
  if (!rank) return "Unranked";
  if (rank <= 5) return `TOP ${rank}`;
  if (rank <= 10) return "Main";
  if (rank <= 25) return "Extended";
  return "Legacy";
}

export function getMapKey(item) {
  return encodeURIComponent(item.levelId || item.orderId || item.title);
}

export function includesSearch(item, query) {
  if (!query.trim()) return true;

  const q = query.trim().toLowerCase();
  return [
    item.rank,
    item.orderId,
    item.title,
    item.rating,
    item.length,
    item.levelId,
    item.creator,
    item.verifier,
    item.minimumRecord,
    item.thumbnail,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function getRatingColor(rating) {
  const key = normalizeRating(rating);
  return RATING_COLORS[key] || "#e8eaed";
}

export function getRatingTextColor(rating) {
  const hex = getRatingColor(rating).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#0a0a0a";

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.58 ? "#0a0a0a" : "#ffffff";
}


export const LENGTH_STYLES = {
  "Tiny": { background: "#ff6fff", text: "#000000" },
  "Short": { background: "#0099ff", text: "#000000" },
  "Medium": { background: "#99ff00", text: "#000000" },
  "Long": { background: "#ff6600", text: "#000000" },
  "XL": { background: "#660000", text: "#ffe100" },
  "XXL": { background: "#000000", text: "#ff6000" },
  "XXXL": { background: "#351c75", text: "#ff3a3a" },
};

export function getLengthCategory(length) {
  const value = String(length || "").trim();
  const compact = value.replace(/\s+/g, "").toLowerCase();

  if (!compact) return "";
  if (compact.startsWith("xxxl")) return "XXXL";
  if (compact.startsWith("xxl")) return "XXL";
  if (compact.startsWith("xl")) return "XL";
  if (compact.startsWith("long")) return "Long";
  if (compact.startsWith("medium")) return "Medium";
  if (compact.startsWith("short")) return "Short";
  if (compact.startsWith("tiny")) return "Tiny";

  return "";
}

export function getLengthBackgroundColor(length) {
  const category = getLengthCategory(length);
  return LENGTH_STYLES[category]?.background || "#ffffff";
}

export function getLengthTextColor(length) {
  const category = getLengthCategory(length);
  return LENGTH_STYLES[category]?.text || "#596579";
}
