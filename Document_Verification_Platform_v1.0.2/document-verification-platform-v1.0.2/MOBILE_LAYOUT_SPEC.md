# MOBILE_LAYOUT_SPEC.md

## Document Verification Platform --- Mobile Responsive Specification

**Version:** 0.1\
**Target:** Smartphone portrait and landscape, with tablet adaptation\
**Visual identity:** Silver/white surfaces, graphite navigation, blue
primary actions\
**Theme:** Light and Dark

------------------------------------------------------------------------

## 1. Mobile Design Principles

1.  Keep the same visual identity as desktop; do not create a separate
    mobile brand.
2.  Prioritize the user's next action over decorative summary cards.
3.  Use one primary content column.
4.  Keep form labels visible; do not rely on placeholders.
5.  Replace dense tables with readable cards or controlled horizontal
    scrolling.
6.  Keep touch targets at least 44 × 44 px.
7.  Respect safe areas and avoid fixed controls covering content.
8.  Support Light, Dark, and System theme preference.
9.  Preserve status text and icons; never use color alone.
10. Make file upload possible through a visible file-picker button;
    drag-and-drop is desktop enhancement only.

## 2. Global Mobile Shell

### Header

-   Target height: 56 px.
-   Left: brand mark or page/back control.
-   Center: current page context where space allows.
-   Right: notification/account action.
-   Search moves into a dedicated search control or page-level field.

### User bottom navigation

Recommended items: - Overview. - My Documents. - Submit. - Verify. -
Profile.

Use icons plus short labels. Keep Submit visually prominent but not so
large that it dominates navigation.

### Admin navigation

Use a compact header and either: - bottom navigation for Overview,
Review Queue, Review History, More; or - a drawer opened from the
header.

User Management and System Settings belong under More and only appear
when permission allows.

### Content

-   Horizontal padding: 16 px.
-   Vertical section gap: 20--24 px.
-   Full-width primary buttons where useful.
-   Avoid two-column form layouts on phones.
-   Use sticky action bars only where they do not obscure document
    content or keyboard focus.

## 3. User Mobile Screens

### U-M01 --- Dashboard Overview

``` text
┌─────────────────────────────┐
│ ☰  Document Platform   🔔   │
├─────────────────────────────┤
│ Overview                    │
│ Kelola dokumen Anda         │
│                             │
│ [ + Submit Document ]       │
│                             │
│ ┌───────────┬─────────────┐ │
│ │ Pending 2 │ Approved 8  │ │
│ ├───────────┼─────────────┤ │
│ │ Revision1 │ Rejected 1  │ │
│ └───────────┴─────────────┘ │
│                             │
│ Recent Documents            │
│ ┌─────────────────────────┐ │
│ │ Sertifikat Pelatihan    │ │
│ │ 15 Jan 2026  [Approved] │ │
│ │                   View  │ │
│ └─────────────────────────┘ │
│                             │
│ Quick Verify                │
│ [ Verify by Code ]          │
│ [ Upload PDF ]              │
├─────────────────────────────┤
│ Home Docs Submit Verify Me  │
└─────────────────────────────┘
```

Rules: - Do not show desktop analytics chart unless there is a clear
mobile-friendly presentation. - Show only a few recent documents with a
`View all` link. - The primary action must remain visible without
excessive scrolling.

### U-M02 --- My Documents

``` text
┌─────────────────────────────┐
│ ← My Documents              │
│ [ + Submit New Document ]   │
│                             │
│ [Search documents...]       │
│ [Status ▾] [Category ▾]     │
│                             │
│ ┌─────────────────────────┐ │
│ │ Ijazah Sarjana          │ │
│ │ Ijazah · 12 Jan 2026    │ │
│ │ [Approved]        View  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Sertifikat Pelatihan    │ │
│ │ Sertifikat · 11 Jan     │ │
│ │ [Pending Review]  View  │ │
│ └─────────────────────────┘ │
│                             │
│ [Load more / Pagination]    │
├─────────────────────────────┤
│ Home Docs Submit Verify Me  │
└─────────────────────────────┘
```

Rules: - Cards show title, category, date, status, and View action. -
Search and filters can open a filter sheet. - Only owner documents are
returned.

### U-M03 --- Submit Document

``` text
┌─────────────────────────────┐
│ ← Submit Document           │
│ Upload PDF untuk review     │
│                             │
│ Upload PDF *                │
│ ┌─────────────────────────┐ │
│ │        ↑ Upload         │ │
│ │     Choose PDF file     │ │
│ └─────────────────────────┘ │
│ Selected file.pdf           │
│ [Replace] [Remove]          │
│                             │
│ Nama dokumen *              │
│ [_________________________] │
│ Kategori *                  │
│ [Select category         ▾] │
│ Jenis dokumen *             │
│ [Only when Other selected]  │
│ Tanggal dokumen (Optional)  │
│ [_________________________] │
│ Instansi (Optional)         │
│ [_________________________] │
│ Deskripsi (Optional)        │
│ [_________________________] │
│                             │
│ [ ] Setuju dengan kebijakan │
│                             │
│ [ Ajukan Dokumen ]          │
├─────────────────────────────┤
│ Home Docs Submit Verify Me  │
└─────────────────────────────┘
```

Rules: - Single-column form. - Do not include document number. - Date
and institution are optional. - `Jenis dokumen` appears only for
`Lainnya`. - No fixed max file size until approved. - Consent checkbox
is unchecked by default. - Use exact consent wording from the approved
upload specification. - Show file validation and submission errors
beside the relevant field. - Button uses full width where practical.

