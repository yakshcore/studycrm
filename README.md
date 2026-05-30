# StudyCRM

A full-stack Study Abroad CRM system built with:
- **Backend**: Node.js + Express + MongoDB + Socket.io
- **CRM**: Next.js 16 internal CRM with RBAC (port 3000)
- **Student Portal**: Next.js 16 PWA for students (port 3001)

---

## Architecture

```
studycrm/
  backend/         Node.js + Express + MongoDB + Socket.io API
    src/
      config/      db.ts
      middleware/  auth.ts (JWT authenticate + authorize)
      models/      User, Lead, Student, Document, Application, Visa, Payment,
                   Notification, ActivityLog, Conversation, Message
      routes/      auth, users, leads, students, documents, applications,
                   visas, payments, messages, notifications, dashboard
      socket/      Socket.io setup
    uploads/       Uploaded document files (auto-created)

  crm/             Next.js 16 CRM app (port 3000)
    src/
      app/
        (crm)/     Route group — all pages wrapped in AppShell
          dashboard/
          leads/
          students/[id]/   (includes "Create Portal Account" panel)
          applications/
          visa/
          documents/
          finance/
          reports/
          settings/
        login/
      components/  AppShell, StageTracker, LeadKanban, StatCard, Skeleton
      context/     ToastContext, ThemeContext
      lib/         api.ts (Axios + crm_token)
      stores/      authStore.ts (Zustand)
      types/       index.ts

  student/         Next.js 16 Student Portal PWA (port 3001)
    src/
      app/
        (portal)/  Route group — all pages wrapped in AppShell
          home/        Dashboard — counsellor, pending docs, journey progress
          progress/    Full 10-stage tracker + profile summary + test scores
          documents/   Upload documents, track approval status
          applications/ View university applications
          payments/    Payment history + pending amounts
          chat/        Real-time DM with assigned counsellor
          notifications/ Push-style notification list
          profile/     Edit personal info, education, preferences, password
        login/
      components/  AppShell (bottom nav on mobile), StageTracker, Skeleton
      context/     ToastContext, ThemeContext
      lib/         api.ts (Axios + student_token)
      stores/      authStore.ts (Zustand — stores studentId)
      types/       index.ts
```

---

## Setup

### 1. Backend

```bash
cd studycrm/backend
cp .env.example .env         # Fill in your values
npm install
npm run dev                  # Starts on port 5000
```

To seed the first super_admin user, POST to:
```
POST http://localhost:5000/api/auth/register
{ "name": "Admin", "email": "admin@example.com", "password": "password123", "role": "super_admin" }
```

### 2. CRM Frontend

```bash
cd studycrm/crm
cp .env.local.example .env.local
npm install
npm run dev                  # Starts on port 3000
```

### 3. Student Portal

```bash
cd studycrm/student
cp .env.local.example .env.local
npm install
npm run dev                  # Starts on port 3001
```

---

## Onboarding a Student

1. **Create the student record** in the CRM: `Students → + New Student`
2. **Open the student's profile** (`Students → [name]`)
3. **Create portal account** using the "Student Portal" card in the right sidebar — enter the student's email + a temporary password
4. Share the Student Portal URL (`http://localhost:3001`) with the student
5. The student logs in and can track their journey, upload documents, and chat with their counsellor

---

## Environment Variables

### Backend (.env)

| Variable            | Default                              | Description                  |
|---------------------|--------------------------------------|------------------------------|
| PORT                | 5000                                 | Server port                  |
| MONGODB_URI         | mongodb://localhost:27017/studycrm   | MongoDB connection string     |
| JWT_SECRET          | —                                    | JWT signing secret (required) |
| JWT_EXPIRES_IN      | 7d                                   | JWT expiry                   |
| CLIENT_CRM_URL      | http://localhost:3000                | CRM frontend origin (CORS)   |
| CLIENT_STUDENT_URL  | http://localhost:3001                | Student portal origin (CORS) |

### CRM Frontend (.env.local)

| Variable                | Default                      | Description           |
|-------------------------|------------------------------|-----------------------|
| NEXT_PUBLIC_API_URL     | http://localhost:5000/api    | Backend API base URL  |
| NEXT_PUBLIC_SOCKET_URL  | http://localhost:5000        | Socket.io server URL  |

---

## API Endpoints Reference

### Auth
| Method | Endpoint                      | Description                     | Auth |
|--------|-------------------------------|---------------------------------|------|
| POST   | /api/auth/login               | Login, returns JWT + studentId  | No   |
| GET    | /api/auth/me                  | Get current user                | Yes  |
| POST   | /api/auth/register            | Register user (seeding)         | No   |
| POST   | /api/auth/change-password     | Change own password             | Yes  |

### Users
| Method | Endpoint                       | Description                          | Auth                           |
|--------|--------------------------------|--------------------------------------|--------------------------------|
| GET    | /api/users                     | List all users                       | super_admin, admin, manager    |
| GET    | /api/users/counsellors         | List counsellors only                | All                            |
| POST   | /api/users                     | Create user                          | super_admin, admin             |
| POST   | /api/users/student-account     | Create portal account for student    | super_admin, admin, manager    |
| PUT    | /api/users/:id                 | Update user                          | Authenticated                  |

