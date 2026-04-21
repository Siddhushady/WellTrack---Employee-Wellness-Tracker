from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import base64
import io
from PIL import Image
import torch
import torch.nn.functional as F
import torchvision.transforms as transforms
from arc import EmotionModel
import time
import asyncio
import socketio
import logging
import os
import pandas as pd
import psycopg2
from datetime import datetime, timedelta
from typing import Optional
import re
import random
from agents.data_agent import DataAgent
from agents.coordinator import CoordinatorAgent

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI and SocketIO
app = FastAPI(exception_handlers={})  # Disable default exception handlers to avoid recursion
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*', logger=True, engineio_logger=False)
app_asgi = socketio.ASGIApp(sio)

# Add CORS middleware to handle OPTIONS requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],
)

# Mount static files directory (only if it exists)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
else:
    logger.warning("Static directory not found, skipping static files mount")

app.mount("/socket.io", app_asgi)  # Explicitly mount SocketIO to avoid conflicts

VALID_DEPARTMENTS = ['IT', 'Accounting', 'Marketing', 'All']
VALID_ROLES = ['Employee', 'HR/Manager']


def init_database(conn):
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS employees (
                    employee_id VARCHAR(50) PRIMARY KEY,
                    department VARCHAR(50) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'Employee',
                    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
                    consent_given_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT FALSE")
            cur.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMP NULL")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS employee_consents (
                    id SERIAL PRIMARY KEY,
                    employee_id VARCHAR(50) REFERENCES employees(employee_id),
                    consent_to_recording BOOLEAN NOT NULL,
                    consent_to_analytics BOOLEAN NOT NULL,
                    consent_to_policy BOOLEAN NOT NULL,
                    confirmation_text VARCHAR(200) NOT NULL,
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id SERIAL PRIMARY KEY,
                    employee_id VARCHAR(50) REFERENCES employees(employee_id),
                    duration_seconds DOUBLE PRECISION NOT NULL,
                    dominant_emotion VARCHAR(50),
                    session_date DATE NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS emotion_details (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
                    emotion VARCHAR(50) NOT NULL,
                    count INTEGER NOT NULL,
                    percentage DOUBLE PRECISION NOT NULL
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS feedback_logins (
                    employee_id VARCHAR(50) PRIMARY KEY,
                    department VARCHAR(50) NOT NULL,
                    is_admin BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS feedback_responses (
                    id SERIAL PRIMARY KEY,
                    employee_id VARCHAR(50) REFERENCES feedback_logins(employee_id),
                    department VARCHAR(50) NOT NULL,
                    question_1 INT NOT NULL,
                    question_2 INT NOT NULL,
                    question_3 INT NOT NULL,
                    question_4 INT NOT NULL,
                    question_5 INT NOT NULL,
                    text_feedback TEXT,
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        conn.rollback()


# Database connection (optional - server can run without it)
conn = None
cursor = None
try:
    conn = psycopg2.connect(
        dbname="emotion_detection",
        user="postgres",
        password="@Siddhuduke3",
        host="localhost",
        port="5432"
    )
    cursor = conn.cursor()
    logger.info("✅ Database connected successfully")
    init_database(conn)

    # Initialize placeholder employee
    try:
        cursor.execute(
            "INSERT INTO employees (employee_id, department, role) VALUES (%s, %s, %s) ON CONFLICT (employee_id) DO NOTHING",
            ("unknown", "Unknown", "Employee")
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.warning(f"Failed to initialize placeholder employee: {e}")

except Exception as e:
    logger.warning(f"⚠️ Database connection failed: {e}")
    logger.warning("⚠️ Server will run without database. Some features may be limited.")
    logger.warning("⚠️ To enable database features, start PostgreSQL and restart the server.")
    conn = None
    cursor = None

# Model initialization
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# Model path - relative to Backend folder
MODEL_FILE = "welltrack_resnet18_cbam_raf_best.pt"
MODEL_PATH = os.path.join(os.path.dirname(__file__), MODEL_FILE)
MODEL_PATHS = {
    "new_model": MODEL_PATH
}
EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# Verify model file exists
if not os.path.exists(MODEL_PATH):
    logger.error(f"Model file not found at: {MODEL_PATH}")
    logger.error(f"Current working directory: {os.getcwd()}")
    logger.error(f"Script directory: {os.path.dirname(__file__)}")
    raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

logger.info(f"Loading model from: {MODEL_PATH}")
try:
    model = EmotionModel()
    model.load(MODEL_PATHS["new_model"], device)
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Model initialization failed: {e}")
    raise

# RGB Transform (no grayscale)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def add_edge_channel(img_pil: Image.Image) -> torch.Tensor:
    img_np = np.array(img_pil)
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 100, 200).astype(np.float32) / 255.0
    edge_tensor = torch.from_numpy(edges).unsqueeze(0)
    edge_tensor = F.interpolate(edge_tensor.unsqueeze(0), size=(224, 224), mode="bilinear", align_corners=False).squeeze(0)
    return edge_tensor

# Face cascade
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Track active camera sessions and user sessions
active_cameras = {}
user_sessions = {}  # Store employee_id and session_id per Socket.IO session

class LoginRequest(BaseModel):
    employee_id: str
    department: str
    role: str

class SelectionRequest(BaseModel):
    model: str

class FeedbackLoginRequest(BaseModel):
    employee_id: Optional[str] = None
    department: Optional[str] = None
    password: Optional[str] = None

class FeedbackResponse(BaseModel):
    employee_id: str
    department: str
    question_1: int
    question_2: int
    question_3: int
    question_4: int
    question_5: int
    text_feedback: Optional[str]

class EmployeeConsentRequest(BaseModel):
    employee_id: str
    consent_to_recording: bool
    consent_to_analytics: bool
    consent_to_policy: bool
    confirmation_text: str

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    logger.info("Root route accessed")
    try:
        with open("dashboard.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Failed to read dashboard.html: {e}")
        raise HTTPException(status_code=500, detail="Error reading dashboard.html")

@app.get("/dashboard.html", response_class=HTMLResponse)
async def get_dashboard_html():
    logger.info("Dashboard route accessed")
    try:
        if os.path.exists("dashboard.html"):
            with open("dashboard.html", "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        else:
            logger.warning("dashboard.html not found, serving index.html as fallback")
            with open("index.html", "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Failed to read dashboard.html or index.html: {e}")
        raise HTTPException(status_code=500, detail="Error reading dashboard.html or index.html")

@app.get("/index.html", response_class=HTMLResponse)
async def get_index():
    logger.info("Index route accessed")
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Failed to read index.html: {e}")
        raise HTTPException(status_code=500, detail="Error reading index.html")

@app.get("/login-screen", response_class=HTMLResponse)
async def get_login_screen():
    logger.info("Login screen route accessed")
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except Exception as e:
        logger.error(f"Failed to read index.html for login-screen: {e}")
        raise HTTPException(status_code=500, detail="Error reading index.html")

@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)

@app.post("/login")
async def login(request: LoginRequest):
    logger.info(f"Login attempt with employee_id: {request.employee_id}, department: {request.department}, role: {request.role}")

    if not re.match(r'^[A-Za-z0-9]+$', request.employee_id):
        logger.error(f"Invalid employee_id format: {request.employee_id}")
        raise HTTPException(status_code=400, detail="Employee ID must be alphanumeric")
    if request.department not in VALID_DEPARTMENTS:
        logger.error(f"Invalid department: {request.department}")
        raise HTTPException(status_code=400, detail="Invalid department")
    if request.role not in VALID_ROLES:
        logger.error(f"Invalid role: {request.role}")
        raise HTTPException(status_code=400, detail="Invalid role")

    needs_consent = request.role == 'Employee'

    if conn and cursor:
        try:
            cursor.execute(
                "SELECT employee_id, department, role, COALESCE(consent_given, FALSE) FROM employees WHERE employee_id = %s",
                (request.employee_id,),
            )
            existing = cursor.fetchone()
            if not existing:
                logger.info(f"Employee ID {request.employee_id} not found, creating new entry")
                cursor.execute(
                    "INSERT INTO employees (employee_id, department, role, consent_given) VALUES (%s, %s, %s, %s)",
                    (request.employee_id, request.department, request.role, False),
                )
                needs_consent = request.role == 'Employee'
            else:
                _, existing_department, existing_role, existing_consent = existing
                if existing_department != request.department or existing_role != request.role:
                    logger.error(
                        f"Invalid credentials for employee_id {request.employee_id}: "
                        f"existing (dept={existing_department}, role={existing_role}), "
                        f"got (dept={request.department}, role={request.role})"
                    )
                    raise HTTPException(status_code=400, detail="Invalid credentials")
                logger.info(f"Employee ID {request.employee_id} found with matching department and role")
                needs_consent = (request.role == 'Employee') and (not bool(existing_consent))
            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            logger.warning(f"Database error during login (continuing anyway): {e}")
    else:
        logger.info("Database not available, login proceeding without database storage")

    return {
        "message": "Login successful",
        "employee_id": request.employee_id,
        "needs_consent": needs_consent
    }

@app.post("/employee_consent")
async def employee_consent(request: EmployeeConsentRequest):
    if not re.match(r'^[A-Za-z0-9]+$', request.employee_id):
        raise HTTPException(status_code=400, detail="Employee ID must be alphanumeric")

    confirmation_text = request.confirmation_text.strip()
    if confirmation_text != "I provide my consent":
        raise HTTPException(status_code=400, detail="Confirmation text does not match required statement")

    if not (request.consent_to_recording and request.consent_to_analytics and request.consent_to_policy):
        raise HTTPException(status_code=400, detail="All consent responses must be accepted")

    if not conn or not cursor:
        return {"message": "Consent recorded", "employee_id": request.employee_id}

    try:
        cursor.execute(
            "SELECT role FROM employees WHERE employee_id = %s",
            (request.employee_id,)
        )
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Employee not found")

        role = existing[0]
        if role != 'Employee':
            raise HTTPException(status_code=400, detail="Consent form applies only to Employee role")

        cursor.execute(
            """
            INSERT INTO employee_consents
            (employee_id, consent_to_recording, consent_to_analytics, consent_to_policy, confirmation_text)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                request.employee_id,
                request.consent_to_recording,
                request.consent_to_analytics,
                request.consent_to_policy,
                confirmation_text,
            )
        )

        cursor.execute(
            """
            UPDATE employees
            SET consent_given = TRUE,
                consent_given_at = CURRENT_TIMESTAMP
            WHERE employee_id = %s
            """,
            (request.employee_id,)
        )

        conn.commit()
        return {"message": "Consent recorded", "employee_id": request.employee_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error storing employee consent: {e}")
        raise HTTPException(status_code=500, detail="Failed to store consent")

@app.post("/select")
async def select_model(request: SelectionRequest):
    if request.model not in MODEL_PATHS:
        raise HTTPException(status_code=400, detail="Invalid model selected")
    try:
        model.load(MODEL_PATHS[request.model], device)
        return {"message": "Model selected successfully"}
    except Exception as e:
        logger.error(f"Model selection error: {e}")
        raise HTTPException(status_code=500, detail="Error selecting model")

@app.post("/feedback_login")
async def feedback_login(request: FeedbackLoginRequest):
    try:
        if request.password:
            if request.password != "admin123":
                raise HTTPException(status_code=400, detail="Incorrect admin password")
            return {"message": "Admin login successful"}
        if not request.employee_id:
            raise HTTPException(status_code=400, detail="Employee ID is required for employee login")
        if not re.match(r'^[A-Za-z]{3}$', request.employee_id):
            raise HTTPException(status_code=400, detail="Employee ID must be exactly 3 letters")
        if not request.department or request.department not in ['IT', 'Accounting', 'Marketing', 'All']:
            raise HTTPException(status_code=400, detail="Invalid or missing department")
        cursor.execute(
            "INSERT INTO feedback_logins (employee_id, department, is_admin) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            (request.employee_id, request.department, False)
        )
        conn.commit()
        return {"message": "Feedback login successful"}
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Database error in feedback_login: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in feedback_login: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/submit_feedback")
async def submit_feedback(request: FeedbackResponse):
    try:
        cursor.execute(
            """
            INSERT INTO feedback_responses 
            (employee_id, department, question_1, question_2, question_3, question_4, question_5, text_feedback)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                request.employee_id, request.department, request.question_1, request.question_2,
                request.question_3, request.question_4, request.question_5, request.text_feedback
            )
        )
        conn.commit()
        return {"message": "Feedback submitted successfully"}
    except Exception as e:
        conn.rollback()
        logger.error(f"Feedback submission error: {e}")
        raise HTTPException(status_code=500, detail="Error submitting feedback")

@app.get("/admin_feedback")
async def get_admin_feedback(employee_id: str):
    if not re.match(r'^[A-Za-z]{3}$', employee_id):
        raise HTTPException(status_code=400, detail="Employee ID must be 3 letters")
    try:
        cursor.execute(
            """
            SELECT department, question_1, question_2, question_3, question_4, question_5, text_feedback, submitted_at
            FROM feedback_responses WHERE employee_id = %s
            """,
            (employee_id,)
        )
        feedback = cursor.fetchall()
        if not feedback:
            raise HTTPException(status_code=404, detail="No feedback found for this employee")
        return [
            {
                "department": row[0],
                "question_1": row[1],
                "question_2": row[2],
                "question_3": row[3],
                "question_4": row[4],
                "question_5": row[5],
                "text_feedback": row[6],
                "submitted_at": row[7]
            } for row in feedback
        ]
    except Exception as e:
        logger.error(f"Admin feedback retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving feedback")

@sio.event
async def connect(sid, environ):
    try:
        logger.info(f"Socket.IO client connected: {sid}")
        active_cameras[sid] = {'active': False, 'cap': None, 'start_time': None, 'frame_count': 0, 'emotions_detected': {emotion: 0 for emotion in EMOTIONS}, 'emotion_history': []}
        user_sessions[sid] = {'employee_id': None, 'session_id': None}
        await sio.emit('connection_success', {'message': 'Connected to server'}, to=sid)
    except Exception as e:
        logger.error(f"Error in SocketIO connect event: {e}")
        await sio.emit('error', {'message': f'Connection error: {str(e)}'}, to=sid)
        raise

@sio.event
async def disconnect(sid):
    logger.info(f"Socket.IO client disconnected: {sid}")
    if sid in active_cameras and active_cameras[sid]['cap']:
        active_cameras[sid]['cap'].release()
    await save_session_data(sid)
    active_cameras.pop(sid, None)
    user_sessions.pop(sid, None)

@sio.event
async def set_employee_id(sid, data):
    try:
        logger.info(f"set_employee_id called with sid: {sid}, data: {data}")
        if sid in user_sessions and 'employee_id' in data:
            # If database is available, verify employee exists; otherwise just set it
            if conn and cursor:
                try:
                    cursor.execute("SELECT employee_id FROM employees WHERE employee_id = %s", (data['employee_id'],))
                    if cursor.fetchone():
                        user_sessions[sid]['employee_id'] = data['employee_id']
                        logger.info(f"Set employee_id {data['employee_id']} for sid {sid}")
                    else:
                        logger.warning(f"Employee_id {data['employee_id']} not in database, but allowing anyway")
                        user_sessions[sid]['employee_id'] = data['employee_id']
                except Exception as e:
                    logger.warning(f"Database error in set_employee_id (continuing anyway): {e}")
                    user_sessions[sid]['employee_id'] = data['employee_id']
            else:
                # No database, just set the employee_id
                user_sessions[sid]['employee_id'] = data['employee_id']
                logger.info(f"Set employee_id {data['employee_id']} for sid {sid} (no database)")
        else:
            logger.error(f"Invalid set_employee_id call: sid {sid} not in user_sessions or employee_id missing")
            await sio.emit('error', {'message': 'Invalid employee ID data'}, to=sid)
    except Exception as e:
        logger.error(f"Error in set_employee_id: {e}")
        await sio.emit('error', {'message': f'Employee ID error: {str(e)}'}, to=sid)

async def save_session_data(sid):
    if sid not in active_cameras or active_cameras[sid]['frame_count'] == 0:
        return
    
    # Skip database save if database is not available
    if not conn or not cursor:
        logger.debug(f"Database not available, skipping session save for sid {sid}")
        return
    
    try:
        session_duration = time.time() - active_cameras[sid]['start_time']
        emotions_detected = active_cameras[sid]['emotions_detected']
        dominant_emotion = max(emotions_detected.items(), key=lambda x: x[1])[0] if any(emotions_detected.values()) else "unknown"
        employee_id = user_sessions[sid]['employee_id']
        if not employee_id:
            logger.warning(f"No employee_id for sid {sid}, skipping session save")
            return
        cursor.execute(
            """
            INSERT INTO sessions 
            (employee_id, duration_seconds, dominant_emotion, session_date)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (employee_id, session_duration, dominant_emotion, datetime.now().date())
        )
        session_id = cursor.fetchone()[0]
        user_sessions[sid]['session_id'] = session_id
        total_frames = active_cameras[sid]['frame_count']
        for emotion, count in emotions_detected.items():
            if count > 0:
                percentage = (count / total_frames) * 100
                cursor.execute(
                    """
                    INSERT INTO emotion_details 
                    (session_id, emotion, count, percentage)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (session_id, emotion, count, percentage)
                )
        conn.commit()
        logger.info(f"Saved session data for sid {sid}, session_id {session_id}, employee_id {employee_id}")
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Failed to save session data for sid {sid}: {e}")
    except Exception as e:
        logger.warning(f"Error saving session data (non-critical): {e}")

@sio.event
async def start_camera(sid):
    logger.info(f"Starting camera for session: {sid}")
    if sid not in active_cameras or sid not in user_sessions:
        await sio.emit('error', {'message': 'Session not found'}, to=sid)
        return
    if not user_sessions[sid]['employee_id']:
        await sio.emit('error', {'message': 'Please log in before starting camera'}, to=sid)
        return
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        await sio.emit('error', {'message': 'Failed to open camera'}, to=sid)
        return
    active_cameras[sid]['cap'] = cap
    active_cameras[sid]['active'] = True
    active_cameras[sid]['start_time'] = time.time()
    active_cameras[sid]['frame_count'] = 0
    active_cameras[sid]['emotions_detected'] = {emotion: 0 for emotion in EMOTIONS}
    active_cameras[sid]['emotion_history'] = []
    history_size = 7
    dominant_emotion = "unknown"
    try:
        while active_cameras[sid]['active']:
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"Failed to read frame for session: {sid}")
                await sio.emit('error', {'message': 'Failed to read camera frame'}, to=sid)
                continue
            faces = face_cascade.detectMultiScale(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 1.1, 5, minSize=(30, 30))
            if len(faces) == 0:
                logger.debug(f"No faces detected in frame for session: {sid}")
            for (x, y, w, h) in faces:
                face_roi = frame[y:y+h, x:x+w]
                try:
                    pil_img = Image.fromarray(cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB))
                    rgb_tensor = transform(pil_img)
                    edge_tensor = add_edge_channel(pil_img)
                    img_tensor = torch.cat([rgb_tensor, edge_tensor], dim=0).unsqueeze(0).to(device)
                    with torch.no_grad():
                        prediction = model.predict(img_tensor)
                        probs = prediction[0].cpu().numpy()
                        emotion_idx = np.argmax(probs)
                        confidence = probs[emotion_idx]
                        predicted_emotion = EMOTIONS[emotion_idx]
                    if confidence >= 0.4:
                        active_cameras[sid]['emotion_history'].append((predicted_emotion, confidence))
                        if len(active_cameras[sid]['emotion_history']) > history_size:
                            active_cameras[sid]['emotion_history'].pop(0)
                        counts = {}
                        for emotion, conf in active_cameras[sid]['emotion_history']:
                            counts[emotion] = counts.get(emotion, 0) + 1
                        dominant_emotion = max(counts, key=counts.get) if counts else "unknown"
                        if dominant_emotion and dominant_emotion != "unknown":
                            active_cameras[sid]['emotions_detected'][dominant_emotion] += 1
                            color = {
                                'angry': (0, 0, 255), 'disgust': (0, 140, 255), 'fear': (0, 69, 255),
                                'happy': (0, 255, 0), 'neutral': (255, 255, 0), 'sad': (255, 0, 0),
                                'surprise': (255, 0, 255)
                            }.get(dominant_emotion, (255, 255, 255))
                            cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
                            cv2.putText(frame, f"{dominant_emotion}: {confidence:.2f}", (x, y-10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                except Exception as e:
                    logger.error(f"Error processing face for session {sid}: {e}")
                    continue
            active_cameras[sid]['frame_count'] += 1
            if active_cameras[sid]['frame_count'] % 100 == 0:
                logger.info(f"Processed {active_cameras[sid]['frame_count']} frames for session: {sid}")
                await save_session_data(sid)
            session_duration = time.time() - active_cameras[sid]['start_time']
            hours, rem = divmod(int(session_duration), 3600)
            mins, secs = divmod(rem, 60)
            try:
                _, buffer = cv2.imencode('.jpg', frame)
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                await sio.emit('frame', {
                    'frame': frame_base64,
                    'stats': active_cameras[sid]['emotions_detected'],
                    'status': dominant_emotion.capitalize() if dominant_emotion != "unknown" else 'No emotion detected',
                    'sessionTime': f"{hours:02}:{mins:02}:{secs:02}"
                }, to=sid)
            except Exception as e:
                logger.error(f"Error emitting frame for session {sid}: {e}")
                continue
            await asyncio.sleep(0.033)
    except Exception as e:
        logger.error(f"Error in camera loop for session {sid}: {e}")
        await sio.emit('error', {'message': f'Camera error: {str(e)}'}, to=sid)
    finally:
        cap.release()
        active_cameras[sid]['cap'] = None
        active_cameras[sid]['active'] = False
        await save_session_data(sid)
        logger.info(f"Camera stopped for session: {sid}, processed {active_cameras[sid]['frame_count']} frames")

@sio.event
async def stop_camera(sid):
    logger.info(f"Stopping camera for session: {sid}")
    if sid in active_cameras and active_cameras[sid]['active']:
        active_cameras[sid]['active'] = False
        if active_cameras[sid]['cap']:
            active_cameras[sid]['cap'].release()
            active_cameras[sid]['cap'] = None
        await save_session_data(sid)
        await sio.emit('camera_stopped', {'message': 'Camera stopped successfully'}, to=sid)

@app.post("/upload_video")
async def upload_video(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    cap = cv2.VideoCapture(io.BytesIO(nparr))
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Failed to open video")
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames_to_process = min(total_frames, 100)
    emotions_detected = {emotion: 0 for emotion in EMOTIONS}
    emotion_history = []
    history_size = 7
    frame_count = 0
    start_time = time.time()
    while cap.isOpened() and frame_count < frames_to_process:
        ret, frame = cap.read()
        if not ret:
            break
        faces = face_cascade.detectMultiScale(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 1.1, 5, minSize=(30, 30))
        for face_roi in [frame[y:y+h, x:x+w] for (x, y, w, h) in faces]:
            try:
                pil_img = Image.fromarray(cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB))
                rgb_tensor = transform(pil_img)
                edge_tensor = add_edge_channel(pil_img)
                img_tensor = torch.cat([rgb_tensor, edge_tensor], dim=0).unsqueeze(0).to(device)
                with torch.no_grad():
                    prediction = model.predict(img_tensor)
                    probs = prediction[0].cpu().numpy()
                    emotion_idx = np.argmax(probs)
                    confidence = probs[emotion_idx]
                    predicted_emotion = EMOTIONS[emotion_idx]
                if confidence >= 0.4:
                    emotion_history.append((predicted_emotion, confidence))
                    if len(emotion_history) > history_size:
                        emotion_history.pop(0)
                    counts = {}
                    for emotion, conf in emotion_history:
                        counts[emotion] = counts.get(emotion, 0) + 1
                    dominant_emotion = max(counts, key=counts.get) if counts else None
                    if dominant_emotion:
                        emotions_detected[dominant_emotion] += 1
            except Exception as e:
                logger.error(f"Error processing video frame: {e}")
                continue
        frame_count += 1
        if frames_to_process < total_frames:
            skip_frames = max(1, int(total_frames / frames_to_process) - 1)
            for _ in range(skip_frames):
                cap.read()
    cap.release()
    session_duration = time.time() - start_time
    dominant_emotion = max(emotions_detected.items(), key=lambda x: x[1])[0] if any(emotions_detected.values()) else "unknown"
    try:
        cursor.execute(
            """
            INSERT INTO sessions 
            (employee_id, duration_seconds, dominant_emotion, session_date)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            ("unknown", session_duration, dominant_emotion, datetime.now().date())
        )
        session_id = cursor.fetchone()[0]
        for emotion, count in emotions_detected.items():
            if count > 0:
                percentage = (count / frame_count) * 100
                cursor.execute(
                    """
                    INSERT INTO emotion_details 
                    (session_id, emotion, count, percentage)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (session_id, emotion, count, percentage)
                )
        conn.commit()
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Failed to save video session data: {e}")
        raise HTTPException(status_code=500, detail="Error saving video session data")
    return {"message": "Video analysis complete", "stats": emotions_detected}

@app.get("/test_samples")
async def test_samples():
    test_dir = "C:\\Employee Welbeing through Emotion Detection\\The Solution\\grok\\data\\test"
    samples = []
    emotions_detected = {emotion: 0 for emotion in EMOTIONS}
    for class_name in os.listdir(test_dir):
        class_dir = os.path.join(test_dir, class_name)
        if os.path.isdir(class_dir):
            for img_name in os.listdir(class_dir):
                if img_name.endswith(('.jpg', '.png')):
                    samples.append((os.path.join(class_dir, img_name), class_name))
    selected_samples = random.sample(samples, min(10, len(samples)))
    sample_images = []
    frame_count = len(selected_samples)
    start_time = time.time()
    for img_path, _ in selected_samples:
        try:
            img = Image.open(img_path).convert('RGB')
            rgb_tensor = transform(img)
            edge_tensor = add_edge_channel(img)
            img_tensor = torch.cat([rgb_tensor, edge_tensor], dim=0).unsqueeze(0).to(device)
            with torch.no_grad():
                prediction = model.predict(img_tensor)
                probs = prediction[0].cpu().numpy()
                emotion_idx = np.argmax(probs)
                confidence = probs[emotion_idx]
                predicted_emotion = EMOTIONS[emotion_idx]
            if confidence >= 0.4:
                emotions_detected[predicted_emotion] += 1
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=95)
            sample_images.append({
                "data": base64.b64encode(img_byte_arr.getvalue()).decode('utf-8'),
                "label": predicted_emotion
            })
        except Exception as e:
            logger.error(f"Error processing test sample {img_path}: {e}")
            continue
    session_duration = time.time() - start_time
    dominant_emotion = max(emotions_detected.items(), key=lambda x: x[1])[0] if any(emotions_detected.values()) else "unknown"
    try:
        cursor.execute(
            """
            INSERT INTO sessions 
            (employee_id, duration_seconds, dominant_emotion, session_date)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            ("unknown", session_duration, dominant_emotion, datetime.now().date())
        )
        session_id = cursor.fetchone()[0]
        for emotion, count in emotions_detected.items():
            if count > 0:
                percentage = (count / frame_count) * 100
                cursor.execute(
                    """
                    INSERT INTO emotion_details 
                    (session_id, emotion, count, percentage)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (session_id, emotion, count, percentage)
                )
        conn.commit()
        logger.info(f"Saved test samples session, session_id {session_id}")
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Failed to save test samples session data: {e}")
    return {"message": "Test completed", "stats": emotions_detected, "sample_images": sample_images}

@app.get("/admin_stats")
async def admin_stats(department: str = "All", date_range: str = "Last 30 Days"):
    if not conn or not cursor:
        return {
            "emotions": [],
            "employees": [],
            "departments": [],
            "time_series": [],
            "risk_employees": [],
        }

    today = datetime.now().date()
    start_date = (
        today.strftime("%Y-%m-%d") if date_range == "Today" else
        (today - timedelta(days=7)).strftime("%Y-%m-%d") if date_range == "Last 7 Days" else
        (today - timedelta(days=30)).strftime("%Y-%m-%d") if date_range == "Last 30 Days" else
        "2000-01-01"
    )
    dept_condition = "" if department == "All" else f"AND e.department = '{department}'"
    try:
        conn.rollback()

        # Overall emotion distribution (only Employee role)
        cursor.execute(f"""
            SELECT ed.emotion, SUM(ed.count) AS total_count
            FROM emotion_details ed
            JOIN sessions s ON ed.session_id = s.id
            JOIN employees e ON s.employee_id = e.employee_id
            WHERE s.session_date >= %s
              AND e.role = 'Employee'
              {dept_condition}
            GROUP BY ed.emotion
            ORDER BY total_count DESC
        """, (start_date,))
        emotion_stats = [{"status": row[0], "total": row[1]} for row in cursor.fetchall()]

        # Per-employee summary (only Employee role)
        cursor.execute(f"""
            SELECT e.employee_id, e.department, COUNT(s.id) AS session_count,
                   AVG(s.duration_seconds) AS avg_duration,
                   MODE() WITHIN GROUP (ORDER BY s.dominant_emotion) AS dominant_emotion
            FROM employees e
            JOIN sessions s ON s.employee_id = e.employee_id
            WHERE s.session_date >= %s
              AND e.role = 'Employee'
              {dept_condition}
            GROUP BY e.employee_id, e.department
            ORDER BY session_count DESC
        """, (start_date,))
        employees = [
            {
                "employee_id": row[0],
                "department": row[1],
                "session_count": row[2],
                "avg_duration": row[3] / 60 if row[3] else 0,
                "dominant_emotion": row[4]
            } for row in cursor.fetchall()
        ]

        # Department-level summary with happiness percentage and dominant emotion
        cursor.execute(f"""
            SELECT e.department,
                   COUNT(DISTINCT e.employee_id) AS employee_count,
                   COUNT(s.id) AS session_count,
                   AVG(s.duration_seconds) AS avg_duration,
                   COALESCE(
                       100.0 * SUM(CASE WHEN ed.emotion = 'happy' THEN ed.count ELSE 0 END)
                       / NULLIF(SUM(ed.count), 0),
                       0
                   ) AS happy_pct,
                   MODE() WITHIN GROUP (ORDER BY ed.emotion) AS dominant_emotion
            FROM employees e
            LEFT JOIN sessions s ON s.employee_id = e.employee_id
                                 AND s.session_date >= %s
            LEFT JOIN emotion_details ed ON ed.session_id = s.id
            WHERE e.role = 'Employee'
            {'' if department == 'All' else 'AND e.department = %s'}
            GROUP BY e.department
            ORDER BY e.department
        """, (start_date,) if department == "All" else (start_date, department))
        departments = [
            {
                "department": row[0],
                "employee_count": row[1],
                "session_count": row[2],
                "avg_duration": row[3] / 60 if row[3] else 0,
                "happy_pct": float(row[4]) if row[4] is not None else 0.0,
                "dominant_emotion": row[5],
            } for row in cursor.fetchall()
        ]

        # Time-series: daily sessions + dominant emotions
        cursor.execute(f"""
            SELECT s.session_date,
                   COUNT(s.id) AS session_count,
                   SUM(s.duration_seconds) AS total_duration,
                   MODE() WITHIN GROUP (ORDER BY s.dominant_emotion) AS dominant_emotion
            FROM sessions s
            JOIN employees e ON s.employee_id = e.employee_id
            WHERE s.session_date >= %s
              AND e.role = 'Employee'
              {dept_condition}
            GROUP BY s.session_date
            ORDER BY s.session_date
        """, (start_date,))
        time_series = [
            {
                "date": row[0].isoformat(),
                "session_count": row[1],
                "total_duration": row[2] / 60 if row[2] else 0,
                "dominant_emotion": row[3],
            } for row in cursor.fetchall()
        ]

        # High-risk employees: highest share of negative emotions
        cursor.execute(f"""
            SELECT e.employee_id,
                   e.department,
                   SUM(CASE WHEN ed.emotion IN ('angry','sad','fear','disgust') THEN ed.count ELSE 0 END) AS negative_count,
                   SUM(ed.count) AS total_count
            FROM emotion_details ed
            JOIN sessions s ON ed.session_id = s.id
            JOIN employees e ON s.employee_id = e.employee_id
            WHERE s.session_date >= %s
              AND e.role = 'Employee'
              {dept_condition}
            GROUP BY e.employee_id, e.department
            HAVING SUM(ed.count) > 0
            ORDER BY (SUM(CASE WHEN ed.emotion IN ('angry','sad','fear','disgust') THEN ed.count ELSE 0 END)::float
                      / NULLIF(SUM(ed.count), 0)) DESC,
                     negative_count DESC
            LIMIT 5
        """, (start_date,))
        risk_employees = [
            {
                "employee_id": row[0],
                "department": row[1],
                "negative_count": row[2],
                "total_count": row[3],
                "negative_ratio": (row[2] / row[3]) * 100 if row[3] else 0,
            } for row in cursor.fetchall()
        ]

        conn.commit()
        return {
            "emotions": emotion_stats,
            "employees": employees,
            "departments": departments,
            "time_series": time_series,
            "risk_employees": risk_employees,
        }
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Admin stats database error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        conn.rollback()
        logger.error(f"Admin stats error: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving admin stats")

@app.get("/admin_stats/current_week")
async def admin_stats_current_week():
    if not conn or not cursor:
        return {"emotions": [], "departments": []}
    agent = DataAgent(conn, cursor)
    return agent.get_current_week_stats()

@app.get("/admin_stats/flags")
async def admin_stats_flags():
    if not conn or not cursor:
        return []
    agent = DataAgent(conn, cursor)
    return agent.get_flagged_employees()

@app.get("/analyze/employee/stream")
async def analyze_employee_stream(employee_id: str, prompt: str, timeframe: str = 'month'):
    if not conn or not cursor:
        raise HTTPException(status_code=503, detail="Database not connected")
    coordinator = CoordinatorAgent(conn, cursor)
    days = 7 if timeframe == 'week' else 30
    return StreamingResponse(
        coordinator.analyze_employee_stream(employee_id, prompt, days), 
        media_type="text/event-stream"
    )

@app.get("/analyze/flags/stream")
async def analyze_flags_stream():
    if not conn or not cursor:
        raise HTTPException(status_code=503, detail="Database not connected")
    coordinator = CoordinatorAgent(conn, cursor)
    return StreamingResponse(
        coordinator.analyze_flags_stream(), 
        media_type="text/event-stream"
    )

# Run the server
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
