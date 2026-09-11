import dns from "node:dns";
import mongoose from "mongoose";

// Fix Node.js querySrv ECONNREFUSED on Windows/ISPs for MongoDB Atlas SRV records
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if not supported in environment
}

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/trao_ai";

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[database] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("[database] MongoDB connection error:", error);
    console.warn(
      "[database] Ensure your MongoDB server is running or update MONGODB_URI in your .env file."
    );
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("[database] MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("[database] MongoDB reconnected");
});
