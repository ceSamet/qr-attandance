// Modern QR Attendance System - Frontend JavaScript
let currentUser = null;
let currentCourseId = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');

// Tab elements
const dashboardTab = document.getElementById('dashboard-tab');
const coursesTab = document.getElementById('courses-tab');
const usersTab = document.getElementById('users-tab');
const usersMenuItem = document.getElementById('users-menu-item');

// Content sections
const dashboardContent = document.getElementById('dashboard-content');
const coursesContent = document.getElementById('courses-content');
const usersContent = document.getElementById('users-content');

// Stats elements
const totalCourses = document.getElementById('total-courses');
const totalSessions = document.getElementById('total-sessions');
const totalAttendances = document.getElementById('total-attendances');

// Course elements
const coursesGrid = document.getElementById('courses-grid');
const addCourseBtn = document.getElementById('add-course-btn');
const courseModal = document.getElementById('course-modal');
const courseForm = document.getElementById('course-form');

// User elements
const usersTableBody = document.getElementById('users-table-body');
const addUserBtn = document.getElementById('add-user-btn');
const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');

// Session elements
const sessionsModal = document.getElementById('sessions-modal');
const sessionsList = document.getElementById('sessions-list');
const createSessionBtn = document.getElementById('create-session-btn');

// QR elements
const qrModal = document.getElementById('qr-modal');
const qrEntryImage = document.getElementById('qr-entry-image');
const qrExitImage = document.getElementById('qr-exit-image');
const qrEntryLink = document.getElementById('qr-entry-link');
const qrExitLink = document.getElementById('qr-exit-link');
const qrCourseName = document.getElementById('qr-course-name');
const qrSessionName = document.getElementById('qr-session-name');

