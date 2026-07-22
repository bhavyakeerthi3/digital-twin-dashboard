# 🏭 Advanced Predictive Digital Twin for Industrial IoT
### Using ONNX Runtime | 22BCE8819 — Bhavya Keerthi K

> **B.Tech Capstone Project** | VIT-AP University | Internship @ Wiman Communication Technologies

A real-time predictive digital twin for a **Modbus-over-GSM industrial network**. Simulated PLC nodes stream telemetry through a **FastAPI + WebSocket** backend, where a **Multi-Task Learning (MTL)** model exported to **ONNX Runtime** performs live inference — delivering **11.4× faster** predictions than native PyTorch (11.00 ms → 0.96 ms).

---

## 🧠 How It Works

```
PLC Simulator  →  FastAPI + WebSocket  →  ONNX MTL Inference  →  React Dashboard
   (Modbus/GSM)      (1 Hz telemetry)       (0.96 ms / tick)      (live KPIs + alerts)
```

The system uses a **shared temporal backbone** (Conv1D + Multi-Head Attention) with three prediction heads trained jointly in a single forward pass:

| Head | Output | Description |
|------|--------|-------------|
| PER Head | `per_prediction` | Packet Error Rate (0–100%) |
| Autoencoder Head | `anomaly_score` | Reconstruction error → anomaly detection |
| Health Head | `health_score` | Equipment health (0–100%), flags failure < 40% |
| Attention | `temporal_attention` | 20-step weights showing which timesteps matter |

---

## 📐 Architecture

```
Input: telemetry_window  [batch, 20, 6]
       └─ 6 features: [temperature, latency_ms, signal_quality,
                        loss_prob_norm, throughput_approx, noise_norm]

Temporal Backbone:
  Conv1D input projection  →  3× Residual Conv1D Blocks  →  Multi-Head Attention
  └─ Temporal Attention pooling  →  shared_embedding [64-dim]

Output Heads:
  shared_embedding → PER Head         → per_prediction   [1, 1]
  shared_embedding → Anomaly Encoder  → reconstructed_embedding [1, 64]
  shared_embedding → Health Head      → health_score     [1, 1]
  Attention weights                   → temporal_attention [1, 20, 1]
```

**ONNX Export:** `opset_version=14`, constant folding enabled, validated against PyTorch within `1×10⁻⁴` absolute tolerance across all 5 output heads.

---

## 🚀 Quick Start

### 1. Backend (FastAPI + ONNX Inference)
```powershell
cd backend
pip install -r requirements.txt
python main.py
# Server starts at http://localhost:8000
# WebSocket at ws://localhost:8000/telemetry
```

### 2. Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 3. (Optional) Retrain & Re-export Model
```powershell
cd backend
python training/train_mtl.py        # trains 100 epochs on 5000 synthetic samples
python inference/onnx_export.py     # exports + validates + benchmarks ONNX vs PyTorch
```

---

## 📁 Project Structure

```
digital-twin-app/
├── backend/
│   ├── main.py                        # FastAPI app + WebSocket telemetry endpoint
│   ├── simulator.py                   # Modbus/GSM PLC node simulator (3 nodes + fault injection)
│   ├── ml_model.py                    # Legacy sklearn models (reference only)
│   ├── requirements.txt
│   ├── inference/
│   │   ├── onnx_runtime.py            # DigitalTwinONNX — production inference wrapper
│   │   └── onnx_export.py             # Export + validate + benchmark PyTorch → ONNX
│   ├── models/
│   │   ├── mtl_digital_twin.py        # MultiTaskDigitalTwin PyTorch model definition
│   │   ├── onnx/
│   │   │   ├── digital_twin_mtl.onnx       # Exported model graph
│   │   │   └── digital_twin_mtl.onnx.data  # External weights file
│   │   └── checkpoints/
│   │       └── best_mtl.pt            # Best PyTorch checkpoint (val loss: 1.9593)
│   └── training/
│       └── train_mtl.py               # MTL training pipeline (5000 samples, 100 epochs)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Root app — WebSocket client + page routing
│   │   ├── dashboard/
│   │   │   ├── TelemetryLineChart.jsx # Latency + PER live chart (Recharts)
│   │   │   ├── HealthDonut.jsx        # Node health donut chart
│   │   │   ├── NodesTable.jsx         # Multi-node comparison table
│   │   │   └── AIMLAnalysisPage.jsx   # ONNX inference details + attention viz
│   │   ├── layout/Sidebar.jsx         # Navigation sidebar
│   │   └── ui/                        # StatCard, StatusPill primitives
│   └── package.json                   # React 18 + Vite + Recharts + Framer Motion
├── report/images/                     # Benchmark charts, training loss, radar plots
├── 22BCE8819_slides.pdf               # Official presentation slides
├── Bhavya_Keerthi_K_22BCE8819_Report_non_cdc.docx  # Full B.Tech report
└── walkthrough.md                     # 10-slide content walkthrough
```

---

## 📊 Key Results (from 22BCE8819 Report)

| Metric | Value |
|--------|-------|
| PyTorch inference time | 11.00 ms |
| **ONNX Runtime inference time** | **0.96 ms** |
| **Speedup** | **11.4×** |
| ONNX vs PyTorch output tolerance | < 1×10⁻⁴ (all 5 heads PASS) |
| Best training loss | 1.9593 |
| Telemetry frequency | 1 Hz (WebSocket push) |
| Nodes monitored | 3 PLC nodes (A, B, C) |

---

## 🛡️ Closed-Loop Optimization

When ML mode is enabled, the backend automatically slows telemetry polling:
- `predicted_per > 15%` **AND** `health_score < 60` → polling rate slows to **2.0s**
- Otherwise → polling rate holds at **1.0s**

This reduces communication overhead during predicted high-risk periods.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Backend + ML model status |
| `GET` | `/nodes` | List all PLC nodes |
| `POST` | `/set-noise?value=N` | Inject GSM noise (0–100%) |
| `POST` | `/toggle-ml?active=true` | Enable/disable closed-loop ML |
| `POST` | `/set-node?node_id=node_a` | Switch active monitoring node |
| `POST` | `/set-thresholds` | Update anomaly thresholds |
| `WS` | `/telemetry` | Live 1 Hz telemetry + ONNX inference stream |

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Simulation | Python — Modbus/GSM simulator |
| Backend | FastAPI + Uvicorn + WebSockets |
| ML Model | PyTorch MTL (Conv1D + MHA + 3 heads) |
| Inference | **ONNX Runtime** (CPUExecutionProvider) |
| Frontend | React 18 + Vite + Recharts + Framer Motion |
| Styling | Tailwind CSS |

---

**Developed by Bhavya Keerthi K (22BCE8819)**
VIT-AP University · School of Computer Science Engineering · July 2026
