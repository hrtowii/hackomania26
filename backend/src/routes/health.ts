import { Elysia } from "elysia";
import { HealthResponse } from "../types";

const START_TIME = Date.now();
const VERSION = "0.1.0";

export const healthRoute = new Elysia().get(
  "/health",
  (): typeof HealthResponse.static => ({
    status: "ok",
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    version: VERSION,
  }),
  {
    response: HealthResponse,
    detail: {
      summary: "Health check",
      tags: ["Utility"],
    },
  }
);
