"""To-Do List REST API — FastAPI + SQLAlchemy backend with Kanban, Priorities, Stats & History."""
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.resolve()

DATABASE_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    sqlite_dir = Path("/tmp") if os.environ.get("VERCEL") else BASE_DIR
    sqlite_path = sqlite_dir / "tasks.db"
    DATABASE_URL = f"sqlite:///{sqlite_path}"
    engine = create_engine(str(DATABASE_URL), connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

VALID_PRIORITIES = {"low", "medium", "high"}
VALID_STATUSES = {"todo", "in_progress", "done"}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class TaskModel(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), index=True, nullable=False)
    priority = Column(String(20), default="medium", nullable=False)
    category = Column(String(50), default="General", nullable=False)
    due_date = Column(String(30), nullable=True)
    status = Column(String(20), default="todo", nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(String(40), default=now_iso, nullable=False)
    completed_at = Column(String(40), nullable=True)


class TaskHistoryModel(Base):
    __tablename__ = "task_history"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, nullable=True, index=True)
    task_title = Column(String(500), nullable=False)
    action = Column(String(30), nullable=False)  # created, completed, reopened, moved, edited, deleted, restored
    details = Column(String(500), nullable=True)
    category = Column(String(50), nullable=True)
    priority = Column(String(20), nullable=True)
    timestamp = Column(String(40), default=now_iso, nullable=False)


def ensure_schema():
    """Create tables and migrate any missing columns on existing databases."""
    Base.metadata.create_all(bind=engine)
    try:
        inspector = inspect(engine)
        existing_cols = {c["name"] for c in inspector.get_columns("tasks")}
        migrations = [
            ("priority", "VARCHAR(20) DEFAULT 'medium' NOT NULL"),
            ("category", "VARCHAR(50) DEFAULT 'General' NOT NULL"),
            ("due_date", "VARCHAR(30)"),
            ("status", "VARCHAR(20) DEFAULT 'todo' NOT NULL"),
            ("completed", "BOOLEAN DEFAULT FALSE NOT NULL"),
            ("position", "INTEGER DEFAULT 0 NOT NULL"),
            ("created_at", f"VARCHAR(40) DEFAULT '{now_iso()}' NOT NULL"),
            ("completed_at", "VARCHAR(40)"),
        ]
        with engine.begin() as conn:
            for col_name, col_def in migrations:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE tasks ADD COLUMN {col_name} {col_def}"))
    except Exception:
        pass


ensure_schema()

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(title="ToDo List API", version="2.0.0")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def serialize_task(t: TaskModel) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "priority": t.priority or "medium",
        "category": t.category or "General",
        "due_date": t.due_date,
        "status": t.status or ("done" if t.completed else "todo"),
        "completed": bool(t.completed),
        "position": t.position or 0,
        "created_at": t.created_at,
        "completed_at": t.completed_at,
    }


def serialize_history(h: TaskHistoryModel) -> dict:
    return {
        "id": h.id,
        "task_id": h.task_id,
        "task_title": h.task_title,
        "action": h.action,
        "details": h.details,
        "category": h.category or "General",
        "priority": h.priority or "medium",
        "timestamp": h.timestamp,
    }


def record_history(
    db: Session,
    task_id: Optional[int],
    task_title: str,
    action: str,
    details: str = "",
    category: str = "General",
    priority: str = "medium",
):
    entry = TaskHistoryModel(
        task_id=task_id,
        task_title=task_title,
        action=action,
        details=details,
        category=category,
        priority=priority,
        timestamp=now_iso(),
    )
    db.add(entry)


def get_ordered_tasks(db: Session) -> List[dict]:
    tasks = db.query(TaskModel).order_by(TaskModel.position.asc(), TaskModel.id.asc()).all()
    return [serialize_task(t) for t in tasks]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    priority: str = "medium"
    category: str = "General"
    due_date: Optional[str] = None
    status: str = "todo"

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Task title cannot be empty.")
        if len(v) > 500:
            raise ValueError("Task title must be 500 characters or fewer.")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        v = (v or "medium").lower().strip()
        if v not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of {sorted(VALID_PRIORITIES)}.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        v = (v or "todo").lower().strip()
        if v not in VALID_STATUSES:
            raise ValueError(f"Status must be one of {sorted(VALID_STATUSES)}.")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        v = (v or "General").strip()
        return v[:50] if v else "General"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    completed: Optional[bool] = None
    position: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Task title cannot be empty.")
        if len(v) > 500:
            raise ValueError("Task title must be 500 characters or fewer.")
        return v

    @field_validator("priority")
    @classmethod
    def priority_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.lower().strip()
        if v not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of {sorted(VALID_PRIORITIES)}.")
        return v

    @field_validator("status")
    @classmethod
    def status_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.lower().strip()
        if v not in VALID_STATUSES:
            raise ValueError(f"Status must be one of {sorted(VALID_STATUSES)}.")
        return v


