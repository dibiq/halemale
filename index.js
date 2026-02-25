const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const DATABASE_URL = process.env.DATABASE_URL;
const hasPgConfig =
  Boolean(process.env.PGHOST) ||
  Boolean(process.env.PGUSER) ||
  Boolean(process.env.PGDATABASE);

// 1. CORS 설정
function getAllowedOrigins() {
  return [
    "https://halemale.onrender.com",
    "https://halemale-client.onrender.com",
    "https://skewer-master.apps.tossmini.com",
    "https://skewer-master.private-apps.tossmini.com",
    "https://halemale.apps.tossmini.com",
    "https://halemale.private-apps.tossmini.com",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "http://10.68.14.196:5173",
    "http://localhost:5173",
    "http://0.0.0.0:5173",
    "http://0.0.0.0:3000",
    "http://192.168.10.113:3000",
    "http://192.168.10.113:5173",
    "http://localhost:3000",
  ];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch (error) {
    return false;
  }
}

// 1. DB 연결 설정
const isDatabaseEnabled = Boolean(DATABASE_URL) || hasPgConfig;

const pool = isDatabaseEnabled
  ? new Pool({
      ...(DATABASE_URL ? { connectionString: DATABASE_URL } : {}),
      ...(DATABASE_URL
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : {}),
    })
  : null;

if (!isDatabaseEnabled) {
  console.warn(
    "⚠️ DATABASE_URL 미설정: DB 저장/조회 기능을 비활성화하고 서버를 실행합니다.",
  );
} else if (!DATABASE_URL && hasPgConfig) {
  console.log(
    "ℹ️ DATABASE_URL 없이 PG 환경변수(PGHOST/PGUSER/PGDATABASE)로 DB 연결을 시도합니다.",
  );
}

// 2. [저장하기] 플레이어 데이터 저장/업데이트 (UPSERT)
async function savePlayer(
  id,
  level,
  coins,
  items,
  experience,
  ownedCharacters = null,
  currentCharacter = null,
) {
  if (!pool) return;

  const normalizedOwnedCharacters = Array.isArray(ownedCharacters)
    ? ownedCharacters.filter((key) => /^player_[1-4]$/.test(String(key)))
    : null;

  const normalizedCurrentCharacter = /^player_[1-4]$/.test(
    String(currentCharacter || ""),
  )
    ? currentCharacter
    : null;

  const query = `
    INSERT INTO players (
      id,
      level,
      coins,
      items,
      experience,
      owned_characters,
      current_character,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      COALESCE($6::jsonb, '[]'::jsonb),
      COALESCE($7, 'player_1'),
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) 
    DO UPDATE SET 
      level = EXCLUDED.level,
      coins = EXCLUDED.coins,
      items = EXCLUDED.items,
      experience = EXCLUDED.experience,
      owned_characters = COALESCE($6::jsonb, players.owned_characters),
      current_character = COALESCE($7, players.current_character),
      updated_at = CURRENT_TIMESTAMP;
  `;
  try {
    const result = await pool.query(query, [
      id,
      level,
      coins,
      JSON.stringify(items),
      experience,
      normalizedOwnedCharacters
        ? JSON.stringify(normalizedOwnedCharacters)
        : null,
      normalizedCurrentCharacter,
    ]);
    console.log(
      `✅ ${id} 데이터 저장 성공 (coins=${coins}, owned=${JSON.stringify(normalizedOwnedCharacters)}, current=${normalizedCurrentCharacter}, rowCount=${result.rowCount})`,
    );
  } catch (err) {
    console.error("❌ 저장 에러:", err);
  }
}

async function ensurePlayersSchema() {
  if (!pool) {
    console.log("ℹ️ players 스키마 확인 건너뜀 (DB 비활성화)");
    return;
  }

  try {
    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS experience INTEGER NOT NULL DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS owned_characters JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS current_character TEXT NOT NULL DEFAULT 'player_1';
    `);
    console.log("✅ players.experience 컬럼 확인 완료");
  } catch (err) {
    console.error("❌ players 스키마 확인 에러:", err);
  }
}

// 3. [불러오기] 플레이어 데이터 조회
async function getPlayer(id) {
  if (!pool) return null;

  try {
    const res = await pool.query("SELECT * FROM players WHERE id = $1", [id]);
    if (res.rows.length > 0) {
      return res.rows[0];
    }
    return null; // 유저 정보 없음
  } catch (err) {
    console.error("❌ 조회 에러:", err);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS 차단 origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.static(path.join(__dirname, "public")));

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Socket.IO CORS 차단 origin: ${origin}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowEIO3: true,
});

let rooms = {};
const RANK_REWARD_COINS = [30, 20, 10];
const WIN_REWARD_XP = 40;
const XP_PER_LEVEL = 100;
const THUNDER_CARD_TYPE = "thunder";
const THUNDER_CARD_COUNT = 2;
const BOMB_CARD_TYPE = "bomb";
// Multiplayer default counts
const BOMB_CARD_COUNT = 2;
const TON_CARD_TYPE = "ton";
const TON_CARD_COUNT = 1;
const PEN_CARD_TYPE = "pen";
const PEN_CARD_COUNT = 1;
const PLUS1_CARD_TYPE = "plus1";
const PLUS1_CARD_COUNT = 1;
const SERVER_BUILD = "2026-02-24-thunder-insert-v1";

function getLevelFromExperience(experience) {
  return Math.floor((Number(experience) || 0) / XP_PER_LEVEL) + 1;
}

function isThunderCard(card) {
  return Boolean(card) && card.type === THUNDER_CARD_TYPE;
}

function isBombCard(card) {
  return Boolean(card) && card.type === BOMB_CARD_TYPE;
}

function isTonCard(card) {
  return Boolean(card) && card.type === TON_CARD_TYPE;
}

function isPenCard(card) {
  return Boolean(card) && card.type === PEN_CARD_TYPE;
}

function isPlus1Card(card) {
  return Boolean(card) && card.type === PLUS1_CARD_TYPE;
}

function hasThunderCardOnTable(players) {
  return players.some((player) => {
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    return isThunderCard(top);
  });
}

function hasBombCardOnTable(players) {
  return players.some((player) => {
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    return isBombCard(top);
  });
}

function hasPenCardOnTable(players) {
  return players.some((player) => {
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    return isPenCard(top);
  });
}

function hasPlus1CardOnTable(players) {
  return players.some((player) => {
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    return isPlus1Card(top);
  });
}

function injectThunderCardsToPlayers(players, thunderCount) {
  if (!Array.isArray(players) || players.length === 0) return;

  const drawablePlayers = players.filter(
    (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
  );
  if (drawablePlayers.length === 0) return;

  const count = Math.max(0, Number(thunderCount) || 0);

  for (let index = 0; index < count; index += 1) {
    const targetPlayer =
      drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
    if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

    const insertIndex = Math.floor(
      Math.random() * (targetPlayer.myDeck.length + 1),
    );
    // Preserve deck size by replacing if index within range, otherwise push
    if (insertIndex < targetPlayer.myDeck.length) {
      targetPlayer.myDeck[insertIndex] = { type: THUNDER_CARD_TYPE };
    } else {
      targetPlayer.myDeck.push({ type: THUNDER_CARD_TYPE });
    }

    console.log(
      `⚡ inject thunder -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
    );
  }
}

function syncRoomPlayersWithActiveSockets(room, io) {
  if (!room || !Array.isArray(room.players)) return;

  const activeSocketIds = io.sockets.adapter.rooms.get(room.roomId);
  if (!activeSocketIds || activeSocketIds.size === 0) return;

  const activeSockets = [...activeSocketIds]
    .map((id) => io.sockets.sockets.get(id))
    .filter(Boolean);

  room.players.forEach((player) => {
    const matchedSocket = activeSockets.find((activeSocket) => {
      const activeNickname =
        typeof activeSocket.nickname === "string"
          ? activeSocket.nickname.trim()
          : "";
      const playerNickname =
        typeof player.nickname === "string" ? player.nickname.trim() : "";
      return (
        activeNickname && playerNickname && activeNickname === playerNickname
      );
    });

    if (matchedSocket) {
      const previousId = player.id;
      player.id = matchedSocket.id;
      if (room.host === previousId) {
        room.host = matchedSocket.id;
      }
    }
  });

  const uniquePlayers = [];
  const seenIds = new Set();
  room.players.forEach((player) => {
    if (seenIds.has(player.id)) return;
    seenIds.add(player.id);
    uniquePlayers.push(player);
  });
  room.players = uniquePlayers;
}

function normalizeCharacterKey(value) {
  return /^player_[1-4]$/.test(String(value || "")) ? String(value) : null;
}

