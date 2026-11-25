import { describe, expect, it } from "vitest";
import { missingEnv } from "./env";

const valid = {
  VITE_SUPABASE_URL: "https://abcd1234.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_9f8e7d",
};

/** SCRUM-67. Without these settings the page used to stay blank. */
describe("missingEnv", () => {
  it("finds nothing missing when both settings are filled in", () => {
    expect(missingEnv(valid)).toEqual([]);
  });

  it("names both settings when there is no .env at all", () => {
    expect(missingEnv({})).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  });

  it("names only the one that is missing", () => {
    expect(missingEnv({ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL })).toEqual([
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ]);
  });

  it.each(["", "   "])("treats %j as missing", (value) => {
    expect(missingEnv({ ...valid, VITE_SUPABASE_URL: value })).toEqual(["VITE_SUPABASE_URL"]);
  });

  it("treats the unedited values from .env.example as missing", () => {
    expect(
      missingEnv({
        VITE_SUPABASE_URL: "https://<project-ref>.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_replace_me",
      }),
    ).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  });

  it("ignores the optional API URL", () => {
    expect(missingEnv({ ...valid, VITE_API_URL: undefined })).toEqual([]);
  });
});
