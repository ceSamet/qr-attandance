from flask import Flask, request, jsonify, send_from_directory, render_template_string, session as flask_session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import os
import qrcode
import secrets
import csv
from io import StringIO
from functools import wraps
from datetime import datetime, timedelta
import bcrypt
import json

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///attendance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.environ.get('SECRET_KEY', 'dev_secret_key_change_in_production')

db = SQLAlchemy(app)
CORS(app)

QR_CODES_DIR = os.path.join(os.path.dirname(__file__), '../qr_codes')
os.makedirs(QR_CODES_DIR, exist_ok=True)

# Enhanced Models with additional fields
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)  # Only use hashed password
    role = db.Column(db.String(20), nullable=False)  # admin (sudo-like), instructor (course management only)
    full_name = db.Column(db.String(120), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)  # Track last login
    is_active = db.Column(db.Boolean, default=True)  # Account status
    courses = db.relationship('Course', backref='instructor', lazy=True)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Check if provided password matches hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

class Course(db.Model):
    __tablename__ = 'courses'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)  # Course status
    course_code = db.Column(db.String(20), nullable=True)  # Course code like "CS101"
    max_students = db.Column(db.Integer, nullable=True)  # Max enrollment
    sessions = db.relationship('Session', backref='course', lazy=True)

class Session(db.Model):
    __tablename__ = 'sessions'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    session_name = db.Column(db.String(120), nullable=True)
    session_date = db.Column(db.DateTime, default=datetime.utcnow)
    start_time = db.Column(db.DateTime, nullable=True)  # Scheduled start time
    end_time = db.Column(db.DateTime, nullable=True)    # Scheduled end time
    is_active = db.Column(db.Boolean, default=True)
    location = db.Column(db.String(200), nullable=True)  # Session location
    max_duration = db.Column(db.Integer, default=120)    # Duration in minutes
    attendances = db.relationship('Attendance', backref='session', lazy=True)

class Attendance(db.Model):
    __tablename__ = 'attendances'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    surname = db.Column(db.String(120), nullable=False)
    student_id = db.Column(db.String(50), nullable=True)
    ip_address = db.Column(db.String(45), nullable=False)
    attendance_time = db.Column(db.DateTime, default=datetime.utcnow)
    course_name = db.Column(db.String(120), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True) # Browser info
    status = db.Column(db.String(20), default='present')  # present, late, excused

