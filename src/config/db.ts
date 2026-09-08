import mongoose from "mongoose";

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