### Leads
| Method | Endpoint         | Description       | Auth          |
|--------|------------------|-------------------|---------------|
| GET    | /api/leads       | List leads        | Authenticated |
| POST   | /api/leads       | Create lead       | Authenticated |
| GET    | /api/leads/:id   | Get lead          | Authenticated |
| PUT    | /api/leads/:id   | Update lead       | Authenticated |
| DELETE | /api/leads/:id   | Delete lead       | Authenticated |

Query params: `?status=new&assignedTo=<userId>`

### Students
| Method | Endpoint            | Description                             | Auth          |
|--------|---------------------|-----------------------------------------|---------------|
| GET    | /api/students       | List students (role-filtered)           | Authenticated |
| POST   | /api/students       | Create student                          | Authenticated |
| GET    | /api/students/:id   | Get student                             | Authenticated |
| PUT    | /api/students/:id   | Update student (full)                   | Authenticated |
| PATCH  | /api/students/:id   | Update student (partial, student portal)| Authenticated |
| DELETE | /api/students/:id   | Delete student                          | Authenticated |

Query params: `?stage=inquiry`  
Note: `student` role users can only see their own record.

### Documents
| Method | Endpoint                    | Description            | Auth               |
|--------|-----------------------------|------------------------|--------------------|
| GET    | /api/documents              | List documents         | Authenticated      |
| POST   | /api/documents              | Create document        | Authenticated      |
| POST   | /api/documents/upload       | Multipart file upload  | Authenticated      |
| GET    | /api/documents/:id          | Get document           | Authenticated      |
| PUT    | /api/documents/:id          | Update document        | Authenticated      |
| PUT    | /api/documents/:id/status   | Approve/Reject doc     | doc_verification+  |
| DELETE | /api/documents/:id          | Delete document        | Authenticated      |

Query params: `?studentId=<id>&status=uploaded&type=passport`  
Files served at: `/uploads/<filename>`

### Applications
| Method | Endpoint                | Description          | Auth          |
|--------|-------------------------|----------------------|---------------|
| GET    | /api/applications       | List applications    | Authenticated |
| POST   | /api/applications       | Create application   | Authenticated |
| GET    | /api/applications/:id   | Get application      | Authenticated |
| PUT    | /api/applications/:id   | Update application   | Authenticated |
| DELETE | /api/applications/:id   | Delete application   | Authenticated |

Query params: `?studentId=<id>&status=submitted`

### Visas
| Method | Endpoint         | Description     | Auth          |
|--------|------------------|-----------------|---------------|
| GET    | /api/visas       | List visas      | Authenticated |
| POST   | /api/visas       | Create visa     | Authenticated |
| GET    | /api/visas/:id   | Get visa        | Authenticated |
| PUT    | /api/visas/:id   | Update visa     | Authenticated |
| DELETE | /api/visas/:id   | Delete visa     | Authenticated |

### Payments
| Method | Endpoint            | Description      | Auth          |
|--------|---------------------|------------------|---------------|
| GET    | /api/payments       | List payments    | Authenticated |
| POST   | /api/payments       | Create payment   | Authenticated |
| GET    | /api/payments/:id   | Get payment      | Authenticated |
| PUT    | /api/payments/:id   | Update payment   | Authenticated |
| DELETE | /api/payments/:id   | Delete payment   | Authenticated |

### Notifications
| Method | Endpoint                       | Description               | Auth          |
|--------|--------------------------------|---------------------------|---------------|
| GET    | /api/notifications             | Get user notifications    | Authenticated |
| POST   | /api/notifications             | Create notification       | Authenticated |
| PUT    | /api/notifications/read-all    | Mark all as read          | Authenticated |
| PUT    | /api/notifications/:id/read    | Mark one as read          | Authenticated |
| DELETE | /api/notifications/:id         | Delete notification       | Authenticated |

### Notifications
| Method | Endpoint                           | Description               | Auth          |
|--------|------------------------------------|---------------------------|---------------|
| GET    | /api/notifications                 | Get user notifications    | Authenticated |
| POST   | /api/notifications                 | Create notification       | Authenticated |
| PUT    | /api/notifications/read-all        | Mark all as read (CRM)    | Authenticated |
| PATCH  | /api/notifications/read-all        | Mark all as read (portal) | Authenticated |
| PUT    | /api/notifications/:id/read        | Mark one as read (CRM)    | Authenticated |
| PATCH  | /api/notifications/:id/read        | Mark one as read (portal) | Authenticated |
| DELETE | /api/notifications/:id             | Delete notification       | Authenticated |

Query params: `?limit=20`

