const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// 1. CORS 설정
function getAllowedOrigins() {
  return [
    "https://skewer-master.apps.tossmini.com",
    "https://skewer-master.private-apps.tossmini.com",
    "http://10.68.14.196:5173",
    "http://localhost:5173",
    "http://0.0.0.0:5173",
    "http://0.0.0.0:3000",
    "http://192.168.10.113:3000",
    "http://192.168.10.113:5173",
    "http://localhost:3000",
  ];
}

app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
app.use(express.static(path.join(__dirname, "public")));

const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
});

let rooms = {};

// 헬스체크
app.get("/", (req, res) => res.status(200).send("서버 가동 중"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// --- 공통 유틸리티 함수 ---

function getFruitTotals(players) {
  let totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  players.forEach((p) => {
    if (p.openCard) totals[p.openCard.fruit] += p.openCard.count;
  });
  return totals;
}

function checkGameOver(room, io) {
  const survivors = room.players.filter((p) => {
    const hasDeck = p.myDeck && p.myDeck.length > 0;
    const hasChance = p.openCardStack && p.openCardStack.length > 0;
    return hasDeck || hasChance;
  });

  if (survivors.length <= 1 && room.isGameStarted) {
    room.isGameStarted = false;
    const winner = survivors.length === 1 ? survivors[0] : room.players[0];
    const sorted = [...room.players].sort(
      (a, b) => (b.myDeck?.length || 0) - (a.myDeck?.length || 0)
    );

    io.to(room.roomId).emit("gameEnded", {
      message: `게임 종료! ${winner.nickname}님의 최종 승리!`,
      ranking: sorted.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        cards: p.myDeck?.length || 0,
      })),
      winner: winner.nickname,
    });
    return true;
  }
  return false;
}

function getSafeNextIndex(room) {
  if (
    typeof room.turnIndex !== "number" ||
    isNaN(room.turnIndex) ||
    room.players.length === 0
  )
    return 0;
  return room.turnIndex % room.players.length;
}

function processSkipTurn(room, io) {
  if (!room.isGameStarted) return;

  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);

  if (isFive) {
    console.log("🔔 바닥이 5입니다. 0장 유저의 기사회생을 기다립니다.");
    // 5인 상태를 유지하며 턴을 넘기지 않음
    return;
  }

  let loopCount = 0;
  room.turnIndex = getSafeNextIndex(room);

  while (loopCount < room.players.length) {
    let currentPlayer = room.players[room.turnIndex];
    if (
      currentPlayer &&
      currentPlayer.myDeck &&
      currentPlayer.myDeck.length > 0
    ) {
      break; // 카드가 있는 사람 발견!
    } else if (currentPlayer) {
      // 0장인데 바닥이 5도 아니니 탈락 처리
      currentPlayer.openCard = null;
      currentPlayer.openCardStack = [];
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      loopCount++;
      if (checkGameOver(room, io)) return;
    }
  }

  // 최종 확정된 다음 턴 정보를 모든 클라이언트에 강제 동기화
  io.to(room.roomId).emit("turnChanged", {
    nextTurnId: room.players[room.turnIndex].id,
    players: room.players.map((p) => ({
      id: p.id,
      cards: p.myDeck?.length || 0,
    })),
  });
}

