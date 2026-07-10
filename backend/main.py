import asyncio
import json
import os
import sys
import numpy as np
from collections import deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from simulator import ModbusGatewaySimulator

# ── ONNX Runtime (MTL model) ──────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from inference.onnx_runtime import DigitalTwinONNX

ONNX_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "onnx", "digital_twin_mtl.onnx")

app = FastAPI(title="Digital Twin Backend — MTL+ONNX")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared instances ──────────────────────────────────────────────────────────
simulator = ModbusGatewaySimulator()

# Load ONNX model (warmed up, ready for sub-1ms inference)
onnx_model = DigitalTwinONNX(ONNX_MODEL_PATH)
onnx_model.warmup(n=10)
print("[ONNX] MTL model loaded and warmed up ✓")

# Sliding-window buffer for temporal context (20 timesteps × 6 features)
telemetry_buffer: deque = deque(maxlen=20)

# Global state
ml_optimization_active = False
current_metrics_cache: dict = {}

# ── Feature order expected by the MTL model ──────────────────────────────────
# [temperature, latency_ms, signal_quality, loss_prob_norm, throughput_approx, noise_norm]
def build_feature_vector(metrics: dict) -> np.ndarray:
    noise      = metrics["noise_percent"]
    latency    = metrics["latency_ms"]
    temperature= metrics["temperature"]
    loss_prob  = metrics["loss_prob"]           # already 0-100
    signal     = max(0.0, 100.0 - loss_prob)   # inverse of loss
    throughput = max(50.0, 1000.0 - latency * 3.0 - loss_prob * 2.0)
    noise_norm = noise / 100.0
    return np.array([temperature, latency, signal, loss_prob / 100.0,
                     throughput, noise_norm], dtype=np.float32)

class ThresholdRequest(BaseModel):
    temp_warning: float
    temp_critical: float
    latency_warning: float
    latency_critical: float


# ── API Endpoints ─────────────────────────────────────────────────────────────
@app.get("/status")
def get_status():
    return {"status": "online", "ml_optimization": ml_optimization_active,
            "model": "MTL+ONNX (11.4x faster)"}

@app.get("/nodes")
def get_nodes():
    return {"nodes": simulator.get_node_list()}

@app.post("/set-fault-profile")
def set_fault_profile(profile: str):
    simulator.set_fault_profile(profile)
    return {"message": f"Fault profile set to {profile}"}

@app.post("/set-thresholds")
def set_thresholds(req: ThresholdRequest):
    simulator.set_thresholds(
        req.temp_warning,
        req.temp_critical,
        req.latency_warning,
        req.latency_critical
    )
    return {"message": "Dynamic anomaly thresholds updated successfully"}

@app.post("/set-noise")
def set_noise(value: float):
    simulator.set_noise(value)
    return {"message": f"Noise set to {value}%"}

@app.post("/toggle-ml")
def toggle_ml(active: bool):
    global ml_optimization_active
    ml_optimization_active = active
    return {"ml_active": ml_optimization_active}

@app.post("/set-node")
def set_node(node_id: str):
    simulator.set_active_node(node_id)
    telemetry_buffer.clear()   # reset window when switching nodes
    return {"active_node": node_id}

# ── WebSocket Telemetry Stream ────────────────────────────────────────────────
@app.websocket("/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # 1. Simulate sensor tick
            metrics = simulator.get_current_metrics()

            # 2. Multi-node overview
            all_nodes = simulator.get_all_nodes_metrics()
            nodes_summary = []
            for nm in all_nodes:
                nodes_summary.append({
                    "node_id":    nm["node_id"],
                    "node_name":  nm["node_name"],
                    "temperature":nm["temperature"],
                    "latency_ms": nm["latency_ms"],
                    "anomaly_flag": nm["anomaly_flag"],
                    "health_score": simulator.compute_health_score(nm),
                })

            # 3. Build feature vector and push to buffer
            feat = build_feature_vector(metrics)
            telemetry_buffer.append(feat)

            # 4. MTL+ONNX inference (only when buffer is full)
            if len(telemetry_buffer) == 20:
                window  = np.array(telemetry_buffer, dtype=np.float32)  # (20, 6)
                results = onnx_model.predict(window)

                per_pred     = round(results["per_prediction"] * 100, 2)   # 0-100%
                anomaly_sc   = round(results["anomaly_score"] * 1000, 2)   # amplify raw recon error
                health_sc    = round(results["health_score"], 1)           # 0-100
                failure_prob = round((100.0 - health_sc), 1)               # inverse of health
                infer_ms     = round(results["inference_ms"], 2)
            else:
                # Not enough history yet — use simulator formula while buffering
                per_pred     = round(metrics["noise_percent"] * 0.05, 2)
                anomaly_sc   = round(metrics["noise_percent"] * 0.3, 2)
                health_sc    = simulator.compute_health_score(metrics)
                failure_prob = round(100.0 - health_sc, 1)
                infer_ms     = 0.0

            metrics["predicted_per"]       = per_pred
            metrics["anomaly_score"]       = anomaly_sc
            metrics["health_score"]        = health_sc
            metrics["failure_probability"] = failure_prob
            metrics["inference_ms"]        = infer_ms
            metrics["buffer_fill"]         = len(telemetry_buffer)
            # Pass the 20 attention weights for visual profiling in the ML tab
            metrics["attention_weights"]   = results["temporal_attention"] if len(telemetry_buffer) == 20 else [0.05] * 20


            # 5. Model badge info for dashboard
            metrics["ml_models"] = {
                "per":     "MTL Conv-Backbone → PER Head",
                "failure": "MTL Health Score (inverted)",
                "anomaly": "MTL Autoencoder Reconstruction",
                "health":  "MTL Sigmoid Health Head",
                "engine":  "ONNX Runtime (11.4x speedup)",
            }

            # 6. Closed-loop ML optimization
            # Only slow polling if BOTH per is high AND health is degraded
            if ml_optimization_active:
                if per_pred > 15.0 and health_sc < 60:
                    simulator.set_polling_rate(2.0)
                    metrics["tuning_action"] = "High PER + Low Health → Polling slowed to 2.0s"
                else:
                    simulator.set_polling_rate(1.0)
                    metrics["tuning_action"] = f"PER {per_pred:.1f}% · Health {health_sc:.0f}% → Polling 1.0s"

            else:
                simulator.set_polling_rate(1.0)
                metrics["tuning_action"] = "ML Optimization Disabled"

            # 7. Build and stream payload
            payload = {**metrics, "nodes_summary": nodes_summary}
            current_metrics_cache.update(payload)
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(simulator.polling_interval)

    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
