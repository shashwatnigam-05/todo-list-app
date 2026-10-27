"""Tests for the ToDo List FastAPI application."""
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


def test_add_task(client):
    response = client.post("/api/tasks", json={"title": "Buy milk"})
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Task added successfully."
    assert data["task"]["title"] == "Buy milk"
    assert isinstance(data["task"]["id"], int)


def test_get_tasks_after_add(client):
    client.post("/api/tasks", json={"title": "Task One"})
    client.post("/api/tasks", json={"title": "Task Two"})
    response = client.get("/api/tasks")
    titles = [t["title"] for t in response.json()["tasks"]]
    assert "Task One" in titles
    assert "Task Two" in titles


def test_delete_task_by_id(client):
    add_resp = client.post("/api/tasks", json={"title": "Delete me"})
    task_id = add_resp.json()["task"]["id"]

    del_resp = client.delete(f"/api/tasks/{task_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Task deleted."

    get_resp = client.get("/api/tasks")
    assert get_resp.json()["tasks"] == []


def test_delete_nonexistent_task_returns_404(client):
    response = client.delete("/api/tasks/99999")
    assert response.status_code == 404


def test_add_task_empty_title_rejected(client):
    response = client.post("/api/tasks", json={"title": "   "})
    assert response.status_code == 422


def test_add_task_title_too_long_rejected(client):
    response = client.post("/api/tasks", json={"title": "x" * 501})
    assert response.status_code == 422


def test_add_task_missing_title_rejected(client):
    response = client.post("/api/tasks", json={})
    assert response.status_code == 422


def test_tasks_returned_in_insertion_order(client):
    for i in range(1, 4):
        client.post("/api/tasks", json={"title": f"Task {i}"})
    titles = [t["title"] for t in client.get("/api/tasks").json()["tasks"]]
    assert titles == ["Task 1", "Task 2", "Task 3"]


def test_delete_leaves_other_tasks_intact(client):
    client.post("/api/tasks", json={"title": "Keep this"})
    r2 = client.post("/api/tasks", json={"title": "Delete this"})
    id2 = r2.json()["task"]["id"]

    client.delete(f"/api/tasks/{id2}")
    titles = [t["title"] for t in client.get("/api/tasks").json()["tasks"]]
    assert titles == ["Keep this"]


def test_task_ids_are_stable_integers(client):
    r = client.post("/api/tasks", json={"title": "Stable ID test"})
    task = r.json()["task"]
    assert isinstance(task["id"], int)
    assert task["id"] > 0