// Bulk import elements
const bulkImportModal = document.getElementById('bulk-import-modal');
const fileUploadArea = document.getElementById('file-upload-area');
const csvFileInput = document.getElementById('csv-file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const uploadBtn = document.getElementById('upload-csv-btn');
const importProgress = document.getElementById('import-progress');
const importResults = document.getElementById('import-results');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const successCount = document.getElementById('success-count');
const errorCount = document.getElementById('error-count');
const errorDetails = document.getElementById('error-details');
const errorList = document.getElementById('error-list');


// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

// Authentication functions
async function checkAuth() {
    try {
        const response = await fetch('/api/courses');
        if (response.ok) {
            const courses = await response.json();
            // User is logged in, get user info from session storage or make another call
            showDashboard();
            loadDashboardData();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showLogin();
    }
}

function showLogin() {
    loginSection.style.display = 'flex';
    dashboardSection.style.display = 'none';
    loginError.textContent = '';
}

function showDashboard() {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    switchTab('dashboard');
}

async function login(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            userName.textContent = `Welcome, ${user.full_name || user.username}!`;
            
            // Show/hide admin features
            if (user.role === 'admin') {
                usersMenuItem.style.display = 'block';
            } else {
                usersMenuItem.style.display = 'none';
            }
            
            showDashboard();
            return true;
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }
    } catch (error) {
        loginError.textContent = error.message;
        return false;
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showLogin();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Dashboard functions
async function loadDashboardData() {
    try {
        const courses = await fetchCourses();
        totalCourses.textContent = courses.length;
        
        // Calculate total sessions and attendances
        let sessionCount = 0;
        let attendanceCount = 0;
        
        for (const course of courses) {
            const sessions = await fetchSessions(course.id);
            sessionCount += sessions.length;
            
            for (const session of sessions) {
                attendanceCount += session.attendance_count || 0;
            }
        }
        
        totalSessions.textContent = sessionCount;
        totalAttendances.textContent = attendanceCount;
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Tab switching
function switchTab(tabName) {
    // Update sidebar active state
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected content and activate tab
    switch(tabName) {
        case 'dashboard':
            dashboardContent.style.display = 'block';
            dashboardTab.classList.add('active');
            loadDashboardData();
            break;
        case 'courses':
            coursesContent.style.display = 'block';
            coursesTab.classList.add('active');
            loadCourses();
            break;
        case 'analytics':
            const analyticsContent = document.getElementById('analytics-content');
            const analyticsTab = document.getElementById('analytics-tab');
            if (analyticsContent && analyticsTab) {
                analyticsContent.style.display = 'block';
                analyticsTab.classList.add('active');
                loadAnalytics();
            }
            break;
        case 'users':
            if (currentUser && currentUser.role === 'admin') {
                usersContent.style.display = 'block';
                usersTab.classList.add('active');
                loadUsers();
            }
            break;
    }
}

// Course functions
async function fetchCourses() {
    try {
        const response = await fetch('/api/courses');
        if (response.ok) {
            return await response.json();
        } else if (response.status === 401) {
            showLogin();
            return [];
        } else {
            throw new Error('Failed to fetch courses');
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        return [];
    }
}

async function loadCourses() {
    try {
        const courses = await fetchCourses();
        displayCourses(courses);
    } catch (error) {
        console.error('Error loading courses:', error);
        coursesGrid.innerHTML = '<div class="loading">Failed to load courses</div>';
    }
}

function displayCourses(courses) {
    if (courses.length === 0) {
        coursesGrid.innerHTML = '<div class="loading">No courses found. Create your first course!</div>';
        return;
    }
    
    coursesGrid.innerHTML = courses.map(course => `
        <div class="course-card">
            <div class="course-header">
                <div>
                    <div class="course-title">${escapeHtml(course.name)}</div>
                    <div class="course-code">${course.course_code ? escapeHtml(course.course_code) : 'No Code'}</div>
                    <div class="course-description">${escapeHtml(course.description || 'No description')}</div>
                </div>
            </div>
            <div class="course-meta">
                <div class="instructor-info">
                    <i class="fas fa-user-tie"></i>
                    <span class="instructor-name">${escapeHtml(course.instructor_name)}</span>
                    ${course.instructor_email ? `<span class="instructor-email">(${escapeHtml(course.instructor_email)})</span>` : ''}
                </div>
                <div class="course-stats">
                    <span class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        ${course.sessions_count || 0} sessions
                    </span>
                    ${course.max_students ? `
                        <span class="stat-item">
                            <i class="fas fa-users"></i>
                            Max: ${course.max_students}
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="course-actions">
                <button class="btn btn-primary btn-sm" data-course-id="${course.id}" data-course-name="${escapeHtml(course.name)}" onclick="viewSessions(${course.id}, this.dataset.courseName)">
                    <i class="fas fa-calendar-alt"></i> Sessions
                </button>
                <button class="btn btn-danger btn-sm" data-course-id="${course.id}" onclick="deleteCourse(${course.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// HTML escape helper function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function addCourse(name, description) {
    try {
        const response = await fetch('/api/courses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
        });
        
        if (response.ok) {
            closeModal(courseModal);
            loadCourses();
            showAlert('Course created successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create course');
        }
    } catch (error) {
        console.error('Error creating course:', error);
        showAlert(error.message, 'error');
    }
}

async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course? This will also delete all associated sessions.')) {
        return;
    }
    
    try {
        console.log('Deleting course with ID:', courseId);
        const response = await fetch(`/api/courses/${courseId}`, {
            method: 'DELETE',
        });
        
        console.log('Delete response status:', response.status);
        console.log('Delete response ok:', response.ok);
        
        if (response.ok) {
            console.log('Course deleted successfully');
            loadCourses();
            showAlert('Course deleted successfully!', 'success');
        } else {
            // Log the raw response text first
            const responseText = await response.text();
            console.log('Error response text:', responseText);
            
            try {
                const error = JSON.parse(responseText);
                throw new Error(error.error || 'Failed to delete course');
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                throw new Error(`Failed to delete course: ${responseText}`);
            }
        }
    } catch (error) {
        console.error('Error deleting course:', error);
        showAlert(error.message, 'error');
    }
}

// Session functions
async function fetchSessions(courseId) {
    try {
        const response = await fetch(`/api/courses/${courseId}/sessions`);
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error('Failed to fetch sessions');
        }
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }
}

async function viewSessions(courseId, courseName) {
    currentCourseId = courseId;
    document.getElementById('sessions-modal-title').textContent = `${courseName} - Sessions`;
    
    try {
        const sessions = await fetchSessions(courseId);
        displaySessions(sessions);
        showModal(sessionsModal);
    } catch (error) {
        console.error('Error loading sessions:', error);
        showAlert('Failed to load sessions', 'error');
    }
}

function displaySessions(sessions) {
    if (sessions.length === 0) {
        sessionsList.innerHTML = '<div class="loading">No sessions found. Create your first session!</div>';
        return;
    }
    
    sessionsList.innerHTML = sessions.map(session => `
        <div class="session-card">
            <div class="session-header">
                <div class="session-title">${session.session_name || 'Session'}</div>
                <div class="session-date">${new Date(session.session_date).toLocaleString()}</div>
            </div>
            <div class="session-stats">
                <div class="attendance-breakdown">
                    <span title="Total attendees"><i class="fas fa-users"></i> ${session.attendance_count || 0} total</span>
                    <span title="Checked in" class="entry-stat"><i class="fas fa-sign-in-alt"></i> ${session.checked_in_count || 0} in</span>
                    <span title="Checked out" class="exit-stat"><i class="fas fa-sign-out-alt"></i> ${session.checked_out_count || 0} out</span>
                </div>
                <span class="${session.is_active ? 'text-success' : 'text-danger'}">
                    <i class="fas fa-circle"></i> ${session.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div class="session-actions">
                <button class="btn btn-primary btn-sm" onclick="showSessionQRCodes('${session.entry_token}', '${session.exit_token}', '${session.session_name}')">
                    <i class="fas fa-qrcode"></i> QR Codes
                </button>
                <button class="btn btn-success btn-sm" onclick="exportCSV(${session.id})">
                    <i class="fas fa-download"></i> Export CSV
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function createSession() {
    if (!currentCourseId) return;
    
    const sessionName = prompt('Enter session name (optional):') || `Session ${new Date().toLocaleString()}`;
    
    try {
        const response = await fetch('/api/create_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                course_id: currentCourseId,
                session_name: sessionName
            }),
        });
        
        if (response.ok) {
            const sessionData = await response.json();
            const sessions = await fetchSessions(currentCourseId);
            displaySessions(sessions);
            showAlert('Session created successfully!', 'success');
            
            // Optionally show QR codes immediately
            showQRCode(sessionData.entry_token, sessionData.exit_token, sessionData.session_name, sessionData.course_name, sessionData.entry_qr_image, sessionData.exit_qr_image);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create session');
        }
    } catch (error) {
        console.error('Error creating session:', error);
        showAlert(error.message, 'error');
    }
}

async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            const sessions = await fetchSessions(currentCourseId);
            displaySessions(sessions);
            showAlert('Session deleted successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete session');
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        showAlert(error.message, 'error');
    }
}

function showQRCode(entryToken, exitToken, sessionName, courseName, entryQrImage, exitQrImage) {
    // Set entry QR code
    qrEntryImage.src = entryQrImage || `/qr_codes/${entryToken}_entry.png`;
    qrEntryLink.href = `/attend/entry/${entryToken}`;
    
    // Set exit QR code
    qrExitImage.src = exitQrImage || `/qr_codes/${exitToken}_exit.png`;
    qrExitLink.href = `/attend/exit/${exitToken}`;
    
    // Set session info
    qrSessionName.textContent = sessionName || 'Session';
    qrCourseName.textContent = courseName || 'Course';
    
    // Reset QR sections to default state (Entry visible, Exit hidden)
    resetQRSections();
    
    showModal(qrModal);
}

// Reset QR sections to default state
function resetQRSections() {
    // Show Entry section
    const entrySection = document.querySelector('.qr-section.entry-qr');
    const entryContent = document.getElementById('entry-qr-content');
    if (entrySection && entryContent) {
        entrySection.classList.remove('hidden');
        entryContent.classList.remove('hidden');
        entryContent.classList.add('visible');
    }
    
    // Hide Exit section
    const exitSection = document.querySelector('.qr-section.exit-qr');
    const exitContent = document.getElementById('exit-qr-content');
    if (exitSection && exitContent) {
        exitSection.classList.add('hidden');
        exitContent.classList.remove('visible');
        exitContent.classList.add('hidden');
    }
}

// Helper function for showing QR codes from session list
function showSessionQRCodes(entryToken, exitToken, sessionName) {
    showQRCode(entryToken, exitToken, sessionName, 'Course', null, null);
}

// QR Code show/hide toggle function
function toggleQRSection(section) {
    const sectionElement = document.querySelector(`.qr-section.${section}-qr`);
    const contentWrapper = document.getElementById(`${section}-qr-content`);
    
    if (!sectionElement || !contentWrapper) return;
    
    const isVisible = contentWrapper.classList.contains('visible');
    
    if (isVisible) {
        // Hide the section
        contentWrapper.classList.remove('visible');
        contentWrapper.classList.add('hidden');
        sectionElement.classList.add('hidden');
    } else {
        // Show the section
        contentWrapper.classList.remove('hidden');
        contentWrapper.classList.add('visible');
        sectionElement.classList.remove('hidden');
    }
}

async function exportCSV(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}/export_csv`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session_${sessionId}_attendances.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            throw new Error('Failed to export CSV');
        }
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showAlert('Failed to export CSV', 'error');
    }
}

// User management functions (Admin only)
async function loadUsers() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
            loadUserCoursesCounts(); // Load course counts after users are displayed
        } else {
            throw new Error('Failed to fetch users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        usersTableBody.innerHTML = '<tr><td colspan="6">Failed to load users</td></tr>';
    }
}

