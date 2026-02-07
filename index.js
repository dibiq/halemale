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
  res.status(200).send("서버가 정상적으로 살아있습니다! 꼬치왕 화이팅!");
});

// 헬스체크용 (Cloud Run 권장)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

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
      nickname: socket.nickname, // "요리사" 또는 실제 이름
      score: 0,
      currentProgress: 0,
      isReady: false, // ⭐ 추가
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
        score: 0,
        currentProgress: 0,
        isReady: false, // ⭐ 추가
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

  socket.on("requestNextRecipe", () => {
    const room = rooms[socket.roomId];
    if (!room || room.host !== socket.id) return;

    // 1. 방장을 제외한 게스트 목록 추출
    const guests = room.players.filter((p) => p.id !== room.host);

    // 2. [추가된 핵심 로직] 게스트가 없으면(혼자라면) 시작 차단
    if (guests.length === 0) {
      socket.emit("startBlocked", "함께 할 유저가 최소 한 명 필요합니다!");
      return;
    }

    // 3. 게스트들이 모두 준비했는지 확인 (인원이 몇 명이든 상관없음)
    const allReady = guests.every((p) => p.isReady);

    if (!allReady) {
      socket.emit("startBlocked", "모든 참가자가 준비해야 시작할 수 있습니다.");
      return;
    }

    // 게임 시작 시 ready 초기화 및 상태 변경
    room.players.forEach((p) => (p.isReady = false));
    room.isGameStarted = true;
    generateNewRecipe(room);
  });

  function generateNewRecipe(room) {
    const roomId = room.roomId;

    room.submitCount = 0;
    room.isGameStarted = true; // 💡 게임 시작 상태로 변경

    room.players.forEach((p) => {
      p.isReady = false; // 안전빵
      p.lastResult = "요리 중...";
      p.currentProgress = 0;
      p.currentSkewer = [];
      p.completedSkewers = [];
    });

    const INGREDIENTS = [1, 2, 3, 4, 5];
    const ROTATIONS = [0, 90, 180, 270];
    const recipeCount = 3;
    room.recipes = [];

    for (let i = 0; i < recipeCount; i++) {
      const materialCount = Math.floor(Math.random() * 4) + 1;
      const singleRecipe = [];
      for (let j = 0; j < materialCount; j++) {
        singleRecipe.push({
          id: INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)],
          angle: ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)],
        });
      }
      room.recipes.push(singleRecipe);
    }

    io.to(roomId).emit("gameStart", {
      roomId: roomId,
      recipes: room.recipes,
      players: room.players,
      hostId: room.host,
      isSingle: false,
    });
  }

  socket.on("syncMySkewer", (currentSkewerData) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.currentSkewer = currentSkewerData;
      io.to(socket.roomId).emit("updateScores", room.players);
    }
  });

  socket.on("updateProgress", (data) => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.completedSkewers = data.completedList;
      player.currentProgress = data.count;
      player.currentSkewer = [];
      io.to(socket.roomId).emit("updateScores", room.players);
    }
  });

  socket.on("submit", (userData) => {
    const room = rooms[socket.roomId];
    if (!room || !room.isGameStarted) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.lastResult === "성공!") return;

    let isAllCorrect = true;
    if (userData.length !== room.recipes.length) isAllCorrect = false;
    else {
      for (let i = 0; i < room.recipes.length; i++) {
        const target = room.recipes[i];
        const submitted = userData[i];
        if (!submitted || target.length !== submitted.length) {
          isAllCorrect = false;
          break;
        }
        for (let j = 0; j < target.length; j++) {
          const norm = (a) => ((Math.round(a) % 360) + 360) % 360;
          if (
            String(target[j].id) !== String(submitted[j].id) ||
            norm(target[j].angle) !== norm(submitted[j].angle)
          ) {
            isAllCorrect = false;
            break;
          }
        }
        if (!isAllCorrect) break;
      }
    }

    if (isAllCorrect) {
      socket.emit("result", { success: true });
      room.submitCount++;
      player.score += room.submitCount === 1 ? 100 : 80;
      player.lastResult = "성공!";
      player.completedSkewers = [...room.recipes];
      player.currentProgress = room.recipes.length;
      player.currentSkewer = [];

      io.to(socket.roomId).emit("updateScores", room.players);

      const targetFinishCount =
        room.players.length > 1 ? room.players.length - 1 : 1;

      if (room.submitCount >= targetFinishCount) {
        setTimeout(() => {
          if (!room.isGameStarted) return;
          room.isGameStarted = false;

          const sortedPlayers = room.players.sort((a, b) => b.score - a.score);
          io.to(socket.roomId).emit("recipeEnded", {
            players: sortedPlayers,
            hostId: room.host, // 이 값이 꼭 필요합니다!
          });
        }, 1500);
      }
    } else {
      socket.emit("result", { success: false });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const room = rooms[roomId];

    if (room) {
      // 1. 나가는 유저 정보 찾기
      const leavingPlayer = room.players.find((p) => p.id === socket.id);
      const nickname = leavingPlayer ? leavingPlayer.nickname : "누군가";

      const wasHost = room.host === socket.id;
      room.players = room.players.filter((p) => p.id !== socket.id);

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
