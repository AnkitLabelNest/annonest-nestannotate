console.log("🔧 Dashboard routes registered");

import type { Server } from "http";
import type { Express } from "express";

// 🔹 New modular routes
import dashboardRoutes from "./dashboard";
import newsRoutes from "./news";
import aiOutputRoutes from "./aiOutputs";

export async function registerRoutes(
  _server: Server,
  app: Express
) {
  // ================================
  // ✅ NEW ANNONEST v1 ROUTES
  // ================================
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/news", newsRoutes);
  app.use("/api/ai-outputs", aiOutputRoutes);

  // ================================
  // ⚠️ LEGACY / EXISTING ROUTES
  // (leave untouched if you add later)
  // ================================
}
