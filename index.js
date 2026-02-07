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

// HTTP 요청용 CORS
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
    allowedHeaders: ["Content-Type"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// 정적 파일 설정
const staticDir = path.join(__dirname, "public");
app.use(express.static(staticDir));

// ============================================
// 2. Socket.IO 설정 (CORS 설정을 함수와 동기화)
// ============================================
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(), // '*' 대신 실제 허용 리스트 사용 권장
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"], // 💡 이 줄을 추가하세요!
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
    const hasDeck = p.myDeck.length > 0;
    const hasChance = p.openCardStack && p.openCardStack.length > 0;
    return hasDeck || hasChance;
  });

  if (survivors.length <= 1) {
    room.isGameStarted = false;
    const winner = survivors.length === 1 ? survivors[0] : room.players[0];
    const sorted = [...room.players].sort(
      (a, b) => b.myDeck.length - a.myDeck.length
    );

    io.to(room.roomId).emit("gameEnded", {
      message: `게임 종료! ${winner.nickname}님의 최종 승리!`,
      ranking: sorted.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        cards: p.myDeck.length,
      })),
      winner: winner.nickname,
    });
    return true;
  }
  return false;
}

function getSafeNextIndex(room) {
  if (typeof room.turnIndex !== "number" || isNaN(room.turnIndex)) return 0;
  return room.turnIndex % room.players.length;
}

/**
 * 💡 핵심: 자동 턴 넘김 및 기사회생 실패 처리
 */
function processSkipTurn(room, io) {
  if (!room.isGameStarted) return;

  // 1. 바닥에 5가 만들어졌는지 확인
  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);

  // 💡 [룰 적용] 바닥이 5라면, 0장인 사람도 종을 쳐야 하므로 턴을 넘기지 않고 중단
  if (isFive) {
    console.log("🔔 바닥이 5입니다. 기사회생을 위해 탈락 처리를 유예합니다.");
    // 클라이언트에게 현재 턴이 유지됨을 다시 확인시켜줌
    io.to(room.roomId).emit("turnChanged", {
      nextTurnId: room.players[room.turnIndex].id,
      isWaitMode: true, // 5인 상황임을 알림 (선택사항)
    });
    return;
  }

  // 2. 5가 아니라면, 현재 turnIndex부터 시작해서 0장인 유저들을 소멸시킴
  let loopCount = 0;
  while (loopCount < room.players.length) {
    let currentPlayer = room.players[room.turnIndex];

    if (currentPlayer.myDeck.length > 0) {
      // 카드가 있는 사람을 찾았으면 중단
      break;
    } else {
      // 💡 덱이 0장인데 바닥이 5도 아니므로 이제 진짜 탈락
      console.log(`💀 [탈락] ${currentPlayer.nickname} 기사회생 실패`);
      currentPlayer.openCard = null;
      currentPlayer.openCardStack = [];

      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      loopCount++;

      if (checkGameOver(room, io)) return;
    }
  }

  // 3. 최종 결정된 유효한 플레이어에게 턴 전송
  if (room.isGameStarted) {
    io.to(room.roomId).emit("turnChanged", {
      nextTurnId: room.players[room.turnIndex].id,
      players: room.players.map((p) => ({ id: p.id, cards: p.myDeck.length })),
    });
  }
}

// 2. 소켓 로직
io.on("connection", (socket) => {
  // ... (setNickname, createRoom, toggleReady, joinRoom, startGameRequest 로직은 기존과 동일) ...

  socket.on("flipCard", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;

    room.turnIndex = getSafeNextIndex(room);
    let currentPlayer = room.players[room.turnIndex];

    if (currentPlayer.id !== socket.id) return;
    if (currentPlayer.myDeck.length === 0) return; // 0장인 유저는 클릭 불가

    // 1. 카드 뒤집기
    const card = currentPlayer.myDeck.pop();
    currentPlayer.openCardStack = currentPlayer.openCardStack || [];
    currentPlayer.openCardStack.push(card);
    currentPlayer.openCard = card;

    // 2. 클라이언트에 알림 (애니메이션 시작)
    io.to(room.roomId).emit("cardFlipped", {
      playerId: socket.id,
      card: card,
      nextTurnId: room.players[room.turnIndex].id, // 아직 넘기기 전 ID 전송
      remainingCount: currentPlayer.myDeck.length,
    });

    // 3. 💡 [수정] 0.8초 연출 뒤에 인덱스를 올리고 Skip 여부 판단
    setTimeout(() => {
      if (!room || !room.isGameStarted) return;

      // 일단 인덱스 하나 올림
      room.turnIndex = (room.turnIndex + 1) % room.players.length;

      // 이제 여기서 5 여부에 따라 A를 탈락시킬지, 기다릴지 결정함
      processSkipTurn(room, io);
    }, 800);
  });

  socket.on("ringBell", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;

    const totals = getFruitTotals(room.players);
    const isSuccess = Object.values(totals).some((t) => t === 5);

    if (isSuccess) {
      let collectedCards = [];
      room.players.forEach((p) => {
        if (p.openCardStack && p.openCardStack.length > 0) {
          collectedCards = [...collectedCards, ...p.openCardStack];
          p.openCardStack = [];
          p.openCard = null;
        }
      });
      const winner = room.players.find((p) => p.id === socket.id);
      winner.myDeck = [...collectedCards, ...winner.myDeck];

      if (checkGameOver(room, io)) return;

      io.to(room.roomId).emit("bellResult", {
        success: true,
        winnerId: socket.id,
        winnerNickname: winner.nickname,
        players: room.players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          cards: p.myDeck.length,
          openCard: p.openCard,
        })),
      });

      // 💡 종을 쳐서 바닥이 비워졌으므로(5가 아니게 됨), 다시 턴 검사 실행
      processSkipTurn(room, io);
    } else {
      // --- 실패: 벌칙 로직 ---
      const penaltyPlayer = room.players.find((p) => p.id === socket.id);
      const penaltyIdx = room.players.findIndex((p) => p.id === socket.id);
      const otherPlayersSorted = [
        ...room.players.slice(penaltyIdx + 1),
        ...room.players.slice(0, penaltyIdx),
      ];

      const requiredCards = otherPlayersSorted.length;
      const isShortage = penaltyPlayer.myDeck.length < requiredCards;

      for (let i = 0; i < otherPlayersSorted.length; i++) {
        if (penaltyPlayer.myDeck.length > 0) {
          otherPlayersSorted[i].myDeck.unshift(penaltyPlayer.myDeck.pop());
        }
      }

      if (isShortage) {
        penaltyPlayer.myDeck = [];
        if (checkGameOver(room, io)) return;
        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: `${penaltyPlayer.nickname}님 실격! (벌칙 카드 부족)`,
          players: room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            cards: p.myDeck.length,
            openCard: p.openCard,
          })),
        });
      } else {
        if (checkGameOver(room, io)) return;
        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: `${penaltyPlayer.nickname}님의 실수! 카드 1장씩 나눔`,
          players: room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            cards: p.myDeck.length,
            openCard: p.openCard,
          })),
        });
      }
      // 벌칙 후에도 턴 상태가 변했을 수 있으므로 체크
      processSkipTurn(room, io);
    }
  });

  // ... (나머지 disconnect 등은 기존과 동일) ...
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
