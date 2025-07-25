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
from datetime import datetime

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///attendance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = os.environ.get('SECRET_KEY', 'dev_secret_key_change_in_production')

db = SQLAlchemy(app)
CORS(app)

QR_CODES_DIR = os.path.join(os.path.dirname(__file__), '../qr_codes')
os.makedirs(QR_CODES_DIR, exist_ok=True)

# Enhanced Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # admin, instructor (students don't need accounts)
    full_name = db.Column(db.String(120), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    courses = db.relationship('Course', backref='instructor', lazy=True)

class Course(db.Model):
    __tablename__ = 'courses'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sessions = db.relationship('Session', backref='course', lazy=True)

class Session(db.Model):
    __tablename__ = 'sessions'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    session_name = db.Column(db.String(120), nullable=True)
    session_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    attendances = db.relationship('Attendance', backref='session', lazy=True)

class Attendance(db.Model):
    __tablename__ = 'attendances'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    surname = db.Column(db.String(120), nullable=False)
    student_id = db.Column(db.String(50), nullable=True)  # Optional student ID
    ip_address = db.Column(db.String(45), nullable=False)
    attendance_time = db.Column(db.DateTime, default=datetime.utcnow)
    course_name = db.Column(db.String(120), nullable=True)  # Denormalized for easy access

# Database initialization with enhanced data and migration support
def init_db():
    with app.app_context():
        db.create_all()
        
        # Check and add new columns if they don't exist (migration)
        try:
            # Try to query new columns, if fails then add them
            db.session.execute(db.text('SELECT full_name, email, created_at FROM users LIMIT 1')).first()
        except Exception as e:
            print("Migrating User table...")
            db.session.execute(db.text('ALTER TABLE users ADD COLUMN full_name VARCHAR(120)'))
            db.session.execute(db.text('ALTER TABLE users ADD COLUMN email VARCHAR(120)'))
            db.session.execute(db.text('ALTER TABLE users ADD COLUMN created_at DATETIME'))
            db.session.commit()
            print("User table migrated!")
        
        try:
            db.session.execute(db.text('SELECT description, created_at FROM courses LIMIT 1')).first()
        except Exception as e:
            print("Migrating Course table...")
            db.session.execute(db.text('ALTER TABLE courses ADD COLUMN description TEXT'))
            db.session.execute(db.text('ALTER TABLE courses ADD COLUMN created_at DATETIME'))
            db.session.commit()
            print("Course table migrated!")
        
        try:
            db.session.execute(db.text('SELECT session_name, session_date, is_active FROM sessions LIMIT 1')).first()
        except Exception as e:
            print("Migrating Session table...")
            db.session.execute(db.text('ALTER TABLE sessions ADD COLUMN session_name VARCHAR(120)'))
            db.session.execute(db.text('ALTER TABLE sessions ADD COLUMN session_date DATETIME'))
            db.session.execute(db.text('ALTER TABLE sessions ADD COLUMN is_active BOOLEAN DEFAULT 1'))
            db.session.commit()
            print("Session table migrated!")
        
        try:
            db.session.execute(db.text('SELECT student_id, attendance_time, course_name FROM attendances LIMIT 1')).first()
        except Exception as e:
            print("Migrating Attendance table...")
            db.session.execute(db.text('ALTER TABLE attendances ADD COLUMN student_id VARCHAR(50)'))
            db.session.execute(db.text('ALTER TABLE attendances ADD COLUMN attendance_time DATETIME'))
            db.session.execute(db.text('ALTER TABLE attendances ADD COLUMN course_name VARCHAR(120)'))
            db.session.commit()
            print("Attendance table migrated!")
        
        # Create default admin and instructor users only
        if not User.query.filter_by(username='admin').first():
            admin = User(
                username='admin', 
                password='admin123', 
                role='admin',
                full_name='System Administrator',
                email='admin@school.edu'
            )
            db.session.add(admin)
        
        if not User.query.filter_by(username='instructor').first():
            instructor = User(
                username='instructor', 
                password='instructor123', 
                role='instructor',
                full_name='John Smith',
                email='john.smith@school.edu'
            )
            db.session.add(instructor)
        
        db.session.commit()
        
        # Add sample courses if none exist
        if Course.query.count() == 0:
            instructor_user = User.query.filter_by(username='instructor').first()
            admin_user = User.query.filter_by(username='admin').first()
            
            sample_courses = [
                Course(
                    name='Mathematics 101', 
                    description='Basic Mathematics Course',
                    instructor_id=instructor_user.id
                ),
                Course(
                    name='Physics 201', 
                    description='Introduction to Physics',
                    instructor_id=instructor_user.id
                ),
                Course(
                    name='Computer Science 301', 
                    description='Advanced Programming',
                    instructor_id=admin_user.id
                )
            ]
            
            for course in sample_courses:
                db.session.add(course)
            
            db.session.commit()
            print("Sample courses created!")
        
        print("Database initialized - INSTRUCTOR/ADMIN ONLY SYSTEM:")
        print("👨‍💼 Admin: username=admin, password=admin123")
        print("👨‍🏫 Instructor: username=instructor, password=instructor123")
        print("📱 Students: NO LOGIN - Only QR Code Access")
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
    user = User.query.filter_by(username=username, password=password).first()
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    flask_session['user_id'] = user.id
    flask_session['role'] = user.role
    flask_session['username'] = user.username
    flask_session['full_name'] = user.full_name
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
            'created_at': u.created_at.isoformat() if u.created_at else None
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
        password=password, 
        role=role,
        full_name=full_name,
        email=email
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({
        'id': user.id, 
        'username': user.username, 
        'role': user.role,
        'full_name': user.full_name
    })

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

# Enhanced attendance form
ATTEND_FORM_HTML = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance - {{ course_name }}</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f8f8f8; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 30px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        h2 { color: #333; margin: 0; }
        .course-info { background: #f0f8ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px; }
        button { width: 100%; background: #007bff; color: white; padding: 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; }
        button:hover { background: #0056b3; }
        .error { color: red; text-align: center; padding: 10px; }
        .success { color: green; text-align: center; padding: 10px; font-weight: bold; }
        .time-info { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📝 Attendance Form</h2>
        </div>
        <div class="course-info">
            <strong>Course:</strong> {{ course_name }}<br>
            <strong>Session:</strong> {{ session_name }}<br>
            <strong>Date:</strong> {{ session_date }}
        </div>
        <div class="time-info">
            Current time: {{ current_time }}
        </div>
        <form method="POST">
            <label>👤 First Name:</label>
            <input type="text" name="name" required placeholder="Enter your first name">
            
            <label>👤 Last Name:</label>
            <input type="text" name="surname" required placeholder="Enter your last name">
            
            <label>🎓 Student ID (Optional):</label>
            <input type="text" name="student_id" placeholder="Enter your student ID (optional)">
            
            <button type="submit">✅ Submit Attendance</button>
        </form>
        {% if error %}<p class="error">❌ {{ error }}</p>{% endif %}
        {% if success %}<p class="success">✅ {{ success }}</p>{% endif %}
    </div>
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
        
        if not name or not surname:
            error = 'Name and surname are required.'
        else:
            # Check for duplicate attendance
            existing = Attendance.query.filter_by(
                session_id=session_obj.id, 
                name=name, 
                surname=surname, 
                ip_address=ip_address
            ).first()
            
            if existing:
                error = 'You have already submitted attendance for this session.'
            else:
                attendance = Attendance(
                    session_id=session_obj.id,
                    name=name,
                    surname=surname,
                    student_id=student_id,
                    ip_address=ip_address,
                    attendance_time=datetime.utcnow(),
                    course_name=course.name
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
    return jsonify([
        {
            'id': c.id, 
            'name': c.name, 
            'description': c.description,
            'instructor_id': c.instructor_id,
            'created_at': c.created_at.isoformat() if c.created_at else None
        } for c in courses
    ])

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
    course = db.session.get(Course, course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404
    if role != 'admin' and course.instructor_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(course)
    db.session.commit()
    return jsonify({'result': 'deleted'})

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
    writer.writerow([
        'Name', 'Surname', 'Student ID', 'Course', 'Session', 
        'Attendance Time', 'IP Address'
    ])
    
    for a in attendances:
        writer.writerow([
            a.name, 
            a.surname, 
            a.student_id or 'N/A',
            a.course_name,
            session_obj.session_name,
            a.attendance_time.strftime('%Y-%m-%d %H:%M:%S') if a.attendance_time else 'N/A',
            a.ip_address
        ])
    
    output = si.getvalue()
    from flask import Response
    return Response(
        output,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment;filename=session_{session_id}_attendances.csv'
        }
    )

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