from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)

# Import ML modules
from ml_service.prediction import predict_consumption, predict_bill
from ml_service.anomaly import detect_anomaly
from ml_service.recommendations import generate_recommendations

@app.route('/')
def home():
    return jsonify({
        'message': 'WattLab ML Service',
        'version': '1.0',
        'endpoints': [
            '/api/predict',
            '/api/predict-bill',
            '/api/detect-anomaly',
            '/api/recommendations'
        ]
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predict future energy consumption for an appliance"""
    try:
        data = request.json
        appliance_id = data.get('applianceId')
        historical_data = data.get('historicalData', [])
        
        prediction = predict_consumption(appliance_id, historical_data)
        
        return jsonify({
            'success': True,
            'prediction': prediction
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/predict-bill', methods=['POST'])
def bill_prediction():
    """Predict monthly electricity bill"""
    try:
        data = request.json
        user_id = data.get('userId')
        month = data.get('month')
        year = data.get('year')
        
        prediction = predict_bill(user_id, month, year)
        
        return jsonify({
            'success': True,
            'prediction': prediction
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/detect-anomaly', methods=['POST'])
def anomaly_detection():
    """Detect anomalies in energy consumption patterns"""
    try:
        data = request.json
        appliance_id = data.get('applianceId')
        consumption_data = data.get('consumptionData', [])
        
        result = detect_anomaly(appliance_id, consumption_data)
        
        return jsonify({
            'success': True,
            'result': result
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/recommendations', methods=['POST'])
def recommendations():
    """Generate energy-saving recommendations"""
    try:
        data = request.json
        user_id = data.get('userId')
        
        recs = generate_recommendations(user_id)
        
        return jsonify({
            'success': True,
            'recommendations': recs
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ml-service',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'True') == 'True'
    app.run(host='0.0.0.0', port=port, debug=debug)
