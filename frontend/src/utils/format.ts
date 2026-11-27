export const money = (value: number) => `$${value.toFixed(2)}`;

/** For shop windows: "$110", but "$95.20" when there are cents. */
export const shortMoney = (value: number) => (Number.isInteger(value) ? `$${value}` : money(value));

export const attachmentType = (file: File): "PDF" | "Image" | "Video" =>
  file.type === "application/pdf" ? "PDF" : file.type.startsWith("video/") ? "Video" : "Image";
