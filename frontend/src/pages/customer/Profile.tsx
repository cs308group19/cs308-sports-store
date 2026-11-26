import type { SessionUser } from "../../auth/types";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { profileDetails } from "./profileDetails";

/**
 * SCRUM-43/65. Read-only profile of the signed-in customer. The data is the user that
 * GET /api/auth/me returned at login, so each account only ever sees its own details.
 */
export function Profile({ user, navigate }: { user: SessionUser; navigate: (v: View) => void }) {
  const details = profileDetails(user);
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Your account</span>
        <h1>Your profile</h1>
      </div>
      <section className="panel profile-form" aria-label="Profile details">
        <div className="avatar" aria-hidden="true">
          {details.initials}
        </div>
        <dl className="profile-details">
          <div>
            <dt>Full name</dt>
            <dd>{details.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{details.email}</dd>
          </div>
          <div>
            <dt>Home address</dt>
            <dd>{details.address}</dd>
          </div>
        </dl>
        <Button variant="outline" onClick={() => navigate("orders")}>
          View your orders
        </Button>
      </section>
    </div>
  );
}
