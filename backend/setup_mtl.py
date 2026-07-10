"""
Master Setup Script for MTL + ONNX Digital Twin Upgrade
========================================================
Run this once: python setup_mtl.py
It will generate:
  - models/mtl_digital_twin.py
  - training/train_mtl.py
  - inference/onnx_export.py
  - inference/onnx_runtime.py
  - integration_example.py (drop-in logic for your main.py)
"""

import os

def write_file(filepath, content):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"Created: {filepath}")

# =====================================================================
# 1. THE MODEL
# =====================================================================
MODEL_CODE = """
\"\"\"
Unified Multi-Task Learning Digital Twin
========================================
Replaces: LSTM (forecasting) + SVM (classification) + Isolation Forest (anomaly) + GBR (health)
With: One shared temporal backbone -> 3 prediction heads -> single forward pass

Designed for clean ONNX export: no dynamic control flow, no unsupported ops.
\"\"\"

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple

class ResidualConv1DBlock(nn.Module):
    def __init__(self, channels: int, kernel_size: int = 3, dropout: float = 0.1):
        super().__init__()
        padding = kernel_size // 2
        self.block = nn.Sequential(
            nn.LayerNorm(channels), nn.GELU(),
            nn.Conv1d(channels, channels, kernel_size, padding=padding), nn.Dropout(dropout),
            nn.LayerNorm(channels), nn.GELU(),
            nn.Conv1d(channels, channels, kernel_size, padding=padding), nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)

class TemporalBackbone(nn.Module):
    def __init__(self, input_channels: int = 6, d_model: int = 64, n_conv_blocks: int = 3, n_heads: int = 4, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Conv1d(input_channels, d_model, kernel_size=1)
        self.conv_blocks = nn.ModuleList([ResidualConv1DBlock(d_model, kernel_size=3, dropout=dropout) for _ in range(n_conv_blocks)])
        self.attention = nn.MultiheadAttention(embed_dim=d_model, num_heads=n_heads, dropout=dropout, batch_first=True)
        self.attn_norm = nn.LayerNorm(d_model)
        self.attn_dropout = nn.Dropout(dropout)
        self.temporal_attn = nn.Sequential(nn.Linear(d_model, d_model // 4), nn.GELU(), nn.Linear(d_model // 4, 1))

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        h = x.transpose(1, 2)
        h = self.input_proj(h)
        for block in self.conv_blocks:
            h = block(h)
        h = h.transpose(1, 2)
        attn_out, _ = self.attention(h, h, h)
        h = self.attn_norm(h + self.attn_dropout(attn_out))
        attn_scores = self.temporal_attn(h)
        attn_weights = F.softmax(attn_scores, dim=1)
        pooled = (h * attn_weights).sum(dim=1)
        return pooled, attn_weights

class MultiTaskDigitalTwin(nn.Module):
    def __init__(self, input_channels: int = 6, seq_len: int = 20, d_model: int = 64, n_heads: int = 4, n_conv_blocks: int = 3, dropout: float = 0.1):
        super().__init__()
        self.backbone = TemporalBackbone(input_channels, d_model, n_conv_blocks, n_heads, dropout)
        self.per_head = nn.Sequential(nn.Linear(d_model, 32), nn.GELU(), nn.Dropout(dropout), nn.Linear(32, 1))
        self.anomaly_encoder = nn.Sequential(nn.Linear(d_model, 32), nn.GELU())
        self.anomaly_decoder = nn.Linear(32, d_model)
        self.health_head = nn.Sequential(nn.Linear(d_model, 32), nn.GELU(), nn.Dropout(dropout), nn.Linear(32, 1))

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        shared_emb, attn_weights = self.backbone(x)
        per_pred = self.per_head(shared_emb)
        encoded = self.anomaly_encoder(shared_emb)
        reconstructed = self.anomaly_decoder(encoded)
        health_score = torch.sigmoid(self.health_head(shared_emb)) * 100.0
        return {
            "per_prediction": per_pred,
            "shared_embedding": shared_emb,
            "reconstructed_embedding": reconstructed,
            "health_score": health_score,
            "temporal_attention": attn_weights,
        }

    def compute_loss(self, preds, per_target, health_target):
        per_loss = F.mse_loss(preds["per_prediction"], per_target)
        recon_loss = F.mse_loss(preds["reconstructed_embedding"], preds["shared_embedding"])
        health_loss = F.mse_loss(preds["health_score"], health_target)
        total_loss = 1.0 * per_loss + 0.5 * recon_loss + 0.3 * health_loss
        return total_loss, {"total": total_loss.item(), "per": per_loss.item(), "anomaly": recon_loss.item(), "health": health_loss.item()}

    def get_failure_probability(self, health_score: float) -> bool:
        return health_score < 40.0
"""