### Messages
| Method | Endpoint                               | Description                        | Auth          |
|--------|----------------------------------------|------------------------------------|---------------|
| GET    | /api/messages/conversations            | List conversations                 | Authenticated |
| POST   | /api/messages/conversations            | Create conversation                | Authenticated |
| POST   | /api/messages/conversation             | Find or create 1-on-1 conversation | Authenticated |
| POST   | /api/messages/send                     | Send message (body + conversationId)| Authenticated |
| GET    | /api/messages/:conversationId          | Get messages                       | Authenticated |
| POST   | /api/messages/:conversationId          | Send message (legacy)              | Authenticated |

### Dashboard
| Method | Endpoint                  | Description        | Auth          |
|--------|---------------------------|--------------------|---------------|
| GET    | /api/dashboard/stats      | Pipeline stats     | Authenticated |
| GET    | /api/dashboard/reports    | Monthly reports    | Authenticated |

### Health
| Method | Endpoint      | Description  | Auth |
|--------|---------------|--------------|------|
| GET    | /api/health   | Health check | No   |

---

## Role Permissions Matrix

| Feature                | super_admin | admin | counsellor_manager | counsellor | finance | accountant | visa_team | doc_verification | university_team | support |
|------------------------|:-----------:|:-----:|:------------------:|:----------:|:-------:|:----------:|:---------:|:----------------:|:---------------:|:-------:|
| Dashboard              | Yes         | Yes   | Yes                | Yes        | Yes     | Yes        | Yes       | Yes              | Yes             | Yes     |
| Leads (view/create)    | Yes         | Yes   | Yes                | Yes        | Yes     | Yes        | No        | No               | Yes             | Yes     |
| Students               | Yes         | Yes   | Yes                | Yes        | Yes     | Yes        | Yes       | Yes              | Yes             | Yes     |
| Applications           | Yes         | Yes   | Yes                | Yes        | No      | No         | No        | No               | Yes             | No      |
| Visa Tracker           | Yes         | Yes   | Yes                | Yes        | No      | No         | Yes       | No               | No              | No      |
| Documents              | Yes         | Yes   | Yes                | Yes        | No      | No         | No        | Yes              | No              | No      |
| Doc Approve/Reject     | Yes         | Yes   | No                 | No         | No      | No         | No        | Yes              | No              | No      |
| Finance                | Yes         | Yes   | No                 | No         | Yes     | Yes        | No        | No               | No              | No      |
| Reports                | Yes         | Yes   | Yes                | No         | No      | No         | No        | No               | No              | No      |
| Settings               | Yes         | Yes   | No                 | No         | No      | No         | No        | No               | No              | No      |
| Create Users           | Yes         | Yes   | No                 | No         | No      | No         | No        | No               | No              | No      |

---

## Key Features

### CRM
- **Lead Pipeline**: Kanban board with drag-and-drop status updates across 7 stages
- **Student 360 Profile**: Tabbed profile with stage tracker, applications, documents, visa, payments, and notes
- **Stage Tracker**: Visual vertical pipeline from Inquiry to Departure (10 stages, clickable to advance)
- **Document Workflow**: Upload, review, approve/reject with versioning support
- **Visa Tracker**: Stage-by-stage visa progress with date milestones
- **Finance Module**: Payment recording, mark-as-paid, receipt links
- **Reports**: Monthly KPIs, student pipeline and lead funnel charts
- **RBAC**: Role-based access control on every API route and UI nav item
- **Create Portal Account**: CRM counsellors can issue student portal login credentials from the student profile page

### Student Portal
- **Journey Dashboard**: Home screen with stage progress bar, counsellor card, pending docs and payments at a glance
- **10-Stage Tracker**: Visual pipeline with stage-specific tips and profile summary
- **Document Upload**: Multipart file upload with real-time status tracking (uploaded → under review → approved/rejected)
- **Applications**: View all university applications with offer dates, deadlines and tuition fees
- **Payments**: Payment history with overdue detection, receipt downloads, total paid/pending summary
- **Real-time Chat**: Direct message with assigned counsellor via Socket.io, typing indicators, read receipts
- **Notifications**: In-app notification list with mark-as-read
- **Profile Management**: Edit personal info, education, preferences and change password across 4-tab form
- **PWA**: Installable (manifest.ts), works on mobile with bottom nav, landscape-blue theme

### Shared
- **Real-time**: Socket.io for messaging and typing indicators
- **Dark/Light Theme**: Tailwind v4 CSS variable theming with localStorage persistence
- **Toast Notifications**: Animated success/error/info toasts
- **Optimistic UI**: Instant feedback with server sync

---

## Tech Stack

| Layer       | Tech                                          |
|-------------|-----------------------------------------------|
| Backend API | Node.js, Express 4, TypeScript                |
| Database    | MongoDB with Mongoose 8                       |
| Auth        | JWT (jsonwebtoken), bcryptjs                  |
| Real-time   | Socket.io 4                                   |
| CRM App     | Next.js 16, React 19, TypeScript              |
| Styling     | Tailwind CSS v4 with @tailwindcss/postcss     |
| State       | Zustand 4 (auth store)                        |
| HTTP Client | Axios 1.7                                     |
| Fonts       | Geist (Google Fonts via next/font)            |
