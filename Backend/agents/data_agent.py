import json
import logging
from datetime import datetime, timedelta
import psycopg2

logger = logging.getLogger(__name__)

class DataAgent:
    def __init__(self, conn, cursor):
        self.conn = conn
        self.cursor = cursor

    def get_current_week_stats(self):
        """Fetches emotional statistics for the last 7 days."""
        if not self.conn or not self.cursor:
            return {"error": "Database not connected"}
            
        today = datetime.now().date()
        start_date = today - timedelta(days=7)
        
        try:
            # Overall emotions
            self.cursor.execute("""
                SELECT ed.emotion, SUM(ed.count) AS total_count
                FROM emotion_details ed
                JOIN sessions s ON ed.session_id = s.id
                JOIN employees e ON s.employee_id = e.employee_id
                WHERE s.session_date >= %s
                  AND e.role = 'Employee'
                GROUP BY ed.emotion
            """, (start_date,))
            emotions = [{"status": row[0], "total": row[1]} for row in self.cursor.fetchall()]
            
            # Department stats
            self.cursor.execute("""
                SELECT e.department, 
                       COUNT(DISTINCT e.employee_id),
                       SUM(CASE WHEN ed.emotion IN ('happy', 'neutral') THEN ed.count ELSE 0 END) as positive_count,
                       SUM(ed.count) as total_count
                FROM employees e
                JOIN sessions s ON e.employee_id = s.employee_id
                JOIN emotion_details ed ON s.id = ed.session_id
                WHERE s.session_date >= %s
                  AND e.role = 'Employee'
                GROUP BY e.department
            """, (start_date,))
            
            departments = []
            for row in self.cursor.fetchall():
                dept, emp_count, pos_count, total_count = row
                happy_pct = (pos_count / total_count * 100) if total_count and total_count > 0 else 0
                departments.append({
                    "department": dept,
                    "employee_count": emp_count,
                    "happy_pct": happy_pct
                })
                
            return {
                "start_date": str(start_date),
                "end_date": str(today),
                "emotions": emotions,
                "departments": departments
            }
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error fetching current week stats: {e}")
            return {"error": str(e)}

    def get_flagged_employees(self):
        """
        Identifies employees who have more negative emotions 
        (angry, sad, fear, disgust) than non-negative over the last 30 days.
        """
        if not self.conn or not self.cursor:
            return {"error": "Database not connected"}
            
        start_date = datetime.now().date() - timedelta(days=30)
        
        try:
            self.cursor.execute("""
                SELECT 
                    e.employee_id, 
                    e.department,
                    SUM(CASE WHEN ed.emotion IN ('angry', 'sad', 'fear', 'disgust') THEN ed.count ELSE 0 END) as negative_count,
                    SUM(ed.count) as total_count
                FROM employees e
                JOIN sessions s ON e.employee_id = s.employee_id
                JOIN emotion_details ed ON s.id = ed.session_id
                WHERE s.session_date >= %s
                  AND e.role = 'Employee'
                GROUP BY e.employee_id, e.department
                HAVING SUM(CASE WHEN ed.emotion IN ('angry', 'sad', 'fear', 'disgust') THEN ed.count ELSE 0 END) > 
                       SUM(CASE WHEN ed.emotion IN ('happy', 'neutral', 'surprise') THEN ed.count ELSE 0 END)
                   AND SUM(ed.count) > 0
                ORDER BY negative_count DESC
            """, (start_date,))
            
            flags = []
            for row in self.cursor.fetchall():
                emp_id, dept, neg_count, total = row
                neg_ratio = (neg_count / total * 100) if total > 0 else 0
                flags.append({
                    "employee_id": emp_id,
                    "department": dept,
                    "negative_count": neg_count,
                    "total_count": total,
                    "negative_ratio": neg_ratio
                })
            return flags
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error fetching flagged employees: {e}")
            return []

    def get_employee_history(self, employee_id: str, days: int = 30):
        """Fetches detailed emotion history for a specific employee."""
        if not self.conn or not self.cursor:
            return {"error": "Database not connected"}
            
        try:
            # Check if employee exists
            self.cursor.execute("SELECT department FROM employees WHERE employee_id = %s", (employee_id,))
            emp = self.cursor.fetchone()
            if not emp:
                return {"error": f"Employee {employee_id} not found."}
                
            department = emp[0]
            
            # Fetch last N days of sessions
            start_date = datetime.now().date() - timedelta(days=days)
            self.cursor.execute("""
                SELECT s.session_date, s.duration_seconds, s.dominant_emotion,
                       ed.emotion, ed.count, ed.percentage
                FROM sessions s
                JOIN emotion_details ed ON s.id = ed.session_id
                WHERE s.employee_id = %s AND s.session_date >= %s
                ORDER BY s.session_date ASC
            """, (employee_id, start_date))
            
            sessions_data = {}
            for row in self.cursor.fetchall():
                date, duration, dominant, emotion, count, pct = row
                date_str = str(date)
                if date_str not in sessions_data:
                    sessions_data[date_str] = {
                        "duration_seconds": duration,
                        "dominant_emotion": dominant,
                        "details": {}
                    }
                sessions_data[date_str]["details"][emotion] = count
                
            return {
                "employee_id": employee_id,
                "department": department,
                "history": sessions_data
            }
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error fetching history for {employee_id}: {e}")
            return {"error": str(e)}

    def get_employee_emotion_summary(self, employee_id: str, days: int = 30):
        """Fetches aggregate emotion distribution for a specific employee."""
        if not self.conn or not self.cursor:
            return {"error": "Database not connected"}

        try:
            self.cursor.execute("SELECT department FROM employees WHERE employee_id = %s", (employee_id,))
            emp = self.cursor.fetchone()
            if not emp:
                return {"error": f"Employee {employee_id} not found."}

            department = emp[0]
            start_date = datetime.now().date() - timedelta(days=days)

            self.cursor.execute("""
                SELECT ed.emotion, SUM(ed.count) AS total_count
                FROM sessions s
                JOIN emotion_details ed ON s.id = ed.session_id
                WHERE s.employee_id = %s AND s.session_date >= %s
                GROUP BY ed.emotion
                ORDER BY total_count DESC
            """, (employee_id, start_date))
            emotions = [{"status": row[0], "total": int(row[1])} for row in self.cursor.fetchall()]

            self.cursor.execute("""
                SELECT COUNT(DISTINCT s.id), COUNT(DISTINCT s.session_date),
                       MIN(s.session_date), MAX(s.session_date)
                FROM sessions s
                WHERE s.employee_id = %s AND s.session_date >= %s
            """, (employee_id, start_date))
            session_count, active_days, first_date, last_date = self.cursor.fetchone()

            return {
                "employee_id": employee_id,
                "department": department,
                "days": days,
                "start_date": str(start_date),
                "end_date": str(datetime.now().date()),
                "first_session_date": str(first_date) if first_date else None,
                "last_session_date": str(last_date) if last_date else None,
                "session_count": int(session_count or 0),
                "active_days": int(active_days or 0),
                "emotions": emotions,
            }
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error fetching emotion summary for {employee_id}: {e}")
            return {"error": str(e)}
