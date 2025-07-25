# QR Attendance System

Create a full-stack QR-based attendance system that runs locally for course sessions.

---

## TECH STACK
- **Backend:** Node.js (Express) + MongoDB
- **Frontend:** React (or Next.js)
- **QR:** Use a QR code generator library
- **Styling:** Tailwind CSS
- **Local development friendly**, no Railway or cloud deployment setup

---

## FUNCTIONAL ROLES

### 1. Admin
- Can see all instructors, all courses, all attendance.
- Can manage (view/edit/delete) everything.

### 2. Instructor (Authenticated)
- Can log in via email/password.
- Can create courses.
- Can create sessions (each with: courseId, start time, end time, entry/exit type).
- Each session generates a unique QR token. Instructor can show this QR on a fullscreen page (for projecting to students).
- Can view attendance data **only for their own courses**.

### 3. Participant (No login)
- Scans the QR code.
- Redirected to a form at `http://<LAN-IP>:3000/attend/:sessionToken`.
- Form fields: name, surname.
- On submit, data is POSTed to backend with the sessionToken, and stored in DB as attendance.

---

## DATABASE STRUCTURE
Use MongoDB with these collections:

- **Users:** `{ _id, name, email, passwordHash, role: 'admin' or 'instructor' }`
- **Courses:** `{ _id, name, instructorId }`
- **Sessions:** `{ _id, courseId, qrToken, date, timeStart, timeEnd, type: 'entry' | 'exit' }`
- **Attendances:** `{ _id, sessionId, name, surname, timestamp, ip }`

---

## BACKEND ROUTES EXAMPLES
- `POST /auth/login`
- `POST /courses` (instructor only)
- `POST /sessions` (instructor only)
- `GET /sessions/:id/attendances` (instructor or admin)
- `POST /attend` (public): receives `{ token, name, surname }`

---

## FRONTEND PAGES
- `/admin`: Admin panel
- `/instructor/dashboard`: Instructor dashboard
- `/instructor/courses`: Course & session creation
- `/attend/[token]`: Public form page opened via QR scan

---

## QR GENERATION
When instructor creates a session:
- Generate a UUID token.
- Store with session.
- Generate a QR image from: `http://<LAN-IP>:3000/attend/<token>`

Use libraries like `qrcode.react` or `qrcode-generator` to render QR code.

---

## LOCAL DEVELOPMENT
Make sure system runs entirely locally:
- Use `localhost` and/or `192.168.x.x` IP for testing on multiple devices.
- No cloud dependencies.
- Include `.env.example` for backend:
  - MONGO_URI
  - JWT_SECRET
  - PORT

---

## EXTRA FEATURES (Optional but nice to have)
- Instructor QR display page (`/instructor/session/:id/qr`) with fullscreen mode.
- Prevent multiple attendance from same IP/token/name.
- Export attendance as CSV.
- Show real-time submissions to instructor during active session. 