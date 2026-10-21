# Admin platform: CMS, theming, campaigns and ABAC — design

**Date:** 2026-08-02
**Branch:** cloudflare-migration
**Goal:** turn `/admin` from a single-owner content form into a multi-user studio CMS — real
users and roles with attribute-based authorization enforced server-side, a draft→approve
pipeline with preview, a media library, admin-editable brand colours, scheduled promo
campaigns, and an admin shell that works on a phone.

Scope decision (user, 2026-08-02): **one release**, all subsystems together. Runtime
dependencies: **none added** (dev dependency `vitest` is added for pure-logic tests).

---

## 1. Context — verified, not assumed

Everything in this section was verified against the tree or the platform docs on 2026-08-02.

### 1.1 What exists today

- **One content document.** `site-content.json` in R2 (filesystem under `data/` in dev),
  validated by `SiteContentSchema` ([content-schema.ts:524](../../../src/lib/content-schema.ts#L524)).
- **One read funnel.** `getContent()` ([content.ts:59](../../../src/lib/content.ts#L59)) —
  54 call sites in 30 files, wrapped in React `cache()` (per-request memo) over a
  module-level 30 s raw-string cache (per-isolate, production only).
- **One write funnel.** `saveContent()` / `restoreVersion()`
  ([content-write.ts:34](../../../src/lib/content-write.ts#L34)) reached only from
  `POST /api/admin/save` and `POST /api/admin/restore`. No server actions anywhere in `src/`.
- **Every editor POSTs the whole document.** 18 of 20 screens hold
  `useState<SiteContent>(initial)` and send the complete document; `/admin/json` posts a
  parsed textarea. The "slice" an editor owns exists only inside its local `patch*()` closure.
- **Every admin page also *receives* the whole document** as an `initial` prop, so the full
  content doc is in the RSC payload of every admin screen.
- **Authorization is cosmetic.** `ownerOnly` filters sidebar links
  ([admin/layout.tsx:69](../../../src/app/admin/layout.tsx#L69)); exactly one mutation
  endpoint checks a role (`restore`, owner-only); `/api/admin/save` and `/api/admin/upload`
  check only that a session exists. 25 of ~27 admin pages have no server-side guard at all —
  they rely entirely on middleware, which verifies the JWT signature and nothing else.
- **Multi-user is impossible in production.** `inviteEditor()` throws when storage is remote
  and `listUsers()` synthesises a one-element roster from `ADMIN_OWNER_EMAIL`
  ([auth.ts:250-275](../../../src/lib/auth.ts#L250-L275)). `data/users.json` is fs-only and,
  because `verifyCredentials` returns early for the env owner, is never even created.
- **No concurrency control of any kind.** `SiteContent.version` is `z.literal(1)` — a *schema*
  version, never incremented. (Which is why every audit line reads literally `version 1`.)
- **Theming is CSS-variable driven** but the tokens have three different value formats and one
  hard specificity constraint — see §7.
- **Three ad-hoc promo surfaces**: `site.notice` (a bare string rendered in the root layout on
  *every* route including `/admin`), `trial` (home ribbon), `tonight` (home tile).

### 1.2 Platform facts (Cloudflare Workers free plan, verified)

| Fact | Value | Consequence for this design |
|---|---|---|
| CPU per invocation | **10 ms** | The binding I/O is free; **JSON parsing is not**. Budget by *number of parses of the 53 KB doc per request*, not by number of R2 calls. |
| R2 binding conditional writes | **Supported.** `put(key, val, { onlyIf: { etagMatches } })` returns **`null`** on precondition failure — it does not throw | This is our compare-and-swap. Test `result === null`. |
| R2 etag | exposed as `obj.etag` (unquoted) and `obj.httpEtag` (quoted) | Feed `etag` back into `onlyIf`, never `httpEtag`. Note the etag is the content MD5 for single-part puts, so byte-identical concurrent writes both succeed — benign for a lost-update guard. |
| Worker bundle | 3 MB gzip | **Measured actual: ~1.09 MB gz**, not the 1.42 MB assumed. Headroom is not the tight budget; CPU is. |
| R2 ops (free) | 1 M Class A/mo, 10 M Class B/mo | `put` **and `list`** are Class A. `delete` is free. |
| Subrequests | 1000 internal / 50 external per invocation | R2 reads are internal. Never a constraint here. |
| Requests | 100 k/day | Relevant only to per-keystroke preview rendering — see §6.4. |
| Cron Triggers | available on free, but also 10 ms CPU, and the OpenNext worker exports `fetch` only (a `scheduled()` handler needs a custom worker entrypoint) | Confirms the no-cron scheduling decision is a *choice*, and a cheap one. |
| `cookies()` under `output: 'export'` | **hard build failure** (E549). `dynamic = 'force-static'` makes it silently return an *empty* store instead | Every `cookies()` call in the public tree needs the `GH_PAGES !== 'true'` guard. `process.env.GH_PAGES` is **not** inlined by Next's DefinePlugin, so the runtime guard genuinely works. |
| Conditional segment config | `export const dynamic = cond ? … : …` is a **build failure** (`process.exit(1)`) | Use literals; the GH Pages workflow's text-append trick stays the escape hatch. |
| Framing | `next.config.mjs` sends `X-Frame-Options: DENY` **and** CSP `frame-ancestors 'none'` on `/:path*`, and OpenNext makes next.config headers win over middleware and route handlers | A preview iframe is impossible without a new next.config header rule — see §6.4. |
| Middleware + bindings | technically *possible* on OpenNext 1.20.2, but `getCloudflareContext()` throws in `next dev` here (no `initOpenNextCloudflareForDev()` in next.config.mjs) and it costs CPU on every navigation | Middleware stays authentication-only. The stated reason changed; the decision did not. |

---

## 2. What changed from the approved outline

The audit and adversarial review (9 agents; 51 findings — 13 critical, 23 high, 13 medium,
2 low) invalidated several parts of the outline approved in conversation. Material changes,
with reasons:

1. **Patches are expanded server-side into per-record leaf changes.** The outline authorized
   "the changed path". That is bypassable three ways: a patch at a *parent* path escapes every
   child-scoped rule (`{path:'instructors', value:[whole roster]}` has no "record" to bind a
   condition to), a `deny` on `theme.**` misses a write to bare `theme`, and `/admin/json`
   becomes `{path:'$', value:<entire document>}`. See §4.3.
2. **Authorization runs on both the pre- and post-patch record.** The outline's order
   (apply → validate → authorize) lets a patch rewrite its own ABAC discriminator in the same
   request: set `batches[x].branchSlug` to your own branch in patch 1, then rewrite that
   batch's `razorpayLink` to an attacker payment URL in patch 2, and the condition passes.
3. **The revision lives outside the content document.** With `rev` inside the payload,
   `restoreVersion()` rewinds it — rev numbers get reused across lineages and stale tabs/drafts
   apply cleanly to unrelated content. Now: `{lineage, rev}` in R2 `customMetadata`, CAS on the
   R2 etag, restore publishes at `currentRev + 1` with a **new lineage**.
4. **The write path may never read through `getContent()`.** The 30 s per-isolate cache
   defeats the version check outright: a stale cached read makes `baseVersion` *match* and the
   save silently clobbers. The pipeline reads bytes **and** etag from one uncached `bucket.get()`.
5. **Custom role authoring is deferred.** Roles ship as a frozen constant in `src/lib/roles.ts`;
   the Users screen assigns roles + attributes. A glob-DSL role editor is ~5 extra screens, a
   policy store with its own authorization, and a privilege-amplification surface, for a team of
   three. The evaluator stays data-driven so custom roles remain purely additive later.
6. **Read access is all-or-nothing and documented as such.** Write grants are per-path; *reads*
   are not filtered. Every admin page ships the whole document in its RSC payload today, and
   four editors derive their dropdowns from slices they never write. Pretending otherwise would
   be security theatre. Nav is filtered by write grants for *usability*, not confidentiality.
7. **Theme CSS is derived once at save time**, not per request. Per-request OKLCH conversion +
   ramp derivation + a contrast loop on the public render path, on top of the 53 KB parse
   already there, spends the 10 ms budget for no benefit.
8. **Contrast is corrected on an explicit click, not silently.** Auto-nudging means the owner
   does not get the colour they picked and is not told why.
9. **Live preview writes on an explicit action or ≥3 s idle, never per keystroke.** A 600 ms
   debounce over a 20-minute editing session is ~1–2 k Worker renders and ~1–2 k Class A writes
   to a single hot R2 key.
10. **Version snapshots move to *after* a successful write**, are skipped when bytes are
    unchanged, are keyed by rev, and are taken only on publish. Snapshot-before-write burns a
    retention slot on every failed CAS retry, and 30 slots is under an hour of history once
    several people edit.
11. **Media delete resolves its key from the listing, never from the request.** `deleteKey()`
    takes an arbitrary key, so a client-supplied key is a delete primitive over `users.json`
    and `site-content.json` — and deleting the latter makes `getContent()` serve the bundled
    seed to the entire public site with no error surfaced anywhere.
12. **The legacy promo fallback is gated on an explicit migration flag**, not on
    `campaigns.length === 0` — otherwise deleting the last campaign resurrects a months-old
    promo site-wide, including on top of the admin chrome.

---

## 3. Storage and revision model

### 3.1 New keys

| Key | Contents | Notes |
|---|---|---|
| `site-content.json` | unchanged | rev/lineage in R2 `customMetadata` |
| `users.json` | user records incl. PBKDF2 hashes | never web-reachable: `readBinary` forces the `uploads/` prefix, and the bucket has no public r2.dev subdomain |
| `drafts/<uuid>.json` | one changeset | id is **server-generated**, never client-supplied |
| `media/index.json` | editable metadata only (alt, tags) keyed by filename | the *listing* comes from `listKeys('uploads/')`; a lost write costs alt text, not an image |
| `versions/<rev>-<iso>-<uid>-<rand>.json` | snapshots | rev-prefixed so pruning is by rev; random suffix kills same-millisecond collisions |
| `audit.json`, `audit-auth.json` | unchanged shape | now CAS-guarded (§4.6) |

### 3.2 Namespaced storage helpers — no raw keys from requests

`storage.ts` gains typed, namespace-scoped helpers and the raw `writeText`/`deleteKey` API
becomes internal:

```ts
readDoc(key: SystemKey): Promise<{ text, etag, rev, lineage } | null>   // uncached, single get()
writeDocIfMatch(key, text, etag, meta): Promise<{ etag } | null>        // null = CAS failed
readDraft(id: string)   writeDraft(id: string, …)   deleteDraft(id: string)
listUploads()           deleteUpload(name: string)                      // asserts /^[\w.-]+$/
```

`SystemKey` is a closed union (`'site-content.json' | 'users.json' | 'media/index.json' | …`).
A deny-list rejects any request-driven write or delete targeting a system key or `versions/`.
Draft ids are `crypto.randomUUID()`. Upload names are validated against a filename regex before
being joined — in dev, `path.join(DATA_DIR, 'drafts/../users.json')` resolves to the real user
store, and dev is where this will be built against real data.

`R2BucketLike` ([storage.ts:28](../../../src/lib/storage.ts#L28)) is widened to expose `etag`
and `customMetadata` on get, and to accept `onlyIf` and `customMetadata` on put. No dependency
change — the interface is hand-rolled precisely to avoid `@cloudflare/workers-types`.

### 3.3 Revision, lineage and CAS

- `DocVersion = { lineage: string; rev: number }` lives in R2 `customMetadata`; the client
  receives it as an opaque `baseVersion` string `"<lineage>:<rev>"`.
- Compare-and-swap is `writeDocIfMatch(key, text, etag, { rev: rev+1, lineage })`. `null` return
  = someone else wrote; retry the whole pipeline **once**, then 409.
- `restoreVersion` writes at `currentRev + 1` with a **freshly generated lineage**, so every
  outstanding tab and draft that predates the restore fails its version check loudly.
- Dev (filesystem) keeps a sidecar `data/.meta/<key>.json` holding `{rev, lineage, hash}`;
  CAS compares the hash. Single-process dev accepts the residual race.

---

## 4. Save pipeline

One function, `applyAndAuthorize(doc, subject, ops)` in `src/lib/save-pipeline.ts`, pure and
unit-testable with no Next or R2 imports. The route is a thin shell around it.

### 4.1 Wire format

```ts
type Op =
  | { op: 'set';      path: string; value: Json }          // scalar or object subtree
  | { op: 'setList';  path: string; value: Json[] }        // whole array — the shape editors produce
  | { op: 'insert';   path: string; value: Json }          // append to an identified collection
  | { op: 'remove';   path: string; id: string }
  | { op: 'reorder';  path: string; ids: string[] }

POST /api/admin/save { baseVersion: string, ops: Op[], mode: 'publish'|'draft', draftId?, note? }
```

`setList` exists because `mergeWithSeed` replaces arrays wholesale
([content.ts:14](../../../src/lib/content.ts#L14)) and every list editor does add/remove/reorder
rather than field-only edits — whole-array values are the only thing the client can honestly
produce. **The convenience of the wire format never reaches the authorizer** (§4.3).

Explicit ops (rather than `value: undefined`) also solve field clearing: `JSON.stringify` drops
`undefined`, and the schema genuinely distinguishes `null`, `''` and absent for
`razorpayLink`, `seatsLeft`, `stats.studentsThisWeek` and `site.email`. Clearing is
`{op:'set', value:null}` with a per-field canonical empty value decided once at diff time.

### 4.2 Path grammar

```
segment      := ident | ident '[id=' idvalue ']' | ident '[' int ']'
reserved     := __proto__ | constructor | prototype        → hard 400 before any matching
root         := rejected ('$', '', '.')
```

Identified collections (`src/lib/collections.ts`): `danceStyles`, `studios`, `batches`,
`instructors`, `testimonials`, `stories`, `customPages`, `campaigns` (all keyed by `id`) and
`welcome.tracks` (keyed by `key`). Numeric indices are legal only for arrays whose *order is the
data* (`about.introParagraphs`, `welcome.whatToBring`, `pages.faqs.sections`), and those are
written whole.

The applier builds intermediates with `Object.create(null)` and `Object.hasOwn` checks. The only
prototype-pollution guard in the codebase today is on the *read* path inside `mergeWithSeed`
([content.ts:29](../../../src/lib/content.ts#L29)); a dotted-path deep-set on the *write* path
bypasses it completely, and Zod cannot undo prototype mutation because `__proto__` is not an own
key.

### 4.3 Expansion — the core of the authorization model

Before anything is authorized, every op is expanded against a **deep clone** of the loaded
document into a flat list of leaf changes:

```ts
type LeafChange =
  | { kind:'update'; path; collection?; id?; before; after }
  | { kind:'create'; collection; id; after }
  | { kind:'delete'; collection; id; before }
  | { kind:'reorder'; collection; before: string[]; after: string[] }
```

A `setList` on `instructors` is structurally diffed **by id** against the current array and
becomes one `create`/`delete`/`update`/`reorder` per affected record. So:

- A patch at a parent path can no longer escape child-scoped rules — it *becomes* the child
  changes.
- Ownership conditions have a record to bind to for every change, including array writes.
- Drafts store the **expanded ops**, not the raw array, which is what makes stale approval safe
  (§5.3).

Authorization per leaf:

| kind | requirement |
|---|---|
| `update` | `allow(before)` **and** `allow(after)` |
| `create` | `allow(after)`, explicitly — absence of a prior record is never an absent constraint |
| `delete` | `allow(before)` |
| `reorder` | `reorder` action on the collection |

The `allow(before) && allow(after)` rule is what closes the branch-hop escalation: rewriting
`branchSlug` to your own branch fails, because the *before* record was not yours.

### 4.4 Order of operations

1. Resolve session → **subject**, read `users.json` uncached (mutations are rare; freshness wins).
2. `sameOrigin` + `contentLengthWithin` + **per-subject rate limit** (new; today only login is limited).
3. Parse the envelope with Zod. Reject reserved segments, root paths, unknown ops.
4. `readDoc('site-content.json')` — uncached, returns bytes + etag + rev + lineage.
5. Expand ops (§4.3) against a deep clone.
6. **Authorize every leaf.** 403 lists the denied leaves. *This runs before the conflict
   response*, so a Viewer cannot poll 409s as a change-feed oracle.
7. Version check: `baseVersion` mismatch → 409 `"krish@… saved at 14:32 — reload to get their
   changes"`. No overlap list: computing one needs a per-rev changed-path log that does not
   exist, and `audit.json` is lossy by construction.
8. Apply → `SiteContentSchema.safeParse(next)`. On failure, re-validate the **base** and reject
   only issues the patch *introduced*; pre-existing invalid records surface as a dashboard
   health item, not as a 400 that blocks every editor on every screen. (The second parse is paid
   only on the failure path.)
9. Referential integrity: every slug reference (`batch.styleSlugs`/`branchSlug`,
   `studio.styleSlugs`, `instructor.branchSlugs`/`styleSlugs`, `testimonial.styleSlug`) resolves
   against `danceStyles[].slug` / `studios[].slug`. Blocking. These are bare `z.string()` today,
   so two non-overlapping patches can currently orphan each other's references.
10. If `mode === 'publish'` but the subject lacks publish rights on any leaf → store as a draft
    and return `201 { draftId }` instead of failing.
11. `writeDocIfMatch(...)`; `null` → retry once from step 4, then 409.
12. **After** success: snapshot (skipped when the new bytes equal the old), `bustContentCache()`,
    `audit({ action:'save_content', paths: leafPaths, rev })`,
    `revalidatePublicPages(mergedDoc)` — the merged document, never the patch, or renamed and
    deleted slugs never get their old paths purged.

### 4.5 Schema-level invariants added

- A document-level `superRefine` enforcing **`id` and `slug` uniqueness within every
  collection**. Every lookup in the codebase is a first-match `.find()`, and slugs are ABAC join
  keys — without uniqueness, an author can point their own page's slug at `refund-policy` and
  take over the URL without ever writing the victim record.
- `*.id` is denied to every built-in role. Ids are immutable after creation.
- **No `.refine()` rejecting future dates** on any new scheduling field. Copying
  `TestimonialSchema`'s pattern would make scheduling unsaveable *and* poisonous: a stored
  document that fails Zod makes `getContent()` serve the bundled **seed for the entire site**
  ([content.ts:67](../../../src/lib/content.ts#L67)).

### 4.6 Audit

`audit()` gains the same etag-conditional write plus one retry, records the changed leaf paths
and the rev, and adds an `authz_denied` event — today no authorization failure anywhere is
recorded. Denial-log write failures are `console.error`'d rather than swallowed, so they appear
in wrangler observability. The 500-entry cap stays.

### 4.7 Restore is a computed op set

`restoreVersion` stops being a whole-document write on a separate route — otherwise the claim
that `applyAndAuthorize` is a single choke point is simply false. Restore diffs the published
document against the snapshot, expands the difference to leaves, and runs it through the same
authorizer with the restorer's subject, refusing with the offending leaf list. That gives
**per-path restore for free** and closes the hole where `versions.restore` reverts path sets its
holder has an explicit `deny` on (a Manager denied `theme.**` and `site.**` can currently revert
both by restoring yesterday, and any restore can silently reinstate a malicious `razorpayLink`
that was cleaned up).

The restored document is written at `currentRev + 1` under a **new lineage**, merged against a
schema-defaults floor rather than the content-bearing seed (§8), and `/admin/versions` gains the
server-side gate its Restore button already implies — today the API 403s while the page renders
the button for every session, and the snapshot filenames leak every actor's email address to
anyone who can load the page.

---

## 5. Identity, roles, drafts

### 5.1 Users (`users.json`, `src/lib/users.ts`)

```ts
{ id, email, name, passwordHash, roleIds: string[],
  attrs: { instructorId?, branchSlugs?, styleSlugs? },
  status: 'active'|'disabled', mustChangePassword: boolean,
  sessionVersion: number, createdAt, createdBy, lastLoginAt }
```

- Hashing reuses the existing `pbkdf2$sha256$50000$…` format. **50 000, not workerd's 100 000
  cap** — [hash-password.mjs:14-18](../../../scripts/hash-password.mjs#L14-L18) records that at
  the cap a login brushes the 10 ms limit and 500s.
- **Break-glass env owner** authenticates before any store lookup, via a dedicated `brk:true`
  claim plus an epoch from `ADMIN_OWNER_TOKEN_EPOCH` (which gives it the revocation lever it
  otherwise lacks — it has no `users.json` record to bump). User writes reject
  `email === ADMIN_OWNER_EMAIL` and any client-supplied `id`; ids are server-generated UUIDs.
  Otherwise a delegated `users.manage` holder can mint an undeletable full-privilege account.
- **Store-unavailable resolves *only* break-glass** and 401s every other session. On Workers
  with a broken binding, reads fail silently as empty
  ([storage.ts:85-90](../../../src/lib/storage.ts#L85-L90)) — "trust the token's claims when the
  store is gone" would turn that into a fail-open.
- Invites: owner creates the user, a generated temp password is shown **once**, delivered over
  WhatsApp (there is no mail service on this stack). `mustChangePassword` forces a change on
  first login.
- Every self-service endpoint takes an explicit allow-list — `/api/admin/me` accepts
  `{currentPassword, newPassword}` and `{name}` and reconstructs the record server-side. Client
  objects are never merged into stored records; `roleIds`, `attrs`, `status`, `sessionVersion`,
  `id`, `email` are settable only under `users.manage`, and granting a role requires already
  holding every capability it grants.

### 5.2 Roles and the evaluator

Roles are a frozen constant (`src/lib/roles.ts`), each
`{ id, name, allowPaths: string[], denyPaths: string[], capabilities: string[], when?: Condition[] }`:

| Role | Writes | Capabilities |
|---|---|---|
| Owner | `**` | all |
| Manager | all content, `campaigns.**` | `campaigns.publish`, `drafts.approve`, `media.*`, `versions.restore` |
| Editor | the sections named in the user's `attrs.sections` | — (saves route to drafts) |
| Author | `stories[*]` where `record.authorId == subject.id` | — |
| Instructor | `instructors[*]` where `record.id == subject.attrs.instructorId` | — |
| Viewer | none | — |

Evaluation is **default-deny, deny-overrides**, over leaf changes. Capabilities cover the
non-path actions: `users.manage`, `versions.restore`, `media.delete`, `theme.write`,
`campaigns.publish`, `drafts.approve`.

The Editor role is the one parameterised role: its `allowPaths` are resolved per user from
`attrs.sections`, a list of **section keys** (`batches`, `stories`, `styles`, `studios`,
`instructors`, `testimonials`, `pages`, `customPages`, `campaigns`, `site`, `hero`) mapped to
path globs by a single table in `src/lib/roles.ts`. Section keys — not raw globs — are what the
Users screen exposes, which is why a glob-authoring UI buys nothing at this team size.

`stories` must not match `storiesArchive` — glob matching is segment-wise, and there is a test
for exactly that.

**Enforcement points** (there is no framework, just three edits):
1. `admin/layout.tsx` becomes the authentication choke point — resolves the subject and
   redirects when absent, disabled, or `sessionVersion`-stale. Today it deliberately renders
   children without a session.
2. Each of the ~25 thin server wrappers gains one `await requireCapability(…)` line.
3. `/admin/json` becomes owner-only **and** `/api/admin/save` rejects any body that is not an op
   envelope — otherwise the raw-JSON screen is a one-paste bypass of every path grant.

The JWT carries `uid`, `email`, `roles`, `sessionVersion` — but **`roles` is a hint that is never
consulted for a decision**. Every decision uses the server-resolved subject. Page renders may
use a 5 s subject cache; mutations always read fresh.

### 5.3 Drafts, approval, preview

`drafts/<uuid>.json` = `{ id, title, authorId, authorRoleIds, status, baseVersion, leafOps[],
frozenDecision, note, comments[], createdAt, reviewedBy?, reviewedAt? }`.

- **Authorized at author time**, and the decision is frozen into the draft along with the
  author's roles. On approve, the check is the **intersection**: the frozen author decision must
  still hold under current policy *and* the approver must be authorized for the same leaves.
  Without this, "approve replays with the approver's authority" lets an Author bury
  `site.whatsappNumber` in patch 39 of a 40-patch "fix FAQ typos" draft.
- The author's `status` and `sessionVersion` are re-checked at approve. Disabled authors' queued
  drafts do not execute — nothing in a status flag reaches a queued draft otherwise.
- **Approve is POST-only, requires `sameOrigin`, and the body must echo the exact leaf-path set
  the approver was shown** (which the UI renders — not a title and a note). `sameOrigin()`
  returns true when `Origin` is absent and the cookie is `sameSite=lax`, so a GET approve link
  would execute on a top-level navigation the approver never inspected.
- **Approval uses a narrower conflict check than a direct save**: it compares only the leaves the
  draft touches between `baseVersion` and current. Unchanged → fast-forward and apply. Changed →
  show which and require the author to refresh. Reusing the strict check would make every draft
  permanently un-approvable after any unrelated publish — which happens on day one.
- Because drafts store **expanded, id-anchored leaf ops**, a two-week-old draft can never delete
  records added since, and can never land on the wrong record after a reorder.

---

## 6. Admin UX

### 6.1 `useEditor(sectionPath)`

Supplies `{ value, patch, dirty, errors, conflict, canWrite, save }`: state, dirty tracking,
field-level Zod error mapping, permission-aware disabling, and op emission by structural diff
against a **`structuredClone` of the loaded document**.

Three escape hatches are required, because four behaviours in five files defeat a naive hook:
`transformInitial` (CustomPagesEditor's `migrateBlocks(initial)` at mount), `beforeSave`
(CustomPagesEditor auto-slugs every page, WelcomePageEditor auto-fills every track key — both
then re-seed state), and pass-through for local UI state (the accordion `openId` in four
editors, and `setOpenId(fresh.id)` inside `add()`).

**Honest budget: all 20 editors are touched, and four need markup rewrites.**
StylesEditor/StudiosEditor/InstructorsEditor/StoriesEditor nest
`<span role="button" tabIndex={0}>` *inside* a `<button>` with no `onKeyDown` — invalid HTML,
keyboard-dead, and Enter toggles the accordion instead of reordering.

**Prerequisite fix:** `StylesEditor.move()`, `StudiosEditor.move()` and
`CustomPagesEditor.move()` do a shallow `arr.slice()` then mutate `displayOrder` on objects the
`initial` prop still references. A diff against `initial` sees *no change* and silently drops the
reorder. Whole-document saves mask this today; it would regress on the exact commit that
introduces diffing. Fix: `arr.map(x => ({...x}))`, plus a unit test asserting move→diff emits a
non-empty op set.

### 6.2 Never lose work

Autosave is **subtree-only**: key `furor:draft:<sectionPath>`, value the section plus its
`baseVersion` and the set of **touched paths**. On mount with a mismatched `baseVersion` it does
*not* silently rehydrate — it offers "your unsaved draft is based on version N, live is M" with
per-field apply. Ops are generated from touched paths only, never from a structural diff of
rehydrated state against a refreshed base (which would re-emit every field another editor
changed overnight as a revert). Plus a `beforeunload` guard — there is none anywhere today.

### 6.3 Shell, navigation, mobile

Below 1024px the sidebar is currently a full-width block *above* the content: ~25 nav rows and a
sign-out form before every editor. That is the whole mobile complaint and it is a small fix:
drawer nav with 44 px targets, active-route indication, `env(safe-area-inset-bottom)` on the
sticky save bar (it currently sits under the iOS home indicator), and breakpoint prefixes on
`AboutPageEditor`'s two `grid-cols-[140px_1fr_auto]` grids. Also consolidated on the way through:
`.input` is defined three times (one copy missing `color-scheme: light`), `Section` five times in
three visual variants, `slugify` twice with different semantics, and `move()` nine times.

Cmd/Ctrl-K command palette over destinations and records, with a visible search affordance for
touch (no Cmd key on a phone).

### 6.4 Preview

**Both ship** (§11, decision 1), in this order:

- **(A) New tab.** `POST /api/admin/preview` sets a signed, httpOnly, ≤15-minute `furor_preview`
  cookie and returns a URL; the public site renders the draft. Zero header changes, zero framing
  risk. This is also the fallback whenever framing is blocked.
- **(B) Split view**, layered on (A). Requires a `next.config.mjs` rule *after* `/:path*`, gated
  `has: [{ type:'cookie', key:'furor_preview' }]`, emitting `X-Frame-Options: SAMEORIGIN` and
  `frame-ancestors 'self'`. The gate is a cookie only our own authenticated preview endpoint can
  set, so an attacker page cannot make the site frameable. Residual accepted risk: while a
  preview session is live, that one admin's browser could be induced to frame the public site.
  The ≤15-minute TTL bounds that window, and the cookie is cleared when preview is closed.

  Two OpenNext specifics this depends on: next.config headers **beat** anything middleware or a
  route handler sets (`middlewareHeadersOverrideNextConfigHeaders` defaults false), so
  next.config is the only lever; and later matching rules overwrite earlier ones per header key,
  so the preview rule must come after the `/:path*` rule that sets `DENY`.

Either way: **explicit "Update preview" button plus a ≥3 s idle threshold — never a per-keystroke
debounce.**

Preview correctness rules (all mandatory):

- `getContent()` itself becomes preview-aware, rather than editing 54 call sites — a missed site
  would render published content mid-preview with no error. `sitemap.ts` uses a new
  `getPublishedContent()`. Because the GH Pages mirror is retired first (§11, decision 3), the
  `cookies()` call needs no `GH_PAGES` guard; if that retirement is ever reverted, **every**
  `cookies()` call in the public tree needs one, and the omission fails only in CI.
- Draft bytes are read via `readDraft()` **directly** — never through `readContentRaw()`, and
  `bustContentCache()` is never called on a draft write. Otherwise the isolate's shared 30 s slot
  serves unpublished content to anonymous visitors.
- The overlay returns a **fresh deep clone**; the published object is a request-wide singleton
  shared by the layout, the page body and every `generateMetadata()`.
- The React memo is keyed by a **primitive** (`previewKey: string | null`) — an options object
  defeats `cache()` entirely.
- The token binds `{draftId, uid, exp}`, is signed with a **separate secret and distinct
  iss/aud** from the session JWT, and on every preview render the subject is re-resolved and
  re-checked against that draft — not merely "the token parses". Without a distinct iss/aud an
  admin session cookie value replayed into `furor_preview` would verify.
- The `published` filter is relaxed **only for records the draft's own ops touch** — otherwise an
  empty draft is a site-wide read bypass over every unpublished page, future-dated story and
  unlaunched campaign.
- Preview responses carry `Cache-Control: private, no-store`, `Vary: Cookie` and
  `X-Robots-Tag: noindex`. `next.config.mjs` sets no-store only for `/admin/*` and `/api/*` today.

### 6.5 Dashboard

Pure functions over the document, no new data: expired-but-open batches (invisible today — they
just vanish from the public site), styles with no upcoming batch, open batches with
`razorpayLink === null` (a dead "Reserve my seat" CTA), duplicate custom-page slugs, dangling
slug references, stale promos, missing alt text, plus the approvals queue, live/scheduled
campaigns and recent activity.

---

## 7. Theming

`theme` in the content document:

```ts
theme: { preset: string, light: { ember: hex, gold: hex }, dark: { ember: hex, gold: hex },
         schedule?: { publishAt?, expireAt?, revertTo?: string },
         css: string /* derived at save time — never hand-edited */ }
```

**The token contract is exact and unforgiving.** A complete override sets 20 properties in
**two different formats**:

- 13 `--c-*` tokens as **bare space-separated RGB triplets** — `tailwind.config.ts` wraps them in
  `rgb(var(…) / <alpha-value>)`, so a hex here breaks *every* alpha utility site-wide at once.
- 6 `--art-*` tokens as **complete colour values** — `PlaceholderArt` feeds them straight into SVG
  `fill`/`stopColor`.
- `--c-on-ember`, the AA pairing invariant: ember stays red in both themes, so text on ember must
  not flip with the theme. Recolour ember without it and `.btn-primary`, `.accent-panel`,
  `NoticeBanner`, the floating CTA and both home CTAs drop below AA — the file records the old
  pairing measured 4.4:1 / 3.9:1 and failed.
- `color-scheme: light|dark` per block, or native scrollbars and form controls stay on the old theme.
- `--beat` / `--bar` must **not** be clobbered — they're the site's tempo tokens, not colours.

**Specificity:** light tokens are declared on `:root, html[data-theme='light']`
([globals.css:7](../../../src/app/globals.css#L7)). An injected `:root{…}` block is
**(0,1,0) against (0,1,1) — a silent no-op in both themes**, while looking perfectly correct in
devtools. Overrides are emitted as `html[data-theme='light']{…}` and `html[data-theme='dark']{…}`,
after the stylesheet.

Also fixed in the same commit, because they duplicate tokens as literals and would visibly drift:
`ThemeToggle.applyTheme` (rewrites every `theme-color` meta on mount with its own hex, destroying
any server-rendered value), the `viewport.themeColor` pair, `manifest.ts`, `RhythmSignature`'s
`#e0313f`/`#3a5fd6` (dark-theme values rendered in *both* themes — already visibly wrong today)
and the `EnquiryCTA` toast's permanently-dark `#150c10`.

Known unreachable, documented rather than fixed: `.hero-vignette`'s literal `rgba(0,0,0,.5)` and
the logo's `hue-rotate` filter tint.

Presets ship in `src/lib/theme-presets.ts` as complete, human-verified token sets (Furor Classic,
Christmas Ball, Pool Party, Monsoon, Festival Gold). Custom accents derive their ramps through
OKLCH lightness steps in `src/lib/color.ts` (~60 lines, no dependency), **once at save time**, and
the resulting CSS string is stored. Contrast is measured and reported; failures offer a one-click
"nudge to AA" rather than silently changing the owner's colour. `theme.write` is owner-only.

---

## 8. Campaigns

```ts
campaigns: [{ id, name, status, slot, audience:{paths[], styleSlugs[], branchSlugs[]},
  schedule:{publishAt?, expireAt?}, content:{…}, urgency:{countdownTo?, seatsFromBatchId?},
  dismissible, dismissDays, priority }]
```

Slots: `top-strip`, `home-ribbon`, `batches-header`, `style-page`, `floating-card`. One
`<Promo slot="…"/>` server component picks the highest-priority campaign that is live now and
targets this route. Only dismissal and the countdown are client-side, and the countdown is driven
by the campaign's own `expireAt`, so it cannot lie. Per-campaign GA4 impression/click events reuse
the existing analytics plumbing.

`top-strip` gets the pathname guard `NoticeBanner` lacks — it currently renders on `/admin` on top
of the editor chrome.

**Scheduling** is `{publishAt?, expireAt?}` on campaigns, stories, custom pages and batches,
evaluated at render time — no cron. Stored as **ISO-8601 UTC instants**, entered in IST in the
admin. (`todayIso()` adds a 5.5 h offset and `visibleBatches` compares date-only strings; mixing
the two conventions yields windows that open and close 5.5 hours off.) `sitemap.ts`, the
`/stories/[slug]` route (which has no publish gate at all today) and `danceSchoolsLd`'s
`priceRange` (which currently includes closed and past batches) all learn to respect the window.

**Migration** sets `legacyPromosMigrated: true`, copies `site.notice`/`trial`/`tonight` into
campaigns, and **blanks the legacy keys**. The renderer falls back to legacy content only when
that flag is absent — never on `campaigns.length === 0`, which would resurrect a months-old promo
site-wide the moment the last campaign is deleted.

`mergeWithSeed` gains a `NEVER_SEED` set (`campaigns`, `theme`). It starts from
`{...seed}` and keeps the seed's value for any key absent from the saved document — and
`sync-seed` bakes a developer's *live local content* into the seed. Without this, restoring a
pre-migration snapshot injects the developer's campaigns and theme into production. Restore
generally merges against a **schema-defaults-only floor**, not the content-bearing seed.

---

## 9. Media library

- Listing is derived from `listUploads()`; `media/index.json` holds **editable metadata only**
  (alt, tags) keyed by filename, tolerant of missing entries. Two concurrent uploads doing
  read-modify-write on an index-as-source-of-truth lose an image; this way they lose alt text.
- Usage detection is **one pass**:
  `new Set(JSON.stringify(doc).match(/\/uploads\/[A-Za-z0-9._-]+/g) ?? [])`, then a Set lookup per
  item — O(doc + n), not 200 passes over 53 KB inside a 10 ms budget.
- Delete requires `media.delete`, resolves the key **from the listing** (never from the request),
  asserts the `uploads/` prefix, and is blocked when the file is referenced by the live document
  or any open draft. Version snapshots are *warned* about, not blocked — restoring an old snapshot
  after a delete yields broken images, and that trade-off should be visible.
- `ImageUploader` gains a "choose from library" tab.

---

## 10. Testing

`vitest` as a dev dependency. Six pure modules are **mandatory-with-tests**, each written with no
Next/R2 imports:

1. **Path parser + applier** — rejects `__proto__`/`constructor`/`prototype` on the write path.
2. **`authorizePatches`** — default-deny, deny-overrides, `stories` ∌ `storiesArchive`, and the
   branch-hop pair (`set branchSlug` + `set razorpayLink` in one envelope) must be denied.
3. **Op expansion + client diff** — a reorder emits a non-empty op set; load→clear→save→reload
   emits zero ops.
4. **`mergeWithSeed`** — a new top-level key absent from the saved document is *not* seeded.
5. **Schedule window evaluator** — pins the IST/UTC question explicitly.
6. **Version/CAS conflict decision** — including `put() === null`.

Everything else — admin markup, dashboard tiles, media UI, block rendering, the palette — ships
untested, deliberately.

---

## 11. Decisions taken (user, 2026-08-02)

1. **Live preview — both shapes.** New-tab preview ships first; split view is layered on top of
   it, which requires the `next.config.mjs` framing rule of §6.4(B), gated on the
   `furor_preview` cookie only. The gate matters: it is a cookie no one but our own
   authenticated preview endpoint can set, so the public site is never frameable for an ordinary
   visitor — only for a browser that currently holds a live preview session.
2. **Custom role authoring — deferred.** Six roles as a frozen constant in `src/lib/roles.ts`;
   the Users screen assigns roles and section keys. No `policies.json`, no rules UI.
3. **The GitHub Pages mirror — retired.** The workflow, the strip step, and the `GH_PAGES`
   conditionals come out. This removes the *only* reason the design needs a guard on every
   `cookies()` call in the public tree, and with it an entire class of build failures that
   surface only in CI. Sequencing matters: **retirement lands before the preview work**, so the
   preview cookie is never written behind a guard that is about to be deleted.

   Affected by the retirement: `.github/workflows/deploy-pages.yml`, the `GH_PAGES` branches in
   `src/app/layout.tsx` (`connection()` and the noindex/robots switch) and `src/app/sitemap.ts`,
   `src/lib/base-path.ts` + `withBase()`, and the `basePath`/`output: 'export'` machinery in
   `next.config.mjs`. `robots.ts` and `manifest.ts` keep their `force-static` exports — those
   are unrelated to the mirror.

---

## 12. Out of scope

Email delivery (invites go over WhatsApp), payments, a second storage engine (D1), per-record
read filtering, i18n, and the two untokenised surfaces in §7. `data/payment-events.json` has zero
code references and is left alone.
