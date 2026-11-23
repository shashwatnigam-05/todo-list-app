"""Tests for the TaskFlow To-Do List FastAPI application."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ToDoList import app, Base, get_db

# In-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_get_tasks_empty(client):
    response = client.get("/api/tasks")
    assert response.status_code == 200
    assert response.json()["tasks"] == []


def test_add_task_with_metadata(client):
    response = client.post(
        "/api/tasks",
        json={"title": "Ship v2 release", "priority": "high", "category": "Work", "due_date": "2026-12-01"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Task added successfully."
    task = data["task"]
    assert task["title"] == "Ship v2 release"
    assert task["priority"] == "high"
    assert task["category"] == "Work"
    assert task["due_date"] == "2026-12-01"
    assert task["status"] == "todo"
    assert task["completed"] is False


def test_update_task_completion_and_history(client):
    create_resp = client.post("/api/tasks", json={"title": "Write tests"})
    task_id = create_resp.json()["task"]["id"]

    patch_resp = client.patch(f"/api/tasks/{task_id}", json={"completed": True})
    assert patch_resp.status_code == 200
    updated = patch_resp.json()["task"]
    assert updated["completed"] is True
    assert updated["status"] == "done"
    assert updated["completed_at"] is not None

    hist_resp = client.get("/api/history")
    assert hist_resp.status_code == 200
    actions = [h["action"] for h in hist_resp.json()["history"]]
    assert "completed" in actions
    assert "created" in actions


def test_delete_and_restore_from_history(client):
    add_resp = client.post("/api/tasks", json={"title": "Restore me", "priority": "high", "category": "Coding"})
    task_id = add_resp.json()["task"]["id"]

    del_resp = client.delete(f"/api/tasks/{task_id}")
    assert del_resp.status_code == 200
    assert client.get("/api/tasks").json()["tasks"] == []

    history = client.get("/api/history?action=deleted").json()["history"]
    assert len(history) == 1
    history_id = history[0]["id"]

    restore_resp = client.post(f"/api/history/{history_id}/restore")
    assert restore_resp.status_code == 201
    tasks = client.get("/api/tasks").json()["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["title"] == "Restore me"
    assert tasks[0]["priority"] == "high"


def test_kanban_reorder(client):
    r1 = client.post("/api/tasks", json={"title": "Task A"}).json()["task"]["id"]
    r2 = client.post("/api/tasks", json={"title": "Task B"}).json()["task"]["id"]

    reorder_resp = client.post(
        "/api/tasks/reorder",
        json={
            "items": [
                {"id": r2, "position": 0, "status": "in_progress"},
                {"id": r1, "position": 1, "status": "done"},
            ]
        },
    )
    assert reorder_resp.status_code == 200
    tasks = reorder_resp.json()["tasks"]
    assert tasks[0]["id"] == r2
    assert tasks[0]["status"] == "in_progress"
    assert tasks[1]["id"] == r1
    assert tasks[1]["completed"] is True


def test_clear_completed_tasks(client):
    r1 = client.post("/api/tasks", json={"title": "Done task", "status": "done"}).json()["task"]["id"]
    client.post("/api/tasks", json={"title": "Active task"})

    clear_resp = client.delete("/api/tasks/completed")
    assert clear_resp.status_code == 200
    assert clear_resp.json()["deleted_count"] == 1
    remaining = client.get("/api/tasks").json()["tasks"]
    assert len(remaining) == 1
    assert remaining[0]["title"] == "Active task"


def test_delete_nonexistent_task_returns_404(client):
    response = client.delete("/api/tasks/99999")
    assert response.status_code == 404


def test_add_task_empty_title_rejected(client):
    response = client.post("/api/tasks", json={"title": "   "})
    assert response.status_code == 422


def test_add_task_title_too_long_rejected(client):
    response = client.post("/api/tasks", json={"title": "x" * 501})
    assert response.status_code == 422
