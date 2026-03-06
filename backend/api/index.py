import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import BaseModel, ValidationError, Field
import google.generativeai as genai

app = Flask(__name__)
# Enable CORS for the frontend origin
CORS(app, resources={r"/api/*": {"origins": "*"}})

class AnalyzeSentimentRequest(BaseModel):
    text: str = Field(..., min_length=1)
    
class SentimentAnalysisResponse(BaseModel):
    sentiment: str # e.g. "Positive", "Negative", "Neutral"
    confidence: float = Field(..., ge=0, le=1)
    explanation: str

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Sentiment Analysis API"})

@app.route('/api/analyze', methods=['POST'])
def analyze_sentiment():
    # 1. Require user's API Key from frontend (AgentModal pattern)
    api_key = request.headers.get('X-Gemini-Key')
    if not api_key:
        return jsonify({"error": "Missing X-Gemini-Key header. Please provide your API key in the UI."}), 401

    try:
        # 2. Strict Zero-Trust JSON validation
        data = AnalyzeSentimentRequest(**request.json)
    except ValidationError as e:
        return jsonify({"error": "Invalid request payload", "details": e.errors()}), 400

    try:
        # 3. Configure Gemini context
        genai.configure(api_key=api_key)
        
        # We enforce JSON mode via prompt and structure
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
        
        # Using 1.5-flash for fast analysis
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        
        # Clean markdown codeblocks if model adds them
        text_response = response.text.strip()
        if text_response.startswith('```json'):
            text_response = text_response[7:-3].strip()
        elif text_response.startswith('```'):
            text_response = text_response[3:-3].strip()
            
        import json
        structured_output = json.loads(text_response)
        
        # 4. Validate AI Output against Schema 
        validated_response = SentimentAnalysisResponse(**structured_output)
        
        return jsonify({
            "success": True, 
            "result": validated_response.model_dump()
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error during analysis: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5333)
