import os
import json
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Initialize OpenAI client pointing to local LM Studio
# Ensure your LM Studio server is running at this address
client = AsyncOpenAI(
    base_url="http://192.168.1.31:1234/v1",
    api_key="lm-studio" # API key is not required for local LM Studio, but the library requires a string
)

MODEL_NAME = "qwen/qwen3-vl-4b"

class AnalysisAgent:
    async def analyze_employee(self, employee_data: dict, custom_prompt: str):
        """Analyzes a single employee's history using the LLM."""
        if "error" in employee_data:
            return f"Error from data agent: {employee_data['error']}"
            
        system_prompt = (
            "You are an expert HR and wellness analytics AI. "
            "You are given raw emotional tracking data for a specific employee over the last 30 days. "
            "Your job is to provide deep, personalized wellness insights, identify trends, and suggest interventions. "
            "Respond in clean, well-structured Markdown. Do not use any emojis or icons in your response."
        )
        
        user_content = f"Employee Data:\n{json.dumps(employee_data, indent=2)}\n\nUser Request/Prompt:\n{custom_prompt}"
        
        return await self._call_llm(system_prompt, user_content)

    async def analyze_flags(self, flagged_data: list):
        """Analyzes the overall population of flagged employees."""
        if not flagged_data:
            return "No flagged employees found to analyze."
            
        system_prompt = (
            "You are an expert HR and wellness analytics AI. "
            "You are given a list of 'flagged' employees who have exhibited higher negative emotions "
            "(angry, sad, fear, disgust) than positive/neutral ones recently. "
            "Analyze the data across departments and individuals. Identify systemic issues if any, "
            "and suggest organizational-level interventions. Respond in clean, well-structured Markdown. Do not use any emojis or icons in your response."
        )
        
        user_content = f"Flagged Employees Data:\n{json.dumps(flagged_data, indent=2)}"
        
        return await self._call_llm(system_prompt, user_content)

    async def _call_llm(self, system_prompt: str, user_content: str):
        try:
            response = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error calling LM Studio: {e}")
            return f"**Analysis Error**: Failed to generate insights using the local LLM. Ensure LM Studio is running at `http://192.168.1.31:1234`. Details: {str(e)}"
