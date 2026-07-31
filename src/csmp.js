export const CSMP_STAGES = Object.freeze([
  Object.freeze({
    key: "red",
    name: "Red",
    iconName: "White",
    required: 4,
    maps: Object.freeze([
      "Fuselage V",
      "Vertex Vacancy",
      "NAVOTI",
      "Easyacti",
    ]),
  }),
  Object.freeze({
    key: "aqua",
    name: "Aqua",
    required: 5,
    maps: Object.freeze([
      "Magasiga",
      "Actinum",
      "C R Y",
      "Requims",
      "Navoti Adventure X",
      "Various Adventure",
    ]),
  }),
  Object.freeze({
    key: "bronze",
    name: "Bronze",
    required: 5,
    maps: Object.freeze([
      "Oatur Surix",
      "Actinumal",
      "Arfojs Weip",
      "Dismal Of Darkness",
      "ChoICE",
      "Fuselage T",
    ]),
  }),
  Object.freeze({
    key: "silver",
    name: "Silver",
    required: 4,
    maps: Object.freeze([
      "The Dreadful",
      "Lights X",
      "Translast",
      "Sagittarius",
    ]),
  }),
  Object.freeze({
    key: "gold",
    name: "Gold",
    required: 5,
    maps: Object.freeze([
      "Trinitic Circles",
      "Revanism",
      "Nerf this",
      "Degrade X",
      "Scorpius",
    ]),
  }),
]);

export function normalizeCsmpMapTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const CSMP_STAGE_BY_MAP = new Map(
  CSMP_STAGES.flatMap((stage) =>
    stage.maps.map((title) => [normalizeCsmpMapTitle(title), stage]),
  ),
);

export function getCsmpStageForMapTitle(value) {
  return CSMP_STAGE_BY_MAP.get(normalizeCsmpMapTitle(value)) || null;
}

export function getCompletedCsmpMapKeys(records) {
  const completed = new Set();

  for (const record of records || []) {
    const status = String(record?.status || "unverified").trim().toLowerCase();
    if (status === "rejected" || Number(record?.percent) < 100) continue;

    const titleKey = normalizeCsmpMapTitle(record?.title);
    if (titleKey && CSMP_STAGE_BY_MAP.has(titleKey)) completed.add(titleKey);
  }

  return completed;
}

export function getCsmpProgress(records) {
  const completedMapKeys = getCompletedCsmpMapKeys(records);
  const stages = CSMP_STAGES.map((stage, index) => {
    const completedMaps = stage.maps.filter((title) =>
      completedMapKeys.has(normalizeCsmpMapTitle(title)),
    );
    const remainingMaps = stage.maps.filter(
      (title) => !completedMapKeys.has(normalizeCsmpMapTitle(title)),
    );

    return {
      ...stage,
      index,
      completed: completedMaps.length,
      completedMaps,
      remainingMaps,
      complete: completedMaps.length >= stage.required,
    };
  });

  let current = null;
  for (const stage of stages) {
    if (!stage.complete) break;
    current = stage;
  }

  const nextIndex = current ? current.index + 1 : 0;

  return {
    current,
    next: stages[nextIndex] || null,
    stages,
    completedAll: current?.key === "gold",
  };
}
