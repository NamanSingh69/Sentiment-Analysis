import os
import sys
import requests
import logging

# Ensure Vercel can find the resolver in the same directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import BaseModel, ValidationError, Field
import google.generativeai as genai

from gemini_model_resolver import generate_with_fallback, get_dynamic_cascade

app = Flask(__name__)
# Enable CORS for the frontend origin
CORS(app, resources={r"/api/*": {"origins": "*"}})

class AnalyzeSentimentRequest(BaseModel):
    text: str = Field(..., min_length=1)
    model: str = Field(default="gemini-1.5-flash")
    
class SentimentAnalysisResponse(BaseModel):
    sentiment: str # e.g. "Positive", "Negative", "Neutral"
    confidence: float = Field(..., ge=0, le=1)
    explanation: str

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Sentiment Analysis API"})

@app.route('/api/models', methods=['GET'])
def get_models():
    api_key = request.headers.get('X-Gemini-Key')
    if not api_key or not api_key.strip() or api_key == "null":
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY") or "***REDACTED_API_KEY***"
        
    if not api_key:
        return jsonify({"error": "Gemini API key missing"}), 401

    try:
        cascade = get_dynamic_cascade(api_key)
        return jsonify({
            "models": [{"name": f"models/{m}"} for m in cascade]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_sentiment():
    api_key = request.headers.get('X-Gemini-Key')
    if not api_key or not api_key.strip() or api_key == "null":
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY") or "***REDACTED_API_KEY***"
        
    if not api_key:
        return jsonify({"error": "Missing API Key. Please provide your API key in the UI or set GEMINI_API_KEY in the environment."}), 401

    try:
        data = AnalyzeSentimentRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": "Invalid request payload", "details": e.errors()}), 400

    try:
        genai.configure(api_key=api_key)
        
        prompt = f"""
        Analyze the sentiment of the following text (it might be a tweet, review, or statement).
        Return the result strictly as a valid JSON object matching this schema:
        {{
            "sentiment": "Positive" | "Negative" | "Neutral",
            "confidence": <float between 0.0 and 1.0 representing your confidence>,
            "explanation": "<brief 1-2 sentence explanation of why you chose this sentiment>"
        }}
        
        Text to analyze:
        "{data.text}"
        """
        
        response, model_used = generate_with_fallback(
            api_key=api_key,
            initial_model=data.model,
            contents=[prompt]
        )
        
        text_response = response.text.strip()
        if text_response.startswith('```json'):
            text_response = text_response[7:-3].strip()
        elif text_response.startswith('```'):
            text_response = text_response[3:-3].strip()
            
        import json
        structured_output = json.loads(text_response)
        
        validated_response = SentimentAnalysisResponse(**structured_output)
        
        payload = validated_response.model_dump()
        payload["_model_used"] = model_used

        return jsonify({
            "success": True, 
            "result": payload
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error during analysis: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5333)
