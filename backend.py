# =================================================================
# SPROUT.IO - SMART IRRIGATION BACKEND
# =================================================================
# This Python script acts as the "Middleman Brain" for Sprout.
# It listens for wireless signals from your mobile phone app over Wi-Fi
# and translates them into Bluetooth commands for your LEGO Spike robot!
#
# Educational Note for Group A:
# 1. Flask: Runs a tiny web server on your laptop.
# 2. Flask-CORS: Allows your mobile phone to securely connect to your laptop.
# 3. PySerial: Sends instructions through the air using Bluetooth.
# =================================================================

import time
from flask import Flask, jsonify, request
from flask_cors import CORS

# We use a try-except block here so if 'pyserial' isn't installed yet, 
# the server still starts up perfectly in Simulation Mode!
try:
    import serial
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False

app = Flask(__name__)
# Enable CORS so your mobile phone web app can talk to this local server over Wi-Fi
CORS(app)

# ==========================================
# HARDWARE CONFIGURATION
# ==========================================
# On Windows, this is usually 'COM3', 'COM4', etc.
# On macOS, it is typically '/dev/tty.LEGOHub-SerialPort' or similar.
#
# Replace 'COM3' with the exact port path of your paired Bluetooth Spike Prime Hub.
BLUETOOTH_PORT = 'COM3'  
BAUD_RATE = 115200       # Standard speed for Spike Prime Hub communications
SERIAL_CONNECTION = None

# ==========================================
# BLUETOOTH CONNECTION LOGIC
# ==========================================
def connect_to_hub():
    """
    Attempts to establish a secure Bluetooth Serial connection with the LEGO Spike Hub.
    If the Hub is not paired or is turned off, it falls back to Simulation Mode
    so that your presentation stays up and running!
    """
    global SERIAL_CONNECTION
    
    if not SERIAL_AVAILABLE:
        print("\n⚠️ SYSTEM NOTE: 'pyserial' library is not installed.")
        print("💡 Run: 'pip install pyserial' in your terminal to enable physical robot control.")
        print("🤖 Running in standard Simulation Mode.\n")
        return False

    try:
        print(f"📡 Attempting to connect to Spike Hub on Bluetooth Port: {BLUETOOTH_PORT}...")
        SERIAL_CONNECTION = serial.Serial(
            port=BLUETOOTH_PORT,
            baudrate=BAUD_RATE,
            timeout=2
        )
        print("🟢 SUCCESS: Bluetooth Connection to Spike Prime Hub Secure!")
        return True
    except Exception as e:
        print("\n⚠️ WARNING: Spike Hub could not be reached over Bluetooth.")
        print("⚠️ Make sure the LEGO Hub is turned on and paired with your laptop's Bluetooth.")
        print("🤖 Falling back to SIMULATION mode so you can still demonstrate the app!\n")
        SERIAL_CONNECTION = None
        return False

# Attempt to connect to the physical robot right when the backend starts
connect_to_hub()

# ==========================================
# FLASK ROUTE: STATUS MONITORING
# ==========================================
@app.route('/api/status', methods=['GET'])
def check_status():
    """
    Tells your mobile app whether the backend is online and if the LEGO Hub is connected.
    """
    is_connected = SERIAL_CONNECTION is not None and SERIAL_CONNECTION.is_open
    return jsonify({
        "status": "online",
        "hub_connected": is_connected,
        "mode": "hardware" if is_connected else "simulation",
        "message": "Backend is running and ready to control Sprout robots!"
    }), 200

# ==========================================
# FLASK ROUTE: TRIGGER IRRIGATION
# ==========================================
@app.route('/api/water', methods=['POST'])
def handle_water_request():
    """
    This is the digital doorbell! When you press 'Pump Water' on the phone app,
    it rings this route, which triggers either the real motor or the simulator.
    """
    global SERIAL_CONNECTION
    print("\n📱 [SPROUT APP] Received 'WATER_PUMP_ON' command!")

    # 1. PHYSICAL HARDWARE MODE (If robot is connected over Bluetooth)
    if SERIAL_CONNECTION and SERIAL_CONNECTION.is_open:
        try:
            print("🤖 [SPIKE PRIME] Activating physical water pump motor on Port A...")
            
            # This line of Python code is sent through Bluetooth to turn your physical motor on Port A
            # Adjust the degrees (720) to pump more or less water!
            command = "hub.port.A.motor.run_for_degrees(720)\r\n"
            SERIAL_CONNECTION.write(command.encode('utf-8'))
            
            # Wait briefly to let the motor spin
            time.sleep(3.0)
            print("🤖 [SPIKE PRIME] Motor cycle completed. Plant watered! 💧\n")
            
            return jsonify({
                "success": True, 
                "message": "Physical watering complete! Hub motor triggered.",
                "mode": "hardware"
            }), 200
            
        except Exception as e:
            print(f"❌ Error during transmission: {e}")
            # Automatically try to heal/reconnect the Bluetooth link
            connect_to_hub()
            return jsonify({
                "success": False, 
                "message": f"Connection dropped. Error: {e}"
            }), 500

    # 2. SIMULATION MODE (Safe fallback for practicing without the robot)
    else:
        print("🤖 [SIMULATION ACTIVE] Activating virtual water pump for 3 seconds...")
        time.sleep(3)
        print("🤖 [SIMULATION ACTIVE] Pump deactivated. Plant is happy! 💧\n")
        
        return jsonify({
            "success": True, 
            "message": "Simulation Mode: Virtual watering completed successfully!",
            "mode": "simulation"
        }), 200

# ==========================================
# START SERVER
# ==========================================
if __name__ == '__main__':
    print("🌱 Sprout Intelligent Backend Booting Up!")
    print("Waiting for the mobile app to send command signals...")
    # hosting on 0.0.0.0 lets any phone on the same Wi-Fi connect using your laptop's IP address!
    app.run(host='0.0.0.0', port=5000, debug=True)
