import random
import time
import asyncio
from dataclasses import dataclass, field
from typing import Dict, Any, List

@dataclass
class NetworkConditions:
    noise_percent: float = 10.0
    base_latency_ms: int = 40
    base_loss_perc: float = 0.5

@dataclass
class NodeConfig:
    node_id: str
    name: str
    register: str
    base_temp: float
    temp_variance: float
    latency_offset: float  # per-node latency modifier

class ModbusGatewaySimulator:
    def __init__(self):
        self.conditions = NetworkConditions()
        self.packets_sent = 0
        self.packets_lost = 0
        self.polling_interval = 1.0  # seconds
        self.is_running = False

        # Dynamic Threshold Configuration (Editable via Settings tab)
        self.temp_warning = 30.0
        self.temp_critical = 35.0
        self.latency_warning = 200.0
        self.latency_critical = 300.0

        # Chaos Simulation Fault Profile ("none" | "thermal" | "network" | "full")
        self.active_fault_profile = "none"

        # Multi-node configuration
        self.nodes: List[NodeConfig] = [
            NodeConfig("node_a", "PLC Node A", "40001", 22.0, 5.0, 0.0),
            NodeConfig("node_b", "PLC Node B", "40002", 22.0, 5.0, 15.0),
            NodeConfig("node_c", "PLC Node C", "40003", 18.0, 3.0, 8.0),
        ]
        self.active_node_id = "node_a"

        # Anomaly history for detection
        self._history: Dict[str, List[float]] = {n.node_id: [] for n in self.nodes}

    def get_node_list(self) -> List[Dict[str, str]]:
        return [{"id": n.node_id, "name": n.name, "register": n.register} for n in self.nodes]

    def set_active_node(self, node_id: str):
        if any(n.node_id == node_id for n in self.nodes):
            self.active_node_id = node_id

    def set_fault_profile(self, profile: str):
        if profile in ["none", "thermal", "network", "full"]:
            self.active_fault_profile = profile

    def set_thresholds(self, t_warn: float, t_crit: float, l_warn: float, l_crit: float):
        self.temp_warning = t_warn
        self.temp_critical = t_crit
        self.latency_warning = l_warn
        self.latency_critical = l_crit

    def _get_node_config(self, node_id: str) -> NodeConfig:
        for n in self.nodes:
            if n.node_id == node_id:
                return n
        return self.nodes[0]

    def get_metrics_for_node(self, node_id: str) -> Dict[str, Any]:
        node = self._get_node_config(node_id)
        noise = self.conditions.noise_percent

        # Simulate network effects based on noise + per-node offset
        latency = self.conditions.base_latency_ms + (noise * 2.5) + node.latency_offset
        jitter = latency * 0.2 * random.random()

        # PLC Data (Simulated Register: Temperature)
        temperature = node.base_temp + (random.random() * node.temp_variance) + (noise / 20.0)

        # ── Chaos Simulation Fault Injection ──
        if self.active_fault_profile == "thermal" or self.active_fault_profile == "full":
            # Simulate a cooling fan failure / heater short circuit
            temperature += 16.5 + (random.random() * 4.0)
        if self.active_fault_profile == "network" or self.active_fault_profile == "full":
            # Simulate cellular tower congestion / packet floods
            latency += 180.0 + (random.random() * 50.0)
            jitter *= 2.5

        # Loss probability increases quadratically with noise
        loss_prob = (noise / 100.0) ** 1.5

        # Track temperature history for anomaly detection
        self._history[node_id].append(temperature)
        if len(self._history[node_id]) > 60:
            self._history[node_id] = self._history[node_id][-60:]

        # Anomaly detection: spike detection using Dynamic Thresholds
        anomaly_flag = "NORMAL"
        anomaly_severity = 0  # 0=normal, 1=warning, 2=critical
        if temperature > self.temp_critical or (latency + jitter) > self.latency_critical:
            anomaly_flag = "CRITICAL"
            anomaly_severity = 2
        elif temperature > self.temp_warning or (latency + jitter) > self.latency_warning:
            anomaly_flag = "WARNING"
            anomaly_severity = 1

        return {
            "node_id": node_id,
            "node_name": node.name,
            "register": node.register,
            "timestamp": time.time(),
            "temperature": round(temperature, 2),
            "latency_ms": round(latency + jitter, 2),
            "jitter_ms": round(jitter, 2),
            "noise_percent": noise,
            "polling_interval": self.polling_interval,
            "loss_prob": round(loss_prob * 100, 2),
            "anomaly_flag": anomaly_flag,
            "anomaly_severity": anomaly_severity,
            "fault_profile": self.active_fault_profile,
            "thresholds": {
                "temp_warning": self.temp_warning,
                "temp_critical": self.temp_critical,
                "latency_warning": self.latency_warning,
                "latency_critical": self.latency_critical
            }
        }

    def get_current_metrics(self) -> Dict[str, Any]:
        """Backward-compatible: returns metrics for active node."""
        return self.get_metrics_for_node(self.active_node_id)

    def get_all_nodes_metrics(self) -> List[Dict[str, Any]]:
        """Returns metrics for all nodes simultaneously."""
        return [self.get_metrics_for_node(n.node_id) for n in self.nodes]

    def compute_health_score(self, metrics: Dict[str, Any]) -> float:
        """
        Composite health score 0-100.
        Factors: temperature (ideal ~22°C), latency (ideal <60ms), noise (ideal 0%), loss_prob (ideal 0%).
        """
        temp = metrics["temperature"]
        latency = metrics["latency_ms"]
        noise = metrics["noise_percent"]
        loss = metrics["loss_prob"]

        # Temperature score: 100 at 22°C, drops as it goes above 30 or below 15
        temp_score = max(0, 100 - abs(temp - 22.0) * 5)

        # Latency score: 100 at 40ms, 0 at 300ms
        latency_score = max(0, 100 - ((latency - 40) / 260) * 100)

        # Noise score: direct inverse
        noise_score = max(0, 100 - noise)

        # Loss score: 100 at 0%, 0 at 10%+
        loss_score = max(0, 100 - loss * 10)

        # Weighted composite
        health = (temp_score * 0.25 + latency_score * 0.30 + noise_score * 0.25 + loss_score * 0.20)
        return round(max(0, min(100, health)), 1)

    def set_noise(self, noise: float):
        self.conditions.noise_percent = max(0.0, min(100.0, noise))

    def set_polling_rate(self, rate: float):
        self.polling_interval = max(0.1, min(10.0, rate))