function normalizeOwnedCharacters(value) {
  const normalized = new Set(["player_1"]);

  if (Array.isArray(value)) {
    value.forEach((key) => {
      const normalizedKey = normalizeCharacterKey(key);
      if (normalizedKey) normalized.add(normalizedKey);
    });
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, owned]) => {
      const normalizedKey = normalizeCharacterKey(key);
      if (normalizedKey && owned) normalized.add(normalizedKey);
    });
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeOwnedCharacters(parsed);
    } catch (err) {
      const normalizedKey = normalizeCharacterKey(value);
      if (normalizedKey) normalized.add(normalizedKey);
    }
  }

  return Array.from(normalized);
}

function reconcileRoomPlayerByNickname(room, socket, payload = {}) {
  if (!room || !Array.isArray(room.players)) return null;

  const nicknameFromPayload =
    typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  const socketNickname =
    typeof socket.nickname === "string" ? socket.nickname.trim() : "";
  const targetNickname = nicknameFromPayload || socketNickname;

  if (!targetNickname) return null;

  let player = room.players.find((p) => p.id === socket.id);
  if (!player) {
    player = room.players.find(
      (p) =>
        typeof p.nickname === "string" && p.nickname.trim() === targetNickname,
    );
  }
  if (!player) return null;

  const previousId = player.id;

  player.id = socket.id;
  player.nickname = targetNickname;
  player.avatarKey = payload.avatarKey || socket.avatarKey || player.avatarKey;
  player.level = socket.level || player.level || 1;
  player.coins = socket.coins || player.coins || 0;
  player.experience = socket.experience || player.experience || 0;
  player.items = socket.items || player.items || [];

  if (room.host === previousId) {
    room.host = socket.id;
  }

  if (
    typeof room.turnIndex === "number" &&
    room.players[room.turnIndex] &&
    room.players[room.turnIndex].id === previousId
  ) {
    const nextTurnIndex = room.players.findIndex((p) => p.id === socket.id);
    room.turnIndex = nextTurnIndex >= 0 ? nextTurnIndex : room.turnIndex;
  }

  room.players = room.players.filter(
    (p) =>
      p === player || (p.id !== socket.id && p.nickname !== targetNickname),
  );

  return player;
}

// 헬스체크
app.get("/", (req, res) => res.status(200).send("서버 가동 중"));
app.get("/health", (req, res) =>
  res.status(200).json({
    status: "ok",
    build: SERVER_BUILD,
    pid: process.pid,
  }),
);

function getRoomListPayload() {
  return Object.values(rooms).map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName || `${room.players[0]?.nickname || "방장"}의 방`,
    hostNickname: room.players[0]?.nickname || "방장",
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    isPublic: room.isPublic,
    isGameStarted: room.isGameStarted || false,
  }));
}

// 방 목록 조회 API (공개/비공개 모두 반환)
app.get("/api/rooms", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.json(getRoomListPayload());
});

// 기존 경로 호환 유지
app.get("/api/public-rooms", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.json(getRoomListPayload());
});

// 공개 방 목록을 모든 클라이언트에게 브로드캐스트하는 헬퍼 함수
function broadcastPublicRooms() {
  const publicRooms = getRoomListPayload();
  io.emit("publicRoomsUpdated", publicRooms);
}

// --- 공통 유틸리티 함수 ---

function getFruitTotals(players) {
  let totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const plus1Active = hasPlus1CardOnTable(players);
  players.forEach((p) => {
    if (
      p.openCard &&
      Number.isFinite(Number(p.openCard.fruit)) &&
      Number.isFinite(Number(p.openCard.count))
    ) {
      const base = Number(p.openCard.count) || 0;
      totals[p.openCard.fruit] += base + (plus1Active ? 1 : 0);
    }
  });
  return totals;
}

