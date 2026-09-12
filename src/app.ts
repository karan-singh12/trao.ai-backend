import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { successResponse } from "./utils/apiResponse";

export const createApp = (): Application => {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const rawOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  const configuredOrigins = rawOrigin
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        const cleanOrigin = origin.replace(/\/$/, "");
        const isAllowed =
          configuredOrigins.includes(cleanOrigin) ||
          cleanOrigin.endsWith(".vercel.app") ||
          cleanOrigin.includes("localhost") ||
          cleanOrigin.includes("127.0.0.1");

        if (isAllowed) {
          return callback(null, cleanOrigin);
        }
        return callback(null, cleanOrigin);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.get("/", (req, res) => {
    return successResponse(res, "Trao.ai Backend API", {
      status: "online",
      version: "1.0.0",
      docs: "/api/health",
    });
  });

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
