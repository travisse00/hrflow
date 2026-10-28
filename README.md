# HRFlow

HR and internal communication platform: employees, a hierarchical department structure, attendance, leave workflow, and private/departmental messaging with secure file sharing.

**Stack:** Next.js (App Router) · TypeScript · Prisma · MongoDB · Tailwind CSS · Zod

---

## 1. Setup

### Prerequisites
- Node.js 20+
- A MongoDB **replica set**. The easiest option is a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. Prisma needs a replica set for transactions; a plain local `mongod` will not work unless you start it with `--replSet`.

### Steps

```bash
git clone <repo-url> hrflow
cd hrflow
npm install

cp .env.example .env        # then fill in DATABASE_URL and AUTH_SECRET (see below)

npx prisma generate          # builds the typed database client
npx prisma db push           # creates collections and indexes in MongoDB
npm run db:seed              # demo departments, employees and logins

npm run dev                  # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | MongoDB connection string, **including the database name** (`.../hrflow?...`) |
| `AUTH_SECRET` | yes | Signs session cookies. 32+ characters. `openssl rand -base64 32` |
| `STORAGE_DIR` | no | Folder for uploaded files. Default `./storage/uploads` |
| `ORG_TIMEZONE` | no | Decides where "today" starts. Default `Africa/Lagos` |

Only variables the code actually reads are listed. `.env` is git-ignored; no secrets are committed.

### Demo logins (created by the seed; password for all: `Password123`)

| Email | Role | Where they sit |
|---|---|---|
| `admin@hrflow.test` | Admin | none |
| `hr.manager@hrflow.test` | HR Manager | Head of **Human Resources** |
| `tunde@hrflow.test` | Employee | Head of **Recruitment** (under HR) |
| `ruth@hrflow.test` | Employee | Member of **Recruitment** |
| `chidi@hrflow.test` | Employee | Head of **Operations** |
| `amaka@hrflow.test` | Employee | Member of **Field Operations** (under Operations) |
| `sola@hrflow.test` | Employee | Head of **Finance** |
| `ibrahim@hrflow.test` | Employee | Member of **Accounts** (under Finance) |

The first account registered on an empty system becomes Admin; everyone after registers as Employee.
These demo passwords are for local development only.

### Try the privacy rules (2 minutes)

1. Sign in as **ruth** → *Messages → New message* → To **Tunde Ojo**. This is a **private** chat.
2. Sign in as **hr.manager** (head of HR, which is *above* Recruitment). The chat is **not** in the list, and opening its URL gives a 404. Hierarchy does not expose private messages.
3. As **ruth** again → New message → To the **Recruitment** department (subject required). This is a **department** conversation.
4. As **hr.manager**: it **is** visible, read-only, with a banner explaining it is visible through the hierarchy. As **chidi** (Operations): not visible.
5. As **tunde** (Recruitment head): visible, and he can reply *as the Recruitment department*.
6. As **admin**: the department conversation is visible (read-only oversight); the private one is not.

---

## 2. Architecture

### Folder structure

```
prisma/
  schema.prisma          data model, relations and indexes
  seed.ts                demo data (idempotent)
src/
  app/
    (auth)/              sign in ("/") and register
    (dashboard)/         everything behind login: dashboard, employees, departments,
                         attendance, leave, messages (+ loading / error / not-found)
    api/attachments/     upload (POST) and secure download (GET/[id]) route handlers
  modules/               business logic, one folder per feature
    auth/ employees/ departments/ attendance/ leave/ dashboard/
    messaging/           service, visibility rules, attachments, actions, components
  components/            ui/ (building blocks), forms/ (ActionForm + fields), layout/ (shell)
  lib/
    auth/                password hashing, session tokens, current user
    permissions/         roles -> permissions, assertCan()
    validation/          Zod schemas (also shared with the browser for uploads)
    storage/             file storage behind an interface
    db/                  Prisma client
    errors.ts, http.ts   one error model for server actions and route handlers
    dates.ts             organisation-timezone date handling
