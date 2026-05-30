# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StudyCRM is a study-abroad management platform with three separate sub-projects:

- **`backend/`** — Express + TypeScript API (port 5000)
- **`crm/`** — Next.js 16 staff-facing CRM dashboard (port 3000)
- **`student/`** — Next.js 16 student self-service portal (port 3001)

## Commands

Each sub-project must be run from its own directory.

### Backend
```bash
cd backend
npm run dev       # ts-node with nodemon (hot reload)
npm run build     # tsc → dist/
npm start         # node dist/index.js
npm run seed      # seed initial data via ts-node src/seed.ts
```

### CRM frontend
```bash
cd crm
npm run dev       # next dev --port 3000
npm run build
npm start
```

### Student portal
```bash
cd student
npm run dev       # next dev --port 3001
npm run build
npm start --port 3001
```

There is no monorepo root with a unified dev command — run each service in a separate terminal.

## Environment Setup

Copy `.env.example` → `.env` in `backend/`, and `.env.local.example` → `.env.local` in both `crm/` and `student/`.

**backend/.env** required vars:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/studycrm
JWT_SECRET=...
JWT_EXPIRES_IN=7d
CLIENT_CRM_URL=http://localhost:3000
CLIENT_STUDENT_URL=http://localhost:3001
```

**crm/.env.local** / **student/.env.local**:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Architecture

### Auth Flow
JWT-based. The backend issues a token on `/api/auth/login`. The CRM stores it in `localStorage` under `crm_token`; the student portal uses `student_token`. Both frontends use Zustand with `persist` middleware (`crm-auth` / `student-auth` keys) to hydrate auth state. The Axios instance in `src/lib/api.ts` (each frontend has one) attaches the token via an interceptor and redirects to `/login` on 401.

Users have a `role` field (`super_admin`, `admin`, `counsellor_manager`, `finance`, `visa_team`, `doc_verification`, `university_team`, `counsellor`, `accountant`, `support`, `student`, `university`). Route-level authorization uses the `authorize(...roles)` middleware from `backend/src/middleware/auth.ts`.

The `student` role has a `studentId` FK on the User document pointing to the `Student` collection. Self-registration (`POST /api/auth/register-student`) atomically creates both records and links them.

### Data Model Relationships
```
User ──(role=student)──► Student
                            │
                ┌───────────┼───────────┬──────────────┐
                ▼           ▼           ▼              ▼
          Application    Document    Payment          Visa
```

- **Lead** → converted to **Student** via `convertedStudentId`
- **Conversation** → has a `studentId` and `participants[]` (User refs); **Message** belongs to a Conversation
- **Notification** and **ActivityLog** are per-user/student side-effect records

### Student Journey Stages
The `StudentStage` enum drives the entire pipeline:
`inquiry → counselling → university_selection → application_submitted → offer_letter → fee_payment → cas_i20 → visa_filing → visa_approved → departure`

`Application.status` is separate: `drafting → submitted → offer_received → conditional_offer → accepted | rejected | withdrawn | deferred`

`Visa.stage`: `not_started → documents_complete → visa_filed → biometrics → interview → decision → approved | rejected | reapplied`

### Real-time (Socket.io)
The backend creates an `http.Server` wrapping Express and attaches `socket.io`. CORS is configured to allow both frontend origins. The socket setup lives in `backend/src/socket.ts`. Both frontends connect via `NEXT_PUBLIC_SOCKET_URL`. The exported `io` instance from `backend/src/index.ts` is used inside routes to emit events.

### CRM Frontend Structure
- App Router with a `(crm)` route group for authenticated pages
- Global providers in `app/layout.tsx`: `ThemeProvider` → `ToastProvider`
- Tailwind CSS v4 with a custom design token vocabulary: `bg-base`, `bg-surface`, `bg-card`, `bg-muted`, `border-line`, `text-t1/t2/t3`, `bg-accent` — defined in global CSS, not `tailwind.config`
- `useToast()` from `ToastContext` for all user-facing feedback
- `useAuthStore` from `stores/authStore.ts` for auth state
- All API calls go through the configured Axios instance at `lib/api.ts`

### Student Portal Structure
Mirrors the CRM structure but also has `ThemeContext` for light/dark switching. Auth store tracks `studentId` separately. Portal pages live under `app/(portal)/`.

## Key Conventions

- Backend routes always import `AuthRequest` (not plain `Request`) for authenticated handlers, and use `req.user!.id` for the caller's identity.
- Mongoose models export both the interface (`IStudent`, etc.) and the compiled model as the default export.
- `User.toJSON` strips the `password` field automatically — never manually omit it in routes.
- Frontend pages use `'use client'` and fetch data in `useEffect`; there is no server-side data fetching (RSC) in use.
