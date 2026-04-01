import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from simulator import ModbusGatewaySimulator
from ml_model import PredictiveModel

app = FastAPI(title="Digital Twin Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared Simulator Instance
simulator = ModbusGatewaySimulator()
model = PredictiveModel()
model.train_synthetic()

# Global state
ml_optimization_active = False

@app.get("/status")
def get_status():
    return {"status": "online", "ml_optimization": ml_optimization_active}

@app.post("/set-noise")
def set_noise(value: float):
    simulator.set_noise(value)
    return {"message": f"Noise set to {value}%"}

@app.post("/toggle-ml")
def toggle_ml(active: bool):
    global ml_optimization_active
    ml_optimization_active = active
    return {"ml_active": ml_optimization_active}

@app.websocket("/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # 1. Get current physical simulation metrics
            metrics = simulator.get_current_metrics()
            
            # 2. Get ML Prediction for PER
            predicted_per = model.predict_per(metrics['noise_percent'], metrics['latency_ms'])
            metrics['predicted_per'] = round(predicted_per, 2)
            
            # 3. Perform ML Optimization (if enabled)
            if ml_optimization_active:
                # Predictive Tuning logic:
                # If PER > 5%, increase polling interval to 2.0s
                # Else, keep at 1.0s
                if predicted_per > 5.0:
                    simulator.set_polling_rate(2.0)
                    metrics['tuning_action'] = "High PER: Reducing polling rate..."
                else:
                    simulator.set_polling_rate(1.0)
                    metrics['tuning_action'] = "Optimal PER: Polling rate set to 1.0s"
            else:
                simulator.set_polling_rate(1.0)
                metrics['tuning_action'] = "ML Optimization Disabled"

            # 4. Stream to frontend
            await websocket.send_text(json.dumps(metrics))
            
            # Sleep based on the current interval
            await asyncio.sleep(simulator.polling_interval)
            
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
