# RL_Admin_Portal Design — Spec Coverage Matrix

**Source:** `Z Roca living Docs/RL_Admin_Portal Design.pdf` (38 pages, client-supplied, AI-generated)
**Audited against:** this codebase, 21 Jul 2026 · **Build plan added:** 22 Jul 2026
**Purpose:** account for *every* element of the client's design — built, adapted, or requiring a new
module — so nothing is silently dropped and every gap has a stated reason and a path forward.
§§10–13 close the loop: every open item in §§1–9 maps to exactly one named home in the build plan.

## Legend

| Status | Meaning |
|---|---|
| ✅ **Built** | Live in the portal, populated with real data |
| 🔁 **Adapted** | Built with a deliberate difference (reason given) |
| 🟡 **Partial** | Page exists and covers the core job; spec shows extra sections that need new data/features |
| 🏗️ **New module** | Nothing behind it today — requires new tables + workflow + screens (Phase 2 candidate) |

**Important context for reading the mock:** the design was AI-generated, so every screen is filled
with sample data (124 landlords, £284,562.17 balances, named tenants, photos). Those numbers are
illustrations, not requirements. Where a layout is built, it populates from the live database and
will look "emptier" until real records exist. Separately, several screens depict *whole software
modules* (bank reconciliation, VAT returns, communications) — those are functional builds, not
styling tasks.

---

## 1. Global chrome (all pages)

| Spec element | Status | Notes |
|---|---|---|
| Dark sidebar, indigo accent, grouped nav with sub-tabs | ✅ Built | Landlords ▾ / Tenants & Tenancies ▾ / Accounting ▾ / Maintenance ▾ / System Administration ▾; active-route auto-expand; collapse mode |
| Sidebar account tile (collapsible) | 🔁 Adapted | Spec shows "Client Account Balance" — no client-money ledger exists, so the tile shows the **Management Fee Account** (real YTD fees from the ledger), as also shown on spec p.24+ |
| Sidebar section headers (ACCOUNTING / OPERATIONS / ADMINISTRATION) | ✅ Built | Section labels between nav groups, per spec p.24+ |
| Header: page title + subtitle, global search, user chip | ✅ Built | Search is a live type-ahead over landlords/properties/tenants |
| Notification bell with red count badge | 🔁 Adapted | Bell opens a real recent-activity feed; the *count badge* needs a notifications/tasks system (see §10) |
| Breadcrumbs (`Landlords / LL-0001`) | ✅ Built | Route-derived trail above the page title on nested pages |
| Help "?" button | 🏗️ New (small) | No help/docs destination exists to link to |
| Nav items: Communications, Tasks & Alerts (18), Legislation & News, Tenancy Lifecycle | 🔁 Adapted | News is managed in Settings and shown on the Dashboard; Tasks & Alerts is the Dashboard alerts table; Communications is a new module (§10); dead links are deliberately not rendered |

## 2. Dashboard (spec p.1)

| Spec element | Status | Notes |
|---|---|---|
| 6 KPI cards with sub-lines | ✅ Built | Landlords / Properties / Tenancies+occupancy / Rent Due / Rent Collected % / Landlord Payments + pending |
| Date-range picker + Export | ✅ Built | Real month picker (re-queries the ledger via `?month=`); Export downloads the summary CSV |
| Financial Overview card | 🔁 Adapted | Rent due/collected, arrears, payments pending, unreconciled receipts, mgmt fees, contractor costs — all live. **"Client Account Balance" / "Unallocated Receipts" rows omitted** (no client-account ledger; unreconciled receipts is the honest equivalent) |
| Compliance Overview donut + legend + warning strip | ✅ Built | Computed from certificate expiry dates |
| Maintenance Overview + urgent strip | ✅ Built | Uses the board's real status vocabulary; spec's "Overdue" row omitted (tickets have no due-date field yet) |
| Legislation & News card | ✅ Built | Admin-curated via Settings → news manager (new module built 21 Jul 2026) |
| Rent Reviews Due card | ✅ Built | Rent-review tracking added to tenancies (new module built 21 Jul 2026) |
| Top Arrears card | ✅ Built | Real overdue rent grouped per tenancy |
| Recent Alerts & Tasks table + count badge | ✅ Built | Derived live from certificates / deposits / urgent maintenance / pending payments |
| Quick Actions | 🔁 Adapted | All real destinations; "Send Communication" omitted (no messaging module) |

## 3. Landlords (spec p.2, 3, 4)

