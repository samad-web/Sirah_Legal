# LexDraft — Client Portal Enhancements (vNext)

> Proposed feature upgrades to improve usability, transparency, and communication in the client portal.
> *Monetization features excluded.*

---

## Table of Contents

1. Notifications System
2. File Upload for Document Requests
3. Case Progress Tracker
4. Smart Calendar & Reminders
5. Messaging Enhancements
6. Document Enhancements
7. Client Notes
8. Feedback System
9. Intake → Dashboard Continuity
10. Security & Trust Features
11. AI Case Summary
12. Multi-Language UI
13. Offline Support
14. Activity Timeline
15. Escalation / Priority Requests
16. Multi-User Client Accounts

---

## 1. Notifications System

**Purpose:** Keep clients informed in real-time.

### Features

* Notification bell with unread count
* Dropdown panel with recent notifications
* Click → deep link to case/message/document

### Trigger Events

* New message from lawyer
* New document shared
* New document request
* Upcoming hearing reminder
* Case status change

### Data Model

```ts
{
  id: string
  user_id: string
  type: 'message' | 'document' | 'request' | 'reminder' | 'case-update'
  ref_id: string
  read_at: string | null
  created_at: string
}
```

---

## 2. File Upload for Document Requests

**Purpose:** Allow clients to directly submit requested documents.

### Features

* Upload button in each request
* Multiple file support
* File types: PDF, DOCX, JPG, PNG

### Flow

1. Lawyer creates request
2. Client uploads file(s)
3. Status updates to fulfilled (or pending approval)

### Enhancements

* Upload progress indicator
* Optional client comments

---

## 3. Case Progress Tracker

**Purpose:** Simplify legal progress for non-legal users.

### UI Example

```
[✔] Case Created → [✔] Filed → [●] Hearing → [ ] Order → [ ] Closed
```

### Benefits

* Reduces confusion
* Improves transparency
* Gives clear expectations

---

## 4. Smart Calendar & Reminders

**Purpose:** Ensure clients never miss important dates.

### Features

* Add to Google / Outlook Calendar
* Reminder notifications:

  * 1 day before
  * Same day

### Enhancements

* Highlight upcoming events
* Optional email reminders

---

## 5. Messaging Enhancements

**Purpose:** Improve communication experience.

### Features

* File attachments in chat
* Typing indicator
* Read receipts (✓✓)
* Message status (sent / delivered / failed)

### Optional

* Voice messages (future)

---

## 6. Document Enhancements

### A. Acknowledge Document

* “I have reviewed this document” button

### B. Version Comparison

* Highlight differences between versions

### C. Download Tracking

* Track timestamp and version accessed

---

## 7. Client Notes

**Purpose:** Personal note-taking for clients.

### Features

* Add/edit/delete notes
* Private by default
* Optional share with lawyer

---

## 8. Feedback System

**Purpose:** Collect client feedback.

### Trigger Points

* After document delivery
* After case closure

### Features

* Rating (1–5 stars)
* Optional feedback text

---

## 9. Intake → Dashboard Continuity

**Purpose:** Smooth onboarding experience.

### Flow

1. Client submits intake form
2. Case is created automatically
3. Client sees case on first login

### Enhancements

* Display submitted intake responses
* Auto-notify client

---

## 10. Security & Trust Features

**Purpose:** Increase transparency and trust.

### Features

* Last accessed document timestamp
* Optional device/IP logging
* Watermark on downloads:

  * Client name
  * Timestamp

---

## 11. AI Case Summary

**Purpose:** Simplify legal complexity.

### Feature

* “View Case Summary” button

### Output

* Case overview
* Current status
* Next steps

---

## 12. Multi-Language UI

**Purpose:** Improve accessibility.

### Features

* Language switcher
* Translate UI elements:

  * Labels
  * Buttons
  * Messages

---

## 13. Offline / Low Network Support

**Purpose:** Improve reliability.

### Features

* Cache last opened documents
* Retry failed messages
* Queue uploads

---

## 14. Activity Timeline

**Purpose:** Show simplified case activity.

### Example

```
Mar 18 — Lawyer shared “NDA Draft”
Mar 17 — You uploaded “ID Proof”
```

### Features

* Chronological activity list
* Filter by type

---

## 15. Escalation / Priority Requests

**Purpose:** Allow urgency signaling.

### Features

* “Mark as urgent” button
* Notification sent to lawyer
* Visual priority indicator

---

## 16. Multi-User Client Accounts (Advanced)

**Purpose:** Support organizations.

### Features

* Multiple users per client account
* Role-based access:

  * Viewer
  * Approver

---

## Summary

### Current State

* Read-only + communication portal

### Target State

* Interactive, transparent, client-friendly system

### Key Goals

* Reduce client confusion
* Improve communication
* Increase engagement
* Build trust

---

