# TaskFlow — Full-Stack Productivity & To-Do Workspace

A modern, full-stack productivity workspace built with **FastAPI**, **SQLAlchemy 2.0**, and **Vanilla JavaScript**. Features an interactive List view, drag-and-drop **Kanban Board**, and a complete **Activity & Task History Timeline** with one-click task restoration.

**Live Demo:** [https://todo-list-app-one-sable.vercel.app](https://todo-list-app-one-sable.vercel.app)

## Features

- **Rich Task Metadata:** Priority levels (`Low`, `Medium`, `High 🔥`), categories (`General`, `Work`, `Study`, `Personal`, `Health`, `Coding`), due dates with overdue detection, and workflow stages (`To Do`, `In Progress`, `Done`).
- **3 Interactive Views:**
  - **List View:** Drag-and-drop reordering, completion checkboxes, double-click inline editing, and quick filters.
  - **Kanban Board View:** Drag tasks across `To Do`, `In Progress`, and `Done` columns with live column counters.
  - **Activity History Timeline:** Automatic audit log of every task created, completed, reopened, moved, edited, deleted, or restored — with filter pills and **one-click Restore** for deleted tasks.
- **Search, Filters & Live Progress Bar:** Instant search by title or category, filter tabs (`All`, `Active`, `Completed`, `🔥 High Priority`), category selector, and animated completion progress bar.
- **Delight & Personalization:** Celebration confetti burst on task completion, synthesized Web Audio sound effects (with mute toggle), completion streak counter, and persistent Dark / Light theme switcher.
- **Zero-Config Database Switching:** Uses PostgreSQL in production (`POSTGRES_URL` / `DATABASE_URL`) and SQLite locally (with automatic schema migration).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Python 3.12 · FastAPI · Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Validation | Pydantic v2 |
| Database | PostgreSQL (production) · SQLite (local/serverless fallback) |
| Frontend | HTML5 · CSS3 (Glassmorphism + Dark/Light themes) · Vanilla JS |
| Deployment | Vercel |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks ordered by position |
| `POST` | `/api/tasks` | Create a task (`title`, `priority`, `category`, `due_date`, `status`) |
| `PATCH` | `/api/tasks/{id}` | Update task fields, toggle completion, or move Kanban stage |
| `POST` | `/api/tasks/reorder` | Persist drag-and-drop ordering and Kanban column changes |
| `DELETE` | `/api/tasks/completed` | Bulk clear all completed tasks |
| `DELETE` | `/api/tasks/{id}` | Delete a task by ID (logged in history) |
| `GET` | `/api/history` | List activity history timeline (`?action=created\|completed\|moved\|edited\|deleted`) |
| `POST` | `/api/history/{id}/restore` | Restore a deleted task from history back to the board |
| `DELETE` | `/api/history` | Clear activity history log |

## Local Development

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python ToDoList.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser. Interactive Swagger docs are available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).
