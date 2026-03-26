# LexDraft by Sirah Legal — Product Guide

> AI-powered legal document automation platform built for Indian advocates and their clients.

---

## Table of Contents

1. [Overview](#overview)
2. [Subscription Plans](#subscription-plans)
3. [User Roles](#user-roles)
4. [Advocate Features](#advocate-features)
5. [Client Portal Features](#client-portal-features)
6. [AI Document Generation](#ai-document-generation)
7. [Public Features](#public-features)
8. [Authentication & Security](#authentication--security)
9. [Design System](#design-system)
10. [Tech Stack](#tech-stack)

---

## Overview

LexDraft is a fullstack legal technology platform that helps Indian advocates draft legal documents, manage cases, collaborate with clients, and streamline their practice — all powered by AI.

**Core value proposition:**
- Generate legally compliant notices, contracts, and title reports in minutes
- AI-powered contract risk analysis with structured risk scoring
- Secure client portal for document sharing, messaging, and case tracking
- Multi-language support: English, Tamil, Hindi

---

## Subscription Plans

| Feature | Free | Solo (₹999/mo) | Firm (₹3,999/mo) |
|---------|------|-----------------|-------------------|
| AI document generation | 5 docs/month | 50 docs/month | Unlimited |
| Document types | All 4 types | All 4 types | All 4 types |
| Multi-language output | EN, TA, HI | EN, TA, HI | EN, TA, HI |
| Case management | Yes | Yes | Yes |
| Client portal | Yes | Yes | Yes |
| Clause library | Yes | Yes | Yes |
| Stamp duty calculator | Yes | Yes | Yes |
| eCourts case lookup | Yes | Yes | Yes |
| Document versioning | Yes | Yes | Yes |
| Letterhead & signature | Yes | Yes | Yes |
| PDF & DOCX export | Yes | Yes | Yes |
| Intake forms | Yes | Yes | Yes |

**Rate limits:** All plans share a 10-generation-per-15-minute rate limit to ensure system stability.

---

## User Roles

LexDraft supports two distinct user roles with separate interfaces and permissions:

### Advocate (Lawyer)
- Full access to all 13+ platform pages
- Can generate documents, manage cases, create client accounts
- Sidebar with 12 navigation items + settings

### Client
- Restricted portal with 2 pages (Dashboard, Documents)
- Can view assigned case documents, message advocate, fulfil document requests
- Read-only access to case timeline and calendar
- Account created by their advocate — cannot self-register

---

## Advocate Features

### 1. Dashboard (`/dashboard`)

The main landing page after login.

**What you see:**
- Personalised greeting (Good morning/afternoon/evening, [Name])
- Profile summary: Bar Council number, firm name
- Current plan badge with monthly usage progress bar (e.g., "3 / 5 documents used")
- Alert banner for documents expiring within 30 days
- Recent documents table (last 10)
- Quick action cards for all 4 document types

**User scenario:**
> Advocate Priya logs in at 9 AM. Her dashboard shows she's on the Free plan with 2/5 documents used this month. She sees a recent contract she drafted yesterday and clicks "Draft Notice" to start a new money recovery notice.

---

### 2. Draft Legal Notice (`/draft/notice`)

AI-powered legal notice generator compliant with the Code of Civil Procedure, 1908.

**6 Notice Types:**
1. Legal Notice — Money Recovery
2. Legal Notice — Property Dispute
3. Legal Notice — Service Deficiency
4. Legal Notice — Employment Matter
5. Demand Letter
6. Rejoinder / Reply to Notice

**4-Step Wizard:**

| Step | What you fill in |
|------|------------------|
| 1. Document Type | Select one of the 6 notice types |
| 2. Party Details | Client name & address, advocate name & bar number (pre-filled), recipient name & address |
| 3. Matter Details | Facts of the matter, relief sought, compliance deadline (days), governing state, relevant act (auto-suggested) |
| 4. Preferences | Output language(s): EN/TA/HI (multi-select), tone: Professional / Firm / Urgent |

**Generation flow:**
1. Click **GENERATE** — a date confirmation modal appears
2. Confirm or adjust the notice date
3. Document streams in real-time on the right panel (SSE streaming)
4. One document is generated per selected language
5. Each document is auto-saved to your library

**Export options:** Download as PDF (with your letterhead & signature) or DOCX (editable Word file)

**User scenario:**
> Advocate Ravi needs to send a money recovery notice. He selects "Money Recovery", fills in his client's details and the debtor's address, describes the unpaid invoice in "Facts", requests payment within 15 days, and generates in English and Tamil. Both versions appear in his library instantly.

---

### 3. Draft Contract (`/draft/contract`)

AI-powered contract drafting for 5 common agreement types under the Indian Contract Act, 1872.

**5 Contract Types:**
1. NDA (Mutual / One-way)
2. Employment Agreement
3. Vendor / Service Agreement
4. Consultancy Agreement
5. Freelance Agreement

**4-Step Wizard:**

| Step | What you fill in |
|------|------------------|
| 1. Contract Type | Select one of the 5 types |
| 2. Party Details | Party A & B: name, address, entity type (Individual/Pvt Ltd/LLP/Partnership), signatory name |
| 3. Contract Terms | Terms specific to the selected type (see below) |
| 4. Jurisdiction | Governing state, dispute resolution (Arbitration/Litigation/Mediation), arbitration seat, output language(s) |

**Type-specific terms:**

- **NDA:** Purpose of disclosure, duration (months), confidential info definition, exclusions, return of materials (toggle), non-compete clause (toggle + duration)
- **Employment:** Designation, department, CTC (annual), probation period, notice period, non-solicitation (toggle)
- **Vendor/Service:** Scope of services, payment terms, warranty period, IP ownership
- **Consultancy/Freelance:** Engagement terms, deliverables, compensation structure

**User scenario:**
> A startup founder needs an NDA before sharing their idea with a potential partner. Advocate Meena selects "NDA", fills in both parties, sets a 24-month duration with a non-compete clause, chooses Arbitration in Chennai, and generates the document in English.

---

### 4. Review Contract (`/review/contract`)

AI-powered contract risk analysis that evaluates an uploaded contract from a specific party's perspective.

**Workflow:**

| Step | Action |
|------|--------|
| 1. Select Role | Choose perspective: Vendor / Employee / Client / Company |
| 2. Upload Contract | Drag-and-drop or browse — accepts .pdf, .docx, .doc, .txt, .pptx (max 10 MB) |
| 3. View Analysis | Structured risk report appears |

**Analysis output:**

| Section | Description |
|---------|-------------|
| Risk Score | 0–100 circular gauge — Green (0-30: LOW), Orange (31-60: MODERATE), Red (61-100: HIGH) |
| Risk Summary | One-sentence executive summary |
| Risk Clauses | Problematic terms with red border — original text, issue, recommendation, suggested redline |
| Missing Clauses | Important absent clauses with yellow border |
| Negotiate Clauses | Terms worth renegotiating |
| Standard Clauses | Well-drafted protective clauses with green checkmark |

Each clause card expands to show: original text, issue description, recommendation, and a suggested redline (removed text in red, added text in green).

**User scenario:**
> A client sends Advocate Kumar an employment contract from a new employer. Kumar uploads the PDF, selects "Employee" perspective, and gets a risk score of 72 (HIGH). The analysis flags a non-compete clause that's too broad and identifies 3 missing clauses (IP assignment, severance, data privacy). Kumar saves the analysis and shares it with the client.

---

### 5. Draft Title Report (`/draft/title-report`)

AI-powered property title research report generation for Indian properties.

**Form sections:**

| Section | Fields |
|---------|--------|
| Property Details | Survey/Khasra number, extent + unit (sqft/acres), village/locality, taluk/tehsil, district, state, purpose of report |
| Search Parameters | Search from year (default: current year − 30) |
| Report Details | Prepared for (client name) |
| Document Upload | Sale deeds, EC, Patta/Chitta/RTC, survey sketch, prior title deeds, other (multi-file per category) |
| Preferences | Output language(s): EN/TA/HI |

**Generated report sections:**
1. **Title Block** — Property identification
2. **Chain of Title** — Tabular: Year, Document Type, Vendor, Purchaser, SRO
3. **Encumbrances & Charges** — Mortgages, liens, pending litigation
4. **Statutory Compliance** — Patta, tax receipts, RERA status
5. **Gap Analysis** — Explicitly flags title gaps with `[GAP IN TITLE]` markers
6. **Opinion on Title** — CLEAR AND MARKETABLE / CONDITIONALLY CLEAR / DEFECTIVE
7. **Documents Reviewed** — List of all uploaded documents analysed
8. **Disclaimer** — Standard legal disclaimer

**User scenario:**
> A client wants to purchase agricultural land in Tamil Nadu. Advocate Lakshmi uploads the sale deed chain, EC, and patta documents, enters the property details (survey number, village, taluk), and generates a title report. The AI identifies a 5-year gap in the chain of title between 2005-2010 and flags the title as "CONDITIONALLY CLEAR" pending verification.

---

### 6. Documents Library (`/documents`)

Central repository for all generated and saved documents.

**Features:**
- Full-text search (server-side, debounced 350ms)
- Filter by type: Notice / Contract / Title Report / Review
- Filter by language: EN / TA / HI
- Pagination: 20 documents per page with "Load More"
- Bulk selection and bulk delete

**Per-document actions:**
- Preview — opens a rendered preview modal
- Version History — view all saved snapshots with timestamps and character counts
- Download PDF — exports with letterhead and signature
- Delete — with confirmation dialog

**Version History:**
Documents are auto-versioned whenever content changes after editing. You can view any previous version in full, with each version showing its version number, creation timestamp, and character count.

---

### 7. Calendar (`/calendar`)

Monthly calendar view of all case timeline events across all your cases.

**Features:**
- Full month grid with day-of-week headers
- Navigate between months (previous/next)
- Today highlighted with gold accent
- Up to 3 events shown per day cell; overflow as "+N more"
- Click any day to see the full event list in a detail panel

**Event types and colours:**

| Type | Colour | Icon |
|------|--------|------|
| Hearing | Light blue | Scale |
| Filing | Light green | FileText |
| Order | Yellow | Gavel |
| Milestone | Gold | Flag |
| Payment | Pink | DollarSign |
| Notice | Indigo | Bell |

---

### 8. Messages (`/messages`)

Secure per-case messaging between advocate and assigned clients.

**Layout:** Split view — case list sidebar (left) + message thread (right)

**Features:**
- Cases listed with title, status badge, and unread message count
- Real-time message thread with auto-scroll
- Your messages: right-aligned (green background)
- Client messages: left-aligned (muted background)
- Sender name, content, timestamp, and "Read" indicator on outgoing messages
- Enter to send, Shift+Enter for new line
- Mobile responsive: sidebar collapses when viewing a thread

**User scenario:**
> Client Sanjay sends a message asking about the next hearing date. Advocate Priya sees the unread badge (1) next to the case name, opens the thread, reads the message (which marks it as read), and replies with the date and preparation instructions.

---

### 9. Manage Clients (`/clients`)

Central hub for case management, client accounts, and collaboration.

**Cases panel (left):**
- Create new cases with title and description
- Each case shows title, status badge (Active/Closed), and delete option
- Click a case to load its detail panel

**Case detail panel (right) — 6 tabs:**

| Tab | Features |
|-----|----------|
| **Clients** | Assign/remove client accounts to the case |
| **Documents** | Link/unlink documents from your library to the case |
| **Notes** | Create, edit, delete private case notes |
| **Requests** | Create document requests for clients; mark as fulfilled when received |
| **Audit** | Read-only log of all client document access (preview, download, view) with timestamps |
| **History** | Timeline of case status changes (date, old status -> new status) |

**Client account management:**
- **Create client** — Enter email + name; system generates a temporary password
- **Credentials modal** — Displays email and temporary password for you to share with the client
- **Reset password** — Sends a password reset email to the client

**User scenario:**
> Advocate Kumar creates a new case "Property Dispute — Rajesh vs. Sharma". He creates a client account for Rajesh (rajesh@email.com), shares the login credentials, assigns Rajesh to the case, links the relevant property title report and legal notice, and creates a document request asking Rajesh to upload the original sale deed. Rajesh logs into the client portal, views the documents, and marks the request as fulfilled.

---

### 10. Clause Library (`/clauses`)

Reusable legal text snippets with category and tag support.

**Categories:** Contract, Notice, Property, Employment, Arbitration, Family, Criminal, General

**Per clause:**
- Title, content, category badge, tags
- One-click copy to clipboard (shows "COPIED" flash for 2 seconds)
- Edit and delete with confirmation

**User scenario:**
> Advocate Meena frequently uses an arbitration clause referencing the Arbitration and Conciliation Act, 1996. She saves it to her clause library tagged as "arbitration, dispute resolution". When drafting the next contract, she searches "arbitration", copies the clause, and pastes it into her document.

---

### 11. Stamp Duty Calculator (`/stamp-duty`)

Instant stamp duty and registration fee calculation for Indian property transactions.

**Inputs:**
- State (all Indian states supported)
- Deed type: Sale / Gift / Lease / Mortgage / Power of Attorney / Partition
- Transaction value (₹)

**Output:**
- Stamp duty amount (percentage-based or flat for POA)
- Registration fee
- Total payable (prominently displayed)
- Disclaimer: *"Approximate rates — verify with local Sub-Registrar Office"*

**Supported states with specific rates:** Tamil Nadu, Maharashtra, Delhi, Karnataka, Gujarat, Uttar Pradesh, West Bengal, Kerala, Andhra Pradesh, Telangana (+ fallback rates for other states)

*Note: Entirely client-side calculation — no API calls, works offline.*

---

### 12. eCourts Case Status (`/ecourts`)

Look up Indian court case status via CNR number or case details.

**Search options:**
- **Option A — CNR Number** (recommended): e.g., `MHNS010012342024`
- **Option B — Case Number**: Case number + state + court number + year

**Results display:**

| Section | Information shown |
|---------|-------------------|
| Case Identity | CNR, case type, filing number, filing date, registration, status |
| Parties | Petitioner, respondent, court number, judge |
| Next Hearing | Date (highlighted in gold), purpose |
| Acts & Sections | Badge list of applicable laws |
| Case History | Table: date, purpose, judge |
| Notes | Warning/info notes from the eCourts system |

---

### 13. Settings (`/settings`)

Profile management, file uploads, intake forms, and plan information.

**Profile information:**
- Full name, bar council enrollment number (e.g., TN/1234/2020)
- State bar council (dropdown), firm/chamber name
- Office address (used in document headers)

**File uploads:**

| Upload | Formats | Max Size | Purpose |
|--------|---------|----------|---------|
| Letterhead | PNG, JPG, PDF | 5 MB | Printed at the top of PDF exports |
| Signature | PNG, JPG | 5 MB | Printed at the bottom of PDF exports |

Both support drag-and-drop, preview thumbnails, optional image cropping, and deletion.

**Preferences:**
- Default output language (EN/TA/HI)
- Default governing state
- Default dispute resolution method (Arbitration / Litigation / Mediation First)
- Email notifications toggle

**Intake Form Builder:**
- Create custom intake forms with dynamic fields
- Field types: text, email, tel, number, date, textarea
- Mark fields as required
- Get a shareable public link for each form
- View all submissions with respondent data

**Plan & usage:**
- Current plan badge with upgrade options
- Visual usage bar showing documents used vs. monthly limit

---

## Client Portal Features

The client portal is a simplified, read-only interface designed for clients to stay informed about their case.

### 1. Client Dashboard (`/client/dashboard`)

**Header:** Personalised greeting + "CLIENT PORTAL — Document access is restricted to your assigned cases."

**Case selector:**
- 0 cases: Empty state — "You have not been assigned to any case yet."
- 1 case: Automatically displayed
- 2+ cases: Dropdown to switch between cases

**Each case shows:**

| Section | Features |
|---------|----------|
| **Case Info** | Title, status badge (Active/Closed/Archived), description, creation date |
| **Document Requests** | Pending requests from advocate with title, description, status badge, and "Mark Done" button |
| **Messaging** | Inline chat panel (320px height) — send/receive messages with advocate in real-time |
| **Case Calendar** | Interactive monthly calendar showing timeline events (hearings, filings, orders) with colour-coded dots |
| **Case Documents** | Table of documents linked by advocate — name, type badge, created date, preview icon |

**User scenario:**
> Client Rajesh logs in and sees his case "Property Dispute vs. Sharma" is active. He notices a document request from his advocate asking for the original sale deed. He also sees a new message from the advocate explaining the next steps. Rajesh reads the message, replies with a question about the hearing date, then views the linked title report by clicking preview. He marks the document request as fulfilled after uploading the deed separately.

---

### 2. Client Documents (`/client/documents`)

Full library of all documents shared across all assigned cases.

**Features:**
- Real-time search (client-side, filters on document title)
- Filter by type: Notice / Contract / Title Report / Review
- Filter by language: EN / TA / HI
- Preview modal with full document rendering
- Export as PDF or DOCX from the preview modal
- All document access (preview, download) is automatically logged for the advocate's audit trail

---

### Feature Comparison: Advocate vs. Client

| Feature | Advocate | Client |
|---------|----------|--------|
| Pages available | 13+ | 2 |
| Sidebar items | 12 | 2 |
| AI document generation | Yes | No |
| Case management | Full CRUD | View assigned only |
| Documents | Create, edit, share, delete | View & download shared only |
| Calendar | All cases | Assigned cases only |
| Messaging | Message any assigned client | Message own advocate only |
| Document requests | Create & manage | View & fulfil |
| Audit logs | View full trail | No access (auto-logged) |
| Clause library | Full CRUD | No access |
| Stamp duty calculator | Yes | No access |
| eCourts lookup | Yes | No access |
| Settings & profile | Full control | No access |
| Client management | Create & manage accounts | N/A |

---

## AI Document Generation

### Technology
- **Model:** OpenAI `gpt-4o-mini`
- **Delivery:** Server-Sent Events (SSE) for real-time streaming
- **Languages:** English (EN), Tamil (TA), Hindi (HI) — selectable per document

### Generation Pipeline

```
User fills wizard → Clicks GENERATE → Date confirmation modal
       ↓
Frontend sends POST /api/generate with payload
       ↓
Server validates quota (plan limit check)
       ↓
Server constructs system prompt + user prompt
       ↓
OpenAI API call with streaming enabled
       ↓
Chunks streamed back to frontend via SSE
       ↓
Document rendered in real-time in preview panel
       ↓
Auto-saved to document library + quota counter incremented
```

### Document Type Capabilities

| Type | Streaming | Output Format | Input Method |
|------|-----------|---------------|-------------|
| Legal Notice | Yes (SSE) | Formatted text | 4-step wizard |
| Contract | Yes (SSE) | Formatted text | 4-step wizard |
| Title Report | Yes (SSE) | Structured report | Form + file upload |
| Contract Review | No (JSON) | Structured JSON → rendered UI | File upload |

### AI Safety Guardrails
- No fabricated case citations — uses `[CITATION]` placeholders
- No fabricated registration numbers — uses `[TO BE VERIFIED]` placeholders
- Input sanitisation: strips HTML tags, markdown code fences, caps at 100,000 characters
- 90-second timeout on streaming requests
- Rate limited: 10 generations per 15 minutes per user

---

## Public Features

### Intake Form (`/intake/:formId`)

A public, unauthenticated page for collecting client information before onboarding.

**How it works:**
1. Advocate creates a custom intake form in Settings (defines fields, types, required status)
2. Advocate copies the shareable link and sends it to the prospective client
3. Client opens the link — no login required
4. Client fills in the form (email + custom fields) and submits
5. Advocate views all submissions in Settings under the form's expansion panel

**Security:** Rate-limited to prevent spam. No authentication required by design.

---

## Authentication & Security

### Authentication Methods
- **Email + Password** — Standard registration and login
- **Google OAuth** — One-click Google sign-in
- **Client accounts** — Created by advocates with temporary passwords; clients can reset via email

### Security Architecture

| Layer | Implementation |
|-------|---------------|
| JWT verification | Server-side via Supabase Auth — every API request verified |
| Role enforcement | `requireLawyer` / `requireClient` middleware on all protected routes |
| User isolation | All database queries filtered by `user_id` / `lawyer_id` / `client_id` |
| Row-Level Security | Supabase RLS policies on all tables |
| Rate limiting | Global (300/15min) + per-endpoint limits |
| CORS | Strict origin validation in production |
| Input validation | Zod schema validation on all API inputs |
| File uploads | Server-side processing with size limits (5 MB) |
| Service role key | Server-only, never exposed to frontend |

### Token Flow
1. User logs in → Supabase returns JWT access token + refresh token
2. Frontend stores session in localStorage (key: `sirah-legal-auth`)
3. Every API call includes `Authorization: Bearer <token>` header
4. Server verifies JWT locally (HS256) or via Supabase Auth API fallback
5. On 401, frontend auto-refreshes the token and retries

---

## Design System

### Theme

| Element | Value |
|---------|-------|
| Background | `#0E0E0E` / `#0a0a0a` |
| Surface | `#161616` |
| Foreground | `#FAF7F0` |
| Gold accent | `#C9A84C` |
| Success | Green tones |
| Error | Red tones |

### Typography

| Usage | Font |
|-------|------|
| Headings | Cormorant Garamond (serif) |
| Body text | Lora (serif) |
| Labels & mono | DM Mono (monospace) |

### Document Type Colour Coding

| Type | Colour |
|------|--------|
| Notice | Light blue `#93c5fd` |
| Contract | Light green `#86efac` |
| Title Report | Amber `#fbbf24` |
| Contract Review | Pink `#f9a8d4` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (email/password + Google OAuth) |
| AI | OpenAI `gpt-4o-mini` |
| File storage | Supabase Storage |
| PDF export | Client-side PDF generation |
| DOCX export | Client-side DOCX generation |

### Development

```bash
npm run dev          # Vite frontend only (port 5173)
npm run dev:server   # Express server only (port 3001)
npm run dev:all      # Both concurrently (recommended)
```

Vite proxies `/api` requests to `http://localhost:3001` in development.

---

*Built by Sirah Legal. Powered by AI. Designed for Indian advocates.*
