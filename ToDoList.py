"""To-Do List REST API — FastAPI + SQLAlchemy backend."""
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.resolve()

DATABASE_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # SQLAlchemy requires postgresql:// instead of postgres://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    sqlite_path = BASE_DIR / "tasks.db"
    DATABASE_URL = f"sqlite:///{sqlite_path}"
    engine = create_engine(str(DATABASE_URL), connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class TaskModel(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), index=True, nullable=False)


Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(title="ToDo List API", version="1.0.0")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class TaskCreate(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Task title cannot be empty.")
        if len(v) > 500:
            raise ValueError("Task title must be 500 characters or fewer.")
        return v


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
    tasks = db.query(TaskModel).order_by(TaskModel.id).all()
    return {"tasks": [{"id": t.id, "title": t.title} for t in tasks]}


@app.post("/api/tasks", status_code=201, summary="Add a new task")
def add_task(task: TaskCreate, db: Session = Depends(get_db)):
    new_task = TaskModel(title=task.title)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    tasks = db.query(TaskModel).order_by(TaskModel.id).all()
    return {
        "message": "Task added successfully.",
        "task": {"id": new_task.id, "title": new_task.title},
        "tasks": [{"id": t.id, "title": t.title} for t in tasks],
    }


@app.delete("/api/tasks/{task_id}", summary="Delete a task by its database ID")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task with id={task_id} not found.")
    db.delete(task)
    db.commit()
    tasks = db.query(TaskModel).order_by(TaskModel.id).all()
    return {
        "message": "Task deleted.",
        "tasks": [{"id": t.id, "title": t.title} for t in tasks],
    }


# ---------------------------------------------------------------------------
# Static file serving (local development)
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
