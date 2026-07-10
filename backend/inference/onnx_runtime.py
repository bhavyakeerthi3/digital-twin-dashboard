"""Production ONNX Runtime Wrapper for 1Hz WebSocket Inference"""
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
