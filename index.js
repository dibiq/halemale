/**
 * Google Cloud Run 용 진입점
 * - PORT: Cloud Run이 주입 (기본 8080)
 * - 0.0.0.0 바인딩으로 컨테이너 내부 수신
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// ============================================
// 1. CORS 설정 (반드시 라우트 및 소켓 설정보다 위에 위치)
// ============================================
function getAllowedOrigins() {
  return [
    "https://skewer-master.apps.tossmini.com",
    "https://skewer-master.private-apps.tossmini.com",
    "http://10.68.14.196:5173",
    "http://localhost:5173",
    "http://0.0.0.0:5173", // 추가
    "http://0.0.0.0:3000", // 추가
    "http://192.168.10.113:3000", // 로컬 테스트용
    "http://192.168.10.113:5173", // 로컬 테스트용
    "http://localhost:3000", // 추가적인 로컬 테스트용
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

// ============================================
// 3. HTTP 라우트 (헬스체크)
// ============================================
app.get("/", (req, res) => {
  res.status(200).send("서버가 정상적으로 살아있습니다! 할래말래 화이팅!");
});

// 헬스체크용 (Cloud Run 권장)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
// 서버 상단에 추가

function checkGameOver(room, io) {
  // 💡 생존자: 덱이 있거나, 아직 자기 턴이 안 와서 기회가 남은(0장이지만 바닥카드가 있는) 사람
  const survivors = room.players.filter((p) => {
    const hasDeck = p.myDeck.length > 0;
    const hasChance = p.openCardStack && p.openCardStack.length > 0;
    return hasDeck || hasChance;
  });

  if (survivors.length === 1) {
    room.isGameStarted = false;
    const winner = survivors[0];
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
// ============================================
// 4. 소켓 로직 (변경 없음)
// ============================================
io.on("connection", (socket) => {
  console.log(`사용자 접속: ${socket.id}`);

  socket.on("setNickname", (nickname) => {
    const oldNickname = socket.nickname;
    socket.nickname = nickname || "요리사" + Math.floor(Math.random() * 1000);

    // 💡 [핵심 추가] 만약 유저가 이미 방에 있다면, 방 명단에서도 닉네임을 바꿔줘야 함!
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const player = room.players.find((p) => p.id === socket.id);
      if (player) {
        player.nickname = socket.nickname; // 방 명단 데이터 동기화

        // 방에 있는 사람들에게 이름이 변경되었음을 알림 (또는 전체 명단 전송)
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
    if (socket.roomId && rooms[socket.roomId]) {
      return socket.emit("error", "이미 방에 참여 중입니다.");
    }

    // data가 객체일 경우를 대비
    const nickname = typeof data === "object" ? data.nickname : socket.nickname;
    socket.nickname = nickname || "요리사";

    function generateRoomId() {
      // 1000 ~ 9999 사이의 랜덤 숫자 생성
      return Math.floor(1000 + Math.random() * 9000).toString();
    }
    let roomId = generateRoomId();

    // const 대신 let을 사용해야 루프 안에서 재할당이 가능합니다.

    // 중복 방지: 이미 존재하는 방 번호라면 다시 생성
    while (rooms[roomId]) {
      roomId = generateRoomId();
    }

    rooms[roomId] = {
      roomId: roomId, // ⭐ 추가
      host: socket.id,
      players: [],
      maxPlayers: data.maxPlayers || 4,
      isGameStarted: false, // ⭐ 추가
    };

    // 방장 본인을 방에 추가 (이때 nickname이 undefined면 안 됨!)
    const hostPlayer = {
      id: socket.id,
      nickname,
      myDeck: [], // 카드 더미
      openCard: null, // 현재 공개된 카드
      isReady: false,
    };
    rooms[roomId].players.push(hostPlayer);

    socket.join(roomId);
    socket.roomId = roomId;

    socket.emit("roomCreated", {
      roomId: roomId,
      players: rooms[roomId].players,
      hostId: socket.id,
      max: rooms[roomId].maxPlayers,
    });
  });

  socket.on("toggleReady", () => {
    const room = rooms[socket.roomId];
    if (!room) return;

    // ❌ 방장은 준비 불가
    if (room.host === socket.id) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    player.isReady = !player.isReady;

    io.to(socket.roomId).emit("readyStatusUpdated", {
      roomId: socket.roomId,
      players: room.players,
      hostId: room.host,
      max: room.maxPlayers,
    });
  });

  // 서버 index.js (또는 socket logic 부분)
  socket.on("joinRoom", (data) => {
    let roomId, nickname;

    if (typeof data === "object") {
      // 객체로 들어온 경우 { roomId: "...", nickname: "..." }
      roomId = data.roomId;
      nickname = data.nickname;
    } else {
      // 기존처럼 문자열만 들어온 경우
      roomId = data;
      nickname = socket.nickname; // 소켓에 저장된 거 사용
    }

    if (roomId) {
      // 💡 중요: 닉네임을 소켓에 즉시 갱신
      socket.nickname = nickname || socket.nickname || "요리사";
      joinRoomLogic(socket, roomId.toUpperCase(), socket.nickname);
    }
  });

  function joinRoomLogic(socket, roomId, nickname) {
    // 🔒 기존 방에서 나가기
    if (socket.roomId && socket.roomId !== roomId) {
      socket.leave(socket.roomId);
    }

    const room = rooms[roomId];
    if (!room) {
      return socket.emit("joinRoomError", "방이 존재하지 않습니다.");
    }

    // 🚩 [추가] 인원수 체크: 현재 인원이 최대 인원보다 같거나 많으면 거부
    if (room.players.length >= room.maxPlayers) {
      return socket.emit("joinRoomError", "방이 꽉 찼습니다! (인원 초과)");
    }

    // 🚩 [추가] 게임 진행 여부 체크 (게임 중에는 못 들어가게 하려면)
    if (room.isGameStarted) {
      return socket.emit("joinRoomError", "이미 게임이 시작된 방입니다.");
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.nickname = nickname;

    // 🔥 socket.id 기준으로만 관리
    const exists = room.players.find((p) => p.id === socket.id);
    if (!exists) {
      room.players.push({
        id: socket.id,
        nickname,
        myDeck: [], // 추가
        openCard: null, // 추가
        isReady: false,
      });
    }

    // 방장 보정
    if (!room.host || !room.players.find((p) => p.id === room.host)) {
      room.host = room.players[0].id;
    }

    io.to(roomId).emit("playerJoined", {
      roomId: roomId,
      players: room.players,
      hostId: room.host,
      max: room.maxPlayers,
    });
  }

  socket.on("startGameRequest", () => {
    const room = rooms[socket.roomId];
    if (!room || room.host !== socket.id) return;

    const guests = room.players.filter((p) => p.id !== room.host);
    if (guests.length === 0) {
      return socket.emit("startBlocked", "최소 2명이 필요합니다!");
    }

    const allReady = guests.every((p) => p.isReady);
    if (!allReady) {
      return socket.emit("startBlocked", "모든 참가자가 준비해야 합니다.");
    }

    // 1. 카드 덱 생성 (과일 4종 x [1개짜리 5장, 2개짜리 3장, 3개짜리 3장, 4개짜리 2장, 5개짜리 1장])
    let deck = [];
    const fruits = [1, 2, 3, 4]; // 딸기, 바나나, 라임, 자두
    const counts = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5];

    fruits.forEach((f) => {
      counts.forEach((c) => deck.push({ fruit: f, count: c }));
    });

    // 2. 셔플 (랜덤 섞기)
    deck.sort(() => Math.random() - 0.5);

    // 3. 인원별로 카드 배분
    room.isGameStarted = true;
    room.centerCards = []; // 바닥에 깔린 카드들
    room.turnIndex = 0; // 누구 차례인지

    const totalPlayers = room.players.length;

    // 💡 테스트용: 전체 덱에서 필요한 만큼만 미리 자릅니다.
    // 인원수 * 5장 만큼만 사용합니다.
    const testDeck = deck.slice(0, totalPlayers * 5);

    room.players.forEach((p, idx) => {
      p.isReady = false;
      p.score = 0;

      //test
      p.myDeck = testDeck.filter((_, i) => i % totalPlayers === idx);
      // 플레이어마다 개인 덱 할당
      //p.myDeck = deck.filter((_, i) => i % totalPlayers === idx);
      p.openCard = null; // 현재 바닥에 보여지는 이 플레이어의 카드
      p.openCardStack = []; // 💡 이 줄을 추가해서 쌓아둘 더미 공간을 만듭니다.
    });

    io.to(room.roomId).emit("gameStart", {
      roomId: room.roomId,
      players: room.players,
      hostId: room.host,
    });
  });

  function getFruitTotals(players) {
    let totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
    players.forEach((p) => {
      if (p.openCard) totals[p.openCard.fruit] += p.openCard.count;
    });
    return totals;
  }

  socket.on("flipCard", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;

    let currentPlayer = room.players[room.turnIndex];
    if (currentPlayer.id !== socket.id) return;

    // 1. 카드 뒤집기
    const card = currentPlayer.myDeck.pop();
    currentPlayer.openCardStack = currentPlayer.openCardStack || [];
    currentPlayer.openCardStack.push(card);
    currentPlayer.openCard = card;

    // 2. 알림 전송 (연출 시작)
    io.to(room.roomId).emit("cardFlipped", {
      playerId: socket.id,
      card: card,
      nextTurnId: room.players[room.turnIndex].id, // 잠시 유지
      remainingCount: currentPlayer.myDeck.length,
    });

    // 3. 💡 [핵심] 뒤집은 후 바닥 상태 확인
    setTimeout(() => {
      const totals = getFruitTotals(room.players);
      const isFive = Object.values(totals).some((t) => t === 5);

      if (!isFive) {
        // 바닥이 5가 아니면? 기사회생 기회 없으므로 0장인 사람들은 차례대로 자동 탈락
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
        processSkipTurn(room, io);
      } else {
        // 바닥이 5라면? 0장인 사람도 종을 쳐야 하므로 턴을 넘기지 않고 대기!
        // (A는 여기서 종을 쳐서 살아나거나, 누군가 종을 쳐서 5가 사라질 때까지 대기하게 됨)
        console.log("🔔 바닥이 5입니다! 기사회생 대기 모드...");
      }
    }, 800);
  });

  function processSkipTurn(room, io) {
    let nextPlayer = room.players[room.turnIndex];

    // 다음 사람이 0장이다? -> 바닥도 5가 아니니 기사회생 실패로 간주하고 탈락
    while (nextPlayer.myDeck.length === 0 && room.isGameStarted) {
      console.log(`💀 [탈락] ${nextPlayer.nickname}님 기사회생 실패`);

      nextPlayer.openCard = null;
      nextPlayer.openCardStack = [];

      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      nextPlayer = room.players[room.turnIndex];

      if (checkGameOver(room, io)) return;
    }

    if (room.isGameStarted) {
      io.to(room.roomId).emit("turnChanged", {
        nextTurnId: nextPlayer.id,
        players: room.players.map((p) => ({
          id: p.id,
          cards: p.myDeck.length,
        })),
      });
    }
  }

  socket.on("ringBell", () => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;

    // 1. 과일 합계 계산
    let fruitTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
    room.players.forEach((p) => {
      if (p.openCard) fruitTotals[p.openCard.fruit] += p.openCard.count;
    });
    const isSuccess = Object.values(fruitTotals).some((total) => total === 5);

    if (isSuccess) {
      // --- 성공: 카드 획득 ---
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

      processSkipTurn(room, io);
    } else {
      // --- 실패: 벌칙 분배 ---
      const penaltyPlayer = room.players.find((p) => p.id === socket.id);
      const penaltyIdx = room.players.findIndex((p) => p.id === socket.id);
      const otherPlayersSorted = [
        ...room.players.slice(penaltyIdx + 1),
        ...room.players.slice(0, penaltyIdx),
      ];
      const requiredCards = otherPlayersSorted.length; // 줘야 할 카드 장수

      // 💡 [룰 적용] 나눠주기 전, 카드가 부족하면 즉시 패배 판정 대상
      const isShortage = penaltyPlayer.myDeck.length < requiredCards;

      // 가진 만큼 최대한 순서대로 나눠줌
      for (let i = 0; i < otherPlayersSorted.length; i++) {
        if (penaltyPlayer.myDeck.length > 0) {
          otherPlayersSorted[i].myDeck.unshift(penaltyPlayer.myDeck.pop());
        }
      }

      if (isShortage) {
        console.log(`💀 [즉시 패배] ${penaltyPlayer.nickname} 벌칙 카드 부족`);
        penaltyPlayer.myDeck = []; // 잔여 카드 소멸 및 패배 처리

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
        // 정상 벌칙 완료
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
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const room = rooms[roomId];

    if (room) {
      // 1. 나가는 유저 정보 찾기 및 제거
      const leavingPlayerIndex = room.players.findIndex(
        (p) => p.id === socket.id
      );
      const leavingPlayer = room.players[leavingPlayerIndex];
      const nickname = leavingPlayer ? leavingPlayer.nickname : "누군가";

      const wasHost = room.host === socket.id;

      // 기존 filter 부분 수정
      room.players = room.players.filter((p) => p.id !== socket.id);

      // ================= [추가된 최적화 로직] =================
      if (room.isGameStarted) {
        // 나간 사람이 현재 턴이었거나, 턴 인덱스가 줄어든 명수보다 클 때 조정
        if (room.turnIndex >= room.players.length) {
          room.turnIndex = 0; // 안전하게 첫 번째 사람으로 초기화
        }

        // 만약 나간 사람 때문에 턴이 꼬일 것 같으면 현재 턴 정보를 다시 전송
        io.to(roomId).emit("turnAdjusted", {
          nextTurnId: room.players[room.turnIndex]?.id,
          players: room.players,
        });
      }
      // ======================================================
      // 2. 방에 아무도 없으면 삭제
      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`[Room ${roomId}] 방 삭제`);
      } else {
        if (wasHost) {
          // ---------------------------------------------------------
          // A. 방장이 나간 경우
          // ---------------------------------------------------------
          room.host = room.players[0].id;

          io.to(roomId).emit("hostChanged", {
            roomId: roomId,
            hostId: room.host,
            players: room.players,
          });

          // (선택사항) 게임 중일 때를 위해 유지해도 좋지만,
          io.to(roomId).emit("updateScores", room.players);
        } else {
          // ---------------------------------------------------------
          // B. 일반 유저가 나간 경우: 기존대로 playerLeft 보냄
          // ---------------------------------------------------------
          io.to(roomId).emit("playerLeft", {
            id: socket.id,
            nickname: nickname,
            players: room.players,
            max: room.maxPlayers,
            hostId: room.host,
          });
        }

        console.log(
          `[Room ${roomId}] ${nickname} 퇴장. 남은 인원: ${room.players.length}`
        );
      }
    }
    socket.roomId = null;
  });
});

// ============================================
// 5. 서버 실행 (Cloud Run 핵심)
// ============================================
const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
