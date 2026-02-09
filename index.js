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
  // 덱이 0장인 사람들을 판별
  room.players.forEach((p) => {
    p.isEliminated = !p.myDeck || p.myDeck.length === 0;
  });

  const survivors = room.players.filter((p) => !p.isEliminated);

  // 실시간으로 플레이어 상태 업데이트 (프론트에서 [탈락] 표시용)
  io.to(room.roomId).emit("updatePlayerStatus", {
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isEliminated: p.isEliminated,
      cards: p.myDeck?.length || 0,
    })),
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

  let loopCount = 0;
  room.turnIndex = getSafeNextIndex(room);

  // 단순히 덱이 있는 다음 플레이어를 찾습니다.
  while (loopCount < room.players.length) {
    let currentPlayer = room.players[room.turnIndex];
    if (
      currentPlayer &&
      currentPlayer.myDeck &&
      currentPlayer.myDeck.length > 0
    ) {
      break;
    } else {
      // 덱이 없으면 무조건 다음 사람으로 (이미 위에서 탈락 처리가 됨)
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      loopCount++;
    }
  }

  // 생존자 확인 후 턴 알림
  const activePlayer = room.players[room.turnIndex];
  if (activePlayer) {
    io.to(room.roomId).emit("turnChanged", {
      nextTurnId: activePlayer.id,
      players: room.players.map((p) => ({
        id: p.id,
        cards: p.myDeck?.length || 0,
      })),
    });
  }
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
      p.cards = p.myDeck.length; // 💡 이 줄을 추가해서 개수를 명시적으로 저장
      p.openCard = null;
      p.openCardStack = [];
      p.isReady = false;
      p.isEliminated = false; // 시작할 때 초기화
    });

    io.to(room.roomId).emit("gameStart", {
      roomId: room.roomId,
      players: room.players,
      hostId: room.host,
    });
  });

  socket.on("flipCard", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted || room.isFlipping) return;

    room.turnIndex = getSafeNextIndex(room);
    let p = room.players[room.turnIndex];

    // 카드가 없는 사람은 이미 탈락자이므로 요청 무시
    if (!p || p.id !== socket.id || p.myDeck.length === 0) return;

    room.isFlipping = true;

    // 💡 [추가] 카드가 뒤집히는 시점의 시간을 기록 (반응 속도 측정 시작)
    room.lastFlipTime = Date.now();

    // 카드 한 장을 뒤집음
    const card = p.myDeck.pop();
    p.openCard = card;
    p.openCardStack.push(card);

    // 💡 5 완성 여부 확인
    const totals = getFruitTotals(room.players);
    const isFive = Object.values(totals).some((t) => t === 5);

    // 💡 [수정] 탈락 로직 변경
    if (p.myDeck.length === 0) {
      if (!isFive) {
        console.log(`💀 ${p.nickname} 즉시 탈락 (덱 0 & 5 아님)`);
        p.isEliminated = true;
      } else {
        console.log(`🔔 ${p.nickname} 기사회생 기회 부여 (덱 0 & 5 완성!)`);
      }
    }

    // [변경점] 카드를 뒤집은 직후 클라이언트에 알림
    io.to(room.roomId).emit("cardFlipped", {
      playerId: socket.id,
      card,
      nextTurnId: p.id,
      remainingCount: p.myDeck.length,
      isEliminated: p.isEliminated, // 💡 이 값을 반드시 포함해서 보냅니다!
    });

    if (p.isEliminated && checkGameOver(room, io)) {
      room.isFlipping = false;
      return;
    }

    // 아직 게임이 끝나지 않았다면 (3명 이상 플레이 중일 때)
    setTimeout(() => {
      if (!room || !room.isGameStarted) {
        if (room) room.isFlipping = false;
        return;
      }

      // 다음 턴으로 넘김 (탈락자는 processSkipTurn에서 자동으로 건너뜀)
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      processSkipTurn(room, io);
      room.isFlipping = false;
    }, 150);
  });

  socket.on("ringBell", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;

    const totals = getFruitTotals(room.players);
    const isFive = Object.values(totals).some((t) => t === 5);

    if (isFive) {
      // 만약 시작하자마자 종을 누르는 경우를 대비해 기본값 0 설정
      const reactionTimeMs = room.lastFlipTime
        ? Date.now() - room.lastFlipTime
        : 0;
      const reactionTimeSec = (reactionTimeMs / 1000).toFixed(2);

      // --- [성공 시나리오] ---
      let collected = [];
      room.players.forEach((p) => {
        collected = [...collected, ...p.openCardStack];
        p.openCardStack = [];
        p.openCard = null;
      });

      const winnerIdx = room.players.findIndex((p) => p.id === socket.id);
      const winner = room.players[winnerIdx];

      // 카드 획득 및 다음 턴을 승리자로 고정
      winner.myDeck = [...collected, ...winner.myDeck];
      room.turnIndex = winnerIdx;

      // 종을 뺏긴 사람들 중 카드가 0장인 사람 확인 (탈락 처리)
      room.players.forEach((p) => {
        // 1. 실제 덱 길이를 cards 속성에 반영 (이게 없어서 숫자가 리셋됨)
        p.cards = p.myDeck.length;

        // 2. 탈락 여부 체크
        /*if (p.id !== winner.id && p.cards === 0) {
          p.isEliminated = true;
        }*/
        if (p.cards === 0) {
          p.isEliminated = true;
        } else {
          // 카드가 생겼다면(승자 등) 다시 생존 처리
          p.isEliminated = false;
        }
      });

      if (checkGameOver(room, io)) return;

      io.to(room.roomId).emit("bellResult", {
        success: true,
        winnerId: socket.id,
        winnerNickname: winner.nickname,
        players: room.players,
        nextTurnId: winner.id,
        collectedCount: collected.length,
        reactionTime: reactionTimeSec, // 💡 추가: 반응 속도(초)
      });

      processSkipTurn(room, io);
    } else {
      const p = room.players.find((pl) => pl.id === socket.id);
      const others = room.players.filter(
        (pl) => pl.id !== socket.id && !pl.isEliminated
      );

      const recipients = []; // 💡 카드를 실제 받은 사람 ID를 담을 배열

      if (others.length > 0) {
        others.forEach((recipient) => {
          if (p.myDeck.length > 0) {
            const card = p.myDeck.pop();
            recipient.myDeck.unshift(card);
            recipients.push(recipient.id); // 💡 실제로 준 사람만 추가
          }
        });
      }

      // 💡 [중요 추가] 모든 플레이어의 cards 속성을 현재 덱 길이에 맞춰 갱신
      room.players.forEach((player) => {
        player.cards = player.myDeck.length;
        if (player.cards === 0) {
          player.isEliminated = true;
        }
      });

      // 벌칙 후 본인 덱이 0장이면 즉시 탈락 및 게임 종료 체크
      if (p.myDeck.length === 0) {
        p.isEliminated = true;

        if (checkGameOver(room, io)) return;

        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: `${p.nickname}님 카드 소진으로 탈락!`,
          players: room.players,
        });
      } else {
        // 카드가 남은 경우 일반 벌칙 알림
        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: `${p.nickname}님 벌칙! 한 장씩 배분`,
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
