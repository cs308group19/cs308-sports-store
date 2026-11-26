import type { SessionUser } from "../../auth/types";

export interface ProfileDetails {
  initials: string;
  name: string;
  email: string;
  address: string;
}

/** "Jamie Taylor" -> "JT", "Cher" -> "C". Falls back to the email's first letter. */
export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.[0] ?? email.trim()[0] ?? "?");
  return letters.toLocaleUpperCase("tr-TR");
}

/**
 * SCRUM-43/65. What the profile page shows, taken only from the signed-in user that
 * GET /api/auth/me returned. Nothing here comes from sample data.
 */
export function profileDetails(user: SessionUser): ProfileDetails {
  const address = user.homeAddress?.trim();
  return {
    initials: initialsOf(user.name, user.email),
    name: user.name,
    email: user.email,
    address: address ? address : "No home address on file",
  };
}
