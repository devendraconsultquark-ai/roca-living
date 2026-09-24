# Cross-portal Inconsistency Audit — 17 Jul 2026

Scope: server (Express/Knex API), admin portal, client (landlord) portal.
Four parallel scans: document taxonomy, status vocabulary, terminology/references, derived-metric drift.
Severity: 🔴 breaks user trust / functional · 🟡 misleading · ⚪ cosmetic.

---

## A. Document taxonomy (two parallel category systems)

Root cause: documents carry BOTH `folder_id` (admin's grouping) and `doc_type` (client's
"category", derived at `server/src/controllers/documentController.js:347-359`). The two are
written independently and never reconciled.

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| A1 | 🔴 | `doc_type` derived from upload scope only — admin's folder choice can never change the landlord-visible category | documentController.js:148,154; DocumentUploadModal.jsx:66 |
| A2 | 🔴 | Admin groups by folder, client by doc_type — structurally free to disagree | DocumentLibrary.jsx:287; client Documents.jsx:55 |
| A3 | 🔴 | Upload from Landlord page filed under "Property Gas & Safety Certs" still shows to landlord as "Compliance" | LandlordDetailPage.jsx:1001; documentController.js:148,351 |
| A4 | 🔴 | Generated statements/invoices have `folder_id=null` → visible to landlord, invisible in EVERY admin document view | statementController.js:147; invoiceController.js:111; documentController.js:59-77 |
| A5 | 🔴 | Same folderless rows also missing from admin Landlord detail Documents tab | LandlordDetailPage.jsx:378-379 |
| A6 | 🔴 | Statements/invoices with no matched landlord (`owner_type='global', owner_id=0`) unreachable in BOTH portals | statementController.js:150-151; invoiceController.js:114-115 |
| A7 | 🔴 | "Total Documents" tile (client) counts folderless docs the admin views exclude — counts disagree | client Documents.jsx:141; DocumentLibrary.jsx:224 |
| A8 | ⚪ | Client tiles/sidebar omit "Invoices" and "Other" categories the backend emits | documentController.js:349-358; client Documents.jsx:84-89,147-170 |
| A9 | 🔴 | Per-property "Documents on File" counts computed with different source sets + match keys per portal | PropertyDetailPage.jsx:85-88; usePropertyDetails.js:307-313 |
| A10 | 🔴 | `property_certificates` table and document-category "Certificates" are disjoint — a cert uploaded one way is invisible the other way | phase1_tables.js:94-107; useCertificates.js:102; documentController.js:353 |
| A11 | ⚪ | Upload dialog labels the folder picker "Category" though it doesn't set the client category | DocumentUploadModal.jsx:108 |
| A12 | ⚪ | Folders are global/uncoupled from scope → scope badge can contradict folder name | documentController.js:26-28,144; DocumentLibrary.jsx:287 |
| A13 | ⚪ | DocumentLibrary upload form cannot set a folder at all (scope-default only) | DocumentLibrary.jsx:115-116 |

## B. Status vocabulary (DB enum vs UI labels)