class ReorderItem(BaseModel):
    id: int
    position: int
    status: Optional[str] = None


class ReorderRequest(BaseModel):
    items: List[ReorderItem]


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@app.get("/api/tasks", summary="List all tasks")
def get_tasks(db: Session = Depends(get_db)):
    return {"tasks": get_ordered_tasks(db)}


@app.post("/api/tasks", status_code=201, summary="Add a new task")
def add_task(task: TaskCreate, db: Session = Depends(get_db)):
    max_pos_row = db.query(TaskModel).order_by(TaskModel.position.desc()).first()
    next_pos = (max_pos_row.position + 1) if max_pos_row and max_pos_row.position is not None else 0
    is_done = task.status == "done"
    ts = now_iso()

    new_task = TaskModel(
        title=task.title,
        priority=task.priority,
        category=task.category,
        due_date=task.due_date or None,
        status=task.status,
        completed=is_done,
        position=next_pos,
        created_at=ts,
        completed_at=ts if is_done else None,
    )
    db.add(new_task)
    db.flush()

    record_history(
        db,
        task_id=new_task.id,
        task_title=new_task.title,
        action="created",
        details=f"Added to {new_task.category} ({new_task.priority.capitalize()} priority)",
        category=new_task.category,
        priority=new_task.priority,
    )
    db.commit()
    db.refresh(new_task)

    return {
        "message": "Task added successfully.",
        "task": serialize_task(new_task),
        "tasks": get_ordered_tasks(db),
    }


@app.patch("/api/tasks/{task_id}", summary="Update a task")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task with id={task_id} not found.")

    changes = []
    action_type = "edited"
    old_completed = bool(task.completed)
    old_status = task.status or "todo"

    if payload.title is not None and payload.title != task.title:
        old_title = task.title
        task.title = payload.title
        changes.append(f'Renamed from "{old_title}" to "{payload.title}"')

    if payload.priority is not None and payload.priority != task.priority:
        task.priority = payload.priority
        changes.append(f"Priority set to {payload.priority.capitalize()}")

    if payload.category is not None:
        clean_cat = payload.category.strip()[:50] or "General"
        if clean_cat != task.category:
            task.category = clean_cat
            changes.append(f"Category changed to {clean_cat}")

    if "due_date" in payload.model_fields_set:
        task.due_date = payload.due_date or None
        changes.append(f"Due date set to {task.due_date or 'None'}")

    if payload.position is not None:
        task.position = payload.position

    # Synchronize status and completed boolean
    if payload.completed is not None and payload.status is None:
        task.completed = payload.completed
        task.status = "done" if payload.completed else (
            "todo" if old_status == "done" else old_status
        )
    elif payload.status is not None:
        task.status = payload.status
        task.completed = payload.status == "done"

    if task.completed and not old_completed:
        task.completed_at = now_iso()
        action_type = "completed"
        changes.append("Marked as completed")
    elif not task.completed and old_completed:
        task.completed_at = None
        action_type = "reopened"
        changes.append(f"Reopened ({task.status.replace('_', ' ').title()})")
    elif task.status != old_status:
        action_type = "moved"
        status_label = {"todo": "To Do", "in_progress": "In Progress", "done": "Done"}.get(
            task.status, task.status
        )
        changes.append(f"Moved to {status_label}")

    if changes:
        record_history(
            db,
            task_id=task.id,
            task_title=task.title,
            action=action_type,
            details=" · ".join(changes),
            category=task.category,
            priority=task.priority,
        )

    db.commit()
    db.refresh(task)
    return {
        "message": "Task updated.",
        "task": serialize_task(task),
        "tasks": get_ordered_tasks(db),
    }


