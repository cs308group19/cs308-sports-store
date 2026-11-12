# RALLY — Frontend

Customer store and staff dashboards for the CS308 online store project (Team 19).

Built with **React + TypeScript**, bundled with **Vite**, styled with **plain CSS**.

## Run it

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

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
    ├── auth/                temporary demo accounts (to be replaced by the backend)
    ├── components/
    │   ├── layout/          Header, Footer, DashboardShell, SupportChat
    │   └── ui/              Button, Icon, Stars, ProductCard, Tracker, Stat, SectionHead
    ├── pages/
    │   ├── auth/            Log in, Sign up, Staff login
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
- `src/auth/demoAccounts.ts` holds test logins so every role can be tried. It will be replaced by the real login from the backend.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | jamie@rally.store | rally123 |
| Product Manager | product@rally.store | staff123 |
| Sales Manager | sales@rally.store | staff123 |
| Support Agent | support@rally.store | staff123 |

Guests can browse and use the cart without logging in. Login is only required at checkout, and for staff dashboards.