function checkGameOver(room, io) {
  // 덱이 0장인 사람들을 판별
  // If there's an active bell-success window (5 or thunder on table),
  // players with 0 cards are given a temporary reprieve.
  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);
  const hasThunder = hasThunderCardOnTable(room.players);
  const isBellSuccessWindow = isFive || hasThunder;

  room.players.forEach((p) => {
    const hasNoDeck = !p.myDeck || p.myDeck.length === 0;
    if (hasNoDeck) {
      // Only mark eliminated when there is no active success window
      p.isEliminated = !isBellSuccessWindow;
    } else {
      p.isEliminated = false;
    }
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
    const beforeStateById = new Map(
      room.players.map((p) => {
        const beforeExperience = Number(p.experience) || 0;
        const beforeLevel =
          Number(p.level) || getLevelFromExperience(beforeExperience);
        const beforeCoins = Number(p.coins) || 0;

        return [
          p.id,
          {
            beforeCoins,
            beforeExperience,
            beforeLevel,
          },
        ];
      }),
    );

    const sorted = [...room.players].sort(
      (a, b) => (b.myDeck?.length || 0) - (a.myDeck?.length || 0),
    );

    // 순위별 코인 보상(1등 30, 2등 20, 3등 10)
    sorted.forEach((player, rankIndex) => {
      const coinReward = RANK_REWARD_COINS[rankIndex] || 0;
      if (coinReward > 0) {
        player.coins = (Number(player.coins) || 0) + coinReward;
      }
    });

    // 승자에게 경험치 보상을 지급하고 레벨을 갱신
    winner.experience = (Number(winner.experience) || 0) + WIN_REWARD_XP;
    winner.level = getLevelFromExperience(winner.experience);

    room.players.forEach((p) => {
      const currentExp = Number(p.experience) || 0;
      const currentLevel =
        Number(p.level) || getLevelFromExperience(currentExp);
      const currentCoins = Number(p.coins) || 0;
      const currentItems = Array.isArray(p.items) ? p.items : [];

      savePlayer(
        p.nickname,
        currentLevel,
        currentCoins,
        currentItems,
        currentExp,
      );

      io.to(p.id).emit("myProfile", {
        nickname: p.nickname,
        level: currentLevel,
        coins: currentCoins,
        items: currentItems,
        experience: currentExp,
        avatarKey: p.avatarKey || "player_1",
      });
    });

    io.to(room.roomId).emit("gameEnded", {
      message: `게임 종료! ${winner.nickname}님의 최종 승리!`,
      ranking: sorted.map((p) => {
        const before = beforeStateById.get(p.id) || {
          beforeCoins: Number(p.coins) || 0,
          beforeExperience: Number(p.experience) || 0,
          beforeLevel: Number(p.level) || 1,
        };

        const rankIndex = sorted.findIndex((sp) => sp.id === p.id);
        const earnedCoins =
          rankIndex >= 0 ? RANK_REWARD_COINS[rankIndex] || 0 : 0;
        const earnedExperience = p.id === winner.id ? WIN_REWARD_XP : 0;
        const finalCoins = Number(p.coins) || 0;
        const finalExperience = Number(p.experience) || 0;
        const finalLevel =
          Number(p.level) || getLevelFromExperience(finalExperience);
        const leveledUp = finalLevel > (Number(before.beforeLevel) || 1);

        return {
          id: p.id,
          nickname: p.nickname,
          cards: p.myDeck?.length || 0,
          currentCoins: before.beforeCoins,
          earnedCoins,
          finalCoins,
          currentLevel: before.beforeLevel,
          finalLevel,
          currentExperience: before.beforeExperience,
          earnedExperience,
          finalExperience,
          leveledUp,
        };
      }),
      winner: winner.nickname,
      winnerId: winner.id,
      rewardCoins: RANK_REWARD_COINS[0],
      rewardCoinsByRank: {
        1: RANK_REWARD_COINS[0] || 0,
        2: RANK_REWARD_COINS[1] || 0,
        3: RANK_REWARD_COINS[2] || 0,
      },
      winnerCoins: winner.coins,
      rewardExperience: WIN_REWARD_XP,
      winnerExperience: winner.experience,
      winnerLevel: winner.level,
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
  const dir = typeof room.turnDirection === "number" ? room.turnDirection : 1;
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
      room.turnIndex =
        (room.turnIndex + dir + room.players.length) % room.players.length;
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

function emitServerDebug(room, event, payload = {}) {
  if (!room || !room.roomId) return;
  io.to(room.roomId).emit("serverDebug", {
    ts: Date.now(),
    roomId: room.roomId,
    event,
    ...payload,
  });
}

// 2. 소켓 로직
io.on("connection", (socket) => {
  socket.emit("serverHello", {
    build: SERVER_BUILD,
    pid: process.pid,
    socketId: socket.id,
  });

  socket.on("setNickname", async (nickname) => {
    const nicknamePayload =
      typeof nickname === "object" && nickname !== null ? nickname : {};
    const resolvedNickname =
      typeof nicknamePayload.nickname === "string"
        ? nicknamePayload.nickname
        : typeof nickname === "string"
          ? nickname
          : "요리사" + Math.floor(Math.random() * 1000);

    const avatarKey =
      typeof nicknamePayload.avatarKey === "string" &&
      /^player_[1-4]$/.test(nicknamePayload.avatarKey)
        ? nicknamePayload.avatarKey
        : socket.avatarKey || "player_1";

    socket.nickname = resolvedNickname;
    socket.avatarKey = avatarKey;
    socket.level = 1;
    socket.coins = 0;
    socket.experience = 0;
    socket.items = [];
    socket.specialCards = {}; // 특수카드 초기화
    socket.ownedCharacters = ["player_1"];
    socket.currentCharacter = avatarKey;

    // 💡 [추가] DB에서 유저 데이터 불러오기
    const savedData = await getPlayer(socket.nickname);
    if (savedData) {
      console.log(`${socket.nickname}의 데이터를 불러왔습니다:`, savedData);
      let parsedItems = [];
      let parsedSpecialCards = {};

      // items 데이터 파싱 (기존 배열 또는 새로운 객체 형식 지원)
      if (
        typeof savedData.items === "object" &&
        !Array.isArray(savedData.items)
      ) {
        // 새로운 형식: {items: [...], specialCards: {...}}
        parsedItems = Array.isArray(savedData.items.items)
          ? savedData.items.items
          : [];
        parsedSpecialCards =
          typeof savedData.items.specialCards === "object"
            ? savedData.items.specialCards
            : {};
      } else if (Array.isArray(savedData.items)) {
        // 기존 형식: 배열
        parsedItems = savedData.items;
      } else if (typeof savedData.items === "string") {
        try {
          const parsed = JSON.parse(savedData.items);
          if (typeof parsed === "object" && !Array.isArray(parsed)) {
            // 객체 형식
            parsedItems = Array.isArray(parsed.items) ? parsed.items : [];
            parsedSpecialCards =
              typeof parsed.specialCards === "object"
                ? parsed.specialCards
                : {};
          } else if (Array.isArray(parsed)) {
            // 배열 형식
            parsedItems = parsed;
          }
        } catch (e) {
          parsedItems = [];
        }
      }

      // 이 데이터를 socket 객체에 담아두거나 클라이언트에 보내주면 됩니다.
      socket.level = savedData.level;
      socket.coins = savedData.coins;
      socket.experience =
        Number(savedData.experience) ||
        Math.max((Number(savedData.level) || 1) - 1, 0) * XP_PER_LEVEL;
      socket.items = parsedItems;
      socket.specialCards = parsedSpecialCards; // 특수카드 할당
      socket.ownedCharacters = normalizeOwnedCharacters(
        savedData.owned_characters,
      );
      socket.currentCharacter =
        normalizeCharacterKey(savedData.current_character) ||
        socket.currentCharacter ||
        "player_1";
      socket.avatarKey = socket.currentCharacter;
      console.log(`✅ setNickname - ${socket.nickname} DB 로드 완료:`, {
        level: socket.level,
        coins: socket.coins,
        exp: socket.experience,
      });
    } else {
      console.log(`⚠️ setNickname - ${socket.nickname} DB 데이터 없음`);
    }

    socket.level =
      Number(socket.level) || getLevelFromExperience(socket.experience);

    console.log(`🎯 setNickname 최종 - ${socket.nickname}:`, {
      level: socket.level,
      coins: socket.coins,
      exp: socket.experience,
    });

    socket.emit("myProfile", {
      nickname: socket.nickname,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
      specialCards: socket.specialCards || {},
      owned_characters: socket.ownedCharacters || ["player_1"],
      current_character: socket.currentCharacter || "player_1",
    });

    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      const player = reconcileRoomPlayerByNickname(room, socket, {
        nickname: socket.nickname,
        avatarKey: socket.avatarKey,
      });

      if (player) {
        player.nickname = socket.nickname;
        player.avatarKey = socket.avatarKey || "player_1";

        // 💡 [추가] DB에서 가져온 데이터를 player 객체에 할당
        player.level = socket.level || 1;
        player.coins = socket.coins || 0;
        player.experience = socket.experience || 0;
        player.items = socket.items || [];

        io.to(socket.roomId).emit("playerJoined", {
          roomId: socket.roomId,
          players: room.players,
          hostId: room.host,
          max: room.maxPlayers,
          roomName: room.roomName,
          newPlayerNickname: player.nickname,
          isRejoin: true,
        });
      }
    }
  });

  // 특수카드 구매 이벤트
  socket.on("buySpecialCard", async (data) => {
    const { cardId, cardPrice } = data;

    // 1. 코인 차감
    socket.coins -= cardPrice;

    // 2. 특수카드 수량 증가
    if (!socket.specialCards[cardId]) {
      socket.specialCards[cardId] = 0;
    }
    socket.specialCards[cardId] += 1;

    // 3. DB에 저장
    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    await savePlayer(
      socket.nickname,
      socket.level,
      socket.coins,
      mergedItems,
      socket.experience,
      socket.ownedCharacters,
      socket.currentCharacter,
    );

    // 4. 클라이언트에 최신 프로필 전송
    socket.emit("myProfile", {
      nickname: socket.nickname,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
      specialCards: socket.specialCards || {},
      owned_characters: socket.ownedCharacters || ["player_1"],
      current_character: socket.currentCharacter || "player_1",
    });

    console.log(
      `✅ ${socket.nickname}이(가) 카드 ${cardId} 구매 (현재 보유: ${socket.specialCards[cardId]}개)`,
    );
  });

  // 코인 추가 구매 이벤트
  socket.on("addCoins", async (data) => {
    const { amount } = data;

    // 1. 코인 추가
    socket.coins += amount;

    // 2. DB에 저장
    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    await savePlayer(
      socket.nickname,
      socket.level,
      socket.coins,
      mergedItems,
      socket.experience,
      socket.ownedCharacters,
      socket.currentCharacter,
    );

    // 3. 클라이언트에 최신 프로필 전송
    socket.emit("myProfile", {
      nickname: socket.nickname,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
      specialCards: socket.specialCards || {},
      owned_characters: socket.ownedCharacters || ["player_1"],
      current_character: socket.currentCharacter || "player_1",
    });

    console.log(
      `✅ ${socket.nickname}이(가) 코인 ${amount}개 구매 (현재 보유: ${socket.coins}개)`,
    );
  });

  const handleBuyCharacter = async (data) => {
    const payload = data && typeof data === "object" ? data : {};
    const targetPlayerId =
      typeof socket.nickname === "string" && socket.nickname.trim()
        ? socket.nickname.trim()
        : typeof payload.id === "string" && payload.id.trim()
          ? payload.id.trim()
          : typeof payload.nickname === "string" && payload.nickname.trim()
            ? payload.nickname.trim()
            : socket.nickname;

    console.log("🛒 buyCharacter 수신:", {
      socketNickname: socket.nickname,
      payloadId: payload.id,
      payloadNickname: payload.nickname,
      targetPlayerId,
      payload,
    });

    if (!targetPlayerId) {
      socket.emit("buyCharacterError", "유효하지 않은 플레이어입니다.");
      return;
    }

    if (socket.nickname !== targetPlayerId) {
      socket.nickname = targetPlayerId;
      const latest = await getPlayer(targetPlayerId);
      if (latest) {
        socket.level = latest.level || socket.level || 1;
        socket.coins = Number(latest.coins) || 0;
        socket.experience = Number(latest.experience) || 0;
        socket.ownedCharacters = normalizeOwnedCharacters(
          latest.owned_characters,
        );
        socket.currentCharacter =
          normalizeCharacterKey(latest.current_character) ||
          socket.currentCharacter ||
          "player_1";
      }
    }

    const characterKey =
      normalizeCharacterKey(payload.characterKey) ||
      normalizeCharacterKey(payload.currentCharacter) ||
      normalizeCharacterKey(payload.current_character);
    const characterPrice = Number(payload.characterPrice ?? payload.price ?? 0);

    if (!characterKey) {
      socket.emit("buyCharacterError", "유효하지 않은 캐릭터입니다.");
      return;
    }

    if (!Number.isFinite(characterPrice) || characterPrice < 0) {
      socket.emit("buyCharacterError", "유효하지 않은 가격입니다.");
      return;
    }

    const hasEnoughCoins = (Number(socket.coins) || 0) >= characterPrice;
    if (!hasEnoughCoins) {
      socket.emit("buyCharacterError", "코인이 부족합니다.");
      return;
    }

    socket.coins = (Number(socket.coins) || 0) - characterPrice;
    socket.ownedCharacters = normalizeOwnedCharacters([
      ...(socket.ownedCharacters || ["player_1"]),
      characterKey,
    ]);
    socket.currentCharacter = characterKey;
    socket.avatarKey = characterKey;

    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    await savePlayer(
      targetPlayerId,
      socket.level,
      socket.coins,
      mergedItems,
      socket.experience,
      socket.ownedCharacters,
      socket.currentCharacter,
    );

    socket.emit("myProfile", {
      nickname: targetPlayerId,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
      specialCards: socket.specialCards || {},
      owned_characters: socket.ownedCharacters || ["player_1"],
      current_character: socket.currentCharacter || "player_1",
    });

    console.log(
      `✅ ${targetPlayerId} 캐릭터 구매 완료: ${characterKey}, 남은 코인 ${socket.coins}`,
    );
  };

  socket.on("buyCharacter", handleBuyCharacter);
  socket.on("purchaseCharacter", handleBuyCharacter);
  socket.on("characterPurchased", handleBuyCharacter);

  socket.on("setCurrentCharacter", async (data) => {
    const payload = data && typeof data === "object" ? data : {};
    const characterKey =
      normalizeCharacterKey(payload.currentCharacter) ||
      normalizeCharacterKey(payload.current_character) ||
      normalizeCharacterKey(payload.characterKey);

    if (!characterKey) return;

    const ownedCharacters = normalizeOwnedCharacters(
      socket.ownedCharacters || ["player_1"],
    );
    if (!ownedCharacters.includes(characterKey)) {
      return;
    }

    socket.currentCharacter = characterKey;
    socket.avatarKey = characterKey;

    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    await savePlayer(
      socket.nickname,
      socket.level,
      socket.coins,
      mergedItems,
      socket.experience,
      ownedCharacters,
      socket.currentCharacter,
    );
  });

  const handleSyncPlayerInventory = async (data) => {
    const payload = data && typeof data === "object" ? data : {};
    const targetPlayerId =
      typeof socket.nickname === "string" && socket.nickname.trim()
        ? socket.nickname.trim()
        : typeof payload.id === "string" && payload.id.trim()
          ? payload.id.trim()
          : typeof payload.nickname === "string" && payload.nickname.trim()
            ? payload.nickname.trim()
            : socket.nickname;

    if (!targetPlayerId) {
      return;
    }

    if (socket.nickname !== targetPlayerId) {
      socket.nickname = targetPlayerId;
    }

    if (typeof payload.coins !== "undefined") {
      const incomingCoins = Number(payload.coins);
      if (Number.isFinite(incomingCoins)) {
        socket.coins = incomingCoins;
      }
    }

    const incomingOwnedCharacters =
      payload.owned_characters || payload.ownedCharacters;
    if (typeof incomingOwnedCharacters !== "undefined") {
      socket.ownedCharacters = normalizeOwnedCharacters(
        incomingOwnedCharacters,
      );
    } else {
      socket.ownedCharacters = normalizeOwnedCharacters(
        socket.ownedCharacters || ["player_1"],
      );
    }

    const incomingCurrentCharacter =
      normalizeCharacterKey(payload.current_character) ||
      normalizeCharacterKey(payload.currentCharacter);
    if (
      incomingCurrentCharacter &&
      socket.ownedCharacters.includes(incomingCurrentCharacter)
    ) {
      socket.currentCharacter = incomingCurrentCharacter;
      socket.avatarKey = incomingCurrentCharacter;
    }

    if (payload.specialCards && typeof payload.specialCards === "object") {
      socket.specialCards = payload.specialCards;
    }

    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    await savePlayer(
      targetPlayerId,
      socket.level,
      socket.coins,
      mergedItems,
      socket.experience,
      socket.ownedCharacters,
      socket.currentCharacter || "player_1",
    );
  };

  socket.on("syncPlayerInventory", handleSyncPlayerInventory);
  socket.on("syncInventory", handleSyncPlayerInventory);
  socket.on("updatePlayerInventory", handleSyncPlayerInventory);
  socket.on("updateProfile", handleSyncPlayerInventory);
  socket.on("savePlayerProfile", handleSyncPlayerInventory);

  socket.on("createRoom", async (data) => {
    console.log("🏠 createRoom 호출됨, 받은 data:", JSON.stringify(data));
    const nickname = typeof data === "object" ? data.nickname : socket.nickname;
    const avatarKey =
      typeof data === "object" && /^player_[1-4]$/.test(data.avatarKey)
        ? data.avatarKey
        : socket.avatarKey || "player_1";
    socket.nickname = nickname || "요리사";
    socket.avatarKey = avatarKey;
    console.log(`🏠 createRoom - socket.nickname 설정됨: ${socket.nickname}`);

    // 💡 [추가] nickname으로 DB에서 플레이어 정보 조회 (level, coins, experience 복원)
    const savedData = await getPlayer(socket.nickname);
    if (savedData) {
      console.log(`🔍 createRoom - ${socket.nickname}의 DB 데이터:`, {
        level: savedData.level,
        coins: savedData.coins,
        exp: savedData.experience,
      });
      socket.level = savedData.level || 1;
      socket.coins = savedData.coins || 0;
      socket.experience = savedData.experience || 0;

      // items 파싱
      let parsedItems = [];
      if (
        typeof savedData.items === "object" &&
        !Array.isArray(savedData.items)
      ) {
        parsedItems = Array.isArray(savedData.items.items)
          ? savedData.items.items
          : [];
      } else if (Array.isArray(savedData.items)) {
        parsedItems = savedData.items;
      } else if (typeof savedData.items === "string") {
        try {
          const parsed = JSON.parse(savedData.items);
          parsedItems = Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed)
              ? parsed
              : [];
        } catch (e) {
          parsedItems = [];
        }
      }
      socket.items = parsedItems;
    } else {
      console.log(
        `⚠️ createRoom - ${socket.nickname}의 DB 데이터 없음, 기본값 사용`,
      );
      socket.level = socket.level || 1;
      socket.coins = socket.coins || 0;
      socket.experience = socket.experience || 0;
      socket.items = socket.items || [];
    }

    let roomId = Math.floor(1000 + Math.random() * 9000).toString();
    while (rooms[roomId])
      roomId = Math.floor(1000 + Math.random() * 9000).toString();

    // 💡 [추가] isPublic 플래그 설정
    const isPublic = data.isPublic === true;
    const roomName = data.roomName || `${socket.nickname}의 방`;
    const password = isPublic ? null : data.password || null;

    rooms[roomId] = {
      roomId,
      host: socket.id,
      players: [],
      maxPlayers: data.maxPlayers || 4,
      isGameStarted: false,
      bellLocked: false,
      isPublic: isPublic,
      roomName: roomName,
      password: password, // 💡 비밀번호 저장 (비공개 방만)
    };
    const playerData = {
      id: socket.id,
      nickname: socket.nickname,
      avatarKey: socket.avatarKey || "player_1",
      level: socket.level || 1, // 💡 방장 데이터도 포함
      coins: socket.coins || 0,
      experience: socket.experience || 0,
      items: socket.items || [],
      myDeck: [],
      openCard: null,
      openCardStack: [],
      isReady: false,
    };
    console.log(`✅ createRoom - 방장 추가:`, {
      nickname: playerData.nickname,
      level: playerData.level,
      coins: playerData.coins,
    });
    rooms[roomId].players.push(playerData);

    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit("roomCreated", {
      roomId,
      players: rooms[roomId].players,
      hostId: socket.id,
      max: rooms[roomId].maxPlayers,
      isPublic: isPublic,
      roomName: rooms[roomId].roomName,
    });

    // 방 생성 시 목록 브로드캐스트 (공개/비공개 모두)
    broadcastPublicRooms();
  });

  socket.on("joinRoom", async (data) => {
    console.log("🚪 joinRoom 호출됨, 받은 data:", JSON.stringify(data));
    const roomId = (
      typeof data === "object" ? data.roomId : data
    ).toUpperCase();
    const nickname =
      (typeof data === "object" ? data.nickname : socket.nickname) || "요리사";
    const avatarKey =
      typeof data === "object" && /^player_[1-4]$/.test(data.avatarKey)
        ? data.avatarKey
        : socket.avatarKey || "player_1";
    const room = rooms[roomId];
    const existingByNickname = room
      ? room.players.find(
          (p) =>
            typeof p.nickname === "string" &&
            p.nickname.trim() === String(nickname || "").trim(),
        )
      : null;
    const isRejoin = Boolean(existingByNickname);

    if (!room) return socket.emit("joinRoomError", "방이 존재하지 않습니다.");
    if (!isRejoin && room.players.length >= room.maxPlayers)
      return socket.emit("joinRoomError", "인원 초과");
    if (room.isGameStarted)
      return socket.emit("joinRoomError", "이미 시작된 게임");

    socket.join(roomId);
    socket.roomId = roomId;
    socket.nickname = nickname;
    socket.avatarKey = avatarKey;
    console.log(`🚪 joinRoom - socket.nickname 설정됨: ${socket.nickname}`);

    // 💡 [추가] nickname으로 DB에서 플레이어 정보 조회 (level, coins, experience 복원)
    const savedData = await getPlayer(nickname);
    if (savedData) {
      console.log(`🔍 joinRoom - ${nickname}의 DB 데이터:`, {
        level: savedData.level,
        coins: savedData.coins,
        exp: savedData.experience,
      });
      socket.level = savedData.level || 1;
      socket.coins = savedData.coins || 0;
      socket.experience = savedData.experience || 0;

      // items 파싱
      let parsedItems = [];
      if (
        typeof savedData.items === "object" &&
        !Array.isArray(savedData.items)
      ) {
        parsedItems = Array.isArray(savedData.items.items)
          ? savedData.items.items
          : [];
      } else if (Array.isArray(savedData.items)) {
        parsedItems = savedData.items;
      } else if (typeof savedData.items === "string") {
        try {
          const parsed = JSON.parse(savedData.items);
          parsedItems = Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed)
              ? parsed
              : [];
        } catch (e) {
          parsedItems = [];
        }
      }
      socket.items = parsedItems;
    } else {
      console.log(`⚠️ joinRoom - ${nickname}의 DB 데이터 없음, 기본값 사용`);
      socket.level = socket.level || 1;
      socket.coins = socket.coins || 0;
      socket.experience = socket.experience || 0;
      socket.items = socket.items || [];
    }

    let joinedPlayer = reconcileRoomPlayerByNickname(room, socket, {
      nickname,
      avatarKey,
    });

    if (!joinedPlayer) {
      const playerData = {
        id: socket.id,
        nickname,
        avatarKey: socket.avatarKey || "player_1",
        level: socket.level || 1, // 💡 socket에 저장된 값을 가져옴
        coins: socket.coins || 0, // 💡 socket에 저장된 값을 가져옴
        experience: socket.experience || 0,
        items: socket.items || [],
        myDeck: [],
        openCard: null,
        openCardStack: [],
        isReady: false,
      };
      console.log(`✅ joinRoom - 플레이어 추가:`, {
        nickname: playerData.nickname,
        level: playerData.level,
        coins: playerData.coins,
      });
      room.players.push(playerData);
      joinedPlayer = playerData;
    }
    io.to(roomId).emit("playerJoined", {
      roomId,
      players: room.players,
      hostId: room.host,
      max: room.maxPlayers,
      roomName: room.roomName,
      newPlayerNickname: nickname,
      isRejoin,
    });
  });

  // 💡 [추가] 공개 방 입장 이벤트
  socket.on("joinPublicRoom", async (data) => {
    console.log("🌐 joinPublicRoom 호출됨, 받은 data:", JSON.stringify(data));
    const roomId = data.roomId;
    const nickname = data.nickname || socket.nickname || "요리사";
    const avatarKey = /^player_[1-4]$/.test(data.avatarKey)
      ? data.avatarKey
      : socket.avatarKey || "player_1";
    const inputPassword = data.password || null;
    const room = rooms[roomId];
    const existingByNickname = room
      ? room.players.find(
          (p) =>
            typeof p.nickname === "string" &&
            p.nickname.trim() === String(nickname || "").trim(),
        )
      : null;
    const isRejoin = Boolean(existingByNickname);

    if (!room) return socket.emit("joinRoomError", "방이 존재하지 않습니다.");
    // 비공개 방이면 비밀번호 검증
    if (!room.isPublic) {
      if (!inputPassword || inputPassword !== room.password) {
        return socket.emit("joinRoomError", "비밀번호가 틀렸습니다.");
      }
    }
    if (!isRejoin && room.players.length >= room.maxPlayers)
      return socket.emit("joinRoomError", "인원 초과");
    if (room.isGameStarted)
      return socket.emit("joinRoomError", "이미 시작된 게임");

    socket.join(roomId);
    socket.roomId = roomId;
    socket.nickname = nickname;
    socket.avatarKey = avatarKey;
    console.log(
      `🌐 joinPublicRoom - socket.nickname 설정됨: ${socket.nickname}`,
    );

    // 💡 [추가] nickname으로 DB에서 플레이어 정보 조회 (level, coins, experience 복원)
    const savedData = await getPlayer(nickname);
    if (savedData) {
      console.log(`🔍 joinPublicRoom - ${nickname}의 DB 데이터:`, {
        level: savedData.level,
        coins: savedData.coins,
        exp: savedData.experience,
      });
      socket.level = savedData.level || 1;
      socket.coins = savedData.coins || 0;
      socket.experience = savedData.experience || 0;

      // items 파싱
      let parsedItems = [];
      if (
        typeof savedData.items === "object" &&
        !Array.isArray(savedData.items)
      ) {
        parsedItems = Array.isArray(savedData.items.items)
          ? savedData.items.items
          : [];
      } else if (Array.isArray(savedData.items)) {
        parsedItems = savedData.items;
      } else if (typeof savedData.items === "string") {
        try {
          const parsed = JSON.parse(savedData.items);
          parsedItems = Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed)
              ? parsed
              : [];
        } catch (e) {
          parsedItems = [];
        }
      }
      socket.items = parsedItems;
    } else {
      console.log(
        `⚠️ joinPublicRoom - ${nickname}의 DB 데이터 없음, 기본값 사용`,
      );
      socket.level = socket.level || 1;
      socket.coins = socket.coins || 0;
      socket.experience = socket.experience || 0;
      socket.items = socket.items || [];
    }

    let joinedPlayer = reconcileRoomPlayerByNickname(room, socket, {
      nickname,
      avatarKey,
    });

    if (!joinedPlayer) {
      const playerData = {
        id: socket.id,
        nickname,
        avatarKey: socket.avatarKey || "player_1",
        level: socket.level || 1, // 💡 이 부분 추가
        coins: socket.coins || 0, // 💡 이 부분 추가
        experience: socket.experience || 0,
        items: socket.items || [], // 💡 이 부분 추가
        myDeck: [],
        openCard: null,
        openCardStack: [],
        isReady: false,
      };
      console.log(`✅ joinPublicRoom - 플레이어 추가:`, {
        nickname: playerData.nickname,
        level: playerData.level,
        coins: playerData.coins,
      });
      room.players.push(playerData);
      joinedPlayer = playerData;
    }

    // 방에 있는 모든 플레이어에게 새 플레이어 입장 알림
    io.to(roomId).emit("playerJoined", {
      roomId,
      players: room.players,
      hostId: room.host,
      max: room.maxPlayers,
      roomName: room.roomName,
      newPlayerNickname: nickname,
      isRejoin,
    });

    // 입장한 플레이어 본인에게 입장 성공 알림
    socket.emit("joinRoomSuccess", {
      roomId,
      players: room.players,
      hostId: room.host,
      maxPlayers: room.maxPlayers,
      roomName: room.roomName,
      isGameStarted: room.isGameStarted || false,
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
        roomName: room.roomName,
      });
    }
  });

  socket.on("lobbyChatMessage", (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const rawMessage =
      typeof data === "object" && data !== null ? data.message : data;
    if (typeof rawMessage !== "string") return;

    const message = rawMessage.trim();
    if (!message) return;

    const safeMessage = message.slice(0, 120);
    const nickname = socket.nickname || "요리사";

    io.to(roomId).emit("lobbyChatMessage", {
      nickname,
      message: safeMessage,
      timestamp: Date.now(),
    });
  });

  socket.on("kickPlayer", (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    // 방장 권한 체크
    if (room.host !== socket.id) {
      return socket.emit("kickFailed", "방장만 플레이어를 강퇴할 수 있습니다.");
    }

    const targetId = data && data.targetId;
    if (!targetId) return;

    // 자기 자신을 강퇴할 수 없음
    if (targetId === socket.id) return;

    // 대상 플레이어가 방에 있는지 확인
    const targetPlayerIndex = room.players.findIndex((p) => p.id === targetId);
    if (targetPlayerIndex === -1) return;

    // 강퇴당한 플레이어의 닉네임 저장
    const kickedNickname =
      room.players[targetPlayerIndex].nickname || "알 수 없는 요리사";

    // 대상 플레이어 제거
    room.players.splice(targetPlayerIndex, 1);

    // 강퇴된 플레이어에게 알림
    io.to(targetId).emit("playerKicked", { kickedId: targetId });

    // 방이 비었으면 방 삭제
    if (room.players.length === 0) {
      delete rooms[roomId];
    } else {
      // 방의 다른 플레이어들에게 플레이어 퇴장 알림
      io.to(roomId).emit("playerLeft", {
        playerId: targetId,
        players: room.players,
        hostId: room.host,
        leftPlayerNickname: kickedNickname,
      });
    }
  });

  socket.on("getOnlineUsers", () => {
    const room = rooms[socket.roomId];
    if (!room) return;

    // 현재 방 외의 모든 온라인 유저 목록 (로비 + 다른 방의 대기 중인 유저)
    const onlineUsers = [];
    const userIds = new Set(room.players.map((p) => p.id)); // 현재 방의 유저 ID

    // 모든 연결된 소켓을 순회하며 수집
    for (const [id, s] of io.sockets.sockets) {
      if (id === socket.id) continue; // 자신은 제외
      if (userIds.has(id)) continue; // 현재 방에 속한 사람은 제외

      // 게임이 시작된 방의 플레이어는 제외
      if (s.roomId && rooms[s.roomId]?.isGameStarted) {
        continue;
      }

      // 온라인 유저 추가
      onlineUsers.push({
        id: s.id,
        nickname: s.nickname || "알 수 없는 요리사",
        avatarKey: s.avatarKey || "player_1",
        level: s.level || 1,
      });
    }

    // 최근 5명만 전송 (역순 정렬)
    const recentUsers = onlineUsers.slice(-5).reverse();

    socket.emit("onlineUsersList", {
      users: recentUsers,
      roomId: socket.roomId,
      roomName: room.roomName,
    });
  });

  socket.on("inviteUser", (data) => {
    const targetId = data && data.targetId;
    const inviterId = socket.id;
    const inviterNickname = socket.nickname || "누군가";
    const inviterRoomId = socket.roomId;
    const room = rooms[inviterRoomId];

    if (!targetId || !room) return;

    // 초대받은 유저에게 팝업 전송
    io.to(targetId).emit("receiveInvite", {
      inviterId: inviterId,
      inviterNickname: inviterNickname,
      roomId: inviterRoomId,
      roomName: room.roomName,
      maxPlayers: room.maxPlayers,
      currentPlayers: room.players.length,
    });
  });

  socket.on("acceptInvite", async (data) => {
    const roomId = data && data.roomId;
    const room = rooms[roomId];

    if (!room) {
      return socket.emit("joinRoomError", "방이 존재하지 않습니다.");
    }

    if (room.players.length >= room.maxPlayers) {
      return socket.emit("joinRoomError", "인원 초과");
    }

    if (room.isGameStarted) {
      return socket.emit("joinRoomError", "이미 시작된 게임");
    }

    // 방에 입장
    socket.join(roomId);
    socket.roomId = roomId;

    // 플레이어 정보 조회
    const savedData = await getPlayer(socket.nickname);
    if (savedData) {
      socket.level = savedData.level || 1;
      socket.coins = savedData.coins || 0;
      socket.experience = savedData.experience || 0;

      let parsedItems = [];
      if (
        typeof savedData.items === "object" &&
        !Array.isArray(savedData.items)
      ) {
        parsedItems = Array.isArray(savedData.items.items)
          ? savedData.items.items
          : [];
      } else if (Array.isArray(savedData.items)) {
        parsedItems = savedData.items;
      } else if (typeof savedData.items === "string") {
        try {
          const parsed = JSON.parse(savedData.items);
          parsedItems = Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed)
              ? parsed
              : [];
        } catch (e) {
          parsedItems = [];
        }
      }
      socket.items = parsedItems;
    } else {
      socket.level = 1;
      socket.coins = 0;
      socket.experience = 0;
      socket.items = [];
    }

    // 플레이어 추가
    room.players.push({
      id: socket.id,
      nickname: socket.nickname,
      avatarKey: socket.avatarKey,
      isReady: false,
      level: socket.level,
      coins: socket.coins,
      experience: socket.experience,
      items: socket.items,
    });

    // 방장 제외하고 모두에게 입장 공지
    io.to(roomId).emit("playerJoined", {
      players: room.players,
      newPlayerNickname: socket.nickname,
      hostId: room.host,
      roomName: room.roomName,
    });

    socket.emit("joinRoomSuccess", {
      players: room.players,
      hostId: room.host,
      roomName: room.roomName,
      isGameStarted: room.isGameStarted,
    });
  });

  socket.on("startGameRequest", (ack) => {
    const respond =
      typeof ack === "function"
        ? (payload) => {
            try {
              ack(payload);
            } catch (error) {
              console.error("startGameRequest ack error:", error);
            }
          }
        : () => {};

    const room = rooms[socket.roomId];
    //if (!room || room.host !== socket.id || room.players.length < 2) return;
    //if (!room.players.filter((p) => p.id !== room.host).every((p) => p.isReady))
    // return;

    // 0. 방이 없으면 무시 (최소한의 안전장치)
    if (!room) {
      respond({ ok: false, reason: "NO_ROOM", socketRoomId: socket.roomId });
      return;
    }

    emitServerDebug(room, "startGameRequest.received", {
      requesterId: socket.id,
      requesterNickname: socket.nickname || null,
      hostId: room.host,
      playerCount: room.players.length,
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isReady: Boolean(p.isReady),
      })),
    });
    respond({
      ok: true,
      stage: "RECEIVED",
      roomId: room.roomId,
      hostId: room.host,
      requesterId: socket.id,
    });

    syncRoomPlayersWithActiveSockets(room, io);

    // 1. 방장 권한 체크
    if (room.host !== socket.id) {
      emitServerDebug(room, "startGameRequest.blocked", {
        reason: "NOT_HOST",
        requesterId: socket.id,
        hostId: room.host,
      });
      respond({
        ok: false,
        reason: "NOT_HOST",
        requesterId: socket.id,
        hostId: room.host,
      });
      return socket.emit("startBlocked", "방장만 게임을 시작할 수 있습니다.");
    }

    // 2. 인원 수 체크 (2명 미만)
    if (room.players.length < 2) {
      emitServerDebug(room, "startGameRequest.blocked", {
        reason: "NOT_ENOUGH_PLAYERS",
        playerCount: room.players.length,
      });
      respond({
        ok: false,
        reason: "NOT_ENOUGH_PLAYERS",
        playerCount: room.players.length,
      });
      return socket.emit(
        "startBlocked",
        "최소 2명 이상의 플레이어가 필요합니다.",
      );
    }

    // 3. 준비 상태 체크 (방장 제외 모두 Ready 인지)
    const notReadyPlayers = room.players.filter(
      (p) => p.id !== room.host && !p.isReady,
    );
    if (notReadyPlayers.length > 0) {
      emitServerDebug(room, "startGameRequest.blocked", {
        reason: "PLAYERS_NOT_READY",
        notReadyPlayers: notReadyPlayers.map((p) => ({
          id: p.id,
          nickname: p.nickname,
        })),
      });
      respond({
        ok: false,
        reason: "PLAYERS_NOT_READY",
        notReadyPlayers: notReadyPlayers.map((p) => ({
          id: p.id,
          nickname: p.nickname,
        })),
      });
      return socket.emit(
        "startBlocked",
        "모든 인원이 준비 완료 상태여야 합니다.",
      );
    }

    let deck = [];
    [1, 2, 3, 4].forEach((f) =>
      [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5].forEach((c) =>
        deck.push({ fruit: f, count: c }),
      ),
    );

    deck.sort(() => Math.random() - 0.5);

    room.isGameStarted = true;
    const hostIndex = room.players.findIndex((p) => p.id === room.host);
    room.turnIndex = hostIndex >= 0 ? hostIndex : 0;
    // 1 => forward, -1 => reverse
    room.turnDirection = 1;
    room.bellLocked = false;
    room.isFlipping = false;
    room.lastFlipTime = null;
    const total = room.players.length;
    // 테스트를 위해 덱 크기 조절 가능 (실제 운영 시 deck 사용)
    // 단위 테스트를 빠르게 하기 위해 각 플레이어당 10장으로 줄입니다.
    const gameDeck = deck.slice(0, total * 10);

    room.players.forEach((p, idx) => {
      p.myDeck = gameDeck.filter((_, i) => i % total === idx);
      p.cards = p.myDeck.length; // 💡 이 줄을 추가해서 개수를 명시적으로 저장
      p.openCard = null;
      p.openCardStack = [];
      p.isReady = false;
      p.isEliminated = false; // 시작할 때 초기화
    });

    injectThunderCardsToPlayers(room.players, THUNDER_CARD_COUNT);
    // Bomb 카드도 동일한 방식으로 덱에 주입 (옵션: 게임당 1장)
    function injectBombCardsToPlayers(players, bombCount) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(bombCount) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * (targetPlayer.myDeck.length + 1),
        );
        if (insertIndex < targetPlayer.myDeck.length) {
          targetPlayer.myDeck[insertIndex] = { type: BOMB_CARD_TYPE };
        } else {
          targetPlayer.myDeck.push({ type: BOMB_CARD_TYPE });
        }
        console.log(
          `💣 inject bomb -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectBombCardsToPlayers(room.players, BOMB_CARD_COUNT);
    // Ton 카드 (턴 반전) 주입
    function injectTonCardsToPlayers(players, tonCount) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(tonCount) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * (targetPlayer.myDeck.length + 1),
        );
        if (insertIndex < targetPlayer.myDeck.length) {
          targetPlayer.myDeck[insertIndex] = { type: TON_CARD_TYPE };
        } else {
          targetPlayer.myDeck.push({ type: TON_CARD_TYPE });
        }
        console.log(
          `🔁 inject ton -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectTonCardsToPlayers(room.players, TON_CARD_COUNT);
    // Pen 카드 주입 (테스트용 기본 1장)
    function injectPenCardsToPlayers(players, penCount) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(penCount) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * (targetPlayer.myDeck.length + 1),
        );
        if (insertIndex < targetPlayer.myDeck.length) {
          targetPlayer.myDeck[insertIndex] = { type: PEN_CARD_TYPE };
        } else {
          targetPlayer.myDeck.push({ type: PEN_CARD_TYPE });
        }
        console.log(
          `🖊️ inject pen -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectPenCardsToPlayers(room.players, PEN_CARD_COUNT);
    // Plus1 카드 주입
    function injectPlus1CardsToPlayers(players, plus1Count) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(plus1Count) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * (targetPlayer.myDeck.length + 1),
        );
        if (insertIndex < targetPlayer.myDeck.length) {
          targetPlayer.myDeck[insertIndex] = { type: PLUS1_CARD_TYPE };
        } else {
          targetPlayer.myDeck.push({ type: PLUS1_CARD_TYPE });
        }
        console.log(
          `➕ inject plus1 -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectPlus1CardsToPlayers(room.players, PLUS1_CARD_COUNT);
    room.players.forEach((player) => {
      player.cards = Array.isArray(player.myDeck) ? player.myDeck.length : 0;
    });
    const thunderCount = room.players.reduce(
      (sum, player) =>
        sum +
        (Array.isArray(player.myDeck)
          ? player.myDeck.filter((card) => isThunderCard(card)).length
          : 0),
      0,
    );
    console.log(`⚡ 멀티 썬더카드 배치 완료: ${thunderCount}장`);
    emitServerDebug(room, "thunder.injected", {
      thunderCount,
    });
    room.players.forEach((player) => {
      const deck = Array.isArray(player.myDeck) ? player.myDeck : [];
      const thunderIndices = deck
        .map((card, index) => (isThunderCard(card) ? index : -1))
        .filter((index) => index >= 0);
      const bombIndices = deck
        .map((card, index) => (isBombCard(card) ? index : -1))
        .filter((index) => index >= 0);
      const tonIndices = deck
        .map((card, index) => (isTonCard(card) ? index : -1))
        .filter((index) => index >= 0);
      const penIndices = deck
        .map((card, index) => (isPenCard(card) ? index : -1))
        .filter((index) => index >= 0);
      const plus1Indices = deck
        .map((card, index) => (isPlus1Card(card) ? index : -1))
        .filter((index) => index >= 0);
      console.log(
        `⚡ ${player.nickname || player.id} thunderIndices=${JSON.stringify(thunderIndices)} bombIndices=${JSON.stringify(bombIndices)} tonIndices=${JSON.stringify(tonIndices)} penIndices=${JSON.stringify(penIndices)} plus1Indices=${JSON.stringify(plus1Indices)} deckSize=${deck.length}`,
      );
      emitServerDebug(room, "thunder.playerDeck", {
        playerId: player.id,
        nickname: player.nickname,
        deckSize: deck.length,
        thunderIndices,
      });
    });
    // emit bomb info for debugging
    const bombCount = room.players.reduce(
      (sum, player) =>
        sum +
        (Array.isArray(player.myDeck)
          ? player.myDeck.filter((c) => isBombCard(c)).length
          : 0),
      0,
    );
    emitServerDebug(room, "bomb.injected", { bombCount });

    const penCount = room.players.reduce(
      (sum, player) =>
        sum +
        (Array.isArray(player.myDeck)
          ? player.myDeck.filter((c) => isPenCard(c)).length
          : 0),
      0,
    );
    emitServerDebug(room, "pen.injected", { penCount });

    const plus1Count = room.players.reduce(
      (sum, player) =>
        sum +
        (Array.isArray(player.myDeck)
          ? player.myDeck.filter((c) => isPlus1Card(c)).length
          : 0),
      0,
    );
    emitServerDebug(room, "plus1.injected", { plus1Count });

    // 추가 디버그: 각 플레이어 덱의 폭탄 인덱스와 덱 요약을 상세히 로깅/전송
    const deckSummaries = room.players.map((player) => {
      const deck = Array.isArray(player.myDeck) ? player.myDeck : [];
      const bombIndices = deck
        .map((card, idx) => (isBombCard(card) ? idx : -1))
        .filter((i) => i >= 0);
      const thunderIndices = deck
        .map((card, idx) => (isThunderCard(card) ? idx : -1))
        .filter((i) => i >= 0);
      // 샘플로 앞/뒤 일부 타입만 보냄(민감 정보 아님)
      const sample = deck
        .slice(0, 20)
        .map((c) => (c && c.type ? c.type : `${c.fruit}_${c.count}`));
      console.log(
        `🔍 [bomb.debug] ${player.nickname || player.id} bombs=${JSON.stringify(bombIndices)} thunders=${JSON.stringify(thunderIndices)} deckSize=${deck.length}`,
      );
      return {
        playerId: player.id,
        nickname: player.nickname,
        deckSize: deck.length,
        bombIndices,
        thunderIndices,
        sample,
      };
    });
    emitServerDebug(room, "bomb.debugDecks", { deckSummaries });

    // 디버그 보정: 만약 폭탄이 전혀 주입되지 않았다면(테스트 환경에서 관찰됨),
    // 각 플레이어 덱에 1장씩 강제로 넣어 확인할 수 있도록 합니다.
    if (bombCount === 0) {
      console.warn(
        "⚠️ bomb.injected detected 0 bombs — forcing 1 bomb per player for debug",
      );
      room.players.forEach((player) => {
        if (Array.isArray(player.myDeck)) {
          const insertIndex = Math.floor(
            Math.random() * (player.myDeck.length + 1),
          );
          player.myDeck.splice(insertIndex, 0, { type: BOMB_CARD_TYPE });
        }
      });

      const forcedBombCount = room.players.reduce(
        (sum, player) =>
          sum +
          (Array.isArray(player.myDeck)
            ? player.myDeck.filter((c) => isBombCard(c)).length
            : 0),
        0,
      );
      console.log(
        `💣 Forced bomb injection complete: totalBombs=${forcedBombCount}`,
      );
      emitServerDebug(room, "bomb.forcedInjected", { forcedBombCount });
    }

    console.log(
      "📊 게임 시작 - room.players 레벨 확인:",
      room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        level: p.level,
      })),
    );
    io.to(room.roomId).emit("gameStart", {
      roomId: room.roomId,
      players: room.players,
      hostId: room.host,
      roomName: room.roomName,
      maxPlayers: room.maxPlayers,
      nextTurnId: room.players[room.turnIndex].id,
    });

    emitServerDebug(room, "gameStart.emitted", {
      nextTurnId: room.players[room.turnIndex].id,
      totalPlayers: room.players.length,
    });
    respond({
      ok: true,
      stage: "GAME_STARTED",
      roomId: room.roomId,
      nextTurnId: room.players[room.turnIndex].id,
      thunderCount,
    });
  });

  socket.on("flipCard", () => {
    const room = rooms[socket.roomId];
    // 상세 스냅샷 로그 추가: flipCard 호출 시점의 방/플레이어 상태
    if (!room) {
      console.log(
        "[TURN_DEBUG]",
        JSON.stringify({
          ts: Date.now(),
          event: "flipCard.blocked",
          reason: "NO_ROOM",
          socketId: socket.id,
          socketNickname: socket.nickname || null,
          socketRoomId: socket.roomId,
        }),
      );
      return;
    }

    try {
      const activeSocketIds =
        io.sockets.adapter.rooms.get(room.roomId) || new Set();
      const playersSnapshot = (room.players || []).map((p) => ({
        id: p && p.id,
        nickname: p && p.nickname,
        cards: Array.isArray(p && p.myDeck)
          ? (p.myDeck || []).length
          : p && p.cards,
        isDisconnected: Boolean(p && p.isDisconnected),
      }));

      console.log(
        "[TURN_DEBUG] flipCard.received.snapshot",
        JSON.stringify({
          ts: Date.now(),
          socketId: socket.id,
          socketNickname: socket.nickname || null,
          roomId: room.roomId,
          isGameStarted: !!room.isGameStarted,
          isFlipping: !!room.isFlipping,
          bellLocked: !!room.bellLocked,
          turnIndex: room.turnIndex,
          activeSocketCount: activeSocketIds.size,
          activeSocketIds: Array.from(activeSocketIds || []),
          players: playersSnapshot,
        }),
      );
    } catch (err) {
      console.warn(
        "[TURN_DEBUG] flipCard snapshot error",
        err && err.stack ? err.stack : err,
      );
    }

    if (!room.isGameStarted || room.isFlipping) return;

    if (room.bellLocked) {
      room.bellLocked = false;
      console.log("🔓 bell 잠금 해제: 다음 카드 제출 감지");
    }

    room.turnIndex = getSafeNextIndex(room);
    let p = room.players[room.turnIndex];

    // 카드가 없는 사람은 이미 탈락자이므로 요청 무시
    if (!p || p.myDeck.length === 0) return;

    if (p.id !== socket.id) {
      const sameNickname =
        typeof socket.nickname === "string" &&
        typeof p.nickname === "string" &&
        socket.nickname.trim() &&
        socket.nickname.trim() === p.nickname.trim();

      if (!sameNickname) return;

      const previousId = p.id;
      p.id = socket.id;
      if (room.host === previousId) {
        room.host = socket.id;
      }
    }

    room.isFlipping = true;

    // 💡 [추가] 카드가 뒤집히는 시점의 시간을 기록 (반응 속도 측정 시작)
    room.lastFlipTime = Date.now();

    // 카드 한 장을 뒤집음
    const card = p.myDeck.pop();
    if (isThunderCard(card)) {
      console.log(
        `⚡ THUNDER DRAWN by ${p.nickname}(${p.id}) remaining=${p.myDeck.length} turnIndex=${room.turnIndex}`,
      );
      emitServerDebug(room, "thunder.drawn", {
        playerId: p.id,
        nickname: p.nickname,
        remaining: p.myDeck.length,
        turnIndex: room.turnIndex,
      });
    }
    p.openCard = card;
    p.openCardStack.push(card);

    // TON 카드: 턴 진행 방향을 반전시킴
    if (isTonCard(card)) {
      room.turnDirection = room.turnDirection === -1 ? 1 : -1;
      console.log(
        `🔁 TON played by ${p.nickname || p.id} -> turnDirection=${room.turnDirection}`,
      );
      emitServerDebug(room, "ton.played", {
        playerId: p.id,
        nickname: p.nickname,
        turnDirection: room.turnDirection,
      });
    }

    // 💡 5 완성 여부 확인
    const totals = getFruitTotals(room.players);
    const isFive = Object.values(totals).some((t) => t === 5);
    const hasThunder = hasThunderCardOnTable(room.players);
    const isBellSuccessWindow = isFive || hasThunder;

    // 💡 [수정] 탈락 로직 변경
    if (p.myDeck.length === 0) {
      if (!isBellSuccessWindow) {
        console.log(`💀 ${p.nickname} 즉시 탈락 (덱 0 & 5 아님)`);
        p.isEliminated = true;
      } else {
        console.log(
          `🔔 ${p.nickname} 기사회생 기회 부여 (덱 0 & 5/썬더 조건 충족)`,
        );
      }
    }

    // [변경점] 카드를 뒤집은 직후 클라이언트에 알림
    io.to(room.roomId).emit("cardFlipped", {
      playerId: socket.id,
      card,
      openCardStack: p.openCardStack, // 💡 [추가] 지금까지 쌓인 전체 카드 배열!
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
      const dir =
        typeof room.turnDirection === "number" ? room.turnDirection : 1;
      room.turnIndex =
        (room.turnIndex + dir + room.players.length) % room.players.length;
      processSkipTurn(room, io);
      room.isFlipping = false;
    }, 150);
  });

  function handleRingForSocket(sock) {
    const room = rooms[sock.roomId];
    if (!room || !room.isGameStarted) return;
    if (room.bellLocked) return;

    // If a flip is currently being processed, wait briefly and re-evaluate
    if (room.isFlipping) {
      setTimeout(() => handleRingForSocket(sock), 50);
      return;
    }

    const hasOpenCards = room.players.some((player) => {
      const hasOpenStack =
        Array.isArray(player.openCardStack) && player.openCardStack.length > 0;
      const hasOpenCard = Boolean(player.openCard);
      return hasOpenStack || hasOpenCard;
    });
    if (!hasOpenCards) {
      return;
    }

    const totals = getFruitTotals(room.players);
    const isFive = Object.values(totals).some((t) => t === 5);
    const hasThunder = hasThunderCardOnTable(room.players);
    const hasBomb = hasBombCardOnTable(room.players);
    // bomb가 테이블에 있으면 어떤 경우에도 종은 실패(패널티)
    const isCorrectBell = !hasBomb && (isFive || hasThunder);
    if (hasBomb) {
      emitServerDebug(room, "bomb.presentOnTable", {
        ts: Date.now(),
        roomId: room.roomId,
      });
    }

    if (isCorrectBell) {
      room.bellLocked = true;

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
        (pl) => pl.id !== socket.id && !pl.isEliminated,
      );

      const recipients = []; // 💡 카드를 실제 받은 사람 ID를 담을 배열

      const hasPen = hasPenCardOnTable(room.players);
      const penaltyPerRecipient = hasPen ? 2 : 1;
      if (hasPen) {
        emitServerDebug(room, "pen.presentOnTable", {
          ts: Date.now(),
          roomId: room.roomId,
        });
      }

      // 추가 디버그: 패널티가 2일 때 각 플레이어의 탑 카드 타입을 전송
      if (penaltyPerRecipient > 1) {
        const topTypes = room.players.map((pl) => {
          const top =
            Array.isArray(pl.openCardStack) && pl.openCardStack.length > 0
              ? pl.openCardStack[pl.openCardStack.length - 1]
              : pl.openCard;
          return {
            playerId: pl.id,
            nickname: pl.nickname,
            topType: top && top.type ? top.type : `${top?.fruit}_${top?.count}`,
          };
        });
        emitServerDebug(room, "pen.debugTopCards", { topTypes });
      }

      if (others.length > 0) {
        others.forEach((recipient) => {
          let givenAny = false;
          for (let k = 0; k < penaltyPerRecipient; k += 1) {
            if (p.myDeck.length > 0) {
              const card = p.myDeck.pop();
              recipient.myDeck.unshift(card);
              givenAny = true;
            }
          }
          if (givenAny) recipients.push(recipient.id);
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

        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: `${p.nickname}님 카드 소진으로 탈락!`,
          players: room.players,
          recipients,
          penaltyPerRecipient,
        });

        if (checkGameOver(room, io)) return;
      } else {
        // 카드가 남은 경우 일반 벌칙 알림
        io.to(room.roomId).emit("bellResult", {
          success: false,
          penaltyId: socket.id,
          message: `${p.nickname}님 틀렸습니다!`,
          players: room.players,
          recipients,
          penaltyPerRecipient,
        });
      }

      processSkipTurn(room, io);
    }
  }

  socket.on("ringBell", () => handleRingForSocket(socket));

  socket.on("disconnect", () => {
    const room = rooms[socket.roomId];
    if (room) {
      // 强퇴 여부 확인 (강퇴된 경우 이미 room.players에서 제거됨)
      const wasInRoom = room.players.some((p) => p.id === socket.id);

      // 1. 💡 나가는 사람의 닉네임을 소켓 객체에서 미리 가져옵니다.
      // (setNickname 등에서 socket.nickname을 저장했다면 가능합니다)
      const leftPlayerNickname = socket.nickname || "누군가";

      // 2. 플레이어 제거
      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[socket.roomId];
      } else if (wasInRoom) {
        // 호스트 위임 로직
        if (room.host === socket.id) room.host = room.players[0].id;

        // 3. 💡 이벤트를 보낼 때 나간 사람의 닉네임을 명시적으로 포함!
        io.to(socket.roomId).emit("playerLeft", {
          players: room.players,
          hostId: room.host,
          leftPlayerNickname: leftPlayerNickname, // 이 값을 추가하세요
          roomName: room.roomName,
        });

        if (room.isGameStarted) {
          if (checkGameOver(room, io)) {
            return;
          }
          processSkipTurn(room, io);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 8080;

ensurePlayersSchema().finally(() => {
  server.listen(PORT, "0.0.0.0", () => console.log(`Server on ${PORT}`));
});
