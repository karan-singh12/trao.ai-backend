import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { successResponse } from "./utils/apiResponse";

export const createApp = (): Application => {
  const app = express();

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