Root cause (B15): StatusPill maps miss underscore/synonym keys — any unmapped value falls
through to a grey default pill showing raw text.

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| B1 | 🔴 | KYC `failed` renders grey pill literally reading "danger"; `not_started` renders as "Draft" | admin Landlords.jsx:232; StatusPill.jsx:212-216 |
| B2 | 🔴 | Client Utilities checks status `'active'` which can never exist; `completed`/`disputed` fall to blue lowercase raw text; `bg-status-warning-bg` token doesn't exist | client Utilities.jsx:92-102; phase3:86 |
| B3 | 🟡 | properties.status `let` = "Active" (admin) vs "Occupied" (client); `vacant` = "Pending" vs "Vacant" | admin Properties.jsx:267-272; client Properties.jsx:72-78 |
| B4 | 🟡 | `onboarding` properties shown to landlords as "Vacant" (admin: "Draft"; unused StatusPill entry "Onboarding" exists) | client Properties.jsx:78; StatusPill.jsx:179-183 |
| B5 | 🟡 | Maintenance urgency: admin Emergency/Urgent/Routine vs client High/Medium (urgent+routine collapsed) | MaintenanceBoard.jsx:36-40; client Maintenance.jsx:119-132 |
| B6 | 🟡 | Maintenance status: `awaiting_approval` shown to landlord as just "In Progress" — landlord can't see it awaits THEIR approval; `new`="Pending" vs "New" | client Maintenance.jsx:135-159 |
| B7 | 🟡 | Landlord detail badge prints raw enum (`not_started`, `failed`) in red; dead check for `kyc_status==='approved'` | LandlordDetailPage.jsx:361,389-395 |
| B8 | 🟡 | Cert `compliant` → "Valid" (grey, unmapped) on client Certificates page, but green "Compliant" on client Properties page — client disagrees with itself | useCertificates.js:24-29; client Properties.jsx:51-53 |
| B9 | 🟡 | Checklist `complete` → grey pill (StatusPill only knows `completed`) | useComplianceOverview.js:46-50; StatusPill.jsx:63-68 |
| B10 | 🟡 | Statement `sent`: grey (client, unmapped) vs blue (admin) | useStatements.js:35; admin Statements.jsx:327-328 |
| B11 | 🟡 | Deposit end-states (`returned/disputed/deducted`) all show as "Registered" to landlords | useTenancyLifecycle.js:94,104-108; admin Deposits.jsx:124-128 |
| B12 | 🔴 | Create-statement API returns `status:'generated'` — not in enum, stored as `draft` | statementController.js:186,261 |
| B13 | 🔴 | Client lifecycle filters on tenancy status `'closed'` which doesn't exist | useTenancyLifecycle.js:44,74 |
| B14 | 🟡 | `notice` tenancies fall into NO lifecycle bucket on client (admin: "Notice Served") | useTenancyLifecycle.js:70-86; admin Tenancies.jsx:17,24 |
| B15 | ⚪ | StatusPill key gaps are the root cause: has `not uploaded`+`not_uploaded` but only `not started`; no `complete`, `valid`, `sent`, `not_started` | StatusPill.jsx:33-203 |

## C. Terminology, references, formatting

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| C1 | 🟡 | "Accounting" (admin) vs "Financials" (client) for the same money hub | AdminLayout.jsx:22,82; client Sidebar.jsx:48 |
| C2 | 🟡 | "Tenancies"/"Tenancy Agreements" (admin) vs "Tenancy Lifecycle" (client) | AdminLayout.jsx:19,79; Sidebar.jsx:64 |
| C3 | ⚪ | "Utilities"/"Utility Handover Dashboard" vs "Utilities & Access" | AdminLayout.jsx:29,89; Sidebar.jsx:65 |
| C4 | ⚪ | Inspections: top-level (admin) vs Compliance sub-item (client) | AdminLayout.jsx:88; Sidebar.jsx:60 |
| C5 | ⚪ | Client nav "Support" opens page titled "Help" | Sidebar.jsx:67; LandlordHeader.jsx:176 |
| C6 | ⚪ | Admin Statements/Invoices subtitles say "landlord partners" | AdminLayout.jsx:23-24 |
| C7 | ⚪ | Nav "Agents" vs "Letting Agents" everywhere else | AdminLayout.jsx:21,81; Agents.jsx:85 |
| C8 | ⚪ | Admin Tenants page: "Total Tenants" tile valued "N Residents" | Tenants.jsx:190-191 |
| C9 | 🟡 | Tenancy refs: `TCY-<id>` (server/admin) vs `TEN-00001` (client) vs `Tenancy #id` (admin dropdowns) | documentController.js:54; useTenancyLifecycle.js:76; admin Utilities.jsx:91 |
| C10 | 🟡 | Maintenance refs: `Ticket #id` (admin) vs `MAI-00001` (client) | MaintenanceBoard.jsx:472; client Maintenance.jsx:168 |
| C11 | 🟡 | Landlord ref: canonical `REM-LND-###` plus 4 ad-hoc formats (`LND-x`, `LR-2024-047`, `RL_LR_...`) | landlordSetup.js:16; documentController.js:50; statementController.js:552 |
| C12 | 🟡 | Property ref fallbacks: `PRP-x`, `Property #x`, `Prop #x`, `BLOCK-APT` all in use | PropertyDetailPage.jsx:78; client Properties.jsx:280; PropertyDropdown.jsx:175 |
| C13 | ⚪ | Statement ref: DB `REM-STM-#####` vs filename `RL_STMT_...` vs "Statement #id" | statementController.js:134,201; AccountingHub.jsx:88 |
| C14 | ⚪ | "Property Reference" (admin header) vs "Property Ref" (client header) | admin Properties.jsx:238; client Properties.jsx:58 |
| C15 | ⚪ | Same field: "Landlord ID" (admin list, client profile) vs "Reference ID" (admin detail) | Landlords.jsx:201; LandlordDetailPage.jsx:413 |
| C16 | ⚪ | Client fabricates `INSP-#####` refs with no admin counterpart | client Inspections.jsx:108 |
| C17 | 🟡 | Rent formatted 3 ways: `£1250.00` / `£1,250` / `£1250` on equivalent screens | admin Properties.jsx:259; client Properties.jsx:66; Dashboard.jsx:138 |
| C18 | 🟡 | Money: admin `toFixed(2)` (no thousands sep) vs client `toLocaleString(...,2dp)` | admin Statements.jsx:316; client Statements.jsx:342 |
| C19 | ⚪ | Client mixes whole-pound and 2dp for same figure kinds | client Properties.jsx:354-398 vs PropertyDetails.jsx:602-686 |
| C20 | ⚪ | Pluralisation bug: "0 Propertyies" / "1 Propertyies" ("Property"+"ies") | LandlordDetailPage.jsx (Managed Properties count) |

