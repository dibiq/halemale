// AI 봇 및 벨 성공 조건 함수 정의
function computeBellSuccessCondition(room) {
  if (!room || !Array.isArray(room.players)) return false;
  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);
  const hasThunder = hasThunderCardOnTable(room.players);
  const hasBomb = hasBombCardOnTable(room.players);
  const hasNot5 = hasNot5CardOnTable(room.players);
  // 벨 성공 조건: 폭탄이 없고, 번개가 있거나, not5카드가 있으면 5가 아니어야 하고, 아니면 5가 있어야 함
  return !hasBomb && (hasThunder || (hasNot5 ? !isFive : isFive));
}
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

const DAILY_LOGIN_REWARD_COINS = 20;
const DAILY_LOGIN_TIMEZONE = "Asia/Seoul";

function getDateStringInTimeZone(date = new Date(), timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function normalizeDateString(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

function getAllowedOrigins() {
  return [
    "https://halemale.apps.tossmini.com",
    "https://halemale.private-apps.tossmini.com",
    "https://halemale-client.onrender.com",
    "http://192.168.10.113:5173",
    "http://10.89.86.196:5173/",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
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

// ------------------------------------------------------------------
// nickname utility for multiplayer rooms
// ------------------------------------------------------------------
function makeUniqueNickname(room, desired) {
  if (!room || !Array.isArray(room.players)) return desired;
  let base = desired || "요리사";
  base = String(base).trim();
  if (!base) base = "요리사";
  let nickname = base;
  let count = 1;
  // if a player with the same nickname but different socket id exists,
  // append a suffix (#1, #2 etc) until it is unique.
  while (
    room.players.some(
      (p) => p.nickname === nickname && p.id !== this.socket?.id,
    )
  ) {
    nickname = `${base}#${count++}`;
  }
  return nickname;
}

const pendingFinalProfileSyncs = new Map();

function syncRoomPlayersWithActiveSockets(room, io) {
  if (!room || !Array.isArray(room.players)) return;
  const uniquePlayers = [];
  const seenIds = new Set();
  room.players.forEach((player) => {
    if (!player || !player.id) return;
    if (seenIds.has(player.id)) return;
    seenIds.add(player.id);
    uniquePlayers.push(player);
  });
  room.players = uniquePlayers;
}

function markFinalProfileSyncReceived(roomId, playerId) {
  const pending = pendingFinalProfileSyncs.get(roomId);
  if (!pending) return;
  pending.pending.delete(playerId);
  if (pending.pending.size === 0) {
    if (pending.timer) clearTimeout(pending.timer);
    pending.resolve();
    pendingFinalProfileSyncs.delete(roomId);
  }
}

function waitForFinalProfileSync(roomId, playerIds, timeoutMs = 500) {
  return new Promise((resolve) => {
    const pending = new Set(playerIds);
    const timer = setTimeout(() => {
      const remaining = Array.from(pending);
      console.warn(
        `[finalizeGame] final profile sync timeout for room=${roomId}, remaining players=`,
        remaining,
      );
      pendingFinalProfileSyncs.delete(roomId);
      resolve();
    }, timeoutMs);

    pendingFinalProfileSyncs.set(roomId, {
      pending,
      resolve,
      timer,
    });
  });
}

async function savePlayer(
  id,
  level,
  coins,
  items,
  experience,
  ownedCharacters = null,
  currentCharacter = null,
  lastCheckinDate = null,
  avetime = null, // new average reaction time; null means "don't update"
  ratio = null, // correct / (correct+wrong) as percentage; null means "don't update"
) {
  // Normalize id: if a live socket exists for this id and it has a nickname,
  // prefer the nickname as the DB primary key. This prevents accidental
  // writes under socket ids which produce separate DB rows.
  let dbId = id;
  try {
    if (
      typeof id === "string" &&
      typeof io !== "undefined" &&
      io &&
      io.sockets &&
      io.sockets.sockets
    ) {
      const sock = io.sockets.sockets.get(id);
      if (sock && typeof sock.nickname === "string" && sock.nickname.trim()) {
        dbId = sock.nickname.trim();
      }
    }
  } catch (e) {
    // ignore mapping errors
  }

  console.log(
    `\n[savePlayer] id=${id} dbId=${dbId} level=${level} coins=${coins} exp=${experience} avetime=${avetime} ratio=${ratio}`,
  );
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
      avetime,
      ratio,
      owned_characters,
      current_character,
      last_checkin_date,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      COALESCE($9::double precision, 0),
      COALESCE($10::double precision, 0),
      COALESCE($6::jsonb, '[]'::jsonb),
      COALESCE($7, 'player_1'),
      $8,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) 
    DO UPDATE SET 
      level = EXCLUDED.level,
      coins = EXCLUDED.coins,
      items = EXCLUDED.items,
      experience = EXCLUDED.experience,
      /* 0 is treated as "no value" so we don't wipe existing average */
      avetime = COALESCE(NULLIF(EXCLUDED.avetime::double precision, 0::double precision), players.avetime),
      ratio = COALESCE(EXCLUDED.ratio::double precision, players.ratio),
      owned_characters = COALESCE($6::jsonb, players.owned_characters),
      current_character = COALESCE($7, players.current_character),
      last_checkin_date = COALESCE($8, players.last_checkin_date),
      updated_at = CURRENT_TIMESTAMP;
  `;
  try {
    const result = await pool.query(query, [
      dbId,
      level,
      coins,
      JSON.stringify(items),
      experience,
      normalizedOwnedCharacters
        ? JSON.stringify(normalizedOwnedCharacters)
        : null,
      normalizedCurrentCharacter,
      lastCheckinDate,
      avetime,
      ratio,
    ]);
    // debug whether this was an insert or update
    if (result && result.command) {
      console.log(`[savePlayer] db ${result.command} rows=${result.rowCount}`);
    }
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
    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS last_checkin_date DATE;
    `);
    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS avetime DOUBLE PRECISION NOT NULL DEFAULT 0;
    `);
    await pool.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS ratio DOUBLE PRECISION NOT NULL DEFAULT 0;
    `);
    console.log("✅ players.experience/avetime/ratio 컬럼 확인 완료");
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

// DB 기반 닉네임 중복 체크
async function checkNicknameExists(nickname) {
  if (!pool) return false;

  try {
    const res = await pool.query("SELECT id FROM players WHERE id = $1", [
      nickname,
    ]);
    return res.rows.length > 0;
  } catch (err) {
    console.error("❌ 닉네임 중복 체크 에러:", err);
    return false;
  }
}

// DB 기반 고유 닉네임 생성
async function makeUniqueNicknameFromDB(desiredNickname) {
  if (!pool) return desiredNickname;

  let base = desiredNickname || "요리사";
  base = String(base).trim();
  if (!base) base = "요리사";

  let nickname = base;
  let count = 1;

  try {
    // 원본 닉네임이 이미 존재하는지 확인
    while (await checkNicknameExists(nickname)) {
      nickname = `${base}#${count++}`;
    }
    return nickname;
  } catch (err) {
    console.error("❌ 고유 닉네임 생성 에러:", err);
    return `${base}#${Date.now()}`; // 에러 시 타임스탬프를 suffix로 사용
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
app.use(express.json()); // JSON 파싱 미들웨어
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
const RANK_REWARD_XP = [40, 20, 10];
const WIN_REWARD_XP = RANK_REWARD_XP[0];
const XP_PER_LEVEL = 100;
const THUNDER_CARD_TYPE = "thunder";
const THUNDER_CARD_COUNT = 1;

const BOMB_CARD_TYPE = "bomb";
// Multiplayer default counts
const BOMB_CARD_COUNT = 1;
const TON_CARD_TYPE = "ton";
const TON_CARD_COUNT = 1;
const PEN_CARD_TYPE = "pen";
const PEN_CARD_COUNT = 0;
const PLUS1_CARD_TYPE = "plus1";
const PLUS1_CARD_COUNT = 1;
const COIN_CARD_TYPE = "coin";
const COIN_CARD_COUNT = 1;
const COIN_CARD_REWARD = 30;
const PLUS2_CARD_TYPE = "plus2";
const PLUS2_CARD_COUNT = 0;
const NOT5_CARD_TYPE = "not5";
const NOT5_CARD_COUNT = 0;
// 아이템 ID constants (client와 매칭)
const SHIELD_CARD_ID = 5;
const SERVER_BUILD = "2026-02-24-thunder-insert-v1";

// startup debug
console.log("[SERVER] index.js loaded, build=", SERVER_BUILD);

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

function isCoinCard(card) {
  return Boolean(card) && card.type === COIN_CARD_TYPE;
}

function isPlus2Card(card) {
  return Boolean(card) && card.type === PLUS2_CARD_TYPE;
}

function isNot5Card(card) {
  return Boolean(card) && card.type === NOT5_CARD_TYPE;
}

function hasThunderCardOnTable(players) {
  return players.some((player) => {
    if (!player) return false;
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    if (player.isEliminated && isBombCard(top)) return false;
    return isThunderCard(top);
  });
}

function hasBombCardOnTable(players) {
  return players.some((player) => {
    if (!player) return false;
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    // If eliminated and top is bomb, ignore (treat as not on table)
    if (player.isEliminated && isBombCard(top)) return false;
    return isBombCard(top);
  });
}

function hasPenCardOnTable(players) {
  return players.some((player) => {
    if (!player) return false;
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    if (player.isEliminated && isBombCard(top)) return false;
    return isPenCard(top);
  });
}

function hasPlus1CardOnTable(players) {
  return players.some((player) => {
    if (!player) return false;
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    if (player.isEliminated && isBombCard(top)) return false;
    return isPlus1Card(top);
  });
}

function hasPlus2CardOnTable(players) {
  return players.some((player) => {
    if (!player) return false;
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    if (player.isEliminated && isBombCard(top)) return false;
    return isPlus2Card(top);
  });
}

function hasNot5CardOnTable(players) {
  return players.some((player) => {
    if (!player) return false;
    const top =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0
        ? player.openCardStack[player.openCardStack.length - 1]
        : player.openCard;
    if (player.isEliminated && isBombCard(top)) return false;
    return isNot5Card(top);
  });
}

function applyCoinCardReward(room, player, io) {
  if (!room || !player) return null;
  const reward = Math.max(0, Number(COIN_CARD_REWARD) || 0);
  if (reward <= 0) return null;

  player.coins = (Number(player.coins) || 0) + reward;
  let coinTotal = Number(player.coins) || 0;

  const targetSocket =
    io && io.sockets && io.sockets.sockets
      ? io.sockets.sockets.get(player.id)
      : null;

  if (targetSocket) {
    targetSocket.coins = (Number(targetSocket.coins) || 0) + reward;
    coinTotal = Number(targetSocket.coins) || coinTotal;

    const mergedItems = {
      items: Array.isArray(targetSocket.items) ? targetSocket.items : [],
      specialCards: targetSocket.specialCards || {},
    };

    const ratioArg =
      typeof targetSocket.ratio === "number" &&
      Number.isFinite(targetSocket.ratio)
        ? targetSocket.ratio
        : null;

    savePlayer(
      targetSocket.nickname,
      targetSocket.level || 1,
      targetSocket.coins,
      mergedItems,
      targetSocket.experience || 0,
      targetSocket.ownedCharacters || ["player_1"],
      targetSocket.currentCharacter || targetSocket.avatarKey || "player_1",
      null,
      typeof targetSocket.avetime === "number" && targetSocket.avetime > 0
        ? targetSocket.avetime
        : null,
      ratioArg,
    ).catch((err) => {
      console.warn("coin reward save failed", err);
    });

    io.to(targetSocket.id).emit("myProfile", {
      nickname: targetSocket.nickname,
      level: Number(targetSocket.level) || 1,
      coins: Number(targetSocket.coins) || 0,
      items: mergedItems.items,
      experience: Number(targetSocket.experience) || 0,
      avetime: Number(targetSocket.avetime) || 0,
      ratio: Number(targetSocket.ratio) || 0,
      avatarKey:
        targetSocket.currentCharacter || targetSocket.avatarKey || "player_1",
      specialCards: targetSocket.specialCards || {},
      owned_characters: targetSocket.ownedCharacters || ["player_1"],
      current_character: targetSocket.currentCharacter || "player_1",
    });
  }

  return { reward, coinTotal };
}

function injectThunderCardsToPlayers(players, thunderCount) {
  if (!Array.isArray(players) || players.length === 0) return;

  const drawablePlayers = players.filter(
    (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
  );
  if (drawablePlayers.length === 0) return;

  const count = Math.max(0, Number(thunderCount) || 0);
  for (let i = 0; i < count; i += 1) {
    const targetPlayer =
      drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
    if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

    const insertIndex = Math.floor(Math.random() * targetPlayer.myDeck.length);
    targetPlayer.myDeck[insertIndex] = { type: THUNDER_CARD_TYPE };
  }
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
  player.avetime =
    typeof socket.avetime === "number" && socket.avetime > 0
      ? socket.avetime
      : player.avetime || 0;
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
    itemMode: room.itemMode !== false,
    gameMode: room.gameMode || "allin",
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

// 닉네임 중복 체크 API
app.post("/api/check-nickname", async (req, res) => {
  try {
    const { nickname } = req.body;

    if (!nickname || typeof nickname !== "string") {
      return res.status(400).json({ error: "올바른 닉네임을 입력해주세요" });
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      return res.status(400).json({ error: "닉네임은 비어있을 수 없습니다" });
    }

    const exists = await checkNicknameExists(trimmedNickname);

    if (exists) {
      // 중복된 경우 에러 반환
      res.status(409).json({
        error: "이미 사용 중인 닉네임입니다",
        exists: true,
        nickname: trimmedNickname,
      });
    } else {
      // 중복되지 않은 경우 사용 가능
      res.json({
        success: true,
        exists: false,
        nickname: trimmedNickname,
      });
    }
  } catch (error) {
    console.error("❌ 닉네임 체크 API 에러:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
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
  const plus2Active = hasPlus2CardOnTable(players);
  const extraPerCard = (plus1Active ? 1 : 0) + (plus2Active ? 2 : 0);
  players.forEach((p) => {
    if (!p) return;
    const top =
      Array.isArray(p.openCardStack) && p.openCardStack.length > 0
        ? p.openCardStack[p.openCardStack.length - 1]
        : p.openCard;
    // If player is eliminated and their top is a bomb, ignore it for totals.
    if (p.isEliminated && isBombCard(top)) return;
    if (
      top &&
      Number.isFinite(Number(top.fruit)) &&
      Number.isFinite(Number(top.count))
    ) {
      const base = Number(top.count) || 0;
      totals[top.fruit] += base + extraPerCard;
    }
  });
  return totals;
}

const TIME_ATTACK_DURATION_MS = 1 * 60 * 1000;

function clearTimeAttackTimer(room) {
  if (!room) return;
  if (room.timeAttackTimer) {
    clearTimeout(room.timeAttackTimer);
  }
  room.timeAttackTimer = null;
  room.timeAttackEndsAt = null;
}

async function finalizeGame(room, io, { winner, sorted, message }) {
  // accumulate debug strings to send back in gameEnded payload
  const debugLines = [];
  debugLines.push("[DEBUG] finalizeGame called");
  debugLines.push(`  roomId=${room && room.roomId}`);
  debugLines.push(`  winner=${winner && winner.nickname}`);
  debugLines.push(
    `  sortedCount=${Array.isArray(sorted) ? sorted.length : null}`,
  );
  debugLines.push(
    "[DEBUG] finalizeGame entry trace (should appear whenever a game ends)",
  );

  console.log("[DEBUG] finalizeGame called", {
    roomId: room && room.roomId,
    winner: winner && winner.nickname,
    sortedCount: Array.isArray(sorted) ? sorted.length : null,
  });
  // additional trace to ensure we see this in logs
  console.log(
    "[DEBUG] finalizeGame entry trace (should appear whenever a game ends)",
  );
  if (!room || !io || !winner || !Array.isArray(sorted)) {
    console.log("[DEBUG] finalizeGame aborted due to invalid args");
    debugLines.push("[DEBUG] finalizeGame aborted due to invalid args");
    return;
  }

  clearTimeAttackTimer(room);
  room.isGameStarted = false;

  const beforeStateById = new Map(
    room.players.map((p) => {
      const beforeExperience = Number(p.experience) || 0;
      const beforeLevel = Number(p.level) || 1;
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

  // 순위별 보상(1등 30, 2등 20, 3등 10)
  sorted.forEach((player, rankIndex) => {
    const coinReward = RANK_REWARD_COINS[rankIndex] || 0;
    if (coinReward > 0) {
      player.coins = (Number(player.coins) || 0) + coinReward;
    }
    // NOTE: Removed end-of-game rank-based XP distribution. XP is now
    // awarded during gameplay (per-card) on the client/server flow.
    // Preserve existing experience; do not overwrite player.level here.
  });

  // compute final average from any accumulated samples (ensures accuracy at game end)
  if (room.reactionSamples && typeof room.reactionSamples === "object") {
    room.players.forEach((p) => {
      const samples = room.reactionSamples[p.id];
      if (Array.isArray(samples) && samples.length > 0) {
        const sum = samples.reduce((a, b) => a + b, 0);
        p.avetime = +(sum / samples.length / 1000).toFixed(2);
      }
    });
  }
  // if we still have no average (no samples at all), fall back to whatever
  // socket stored from prior games so we don't drop an existing value.
  room.players.forEach((p) => {
    if (!p.avetime || p.avetime === 0) {
      const sock = io.sockets && io.sockets.sockets.get(p.id);
      if (sock && typeof sock.avetime === "number" && sock.avetime > 0) {
        p.avetime = sock.avetime;
      }
    }
  });

  // debug print before saving
  console.log("[GAME END] preparing to save avetime values:");
  console.log(
    "[GAME END] about to emit gameEnded for room",
    room && room.roomId,
  );
  room.players.forEach((p) => {
    console.log(`  player=${p.nickname} id=${p.id} avetime=${p.avetime}`);
  });

  // Ask clients for a final profile sync (including experience) to avoid
  // race conditions where the client's last XP update hasn't arrived yet.
  // Wait until all players have responded or until timeout.
  try {
    const expectedIds = room.players.map((p) => p.id).filter(Boolean);
    console.log(
      "[GAME END] requesting final profile sync for players:",
      expectedIds,
    );
    io.to(room.roomId).emit("requestProfileSync", { reason: "final" });
    await waitForFinalProfileSync(room.roomId, expectedIds, 500);
    console.log("[GAME END] final profile sync wait completed");
  } catch (e) {
    console.warn("final profile sync wait failed", e);
  }

  // before saving, optionally record current socket avetime if already populated
  // (won't overwrite sample-based value when hook is disabled)
  room.players.forEach((p) => {
    const currentCoins = Number(p.coins) || 0;
    const currentItems = Array.isArray(p.items) ? p.items : [];

    // Ensure we consistently resolve the player by a single unique key.
    // Prefer nickname (DB key), fall back to socket id when needed.
    const playerKey =
      typeof p.nickname === "string" && p.nickname.trim()
        ? p.nickname.trim()
        : p.id;

    try {
      let sock =
        io.sockets && io.sockets.sockets ? io.sockets.sockets.get(p.id) : null;

      // If lookup by socket id failed, try to find a socket by nickname or id.
      if (!sock && io.sockets && io.sockets.sockets) {
        try {
          for (const [sid, s] of io.sockets.sockets) {
            if (!s) continue;
            if (s.nickname === playerKey || s.id === playerKey) {
              sock = s;
              break;
            }
          }
        } catch (e) {
          /* ignore */
        }
      }

      // If socket exists, ensure room snapshot stays in sync with its latest state.
      if (sock) {
        if (typeof sock.experience !== "undefined")
          p.experience = sock.experience;
        if (typeof sock.level !== "undefined") p.level = sock.level;
        if (typeof sock.coins !== "undefined") p.coins = sock.coins;
        if (Array.isArray(sock.items)) p.items = sock.items;
      }

      const dbId = (sock && sock.nickname) || p.nickname || p.id;
      const av =
        typeof p.avetime === "number" && p.avetime > 0 ? p.avetime : null;
      const ratioToSave =
        sock && Number.isFinite(sock.ratio)
          ? sock.ratio
          : typeof p.ratio === "number"
            ? p.ratio
            : null;

      const expToSave = Number(p.experience) || 0;
      const levelToSave = Number(p.level) || 1;

      console.log("[finalizeGame] save values for", playerKey, {
        expToSave,
        levelToSave,
        sockExists: !!sock,
        pExp: p.experience,
        pLevel: p.level,
        avetime: av,
        ratio: ratioToSave,
      });
      console.log(
        `[finalizeGame] calling savePlayer for id=${p.id} nickname=${p.nickname} dbId=${dbId} avetime=${av} ratio=${ratioToSave}`,
      );

      savePlayer(
        dbId,
        levelToSave,
        currentCoins,
        currentItems,
        expToSave,
        null,
        null,
        null,
        av,
        ratioToSave,
      ).catch((e) => console.warn("savePlayer game end failed", e));
    } catch (e) {
      console.warn("finalizeGame savePlayer wrapper error", e);
    }

    // Do not emit level/experience at game end to avoid overwriting
    // gameplay-updated values on clients. Emit only non-XP profile fields.
    io.to(p.id).emit("myProfile", {
      nickname: p.nickname,
      coins: currentCoins,
      items: currentItems,
      avetime: p.avetime ?? 0,
      ratio: typeof p.ratio === "number" ? p.ratio : 0,
      avatarKey: p.avatarKey || "player_1",
      specialCards: p.specialCards || {},
      owned_characters: p.owned_characters || [],
      current_character: p.current_character || p.avatarKey || "player_1",
    });
  });

  io.to(room.roomId).emit("gameEnded", {
    message: message || `게임 종료! ${winner.nickname}님의 최종 승리!`,
    // include average times by player id for debugging on client
    avetimeById: room.players.reduce((m, p) => {
      m[p.id] = p.avetime || 0;
      return m;
    }, {}),
    // attach debug strings from server execution so the client can see them
    serverDebug: debugLines,
    ranking: sorted.map((p) => {
      const before = beforeStateById.get(p.id) || {
        beforeCoins: Number(p.coins) || 0,
      };
      const rankIndex = sorted.findIndex((sp) => sp.id === p.id);
      const earnedCoins =
        rankIndex >= 0 ? RANK_REWARD_COINS[rankIndex] || 0 : 0;
      const finalCoins = Number(p.coins) || 0;
      return {
        id: p.id,
        nickname: p.nickname,
        cards: p.myDeck?.length || 0,
        currentCoins: before.beforeCoins,
        earnedCoins,
        finalCoins,
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
  });
}

function handleTimeAttackExpiry(room, io) {
  console.log(
    "[DEBUG] handleTimeAttackExpiry called for room",
    room && room.roomId,
  );
  if (!room || !room.isGameStarted) {
    console.log("[AI] scheduleAiTurn: room 없음 또는 게임 미시작");
    return;
  }
  const sorted = [...room.players].sort(
    (a, b) => (b.myDeck?.length || 0) - (a.myDeck?.length || 0),
  );
  const winner = sorted[0] || room.players[0];
  finalizeGame(room, io, {
    winner,
    sorted,
    message: `시간 종료! ${winner.nickname}님의 최종 승리!`,
  });
}

function checkGameOver(room, io, options = {}) {
  console.log(
    "[DEBUG] checkGameOver called for room",
    room && room.roomId,
    "options",
    options,
  );
  const forceEliminateZeroDeck = options.forceEliminateZeroDeck === true;
  // 덱이 0장인 사람들을 판별
  // If there's an active bell-success window (5 or thunder on table),
  // players with 0 cards are given a temporary reprieve.
  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);
  const hasThunder = hasThunderCardOnTable(room.players);
  const hasNot5 = hasNot5CardOnTable(room.players);
  const isBellSuccessWindow = hasThunder || (hasNot5 ? !isFive : isFive);

  room.players.forEach((p) => {
    const hasNoDeck = !p.myDeck || p.myDeck.length === 0;
    if (hasNoDeck) {
      // Bots should not stall the match when they run out of cards.
      if (p && p.isBot) {
        p.isEliminated = true;
      } else {
        // Only mark eliminated when there is no active success window
        // unless forced (e.g., thief steals all remaining cards)
        p.isEliminated = forceEliminateZeroDeck ? true : !isBellSuccessWindow;
      }
    } else {
      p.isEliminated = false;
    }
  });

  const survivors = room.players.filter((p) => !p.isEliminated);
  const hasBots = room.players.some((p) => p && p.isBot);
  const humans = room.players.filter((p) => p && !p.isBot);
  const allHumansEliminated =
    humans.length > 0 && humans.every((p) => p.isEliminated);
  const forceEndForHumanElim = hasBots && allHumansEliminated;

  // 실시간으로 플레이어 상태 업데이트 (프론트에서 [탈락] 표시용)
  io.to(room.roomId).emit("updatePlayerStatus", {
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isEliminated: p.isEliminated,
      cards: p.myDeck?.length || 0,
    })),
  });

  if ((survivors.length <= 1 || forceEndForHumanElim) && room.isGameStarted) {
    console.log("[DEBUG] checkGameOver triggering finalize", {});
    console.log("[DEBUG] checkGameOver winner/sorted path active");
    const winner = forceEndForHumanElim
      ? survivors[0] || room.players[0]
      : survivors.length === 1
        ? survivors[0]
        : room.players[0];
    const sorted = [...room.players].sort(
      (a, b) => (b.myDeck?.length || 0) - (a.myDeck?.length || 0),
    );

    finalizeGame(room, io, {
      winner,
      sorted,
      message: `게임 종료! ${winner.nickname}님의 최종 승리!`,
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
  console.log(
    `[AI][DEBUG] processSkipTurn: 진입 room=${room && room.roomId} turnIndex=${room && room.turnIndex}`,
  );
  if (!room.isGameStarted) {
    console.log("[AI][DEBUG] processSkipTurn: 게임 미시작");
    return;
  }

  // clear any bell lock when advancing the turn; this covers cases where
  // processSkipTurn is called from elsewhere as well, including right after
  // a bell result has been emitted.
  if (room.bellLocked) room.bellLocked = false;

  let loopCount = 0; // reset counter for this call

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
    console.log(
      `[AI][DEBUG] processSkipTurn: turnChanged emit nextTurnId=${activePlayer.id}`,
    );
    io.to(room.roomId).emit("turnChanged", {
      nextTurnId: activePlayer.id,
      players: room.players.map((p) => ({
        id: p.id,
        cards: p.myDeck?.length || 0,
      })),
    });
    // Defensive: if this change caused a game-over condition, finalize now.
    if (checkGameOver(room, io)) {
      console.log(
        `[AI][DEBUG] processSkipTurn: checkGameOver triggered after turnChanged for room=${room && room.roomId}`,
      );
      return;
    }
  } else {
    console.log("[AI][DEBUG] processSkipTurn: activePlayer 없음");
  }

  // Schedule AI turn if the next player is a bot.
  console.log(
    `[AI][DEBUG] processSkipTurn: scheduleAiTurn 호출 room=${room.roomId} turnIndex=${room.turnIndex}`,
  );
  scheduleAiTurn(room, io);
  console.log(`[AI][DEBUG] processSkipTurn: scheduleAiTurn 호출 완료`);
}

const MULTI_AI_BASE_PROFILE = {
  flipDelay: 80,
  reactionTime: 220,
};

const MULTI_AI_SLOWDOWN_MS = 520;
const SPECIAL_CARD_PAUSE_MS = 1400;

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomTriangular(min, max, mode) {
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function getSpecialPauseRemaining(room) {
  if (!room || !room.specialPauseUntil) return 0;
  return Math.max(0, room.specialPauseUntil - Date.now());
}

function extendSpecialPause(room, durationMs = SPECIAL_CARD_PAUSE_MS) {
  if (!room) return;
  const until = Date.now() + durationMs;
  room.specialPauseUntil = Math.max(room.specialPauseUntil || 0, until);
}

function getHumanReactionBaseline(room) {
  const samples = [];
  if (room && room.reactionSamples) {
    Object.values(room.reactionSamples).forEach((arr) => {
      if (Array.isArray(arr)) samples.push(...arr);
    });
  }

  if (samples.length === 0) return MULTI_AI_BASE_PROFILE.reactionTime;

  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return clampNumber(Math.round(median), 800, 3000);
}

function buildMatchAiProfile(room) {
  // Use current players' reaction speed as a baseline.
  const baseline = getHumanReactionBaseline(room) + MULTI_AI_SLOWDOWN_MS;
  const reactionFactor = randomTriangular(1.0, 1.5, 1.2);
  const flipFactor = randomTriangular(0.9, 1.4, 1.1);
  const reactionTime = clampNumber(
    Math.round(baseline * reactionFactor),
    1000,
    2400,
  );
  const flipDelay = clampNumber(Math.round(baseline * flipFactor), 500, 2400);

  return {
    flipDelay,
    reactionTime,
    baseline,
  };
}

function ensureAiState(room) {
  if (!room) return;
  if (typeof room.aiCounter !== "number") room.aiCounter = 0;
  if (!room.aiTimers) {
    room.aiTimers = { turn: null, bells: {} };
  }
  if (!room.aiTimers.bells) room.aiTimers.bells = {};
}

function clearAiTurnTimer(room) {
  if (room && room.aiTimers && room.aiTimers.turn) {
    clearTimeout(room.aiTimers.turn);
    room.aiTimers.turn = null;
  }
}

function clearAiBellTimers(room) {
  if (!room || !room.aiTimers || !room.aiTimers.bells) return;
  Object.values(room.aiTimers.bells).forEach((timer) => {
    if (timer) clearTimeout(timer);
  });
  room.aiTimers.bells = {};
}

function isBotPlayer(player) {
  return Boolean(player && player.isBot);
}

function pickNextHostId(room) {
  if (!room || !Array.isArray(room.players) || room.players.length === 0) {
    return null;
  }
  const human = room.players.find((p) => p && !p.isBot);
  return (human || room.players[0]).id;
}

function buildAiPlayer(room) {
  ensureAiState(room);
  const aiNumber = room.aiCounter + 1;
  room.aiCounter += 1;

  return {
    id: `AI_BOT_${aiNumber}`,
    nickname: `AI ${aiNumber}`,
    avatarKey: `player_${((aiNumber - 1) % 4) + 1}`,
    level: 1,
    coins: 0,
    experience: 0,
    specialCards: {},
    items: [],
    myDeck: [],
    openCard: null,
    openCardStack: [],
    isReady: true,
    isEliminated: false,
    isBot: true,
    aiProfile: null,
  };
}

function scheduleAiTurn(room, io) {
  if (!room) {
    console.log("[AI][DEBUG] scheduleAiTurn: room 없음");
    return;
  }
  if (!room.isGameStarted) {
    console.log("[AI][DEBUG] scheduleAiTurn: 게임 미시작");
    return;
  }
  console.log("[AI][DEBUG] scheduleAiTurn: ensureAiState, clearAiTurnTimer");
  ensureAiState(room);
  clearAiTurnTimer(room);

  const debugRoom = room.roomId || "?";
  console.log(
    `[AI] scheduleAiTurn start room=${debugRoom} turnIndex=${room.turnIndex}`,
  );
  emitServerDebug(room, "ai.scheduleStart", { turnIndex: room.turnIndex });

  // always give bots a chance to ring first
  console.log("[AI][DEBUG] scheduleAiTurn: scheduleAiBell 호출");
  scheduleAiBell(room, io);

  if (room.bellPending || room.bellLocked) {
    console.log(
      `[AI][DEBUG] scheduleAiTurn: bellPending=${!!room.bellPending}, bellLocked=${!!room.bellLocked} -> 턴 지연`,
    );
    room.aiTimers.turn = setTimeout(() => scheduleAiTurn(room, io), 50);
    return;
  }

  const pauseRemaining = getSpecialPauseRemaining(room);
  if (pauseRemaining > 0) {
    console.log(
      `[AI][DEBUG] scheduleAiTurn: pauseRemaining=${pauseRemaining} -> 턴 지연`,
    );
    room.aiTimers.turn = setTimeout(
      () => scheduleAiTurn(room, io),
      pauseRemaining + 20,
    );
    return;
  }

  const current = room.players[room.turnIndex];
  if (!isBotPlayer(current)) {
    console.log(
      `[AI][DEBUG] scheduleAiTurn: 현재 턴 플레이어가 봇이 아님 (id=${current && current.id}) -> 스킵`,
    );
    return;
  }
  if (!current.myDeck || current.myDeck.length === 0) {
    console.log(
      `[AI][DEBUG] scheduleAiTurn: 봇 덱 없음 (id=${current && current.id}) -> 스킵`,
    );
    return;
  }
  if (room.isFlipping) {
    console.log(`[AI][DEBUG] scheduleAiTurn: room.isFlipping true -> 스킵`);
    return;
  }

  if (computeBellSuccessCondition(room)) {
    console.log(
      `[AI][DEBUG] scheduleAiTurn: bell 조건 true (id=${current.id}) -> 2초 후 벨 시도`,
    );
    setTimeout(() => {
      handleAiBell(room, io, current.id);
    }, 1759);
    return;
  }

  console.log(
    `[AI][DEBUG] scheduleAiTurn: 봇 ${current.id} 카드 제출 예약 (2200ms 후)`,
  );
  room.aiTimers.turn = setTimeout(() => {
    console.log(`[AI] flip timeout fired for room=${debugRoom}`);
    if (!room.isGameStarted) {
      console.log("[AI] flip timeout: 게임 종료됨");
      return;
    }
    const active = room.players[room.turnIndex];
    if (
      active &&
      active.id === current.id &&
      !room.bellPending &&
      !computeBellSuccessCondition(room)
    ) {
      console.log(`[AI] handleAiFlip 실행: ${current.id}`);
      handleAiFlip(room, io, current.id);
    } else {
      console.log(
        `[AI] flip aborted: active=${active && active.id}, bellPending=${!!room.bellPending}, bellCondition=${computeBellSuccessCondition(room)}`,
      );
    }
  }, 2200);
}

function scheduleAiBell(room, io) {
  if (!room) {
    console.log("[AI][DEBUG] handleAiFlip: room 없음");
    return;
  }
  if (!room.isGameStarted) {
    console.log("[AI][DEBUG] handleAiFlip: 게임 미시작");
    return;
  }
  if (room.bellLocked || room.bellPending) {
    console.log("[AI] scheduleAiBell skipped due to lock/pending", {
      bellLocked: room.bellLocked,
      bellPending: room.bellPending,
    });
    return;
  }
  ensureAiState(room);
  clearAiBellTimers(room);

  const pauseRemaining = getSpecialPauseRemaining(room);
  if (pauseRemaining > 0) {
    console.log("[AI] scheduleAiBell pauseRemaining", pauseRemaining);
    room.aiTimers.bells._pause = setTimeout(() => {
      scheduleAiBell(room, io);
    }, pauseRemaining + 20);
    return;
  }

  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);
  const hasThunder = hasThunderCardOnTable(room.players);
  const hasBomb = hasBombCardOnTable(room.players);
  const hasNot5 = hasNot5CardOnTable(room.players);
  const isCorrectBell =
    !hasBomb && (hasThunder || (hasNot5 ? !isFive : isFive));

  if (!isCorrectBell) return;

  room.players.forEach((player) => {
    if (!isBotPlayer(player)) return;
    if (player.isEliminated) return;
    if (!player.myDeck || player.myDeck.length <= 0) return;

    // 봇 벨 반응 딜레이를 2초(2000ms)로 조정
    const delay = 1750;
    room.aiTimers.bells[player.id] = setTimeout(() => {
      handleAiBell(room, io, player.id);
    }, delay);
  });

  // retry if the bell condition somehow persists but nobody rang
  room.aiTimers.bells._retry = setTimeout(() => {
    if (!room || !room.isGameStarted) return;
    if (
      !room.bellLocked &&
      !room.bellPending &&
      computeBellSuccessCondition(room)
    ) {
      scheduleAiBell(room, io);
    }
  }, 2200);
}

function handleAiFlip(room, io, playerId) {
  if (!room || !room.isGameStarted) return;
  console.log(
    "[AI] handleAiFlip called for",
    playerId,
    "turnIndex=",
    room.turnIndex,
  );
  if (room.bellPending) {
    console.log("[AI][DEBUG] handleAiFlip: bellPending true -> 스킵");
    return;
  }
  if (computeBellSuccessCondition(room)) {
    console.log("[AI][DEBUG] handleAiFlip: bell 조건 true -> 스킵");
    return;
  }
  if (room.bellLocked) {
    console.log("[AI][DEBUG] handleAiFlip: bellLocked true -> 스킵");
    return;
  }
  if (room.isFlipping) {
    console.log("[AI][DEBUG] handleAiFlip: isFlipping true -> 스킵");
    return;
  }
  if (getSpecialPauseRemaining(room) > 0) {
    console.log("[AI][DEBUG] handleAiFlip: pauseRemaining > 0 -> 스킵");
    return;
  }

  // cancel any pending turn timer for this room; the bot is about
  // to act so there is no need for the scheduled callback anymore.
  clearAiTurnTimer(room);

  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) {
    console.log(`[AI][DEBUG] handleAiFlip: playerId=${playerId} 플레이어 없음`);
    return;
  }
  if (!p.myDeck || p.myDeck.length === 0) {
    console.log(`[AI][DEBUG] handleAiFlip: playerId=${playerId} 덱 없음`);
    return;
  }
  if (room.players[room.turnIndex]?.id !== playerId) {
    console.log(
      `[AI][DEBUG] handleAiFlip: turnIndex=${room.turnIndex} playerId=${playerId} 불일치 -> 스킵`,
    );
    return;
  }

  // clearing the lock happens when a valid card is played; the check
  // above prevented us from running while it was still locked.

  room.isFlipping = true;
  room.lastFlipTime = Date.now();

  // if a bell has already occurred after we scheduled this flip, cancel
  // the action to prevent the temporary card‑on‑table glitch.
  if (room.lastBellTime && room.lastBellTime >= room.lastFlipTime) {
    room.isFlipping = false;
    return;
  }

  const card = p.myDeck.pop();
  // second check: if a bell fired between starting the flip and now,
  // return the card to the deck and bail out.
  if (room.lastBellTime && room.lastBellTime >= room.lastFlipTime) {
    p.myDeck.push(card);
    room.isFlipping = false;
    return;
  }
  p.openCard = card;
  p.openCardStack.push(card);

  // third check: maybe a ring just occurred after we pushed? undo again
  if (room.lastBellTime && room.lastBellTime >= room.lastFlipTime) {
    // return card and avoid emitting event
    p.openCard = null;
    p.openCardStack.pop();
    p.myDeck.push(card);
    room.isFlipping = false;
    return;
  }

  // only bombs and ton cards trigger the special pause; thunder is
  // handled immediately as a correct bell and should not introduce any
  // delay.
  if (isBombCard(card) || isTonCard(card)) {
    extendSpecialPause(room);
  }

  try {
    if (Array.isArray(room.blockEffects) && room.blockEffects.length > 0) {
      room.blockEffects.forEach((eff) => {
        eff.remainingTurns = (eff.remainingTurns || 0) - 1;
      });

      const expired = room.blockEffects.filter((e) => e.remainingTurns <= 0);
      if (expired.length > 0) {
        const expiredIds = new Set(expired.map((e) => e.id));
        room.players.forEach((pl) => {
          if (!pl || !Array.isArray(pl.openCardStack)) return;
          pl.openCardStack = pl.openCardStack.filter(
            (c) => !(c && c.type === "blockcard" && expiredIds.has(c.effectId)),
          );
        });

        room.blockEffects = room.blockEffects.filter(
          (e) => e.remainingTurns > 0,
        );
      }
    }
  } catch (e) {
    console.warn("blockEffects processing error", e);
  }

  if (isTonCard(card)) {
    room.turnDirection = room.turnDirection === -1 ? 1 : -1;
  }

  let coinReward = null;
  let coinTotal = null;
  if (isCoinCard(card)) {
    const rewardInfo = applyCoinCardReward(room, p, io);
    coinReward = rewardInfo?.reward ?? COIN_CARD_REWARD;
    coinTotal = rewardInfo?.coinTotal ?? null;
  }

  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);
  const hasThunder = hasThunderCardOnTable(room.players);
  const isBellSuccessWindow = isFive || hasThunder;

  if (p.myDeck.length === 0) {
    if (isBotPlayer(p)) {
      p.isEliminated = true;
    } else if (!isBellSuccessWindow) {
      p.isEliminated = true;
    }
  }

  io.to(room.roomId).emit("cardFlipped", {
    playerId: p.id,
    card,
    openCardStack: p.openCardStack,
    nextTurnId: p.id,
    remainingCount: p.myDeck.length,
    isEliminated: p.isEliminated,
    coinReward,
    coinTotal,
  });

  scheduleAiBell(room, io);

  if (p.isEliminated && checkGameOver(room, io)) {
    room.isFlipping = false;
    return;
  }

  setTimeout(() => {
    if (!room || !room.isGameStarted) {
      if (room) room.isFlipping = false;
      return;
    }

    const pauseRemaining = getSpecialPauseRemaining(room);
    if (pauseRemaining > 0) {
      setTimeout(() => {
        if (!room || !room.isGameStarted) return;
        room.isFlipping = false;
        const dir =
          typeof room.turnDirection === "number" ? room.turnDirection : 1;
        room.turnIndex =
          (room.turnIndex + dir + room.players.length) % room.players.length;
        processSkipTurn(room, io);
      }, pauseRemaining + 20);
      return;
    }

    room.isFlipping = false;
    const dir = typeof room.turnDirection === "number" ? room.turnDirection : 1;
    room.turnIndex =
      (room.turnIndex + dir + room.players.length) % room.players.length;
    processSkipTurn(room, io);
  }, 150);
}

function handleAiBell(room, io, playerId) {
  if (!room) {
    console.log("[AI][DEBUG] handleAiBell: room 없음");
    return;
  }
  if (!room.isGameStarted) {
    console.log("[AI][DEBUG] handleAiBell: 게임 미시작");
    return;
  }
  console.log("[AI] handleAiBell for", playerId, "turnIndex=", room.turnIndex);
  if (room.bellLocked) {
    console.log("[AI] handleAiBell exit bellLocked");
    return;
  }
  if (room.isFlipping) {
    console.log("[AI] handleAiBell exit isFlipping");
    return;
  }

  const p = room.players.find((pl) => pl.id === playerId);
  if (!p || p.isEliminated) return;

  const hasOpenCards = room.players.some((player) => {
    const hasOpenStack =
      Array.isArray(player.openCardStack) && player.openCardStack.length > 0;
    const hasOpenCard = Boolean(player.openCard);
    return hasOpenStack || hasOpenCard;
  });
  if (!hasOpenCards) return;

  const totals = getFruitTotals(room.players);
  const isFive = Object.values(totals).some((t) => t === 5);
  const hasThunder = hasThunderCardOnTable(room.players);
  const hasBomb = hasBombCardOnTable(room.players);
  const hasNot5 = hasNot5CardOnTable(room.players);
  const isCorrectBell =
    !hasBomb && (hasThunder || (hasNot5 ? !isFive : isFive));
  if (!isCorrectBell) return;

  clearAiBellTimers(room);
  room.bellLocked = true;

  const reactionTimeMs = room.lastFlipTime ? Date.now() - room.lastFlipTime : 0;
  const reactionTimeSec = (reactionTimeMs / 1000).toFixed(2);

  let collected = [];
  room.players.forEach((player) => {
    collected = [...collected, ...player.openCardStack];
    player.openCardStack = [];
    player.openCard = null;
  });

  const winnerIdx = room.players.findIndex((pl) => pl.id === playerId);
  const winner = room.players[winnerIdx];
  if (!winner) return;

  winner.myDeck = [...collected, ...winner.myDeck];
  room.turnIndex = winnerIdx;

  room.players.forEach((pl) => {
    pl.cards = pl.myDeck.length;
    if (pl.cards === 0) {
      pl.isEliminated = true;
    } else {
      pl.isEliminated = false;
    }
  });

  if (checkGameOver(room, io)) return;

  io.to(room.roomId).emit("bellResult", {
    success: true,
    winnerId: winner.id,
    winnerNickname: winner.nickname,
    players: room.players,
    nextTurnId: winner.id,
    collectedCount: collected.length,
    reactionTime: reactionTimeSec,
  });

  processSkipTurn(room, io);
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
  console.log("[SERVER] new socket connected", socket.id);
  socket.emit("serverHello", {
    build: SERVER_BUILD,
    pid: process.pid,
    socketId: socket.id,
  });

  // Ensure specialCards object exists immediately to avoid early-turn race conditions
  socket.specialCards = socket.specialCards || {};

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
      console.log(`   avetime=${savedData.avetime}`);
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
      // Persisted experience is stored as "remainder" XP (0..XP_PER_LEVEL-1).
      // If missing, start at 0 so level is driven by savedData.level.
      socket.experience = Number(savedData.experience) || 0;
      socket.avetime = Number(savedData.avetime) || 0;
      socket.ratio = Number(savedData.ratio) || 0;
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
        avetime: socket.avetime,
        ratio: socket.ratio,
      });
    } else {
      console.log(`⚠️ setNickname - ${socket.nickname} DB 데이터 없음`);
    }

    // server should trust saved level value (client maintains separate remainder XP)
    socket.level = Math.max(Number(socket.level) || 1, 1);

    try {
      const today = getDateStringInTimeZone(new Date(), DAILY_LOGIN_TIMEZONE);
      const lastCheckin = normalizeDateString(
        savedData ? savedData.last_checkin_date : null,
      );
      socket.lastCheckinDate = lastCheckin;

      socket.emit("dailyRewardAvailable", {
        available: Boolean(today && today !== lastCheckin),
        amount: DAILY_LOGIN_REWARD_COINS,
        date: today,
        lastCheckinDate: lastCheckin,
      });
    } catch (err) {
      console.warn("daily login availability check failed", err);
    }

    console.log(`🎯 setNickname 최종 - ${socket.nickname}:`, {
      level: socket.level,
      coins: socket.coins,
      exp: socket.experience,
      avetime: socket.avetime,
      ratio: socket.ratio,
    });

    socket.emit("myProfile", {
      nickname: socket.nickname,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avetime: Number(socket.avetime) || 0,
      ratio: Number(socket.ratio) || 0,
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
        // Sync specialCards from socket into room snapshot to avoid timing issues
        player.specialCards = socket.specialCards || {};

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
          itemMode: room.itemMode,
          gameMode: room.gameMode,
          newPlayerNickname: player.nickname,
          isRejoin: true,
        });
      }
    }
  });

  socket.on("claimDailyReward", async (data) => {
    const today = getDateStringInTimeZone(new Date(), DAILY_LOGIN_TIMEZONE);
    // payload might include avetime
    if (
      data &&
      typeof data === "object" &&
      typeof data.avetime !== "undefined"
    ) {
      const a = parseFloat(data.avetime);
      if (!isNaN(a)) socket.avetime = a;
    }
    const lastCheckin = normalizeDateString(socket.lastCheckinDate);

    if (!today) {
      socket.emit("dailyRewardError", "출석 보상 날짜를 확인할 수 없습니다.");
      return;
    }

    if (today === lastCheckin) {
      socket.emit("dailyRewardError", "이미 오늘의 출석 보상을 받았습니다.");
      socket.emit("dailyRewardAvailable", {
        available: false,
        amount: DAILY_LOGIN_REWARD_COINS,
        date: today,
        lastCheckinDate: today,
      });
      return;
    }

    const rewardCoins = DAILY_LOGIN_REWARD_COINS;
    const previousCoins = Number(socket.coins) || 0;
    socket.coins = previousCoins + rewardCoins;
    socket.lastCheckinDate = today;

    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    try {
      await savePlayer(
        socket.nickname,
        socket.level,
        socket.coins,
        mergedItems,
        socket.experience,
        socket.ownedCharacters,
        socket.currentCharacter,
        today,
        typeof socket.avetime === "number" && socket.avetime > 0
          ? socket.avetime
          : null,
      );

      socket.emit("dailyReward", {
        amount: rewardCoins,
        totalCoins: socket.coins,
        date: today,
      });

      socket.emit("dailyRewardAvailable", {
        available: false,
        amount: DAILY_LOGIN_REWARD_COINS,
        date: today,
        lastCheckinDate: today,
      });
    } catch (err) {
      socket.coins = previousCoins;
      socket.lastCheckinDate = lastCheckin;
      console.warn("daily login reward claim failed", err);
      socket.emit("dailyRewardError", "출석 보상 처리 중 오류가 발생했습니다.");
    }
  });

  // 특수카드 구매 이벤트
  socket.on("buySpecialCard", async (data) => {
    const { cardId, cardPrice, avetime } = data || {};
    if (typeof avetime !== "undefined") {
      const a = parseFloat(avetime);
      if (!isNaN(a)) socket.avetime = a;
    }

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

    try {
      await savePlayer(
        socket.nickname,
        socket.level,
        socket.coins,
        mergedItems,
        socket.experience,
        socket.ownedCharacters,
        socket.currentCharacter,
        null,
        typeof socket.avetime === "number" && socket.avetime > 0
          ? socket.avetime
          : null,
      );
      console.log(`✅ ${socket.nickname} 특수카드 ${cardId} 구매 DB 저장 완료`);
    } catch (e) {
      console.error(`❌ ${socket.nickname} 특수카드 구매 DB 저장 실패:`, e);
    }

    // 4. 클라이언트에 최신 프로필 전송
    socket.emit("myProfile", {
      nickname: socket.nickname,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avetime: Number(socket.avetime) || 0,
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
    const { amount, nickname, playerId, timestamp, avetime } = data || {};
    // 클라이언트가 평균속도를 함께 보낼 수 있도록 허용
    if (typeof avetime !== "undefined") {
      const a = parseFloat(avetime);
      if (!isNaN(a)) {
        socket.avetime = a;
      }
    }

    console.log(`💰 [DEBUG] addCoins 요청 받음:`, {
      amount,
      clientNickname: nickname,
      socketNickname: socket.nickname,
      playerId,
      timestamp,
      socketId: socket.id,
      socketCoins: socket.coins,
    });

    // 닉네임 결정 (클라이언트에서 보낸 것을 우선 사용)
    const targetNickname = nickname || socket.nickname;
    if (!targetNickname) {
      console.error(`❌ addCoins: 닉네임이 없음. data:`, data);
      socket.emit("buyItemError", "닉네임 정보가 없습니다.");
      return;
    }

    // socket.nickname 동기화
    if (nickname && socket.nickname !== nickname) {
      console.log(
        `🔄 socket.nickname 업데이트: ${socket.nickname} → ${nickname}`,
      );
      socket.nickname = nickname;
    }

    // 1. 코인 추가
    const previousCoins = Number(socket.coins) || 0;
    socket.coins = previousCoins + amount;

    console.log(
      `💰 [DEBUG] 코인 업데이트: ${previousCoins} → ${socket.coins} (+${amount})`,
    );

    // 2. DB에 저장
    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    try {
      await savePlayer(
        targetNickname,
        socket.level || 1,
        socket.coins,
        mergedItems,
        socket.experience || 0,
        socket.ownedCharacters || ["player_1"],
        socket.currentCharacter || "player_1",
        null,
        typeof socket.avetime === "number" && socket.avetime > 0
          ? socket.avetime
          : null,
      );
      console.log(
        `✅ ${targetNickname} 코인 ${amount} 충전 DB 저장 완료 (총 코인: ${socket.coins})`,
      );
    } catch (e) {
      console.error(`❌ ${targetNickname} 코인 충전 DB 저장 실패:`, e);
      // 롤백
      socket.coins = previousCoins;
      socket.emit("buyItemError", "코인 충전 처리 중 오류가 발생했습니다.");
      return;
    }

    // 3. 클라이언트에 최신 프로필 전송
    socket.emit("myProfile", {
      nickname: targetNickname,
      level: Number(socket.level) || 1,
      coins: Number(socket.coins) || 0,
      items: Array.isArray(socket.items) ? socket.items : [],
      experience: Number(socket.experience) || 0,
      avetime: Number(socket.avetime) || 0,
      avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
      specialCards: socket.specialCards || {},
      owned_characters: socket.ownedCharacters || ["player_1"],
      current_character: socket.currentCharacter || "player_1",
    });

    // 성공 응답 전송
    socket.emit("coinPurchased", {
      amount,
      newCoins: socket.coins,
      message: "코인 충전이 완료되었습니다!",
    });

    console.log(
      `✅ [FINAL] ${targetNickname}이(가) 코인 ${amount}개 구매 완료 (현재 보유: ${socket.coins}개)`,
    );
  });

  const handleBuyCharacter = async (data) => {
    const payload = data && typeof data === "object" ? data : {};
    // allow average reaction time to be included when coins/characters change
    if (typeof payload.avetime !== "undefined") {
      const a = parseFloat(payload.avetime);
      if (!isNaN(a)) socket.avetime = a;
    }
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

    // 이미 소유한 케릭터인지 확인
    const currentOwnedCharacters = socket.ownedCharacters || ["player_1"];
    if (currentOwnedCharacters.includes(characterKey)) {
      socket.emit("buyCharacterError", "이미 소유한 케릭터입니다.");
      return;
    }

    // 코인 및 캐릭터 정보 업데이트
    const previousCoins = Number(socket.coins) || 0;
    socket.coins = previousCoins - characterPrice;
    socket.ownedCharacters = normalizeOwnedCharacters([
      ...currentOwnedCharacters,
      characterKey,
    ]);
    socket.currentCharacter = characterKey;
    socket.avatarKey = characterKey;

    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    try {
      await savePlayer(
        targetPlayerId,
        socket.level,
        socket.coins,
        mergedItems,
        socket.experience,
        socket.ownedCharacters,
        socket.currentCharacter,
        null,
        typeof socket.avetime === "number" && socket.avetime > 0
          ? socket.avetime
          : null,
      );

      // 성공시 클라이언트에 최신 프로필 전송
      socket.emit("myProfile", {
        nickname: targetPlayerId,
        level: Number(socket.level) || 1,
        coins: Number(socket.coins) || 0,
        items: Array.isArray(socket.items) ? socket.items : [],
        experience: Number(socket.experience) || 0,
        avetime: Number(socket.avetime) || 0,
        avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
        specialCards: socket.specialCards || {},
        owned_characters: socket.ownedCharacters || ["player_1"],
        current_character: socket.currentCharacter || "player_1",
      });

      // 성공 응답 전송
      socket.emit("characterPurchased", {
        characterKey,
        characterPrice,
        newCoins: socket.coins,
        message: "케릭터 구매가 완료되었습니다!",
      });

      // 최신 프로필 정보도 다시 전송하여 UI 동기화
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
    } catch (e) {
      console.error(`❌ ${targetPlayerId} 캐릭터 구매 DB 저장 실패:`, e);
      // 롤백 - 원래 상태로 되돌리기
      socket.coins = previousCoins;
      socket.ownedCharacters = currentOwnedCharacters; // 기존 상태로 완전 복원
      if (socket.currentCharacter === characterKey) {
        // 새로 설정된 currentCharacter도 원래대로 되돌리기
        socket.currentCharacter = currentOwnedCharacters[0] || "player_1";
        socket.avatarKey = socket.currentCharacter;
      }
      socket.emit(
        "buyCharacterError",
        "케릭터 구매 처리 중 오류가 발생했습니다.",
      );
      return;
    }
  };

  // handleBuyCharacter already captures socket.avetime from payload if sent
  socket.on("buyCharacter", handleBuyCharacter);

  // 케릭터 착용 이벤트 핸들러
  socket.on("equipCharacter", async (data) => {
    const { nickname: targetNickname, characterKey } = data;
    const resolvedNickname = targetNickname || socket.nickname;

    if (!resolvedNickname) {
      socket.emit("equipCharacterError", "닉네임 정보가 없습니다.");
      return;
    }

    if (!characterKey || !normalizeCharacterKey(characterKey)) {
      socket.emit("equipCharacterError", "유효하지 않은 캐릭터입니다.");
      return;
    }

    // 소유 캐릭터인지 확인
    const ownedCharacters = socket.ownedCharacters || ["player_1"];
    if (
      !ownedCharacters.includes(characterKey) &&
      characterKey !== "player_1"
    ) {
      socket.emit("equipCharacterError", "소유하지 않은 캐릭터입니다.");
      return;
    }

    // 착용 처리
    socket.currentCharacter = characterKey;
    socket.avatarKey = characterKey;

    // DB에 저장
    const mergedItems = {
      items: Array.isArray(socket.items) ? socket.items : [],
      specialCards: socket.specialCards || {},
    };

    try {
      await savePlayer(
        resolvedNickname,
        socket.level || 1,
        socket.coins || 0,
        mergedItems,
        socket.experience || 0,
        socket.ownedCharacters || ["player_1"],
        socket.currentCharacter,
        null,
        typeof socket.avetime === "number" && socket.avetime > 0
          ? socket.avetime
          : null,
      );

      // 최신 프로필 정보 전송
      socket.emit("myProfile", {
        nickname: resolvedNickname,
        level: Number(socket.level) || 1,
        coins: Number(socket.coins) || 0,
        items: Array.isArray(socket.items) ? socket.items : [],
        experience: Number(socket.experience) || 0,
        avetime: Number(socket.avetime) || 0,
        avatarKey: socket.currentCharacter || "player_1",
        specialCards: socket.specialCards || {},
        owned_characters: socket.ownedCharacters || ["player_1"],
        current_character: socket.currentCharacter || "player_1",
      });

      console.log(`✅ ${resolvedNickname} 케릭터 착용 완료: ${characterKey}`);

      // inform other players in the room about the change as well
      if (socket.roomId && rooms[socket.roomId]) {
        io.to(socket.roomId).emit("playerUpdated", {
          players: rooms[socket.roomId].players,
        });
      }
    } catch (e) {
      console.error(`❌ ${resolvedNickname} 케릭터 착용 DB 저장 실패:`, e);
      socket.emit("equipCharacterError", "착용 처리 중 오류가 발생했습니다.");
    }
  });

  // 특수카드 동기화 요청
  socket.on("syncSpecialCards", async (clientSpecialCards, cb) => {
    try {
      console.log(
        `[syncSpecialCards] from ${socket.nickname}, clientCards:`,
        clientSpecialCards,
      );

      // 서버의 socket.specialCards와 클라이언트의 데이터를 동기화
      if (
        typeof clientSpecialCards === "object" &&
        clientSpecialCards !== null
      ) {
        socket.specialCards = { ...clientSpecialCards };

        // 데이터베이스에도 저장
        try {
          await savePlayer(
            socket.nickname,
            socket.level || 1,
            socket.coins || 0,
            {
              items: Array.isArray(socket.items) ? socket.items : [],
              specialCards: socket.specialCards || {},
            },
            socket.experience || 0,
            socket.ownedCharacters || ["player_1"],
            socket.currentCharacter || socket.avatarKey || "player_1",
          );
          console.log(`[syncSpecialCards] saved to DB for ${socket.nickname}`);
        } catch (saveError) {
          console.warn("syncSpecialCards DB save error", saveError);
        }
      }

      if (typeof cb === "function") {
        cb({
          success: true,
          specialCards: socket.specialCards || {},
        });
      }
    } catch (e) {
      console.error("syncSpecialCards error", e);
      if (typeof cb === "function") {
        cb({ success: false, message: "동기화 실패" });
      }
    }
  });

  // 특수카드 사용 요청 (예: thief 등)
  socket.on("requestUseSpecial", async (data, cb) => {
    try {
      const payload = data && typeof data === "object" ? data : {};
      const cardId = Number(payload.cardId || 0);

      // Helper to refresh snapshots from live sockets (safe to call frequently)
      const refreshRoomSpecialCards = (room) => {
        if (!room || !Array.isArray(room.players)) return;
        room.players.forEach((p) => {
          if (!p || !p.id) return;
          const s = io.sockets.sockets.get(p.id);
          const sockCards = s && s.specialCards ? s.specialCards : {};
          console.log(
            `[debug] refreshRoomSpecialCards player=${p.nickname} id=${p.id} socketCards=${JSON.stringify(sockCards)}`,
          );
          if (s && s.specialCards) {
            // copy to avoid mutation issues
            p.specialCards = { ...s.specialCards };
          }
        });
      };

      // cardId 4 (lock) may be requested during penalty handling, not only on
      // your own turn. other special cards (6,7,8) still require turn.
      const isAutoLockPenalty =
        cardId === 4 && payload.reason === "auto_lock_penalty";

      if (!isAutoLockPenalty && ![6, 7, 8].includes(cardId)) {
        if (typeof cb === "function")
          cb({ success: false, message: "unsupported_card" });
        return;
      }

      const room = rooms[socket.roomId];
      if (!room || !room.isGameStarted) {
        if (typeof cb === "function")
          cb({ success: false, message: "invalid_room" });
        return;
      }

      if (room.itemMode === false) {
        if (typeof cb === "function")
          cb({ success: false, message: "item_mode_disabled" });
        return;
      }

      // 최신 specialCards를 소켓에서 다시 가져와서 방 스냅샷을 갱신합니다.
      refreshRoomSpecialCards(room);
      // ensure the current socket also has up-to-date counts (in case they changed elsewhere)
      const mePlayer = room.players.find((p) => p && p.id === socket.id);
      if (mePlayer && mePlayer.specialCards) {
        socket.specialCards = { ...mePlayer.specialCards };
      }

      // auto-lock requests are allowed anytime; other cards require your turn
      if (!isAutoLockPenalty) {
        const currentTurnPlayer = room.players[room.turnIndex];
        if (!currentTurnPlayer || currentTurnPlayer.id !== socket.id) {
          if (typeof cb === "function")
            cb({ success: false, message: "not_your_turn" });
          return;
        }
      }

      // 보유 여부 확인
      console.log(
        `[debug] requestUseSpecial from ${socket.nickname} (${socket.id}) cardId=${cardId} specialCards=`,
        socket.specialCards,
      );
      if (
        !socket.specialCards ||
        Number(socket.specialCards[cardId] || 0) <= 0
      ) {
        console.log(
          `[debug] requestUseSpecial denied no_card for ${socket.nickname} cardId=${cardId}`,
        );
        if (typeof cb === "function")
          cb({ success: false, message: "no_card" });
        return;
      }

      // --------------------------------------------------------------
      // Special-case: auto-lock penalty handling. No animation is needed,
      // we just consume the lock and tell the client so it can avoid the
      // penalty. This path is invoked from the client when the server did
      // not auto-use the lock on its own (e.g. stale state).
      if (isAutoLockPenalty) {
        try {
          // consume once more just in case refreshRoomSpecialCards updated it
          socket.specialCards[4] = Number(socket.specialCards[4] || 0) - 1;
          if (socket.specialCards[4] <= 0) delete socket.specialCards[4];

          // persist change asynchronously
          savePlayer(
            socket.nickname,
            socket.level || 1,
            socket.coins || 0,
            {
              items: Array.isArray(socket.items) ? socket.items : [],
              specialCards: socket.specialCards || {},
            },
            socket.experience || 0,
            socket.ownedCharacters || ["player_1"],
            socket.currentCharacter || socket.avatarKey || "player_1",
            null,
            typeof socket.avetime === "number" && socket.avetime > 0
              ? socket.avetime
              : null,
          ).catch((e) =>
            console.warn(
              "savePlayer error on auto-lock (requestUseSpecial)",
              e,
            ),
          );

          // also update room snapshot for clients that look at players
          refreshRoomSpecialCards(room);

          // broadcast lock usage so other clients show animation
          io.to(room.roomId).emit("specialUsed", {
            cardId: 4,
            by: socket.id,
            players: room.players,
            recipients: [],
            shielded: [],
            message: `${socket.nickname}님이 자물쇠를 사용했습니다!`,
          });

          if (typeof cb === "function")
            cb({
              success: true,
              updatedSpecialCards: socket.specialCards,
              players: room.players,
            });
        } catch (e) {
          console.warn("auto-lock requestUseSpecial error", e);
          if (typeof cb === "function")
            cb({ success: false, message: "error" });
        }
        return;
      }

      // recipients (effect 대상 id들)
      const recipients = [];
      const SHIELD_CARD_ID = 5; // 자동 발동되는 방어 아이템 (client mapping: shield -> 5)
      let shieldedGlobal = [];
      let emittedEffectId = null;

      // 애니메이션을 먼저 모든 플레이어에게 브로드캐스트하고, 일정 시간 후 실제 효과를 적용합니다.
      const ANIM_MS = 1400;
      const animMap = {
        6: {
          imageKey: "block",
          title: "먹물 카드 사용",
          subtitle: "모든 플레이어의 오픈 더미를 가립니다.",
        },
        7: {
          imageKey: "thief",
          title: "도둑 카드 사용",
          subtitle: "생존 플레이어들로부터 3장씩 획득합니다.",
        },
        8: {
          imageKey: "king",
          title: "왕 카드 사용",
          subtitle: "카드 보유 수가 가장 많은 플레이어와 덱을 교환합니다.",
        },
        5: {
          imageKey: "shield",
          title: "방패 사용",
          subtitle: "방어 효과를 활성화합니다.",
        },
        4: {
          imageKey: "lock",
          title: "자물쇠 사용",
          subtitle: "공격을 막습니다.",
        },
      };

      const animInfo = animMap[cardId] || {
        imageKey: "block",
        title: "특수카드 사용",
        subtitle: "특수카드를 사용했습니다.",
      };
      // notify all players to play animation
      io.to(room.roomId).emit("specialPlay", {
        cardId,
        by: socket.id,
        imageKey: animInfo.imageKey,
        title: animInfo.title,
        subtitle: animInfo.subtitle,
        duration: ANIM_MS,
      });

      // 실제 효과는 애니메이션이 끝난 뒤 적용
      setTimeout(async () => {
        try {
          // Helper: try to find a socket for a player (by id or nickname) and consume shield if present.
          // Returns the socket id if a shield was consumed, otherwise returns false.
          const tryConsumeShield = async (playerRef) => {
            try {
              // First, if the room/player snapshot contains specialCards, prefer that
              try {
                const snapshotCount =
                  playerRef && playerRef.specialCards
                    ? Number(playerRef.specialCards[SHIELD_CARD_ID] || 0)
                    : 0;
                console.log(
                  `[debug] tryConsumeShield snapshotCount=${snapshotCount} for ref=${JSON.stringify(
                    {
                      id: playerRef && playerRef.id,
                      nickname: playerRef && playerRef.nickname,
                    },
                  )}`,
                );
                if (playerRef && playerRef.specialCards && snapshotCount > 0) {
                  playerRef.specialCards[SHIELD_CARD_ID] = snapshotCount - 1;
                  if (playerRef.specialCards[SHIELD_CARD_ID] <= 0)
                    delete playerRef.specialCards[SHIELD_CARD_ID];

                  // Try to find live socket and sync if present
                  let resolvedSock = null;
                  const lookupId = playerRef && playerRef.id;
                  if (lookupId) resolvedSock = io.sockets.sockets.get(lookupId);
                  if (!resolvedSock && playerRef && playerRef.nickname) {
                    for (const [sid, sock] of io.sockets.sockets) {
                      if (sock && sock.nickname === playerRef.nickname) {
                        resolvedSock = sock;
                        break;
                      }
                    }
                  }
                  if (resolvedSock) {
                    resolvedSock.specialCards = resolvedSock.specialCards || {};
                    const sockCount = Number(
                      resolvedSock.specialCards[SHIELD_CARD_ID] || 0,
                    );
                    console.log(
                      `[debug] tryConsumeShield socket had count=${sockCount} for ${resolvedSock.nickname}`,
                    );
                    resolvedSock.specialCards[SHIELD_CARD_ID] = sockCount - 1;
                    if (resolvedSock.specialCards[SHIELD_CARD_ID] <= 0)
                      delete resolvedSock.specialCards[SHIELD_CARD_ID];

                    // persist change and emit updated profile
                    savePlayer(
                      resolvedSock.nickname,
                      resolvedSock.level || 1,
                      resolvedSock.coins || 0,
                      {
                        items: Array.isArray(resolvedSock.items)
                          ? resolvedSock.items
                          : [],
                        specialCards: resolvedSock.specialCards || {},
                      },
                      resolvedSock.experience || 0,
                      resolvedSock.ownedCharacters || ["player_1"],
                      resolvedSock.currentCharacter ||
                        resolvedSock.avatarKey ||
                        "player_1",
                      null,
                      typeof resolvedSock.avetime === "number" &&
                        resolvedSock.avetime > 0
                        ? resolvedSock.avetime
                        : null,
                    ).catch((e) =>
                      console.warn("savePlayer error on shield consume", e),
                    );
                    try {
                      resolvedSock.emit("myProfile", {
                        nickname: resolvedSock.nickname,
                        level: Number(resolvedSock.level) || 1,
                        coins: Number(resolvedSock.coins) || 0,
                        items: Array.isArray(resolvedSock.items)
                          ? resolvedSock.items
                          : [],
                        experience: Number(resolvedSock.experience) || 0,
                        avatarKey:
                          resolvedSock.currentCharacter ||
                          resolvedSock.avatarKey ||
                          "player_1",
                        specialCards: resolvedSock.specialCards || {},
                        owned_characters: resolvedSock.owned_characters || [
                          "player_1",
                        ],
                        current_character:
                          resolvedSock.currentCharacter || "player_1",
                      });
                    } catch (e) {}
                  }

                  return playerRef && playerRef.id ? playerRef.id : true;
                }
              } catch (e) {
                console.warn("tryConsumeShield(room-snapshot) error", e);
              }

              // Fallback: resolve live socket and check its specialCards
              let resolvedSock = null;
              let lookupId =
                typeof playerRef === "string"
                  ? playerRef
                  : playerRef && playerRef.id;
              if (lookupId) resolvedSock = io.sockets.sockets.get(lookupId);
              // fallback: match by nickname if socket not found
              if (!resolvedSock && playerRef && playerRef.nickname) {
                for (const [sid, sock] of io.sockets.sockets) {
                  if (sock && sock.nickname === playerRef.nickname) {
                    resolvedSock = sock;
                    break;
                  }
                }
              }
              if (resolvedSock)
                resolvedSock.specialCards = resolvedSock.specialCards || {};
              console.log(
                `[debug] tryConsumeShield resolved for ref=${JSON.stringify(
                  playerRef && {
                    id: playerRef.id,
                    nickname: playerRef.nickname,
                  },
                )} -> socketExists=${!!resolvedSock}`,
              );
              if (
                resolvedSock &&
                Number(resolvedSock.specialCards[SHIELD_CARD_ID] || 0) > 0
              ) {
                resolvedSock.specialCards[SHIELD_CARD_ID] =
                  Number(resolvedSock.specialCards[SHIELD_CARD_ID] || 0) - 1;
                if (resolvedSock.specialCards[SHIELD_CARD_ID] <= 0)
                  delete resolvedSock.specialCards[SHIELD_CARD_ID];
                // persist change and emit updated profile
                savePlayer(
                  resolvedSock.nickname,
                  resolvedSock.level || 1,
                  resolvedSock.coins || 0,
                  {
                    items: Array.isArray(resolvedSock.items)
                      ? resolvedSock.items
                      : [],
                    specialCards: resolvedSock.specialCards || {},
                  },
                  resolvedSock.experience || 0,
                  resolvedSock.ownedCharacters || ["player_1"],
                  resolvedSock.currentCharacter ||
                    resolvedSock.avatarKey ||
                    "player_1",
                  null,
                  typeof resolvedSock.avetime === "number" &&
                    resolvedSock.avetime > 0
                    ? resolvedSock.avetime
                    : null,
                ).catch((e) =>
                  console.warn("savePlayer error on shield consume", e),
                );
                try {
                  resolvedSock.emit("myProfile", {
                    nickname: resolvedSock.nickname,
                    level: Number(resolvedSock.level) || 1,
                    coins: Number(resolvedSock.coins) || 0,
                    items: Array.isArray(resolvedSock.items)
                      ? resolvedSock.items
                      : [],
                    experience: Number(resolvedSock.experience) || 0,
                    avetime: Number(resolvedSock.avetime) || 0,
                    avatarKey:
                      resolvedSock.currentCharacter ||
                      resolvedSock.avatarKey ||
                      "player_1",
                    specialCards: resolvedSock.specialCards || {},
                    owned_characters: resolvedSock.owned_characters || [
                      "player_1",
                    ],
                    current_character:
                      resolvedSock.currentCharacter || "player_1",
                  });
                } catch (e) {}
                return resolvedSock.id;
              }

              // If socket exists but has no shield, try DB fallback to check persisted items
              if (resolvedSock && resolvedSock.nickname) {
                try {
                  const saved = await getPlayer(resolvedSock.nickname);
                  let parsedSpecial = {};
                  if (saved) {
                    if (
                      typeof saved.items === "object" &&
                      !Array.isArray(saved.items)
                    ) {
                      parsedSpecial = saved.items.specialCards || {};
                    } else if (typeof saved.items === "string") {
                      try {
                        const parsed = JSON.parse(saved.items);
                        if (
                          parsed &&
                          typeof parsed === "object" &&
                          !Array.isArray(parsed)
                        ) {
                          parsedSpecial = parsed.specialCards || {};
                        }
                      } catch (e) {}
                    }
                  }
                  const dbCount = Number(parsedSpecial[SHIELD_CARD_ID] || 0);
                  console.log(
                    `[debug] tryConsumeShield dbFallback count=${dbCount} for ${
                      resolvedSock.nickname
                    }`,
                  );
                  if (dbCount > 0) {
                    parsedSpecial[SHIELD_CARD_ID] = dbCount - 1;
                    if (parsedSpecial[SHIELD_CARD_ID] <= 0)
                      delete parsedSpecial[SHIELD_CARD_ID];
                    // apply to socket and room snapshot
                    resolvedSock.specialCards = parsedSpecial;
                    if (playerRef && playerRef.specialCards)
                      playerRef.specialCards = parsedSpecial;
                    // persist
                    await savePlayer(
                      resolvedSock.nickname,
                      resolvedSock.level || 1,
                      resolvedSock.coins || 0,
                      {
                        items: Array.isArray(resolvedSock.items)
                          ? resolvedSock.items
                          : [],
                        specialCards: resolvedSock.specialCards || {},
                      },
                      resolvedSock.experience || 0,
                      resolvedSock.ownedCharacters || ["player_1"],
                      resolvedSock.currentCharacter ||
                        resolvedSock.avatarKey ||
                        "player_1",
                      null,
                      typeof resolvedSock.avetime === "number" &&
                        resolvedSock.avetime > 0
                        ? resolvedSock.avetime
                        : null,
                    ).catch((e) =>
                      console.warn("savePlayer error on shield consume", e),
                    );
                    try {
                      resolvedSock.emit("myProfile", {
                        nickname: resolvedSock.nickname,
                        level: Number(resolvedSock.level) || 1,
                        coins: Number(resolvedSock.coins) || 0,
                        items: Array.isArray(resolvedSock.items)
                          ? resolvedSock.items
                          : [],
                        experience: Number(resolvedSock.experience) || 0,
                        avatarKey:
                          resolvedSock.currentCharacter ||
                          resolvedSock.avatarKey ||
                          "player_1",
                        specialCards: resolvedSock.specialCards || {},
                        owned_characters: resolvedSock.owned_characters || [
                          "player_1",
                        ],
                        current_character:
                          resolvedSock.currentCharacter || "player_1",
                      });
                    } catch (e) {}
                    return resolvedSock.id;
                  }
                } catch (e) {
                  // ignore DB fallback errors
                }
              }
            } catch (e) {
              console.warn("tryConsumeShield error", e);
            }
            return false;
          };

          // 기존 로직: 카드별 효과 적용
          if (cardId === 7) {
            // 차감
            socket.specialCards[7] = Number(socket.specialCards[7] || 0) - 1;
            if (socket.specialCards[7] <= 0) delete socket.specialCards[7];

            // thief 효과: 생존 플레이어들(자기 제외, 탈락자 제외)로부터 카드 3장씩 가져옴
            const givers = room.players.filter(
              (p) =>
                p.id !== socket.id &&
                !p.isEliminated &&
                (p.myDeck?.length || 0) > 0,
            );

            const stolenFrom = [];

            const recipientPlayer = room.players.find(
              (p) => p.id === socket.id,
            );
            if (recipientPlayer) {
              if (!Array.isArray(recipientPlayer.myDeck))
                recipientPlayer.myDeck = [];
              socket.myDeck = recipientPlayer.myDeck;

              for (const giver of givers) {
                if (giver.myDeck && giver.myDeck.length > 0) {
                  const consumedId = await tryConsumeShield(giver);
                  if (consumedId) {
                    shieldedGlobal.push(consumedId);
                  } else {
                    // steal up to 3 cards from each giver
                    for (let k = 0; k < 3 && giver.myDeck.length > 0; k += 1) {
                      const card = giver.myDeck.pop();
                      recipientPlayer.myDeck.unshift(card);
                    }
                    stolenFrom.push(giver.id);
                  }
                }
              }
              console.log(
                `[debug] thief result for ${socket.nickname}: stolenFrom=`,
                stolenFrom,
                `shielded=`,
                shieldedGlobal,
              );
            } else {
              if (!Array.isArray(socket.myDeck))
                socket.myDeck = Array.isArray(socket.myDeck)
                  ? socket.myDeck
                  : [];

              for (const giver of givers) {
                if (giver.myDeck && giver.myDeck.length > 0) {
                  const consumedId = await tryConsumeShield(giver);
                  if (consumedId) {
                    shieldedGlobal.push(consumedId);
                  } else {
                    for (let k = 0; k < 3 && giver.myDeck.length > 0; k += 1) {
                      const card = giver.myDeck.pop();
                      socket.myDeck.unshift(card);
                    }
                    stolenFrom.push(giver.id);
                  }
                }
              }
              console.log(
                `[debug] thief result for ${socket.nickname}: stolenFrom=`,
                stolenFrom,
                `shielded=`,
                shieldedGlobal,
              );
            }

            recipients.push(...stolenFrom);
          } else if (cardId === 8) {
            socket.specialCards[8] = Number(socket.specialCards[8] || 0) - 1;
            if (socket.specialCards[8] <= 0) delete socket.specialCards[8];

            const candidates = room.players.filter(
              (p) => p.id !== socket.id && !p.isEliminated,
            );
            if (candidates.length > 0) {
              let target = candidates[0];
              candidates.forEach((c) => {
                if ((c.myDeck?.length || 0) > (target.myDeck?.length || 0))
                  target = c;
              });

              const mePlayer = room.players.find((p) => p.id === socket.id);
              const targetPlayer = target;
              if (mePlayer && targetPlayer) {
                let targetShielded = false;
                try {
                  const tSock = io.sockets.sockets.get(targetPlayer.id);
                  if (tSock) tSock.specialCards = tSock.specialCards || {};
                  if (
                    tSock &&
                    Number(tSock.specialCards[SHIELD_CARD_ID] || 0) > 0
                  ) {
                    tSock.specialCards[SHIELD_CARD_ID] =
                      Number(tSock.specialCards[SHIELD_CARD_ID] || 0) - 1;
                    if (tSock.specialCards[SHIELD_CARD_ID] <= 0)
                      delete tSock.specialCards[SHIELD_CARD_ID];
                    savePlayer(
                      tSock.nickname,
                      tSock.level || 1,
                      tSock.coins || 0,
                      {
                        items: Array.isArray(tSock.items) ? tSock.items : [],
                        specialCards: tSock.specialCards || {},
                      },
                      tSock.experience || 0,
                      tSock.ownedCharacters || ["player_1"],
                      tSock.currentCharacter || tSock.avatarKey || "player_1",
                      null,
                      typeof tSock.avetime === "number" && tSock.avetime > 0
                        ? tSock.avetime
                        : null,
                    ).catch((e) =>
                      console.warn("savePlayer error on shield consume", e),
                    );
                    try {
                      tSock.emit("myProfile", {
                        nickname: tSock.nickname,
                        level: Number(tSock.level) || 1,
                        coins: Number(tSock.coins) || 0,
                        items: Array.isArray(tSock.items) ? tSock.items : [],
                        experience: Number(tSock.experience) || 0,
                        avatarKey:
                          tSock.currentCharacter ||
                          tSock.avatarKey ||
                          "player_1",
                        specialCards: tSock.specialCards || {},
                        owned_characters: tSock.ownedCharacters || ["player_1"],
                        current_character: tSock.currentCharacter || "player_1",
                      });
                    } catch (e) {}
                    targetShielded = true;
                    shieldedGlobal.push(targetPlayer.id);
                  }
                } catch (e) {}

                if (!targetShielded) {
                  if (!Array.isArray(mePlayer.myDeck)) mePlayer.myDeck = [];
                  if (!Array.isArray(targetPlayer.myDeck))
                    targetPlayer.myDeck = [];
                  const tmp = mePlayer.myDeck.slice();
                  mePlayer.myDeck.length = 0;
                  Array.prototype.push.apply(
                    mePlayer.myDeck,
                    targetPlayer.myDeck,
                  );
                  targetPlayer.myDeck.length = 0;
                  Array.prototype.push.apply(targetPlayer.myDeck, tmp);
                  socket.myDeck = mePlayer.myDeck;
                  recipients.push(targetPlayer.id);
                }
              }
            }
          } else if (cardId === 6) {
            socket.specialCards[6] = Number(socket.specialCards[6] || 0) - 1;
            if (socket.specialCards[6] <= 0) delete socket.specialCards[6];

            const effectId = `block_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            emittedEffectId = effectId;
            room.blockEffects = room.blockEffects || [];
            // duration = number of surviving players * 2 submissions
            const activePlayers = room.players.filter((p) => !p.isEliminated);
            const survivorsCount = activePlayers.length;
            const turns = survivorsCount * 2;
            room.blockEffects.push({
              id: effectId,
              issuer: socket.id,
              remainingTurns: turns,
            });

            room.players.forEach((pl) => {
              if (!pl || pl.isEliminated) return;
              if (!Array.isArray(pl.openCardStack)) pl.openCardStack = [];
              const top = pl.openCardStack[pl.openCardStack.length - 1];
              try {
                const pSock = io.sockets.sockets.get(pl.id);
                if (pSock) pSock.specialCards = pSock.specialCards || {};
                // 먹물 카드 사용자는 공격 대상이 아니므로 방패 소모하지 않음
                if (
                  pl.id !== socket.id && // 사용자 본인은 제외
                  pSock &&
                  Number(pSock.specialCards[SHIELD_CARD_ID] || 0) > 0
                ) {
                  pSock.specialCards[SHIELD_CARD_ID] =
                    Number(pSock.specialCards[SHIELD_CARD_ID] || 0) - 1;
                  if (pSock.specialCards[SHIELD_CARD_ID] <= 0)
                    delete pSock.specialCards[SHIELD_CARD_ID];
                  shieldedGlobal.push(pl.id);
                  savePlayer(
                    pSock.nickname,
                    pSock.level || 1,
                    pSock.coins || 0,
                    {
                      items: Array.isArray(pSock.items) ? pSock.items : [],
                      specialCards: pSock.specialCards || {},
                    },
                    pSock.experience || 0,
                    pSock.ownedCharacters || ["player_1"],
                    pSock.currentCharacter || pSock.avatarKey || "player_1",
                    null,
                    typeof pSock.avetime === "number" && pSock.avetime > 0
                      ? pSock.avetime
                      : null,
                  ).catch((e) =>
                    console.warn("savePlayer error on shield consume", e),
                  );
                  try {
                    pSock.emit("myProfile", {
                      nickname: pSock.nickname,
                      level: Number(pSock.level) || 1,
                      coins: Number(pSock.coins) || 0,
                      items: Array.isArray(pSock.items) ? pSock.items : [],
                      experience: Number(pSock.experience) || 0,
                      avetime: Number(pSock.avetime) || 0,
                      avatarKey:
                        pSock.currentCharacter || pSock.avatarKey || "player_1",
                      specialCards: pSock.specialCards || {},
                      owned_characters: pSock.ownedCharacters || ["player_1"],
                      current_character: pSock.currentCharacter || "player_1",
                    });
                  } catch (e) {}
                }
              } catch (e) {}

              if (!top || top.type !== "blockcard") {
                const wasShielded = shieldedGlobal.includes(pl.id);
                pl.openCardStack.push({
                  type: "blockcard",
                  issuer: socket.id,
                  effectId,
                  shielded: wasShielded || false,
                });
              }
            });
          } else if (cardId === 5 || cardId === 4) {
            // 방어 아이템(낙관적 소모 및 프로필 업데이트)
            socket.specialCards[cardId] =
              Number(socket.specialCards[cardId] || 0) - 1;
            if (socket.specialCards[cardId] <= 0)
              delete socket.specialCards[cardId];
          }

          // 모든 플레이어의 cards 속성 갱신
          room.players.forEach((pl) => {
            pl.cards = pl.myDeck ? pl.myDeck.length : 0;
            if (pl.cards === 0) pl.isEliminated = true;
          });

          // DB 동기화: 사용자의 specialCards 변경사항 저장
          const mergedItems = {
            items: Array.isArray(socket.items) ? socket.items : [],
            specialCards: socket.specialCards || {},
          };

          await savePlayer(
            socket.nickname,
            socket.level || 1,
            socket.coins || 0,
            mergedItems,
            socket.experience || 0,
            socket.ownedCharacters || ["player_1"],
            socket.currentCharacter || socket.avatarKey || "player_1",
            null,
            typeof socket.avetime === "number" && socket.avetime > 0
              ? socket.avetime
              : null,
          ).catch((e) => console.warn("savePlayer error on useSpecial", e));

          // 사용자에게 프로필 업데이트 전송
          try {
            socket.emit("myProfile", {
              nickname: socket.nickname,
              level: Number(socket.level) || 1,
              coins: Number(socket.coins) || 0,
              items: Array.isArray(socket.items) ? socket.items : [],
              experience: Number(socket.experience) || 0,
              avetime: Number(socket.avetime) || 0,
              avatarKey:
                socket.currentCharacter || socket.avatarKey || "player_1",
              specialCards: socket.specialCards || {},
              owned_characters: socket.ownedCharacters || ["player_1"],
              current_character: socket.currentCharacter || "player_1",
            });
          } catch (e) {
            console.warn("emit myProfile error on useSpecial", e);
          }

          // 룸에 효과 브로드캐스트
          let broadcastMessage = `${socket.nickname}님이 도둑 카드를 사용했습니다!`;
          if (cardId === 8)
            broadcastMessage = `${socket.nickname}님이 왕 카드를 사용했습니다!`;
          if (cardId === 6)
            broadcastMessage = `${socket.nickname}님이 먹물(블록) 카드를 사용했습니다!`;
          if (cardId === 5)
            broadcastMessage = `${socket.nickname}님이 방패를 사용했습니다!`;
          if (cardId === 4)
            broadcastMessage = `${socket.nickname}님이 자물쇠를 사용했습니다!`;

          console.log(
            `[specialUsed] cardId=${cardId} by=${socket.id} recipients=${JSON.stringify(recipients)} shielded=${JSON.stringify(shieldedGlobal)} effectId=${emittedEffectId}`,
          );
          // determine duration again for event payload
          let turns;
          if (cardId === 6) {
            const activePlayers = room.players.filter((p) => !p.isEliminated);
            turns = activePlayers.length * 2;
          }
          io.to(room.roomId).emit("specialUsed", {
            cardId: cardId,
            by: socket.id,
            players: room.players,
            recipients,
            effectId: emittedEffectId,
            // include remainingTurns for ink effect so clients can sync
            remainingTurns: cardId === 6 ? turns : undefined,
            shielded:
              shieldedGlobal && shieldedGlobal.length > 0 ? shieldedGlobal : [],
            message: broadcastMessage,
          });

          // Special cards can change deck sizes; check game end after effects.
          checkGameOver(room, io, { forceEliminateZeroDeck: cardId === 7 });

          // 콜백 응답
          if (typeof cb === "function")
            cb({
              success: true,
              players: room.players,
              updatedSpecialCards: socket.specialCards,
            });
        } catch (err) {
          console.error("deferred requestUseSpecial error", err);
          if (typeof cb === "function")
            cb({ success: false, message: "server_error" });
        }
      }, ANIM_MS);
    } catch (err) {
      console.error("requestUseSpecial error", err);
      if (typeof cb === "function")
        cb({ success: false, message: "server_error" });
    }
  });

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

    // notify everyone in the same room that one player's profile changed
    if (socket.roomId && rooms[socket.roomId]) {
      io.to(socket.roomId).emit("playerUpdated", {
        players: rooms[socket.roomId].players,
      });
    }
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
    // Accept client-provided experience/level updates so gameplay-awarded
    // XP is reflected on the server during the match.
    //
    // The client stores XP as a "remainder" (0..XP_PER_LEVEL-1) and keeps
    // the current level separately. For experience gain events we apply
    // the same rollover logic as the client (level up when remainder exceeds
    // XP_PER_LEVEL) so server and client stay in sync.
    const reason = typeof payload.reason === "string" ? payload.reason : "";
    const isExperienceGain = reason.indexOf("experience") >= 0;

    if (typeof payload.experience !== "undefined") {
      const incomingExp = Number(payload.experience);
      if (Number.isFinite(incomingExp)) {
        if (isExperienceGain) {
          const prevLevel = Number(socket.level) || 1;
          const prevRemainder = Number(socket.experience) || 0;
          let newExpTotal = prevRemainder + incomingExp;
          let newLevel = prevLevel;
          while (newExpTotal >= XP_PER_LEVEL) {
            newExpTotal -= XP_PER_LEVEL;
            newLevel += 1;
          }
          socket.experience = newExpTotal;
          socket.level = newLevel;
        } else {
          // Treat the provided experience as the remainder (0..XP_PER_LEVEL-1)
          socket.experience = Number(incomingExp);
        }
      }
    }

    // If the client provided an explicit level (non-experience sync), trust it.
    if (!isExperienceGain && typeof payload.level !== "undefined") {
      const incomingLevel = Number(payload.level);
      if (Number.isFinite(incomingLevel)) {
        socket.level = incomingLevel;
      }
    }
    // Debug log for experience sync
    try {
      if (
        typeof payload.reason === "string" &&
        payload.reason.indexOf("experience") >= 0
      ) {
        console.log("[syncInventory] experience sync:", {
          id: socket.id,
          nickname: socket.nickname,
          reason: payload.reason,
          incoming: payload.experience,
          socketExperience: socket.experience,
          socketLevel: socket.level,
        });
      }
    } catch (e) {}
    if (typeof payload.avetime !== "undefined") {
      const incomingAve = Number(payload.avetime);
      if (Number.isFinite(incomingAve)) {
        socket.avetime = incomingAve;
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

    // if client provided avetime, update socket copy
    if (typeof payload.avetime !== "undefined") {
      const a = parseFloat(payload.avetime);
      if (!isNaN(a)) {
        socket.avetime = a;
      }
    }

    if (typeof payload.ratio !== "undefined") {
      const r = parseFloat(payload.ratio);
      if (!isNaN(r)) {
        socket.ratio = r;
      }
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
      null,
      Number.isFinite(socket.avetime) ? socket.avetime : null,
      Number.isFinite(socket.ratio) ? socket.ratio : null,
    );

    // If this socket is in a room, update the room's player snapshot so
    // subsequent game-end logic (finalizeGame) sees the latest values.
    try {
      if (socket.roomId && rooms && rooms[socket.roomId]) {
        const room = rooms[socket.roomId];
        room.players = room.players.map((p) => {
          if (!p) return p;
          if (
            p.id === socket.id ||
            p.nickname === socket.nickname ||
            p.nickname === targetPlayerId
          ) {
            return Object.assign({}, p, {
              level: socket.level || p.level,
              experience:
                typeof socket.experience !== "undefined"
                  ? socket.experience
                  : p.experience,
              coins:
                typeof socket.coins !== "undefined" ? socket.coins : p.coins,
              ratio:
                typeof socket.ratio !== "undefined" ? socket.ratio : p.ratio,
              items: Array.isArray(socket.items) ? socket.items : p.items,
            });
          }
          return p;
        });
        // notify room of updated player state for UI
        io.to(socket.roomId).emit("playerUpdated", {
          players: rooms[socket.roomId].players,
        });
        console.log(
          "[syncInventory] room snapshot updated for",
          socket.nickname,
          "room=",
          socket.roomId,
        );
      }
    } catch (e) {
      console.warn("syncPlayerInventory room snapshot update failed", e);
    }
  };

  socket.on("syncPlayerInventory", handleSyncPlayerInventory);
  socket.on("syncInventory", handleSyncPlayerInventory);
  socket.on("updatePlayerInventory", handleSyncPlayerInventory);
  socket.on("updateProfile", handleSyncPlayerInventory);
  socket.on("savePlayerProfile", handleSyncPlayerInventory);

  // Final profile sync from client (ensures latest level/experience reaches server)
  socket.on("finalProfileSync", (payload) => {
    try {
      if (!payload || typeof payload !== "object") return;
      const targetPlayerId =
        typeof socket.nickname === "string" && socket.nickname.trim()
          ? socket.nickname.trim()
          : typeof payload.id === "string" && payload.id.trim()
            ? payload.id.trim()
            : socket.nickname;

      if (!targetPlayerId) return;

      // Update socket state with final values (explicitly provided by the client)
      if (typeof payload.level !== "undefined") {
        const lvl = Number(payload.level);
        if (Number.isFinite(lvl)) {
          socket.level = lvl;
        }
      }
      if (typeof payload.experience !== "undefined") {
        const exp = Number(payload.experience);
        if (Number.isFinite(exp)) {
          socket.experience = exp;
        }
      }

      // Also update the room snapshot so finalizeGame reads the latest values.
      if (socket.roomId && rooms && rooms[socket.roomId]) {
        const room = rooms[socket.roomId];
        room.players = room.players.map((p) => {
          if (!p) return p;
          if (p.id === socket.id || p.nickname === targetPlayerId) {
            return Object.assign({}, p, {
              level: socket.level || p.level,
              experience:
                typeof socket.experience !== "undefined"
                  ? socket.experience
                  : p.experience,
            });
          }
          return p;
        });
      }

      // If finalizeGame is waiting, mark this player as updated
      if (socket.roomId) {
        markFinalProfileSyncReceived(socket.roomId, socket.id);
      }

      console.log("[finalProfileSync] received from", targetPlayerId, {
        level: socket.level,
        experience: socket.experience,
      });
    } catch (e) {
      console.warn("finalProfileSync handler error", e);
    }
  });

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
    console.log(
      `[DEBUG] createRoom initial avetime for ${socket.nickname}:`,
      socket.avetime,
    );

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
      // also restore average reaction time from DB
      socket.avetime = Number(savedData.avetime) || 0;

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
    const itemMode = data.itemMode !== false;
    const gameMode = data.gameMode === "timeattack" ? "timeattack" : "allin";
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
      itemMode: itemMode,
      gameMode: gameMode,
      timeAttackDurationMs: TIME_ATTACK_DURATION_MS,
      timeAttackTimer: null,
      timeAttackEndsAt: null,
      blockEffects: [], // 현재 방에 적용된 블록(먹물) 이펙트 목록
      aiCounter: 0,
      aiTimers: { turn: null, bells: {} },
      reactionSamples: {},
    };
    const playerData = {
      id: socket.id,
      nickname: socket.nickname,
      avatarKey: socket.avatarKey || "player_1",
      level: socket.level || 1, // 💡 방장 데이터도 포함
      coins: socket.coins || 0,
      experience: socket.experience || 0,
      avetime: socket.avetime || 0, // ⚠️ keep average speed in room state
      specialCards: socket.specialCards || {},
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
      itemMode: rooms[roomId].itemMode,
      gameMode: rooms[roomId].gameMode,
    });
    // immediately send profile so client has the latest avetime etc
    try {
      socket.emit("myProfile", {
        nickname: socket.nickname,
        level: Number(socket.level) || 1,
        coins: Number(socket.coins) || 0,
        items: Array.isArray(socket.items) ? socket.items : [],
        experience: Number(socket.experience) || 0,
        avetime: Number(socket.avetime) || 0,
        avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
        specialCards: socket.specialCards || {},
        owned_characters: socket.ownedCharacters || ["player_1"],
        current_character: socket.currentCharacter || "player_1",
      });
    } catch (e) {
      console.warn("emit myProfile error on createRoom", e);
    }

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

    if (!room) return socket.emit("joinRoomError", "방이 존재하지 않습니다.");

    // 기존 플레이어인지 확인
    const existingPlayerById = room.players.find((p) => p.id === socket.id);
    const existingPlayerByNickname = room.players.find(
      (p) => p.nickname === nickname,
    );
    const isRejoin = Boolean(existingPlayerById || existingPlayerByNickname);

    if (!isRejoin && room.players.length >= room.maxPlayers)
      return socket.emit("joinRoomError", "인원 초과");
    if (room.isGameStarted)
      return socket.emit("joinRoomError", "이미 시작된 게임");

    socket.join(roomId);
    socket.roomId = roomId;
    socket.nickname = nickname;
    socket.avatarKey = avatarKey;
    console.log(
      `🚪 joinRoom - socket.nickname 설정됨: ${socket.nickname}, isRejoin: ${isRejoin}`,
    );
    console.log(`[DEBUG] joinRoom avetime after load:`, socket.avetime);

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
        avetime: socket.avetime || 0,
        specialCards: socket.specialCards || {},
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
      itemMode: room.itemMode,
      gameMode: room.gameMode,
      newPlayerNickname: nickname,
      isRejoin,
    });
    // ensure client knows their own profile (including avetime) before game start
    try {
      socket.emit("myProfile", {
        nickname: socket.nickname,
        level: Number(socket.level) || 1,
        coins: Number(socket.coins) || 0,
        items: Array.isArray(socket.items) ? socket.items : [],
        experience: Number(socket.experience) || 0,
        avetime: Number(socket.avetime) || 0,
        avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
        specialCards: socket.specialCards || {},
        owned_characters: socket.ownedCharacters || ["player_1"],
        current_character: socket.currentCharacter || "player_1",
      });
    } catch (e) {
      console.warn("emit myProfile error on joinRoom", e);
    }
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

    if (!room) return socket.emit("joinRoomError", "방이 존재하지 않습니다.");

    // 기존 플레이어인지 확인
    const existingPlayerById = room.players.find((p) => p.id === socket.id);
    const existingPlayerByNickname = room.players.find(
      (p) => p.nickname === nickname,
    );
    const isRejoin = Boolean(existingPlayerById || existingPlayerByNickname);

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
      `🌐 joinPublicRoom - socket.nickname 설정됨: ${socket.nickname}, isRejoin: ${isRejoin}`,
    );
    console.log(`[DEBUG] joinPublicRoom avetime after load:`, socket.avetime);

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
        avetime: socket.avetime || 0,
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
      itemMode: room.itemMode,
      gameMode: room.gameMode,
      newPlayerNickname: nickname,
      isRejoin,
    });
    // also send profile to the newly joined client
    try {
      socket.emit("myProfile", {
        nickname: socket.nickname,
        level: Number(socket.level) || 1,
        coins: Number(socket.coins) || 0,
        items: Array.isArray(socket.items) ? socket.items : [],
        experience: Number(socket.experience) || 0,
        avetime: Number(socket.avetime) || 0,
        avatarKey: socket.currentCharacter || socket.avatarKey || "player_1",
        specialCards: socket.specialCards || {},
        owned_characters: socket.ownedCharacters || ["player_1"],
        current_character: socket.currentCharacter || "player_1",
      });
    } catch (e) {
      console.warn("emit myProfile error on joinPublicRoom", e);
    }
  });

  socket.on("addAiPlayer", () => {
    const room = rooms[socket.roomId];
    if (!room || room.isGameStarted) return;
    if (room.host !== socket.id) return;
    if (room.players.length >= room.maxPlayers) return;

    const aiPlayer = buildAiPlayer(room);
    room.players.push(aiPlayer);

    io.to(room.roomId).emit("playerJoined", {
      roomId: room.roomId,
      players: room.players,
      hostId: room.host,
      max: room.maxPlayers,
      roomName: room.roomName,
      itemMode: room.itemMode,
      gameMode: room.gameMode,
      newPlayerNickname: aiPlayer.nickname,
      isRejoin: false,
    });
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

    const hasHumanPlayers = room.players.some((p) => p && !p.isBot);
    if (!hasHumanPlayers) {
      clearAiBellTimers(room);
      clearAiTurnTimer(room);
      delete rooms[roomId];
      broadcastPublicRooms();
      return;
    }

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

  socket.on("leaveRoom", (data, ack) => {
    const payload = data && typeof data === "object" ? data : {};
    const roomId = payload.roomId || socket.roomId;
    const room = roomId ? rooms[roomId] : null;

    if (!room) {
      if (socket.roomId === roomId) socket.roomId = null;
      if (typeof ack === "function") ack({ ok: false, reason: "NO_ROOM" });
      return;
    }

    const targetId = socket.id;
    const targetIndex = room.players.findIndex((p) => p.id === targetId);
    const leftPlayerNickname =
      targetIndex >= 0 && room.players[targetIndex]
        ? room.players[targetIndex].nickname || socket.nickname || "누군가"
        : socket.nickname || "누군가";

    let removedPlayerIndex = -1;
    if (targetIndex >= 0) {
      removedPlayerIndex = targetIndex;
      room.players.splice(targetIndex, 1);
    }

    socket.leave(roomId);
    if (socket.roomId === roomId) socket.roomId = null;

    const hasHumanPlayers = room.players.some((p) => p && !p.isBot);
    if (!hasHumanPlayers) {
      clearAiBellTimers(room);
      clearAiTurnTimer(room);
      delete rooms[roomId];
      broadcastPublicRooms();
      if (typeof ack === "function") ack({ ok: true });
      return;
    }

    if (room.players.length === 0) {
      delete rooms[roomId];
    } else {
      if (room.host === targetId) {
        const nextHostId = pickNextHostId(room);
        if (nextHostId) room.host = nextHostId;
      }
      // If a player left during an active game, we must adjust turnIndex
      // so we don't end up with an out-of-range index or skip a player.
      if (
        room.isGameStarted &&
        typeof removedPlayerIndex === "number" &&
        removedPlayerIndex >= 0
      ) {
        // Normalize existing turnIndex
        const prevTurnIndex =
          typeof room.turnIndex === "number" ? room.turnIndex : 0;

        if (removedPlayerIndex < prevTurnIndex) {
          // Removal before current turn shifts indices left
          room.turnIndex = Math.max(0, prevTurnIndex - 1);
        } else if (removedPlayerIndex === prevTurnIndex) {
          // The player who had the turn left; keep same numeric index
          // which now refers to the next player in sequence. If out of
          // bounds, wrap to 0.
          if (room.players.length === 0) {
            room.turnIndex = 0;
          } else {
            room.turnIndex = prevTurnIndex % room.players.length;
          }
        }

        // Ensure turnIndex is safe
        if (room.players.length > 0) {
          if (room.turnIndex >= room.players.length)
            room.turnIndex = room.players.length - 1;
          if (room.turnIndex < 0) room.turnIndex = 0;
        } else {
          room.turnIndex = 0;
        }

        // Clear AI timers to avoid stale callbacks for the removed player,
        // then let processSkipTurn reschedule as needed.
        clearAiBellTimers(room);
        clearAiTurnTimer(room);
      }
      io.to(roomId).emit("playerLeft", {
        playerId: targetId,
        players: room.players,
        hostId: room.host,
        leftPlayerNickname,
      });

      if (room.isGameStarted) {
        if (checkGameOver(room, io)) {
          if (typeof ack === "function") ack({ ok: true });
          return;
        }
        processSkipTurn(room, io);
      }
    }

    broadcastPublicRooms();
    if (typeof ack === "function") ack({ ok: true });
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
      itemMode: room.itemMode,
      gameMode: room.gameMode,
    });

    socket.emit("joinRoomSuccess", {
      players: room.players,
      hostId: room.host,
      roomName: room.roomName,
      isGameStarted: room.isGameStarted,
      itemMode: room.itemMode,
      gameMode: room.gameMode,
    });
  });

  socket.on("startGameRequest", async (ack) => {
    console.log("[SERVER] startGameRequest received from", socket.id);
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

    // 시작 직전에 room.players의 specialCards를 실시간 소켓과 동기화합니다.
    // (게임 시작 직후 공격이 들어오는 경우에 대비한 안전장치)
    try {
      for (const p of room.players) {
        try {
          const s = p && p.id ? io.sockets.sockets.get(p.id) : null;
          // copy from socket if available
          if (s && s.specialCards && Object.keys(s.specialCards).length > 0) {
            p.specialCards = s.specialCards;
          }

          // restore from DB if neither snapshot nor socket had cards
          if (
            (!p.specialCards || Object.keys(p.specialCards).length === 0) &&
            s &&
            s.nickname
          ) {
            try {
              const saved = await getPlayer(s.nickname);
              let parsedSpecial = {};
              if (saved) {
                if (
                  typeof saved.items === "object" &&
                  !Array.isArray(saved.items)
                ) {
                  parsedSpecial = saved.items.specialCards || {};
                } else if (typeof saved.items === "string") {
                  try {
                    const parsed = JSON.parse(saved.items);
                    if (
                      parsed &&
                      typeof parsed === "object" &&
                      !Array.isArray(parsed)
                    ) {
                      parsedSpecial = parsed.specialCards || {};
                    }
                  } catch (e) {}
                }
              }
              if (parsedSpecial && Object.keys(parsedSpecial).length > 0) {
                p.specialCards = parsedSpecial;
                if (s) s.specialCards = parsedSpecial;
              }
            } catch (e) {
              // ignore restore errors
            }
          }

          // debug: inspect before cleaning
          console.log(
            `[debug] startGame sync pre-clean player=${p.nickname} id=${p.id} p.specialCards=${JSON.stringify(
              p.specialCards,
            )} s.specialCards=${JSON.stringify(s && s.specialCards)}`,
          );
          // ensure objects exist
          p.specialCards = p.specialCards || {};
          if (s) s.specialCards = s.specialCards || {};

          // debug: after ensuring objects
          console.log(
            `[debug] startGame sync after-clean player=${p.nickname} p.specialCards=${JSON.stringify(
              p.specialCards,
            )}`,
          );
        } catch (e) {
          // ignore per-player sync error
        }
      }
    } catch (e) {
      console.warn("startGame: failed to sync specialCards", e);
    }
    // 디버그: 게임 시작 시 모든 플레이어의 특수카드 보유 상태를 로그로 남깁니다.
    try {
      const snapshot = room.players.map((p) => {
        const liveSock = p && p.id ? io.sockets.sockets.get(p.id) : null;
        return {
          id: p.id,
          nickname: p.nickname,
          roomSnapshot: p.specialCards || {},
          liveSocket: liveSock ? liveSock.specialCards || {} : null,
        };
      });
      console.log(
        "[startGame] players specialCards snapshot:",
        JSON.stringify(snapshot),
      );
      emitServerDebug(room, "startGame.specialCardsSnapshot", { snapshot });
    } catch (e) {
      console.warn("startGame: failed to log specialCards snapshot", e);
    }

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
    clearTimeAttackTimer(room);
    const hostIndex = room.players.findIndex((p) => p.id === room.host);
    room.turnIndex = hostIndex >= 0 ? hostIndex : 0;
    // 1 => forward, -1 => reverse
    room.turnDirection = 1;
    room.bellLocked = false;
    room.isFlipping = false;
    room.lastFlipTime = null;
    const total = room.players.length;
    // 균등 분배를 위해 나눠떨어지지 않는 카드 수는 제거
    while (deck.length % total !== 0) {
      deck.pop();
    }
    const gameDeck = deck;

    const matchAiProfile = buildMatchAiProfile(room);
    room.players.forEach((p, idx) => {
      p.myDeck = gameDeck.filter((_, i) => i % total === idx);
      p.cards = p.myDeck.length; // 💡 이 줄을 추가해서 개수를 명시적으로 저장
      p.openCard = null;
      p.openCardStack = [];
      p.isReady = p.isBot ? true : false;
      p.isEliminated = false; // 시작할 때 초기화
      if (p.isBot) {
        // Keep AI skill similar within a match, with slight variation.
        const variance = 0.95 + Math.random() * 0.1;
        p.aiProfile = {
          flipDelay: Math.max(
            450,
            Math.round(matchAiProfile.flipDelay * variance),
          ),
          reactionTime: Math.max(
            500,
            Math.round(matchAiProfile.reactionTime * variance),
          ),
          baseline: matchAiProfile.baseline,
        };
      }
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
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: BOMB_CARD_TYPE };
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
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: TON_CARD_TYPE };
        console.log(
          `🔁 inject ton -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectTonCardsToPlayers(room.players, TON_CARD_COUNT);
    // Pen 카드 주입
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
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: PEN_CARD_TYPE };
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
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: PLUS1_CARD_TYPE };
        console.log(
          `➕ inject plus1 -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectPlus1CardsToPlayers(room.players, PLUS1_CARD_COUNT);
    // Coin 카드 주입
    function injectCoinCardsToPlayers(players, coinCount) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(coinCount) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: COIN_CARD_TYPE };
        console.log(
          `🪙 inject coin -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectCoinCardsToPlayers(room.players, COIN_CARD_COUNT);
    // Plus2 카드 주입
    function injectPlus2CardsToPlayers(players, plus2Count) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(plus2Count) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: PLUS2_CARD_TYPE };
        console.log(
          `➕➕ inject plus2 -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectPlus2CardsToPlayers(room.players, PLUS2_CARD_COUNT);
    // Not5 카드 주입
    function injectNot5CardsToPlayers(players, not5Count) {
      if (!Array.isArray(players) || players.length === 0) return;

      const drawablePlayers = players.filter(
        (player) => Array.isArray(player.myDeck) && player.myDeck.length > 0,
      );
      if (drawablePlayers.length === 0) return;

      const count = Math.max(0, Number(not5Count) || 0);
      for (let i = 0; i < count; i += 1) {
        const targetPlayer =
          drawablePlayers[Math.floor(Math.random() * drawablePlayers.length)];
        if (!targetPlayer || !Array.isArray(targetPlayer.myDeck)) continue;

        const insertIndex = Math.floor(
          Math.random() * targetPlayer.myDeck.length,
        );
        targetPlayer.myDeck[insertIndex] = { type: NOT5_CARD_TYPE };
        console.log(
          `⭕ inject not5 -> ${targetPlayer.nickname || targetPlayer.id} (deckIndex=${insertIndex})`,
        );
      }
    }
    injectNot5CardsToPlayers(room.players, NOT5_CARD_COUNT);

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
    const coinCount = room.players.reduce(
      (sum, player) =>
        sum +
        (Array.isArray(player.myDeck)
          ? player.myDeck.filter((c) => isCoinCard(c)).length
          : 0),
      0,
    );
    emitServerDebug(room, "coin.injected", { coinCount });
    const not5Count = room.players.reduce(
      (sum, player) =>
        sum +
        (Array.isArray(player.myDeck)
          ? player.myDeck.filter((c) => isNot5Card(c)).length
          : 0),
      0,
    );
    emitServerDebug(room, "not5.injected", { not5Count });

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
        bombIndices,
        thunderIndices,
        sample,
        deckSize: deck.length,
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
    if (room.gameMode === "timeattack") {
      room.timeAttackEndsAt = Date.now() + room.timeAttackDurationMs;
      room.timeAttackTimer = setTimeout(() => {
        handleTimeAttackExpiry(room, io);
      }, room.timeAttackDurationMs);
    }

    io.to(room.roomId).emit("gameStart", {
      roomId: room.roomId,
      players: room.players,
      hostId: room.host,
      roomName: room.roomName,
      maxPlayers: room.maxPlayers,
      nextTurnId: room.players[room.turnIndex].id,
      itemMode: room.itemMode,
      gameMode: room.gameMode,
      timeAttackEndsAt: room.timeAttackEndsAt,
    });

    console.log(
      `[SERVER] emitting gameStart for room=${room.roomId} turnIndex=${room.turnIndex}`,
    );
    emitServerDebug(room, "gameStart.emitted", {
      nextTurnId: room.players[room.turnIndex].id,
      totalPlayers: room.players.length,
    });

    // If the first turn belongs to a bot, schedule its action.
    console.log(
      `[AI] scheduleAiTurn invoked at gameStart room=${room.roomId} turnIndex=${room.turnIndex}`,
    );
    scheduleAiTurn(room, io);
    respond({
      ok: true,
      stage: "GAME_STARTED",
      roomId: room.roomId,
      nextTurnId: room.players[room.turnIndex].id,
      thunderCount,
    });
  });

  // 플레이어 준비 토글 처리 (클라이언트에서 emit: "toggleReady")
  socket.on("toggleReady", () => {
    try {
      const room = rooms[socket.roomId];
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      player.isReady = !Boolean(player.isReady);
      console.log(
        `[READY] ${socket.id} (${socket.nickname}) toggled ready -> ${player.isReady}`,
      );

      // Broadcast updated ready status to room
      io.to(room.roomId).emit("readyStatusUpdated", {
        players: room.players,
        hostId: room.host,
        max: room.maxPlayers,
        roomName: room.roomName,
        roomNumber: room.roomNumber,
      });
    } catch (e) {
      console.warn("toggleReady handler error", e);
    }
  });

  socket.on("flipCard", () => {
    const room = rooms[socket.roomId];
    // if the human is trying to flip, cancel any AI action that might be
    // scheduled for the same turn. this prevents the AI from racing the
    // player and leaving room.isFlipping stuck.
    if (room) clearAiTurnTimer(room);

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

    if (!room.isGameStarted || room.isFlipping) {
      console.log("[TURN_DEBUG] flipCard blocked", {
        reason: !room.isGameStarted ? "notStarted" : "isFlipping",
        bellLocked: !!room.bellLocked,
        bellPending: !!room.bellPending,
      });
      return;
    }

    if (room.bellLocked) {
      // a bell just fired and has not yet advanced the turn – ignore any
      // attempted flips until the lock is cleared by processSkipTurn.
      console.log("[TURN_DEBUG] flipCard blocked due to bellLocked");
      return;
    }

    room.turnIndex = getSafeNextIndex(room);
    console.log(`[TURN_DEBUG] advance turn -> ${room.turnIndex}`);
    emitServerDebug(room, "turn.advanced", { turnIndex: room.turnIndex });
    emitServerDebug(room, "turn.advanced", { turnIndex: room.turnIndex });
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
    console.log("[TURN_DEBUG] human flip set isFlipping true");
    emitServerDebug(room, "human.flipStart", { playerId: socket.id });

    // 💡 [추가] 카드가 뒤집히는 시점의 시간을 기록 (반응 속도 측정 시작)
    room.lastFlipTime = Date.now();
    const flipStartTime = room.lastFlipTime;

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
    } else {
      console.log(
        `[TURN_DEBUG] normal card flipped by ${p.nickname} ${p.id}`,
        card,
      );
    }
    p.openCard = card;
    p.openCardStack.push(card);

    if (isBombCard(card) || isTonCard(card)) {
      extendSpecialPause(room);
    }

    // 블록(먹물) 이펙트가 있는 경우: 어떤 플레이어가 제출하든 모든 effect의 남은 턴을 감소
    try {
      if (Array.isArray(room.blockEffects) && room.blockEffects.length > 0) {
        room.blockEffects.forEach((eff) => {
          eff.remainingTurns = (eff.remainingTurns || 0) - 1;
        });

        const expired = room.blockEffects.filter((e) => e.remainingTurns <= 0);
        if (expired.length > 0) {
          const expiredIds = new Set(expired.map((e) => e.id));
          room.players.forEach((pl) => {
            if (!pl || !Array.isArray(pl.openCardStack)) return;
            pl.openCardStack = pl.openCardStack.filter(
              (c) =>
                !(c && c.type === "blockcard" && expiredIds.has(c.effectId)),
            );
          });

          // 만료된 이펙트 제거
          room.blockEffects = room.blockEffects.filter(
            (e) => e.remainingTurns > 0,
          );
        }
      }
    } catch (e) {
      console.warn("blockEffects processing error", e);
    }

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

    let coinReward = null;
    let coinTotal = null;
    if (isCoinCard(card)) {
      const rewardInfo = applyCoinCardReward(room, p, io);
      coinReward = rewardInfo?.reward ?? COIN_CARD_REWARD;
      coinTotal = rewardInfo?.coinTotal ?? null;
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
      coinReward,
      coinTotal,
    });

    scheduleAiBell(room, io);

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

      // if a bell occurred after this flip started we should ignore the
      // timer entirely to avoid overwriting the winner's turn.  lastBellTime
      // is set when handleRingForSocket successfully processes a bell.
      if (
        room.lastBellTime &&
        flipStartTime &&
        room.lastBellTime >= flipStartTime
      ) {
        room.isFlipping = false;
        return;
      }

      // if a correct bell is still locked, skip advancing as before
      if (room.bellLocked) {
        room.isFlipping = false;
        return;
      }

      const pauseRemaining = getSpecialPauseRemaining(room);
      if (pauseRemaining > 0) {
        setTimeout(() => {
          if (!room || !room.isGameStarted) return;
          room.isFlipping = false;
          const dir =
            typeof room.turnDirection === "number" ? room.turnDirection : 1;
          room.turnIndex =
            (room.turnIndex + dir + room.players.length) % room.players.length;
          processSkipTurn(room, io);
        }, pauseRemaining + 20);
        return;
      }

      room.isFlipping = false;
      const dir =
        typeof room.turnDirection === "number" ? room.turnDirection : 1;
      room.turnIndex =
        (room.turnIndex + dir + room.players.length) % room.players.length;
      processSkipTurn(room, io);
    }, 150);
  });

  function handleRingForSocket(sock) {
    const room = rooms[sock.roomId];
    if (!room || !room.isGameStarted) return;
    // prevent AI actions while we evaluate this ring
    room.bellPending = true;

    // immediately cancel any pending AI flip; see earlier comment in
    // the file for reasoning.
    clearAiTurnTimer(room);

    if (room.bellLocked) return;

    // during any special-card pause we normally ignore bell presses, but
    // a lightning card on the table should override the pause and allow
    // an immediate ring.  compute the thunder state early so we can make
    // that decision before returning.
    const pauseRemaining = getSpecialPauseRemaining(room);
    const thunderNow = hasThunderCardOnTable(room.players);
    if (pauseRemaining > 0 && !thunderNow) return;

    // clear pending AI bell timers once we are actually going to evaluate
    // the ring.  doing it earlier (prior to the pause check) could clear
    // timers even when the ring is ignored, allowing bots to still fire
    // during the pause window.
    clearAiBellTimers(room);

    // If a flip is currently being processed, normally wait and retry
    if (room.isFlipping) {
      // but if a thunder card is already on the table we can still process
      const thunderNow = hasThunderCardOnTable(room.players);
      if (!thunderNow) {
        setTimeout(() => handleRingForSocket(sock), 50);
        return;
      }
      // otherwise fall through and evaluate normally (optimistic success)
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
    const hasNot5 = hasNot5CardOnTable(room.players);
    // bomb가 테이블에 있으면 어떤 경우에도 종은 실패(패널티)
    // not5가 있으면 정답 조건이 반전: 합이 5가 아닌 경우가 정답
    const isCorrectBell =
      !hasBomb && (hasThunder || (hasNot5 ? !isFive : isFive));
    if (hasBomb) {
      emitServerDebug(room, "bomb.presentOnTable", {
        ts: Date.now(),
        roomId: room.roomId,
      });
    }
    if (hasNot5) {
      emitServerDebug(room, "not5.presentOnTable", {
        ts: Date.now(),
        roomId: room.roomId,
      });
    }

    if (isCorrectBell) {
      // record bell timestamp for flip-timer comparisons
      room.lastBellTime = Date.now();
      // lock as soon as we know the bell was right (it may already have
      // been cleared above but doing it again keeps the meaning clear)
      room.bellLocked = true;
      // ensure no stray timer survives
      clearAiTurnTimer(room);
      // also clear any flip lock so AI scheduling isn’t blocked
      room.isFlipping = false;

      // 만약 시작하자마자 종을 누르는 경우를 대비해 기본값 0 설정
      const reactionTimeMs = room.lastFlipTime
        ? Date.now() - room.lastFlipTime
        : 0;
      const reactionTimeSec = (reactionTimeMs / 1000).toFixed(2);

      // Track human reaction times to calibrate AI speed next match.
      if (!room.reactionSamples) room.reactionSamples = {};
      const winnerId = sock.id;
      if (!room.reactionSamples[winnerId]) room.reactionSamples[winnerId] = [];
      if (reactionTimeMs > 0) {
        room.reactionSamples[winnerId].push(reactionTimeMs);
        if (room.reactionSamples[winnerId].length > 5) {
          room.reactionSamples[winnerId].shift();
        }
        console.log("[DEBUG] recorded reaction sample", {
          player: sock.nickname || sock.id,
          ms: reactionTimeMs,
          samples: room.reactionSamples[winnerId].slice(),
        });
      } else {
        console.log("[DEBUG] reactionTimeMs was 0, not recorded", {
          player: sock.nickname || sock.id,
        });
      }

      // --- [성공 시나리오] ---
      let collected = [];
      room.players.forEach((p) => {
        collected = [...collected, ...p.openCardStack];
        p.openCardStack = [];
        p.openCard = null;
        // no plus1 flag to clear
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

      // leave bellLocked true until processSkipTurn clears it; that way
      // any AI flip arriving between result emission and turn advancement
      // will be ignored.
      processSkipTurn(room, io);
    } else {
      const p = room.players.find((pl) => pl.id === sock.id);
      const others = room.players.filter(
        (pl) => pl.id !== sock.id && !pl.isEliminated,
      );

      // 자동 자물쇠 처리: 패널티 적용 전에 해당 플레이어 소켓에 lock(id=4)이 있으면 소모하고 패널티를 건너뜁니다.
      if (room.itemMode !== false) {
        try {
          // ensure our room snapshot has up-to-date specialCards values by
          // refreshing from live sockets (same helper used elsewhere)
          const refreshRoomSpecialCards = (room) => {
            if (!room || !Array.isArray(room.players)) return;
            room.players.forEach((p) => {
              if (!p || !p.id) return;
              const s = io.sockets.sockets.get(p.id);
              const sockCards = s && s.specialCards ? s.specialCards : {};
              // console.log(`[debug] refreshRoomSpecialCards player=${p.nickname} id=${p.id} socketCards=${JSON.stringify(sockCards)}`);
              if (s && s.specialCards) {
                p.specialCards = { ...s.specialCards };
              }
            });
          };
          refreshRoomSpecialCards(room);

          const penalizedSocket = io.sockets.sockets.get(sock.id) || sock;
          console.log(
            "[auto-lock check] socketId=",
            sock.id,
            "specialCards=",
            penalizedSocket.specialCards,
          );
          if (
            penalizedSocket &&
            penalizedSocket.specialCards &&
            Number(penalizedSocket.specialCards[4] || 0) > 0
          ) {
            // 차감
            penalizedSocket.specialCards[4] =
              Number(penalizedSocket.specialCards[4] || 0) - 1;
            if (penalizedSocket.specialCards[4] <= 0)
              delete penalizedSocket.specialCards[4];

            // DB 동기화 (비동기)
            const mergedItems = {
              items: Array.isArray(penalizedSocket.items)
                ? penalizedSocket.items
                : [],
              specialCards: penalizedSocket.specialCards || {},
            };
            savePlayer(
              penalizedSocket.nickname,
              penalizedSocket.level || 1,
              penalizedSocket.coins || 0,
              mergedItems,
              penalizedSocket.experience || 0,
              penalizedSocket.ownedCharacters || ["player_1"],
              penalizedSocket.currentCharacter ||
                penalizedSocket.avatarKey ||
                "player_1",
              null,
              typeof penalizedSocket.avetime === "number" &&
                penalizedSocket.avetime > 0
                ? penalizedSocket.avetime
                : null,
            ).catch((e) => console.warn("savePlayer error on auto-lock", e));

            // 해당 플레이어에게 프로필 업데이트 전송
            try {
              penalizedSocket.emit("myProfile", {
                nickname: penalizedSocket.nickname,
                level: Number(penalizedSocket.level) || 1,
                coins: Number(penalizedSocket.coins) || 0,
                items: Array.isArray(penalizedSocket.items)
                  ? penalizedSocket.items
                  : [],
                experience: Number(penalizedSocket.experience) || 0,
                avetime: Number(penalizedSocket.avetime) || 0,
                avatarKey:
                  penalizedSocket.currentCharacter ||
                  penalizedSocket.avatarKey ||
                  "player_1",
                specialCards: penalizedSocket.specialCards || {},
                owned_characters: penalizedSocket.ownedCharacters || [
                  "player_1",
                ],
                current_character:
                  penalizedSocket.currentCharacter || "player_1",
              });
            } catch (e) {
              console.warn("emit myProfile error on auto-lock", e);
            }

            // 룸에 패널티 면제 알림 전송 (recipients 빈 배열로 전달)
            io.to(room.roomId).emit("bellResult", {
              success: false,
              penaltyId: null,
              message: `${penalizedSocket.nickname}님이 자물쇠로 패널티를 면제했습니다.`,
              players: room.players,
              recipients: [],
              penaltyPerRecipient: 0,
              autoLockUsedBy: penalizedSocket.id,
            });

            // also broadcast a specialUsed event so clients can show lock effect
            io.to(room.roomId).emit("specialUsed", {
              cardId: 4,
              by: penalizedSocket.id,
              players: room.players,
              recipients: [],
              shielded: [],
              message: `${penalizedSocket.nickname}님이 자물쇠를 사용했습니다!`,
            });

            processSkipTurn(room, io);
            return;
          }
        } catch (e) {
          console.warn("auto-lock check error", e);
        }
      }

      const recipients = []; // 💡 카드를 실제 받은 사람 ID를 담을 배열

      const hasPen = hasPenCardOnTable(room.players);
      const hasNot5 = hasNot5CardOnTable(room.players);
      let penaltyPerRecipient = null; // for response payload - if not5 active, will be set to given count

      // not5가 활성화된 경우: 패널티는 틀린 사람의 덱 절반이 꼴찌(가장 적은 카드 보유자)에게 이동
      if (hasNot5) {
        emitServerDebug(room, "not5.penaltyApplied", {
          ts: Date.now(),
          roomId: room.roomId,
        });

        const candidates = room.players.filter(
          (pl) => pl.id !== p.id && !pl.isEliminated,
        );
        if (candidates.length > 0) {
          // 꼴찌(덱 수 최소) 선택
          candidates.sort(
            (a, b) => (a.myDeck?.length || 0) - (b.myDeck?.length || 0),
          );
          const loser = candidates[0];
          let givenAny = false;
          const giveCount = Math.floor((p.myDeck.length || 0) / 2);
          for (let k = 0; k < giveCount; k += 1) {
            if (p.myDeck.length > 0) {
              const card = p.myDeck.pop();
              loser.myDeck.unshift(card);
              givenAny = true;
            }
          }
          penaltyPerRecipient = giveCount;
          if (givenAny) recipients.push(loser.id);
        }
      } else {
        penaltyPerRecipient = hasPen ? 2 : 1;
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
              topType:
                top && top.type ? top.type : `${top?.fruit}_${top?.count}`,
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
    // ring handling done, allow AI again after a brief grace period
    // this prevents flips that would otherwise fire within a few dozen
    // milliseconds of the result being emitted.
    setTimeout(() => {
      if (room) room.bellPending = false;
    }, 500);
  }

  socket.on("ringBell", () => handleRingForSocket(socket));

  socket.on("disconnect", async () => {
    // 💡 연결 해제 시 플레이어 데이터 저장 (중요한 누락 부분 수정)
    if (socket.nickname) {
      try {
        const mergedItems = {
          items: Array.isArray(socket.items) ? socket.items : [],
          specialCards: socket.specialCards || {},
        };

        // only include avetime if we actually have a value to preserve
        const avetimeArg =
          typeof socket.avetime === "number" && socket.avetime > 0
            ? socket.avetime
            : null;
        const ratioArg =
          typeof socket.ratio === "number" && socket.ratio >= 0
            ? socket.ratio
            : null;
        await savePlayer(
          socket.nickname,
          socket.level || 1,
          socket.coins || 0,
          mergedItems,
          socket.experience || 0,
          socket.ownedCharacters || ["player_1"],
          socket.currentCharacter || "player_1",
          null,
          avetimeArg,
          ratioArg,
        );

        console.log(
          `✅ 연결 해제 시 ${socket.nickname} 데이터 저장 완료` +
            (avetimeArg !== null
              ? ` (avetime=${avetimeArg})`
              : " (avetime unchanged)") +
            (ratioArg !== null ? ` (ratio=${ratioArg})` : " (ratio unchanged)"),
        );
      } catch (e) {
        console.warn(`❌ 연결 해제 시 ${socket.nickname} 데이터 저장 실패:`, e);
      }
    }

    const room = rooms[socket.roomId];
    if (room) {
      // 强퇴 여부 확인 (강퇴된 경우 이미 room.players에서 제거됨)
      const wasInRoom = room.players.some((p) => p.id === socket.id);

      // 1. 💡 나가는 사람의 닉네임을 소켓 객체에서 미리 가져옵니다.
      // (setNickname 등에서 socket.nickname을 저장했다면 가능합니다)
      const leftPlayerNickname = socket.nickname || "누군가";

      // 2. 플레이어 제거
      room.players = room.players.filter((p) => p.id !== socket.id);

      const hasHumanPlayers = room.players.some((p) => p && !p.isBot);
      if (!hasHumanPlayers) {
        clearAiBellTimers(room);
        clearAiTurnTimer(room);
        delete rooms[socket.roomId];
        broadcastPublicRooms();
        return;
      }

      if (room.players.length === 0) {
        delete rooms[socket.roomId];
      } else if (wasInRoom) {
        // 호스트 위임 로직
        if (room.host === socket.id) {
          const nextHostId = pickNextHostId(room);
          if (nextHostId) room.host = nextHostId;
        }

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
