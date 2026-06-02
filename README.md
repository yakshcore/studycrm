# StudyCRM

A full-stack study-abroad management platform for counselling agencies. Manages the complete student lifecycle — from lead capture through visa approval — with a staff CRM and a student self-service portal.

---

## What It Does

**For staff** (CRM dashboard):
- Track leads through a Kanban sales pipeline
- Manage student records across a 10-stage journey (inquiry → departure)
- Review and approve uploaded documents
- Manage university applications, visa cases, and payments
- Real-time chat with students and live notifications

**For students** (self-service portal):
- Track their own progress through the journey
- Upload required documents and monitor approval status
- View university applications, offer letters, and payment dues
- Chat directly with their assigned counsellor

---

## Services

| Service | Port | Stack |
|---------|------|-------|
| Backend API | 5000 | Node.js · Express · TypeScript · MongoDB · Socket.IO |
| CRM Dashboard | 3000 | Next.js 16 · React 19 · Zustand · Tailwind CSS v4 |
| Student Portal | 3001 | Next.js 16 · React 19 · Zustand · Tailwind CSS v4 (PWA) |

---

## Quick Start

Each service runs independently in its own terminal.

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in JWT_SECRET and MONGODB_URI
npm install
npm run dev                 # starts on port 5000
```

Seed an initial super_admin:
```bash
npm run seed
```

### 2. CRM Dashboard

```bash
cd crm
cp .env.local.example .env.local
npm install
npm run dev                 # starts on port 3000
```

### 3. Student Portal

```bash
cd student
cp .env.local.example .env.local
npm install
npm run dev                 # starts on port 3001
```

---

## Environment Variables

### backend/.env

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) |
| `CLIENT_CRM_URL` | CRM origin for CORS (default: http://localhost:3000) |
| `CLIENT_STUDENT_URL` | Student portal origin for CORS (default: http://localhost:3001) |

### crm/.env.local and student/.env.local

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (default: http://localhost:5000/api) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO server URL (default: http://localhost:5000) |

---

## Student Journey (10 Stages)

```
Inquiry → Counselling → University Selection → Application Submitted
  → Offer Letter → Fee Payment → CAS/I-20 → Visa Filing
  → Visa Approved → Departure
```

Application status runs on a separate track: `drafting → submitted → offer received → conditional offer → accepted | rejected | withdrawn | deferred`

---

## Role-Based Access Control

11 staff roles with route-level enforcement:

`super_admin` · `admin` · `counsellor_manager` · `counsellor` · `finance` · `accountant` · `visa_team` · `doc_verification` · `university_team` · `support` · `student`

| Capability | Roles |
|-----------|-------|
| Full system access | super_admin, admin |
| Lead & student management | counsellor_manager, counsellor |
| Document approval | doc_verification |
| Visa tracking | visa_team |
| Finance & payments | finance, accountant |
| Reports | super_admin, admin, counsellor_manager |
| Student (own data only) | student |

---

## API Overview

Base URL: `http://localhost:5000/api`

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/register-student` |
| Users | `GET/POST /users`, `PUT /users/:id`, `POST /users/student-account` |
| Leads | `GET/POST /leads`, `GET/PUT/DELETE /leads/:id` |
| Students | `GET/POST /students`, `GET/PUT/PATCH/DELETE /students/:id` |
| Documents | `GET/POST /documents`, `POST /documents/upload`, `PUT /documents/:id/status` |
| Applications | `GET/POST /applications`, `GET/PUT/DELETE /applications/:id` |
| Visas | `GET/POST /visas`, `GET/PUT/DELETE /visas/:id` |
| Payments | `GET/POST /payments`, `GET/PUT/DELETE /payments/:id` |
| Messages | `GET/POST /messages/conversations`, `POST /messages/send`, `GET /messages/:conversationId` |
| Notifications | `GET/POST /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read` |
| Dashboard | `GET /dashboard/stats`, `GET /dashboard/reports` |

Uploaded files served at `/uploads/<filename>`.

---

## Key Features

### CRM Dashboard
- Lead Kanban board with 7 status columns
- Student 360 profile: stage tracker, applications, documents, visa, payments, notes
- Document review queue with approve/reject and rejection reason
- Visa stage progression tracker
- Finance module: payment recording, mark-paid, receipt links
- Monthly KPI reports and lead funnel analytics
- Issue student portal credentials from the student profile

### Student Portal
- Home dashboard with counsellor card, pending actions summary
- 10-stage visual journey tracker with stage-specific guidance
- Multipart document upload with approval status tracking
- University applications with offer dates and tuition details
- Payment history with overdue detection
- Real-time chat with assigned counsellor (typing indicators, read receipts)
- PWA — installable on mobile, bottom navigation

### Platform-wide
- Socket.IO real-time messaging and notifications
- Dark / light theme with localStorage persistence
- JWT auth with automatic token refresh redirect
- Toast notification system

---

## Project Docs

- [`context.md`](./context.md) — Deep technical reference: models, routes, auth flow, socket events, design tokens
- [`summary.md`](./summary.md) — One-page high-level overview
