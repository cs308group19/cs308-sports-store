# Sprint 3 completion plan

The sprint goal is to have features 1, 3, 4, 5, 7 and 9 of the progress demo working on the real PostgreSQL database **by 29 November 2026, 23:00** (Turkey time). A card is finished when its reviewed PR is merged into `main` and its tests pass. The mock demo with the TA is in the week of **30 November–6 December**, and the progress demo is on **7 December**. [Sprint 3 in Jira](https://project308.atlassian.net/issues/?jql=project%20%3D%20SCRUM%20AND%20sprint%20%3D%2035)

As of 22 November, Sprint 3 has **31 cards**: 10 are `Done`, and **21 open cards add up to 51 points**. SCRUM-15 is `Done`, but its "stock goes down after an order" criterion is not met yet, so a **1-point follow-up** is also part of the plan. The plan covers **22 cards and 52 points across 6 people**. Points are the current Jira estimates.

## Starting point (22 November, `main` @ `c251dbf`)

Some of the open cards are already partly done in `main`. Each card owner starts from the point below and builds only what is left.

| Area | Working in `main` | Still mock or missing |
|---|---|---|
| Catalogue | Category list, product detail, search (`q`), price and popularity sort (`sort`), stock and `Out of stock` display | `products.popularity` is not updated by sales; it shows hand-written values from the seed |
| Cart | Guest cart (`/api/cart`), customer cart (`/api/me/cart`), merge at login (`/api/me/cart/merge`), limit of 99 per product and of the stock | The merge runs in three separate steps. Two simultaneous requests for the same guest cart can add its products twice |
| Checkout | Return to checkout after a guest logs in (`App.tsx`), cart and checkout totals (`utils/cartTotals.ts`) | Card form validation, order and payment endpoint, stock decrease |
| After the order | Tables exist: `orders`, `order_items`, `payments`, `invoices`, `deliveries`, `reviews` | The `Invoice`, `Orders`, `ReviewForm`, `Deliveries` and `ReviewQueue` pages show sample data |
| Profile | `/api/auth/me` returns name, email, address, tax ID and role | The `Profile` page shows fixed sample data, a password field and a fake "Save changes" button |
| Tests | `npm test` in backend and frontend, `npm run test:e2e` in backend, and `npm run test:database` on a real PostgreSQL | Tests for orders, payment, delivery and reviews |

## Assignments and branches

Each card has **one owner**. The owner makes every frontend, backend, migration and test change the card needs on their own branch. Branch names follow `SCRUM-<card>-<topic>`. A branch with several cards lists the card numbers in order, for example `SCRUM-22-23-24-checkout-payment`. The PR description gives the verification result of each card on its own line.

| Owner | Cards | Points | Branches and cards | Tasks without a branch |
|---|---:|---:|---|---|
| Emre Tutal | 4 | 12 | `SCRUM-22-23-24-checkout-payment` — SCRUM-22, SCRUM-23, SCRUM-24 | SCRUM-71 |
| Rayen Tabassi | 4 | 11 | `SCRUM-25-26-invoices` — SCRUM-25, SCRUM-26<br>`SCRUM-34-deliveries` — SCRUM-34<br>`SCRUM-70-frontend-notes` — SCRUM-70 | — |
| Yiğit Turan | 3 | 9 | `SCRUM-17-cart-merge` — SCRUM-17<br>`SCRUM-61-62-regression-tests` — SCRUM-61, SCRUM-62 | — |
| Baran Aksoy | 4 | 8 | `SCRUM-31-32-33-reviews` — SCRUM-31, SCRUM-32, SCRUM-33 | SCRUM-72 |
| Sezgin Berk Özer | 3 | 6 | `SCRUM-27-order-history` — SCRUM-27<br>`SCRUM-15-29-stock-popularity` — SCRUM-15, SCRUM-29 | — |
| Naz Üstün | 4 | 6 | `SCRUM-43-65-customer-profile` — SCRUM-43, SCRUM-65<br>`SCRUM-67-env-setup-message` — SCRUM-67 | SCRUM-35 |

The whole team attends the demo and the meetings. Preparing a card, coordinating it and adding its closing evidence is the owner's job.

The Jira assignees match this table (updated on 22 November).

## Shared order contract

Checkout, invoices, order history, delivery, popularity and reviews all use the same records. The team approves the contract below on **23 November**. Pages and business rules start in parallel against this contract with test data. Any change to the contract is made in this file and announced to the team.

**An approved payment writes all of the following in one database transaction:**

1. `orders`: status `processing`, with the delivery recipient and address as they were at order time.
2. `order_items`: product name, model, list price, discount rate and unit price paid, as they were at order time.
3. `payments`: status `succeeded`, card brand, last 4 digits and transaction reference. The full card number and the CVV never go into any table, log or response.
4. `products.stock_quantity`: decreased with a conditional update if there is enough stock; otherwise the whole transaction is rolled back.
5. `products.popularity`: increased by the quantity sold.
6. `deliveries`: one row per order item, status `processing`.
7. `invoices`: invoice number, billed-to name and address, amounts, `email_status = 'pending'`.
8. The customer's cart is emptied.

The PDF and the email are produced after the transaction commits. A failed email does not undo the order.

**On a declined payment** nothing is written, stock and cart stay as they were, and the customer sees an error message.

**Amounts** are calculated on the server; prices sent by the client are not trusted. The rules match `utils/cartTotals.ts`: the subtotal uses the prices paid, orders under 75 pay a delivery fee of 8, tax is 8% of the subtotal, and everything is worked out in cents. `orders` and `invoices` have no column for the delivery fee, so the SCRUM-22/23/24 PR adds a `delivery_fee` column through a migration.

**The mock bank** decides by card number. `4242 4242 4242 4242`, which passes the Luhn check, is approved and `4000 0000 0000 0002` is declined. The demo uses only these fictional numbers.

**Statuses** only move forward: `processing` → `in_transit` → `delivered`. An order's status is that of its least advanced delivery row. The order becomes `delivered`, and `orders.delivered_at` is set, when its last item is delivered. Ratings and comments are per order item: that item's delivery row must be `delivered`.

**Proposed endpoints** (customer endpoints under `/api/me`, product manager endpoints under `/api/staff`):

| Purpose | Endpoint | Card |
|---|---|---|
| Payment and order | `POST /api/me/checkout` → `201 { orderId, orderNumber, invoiceId }`, declined `402`, not enough stock `409` | SCRUM-22/23/24 |
| Order history | `GET /api/me/orders` | SCRUM-27 |
| Invoice and PDF | `GET /api/me/invoices/:id`, `GET /api/me/invoices/:id/pdf` | SCRUM-25/26 |
| Delivery list and status | `GET /api/staff/deliveries`, `PATCH /api/staff/deliveries/:id` | SCRUM-34 |
| Rating and comment | `POST /api/me/reviews { orderItemId, rating, comment? }` | SCRUM-31/32 |
| Comment moderation | `GET /api/staff/reviews?status=pending`, `PATCH /api/staff/reviews/:id` | SCRUM-33 |

Errors use NestJS's default `{ statusCode, message, error }` shape. A record that belongs to another customer returns `404`, so its existence is not revealed. A role without permission gets `403`.

## Scope of each card

### Checkout, payment and stock — Emre

| Card | Remaining work and closing evidence |
|---|---|
| [SCRUM-22](https://project308.atlassian.net/browse/SCRUM-22) | The return after login is in `main`. Cardholder, number (Luhn), expiry date (not in the past) and CVV (3–4 digits) are validated both in the form and in the backend DTO. The delivery address is prefilled from the profile. Evidence: a guest logs in with a cart and returns to checkout with the same cart. A test shows the card number and CVV appear in no record, log or response. |
| [SCRUM-23](https://project308.atlassian.net/browse/SCRUM-23) | The mock bank approves and declines with the numbers in the contract. On approval, every record in the contract is written and the response carries `orderId` and `invoiceId`. On decline, the customer sees an error. `npm run test:database` verifies that row counts, stock and cart are unchanged after a decline. |
| [SCRUM-24](https://project308.atlassian.net/browse/SCRUM-24) | The stock check and decrease happen inside the order transaction. Not enough stock returns `409` and writes nothing. A test on a real PostgreSQL shows that when two customers buy the last item at the same time, only one succeeds. The `delivery_fee` migration and Prisma model are also in this PR. |

### Invoices and delivery — Rayen

| Card | Remaining work and closing evidence |
|---|---|
| [SCRUM-25](https://project308.atlassian.net/browse/SCRUM-25) | The `Invoice` page opens the real invoice from the `invoiceId` in the checkout response. Number, date, products, prices paid, delivery fee, tax, total and address come from the records saved at order time. The customer opens their own invoice. A test shows a second account gets `404` for the same invoice. |
| [SCRUM-26](https://project308.atlassian.net/browse/SCRUM-26) | The PDF is built from the same invoice data and emailed to the customer after approval. On success `email_status = 'sent'` and `emailed_at` are written; on failure `failed` and `email_error`. The order and the invoice stay available even if the email fails. Delivery is shown in a local test mailbox (Mailpit, Ethereal or similar). SMTP settings are added to `backend/.env.example`; no real password is committed. |
| [SCRUM-34](https://project308.atlassian.net/browse/SCRUM-34) | The `Deliveries` page shows delivery number, customer ID, product, quantity, total, address and completion from the `deliveries` table. Status moves forward in the order set by the contract, and `is_completed` and `delivered_at` are set on `delivered`. The endpoint is open only to product managers; customers and sales managers get `403`. A test shows that in a multi-item order the order status changes by the contract rule and shows up in the customer's history. |

### Cart and regression tests — Yiğit

| Card | Remaining work and closing evidence |
|---|---|
| [SCRUM-17](https://project308.atlassian.net/browse/SCRUM-17) | The merge and the stock and 99 limits work in `main`. What is left: read the guest cart, add it to the customer cart and empty it in one transaction, with the guest cart locked. A test added to `npm run test:database` shows that two simultaneous merge requests for the same guest cart do not add its products twice. This PR also deletes `backend/src/cart/dto/dasd`, which was added by mistake. |
| [SCRUM-61](https://project308.atlassian.net/browse/SCRUM-61) | At least 10 cases. Search and sort tests are in `main`. Missing coverage: order statuses only move forward, the status rule for multi-item orders, the 1–5 rating limit, only a delivered item owned by the customer can be reviewed, one rating per item. |
| [SCRUM-62](https://project308.atlassian.net/browse/SCRUM-62) | At least 10 cases. Cart request, login and totals tests are in `main`. Missing coverage: simultaneous merge, request above stock, card validation, order and stock unchanged after a declined payment, stock decrease after an order. |

### Ratings, comments and moderation — Baran

| Card | Remaining work and closing evidence |
|---|---|
| [SCRUM-31](https://project308.atlassian.net/browse/SCRUM-31) | A customer can rate only an order item delivered to them, with 1–5 stars. The rating shows without approval. The current `reviews_unique_user_product` constraint blocks the second rating of a customer who bought the same product in two separate orders. A migration replaces it with a unique constraint on `order_item_id`, and the Prisma model is updated in the same PR. `products.average_rating` and `review_count` are updated in the same transaction as the rating. |
| [SCRUM-32](https://project308.atlassian.net/browse/SCRUM-32) | `ReviewForm` moves from sample data to the real endpoint. A comment on a delivered item owned by the customer is saved as `pending`. The product page shows only approved comments, and a test shows a pending comment is not visible. |
| [SCRUM-33](https://project308.atlassian.net/browse/SCRUM-33) | `ReviewQueue` shows the real pending comments. An approved comment is published; a rejected one stays hidden. `moderated_by` and `moderated_at` are written. An API test shows customers and sales managers get `403`. |

### Order history, stock and popularity — Sezgin Berk

| Card | Remaining work and closing evidence |
|---|---|
| [SCRUM-27](https://project308.atlassian.net/browse/SCRUM-27) | The `Orders` page moves from sample data to `GET /api/me/orders`. A customer sees only their own orders, newest first. Each order shows its products, purchase total and `processing`, `in_transit` or `delivered` status. A customer with no orders sees an empty-state message. An e2e test shows a second account's orders do not appear in the list. |
| [SCRUM-15](https://project308.atlassian.net/browse/SCRUM-15) | The stock display is in `main`. After a real order, the stock on the product list and detail page goes down. When the last item is bought, `Out of stock` shows. If the page shows stale stock, its data is refreshed after the order. |
| [SCRUM-29](https://project308.atlassian.net/browse/SCRUM-29) | Price sorting in `main` uses the discounted price. Popularity comes only from sales: checkout adds the quantity sold, and the hand-written popularity values in the seed are removed. A test shows a product moves up in the popularity order after an order, and that category, search and sort work together. |

### Profile, setup and demo — Naz

| Card | Remaining work and closing evidence |
|---|---|
| [SCRUM-43](https://project308.atlassian.net/browse/SCRUM-43) | The profile page shows the name, email and address from `/api/auth/me`, read-only. The sample data, password field, tax ID and fake "Save changes" button are removed. A guest who clicks the profile link is sent to login. |
| [SCRUM-65](https://project308.atlassian.net/browse/SCRUM-65) | Closed in the same PR as SCRUM-43. Verified with two customer accounts that each one sees only its own data. |
| [SCRUM-67](https://project308.atlassian.net/browse/SCRUM-67) | Today `lib/supabase.ts` throws while the module loads and the page stays blank. The settings are checked before React starts. If one is missing, the page names the missing variable and says to copy `frontend/.env.example`. Startup is checked with missing and with valid settings. |
| [SCRUM-35](https://project308.atlassian.net/browse/SCRUM-35) | By 28 November the demo order is written and each section has a presenter. The team rehearses with a clean account. The counts are checked: 25+ new unit tests, 5+ bug reports and 5+ meaningful commits per member. Details are in the **Demo counts** section below. The closing evidence is added after the TA session. |

### Team sessions

| Card | Owner | Delivery and closing evidence |
|---|---|---|
| [SCRUM-70](https://project308.atlassian.net/browse/SCRUM-70) | Rayen | 30-minute frontend session: role pages, components, styles and API calls. Each member makes a small sample change. Short notes are added to `frontend/README.md`. |
| [SCRUM-71](https://project308.atlassian.net/browse/SCRUM-71) | Emre | 30-minute backend and login session: NestJS modules, adding an endpoint, authentication and role checks, test commands. Each member runs the backend and the tests on their own machine. |
| [SCRUM-72](https://project308.atlassian.net/browse/SCRUM-72) | Baran | 30-minute schema session: how the tables relate, access rules and the local migration order. Each member confirms they can open the tables with their own authorized Supabase access. |

These three sessions take place between 24 and 26 November, so card owners know the code while their work is under way.

## Order and dependencies

| Target date | What must be done |
|---|---|
| **23 November (Mon)** | The order contract is approved. Emre opens the checkout endpoint skeleton and the `delivery_fee` migration. The other card owners start against the contract with test data. |
| **24 November** | SCRUM-17 and SCRUM-67 are merged into `main`. The SCRUM-43/65 PR is ready for review. Team sessions begin. |
| **25 November** | The SCRUM-22/23/24 PR is merged with evidence for approval, decline and the simultaneous last-item purchase. The invoice, order history, delivery, stock and popularity cards move on to checks with real orders. |
| **26 November** | SCRUM-27, SCRUM-34 and SCRUM-25 are merged. Review tests start with a delivered order. |
| **27 November** | SCRUM-31/32/33 and SCRUM-15/29 are merged. The SCRUM-26 PDF and email flow is shown in the test mailbox and its PR is merged. |
| **28 November** | SCRUM-61/62 are merged. Every command in the closing check is run. The demo script is written and the team rehearses with a clean customer account. |
| **29 November, 23:00** | The owner of each card fixes the bugs found in the rehearsal. Every card in Jira is checked for PR and test evidence. |

The critical path runs from the guest cart to checkout and atomic stock, then through delivery to ratings, comments and moderation. A delay in SCRUM-22/23/24 delays every card on this path, so if it gets stuck, tell the team the same day. Invoices, order history, stock and popularity are verified in parallel after checkout. Drafts of SCRUM-43/65/67 and SCRUM-61/62 can start on day one.

Checkout (passing `invoiceId` to the invoice page), invoices, order history and the profile redirect all touch `App.tsx`. PRs are merged in the order of the table above. The owner of the PR merged later syncs their branch with the latest `main` and resolves any conflicts themselves.

## Working rules

- No direct commits to `main` and no file uploads through the GitHub web interface. Every change comes through a PR approved by at least one other team member. Commit messages start with the card number, for example `SCRUM-27 Show the customer's own orders`.
- Each member commits from their own GitHub account with a single `git config user.name`, so commit counts come out right.
- A new migration is added to `supabase/migrations` with a unique timestamp, and the Prisma model is matched by hand in the same PR. `prisma db push` and Prisma Migrate are not used. `npm run test:database` must pass on the PR. After the PR is merged, its owner applies the migration to the shared Supabase project and adds it to the migration table in `supabase/README.md`. [Database guide](supabase/README.md)
- The frontend never talks to the database directly. All data comes from the NestJS API, and ownership and role checks happen in the backend.

## Demo counts (SCRUM-35)

Status as of 22 November and what to do:

- **Bug reports:** Jira has 4 cards of type `Bug` (SCRUM-64, SCRUM-65, SCRUM-67, SCRUM-68). SCRUM-66 describes a bug but is of type `Task`. To reach 5+, change SCRUM-66 to `Bug` and file the bugs found in the rehearsal as `Bug`.
- **Commits:** Counted on `main` with `git log --no-merges`. Right now Baran and Yiğit have no non-merge commits on `main`. Both need to reach 5+ commits through their PRs this sprint.
- **Unit tests:** New cases in the demo period are counted from the `npm test` output in backend and frontend. SCRUM-61 and SCRUM-62 are the main source of this number.

## Closing check

- In the backend, `npm test`, `npm run test:e2e` and `npm run build` pass, and `npm run test:database` runs on a clean, throwaway local PostgreSQL. In the frontend, `npm test` and `npm run build` pass. [Backend commands](backend/README.md#commands) · [PostgreSQL test setup](supabase/README.md#testing-against-a-real-postgresql)
- With the demo account, show this flow: category → search and sort → product detail → guest cart → login → payment → invoice and email → order history → delivery status → rating and comment → comment approval. Also run the declined payment, zero stock, two separate customer accounts and unauthorized role scenarios.
- Before a card is closed, Jira must have the owner's name, the PR, the acceptance test result and a link to the commit in `main`. For SCRUM-15, besides the `Done` status, evidence of the stock change after a real order is required.
