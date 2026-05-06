// Detect if running on GitHub Pages or localhost
const socketUrl = window.location.hostname.includes('github.io') 
  ? 'http://localhost:3000' 
  : undefined;
const socket = io(socketUrl);

let currentGameId = null;
let mySymbol = null;
let myName = null;
let myTurn = false;
let cpuBoard = Array(9).fill(null);
let cpuGameOver = false;
let typingTimeout = null;

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

// ============ SCORE MANAGEMENT (PERSISTENT) ============
function getScore() {
  const saved = localStorage.getItem('xox_cpu_score');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return { wins: 0, losses: 0, draws: 0 };
}

function saveScore(score) {
  localStorage.setItem('xox_cpu_score', JSON.stringify(score));
}

function updateScoreDisplay(animate = false, type = null) {
  const score = getScore();
  const winEl = document.getElementById('winCount');
  const lossEl = document.getElementById('lossCount');
  const drawEl = document.getElementById('drawCount');

  if (winEl) winEl.textContent = score.wins;
  if (lossEl) lossEl.textContent = score.losses;
  if (drawEl) drawEl.textContent = score.draws;

  if (animate && type) {
    let target = null;
    if (type === 'win') target = winEl;
    else if (type === 'loss') target = lossEl;
    else if (type === 'draw') target = drawEl;
    if (target) {
      target.classList.remove('bump');
      void target.offsetWidth;
      target.classList.add('bump');
    }
  }
}

function incrementScore(type) {
  const score = getScore();
  if (type === 'win') score.wins++;
  else if (type === 'loss') score.losses++;
  else if (type === 'draw') score.draws++;
  saveScore(score);
  updateScoreDisplay(true, type);
}

function resetScore() {
  if (confirm('Reset all scores to 0?')) {
    saveScore({ wins: 0, losses: 0, draws: 0 });
    updateScoreDisplay();
    showToast('Score reset!');
  }
}

// ============ TOAST ============
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============ SCREEN MANAGEMENT ============
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'computerScreen') {
    updateScoreDisplay();
    startComputerGame();
  }
}

function resetToHome() {
  if (currentGameId) {
    socket.disconnect();
    setTimeout(() => socket.connect(), 100);
  }
  currentGameId = null;
  mySymbol = null;
  document.getElementById('gameLinkBox').classList.add('hidden');
  document.getElementById('chatMessages').innerHTML = '';
  showScreen('homeScreen');
}

// Auto-join from URL
window.addEventListener('load', () => {
  updateScoreDisplay();
  const params = new URLSearchParams(window.location.search);
  const gid = params.get('game');
  if (gid) {
    document.getElementById('joinGameId').value = gid.toUpperCase();
    showScreen('joinScreen');
  }
});

// ============ CREATE ============
function createGame() {
  const name = document.getElementById('createName').value.trim();
  if (!name) return showToast('Please enter your name');
  myName = name;
  socket.emit('createGame', { playerName: name });
}

socket.on('gameCreated', ({ gameId, playerSymbol }) => {
  currentGameId = gameId;
  mySymbol = playerSymbol;
  // Generate share link with correct path for GitHub Pages
  const pathname = window.location.pathname.endsWith('/') 
    ? window.location.pathname 
    : window.location.pathname + '/';
  const link = `${window.location.origin}${pathname}?game=${gameId}`;
  document.getElementById('shareLink').value = link;
  document.getElementById('gameIdDisplay').textContent = gameId;
  document.getElementById('gameLinkBox').classList.remove('hidden');
});

function copyLink() {
  const link = document.getElementById('shareLink');
  link.select();
  link.setSelectionRange(0, 99999);
  try {
    navigator.clipboard.writeText(link.value).then(() => {
      showToast('Link copied! Share with friend');
      const btn = document.getElementById('copyBtn');
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    });
  } catch (e) {
    document.execCommand('copy');
    showToast('Link copied!');
  }
}

// ============ JOIN ============
function joinGame() {
  const name = document.getElementById('joinName').value.trim();
  const gameId = document.getElementById('joinGameId').value.trim().toUpperCase();
  if (!name) return showToast('Please enter your name');
  if (!gameId) return showToast('Please enter Game ID');
  myName = name;
  socket.emit('joinGame', { gameId, playerName: name });
}