# =====================================================================
# 2. THE TRAINER
# =====================================================================
TRAINER_CODE = """
\"\"\"Training pipeline for Multi-Task Digital Twin\"\"\"
import torch
import numpy as np
from torch.utils.data import DataLoader, TensorDataset
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from models.mtl_digital_twin import MultiTaskDigitalTwin

def generate_synthetic_data(n_samples=5000, seq_len=20):
    np.random.seed(42)
    X = np.zeros((n_samples, seq_len, 6), dtype=np.float32)
    y_per = np.zeros((n_samples, 1), dtype=np.float32)
    y_health = np.zeros((n_samples, 1), dtype=np.float32)
    for i in range(n_samples):
        phase = np.random.uniform(0, 2 * np.pi)
        base_temp = 25 + 5 * np.sin(phase + np.linspace(0, 0.5, seq_len))
        base_latency = 80 + 20 * np.cos(phase + np.linspace(0, 0.3, seq_len))
        noise_level = np.random.uniform(0.6, 1.0, seq_len).astype(np.float32) if np.random.random() < 0.15 else np.random.uniform(0.0, 0.3, seq_len).astype(np.float32)
        X[i, :, 0] = base_temp + noise_level * 8 + np.random.normal(0, 0.5, seq_len)
        X[i, :, 1] = base_latency + noise_level * 60 + np.random.normal(0, 3, seq_len)
        X[i, :, 2] = np.clip(100 - noise_level * 80 - X[i, :, 1] * 0.1, 10, 100)
        X[i, :, 3] = np.clip(noise_level * 0.08 + (100 - X[i, :, 2]) * 0.001, 0, 1)
        X[i, :, 4] = np.clip(1000 - X[i, :, 1] * 3 - X[i, :, 3] * 2000, 50, 1000)
        X[i, :, 5] = noise_level
        y_per[i, 0] = np.clip(X[i, -1, 3] + np.random.normal(0, 0.005), 0, 1)
        y_health[i, 0] = np.clip(100 - np.mean(noise_level) * 80 - np.mean(X[i, :, 3]) * 200, 0, 100)
    return X, y_per, y_health

def train():
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {DEVICE}")
    X, y_per, y_health = generate_synthetic_data()
    split = int(0.8 * len(X))
    train_loader = DataLoader(TensorDataset(torch.from_numpy(X[:split]), torch.from_numpy(y_per[:split]), torch.from_numpy(y_health[:split])), batch_size=32, shuffle=True)
    val_loader = DataLoader(TensorDataset(torch.from_numpy(X[split:]), torch.from_numpy(y_per[split:]), torch.from_numpy(y_health[split:])), batch_size=32)

    model = MultiTaskDigitalTwin().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)

    best_val_loss = float("inf")
    ckpt_dir = os.path.join(os.path.dirname(__file__), "..", "models", "checkpoints")
    os.makedirs(ckpt_dir, exist_ok=True)

    for epoch in range(1, 101):
        model.train()
        for X_b, per_b, health_b in train_loader:
            X_b, per_b, health_b = X_b.to(DEVICE), per_b.to(DEVICE), health_b.to(DEVICE)
            optimizer.zero_grad()
            preds = model(X_b)
            loss, _ = model.compute_loss(preds, per_b, health_b)
            loss.backward()
            optimizer.step()

        model.eval()
        val_loss_sum = 0
        with torch.no_grad():
            for X_b, per_b, health_b in val_loader:
                X_b, per_b, health_b = X_b.to(DEVICE), per_b.to(DEVICE), health_b.to(DEVICE)
                preds = model(X_b)
                loss, losses = model.compute_loss(preds, per_b, health_b)
                val_loss_sum += losses["total"]
        val_loss = val_loss_sum / len(val_loader)
        scheduler.step()

        if epoch % 10 == 0: print(f"Epoch {epoch:3d} | Val Loss: {val_loss:.4f}")
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({"model_state_dict": model.state_dict(), "val_loss": best_val_loss}, os.path.join(ckpt_dir, "best_mtl.pt"))
    print(f"Training complete. Best Val Loss: {best_val_loss:.4f}")

if __name__ == "__main__": train()
"""

