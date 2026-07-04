# StudyCRM — Deep Technical Context

## Project Overview

StudyCRM is a full-stack study-abroad management platform. It manages the complete student lifecycle — from initial lead capture through visa approval and departure. Three services run independently and communicate via REST API and Socket.IO.

| Service | Framework | Port | Audience |
|---------|-----------|------|----------|
| `backend/` | Express + TypeScript | 5000 | Internal (API only) |
| `crm/` | Next.js 16 (App Router) | 3000 | Staff (admins, counsellors, etc.) |
| `student/` | Next.js 16 (App Router) | 3001 | Students |

---

## Repository Structure

```
studycrm/
├── backend/
│   ├── src/
│   │   ├── index.ts            — App entry: Express + Socket.IO server
│   │   ├── config/db.ts        — Mongoose connection
│   │   ├── middleware/auth.ts  — JWT verify + authorize() guard
│   │   ├── models/             — Mongoose schemas
│   │   ├── routes/             — Express route handlers
│   │   ├── socket/
│   │   │   ├── index.ts        — Socket.IO event wiring
│   │   │   └── emitter.ts      — Singleton io export
│   │   ├── utils/notify.ts     — Notification helper
│   │   └── seed.ts             — Database seed script
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── crm/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              — Root layout (providers)
│   │   │   ├── page.tsx                — Redirect to /dashboard
│   │   │   ├── login/page.tsx
│   │   │   └── (crm)/                  — Authenticated route group
│   │   │       ├── layout.tsx
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── students/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── leads/page.tsx
│   │   │       ├── applications/page.tsx
│   │   │       ├── documents/page.tsx
│   │   │       ├── visa/page.tsx
│   │   │       ├── finance/page.tsx
│   │   │       ├── chat/page.tsx
│   │   │       ├── reports/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── AppShell.tsx
│   │   │   ├── LeadKanban.tsx
│   │   │   ├── PaletteWidget.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── StageTracker.tsx
│   │   │   └── StatCard.tsx
│   │   ├── context/
│   │   │   ├── ThemeContext.tsx
│   │   │   └── ToastContext.tsx
│   │   ├── stores/authStore.ts
│   │   ├── lib/api.ts
│   │   └── types/index.ts
│   └── .env.local.example
└── student/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                — Redirect to /home
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   ├── manifest.ts             — PWA manifest
    │   │   └── (portal)/               — Authenticated route group
    │   │       ├── layout.tsx
    │   │       ├── home/page.tsx
    │   │       ├── profile/page.tsx
    │   │       ├── progress/page.tsx
    │   │       ├── applications/page.tsx
    │   │       ├── documents/page.tsx
    │   │       ├── payments/page.tsx
    │   │       ├── notifications/page.tsx
    │   │       └── chat/page.tsx
    │   ├── components/
    │   │   ├── AppShell.tsx
    │   │   ├── Skeleton.tsx
    │   │   └── StageTracker.tsx
    │   ├── context/
    │   │   ├── ThemeContext.tsx
    │   │   └── ToastContext.tsx
    │   ├── stores/authStore.ts
    │   ├── lib/api.ts
    │   └── types/index.ts
    └── .env.local.example
```

---

## Backend

### Tech Stack

| Package | Version | Role |
|---------|---------|------|
| express | 4.19.2 | HTTP server |
| mongoose | 8.4.1 | MongoDB ODM |
| socket.io | 4.7.5 | Real-time events |
| jsonwebtoken | 9.0.2 | JWT auth |
| bcryptjs | 2.4.3 | Password hashing |
| multer | 1.4.5-lts.1 | File uploads |
| express-validator | 7.1.0 | Input validation |
| cors | 2.8.5 | CORS policy |
| ts-node | 10.9.2 | Dev runtime |
| nodemon | 3.1.4 | Dev hot-reload |
| TypeScript | 5.4.5 | Language |

### API Routes