| Spec element | Status | Notes |
|---|---|---|
| Landlord list + Add New Landlord | ✅ Built | Registration creates the account + one-time activation link (no email dependency) |
| Landlord detail — KYC/AML, sanctions, ToB, ownership, NRL, bank details (verified), documents, notes | ✅ Built | Full compliance panel incl. bank-detail verification workflow |
| Landlord detail — KPI strip | 🔁 Adapted | Built: rent roll, compliance %, outstanding tasks, plus **Total Arrears** and **Net Paid YTD** in place of "portfolio value" (no valuations) and "available balance" (no client ledger) |
| Landlord detail — tab set | ✅ Built | Overview / Properties / Financials / Statements / Compliance / Documents / Timeline / Settings — incl. portfolio donut, quick actions, derived outstanding actions, notes, account manager, audit-log timeline, last-login. Communications tab omitted (§10 module) |
| Onboarding wizard with step tracker | 🔁 Adapted | 6-stage wizard exists (landlord → property → tenancy → move-in) and captures AML/KYC, NRL, ToB, ownership. Spec's 7-step layout with % progress is a visual upgrade of the same flow |
| Landlord Groups / Referral Partners / Management Packages sub-tabs | 🏗️ New module | No grouping/packages data model exists |
| Property photos on cards | ✅ Built | Property media added 22 Jul 2026: photos + floor plans per property (`property_images`, authenticated serving); primary-photo thumbnails on landlord property cards |
| "Send Message" button | 🏗️ New module | Communications (§10) |

## 4. Properties (spec p.5–13)

| Spec element | Status | Notes |
|---|---|---|
| Properties list + stats + filters | 🟡 Partial | List/table with statuses + primary-photo thumbnails (22 Jul 2026); "Property Import" (bulk) not built |
| Property detail — overview, certificates, tenancy, documents, notes | ✅ Built | Core management page exists |
| Compliance tab (per-certificate validity list) | ✅ Built | Certificates with expiry tracking are first-class |
| Financials tab (YTD summary, collection donut, transactions, charts, statements) | ✅ Built | Per-property Financials tab: YTD summary, 12-month income-vs-costs chart, full transaction list — live from the ledger |
| Tenancy tab (break clause, notice period, guarantor, occupants, pets/smoker) | 🟡 Partial | Tenancy core (dates, rent, deposit, AST) exists incl. rent-review date; break clause/notice period/occupants/guarantor fields not captured |
| Documents tab (categories, expiry dates per document, storage quota) | 🟡 Partial | Folder-driven categories exist; per-document expiry/status and storage quota not tracked |
| Maintenance tab (response/resolution analytics, upcoming works, preferred contractors) | 🟡 Partial | Tickets per property exist; analytics + scheduled works need timestamps/scheduling the model doesn't hold |
| Inspections tab (types donut, recurring reminders) | 🟡 Partial | Inspection log + next-due exists; recurrence rules/reminders not built |
| Timeline tab (event feed) | 🏗️ New (medium) | Audit log exists and could power a first version scoped per property |
| Notes tab (categorised, flagged notes) | 🟡 Partial | Single notes field exists; multi-note with categories is a small new table |
| Floor plans | ✅ Built | Uploaded/managed alongside photos on the property Photos tab (22 Jul 2026) |

## 5. Tenants & Tenancies (spec p.14–16)

| Spec element | Status | Notes |
|---|---|---|
| Tenants directory + detail | ✅ Built | Incl. right-to-rent status/expiry |
| Add Tenant form (guarantor, references, ID checks, checklist) | 🟡 Partial | Tenants are created via the tenancy/onboarding flow with right-to-rent; guarantor + referencing records not modelled |
| Tenancies list + lifecycle (activate, notice, end) | ✅ Built | Full state machine incl. schedule cleanup and property vacancy handling |
| Renewals tracking ("Renewal due", avg tenancy length) | 🟡 Partial | "Renewals Due (90 days)" + average tenancy length stats on Tenancies; a full renewal *workflow* (statuses, notices) is still a build |
| Rent Reviews — tracking per tenancy | ✅ Built | Date, proposed rent, status; managed from Tenancies; feeds Dashboard |
| Rent Reviews — dedicated page (stats, tabs, projections) | ✅ Built | Due/overdue/completed stats, average increase, projected additional rent (12m), tabbed review table. Spec's "Justify Increase" AI tool descoped |
| Arrears — dedicated page (ageing buckets, chart, per-tenant table) | ✅ Built | Ageing buckets (1–30/31–60/61–90/90+), ageing chart, over-30/60/90 tabs. Payment plans, comms log, letter templates remain new modules |

