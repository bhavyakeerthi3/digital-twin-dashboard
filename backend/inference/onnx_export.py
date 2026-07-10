"""ONNX Export, Validation, and Benchmarking"""
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
    torch.onnx.export(
        model, dummy, onnx_path,
        input_names=["telemetry_window"],
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=14,              # opset 14 is stable and onnxscript-free
        do_constant_folding=True,
        export_params=True,
    )
    print(f"Saved: {onnx_path}")


    # Validate
    print("\nValidating ONNX vs PyTorch...")
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    inp = np.random.randn(1, 20, 6).astype(np.float32)
    with torch.no_grad():
        pt_out = model(torch.from_numpy(inp))
    onnx_out = dict(zip(output_names, session.run(None, {"telemetry_window": inp})))

    for name in output_names:
        match = np.allclose(pt_out[name].numpy(), onnx_out[name], atol=1e-4)
        print(f"  {name}: {'PASS' if match else 'FAIL'}")

    # Benchmark
    print("\nBenchmarking (200 runs)...")
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
