# TAPMI Timeline

Build a modern, sleek academic deadline and quiz tracker portal for the TAPMI IPM batch (2026–2031). Connect it with Supabase for backend and auth.

Features to include:

Public dashboard with filterable views (All, Quizzes, Assignments, Presentations, Midterms/Endterms), search bar, and calendar/timeline toggle.

Supabase Auth with Role-Based Access: 'student' (read-only) and 'mod'/'admin' (can create, edit, and delete deadlines).

Hide all action buttons (Add, Edit, Delete) for non-authenticated users or standard students.

A protected /admin or modal dashboard where moderators can manage upcoming deadlines and assign subjects, due dates, submission links, and group/individual tags.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tapmi-zenith.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7018199b-4dc2-4ac9-b228-d89c3377561b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