## 6. Accounting (spec p.19–26)

| Spec element | Status | Notes |
|---|---|---|
| Accounting Overview (hub) | ✅ Built | Hub now includes the 12-month cash-flow chart + income/outgoings breakdown donuts, live from the transactions ledger |
| Invoices | 🟡 Partial | Landlord invoices with PDF generation exist; spec adds part-paid/overdue statuses + due dates (model change) |
| Payments Received (typed: rent / service charge / ancillary; methods analytics) | 🟡 Partial | Rent payments with methods exist; service-charge & ancillary income types don't |
| Expenses (suppliers, categories, recurring, approvals) | 🏗️ New module | Only contractor costs exist as transactions; supplier/expense management is a full build |
| Statements (generate, send, paid) | ✅ Built | PDF generation, initials, draft→sent→paid |
| Statements — delivery tracking (Delivered/Viewed/Downloaded), scheduling, tax packs, custom/investment reports | 🏗️ New module | Needs delivery/open tracking + a scheduler + report builder |
| Bank Reconciliation (statement import, matching, client accounts) | 🏗️ New module | Biggest accounting gap: needs bank accounts, statement import (CSV/OB), matching engine. Reconcile *flags* exist today |
| Client Account Balance (multiple client accounts) | 🏗️ New module | Requires a client-money ledger — prerequisite for several spec numbers |
| VAT (returns, liability timeline, HMRC refs) | 🏗️ New module | VAT amounts are recorded per transaction; returns/reporting layer doesn't exist |

## 7. Compliance (spec p.27–28)

| Spec element | Status | Notes |
|---|---|---|
| Certificate compliance per property | ✅ Built | Types, expiry, status; feeds dashboard + reports |
| Compliance checklist (landlord + property scope) | ✅ Built | Exists in data model and detail pages |
| Dedicated Compliance page (all items, filters, donut) | ✅ Built | Certificate register across all properties with type/status filters, expiry countdowns, and the overview donut. Frequency/recurrence *rules* remain a build |
| Tenant Compliance (inventories, house rules, guarantor agreements, per-tenancy items) | 🏗️ New (medium) | Right-to-rent exists; the rest needs new per-tenancy compliance records |

## 8. Maintenance (spec p.29–37)

| Spec element | Status | Notes |
|---|---|---|
| Request board with statuses, urgency, contractor assignment | ✅ Built | Drag-and-drop board mirroring the server state machine |
| Quote + invoice amounts, landlord approval, auto-approve threshold | ✅ Built | On the ticket model |
| Photos/media on requests | 🟡 Partial | `maintenance_images` table exists; gallery/video UI in the spec is richer |
| 8-stage workflow (Awaiting Quote, multi-contractor quotes, Work In Progress tracking, Financial Settlement, Recharge to tenant, Closed + sign-off) | 🏗️ New (large) | Spec's flagship module. Today: 6 statuses + single quote. Multi-quote tendering, engineer appointments, settlement/recharge ledger, sign-off ratings are all new workflow + data |
| Charge To (landlord vs tenant) + recharge tracking | 🏗️ New (small-medium) | One field + settlement logic |
| Response/resolution time analytics | 🟡 Partial | Derivable from existing timestamps once needed |

## 9. Calendar (spec p.38)

| Spec element | Status | Notes |
|---|---|---|
| Operations Calendar (month view, filters, agenda) | ✅ Built | Month grid + agenda of live key dates: certificate expiries, inspections due, rent due, tenancy ends, rent reviews, deposit deadlines — with type filters and month navigation. Arbitrary custom events + week/day views remain a build |
| AI Daily Planner (workload estimate) | 🏗️ New | Flagged BETA even in the mock; recommend explicitly descoping |

## 10. Build plan — six engines + edge integrations

The remaining gaps are not forty separate screens. They decompose into **six buildable engines**
plus a short list of small standalone items; §11 maps every open row of §§1–9 to exactly one of
these homes.

**E1 — Client-money ledger (the spine).** Replace the flat transactions table with a double-entry
ledger: an account per landlord, per tenancy, the agency fee account, and each real bank account.
Every business event (rent receipt, fee charge, contractor invoice, payout) posts balanced
entries, so arrears, statements, available balances, client-account balances and reconciliation
all become views over one ledger that must sum to zero — which is why the mock's numbers agree
with each other on every page. *Unlocks:* Client Account Balance (sidebar, dashboard, accounting),
Available Balance per landlord, Bank Reconciliation, supplier creditors, payment plans, recharge
settlement. *Decided (§13):* the reconciliation input is the **Xero transaction feed**
(`XERO-INTEGRATION.md`), not in-house bank-statement import; rent-through-ROCA confirmed —
tenants pay into ROCA's account and payments are matched back to tenancies/properties.