### U-M04 --- Document Detail

``` text
┌─────────────────────────────┐
│ ← Document Detail           │
│ Sertifikat Pelatihan        │
│ [Approved]                  │
│                             │
│ ┌─────────────────────────┐ │
│ │ PDF preview / thumbnail │ │
│ └─────────────────────────┘ │
│                             │
│ Document Information       │
│ Category: Sertifikat       │
│ Submitted: 15 Jan 2026     │
│ Approved: 16 Jan 2026      │
│                             │
│ Verification Code           │
│ DOC-2026-000156 [Copy]      │
│                             │
│ QR Code                     │
│       [ QR image ]          │
│ [Download QR]               │
│                             │
│ Hash (SHA-256) [Copy]       │
│ Activity / Review History  │
└─────────────────────────────┘
```

Rules: - Show QR/code only when approved. - Keep hash in a collapsible
details section if it is too long. - Revoked status must be explicit.

### U-M05 --- Verify Document

``` text
┌─────────────────────────────┐
│ ← Verify Document           │
│ Pilih metode verifikasi     │
│                             │
│ [QR] [Code] [Upload PDF]    │
│                             │
│ QR method                   │
│ ┌─────────────────────────┐ │
│ │     Camera / QR area    │ │
│ └─────────────────────────┘ │
│ [Use Camera]                │
│ [Upload QR Image]           │
│                             │
│ [ Verify Document ]         │
│                             │
│ Result appears below        │
└─────────────────────────────┘
```

Rules: - Method tabs must be reachable and clear. - Code mode displays
one code input and a submit action. - PDF mode displays PDF picker,
upload progress, and match result. - Do not show another user's
record. - Do not label a hash match as proof of authenticity.

### U-M06 --- Profile & Settings

-   Use grouped sections or accordions.
-   Profile information first.
-   Security and password actions next.
-   Notification preferences.
-   Theme control.
-   Avoid a dense desktop-style multi-column settings page.

## 4. Admin Mobile Screens

### A-M01 --- Admin Overview

-   Compact status metrics in a two-column grid.
-   Show Pending Review prominently.
-   Recent queue entries appear as compact cards.
-   Charts may be simplified or omitted on narrow screens.
-   Quick action opens Review Queue.

### A-M02 --- Review Queue

``` text
┌─────────────────────────────┐
│ ☰ Admin · Review Queue      │
│ [Pending] [Revision] [All]  │
│ [Search submissions...]    │
│ [Filters ▾]                 │
│                             │
│ ┌─────────────────────────┐ │
│ │ Sertifikat Pelatihan    │ │
│ │ Andi Pratama            │ │
│ │ 15 Jan · Waiting 2h     │ │
│ │ [Pending Review]        │ │
│ │ [Review Document]       │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Transkrip Nilai         │ │
│ │ Siti Aminah             │ │
│ │ 15 Jan · Waiting 4h     │ │
│ │ [Pending Review]        │ │
│ │ [Review Document]       │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Rules: - Use card list rather than dense table. - Filter options open a
bottom sheet. - Default order is oldest pending submission first unless
an approved priority policy exists. - Review action is clear and
accessible.

### A-M03 --- Review Detail

Recommended mobile order: 1. Page title and submission ID. 2. Document
metadata. 3. PDF preview. 4. Four-part checklist. 5. Reviewer note. 6.
Decision actions.

Decision action area: - Request Revision. - Reject. - Approve.

Rules: - Sticky action bar may be used only if it does not cover the
checklist, note, or keyboard. - Approve remains disabled until all
mandatory checklist criteria pass. - Revision/rejection require a
reason. - PDF viewer must allow zoom and page navigation. - Do not
approve if preview fails.

### A-M04 --- Review History

-   Search and filters open as compact controls.
-   Each history record is a card containing title, submitter, decision,
    reviewer, and date.
-   View action opens the immutable decision record.
-   Export is not shown unless explicitly authorized.

### A-M05 --- User Management

-   Use searchable user cards/list rows.
-   Show role and status.
-   Privileged actions are hidden unless the administrator has
    permission.
-   Account suspension/deletion must not be implemented until policy is
    approved.

### A-M06 --- System Settings

-   Use a section list or accordion navigation.
-   Save action appears within each relevant section or at the bottom.
-   Sensitive settings require confirmation and audit logging.
-   Secrets must never be displayed in browser-readable fields.

## 5. Tablet Adaptation

-   Sidebar may collapse to icon rail or drawer.
-   Two-column layouts may remain where width allows.
-   Review Detail may use a 60/40 split on landscape tablets.
-   Use single-column stack on portrait tablets if the PDF preview
    becomes too narrow.

## 6. Mobile Acceptance Criteria

-   [ ] All primary user tasks can be completed on a phone.
-   [ ] All primary review tasks can be completed on a phone.
-   [ ] No horizontal page overflow.
-   [ ] Inputs and buttons meet touch-target requirements.
-   [ ] PDF preview supports zoom and page navigation.
-   [ ] Sticky actions do not cover form fields or content.
-   [ ] Keyboard does not obscure focused inputs or submit controls.
-   [ ] Bottom navigation does not obscure the final form action.
-   [ ] Status labels remain readable in Light and Dark Mode.
-   [ ] Table/card lists have loading, empty, and error states.
-   [ ] File upload works without drag-and-drop.
-   [ ] User and reviewer permissions are enforced by the backend on
    mobile as well as desktop.