@app.post("/api/tasks/reorder", summary="Batch reorder tasks and update Kanban status")
def reorder_tasks(payload: ReorderRequest, db: Session = Depends(get_db)):
    for item in payload.items:
        task = db.query(TaskModel).filter(TaskModel.id == item.id).first()
        if not task:
            continue
        task.position = item.position
        if item.status and item.status in VALID_STATUSES and item.status != task.status:
            old_completed = bool(task.completed)
            task.status = item.status
            task.completed = item.status == "done"
            if task.completed and not old_completed:
                task.completed_at = now_iso()
                record_history(
                    db,
                    task_id=task.id,
                    task_title=task.title,
                    action="completed",
                    details="Dragged to Done column",
                    category=task.category,
                    priority=task.priority,
                )
            elif not task.completed and old_completed:
                task.completed_at = None
                status_label = {"todo": "To Do", "in_progress": "In Progress"}.get(
                    task.status, task.status
                )
                record_history(
                    db,
                    task_id=task.id,
                    task_title=task.title,
                    action="reopened",
                    details=f"Moved back to {status_label}",
                    category=task.category,
                    priority=task.priority,
                )
            else:
                status_label = {"todo": "To Do", "in_progress": "In Progress", "done": "Done"}.get(
                    task.status, task.status
                )
                record_history(
                    db,
                    task_id=task.id,
                    task_title=task.title,
                    action="moved",
                    details=f"Moved to {status_label}",
                    category=task.category,
                    priority=task.priority,
                )
    db.commit()
    return {"message": "Tasks reordered.", "tasks": get_ordered_tasks(db)}


@app.delete("/api/tasks/completed", summary="Clear all completed tasks")
def clear_completed_tasks(db: Session = Depends(get_db)):
    completed_tasks = db.query(TaskModel).filter(TaskModel.completed.is_(True)).all()
    count = len(completed_tasks)
    for t in completed_tasks:
        record_history(
            db,
            task_id=t.id,
            task_title=t.title,
            action="deleted",
            details="Cleared completed task",
            category=t.category,
            priority=t.priority,
        )
        db.delete(t)
    db.commit()
    return {
        "message": f"Cleared {count} completed task(s).",
        "deleted_count": count,
        "tasks": get_ordered_tasks(db),
    }


@app.delete("/api/tasks/{task_id}", summary="Delete a task by its database ID")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task with id={task_id} not found.")

    record_history(
        db,
        task_id=task.id,
        task_title=task.title,
        action="deleted",
        details=f"Deleted from {task.category} ({task.priority.capitalize()} priority)",
        category=task.category,
        priority=task.priority,
    )
    db.delete(task)
    db.commit()
    return {
        "message": "Task deleted.",
        "tasks": get_ordered_tasks(db),
    }


# ---------------------------------------------------------------------------
# History & Analytics Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/history", summary="List task activity history")
def get_history(
    action: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(TaskHistoryModel)
    if action and action != "all":
        query = query.filter(TaskHistoryModel.action == action)
    entries = query.order_by(TaskHistoryModel.id.desc()).limit(limit).all()
    return {"history": [serialize_history(h) for h in entries]}


@app.post("/api/history/{history_id}/restore", status_code=201, summary="Restore a task from history")
def restore_from_history(history_id: int, db: Session = Depends(get_db)):
    entry = db.query(TaskHistoryModel).filter(TaskHistoryModel.id == history_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found.")

    max_pos_row = db.query(TaskModel).order_by(TaskModel.position.desc()).first()
    next_pos = (max_pos_row.position + 1) if max_pos_row and max_pos_row.position is not None else 0

    restored_task = TaskModel(
        title=entry.task_title,
        priority=entry.priority if entry.priority in VALID_PRIORITIES else "medium",
        category=entry.category or "General",
        status="todo",
        completed=False,
        position=next_pos,
        created_at=now_iso(),
    )
    db.add(restored_task)
    db.flush()

    record_history(
        db,
        task_id=restored_task.id,
        task_title=restored_task.title,
        action="restored",
        details="Restored from activity history",
        category=restored_task.category,
        priority=restored_task.priority,
    )
    db.commit()
    db.refresh(restored_task)
    return {
        "message": "Task restored from history.",
        "task": serialize_task(restored_task),
        "tasks": get_ordered_tasks(db),
    }


@app.delete("/api/history", summary="Clear all activity history")
def clear_history(db: Session = Depends(get_db)):
    deleted = db.query(TaskHistoryModel).delete()
    db.commit()
    return {"message": "History cleared.", "deleted_count": deleted, "history": []}


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def read_root():
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "Frontend not found — place index.html in the project root."}


@app.get("/{filename}", include_in_schema=False)
def serve_file(filename: str):
    allowed = {"style.css", "script.js"}
    if filename not in allowed:
        raise HTTPException(status_code=404, detail="File not found.")
    file_path = BASE_DIR / filename
    if file_path.exists():
        return FileResponse(str(file_path))
    raise HTTPException(status_code=404, detail="File not found.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ToDoList:app", host="127.0.0.1", port=8000, reload=True)
