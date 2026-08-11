import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import "./db"; // Initialize database on import
import rsvpRoutes from "./routes/rsvp";
import adminRoutes from "./routes/admin";
import { globalLimiter } from "./middleware/rateLimit";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// --- Middleware ---

app.use(
  cors({
    origin: true, // Allow all origins (same-origin in production, flexible in dev)
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-admin-password"],
  })
);

app.use(express.json());
app.use(globalLimiter);

// --- API Routes (must come before static files) ---

app.use("/api", rsvpRoutes);
app.use("/api/admin", adminRoutes);

// --- Health check ---

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Static frontend files ---

const publicDir = path.resolve(__dirname, "..", "public");
app.use(express.static(publicDir));

// Serve correct Astro-generated HTML for known routes
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(publicDir, "admin", "index.html"), (err) => {
    if (err) res.status(404).send("Страница не найдена");
  });
});

app.get("/rsvp", (_req, res) => {
  res.sendFile(path.join(publicDir, "rsvp", "index.html"), (err) => {
    if (err) res.status(404).send("Страница не найдена");
  });
});

// Catch-all: serve main page for unknown routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) res.status(404).send("Страница не найдена");
  });
});

// --- Start server ---

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

export default app;