# Database initialization with enhanced data and migration support
def init_db():
    with app.app_context():
        # Drop all tables and recreate from scratch for clean start
        db.drop_all()
        db.create_all()
        print("Database tables created fresh!")
        
        # Create default admin and instructor users
        admin = User(
            username='admin', 
            role='admin',
            full_name='System Administrator',
            email='admin@school.edu'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        
        instructor = User(
            username='instructor', 
            role='instructor',
            full_name='John Smith',
            email='john.smith@school.edu'
        )
        instructor.set_password('instructor123')
        db.session.add(instructor)
        
        db.session.commit()
        print("Default users created!")
        
        # Add sample courses
        instructor_user = User.query.filter_by(username='instructor').first()
        admin_user = User.query.filter_by(username='admin').first()
        
        sample_courses = [
            Course(
                name='Mathematics 101', 
                description='Basic Mathematics Course',
                instructor_id=instructor_user.id,
                course_code='MATH101',
                max_students=30
            ),
            Course(
                name='Physics 201', 
                description='Introduction to Physics',
                instructor_id=instructor_user.id,
                course_code='PHYS201',
                max_students=25
            ),
            Course(
                name='Computer Science 301', 
                description='Advanced Programming',
                instructor_id=admin_user.id,
                course_code='CS301',
                max_students=20
            )
        ]
        
        for course in sample_courses:
            db.session.add(course)
        
        db.session.commit()
        print("Sample courses created!")
        
        print("Database initialized - ENHANCED ATTENDANCE SYSTEM:")
        print("👨‍💼 Admin: username=admin, password=admin123")
        print("👨‍🏫 Instructor: username=instructor, password=instructor123")
        print("📱 Students: NO LOGIN - Only QR Code Access")
        print("🔒 Password Security: ENABLED")
        print("📊 Analytics: ENABLED")
        print(f"Total users: {User.query.count()}")
        print(f"Total courses: {Course.query.count()}")
        print(f"Total sessions: {Session.query.count()}")

# Auth decorator
def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in flask_session:
                return jsonify({'error': 'Authentication required'}), 401
            if role and flask_session.get('role') != role:
                return jsonify({'error': 'Unauthorized'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Utility functions
def get_lan_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

# Routes
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/init_db')
def init_database():
    try:
        init_db()
        return jsonify({'message': 'Database initialized successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    flask_session['user_id'] = user.id
    flask_session['role'] = user.role
    flask_session['username'] = user.username
    flask_session['full_name'] = user.full_name
    user.last_login = datetime.utcnow()
    db.session.commit()
    return jsonify({
        'id': user.id, 
        'username': user.username, 
        'role': user.role,
        'full_name': user.full_name
    })

@app.route('/api/logout', methods=['POST'])
def logout():
    flask_session.clear()
    return jsonify({'result': 'logged out'})

# User Management API
@app.route('/api/users', methods=['GET'])
@login_required(role='admin')
def get_users():
    users = User.query.all()
    return jsonify([
        {
            'id': u.id, 
            'username': u.username, 
            'role': u.role,
            'full_name': u.full_name,
            'email': u.email,
            'created_at': u.created_at.isoformat() if u.created_at else None,
            'last_login': u.last_login.isoformat() if u.last_login else None,
            'is_active': u.is_active
        } for u in users
    ])

@app.route('/api/users', methods=['POST'])
@login_required(role='admin')
def add_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'instructor')  # Default to instructor, not student
    full_name = data.get('full_name', '')
    email = data.get('email', '')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
        
    if role not in ['admin', 'instructor']:
        return jsonify({'error': 'Role must be admin or instructor'}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    user = User(
        username=username, 
        role=role,
        full_name=full_name,
        email=email
    )
    user.set_password(password)  # Use the proper method to hash password
    db.session.add(user)
    db.session.commit()
    return jsonify({
        'id': user.id, 
        'username': user.username, 
        'role': user.role,
        'full_name': user.full_name
    })

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required(role='admin')
def delete_user(user_id):
    # Admin cannot delete themselves
    if user_id == flask_session['user_id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if user has courses
    if user.courses:
        return jsonify({'error': 'Cannot delete user with existing courses. Delete courses first.'}), 400
    
    db.session.delete(user)
    db.session.commit()
    return jsonify({'result': 'User deleted successfully'})

@app.route('/api/users/<int:user_id>/bulk-delete', methods=['DELETE'])
@login_required(role='admin')
def bulk_delete_user(user_id):
    # Admin cannot delete themselves
    if user_id == flask_session['user_id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        # Count what will be deleted for reporting
        courses_count = len(user.courses)
        sessions_count = 0
        attendances_count = 0
        
        # Delete all courses and their related data for this user
        for course in user.courses:
            course_sessions = Session.query.filter_by(course_id=course.id).all()
            sessions_count += len(course_sessions)
            
            for session in course_sessions:
                # Delete all attendances for each session
                session_attendances = Attendance.query.filter_by(session_id=session.id).all()
                attendances_count += len(session_attendances)
                
                for attendance in session_attendances:
                    db.session.delete(attendance)
                
                # Delete the session
                db.session.delete(session)
            
            # Delete the course
            db.session.delete(course)
        
        # Finally delete the user
        user_name = user.full_name or user.username
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'result': 'User and all associated data deleted successfully',
            'deleted': {
                'user': user_name,
                'courses': courses_count,
                'sessions': sessions_count,
                'attendances': attendances_count
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in bulk delete for user {user_id}: {str(e)}")
        return jsonify({'error': f'Failed to delete user and data: {str(e)}'}), 500

@app.route('/api/users/bulk-import', methods=['POST'])
@login_required(role='admin')
def bulk_import_users():
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not file.filename.lower().endswith('.csv'):
            return jsonify({'error': 'File must be a CSV file'}), 400
        
        # Read CSV content
        csv_content = file.read().decode('utf-8')
        csv_reader = csv.DictReader(StringIO(csv_content))
        
        # Expected CSV columns
        required_columns = ['username', 'password', 'full_name']
        optional_columns = ['email', 'role']
        
        # Validate CSV headers
        if not required_columns[0] in csv_reader.fieldnames:
            return jsonify({'error': f'CSV must contain required columns: {", ".join(required_columns)}'}), 400
        
        created_users = []
        errors = []
        line_number = 1
        
        for row in csv_reader:
            line_number += 1
            
            try:
                # Extract required fields
                username = row.get('username', '').strip()
                password = row.get('password', '').strip()
                full_name = row.get('full_name', '').strip()
                
                # Extract optional fields
                email = row.get('email', '').strip()
                role = row.get('role', 'instructor').strip().lower()
                
                # Validate required fields
                if not username or not password or not full_name:
                    errors.append(f"Line {line_number}: Missing required fields (username, password, full_name)")
                    continue
                
                # Validate role
                if role not in ['admin', 'instructor']:
                    role = 'instructor'  # Default to instructor
                
                # Check if username already exists
                if User.query.filter_by(username=username).first():
                    errors.append(f"Line {line_number}: Username '{username}' already exists")
                    continue
                
                # Create new user
                user = User(
                    username=username,
                    role=role,
                    full_name=full_name,
                    email=email if email else None
                )
                user.set_password(password)
                
                db.session.add(user)
                created_users.append({
                    'username': username,
                    'full_name': full_name,
                    'role': role,
                    'email': email
                })
                
            except Exception as e:
                errors.append(f"Line {line_number}: Error processing user - {str(e)}")
                continue
        
        # Commit all successful users
        if created_users:
            db.session.commit()
        
        return jsonify({
            'success': True,
            'created_count': len(created_users),
            'error_count': len(errors),
            'created_users': created_users,
            'errors': errors
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to process CSV file: {str(e)}'}), 500

@app.route('/api/users/bulk-import/template', methods=['GET'])
@login_required(role='admin')
def download_bulk_import_template():
    """Download a CSV template for bulk user import"""
    try:
        si = StringIO()
        writer = csv.writer(si)
        
        # CSV headers
        writer.writerow(['username', 'password', 'full_name', 'email', 'role'])
        
        # Example rows
        writer.writerow(['john.doe', 'password123', 'John Doe', 'john.doe@school.edu', 'instructor'])
        writer.writerow(['jane.smith', 'password456', 'Jane Smith', 'jane.smith@school.edu', 'instructor'])
        writer.writerow(['admin.user', 'adminpass789', 'Admin User', 'admin@school.edu', 'admin'])
        
        output = si.getvalue()
        from flask import Response
        return Response(
            output,
            mimetype='text/csv',
            headers={
                'Content-Disposition': 'attachment;filename=bulk_user_import_template.csv'
            }
        )
    except Exception as e:
        return jsonify({'error': f'Failed to generate template: {str(e)}'}), 500

@app.route('/api/create_session', methods=['POST'])
@login_required()
def create_session():
    data = request.json
    course_id = data.get('course_id')
    session_name = data.get('session_name', f'Session {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    
    if not course_id:
        return jsonify({'error': 'course_id required'}), 400
        
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404
        
    token = secrets.token_urlsafe(16)
    session = Session(
        course_id=course_id, 
        token=token,
        session_name=session_name,
        session_date=datetime.utcnow()
    )
    db.session.add(session)
    db.session.commit()
    
    # QR code content
    lan_ip = get_lan_ip()
    qr_url = f"http://{lan_ip}:5000/attend/{token}"
    qr_img = qrcode.make(qr_url)
    qr_path = os.path.join(QR_CODES_DIR, f'{token}.png')
    qr_img.save(qr_path)
    
    return jsonify({
        'session_id': session.id, 
        'token': token, 
        'qr_url': qr_url, 
        'qr_image': f'/qr_codes/{token}.png',
        'session_name': session_name,
        'course_name': course.name
    })

@app.route('/qr_codes/<filename>')
def serve_qr(filename):
    return send_from_directory(QR_CODES_DIR, filename)

# Simple attendance form without GPS tracking
ATTEND_FORM_HTML = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance - {{ course_name }}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            margin: 0; 
            padding: 20px; 
            min-height: 100vh;
        }
        .container { 
            max-width: 500px; 
            margin: 30px auto; 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
        }
        h2 { 
            color: #333; 
            margin: 0 0 10px 0; 
            font-size: 24px;
        }
        .course-info { 
            background: linear-gradient(135deg, #f0f8ff, #e6f3ff); 
            padding: 20px; 
            border-radius: 10px; 
            margin-bottom: 25px; 
            border-left: 4px solid #667eea;
        }
        .course-info strong {
            color: #667eea;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600; 
            color: #555; 
            font-size: 14px;
        }
        input { 
            width: 100%; 
            padding: 15px; 
            margin-bottom: 5px; 
            border: 2px solid #e1e5e9; 
            border-radius: 8px; 
            box-sizing: border-box; 
            font-size: 16px; 
            transition: all 0.3s ease;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button { 
            width: 100%; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 18px; 
            border: none; 
            border-radius: 10px; 
            cursor: pointer; 
            font-size: 16px; 
            font-weight: 600; 
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        button:hover:not(:disabled) { 
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .error { 
            color: #e74c3c; 
            text-align: center; 
            padding: 15px; 
            background: #fdf2f2;
            border-radius: 8px;
            margin: 15px 0;
        }
        .success { 
            color: #27ae60; 
            text-align: center; 
            padding: 15px; 
            background: #f0f9f0;
            border-radius: 8px;
            margin: 15px 0;
            font-weight: 600;
        }
        .time-info { 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
            margin-bottom: 25px; 
            background: #f8f9fa;
            padding: 10px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📝 Attendance Check-in</h2>
        </div>
        <div class="course-info">
            <strong>Course:</strong> {{ course_name }}<br>
            <strong>Session:</strong> {{ session_name }}<br>
            <strong>Date:</strong> {{ session_date }}
        </div>
        <div class="time-info">
            📅 Current time: {{ current_time }}
        </div>
        
        <form method="POST" id="attendance-form">
            <div class="form-group">
                <label>👤 First Name:</label>
                <input type="text" name="name" id="name" required placeholder="Enter your first name">
            </div>
            
            <div class="form-group">
                <label>👤 Last Name:</label>
                <input type="text" name="surname" id="surname" required placeholder="Enter your last name">
            </div>
            
            <div class="form-group">
                <label>🎓 Student ID (Optional):</label>
                <input type="text" name="student_id" id="student_id" placeholder="Enter your student ID (optional)">
            </div>
            
            <button type="submit" id="submit-btn">
                <span>✅ Submit Attendance</span>
            </button>
        </form>
        
        {% if error %}<div class="error">❌ {{ error }}</div>{% endif %}
        {% if success %}<div class="success">✅ {{ success }}</div>{% endif %}
    </div>

    <script>
        // Form submission validation
        document.getElementById('attendance-form').addEventListener('submit', function(e) {
            const name = document.getElementById('name').value.trim();
            const surname = document.getElementById('surname').value.trim();
            const submitBtn = document.getElementById('submit-btn');
            
            if (!name || !surname) {
                e.preventDefault();
                alert('Please enter both your first and last name.');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>⏳ Submitting...</span>';
        });
    </script>
</body>
</html>
'''

@app.route('/attend/<token>', methods=['GET', 'POST'])
def attend(token):
    session_obj = Session.query.filter_by(token=token).first()
    if not session_obj:
        return 'Invalid session token', 404
        
    course = db.session.get(Course, session_obj.course_id)
    if not course:
        return 'Course not found', 404
    
    error = None
    success = None
    
    if request.method == 'POST':
        name = request.form.get('name')
        surname = request.form.get('surname')
        student_id = request.form.get('student_id', '')
        ip_address = request.remote_addr
        
        # Get user agent
        user_agent = request.headers.get('User-Agent', '')
        
        if not name or not surname:
            error = 'Name and surname are required.'
        else:
            # Check for duplicate attendance (same session + name + surname)
            existing = Attendance.query.filter_by(
                session_id=session_obj.id, 
                name=name, 
                surname=surname
            ).first()
            
            if existing:
                error = 'You have already submitted attendance for this session.'
            else:
                # Create new attendance record
                attendance = Attendance(
                    session_id=session_obj.id,
                    name=name,
                    surname=surname,
                    student_id=student_id,
                    ip_address=ip_address,
                    attendance_time=datetime.utcnow(),
                    course_name=course.name,
                    user_agent=user_agent
                )
                
                db.session.add(attendance)
                db.session.commit()
                
                success = f'Attendance submitted successfully for {course.name}!'
    
    return render_template_string(
        ATTEND_FORM_HTML,
        course_name=course.name,
        session_name=session_obj.session_name,
        session_date=session_obj.session_date.strftime('%Y-%m-%d %H:%M') if session_obj.session_date else 'N/A',
        current_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        error=error,
        success=success
    )

# Protected Courses API (unchanged but improved)
@app.route('/api/courses', methods=['GET'])
@login_required()
def get_courses():
    user_id = flask_session['user_id']
    role = flask_session['role']
    if role == 'admin':
        courses = Course.query.all()
    else:
        courses = Course.query.filter_by(instructor_id=user_id).all()
    
    # Get instructor information for each course
    courses_with_instructor = []
    for c in courses:
        instructor = db.session.get(User, c.instructor_id)
        course_data = {
            'id': c.id, 
            'name': c.name, 
            'description': c.description,
            'instructor_id': c.instructor_id,
            'instructor_name': instructor.full_name if instructor and instructor.full_name else (instructor.username if instructor else 'Unknown'),
            'instructor_email': instructor.email if instructor else None,
            'created_at': c.created_at.isoformat() if c.created_at else None,
            'is_active': c.is_active,
            'course_code': c.course_code,
            'max_students': c.max_students,
            'sessions_count': len(c.sessions)
        }
        courses_with_instructor.append(course_data)
    
    return jsonify(courses_with_instructor)

@app.route('/api/courses', methods=['POST'])
@login_required()
def add_course():
    data = request.json
    name = data.get('name')
    description = data.get('description', '')
    instructor_id = flask_session['user_id']
    if not name:
        return jsonify({'error': 'Course name required'}), 400
    course = Course(name=name, description=description, instructor_id=instructor_id)
    db.session.add(course)
    db.session.commit()
    return jsonify({
        'id': course.id, 
        'name': course.name, 
        'description': course.description,
        'instructor_id': course.instructor_id
    })

@app.route('/api/courses/<int:course_id>', methods=['DELETE'])
@login_required()
def delete_course(course_id):
    user_id = flask_session['user_id']
    role = flask_session['role']
    
    try:
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        if role != 'admin' and course.instructor_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Delete all sessions related to this course first
        sessions = Session.query.filter_by(course_id=course_id).all()
        for session in sessions:
            # Delete all attendances for each session
            Attendance.query.filter_by(session_id=session.id).delete()
            # Delete the session
            db.session.delete(session)
        
        # Now delete the course
        db.session.delete(course)
        db.session.commit()
        
        print(f"Course {course_id} deleted successfully with {len(sessions)} sessions")
        return jsonify({'result': 'Course deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting course {course_id}: {str(e)}")
        return jsonify({'error': f'Failed to delete course: {str(e)}'}), 500

# Enhanced Sessions API
@app.route('/api/courses/<int:course_id>/sessions', methods=['GET'])
@login_required()
def get_sessions(course_id):
    user_id = flask_session['user_id']
    role = flask_session['role']
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404
    if role != 'admin' and course.instructor_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    sessions = Session.query.filter_by(course_id=course_id).all()
    return jsonify([
        {
            'id': s.id, 
            'token': s.token,
            'session_name': s.session_name,
            'session_date': s.session_date.isoformat() if s.session_date else None,
            'is_active': s.is_active,
            'attendance_count': len(s.attendances)
        } for s in sessions
    ])

@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
@login_required()
def delete_session(session_id):
    user_id = flask_session['user_id']
    role = flask_session['role']
    session_obj = db.session.get(Session, session_id)
    if not session_obj:
        return jsonify({'error': 'Session not found'}), 404
    course = db.session.get(Course, session_obj.course_id)
    if role != 'admin' and course.instructor_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(session_obj)
    db.session.commit()
    return jsonify({'result': 'deleted'})

@app.route('/api/sessions/<int:session_id>/export_csv', methods=['GET'])
@login_required()
def export_session_csv(session_id):
    user_id = flask_session['user_id']
    role = flask_session['role']
    session_obj = db.session.get(Session, session_id)
    if not session_obj:
        return jsonify({'error': 'Session not found'}), 404
    course = db.session.get(Course, session_obj.course_id)
    if role != 'admin' and course.instructor_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    attendances = Attendance.query.filter_by(session_id=session_id).all()
    si = StringIO()
    writer = csv.writer(si)
    
    # CSV headers without location data
    writer.writerow([
        'Name', 'Surname', 'Student ID', 'Course', 'Session', 
        'Attendance Time', 'IP Address', 'Device/Browser', 'Status'
    ])
    
    for a in attendances:
        # Simplify user agent for readability
        device_info = 'Unknown'
        if a.user_agent:
            user_agent = a.user_agent.lower()
            if 'mobile' in user_agent or 'android' in user_agent or 'iphone' in user_agent:
                device_info = 'Mobile Device'
            elif 'tablet' in user_agent or 'ipad' in user_agent:
                device_info = 'Tablet'
            else:
                device_info = 'Desktop Browser'
        
        writer.writerow([
            a.name, 
            a.surname, 
            a.student_id or 'N/A',
            a.course_name,
            session_obj.session_name,
            a.attendance_time.strftime('%Y-%m-%d %H:%M:%S') if a.attendance_time else 'N/A',
            a.ip_address,
            device_info,
            a.status or 'present'
        ])
    
    output = si.getvalue()
    from flask import Response
    return Response(
        output,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment;filename=session_{session_id}_attendance.csv'
        }
    )

# Analytics endpoints
@app.route('/api/analytics/dashboard', methods=['GET'])
@login_required()
def analytics_dashboard():
    try:
        # Get overall statistics
        total_courses = Course.query.filter_by(is_active=True).count()
        total_sessions = Session.query.count()
        total_attendances = Attendance.query.count()
        active_sessions = Session.query.filter_by(is_active=True).count()
        
        # Get recent activity (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_attendances = Attendance.query.filter(
            Attendance.attendance_time >= week_ago
        ).count()
        
        # Get top courses by attendance
        top_courses = db.session.query(
            Course.name, 
            Course.course_code,
            db.func.count(Attendance.id).label('attendance_count')
        ).join(Session).join(Attendance).group_by(Course.id).order_by(
            db.func.count(Attendance.id).desc()
        ).limit(5).all()
        
        # Get attendance trends (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        attendance_trends = db.session.query(
            db.func.date(Attendance.attendance_time).label('date'),
            db.func.count(Attendance.id).label('count')
        ).filter(
            Attendance.attendance_time >= thirty_days_ago
        ).group_by(
            db.func.date(Attendance.attendance_time)
        ).order_by('date').all()
        
        return jsonify({
            'overview': {
                'total_courses': total_courses,
                'total_sessions': total_sessions,
                'total_attendances': total_attendances,
                'active_sessions': active_sessions,
                'recent_attendances': recent_attendances
            },
            'top_courses': [
                {
                    'name': course[0],
                    'code': course[1],
                    'attendance_count': course[2]
                } for course in top_courses
            ],
            'attendance_trends': [
                {
                    'date': trend[0],
                    'count': trend[1]
                } for trend in attendance_trends
            ]
        })
    except Exception as e:
        print(f"Analytics error: {str(e)}")
        return jsonify({'error': 'Failed to fetch analytics data'}), 500

@app.route('/api/analytics/course/<int:course_id>', methods=['GET'])
@login_required()
def course_analytics(course_id):
    try:
        course = db.session.get(Course, course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # Check permissions
        user_id = flask_session['user_id']
        role = flask_session['role']
        if role != 'admin' and course.instructor_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get course sessions
        sessions = Session.query.filter_by(course_id=course_id).all()
        
        # Get attendance statistics
        total_attendances = Attendance.query.join(Session).filter(
            Session.course_id == course_id
        ).count()
        
        unique_students = db.session.query(
            Attendance.name, Attendance.surname
        ).join(Session).filter(
            Session.course_id == course_id
        ).distinct().count()
        
        # Session attendance rates
        session_stats = []
        for session in sessions:
            attendance_count = len(session.attendances)
            session_stats.append({
                'session_name': session.session_name,
                'date': session.session_date.isoformat() if session.session_date else None,
                'attendance_count': attendance_count,
                'is_active': session.is_active
            })
        
        return jsonify({
            'course': {
                'name': course.name,
                'code': course.course_code,
                'description': course.description,
                'max_students': course.max_students
            },
            'statistics': {
                'total_sessions': len(sessions),
                'total_attendances': total_attendances,
                'unique_students': unique_students,
                'average_attendance': total_attendances / len(sessions) if sessions else 0
            },
            'sessions': session_stats
        })
    except Exception as e:
        print(f"Course analytics error: {str(e)}")
        return jsonify({'error': 'Failed to fetch course analytics'}), 500

if __name__ == '__main__':
    # Initialize database on startup
    init_db()
    print("\n" + "="*60)
    print("🎓 QR ATTENDANCE SYSTEM - ENHANCED VERSION 🎓")
    print("="*60)
    print(f"Frontend: http://localhost:5000")
    print(f"LAN Access: http://{get_lan_ip()}:5000")
    print("\n📚 Default Login Credentials:")
    print("👨‍💼 Admin: username=admin, password=admin123")
    print("👨‍🏫 Instructor: username=instructor, password=instructor123")
    print("📱 Students: NO LOGIN - Only QR Code Access")
    print("="*60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True) 