// 2. 소켓 로직
io.on("connection", (socket) => {
  socket.on("setNickname", (nickname) => {
    socket.nickname = nickname || "요리사" + Math.floor(Math.random() * 1000);
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const player = room.players.find((p) => p.id === socket.id);
      if (player) {
        player.nickname = socket.nickname;
        io.to(socket.roomId).emit("playerJoined", {
          roomId: socket.roomId,
          players: room.players,
          hostId: room.host,
          max: room.maxPlayers,
        });
      }
    }
  });

  socket.on("createRoom", (data) => {
    const nickname = typeof data === "object" ? data.nickname : socket.nickname;
    socket.nickname = nickname || "요리사";
    let roomId = Math.floor(1000 + Math.random() * 9000).toString();
    while (rooms[roomId])
      roomId = Math.floor(1000 + Math.random() * 9000).toString();

    rooms[roomId] = {
      roomId,
      host: socket.id,
      players: [],
      maxPlayers: data.maxPlayers || 4,
      isGameStarted: false,
    };
    rooms[roomId].players.push({
      id: socket.id,
      nickname: socket.nickname,
      myDeck: [],
      openCard: null,
      openCardStack: [],
      isReady: false,
    });

    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit("roomCreated", {
      roomId,
      players: rooms[roomId].players,
      hostId: socket.id,
      max: rooms[roomId].maxPlayers,
    });
  });

  socket.on("joinRoom", (data) => {
    const roomId = (
      typeof data === "object" ? data.roomId : data
    ).toUpperCase();
    const nickname =
      (typeof data === "object" ? data.nickname : socket.nickname) || "요리사";
    const room = rooms[roomId];

    if (!room) return socket.emit("joinRoomError", "방이 존재하지 않습니다.");
    if (room.players.length >= room.maxPlayers)
      return socket.emit("joinRoomError", "인원 초과");
    if (room.isGameStarted)
      return socket.emit("joinRoomError", "이미 시작된 게임");

    socket.join(roomId);
    socket.roomId = roomId;
    socket.nickname = nickname;
    if (!room.players.find((p) => p.id === socket.id)) {
      room.players.push({
        id: socket.id,
        nickname,
        myDeck: [],
        openCard: null,
        openCardStack: [],
        isReady: false,
      });
    }
    io.to(roomId).emit("playerJoined", {
      roomId,
      players: room.players,
      hostId: room.host,
      max: room.maxPlayers,
    });
  });

  socket.on("toggleReady", () => {
    const room = rooms[socket.roomId];
    if (!room || room.host === socket.id) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      io.to(socket.roomId).emit("readyStatusUpdated", {
        players: room.players,
        hostId: room.host,
      });
    }
  });

  socket.on("startGameRequest", () => {
    const room = rooms[socket.roomId];
    if (!room || room.host !== socket.id || room.players.length < 2) return;
    if (!room.players.filter((p) => p.id !== room.host).every((p) => p.isReady))
      return;

    let deck = [];
    [1, 2, 3, 4].forEach((f) =>
      [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5].forEach((c) =>
        deck.push({ fruit: f, count: c })
      )
    );
    deck.sort(() => Math.random() - 0.5);

    room.isGameStarted = true;
    room.turnIndex = 0;
    const total = room.players.length;
    // 테스트를 위해 덱 크기 조절 가능 (실제 운영 시 deck 사용)
    const gameDeck = deck.slice(0, total * 5);

    room.players.forEach((p, idx) => {
      p.myDeck = gameDeck.filter((_, i) => i % total === idx);
      p.openCard = null;
      p.openCardStack = [];
      p.isReady = false;
    });

    io.to(room.roomId).emit("gameStart", {
      roomId: room.roomId,
      players: room.players,
      hostId: room.host,
    });
  });

  // index.js 수정 핵심

  socket.on("flipCard", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;

    // 💡 [추가] 중복 클릭 방지 잠금
    if (room.isFlipping) return;

    room.turnIndex = getSafeNextIndex(room);
    let p = room.players[room.turnIndex];

    // 💡 [검증] 실제 자기 차례가 맞는지 ID로 확인
    if (p.id !== socket.id || p.myDeck.length === 0) return;

    // 잠금 시작
    room.isFlipping = true;

    const card = p.myDeck.pop();
    p.openCard = card;
    p.openCardStack.push(card);

    io.to(room.roomId).emit("cardFlipped", {
      playerId: socket.id,
      card,
      nextTurnId: p.id, // 연출 중에는 현재 ID 유지
      remainingCount: p.myDeck.length,
    });

    // 0.8초 연출 뒤 다음 턴 결정
    setTimeout(() => {
      if (!room.isGameStarted) {
        room.isFlipping = false;
        return;
      }

      // 인덱스 이동 및 자동 스킵 처리
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      processSkipTurn(room, io);

      // 잠금 해제
      room.isFlipping = false;
    }, 800);
  });

  socket.on("ringBell", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;
    const isSuccess = Object.values(getFruitTotals(room.players)).some(
      (t) => t === 5
    );

    if (isSuccess) {
      let collected = [];
      room.players.forEach((p) => {
        collected = [...collected, ...p.openCardStack];
        p.openCardStack = [];
        p.openCard = null;
      });
      const winner = room.players.find((p) => p.id === socket.id);
      winner.myDeck = [...collected, ...winner.myDeck];
      if (checkGameOver(room, io)) return;
      io.to(room.roomId).emit("bellResult", {
        success: true,
        winnerId: socket.id,
        winnerNickname: winner.nickname,
        players: room.players,
      });
      processSkipTurn(room, io);
    } else {
      const p = room.players.find((p) => p.id === socket.id);
      const others = room.players.filter((pl) => pl.id !== socket.id);
      if (p.myDeck.length < others.length) {
        others.forEach((o) => {
          if (p.myDeck.length > 0) o.myDeck.unshift(p.myDeck.pop());
        });
        p.myDeck = [];
        if (checkGameOver(room, io)) return;
        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: "실격!",
          players: room.players,
        });
      } else {
        others.forEach((o) => o.myDeck.unshift(p.myDeck.pop()));
        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: "벌칙!",
          players: room.players,
        });
      }
      processSkipTurn(room, io);
    }
  });

  socket.on("disconnect", () => {
    const room = rooms[socket.roomId];
    if (room) {
      room.players = room.players.filter((p) => p.id !== socket.id);
      if (room.players.length === 0) delete rooms[socket.roomId];
      else {
        if (room.host === socket.id) room.host = room.players[0].id;
        io.to(socket.roomId).emit("playerLeft", {
          players: room.players,
          hostId: room.host,
        });
        if (room.isGameStarted) processSkipTurn(room, io);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => console.log(`Server on ${PORT}`));
