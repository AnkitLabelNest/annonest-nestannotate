import "dotenv/config";

console.log("DATABASE_URL =", process.env.DATABASE_URL);

import cors from "cors";

import { Pool } from "pg";
import { startNewsScheduler } from "./jobs/newsScheduler";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();

console.log("ENV CHECK", {
  SUPABASE_URL: !!process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});

import cors from "cors";

app.use(
  cors({
    origin: [
      "https://annonest-frontend.onrender.com",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-org-id",
      "x-user-id"
    ],
    credentials: true,
  })
);

app.options("*", cors());


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    ca: undefined,
  },
});

app.locals.db = pool;

pool.query("select 1")
  .then(() => {
    console.log("🟢 DB health check passed");

    // Scheduler will start when server runs
    startNewsScheduler(app.locals.db);
  })
  .catch((err) => {
    console.error("❌ DB health check failed", err);
    process.exit(1);
  });

app.get("/", (req, res) => {
  res.send("AnnoNest backend is live 🚀");
});


app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "annonest" });
});
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// 🔍 Supabase debug health check
app.get("/api/_debug/supabase", (_req, res) => {
  res.json({
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // Frontend is deployed separately (Render)
// Backend runs as API-only in production
if (process.env.NODE_ENV !== "production") {
  const { setupVite } = await import("./vite");
  await setupVite(httpServer, app);
}

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // For Autoscale deployments, PORT will be set to 80
  // For development, default to 5000 if not specified
  // This serves both the API and the client.
  const port = Number(process.env.PORT) || 5001;
  
  log(`Starting server in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
