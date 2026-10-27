# To-Do List App

A full-stack To-Do List application with a FastAPI backend, SQLAlchemy ORM, and a Vanilla JavaScript frontend. Supports PostgreSQL (Vercel) and SQLite (local) automatically.

## Features

- Add, view, and delete tasks via a REST API
- Tasks identified by stable database IDs (not fragile array indices)
- Input validation: empty titles and titles over 500 characters are rejected with clear errors
- PostgreSQL in production (via `POSTGRES_URL`), SQLite locally — zero-config switching
- Interactive API docs at `/docs` (FastAPI Swagger UI)
- Deployable to Vercel (serverless Python)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | Python 3.12 · FastAPI · Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Validation | Pydantic v2 |
| Database | PostgreSQL (production) · SQLite (local) |
| Frontend | HTML5 · CSS3 · Vanilla JavaScript |
| Deployment | Vercel |

## Local Development

### Prerequisites
- Python 3.12+

### Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd todo-list-app

# 2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the development server
python ToDoList.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.  
API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

A `tasks.db` SQLite file is created automatically in the project root — it is listed in `.gitignore`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | PostgreSQL connection string (Vercel Postgres format) |
| `DATABASE_URL` | SQLAlchemy-compatible DB URL (alternative to `POSTGRES_URL`) |

If neither is set, SQLite is used automatically for local development.

## API Reference

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks` | — | List all tasks (`[{id, title}]`) |
| POST | `/api/tasks` | `{"title": "..."}` | Add a task |
| DELETE | `/api/tasks/{id}` | — | Delete a task by its database ID |

Tasks are returned as `{"id": int, "title": str}` objects. The `id` is a stable database primary key.

## Running Tests

```bash
pip install pytest httpx
pytest tests/ -v
```

Tests run against an in-memory SQLite database — no setup required.

## Vercel Deployment

1. Connect the repository to Vercel.
2. Add a **Vercel Postgres** database in the Vercel dashboard (sets `POSTGRES_URL` automatically), or configure any PostgreSQL `POSTGRES_URL` manually.
3. Deploy — Vercel runs the FastAPI app via `@vercel/python`.

## Project Structure

```
todo-list-app/
├── ToDoList.py         # FastAPI application and SQLAlchemy models
├── index.html          # Frontend HTML
├── style.css           # Frontend styles
├── script.js           # Frontend JavaScript (fetches the API)
├── requirements.txt
├── vercel.json
├── .env.example
└── tests/
    └── test_todo.py    # Pytest test suite (11 tests)
```
