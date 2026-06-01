import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import leadRoutes from "./routes/leads";
import studentRoutes from "./routes/students";
import documentRoutes from "./routes/documents";
import applicationRoutes from "./routes/applications";
import visaRoutes from "./routes/visas";
import paymentRoutes from "./routes/payments";
import messageRoutes from "./routes/messages";
import notificationRoutes from "./routes/notifications";
import dashboardRoutes from "./routes/dashboard";
import { setupSocket } from "./socket";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_CRM_URL || "",
      process.env.CLIENT_STUDENT_URL || "",
    ],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: [
      process.env.CLIENT_CRM_URL || "",
      process.env.CLIENT_STUDENT_URL || "",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Ensure uploads dir exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded files
app.use("/uploads", express.static(uploadsDir));

// Connect DB
connectDB();

// Socket.io
setupSocket(io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/visas", visaRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`StudyCRM backend running on port ${PORT}`),
);

export { io };
