# RALLY — Frontend

Customer store and staff dashboards for the CS308 online store project (Team 19).

Built with **React + TypeScript**, bundled with **Vite**, styled with **plain CSS**.

## Run it

```bash
cd frontend
npm install
cp .env.example .env   # then fill in the Supabase URL and publishable key
npm run dev
```

Then open http://localhost:5173. Log in and sign up need the backend running too (see [`../backend/README.md`](../backend/README.md)); in development Vite forwards `/api` to `http://localhost:3000`.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app with live reload |
| `npm run build` | Checks types, then builds into `dist/` |
| `npm run preview` | Serves the built app |
| `npm run typecheck` | Checks types only |

## Folder structure

```
frontend/
├── index.html
├── public/                  static files (favicon)
└── src/
    ├── main.tsx             entry point
    ├── App.tsx              app state and page switching
    ├── app/navigation.ts    page names and the menu for each role
    ├── auth/                AuthProvider (session + current user), role labels, password rules,
    │                        demo account list shown on the login page
    ├── lib/                 supabase.ts (login/session client), api.ts (calls the backend)
    ├── components/
    │   ├── layout/          Header, Footer, DashboardShell, SupportChat
    │   └── ui/              Button, Icon, Stars, ProductCard, Tracker, Stat, SectionHead
    ├── pages/
    │   ├── auth/            Log in (all roles) and Sign up (customers)
    │   ├── customer/        Home, Shop, ProductDetail, Cart, Checkout, Invoice,
    │   │                    Orders, Wishlist, Profile, ReviewForm
    │   ├── product-manager/ ProductManagement, Deliveries, ReviewQueue
    │   ├── sales-manager/   Pricing, Invoices, Analytics, Refunds
    │   └── support-agent/   SupportDesk
    ├── services/mockStore.ts  sample products and orders (to be replaced by API calls)
    ├── styles/global.css    all styles
    ├── types/models.ts      shared data types (Product, Order, CartLine…)
    └── utils/format.ts      small helpers (money format, file types)
```

## Current state

- All screens work with **sample data**. Nothing is saved yet.
- `src/services/mockStore.ts` is the only place the sample data lives. When the backend is ready, replace its contents with API calls and the pages keep working.
- Log in and sign up are real: Supabase Auth keeps the session, and the backend decides the role. Everything else is still sample data.
- Everyone who signs up is a **customer**. Staff roles are assigned by the backend (`npm run user:set-role`), never from the browser.

### Demo accounts

Created in Supabase by `npm run seed:demo` in the backend. One login form serves every role and opens the right dashboard.

| Role | Email | Password |
|---|---|---|
| Customer | jamie@rally.store | Rally1234 |
| Product Manager | product@rally.store | Staff1234 |
| Sales Manager | sales@rally.store | Staff1234 |
| Support Agent | support@rally.store | Staff1234 |

Guests can browse and use the cart without logging in. Login is only required at checkout, and for staff dashboards.
