import requests

window = [250.0] * 599

r = requests.post(
    'http://localhost:5001/predict/appliance',
    json={'appliance': 'kettle', 'window': window}
)

print('Status:', r.status_code)
print('Flask response:', r.json())