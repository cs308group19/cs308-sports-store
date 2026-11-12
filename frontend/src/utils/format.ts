export const money = (value: number) => `$${value.toFixed(2)}`;

export const attachmentType = (file: File): "PDF" | "Image" | "Video" =>
  file.type === "application/pdf" ? "PDF" : file.type.startsWith("video/") ? "Video" : "Image";
