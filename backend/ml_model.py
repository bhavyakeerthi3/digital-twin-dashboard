import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
import os

class PredictiveModel:
    def __init__(self):
        self.model = LinearRegression()
        self.is_trained = False

    def train_synthetic(self):
        # Generate 1000 data points of noise vs PER
        noise = np.random.uniform(0, 100, 1000)
        # Latency is also a factor
        latency = 40 + (noise * 2.5) + np.random.normal(0, 5, 1000)
        
        # PER based on noise (quadratic-ish)
        per = (noise / 100.0) ** 1.5 * 10 
        per += np.random.normal(0, 0.5, 1000)
        per = np.clip(per, 0, 100)

        df = pd.DataFrame({
            'noise': noise,
            'latency': latency,
            'per': per
        })

        X = df[['noise', 'latency']]
        y = df['per']
        
        self.model.fit(X, y)
        self.is_trained = True

    def predict_per(self, noise: float, latency: float) -> float:
        if not self.is_trained:
            self.train_synthetic()
        
        X_new = np.array([[noise, latency]])
        prediction = self.model.predict(X_new)[0]
        return max(0, prediction)

# Global Instance
model = PredictiveModel()
model.train_synthetic()