# =====================================================================
# 3. ONNX EXPORT & BENCHMARK
# =====================================================================
EXPORT_CODE = """
\"\"\"ONNX Export, Validation, and Benchmarking\"\"\"
import torch, numpy as np, onnxruntime as ort, time, os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from models.mtl_digital_twin import MultiTaskDigitalTwin

def main():
    ckpt_path = os.path.join(os.path.dirname(__file__), "..", "models", "checkpoints", "best_mtl.pt")
    onnx_path = os.path.join(os.path.dirname(__file__), "..", "models", "onnx", "digital_twin_mtl.onnx")

    if not os.path.exists(ckpt_path):
        print("ERROR: Run training/train_mtl.py first."); return

    model = MultiTaskDigitalTwin()
    model.load_state_dict(torch.load(ckpt_path, map_location="cpu", weights_only=True)["model_state_dict"])
    model.eval()
    os.makedirs(os.path.dirname(onnx_path), exist_ok=True)

    dummy = torch.randn(1, 20, 6)
    output_names = ["per_prediction", "shared_embedding", "reconstructed_embedding", "health_score", "temporal_attention"]
    dynamic_axes = {n: {0: "batch"} for n in output_names}
    dynamic_axes["telemetry_window"] = {0: "batch"}
    dynamic_axes["temporal_attention"][1] = "seq_len"

    print("Exporting to ONNX...")
    torch.onnx.export(model, dummy, onnx_path, input_names=["telemetry_window"], output_names=output_names, dynamic_axes=dynamic_axes, opset_version=17, do_constant_folding=True)
    print(f"Saved: {onnx_path}")

    # Validate
    print("\\nValidating ONNX vs PyTorch...")
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    inp = np.random.randn(1, 20, 6).astype(np.float32)
    with torch.no_grad():
        pt_out = model(torch.from_numpy(inp))
    onnx_out = dict(zip(output_names, session.run(None, {"telemetry_window": inp})))

    for name in output_names:
        match = np.allclose(pt_out[name].numpy(), onnx_out[name], atol=1e-4)
        print(f"  {name}: {'PASS' if match else 'FAIL'}")

    # Benchmark
    print("\\nBenchmarking (200 runs)...")
    session.run(None, {"telemetry_window": inp})
    with torch.no_grad(): model(torch.from_numpy(inp))

    pt_times, onnx_times = [], []
    for _ in range(200):
        s = time.perf_counter()
        with torch.no_grad(): model(torch.from_numpy(inp))
        pt_times.append((time.perf_counter() - s)*1000)

        s = time.perf_counter()
        session.run(None, {"telemetry_window": inp})
        onnx_times.append((time.perf_counter() - s)*1000)

    print(f"  PyTorch: {np.mean(pt_times):.2f} ms")
    print(f"  ONNX:    {np.mean(onnx_times):.2f} ms")
    print(f"  Speedup: {np.mean(pt_times)/np.mean(onnx_times):.1f}x")

if __name__ == "__main__": main()
"""

