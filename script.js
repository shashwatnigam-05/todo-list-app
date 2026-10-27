document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const taskCount = document.getElementById('task-count');

    // Fetch and render tasks on load
    fetchTasks();

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = taskInput.value.trim();
        if (!title) return;

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });

            if (response.ok) {
                taskInput.value = '';
                fetchTasks(); // Reload tasks
            } else {
                console.error("Failed to add task");
            }
        } catch (error) {
            console.error("Error adding task:", error);
        }
    });

    async function fetchTasks() {
        try {
            const response = await fetch('/api/tasks');
            const data = await response.json();
            renderTasks(data.tasks);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    }

    function renderTasks(tasks) {
        taskList.innerHTML = '';
        taskCount.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''} pending`;

        tasks.forEach((task, index) => {
            const li = document.createElement('li');
            li.className = 'task-item';
            
            const span = document.createElement('span');
            span.className = 'task-content';
            span.textContent = task;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = () => deleteTask(index);

            li.appendChild(span);
            li.appendChild(deleteBtn);
            taskList.appendChild(li);
        });
    }

    async function deleteTask(index) {
        try {
            const response = await fetch(`/api/tasks/${index}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchTasks(); // Reload tasks
            } else {
                console.error("Failed to delete task");
            }
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    }
});