## D. Derived-metric drift (same number, different formulas)

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| D1 | ⚪ | Occupancy: integer (admin Reports) vs 1dp (admin Dashboard) from same endpoint | Reports.jsx:70-72; Dashboard.jsx:49 |
| D2 | 🔴 | Occupancy has 3 unrelated definitions across portals (portfolio ratio / binary per property / let-ratio) | reportController.js:109-112; useDashboard.js:382; usePropertiesPage.js:77-83 |
| D3 | 🔴 | Client "Year to Date Net" is actually ALL-TIME net (no year filter; identical to "Net Paid" tile) | useFinancials.js:117-125; Financials.jsx:106,152 |
| D4 | 🔴 | YTD income basis: transactions ledger (admin/server) vs statement gross_rent (client) — diverge via void credits/rebates | reportController.js:129-137; useDashboard.js:350 |
| D5 | 🔴 | Expenses: 3 formulas (non-rent transactions / gross−net gap / deductions+NRL) — client's own two disagree | LandlordDetailPage.jsx:368-370; useDashboard.js:352-361; useFinancials.js:124 |
| D6 | 🔴 | Compliance % has FIVE different formulas (incl. fixed /3 denominator in formatProperty.js) | useDashboard.js:17-36; useComplianceOverview.js:151-157; formatProperty.js:5-9; usePropertiesPage.js:85-121 |
| D7 | 🔴 | "Overall compliance" headline differs between client Dashboard and client Compliance page | useDashboard.js:464-466; useComplianceOverview.js:185 |
| D8 | 🟡 | Landlord checklist %: not_applicable handled oppositely in two client formulas | useDashboard.js:427-434; useComplianceOverview.js:169-180 |
| D9 | 🟡 | Arrears day-count: `Math.abs` (accounting endpoint) vs `Math.max(0,…)` (everywhere else) | tenancyController.js:743-744 vs 638-644 |
| D10 | 🟡 | "Pending payout": `status!=='paid'` (admin detail) vs `!=='Paid'` (client, title-cased data) vs draft-only (pipeline count) | LandlordDetailPage.jsx:104-107; useFinancials.js:118-120; reportController.js:127 |
| D11 | 🟡 | DataTable drifted between portals (onRowClick, align:'center', selection colors, pagination icons) — all other shared UI components byte-identical | admin vs client DataTable.jsx |
| D12 | ⚪ | Percentage precision inconsistent (integers vs 1dp) across screens | multiple, see D1 |
| D13 | ⚪ | Currency locale/min-max fraction digit settings vary per screen | LandlordDetailPage.jsx:374; Reports.jsx:77,91 |
| D14 | 🟡 | "Avg tenancy length" (client-only) actually measures elapsed time since start, /30.44 | usePropertiesPage.js:134-145 |

---

## Suggested fix order

1. **B-bucket quick wins** — extend StatusPill key maps (fixes B1, B8, B9, B10 mechanically), remove dead statuses (B2, B12, B13), then align label vocabularies per entity (product sign-off: which label wins per status).
2. **A-bucket root cause** — single source of truth for category: derive client category from the folder (or set doc_type from folder at upload); give generated statements/invoices folders (fixes A4-A7); merge/bridge certificates (A10) needs product decision.
3. **D3 immediately** (the "Year to Date" that isn't) + pick ONE canonical formula each for occupancy, compliance %, expenses — needs product sign-off, then implement in server so both portals consume the same computed number.
4. **C-bucket** — one shared reference-format helper (server-side), one currency formatter per portal, rename nav/labels after product sign-off.