```

**Why this shape:** every feature is split into the same layers, so each has one reason to change.

| Layer | Knows about | Does not know about |
|---|---|---|
| `app/**/page.tsx` | what to show, which service to call | database details, business rules |
| `modules/*/actions.ts` | the web request: who is calling, parse the form, refresh pages | business rules |
| `modules/*/service.ts` | business rules, permissions, database | HTTP, forms, React |
| `lib/validation` | the shape of valid input | everything else |

Because rules live in services (not in pages or actions), they can be reused and tested without a browser, and a future mobile API could call the same services.

### Authentication
- Email + password. Passwords are hashed with **bcrypt** (cost 12), never stored or logged.
- A signed **JWT** (HS256, `jose`) is stored in an **httpOnly, SameSite=Lax, Secure-in-production** cookie, valid 7 days. JavaScript cannot read it (blocks XSS theft) and cross-site requests don't carry it (CSRF defence).
- Login returns one generic error for every failure and compares against a dummy hash when the email is unknown, so neither the message nor the response time reveals which emails exist.
- **The cookie proves identity only.** On every request `getCurrentUser()` re-reads the employee from the database, so deactivating a user or changing their role takes effect immediately, even though their cookie is still valid.
- `middleware` is only a fast first gate ("is there a valid cookie?"). Real checks happen server-side below it.

### Authorization
Three roles (Admin, HR Manager, Employee) map to **permissions** (`employee:manage`, `leave:review`, `department:manage`, ...) in `lib/permissions`.

Authorization is enforced **on the server, in the services**, not by hiding buttons. Every service starts with `assertCan(actor, "...")`; the UI hides links as a courtesy only. Ownership rules sit on top of permissions:

- you can open your own profile, but others need `employee:view-all`
- nobody can approve their own leave request (even an Admin)
- HR Managers cannot edit or deactivate an Admin
- an Admin cannot deactivate themselves or the last active Admin
- only an Admin can hand out elevated roles

### Database design (MongoDB via Prisma)

| Model | Key decisions |
|---|---|
| **Employee** | Doubles as the login account. **Never deleted**, only `INACTIVE`, so attendance, leave and messages keep their history. |
| **Department** | `parentId` (backward link) + `children` (forward link) + `path` (array of ancestor ids, nearest first) + `depth`. |
| **Attendance** | One row per employee per day, `dayKey` = `"YYYY-MM-DD"` in the org timezone. **Unique index (employeeId, dayKey)** makes duplicate clock-ins impossible even under concurrent requests. |
| **LeaveRequest** | Status machine `PENDING → APPROVED/REJECTED` (final). Review info stored on the row; every action also goes to the audit log. |
| **Conversation / ConversationParticipant / Message / Attachment** | See Messaging below. |
| **AuditLog** | Who did what to which record, with small metadata. Never contains message content. |

Indexes follow the queries: employees by department/status/role/name, departments by parent and by `path`, attendance by day, leave by (status, date), messages by (conversation, time), conversations by (kind, last activity).

MongoDB-specific care taken:
- Unique indexes on optional fields allow only one empty value, so `Conversation.threadKey` is required (department conversations get a random `org:<uuid>` key).
- Optional fields can be "missing" or `null`; queries that depend on it (`clockOut`) check both.
- Multi-document writes use `$transaction` (array form), which is why a replica set is required.

### Department hierarchy
Stored as an **adjacency list plus materialised ancestor path**:

- `parentId` gives the immediate parent and `children` gives the immediate children (forward and backward links).
- `path` lists *all* ancestors, so "who is above Recruitment?" and "is X inside Y?" are one query or one array check, with no recursive loop.
- **Cycle prevention** (`A` can't be its own parent, can't move under its own descendant): if the new parent's `path` contains the department being moved, the move is rejected.
- **Moving a branch** rewrites `path` and `depth` for every descendant inside one transaction, so the tree is never half-moved.
- Cost of this design: reads are cheap, moves are more work. Org charts are read far more than they are restructured, so this is the right trade.

### Messaging architecture
One reusable model for all four communication types:

```
Conversation ── ConversationParticipant (an EMPLOYEE or a DEPARTMENT)
             └── Message ── Attachment
