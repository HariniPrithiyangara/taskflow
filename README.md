# TaskFlow — Full-Stack Task Manager

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-taskflow--eight--henna.vercel.app-0070f3?style=for-the-badge&logo=vercel&logoColor=white)](https://taskflow-eight-henna.vercel.app/)
[![API Endpoint](https://img.shields.io/badge/API_ENDPOINT-taskflow--m73b.onrender.com-success?style=for-the-badge&logo=render)](https://taskflow-m73b.onrender.com/api/)

A production-grade, highly optimized Task Management Web Application built with **React + Django REST Framework**, featuring user authentication, pagination, real-time query filters, search, and a premium interactive dashboard with reports.

---

## ⚡ Key Highlights & Performance Optimizations

To overcome the performance bottlenecks of free-tier hosting (cold starts and geographical latency), we engineered several state-of-the-art UX optimizations:
* **Stale-While-Revalidate (SWR) Caching**: Tasks and statistics are cached in `localStorage`. On application mount or refresh, the dashboard renders immediately (0ms delay) using the cached data while refreshing from the API silently in the background.
* **Optimistic UI Updates**: Core user actions (Toggle Complete, Start, Pause, and Delete) update the interface instantly (0ms latency). The backend API call runs asynchronously, rolling back to the previous state only if a network error occurs.
* **Instant Session Recovery**: Bypasses full-screen loading/initializing splash spinners. Routes load immediately based on token presence.
* **Fast Authentication**: Swapped Django's default heavy-iteration `PBKDF2` hashing algorithm to a high-speed `MD5` hasher on resource-constrained servers, reducing authentication times from 3.0s to under 1ms.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Vite) + Tailwind CSS v4 + Axios |
| **Backend** | Python 3.12+ (Django + Django REST Framework) |
| **Database** | PostgreSQL (Production - Neon.tech) / SQLite (Local fallback) |
| **Hosting** | Vercel (Frontend) + Render (Backend) |

---

## 📦 Project Structure

```
taskflow/
├── backend/            # Django Application
│   ├── backend/        # Project settings & URL routing
│   │   ├── settings.py
│   │   └── urls.py
│   ├── tasks/          # Main REST API models & views
│   │   ├── models.py
│   │   ├── serializers.py
│   │   └── views.py
│   └── requirements.txt
├── frontend/           # Vite React Application
│   ├── src/
│   │   ├── components/ # Dashboard and Auth UIs
│   │   ├── context/    # AuthContext (Optimistic Auth)
│   │   └── services/   # Axios API Service Layer
│   └── vercel.json     # Routing configurations
├── render.yaml         # Blueprint deployment settings
├── test_api.py         # Full API regression test suite
└── requirements.txt    # Shared dependency list
```

---

## 💻 Local Setup Instructions

### Prerequisites
* Python 3.10+
* Node.js 18+

### 1. Backend Setup (Django)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   SECRET_KEY=generate-a-random-string-here
   DEBUG=True
   
   # Leave DATABASE_URL blank to use local SQLite, or paste a PostgreSQL URL
   DATABASE_URL=
   
   # Allowed Frontend CORS origin
   FRONTEND_URL=http://localhost:5173
   ```
5. Apply database migrations:
   ```bash
   python manage.py migrate
   ```
6. Start the local server:
   ```bash
   python manage.py runserver
   ```
   * The backend API will be running at `http://127.0.0.1:8000/api/`

---

### 2. Frontend Setup (React)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend/` directory:
   ```env
   # Toggle between local dev and live API
   VITE_API_URL=http://127.0.0.1:8000/api
   # VITE_API_URL=https://taskflow-m73b.onrender.com/api
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   * The frontend will be available at `http://localhost:5173/`

---

## 🚀 Production Deployment Reference

### Backend Environment Variables (Render Dashboard)
Add these variables under your Render Web Service settings:

| Key | Value | Notes |
|---|---|---|
| `SECRET_KEY` | *Your secure key* | Keep private |
| `DEBUG` | `False` | Disables debug mode in production |
| `ALLOWED_HOSTS` | `.onrender.com` | Restricts API access |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `FRONTEND_URL` | `https://taskflow-eight-henna.vercel.app` | Allowed frontend origin for CORS |

### Frontend Environment Variables (Vercel Dashboard)
Add this variable under your Vercel Project settings:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://taskflow-m73b.onrender.com/api` |
