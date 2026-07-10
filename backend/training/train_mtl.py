"""Training pipeline for Multi-Task Digital Twin"""
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
