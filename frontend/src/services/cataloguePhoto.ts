// The demo catalogue uses stable model codes. An uploaded product photo takes precedence in productApi.
const photos = import.meta.glob<string>("../assets/catalogue/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export function cataloguePhoto(model: string): string {
  return photos[`../assets/catalogue/${model}.webp`] ?? "/images/photo-unavailable.svg";
}
