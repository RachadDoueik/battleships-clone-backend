const RoomManager = require('../managers/RoomManager');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.roomManager = new RoomManager(io);
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on("connection", (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // Handle room creation
      socket.on('create-room', (data) => {
        const { playerName, playerId } = data;
        const result = this.roomManager.createRoom(socket.id, playerName, playerId);
        
        if (result.success) {
          socket.join(result.roomId);
          socket.emit('room-created', {
            roomId: result.roomId,
            room: result.room
          });
        } else {
          socket.emit('room-creation-error', result.error);
        }
      });

      // Handle joining room
      socket.on('join-room', (data) => {
        const { roomId, playerName, playerId } = data;
        const result = this.roomManager.joinRoom(socket.id, roomId, playerName, playerId);
        
        if (result.success) {
          socket.join(roomId);
          
          // Notify the joining player
          socket.emit('room-joined', { 
            roomId, 
            room: result.room,
            message: result.message 
          });
          
          // Notify existing players
          socket.to(roomId).emit('player-joined', {
            playerName: playerName,
            playersCount: result.room.players.length,
            room: result.room
          });

          // If room is full, notify all players
          if (result.roomFull) {
            this.io.to(roomId).emit('room-ready', { 
              room: result.room,
              message: 'Room is full! Game can start.' 
            });
          }
        } else {
          socket.emit('join-room-error', result.error);
        }
      });

      // Handle game start
      socket.on('start-game', (data) => {
        const { roomId } = data;
        const result = this.roomManager.startGame(socket.id, roomId);
        
        if (result.success) {
          this.io.to(roomId).emit('game-started', { 
            room: result.room,
            message: result.message 
          });
        } else {
          socket.emit('error', result.error);
        }
      });

      // Handle player ready status
      socket.on('player-ready', (data) => {
        const result = this.roomManager.updatePlayerReady(socket.id, data.ready);
        
        if (result) {
          this.io.to(result.roomId).emit('player-status-updated', {
            playerName: result.playerName,
            ready: result.ready,
            room: result.room
          });
        }
      });

      // Handle leaving room manually
      socket.on('leave-room', () => {
        const result = this.roomManager.leaveRoom(socket.id);
        
        if (result) {
          socket.leave(result.roomId);
          socket.emit('left-room');
          
          if (result.room) {
            // Notify remaining players
            this.io.to(result.roomId).emit('player-left', {
              playerName: result.playerName,
              playersCount: result.playersCount,
              room: result.room
            });
          }
        }
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
        
        const result = this.roomManager.removePlayerFromRooms(socket.id);
        
        if (result && result.room) {
          // Notify remaining players
          this.io.to(result.roomId).emit('player-left', {
            playerName: result.playerName,
            playersCount: result.playersCount,
            room: result.room
          });
        }
      });
    });
  }

  // Get room manager for external access
  getRoomManager() {
    return this.roomManager;
  }
}

module.exports = SocketHandler;
