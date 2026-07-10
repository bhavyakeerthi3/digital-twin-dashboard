"""
Advanced ML Model Suite for Digital Twin Predictive Analytics
=============================================================
Models:
  1. LSTM         — PyTorch, sliding-window time-series  → PER / latency prediction
  2. SVM (RBF)    — Sklearn SVC                          → failure probability classification
  3. Isolation Forest — Sklearn unsupervised             → anomaly scoring
  4. Gradient Boosting — Sklearn ensemble                → system health score regression
"""

import warnings
import numpy as np
import pandas as pd
from collections import deque

# Sklearn
from sklearn.svm import SVC
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.pipeline import Pipeline

# PyTorch LSTM
import torch
import torch.nn as nn

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# 1. LSTM Network Definition
# ─────────────────────────────────────────────
class LSTMModel(nn.Module):
    """Stacked LSTM for time-series PER prediction."""
    def __init__(self, input_size=3, hidden_size=64, num_layers=2, output_size=1):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers  = num_layers
        self.lstm = nn.LSTM(
            input_size, hidden_size, num_layers,
            batch_first=True, dropout=0.2
        )
        self.attention = nn.Linear(hidden_size, 1)   # self-attention over time
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, output_size),
            nn.Sigmoid()
        )

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        out, _ = self.lstm(x, (h0, c0))          # (B, T, H)
        # Self-attention pooling
        attn_weights = torch.softmax(self.attention(out), dim=1)  # (B, T, 1)
        context = (out * attn_weights).sum(dim=1)                  # (B, H)
        return self.fc(context)                                    # (B, 1)


# ─────────────────────────────────────────────
# 2. Main Predictive Model Class
# ─────────────────────────────────────────────
class PredictiveModel:
    SEQ_LEN    = 20          # LSTM sequence window
    N_FEATURES = 3           # [noise%, latency_ms, temperature]

    def __init__(self):
        self.is_trained = False

        # LSTM
        self.lstm_model  = LSTMModel(self.N_FEATURES, 64, 2, 1)
        self.lstm_scaler = MinMaxScaler()

        # SVM failure classifier
        self.svm_pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('svm',    SVC(kernel='rbf', C=5.0, gamma='scale',
                           probability=True, class_weight='balanced'))
        ])

        # Isolation Forest anomaly detector
        self.iso_forest = IsolationForest(
            n_estimators=200, contamination=0.1,
            max_samples='auto', random_state=42
        )

        # Gradient Boosting health score regressor
        self.gb_health = Pipeline([
            ('scaler', StandardScaler()),
            ('gb',     GradientBoostingRegressor(
                n_estimators=200, learning_rate=0.05,
                max_depth=4, subsample=0.8, random_state=42
            ))
        ])

        # Ring buffer for LSTM online input
        self._seq_buffer = deque(maxlen=self.SEQ_LEN)

        self.train_synthetic()

    # ── Synthetic Training Data ──────────────────
    def _make_synthetic(self, n=2000):
        np.random.seed(42)
        noise   = np.random.uniform(0, 100, n)
        latency = 50 + noise * 1.5 + np.random.normal(0, 10, n)
        temp    = 20 + noise * 0.15 + np.random.normal(0, 3, n)
        per     = (noise * 0.08 + np.random.normal(0, 0.5, n)).clip(0, 100) / 100.0
        failed  = ((noise > 60) | (temp > 35) | (latency > 250)).astype(int)
        health  = (100 - noise * 0.5 - (latency - 50) * 0.05 - (temp - 20) * 0.5
                   + np.random.normal(0, 3, n)).clip(0, 100)
        return noise, latency, temp, per, failed, health

    def train_synthetic(self):
        noise, latency, temp, per, failed, health = self._make_synthetic()
        X3 = np.stack([noise, latency, temp], axis=1)

        # ── Train SVM ──────────────────────────────
        self.svm_pipeline.fit(X3, failed)

        # ── Train Isolation Forest ──────────────────
        self.iso_forest.fit(X3)

        # ── Train Gradient Boosting health score ────
        X4 = np.stack([noise, latency, temp, per * 100], axis=1)
        self.gb_health.fit(X4, health)

        # ── Train LSTM (sliding window) ─────────────
        X_scaled = self.lstm_scaler.fit_transform(X3)
        sequences, targets = [], []
        for i in range(self.SEQ_LEN, len(X_scaled)):
            sequences.append(X_scaled[i - self.SEQ_LEN:i])
            targets.append(per[i])

        X_t = torch.tensor(np.array(sequences), dtype=torch.float32)
        y_t = torch.tensor(np.array(targets), dtype=torch.float32).unsqueeze(1)

        optimizer = torch.optim.Adam(self.lstm_model.parameters(), lr=1e-3)
        loss_fn   = nn.MSELoss()
        self.lstm_model.train()
        for epoch in range(30):                      # quick training for startup
            optimizer.zero_grad()
            pred = self.lstm_model(X_t)
            loss = loss_fn(pred, y_t)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.lstm_model.parameters(), 1.0)
            optimizer.step()

        self.lstm_model.eval()
        self.is_trained = True
        print("[ML] Advanced model suite trained: LSTM + SVM(RBF) + IsolationForest + GradientBoosting")

    # ── Public API ───────────────────────────────

    def predict_per(self, noise: float, latency: float, temperature: float = 25.0) -> float:
        """LSTM time-series PER prediction."""
        point = np.array([[noise, latency, temperature]])
        scaled = self.lstm_scaler.transform(point)[0]
        self._seq_buffer.append(scaled)

        if len(self._seq_buffer) < self.SEQ_LEN:
            # Not enough history yet — return simple linear estimate
            return round(float(max(0, noise * 0.08 + np.random.normal(0, 0.3))), 2)

        seq = torch.tensor(
            np.array(list(self._seq_buffer)), dtype=torch.float32
        ).unsqueeze(0)                              # (1, SEQ_LEN, 3)

        with torch.no_grad():
            pred = self.lstm_model(seq).item()

        return round(float(np.clip(pred * 100, 0, 100)), 2)

    def predict_failure_probability(self, noise: float, latency: float,
                                     temperature: float) -> float:
        """SVM (RBF kernel) failure probability (0-100%)."""
        X = pd.DataFrame([[noise, latency, temperature]],
                          columns=['noise', 'latency', 'temperature'])
        prob = self.svm_pipeline.predict_proba(X)[0][1]
        return round(float(prob * 100), 2)

    def compute_anomaly_score(self, noise: float, latency: float,
                               temperature: float) -> float:
        """Isolation Forest anomaly score (0-100 scale)."""
        X = np.array([[noise, latency, temperature]])
        # Returns -1 (anomaly) or 1 (normal) + decision function score
        decision = self.iso_forest.decision_function(X)[0]
        # Normalise: decision ∈ [-0.5, 0.5] roughly → [0, 100]
        score = float(np.clip((0.5 - decision) * 100, 0, 100))
        return round(score, 2)

    def predict_health_score(self, noise: float, latency: float,
                              temperature: float, per: float) -> float:
        """Gradient Boosting health score regression (0-100)."""
        X = pd.DataFrame([[noise, latency, temperature, per]],
                          columns=['noise', 'latency', 'temperature', 'per'])
        score = self.gb_health.predict(X)[0]
        return round(float(np.clip(score, 0, 100)), 1)
