import os
import requests
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import BaseModel, ValidationError, Field

logger = logging.getLogger(__name__)

# Cache the cascade to avoid hitting the models list endpoint excessively
_CASCADE_CACHE = None

def _score_model(model_name: str) -> float:
    name = model_name.lower().replace("models/", "")
    score = 0.0

    if "flash-lite" in name:
        score = 25
    elif "pro" in name:
        score = 100
    elif "lite" in name:
        score = 25
    elif "flash" in name:
        score = 50
    else:
        score = 10

    version_score = 1.0
    import re
    version_match = re.search(r"(\d+)\.(\d+)", name)
    if version_match:
        major = int(version_match.group(1))
        minor = int(version_match.group(2))
        version_score = major + (minor * 0.1)
    elif re.search(r"gemini-(\d+)-", name):
        major = int(re.search(r"gemini-(\d+)-", name).group(1))
        version_score = float(major)
    elif "latest" in name:
        version_score = 2.5

    score *= version_score

    if "preview" in name:
        score *= 1.05
    if "exp" in name:
        score *= 0.85

    return round(score, 2)

def get_dynamic_cascade(api_key: str) -> list:
    global _CASCADE_CACHE
    if _CASCADE_CACHE:
        return _CASCADE_CACHE

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        models = [m.name.replace("models/", "") for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        scored = [(name, _score_model(name)) for name in models]
        scored.sort(key=lambda x: x[1], reverse=True)
        sorted_models = [n for n, s in scored]

        pros = [m for m in sorted_models if "pro" in m]
        flash_lites = [m for m in sorted_models if "flash-lite" in m]
        flashes = [m for m in sorted_models if "flash" in m and "lite" not in m]

        best_pro = pros[0] if pros else "gemini-3.1-pro-preview"
        best_flash_lite = flash_lites[0] if flash_lites else "gemini-3.1-flash-lite-preview"
        fallback_pro = pros[1] if len(pros) > 1 else "gemini-2.5-pro"
        fallback_flash = flashes[0] if flashes else "gemini-2.5-flash"

        _CASCADE_CACHE = [best_pro, best_flash_lite, fallback_pro, fallback_flash]
        return _CASCADE_CACHE
    except Exception as e:
        logger.error(f"Failed to fetch model cascade dynamically: {e}")
        return ["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]

def generate_with_fallback(api_key: str, initial_model: str, contents, system_instruction: str = None, response_schema=None, response_mime_type=None):
    """
    Executes a Gemini generation request, automatically falling back across model tiers
    on 429 quota/rate limits or 503 service issues.
    """
    import google.generativeai as genai
    cascade = get_dynamic_cascade(api_key)
    
    # Ensure requested model is our starting point
    start_index = cascade.index(initial_model) if initial_model in cascade else 0
    
    last_error = None
    
    for i in range(start_index, len(cascade)):
        model_name = cascade[i]
        try:
            logger.info(f"Attempting generation with {model_name}...")
            # Automatically apply Google Search tools to 2.5 models as paid fallback feature for grounding
            tools = "google_search" if model_name.startswith("gemini-2.5") else None
            
            # Use strict Pydantic/typing parameters dynamically based on args presence
            kwargs = {}
            if response_schema or response_mime_type:
                kwargs["generation_config"] = genai.GenerationConfig(
                    response_mime_type=response_mime_type,
                    response_schema=response_schema
                )

            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction,
                tools=tools
            )
            
            # --- CONTEXT CACHING FOR 2.5 MODELS ON MASSIVE PAYLOADS --- #
            token_count = 0
            try:
                # Approximate token count safely
                token_count = model.count_tokens(contents).total_tokens
            except Exception:
                pass
                
            if token_count > 32000 and model_name.startswith("gemini-2.5"):
                logger.info(f"Payload > 32k tokens ({token_count}). Engaging Context Caching API for {model_name}.")
                try:
                    import datetime
                    
                    cache = genai.caching.CachedContent.create(
                        model=model_name,
                        system_instruction=system_instruction,
                        contents=contents,
                        ttl=datetime.timedelta(minutes=15)
                    )
                    
                    cached_model = genai.GenerativeModel.from_cached_content(
                        cached_content=cache,
                        tools=tools
                    )
                    
                    response = cached_model.generate_content("Synthesize and process the cached payload.", **kwargs)
                    
                    # Cleanup cache immediately to save user costs
                    cache.delete()
                    return response, model_name
                    
                except Exception as cache_err:
                    logger.warning(f"Failed to implement Context Caching: {cache_err}. Proceeding with standard generation.")
            
            response = model.generate_content(contents, **kwargs)
            return response, model_name
        except Exception as e:
            error_str = str(e).lower()
            last_error = e
            if "429" in error_str or "503" in error_str or "quota" in error_str or "exhausted" in error_str:
                logger.warning(f"Model {model_name} failed with rate limit/unavailable. Falling back... Error: {e}")
                continue
            else:
                # E.g. 400 Bad Request, API Key invalid -> immediately throw
                raise e
    
    raise RuntimeError(f"All models in fallback cascade failed due to rate limits. Last error: {last_error}")

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
