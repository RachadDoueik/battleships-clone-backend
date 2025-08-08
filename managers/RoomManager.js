// Room management logic
class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.players = new Map();
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  // Generate unique room ID
  generateRoomId() {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  // Create a new room
  createRoom(socketId, playerName, playerId) {
    try {
      const roomId = this.generateRoomId();
      
      const room = {
        id: roomId,
        players: [
          {
            id: playerId || socketId,
            name: playerName,
            socketId: socketId,
            ready: false,
            isHost: true
          }
        ],
        status: 'waiting', // waiting, ready_to_start, in_progress, finished
        createdAt: new Date(),
        gameState: null
      };

      this.rooms.set(roomId, room);
      this.players.set(socketId, { roomId, playerName });

      console.log(`🏠 Room ${roomId} created by ${playerName}`);
      return { success: true, roomId, room };
    } catch (error) {
      console.error('Error creating room:', error);
      return { success: false, error: 'Failed to create room. Please try again.' };
    }
  }

  // Join an existing room
  joinRoom(socketId, roomId, playerName, playerId) {
    try {
      const room = this.rooms.get(roomId);
      
      if (!room) {
        return { success: false, error: 'Room not found. Please check the room ID.' };
      }

      if (room.players.length >= 2) {
        return { success: false, error: 'Room is full. Maximum 2 players allowed.' };
      }

      if (room.status === 'in_progress') {
        return { success: false, error: 'Game already in progress.' };
      }

      // Check if player name already exists in room
      const existingPlayer = room.players.find(p => p.name === playerName);
      if (existingPlayer) {
        return { success: false, error: 'A player with that name is already in the room.' };
      }

      // Add player to room
      room.players.push({
        id: playerId || socketId,
        name: playerName,
        socketId: socketId,
        ready: false,
        isHost: false
      });

      this.players.set(socketId, { roomId, playerName });

      // Check if room is full
      if (room.players.length === 2) {
        room.status = 'ready_to_start';
      }

      console.log(`🚢 ${playerName} joined room ${roomId} (${room.players.length}/2 players)`);
      return { 
        success: true, 
        room, 
        roomFull: room.players.length === 2,
        message: `Successfully joined ${roomId}!` 
      };
    } catch (error) {
      console.error('Error joining room:', error);
      return { success: false, error: 'Failed to join room. Please try again.' };
    }
  }

  // Start a game
  startGame(socketId, roomId) {
    try {
      const room = this.rooms.get(roomId);
      
      if (!room) {
        return { success: false, error: 'Room not found.' };
      }

      if (room.players.length !== 2) {
        return { success: false, error: 'Need 2 players to start game.' };
      }

      // Check if requesting player is the host
      const player = room.players.find(p => p.socketId === socketId);
      if (!player || !player.isHost) {
        return { success: false, error: 'Only the host can start the game.' };
      }

      room.status = 'in_progress';
      room.gameState = {
        currentTurn: room.players[0].id, // Host goes first
        phase: 'ship_placement', // ship_placement, battle
        startedAt: new Date()
      };

      console.log(`🎮 Game started in room ${roomId}`);
      return { 
        success: true, 
        room,
        message: 'Game started! Place your ships.' 
      };
    } catch (error) {
      console.error('Error starting game:', error);
      return { success: false, error: 'Failed to start game.' };
    }
  }

  // Update player ready status
  updatePlayerReady(socketId, ready) {
    const playerData = this.players.get(socketId);
    if (!playerData) return null;

    const room = this.rooms.get(playerData.roomId);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (player) {
      player.ready = ready;
      console.log(`${player.name} is ${ready ? 'ready' : 'not ready'} in room ${playerData.roomId}`);
      
      return {
        roomId: playerData.roomId,
        playerName: player.name,
        ready: ready,
        room: room
      };
    }
    return null;
  }

  // Remove player from all rooms
  removePlayerFromRooms(socketId) {
    const playerData = this.players.get(socketId);
    if (!playerData) return null;

    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socketId);
      
      if (playerIndex !== -1) {
        const playerName = room.players[playerIndex].name;
        room.players.splice(playerIndex, 1);
        
        // Delete room if empty
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted - no players left`);
        } else {
          room.status = 'waiting'; // Reset to waiting if someone left
        }
        
        console.log(`👋 ${playerName} left room ${roomId}`);
        this.players.delete(socketId);
        
        return {
          roomId,
          playerName,
          playersCount: room.players.length,
          room: room.players.length > 0 ? room : null
        };
      }
    }
    
    this.players.delete(socketId);
    return null;
  }

  // Leave room manually
  leaveRoom(socketId) {
    return this.removePlayerFromRooms(socketId);
  }

  // Get room statistics
  getStats() {
    return {
      rooms: this.rooms.size,
      players: this.players.size,
      activeGames: Array.from(this.rooms.values()).filter(room => room.status === 'in_progress').length
    };
  }

  // Get room by ID
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Get player data
  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  // Clean up old empty rooms
  cleanupRooms() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [roomId, room] of this.rooms.entries()) {
      const roomAge = now - room.createdAt;
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
      
      // Remove empty rooms older than 1 hour
      if (room.players.length === 0 && roomAge > oneHour) {
        this.rooms.delete(roomId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old/empty rooms`);
    }
    
    return cleanedCount;
  }

  // Start automatic cleanup interval
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupRooms();
    }, 300000); // Check every 5 minutes
  }
}

module.exports = RoomManager;