socket.on('gameJoined', ({ gameId, playerSymbol }) => {
  currentGameId = gameId;
  mySymbol = playerSymbol;
});

socket.on('errorMsg', (msg) => showToast(msg));

// ============ MULTIPLAYER GAME ============
socket.on('startGame', ({ players, board, currentTurn }) => {
  showScreen('gameScreen');
  document.getElementById('restartBtn').classList.add('hidden');

  const p1 = players[0], p2 = players[1] || { name: 'Waiting...' };
  document.getElementById('p1Name').textContent = p1.name;
  document.getElementById('p2Name').textContent = p2.name;

  renderBoard('multiBoard', board, (i) => {
    if (myTurn && board[i] === null) {
      socket.emit('makeMove', { gameId: currentGameId, index: i });
    }
  });

  updateTurn(currentTurn);
  if (players.length === 2) {
    addSystemMessage(`Game started! ${p1.name} vs ${p2.name}`);
  }
});

socket.on('updateBoard', ({ board, currentTurn }) => {
  renderBoard('multiBoard', board, (i) => {
    if (myTurn && board[i] === null) {
      socket.emit('makeMove', { gameId: currentGameId, index: i });
    }
  });
  updateTurn(currentTurn);
});

socket.on('gameOver', ({ board, winner, winnerName, loserName, line, dare }) => {
  renderBoard('multiBoard', board, () => {}, line);
  myTurn = false;
  document.getElementById('restartBtn').classList.remove('hidden');

  if (winner === 'draw') {
    document.getElementById('multiStatus').textContent = "It's a Draw";
    showDareModal('Draw!', "No winner this round", null, null);
  } else {
    document.getElementById('multiStatus').textContent = `${winnerName} Wins`;
    showDareModal(`${winnerName} Wins!`, `${loserName} lost the game`, loserName, dare);
  }
});

socket.on('playerLeft', ({ name }) => {
  addSystemMessage(`${name} left the game`);
  document.getElementById('multiStatus').textContent = 'Opponent left';
});

function updateTurn(currentTurn) {
  myTurn = (currentTurn === mySymbol);
  document.getElementById('multiStatus').textContent =
    myTurn ? "Your turn" : "Opponent's turn";
  document.getElementById('player1Card').classList.toggle('active', currentTurn === 'X');
  document.getElementById('player2Card').classList.toggle('active', currentTurn === 'O');
}

function restartMultiplayer() {
  socket.emit('restartGame', { gameId: currentGameId });
}

// ============ RENDER BOARD ============
function renderBoard(boardId, board, onClick, winLine = []) {
  const boardEl = document.getElementById(boardId);
  const existing = boardEl.querySelectorAll('.cell');
  if (existing.length !== 9) {
    boardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const div = document.createElement('div');
      div.className = 'cell';
      boardEl.appendChild(div);
    }
  }
  const cells = boardEl.querySelectorAll('.cell');
  board.forEach((cell, i) => {
    const div = cells[i];
    const wasFilled = div.classList.contains('filled');
    div.className = 'cell';
    if (cell) {
      div.classList.add('filled', cell.toLowerCase());
      div.textContent = cell;
    } else {
      div.textContent = '';
    }
    if (winLine.includes(i)) div.classList.add('win');
    div.onclick = () => onClick(i);
  });
}

// ============ CHAT ============
function handleChatKey(e) {
  if (e.key === 'Enter') sendMessage();
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg || !currentGameId) return;
  socket.emit('chatMessage', { gameId: currentGameId, message: msg, sender: myName, type: 'text' });
  input.value = '';
}

function sendSticker(sticker) {
  if (!currentGameId) return;
  socket.emit('chatMessage', { gameId: currentGameId, message: sticker, sender: myName, type: 'sticker' });
  document.getElementById('stickersBar').classList.remove('active');
}

function toggleStickers() {
  document.getElementById('stickersBar').classList.toggle('active');
}

function emitTyping() {
  if (!currentGameId) return;
  socket.emit('typing', { gameId: currentGameId, sender: myName });
}