**E2 — Obligations engine.** Generalise the certificate model into "a dated obligation with a
responsible party and a recurrence rule". Gas cert, EICR, EPC, deposit registration, right-to-rent
recheck, inspections, rent reviews, renewals, licensing — one engine feeding one calendar and one
alerts feed. *Unlocks:* compliance frequency rules, inspection recurrence + reminders, tenant
compliance items, renewal chasing.

**E3 — Tasks & notifications.** Generic task queue (due date, priority, assignee) populated by
event triggers ("cert expires in 30 d", "arrears > 14 d", "quote received → approval task within
limit"). *Unlocks:* bell count badge, Tasks & Alerts page, approval flows, outstanding-action
queues. (The dashboard already derives *operational* alerts automatically.)

**E4 — Communications.** Templated outbound email, logged per entity — a send-and-log system, not
chat. *Unlocks:* Send Message buttons, Send Communication quick action, Communications tabs,
arrears letters, rent-review notices, statement delivery with Delivered/Viewed/Downloaded tracking.

**E5 — Property media.** Image/floor-plan storage + upload UI. *Built for properties 22 Jul
2026:* Photos tab on property detail (upload, set-primary, delete, floor plans), overview hero,
primary-photo thumbnails on the Properties list and landlord property cards — all served through
an authenticated endpoint with a client-side blob cache. *Still open from this engine:* richer
maintenance photo/video gallery (§8).

**E6 — Maintenance workflow v2** *(builds on E1 + E3)*. The spec's flagship module: 8-stage
workflow with multi-contractor quote tendering, engineer appointments, work-in-progress tracking,
financial settlement, recharge to landlord/tenant, and sign-off with ratings.

**Edge integrations — buy, don't build.** Xero (confirmed in use, §13) for company books and MTD
VAT returns; the Xero bank feed as the reconciliation *input* to E1 — design in
`XERO-INTEGRATION.md`. No in-house VAT engine, no in-house payment processing.

## 11. Complete reconciliation — every open item, one named home

Every 🟡 / 🏗️ row and every gap noted inside a 🔁 row from §§1–9. **Nothing in the 38 pages
exists outside this table plus the ✅ rows above.**

| Open deck item (spec §) | Home |
|---|---|
| Client Account Balance — sidebar tile, dashboard rows, accounting page (§1, §2, §6) | **E1** — live balance read from Xero (§13) |
| Available Balance per landlord — KPI strip (§3) | **E1** |
| Bank Reconciliation — accounts, statement import, matching (§6) | **E1** + Xero transaction feed (§13, `XERO-INTEGRATION.md`) |
| Expenses — suppliers, categories, recurring, approvals (§6) | **E1** (supplier entity; approvals via E3) |
| Payment plans on Arrears (§5) | **E1** (small feature on top of the ledger) |
| Tax packs + custom reports (§6) | Reporting layer on **E1** |
| VAT — returns, liability timeline, HMRC refs (§6) | **Xero integration** (Xero owns MTD filing) |
| Compliance frequency/recurrence rules (§7) | **E2** |
| Inspection recurrence rules + reminders (§4) | **E2** |
| Tenant compliance — inventories, house rules, guarantor agreements (§7) | **E2** |
| Renewal workflow — statuses, notices, chasing (§5) | **E2 + E3** |
| Notification bell count badge; Tasks & Alerts page (§1) | **E3** |
| Send Message buttons; Send Communication quick action; Communications tabs/nav (§1, §2, §3) | **E4** |
| Arrears communications log + letter templates (§5) | **E4** |
| Statement delivery tracking (Delivered/Viewed/Downloaded) + scheduling (§6) | **E4** + scheduler |
| Property photos on cards; photo-card grid; detail heroes (§3, §4) | **E5** — ✅ built 22 Jul 2026 |
| Floor plans (§4) | **E5** — ✅ built 22 Jul 2026 |
| Maintenance media gallery/video (§8) | **E5** |
| 8-stage workflow — multi-quote, appointments, settlement, sign-off (§8) | **E6** |
| Charge To (landlord/tenant) + recharge tracking (§8) | **E6 + E1** |
| Maintenance response/resolution analytics; dashboard "Overdue" row; upcoming works (§2, §4, §8) | **E6** (derivable once due dates/appointments exist) |
| Landlord Groups / Referral Partners / Management Packages (§3) | Standalone module — **gated on §13 Q5** (real offering, or AI filler?) |
| Property Import — bulk CSV (§4) | Standalone utility (small-medium) |
| Property Timeline tab (§4) | Standalone small — per-property view over the existing audit log |
| Portfolio value KPI (§3) | Small migrations bundle (admin-entered valuation field) — or descope |
| Tenancy fields: break clause, notice period, guarantor, occupants, pets/smoker (§4, §5) | Small migrations bundle |
| Referencing records on Add Tenant (§5) | Small migrations bundle |
| Per-document expiry dates (§4) | Small migrations bundle |
| Categorised/flagged property notes (§4) | Small migrations bundle |
| Invoice due dates + Overdue/Part-Paid statuses (§6) | Small migrations bundle |
| Service-charge & ancillary payment types (§6) | Small migrations bundle |
| Onboarding wizard 7-step % -progress layout (§3) | Standalone small — visual upgrade of the live 6-stage wizard |
| Calendar custom events + week/day views (§9) | Standalone small |
| Document storage quota (§4) | Standalone small (nice-to-have) |
| Help "?" button (§1) | Standalone small — needs a docs destination to exist first |
| AI Daily Planner (§9) | **Descope** — flagged BETA even in the mock |
| "Justify Increase" AI tool on rent reviews (§5) | **Descope** |
| Investment Reports (Premium) (§6) | **Descope** until the premium service exists |

## 12. Suggested phasing (for the client conversation)

- **Phase 1 (done):** everything the current data model supports, styled to the approved design —
  dashboard, sidebar/header chrome, landlord compliance & onboarding, properties & certificates,
  tenancies & lifecycle, rent reviews, news, deposits, inspections, utilities, documents,
  statements/invoices, maintenance board, reports, settings, plus landlord portal.
- **Phase 2 (done, 21 Jul 2026):** Rent Reviews page; Arrears page with ageing; dedicated
  Compliance page; accounting cash-flow/breakdown charts; per-property Financials tab; read-only
  Operations Calendar; breadcrumbs; sidebar section headers; renewals/tenure stats; landlord
  detail rebuild (KPI strip + 8 tabs).
- **Phase 2.5 (no client decisions needed):** ~~E5 property media~~ (done 22 Jul 2026 — photos,
  floor plans, thumbnails, hero); small migrations bundle (§11); property Timeline tab; Property
  Import; calendar week/day views; onboarding wizard visual upgrade.
- **Phase 3 (gated on §13):** **E1 ledger first** — it is the prerequisite for most missing money
  figures — then E2 obligations, E3 tasks, and E6 maintenance v2 in that order (E6 depends on E1 +
  E3); **E4 communications** can run in parallel with any of them; Xero integration runs as its
  own track (phases X1–X4 in `XERO-INTEGRATION.md`).
- **Recommend descoping:** AI Daily Planner; "Justify Increase" AI; "Investment Reports (Premium)"
  until the premium service exists.

## 13. Phase 3 decisions (taken 22 Jul 2026)

The client is non-technical, so these were decided on their behalf with the project lead. Only
one plain-English confirmation remains outstanding.

1. **Accounting backbone: Xero (confirmed in use).** ROCA's money runs through Xero — landlord
   payouts are made from the Xero-connected bank account. **Decision: our platform stays the
   property-management source of truth; Xero stays the money source of truth.** We integrate
   rather than rebuild: pull Xero bank transactions via the API and match them against rent
   schedules (money in) and landlord statements/payouts (money out). Bank Reconciliation, Client
   Account Balance and VAT become Xero-backed screens, not in-house engines. Full design in
   `XERO-INTEGRATION.md`.
2. **Rent flow: confirmed (22 Jul 2026) — tenants pay ROCA directly.** Rent lands in ROCA's
   Xero-connected account; the platform imports every transaction as income, auto-reconciles it
   to its tenancy/property where the match is unambiguous, and queues the rest for one-click
   manual reconciliation. This is the E1 + Xero matching design in `XERO-INTEGRATION.md` §3.
3. **Landlord Groups / Referral Partners / Management Packages: descoped** as AI filler unless
   the client explicitly asks (kept accounted for in §11).
4. **Operating policies: sensible defaults, no client input needed.** Maintenance auto-approve
   threshold already exists on the ticket model; statement day/channel become Settings options;
   NRL stays as captured at onboarding.

---
*Every figure shown in the live portal is computed from the database — nothing is hard-coded.
Where the mock displays a number the system cannot yet compute honestly, the element was omitted
or replaced with its real equivalent rather than faked; each such case is listed above.*
