# StudyCRM — Project Summary

## What It Is

StudyCRM is a study-abroad management platform that tracks students from first inquiry through visa approval and departure. It replaces manual spreadsheets with a structured, real-time system for counselling agencies.

## Three Services

| Service | Who Uses It | Purpose |
|---------|------------|---------|
| Backend API (Express, port 5000) | Internal | Data layer, auth, real-time |
| CRM Dashboard (Next.js, port 3000) | Staff | Manage leads, students, documents, visas, finances |
| Student Portal (Next.js, port 3001) | Students | Track progress, upload documents, pay fees, chat |

## Core Workflow

1. **Lead capture** — staff log enquiries; leads move through a Kanban pipeline (new → contacted → qualified → converted)
2. **Student onboarding** — converted leads become Students; assigned to a counsellor
3. **University selection & applications** — counsellors manage applications per student, tracking offer status
4. **Document collection** — students upload documents; staff review and approve/reject
5. **Visa processing** — visa team tracks each stage from submission to decision
6. **Fee management** — finance team records payments, generates invoices
7. **Messaging** — counsellor and student communicate via built-in chat

## Student Journey (10 Stages)

`inquiry → counselling → university selection → application submitted → offer letter → fee payment → CAS/I-20 → visa filing → visa approved → departure`

## Key Technical Choices

- **MongoDB + Mongoose** — flexible schema suits the varied student data (education history, test scores, preferences)
- **JWT auth with 11 roles** — fine-grained access control across staff functions (counsellor, finance, visa team, etc.)
- **Socket.IO** — real-time notifications and live chat on the same Express instance; no separate websocket server
- **Zustand + localStorage** — lightweight client-side auth state without a session server
- **Tailwind CSS v4** — custom design token system (`bg-base`, `bg-surface`, `text-t1`, etc.) for consistent theming across both frontends
- **Student portal theming** — light-first glassmorphism design (frosted glass surfaces, blue accents, animated background orbs) with an optional dark mode persisted per user

## Stack at a Glance

```
Backend  : Node.js · Express · TypeScript · MongoDB (Mongoose) · Socket.IO · JWT
Frontend : Next.js 16 (App Router) · React 19 · Axios · Zustand · Tailwind CSS v4
```
