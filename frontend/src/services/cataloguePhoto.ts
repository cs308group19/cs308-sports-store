// The demo catalogue uses stable model codes. An uploaded product photo takes precedence in productApi.
const photos = import.meta.glob<string>("../assets/catalogue/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/**
 * Orders keep the model code saved when they were placed. These are the codes the first 12
 * demo products had, each pointing at the model its product has now.
 */
export const RENAMED_MODELS: Readonly<Record<string, string>> = {
  "AS-PRO-25": "NK-AM11-GRY",
  "SL-CAP-25": "PM-CAP-WHT",
  "TB-GTX-25": "AD-FLTR-GRY",
  "CV-ELT-25": "NK-DUNK-OLV",
  "RB-IND-7": "SP-TF150-ORG",
  "MP-FB-5": "PM-LIGA-GLD",
  "ST-FG-25": "AD-F50-ORG",
  "CF-MAT-6": "GY-MAT-SET2",
  "PG-GLV-25": "GY-GLV-BLK",
  "VK-25": "CV-CTAS-NVY",
  "HL-750": "PM-BTL-RED",
  "PB-FT-2": "AD-DIGI-WHT",
};

export function cataloguePhoto(model: string): string {
  const current = RENAMED_MODELS[model] ?? model;
  return photos[`../assets/catalogue/${current}.webp`] ?? "/images/photo-unavailable.svg";
}