// Analytics functions
async function loadAnalytics() {
    try {
        const response = await fetch('/api/analytics/dashboard');
        if (response.ok) {
            const data = await response.json();
            displayAnalytics(data);
        } else {
            throw new Error('Failed to fetch analytics data');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        showAlert('Failed to load analytics data', 'error');
    }
}

function displayAnalytics(data) {
    // Update analytics cards
    document.getElementById('analytics-total-attendances').textContent = data.overview.total_attendances;
    document.getElementById('analytics-active-sessions').textContent = data.overview.active_sessions;
    document.getElementById('analytics-recent-activity').textContent = data.overview.recent_attendances;
    
    // Calculate average attendance rate
    const avgRate = data.overview.total_sessions > 0 ? 
        Math.round((data.overview.total_attendances / data.overview.total_sessions) * 100) / 100 : 0;
    document.getElementById('analytics-avg-attendance').textContent = avgRate;
    
    // Display top courses
    const topCoursesList = document.getElementById('top-courses-list');
    if (data.top_courses && data.top_courses.length > 0) {
        topCoursesList.innerHTML = data.top_courses.map(course => `
            <div class="top-course-item">
                <div class="course-info">
                    <div class="course-name">${escapeHtml(course.name)}</div>
                    <div class="course-code">${course.code || 'No Code'}</div>
                </div>
                <div class="attendance-count">${course.attendance_count}</div>
            </div>
        `).join('');
    } else {
        topCoursesList.innerHTML = '<div class="loading">No course data available</div>';
    }
    
    // Display recent activities (simulated)
    const activitiesList = document.getElementById('recent-activities-list');
    const recentActivities = generateRecentActivities(data);
    activitiesList.innerHTML = recentActivities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
}

function generateRecentActivities(data) {
    const activities = [];
    
    if (data.overview.recent_attendances > 0) {
        activities.push({
            icon: 'fas fa-user-check',
            title: `${data.overview.recent_attendances} new attendances this week`,
            time: 'Last 7 days'
        });
    }
    
    if (data.overview.active_sessions > 0) {
        activities.push({
            icon: 'fas fa-calendar-plus',
            title: `${data.overview.active_sessions} active sessions`,
            time: 'Currently'
        });
    }
    
    activities.push({
        icon: 'fas fa-chart-bar',
        title: 'Analytics dashboard updated',
        time: 'Just now'
    });
    
    return activities.slice(0, 5); // Limit to 5 activities
}

function displayUsers(users) {
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.full_name || 'N/A'}</td>
            <td>${user.username}</td>
            <td>${user.email || 'N/A'}</td>
            <td><span class="badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}">${user.role}</span></td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>
                <div class="user-actions">
                    ${getCourseCountForUser(user.id)}
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})" ${user.id === currentUser.id ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="bulkDeleteUser(${user.id})" ${user.id === currentUser.id ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i> Bulk Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getCourseCountForUser(userId) {
    // This will be populated by a separate API call, for now show loading
    return `<span class="course-count-${userId}">Loading...</span>`;
}

