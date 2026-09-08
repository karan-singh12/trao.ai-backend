import dotenv from "dotenv";
dotenv.config();

import http from "http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { connectDB } from "./config/db";

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  // Connect to MongoDB
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[server] Server listening on http://localhost:${PORT}`);
    console.log(`[server] Health check available at http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[server] Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log("[server] HTTP server closed.");

      try {
        await mongoose.connection.close();
        console.log("[database] MongoDB connection closed.");
        process.exit(0);
      } catch (err) {
        console.error("[database] Error closing MongoDB connection:", err);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
};

startServer().catch((error) => {
  console.error("[server] Failed to start server:", error);
  process.exit(1);
});
