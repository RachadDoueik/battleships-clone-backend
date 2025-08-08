const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const SocketHandler = require('./handlers/SocketHandler');
require('dotenv').config();

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173", // Local development
      "http://localhost:3000", // Alternative local port
      process.env.CLIENT_URL || "https://battleships-clone-frontend.vercel.app/" // Production frontend
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize socket handler with room management
const socketHandler = new SocketHandler(io);

// API endpoints
app.get("/api/status", (req, res) => {
  const stats = socketHandler.getRoomManager().getStats();
  res.json({ 
    status: "online",
    ...stats,
    uptime: process.uptime()
  });
});

app.get("/api/rooms", (req, res) => {
  const roomManager = socketHandler.getRoomManager();
  const roomStats = roomManager.getStats();
  res.json({
    totalRooms: roomStats.rooms,
    activeGames: roomStats.activeGames,
    waitingRooms: roomStats.rooms - roomStats.activeGames
  });
});

app.get("/", (req, res) => {
  res.send("🚢 Battleships Server is running! Room-based multiplayer ready.");
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Battleships Server running on port ${PORT}`);
  console.log("🎮 Room-based multiplayer system active");
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