socket.on('chatMessage', ({ message, sender, type }) => {
  const div = document.createElement('div');
  div.className = 'msg ' + (sender === myName ? 'me' : 'them') + (type === 'sticker' ? ' sticker' : '');
  if (type !== 'sticker') {
    if (sender !== myName) {
      div.innerHTML = `<div class="sender">${escapeHtml(sender)}</div>${escapeHtml(message)}`;
    } else {
      div.textContent = message;
    }
  } else {
    div.textContent = message;
  }
  const chat = document.getElementById('chatMessages');
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

socket.on('typing', () => {
  const ind = document.getElementById('typingIndicator');
  ind.classList.remove('hidden');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => ind.classList.add('hidden'), 1500);
});

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  document.getElementById('chatMessages').appendChild(div);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ============ DARE MODAL ============
function showDareModal(title, winnerText, loserName, dare) {
  document.getElementById('dareTitle').textContent = title;
  document.getElementById('dareWinner').textContent = winnerText;
  if (dare && loserName) {
    document.querySelector('.dare-box').style.display = 'block';
    document.getElementById('dareLoser').textContent = loserName.toUpperCase();
    document.getElementById('dareText').textContent = dare;
  } else {
    document.querySelector('.dare-box').style.display = 'none';
  }
  document.getElementById('dareModal').classList.remove('hidden');
}

function closeDare() {
  document.getElementById('dareModal').classList.add('hidden');
}

// ============ COMPUTER MODE ============
function startComputerGame() {
  cpuBoard = Array(9).fill(null);
  cpuGameOver = false;
  document.getElementById('cpuStatus').textContent = "Your turn";
  document.getElementById('cpuYou').classList.add('active');
  document.getElementById('cpuBot').classList.remove('active');
  renderBoard('cpuBoard', cpuBoard, cpuPlayerMove);
}

function cpuPlayerMove(i) {
  if (cpuGameOver || cpuBoard[i] !== null) return;
  cpuBoard[i] = 'X';
  renderBoard('cpuBoard', cpuBoard, cpuPlayerMove);
  let res = checkWin(cpuBoard);
  if (res) return endCpuGame(res);

  document.getElementById('cpuStatus').textContent = "Computer thinking...";
  document.getElementById('cpuYou').classList.remove('active');
  document.getElementById('cpuBot').classList.add('active');

  setTimeout(() => {
    const move = bestMove(cpuBoard);
    if (move !== -1) cpuBoard[move] = 'O';
    renderBoard('cpuBoard', cpuBoard, cpuPlayerMove);
    let r = checkWin(cpuBoard);
    if (r) return endCpuGame(r);
    document.getElementById('cpuStatus').textContent = "Your turn";
    document.getElementById('cpuYou').classList.add('active');
    document.getElementById('cpuBot').classList.remove('active');
  }, 600);
}

function endCpuGame(res) {
  cpuGameOver = true;
  renderBoard('cpuBoard', cpuBoard, () => {}, res.line || []);

  if (res.winner === 'draw') {
    incrementScore('draw');
    document.getElementById('cpuStatus').textContent = "Draw";
    showDareModal('Draw!', "No winner this round", null, null);
  } else if (res.winner === 'X') {
    incrementScore('win');
    document.getElementById('cpuStatus').textContent = "You Win!";
    const dare = dares[Math.floor(Math.random() * dares.length)];
    showDareModal('You Win!', 'Computer lost the game', 'Computer', dare);
  } else {
    incrementScore('loss');
    document.getElementById('cpuStatus').textContent = "Computer Wins";
    const dare = dares[Math.floor(Math.random() * dares.length)];
    showDareModal('Computer Wins!', 'You lost the game', 'You', dare);
  }
}

function checkWin(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b1,c] of lines) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return { winner: b[a], line: [a,b1,c] };
  }
  if (b.every(x => x !== null)) return { winner: 'draw' };
  return null;
}

function bestMove(board) {
  let bestScore = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      let score = minimax(board, 0, false);
      board[i] = null;
      if (score > bestScore) { bestScore = score; move = i; }
    }
  }
  return move;
}

function minimax(board, depth, isMax) {
  const res = checkWin(board);
  if (res) {
    if (res.winner === 'O') return 10 - depth;
    if (res.winner === 'X') return depth - 10;
    return 0;
  }
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, depth + 1, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, depth + 1, true));
        board[i] = null;
      }
    }
    return best;
  }
}