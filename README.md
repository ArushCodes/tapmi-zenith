# TAPMI Zenith

A modern, sleek academic deadline and timetable tracker for the TAPMI IPM batch (2026–2031). Built with React, TanStack Start, and Supabase.

## Features

- **Dashboard**: Filterable views (All, Quizzes, Assignments, Presentations, Exams)
- **Authentication**: Email/password auth with domain restriction (@learner.manipal.edu)
- **Role-Based Access**: Student (read-only) and Moderator/Admin (create, edit, delete)
- **Deadline Management**: Create and manage deadlines with types and submission links
- **Timetable**: Automatic timetable sync from Registro
- **Attendance**: Track attendance across batches
- **Grading**: Component-based marking with pass rules
- **Announcements**: Batch-level communication
- **Calendar**: Visual deadline calendar with marker shapes

## Setup

### Prerequisites

- Node.js 18+ with npm (or use [nvm](https://github.com/nvm-sh/nvm))
- A Supabase account with a project set up

### Local Development

```sh
git clone https://github.com/ArushCodes/tapmi-zenith.git
cd tapmi-zenith
npm i
npm run dev
```

Visit `http://localhost:5173` to see the app.

### Environment Variables

Create a `.env.local` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
CRON_SECRET=your-secret-for-scheduled-syncs
```

Get these values from your Supabase dashboard:
1. Go to Settings → API
2. Copy Project URL and `anon` public key

## Deployment

### Deploy to Vercel

```sh
npm i -g vercel
vercel
```

During setup:
- Link your GitHub repository
- Set environment variables in Vercel dashboard
- Deploy automatically on push to `main`

### Setting up Supabase

1. Create a Supabase project
2. Run all migrations from `/supabase/migrations` in the SQL editor
3. Set up authentication:
   - Enable Email/Password provider
   - Configure email templates
4. Add your Supabase URL and keys to Vercel env variables

## Tech Stack

- **Frontend**: React 19, TypeScript, TanStack Router, TanStack Query
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: TanStack Start (Node.js SSR)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Build**: Vite

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier

## Architecture

- **Full-stack SSR**: Server-side rendering via TanStack Start
- **Batch-scoped**: All data is scoped to batches for multi-tenant support
- **Row-level security**: PostgreSQL policies enforce access control
- **Email verification**: Signed up users must verify email before access
- **Role-based access**: Admins and moderators manage content
- **Cron jobs**: Automated timetable sync from external sources
