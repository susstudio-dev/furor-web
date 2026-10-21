# Admin Drafts, Approval & Preview + Mobile Shell (Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors' saves become reviewable drafts instead of direct publishes; anyone can
preview a draft on the real public site (new tab and split view); the admin works on a phone;
nobody loses work to a stray navigation.

**Architecture:** A draft is a stored op envelope plus the authorization decision **frozen at
author time**. Approval replays it through the same pipeline with an *intersection* check —
frozen author decision must still hold AND the approver must be authorized — and a *narrower*
conflict rule (only the draft's own leaves are compared, so an unrelated publish never wedges
the queue). Preview is a signed, short-TTL cookie naming one draft; `getPreviewableContent()`
overlays that draft's ops on a fresh clone for **public** renders only — admin editors and the
save pipeline keep reading published content, so editing during a preview can never launder
draft content into a real save.

**Spec:** [`2026-08-02-admin-cms-abac-design.md`](../specs/2026-08-02-admin-cms-abac-design.md)
§5.3, §6.2–6.4. Predecessors: Plans 1–2 (merged; two independent reviews, 226 tests).

## Global Constraints

- No new runtime dependencies. Pure logic gets tests; markup ships untested.
- **The preview secret and iss/aud are distinct from the session JWT's** — an admin session
  cookie replayed into `furor_preview` must not verify. TTL ≤ 15 minutes.
- **Preview never touches**: the 30s raw content cache, the version token, admin editor
  `initial` props, the save pipeline's base, or the sitemap.
- **Approve is POST-only, same-origin, and the body echoes the leaf-path set the approver was
  shown** — `sameOrigin()` passes bare top-level navigations, so a GET approve link would
  execute sight-unseen.
- A draft from a **disabled or session-bumped author is never approvable**.
- The published-only filter (`customPages[].published`) relaxes **only for records the draft's
  own ops touch** — an empty draft must not become a site-wide unpublished-content reader.
- `requiresApproval` flips ON for the Editor role **in the same commit** the save route learns
  to store drafts — never before.
- Framing: the split-view rule in next.config is gated on the `furor_preview` cookie and adds
  `Cache-Control: private, no-store` + `Vary: Cookie` + `X-Robots-Tag: noindex`; it must come
  AFTER the `/:path*` rule (later rules win per header key under OpenNext).
- Command palette: **deferred** (feasibility critique) — recorded here so it isn't re-litigated.
- Stage explicit paths; conventional commits; ledger after each task.

## Tasks

1. **Preview token (pure)** — `src/lib/preview-token.ts` + tests: `mintPreviewToken({draftId,
   uid})` / `verifyPreviewToken(token)`, HS256 via jose, secret =
   `PREVIEW_SECRET ?? JWT_SECRET + ':preview'`, iss `furor-web-preview`, aud `furor-preview`,
   exp 15m. Test: a session JWT does NOT verify as a preview token; expiry honored; tampering
   fails.
2. **Draft store + lifecycle (pure core)** — `src/lib/drafts.ts` (+`drafts-core.ts` pure,
   tested): `DraftSchema` (id server-generated, ops, leaf summary, authorId, authorSv,
   frozenDecision, baseVersion, status draft|approved|rejected, note, reviewedBy/At);
   `buildDraft(doc, subject, ops, note)` freezes `applyAndAuthorize`'s decision;
   `assessApproval(draft, currentDoc, author, approver)` → ok | author-revoked |
   author-no-longer-authorized | approver-not-authorized | conflicts(leaves) — the narrower
   conflict compares only the draft's touched leaves between base and current.
3. **Routes** — save route: `mode:'draft'` stores a draft; `!mayPublish` auto-downgrades to
   draft (201 `{draftId}`) instead of 403; **Editor.requiresApproval → true** here.
   `/api/admin/drafts`: GET list (drafts.approve capability), POST
   `{id, action:'approve'|'reject', leafPaths:[...echo...]}`. Approve re-runs
   `assessApproval` with fresh author+approver subjects, applies via the normal CAS write path,
   audits `draft_approved` with the leaf list.
4. **Preview plumbing** — `POST /api/admin/preview {draftId}` sets the cookie (author or
   `drafts.approve` holder only); DELETE clears it. `getPreviewableContent()` in content.ts:
   reads the cookie (jose verify), loads the draft via `readDraft` (never the raw cache),
   returns `{content: overlaid clone, previewing: draftId|null}`; ~15 public call sites switch
   to it (root layout + public pages); sitemap keeps `getContent`. `/p/[slug]` relaxes
   `published` only for touched record ids. next.config preview-cookie header rule.
5. **Approvals UI** — `/admin/drafts` (guard: `requireSubject`; approve buttons only render
   with the capability): list with author/date/note/leaf paths, per-draft Preview (new tab) +
   split view (`/admin/drafts/[id]/review` iframe page), approve/reject POSTing the echoed leaf
   list. Dashboard nav gains a pending-count badge.
6. **SaveBar: draft flow + never-lose-work** — surfaces the 201 draft response ("Saved as a
   draft for review — preview it here"); adds an explicit "Save as draft" secondary action for
   publishers; `beforeunload` guard keyed on `dirty` (covers all 20 editors at once);
   `useAutosave(sectionKey, value, baseVersion, restore)` wired into the three heaviest editors
   (CustomPages, About, Welcome) — subtree-only, discarded on baseVersion mismatch with an
   offer, cleared on save.
7. **Mobile shell** — drawer nav (client `AdminNav` with hamburger below lg, active-route
   highlight, 44px targets), `env(safe-area-inset-bottom)` on SaveBar, breakpoint prefixes on
   AboutPageEditor's two fixed-column grids.
8. **Docs + ledger** — SECURITY.md preview-token model; DEPLOY.md `PREVIEW_SECRET` (optional);
   record palette deferral.
