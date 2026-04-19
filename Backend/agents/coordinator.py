import json
import asyncio
from typing import AsyncGenerator
from .data_agent import DataAgent
from .analysis_agent import AnalysisAgent

class CoordinatorAgent:
    def __init__(self, conn, cursor):
        self.data_agent = DataAgent(conn, cursor)
        self.analysis_agent = AnalysisAgent()

    async def analyze_employee_stream(self, employee_id: str, custom_prompt: str, days: int = 30) -> AsyncGenerator[str, None]:
        """
        Coordinates fetching data and analyzing it for a specific employee,
        yielding SSE JSON messages along the way to update the frontend UI.
        """
        try:
            # Step 1: Notify frontend that Data Agent is starting
            yield self._format_sse({"agent": "Data Agent", "status": "working", "message": f"Fetching database history for Employee {employee_id}..."})
            
            # Simulate a slight delay so the user can read the UI change
            await asyncio.sleep(1)
            
            # Fetch data (synchronous DB call, could block event loop slightly, but fine for this scope)
            data = self.data_agent.get_employee_history(employee_id, days=days)
            
            if "error" in data:
                yield self._format_sse({"agent": "Data Agent", "status": "error", "message": data["error"]})
                return
                
            yield self._format_sse({"agent": "Data Agent", "status": "done", "message": "History retrieved successfully. Passing to Analysis Agent."})
            
            # Step 2: Notify frontend that Analysis Agent is starting
            await asyncio.sleep(1)
            yield self._format_sse({"agent": "Analysis Agent", "status": "working", "message": "Reasoning over the data and generating insights..."})
            
            # Call LLM
            insights = await self.analysis_agent.analyze_employee(data, custom_prompt)
            
            yield self._format_sse({"agent": "Analysis Agent", "status": "done", "message": "Insights generated successfully."})
            
            # Step 3: Send Final Result
            yield self._format_sse({"status": "complete", "result": insights})
            
        except Exception as e:
            yield self._format_sse({"status": "error", "message": f"An unexpected error occurred: {str(e)}"})


    async def analyze_flags_stream(self) -> AsyncGenerator[str, None]:
        """
        Coordinates fetching all flagged employees and analyzing systemic trends.
        """
        try:
            yield self._format_sse({"agent": "Data Agent", "status": "working", "message": "Scanning database for flagged employees (negative trend)..."})
            await asyncio.sleep(1)
            
            flags = self.data_agent.get_flagged_employees()
            
            if not flags:
                yield self._format_sse({"agent": "Data Agent", "status": "error", "message": "No flagged employees found."})
                return
                
            yield self._format_sse({"agent": "Data Agent", "status": "done", "message": f"Found {len(flags)} flagged employees. Passing to Analysis Agent."})
            
            await asyncio.sleep(1)
            yield self._format_sse({"agent": "Analysis Agent", "status": "working", "message": "Identifying systemic issues and formulating interventions..."})
            
            insights = await self.analysis_agent.analyze_flags(flags)
            
            yield self._format_sse({"agent": "Analysis Agent", "status": "done", "message": "Insights generated successfully."})
            yield self._format_sse({"status": "complete", "result": insights})
            
        except Exception as e:
            yield self._format_sse({"status": "error", "message": f"An unexpected error occurred: {str(e)}"})

    def _format_sse(self, data: dict) -> str:
        """Helper to format SSE messages."""
        return f"data: {json.dumps(data)}\n\n"
