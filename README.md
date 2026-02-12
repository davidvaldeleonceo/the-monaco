# Monaco PRO

**The most complete car wash and detailing management platform in the world.**

Monaco PRO is a multi-tenant SaaS application built for car wash and detailing businesses of any size. Track services in real time, manage customers and memberships, handle worker payments with flexible commission structures, and get full financial visibility — all from one dashboard.

## Features

- **Real-Time Service Tracking** — Monitor every vehicle through stages: Waiting → In Service → Notified → Delivered, with live elapsed-time counters
- **Customer & Membership Management** — Customer profiles, license plate lookup, membership plans with automatic renewal dates, discounts, and cashback
- **Financial Dashboard** — Full income/expense tracking by category, multiple payment methods, and instant balance summaries
- **Worker Payment Engine** — Flexible pay structures: percentage-based, fixed salary, per-service, per-addon, or any combination
- **Advanced Reporting** — Charts, KPIs, PDF & Excel exports with date-range filtering by day, week, month, or year
- **Task Control** — Recurring daily/weekly maintenance tasks with per-worker tracking and completion history
- **CSV Import** — Bulk import customers and services with validation and duplicate detection
- **Multi-Tenant Architecture** — Complete data isolation per business with Row Level Security
- **Mobile-Ready** — Fully responsive dark-mode UI designed for use on the shop floor

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router |
| Backend & Auth | Supabase (PostgreSQL + RLS + Auth) |
| Charts | Recharts |
| Exports | jsPDF, ExcelJS |
| UI | Lucide Icons, React Select, React DatePicker |
| Hosting | Vercel |

## Getting Started

```bash
npm install
npm run dev
```

Set up your Supabase project and configure the environment variables in `supabaseClient.js`.