async function loadUserCoursesCounts() {
    // Get course counts for each user
    try {
        const courses = await fetchCourses();
        const userCourseCounts = {};
        
        courses.forEach(course => {
            const instructorId = course.instructor_id;
            if (!userCourseCounts[instructorId]) {
                userCourseCounts[instructorId] = 0;
            }
            userCourseCounts[instructorId]++;
        });
        
        // Update the course count displays
        Object.keys(userCourseCounts).forEach(userId => {
            const countElement = document.querySelector(`.course-count-${userId}`);
            if (countElement) {
                const count = userCourseCounts[userId];
                countElement.innerHTML = `<span class="badge badge-info">${count} courses</span>`;
            }
        });
        
        // Set 0 for users with no courses
        document.querySelectorAll('[class*="course-count-"]').forEach(element => {
            if (element.innerHTML === 'Loading...') {
                element.innerHTML = '<span class="badge badge-secondary">0 courses</span>';
            }
        });
        
    } catch (error) {
        console.error('Error loading course counts:', error);
    }
}

async function bulkDeleteUser(userId) {
    if (userId === currentUser.id) {
        showAlert('You cannot delete your own account', 'error');
        return;
    }

    const user = await getUserById(userId);
    if (!user) {
        showAlert('User not found', 'error');
        return;
    }

    const confirmMessage = `⚠️ BULK DELETE WARNING ⚠️\n\nThis will permanently delete:\n- User: ${user.full_name || user.username}\n- ALL their courses\n- ALL sessions in those courses\n- ALL attendance records\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm:`;
    
    const userConfirmation = prompt(confirmMessage);
    
    if (userConfirmation !== 'DELETE') {
        showAlert('Bulk delete cancelled', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}/bulk-delete`, {
            method: 'DELETE',
        });

        if (response.ok) {
            const result = await response.json();
            loadUsers();
            
            // Show detailed success message
            const deletedInfo = result.deleted;
            showAlert(
                `✅ Bulk delete successful!\nDeleted: ${deletedInfo.user}\n` +
                `Courses: ${deletedInfo.courses}\n` +
                `Sessions: ${deletedInfo.sessions}\n` +
                `Attendances: ${deletedInfo.attendances}`, 
                'success'
            );
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to bulk delete user');
        }
    } catch (error) {
        console.error('Error bulk deleting user:', error);
        showAlert(error.message, 'error');
    }
}

async function getUserById(userId) {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const users = await response.json();
            return users.find(user => user.id === userId);
        }
        return null;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

async function addUser(userData) {
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });
        
        if (response.ok) {
            closeModal(userModal);
            loadUsers();
            showAlert('User created successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create user');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert(error.message, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            loadUsers();
            showAlert('User deleted successfully!', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert(error.message, 'error');
    }
}

// Modal functions
function showModal(modal) {
    modal.style.display = 'block';
}

function closeModal(modal) {
    modal.style.display = 'none';
    // Reset forms
    modal.querySelectorAll('form').forEach(form => form.reset());
}

// Utility functions
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const firstContent = document.querySelector('.main-content .content-section[style*="block"]') || document.querySelector('.main-content');
    firstContent.insertBefore(alertDiv, firstContent.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Bulk import functions
async function downloadTemplate() {
    try {
        const response = await fetch('/api/users/bulk-import/template');
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bulk_user_import_template.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            showAlert('CSV template downloaded successfully!', 'success');
        } else {
            throw new Error('Failed to download template');
        }
    } catch (error) {
        console.error('Error downloading template:', error);
        showAlert('Failed to download template', 'error');
    }
}

function setupBulkImport() {
    const bulkImportModal = document.getElementById('bulk-import-modal');
    const fileUploadArea = document.getElementById('file-upload-area');
    const csvFileInput = document.getElementById('csv-file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const uploadBtn = document.getElementById('upload-csv-btn');
    const importProgress = document.getElementById('import-progress');
    const importResults = document.getElementById('import-results');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const successCount = document.getElementById('success-count');
    const errorCount = document.getElementById('error-count');
    const errorDetails = document.getElementById('error-details');
    const errorList = document.getElementById('error-list');
    
    let selectedFile = null;
    
    // File upload area click
    fileUploadArea.addEventListener('click', () => {
        csvFileInput.click();
    });
    
    // File input change
    csvFileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });
    
    // Drag and drop handlers
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
    });
    
    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('dragover');
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    function handleFileSelect(file) {
        if (!file) return;
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showAlert('Please select a CSV file', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showAlert('File size must be less than 5MB', 'error');
            return;
        }
        
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';
        uploadBtn.disabled = false;
        
        // Hide previous results
        importProgress.style.display = 'none';
        importResults.style.display = 'none';
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Upload button click
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        
        uploadBtn.disabled = true;
        importProgress.style.display = 'block';
        
        // Simulate progress
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressFill.style.width = '30%';
        progressText.textContent = 'Uploading file...';
        
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            
            progressFill.style.width = '60%';
            progressText.textContent = 'Processing users...';
            
            const response = await fetch('/api/users/bulk-import', {
                method: 'POST',
                body: formData
            });
            
            progressFill.style.width = '100%';
            progressText.textContent = 'Complete!';
            
            if (response.ok) {
                const result = await response.json();
                displayImportResults(result);
                
                // Refresh users list
                if (result.created_count > 0) {
                    loadUsers();
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Import failed');
            }
            
        } catch (error) {
            console.error('Import error:', error);
            showAlert(error.message, 'error');
            importProgress.style.display = 'none';
        }
        
        uploadBtn.disabled = false;
    });
    
    function displayImportResults(result) {
        const successCount = document.getElementById('success-count');
        const errorCount = document.getElementById('error-count');
        const errorDetails = document.getElementById('error-details');
        const errorList = document.getElementById('error-list');
        
        successCount.textContent = result.created_count;
        errorCount.textContent = result.error_count;
        
        if (result.errors && result.errors.length > 0) {
            errorList.innerHTML = result.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('');
            errorDetails.style.display = 'block';
        } else {
            errorDetails.style.display = 'none';
        }
        
        importResults.style.display = 'block';
        
        // Show summary alert
        if (result.created_count > 0) {
            showAlert(`Successfully imported ${result.created_count} users!`, 'success');
        }
        if (result.error_count > 0) {
            showAlert(`${result.error_count} errors occurred during import. Check details below.`, 'error');
        }
    }
    
    // Reset modal when closed
    bulkImportModal.addEventListener('click', (e) => {
        if (e.target === bulkImportModal) {
            resetImportModal();
        }
    });
    
    function resetImportModal() {
        selectedFile = null;
        csvFileInput.value = '';
        fileInfo.style.display = 'none';
        uploadBtn.disabled = true;
        importProgress.style.display = 'none';
        importResults.style.display = 'none';
        fileUploadArea.classList.remove('dragover');
    }
    
    // Cancel button
    document.getElementById('cancel-import').addEventListener('click', () => {
        closeModal(bulkImportModal);
        resetImportModal();
    });
}

// Event listeners setup
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        await login(username, password);
    });
    
    // Logout button
    logoutBtn.addEventListener('click', logout);
    
    // Tab navigation
    dashboardTab.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('dashboard');
    });
    
    coursesTab.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('courses');
    });

    const analyticsTab = document.getElementById('analytics-tab');
    if (analyticsTab) {
        analyticsTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('analytics');
        });
    }
    
    if (usersTab) {
        usersTab.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('users');
        });
    }
    
    // Add course button and modal
    addCourseBtn.addEventListener('click', () => showModal(courseModal));
    
    courseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('course-name').value;
        const description = document.getElementById('course-description').value;
        addCourse(name, description);
    });
    
    // Add user button and modal (Admin only)
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => showModal(userModal));
    }
    
    // Bulk import buttons (Admin only)
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    const bulkImportBtn = document.getElementById('bulk-import-btn');
    
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadTemplate);
    }
    
    if (bulkImportBtn) {
        bulkImportBtn.addEventListener('click', () => showModal(bulkImportModal));
    }
    
    if (userForm) {
        userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userData = {
                full_name: document.getElementById('user-fullname').value,
                username: document.getElementById('user-username').value,
                email: document.getElementById('user-email').value,
                password: document.getElementById('user-password').value,
                role: document.getElementById('user-role').value,
            };
            addUser(userData);
        });
    }
    
    // Create session button
    createSessionBtn.addEventListener('click', createSession);
    
    // Modal close buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });
    
    // Cancel buttons
    document.getElementById('cancel-course')?.addEventListener('click', () => closeModal(courseModal));
    document.getElementById('cancel-user')?.addEventListener('click', () => closeModal(userModal));
    document.getElementById('cancel-import')?.addEventListener('click', () => closeModal(bulkImportModal));
    
    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    // Setup bulk import modal
    if (bulkImportModal) {
        setupBulkImport();
    }
} 