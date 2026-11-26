import React from "react";
import ReactDOM from "react-dom/client";
import { missingEnv } from "./config/env";
import { SetupMessage } from "./config/SetupMessage";
import "./styles/global.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// SCRUM-67. Check the settings before loading the app: lib/supabase throws while it loads when
// they are missing, which used to leave a blank page. The app is imported only after the check.
const missing = missingEnv(import.meta.env);

if (missing.length > 0) {
  console.error(
    `Missing frontend settings: ${missing.join(", ")}. Copy frontend/.env.example to frontend/.env.`,
  );
  root.render(<SetupMessage missing={missing} />);
} else {
  // Not top-level await: the default Vite build target does not support it.
  void Promise.all([import("./App"), import("./auth/AuthProvider")]).then(
    ([{ default: App }, { AuthProvider }]) => {
      root.render(
        <React.StrictMode>
          <AuthProvider>
            <App />
          </AuthProvider>
        </React.StrictMode>,
      );
    },
  );
}
