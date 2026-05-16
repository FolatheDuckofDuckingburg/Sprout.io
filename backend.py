# This is your Backend! It acts as the brain between your App and the LEGO robot.
# To run this, you will need to install flask on your computer:
# Type this in your computer terminal: pip install flask flask-cors

from flask import Flask, jsonify, request
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app) # This safely allows the downloaded app to talk to this Python code

def send_water_command_to_spike():
    # ---------------------------------------------------------
    # TODO FOR GROUP A:
    # Later, put the actual Pybricks or LEGO Spike 
    # connection code here to turn on the physical motor!
    # ---------------------------------------------------------
    print("\n🤖 [SPIKE PRIME] Activating water pump for 3 seconds...")
    time.sleep(3)
    print("🤖 [SPIKE PRIME] Pump deactivated. Plant is happy!\n")
    return True

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({"status": "Backend is running and ready to control robots!"})

@app.route('/api/water', methods=['POST'])
def trigger_water():
    print("📱 Received 'WATER_PUMP_ON' command from the Sprout App!")
    
    # Call the function to activate the LEGO robot
    success = send_water_command_to_spike()
    
    if success:
        return jsonify({"success": True, "message": "Watering complete!"})
    else:
        return jsonify({"success": False, "message": "Failed to connect to Spike."}), 500

if __name__ == '__main__':
    print("🌱 Sprout Backend Starting!")
    print("Waiting for the app to send commands...")
    app.run(port=5000, debug=True)
