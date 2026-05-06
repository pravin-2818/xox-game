const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const games = {};

const dares = [
  "Video call me and do your best dance.",
  "Kiss your opponent person",
  "Propose your opponent person",
  "Tell your most embarrassing story",
  "Send me a screenshot of your last text conversation.",
  "Text opponent person 'Will you marry me?'",
  "Prank call your friend and keep me on the line",
  "Sing your favorite song",
  "What's your phone's lock screen?",
  "Post a TikTok doing a silly dance.",
  "What's your biggest secret?",
  "Set your alarm for 1:11 AM",
  "Write a funny word on your forehead.",
  "What's your worst habit?",
  "Don't use your favorite app for 1 day",
  "Set your WhatsApp status to 'I am looking for a monkey to adopt.'",
  "Stand in front of a mirror with a serious face for 1 minute (don't laugh).",
  "Imitate your favorite hero/celebrity.",
  "Say a random dialogue like a movie scene.",
  "Say a tongue twister 5 times fast.",
  "Dance for 1 minute and send the video.",
  "Tell a funny incident from your childhood.",
  "Imitate 5 animal sounds.",
  "Write a message in your handwriting and send a photo of it.",
  "Create and tell a fake news story (just for fun).",
  "Talk romantically with the opponent for 1 minute."
];

function generateGameId() {
  let id;
  do {
    id = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (games[id]);
  return id;
}

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  if (board.every(cell => cell !== null)) return { winner: 'draw' };
  return null;
}

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('createGame', ({ playerName }) => {
    const gameId = generateGameId();
    games[gameId] = {
      id: gameId,
      players: [{ id: socket.id, name: playerName, symbol: 'X' }],
      board: Array(9).fill(null),
      currentTurn: 'X',
      status: 'waiting'
    };
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerSymbol: 'X', playerName });
    console.log(`🎮 Game created: ${gameId} by ${playerName}`);
  });

  socket.on('joinGame', ({ gameId, playerName }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit('errorMsg', 'Game not found! Check the Game ID.');
      return;
    }
    if (game.players.length >= 2) {
      socket.emit('errorMsg', 'Game is full!');
      return;
    }
    if (game.players.some(p => p.name === playerName)) {
      socket.emit('errorMsg', 'Name already taken in this game!');
      return;
    }
    game.players.push({ id: socket.id, name: playerName, symbol: 'O' });
    game.status = 'playing';
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, playerSymbol: 'O', playerName });
    io.to(gameId).emit('startGame', {
      players: game.players,
      board: game.board,
      currentTurn: game.currentTurn
    });
    console.log(`👥 ${playerName} joined game ${gameId}`);
  });

  socket.on('makeMove', ({ gameId, index }) => {
    const game = games[gameId];
    if (!game || game.status !== 'playing') return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player || player.symbol !== game.currentTurn) return;
    if (game.board[index] !== null) return;

    game.board[index] = player.symbol;
    const result = checkWinner(game.board);

    if (result) {
      game.status = 'ended';
      let loser = null;
      if (result.winner !== 'draw') {
        loser = game.players.find(p => p.symbol !== result.winner);
      }
      const dare = dares[Math.floor(Math.random() * dares.length)];
      io.to(gameId).emit('gameOver', {
        board: game.board,
        winner: result.winner,
        winnerName: result.winner !== 'draw' ? game.players.find(p => p.symbol === result.winner).name : null,
        loserName: loser ? loser.name : null,
        line: result.line || [],
        dare: result.winner !== 'draw' ? dare : null
      });
    } else {
      game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';
      io.to(gameId).emit('updateBoard', {
        board: game.board,
        currentTurn: game.currentTurn
      });
    }
  });

  socket.on('restartGame', ({ gameId }) => {
    const game = games[gameId];
    if (!game) return;
    game.board = Array(9).fill(null);
    game.currentTurn = 'X';
    game.status = 'playing';
    io.to(gameId).emit('startGame', {
      players: game.players,
      board: game.board,
      currentTurn: game.currentTurn
    });
  });

  socket.on('chatMessage', ({ gameId, message, sender, type }) => {
    io.to(gameId).emit('chatMessage', { message, sender, type });
  });

  socket.on('typing', ({ gameId, sender }) => {
    socket.to(gameId).emit('typing', { sender });
  });

  socket.on('disconnect', () => {
    for (const gameId in games) {
      const game = games[gameId];
      const idx = game.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        io.to(gameId).emit('playerLeft', { name: game.players[idx].name });
        delete games[gameId];
        console.log(`❌ Player disconnected from ${gameId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 XOX Game Server running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});