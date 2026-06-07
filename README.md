# TaskFlow — Full-Stack Task Manager

> A production-grade Task Manager built with **React + Django REST Framework**, featuring authentication, pagination, real-time filtering, and a premium UI.

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS v4   |
| Backend   | Django 6 + Django REST Framework    |
| Auth      | Token Authentication (DRF)          |
| Database  | SQLite (dev) — swap for PostgreSQL  |
| HTTP      | Axios                               |

---

## Features

### Frontend (React)
- ✅ **Add Task** — collapsible inline create form with validation
- ✅ **Edit Task** — modal overlay, pre-filled with current data
- ✅ **Delete Task** — inline confirmation (no browser dialogs)
- ✅ **View All Tasks** — paginated list, 6 per page
- ✅ **Pagination** — smart page number controls with ellipsis
- ✅ **Filter by Status** — All / Pending / In Progress / Completed tabs
- ✅ **Sort** — Newest First / Due Date / Priority / Title A–Z
- ✅ **Search** — debounced search across title + description
- ✅ **Quick Status Change** — Start / Pause buttons on each card
- ✅ **Reports Tab** — radial completion chart + status bar chart + summary
- ✅ **Notifications** — overdue alerts + in-progress count
- ✅ **Authentication** — Login / Register / Logout
- ✅ **Responsive** — works on mobile, tablet, and desktop

### Backend (Django API)
| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | `/api/auth/register/` | Register new user        |
| POST   | `/api/auth/login/`    | Login, returns token     |
| POST   | `/api/auth/logout/`   | Invalidate token         |
| GET    | `/api/auth/user/`     | Current user info        |
| GET    | `/api/tasks/`         | List tasks (paginated)   |
| POST   | `/api/tasks/`         | Create task              |
| GET    | `/api/tasks/{id}/`    | Get single task          |
| PATCH  | `/api/tasks/{id}/`    | Update task (partial)    |
| DELETE | `/api/tasks/{id}/`    | Delete task              |
| GET    | `/api/tasks/stats/`   | Aggregate counts         |
| GET    | `/api/projects/`      | List projects            |
| POST   | `/api/projects/`      | Create project           |

### Query Parameters (GET /api/tasks/)
| Param      | Description                              | Example             |
|------------|------------------------------------------|---------------------|
| `status`   | Filter by status                         | `status=Pending`    |
| `search`   | Full-text search on title + description  | `search=deploy`     |
| `ordering` | Sort field                               | `ordering=priority` |
| `page`     | Page number                              | `page=2`            |
| `page_size`| Results per page (max 50)                | `page_size=10`      |

---

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1 — Clone & setup

```bash
git clone <repo-url>
cd task2
```

### 2 — Backend

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
cd backend
pip install django djangorestframework django-cors-headers

# Apply migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Start server
python manage.py runserver
```

Backend runs at: **http://127.0.0.1:8000**

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Project Structure

```
task2/
├── backend/
│   ├── backend/          # Django project config
│   │   ├── settings.py
│   │   └── urls.py
│   └── tasks/            # Main app
│       ├── models.py     # Task, Project models
│       ├── serializers.py
│       ├── views.py      # ViewSets + Auth views + stats action
│       ├── pagination.py # Custom PageNumberPagination
│       └── urls.py
└── frontend/
    └── src/
        ├── components/
│       │   ├── Auth.jsx      # Login / Register
│       │   └── Dashboard.jsx # Main UI (tasks + reports)
│       ├── context/
│       │   └── AuthContext.jsx
│       └── services/
│           └── api.js        # Axios service layer
```

---

## API Response Format (Paginated)

```json
{
  "count": 25,
  "total_pages": 5,
  "current_page": 1,
  "page_size": 6,
  "next": "http://127.0.0.1:8000/api/tasks/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Deploy to production",
      "description": "Deploy the new release to the prod server.",
      "status": "In Progress",
      "priority": "High",
      "due_date": "2026-06-30",
      "created_at": "2026-06-07T09:00:00Z",
      "updated_at": "2026-06-07T09:30:00Z",
      "project": null,
      "project_name": null
    }
  ]
}
```

---

## Task Fields

| Field        | Type     | Required | Notes                               |
|--------------|----------|----------|-------------------------------------|
| `title`      | string   | ✅ Yes   | Max 200 chars                       |
| `description`| string   | No       | Free text                           |
| `status`     | string   | No       | Pending / In Progress / Completed   |
| `priority`   | string   | No       | Low / Medium / High                 |
| `due_date`   | date     | No       | YYYY-MM-DD or null                  |
| `created_at` | datetime | Auto     | Set on creation                     |
| `updated_at` | datetime | Auto     | Updated on every save               |

---

## Deployment Notes

For production deployment:
1. Set `DEBUG = False` in `settings.py`
2. Set a secure `SECRET_KEY` from environment variable
3. Configure `ALLOWED_HOSTS` with your domain
4. Switch to PostgreSQL database
5. Set up static file serving (WhiteNoise or nginx)
6. Build frontend: `npm run build` — serve the `dist/` folder
