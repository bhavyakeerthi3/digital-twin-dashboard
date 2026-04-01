import random
import time
import asyncio
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class NetworkConditions:
    noise_percent: float = 10.0
    base_latency_ms: int = 40
    base_loss_perc: float = 0.5

class ModbusGatewaySimulator:
    def __init__(self):
        self.conditions = NetworkConditions()
        self.packets_sent = 0
        self.packets_lost = 0
        self.polling_interval = 1.0  # seconds
        self.is_running = False

    def get_current_metrics(self) -> Dict[str, Any]:
        # Simulate network effects based on noise
        latency = self.conditions.base_latency_ms + (self.conditions.noise_percent * 2.5)
        # Jitter is roughly 20% of latency
        jitter = latency * 0.2 * (random.random())
        
        # Loss probability increases quadratically with noise
        loss_prob = (self.conditions.noise_percent / 100.0) ** 1.5
        
        # PLC Data (Simulated Register 40001: Temperature)
        temperature = 22.0 + (random.random() * 5.0) + (self.conditions.noise_percent / 20.0)
        
        return {
            "timestamp": time.time(),
            "temperature": round(temperature, 2),
            "latency_ms": round(latency + jitter, 2),
            "jitter_ms": round(jitter, 2),
            "noise_percent": self.conditions.noise_percent,
            "polling_interval": self.polling_interval,
            "loss_prob": round(loss_prob * 100, 2)
        }

    def set_noise(self, noise: float):
        self.conditions.noise_percent = max(0.0, min(100.0, noise))

    def set_polling_rate(self, rate: float):
        self.polling_interval = max(0.1, min(10.0, rate))