| File | Base Path | Key Operations |
|------|-----------|---------------|
| `routes/auth.ts` | `/api/auth` | Login, register student, validate token |
| `routes/users.ts` | `/api/users` | CRUD users, assign roles |
| `routes/leads.ts` | `/api/leads` | Create/update leads, convert → student |
| `routes/students.ts` | `/api/students` | Student CRUD, stage progression, counsellor assign |
| `routes/documents.ts` | `/api/documents` | Upload, approve/reject, versioning |
| `routes/applications.ts` | `/api/applications` | University application lifecycle |
| `routes/visas.ts` | `/api/visas` | Visa stage progression |
| `routes/payments.ts` | `/api/payments` | Payment records, invoice generation |
| `routes/messages.ts` | `/api/messages` | Conversation + message CRUD |
| `routes/notifications.ts` | `/api/notifications` | List/mark-read notifications |
| `routes/dashboard.ts` | `/api/dashboard` | Aggregated analytics |

### Data Models

#### User
Fields: `name`, `email`, `password` (hashed), `role`, `studentId` (FK for student role), `avatar`, `isActive`, `lastLogin`, timestamps.
`toJSON` strips `password` automatically.

Roles (11): `super_admin`, `admin`, `counsellor_manager`, `finance`, `visa_team`, `doc_verification`, `university_team`, `counsellor`, `accountant`, `support`, `student`, `university`

#### Student
Fields: `userId` (User FK), `studentId` (generated), `firstName`, `lastName`, `email`, `phone`, `dateOfBirth`, `nationality`, `passportNumber`, `stage` (StudentStage enum), `assignedCounsellor` (User FK), `preferredCountries`, `preferredCourses`, `educationHistory`, `testScores` (IELTS/TOEFL/GRE/GMAT/SAT), `workExperience`, `notes`, timestamps.

#### Lead
Fields: `firstName`, `lastName`, `email`, `phone`, `source` (website/referral/social/event/walk-in/other), `status` (new/contacted/qualified/proposal/negotiation/converted/lost), `interestedCountries`, `interestedCourses`, `notes`, `assignedTo` (User FK), `convertedStudentId` (Student FK), timestamps.

#### Application
Fields: `studentId`, `universityName`, `courseName`, `courseLevel`, `country`, `tuitionFee`, `currency`, `applicationDate`, `intake`, `status` (drafting/submitted/offer_received/conditional_offer/accepted/rejected/withdrawn/deferred), `notes`, `documents[]`, timestamps.

#### Visa
Fields: `studentId`, `applicationId` (FK), `country`, `visaType`, `stage` (not_started/documents_complete/visa_filed/biometrics/interview/decision/approved/rejected/reapplied), `submissionDate`, `decisionDate`, `notes`, `officer` (User FK), timestamps.

#### Payment
Fields: `studentId`, `type` (tuition/application_fee/visa_fee/service_fee/other), `amount`, `currency`, `status` (pending/paid/overdue/cancelled/refunded), `dueDate`, `paidDate`, `description`, `invoiceNumber`, `receipt`, timestamps.

#### Document
Fields: `studentId`, `type` (DocType enum — passport/photo/transcript/degree/ielts/toefl/gre/gmat/sat/recommendation/sop/lor/bank_statement/financial_sponsorship/visa_form/other), `name`, `url` (Multer upload path), `version`, `status` (pending/approved/rejected/expired), `uploadedBy`, `approvedBy`, `rejectionReason`, `expiryDate`, timestamps.

#### Conversation
Fields: `studentId`, `participants[]` (User refs), `lastMessage`, `lastMessageAt`, timestamps.

#### Message
Fields: `conversationId`, `senderId`, `content`, `readBy[]`, `attachments[]`, timestamps.

#### Notification
Fields: `userId`, `title`, `message`, `type` (info/success/warning/error), `read`, `link`, timestamps.

#### ActivityLog
Fields: `userId`, `action`, `resource`, `resourceId`, `details`, `ip`, timestamps.

### Authentication & Authorization

JWT flow:
1. `POST /api/auth/login` → validates credentials → returns `{ token, user }`
2. Subsequent requests: `Authorization: Bearer <token>`
3. `middleware/auth.ts` → `authenticate` middleware verifies JWT, attaches `req.user`
4. `authorize(...roles)` — variadic middleware factory that checks `req.user.role` against allowed roles

