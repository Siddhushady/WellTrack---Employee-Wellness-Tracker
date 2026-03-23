# Backend Setup Guide

## Installation

### 1. Install Python Dependencies

```bash
cd Backend
pip install -r requirements.txt
```

### 2. Database Setup (Optional)

If you want to use the database features:

1. Install PostgreSQL
2. Create a database named `emotion_detection`
3. Update database credentials in `server.py` (lines 50-57):
   ```python
   conn = psycopg2.connect(
       dbname="emotion_detection",
       user="postgres",
       password="your_password",
       host="localhost",
       port="5432"
   )
   ```

**Note**: The application can work without a database for basic functionality.

### 3. Model File

Make sure your model file (`welltrack_resnet18_cbam_raf_best.pt`) is in the `Backend/` folder.

The path is configured in `server.py` line 91:
```python
MODEL_PATHS = {
    "new_model": r"./welltrack_resnet18_cbam_raf_best.pt"
}
```

### 4. Run the Server

```bash
python server.py
```

Or using uvicorn directly:
```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on `http://localhost:8000`

## Dependencies

All dependencies are listed in `requirements.txt`:

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **python-socketio**: Real-time communication
- **PyTorch**: Deep learning framework
- **OpenCV**: Computer vision
- **Pillow**: Image processing
- **NumPy**: Numerical computing
- **Pandas**: Data manipulation
- **psycopg2**: PostgreSQL adapter
- **Pydantic**: Data validation

## System Requirements

- Python 3.8+
- Webcam (for camera functionality)
- CUDA-capable GPU (optional, for faster inference)

## Troubleshooting

### Model Loading Error
- Check that the `.pt` file exists in the Backend folder
- Verify the model path in `server.py`
- Ensure PyTorch is installed correctly

### Database Connection Error
- Verify PostgreSQL is running
- Check database credentials
- Database is optional - app can work without it

### Camera Not Working
- Ensure camera is connected to the server machine
- Check camera permissions (if on Linux/Mac)
- Try different camera index (0, 1, 2, etc.) in `server.py` line 429

### Port Already in Use
- Change port in `server.py` or uvicorn command
- Or stop the process using port 8000

## API Endpoints

- `POST /login` - Employee login
- `POST /select` - Select model
- `POST /feedback_login` - Feedback system login
- `POST /submit_feedback` - Submit feedback
- `GET /admin_stats` - Get admin statistics
- `POST /upload_video` - Upload video for analysis

## Socket.IO Events

- `connect` - Client connection
- `set_employee_id` - Set employee ID for session
- `start_camera` - Start camera feed
- `stop_camera` - Stop camera feed
- `frame` - Receive video frames with emotion data

