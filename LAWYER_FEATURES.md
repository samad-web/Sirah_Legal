# LexDraft — Lawyer Dashboard: Features & Functions

> Complete reference for all pages, features, actions, and API calls on the advocate side of LexDraft.

---

## Table of Contents

1. [Routing Overview](#routing-overview)
2. [Dashboard](#1-dashboard--dashboard)
3. [Documents Library](#2-documents--documents)
4. [Calendar](#3-calendar--calendar)
5. [Messages](#4-messages--messages)
6. [Draft Legal Notice](#5-draft-notice--draftnotice)
7. [Draft Contract](#6-draft-contract--draftcontract)
8. [Review Contract](#7-review-contract--reviewcontract)
9. [Draft Title Report](#8-draft-title-report--drafttitle-report)
10. [Settings](#9-settings--settings)
11. [Manage Clients](#10-manage-clients--clients)
12. [Clause Library](#11-clause-library--clauses)
13. [Stamp Duty Calculator](#12-stamp-duty-calculator--stamp-duty)
14. [eCourts Case Status](#13-ecourts-case-status--ecourts)
15. [Public Intake Form](#14-public-intake-form--intakeformid)
16. [Sidebar Navigation](#15-sidebar-navigation)
17. [Shared Components](#shared-components--utilities)

---

## Routing Overview

All advocate routes are wrapped in `AppLayout`, which enforces authentication and renders the sidebar.

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Home — quick actions, metrics, recent documents |
| `/calendar` | Calendar | Monthly calendar of all case timeline events |
| `/messages` | Messages | Per-case secure chat with clients |
| `/draft/notice` | Draft Notice | AI-powered legal notice generation |
| `/draft/contract` | Draft Contract | AI-powered contract generation |
| `/review/contract` | Review Contract | AI contract risk analysis & clause review |
| `/draft/title-report` | Draft Title Report | AI property title research report |
| `/documents` | Documents | Full document library with search & versioning |
| `/settings` | Settings | Profile, uploads, intake forms, plan |
| `/clients` | Manage Clients | Case & client management, notes, requests |
| `/clauses` | Clause Library | Reusable legal clause snippets |
| `/stamp-duty` | Stamp Duty | Stamp duty & registration fee calculator |
| `/ecourts` | eCourts | Indian court case status lookup |
| `/intake/:formId` | Intake Form | Public client intake form (no auth required) |

---

## 1. Dashboard — `/dashboard`

**Purpose:** Main entry point. Displays profile summary, usage metrics, quick actions, and recent documents.

### Displayed Data
- Time-based greeting (Good morning / afternoon / evening) + advocate name
- Bar Council enrollment number and firm name
- Current plan (Free / Solo / Firm) with monthly document quota
- Usage progress bar — documents generated this month vs. plan limit
- Expiring documents alert — documents due to expire within 30 days
- Recent documents table — last 10 documents created

### Quick Action Cards
| Card | Navigates To | Description |
|------|-------------|-------------|
| Draft a Legal Notice | `/draft/notice` | Legal notices, demand letters, rejoinders |
| Draft a Contract | `/draft/contract` | NDA, employment, vendor agreements |
| Review a Contract | `/review/contract` | AI risk flagging and clause analysis |
| Title Research Report | `/draft/title-report` | Property title opinion and chain |

### Recent Documents Table
- **Columns:** Document Name · Type (colour-coded badge) · Created Date · Status · Actions
- **Actions per row:** Download PDF · Delete (with confirm dialog)
- Table auto-refreshes when a document is saved from any draft page via `lexdraft:document-saved` window event

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getUserDocuments(userId, { limit: 10 })` | `GET /api/documents` | Load recent documents |
| `deleteDocument(docId)` | `DELETE /api/documents/:id` | Delete a document |

---

## 2. Documents — `/documents`

**Purpose:** Full document library with full-text search, multi-filter, pagination, and version history.

### Search & Filtering
- **Full-text search** — debounced 350 ms, server-side
- **Type filter** — ALL / NOTICE / CONTRACT / TITLE REPORT / REVIEW
- **Language filter** — ALL / EN / TA (Tamil) / HI (Hindi)
- Results paginated at 20 per page with "LOAD MORE" button

### Document Table
- **Columns:** ☐ Checkbox · Name · Type · Created · Language · Status · Actions
- **Hover actions:** Preview · Version History · Download PDF · Delete

### Bulk Operations
- Select / deselect all checkboxes
- Bulk delete with confirm dialog popup

### Preview Modal
- Full rendered document content
- Export buttons: **PDF** and **DOCX**

### Version History Modal
- Lists all saved versions: version number, timestamp, character count
- Click **VIEW** to read any previous version in full
- Versions are auto-saved whenever document content changes after an edit

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getUserDocuments(userId, opts)` | `GET /api/documents` | Paginated document fetch |
| `deleteDocument(docId)` | `DELETE /api/documents/:id` | Delete document |
| `getDocumentVersions(docId)` | `GET /api/documents/:id/versions` | List all versions |
| `getDocumentVersion(docId, versionId)` | `GET /api/documents/:id/versions/:vid` | Fetch version content |
| `logDocumentAccess(userId, docId, action)` | `POST /api/client/audit` | Fire-and-forget audit log |

---

## 3. Calendar — `/calendar`

**Purpose:** Monthly calendar view of all case timeline events across every case.

### Calendar Features
- Full month grid with day-of-week headers
- Previous / Next month navigation
- Today's date highlighted in gold
- Each day cell shows up to 3 events; excess shown as **+N more**
- Clicking a day selects it and shows a full event list below the grid

### Event Types & Colours
| Type | Colour |
|------|--------|
| Hearing | Light blue |
| Filing | Light green |
| Order | Yellow |
| Milestone | Gold |
| Payment | Pink |
| Notice | Indigo |

### Selected Day Panel
- Event type badge · Case name · Event title · Description
- Contextual icon per event type (gavel, folder, document, etc.)

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getAllTimeline()` | `GET /api/cases/timeline` | All timeline events across all cases |

---

## 4. Messages — `/messages`

**Purpose:** Per-case secure messaging between advocate and assigned clients.

### Layout
- **Left sidebar** — case list (collapses on mobile when a thread is open)
- **Right panel** — message thread for the selected case

### Case List (Sidebar)
- Displays: case title · status badge · unread count badge (gold)
- Tap/click a case to load its thread; sidebar auto-hides on mobile
- **← back button** (mobile only) to return to the case list

### Message Thread
- Messages auto-scroll to bottom on load and on new message
- **User messages** — aligned right, forest-green background
- **Client messages** — aligned left, muted surface background
- Each message shows: sender name (if not current user) · content · timestamp · "Read" tick (outgoing)
- Empty state when no messages exist

### Message Input
- Multi-line textarea — **Enter** to send, **Shift+Enter** for new line
- Send button disabled when input is empty
- Restores input text if send fails (network error)

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getCases(userId)` | `GET /api/cases` | Load case list for sidebar |
| `getCaseMessages(caseId)` | `GET /api/messages/:caseId` | Load thread |
| `markMessagesRead(caseId)` | `POST /api/messages/:caseId/read` | Reset unread count |
| `sendMessage(caseId, content)` | `POST /api/messages/:caseId` | Send message |

---

## 5. Draft Notice — `/draft/notice`

**Purpose:** AI-powered legal notice generation with multi-language support.

### Form Wizard — 4 Steps

**Step 1 — Document Type**
- Select one of 6 notice types:
  - Legal Notice — Money Recovery
  - Legal Notice — Property Dispute
  - Legal Notice — Service Deficiency
  - Legal Notice — Employment Matter
  - Demand Letter
  - Rejoinder / Reply to Notice

**Step 2 — Party Details**
| Field | Notes |
|-------|-------|
| Client (Sender) Name | Required |
| Client Address | Textarea |
| Advocate Name | Pre-filled from profile |
| Bar Council Enrollment No. | Pre-filled from profile |
| Recipient Name | Required |
| Recipient Address | Textarea |

**Step 3 — Matter Details**
| Field | Notes |
|-------|-------|
| Facts of the Matter | Textarea, required |
| Relief Sought | Textarea, required |
| Compliance Deadline | Days from receipt (default: 30) |
| Governing State | Dropdown, pre-filled from profile |
| Relevant Act | Auto-suggested based on notice type |

**Step 4 — Preferences**
| Field | Options |
|-------|---------|
| Output Language(s) | Multi-select: EN / TA (Tamil) / HI (Hindi) |
| Tone | Professional / Firm / Urgent |

> The **Next** and **Generate** buttons are disabled until all required fields in the current step are filled (`canProceed()` validation).

### Generation Flow
1. Click **GENERATE** → date confirmation modal appears
2. User confirms or changes the notice date
3. Document streams in real-time into the preview panel (right side on desktop, toggled on mobile)
4. One document is generated per selected language
5. Each generated document is auto-saved to the library

### Export Options
- **Download PDF** — uses advocate's letterhead & signature from profile
- **Download DOCX** — editable Word format

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `generateDocument({ module: 'notice', language, payload })` | `POST /api/generate` | SSE streaming generation |
| `saveDocument({ title, type, content, language, status })` | `POST /api/documents` | Save to library |
| `incrementDocumentCount(userId)` | `POST /api/profiles/increment-count` | Update usage counter |

---

## 6. Draft Contract — `/draft/contract`

**Purpose:** AI-powered contract drafting for 5 common agreement types.

### Form Wizard — 4 Steps

**Step 1 — Contract Type**
- NDA (Mutual / one-way confidentiality)
- Employment Agreement
- Vendor / Service Agreement
- Consultancy Agreement
- Freelance Agreement

**Step 2 — Party Details** (for Party A and Party B)
| Field | Options |
|-------|---------|
| Name | Text input |
| Address | Textarea |
| Entity Type | Individual / Private Limited / LLP / Partnership |
| Represented By | Signatory name |

**Step 3 — Contract Terms** *(conditional on type)*

*For NDA:*
- Purpose of Disclosure
- Duration (months)
- Confidential Information Definition
- Exclusions from confidentiality
- Return of Materials (toggle)
- Non-Compete Clause (toggle + duration if enabled)

*For Employment:*
- Designation, Department
- CTC (annual salary)
- Probation Period (default: 6 months)
- Notice Period (default: 30 days)
- Non-Solicitation clause (toggle)

**Step 4 — Jurisdiction**
| Field | Options |
|-------|---------|
| Governing Law State | Dropdown, pre-filled from profile |
| Dispute Resolution | Arbitration / Litigation / Mediation First |
| Arbitration Seat | State name (shown if Arbitration selected) |
| Output Language(s) | Multi-select: EN / TA / HI |

### Generation, Export & Save
Same as Draft Notice — streaming SSE, PDF/DOCX export, auto-save to library.

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `generateDocument({ module: 'contract', language, payload })` | `POST /api/generate` | SSE streaming generation |
| `saveDocument({ ... })` | `POST /api/documents` | Save to library |
| `incrementDocumentCount(userId)` | `POST /api/profiles/increment-count` | Update usage counter |

---

## 7. Review Contract — `/review/contract`

**Purpose:** AI-powered contract risk analysis. Upload a contract, get a structured risk report.

### Workflow

**Step 1 — Select Role**
- Radio buttons: **Vendor** · **Employee** · **Client** · **Company**
- Determines the analysis perspective

**Step 2 — Upload Contract**
- Accepted formats: `.pdf`, `.docx`, `.doc`, `.txt`, `.pptx` (max 10 MB)
- Drag-and-drop or click-to-browse
- Frontend extracts text client-side before sending

**Step 3 — Analysis Results**

| Section | Description |
|---------|-------------|
| Risk Score Gauge | 0–100 circular indicator. Green ≤30 (LOW), Orange 31–60 (MODERATE), Red >60 (HIGH) |
| Risk Summary | One-sentence AI executive summary |
| Risk Clauses | Problematic terms — red left border |
| Missing Clauses | Important absent clauses — yellow border + alert icon |
| Negotiate Clauses | Terms worth negotiating — yellow border |
| Standard Clauses | Well-drafted protective clauses — green border + checkmark |

**Expandable Clause Cards** (click any clause to expand):
- Original text extracted from the contract
- Issue description
- Recommendation
- Suggested Redline — removed text (red) and added text (green)

### Save Analysis
- **SAVE ANALYSIS** button stores the full result as a `contract-review` document in the library

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `generateDocument({ module: 'contract-review', payload })` | `POST /api/generate` | Non-streaming JSON analysis |
| `saveDocument({ type: 'contract-review', ... })` | `POST /api/documents` | Save analysis |

---

## 8. Draft Title Report — `/draft/title-report`

**Purpose:** AI-powered Indian property title research report generation with document upload support.

### Form Sections

**Property Details**
| Field | Notes |
|-------|-------|
| Survey / Khasra Number | Optional |
| Extent + Unit | Number input + dropdown (sqft / acres) |
| Village / Locality | Text |
| Taluk / Tehsil | Text |
| District | Text |
| State | Dropdown, pre-filled from profile |
| Purpose of Report | e.g., "Verification for purchase" |

**Search Parameters**
- Search From Year (default: current year − 30)

**Report Details**
- Prepared For (client name)

**Document Upload**
Upload supporting documents by category:
- Sale Deed(s) — multi-file
- Encumbrance Certificate (EC)
- Patta / Chitta / RTC
- Survey Sketch / FMB
- Prior Title Deeds — multi-file
- Any Other

**Output Language** — Multi-select: EN / TA / HI

### Report Sections Generated
1. Title Block (property identification)
2. Chain of Title (tabular: Year · Document Type · Vendor · Purchaser · SRO)
3. Encumbrances & Charges
4. Statutory Compliance (Patta, tax, RERA)
5. Gap Analysis (flags gaps with `[GAP IN TITLE]`)
6. Opinion on Title — CLEAR AND MARKETABLE / CONDITIONALLY CLEAR / DEFECTIVE
7. Documents Reviewed
8. Disclaimer

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `generateDocument({ module: 'title-report', language, payload })` | `POST /api/generate` | SSE streaming |
| `saveDocument({ type: 'title-report', ... })` | `POST /api/documents` | Save report |
| `incrementDocumentCount(userId)` | `POST /api/profiles/increment-count` | Update usage counter |

---

## 9. Settings — `/settings`

**Purpose:** Advocate profile management, file uploads, intake form builder, plan info, and session control.

### Profile Information (Left Column)
| Field | Notes |
|-------|-------|
| Full Name | Text input |
| Bar Council Enrollment No. | e.g., TN/1234/2020 |
| State Bar Council | Dropdown |
| Firm / Chamber Name | Text input |
| Office Address | Textarea — used in document headers |

### File Uploads
| Upload | Accepted Formats | Max Size | Purpose |
|--------|-----------------|----------|---------|
| Letterhead | PNG, JPG, PDF | 5 MB | Printed at top of PDF exports |
| Signature | PNG, JPG | 5 MB | Printed at bottom of PDF exports |

- Upload zone with drag-and-drop
- Preview thumbnail after upload
- Optional crop modal for images
- Delete button to remove existing file

### Preferences (Right Column)
| Setting | Options |
|---------|---------|
| Default Output Language | EN / TA / HI toggle |
| Default Governing State | Dropdown (all Indian states) |
| Default Dispute Resolution | Arbitration / Litigation / Mediation First |
| Email Notifications | ON / OFF toggle |

### Plan & Usage
- Current plan badge (FREE / SOLO / FIRM)
- Visual usage bar — documents this month vs. monthly limit
- Upgrade buttons with pricing:
  - Free → Solo ₹999/month (50 docs/month)
  - Free/Solo → Firm ₹3,999/month (unlimited)

### Security
- Shows current session: email + last sign-in timestamp
- **Sign out all other devices** button — invalidates all other sessions

### Intake Forms Manager
| Action | Description |
|--------|-------------|
| NEW FORM | Opens form builder panel |
| Form builder | Dynamic field creation — label, type, required toggle |
| Field types | text · email · tel · number · date · textarea |
| LINK button | Copies shareable public URL to clipboard |
| Open icon | Opens form in new tab |
| Submissions icon | Expands to show all submission responses |
| Delete icon | Deletes form with confirm |

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `upsertProfile(data)` | `PATCH /api/profiles/me` | Save profile changes |
| `uploadAdvocateFile(file, slot)` | `POST /api/profiles/upload-file` | Upload letterhead/signature |
| `getIntakeForms()` | `GET /api/intake-forms` | Load forms list |
| `createIntakeForm({ title, fields })` | `POST /api/intake-forms` | Create new form |
| `updateIntakeForm(id, updates)` | `PATCH /api/intake-forms/:id` | Update form |
| `deleteIntakeForm(id)` | `DELETE /api/intake-forms/:id` | Delete form |
| `getIntakeFormSubmissions(formId)` | `GET /api/intake-forms/:id/submissions` | Load responses |

---

## 10. Manage Clients — `/clients`

**Purpose:** Central hub for case management, client accounts, document linking, notes, requests, and audit logs.

### Cases List (Left Panel)
- **NEW CASE** button → create case (title + description)
- Each case shows: title · status badge (ACTIVE / CLOSED) · delete icon
- Click a case to load the detail panel

### Case Detail Tabs (Right Panel)

#### Clients Tab
| Action | Description |
|--------|-------------|
| ASSIGN CLIENT | Link an existing client account to this case |
| Remove client | Unlink client from case |

#### Documents Tab
| Action | Description |
|--------|-------------|
| LINK DOCUMENTS | Modal to select from advocate's document library |
| Unlink document | Remove document from case |

#### Notes Tab
| Action | Description |
|--------|-------------|
| Write new note | Textarea + SAVE button |
| Edit note | Opens note in textarea for editing |
| Delete note | With confirm dialog |

#### Requests Tab
| Action | Description |
|--------|-------------|
| NEW REQUEST | Request a specific document from a client |
| Fields | Client selector · Title · Description |
| Mark Fulfilled | Updates request status to fulfilled |

#### Audit Tab
- Read-only log: Date/Time · User · Action (preview / download / view) · Document
- Entries created automatically when clients access documents

#### History Tab
- Timeline of case status changes: Date · Old Status → New Status

### Client Management
| Action | Description |
|--------|-------------|
| NEW CLIENT | Create client account with email + auto-generated password |
| Credentials modal | Shows email & temp password to share with client |
| RESET PW | Sends password reset; shows success/error inline |

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getCases(userId)` | `GET /api/cases` | Load all cases |
| `createCase({ title, description })` | `POST /api/cases` | Create case |
| `updateCase(id, updates)` | `PATCH /api/cases/:id` | Update case |
| `deleteCase(id)` | `DELETE /api/cases/:id` | Delete case |
| `getClientsForCase(caseId)` | `GET /api/cases/:id/clients` | Clients on case |
| `assignClientToCase(caseId, clientId)` | `POST /api/cases/:id/clients/:cid` | Assign client |
| `removeClientFromCase(caseId, clientId)` | `DELETE /api/cases/:id/clients/:cid` | Remove client |
| `getClientProfiles()` | `GET /api/clients` | All client accounts |
| `createClientAccount(email, pw, name)` | `POST /api/clients` | Create client |
| `resetClientPassword(clientId)` | `POST /api/clients/:id/reset-password` | Reset password |
| `getUserDocuments(userId, { limit: 200 })` | `GET /api/documents` | Docs for linking modal |
| `getLinkedCaseDocumentIds(caseId)` | `GET /api/cases/:id/documents` | Already-linked doc IDs |
| `linkDocumentToCase(caseId, docId)` | `POST /api/cases/:id/documents/:did` | Link doc |
| `unlinkDocumentFromCase(caseId, docId)` | `DELETE /api/cases/:id/documents/:did` | Unlink doc |
| `getCaseNotes(caseId)` | `GET /api/cases/:id/notes` | Load notes |
| `createCaseNote(caseId, content)` | `POST /api/cases/:id/notes` | Add note |
| `updateCaseNote(caseId, noteId, content)` | `PATCH /api/cases/:id/notes/:nid` | Edit note |
| `deleteCaseNote(caseId, noteId)` | `DELETE /api/cases/:id/notes/:nid` | Delete note |
| `getDocumentRequests(caseId)` | `GET /api/document-requests?caseId=` | Load requests |
| `createDocumentRequest(data)` | `POST /api/document-requests` | Create request |
| `updateDocumentRequest(id, { status })` | `PATCH /api/document-requests/:id` | Mark fulfilled |
| `getAuditLogs({ caseId })` | `GET /api/audit-logs` | Access log |
| `getCaseStatusHistory(caseId)` | `GET /api/cases/:id/history` | Status timeline |

---

## 11. Clause Library — `/clauses`

**Purpose:** Create, manage, search, and reuse legal text snippets with category and tag support.

### Toolbar
- **Search box** — full-text search, debounced 300 ms
- **Category filters** — ALL · CONTRACT · NOTICE · PROPERTY · EMPLOYMENT · ARBITRATION · FAMILY · CRIMINAL · GENERAL
- **NEW CLAUSE** button → opens create modal

### Clause Card
- Title · Category badge · Tags · Content preview (3 lines)
- **Hover actions:**
  - **Copy** — copies content to clipboard, shows "COPIED" flash (2 s)
  - **Edit** — opens edit modal
  - **Delete** — confirm dialog

### Create / Edit Modal
| Field | Notes |
|-------|-------|
| Title | Required |
| Content | Textarea, 8 rows, required |
| Category | Dropdown, optional |
| Tags | Comma-separated, optional |

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getClauses({ search, category })` | `GET /api/clauses` | Load/search clauses |
| `createClause({ title, content, category, tags })` | `POST /api/clauses` | Create |
| `updateClause(id, updates)` | `PATCH /api/clauses/:id` | Edit |
| `deleteClause(id)` | `DELETE /api/clauses/:id` | Delete |

---

## 12. Stamp Duty Calculator — `/stamp-duty`

**Purpose:** Instant stamp duty and registration fee calculation for Indian property deeds.

### Inputs
| Field | Options |
|-------|---------|
| State | All Indian states dropdown |
| Deed Type | Sale · Gift · Lease · Mortgage · Power of Attorney · Partition |
| Transaction Value | ₹ currency input |

### Output (shown when value > 0)
- Stamp Duty (% or flat amount for POA)
- Registration Fee
- **Total Payable** (prominent display)
- Disclaimer: *Approximate rates — verify with local SRO*

### Supported States
Tamil Nadu · Maharashtra · Delhi · Karnataka · Gujarat · Uttar Pradesh · West Bengal · Kerala · Andhra Pradesh · Telangana · (+ default fallback rates)

> **No API calls** — purely client-side calculation.

---

## 13. eCourts Case Status — `/ecourts`

**Purpose:** Lookup Indian court case status via CNR number or case number details.

### Search Options

**Option A — CNR Number (recommended)**
- Auto-uppercased text input
- Format: `MHNS010012342024`

**Option B — Case Number**
- Case number + optional: State · Court Number · Year (dropdown, last 15 years)

### Results Display
| Section | Fields |
|---------|--------|
| Case Identity | CNR · Case Type · Filing No. · Filing Date · Registration · Status |
| Parties | Petitioner · Respondent · Court No. · Judge |
| Next Hearing | Date (prominently shown in gold) · Purpose |
| Acts / Sections | Badge list of applicable laws |
| Case History | Table: Date · Purpose · Judge |
| Notes | Warning/info notes from eCourts system |

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `searchECourts({ cnr, caseNo, court, state, year })` | `GET /api/ecourts/search` | Query eCourts |

---

## 14. Public Intake Form — `/intake/:formId`

**Route:** `/intake/{formId}` — **no authentication required**

**Purpose:** Client-facing form for collecting information before onboarding. Shareable link generated from Settings.

### Form Display
- LexDraft branding header
- Form title (from database)
- Subtitle: *"Please fill in the form below. All information is confidential."*

### Fields
- **Email Address** — optional, for follow-up contact
- **Dynamic fields** — defined by the advocate when creating the form:
  - Types: `text` · `email` · `tel` · `number` · `date` · `textarea`
  - Required fields marked with *

### States
| State | Display |
|-------|---------|
| Loading | Spinner |
| Form not found | Error message |
| Filled | SUBMIT FORM button (disabled until required fields filled) |
| Success | Checkmark icon + confirmation message |
| Submit error | Inline error text |

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getIntakeFormPublic(formId)` | `GET /api/intake-forms/:id/public` | Load form (no auth) |
| `submitIntakeForm(formId, data)` | `POST /api/intake-forms/:id/submit` | Submit responses (no auth) |

---

## 15. Sidebar Navigation

Persistent collapsible sidebar on all advocate pages.

### Navigation Items
| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/dashboard` | LayoutDashboard |
| Calendar | `/calendar` | Calendar |
| Messages | `/messages` | MessageSquare |
| Draft Notice | `/draft/notice` | FileText |
| Draft Contract | `/draft/contract` | Scroll |
| Review Contract | `/review/contract` | ShieldCheck |
| Title Report | `/draft/title-report` | MapPin |
| Documents | `/documents` | FolderOpen |
| Manage Clients | `/clients` | Users |
| Clause Library | `/clauses` | BookOpen |
| Stamp Duty | `/stamp-duty` | Calculator |
| eCourts | `/ecourts` | Gavel |

### Bottom Controls
| Control | Action |
|---------|--------|
| Settings | Navigate to `/settings` |
| Theme toggle (☀ / ☾) | Switch dark/light mode via `ThemeContext` |
| Sign Out | Calls `supabase.auth.signOut()` and redirects to `/login` |
| Profile info | Shows full name + bar council number (when sidebar is expanded) |

---

## Shared Components & Utilities

### Form Components
| Component | Description |
|-----------|-------------|
| `FormField` | Wrapper with label, hint text, and required asterisk |
| `Input` | Styled text input |
| `Textarea` | Multi-line text area |
| `Select` | Dropdown with options array |
| `SelectionCard` | Card-style radio selector (used in draft type step) |
| `ProgressSteps` | Horizontal step indicator for wizards |
| `DateConfirmModal` | Modal to confirm/change document date before generation |

### UI Components
| Component | Description |
|-----------|-------------|
| `Button` | Primary / outline / ghost / danger / gold variants with loading state and keyboard focus ring |
| `ConfirmDialog` | Modal confirmation popup for all destructive actions |
| `DocumentPreview` | Renders generated document content with markdown support |

### Export Utilities
| Function | Output |
|----------|--------|
| `exportToPdf(content, title, profile)` | PDF with advocate letterhead + signature |
| `exportToDocx(content, title, profile)` | Editable DOCX file |

### Design Tokens
| Token | Value |
|-------|-------|
| Background | `#0E0E0E` |
| Surface | `#161616` |
| Dark surface | `#0a0a0a` |
| Foreground | `#FAF7F0` |
| Gold accent | `#C9A84C` |
| Font — Headings | Cormorant Garamond (serif) |
| Font — Labels / Mono | DM Mono (monospace) |
| Font — Body | Lora (serif) |

---

## Authentication & Security

- All advocate routes require a valid Supabase JWT, verified server-side
- Token auto-refreshes on `401` via `supabase.auth.refreshSession()`
- Service-role key bypasses RLS on the backend; all queries include `eq('user_id', req.userId)` for isolation
- Role is read from the `profiles` table (not JWT metadata) to prevent privilege escalation
- File uploads are multipart POST to Express, not directly to Supabase Storage
- Intake form submission endpoints are public (no auth) but isolated per `formId`

---

*Generated: 2026-03-19 — LexDraft v3*
