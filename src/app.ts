import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

export const createApp = (): Application => {
  const app = express();

  // Security & Utility Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      name: "Trao.ai Backend API",
      status: "online",
      version: "1.0.0",
      docs: "/api/health",
    });
  });

  // API Routes
  app.use("/api", routes);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
