# CS308 Sports Store

**Sabancı University · CS308 Software Engineering · Group 19 / Team308**

## Implementation status — 12 November 2026

This branch contains the React/Vite frontend prototype, Emre's NestJS/Supabase
authentication backend, and the SCRUM-12 store migrations with matching Prisma
models and database integration tests. The store pages still use mock data;
catalogue, cart, checkout and review APIs remain to be implemented. Database
deployment to the team's hosted Supabase project has not been verified.

Start with the [backend setup](backend/README.md),
[frontend setup](frontend/README.md), and
[database setup and integration contract](supabase/README.md).
Local verification used Node.js 24.22.1 and PostgreSQL 17.11.

> The design proposal and planning checklist below are retained from 6 November
> 2026. They describe intended features, not a current completion checklist.

## Project overview

We are building an online sports store where customers can browse products by sport, manage a shopping cart, place orders, and track deliveries. Separate interfaces will support product management, sales management, and live customer support.

Initial category ideas: **football, basketball, running, and fitness**. The final categories, product catalogue, and store name will be decided by the team.

## Team

Group 19 roster verified against the course's Groups & Schedules sheet and the TA's email. GitHub usernames match the repository's collaborator list; individual feature assignments still need confirmation.

| Member | Coordination role | Development responsibility | GitHub username |
|---|---|---|---|
| Sezgin Berk Özer | Team member | Full-stack; feature assignment to agree | [@SezginBerkOzer](https://github.com/SezginBerkOzer) |
| Rayen Tabassi | Jira coordination; confirm formal Scrum Master role | Full-stack; feature assignment to agree | [@Rayen12354333](https://github.com/Rayen12354333)|
| Emre Tutal | Team member | Full-stack; feature assignment to agree | [@EmreTutal](https://github.com/EmreTutal) |
| Naz Üstün | Team member | Full-stack; feature assignment to agree | [@nazustun](https://github.com/nazustun) (invite pending) |
| Baran Aksoy | Team member | Full-stack; feature assignment to agree | [@BaranSUnet](https://github.com/BaranSUnet) |
| Yiğit Turan | Team member | Full-stack; feature assignment to agree | Not added yet |

**Assigned TA:** Saltuk Buğra Çiftçi.

The TA's 25 October email says everyone should work full-stack rather than splitting the group into permanent frontend and backend roles. Everyone should learn the chosen tools and understand their own contributions. Task distribution is a team decision; the Scrum Master role does not carry additional project-management responsibility in this course group.

## Project links

- [Jira backlog](https://project308.atlassian.net/jira/software/projects/SCRUM/boards/1/backlog)
- [GitHub repository from the initial setup](https://github.com/Rayen12354333/cs308-sports-store) — confirm that this remains the team's shared repository.
- [Groups & Schedules](https://docs.google.com/spreadsheets/d/19-6ZXONKsVE6TezvMrofDF1Fpdg0JXMh9it9GlNytbw/edit#gid=944535383&range=A145:H151)

### Scrum meeting slot

The current Group 19 schedule lists **17:40–18:40**, with the TA joining **17:55–18:25**, during the Friday recitation. Use [the assigned Meet room](https://meet.google.com/aiu-mdvm-gqg). These are the times displayed in the course sheet; it does not print a timezone beside them.

Follow this assigned slot unless course staff announce a change. The **31 October, 15:00** meeting was separately agreed as a makeup; it is not evidence of a permanent schedule change. Recheck the shared sheet and course announcements for updates.

## Technology stack

| Layer | Technology | Purpose | Decision status |
|---|---|---|---|
| Frontend | React | Customer pages and staff dashboards | Reported team choice |
| Language | TypeScript | Typed frontend and backend code | Reported team choice |
| Frontend tooling | Vite | Local development server and production frontend build | Reported team choice |
| Styling | CSS | Responsive layout and visual design | Reported team choice |
| Backend | NestJS on Node.js | API, permissions, business rules, and integrations | Working choice; reconfirm NestJS |
| Database | PostgreSQL | Persistent application data | Reported team choice |
| Version control | Git and GitHub | Shared code, reviews, and change history | Repository created |
| Task tracking | Jira | Backlog, sprint planning, and progress tracking | Project created |

Additional choices remain open: database access library/ORM, authentication method, chat transport, PDF and email libraries, testing tools, file storage, and deployment provider. These are implementation decisions, not additional agreed technologies.

## Proposed architecture

Use one React frontend, one NestJS backend organized into feature modules, and one PostgreSQL database. Customer pages and staff dashboards share the frontend; the backend enforces each user's permissions.

```text
Customer / Product Manager / Sales Manager / Support Agent
                           |
                           v
              React + TypeScript + CSS
                developed/built with Vite
                           |
                    HTTPS / REST API
                           |
                           v
                NestJS backend (Node.js)
         Controllers -> Services -> Data access layer
                  |                    |
                  v                    v
            PostgreSQL           Integrations
                           - Mock payment service
                           - PDF invoice generation
                           - Email delivery
                           - Protected file storage

Live support: frontend <-> NestJS chat gateway
              WebSocket transport proposed; library to agree
              Chat records stored in PostgreSQL
```

The browser requests data and displays results. The backend checks requests, calculates prices, applies order rules, and reads/writes the database. The frontend never connects directly to PostgreSQL. Start with a single backend application; individual modules are parts of that application.

### Backend modules

| Module | Main responsibility |
|---|---|
| Authentication and users | Login, registration, profiles, and role checks |
| Catalogue | Sports categories, product details, search, sorting, and inventory |
| Cart and wishlist | Guest cart, cart retention after login, and wishlist items |
| Orders and payments | Checkout, simulated payment, order history, cancellation, and delivery status |
| Reviews | Delivered-purchase eligibility, ratings, and comment approval |
| Sales and returns | Prices, discounts, refund decisions, and revenue/profit reports |
| Support | Conversation queue, claiming chats, messages, attachments, and permitted customer context |
| Notifications and invoices | Discount/refund notifications and emailed PDF invoices |

### Example purchase flow

1. A guest browses football products and adds a ball to their cart.
2. At checkout, they log in; their cart is retained.
3. The backend checks stock and calculates the total using server-side prices.
4. A mock banking service confirms the simulated payment.
5. The backend records the order and reduces stock consistently, using database transactions and concurrency-safe stock updates to prevent overselling.
6. The invoice is displayed and a PDF copy is emailed to the customer.
7. The product manager updates delivery status; after delivery, the customer may submit a rating and comment.

Email/PDF failures should be recorded and retried without creating a second order or payment. The exact implementation will be agreed during development.

## Application roles

| Role | Planned capabilities |
|---|---|
| Customer | Browse, search, maintain a cart/wishlist, purchase, track orders, review delivered purchases, cancel eligible orders, and request returns |
| Product manager | Manage products, categories and stock; process deliveries; update order status; approve/reject written comments |
| Sales manager | Set prices and discounts; inspect invoices; view revenue and profit/loss reports; evaluate and authorize refunds |
| Support agent | Claim customer conversations, reply in real time, exchange attachments, and view permitted customer information |

Guests may browse, use a cart, and start support chats. Login is required to place an order. Role restrictions must be enforced by the backend, including on chat and attachment access.

## Planned features

- Product browsing by sports category, product details, and stock visibility.
- Search by name/description and sorting by price/popularity.
- Guest cart retained after login; registration, login, and customer profile.
- Checkout with simulated payment, on-screen invoices, and emailed PDF invoices.
- Order history and delivery tracking: processing, in transit, and delivered.
- Wishlist and notifications when wishlisted products are discounted.
- Ratings and written comments for delivered purchases; written comments require approval.
- Custom product and sales management dashboards.
- Discounts, invoice filtering/export, and revenue/profit charts.
- Eligible cancellations, product returns, and refunds.
- Live support for guests and logged-in customers, with attachments and a queue for agents.
- Automated tests and correct behavior when multiple users act at the same time.

### Business rules to preserve

- Out-of-stock products remain searchable but cannot be added to the cart. Checkout rechecks stock.
- Orders may be cancelled only while processing.
- Return requests apply to delivered products within **30 days of purchase**; customers may return selected products from an order.
- The sales manager authorizes a refund after the returned product is received. Approved returned stock is restored exactly once.
- Refunds use the **original amount paid**, including any discount, rather than the current price. Notify the customer of the approved amount.
- Ratings can appear without manager approval; written comments need product-manager approval.
- Sales managers set prices; product managers manage inventory. Their permissions must remain separate.

## Initial data model

Proposed entities, to refine during database design:

| Area | Entities |
|---|---|
| Accounts | User, address, role/permissions |
| Catalogue | Category, product, inventory; product variants if sizes/colors are offered |
| Shopping | Cart, cart item, wishlist item |
| Purchasing | Order, order item, mock payment record, invoice, delivery |
| Feedback | Review with rating and comment approval status |
| Sales | Discount, return request, return item, refund |
| Support | Conversation, message, attachment |

Required product information includes ID, name, model, serial number, description, stock quantity, price, warranty status, and distributor information. Customer information includes ID, name, tax ID, email, home address, and a securely hashed password.

Order items preserve the purchase-time unit price and applied discount. If products have size/color variants, track stock for each purchasable variant. Delivery records must capture the required customer/product references, quantity, total price, address, and completion status. Store money using an exact representation such as PostgreSQL `NUMERIC`.

## Suggested repository structure

This is a proposed layout; these folders and applications are not yet verified as implemented.

```text
cs308-sports-store/
├── frontend/          # React, Vite, TypeScript, and CSS
├── backend/           # NestJS application and backend tests
├── docs/              # Architecture, database design, and meeting notes
└── README.md
```

Use separate feature modules in the backend and reusable components/pages in the frontend. Select one database access library and keep migrations in version control.

## Planning checklist — 6 November snapshot

- [x] Brainstorm project ideas and choose a sports store.
- [x] Create the Jira project.
- [x] Create the GitHub repository.
- [x] Discuss and select an initial technology stack.
- [ ] Reconfirm the exact backend choice and document final stack versions.
- [ ] Review this README and confirm the team roster and development responsibilities.
- [ ] Confirm Scrum Master selection with the group.
- [ ] Verify the TA has the Jira/GitHub links and required access, and that Jira Reports is enabled.
- [ ] Each member learns unfamiliar stack basics (the TA suggested around two hours).
- [ ] Agree on the initial database model and first implementation goal.
- [ ] Create the frontend/backend application scaffolds and connect PostgreSQL.

Completed planning and setup do not imply that store features have been implemented.

## Development workflow

1. Keep Jira tasks short and understandable: a clear title, brief description, owner, and status.
2. Agree on a realistic sprint scope together. Assign dates and sprint membership according to the team's actual plan.
3. Use `To Do -> In Progress -> Done`; mark development work Done after checking it works and completing the team's review process.
4. Create a feature branch, make meaningful commits, and open a pull request for review before merging into `main`.
5. Include the Jira key in branch names, commits, or pull requests so work can be traced.
6. Update progress consistently and record real bugs when discovered.

Jira identifiers such as `SCRUM-5` are references, not the order in which tasks must be completed. Numbered titles can provide a simple reading order.

## Quality and security

- Validate all incoming requests on the server; TypeScript types alone do not validate network input.
- Hash passwords with a suitable password-hashing library and protect invoices, account data, and files with access controls.
- Use only fictional payment details for the mock payment flow. Do not persist real card numbers or CVVs.
- Calculate totals and authorize operations in the backend; do not trust client-supplied prices or roles.
- Keep secrets out of Git and provide an `.env.example` containing placeholders only.
- Test order rules, permissions, review eligibility, refund amounts, and concurrent stock changes.
- Restrict support attachments by access, size, and allowed file types.

## Course milestones

The progress demo requires features **1, 3, 4, 5, 7, and 9** from the project brief: product/category browsing and cart, stock and delivery status, guest cart/login/checkout/invoices, delivered-purchase reviews, search/sorting, and required product information. The final demo requires all listed features.

The brief specifies two-week sprints. Record actual meeting and demo dates once confirmed by the course staff.

Development thresholds **per demo**:

- At least **5 meaningful commits per member**.
- At least **25 new unit test cases**, **5 new bug reports**, and **30 sprint backlog items** for the team; the brief explicitly says “per member” only for commits.
- Contributions must be meaningful and spread across the sprints.

Separately, the TA's 25 October follow-up refers to **three backlogs of 30 items before the first demo**. Confirm how the TA wants these organized and follow that group-specific expectation; the four broad setup tasks are only a starting point, not the complete demo backlog.

AI assistance is permitted by the brief, but each member must understand and be able to explain their contribution.

## Local setup

Use Node.js 24 and the checked-in lockfiles. Follow the [backend instructions](backend/README.md),
[frontend instructions](frontend/README.md) and [database migration/test guide](supabase/README.md).
The database guide distinguishes the locally verified setup from the remaining hosted deployment and store API work.

## Technical references

- [React documentation](https://react.dev/)
- [Vite guide](https://vite.dev/guide/)
- [TypeScript documentation](https://www.typescriptlang.org/docs/)
- [NestJS documentation](https://docs.nestjs.com/)
- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)

Course requirements in this draft come from the supplied CS308 Online Store Project brief, the [TA's first-meeting follow-up](https://mail.google.com/mail/u/?authuser=rayen.tabassi%40sabanciuniv.edu#all/1a171a606d687710), and the linked Groups & Schedules sheet. Architecture details are proposals for team review.
