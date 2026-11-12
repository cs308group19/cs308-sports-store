import { Button } from "../../components/ui/Button";

export function Profile({ notify }: { notify: (s: string) => void }) {
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Account settings</span>
        <h1>Your profile</h1>
      </div>
      <form
        className="panel profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          notify("Profile saved");
        }}
      >
        <div className="avatar">JT</div>
        <div className="field-row">
          <label>
            Full name
            <input defaultValue="Jamie Taylor" />
          </label>
          <label>
            Email
            <input defaultValue="jamie.taylor@example.com" />
          </label>
        </div>
        <label>
          Tax ID
          <input defaultValue="TR-308-58-991" />
        </label>
        <label>
          Home address
          <textarea defaultValue="123 Fast Lane, Kadıköy, Istanbul 34000" />
        </label>
        <label>
          Password
          <input type="password" defaultValue="rally-pass" />
        </label>
        <Button type="submit">Save changes</Button>
      </form>
    </div>
  );
}
