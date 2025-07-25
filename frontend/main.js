let currentUser = null;

function showLogin() {
    document.getElementById('login-section').style.display = '';
    document.getElementById('panel-section').style.display = 'none';
}
function showPanel() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('panel-section').style.display = '';
}

function checkAuth() {
    // Try to fetch courses to check if logged in
    fetch('/api/courses').then(res => {
        if (res.status === 401) {
            showLogin();
        } else {
            showPanel();
            fetchCourses();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json().then(data => ({ status: res.status, data })))
        .then(({ status, data }) => {
            if (status === 200) {
                currentUser = data;
                loginError.textContent = '';
                showPanel();
                fetchCourses();
            } else {
                loginError.textContent = data.error || 'Login failed';
            }
        });
    };

    logoutBtn.onclick = () => {
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                currentUser = null;
                showLogin();
            });
    };

    const coursesList = document.getElementById('courses-list');
    const addCourseBtn = document.getElementById('add-course-btn');
    const sessionsSection = document.getElementById('sessions-section');
    const sessionsList = document.getElementById('sessions-list');
    const addSessionBtn = document.getElementById('add-session-btn');
    const qrSection = document.getElementById('qr-section');
    const qrImage = document.getElementById('qr-image');
    const qrLink = document.getElementById('qr-link');
    const selectedCourseName = document.getElementById('selected-course-name');

    let selectedCourseId = null;
    let selectedCourse = null;

    function fetchCourses() {
        fetch('/api/courses')
            .then(res => {
                if (res.status === 401) {
                    showLogin();
                    return [];
                }
                return res.json();
            })
            .then(courses => {
                if (!Array.isArray(courses)) return;
                coursesList.innerHTML = '';
                courses.forEach(course => {
                    const li = document.createElement('li');
                    li.textContent = course.name;
                    li.style.cursor = 'pointer';
                    li.onclick = () => selectCourse(course);
                    // Add delete button
                    const delBtn = document.createElement('button');
                    delBtn.textContent = 'Delete';
                    delBtn.style.marginLeft = '10px';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (confirm('Delete this course?')) {
                            fetch(`/api/courses/${course.id}`, { method: 'DELETE' })
                                .then(() => fetchCourses());
                        }
                    };
                    li.appendChild(delBtn);
                    coursesList.appendChild(li);
                });
            });
    }

    function selectCourse(course) {
        selectedCourseId = course.id;
        selectedCourse = course;
        selectedCourseName.textContent = course.name;
        sessionsSection.style.display = '';
        fetchSessions();
    }

    function fetchSessions() {
        if (!selectedCourseId) return;
        fetch(`/api/courses/${selectedCourseId}/sessions`)
            .then(res => res.json())
            .then(sessions => {
                sessionsList.innerHTML = '';
                sessions.forEach(session => {
                    const li = document.createElement('li');
                    li.textContent = `Session ${session.id}`;
                    // Add export CSV button
                    const exportBtn = document.createElement('button');
                    exportBtn.textContent = 'Export CSV';
                    exportBtn.style.marginLeft = '10px';
                    exportBtn.onclick = (e) => {
                        e.stopPropagation();
                        window.open(`/api/sessions/${session.id}/export_csv`, '_blank');
                    };
                    // Add delete button
                    const delBtn = document.createElement('button');
                    delBtn.textContent = 'Delete';
                    delBtn.style.marginLeft = '10px';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (confirm('Delete this session?')) {
                            fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
                                .then(() => fetchSessions());
                        }
                    };
                    li.appendChild(exportBtn);
                    li.appendChild(delBtn);
                    sessionsList.appendChild(li);
                });
            });
    }

    addCourseBtn.onclick = () => {
        const name = prompt('Course name:');
        if (name) {
            fetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            })
            .then(() => fetchCourses());
        }
    };

    addSessionBtn.onclick = () => {
        if (!selectedCourseId) return;
        fetch('/api/create_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: selectedCourseId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.qr_image && data.qr_url) {
                qrImage.src = data.qr_image;
                qrLink.href = data.qr_url;
                qrSection.style.display = '';
            }
            fetchSessions();
        });
    };

    checkAuth();
}); 