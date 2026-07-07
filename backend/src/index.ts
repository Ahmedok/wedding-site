import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import "./db"; // Initialize database on import
import rsvpRoutes from "./routes/rsvp";
import adminRoutes from "./routes/admin";
import { globalLimiter } from "./middleware/rateLimit";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// --- Middleware ---

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || FRONTEND_URL === "*" || origin === FRONTEND_URL || /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-admin-password"],
  })
);

app.use(express.json());
app.use(globalLimiter);

// --- Routes ---

app.use("/api", rsvpRoutes);
app.use("/api/admin", adminRoutes);

// --- Health check ---

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Start server ---

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

export default app;
