import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { authRoutes } from "./routes/auth.js";
import { pageRoutes } from "./routes/pages.js";
import { blockRoutes } from "./routes/blocks.js";
import { databaseRoutes } from "./routes/databases.js";
import { existsSync } from "fs";
import { resolve } from "path";

const app = new Hono();

app.use(logger());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin) => {
      if (!origin) return origin; // allow non-browser requests (curl, etc.)
      if (allowedOrigins.includes(origin)) return origin;
      return null;
    },
    credentials: true,
  })
);

const api = app
  .basePath("/api")
  .route("/auth", authRoutes)
  .route("/pages", pageRoutes)
  .route("/blocks", blockRoutes)
  .route("/databases", databaseRoutes);

// In production, serve the built frontend
const staticDir = resolve(import.meta.dir, "../../web/dist");
if (existsSync(staticDir)) {
  app.use(
    "/*",
    serveStatic({
      root: staticDir,
      rewriteRequestPath: (path) => path,
    })
  );
  // SPA fallback: serve index.html for non-API, non-file routes
  app.get("/*", async (c) => {
    const file = Bun.file(resolve(staticDir, "index.html"));
    return new Response(file, {
      headers: { "Content-Type": "text/html" },
    });
  });
}

export type AppType = typeof api;

const port = Number(process.env.PORT) || 3000;

export default {
  hostname: "0.0.0.0",
  port,
  fetch: app.fetch,
};

console.log(`Server running on http://0.0.0.0:${port}`);
