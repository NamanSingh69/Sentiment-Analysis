from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for the frontend origin
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Sentiment Analysis Minimal Vercel Check"})

@app.route('/api/analyze', methods=['POST'])
def analyze():
    return jsonify({"success": True, "result": {"sentiment": "Neutral", "confidence": 1.0, "explanation": "This is a minimal test payload."}}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5333)
