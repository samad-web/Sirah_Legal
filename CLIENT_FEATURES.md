# LexDraft — Client Portal: Features & Functions

> Complete reference for all pages, features, actions, and API calls on the client side of LexDraft.

---

## Table of Contents

1. [Routing & Role Architecture](#routing--role-architecture)
2. [Layout Components](#layout-components)
3. [Client Dashboard](#1-client-dashboard--clientdashboard)
4. [Client Documents](#2-client-documents--clientdocuments)
5. [API Endpoints](#api-endpoints)
6. [Backend Routes](#backend-routes)
7. [Data Types](#data-types)
8. [Client vs Lawyer — Comparison](#client-vs-lawyer--comparison)
9. [What Clients Cannot Do](#what-clients-cannot-do)

---

## Routing & Role Architecture

### Role-Based Routing (App.tsx)
| Route | Client | Lawyer |
|-------|--------|--------|
| `/home` | Redirects to `/client/dashboard` | Redirects to `/dashboard` |
| `/client/dashboard` | ✅ Accessible | 🔄 Redirects to `/dashboard` |
| `/client/documents` | ✅ Accessible | 🔄 Redirects to `/dashboard` |
| `/dashboard` | 🚫 Blocked | ✅ Accessible |
| All `/draft/*`, `/review/*`, `/clients`, etc. | 🚫 Blocked | ✅ Accessible |

### Auth Guard — `ClientLayout`
- Checks for authenticated `user` — redirects to `/login` if missing
- Checks `role === 'client'` — redirects to `/dashboard` if advocate
- Both client routes share the same layout guard

---

## Layout Components

### ClientSidebar (`src/components/layout/ClientSidebar.tsx`)

Collapsible sidebar: **64 px** collapsed → **240 px** expanded on hover.

#### Navigation Items
| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/client/dashboard` | LayoutGrid |
| My Documents | `/client/documents` | Folder |

#### Bottom Controls
| Control | Action |
|---------|--------|
| Theme toggle (☀ / ☾) | Switch dark / light mode via `ThemeContext` |
| Sign Out | `supabase.auth.signOut()` → redirects to `/login` |
| Profile display | Shows `profile.full_name` + "CLIENT PORTAL" label (when expanded) |

### ClientLayout (`src/components/layout/ClientLayout.tsx`)
- Renders `ClientSidebar` on tablet/desktop
- **Mobile bottom navigation bar** — 2 tabs: Dashboard · Documents
- Page transitions via Framer Motion

---

## 1. Client Dashboard — `/client/dashboard`

**Purpose:** Central view for a client to see their assigned cases, case timeline, linked documents, document requests, and communicate with their advocate.

---

### Header
- Time-based greeting: *Good morning / afternoon / evening, [first name]*
- Subtitle: *"CLIENT PORTAL — Document access is restricted to your assigned cases."*

---

### Case Selector

| Scenario | Display |
|----------|---------|
| 0 cases assigned | Empty state — *"You have not been assigned to any case yet."* |
| 1 case | Single case card displayed automatically |
| 2+ cases | Dropdown — select a case to load its data |

Each case card shows:
- Case title
- Status badge (ACTIVE / CLOSED / ARCHIVED)
- Description (if set)
- Creation date

> Selecting a case triggers parallel loading of: timeline, case documents, messages, and document requests for that case.

---

### Document Requests Panel

Displayed when at least one request exists for the selected case.

| Field | Description |
|-------|-------------|
| Title | What the lawyer is requesting |
| Description | Optional detail |
| Status badge | PENDING (amber) or FULFILLED (green checkmark) |
| MARK DONE button | Shown only for PENDING requests — marks request as fulfilled |

**Actions:**
- **MARK DONE** → calls `fulfilDocumentRequest(requestId)` — updates status to `fulfilled` with a timestamp, removes the button

---

### Messaging Panel

Inline chat panel (fixed height: 320 px) for communicating with the assigned advocate.

| Element | Description |
|---------|-------------|
| Message list | Scrollable list, auto-scrolls to latest |
| Advocate messages | Left-aligned, muted background |
| Client messages (own) | Right-aligned, forest-green background |
| Sender label | Shown above each message (advocate name or role) |
| Timestamp | Shown below each message |
| Empty state | *"No messages yet. Send a message to your advocate below."* |

**Message Input:**
- Textarea at the bottom of the panel
- **Enter** to send · **Shift+Enter** for new line
- Send button disabled when input is empty
- If send fails (network error), input text is restored

**API calls per action:**
| Action | Endpoint |
|--------|----------|
| Load messages | `GET /api/client/messages/:caseId` |
| Send message | `POST /api/client/messages/:caseId` (max 10,000 chars) |

---

### Two-Column Grid (lg+ screens)

#### Left Column — Case Calendar

Full interactive calendar showing all timeline events for the selected case.

**Calendar Navigation:**
- Previous / Next month buttons
- Current month + year display

**Day Grid:**
- 7-column layout (SUN → SAT)
- Today's date highlighted in gold
- Days with events show coloured indicator dots (up to 3; "+N more" overflow)
- Clicking a day selects it and shows a detail panel below

**Event Types & Colours:**
| Type | Colour | Icon |
|------|--------|------|
| Hearing | Light blue | Gavel |
| Filing | Light green | Folder |
| Order | Yellow | FileText |
| Milestone | Gold | Flag |
| Payment | Pink | CreditCard |
| Notice | Indigo | Bell |

**Selected Day Panel:**
- Lists all events for the chosen date
- Each event shows: type badge · case name · event title · description
- "TODAY" indicator if the selected date is today's date

**API call:** `getClientCaseTimeline(caseId)` — loaded once per case selection.

---

#### Right Column — Case Documents

Table of documents linked to the selected case by the lawyer.

**Columns:** Document Name · Type (badge) · Created Date · Preview icon

**Document type badges (colour-coded):**
| Type | Badge Colour |
|------|-------------|
| notice | Light blue |
| contract | Light green |
| title-report | Amber |
| contract-review | Pink |

**Actions:**
| Action | Trigger | Effect |
|--------|---------|--------|
| Preview | Click title or eye icon | Opens preview modal, logs `'preview'` |
| View all | "VIEW ALL →" link | Navigates to `/client/documents` |

**Empty state:** *"No documents linked to this case yet."*

**API call:** `getClientCaseDocuments(caseId)` — loaded once per case selection.

---

### Document Preview Modal

Triggered by clicking any document (from calendar page or document table).

| Element | Description |
|---------|-------------|
| Header | Document type badge + title |
| Content | Full rendered document via `DocumentPreview` component |
| Close | "X" button dismisses modal |

**Access is logged automatically:** `logDocumentAccess(userId, docId, 'preview')`

---

### Loading States
| Scenario | Display |
|----------|---------|
| Initial cases load | Full-page spinner |
| Switching cases | Inner spinner within case content area |
| Messages loading | Spinner in messaging panel |

---

## 2. Client Documents — `/client/documents`

**Purpose:** Full library of all documents shared with the client across all assigned cases, with search and filtering.

---

### Header
- Title: *"My Documents"*
- Subtitle: *"{count} document(s) — showing documents assigned to your cases"*

---

### Search & Filtering

| Control | Behaviour |
|---------|-----------|
| Search box | Real-time filter on `doc.title` (case-insensitive, client-side) |
| Type filter | ALL · NOTICE · CONTRACT · TITLE REPORT · REVIEW |
| Language filter | ALL · EN · TA · HI |

Active filter buttons show a gold border + darker background.

---

### Document Table

**Columns:** Document Name · Type · Created · Language · Actions

**Hover actions per row:**
| Icon | Action |
|------|--------|
| Eye | Open preview modal → logs `'preview'` |
| Download | Export as PDF → logs `'download'` |

---

### Preview Modal

Triggered by clicking a document title or the eye icon.

| Element | Description |
|---------|-------------|
| Header | Document type badge · title |
| Export | **PDF** button → `exportToPdf()` + logs `'download'` |
| Export | **DOCX** button → `exportToDocx()` + logs `'download'` |
| Content | Full rendered document via `DocumentPreview` |
| Close | "X" button |

---

### Empty States
| Scenario | Message |
|----------|---------|
| No documents at all | File icon + *"No documents have been shared with you yet."* |
| Search returns nothing | *"No documents match your search."* |

---

### API Calls
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `getClientDocuments(userId)` | `GET /api/client/documents` | Load all client documents |
| `logDocumentAccess(userId, docId, action)` | `POST /api/client/audit` | Audit log (fire-and-forget) |

---

## API Endpoints

All calls use Bearer token auth. Token auto-refreshes on `401` via `supabase.auth.refreshSession()`.

| Function | Method + Endpoint | Returns | Notes |
|----------|-------------------|---------|-------|
| `getClientCases(userId)` | `GET /api/client/cases` | `Case[]` | All cases assigned to client |
| `getClientDocuments(userId)` | `GET /api/client/documents` | `Document[]` | Docs from all assigned cases |
| `getClientCaseTimeline(caseId)` | `GET /api/client/cases/:id/timeline` | `CaseTimelineEvent[]` | 403 if not assigned |
| `getClientCaseDocuments(caseId)` | `GET /api/client/cases/:id/documents` | `Document[]` | 403 if not assigned |
| `getClientCaseMessages(caseId)` | `GET /api/client/messages/:caseId` | `CaseMessage[]` | Includes sender profile |
| `sendClientMessage(caseId, content)` | `POST /api/client/messages/:caseId` | `CaseMessage` | Max 10,000 chars |
| `getClientDocumentRequests()` | `GET /api/client/document-requests` | `DocumentRequest[]` | Includes case info |
| `fulfilDocumentRequest(id)` | `PATCH /api/client/document-requests/:id/fulfil` | `DocumentRequest` | Sets `fulfilled_at` |
| `logDocumentAccess(userId, docId, action)` | `POST /api/client/audit` | — | Fire-and-forget |

---

## Backend Routes

All routes at `server/routes/client.ts` require **both** `requireAuth` and `requireClient` middleware.

| Method | Endpoint | Access Control | Purpose |
|--------|----------|----------------|---------|
| `GET` | `/api/client/cases` | `client_id = userId` | Fetch via `case_assignments` table |
| `GET` | `/api/client/documents` | Case assignment check | Docs from all assigned cases |
| `GET` | `/api/client/cases/:id/timeline` | Case assignment check | Timeline for one case (403 if denied) |
| `GET` | `/api/client/cases/:id/documents` | Case assignment check | Docs for one case (403 if denied) |
| `POST` | `/api/client/audit` | Auth only | Log document access |
| `GET` | `/api/client/messages/:caseId` | Case assignment check | Fetch messages |
| `POST` | `/api/client/messages/:caseId` | Case assignment check | Send message |
| `GET` | `/api/client/document-requests` | `client_id = userId` | Fetch requests |
| `PATCH` | `/api/client/document-requests/:id/fulfil` | `client_id = userId` | Mark request fulfilled |

---

## Data Types

### Case
```typescript
{
  id: string
  lawyer_id: string
  title: string
  description: string | null
  status: 'active' | 'closed' | 'archived'
  created_at: string
  updated_at: string
}
```

### Document
```typescript
{
  id: string
  user_id: string
  title: string
  type: 'notice' | 'contract' | 'title-report' | 'contract-review'
  language: string        // 'en' | 'ta' | 'hi'
  content: string
  analysis: Record<string, unknown> | null
  status: 'draft' | 'exported' | 'shared'
  created_at: string
  updated_at: string
}
```

### CaseTimelineEvent
```typescript
{
  id: string
  case_id: string
  lawyer_id: string
  title: string
  description: string | null
  event_date: string      // YYYY-MM-DD
  event_type: 'hearing' | 'filing' | 'order' | 'milestone' | 'payment' | 'notice'
  created_at: string
}
```

### CaseMessage
```typescript
{
  id: string
  case_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: {
    id: string
    full_name: string | null
    role: string
  }
}
```

### DocumentRequest
```typescript
{
  id: string
  case_id: string
  lawyer_id: string
  client_id: string
  title: string
  description: string | null
  status: 'pending' | 'fulfilled' | 'cancelled'
  created_at: string
  fulfilled_at: string | null
  client?: { id: string; full_name: string | null }
  case?: { id: string; title: string }
}
```

---

## Client vs Lawyer — Comparison

| Feature | Client | Lawyer |
|---------|--------|--------|
| **Pages** | 2 (Dashboard, Documents) | 13+ pages |
| **Sidebar items** | 2 (Dashboard, Documents) | 12 navigation items |
| **Cases** | Read-only, view assigned cases only | Create, edit, delete, manage all cases |
| **Documents** | View & download only (shared by lawyer) | Create, edit, share, delete |
| **Calendar** | View timeline events for assigned cases | View events across all cases |
| **Messages** | Message own advocate only | Message any assigned client |
| **Document Requests** | View requests, mark as fulfilled | Create requests, assign to clients |
| **Audit Logs** | No access | View full audit trail per case |
| **AI Generation** | ❌ Not available | ✅ Notice, Contract, Title Report, Review |
| **Clause Library** | ❌ Not available | ✅ Full create/edit/search |
| **Stamp Duty Calc** | ❌ Not available | ✅ Available |
| **eCourts Lookup** | ❌ Not available | ✅ Available |
| **Settings** | ❌ No settings page | ✅ Profile, uploads, intake forms, plan |
| **Client Management** | ❌ Not available | ✅ Full client & case management |

---

## What Clients Cannot Do

- Create, edit, or delete any documents
- Create or manage cases
- Create or modify timeline events
- Create document requests (lawyer initiates)
- Access audit logs or case history
- View cases they are not assigned to
- View documents from cases they are not assigned to
- Access another client's data (enforced server-side via `client_id` checks)
- Use AI drafting tools (notice, contract, title report, review)
- Access settings, profile management, or plan upgrades
- View the lawyer sidebar or any lawyer-only route

---

## State Overview

### Client Dashboard State
| State Variable | Type | Purpose |
|----------------|------|---------|
| `cases` | `Case[]` | All cases assigned to this client |
| `selectedCase` | `Case \| null` | Currently active case |
| `timeline` | `CaseTimelineEvent[]` | Events for selected case |
| `caseDocs` | `Document[]` | Documents for selected case |
| `messages` | `CaseMessage[]` | Chat for selected case |
| `docRequests` | `DocumentRequest[]` | Pending/fulfilled requests |
| `loading` | `boolean` | Initial cases loading |
| `loadingCase` | `boolean` | Per-case data loading |
| `previewDoc` | `Document \| null` | Preview modal state |
| `msgInput` | `string` | Message compose field |
| `calendarDate` | `Date` | Month shown in calendar |
| `selectedCalDate` | `string \| null` | Selected day for event panel |

### Client Documents State
| State Variable | Type | Purpose |
|----------------|------|---------|
| `documents` | `Document[]` | All documents across all cases |
| `loading` | `boolean` | Fetch in progress |
| `search` | `string` | Search input value |
| `filterType` | `FilterType` | Active type filter |
| `filterLang` | `FilterLang` | Active language filter |
| `previewDoc` | `Document \| null` | Preview modal state |

---

*Generated: 2026-03-19 — LexDraft v3*
