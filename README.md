# Personal Pro

SaaS platform for personal trainers and their clients.

🌐 **Live:** [app.personalpro.fit](https://app.personalpro.fit)
🌐 **Landing:** [personalpro.fit](https://personalpro.fit)

## What it does

Personal Pro is a dual-role platform that solves two problems 
in the same product:

- **For personal trainers:** manage clients, plan workouts, 
  track progress, view client portfolio in a single dashboard.
- **For clients:** access current workout, log execution, 
  track progress over time, stay connected with the trainer 
  between sessions.

The market has apps for gym chains (Tecnofit, Mfit) but not 
for the independent personal trainer — who needs to both manage 
clients and keep engagement between workouts.

## Stack

- **Frontend:** Next.js 15 + TypeScript + shadcn/ui + Tailwind
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** Vercel
- **Database:** ~20 tables with Row-Level Security per user role

## Architecture highlights

- **Conditional routing** via Next.js middleware to separate 
  trainer vs client flows
- **Row-Level Security** at the database layer — authorization 
  enforced in PostgreSQL, not scattered across the frontend
- **TypeScript types** generated from Supabase schema for 
  end-to-end type safety

## Status

MVP in production with end-to-end signup → dashboard flow. 
Under active development.

## Running locally

\`\`\`bash
npm install
cp .env.example .env.local
# fill in your Supabase credentials
npm run dev
\`\`\`

## About

Built solo by [Leonardo Melo](https://github.com/LeonardoMeloLima) 
as part of the Personal Pro product. See [personalpro.fit](https://personalpro.fit) 
for the full landing page.