Student self-registration:
- `POST /api/auth/register-student` atomically creates both `User` (role: `student`) and `Student` records and links them via `User.studentId`

### Real-time (Socket.IO)

Socket setup in `src/socket/index.ts`:
- Auth handshake: client passes `{ token }` in `socket.handshake.auth`
- On connect: socket joins room `user:<userId>` for targeted events
- Events: `join_room`, `leave_room`, `send_message`, `typing`, `disconnect`

`src/socket/emitter.ts` exports the singleton `io` instance. Routes import it to emit after mutations.

`src/utils/notify.ts` — `createNotification(userId, title, message, type, link?)`:
1. Persists a `Notification` document
2. Emits `notification` event to `user:<userId>` room

### Environment Variables (backend/.env)

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/studycrm
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d
CLIENT_CRM_URL=http://localhost:3000
CLIENT_STUDENT_URL=http://localhost:3001
```

---

## CRM Frontend

### Tech Stack

| Package | Version | Role |
|---------|---------|------|
| next | 16.2.6 | App Router framework |
| react | 19.2.4 | UI |
| axios | 1.7.2 | HTTP client |
| zustand | 4.5.4 | Global state |
| socket.io-client | 4.7.5 | Real-time |
| tailwindcss | 4 | Styling |

### Auth Store (`stores/authStore.ts`)

Zustand + `persist` middleware. Persisted to `localStorage` under key `crm-auth`.
Shape: `{ user: User | null, token: string | null, setAuth, clearAuth }`
Token read by `lib/api.ts` interceptor from `localStorage.getItem('crm_token')`.

### Axios Instance (`lib/api.ts`)

- `baseURL`: `NEXT_PUBLIC_API_URL`
- Request interceptor: reads `crm_token` from localStorage, sets `Authorization: Bearer <token>`
- Response interceptor: on 401 → clears auth store → redirects to `/login`

### Design System

Tailwind CSS v4 with custom design tokens defined in global CSS (not `tailwind.config`):

| Token | Usage |
|-------|-------|
| `bg-base` | Page background |
| `bg-surface` | Panel/sidebar background |
| `bg-card` | Card component background |
| `bg-muted` | Subtle background |
| `border-line` | Dividers and borders |
| `text-t1` | Primary text |
| `text-t2` | Secondary text |
| `text-t3` | Tertiary / placeholder text |
| `bg-accent` | Brand accent color |

The same token vocabulary is shared by the student portal, where the tokens are backed by theme-switchable CSS variables (see Student Portal → Theming).

### Provider Hierarchy

```
RootLayout
  └─ ThemeProvider (ThemeContext)
       └─ ToastProvider (ToastContext)
            └─ page content
```

### Key Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | KPI cards, recent activity, pipeline overview |
| `/students` | Paginated student list, search, filter by stage/counsellor |
| `/students/[id]` | Full student profile: personal info, stage tracker, documents, applications, visa, payments, chat |
| `/leads` | Kanban board (`LeadKanban.tsx`) grouped by lead status |
| `/applications` | All applications with status filters |
| `/documents` | Document review queue — approve/reject with reason |
| `/visa` | Visa cases grouped by stage |
| `/finance` | Payment records, invoice management |
| `/chat` | Messaging interface with student conversations |
| `/reports` | Analytics charts |
| `/settings` | Admin: users, roles, system config |

---

## Student Portal

### Auth Store (`stores/authStore.ts`)

Zustand + `persist` under key `student-auth`.
Shape: `{ user: StudentUser | null, token: string | null, studentId: string | null, setAuth, clearAuth }`

### Axios Instance (`lib/api.ts`)

Same pattern as CRM but reads `student_token` from localStorage.

### Theming (`context/ThemeContext.tsx`)

The student portal has a light/dark theme switcher (the CRM does not):

- **Light is the default theme**; dark is secondary. Preference persisted in `localStorage` under `student-theme`.
- Dark mode is applied by toggling the `dark` class on `<html>` (`:root.dark` overrides the CSS variables).
- Design language is **glassmorphism**: `globals.css` defines `.glass`, `.glass-card`, `.glass-nav` (frosted backdrop-blur surfaces), `.glow-accent` / `.glow-accent-sm` glows, `.nav-active-glow`, and three animated background orbs (`.animate-orb-a/b/c`) driven by `--orb-1/2/3` variables.
- Light palette: blue-white canvas (`#f0f4ff`), white surfaces, navy text, `#2563eb` accent. Dark palette: near-black (`#111318`) backgrounds with `#4f8ef7` accent.
- PWA `themeColor` in `layout.tsx` viewport is `#2563eb`.

