# Online Examination Management System (OEMS) — DBMS Capstone

Stack: HTML5/CSS3/vanilla JS · Node.js + Express · MySQL 8 (`database/schema.sql`).

## Project structure
```
oems/
├─ database/schema.sql      # tables, FKs, indexes, sample data
├─ server/                  # Express API (JWT auth, role middleware, MySQL via mysql2)
│  ├─ server.js  package.json  .env.example
└─ public/                  # Frontend (served by Express, or open index.html directly)
   ├─ index.html (login) student.html admin.html
   ├─ css/style.css
   └─ js/ demo-data.js common.js student.js admin.js
```

## Demo credentials
| Portal  | Email               | Password    |
|---------|---------------------|-------------|
| Student | student1@exam.demo  | Student@123 |
| Admin   | admin@exam.demo     | Admin@123   |
(student1…student24@exam.demo share the password; student11 and student22 are inactive.)

## Quick start (demo mode, no database needed)
1. Install VS Code and Node.js LTS (https://nodejs.org). Check: `node -v`.
2. VS Code → File → Open Folder → `oems`. Open terminal (Ctrl+`).
3. `cd server` → `npm install` → `npm start` → open http://localhost:3000
   (Alternative: install the "Live Server" extension and open `public/index.html`.)

## MySQL setup (integration phase)
1. Install MySQL 8 and ensure the service is running.
2. `mysql -u root -p < database/schema.sql` (creates DB `oems`, tables, sample rows).
3. `cd server && copy .env.example .env` (Windows) / `cp .env.example .env`; set `DB_PASSWORD`, `JWT_SECRET`.
4. `npm start`, then check http://localhost:3000/api/health → `{"ok":true,"db":"connected"}`.

## What is simulated vs. database-backed
| Feature | Demo (now) | Needs DB (integration phase) |
|---|---|---|
| Login, sessions | Checked against `localStorage` demo users | `POST /api/auth/login` (JWT, SHA-256 demo hash) |
| All CRUD (students, admins, subjects, exams, questions, announcements) | `demo-data.js` store | `/api/admin/<entity>` routes (implemented) |
| Enrollment, exams list, question fetch, submission + MCQ auto-grading | Browser-side | `/api/student/*` (grading server-side; answers never exposed) |
| Evaluation, result publication, notifications | Browser-side | `/api/admin/evaluate`, `/exams/:id/publish` |
| Audit logs, settings, CSV export | Browser-side | `/api/admin/audit`, `/settings`, `/export/results.csv` |
| Live exam monitoring | **Simulated** random progress | `GET /api/admin/monitor` (reads attempts) |
| Exam timer, palette, mark-for-review, answer persistence | Real client logic (sessionStorage) | Add server-side start time for tamper resistance |

**Integration steps:** replace functions that read/write `DB` in `public/js/*.js` with `fetch('/api/...', {headers:{Authorization:'Bearer '+token}})`. Store the JWT at login. Field mapping: frontend `sid/start/end/duration/total` ↔ DB `subject_id/start_time/end_time/duration_min/total_marks`; `roll` ↔ `roll_no`; question `ans` is 0-based `correct_option`.

## Database design (3NF)
users · subjects · enrollments (M:N) · exams · questions · attempts (UNIQUE exam,user) · answers · results · notifications · announcements · audit_logs · settings. Foreign keys cascade on delete; indexes on attempts(user) and exams(time). Submission uses a transaction.

## Security notes (for the viva)
Role-based JWT middleware; parameterized queries (SQL-injection safe); correct answers never sent to students. Demo passwords are plain SHA-256 — **for production use bcrypt** (`bcryptjs`) with salts.

## Troubleshooting
- `npm: command not found` → reinstall Node.js, restart VS Code.
- `ECONNREFUSED 3306` → MySQL service not running; start it.
- `ER_ACCESS_DENIED_ERROR` → wrong `DB_USER/DB_PASSWORD` in `.env`.
- `ER_BAD_DB_ERROR` → run `schema.sql` first.
- Port 3000 busy → set `PORT=3001` in `.env`.
- Blank/odd demo state → click "Reset demo data" (top banner).
- Login fails after DB switch → seed hashes use `SHA2(...,256)`; passwords must match exactly.
- Exam refreshed mid-attempt → timer and answers restore from sessionStorage when you click Start again.
