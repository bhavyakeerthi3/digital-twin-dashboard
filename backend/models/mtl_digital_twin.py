"""
Unified Multi-Task Learning Digital Twin
========================================
Replaces: LSTM (forecasting) + SVM (classification) + Isolation Forest (anomaly) + GBR (health)
With: One shared temporal backbone -> 3 prediction heads -> single forward pass

Designed for clean ONNX export: no dynamic control flow, no unsupported ops.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple

class ResidualConv1DBlock(nn.Module):
    def __init__(self, channels: int, kernel_size: int = 3, dropout: float = 0.1):
        super().__init__()
        padding = kernel_size // 2
        # GroupNorm(1, C) works on (B, C, T) — correct for Conv1d tensors
        # LayerNorm would fail here because Conv1d output is (B, C, T) not (B, T, C)
        self.norm1 = nn.GroupNorm(1, channels)
        self.norm2 = nn.GroupNorm(1, channels)
        self.act   = nn.GELU()
        self.drop  = nn.Dropout(dropout)
        self.conv1 = nn.Conv1d(channels, channels, kernel_size, padding=padding)
        self.conv2 = nn.Conv1d(channels, channels, kernel_size, padding=padding)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.drop(self.conv1(self.act(self.norm1(x))))
        h = self.drop(self.conv2(self.act(self.norm2(h))))
        return x + h


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