# =====================================================================
# 4. ONNX RUNTIME WRAPPER
# =====================================================================
RUNTIME_CODE = """
\"\"\"Production ONNX Runtime Wrapper for 1Hz WebSocket Inference\"\"\"
import numpy as np, onnxruntime as ort, time, logging
from typing import Dict
logger = logging.getLogger(__name__)

class DigitalTwinONNX:
    def __init__(self, model_path: str = "models/onnx/digital_twin_mtl.onnx"):
        providers = ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [o.name for o in self.session.get_outputs()]
        logger.info(f"Loaded ONNX model: {model_path}")

    def warmup(self, n: int = 10):
        dummy = np.random.randn(1, 20, 6).astype(np.float32)
        for _ in range(n): self.session.run(None, {self.input_name: dummy})
        logger.info("ONNX runtime warmed up.")

    def predict(self, window: np.ndarray) -> Dict:
        start = time.perf_counter()
        inp = window.astype(np.float32).reshape(1, 20, 6)
        outputs = dict(zip(self.output_names, self.session.run(None, {self.input_name: inp})))

        shared_emb = outputs["shared_embedding"][0]
        recon_emb = outputs["reconstructed_embedding"][0]
        anomaly_score = float(np.mean((shared_emb - recon_emb) ** 2))
        health_score = float(outputs["health_score"][0, 0])

        return {
            "per_prediction": float(outputs["per_prediction"][0, 0]),
            "anomaly_score": anomaly_score,
            "health_score": health_score,
            "failure_likely": health_score < 40.0,
            "temporal_attention": outputs["temporal_attention"][0].tolist(),
            "inference_ms": (time.perf_counter() - start) * 1000
        }
"""

# =====================================================================
# 5. MAIN.PY INTEGRATION SNIPPET
# =====================================================================
INTEGRATION_CODE = """
\"\"\"
Drop-in replacement for your FastAPI WebSocket handler.
Replace your old model loading and inference logic with this.
\"\"\"
import numpy as np
from collections import deque
import logging
from inference.onnx_runtime import DigitalTwinONNX

logger = logging.getLogger(__name__)

# 1. Initialize on startup (outside the websocket function)
onnx_model = DigitalTwinONNX("models/onnx/digital_twin_mtl.onnx")
onnx_model.warmup(n=10)
telemetry_buffer = deque(maxlen=20)
current_polling_rate = 1.0


# 2. Inside your websocket endpoint:
async def handle_websocket(websocket):
    global current_polling_rate
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()

            # Extract features in exact order: temp, latency, signal, per, throughput, noise
            telemetry = np.array([
                data["temperature"], data["latency"], data["signal_strength"],
                data["packet_error_rate"], data["throughput"], data["noise_level"]
            ], dtype=np.float32)

            telemetry_buffer.append(telemetry)
            response = {"telemetry": data, "predictions": None, "control": {"polling_rate": current_polling_rate, "action": "waiting"}}

            if len(telemetry_buffer) == 20:
                window = np.array(telemetry_buffer, dtype=np.float32)
                results = onnx_model.predict(window)

                response["predictions"] = {
                    "per_predicted": round(results["per_prediction"], 4),
                    "anomaly_score": round(results["anomaly_score"], 4),
                    "health_score": round(results["health_score"], 1),
                    "failure_likely": results["failure_likely"],
                    "attention_weights": results["temporal_attention"],
                    "inference_ms": round(results["inference_ms"], 2)
                }

                # Closed-loop control
                if results["per_prediction"] > 0.05:
                    current_polling_rate = max(0.2, current_polling_rate * 0.75)
                    response["control"] = {"polling_rate": round(current_polling_rate, 2), "action": "decreased (PER elevated)"}
                elif results["health_score"] > 80 and current_polling_rate < 1.0:
                    current_polling_rate = min(2.0, current_polling_rate * 1.1)
                    response["control"] = {"polling_rate": round(current_polling_rate, 2), "action": "increased (health good)"}

            await websocket.send_json(response)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
"""

# =====================================================================
# EXECUTION
# =====================================================================
if __name__ == "__main__":
    print("Generating MTL + ONNX Digital Twin files...")
    write_file("models/mtl_digital_twin.py", MODEL_CODE)
    write_file("training/train_mtl.py", TRAINER_CODE)
    write_file("inference/onnx_export.py", EXPORT_CODE)
    write_file("inference/onnx_runtime.py", RUNTIME_CODE)
    write_file("integration_example.py", INTEGRATION_CODE)

    write_file("models/__init__.py", "")
    write_file("training/__init__.py", "")
    write_file("inference/__init__.py", "")

    print("\n✅ All files generated successfully!")
    print("Run these commands in order:\n")
    print("1. python training/train_mtl.py")
    print("2. python inference/onnx_export.py")
    print("3. Copy logic from integration_example.py into your main.py")