```

| Type | Conversation kind | Participants |
|---|---|---|
| Employee → Employee | `PRIVATE` | employee, employee |
| Employee → Department | `ORGANIZATIONAL` | employee, department |
| Department → Department | `ORGANIZATIONAL` | department, department |
| Department → Employee | `ORGANIZATIONAL` | department, employee |

- A message always stores the **real person** (`senderId`). When a department head speaks for the department, `senderDepartmentId` is also set ("Tunde, on behalf of Recruitment").
- Private chats use a unique `threadKey` (`dm:<idA>:<idB>`, ids sorted) so each pair of people has exactly one thread, even if both start it at the same instant.
- Future features (groups, reactions, read receipts) fit the existing tables: more participants, a `MessageReaction` model is already in the schema, `lastReadAt` is on participants.

**Visibility** (single source of truth: `modules/messaging/visibility.ts`; the list, the thread page, sending and file downloads all use the same filter):

| Who | `PRIVATE` | `ORGANIZATIONAL` |
|---|---|---|
| The participants | ✅ | ✅ |
| Members of a participating department | n/a | ✅ can read and reply |
| Head of a participating department | n/a | ✅ can read, reply, and reply *as the department* |
| Head of a department **above** a participating one | ❌ | ✅ read-only |
| Admin | ❌ | ✅ read-only oversight |
| Anyone else | ❌ | ❌ |

"Above" is resolved with the stored `path`, in the database query. If you can't see a conversation the server answers exactly as if it didn't exist (404), so ids can't be probed.

### File attachments
Two steps, so uploads can show real progress:

1. `POST /api/attachments` uploads one file (XHR with a progress bar). The server validates, stores the bytes, and creates an `Attachment` row with no message yet, owned by the uploader.
2. Sending the message links those attachments to it. The server checks every id is an unsent upload **by the same user**, so you can't attach someone else's file.

Security:
- **Type** is decided by file extension (allow-list) **and** a content signature check (magic bytes), never by the MIME type the browser claims. Executables, scripts and SVG are not on the allow-list.
- **Size** limit 10 MB per file and 5 files per message, checked in the browser (fast feedback) and again on the server on the real bytes.
- **Storage keys are random UUIDs** and files live outside `public/`. The database stores only metadata (name, MIME type, size, key, timestamp, message link).
- **Download goes only through `GET /api/attachments/[id]`**, which checks that you can see the conversation the file was sent in. Responses send `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`. Only images and PDFs display inline; everything else downloads.
- Guessing a URL gets a 404 unless you have access.

### State management
No global state library. It isn't needed, and adding one would duplicate data the server already owns.

- **Server state stays on the server.** Pages are Server Components that read straight from services; changes go through Server Actions followed by `revalidatePath`.
- **Local UI state stays in components:** form values, the message draft, upload progress, the mobile menu.
- **URL state** holds list filters, search and pagination (`?q=&department=&page=`), so results are shareable and survive refresh.
- **Realtime:** the open conversation re-fetches every 5 seconds while the tab is visible (`AutoRefresh`). Moving to true realtime later only means replacing that component with a Socket.io/Pusher subscription that calls `router.refresh()`.

### Storage decision
Uploaded files go to local disk behind a small `StorageProvider` interface (`lib/storage`). It needs no extra services or secrets for reviewers. Production should implement the same interface for S3/R2/Azure Blob; nothing else changes.

---

## 3. Assumptions

- **Department heads:** one head per department, who must be an *active* employee. Heads don't have to be members of the department. If a head is deactivated, the departments they head are released (no head).
- **Acting for a department:** a department head (or an Admin) may start conversations and reply *as* that department. Ordinary members reply as themselves.
- **Deactivation:** sets status to `INACTIVE`. The person can no longer sign in (checked on every request) and stops appearing in pickers, but all attendance, leave and messages remain.
- **Attendance:** one record per employee per organisation-timezone calendar day, created at clock-in. Clock-out must follow a clock-in the same day. A day left without a clock-out is shown as "No clock-out" and doesn't block the next day. Timestamps come from the server clock, never the client.
- **Absent** = active, not clocked in, and not on approved leave. **On leave** = approved leave covering today.
- **Leave conflicts:** a new request can't overlap the same person's pending or approved request. Start dates can't be in the past, except sick leave (up to 7 days back). Maximum 365 days. Rejection requires a note. Decisions are final.
- **Department message visibility:** see the table above. Admin oversight is read-only and applies only to department conversations.
- **File access:** you can open a file if and only if you can see the conversation it was sent in (or you uploaded it and haven't sent it yet).
- **Passwords:** new employees get a temporary password set by HR/Admin. There is no email service, so there is no self-service reset in this version.

## 4. Tradeoffs

| Decision | Alternative | Why |
|---|---|---|
| Server-side checks in services | Role checks only in the UI | UI checks can be bypassed by calling the action directly |
| Materialised ancestor `path` | Recursive queries / nested sets | Cheap reads for upward visibility; moves are rare |
| JWT cookie + DB lookup per request | Stateless JWT only | Instant revocation on deactivation, at the cost of one indexed read per request |
| Polling for live updates | Socket.io / Pusher | No extra infrastructure and works on serverless; slightly delayed (≤5 s) |
| Local disk behind an interface | S3 from day one | Zero setup for reviewers; interface makes the swap trivial |
| Two-step upload | Files inside the server action | Real progress bars; no server-action body size limit |
| Offset pagination | Cursor pagination | Simple and fine at this scale |
| `Employee` is also the login account | Separate `User` + `Employee` | Fewer joins and one source of truth for a small system |

## 5. Scaling and improvements

**At 100,000 employees:** replace the full employee/recipient dropdowns with type-ahead search; add a text index or a search service (Atlas Search / Meilisearch) for the directory; move to cursor pagination; cache the department tree; archive old attendance and audit rows.

**Messaging at scale:** cursor-paginate messages (the thread already loads only the latest 200); add per-participant unread counters; fan out realtime through Redis-backed Socket.io or a managed service (Pusher/Ably); store files in object storage with signed URLs and a CDN.

**Large uploads:** direct-to-S3 multipart uploads with presigned URLs, virus scanning, and a cleanup job for uploads never attached to a message.

**What I intentionally kept simple:** polling instead of websockets; no email or in-app notifications; no password reset; no PWA/offline; no reactions UI (the model exists); analytics are small CSS charts; the attendance trend counts check-ins and doesn't model shifts or holidays.

**Before production:** rate-limit login and uploads, add CSRF-style origin checks on route handlers, optimistic locking for concurrent department moves, automated tests (service-level and end-to-end), structured logging, backups, Docker/CI, and move file storage off local disk.

---

## 6. Server API reference

All mutations are Server Actions returning `{ ok: true } | { ok: false, error: { code, message, fieldErrors? } }`. `code` is one of `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL`. Every action validates input with Zod, checks the session, then calls a service that checks permissions.

| Action | Permission / rule |
|---|---|
| `registerAction`, `loginAction`, `logoutAction` | public / signed in |
| `createEmployeeAction`, `updateEmployeeAction`, `setEmployeeStatusAction` | `employee:manage` (+ `employee:assign-role` to change roles) |
| `createDepartmentAction`, `updateDepartmentAction` (edit + move), `assignEmployeeAction` | `department:manage` |
| `clockInAction`, `clockOutAction` | signed in; state-machine enforced |
| `submitLeaveAction` | signed in |
| `reviewLeaveAction` | `leave:review`; not your own request; pending only |
| `sendMessageAction`, `startConversationAction` | must be able to post in / start the conversation |

Route handlers:

| Endpoint | Description |
|---|---|
| `POST /api/attachments` | multipart `file`. Returns `201 { id, originalName, mimeType, size }`. Errors: `400` invalid type/size, `401` signed out |
| `GET /api/attachments/:id` | Streams the file if you can see its conversation, else `404`. `?download=1` forces a download |

## 7. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / run |
| `npm run db:seed` | Seed demo data (safe to re-run) |
| `npx prisma studio` | Browse the database |
| `npm run lint`, `npx tsc --noEmit` | Lint, type check |