### Key Pages

| Route | Description |
|-------|-------------|
| `/home` | Welcome dashboard: stage summary, quick links |
| `/profile` | View/edit personal info, passport details |
| `/progress` | Journey timeline (`StageTracker.tsx`) with current stage |
| `/applications` | List of submitted applications and statuses |
| `/documents` | Upload documents, view approval status |
| `/payments` | Payment history and outstanding dues |
| `/notifications` | All notifications, mark as read |
| `/chat` | Messaging with assigned counsellor |

### Student Self-Registration

`POST /api/auth/register-student` → backend atomically creates `User` + `Student` → returns token.
Portal stores `studentId` separately in Zustand for downstream API calls.

---

## Student Journey

### Stages (StudentStage enum — ordered pipeline)

```
inquiry
  → counselling
    → university_selection
      → application_submitted
        → offer_letter
          → fee_payment
            → cas_i20
              → visa_filing
                → visa_approved
                  → departure
```

### Application Status (separate from stage)

`drafting → submitted → offer_received → conditional_offer → accepted | rejected | withdrawn | deferred`

### Visa Stage

`not_started → documents_complete → visa_filed → biometrics → interview → decision → approved | rejected | reapplied`

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────┐
                    │         MongoDB (Mongoose)        │
                    │  User, Student, Lead,             │
                    │  Application, Visa, Payment,      │
                    │  Document, Notification,          │
                    │  Message, Conversation,           │
                    │  ActivityLog                      │
                    └────────────┬────────────────┬────┘
                                 │                │
                    ┌────────────▼────────────┐   │
                    │  Express API (port 5000) │   │
                    │  /api/auth              │   │
                    │  /api/users             │   │
                    │  /api/leads             │   │
                    │  /api/students          │   │
                    │  /api/documents         │   │
                    │  /api/applications      │   │
                    │  /api/visas             │   │
                    │  /api/payments          │   │
                    │  /api/messages          │   │
                    │  /api/notifications     │   │
                    │  /api/dashboard         │   │
                    └───────┬────────┬────────┘   │
                            │        │             │
              Socket.IO     │        │    Socket.IO│
              (port 5000)   │        │    (port 5000)
                            │        │
            ┌───────────────▼──┐  ┌──▼────────────────────┐
            │ CRM (port 3000)  │  │ Student Portal (3001) │
            │ Staff dashboard  │  │ Self-service portal   │
            │ crm_token        │  │ student_token          │
            │ crm-auth store   │  │ student-auth store    │
            └──────────────────┘  └───────────────────────┘
```

---

## Security

| Concern | Implementation |
|---------|---------------|
| Password storage | bcryptjs hashing |
| Auth tokens | JWT signed with `JWT_SECRET`, expiry configurable |
| Transport | Bearer token in Authorization header |
| Role enforcement | `authorize(...roles)` middleware on every protected route |
| Input validation | express-validator on mutating endpoints |
| CORS | Whitelist: `CLIENT_CRM_URL` + `CLIENT_STUDENT_URL` only |
| Token exposure | `User.toJSON` strips `password` field; never manually omitted |

---

## Development Commands

```bash
# Backend
cd backend && npm run dev       # ts-node + nodemon, port 5000
cd backend && npm run seed      # seed initial data

# CRM
cd crm && npm run dev           # next dev, port 3000

# Student
cd student && npm run dev       # next dev, port 3001
```

Each service runs in its own terminal. There is no unified monorepo dev command.
