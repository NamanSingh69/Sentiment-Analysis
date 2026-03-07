import pytest
import os
import json
from api.index import app
from unittest.mock import patch, MagicMock

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """Quality_Automation_Commander: Test API health state isolation."""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'healthy'

def test_missing_api_key(client):
    """Security_Protection_Officer: Enforce Zero-Trust architecture without .env fallbacks."""
    response = client.post('/api/analyze', json={'text': 'Testing the API without a key.'})
    assert response.status_code == 401
    assert b"Missing X-Gemini-Key header" in response.data

def test_invalid_payload(client):
    """Core_Systems_Engineer: Enforce rigorous Pydantic schema validation against empty strings."""
    # Attempting to send an empty text string, which violates the min_length=1 in AnalyzeSentimentRequest
    response = client.post('/api/analyze', 
                           headers={'X-Gemini-Key': 'fake-key'},
                           json={'text': ''})
    assert response.status_code == 400
    assert b"Invalid request payload" in response.data

@patch('api.index.genai.GenerativeModel')
def test_successful_analysis(mock_model, client):
    """Intelligence_Data_Lead: Deterministic evaluation of probabilistic LLM outputs via MagicMocks."""
    # Mocking the Gemini response
    mock_instance = MagicMock()
    mock_response = MagicMock()
    
    # We enforce JSON mode via the prompt
    mock_response.text = '{"sentiment": "Positive", "confidence": 0.95, "explanation": "The text expresses extreme joy."}'
    mock_instance.generate_content.return_value = mock_response
    mock_model.return_value = mock_instance

    response = client.post('/api/analyze', 
                           headers={'X-Gemini-Key': 'valid-mocked-key'},
                           json={'text': 'I am so incredibly happy with this architecture!'})
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['success'] is True
    assert data['result']['sentiment'] == 'Positive'
    assert data['result']['confidence'] == 0.95
