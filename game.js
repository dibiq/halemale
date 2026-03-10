import { getUserKeyForGame } from "@apps-in-toss/web-framework";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { title } from "process";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";

const THUNDER_CARD_TYPE = "thunder";
const SINGLE_THUNDER_CARD_COUNT = 1;
const BOMB_CARD_TYPE = "bomb";
const SINGLE_BOMB_CARD_COUNT = 1;
const TON_CARD_TYPE = "ton";
const SINGLE_TON_CARD_COUNT = 1;
const PEN_CARD_TYPE = "pen";
const SINGLE_PEN_CARD_COUNT = 0;
const PLUS1_CARD_TYPE = "plus1";
const SINGLE_PLUS1_CARD_COUNT = 1;
const COIN_CARD_TYPE = "coin";
const SINGLE_COIN_CARD_COUNT = 1;
const COIN_CARD_REWARD = 30;
const PLUS2_CARD_TYPE = "plus2";
const SINGLE_PLUS2_CARD_COUNT = 0;
const NOT5_CARD_TYPE = "not5";
const SINGLE_NOT5_CARD_COUNT = 0;
const TUTORIAL_STATE_KEY = "tutorialCompleted";
const QUEST_PROGRESS_STORAGE_KEY = "singleQuestProgress";
const MULTI_QUEST_PROGRESS_STORAGE_KEY = "multiQuestProgress";
const QUEST_CONFIGS = [
  {
    key: "bell_master",
    type: "count",
    titleTemplate: "정답 {target}번 맞추기",
    descriptionTemplate: "싱글에서 종을 정확히 {target}번 눌러보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 30,
  },
  {
    key: "big_haul",
    type: "threshold",
    titleTemplate: "정답 시 {threshold}장 획득",
    descriptionTemplate: "한 번의 정답으로 카드 {threshold}장을 가져가세요.",
    initialTarget: 1,
    targetIncrement: 1,
    initialThreshold: 5,
    thresholdIncrement: 1,
    rewardCoins: 40,
  },
  {
    key: "penalty_runner",
    type: "count",
    titleTemplate: "패널티 {target}회 체험",
    descriptionTemplate: "실수로 종을 쳐서 패널티를 {target}번 받아보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 25,
  },
  {
    key: "bomb_flip",
    type: "count",
    titleTemplate: "폭탄 {target}회 오픈",
    descriptionTemplate: "내 덱에서 폭탄 카드를 총 {target}번 뒤집어보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 25,
  },
  {
    key: "combo_duo",
    type: "count",
    titleTemplate: "{target}콤보 성공",
    descriptionTemplate: "정답을 연속 {target}번 맞춰 콤보를 달성하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 35,
  },
  {
    key: "thunder_flip",
    type: "count",
    titleTemplate: "번개 {target}회 오픈",
    descriptionTemplate: "내 덱에서 번개 카드를 총 {target}번 뒤집어보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 25,
  },
];
const MULTI_QUEST_CONFIGS = [
  {
    key: "multi_play",
    type: "count",
    titleTemplate: "멀티플레이 {target}판 참여",
    descriptionTemplate: "멀티플레이에 {target}번 참여해보세요.",
    initialTarget: 3,
    targetIncrement: 2,
    rewardCoins: 30,
  },
  {
    key: "multi_first",
    type: "count",
    titleTemplate: "멀티 1등 {target}회 달성",
    descriptionTemplate: "멀티플레이에서 1등을 {target}번 달성하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 50,
  },
  {
    key: "multi_room",
    type: "count",
    titleTemplate: "방 만들기 {target}회",
    descriptionTemplate: "멀티플레이 방을 {target}번 만들어보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 25,
  },
  {
    key: "multi_card_win",
    type: "count",
    titleTemplate: "멀티에서 카드 {target}장 획득",
    descriptionTemplate: "멀티플레이에서 카드 {target}장을 획득하세요.",
    initialTarget: 5,
    targetIncrement: 5,
    rewardCoins: 35,
  },
  {
    key: "multi_penalty",
    type: "count",
    titleTemplate: "멀티 패널티 {target}회",
    descriptionTemplate: "멀티플레이에서 패널티를 {target}번 받아보세요.",
    initialTarget: 3,
    targetIncrement: 2,
    rewardCoins: 25,
  },
  {
    key: "multi_ad_reward",
    type: "count",
    titleTemplate: "광고 보상 {target}회 받기",
    descriptionTemplate: "광고 보상을 {target}번 받아보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 20,
  },
];
const QUEST_CONFIG_MAP = QUEST_CONFIGS.reduce((acc, quest) => {
  acc[quest.key] = quest;
  return acc;
}, {});

function formatQuestTemplate(template, vars) {
  if (!template) return "";
  return template
    .replace(/\{target\}/g, vars.target ?? "")
    .replace(/\{threshold\}/g, vars.threshold ?? "");
}

function buildQuestRuntime(quest, entry = {}) {
  const stage = Math.max(0, Number(entry.stage) || 0);
  const baseTarget = Math.max(1, Number(quest.initialTarget) || 1);
  const targetIncrement = Number(quest.targetIncrement) || 0;
  const target = Math.max(1, baseTarget + stage * targetIncrement);
  let threshold;
  if (typeof quest.initialThreshold === "number") {
    const base = Number(quest.initialThreshold) || 0;
    const increment = Number(quest.thresholdIncrement) || 0;
    threshold = base + stage * increment;
  }
  const textVars = { target, threshold };

  return {
    stage,
    target,
    threshold,
    title: formatQuestTemplate(quest.titleTemplate, textVars),
    description: formatQuestTemplate(quest.descriptionTemplate, textVars),
  };
}
const TUTORIAL_STAGE_CONFIGS = [
  {
    key: "flip",
    title: "1단계 · 카드 제출",
    description: "내 카드를 눌러 카드를 제출해보세요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "ringFive",
    title: "2단계 · 카드 획득",
    description: "바닥의 과일 합이 5가 되면 종을 눌러주세요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "wrongBell",
    title: "3단계 · 패널티",
    description: "숫자합이 5가 아닐 때 종을 누르면 카드를 한 장씩 뺏겨요.",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "bomb",
    title: "4단계 · 특수카드: 폭탄",
    description:
      "폭탄이 열린 동안엔 합이 5여도 종을 누르면 안돼요. 카드만 제출하세요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "thunder",
    title: "5단계 · 특수카드: 번개",
    description:
      "카드 합이 5가 아니어도 번개가 나오면 즉시 종을 눌러 카드를 가져가요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "plus1",
    title: "6단계 · 특수카드: +1",
    description:
      "+1 카드가 있으면 모든 카드 숫자에 +1이 적용됩니다. 이를 계산해 종을 누르세요!",
    pointer: "deck",
    reward: 20,
  },
];

function handleGetUserKey() {
  // ReactNativeWebView가 있는지 먼저 확인
  if (typeof ReactNativeWebView !== "undefined") {
    ReactNativeWebView.postMessage(JSON.stringify({ type: "GET_USER_KEY" }));
    return;
  }

  // 브라우저 환경일 경우 임시 키 발급 또는 에러 방지 처리
  console.warn(
    "ReactNativeWebView를 찾을 수 없습니다. 브라우저 모드로 동작합니다.",
  );
  return "GUEST_USER";
}

// treat a few common local hostnames as "production" when
// deciding the default SERVER_URL.  this allows dev builds opened on
// localhost to still connect to the remote render server without
// needing to supply a query string or env var.
const PRODUCTION_HOSTS = new Set([
  "halemale.onrender.com",
  "halemale-client.onrender.com",
  "halemale.apps.tossmini.com",
  "halemale.private-apps.tossmini.com",
  "skewer-master.apps.tossmini.com",
  "skewer-master.private-apps.tossmini.com",
  // also honor common development hostnames as production
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);
const browserHost =
  typeof window !== "undefined" ? window.location.hostname : "";

// private LAN addresses should also behave like production (the remote
// render server is preferred over whatever service might be running on
// the local machine).  covers 10.x, 127.x, 169.254.x, 172.16-31.x, and
// 192.168.x ranges.
function isPrivateHost(host) {
  return /^(?:10|127|169\.254|192\.168|172\.(?:1[6-9]|2[0-9]|3[0-1]))\./.test(
    host,
  );
}

const isProductionBrowser =
  PRODUCTION_HOSTS.has(browserHost) || isPrivateHost(browserHost);
const envServerUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SERVER_URL
    : "";
const queryServerUrl =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("server")
    : "";

const SERVER_URL =
  queryServerUrl ||
  envServerUrl ||
  (!isProductionBrowser
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : "https://halemale.onrender.com");

const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"], // 웹소켓 우선 사용
  withCredentials: true,
});

socket.off("serverDebug").on("serverDebug", (payload) => {
  const event = payload?.event || "unknown";
  const roomId = payload?.roomId || "-";
  const ts = payload?.ts ? new Date(payload.ts).toLocaleTimeString() : "-";
  //console.log(`🛰️ [serverDebug][${ts}][room:${roomId}] ${event}`, payload);
});

socket.off("connect").on("connect", () => {
  /*console.log("🔌 socket connected", {
    serverUrl: SERVER_URL,
    socketId: socket.id,
  });*/
});

socket.off("disconnect").on("disconnect", (reason) => {
  /*console.warn("🔌 socket disconnected", {
    serverUrl: SERVER_URL,
    reason,
  });*/
});

socket.off("serverHello").on("serverHello", (payload) => {
  /*console.log("🧭 serverHello", {
    serverUrl: SERVER_URL,
    ...payload,
  });*/
});

// -----------------------------------------------------------------------------
// utility for cutting player_2_sprite into 10 frames (columns)
// called early in both LobbyScene and GameScene so UI can display when owned.
function ensurePlayer2Frames(scene) {
  try {
    if (!scene || !scene.textures) {
      //console.log("[ensurePlayer2Frames] no scene/textures");
      return;
    }
    // must have the base sprite loaded first
    if (!scene.textures.exists("player_2_sprite")) {
      // console.log("[ensurePlayer2Frames] base sprite not yet available");
      return;
    }
    const tex = scene.textures.get("player_2_sprite");
    const img = tex.getSourceImage();
    if (!img || !img.width || !img.height) {
      // console.log("[ensurePlayer2Frames] invalid image");
      return;
    }

    const cols = 10; // sprite is known to be a 10×10 grid
    const w = img.width;
    const h = img.height;
    const frameW = Math.floor(w / cols) || w;
    const rows = 10; // fixed
    const frameH = Math.floor(h / rows) || h;

    let idx = 1;
    let created = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        // extract into temporary canvas to examine pixels
        const temp = document.createElement("canvas");
        temp.width = frameW;
        temp.height = frameH;
        const tctx = temp.getContext("2d");
        tctx.drawImage(img, -c * frameW, -r * frameH);
        const data = tctx.getImageData(0, 0, frameW, frameH).data;
        let nonEmpty = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) {
            nonEmpty = true;
            break;
          }
        }
        if (!nonEmpty) {
          // skip blank cell
          continue;
        }
        const key = `player_2_${idx}`;
        idx += 1;
        if (scene.textures.exists(key)) continue;
        const canvas = scene.textures.createCanvas(key, frameW, frameH);
        const ctx = canvas.getContext();
        ctx.drawImage(img, -c * frameW, -r * frameH);
        canvas.refresh();
        created++;
      }
    }
    // console.log("[ensurePlayer2Frames] created", created, "frames");
  } catch (e) {
    // console.error("[ensurePlayer2Frames] error", e);
  }
}

function ensureMainbgFrames(scene) {
  try {
    if (!scene || !scene.textures) return;

    const splitKeys = ["mainbg_q1", "mainbg_q2", "mainbg_q3", "mainbg_q4"];
    const hasSplit = splitKeys.every((key) => scene.textures.exists(key));

    const buildFramesFromSheet = ({ sheetKey, framePrefix, skipEmpty }) => {
      if (scene.textures.exists(`${framePrefix}1`)) return;
      const tex = scene.textures.get(sheetKey);
      const img = tex.getSourceImage();
      if (!img || !img.width || !img.height) return;

      const w = img.width;
      const h = img.height;
      const cols = 10;
      const rows = 5;
      if (w % cols !== 0 || h % rows !== 0) return;
      const frameW = Math.floor(w / cols) || w;
      const frameH = Math.floor(h / rows) || h;

      let tctx = null;
      if (skipEmpty) {
        const temp = document.createElement("canvas");
        temp.width = frameW;
        temp.height = frameH;
        tctx = temp.getContext("2d", { willReadFrequently: true });
      }

      let idx = 1;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const key = `${framePrefix}${idx}`;
          idx += 1;
          if (scene.textures.exists(key)) continue;

          if (tctx) {
            tctx.clearRect(0, 0, frameW, frameH);
            tctx.drawImage(img, -c * frameW, -r * frameH);
            const data = tctx.getImageData(0, 0, frameW, frameH).data;
            let nonEmpty = false;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] !== 0) {
                nonEmpty = true;
                break;
              }
            }
            if (!nonEmpty) continue;
          }

          const canvas = scene.textures.createCanvas(key, frameW, frameH);
          const ctx = canvas.getContext();
          ctx.drawImage(img, -c * frameW, -r * frameH);
          canvas.refresh();
        }
      }
    };

    if (hasSplit) {
      buildFramesFromSheet({
        sheetKey: "mainbg_q1",
        framePrefix: "mainbg_q1_",
        skipEmpty: false,
      });
      buildFramesFromSheet({
        sheetKey: "mainbg_q2",
        framePrefix: "mainbg_q2_",
        skipEmpty: false,
      });
      buildFramesFromSheet({
        sheetKey: "mainbg_q3",
        framePrefix: "mainbg_q3_",
        skipEmpty: false,
      });
      buildFramesFromSheet({
        sheetKey: "mainbg_q4",
        framePrefix: "mainbg_q4_",
        skipEmpty: false,
      });
      return;
    }

    if (!scene.textures.exists("mainbg")) return;
    buildFramesFromSheet({
      sheetKey: "mainbg",
      framePrefix: "mainbg_",
      skipEmpty: true,
    });
  } catch (e) {
    // console.error("[ensureMainbgFrames] error", e);
  }
}

// --- 전역 설정 변수 추가 ---
const GAME_FONTS = {
  main: "Jua", // HTML에서 로드한 폰트 이름
  sub: "monospace",
};

const COLORS = {
  bg: 0x0f172a,
  primary: 0x38bdf8,
  success: 0x22c55e,
  danger: 0xef4444,
  warning: 0xf59e0b,
  text: 0xf1f5f9,
};
const XP_PER_LEVEL = 100;

let bgmEnabled = localStorage.getItem("bgmEnabled") !== "false";

class LobbyScene extends Phaser.Scene {
  constructor() {
    super("LobbyScene");
  }

  init(data = {}) {
    // 1. 필요한 상태를 미리 체크 (비동기)
    this.isOnline = false;
    this.isLeavingRoom = false;
    this.pendingRoomData = data && data.fromGame ? data : null;
    this.skipLobbyLoading = Boolean(
      data && (data.fromGame || data.fromTutorial || data.skipLobbyLoading),
    );
    this.suppressJoinToast = !!this.pendingRoomData;
    this.suppressJoinToastUntil = this.pendingRoomData
      ? Date.now() + 5000
      : null;
    this.currentRoomNumber = null;
  }

  async checkConnection() {
    const status = await Network.getStatus();
    this.isOnline = status.connected;
  }

  preload() {
    this.checkConnection();

    const { width, height } = this.cameras.main;

    let loadingContainer = null;
    let loadingText = null;
    let onLoadProgress = null;

    if (!this.skipLobbyLoading) {
      // 1. 기존 loadingText 삭제 후 이 코드를 넣으세요
      loadingContainer = this.add.container(width / 2, height / 2);
      const spinner = this.add.graphics();
      spinner.lineStyle(4, 0xffffff, 0.3);
      spinner.strokeCircle(0, 0, 40);
      spinner.lineStyle(4, 0xffffff, 1);
      spinner.beginPath();
      spinner.arc(0, 0, 40, 0, Phaser.Math.DegToRad(90));
      spinner.strokePath();

      this.tweens.add({
        targets: spinner,
        angle: 360,
        duration: 800,
        repeat: -1,
      });

      loadingText = this.add
        .text(0, 60, "데이터를 불러오는 중...", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          fill: "#ffffff",
        })
        .setOrigin(0.5);

      loadingContainer.add([spinner, loadingText]);

      // 진행률 표시 (선택사항 - % 숫자가 올라감)
      onLoadProgress = (value) => {
        if (!loadingText || !loadingText.active) return;
        loadingText.setText(`로딩 중... ${Math.floor(value * 100)}%`);
      };
      this.load.on("progress", onLoadProgress);
    }

    // 로드 완료 시 컨테이너 제거
    this.load.once("complete", () => {
      if (onLoadProgress) {
        this.load.off("progress", onLoadProgress);
      }
      if (loadingContainer && loadingContainer.active) {
        loadingContainer.destroy();
      }
    });

    // 1. CORS 설정 (이미지뿐만 아니라 오디오 로드 시에도 영향을 줄 수 있음)
    this.load.crossOrigin = "anonymous";

    // 2. 에셋 서버의 기본 주소를 변수로 설정
    //const ASSET_SERVER = "https://cushi-assets.onrender.com";
    // 1. 네트워크 연결 상태 확인 (true면 온라인, false면 오프라인)

    // 2. 서버 주소 설정 (오프라인일 경우 로컬 경로 'assets' 사용)

    const ASSET_SERVER = "https://halemale.onrender.com/assets";
    const VERSION = "?v=2";

    const PLAYER1_SPRITE_VERSION = VERSION
      ? `${VERSION}&p1=20260221_8`
      : "?p1=20260221_8";
    const PLAYER2_SPRITE_VERSION = VERSION
      ? `${VERSION}&p2=20260227_1`
      : "?p2=20260227_1";

    this.load.image(
      "popupclose",
      `${ASSET_SERVER}/images/popupclose.png${VERSION}`,
    );

    for (let i = 1; i <= 47; i += 1) {
      this.load.image(
        `mainbg_frame_${i}`,
        `assets/images/bg_sprite/${i}.png${VERSION}`,
      );
    }

    this.load.image("gamebg", `${ASSET_SERVER}/images/gamebg.png${VERSION}`);
    this.load.image(
      "invitebg",
      `${ASSET_SERVER}/images/invitebg.png${VERSION}`,
    );
    this.load.image("coin", `${ASSET_SERVER}/images/coin.png${VERSION}`);
    this.load.image("exp", `${ASSET_SERVER}/images/exp.png${VERSION}`);
    this.load.image(
      "statusbg",
      `${ASSET_SERVER}/images/statusbg.png${VERSION}`,
    );

    this.load.image("roombg", `${ASSET_SERVER}/images/roombg.png${VERSION}`);
    this.load.image("chatbg", `${ASSET_SERVER}/images/chatbg.png${VERSION}`);
    this.load.image(
      "playerbg",
      `${ASSET_SERVER}/images/playerbg.png${VERSION}`,
    );

    this.load.image("multbg", `${ASSET_SERVER}/images/multbg.png${VERSION}`);

    this.load.image(
      "ton_img",
      `${ASSET_SERVER}/images/cards/special/ton.png${VERSION}`,
    );

    this.load.image(
      "thun_img",
      `${ASSET_SERVER}/images/cards/special/thun.png${VERSION}`,
    );

    this.load.image(
      "bomb_img",
      `${ASSET_SERVER}/images/cards/special/bomb.png${VERSION}`,
    );

    this.load.image(
      "coincard",
      `${ASSET_SERVER}/images/cards/special/ongame_coin.png${VERSION}`,
    );
    this.load.image(
      "thun",
      `${ASSET_SERVER}/images/cards/special/ongame_thun.png${VERSION}`,
    );
    this.load.image(
      "bomb",
      `${ASSET_SERVER}/images/cards/special/ongame_bomb.png${VERSION}`,
    );
    this.load.image(
      "ton",
      `${ASSET_SERVER}/images/cards/special/ongame_ton.png${VERSION}`,
    );

    this.load.image(
      "pen",
      `${ASSET_SERVER}/images/cards/special/ongame_pen.png${VERSION}`,
    );

    this.load.image(
      "plus1",
      `${ASSET_SERVER}/images/cards/special/ongame_plus1.png${VERSION}`,
    );

    this.load.image(
      "plus2",
      `${ASSET_SERVER}/images/cards/special/ongame_plus2.png${VERSION}`,
    );

    this.load.image(
      "not5",
      `${ASSET_SERVER}/images/cards/special/ongame_not5.png${VERSION}`,
    );

    this.load.image(
      "lock",
      `${ASSET_SERVER}/images/cards/special/lock.png${VERSION}`,
    );

    this.load.image(
      "shield",
      `${ASSET_SERVER}/images/cards/special/shield.png${VERSION}`,
    );

    this.load.image(
      "block",
      `${ASSET_SERVER}/images/cards/special/block.png${VERSION}`,
    );

    this.load.image(
      "blockcard",
      `${ASSET_SERVER}/images/cards/special/blockcard.png${VERSION}`,
    );

    this.load.image(
      "thief",
      `${ASSET_SERVER}/images/cards/special/thief.png${VERSION}`,
    );

    this.load.image(
      "king",
      `${ASSET_SERVER}/images/cards/special/king.png${VERSION}`,
    );

    this.load.image("itembg", `${ASSET_SERVER}/images/itembg.png${VERSION}`);
    this.load.image("uibtn", `${ASSET_SERVER}/images/ui_btn.png${VERSION}`);
    this.load.image("ui_btn", `${ASSET_SERVER}/images/ui_btn.png${VERSION}`);
    this.load.image("btnbg", `${ASSET_SERVER}/images/btnbg.png${VERSION}`);
    this.load.image(
      "profilebg",
      `${ASSET_SERVER}/images/profilebg.png${VERSION}`,
    );

    this.load.image("slide", `${ASSET_SERVER}/images/slide.png${VERSION}`);
    this.load.image("storebg", `${ASSET_SERVER}/images/storebg.png${VERSION}`);

    for (let i = 1; i <= 91; i += 1) {
      this.load.image(
        `player_1_frame_${i}`,
        `assets/images/player_1_sprite/${i}.png${PLAYER1_SPRITE_VERSION}`,
      );
    }

    for (let i = 1; i <= 91; i += 1) {
      this.load.image(
        `player_2_frame_${i}`,
        `assets/images/player_2_sprite/${i}.png${PLAYER2_SPRITE_VERSION}`,
      );
    }

    // 플레이어 애니메이션용 이미지
    this.load.image(`${ASSET_SERVER}/images/player_3_1.png${VERSION}`);
    this.load.image(
      "player_3_2",
      `${ASSET_SERVER}/images/player_3_2.png${VERSION}`,
    );
    this.load.image(
      "player_4_1",
      `${ASSET_SERVER}/images/player_4_1.png${VERSION}`,
    );
    this.load.image(
      "player_4_2",
      `${ASSET_SERVER}/images/player_4_2.png${VERSION}`,
    );
    this.load.image(
      "resultbg",
      `${ASSET_SERVER}/images/resultbg.png${VERSION}`,
    );
    this.load.image("soundon", `${ASSET_SERVER}/images/soundon.png${VERSION}`);
    this.load.image(
      "soundoff",
      `${ASSET_SERVER}/images/soundoff.png${VERSION}`,
    );
    //this.load.image("popupbg", `${ASSET_SERVER}/images/popupbg.png${VERSION}`);
    this.load.image("home", `${ASSET_SERVER}/images/home.png${VERSION}`);

    // ============================================
    // 1. 할리갈리 카드 에셋 로드 (반복문)
    // ============================================
    const fruits = ["strawberry", "banana", "lime", "plum"];
    fruits.forEach((fruit) => {
      for (let count = 1; count <= 5; count++) {
        // 키 형식: strawberry_1, banana_5 등
        this.load.image(
          `${fruit}_${count}`,
          `${ASSET_SERVER}/images/cards/${fruit}_${count}.png${VERSION}`,
        );
      }
    });

    // 카드 뒷면 로드
    this.load.image(
      "card_back",
      `${ASSET_SERVER}/images/cards/card_back.png${VERSION}`,
    );

    // ============================================
    // 2. 할리갈리 UI 에셋 로드
    // ============================================
    this.load.image("bell", `${ASSET_SERVER}/images/bell.png${VERSION}`);

    this.load.audio("bgm", `${ASSET_SERVER}/sounds/bg.mp3${VERSION}`);
    this.load.audio("pop", `${ASSET_SERVER}/sounds/pop.wav${VERSION}`);
    this.load.audio("bell", `${ASSET_SERVER}/sounds/bell.mp3${VERSION}`);
    this.load.audio("effect", `${ASSET_SERVER}/sounds/effect.mp3${VERSION}`);

    this.load.audio("btn", `${ASSET_SERVER}/sounds/btn.wav${VERSION}`);
    this.load.audio("readygo", `${ASSET_SERVER}/sounds/readygo.mp3${VERSION}`);
    this.load.audio("pass", `${ASSET_SERVER}/sounds/pass.wav${VERSION}`);
    this.load.audio(
      "cardflip",
      `${ASSET_SERVER}/sounds/cardflip.wav${VERSION}`,
    );

    this.load.audio(
      "gameover",
      `${ASSET_SERVER}/sounds/gameover.mp3${VERSION}`,
    );
  }

  async create() {
    this.isJoinPopupOpen = false;
    this.isToastOpen = false;
    this.isRoomOpen = false;
    this.lastBackPressedAt = 0;
    this.backPressExitWindowMs = 2000;
    this.isSingle = false; // 로비는 항상 멀티플레이
    this.coinShopElements = []; // 코인 팝업 요소들
    this.tutorialOverlayContainer = null;
    this.currentTutorialCloseHandler = null;
    this.tutorialOverlayScheduled = false;
    this.hasCompletedTutorial =
      localStorage.getItem(TUTORIAL_STATE_KEY) === "true";

    // 사운드 인스턴스를 미리 만들어두어 중복 재생 문제 해결
    // 단순 볼륨 설정은 여기서 하면 됨
    this.successSound = null;

    this.lobbyChatMessages = this.lobbyChatMessages || [];
    this.lobbyChatTexts = [];
    this.lobbyChatLayout = null;
    this.lobbyChatInputElement = null;
    this.lobbyChatLastSent = null;

    // 특수카드 사용(턴당 1회) 추적 초기화
    this.specialUsedThisTurn = {}; // { playerId: true }

    // Reset game-over sound guard per game session
    this.resultGameoverPlayed = false;
    // ensure player2 frames exist for lobby avatars
    ensurePlayer2Frames(this);

    this.currentJoinPopupCloseHandler = null;
    this.currentShopPopupCloseHandler = null;

    const savedNickname = localStorage.getItem("nickname");

    // helper that gathers and emits the inventory payload directly
    const emitInventory = (reason = "initial", options = {}) => {
      try {
        const requireServerProfile =
          typeof options.requireServerProfile === "boolean"
            ? options.requireServerProfile
            : true;

        if (requireServerProfile && !this.hasServerProfileSnapshot) {
          console.log(
            `[inventory-sync] skipped ${reason}: awaiting server profile`,
          );
          return;
        }

        const storedNick = localStorage.getItem("nickname") || "요리사";
        const resolvedPlayerId =
          (this.myProfile && this.myProfile.nickname) ||
          this.myNickname ||
          storedNick;
        const specialCardsOwned = JSON.parse(
          localStorage.getItem("specialCards") || "{}",
        );
        const items = Object.entries(specialCardsOwned)
          .map(([id, count]) => ({ id: Number(id), count: Number(count) || 0 }))
          .filter((item) => Number.isFinite(item.id) && item.count > 0);
        const payload = {
          reason,
          id: resolvedPlayerId,
          userId: resolvedPlayerId,
          player_id: resolvedPlayerId,
          nickname: (this.myProfile && this.myProfile.nickname) || storedNick,
          playerId: socket.id,
          items,
          specialCards: specialCardsOwned,
        };

        if (this.hasServerProfileSnapshot) {
          const safeCoins = Number(this.myProfile && this.myProfile.coins);
          if (Number.isFinite(safeCoins)) {
            payload.coins = safeCoins;
          }

          const ownedCharacters = Array.isArray(
            this.myProfile && this.myProfile.owned_characters,
          )
            ? this.myProfile.owned_characters.filter(
                (key) => typeof key === "string" && /^player_[1-4]$/.test(key),
              )
            : [];
          if (ownedCharacters.length > 0) {
            payload.ownedCharacters = ownedCharacters;
            payload.owned_characters = ownedCharacters;
          }

          const currentCharacter = this.getSelectedAvatarKey();
          if (
            typeof currentCharacter === "string" &&
            /^player_[1-4]$/.test(currentCharacter)
          ) {
            payload.currentCharacter = currentCharacter;
            payload.current_character = currentCharacter;
          }
        }

        socket.emit("syncPlayerInventory", payload);
        socket.emit("syncInventory", payload);
        socket.emit("updatePlayerInventory", payload);
        socket.emit("updateProfile", payload);
        socket.emit("savePlayerProfile", payload);
        console.log(`🛰️ inventory synced (${reason})`, payload.specialCards);
      } catch (e) {
        console.warn("inventory emit failed", e);
      }
    };

    if (!savedNickname) {
      // 2. 저장된 닉네임이 없으면 팝업 표시
      this.showNicknamePopup((nickname) => {
        localStorage.setItem("nickname", nickname); // 로컬에 영구 저장

        // 서버로 전송
        socket.emit("setNickname", {
          nickname,
          avatarKey: this.getSelectedAvatarKey(),
        });
        this.myNickname = nickname; // 현재 씬 변수에 저장
        this.updateMyProfileUI({ nickname: this.myNickname });
        // inventory sync
        emitInventory();
        this.scheduleTutorialOverlay();
      });
    } else {
      // 3. 이미 닉네임이 있다면 팝업 없이 바로 서버로 전송
      this.myNickname = savedNickname;
      socket.emit("setNickname", {
        nickname: savedNickname,
        avatarKey: this.getSelectedAvatarKey(),
      });
      emitInventory();
      // (선택 사항) 로딩 중이라면 바로 메인 화면으로 진입하는 로직 실행
      console.log(`반가워요, ${savedNickname} 요리사님!`);
      this.scheduleTutorialOverlay();
    }

    this.profileAvatarKeys = ["player_1", "player_2", "player_3", "player_4"];
    const savedAvatarKey = localStorage.getItem("profileAvatarKey");
    const savedAvatarIndex = this.profileAvatarKeys.indexOf(savedAvatarKey);
    this.profileAvatarIndex = savedAvatarIndex >= 0 ? savedAvatarIndex : 0;
    const initialAvatarKey =
      typeof savedAvatarKey === "string" &&
      /^player_[1-4]$/.test(savedAvatarKey)
        ? savedAvatarKey
        : this.profileAvatarKeys[this.profileAvatarIndex] || "player_1";

    this.myProfile = {
      nickname: this.myNickname || savedNickname || "요리사",
      level: 1,
      coins: 0,
      experience: 0,
      owned_characters: ["player_1"],
      current_character: initialAvatarKey || "player_1",
      avatarKey: initialAvatarKey || "player_1",
    };
    this.hasServerProfileSnapshot = false;
    this.hasReceivedProfileStats = false;
    this.dailyRewardAvailable = false;
    this.dailyRewardAmount = 0;
    this.dailyRewardTodayDate = null;
    this.dailyRewardLastCheckinDate = null;
    this.isDailyRewardClaimPending = false;
    this.dailyRewardBtn = null;
    this.dailyRewardBtnBg = null;
    this.dailyRewardBtnText = null;
    this.isWeeklyRewardPopupOpen = false;
    this.disableDailyRewardBtnUntil = 0;
    this.dailyRewardBadge = null;
    this.dailyRewardBadgeText = null;
    this.dailyRewardCountdownText = null;
    this.dailyRewardCountdownTimer = null;
    this.dailyRewardPulseTween = null;
    this.dailyRewardBtnTint = 0x22c55e;
    this.dailyRewardBtnDisabledTint = 0x64748b;
    this.getKstNow = () =>
      new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    this.formatDateYmd = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    this.getDailyRewardCountdownText = () => {
      const kstNow = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
      );
      const nextReset = new Date(kstNow);
      nextReset.setHours(24, 0, 0, 0);
      let diffMs = nextReset.getTime() - kstNow.getTime();
      if (diffMs < 0) diffMs = 0;

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    };
    this.updateDailyRewardCountdownText = () => {
      if (
        !this.dailyRewardCountdownText ||
        !this.dailyRewardCountdownText.scene ||
        !this.dailyRewardCountdownText.canvas ||
        !this.dailyRewardCountdownText.context
      ) {
        return;
      }

      if (this.dailyRewardAvailable) {
        this.dailyRewardCountdownText.setVisible(false);
        return;
      }

      const countdown = this.getDailyRewardCountdownText();
      this.dailyRewardCountdownText.setText(`다음 보상까지 ${countdown}`);
      this.dailyRewardCountdownText.setVisible(true);
    };
    this.updateDailyRewardButtonState = () => {
      if (
        !this.dailyRewardBtn ||
        !this.dailyRewardBtnBg ||
        !this.dailyRewardBtnText ||
        !this.dailyRewardBtnText.scene ||
        !this.dailyRewardBtnText.canvas ||
        !this.dailyRewardBtnText.context
      ) {
        return;
      }

      const amountText =
        this.dailyRewardAmount > 0 ? ` +${this.dailyRewardAmount}` : "";
      this.dailyRewardBtnText.setText(`출석 보상${amountText}`);

      this.dailyRewardBtn.setVisible(true);
      this.updateDailyRewardCountdownText();

      if (this.isWeeklyRewardPopupOpen) {
        this.dailyRewardBtnBg.disableInteractive();
      }

      const shouldPulse =
        this.dailyRewardAvailable && !this.isDailyRewardClaimPending;
      if (this.dailyRewardBadge) {
        this.dailyRewardBadge.setVisible(this.dailyRewardAvailable);
      }
      if (this.dailyRewardBadgeText) {
        this.dailyRewardBadgeText.setVisible(this.dailyRewardAvailable);
      }

      if (!this.dailyRewardAvailable) {
        this.isDailyRewardClaimPending = false;
        this.dailyRewardBtn.setAlpha(0.9);
        this.dailyRewardBtnBg.setTint(this.dailyRewardBtnDisabledTint);
        this.dailyRewardBtnBg.setInteractive({ useHandCursor: true });
      } else {
        this.dailyRewardBtnBg.setTint(this.dailyRewardBtnTint);
      }

      if (this.isDailyRewardClaimPending) {
        this.dailyRewardBtn.setAlpha(0.7);
        if (this.dailyRewardBtnBg.input) {
          this.dailyRewardBtnBg.disableInteractive();
        }
      }

      if (shouldPulse) {
        if (!this.dailyRewardPulseTween) {
          this.dailyRewardPulseTween = this.tweens.add({
            targets: [this.dailyRewardBtnBg],
            scaleX: "*=1.05",
            scaleY: "*=1.05",
            yoyo: true,
            duration: 500,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      } else if (this.dailyRewardPulseTween) {
        this.dailyRewardPulseTween.stop();
        this.dailyRewardPulseTween = null;
        this.dailyRewardBtnBg.setScale(1);
      }

      if (this.dailyRewardAvailable && !this.isDailyRewardClaimPending) {
        this.dailyRewardBtn.setAlpha(1);
        if (!this.isWeeklyRewardPopupOpen) {
          this.dailyRewardBtnBg.setInteractive({ useHandCursor: true });
        }
      }
    };
    // ensureAvatarAnimation() cost is paid once during startup rather
    // than during the win animation. This also forces player2 frames
    // to be generated early.
    this.profileAvatarKeys.forEach((k) => {
      try {
        ensurePlayer2Frames(this);
        this.ensureAvatarAnimation(k);
      } catch (e) {
        console.warn("avatar preload failed for", k, e);
      }
    });

    bgmEnabled = localStorage.getItem("bgmEnabled") !== "false";

    handleGetUserKey();

    // 1. 먼저 컨테이너를 준비합니다.
    if (!this.mainUIContainer || !this.mainUIContainer.scene) {
      this.mainUIContainer = this.add.container(0, 0);
    }

    const { width, height } = this.cameras.main;
    const centerX = width / 2;

    // BGM: 브라우저 정책상 유저 제스처 이후에만 재생 가능하므로
    // 사운드가 준비되었고 BGM 사용 설정이 켜져 있으면
    // 최초 유저 인터랙션 시점에 한 번 재생을 시도합니다.
    if (!this.sound.get("bgm") && bgmEnabled) {
      const tryPlayBgm = () => {
        try {
          this.sound.play("bgm", { loop: true, volume: 0.2 });
        } catch (e) {
          // 실패 시 무시
        }
      };

      const audioCtx = this.sound && this.sound.context;
      if (audioCtx && audioCtx.state === "suspended") {
        const resumeAndPlay = () => {
          if (audioCtx && typeof audioCtx.resume === "function") {
            audioCtx.resume().catch(() => {});
          }
          tryPlayBgm();
        };
        this.input.once("pointerdown", resumeAndPlay);
      } else {
        tryPlayBgm();
      }
    }

    const totalBgW = width;
    const totalBgH = height * 1.1;
    const mybgAnimKey = this.ensureMybgAnimation();

    if (Array.isArray(mybgAnimKey) && mybgAnimKey.length === 4) {
      const bgContainer = this.add
        .container(centerX, height / 2)
        .setDepth(0)
        .setAlpha(1);
      const halfW = totalBgW / 2;
      const halfH = totalBgH / 2;
      const quadPositions = [
        { x: -halfW / 2, y: -halfH / 2, key: "mainbg_q1_1" },
        { x: halfW / 2, y: -halfH / 2, key: "mainbg_q2_1" },
        { x: -halfW / 2, y: halfH / 2, key: "mainbg_q3_1" },
        { x: halfW / 2, y: halfH / 2, key: "mainbg_q4_1" },
      ];

      const quadSprites = quadPositions.map((pos) => {
        const textureKey = this.textures.exists(pos.key)
          ? pos.key
          : pos.key.replace("_1", "");
        return this.add
          .sprite(pos.x, pos.y, textureKey)
          .setDisplaySize(halfW, halfH)
          .setOrigin(0.5);
      });

      quadSprites.forEach((sprite, idx) => {
        const animKey = mybgAnimKey[idx];
        if (animKey) {
          sprite.play(animKey, true);
        }
      });

      bgContainer.add(quadSprites);
    } else {
      const fallbackTexture = this.textures.exists("mainbg_frame_1")
        ? "mainbg_frame_1"
        : "mainbg";
      const lobbyBg = this.add
        .sprite(centerX, height / 2, fallbackTexture)
        .setDisplaySize(totalBgW, totalBgH)
        .setDepth(0)
        .setAlpha(1);

      if (mybgAnimKey) {
        if (this.textures.exists("mainbg_frame_1")) {
          lobbyBg.setTexture("mainbg_frame_1");
        } else if (this.textures.exists("mainbg_1")) {
          lobbyBg.setTexture("mainbg_1");
        }
        lobbyBg.play(mybgAnimKey, true);
        lobbyBg.setDisplaySize(totalBgW, totalBgH);
      }
    }

    socket.off("hostChanged").on("hostChanged", (data) => {
      if (this.isLeavingRoom) return;
      if (data.players) this.currentPlayers = data.players;
      this.hostId = data.hostId;

      this.refreshLobbyUI(data);

      if (data.message) {
        this.time.delayedCall(100, () => {
          this.showToast(data.message, "#f1c40f");
        });
      }
    });

    socket.off("myProfile").on("myProfile", (profilePayload) => {
      const profile = profilePayload || {};
      const normalizeSpecialCardId = (rawId) => {
        if (rawId === null || rawId === undefined) return null;

        const numericId = Number(rawId);
        if (Number.isFinite(numericId) && numericId >= 1 && numericId <= 8) {
          return numericId;
        }

        const idText = String(rawId).toLowerCase().trim();
        const idMap = {
          magnet: 1,
          bomb: 2,
          star: 3,
          lock: 4,
          shield: 5,
          block: 6,
          thief: 7,
          king: 8,
          자석: 1,
          폭탄: 2,
          별: 3,
          자물쇠: 4,
          방패: 5,
          먹물: 6,
          도둑: 7,
          왕: 8,
        };
        return idMap[idText] || null;
      };

      const collectSpecialCardsFromPayload = (
        specialCardsPayload,
        itemsPayload,
      ) => {
        const parsed = {};
        let sourceHadData = false;

        const addCount = (rawId, rawCount = 1) => {
          const normalizedId = normalizeSpecialCardId(rawId);
          const count = Number(rawCount);
          if (!normalizedId || !Number.isFinite(count) || count <= 0) return;
          parsed[normalizedId] = (parsed[normalizedId] || 0) + count;
        };

        if (
          specialCardsPayload &&
          typeof specialCardsPayload === "object" &&
          !Array.isArray(specialCardsPayload)
        ) {
          const entries = Object.entries(specialCardsPayload);
          if (entries.length > 0) {
            sourceHadData = true;
            entries.forEach(([key, value]) => {
              if (value && typeof value === "object") {
                addCount(
                  value.id ?? value.cardId ?? key,
                  value.count ?? value.qty ?? 1,
                );
              } else {
                addCount(key, value);
              }
            });
          }
        }

        if (Array.isArray(itemsPayload)) {
          if (itemsPayload.length > 0) {
            sourceHadData = true;
          }

          itemsPayload.forEach((item) => {
            if (item && typeof item === "object") {
              addCount(
                item.id ?? item.cardId ?? item.itemId ?? item.key ?? item.name,
                item.count ?? item.qty ?? item.quantity ?? 1,
              );
              return;
            }

            addCount(item, 1);
          });
        } else if (itemsPayload && typeof itemsPayload === "object") {
          const entries = Object.entries(itemsPayload);
          if (entries.length > 0) {
            sourceHadData = true;
            entries.forEach(([key, value]) => addCount(key, value));
          }
        }

        return {
          parsed,
          sourceHadData,
          parsedCount: Object.keys(parsed).length,
        };
      };

      const normalizeOwnedCharacters = (rawValue) => {
        const normalized = {};

        if (Array.isArray(rawValue)) {
          rawValue.forEach((key) => {
            if (typeof key === "string" && /^player_[1-4]$/.test(key)) {
              normalized[key] = true;
            }
          });
        } else if (rawValue && typeof rawValue === "object") {
          Object.entries(rawValue).forEach(([key, value]) => {
            if (typeof key === "string" && /^player_[1-4]$/.test(key)) {
              normalized[key] = !!value;
            }
          });
        }

        normalized.player_1 = true;
        return normalized;
      };

      let mergedOwnedCharacters = normalizeOwnedCharacters({});

      if (profile && Array.isArray(profile.owned_characters)) {
        const ownedCharactersFromServer = {};
        profile.owned_characters.forEach((key) => {
          if (typeof key === "string" && /^player_[1-4]$/.test(key)) {
            ownedCharactersFromServer[key] = true;
          }
        });
        mergedOwnedCharacters = normalizeOwnedCharacters({
          ...mergedOwnedCharacters,
          ...ownedCharactersFromServer,
        });
        // 케릭터 소유권은 서버 전용으로 관리, 로컬스토리지 저장하지 않음
      }

      profile.owned_characters = Object.keys(mergedOwnedCharacters).filter(
        (key) => mergedOwnedCharacters[key],
      );

      // after merging inventory update, ensure frames exist for player 2
      ensurePlayer2Frames(this);
      // reapply animation in case the current avatar changed to a newly owned one
      this.updateProfileAvatarUI();

      if (
        profile &&
        typeof profile.current_character === "string" &&
        /^player_[1-4]$/.test(profile.current_character)
      ) {
        const canApplyServerCharacter =
          profile.current_character === "player_1" ||
          !!mergedOwnedCharacters[profile.current_character];

        if (canApplyServerCharacter) {
          const idx = this.profileAvatarKeys.indexOf(profile.current_character);
          if (idx >= 0) {
            this.profileAvatarIndex = idx;
            this.updateProfileAvatarUI(profile.current_character);
          }
        }
      }

      if (
        profile &&
        typeof profile.avatarKey === "string" &&
        /^player_[1-4]$/.test(profile.avatarKey)
      ) {
        const canApplyAvatarKey =
          profile.avatarKey === "player_1" ||
          !!mergedOwnedCharacters[profile.avatarKey];

        if (canApplyAvatarKey) {
          const idx = this.profileAvatarKeys.indexOf(profile.avatarKey);
          if (idx >= 0) {
            this.profileAvatarIndex = idx;
            this.updateProfileAvatarUI(profile.avatarKey);
          }
        }
      }

      // 특수카드 저장
      if (
        profile &&
        (typeof profile.specialCards === "object" ||
          typeof profile.items !== "undefined")
      ) {
        const { parsed, sourceHadData, parsedCount } =
          collectSpecialCardsFromPayload(profile.specialCards, profile.items);

        if (sourceHadData && parsedCount === 0) {
          console.warn("특수카드 데이터 파싱 실패: 서버 데이터를 무시합니다.");
        }
        // 특수카드는 서버 전용으로 관리, 로컬스토리지 저장하지 않음
      }

      this.updateMyProfileUI(profile);
      this.hasServerProfileSnapshot = true;

      try {
        emitInventory("postProfileSync");
      } catch (e) {
        console.warn("postProfileSync emit failed", e);
      }

      // 상점이 열려있다면 새로고침하여 최신 소유 정보 반영
      if (this.isShopOpen && typeof renderShopContent === "function") {
        renderShopContent();
      }
    });

    socket.off("dailyRewardAvailable").on("dailyRewardAvailable", (payload) => {
      this.dailyRewardAvailable = Boolean(payload && payload.available);
      this.dailyRewardAmount = Number(payload && payload.amount) || 0;
      this.dailyRewardTodayDate = payload && payload.date ? payload.date : null;
      this.dailyRewardLastCheckinDate =
        payload && payload.lastCheckinDate ? payload.lastCheckinDate : null;
      this.isDailyRewardClaimPending = false;

      if (typeof this.updateDailyRewardButtonState === "function") {
        this.updateDailyRewardButtonState();
      }
    });

    socket.off("dailyRewardError").on("dailyRewardError", (message) => {
      this.isDailyRewardClaimPending = false;
      if (typeof this.updateDailyRewardButtonState === "function") {
        this.updateDailyRewardButtonState();
      }
      this.showToast(
        message || "출석 보상 처리 중 오류가 발생했습니다.",
        "#e74c3c",
      );
    });

    socket.off("dailyReward").on("dailyReward", (payload) => {
      const amount = Number(payload && payload.amount) || 0;
      if (amount <= 0) return;

      if (this.myProfile) {
        this.myProfile.coins =
          Number(payload.totalCoins) || Number(this.myProfile.coins) || 0;
        this.updateMyProfileUI();
      }

      if (this.shopCoinText && this.myProfile) {
        this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
      }
      if (this.coinShopCurrentCoinText && this.myProfile) {
        this.coinShopCurrentCoinText.setText(
          `현재 보유: 💰 ${this.myProfile.coins}`,
        );
      }

      this.showToast(`오늘의 출석 보상 +${amount} 코인!`, "#22c55e");

      this.dailyRewardAvailable = false;
      this.dailyRewardLastCheckinDate =
        payload && payload.date
          ? payload.date
          : this.dailyRewardLastCheckinDate;
      this.isDailyRewardClaimPending = false;
      if (typeof this.updateDailyRewardButtonState === "function") {
        this.updateDailyRewardButtonState();
      }
    });

    // 💡 케릭터 구매 이벤트 핸들러 추가
    socket.off("buyCharacterError").on("buyCharacterError", (message) => {
      this.showToast(message || "케릭터 구매에 실패했습니다.", "#e74c3c");
    });

    // 💡 케릭터 착용 에러 이벤트 핸들러 추가
    socket.off("equipCharacterError").on("equipCharacterError", (message) => {
      this.showToast(message || "착용에 실패했습니다.", "#e74c3c");
    });

    socket.off("characterPurchased").on("characterPurchased", (data) => {
      console.log("🎭 케릭터 구매 성공:", data);

      // 서버 응답 기반으로 UI만 업데이트 (로컬스토리지 저장 없음)
      if (data && typeof data.newCoins === "number") {
        this.myProfile.coins = data.newCoins;

        // 상점이 열려있다면 코인 표시 업데이트
        if (this.shopCoinText) {
          this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
        }

        this.updateMyProfileUI();
      }

      // 케릭터 착용만 처리 (소유권은 myProfile 이벤트에서 처리)
      if (data.characterKey) {
        if (!this.myProfile) {
          this.myProfile = {};
        }
        if (!Array.isArray(this.myProfile.owned_characters)) {
          this.myProfile.owned_characters = ["player_1"];
        }
        if (!this.myProfile.owned_characters.includes(data.characterKey)) {
          this.myProfile.owned_characters.push(data.characterKey);
        }
        this.equipCharacter(data.characterKey);

        // safeSyncInventory 호출
        try {
          const sceneInstance =
            typeof game !== "undefined" &&
            game.scene &&
            game.scene.keys &&
            game.scene.keys.GameScene;
          if (
            sceneInstance &&
            typeof sceneInstance.safeSyncInventory === "function"
          ) {
            sceneInstance.safeSyncInventory("buyCharacter", {
              boughtCharacter: data.characterKey,
              bought_character: data.characterKey,
            });
          }
        } catch (e) {
          console.warn("buyCharacter sync failed", e);
        }
      }

      const now = Date.now();
      if (
        !this.lastCharacterPurchaseToastAt ||
        now - this.lastCharacterPurchaseToastAt > 1500
      ) {
        this.lastCharacterPurchaseToastAt = now;
        this.showToast("케릭터 구매가 완료되었습니다!", "#2ecc71");
      }

      // 상점 새로고침으로 즉시 UI 반영
      if (this.isShopOpen && typeof renderShopContent === "function") {
        renderShopContent();
      }
    });

    // 💡 코인 구매 완료 이벤트 핸들러 추가
    socket.off("coinPurchased").on("coinPurchased", (data) => {
      if (data && data.message) {
        this.showToast(data.message, "#2ecc71");
      }

      if (data && typeof data.newCoins === "number") {
        this.myProfile.coins = data.newCoins;
        this.updateMyProfileUI();

        // 상점 UI가 열려있다면 업데이트
        if (this.shopCoinText) {
          this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
        }
        if (this.coinShopCurrentCoinText) {
          this.coinShopCurrentCoinText.setText(
            `현재 보유: 💰 ${this.myProfile.coins}`,
          );
        }
      }
    });

    socket.off("lobbyChatMessage").on("lobbyChatMessage", (payload) => {
      if (!payload || typeof payload.message !== "string") return;
      const nickname = payload.nickname || "요리사";
      const message = payload.message.trim();
      if (!message) return;

      this.addLobbyChatMessage(`${nickname}: ${message}`);
    });

    socket.off("playerKicked").on("playerKicked", (data) => {
      if (data && data.kickedId === socket.id) {
        this.kickedPlayerId = data.kickedId;
        this.showToast("방에서 강퇴되었습니다!", "#e74c3c");
        this.time.delayedCall(1000, () => {
          this.leaveCurrentRoom();
        });
      }
    });

    socket.off("onlineUsersList").on("onlineUsersList", (data) => {
      if (!data || !data.users) return;
      this.showInvitePopup(data.users, data.roomName);
    });

    socket.off("receiveInvite").on("receiveInvite", (data) => {
      if (!data) return;
      this.showInviteReceivePopup(data);
    });

    this.backHandler = await App.addListener("backButton", () => {
      if (typeof this.currentTutorialCloseHandler === "function") {
        this.currentTutorialCloseHandler();
        this.lastBackPressedAt = 0;
        return;
      }

      if (typeof this.currentJoinPopupCloseHandler === "function") {
        this.currentJoinPopupCloseHandler();
        this.lastBackPressedAt = 0;
        return;
      }

      if (typeof this.currentShopPopupCloseHandler === "function") {
        this.currentShopPopupCloseHandler();
        this.lastBackPressedAt = 0;
        return;
      }

      if (this.isRoomOpen) {
        this.showCustomAlert("로비로 이동합니다!", () => {
          this.leaveCurrentRoom();
        });
        this.lastBackPressedAt = 0;
        return;
      }

      const now = Date.now();
      const isSecondPress =
        now - this.lastBackPressedAt <= this.backPressExitWindowMs;

      if (isSecondPress) {
        App.exitApp();
        return;
      }

      this.lastBackPressedAt = now;
      this.showToast("한번 더 누르면 앱이 종료됩니다", "#f1c40f");
    });

    /* =======================================================
   멀티 플레이 버튼 (단일 버튼, 4인 기준)
======================================================= */
    const x = centerX; // 화면 중앙
    const y = height * 0.48;
    const btnH = height * 0.07;

    const safePadding = Math.max(width * 0.06, 24);
    const actionBtnGap = Math.max(width * 0.03, 16);
    const availableWidth = width - safePadding * 2;
    const topBtnW = Math.min(width * 0.32, (availableWidth - actionBtnGap) / 2);
    const topRowWidth = topBtnW * 2 + actionBtnGap;
    let topLeftEdge = centerX - topRowWidth / 2;
    if (topLeftEdge < safePadding) {
      topLeftEdge = safePadding;
    }
    if (topLeftEdge + topRowWidth > width - safePadding) {
      topLeftEdge = width - safePadding - topRowWidth;
    }
    const topLeftX = topLeftEdge + topBtnW / 2;
    const topRightX = topLeftX + topBtnW + actionBtnGap;

    const bottomBtnGap = Math.max(width * 0.02, 12);
    const bottomBtnW = Math.min(
      width * 0.22,
      (availableWidth - bottomBtnGap * 3) / 4,
    );
    const bottomStartX = safePadding + bottomBtnW / 2;

    const actionBtnTopY = height * 0.7;
    const actionBtnBottomY = actionBtnTopY + btnH * 1.35;

    const multiBtnX = topLeftX;
    const singleBtnX = topRightX;
    const dailyRewardBtnX = bottomStartX;
    const adRewardBtnX = bottomStartX + (bottomBtnW + bottomBtnGap);
    const questBtnX = bottomStartX + (bottomBtnW + bottomBtnGap) * 2;
    const shopBtnX = bottomStartX + (bottomBtnW + bottomBtnGap) * 3;

    // two rows: (멀티, 싱글) then (출석보상, 광고보상, 퀘스트, 상점)
    const multiBtn = this.add.container(multiBtnX, actionBtnTopY);

    const profileCenterY = y;
    const profileSize = width * 0.2;
    const profileContainer = this.add.container(centerX, profileCenterY);

    // 프로필 배경 이미지는 제거
    const profileBg = null;

    // 프로필 이미지를 스프라이트로 생성하고 애니메이션 적용
    const currentKey = this.getSelectedAvatarKey();
    // 존재하는 텍스처를 우선 사용, 없으면 안전한 플레이스홀더로 폴백
    let currentAvatarTexture = this.getAvatarDisplayKey(currentKey);
    if (!currentAvatarTexture && this.textures.exists(`${currentKey}_1`)) {
      currentAvatarTexture = `${currentKey}_1`;
    } else if (!currentAvatarTexture && this.textures.exists(`${currentKey}`)) {
      currentAvatarTexture = `${currentKey}`;
    } else if (
      !currentAvatarTexture &&
      this.textures.exists("player_1_frame_1")
    ) {
      currentAvatarTexture = "player_1_frame_1";
    }
    const currentIdx = this.profileAvatarKeys.indexOf(currentKey);
    this.profileAvatarIndex = currentIdx >= 0 ? currentIdx : 0;
    // create sprite at container origin (0,0)
    this.profileImage = this.add
      .sprite(0, 0, currentAvatarTexture)
      .setDisplaySize(profileSize * 1.6, profileSize * 1.6);
    this.applyAvatarAnimation(this.profileImage, currentKey);

    const avatarLeftBtn = this.add
      .circle(-profileSize * 0.95, 0, profileSize * 0.14, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });

    const avatarLeftIcon = this.add
      .text(-profileSize * 0.95, 0, "<", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    const avatarRightBtn = this.add
      .circle(profileSize * 0.95, 0, profileSize * 0.14, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });

    const avatarRightIcon = this.add
      .text(profileSize * 0.95, 0, ">", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // single combined level+nickname text
    this.profileIdText = this.add
      .text(
        0,
        profileSize * 0.8,
        `LV.${this.myProfile.level} ${this.myProfile.nickname}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.045}px`,
          color: "#ffffff",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(10000);

    // 코인 + 경험치 표시 영역 (한 줄)
    const statY = profileSize * 1.18;
    const coinBgX = -profileSize * 0.47;
    const expBarCenterX = profileSize * 0.4;
    const expBarWidth = profileSize * 0.9;
    const expBarHeight = width * 0.032;

    this.profileStatusBg = this.add
      .image(0, statY, "statusbg")
      .setDisplaySize(profileSize * 1.9, width * 0.07)
      .setDepth(8);

    this.profileCoinText = this.add
      .text(coinBgX * 1.03, statY, `X ${this.myProfile.coins}`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.033}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(11);

    // 경험치 배경 막대 (회색, 둥근 모서리)
    const expBarGraphicsBg = this.add.graphics();
    expBarGraphicsBg.fillStyle(0x555555, 1);
    expBarGraphicsBg.fillRoundedRect(
      expBarCenterX - expBarWidth / 2,
      statY - expBarHeight / 2,
      expBarWidth,
      expBarHeight,
      15,
    );
    expBarGraphicsBg.setDepth(10);
    this.profileExpBarBg = expBarGraphicsBg;

    // 경험치 진행 막대 (초록색, 둥근 모서리)
    const currentExp = this.myProfile.experience % XP_PER_LEVEL;
    const expRatio = currentExp / XP_PER_LEVEL;
    const expBarGraphicsFill = this.add.graphics();
    expBarGraphicsFill.fillStyle(0x2ecc71, 1);
    expBarGraphicsFill.fillRoundedRect(
      expBarCenterX - expBarWidth / 2,
      statY - expBarHeight / 2,
      expBarWidth * expRatio,
      expBarHeight,
      15,
    );
    expBarGraphicsFill.setDepth(11);
    this.profileExpBarFill = expBarGraphicsFill;

    // 경험치 숫자 텍스트
    this.profileExpText = this.add
      .text(expBarCenterX, statY, `EXP  ${currentExp}/${XP_PER_LEVEL}`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.028}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(12);

    profileContainer.add([
      this.profileImage,
      avatarLeftBtn,
      avatarLeftIcon,
      avatarRightBtn,
      avatarRightIcon,
      this.profileIdText,
      this.profileStatusBg,
      this.profileCoinText,
      this.profileExpBarBg,
      this.profileExpBarFill,
      this.profileExpText,
    ]);
    // ensure image & text are centered inside container
    if (this.profileImage) {
      this.profileImage.setPosition(0, 0);
    }
    if (this.profileIdText) {
      this.profileIdText.setPosition(0, profileSize * 0.9);
    }

    avatarLeftBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: [avatarLeftBtn, avatarLeftIcon],
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.changeProfileAvatar(-1);
        },
      });
    });

    avatarRightBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: [avatarRightBtn, avatarRightIcon],
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.changeProfileAvatar(1);
        },
      });
    });

    this.updateMyProfileUI();
    this.updateProfileAvatarUI();

    const dailyRewardBtn = this.add.container(
      dailyRewardBtnX,
      actionBtnBottomY,
    );
    const dailyRewardBtnBg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(bottomBtnW * 0.9, btnH * 1.05)
      .setTint(this.dailyRewardBtnTint)
      .setInteractive({ useHandCursor: true });
    const dailyRewardBtnText = this.add
      .text(0, 0, "출석 보상", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.032}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);
    const badgeRadius = btnH * 0.18;
    const dailyRewardBadge = this.add
      .circle(bottomBtnW * 0.35, -btnH * 0.4, badgeRadius, 0xffd54f, 1)
      .setStrokeStyle(2, 0x1f2937, 0.9);
    const dailyRewardBadgeText = this.add
      .text(bottomBtnW * 0.35, -btnH * 0.4, "NEW", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.02}px`,
        color: "#1f2937",
        fontWeight: "bold",
      })
      .setOrigin(0.5);
    const dailyRewardCountdownText = this.add
      .text(0, btnH * 0.85, "", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.022}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    dailyRewardBtn.add([
      dailyRewardBtnBg,
      dailyRewardBtnText,
      dailyRewardBadge,
      dailyRewardBadgeText,
      dailyRewardCountdownText,
    ]);

    this.dailyRewardBtn = dailyRewardBtn;
    this.dailyRewardBtnBg = dailyRewardBtnBg;
    this.dailyRewardBtnText = dailyRewardBtnText;
    this.dailyRewardBadge = dailyRewardBadge;
    this.dailyRewardBadgeText = dailyRewardBadgeText;
    this.dailyRewardCountdownText = dailyRewardCountdownText;

    dailyRewardBtnBg.on("pointerdown", () => {
      if (Date.now() < this.disableDailyRewardBtnUntil) return;
      this.showWeeklyRewardPopup();
    });

    if (typeof this.updateDailyRewardButtonState === "function") {
      this.updateDailyRewardButtonState();
    }
    if (this.dailyRewardCountdownTimer) {
      this.dailyRewardCountdownTimer.remove(false);
      this.dailyRewardCountdownTimer = null;
    }
    this.dailyRewardCountdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (typeof this.updateDailyRewardCountdownText === "function") {
          this.updateDailyRewardCountdownText();
        }
      },
    });
    this.events.once("shutdown", () => {
      if (this.dailyRewardCountdownTimer) {
        this.dailyRewardCountdownTimer.remove(false);
        this.dailyRewardCountdownTimer = null;
      }
      if (this.dailyRewardPulseTween) {
        this.dailyRewardPulseTween.stop();
        this.dailyRewardPulseTween = null;
      }
      if (this.dailyRewardCountdownText) {
        this.dailyRewardCountdownText.destroy();
        this.dailyRewardCountdownText = null;
      }
    });

    const adRewardBtn = this.add.container(adRewardBtnX, actionBtnBottomY);
    const adRewardBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(bottomBtnW * 0.9, btnH * 1.05)
      .setInteractive()
      .setTint(0x38bdf8);
    const adRewardBtnText = this.add
      .text(0, 0, "광고보상", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.03}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);
    adRewardBtn.add([adRewardBtnImg, adRewardBtnText]);
    adRewardBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [adRewardBtnImg, adRewardBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.showToast("광고 보상은 준비 중입니다!", "#38bdf8");
        },
      });
    });

    const questBtn = this.add.container(questBtnX, actionBtnBottomY);
    const questBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(bottomBtnW * 0.9, btnH * 1.05)
      .setInteractive()
      .setTint(0xf59e0b);
    const questBtnText = this.add
      .text(0, 0, "퀘스트", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.032}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);
    const questBadgeRadius = btnH * 0.18;
    const questBadge = this.add
      .circle(bottomBtnW * 0.35, -btnH * 0.4, questBadgeRadius, 0xffd54f, 1)
      .setStrokeStyle(2, 0x1f2937, 0.9)
      .setVisible(false);
    const questBadgeText = this.add
      .text(bottomBtnW * 0.35, -btnH * 0.4, "NEW", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.02}px`,
        color: "#1f2937",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);
    questBtn.add([questBtnImg, questBtnText]);
    questBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [questBtnImg, questBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.showQuestPopup();
        },
      });
    });
    questBtn.add([questBadge, questBadgeText]);

    const hasQuestRewardReady = () => {
      try {
        const stored = JSON.parse(
          localStorage.getItem(MULTI_QUEST_PROGRESS_STORAGE_KEY) || "{}",
        );
        return MULTI_QUEST_CONFIGS.some((quest) => {
          const entry = stored[quest.key] || {};
          return Boolean(entry.ready);
        });
      } catch (e) {
        return false;
      }
    };

    const updateQuestBadgeState = () => {
      const shouldShow = hasQuestRewardReady();
      questBadge.setVisible(shouldShow);
      questBadgeText.setVisible(shouldShow);

      if (shouldShow) {
        if (!this.questBadgeTween) {
          this.questBadgeTween = this.tweens.add({
            targets: [questBadge, questBadgeText],
            scaleX: "*=1.12",
            scaleY: "*=1.12",
            yoyo: true,
            duration: 420,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      } else if (this.questBadgeTween) {
        this.questBadgeTween.stop();
        this.questBadgeTween = null;
        questBadge.setScale(1);
        questBadgeText.setScale(1);
      }
    };

    updateQuestBadgeState();

    const multiBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(topBtnW * 0.9, btnH * 1.2)
      .setInteractive();

    // 2. 버튼 텍스트
    const multiBtnText = this.add
      .text(0, 0, "멀티플레이", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.042}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    multiBtn.add([multiBtnImg, multiBtnText]);

    // 3. 클릭 이벤트 + 연출
    multiBtnImg.on("pointerdown", () => {
      this.checkConnection();

      // 효과음
      this.sound.play("btn", { volume: 0.1 });

      // 팅기는 연출
      this.tweens.add({
        targets: multiBtn,
        scaleX: "*=0.9",
        scaleY: "*=0.9",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          if (this.isOnline) {
            // 공개 방 화면 띄우기 (방 찾기 / 방 만들기 / 코드 입력)
            this.showPublicRoomsPopup();
          } else {
            this.showToast("인터넷 연결이 필요합니다!", "#ffffff");
          }
        },
      });
    });

    const singleBtn = this.add.container(singleBtnX, actionBtnTopY);
    const singleBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(topBtnW * 0.9, btnH * 1.2)
      .setInteractive()
      .setTint(0xffd700); // 금색 포인트

    singleBtn.add([
      singleBtnImg,
      this.add
        .text(0, 0, "싱글플레이", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.042}px`,
          color: "#ffffff",
          fontWeight: "bold",
        })
        .setOrigin(0.5),
    ]);

    singleBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [singleBtnImg, singleBtn.list[1]],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        // LobbyScene.js 의 싱글플레이 버튼 내부
        onComplete: () => {
          this.showSingleDifficultyPopup();
        },
      });
    });

    /* =======================================================
   상점 버튼 추가
======================================================= */
    const shopBtn = this.add.container(shopBtnX, actionBtnBottomY);
    const shopBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(bottomBtnW * 0.9, btnH * 1.05)
      .setInteractive()
      .setTint(0xff69b4); // 핑크 포인트

    const shopBtnText = this.add
      .text(0, 0, "🎁 상점", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.032}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    shopBtn.add([shopBtnImg, shopBtnText]);

    shopBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [shopBtnImg, shopBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.showShopPopup();
        },
      });
    });

    socket.off("roomCreated").on("roomCreated", (data) => {
      this.currentRoomNumber =
        typeof data?.roomNumber === "number" ? data.roomNumber : null;
      this.isRoomOpen = true;

      this.hideLoading(); // 🔹 로딩창 끄기
      this.showToast("방 생성 성공!", "#2ecc71"); // 초록색 토스트

      this.createBlocker(); // 함수 호출

      this.refreshLobbyUI({
        roomId: data.roomId,
        players: data.players,
        max: data.maxPlayers,
        hostId: socket.id,
        roomName: data.roomName,
        roomNumber: this.currentRoomNumber,
        itemMode: data.itemMode,
        gameMode: data.gameMode,
      });

      if (typeof this.currentRoomNumber !== "number" && data?.roomId) {
        this.resolveRoomNumberFromPublicList(data.roomId).then(
          (resolvedRoomNumber) => {
            if (
              typeof resolvedRoomNumber === "number" &&
              this.scene.isActive() &&
              this.currentRoomId === data.roomId
            ) {
              this.currentRoomNumber = resolvedRoomNumber;
              this.refreshLobbyUI({
                roomId: this.currentRoomId,
                players: this.currentPlayers,
                max: this.currentMax,
                hostId: this.hostId,
                roomName: this.currentRoomName,
                roomNumber: this.currentRoomNumber,
              });
            }
          },
        );
      }
    });

    socket.off("joinRoomError").on("joinRoomError", (message) => {
      this.hideLoading(); // 🔹 로딩창 끄기
      this.showToast(message, "#e74c3c"); // 빨간색 토스트
      if (this.lobbyBlocker) {
        this.lobbyBlocker.setVisible(false);
      }

      // 3. (옵션) 입력창 초기화
      console.log("입장 실패 원인:", message);
    });

    socket.off("playerJoined").on("playerJoined", (data) => {
      if (this.isLeavingRoom) return;
      this.createBlocker(); // 함수 호출

      this.hideLoading();

      this.cleanupPopup();

      // UI를 먼저 동기화해서 데이터 구조를 잡습니다.
      this.refreshLobbyUI(data);

      if (data && data.isRejoin) {
        return;
      }

      // 🔹 0.1초 뒤에 토스트를 띄워 UI에 가려지지 않게 합니다.
      this.time.delayedCall(100, () => {
        if (
          this.suppressJoinToastUntil &&
          Date.now() < this.suppressJoinToastUntil
        ) {
          return;
        }
        if (data.players && data.players.length > 0) {
          const lastPlayer = data.players[data.players.length - 1];
          const candidateNickname =
            typeof data.newPlayerNickname === "string" &&
            data.newPlayerNickname.trim()
              ? data.newPlayerNickname.trim()
              : lastPlayer && typeof lastPlayer.nickname === "string"
                ? lastPlayer.nickname
                : "";

          if (this.suppressJoinToast) {
            if (candidateNickname && candidateNickname !== this.myNickname) {
              this.suppressJoinToast = false;
            }
            return;
          }

          // 내가 방금 들어온 게 아닐 때만 알림
          if (lastPlayer && lastPlayer.id !== socket.id && candidateNickname) {
            console.log("새 유저 입장 토스트 실행!");
            this.showToast(`${candidateNickname}님이 입장했습니다!`, "#2ecc71");
            console.log(
              `${lastPlayer.id}님의 레벨: ${lastPlayer.level}, 코인: ${lastPlayer.coins}`,
            );
            console.log("전체 플레이어 객체:", lastPlayer);
          }
        }
      });
    });

    // 3. 플레이어 퇴장 리스너
    socket.off("playerLeft").on("playerLeft", (data) => {
      if (this.isLeavingRoom) return;
      // 강퇴당한 플레이어는 자신만의 토스트가 이미 표시되었으므로 여기서는 표시 안 함
      if (this.kickedPlayerId && data.playerId === this.kickedPlayerId) {
        this.kickedPlayerId = null;
        this.refreshLobbyUI(data);
        return;
      }
      const nickname = data.leftPlayerNickname || "알 수 없는 요리사";
      this.refreshLobbyUI(data);
      this.showToast(`${nickname}님이 나갔습니다.`, "#e74c3c");
    });

    // 새로운 이벤트: 플레이어 데이터가 변경되었을 때 (캐릭터 교체 등)
    socket.off("playerUpdated").on("playerUpdated", (data) => {
      if (this.isLeavingRoom) return;
      // data should include at least `players` array similar to playerJoined
      this.refreshLobbyUI(data);
    });

    socket.off("joinRoomSuccess").on("joinRoomSuccess", (data) => {
      if (this.isLeavingRoom) return;
      if (typeof data?.roomNumber === "number") {
        this.currentRoomNumber = data.roomNumber;
      }
      this.hideLoading();
      this.currentPlayers = data.players || [];
      this.roomName = data.roomName;
      this.isGameStarted = data.isGameStarted || false;
      this.showToast("방에 입장했습니다!", "#3498db");
      this.refreshLobbyUI(data);
    });

    socket.on("startBlocked", (msg) => {
      console.log("startblock");

      this.showToast(
        msg || "아직 준비되지 않은 플레이어가 있습니다!",
        "#e74c3c",
      );
    });

    socket.off("readyStatusUpdated").on("readyStatusUpdated", (data) => {
      if (this.isLeavingRoom) return;
      this.refreshLobbyUI(data);
    });

    // ======================================
    // 1️⃣ 초기화
    // ======================================
    let bgmOn = localStorage.getItem("bgmEnabled") !== "false";

    // BGM 인스턴스 만들기 (한 번만)
    let bgm = this.sound.get("bgm");
    if (!bgm) {
      bgm = this.sound.add("bgm", { loop: true, volume: 0.2 });
    }

    // 사운드 전체 mute 상태 초기화
    this.sound.mute = !bgmOn;

    // BGM 재생
    if (bgmOn && !bgm.isPlaying) {
      bgm.play();
    }

    // ======================================
    // 2️⃣ 백그라운드 진입/복귀 처리
    // ======================================
    document.addEventListener("visibilitychange", () => {
      if (!socket.connected) {
        console.log("연결이 끊겨있음 -> 초기 화면으로 이동");
        this.scene.start("LobbyScene", { fromGame: true });
      }

      if (!bgm) return;

      if (document.hidden) {
        // 🔻 백그라운드 → BGM만 멈춤
        if (bgm.isPlaying) {
          bgm.pause();
        }
      } else {
        // 🔺 포그라운드 → BGM만 재생
        if (bgm.isPaused && bgmOn) {
          bgm.resume();
        }
      }
    });

    // ======================================
    // 3️⃣ BGM ON/OFF 버튼
    // ======================================
    const bgmBtn = this.add
      .image(centerX, profileCenterY * 0.7, bgmOn ? "soundon" : "soundoff")
      .setOrigin(0.5)
      .setDepth(10)
      .setScale(1.4)
      .setInteractive();

    // [핵심] 생성한 모든 객체를 메인 컨테이너에 추가
    this.mainUIContainer.add([bgmBtn, this.dailyRewardBtn]);
    this.mainUIContainer.setDepth(100);

    bgmBtn.on("pointerdown", () => {
      bgmOn = !bgmOn;
      localStorage.setItem("bgmEnabled", bgmOn);

      // 🔁 버튼 이미지 교체
      bgmBtn.setTexture(bgmOn ? "soundon" : "soundoff");

      if (!bgm) return;

      if (bgmOn) {
        // BGM 재생
        if (bgm.isPaused) {
          bgm.resume();
        } else if (!bgm.isPlaying) {
          bgm.play();
        }
      } else {
        // BGM 일시정지
        if (bgm.isPlaying) {
          bgm.pause();
        }
      }

      // 전체 사운드 mute 제어
      this.sound.mute = !bgmOn;
    });

    socket.off("gameStart").on("gameStart", (data) => {
      // 🔹 중요: 게임이 시작되면 로비 관련 경고 리스너들을 미리 끕니다.
      socket.off("startBlocked");
      socket.off("readyStatusUpdated");
      socket.off("joinRoomError");

      // 로딩창이 혹시 떠 있다면 닫아줍니다.
      this.hideLoading();

      if (typeof data?.itemMode !== "boolean") {
        data.itemMode = this.currentItemMode !== false;
      }

      this.scene.start("GameScene", data);
    });

    if (this.pendingRoomData) {
      const data = this.pendingRoomData;
      this.pendingRoomData = null;
      this.isRoomOpen = true;
      this.createBlocker();
      this.refreshLobbyUI({
        roomId: data.roomId,
        players: data.players || [],
        max: data.maxPlayers || data.max || 4,
        hostId: data.hostId,
        roomName: data.roomName || "대기실",
        itemMode: data.itemMode,
      });
    }

    // LobbyScene의 create() 내부
    this.events.once("shutdown", () => {
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("roomCreated");
      socket.off("joinRoomError");
      socket.off("recipeEnded");
      this.lastBackPressedAt = 0;
      if (this.backHandler && typeof this.backHandler.remove === "function") {
        this.backHandler.remove();
      }
    });
  }

  updateMyProfileUI(profile = {}) {
    const prev = this.myProfile || {};
    const prevLevel = Number(prev.level) || 1;
    const hasIncomingStats =
      typeof profile.level !== "undefined" ||
      typeof profile.coins !== "undefined" ||
      typeof profile.experience !== "undefined";

    const normalizeCharacterKey = (value) =>
      typeof value === "string" && /^player_[1-4]$/.test(value) ? value : null;

    const incomingOwnedCharacters = Array.isArray(profile.owned_characters)
      ? profile.owned_characters
      : Array.isArray(prev.owned_characters)
        ? prev.owned_characters
        : [];

    const normalizedOwnedCharacters = Array.from(
      new Set(
        ["player_1"].concat(
          incomingOwnedCharacters.filter(
            (key) => typeof key === "string" && /^player_[1-4]$/.test(key),
          ),
        ),
      ),
    );

    const normalizedCurrentCharacter =
      normalizeCharacterKey(profile.current_character) ||
      normalizeCharacterKey(profile.avatarKey) ||
      normalizeCharacterKey(prev.current_character) ||
      "player_1";

    const normalizedAvatarKey =
      normalizeCharacterKey(profile.avatarKey) ||
      normalizeCharacterKey(profile.current_character) ||
      normalizeCharacterKey(prev.avatarKey) ||
      normalizedCurrentCharacter;

    this.myProfile = {
      ...prev,
      ...profile,
      nickname:
        profile.nickname ||
        prev.nickname ||
        localStorage.getItem("nickname") ||
        "요리사",
      level: Number(profile.level ?? prev.level ?? 1) || 1,
      coins: Number(profile.coins ?? prev.coins ?? 0) || 0,
      experience: Number(profile.experience ?? prev.experience ?? 0) || 0,
      owned_characters: normalizedOwnedCharacters,
      current_character: normalizedCurrentCharacter,
      avatarKey: normalizedAvatarKey,
    };

    if (
      hasIncomingStats &&
      this.hasReceivedProfileStats &&
      this.myProfile.level > prevLevel
    ) {
      this.showToast(
        `레벨 업! Lv.${prevLevel} → Lv.${this.myProfile.level}`,
        "#2ecc71",
      );
    }
    if (hasIncomingStats) {
      this.hasReceivedProfileStats = true;
    }

    // combined text exists check
    if (
      !this.profileIdText ||
      !this.profileCoinText ||
      !this.profileExpBarFill ||
      !this.profileExpText
    ) {
      return;
    }

    // update combined level+nickname text
    this.profileIdText.setText(
      `LV.${this.myProfile.level} ${this.myProfile.nickname}`,
    );
    this.profileCoinText.setText(`X ${this.myProfile.coins}`);

    // 경험치 바 업데이트
    const currentExp = this.myProfile.experience % XP_PER_LEVEL;
    const expRatio = currentExp / XP_PER_LEVEL;
    const { width } = this.cameras.main;
    const profileSize = width * 0.2;
    const expBarWidth = profileSize * 0.9;
    const expBarHeight = width * 0.032;
    const statY = profileSize * 1.18;
    const expBarCenterX = profileSize * 0.4;

    // 진행 막대 업데이트 (둥근 모서리)
    this.profileExpBarFill.clear();
    this.profileExpBarFill.fillStyle(0x2ecc71, 1);
    this.profileExpBarFill.fillRoundedRect(
      expBarCenterX - expBarWidth / 2,
      statY - expBarHeight / 2,
      expBarWidth * expRatio,
      expBarHeight,
      8,
    );

    // 경험치 숫자 텍스트 업데이트
    this.profileExpText.setText(`EXP  ${currentExp}/${XP_PER_LEVEL}`);
  }

  getOwnedProfileAvatarKeys() {
    const allKeys = Array.isArray(this.profileAvatarKeys)
      ? this.profileAvatarKeys
      : [];
    if (allKeys.length === 0) {
      return ["player_1"];
    }

    const ownedList = Array.isArray(this.myProfile?.owned_characters)
      ? this.myProfile.owned_characters
      : [];
    const ownedSet = new Set(["player_1", ...ownedList]);

    const ownedKeys = allKeys.filter((key) => ownedSet.has(key));
    return ownedKeys.length > 0 ? ownedKeys : ["player_1"];
  }

  changeProfileAvatar(step) {
    const ownedKeys = this.getOwnedProfileAvatarKeys();
    if (ownedKeys.length === 0) {
      return;
    }

    const currentKey = this.getSelectedAvatarKey();
    const currentOwnedIndex = ownedKeys.indexOf(currentKey);
    const baseIndex = currentOwnedIndex >= 0 ? currentOwnedIndex : 0;

    const total = ownedKeys.length;
    const nextOwnedIndex =
      (((baseIndex + step + total) % total) + total) % total;
    const selectedKey = ownedKeys[nextOwnedIndex];

    const selectedIndex = this.profileAvatarKeys.indexOf(selectedKey);
    this.profileAvatarIndex = selectedIndex >= 0 ? selectedIndex : 0;
    localStorage.setItem("profileAvatarKey", selectedKey);
    this.updateProfileAvatarUI(selectedKey);

    if (!this.isSingle && socket.connected) {
      const resolvedPlayerId =
        this.myProfile?.nickname ||
        localStorage.getItem("nickname") ||
        this.myNickname ||
        "요리사";

      socket.emit("setCurrentCharacter", {
        id: resolvedPlayerId,
        userId: resolvedPlayerId,
        nickname: this.myProfile?.nickname,
        currentCharacter: selectedKey,
        current_character: selectedKey,
      });
    }
  }

  scheduleTutorialOverlay() {
    if (this.hasCompletedTutorial) return;
    if (this.tutorialOverlayScheduled || this.tutorialOverlayContainer) return;
    if (this.isRoomOpen || this.currentRoomId) return;

    this.tutorialOverlayScheduled = true;
    this.time.delayedCall(400, () => {
      this.tutorialOverlayScheduled = false;
      if (
        !this.scene.isActive("LobbyScene") ||
        this.isRoomOpen ||
        this.currentRoomId ||
        this.hasCompletedTutorial ||
        this.tutorialOverlayContainer
      ) {
        return;
      }
      this.showTutorialOverlay();
    });
  }

  showTutorialOverlay() {
    if (this.hasCompletedTutorial || this.tutorialOverlayContainer) {
      return;
    }
    if (this.isRoomOpen || this.currentRoomId) {
      return;
    }

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.5;

    this.tutorialOverlayContainer = this.add.container(0, 0).setDepth(6000);

    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.86)
      .setInteractive();

    const panel = this.add
      .image(centerX, popupY, "profilebg")
      .setDisplaySize(width * 0.82, height * 0.4);

    const title = this.add
      .text(centerX, popupY * 0.75, "튜토리얼", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffd700",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(
        centerX,
        popupY * 0.95,
        "게임플레이 방법을 익히고 엄청난 보상을 받아가세요!",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          color: "#ffffff",
          align: "center",
          stroke: "#000000",
          strokeThickness: 3,
          wordWrap: { width: width * 0.55 },
        },
      )
      .setOrigin(0.5);

    const steps = [
      "싱글플레이 버튼을 눌러 튜토리얼 전용 게임을 시작하세요.",
      "AI와 플레이하며 카드 뒤집기와 벨 사용 흐름을 익혀보세요.",
      "끝까지 완료하면 멀티플레이도 훨씬 수월해집니다!",
    ];

    const stepStartY = popupY - height * 0.05;
    steps.forEach((line, idx) => {
      const stepText = this.add
        .text(
          centerX - width * 0.32,
          stepStartY + idx * height * 0.07,
          `• ${line}`,
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.035}px`,
            color: "#e2e8f0",
            stroke: "#000000",
            strokeThickness: 2,
            wordWrap: { width: width * 0.64 },
          },
        )
        .setOrigin(0, 0.5);
      this.tutorialOverlayContainer.add(stepText);
    });

    const startBtn = this.add
      .image(centerX, popupY * 1.2, "ui_btn")
      .setDisplaySize(width * 0.33, height * 0.07)
      .setTint(0x2ecc71)
      .setInteractive({ useHandCursor: true });

    const startBtnText = this.add
      .text(centerX, popupY * 1.2, "시작하기", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const beginTutorialFlow = () => {
      this.closeTutorialOverlay();
      this.startTutorialGame();
    };

    startBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [startBtn, startBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 80,
        yoyo: true,
        onComplete: () => {
          this.ensureNicknameBeforeTutorial(() => {
            beginTutorialFlow();
          });
        },
      });
    });

    const skipText = this.add
      .text(centerX, popupY * 1.42, "나중에 할게요", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#f1f5f9",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    skipText.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      this.closeTutorialOverlay();
    });

    this.tutorialOverlayContainer.add([
      overlay,
      panel,
      title,
      subtitle,
      startBtn,
      startBtnText,
      skipText,
    ]);

    this.currentTutorialCloseHandler = () => this.closeTutorialOverlay();
  }

  ensureNicknameBeforeTutorial(onReady) {
    const finalizeNickname = (rawNickname) => {
      const nickname = (rawNickname || "").trim() || "요리사";
      try {
        localStorage.setItem("nickname", nickname);
      } catch (e) {
        console.warn("failed to persist nickname", e);
      }
      this.myNickname = nickname;

      socket.emit("setNickname", {
        nickname,
        avatarKey: this.getSelectedAvatarKey(),
      });

      if (typeof this.updateMyProfileUI === "function") {
        this.updateMyProfileUI({ nickname });
      }

      if (typeof onReady === "function") {
        onReady();
      }
    };

    const savedNickname = localStorage.getItem("nickname");
    if (savedNickname && savedNickname.trim().length > 0) {
      finalizeNickname(savedNickname);
      return;
    }

    this.showNicknamePopup((confirmedNickname) => {
      finalizeNickname(confirmedNickname);
    });
  }

  closeTutorialOverlay() {
    if (this.tutorialOverlayContainer) {
      this.tutorialOverlayContainer.destroy();
      this.tutorialOverlayContainer = null;
    }
    this.currentTutorialCloseHandler = null;
  }

  completeTutorial() {
    if (this.hasCompletedTutorial) {
      return;
    }
    this.hasCompletedTutorial = true;
    try {
      localStorage.setItem(TUTORIAL_STATE_KEY, "true");
    } catch (e) {
      console.warn("failed to persist tutorial state", e);
    }
  }

  getAvatarAnimMaxFrame(baseKey) {
    // player_2 is handled dynamically in ensureAvatarAnimation
    return baseKey === "player_1" ? 4 : 2;
  }

  getMybgAnimKey() {
    return "mainbg_anim";
  }

  ensureMybgAnimation() {
    const frameKeys = [];
    let frameIndex = 1;
    while (true) {
      const key = `mainbg_frame_${frameIndex}`;
      if (!this.textures.exists(key)) break;
      frameKeys.push(key);
      frameIndex += 1;
    }

    if (frameKeys.length > 0) {
      const animKey = this.getMybgAnimKey();
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: frameKeys.map((key) => ({ key })),
          frameRate: 12,
          skipMissedFrames: false,
          repeat: -1,
        });
      }
      return animKey;
    }

    const splitKeys = ["mainbg_q1", "mainbg_q2", "mainbg_q3", "mainbg_q4"];
    const hasSplit = splitKeys.every((key) => this.textures.exists(key));

    if (hasSplit) {
      ensureMainbgFrames(this);
      const animKeys = splitKeys.map((_, idx) => `mainbg_anim_q${idx + 1}`);

      animKeys.forEach((key, idx) => {
        if (this.anims.exists(key)) return;
        const frames = [];
        let frameIdx = 1;
        while (true) {
          const textureKey = `mainbg_q${idx + 1}_${frameIdx}`;
          if (this.textures.exists(textureKey)) {
            frames.push({ key: textureKey });
            frameIdx += 1;
            continue;
          }
          break;
        }

        if (frames.length === 0) return;
        this.anims.create({
          key,
          frames,
          frameRate: 12,
          skipMissedFrames: false,
          repeat: -1,
        });
      });

      return animKeys;
    }

    const animKey = this.getMybgAnimKey();
    if (this.anims.exists(animKey)) {
      return animKey;
    }

    if (!this.textures.exists("mainbg")) {
      return null;
    }

    ensureMainbgFrames(this);
    const frames = [];
    let idx = 1;
    while (true) {
      const textureKey = `mainbg_${idx}`;
      if (this.textures.exists(textureKey)) {
        frames.push({ key: textureKey });
        idx += 1;
        continue;
      }
      break;
    }

    if (frames.length === 0) {
      return null;
    }

    this.anims.create({
      key: animKey,
      frames,
      frameRate: 12,
      skipMissedFrames: false,
      repeat: -1,
    });

    return animKey;
  }

  getAvatarAnimKey(baseKey) {
    return `avatar_anim_${baseKey}`;
  }

  getAvatarAnimFrameRate(baseKey) {
    // both player1 and player2 use the higher frame rate for sprite sheet animations
    return baseKey === "player_1" || baseKey === "player_2" ? 18 : 2;
  }

  // choose a texture key to display for a given avatar base key
  getAvatarDisplayKey(baseKey) {
    if (this.textures.exists(`${baseKey}_1`)) return `${baseKey}_1`;
    if (baseKey === "player_1") {
      if (this.textures.exists("player_1_frame_1")) return "player_1_frame_1";
    }
    if (baseKey === "player_2") {
      if (this.textures.exists("player_2_frame_1")) return "player_2_frame_1";
    }
    // use first sheet if available
    const sheetKey = `${baseKey}_sprite_a`;
    if (this.textures.exists(sheetKey)) return sheetKey;
    return null;
  }

  updateProfileAvatarUI(forcedKey = null) {
    if (!this.profileImage || !this.profileAvatarKeys) {
      return;
    }

    let baseKey = null;
    if (
      typeof forcedKey === "string" &&
      /^player_[1-4]$/.test(forcedKey.trim())
    ) {
      baseKey = forcedKey.trim();
    } else {
      baseKey = this.getSelectedAvatarKey();
    }

    if (!baseKey) {
      baseKey = "player_1";
    }

    const selectedIndex = this.profileAvatarKeys.indexOf(baseKey);
    if (selectedIndex >= 0) {
      this.profileAvatarIndex = selectedIndex;
    }

    if (this.profileImage && typeof this.profileImage.setData === "function") {
      this.profileImage.setPosition(0, 0);
      this.profileImage.setData("avatarBaseY", 0);
      this.profileImage.setData(
        "avatarDisplayWidth",
        this.profileImage.displayWidth,
      );
      this.profileImage.setData(
        "avatarDisplayHeight",
        this.profileImage.displayHeight,
      );
    }

    this.applyAvatarAnimation(this.profileImage, baseKey);
  }

  getSelectedAvatarKey() {
    const ownedKeys = this.getOwnedProfileAvatarKeys();

    const current = Array.isArray(this.profileAvatarKeys)
      ? this.profileAvatarKeys[this.profileAvatarIndex]
      : null;

    if (typeof current === "string" && ownedKeys.includes(current)) {
      return current;
    }

    const saved = localStorage.getItem("profileAvatarKey");
    if (typeof saved === "string" && ownedKeys.includes(saved)) {
      return saved;
    }

    return ownedKeys[0] || "player_1";
  }

  showLoading(message = "로딩 중...") {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const bg = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setDepth(1000);

    const loadingContainer = this.add
      .container(centerX, centerY)
      .setDepth(1001);

    const loadingText = this.add
      .text(0, rotateRadius + ingreSize / 2 + 40, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        fill: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: loadingText,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    loadingContainer.add(loadingText);
    this.loadingUI = { bg, container: loadingContainer };
  }

  // 차단막을 생성하거나 가져오는 함수
  createBlocker() {
    // 1. 이미 있으면 새로 만들지 않고 기존 것을 반환
    if (this.lobbyBlocker && this.lobbyBlocker.active) {
      return this.lobbyBlocker;
    }

    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // 2. this.lobbyBlocker에 저장 (클래스 어디서든 접근 가능)
    this.lobbyBlocker = this.add.rectangle(
      0,
      0,
      screenWidth,
      screenHeight,
      0x000000,
      0.8,
    );
    this.lobbyBlocker.setOrigin(0);
    this.lobbyBlocker.setDepth(5); // UI보다 낮고 배경보다는 높게
    this.lobbyBlocker.setInteractive();

    return this.lobbyBlocker;
  }

  // 1. 모든 소켓 이벤트를 처리할 공통 데이터 업데이트 함수
  refreshLobbyUI(data) {
    if (this.isLeavingRoom) return;
    if (!this.scene.isActive()) return;

    // 서버가 주는 데이터가 있으면 갱신, 없으면 기존값 유지 (undefined 방지)
    this.currentRoomId = data.roomId || this.currentRoomId;
    this.currentPlayers = data.players || [];
    this.currentMax = data.max || this.currentMax;
    this.hostId = data.hostId || this.hostId;
    this.currentRoomName = data.roomName || this.currentRoomName || "대기실";
    if (typeof data.itemMode === "boolean") {
      this.currentItemMode = data.itemMode;
    }
    if (typeof data.gameMode === "string") {
      this.currentGameMode = data.gameMode;
    }
    if (typeof data.roomNumber === "number") {
      this.currentRoomNumber = data.roomNumber;
    }

    const isHost = socket.id === this.hostId;
    // 로그로 현재 상태 확인
    console.log(
      `[Sync] 방:${this.currentRoomId}, 나:${socket.id}, 방장:${this.hostId}, 방장여부:${isHost}`,
    );

    // UI 그리기 (기존 함수 호출)
    this.showWaiting(
      this.currentRoomId,
      this.currentPlayers,
      isHost,
      this.currentMax,
      this.currentRoomName,
      this.currentRoomNumber,
    );
  }

  async resolveRoomNumberFromPublicList(roomId) {
    if (!roomId) return null;

    try {
      const response = await fetch(`${SERVER_URL}/api/rooms`);
      if (!response.ok) return null;

      const rooms = await response.json();
      if (!Array.isArray(rooms)) return null;

      const index = rooms.findIndex((room) => room && room.roomId === roomId);
      return index >= 0 ? index + 1 : null;
    } catch (error) {
      return null;
    }
  }

  // 로딩 화면 표시 및 제거 함수
  showLoading(message) {
    const { width, height } = this.cameras.main;

    // 기존 로딩창이 있다면 제거 (타이머도 함께 취소됨)
    this.hideLoading();

    this.loadingContainer = this.add.container(0, 0).setDepth(1000);

    // 1. 배경 어둡게
    const bg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();

    // 2. 메시지 텍스트
    const txt = this.add
      .text(width / 2, height / 2, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // 3. 간단한 애니메이션 (깜빡임)
    this.tweens.add({
      targets: txt,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.loadingContainer.add([bg, txt]);

    // 5초 후에도 안 사라지면 강제로 닫기 (네트워크 오류 대비)
    this.loadingTimer = this.time.delayedCall(10000, () => {
      if (this.loadingContainer) {
        this.hideLoading();
        this.showToast("연결 시간이 초과되었습니다.");
      }
    });
  }

  hideLoading() {
    // 타이머 취소
    if (this.loadingTimer) {
      this.loadingTimer.remove();
      this.loadingTimer = null;
    }

    if (this.loadingContainer) {
      this.loadingContainer.destroy();
      this.loadingContainer = null;
    }
  }

  leaveCurrentRoom() {
    const roomId =
      this.currentRoomId || (socket && socket.roomId ? socket.roomId : null);

    const finalize = () => {
      this.hideLoading();
      this.isRoomOpen = false;
      this.currentRoomId = null;
      this.currentPlayers = [];
      this.currentMax = null;
      this.hostId = null;
      this.currentRoomName = null;
      this.currentRoomNumber = null;
      if (this.lobbyBlocker && this.lobbyBlocker.active) {
        this.lobbyBlocker.destroy();
      }
      this.lobbyBlocker = null;
      if (this.lobbyUIContainer) {
        this.lobbyUIContainer.destroy();
        this.lobbyUIContainer = null;
      }
      if (socket && socket.roomId === roomId) {
        socket.roomId = null;
      }
      this.scene.restart({ skipLobbyLoading: true });
    };

    this.isLeavingRoom = true;

    if (!roomId || !socket) {
      finalize();
      return;
    }

    this.showLoading("나가는 중...");

    const timeoutId = setTimeout(() => {
      finalize();
    }, 1200);

    socket.emit("leaveRoom", { roomId }, () => {
      clearTimeout(timeoutId);
      finalize();
    });
  }

  showToast(message, color = "#ffffff") {
    this.isToastOpen = true;

    if (!this.cameras || !this.cameras.main) return;

    const { width, height } = this.cameras.main;

    if (!this.toastLayer || !this.toastLayer.scene) {
      this.toastLayer = this.add.container(0, 0).setDepth(1000000);
      this.toastLayer.setScrollFactor(0);
    }
    this.toastLayer.setVisible(true);
    this.toastLayer.setActive(true);
    this.children.bringToTop(this.toastLayer);

    // 토스트 컨테이너 생성
    const toast = this.add
      .container(width / 2, height * 0.22)
      .setDepth(1000001);
    toast.setScrollFactor(0);

    const txt = this.add
      .text(0, 0, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.floor(width * 0.05)}px`,
        color: color,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#000000", 6, true, true);

    const paddingX = Math.floor(width * 0.04);
    const paddingY = Math.floor(width * 0.018);
    const bg = this.add
      .rectangle(
        0,
        0,
        Math.min(width * 0.86, txt.width + paddingX * 2),
        txt.height + paddingY * 2,
        0x000000,
        0.85,
      )
      .setOrigin(0.5);

    toast.add([bg, txt]);
    this.toastLayer.add(toast);

    // 효과음
    try {
      this.sound.play("pass", { volume: 0.5 });
    } catch (e) {}

    // 보여주기 애니메이션
    this.tweens.add({
      targets: toast,
      y: height * 0.22,
      duration: 300,
      ease: "Sine.easeOut",
      onStart: () => {
        toast.y = height * 0.19;
      },
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          if (toast.scene) {
            this.tweens.add({
              targets: toast,
              y: -100,
              duration: 300,
              ease: "Power2.easeIn",
              onComplete: () => {
                toast.destroy();
                this.activeToast = null;
                this.isToastOpen = false;
              },
            });
          }
        });
      },
    });
  }

  /*showJoinCodePopup(callback) {
    this.isJoinPopupOpen = true;
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    if (this.joinPopupContainer) this.joinPopupContainer.destroy();
    this.joinPopupContainer = this.add.container(0, 0).setDepth(200);

    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.5)
      .setInteractive();

    const popupBg = this.add
      .image(centerX, popupY, "popupbg")
      .setDisplaySize(width * 0.7, height * 0.24);

    const titleText = this.add
      .text(centerX, popupY - 120, "방 코드 입력", {
        fontFamily: "Jua",
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // 5. Phaser DOM Input (DOM은 컨테이너에 담기지 않으므로 개별 관리 필요)
    this.joinInputElement = this.add
      .dom(centerX - 200, popupY - 80, "input")
      .setDepth(201); // 컨테이너보다 살짝 높게

    const el = this.joinInputElement.node;
    el.placeholder = "코드 입력";
    Object.assign(el.style, {
      width: `${width * 0.5}px`,
      height: "85px",
      fontSize: "54px",
      fontFamily: "'Jua', sans-serif",
      textAlign: "center",
      border: "3px solid #5d4037",
      borderRadius: "10px",
      backgroundColor: "#ffffff",
      outline: "none",
      color: "#000",
    });

    el.addEventListener("input", () => {
      el.value = el.value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .substring(0, 6);
    });

    // 버튼 설정
    const btnY = popupY + 120;
    const btnGap = width * 0.17;

    const cancelBtnImg = this.add
      .image(centerX - btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.3, height * 0.065)
      .setInteractive({ useHandCursor: true })
      .setTint(0xffaaaa);
    const cancelBtnText = this.add
      .text(centerX - btnGap, btnY, "취소", {
        fontFamily: "Jua",
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const confirmBtnImg = this.add
      .image(centerX + btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.3, height * 0.065)
      .setInteractive({ useHandCursor: true });
    const confirmBtnText = this.add
      .text(centerX + btnGap, btnY, "입장", {
        fontFamily: "Jua",
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // 🔥 [핵심] DOM 요소를 제외한 모든 Phaser 객체를 컨테이너에 담기
    this.joinPopupContainer.add([
      overlay,
      popupBg,
      titleText,
      cancelBtnImg,
      cancelBtnText,
      confirmBtnImg,
      confirmBtnText,
    ]);

    // 제거 함수
    const closePopup = () => {
      if (this.joinPopupContainer) {
        this.joinPopupContainer.destroy();
        this.joinPopupContainer = null;
      }
      if (this.joinInputElement) {
        this.joinInputElement.destroy();
        this.joinInputElement = null;
      }

      this.isJoinPopupOpen = false;
      this.currentJoinPopupCloseHandler = null; // 핸들러 초기화
    };

    this.currentJoinPopupCloseHandler = closePopup;

    cancelBtnImg.on("pointerdown", () => {
      // 1. 효과음 재생
      this.sound.play("btn", { volume: 0.1 });

      // 2. 햅틱 피드백 (기존 코드 유지)
      if (window.ReactNativeWebView) {
        generateHapticFeedback({ type: "impactLight" }).catch(() => {});
      }

      // 3. 클릭 연출 (이미지와 텍스트 동시 적용)
      this.tweens.add({
        targets: [cancelBtnImg, cancelBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // 4. 연출이 끝난 후 팝업 닫기
          closePopup();
        },
      });
    });

    confirmBtnImg.on("pointerdown", () => {
      const code = el.value.trim();

      // 1. 클릭 효과음
      this.sound.play("btn", { volume: 0.1 });

      // 2. 클릭 연출 (이미지와 텍스트 동시 적용)
      this.tweens.add({
        targets: [confirmBtnImg, confirmBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // 3. 연출이 끝난 후 로직 실행
          if (code) {
            const myNickname = localStorage.getItem("nickname") || "요리사";

            if (callback) {
              // 🔹 먼저 로딩창을 띄우고
              this.showLoading("방 입장 중...");

              // 🔹 서버에 입장 요청 전송
              callback({
                roomId: code.toUpperCase(),
                nickname: myNickname,
              });
            }
            // 팝업 입력창 닫기
            closePopup();
          } else {
            this.showToast("방 코드를 입력해주세요!");
          }
        },
      });
    });
  }*/

  startSingleGame(aiDifficulty) {
    // socket.id가 없으면 고정 ID 사용 (싱글플레이 전용)
    const myId = socket.id || "PLAYER_ME";
    const myNickname = localStorage.getItem("nickname") || "나";

    const singleGameData = {
      roomId: "SINGLE",
      maxPlayers: 4,
      isSingle: true,
      hostId: myId, // 내가 방장
      aiDifficulty: aiDifficulty || "normal",

      // 나를 항상 0번 인덱스에 배치
      players: [
        {
          id: myId,
          nickname: myNickname,
          cards: 25,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
        {
          id: "AI_1",
          nickname: "초보 요리사",
          cards: 25,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
        {
          id: "AI_2",
          nickname: "중급 요리사",
          cards: 25,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
        {
          id: "AI_3",
          nickname: "천재 요리사",
          cards: 25,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
      ],
      // ... 나머지 recipes 로직
    };

    this.scene.start("GameScene", singleGameData);
  }

  startTutorialGame() {
    const myId = socket.id || "PLAYER_ME";
    const myNickname = localStorage.getItem("nickname") || "나";
    const tutorId = "AI_TUTOR";

    const tutorialDeckLayout = {
      [myId]: [
        { fruit: 1, count: 2 },
        { fruit: 3, count: 1 },
        { fruit: 2, count: 4 },
      ],
      [tutorId]: [
        { fruit: 1, count: 3 },
        { fruit: 4, count: 2 },
        { fruit: 2, count: 2 },
      ],
    };

    const buildPlayer = (id, nickname) => ({
      id,
      nickname,
      cards: tutorialDeckLayout[id]?.length || 0,
      isReady: true,
      openCard: null,
      openCardStack: [],
    });

    const tutorialPlayers = [
      buildPlayer(myId, myNickname),
      buildPlayer(tutorId, "가이드 요리사"),
    ];

    const tutorialConfig = {
      deckLayout: tutorialDeckLayout,
      rewardCoins: 80,
    };

    this.scene.start("GameScene", {
      roomId: "TUTORIAL",
      maxPlayers: tutorialPlayers.length,
      isSingle: true,
      hostId: myId,
      aiDifficulty: "easy",
      players: tutorialPlayers,
      isTutorialMode: true,
      tutorialConfig,
    });
  }

  showSingleDifficultyPopup() {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.5;

    if (this.singleDifficultyPopupContainer)
      this.singleDifficultyPopupContainer.destroy();
    this.singleDifficultyPopupContainer = this.add
      .container(0, 0)
      .setDepth(200);

    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.5)
      .setInteractive();
    overlay.on("pointerdown", () => {
      this.closeSingleDifficultyPopup();
    });

    const popupBg = this.add
      .image(centerX, popupY, "invitebg")
      .setDisplaySize(width * 0.7, height * 0.5);

    const difficultyButtons = [
      { key: "easy", label: "EASY", tint: 0x2ecc71 },
      { key: "normal", label: "NORMAL", tint: 0xf1c40f },
      { key: "hard", label: "HARD", tint: 0xe74c3c },
    ];

    const btnW = width * 0.45;
    const btnH = height * 0.075;
    const btnGap = height * 0.11;
    const firstY = popupY - btnGap;

    const closeBtn = this.add
      .image(
        centerX + width * 0.7 * 0.5 - width * 0.06,
        popupY - height * 0.5 * 0.5 + height * 0.045,
        "popupclose",
      )
      .setDisplaySize(width * 0.1, width * 0.1)
      .setInteractive({ useHandCursor: true });

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.closeSingleDifficultyPopup();
    });

    const popupObjects = [overlay, popupBg, closeBtn];

    difficultyButtons.forEach((btn, index) => {
      const btnY = firstY + btnGap * index;

      const btnImg = this.add
        .image(centerX, btnY, "uibtn")
        .setDisplaySize(btnW, btnH)
        .setInteractive({ useHandCursor: true })
        .setTint(btn.tint);

      const btnText = this.add
        .text(centerX, btnY, btn.label, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#ffffff",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      btnImg.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: [btnImg, btnText],
          scaleX: "*=0.95",
          scaleY: "*=0.95",
          duration: 80,
          yoyo: true,
          onComplete: () => {
            this.closeSingleDifficultyPopup();
            this.startSingleGame(btn.key);
          },
        });
      });

      popupObjects.push(btnImg, btnText);
    });

    this.singleDifficultyPopupContainer.add(popupObjects);
    this.currentJoinPopupCloseHandler = () => this.closeSingleDifficultyPopup();
  }

  closeSingleDifficultyPopup() {
    this.isJoinPopupOpen = false;
    if (this.singleDifficultyPopupContainer) {
      this.singleDifficultyPopupContainer.destroy();
      this.singleDifficultyPopupContainer = null;
    }
    this.currentJoinPopupCloseHandler = null;
  }

  equipCharacter(avatarKey) {
    const idx = this.profileAvatarKeys.indexOf(avatarKey);
    if (idx >= 0) {
      // update local avatar selection UI
      this.profileAvatarIndex = idx;
      this.updateProfileAvatarUI(avatarKey);

      if (!this.myProfile) {
        this.myProfile = {};
      }
      this.myProfile.current_character = avatarKey;
      this.myProfile.avatarKey = avatarKey;
      if (Array.isArray(this.myProfile.owned_characters)) {
        if (!this.myProfile.owned_characters.includes(avatarKey)) {
          this.myProfile.owned_characters.push(avatarKey);
        }
      }

      // if we're currently sitting in a room, update our local player record and
      // re-render the waiting screen so the lobby avatar reflects the change
      if (Array.isArray(this.currentPlayers)) {
        const me = this.currentPlayers.find((p) => p.id === socket.id);
        if (me) {
          me.avatarKey = avatarKey;
          me.currentCharacter = avatarKey;
        }
      }
      if (this.scene.isActive("LobbyScene")) {
        this.refreshLobbyUI({
          roomId: this.currentRoomId,
          players: this.currentPlayers,
          max: this.currentMax,
          hostId: this.hostId,
          roomName: this.currentRoomName,
          roomNumber: this.currentRoomNumber,
          itemMode: this.currentItemMode,
          gameMode: this.currentGameMode,
        });
      }

      if (!this.isSingle && socket.connected) {
        const resolvedPlayerId =
          this.myProfile.nickname ||
          localStorage.getItem("nickname") ||
          this.myNickname ||
          "요리사";

        socket.emit("setCurrentCharacter", {
          id: resolvedPlayerId,
          userId: resolvedPlayerId,
          nickname: this.myProfile.nickname,
          currentCharacter: avatarKey,
          current_character: avatarKey,
        });
      }
    }
  }

  showShopPopup() {
    this.isJoinPopupOpen = true;
    this.setLobbyChatInputHidden(true);

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.5;

    const specialCards = [
      {
        id: 4,
        key: "lock",
        icon: "lock",
        name: "패널티 방어",
        description: "실수해도 카드를 잃지 않아요",
        price: 180,
      },
      {
        id: 5,
        key: "shield",
        icon: "shield",
        name: "방패",
        description: "공격을 막아서 카드를 지켜요",
        price: 170,
      },
      {
        id: 6,
        key: "ink",
        icon: "block",
        name: "먹물",
        description: "상대방 카드에 먹물을 뿌려요",
        price: 160,
      },
      {
        id: 7,
        key: "thief",
        icon: "thief",
        name: "도둑",
        description: "모두에게서 카드 3장씩 뺏어와요",
        price: 220,
      },
      {
        id: 8,
        key: "king",
        icon: "king",
        name: "왕",
        description: "특수한 보너스 효과를 부여합니다",
        price: 300,
      },
    ];

    const characterItems = [
      {
        key: "player_1",
        name: "아기 곰돌이",
        description: "귀여운 아기 곰돌이에요",
        price: 0,
      },
      {
        key: "player_2",
        name: "명품 곰돌이",
        description: "럭셔리한 명품 곰돌이에요",
        price: 300,
      },
      {
        key: "player_3",
        name: "👨‍🍳 요리사 3",
        description: "빠른 손놀림의 셰프",
        price: 450,
      },
      {
        key: "player_4",
        name: "👩‍🍳 요리사 4",
        description: "화려한 플레이의 장인",
        price: 600,
      },
    ];

    const coinProducts = [
      { amount: 500, display: "$0.99" },
      { amount: 1000, display: "$1.99" },
      { amount: 3000, display: "$4.99" },
    ];

    const normalizeOwnedCharacters = (rawValue) => {
      const normalized = {};

      if (Array.isArray(rawValue)) {
        rawValue.forEach((key) => {
          if (typeof key === "string" && /^player_[1-4]$/.test(key)) {
            normalized[key] = true;
          }
        });
      } else if (rawValue && typeof rawValue === "object") {
        Object.entries(rawValue).forEach(([key, value]) => {
          if (typeof key === "string" && /^player_[1-4]$/.test(key)) {
            normalized[key] = !!value;
          }
        });
      }

      normalized.player_1 = true;
      return normalized;
    };

    const getOwnedCharacters = () => {
      const owned = {};
      if (this.myProfile && Array.isArray(this.myProfile.owned_characters)) {
        this.myProfile.owned_characters.forEach((key) => {
          if (typeof key === "string" && /^player_[1-4]$/.test(key)) {
            owned[key] = true;
          }
        });
      }
      owned.player_1 = true;
      return owned;
    };

    const saveOwnedCharacters = (ownedCharacters) => {
      const normalized = normalizeOwnedCharacters(ownedCharacters);
      const ownedList = Object.keys(normalized).filter(
        (key) => normalized[key],
      );
      if (!this.myProfile) {
        this.myProfile = {};
      }
      if (this.myProfile) {
        this.myProfile.owned_characters = ownedList;
      }
    };

    const getCharacterIdFromKey = (characterKey) => {
      const match = /^player_(\d+)$/.exec(String(characterKey || ""));
      return match ? Number(match[1]) : null;
    };

    this.syncInventoryToServer = (reason, extra = {}) => {
      if (this.isSingle || !socket.connected) return;

      const resolvedPlayerId =
        this.myProfile.nickname ||
        localStorage.getItem("nickname") ||
        this.myNickname ||
        "요리사";

      const specialCardsOwned = JSON.parse(
        localStorage.getItem("specialCards") || "{}",
      );

      const items = Object.entries(specialCardsOwned)
        .map(([id, count]) => ({
          id: Number(id),
          count: Number(count) || 0,
        }))
        .filter((item) => Number.isFinite(item.id) && item.count > 0);

      const payload = {
        reason,
        id: resolvedPlayerId,
        userId: resolvedPlayerId,
        player_id: resolvedPlayerId,
        nickname: this.myProfile.nickname,
        playerId: socket.id,
        items,
        specialCards: specialCardsOwned,
        ...extra,
      };

      if (this.hasServerProfileSnapshot) {
        const safeCoins = Number(this.myProfile.coins);
        if (Number.isFinite(safeCoins)) {
          payload.coins = safeCoins;
        }

        const ownedCharacters = Object.entries(getOwnedCharacters())
          .filter(([, owned]) => !!owned)
          .map(([key]) => key);
        if (ownedCharacters.length > 0) {
          payload.ownedCharacters = ownedCharacters;
          payload.owned_characters = ownedCharacters;
        }

        const currentCharacter = this.getSelectedAvatarKey();
        if (
          typeof currentCharacter === "string" &&
          /^player_[1-4]$/.test(currentCharacter)
        ) {
          payload.currentCharacter = currentCharacter;
          payload.current_character = currentCharacter;
        }
      }

      socket.emit("syncPlayerInventory", payload);
      socket.emit("syncInventory", payload);
      socket.emit("updatePlayerInventory", payload);
      socket.emit("updateProfile", payload);
      socket.emit("savePlayerProfile", payload);
    };

    if (this.shopPopupContainer) this.shopPopupContainer.destroy();
    this.shopPopupContainer = this.add.container(0, 0).setDepth(200);

    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.8)
      .setInteractive();
    overlay.on("pointerdown", () => {
      this.closeShopPopup();
    });

    const popupBg = this.add
      .image(centerX, popupY, "storebg")
      .setDisplaySize(width * 0.85, height * 0.7);

    const titleText = this.add
      .text(centerX, popupY - height * 0.28, "", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.08}px`,
        color: "#ffd700",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const coinDisplayY = popupY + height * 0.25;
    const buyButtonY = popupY + height * 0.31;

    const coinDisplayBg = this.add
      .image(centerX, coinDisplayY, "roombg")
      .setDisplaySize(width * 0.3, height * 0.04);

    this.shopCoinText = this.add
      .text(centerX, coinDisplayY, `💰 ${this.myProfile.coins}`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const tabs = [
      { key: "special", label: "특수카드" },
      { key: "character", label: "케릭터" },
      { key: "coin", label: "코인" },
    ];
    let currentTab = "special";
    const tabIndexes = { special: 0, character: 0, coin: 0 };

    const tabButtonWidth = width * 0.18;
    const tabButtonHeight = height * 0.05;
    const tabStartX = centerX * 0.62;
    const tabY = popupY - height * 0.16;
    const tabButtons = [];

    tabs.forEach((tab, idx) => {
      const tabX = tabStartX + idx * width * 0.19;
      const tabBg = this.add
        .image(tabX, tabY, "uibtn")
        .setDisplaySize(tabButtonWidth, tabButtonHeight)
        .setInteractive({ useHandCursor: true });

      const tabText = this.add
        .text(tabX, tabY, tab.label, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.034}px`,
          color: "#ffffff",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      tabBg.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.08 });
        currentTab = tab.key;
        updateTabVisuals();
        renderShopContent();
      });

      tabButtons.push({ key: tab.key, bg: tabBg, text: tabText });
    });

    const updateTabVisuals = () => {
      tabButtons.forEach((tabButton) => {
        const isActive = tabButton.key === currentTab;
        tabButton.bg.setTint(isActive ? 0x2ecc71 : 0x7f8c8d);
        tabButton.text.setAlpha(isActive ? 1 : 0.85);
      });
    };

    const cardDisplayContainer = this.add.container(
      centerX,
      popupY + height * 0.03,
    );
    const shopNavBtnTint = 0xd2d2d2;
    const shopBuyBtnTint = 0xd9be86;

    const leftBtn = this.add
      .image(centerX - width * 0.38, popupY + height * 0.03, "uibtn")
      .setDisplaySize(width * 0.1, width * 0.1)
      .setTint(shopNavBtnTint)
      .setInteractive({ useHandCursor: true });

    const leftIcon = this.add
      .text(centerX - width * 0.38, popupY + height * 0.03, "◀", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#f5e1c3", // beige tone
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const rightBtn = this.add
      .image(centerX + width * 0.38, popupY + height * 0.03, "uibtn")
      .setDisplaySize(width * 0.1, width * 0.1)
      .setTint(shopNavBtnTint)
      .setInteractive({ useHandCursor: true });

    const rightIcon = this.add
      .text(centerX + width * 0.38, popupY + height * 0.03, "▶", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#f5e1c3", // beige tone
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const buyBtn = this.add
      .image(centerX, buyButtonY, "ui_btn")
      .setDisplaySize(width * 0.35, height * 0.07)
      .setTint(shopNavBtnTint)
      .setInteractive({ useHandCursor: true });

    const buyBtnText = this.add
      .text(centerX, buyButtonY, "구매하기", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const renderShopContent = () => {
      cardDisplayContainer.removeAll(true);

      const index = tabIndexes[currentTab];

      if (currentTab === "special") {
        const card = specialCards[index];
        const specialCardsOwned =
          JSON.parse(localStorage.getItem("specialCards")) || {};
        const ownedCount = specialCardsOwned[card.id] || 0;

        // 아이콘
        let iconImg = null;
        try {
          const iconKey = card.icon || card.key || "itembg";
          if (this.textures.exists(iconKey)) {
            iconImg = this.add
              .image(0, 0, iconKey)
              .setDisplaySize(width * 0.5, width * 0.55)
              .setOrigin(0.5);
          }
        } catch (e) {
          iconImg = null;
        }

        const nameText = this.add
          .text(0, height * -0.12, card.name, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.07}px`,
            color: "#39ff14",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 5,
          })
          .setOrigin(0.5);

        const descText = this.add
          .text(0, height * 0.12, card.description, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.04}px`,
            color: "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
            wordWrap: { width: width * 0.5 },
          })
          .setOrigin(0.5);

        const priceText = this.add
          .text(0, height * 0.08, `💰 ${card.price}`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.05}px`,
            color: "#ffd700",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5);

        const ownedText = this.add
          .text(0, height * -0.089, `보유중: ${ownedCount}개`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.035}px`,
            color: "#2ecc71",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        const toAdd = [nameText, descText, priceText, ownedText];
        if (iconImg) toAdd.unshift(iconImg);
        cardDisplayContainer.add(toAdd);

        buyBtnText.setText("구매하기");
      }

      if (currentTab === "character") {
        const character = characterItems[index];
        const ownedCharacters = getOwnedCharacters();
        const isOwned = !!ownedCharacters[character.key];
        const isEquipped =
          this.profileAvatarKeys[this.profileAvatarIndex] === character.key;

        // show avatar sprite/animation (player_1/player_2 etc)
        let avatarSprite = null;
        try {
          const key = character.key;
          let avatarTexture = null;
          if (this.textures.exists(`${key}_1`)) {
            avatarTexture = `${key}_1`;
          } else if (this.textures.exists(`${key}`)) {
            avatarTexture = `${key}`;
          }
          if (!avatarTexture && this.textures.exists("player_1_frame_1")) {
            avatarTexture = "player_1_frame_1";
          }
          avatarSprite = this.add
            .sprite(0, height * 0.0, avatarTexture)
            .setDisplaySize(width * 0.3, width * 0.3);
          this.applyAvatarAnimation(avatarSprite, character.key);
        } catch (e) {
          console.warn("shop avatar sprite error", e);
        }

        const nameText = this.add
          .text(0, height * -0.12, character.name, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.065}px`,
            color: "#4ecdc4",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 5,
          })
          .setOrigin(0.5);

        const descText = this.add
          .text(0, height * 0.14, character.description, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.04}px`,
            color: "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
            wordWrap: { width: width * 0.5 },
          })
          .setOrigin(0.5);

        const priceText = this.add
          .text(
            0,
            height * 0.1,
            character.price > 0 ? `💰 ${character.price}` : "무료",
            {
              fontFamily: GAME_FONTS.main,
              fontSize: `${width * 0.05}px`,
              color: "#ffd700",
              fontWeight: "bold",
              stroke: "#000000",
              strokeThickness: 4,
            },
          )
          .setOrigin(0.5);

        const ownedText = this.add
          .text(0, height * -0.09, isOwned ? "보유중" : "미보유", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.035}px`,
            color: isOwned ? "#2ecc71" : "#ff6b6b",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        if (avatarSprite) {
          cardDisplayContainer.add([
            avatarSprite,
            nameText,
            descText,
            priceText,
            ownedText,
          ]);
        } else {
          cardDisplayContainer.add([nameText, descText, priceText, ownedText]);
        }

        if (isOwned) {
          buyBtnText.setText(isEquipped ? "착용중" : "착용하기");
        } else {
          buyBtnText.setText("구매하기");
        }
      }

      if (currentTab === "coin") {
        const product = coinProducts[index];

        const nameText = this.add
          .text(0, -80, "💎 코인 패키지", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.065}px`,
            color: "#ffd700",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 5,
          })
          .setOrigin(0.5);

        const amountText = this.add
          .text(0, -25, `💰 ${product.amount} 충전`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.05}px`,
            color: "#4ecdc4",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        const priceText = this.add
          .text(0, 25, product.display, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.05}px`,
            color: "#ffffff",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5);

        const tipText = this.add
          .text(0, 65, "구매 시 즉시 코인 추가", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.032}px`,
            color: "#2ecc71",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        cardDisplayContainer.add([nameText, amountText, priceText, tipText]);

        buyBtnText.setText("충전하기");
      }
    };

    leftBtn.on("pointerdown", () => {
      const activeLength =
        currentTab === "special"
          ? specialCards.length
          : currentTab === "character"
            ? characterItems.length
            : coinProducts.length;

      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: leftBtn,
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
      tabIndexes[currentTab] =
        (tabIndexes[currentTab] - 1 + activeLength) % activeLength;
      renderShopContent();
    });

    rightBtn.on("pointerdown", () => {
      const activeLength =
        currentTab === "special"
          ? specialCards.length
          : currentTab === "character"
            ? characterItems.length
            : coinProducts.length;

      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: rightBtn,
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
      tabIndexes[currentTab] = (tabIndexes[currentTab] + 1) % activeLength;
      renderShopContent();
    });

    buyBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: buyBtn,
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
      });

      if (currentTab === "special") {
        const card = specialCards[tabIndexes.special];
        if (this.myProfile.coins >= card.price) {
          this.myProfile.coins -= card.price;

          const specialCardsOwned =
            JSON.parse(localStorage.getItem("specialCards")) || {};
          if (!specialCardsOwned[card.id]) {
            specialCardsOwned[card.id] = 0;
          }
          specialCardsOwned[card.id] += 1;
          localStorage.setItem(
            "specialCards",
            JSON.stringify(specialCardsOwned),
          );

          this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
          this.updateMyProfileUI();

          if (!this.isSingle && socket.connected) {
            socket.emit("buySpecialCard", {
              cardId: card.id,
              cardPrice: card.price,
            });
          }

          try {
            const sceneInstance =
              typeof game !== "undefined" &&
              game.scene &&
              game.scene.keys &&
              game.scene.keys.GameScene;
            if (
              sceneInstance &&
              typeof sceneInstance.safeSyncInventory === "function"
            ) {
              sceneInstance.safeSyncInventory("buySpecialCard", {
                boughtItemId: card.id,
              });
            } else {
              console.warn(
                "safeSyncInventory not available for buySpecialCard",
              );
            }
          } catch (e) {
            console.warn("buySpecialCard sync failed", e);
          }

          this.showToast(`${card.name} 구매 완료!`, "#2ecc71");
          renderShopContent();
        } else {
          this.showToast("코인이 부족합니다!", "#e74c3c");
        }
        return;
      }

      if (currentTab === "character") {
        const character = characterItems[tabIndexes.character];
        const characterId = getCharacterIdFromKey(character.key);
        const ownedCharacters = getOwnedCharacters();
        const isOwned = !!ownedCharacters[character.key];

        if (isOwned) {
          // 서버에 케릭터 착용 요청
          if (!this.isSingle && socket.connected) {
            const resolvedPlayerId =
              this.myProfile.nickname ||
              localStorage.getItem("nickname") ||
              this.myNickname ||
              "요리사";

            socket.emit("equipCharacter", {
              nickname: resolvedPlayerId,
              characterKey: character.key,
            });
          } else {
            // 싱글플레이어 모드에서만 로컬 착용
            this.equipCharacter(character.key);
          }

          this.showToast(`${character.name} 착용 완료!`, "#2ecc71");
          renderShopContent();
          return;
        }

        if (this.myProfile.coins < character.price) {
          this.showToast("코인이 부족합니다!", "#e74c3c");
          return;
        }

        // 서버에 케릭터 구매 요청 (로컬 상태 변경 없이)
        if (!this.isSingle && socket.connected) {
          const resolvedPlayerId =
            this.myProfile.nickname ||
            localStorage.getItem("nickname") ||
            this.myNickname ||
            "요리사";

          const characterPayload = {
            id: resolvedPlayerId,
            userId: resolvedPlayerId,
            player_id: resolvedPlayerId,
            nickname: this.myProfile.nickname || resolvedPlayerId,
            playerId: socket.id,
            characterKey: character.key,
            characterId,
            characterPrice: character.price,
            currentCharacter: character.key,
            current_character: character.key,
            coins: Number(this.myProfile.coins) || 0,
          };

          socket.emit("buyCharacter", characterPayload);

          // Optimistically mark as owned/equipped for immediate UI feedback.
          ownedCharacters[character.key] = true;
          saveOwnedCharacters(ownedCharacters);
          this.equipCharacter(character.key);
          this.updateMyProfileUI();
          renderShopContent();
          return;
        } else {
          // 싱글플레이어 모드에서만 로컬 처리
          this.myProfile.coins -= character.price;
          this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);

          ownedCharacters[character.key] = true;
          saveOwnedCharacters(ownedCharacters);
          this.equipCharacter(character.key);
          this.updateMyProfileUI();
          this.lastCharacterPurchaseToastAt = Date.now();
          this.showToast(`${character.name} 구매 완료!`, "#2ecc71");
          renderShopContent();
        }

        return;
      }

      if (currentTab === "coin") {
        const product = coinProducts[tabIndexes.coin];
        this.buyCoin(product.amount);
        this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
        // 💡 buyCoin 함수에서 이미 서버에 addCoins 이벤트를 전송하므로
        // safeSyncInventory 호출은 중복이며 오류를 발생시킬 수 있음
        this.showToast(`💰 ${product.amount} 코인 구매 완료!`, "#2ecc71");
        renderShopContent();
      }
    });

    updateTabVisuals();
    renderShopContent();

    // 닫기 버튼 (popupclose 이미지)
    const closeBtn = this.add
      .image(centerX + width * 0.37, popupY - height * 0.31, "popupclose")
      .setDisplaySize(width * 0.11, width * 0.11)
      .setInteractive({ useHandCursor: true });

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: closeBtn,
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
      this.closeShopPopup();
    });

    this.shopPopupContainer.add([
      overlay,
      popupBg,
      titleText,
      coinDisplayBg,
      this.shopCoinText,
      ...tabButtons.flatMap((tabButton) => [tabButton.bg, tabButton.text]),
      cardDisplayContainer,
      leftBtn,
      leftIcon,
      rightBtn,
      rightIcon,
      buyBtn,
      buyBtnText,
      closeBtn,
    ]);

    this.currentShopPopupCloseHandler = () => {
      this.closeShopPopup();
    };
  }

  buildQuestPopupSnapshot() {
    const safe = {};
    let stored = {};
    try {
      stored = JSON.parse(
        localStorage.getItem(MULTI_QUEST_PROGRESS_STORAGE_KEY) || "{}",
      );
    } catch (e) {
      stored = {};
    }

    MULTI_QUEST_CONFIGS.forEach((quest) => {
      const raw = stored[quest.key] || {};
      let count = Math.max(0, Number(raw.count) || 0);
      let stage = Math.max(0, Number(raw.stage) || 0);
      const ready = Boolean(raw.ready);
      let runtime = buildQuestRuntime(quest, { stage, count: 0 });
      const loopGuard = 50;
      let guard = 0;
      while (!ready && count >= runtime.target && guard < loopGuard) {
        count -= runtime.target;
        stage += 1;
        runtime = buildQuestRuntime(quest, { stage, count: 0 });
        guard += 1;
      }

      safe[quest.key] = {
        count,
        stage,
        ready: ready && runtime ? true : false,
      };
    });

    return safe;
  }

  saveMultiQuestProgressSnapshot(snapshot) {
    try {
      const payload = {};
      MULTI_QUEST_CONFIGS.forEach((quest) => {
        const entry = snapshot?.[quest.key] || {};
        payload[quest.key] = {
          count: Number(entry.count) || 0,
          stage: Number(entry.stage) || 0,
          ready: Boolean(entry.ready),
        };
      });
      localStorage.setItem(
        MULTI_QUEST_PROGRESS_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch (e) {
      console.warn("failed to save multi quest progress", e);
    }
  }

  showQuestPopup() {
    this.isJoinPopupOpen = true;
    this.setLobbyChatInputHidden(true);

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height * 0.5;

    if (this.questPopupContainer) {
      this.questPopupContainer.destroy();
    }
    this.questPopupContainer = this.add.container(0, 0).setDepth(210);

    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.7)
      .setInteractive();
    overlay.on("pointerdown", () => {
      this.closeQuestPopup();
    });

    const panelW = width * 0.86;
    const panelH = height * 0.7;
    const panel = this.add
      .rectangle(centerX, centerY, panelW, panelH, 0x0b1220, 0.95)
      .setStrokeStyle(3, 0x38bdf8, 0.6);

    const titleText = this.add
      .text(centerX, centerY - panelH * 0.4, "멀티 퀘스트", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#f8fafc",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const closeBtn = this.add
      .image(centerX + panelW * 0.42, centerY - panelH * 0.42, "popupclose")
      .setDisplaySize(width * 0.1, width * 0.1)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: closeBtn,
        scale: "*=0.95",
        duration: 90,
        yoyo: true,
      });
      this.closeQuestPopup();
    });

    this.questPopupContainer.add([overlay, panel]);

    const snapshot = this.buildQuestPopupSnapshot();
    const rowHeight = Math.max(height * 0.055, 40);
    const rowGap = Math.max(height * 0.012, 10);
    const listStartY = centerY - panelH * 0.28;
    const rowWidth = panelW * 0.86;
    const barHeight = Math.max(6, rowHeight * 0.2);

    MULTI_QUEST_CONFIGS.forEach((quest, index) => {
      const entry = snapshot[quest.key] || { count: 0, stage: 0, ready: false };
      const runtime = buildQuestRuntime(quest, entry);
      const rowY = listStartY + index * (rowHeight + rowGap);

      const rowBg = this.add
        .rectangle(centerX, rowY, rowWidth, rowHeight, 0x1f2937, 0.85)
        .setStrokeStyle(1, 0x475569, 0.7);

      const rewardText = quest.rewardCoins ? ` · +${quest.rewardCoins}💰` : "";
      const rowText = this.add
        .text(centerX - rowWidth * 0.44, rowY - rowHeight * 0.18, "", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.07}px`,
          color: "#e2e8f0",
        })
        .setOrigin(0, 0.5);
      rowText.setText(`${runtime.title}${rewardText}`);

      const barX = centerX - rowWidth * 0.44;
      const barY = rowY + rowHeight * 0.22;
      const barW = rowWidth * 0.7;
      const track = this.add
        .rectangle(barX, barY, barW, barHeight, 0x0f172a, 0.75)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x1d4ed8, 0.55);
      const ratio = Math.max(
        0,
        Math.min(1, entry.count / Math.max(1, runtime.target)),
      );
      const fill = this.add
        .rectangle(barX, barY, barW, barHeight, 0x38bdf8, 0.95)
        .setOrigin(0, 0.5)
        .setScale(ratio, 1);

      const progressLabel = this.add
        .text(barX + barW, barY, `${entry.count}/${runtime.target}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.026}px`,
          color: "#cbd5f5",
        })
        .setOrigin(1, 0.5);

      const claimX = centerX + rowWidth * 0.36;
      const claimY = rowY;
      const claimW = rowHeight * 1.3;
      const claimH = rowHeight * 0.55;
      const claimBg = this.add
        .rectangle(
          claimX,
          claimY,
          claimW,
          claimH,
          entry.ready ? 0x22c55e : 0x3b3f51,
          entry.ready ? 0.95 : 0.65,
        )
        .setStrokeStyle(2, 0x15803d, 0.9);
      const claimText = this.add
        .text(claimX, claimY, "수령", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.025}px`,
          color: entry.ready ? "#f8fafc" : "#94a3b8",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      if (entry.ready) {
        const handleClaim = () => {
          this.sound.play("btn", { volume: 0.08 });
          if (!entry.ready) {
            this.showToast("아직 수령할 보상이 없어요!", "#f97316");
            return;
          }
          if (quest.rewardCoins) {
            this.rewardQuestCoins(quest.rewardCoins, runtime.title, quest.key);
          } else {
            this.showToast(`${runtime.title} 완료!`, "#22c55e");
          }

          entry.stage = (entry.stage || 0) + 1;
          entry.count = 0;
          entry.ready = false;
          snapshot[quest.key] = entry;
          this.saveMultiQuestProgressSnapshot(snapshot);

          const nextRuntime = buildQuestRuntime(quest, entry);
          if (nextRuntime?.title) {
            this.showToast(`${nextRuntime.title} 시작!`, "#38bdf8");
          }
          this.closeQuestPopup();
          this.showQuestPopup();
        };
        claimBg
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", handleClaim);
        claimText
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", handleClaim);
      }

      this.questPopupContainer.add([
        rowBg,
        rowText,
        track,
        fill,
        progressLabel,
        claimBg,
        claimText,
      ]);
    });

    this.questPopupContainer.add([titleText, closeBtn]);
    this.currentJoinPopupCloseHandler = () => this.closeQuestPopup();
  }

  closeQuestPopup() {
    if (this.questPopupContainer) {
      this.questPopupContainer.destroy();
      this.questPopupContainer = null;
    }
    this.isJoinPopupOpen = false;
    this.setLobbyChatInputHidden(false);
  }

  /*showCoinShopPopup() {
    this.isJoinPopupOpen = true;
    this.coinShopBackCloseHandler = () => this.closeCoinShopPopup();
    this.currentJoinPopupCloseHandler = this.coinShopBackCloseHandler;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.5;

    // 코인 상품 데이터
    const coinProducts = [
      { amount: 500, price: 0.99, display: "💰 500 +\n$0.99" },
      { amount: 1000, price: 1.99, display: "💰 1000 +\n$1.99" },
      { amount: 3000, price: 4.99, display: "💰 3000 +\n$4.99" },
    ];

    if (this.coinShopContainer) this.coinShopContainer.destroy();
    this.coinShopElements = []; // 코인 팝업 요소들을 추적할 배열

    // 반투명 배경
    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.6)
      .setInteractive()
      .setDepth(1001);
    overlay.on("pointerdown", () => {
      this.closeCoinShopPopup();
    });
    this.coinShopElements.push(overlay);

    // 팝업 배경 (이미지 사용)
    const popupBg = this.add
      .image(centerX, popupY, "popupbg")
      .setDisplaySize(width * 0.85, height * 0.55)
      .setDepth(1002);
    this.coinShopElements.push(popupBg);

    // 제목
    const titleText = this.add
      .text(centerX, popupY - height * 0.22, "💎 코인 구매", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.08}px`,
        color: "#4ecdc4",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1003);
    this.coinShopElements.push(titleText);

    // 현재 보유 코인 배경
    const coinDisplayBg = this.add
      .image(centerX, popupY - height * 0.14, "itembg")
      .setDisplaySize(width * 0.4, height * 0.05)
      .setDepth(1002);
    this.coinShopElements.push(coinDisplayBg);

    // 현재 보유 코인
    this.coinShopCurrentCoinText = this.add
      .text(
        centerX,
        popupY - height * 0.14,
        `현재 보유: 💰 ${this.myProfile.coins}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          color: "#ffffff",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(1003);
    this.coinShopElements.push(this.coinShopCurrentCoinText);

    // 닫기 버튼 (이미지 사용)
    const closeBtn = this.add
      .image(centerX + width * 0.38, popupY - height * 0.24, "uibtn")
      .setDisplaySize(width * 0.09, width * 0.09)
      .setInteractive({ useHandCursor: true })
      .setDepth(1003);
    this.coinShopElements.push(closeBtn);

    const closeBtnIcon = this.add
      .text(centerX + width * 0.38, popupY - height * 0.24, "✕", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ff6b6b",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1004);
    this.coinShopElements.push(closeBtnIcon);

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      this.tweens.add({
        targets: closeBtn,
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
      this.closeCoinShopPopup();
    });

    // 코인 상품 버튼들 배치
    const productSpacing = width * 0.27;
    const productStartX = centerX - (productSpacing * 2) / 2;

    coinProducts.forEach((product, index) => {
      const productX = productStartX + index * productSpacing;
      const productY = popupY + height * 0.05;

      // 상품 배경 (이미지 사용)
      const productBg = this.add
        .image(productX, productY, "itembg")
        .setDisplaySize(width * 0.24, height * 0.2)
        .setDepth(1003);
      this.coinShopElements.push(productBg);

      // 상품 버튼 (투명한 클릭 영역)
      const productBtn = this.add
        .rectangle(productX, productY, width * 0.24, height * 0.2, 0x4ecdc4, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(1004);
      this.coinShopElements.push(productBtn);

      // 상품 텍스트
      const productText = this.add
        .text(productX, productY, product.display, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          color: "#ffd700",
          fontWeight: "bold",
          align: "center",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(1005);
      this.coinShopElements.push(productText);

      productBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: [productBg, productText],
          scale: "*=0.95",
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
        });
        this.buyCoin(product.amount);
      });
    });
  }*/

  buyCoin(amount) {
    // 🔹 멀티플레이인 경우: 서버에 전송하고 응답을 기다림
    if (!this.isSingle && socket?.connected) {
      const nickname =
        this.myProfile.nickname || localStorage.getItem("nickname") || "추추";

      socket.emit("addCoins", {
        amount,
        nickname,
        playerId: socket.id,
        timestamp: new Date().toISOString(),
      });

      // 서버 응답을 기다리므로 여기서는 UI만 표시
      this.showToast(`💰 ${amount} 코인 충전 요청 중...`, "#f39c12");
      return;
    }

    // 🔹 싱글플레이인 경우: 즉시 로컬 업데이트
    this.myProfile.coins += amount;

    // 🔹 스토어의 코인 텍스트 업데이트 (상점 팝업이 뒤에 있을 때)
    if (this.shopCoinText) {
      this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
    }

    // 🔹 코인 팝업의 현재 보유 코인 텍스트 업데이트
    if (this.coinShopCurrentCoinText) {
      this.coinShopCurrentCoinText.setText(
        `현재 보유: 💰 ${this.myProfile.coins}`,
      );
    }

    // 🔹 프로필 업데이트
    this.updateMyProfileUI();

    this.showToast(`💰 ${amount} 코인 추가되었습니다!`, "#2ecc71");
  }

  closeCoinShopPopup() {
    if (this.coinShopElements && Array.isArray(this.coinShopElements)) {
      this.coinShopElements.forEach((element) => {
        if (element) element.destroy();
      });
      this.coinShopElements = [];
    }

    if (this.currentJoinPopupCloseHandler === this.coinShopBackCloseHandler) {
      this.currentJoinPopupCloseHandler = null;
    }
    this.coinShopBackCloseHandler = null;
    this.isJoinPopupOpen = !!this.shopPopupContainer;
  }

  closeShopPopup() {
    this.isJoinPopupOpen = false;
    if (this.shopPopupContainer) {
      this.shopPopupContainer.destroy();
      this.shopPopupContainer = null;
    }
    this.currentShopPopupCloseHandler = null;
    this.setLobbyChatInputHidden(false);
  }

  showPublicRoomsPopup() {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    // 로딩 표시
    this.showLoading("방 목록 로딩 중...");

    // 공개 방 목록 가져오기
    fetch(`${SERVER_URL}/api/rooms`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((rooms) => {
        this.hideLoading(); // ✅ 방 목록 로드 완료 시 로딩창 닫기
        // 1. 기존 팝업 닫기
        if (this.joinPopupContainer) this.joinPopupContainer.destroy();
        this.joinPopupContainer = this.add.container(0, 0).setDepth(1100); // 로비 UI보다 높게

        // 2. 반투명 배경
        const overlay = this.add
          .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.85)
          .setInteractive();

        // 3. 팝업 배경 이미지
        const popupBg = this.add
          .image(centerX, popupY, "multbg")
          .setDisplaySize(width * 0.7, height * 0.5);

        // 4. 제목 텍스트

        // 5. 탭 버튼들 (3가지 선택) - popupbg 하단에 uibtn 이미지로 배치
        // popupbg 하단 = popupY + popupbg높이/2 부근
        const popupHalfH = (height * 0.6) / 2;
        const tabY = popupY + popupHalfH - height * 0.075; // popupbg 하단 안쪽
        const tabBtnW = width * 0.16;
        const tabBtnH = height * 0.05;
        const tabGap = width * 0.195;
        const activeTabTint = 0xf5b041;

        let currentTab = "browse"; // 기본 탭
        const allTabs = []; // 모든 탭 저장

        // 먼저 배경과 제목을 컨테이너에 추가
        this.joinPopupContainer.add([overlay, popupBg]);

        const createTabButton = (label, tabName, posX) => {
          const isActive = currentTab === tabName;
          const tabImg = this.add
            .image(posX, tabY, "uibtn")
            .setDisplaySize(tabBtnW, tabBtnH * 1.1)
            .setTint(isActive ? activeTabTint : 0x7f8c8d)
            .setInteractive({ useHandCursor: true });

          const tabText = this.add
            .text(posX, tabY, label, {
              fontFamily: "Jua",
              fontSize: `${width * 0.035}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const onTabClick = () => {
            currentTab = tabName;
            this.sound.play("btn", { volume: 0.1 });

            // 모든 탭 색상 업데이트
            allTabs.forEach((tab) => {
              tab.img.setTint(tab.name === tabName ? activeTabTint : 0x7f8c8d);
            });

            // 콘텐츠 업데이트
            updateTabContent(tabName);
          };

          tabImg.on("pointerdown", () => {
            this.tweens.add({
              targets: [tabImg, tabText],
              scale: "*=0.95",
              duration: 100,
              yoyo: true,
              ease: "Quad.easeInOut",
              onComplete: () => {
                onTabClick();
              },
            });
          });

          tabText.setInteractive({ useHandCursor: true });
          tabText.on("pointerdown", () => {
            this.tweens.add({
              targets: [tabImg, tabText],
              scale: "*=0.95",
              duration: 100,
              yoyo: true,
              ease: "Quad.easeInOut",
              onComplete: () => {
                onTabClick();
              },
            });
          });

          this.joinPopupContainer.add([tabImg, tabText]);

          return { img: tabImg, text: tabText, name: tabName };
        };

        const browseTab = createTabButton(
          "방 찾기",
          "browse",
          centerX * 1 - tabGap * 0.5,
        );
        const createTab = createTabButton(
          "방 만들기",
          "create",
          centerX * 1 + tabGap * 0.5,
        );

        allTabs.push(browseTab, createTab);

        // 6. 콘텐츠 영역
        const contentY = popupY;
        let currentContent = null;

        const updateTabContent = (tabName, roomsData) => {
          if (currentContent) {
            this.joinPopupContainer.remove(currentContent);
            currentContent.destroy();
          }

          if (tabName === "browse") {
            currentContent = this.add.container(centerX, contentY);
            showRoomList(currentContent, roomsData || rooms);
          } else if (tabName === "create") {
            currentContent = this.add.container(centerX, contentY);
            showRoomCreateForm(currentContent);
          }

          // 콘텐츠를 joinPopupContainer에 추가
          if (currentContent) {
            this.joinPopupContainer.add(currentContent);
          }
        };

        // 콘텐츠 표시 함수들
        const showRoomList = (container, rooms) => {
          if (rooms.length === 0) {
            const emptyText = this.add
              .text(0, 0, "방이 없습니다", {
                fontFamily: "Jua",
                fontSize: `${width * 0.05}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
              })
              .setOrigin(0.5);
            container.add(emptyText);
            return;
          }

          const roomItemHeight = height * 0.065;
          const maxVisibleRooms = 4;
          const roomsPerPage = 4;
          const listWidth = width * 0.58;
          const itemGap = 10;
          const popupBgHeight = height * 0.5;
          const contentTop = -popupBgHeight * 0.5 + height * 0.06;
          const listStartY = contentTop + roomItemHeight * 0.5;

          // 페이지 상태 관리
          let currentPage = 0;
          const totalPages = Math.ceil(rooms.length / roomsPerPage);

          // 방 목록을 담을 컨테이너
          const roomsContainer = this.add.container(0, 0);
          container.add(roomsContainer);

          // 현재 페이지 방들을 표시하는 함수
          const displayRoomsPage = () => {
            // 기존 방들 제거
            roomsContainer.removeAll(true);

            const startIdx = currentPage * roomsPerPage;
            const endIdx = Math.min(startIdx + roomsPerPage, rooms.length);

            for (let i = startIdx; i < endIdx; i++) {
              const room = rooms[i];
              const pageIndex = i - startIdx;
              const itemY = listStartY + pageIndex * (roomItemHeight + itemGap);

              const isPlaying = room.isGameStarted === true;

              const itemBg = this.add
                .image(0, itemY, "roombg")
                .setDisplaySize(listWidth, roomItemHeight)
                .setTint(isPlaying ? 0x555555 : 0xffffff)
                .setInteractive({ useHandCursor: true });

              const roomNo = i + 1;
              const publicTag = room.isPublic === false ? "🔒" : "🌐";
              const modeTag = room.gameMode === "timeattack" ? "⏱️" : "🎴";
              const playingTag = isPlaying ? " 🎮플레이중" : "";
              const roomTitle = room.roomName || `${room.hostNickname}의 방`;
              const itemTag = room.itemMode === false ? "(노템) " : "(아이템) ";
              const roomInfo = `${roomNo}. ${publicTag} ${modeTag} ${itemTag}${roomTitle}${playingTag}  (${room.playerCount}/${room.maxPlayers})`;
              const roomText = this.add
                .text(-listWidth * 0.4, itemY, roomInfo, {
                  fontFamily: "Jua",
                  fontSize: `${width * 0.028}px`,
                  color: isPlaying ? "#aaaaaa" : "#ffffff",
                  stroke: "#000000",
                  strokeThickness: 2,
                  align: "left",
                })
                .setOrigin(0, 0.5);

              itemBg.on("pointerdown", () => {
                this.sound.play("btn", { volume: 0.1 });

                if (window.ReactNativeWebView) {
                  generateHapticFeedback({ type: "impactLight" }).catch(
                    () => {},
                  );
                }

                // 플레이 중인 방은 입장 불가
                if (isPlaying) {
                  this.showToast("이미 게임이 진행 중인 방입니다!", "#e74c3c");
                  return;
                }

                const myNickname = localStorage.getItem("nickname") || "요리사";

                if (!room.isPublic) {
                  // 비공개 방: 비밀번호 입력 팝업
                  this.showPasswordPopup((pw) => {
                    this.currentRoomNumber = roomNo;
                    this.showLoading("방 입장 중...");
                    socket.emit("joinPublicRoom", {
                      roomId: room.roomId,
                      nickname: myNickname,
                      avatarKey: this.getSelectedAvatarKey(),
                      password: pw,
                    });
                    closePopupWithCleanup();
                  });
                } else {
                  // 공개 방: 바로 입장
                  this.currentRoomNumber = roomNo;
                  this.showLoading("방 입장 중...");
                  socket.emit("joinPublicRoom", {
                    roomId: room.roomId,
                    nickname: myNickname,
                    avatarKey: this.getSelectedAvatarKey(),
                  });
                  closePopupWithCleanup();
                }
              });

              itemBg.on("pointerover", () => {
                itemBg.setAlpha(0.8);
              });

              itemBg.on("pointerout", () => {
                itemBg.setAlpha(1);
              });

              roomsContainer.add([itemBg, roomText]);
            }
          };

          // 첫 페이지 표시
          displayRoomsPage();

          // 페이지 버튼 추가 (방 목록 아래에)
          if (totalPages > 1) {
            const pageButtonY =
              listStartY +
              maxVisibleRooms * (roomItemHeight + itemGap) +
              height * 0.01;
            const buttonGap = width * 0.15;

            // 이전 버튼
            const prevBtnText = this.add
              .text(-buttonGap, pageButtonY, "◀ 이전", {
                fontFamily: "Jua",
                fontSize: `${width * 0.028}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
              })
              .setOrigin(0.5)
              .setInteractive({ useHandCursor: true });

            // 다음 버튼
            const nextBtnText = this.add
              .text(buttonGap, pageButtonY, "다음 ▶", {
                fontFamily: "Jua",
                fontSize: `${width * 0.028}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
              })
              .setOrigin(0.5)
              .setInteractive({ useHandCursor: true });

            // 페이지 표시
            const pageIndicator = this.add
              .text(0, pageButtonY, `${currentPage + 1}/${totalPages}`, {
                fontFamily: "Jua",
                fontSize: `${width * 0.028}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 3,
              })
              .setOrigin(0.5);

            // 버튼 상태 업데이트
            const updateButtonStates = () => {
              if (currentPage === 0) {
                prevBtnText.setColor("#ffffff");
                prevBtnText.setStroke("#000000");
                prevBtnText.disableInteractive();
              } else {
                prevBtnText.setColor("#ffffff");
                prevBtnText.setStroke("#000000");
                prevBtnText.setInteractive({ useHandCursor: true });
              }

              if (currentPage === totalPages - 1) {
                nextBtnText.setColor("#ffffff");
                nextBtnText.setStroke("#000000");
                nextBtnText.disableInteractive();
              } else {
                nextBtnText.setColor("#ffffff");
                nextBtnText.setStroke("#000000");
                nextBtnText.setInteractive({ useHandCursor: true });
              }

              pageIndicator.setText(`${currentPage + 1}/${totalPages}`);
            };

            updateButtonStates();

            // 이전 버튼 클릭
            prevBtnText.on("pointerdown", () => {
              if (currentPage > 0) {
                this.sound.play("btn", { volume: 0.1 });
                currentPage--;
                displayRoomsPage();
                updateButtonStates();
              }
            });

            // 다음 버튼 클릭
            nextBtnText.on("pointerdown", () => {
              if (currentPage < totalPages - 1) {
                this.sound.play("btn", { volume: 0.1 });
                currentPage++;
                displayRoomsPage();
                updateButtonStates();
              }
            });

            container.add([prevBtnText, nextBtnText, pageIndicator]);
          }
        };

        const showRoomCreateForm = (container) => {
          const roomNameInputY = contentY * -0.36;
          const passwordInputY = contentY * -0.22;
          const publicToggleY = height * 0.02;
          const itemToggleY = height * 0.07;
          const modeToggleY = height * 0.115;
          const createBtnY = height * 0.155;

          // 방 이름 입력창 (DOM 절대 좌표)
          const roomNameInput = this.add
            .dom(centerX * -0.36, roomNameInputY, "input")
            .setDepth(1102);
          const nameEl = roomNameInput.node;
          nameEl.placeholder = "방 이름 입력 (선택, 최대10자)";
          Object.assign(nameEl.style, {
            width: `${width * 0.5}px`,
            height: "90px",
            fontSize: "40px",
            fontFamily: "'Jua', sans-serif",
            textAlign: "center",
            border: "3px solid #5d4037",
            borderRadius: "10px",
            backgroundColor: "#ffffff",
            outline: "none",
            color: "#000",
          });
          nameEl.addEventListener("input", () => {
            if (nameEl.value.length > 10)
              nameEl.value = nameEl.value.substring(0, 10);
          });

          // 공개/비공개 각각 버튼
          let isPublic = true;
          let isItemMode = true;
          let isTimeAttack = false;
          const btnGapX = width * 0.13;

          const publicBtnImg = this.add
            .image(-btnGapX, publicToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x3498db) // 활성 상태 (파란색)
            .setInteractive({ useHandCursor: true });
          const publicBtnText = this.add
            .text(-btnGapX, publicToggleY, "🌐 공개", {
              fontFamily: "Jua",
              fontSize: `${width * 0.033}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const privateBtnImg = this.add
            .image(btnGapX, publicToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x7f8c8d) // 비활성 상태 (회색)
            .setInteractive({ useHandCursor: true });
          const privateBtnText = this.add
            .text(btnGapX, publicToggleY, "🔒 비공개", {
              fontFamily: "Jua",
              fontSize: `${width * 0.033}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          // 비밀번호 입력창 (비공개 선택 시 표시)
          const pwInput = this.add
            .dom(centerX * -0.35, passwordInputY, "input")
            .setDepth(1102);
          const pwEl = pwInput.node;
          pwEl.placeholder = "비밀번호 (숫자 4자리)";
          pwEl.type = "password";
          Object.assign(pwEl.style, {
            width: `${width * 0.4}px`,
            height: "65px",
            fontSize: "38px",
            fontFamily: "'Jua', sans-serif",
            textAlign: "center",
            border: "3px solid #e67e22",
            borderRadius: "10px",
            backgroundColor: "#fff8f0",
            outline: "none",
            color: "#000",
            display: "none", // 처음엔 숨김
          });
          pwEl.addEventListener("input", () => {
            pwEl.value = pwEl.value.replace(/[^0-9]/g, "").substring(0, 4);
          });

          pwInput.setVisible(false);
          const updateToggle = (pub) => {
            isPublic = pub;
            publicBtnImg.setTint(pub ? 0x3498db : 0x7f8c8d);
            privateBtnImg.setTint(pub ? 0x7f8c8d : 0xe67e22);
            pwEl.style.display = pub ? "none" : "block";
            pwInput.setVisible(!pub);
            if (pub) pwEl.value = "";
          };

          publicBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateToggle(true);
          });
          publicBtnText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateToggle(true);
          });
          privateBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateToggle(false);
          });
          privateBtnText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateToggle(false);
          });

          const itemBtnImg = this.add
            .image(-btnGapX, itemToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x2ecc71)
            .setInteractive({ useHandCursor: true });
          const itemBtnText = this.add
            .text(-btnGapX, itemToggleY, "🎯 아이템전", {
              fontFamily: "Jua",
              fontSize: `${width * 0.03}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const noItemBtnImg = this.add
            .image(btnGapX, itemToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x7f8c8d)
            .setInteractive({ useHandCursor: true });
          const noItemBtnText = this.add
            .text(btnGapX, itemToggleY, "🚫 노템전", {
              fontFamily: "Jua",
              fontSize: `${width * 0.03}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const updateItemToggle = (useItemMode) => {
            isItemMode = useItemMode;
            itemBtnImg.setTint(useItemMode ? 0x2ecc71 : 0x7f8c8d);
            noItemBtnImg.setTint(useItemMode ? 0x7f8c8d : 0xe74c3c);
          };

          itemBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateItemToggle(true);
            this.showToast("게임에서 아이템을 사용할 수 있습니다", "#2ecc71");
          });
          itemBtnText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateItemToggle(true);
            this.showToast("게임에서 아이템을 사용할 수 있습니다", "#2ecc71");
          });
          noItemBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateItemToggle(false);
            this.showToast("게임에서 아이템을 사용할 수 없습니다", "#e74c3c");
          });
          noItemBtnText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateItemToggle(false);
            this.showToast("게임에서 아이템을 사용할 수 없습니다", "#e74c3c");
          });

          const timeBtnImg = this.add
            .image(-btnGapX, modeToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x7f8c8d)
            .setInteractive({ useHandCursor: true });
          const timeBtnText = this.add
            .text(-btnGapX, modeToggleY, "⏱️ 타임어택", {
              fontFamily: "Jua",
              fontSize: `${width * 0.03}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const allInBtnImg = this.add
            .image(btnGapX, modeToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x2ecc71)
            .setInteractive({ useHandCursor: true });
          const allInBtnText = this.add
            .text(btnGapX, modeToggleY, "🎴 올인", {
              fontFamily: "Jua",
              fontSize: `${width * 0.03}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const updateModeToggle = (useTimeAttack) => {
            isTimeAttack = useTimeAttack;
            timeBtnImg.setTint(useTimeAttack ? 0x3498db : 0x7f8c8d);
            allInBtnImg.setTint(useTimeAttack ? 0x7f8c8d : 0x2ecc71);
          };

          timeBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateModeToggle(true);
          });
          timeBtnText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateModeToggle(true);
          });
          allInBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateModeToggle(false);
          });
          allInBtnText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            updateModeToggle(false);
          });

          // 방 만들기 버튼
          const createBtnImg = this.add
            .image(0, createBtnY, "uibtn")
            .setDisplaySize(width * 0.25, height * 0.06)
            .setTint(0x2ecc71)
            .setInteractive({ useHandCursor: true });
          const createBtnText = this.add
            .text(0, createBtnY, "만들기", {
              fontFamily: "Jua",
              fontSize: `${width * 0.042}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          createBtnImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            this.tweens.add({
              targets: [createBtnImg, createBtnText],
              scaleX: "*=0.95",
              scaleY: "*=0.95",
              duration: 50,
              yoyo: true,
              onComplete: () => {
                const myNickname = localStorage.getItem("nickname") || "요리사";
                const roomName = nameEl.value.trim() || `${myNickname}의 방`;
                const password = isPublic ? null : pwEl.value.trim();

                if (!isPublic && (!password || password.length < 4)) {
                  this.showToast("비밀번호 4자리를 입력해주세요!", "#e74c3c");
                  return;
                }

                this.currentItemMode = isItemMode;

                this.showLoading("방 생성 중...");
                socket.emit("createRoom", {
                  nickname: myNickname,
                  avatarKey: this.getSelectedAvatarKey(),
                  maxPlayers: 4,
                  isPublic: isPublic,
                  itemMode: isItemMode,
                  gameMode: isTimeAttack ? "timeattack" : "allin",
                  roomName: roomName,
                  password: password,
                });
                closePopupWithCleanup();
              },
            });
          });

          container.add([
            roomNameInput,
            publicBtnImg,
            publicBtnText,
            privateBtnImg,
            privateBtnText,
            itemBtnImg,
            itemBtnText,
            noItemBtnImg,
            noItemBtnText,
            timeBtnImg,
            timeBtnText,
            allInBtnImg,
            allInBtnText,
            pwInput,
            createBtnImg,
            createBtnText,
          ]);
        };

        const showRoomCodeForm = (container) => {
          // DOM 요소는 절대 좌표 기준이므로 centerX를 직접 사용
          // 컨테이너 내부 좌표(0)가 아닌 화면 절대 X 좌표(centerX)로 배치
          const codeInput = this.add
            .dom(centerX * -0.375, contentY * -0.1, "input")
            .setDepth(1102);

          const el = codeInput.node;
          el.placeholder = "방 코드 입력";
          Object.assign(el.style, {
            width: `${width * 0.5}px`,
            height: "100px",
            fontSize: "60px",
            fontFamily: "'Jua', sans-serif",
            textAlign: "center",
            border: "3px solid #5d4037",
            borderRadius: "10px",
            backgroundColor: "#ffffff",
            outline: "none",
            color: "#000",
          });

          el.addEventListener("input", () => {
            el.value = el.value
              .replace(/[^a-zA-Z0-9]/g, "")
              .toUpperCase()
              .substring(0, 6);
          });

          // 입장 버튼 - uibtn 이미지 사용
          const joinBtnImg = this.add
            .image(0, height * 0.1, "uibtn")
            .setDisplaySize(width * 0.35, height * 0.065)
            .setInteractive({ useHandCursor: true });
          const joinBtnText = this.add
            .text(0, height * 0.1, "입장", {
              fontFamily: "Jua",
              fontSize: `${width * 0.045}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          joinBtnImg.on("pointerdown", () => {
            const code = el.value.trim();

            if (code) {
              this.sound.play("btn", { volume: 0.1 });
              this.tweens.add({
                targets: [joinBtnImg, joinBtnText],
                scaleX: "*=0.95",
                scaleY: "*=0.95",
                duration: 50,
                yoyo: true,
                onComplete: () => {
                  const myNickname =
                    localStorage.getItem("nickname") || "요리사";
                  this.showLoading("방 입장 중...");
                  socket.emit("joinRoom", {
                    roomId: code.toUpperCase(),
                    nickname: myNickname,
                    avatarKey: this.getSelectedAvatarKey(),
                  });
                  closePopupWithCleanup();
                },
              });
            } else {
              this.showToast("방 코드를 입력해주세요!");
            }
          });

          container.add([codeInput, joinBtnImg, joinBtnText]);
        };

        // 초기 콘텐츠 표시
        updateTabContent("browse");

        // ✅ closePopup 함수 정의 (먼저 선언해야 아래에서 참조 가능)
        const closePopup = () => {
          // 자동 새로고침 타이머 정리
          if (this._roomListRefreshTimer) {
            clearInterval(this._roomListRefreshTimer);
            this._roomListRefreshTimer = null;
          }
          // 소켓 이벤트 리스너 정리
          socket.off("publicRoomsUpdated");

          if (this.joinPopupContainer) {
            this.joinPopupContainer.destroy();
            this.joinPopupContainer = null;
          }
          this.isJoinPopupOpen = false;
        };

        const closePopupWithCleanup = () => {
          closePopup();
        };

        // 새로고침 실행 함수
        const doRefresh = () => {
          if (!this.joinPopupContainer) return;
          fetch(`${SERVER_URL}/api/rooms`)
            .then((res) => res.json())
            .then((freshRooms) => {
              if (!this.joinPopupContainer) return;
              rooms = freshRooms;
              if (currentTab === "browse") {
                updateTabContent("browse", freshRooms);
              }
            })
            .catch(() => {});
        };

        // 탭 버튼들의 onTabClick 재설정 - "방 찾기" 탭 클릭 시 새로고침 포함
        allTabs.forEach((tab) => {
          tab.img.removeAllListeners("pointerdown");
          tab.text.removeAllListeners("pointerdown");
          const onTabClick = () => {
            this.sound.play("btn", { volume: 0.1 });
            allTabs.forEach((t) => {
              t.img.setTint(t.name === tab.name ? activeTabTint : 0x7f8c8d);
            });
            currentTab = tab.name;
            updateTabContent(tab.name);
            // "방 찾기" 탭 클릭 시 자동 새로고침
            if (tab.name === "browse") {
              doRefresh();
            }
          };
          tab.img.on("pointerdown", onTabClick);
          tab.text.on("pointerdown", onTabClick);
        });

        // ✅ 소켓 이벤트: 다른 유저가 공개 방을 만들면 자동 갱신
        socket
          .off("publicRoomsUpdated")
          .on("publicRoomsUpdated", (freshRooms) => {
            if (!this.joinPopupContainer) return;
            rooms = freshRooms;
            if (currentTab === "browse") {
              updateTabContent("browse", freshRooms);
              //this.showToast("새로운 방이 생겼어요!", "#2ecc71");
            }
          });

        // ✅ 자동 새로고침: 15초마다 방 목록 갱신
        this._roomListRefreshTimer = setInterval(() => {
          if (!this.joinPopupContainer) {
            clearInterval(this._roomListRefreshTimer);
            this._roomListRefreshTimer = null;
            return;
          }
          if (currentTab === "browse") {
            doRefresh();
          }
        }, 15000);

        // 닫기 버튼 (상점 팝업과 동일한 위치/스타일)
        const closeBtn = this.add
          .image(centerX + width * 0.3, popupY - height * 0.2, "popupclose")
          .setDisplaySize(width * 0.11, width * 0.11)
          .setInteractive({ useHandCursor: true });

        closeBtn.on("pointerdown", () => {
          this.sound.play("btn", { volume: 0.08 });
          if (window.ReactNativeWebView) {
            generateHapticFeedback({ type: "impactLight" }).catch(() => {});
          }
          this.tweens.add({
            targets: closeBtn,
            scale: "*=0.95",
            duration: 100,
            yoyo: true,
            ease: "Quad.easeInOut",
            onComplete: () => {
              closePopupWithCleanup();
            },
          });
        });

        this.joinPopupContainer.add([closeBtn]);
      })
      .catch((err) => {
        console.error("공개 방 목록 요청 실패:", err);
        this.hideLoading();
        this.showToast("방 목록을 불러올 수 없습니다!");
        this.isJoinPopupOpen = false;
      });
  }

  showPasswordPopup(callback) {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    const pwPopupContainer = this.add.container(0, 0).setDepth(1200);

    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.6)
      .setInteractive();

    const popupBg = this.add
      .image(centerX, popupY, "btnbg")
      .setDisplaySize(width * 0.65, height * 0.22);

    const titleText = this.add
      .text(centerX, popupY - height * 0.1, "비밀번호를 입력하세요", {
        fontFamily: "Jua",
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const pwInput = this.add
      .dom(centerX * 0.72, popupY - height * 0.02, "input")
      .setDepth(1201);
    const pwEl = pwInput.node;
    pwEl.placeholder = "숫자 4자리";
    pwEl.type = "password";
    Object.assign(pwEl.style, {
      width: `${width * 0.4}px`,
      height: "70px",
      fontSize: "44px",
      fontFamily: "'Jua', sans-serif",
      textAlign: "center",
      border: "3px solid #e67e22",
      borderRadius: "10px",
      backgroundColor: "#fff8f0",
      outline: "none",
      color: "#000",
    });
    pwEl.addEventListener("input", () => {
      pwEl.value = pwEl.value.replace(/[^0-9]/g, "").substring(0, 4);
    });

    const btnGap = width * 0.17;
    const btnY = popupY + height * 0.08;

    const cancelBtnImg = this.add
      .image(centerX - btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.28, height * 0.06)
      .setTint(0xffaaaa)
      .setInteractive({ useHandCursor: true });
    const cancelBtnText = this.add
      .text(centerX - btnGap, btnY, "취소", {
        fontFamily: "Jua",
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const confirmBtnImg = this.add
      .image(centerX + btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.28, height * 0.06)
      .setInteractive({ useHandCursor: true });
    const confirmBtnText = this.add
      .text(centerX + btnGap, btnY, "입장", {
        fontFamily: "Jua",
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    pwPopupContainer.add([
      overlay,
      popupBg,
      titleText,
      cancelBtnImg,
      cancelBtnText,
      confirmBtnImg,
      confirmBtnText,
    ]);

    const closePwPopup = () => {
      pwPopupContainer.destroy();
      pwInput.destroy();
      this.isJoinPopupOpen = false;
      if (this.currentJoinPopupCloseHandler === closePwPopup) {
        this.currentJoinPopupCloseHandler = null;
      }
    };

    this.currentJoinPopupCloseHandler = closePwPopup;

    cancelBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      closePwPopup();
    });

    confirmBtnImg.on("pointerdown", () => {
      const pw = pwEl.value.trim();
      if (!pw || pw.length < 4) {
        this.showToast("비밀번호 4자리를 입력해주세요!", "#e74c3c");
        return;
      }
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [confirmBtnImg, confirmBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          closePwPopup();
          if (callback) callback(pw);
        },
      });
    });
  }

  cleanupPopup() {
    if (this.activePopupElements) {
      this.activePopupElements.forEach((el) => {
        if (el) {
          // DOM 요소인 경우 부모 노드에서 직접 제거 시도
          if (el.node && el.node.parentNode) {
            el.node.parentNode.removeChild(el.node);
          }
          el.destroy();
        }
      });
      this.activePopupElements = null;
    }
  }

  showNicknamePopup(callback) {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    // 1. 반투명 배경 (Overlay)
    // 컨테이너 밖에 두어야 배경 전체를 덮기 편합니다.
    const overlay = this.add
      .rectangle(centerX, height / 2, width, height, 0x000000, 0.5)
      .setDepth(100)
      .setInteractive();

    // 2. 팝업 컨테이너 생성 (모든 팝업 요소를 이 안에 담습니다)
    const popupContainer = this.add.container(centerX, popupY).setDepth(101);

    // 3. 팝업 배경 이미지 (컨테이너 내부 0, 0 위치) - 프로필 배경으로 교체
    const popupBg = this.add
      .image(0, 0, "profilebg")
      .setDisplaySize(width * 0.7, height * 0.35);

    // 4. 안내 텍스트 (위로 90px)
    const titleText = this.add
      .text(0, -150, "아이디를 입력하세요.\n(입력후 변경불가! 최대5글자)", {
        fontFamily: "Jua",
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // 5. Phaser DOM Input (중앙에서 약간 보정)
    const inputElement = this.add.dom(-200, -30, "input");
    const el = inputElement.node;
    el.placeholder = "닉네임 입력";
    Object.assign(el.style, {
      width: `${width * 0.5}px`,
      height: "85px",
      fontSize: "54px",
      fontFamily: "'Jua', sans-serif",
      textAlign: "center",
      border: "3px solid #5d4037",
      borderRadius: "10px",
      backgroundColor: "#ffffff",
      outline: "none",
      color: "#000",
    });

    el.addEventListener("input", () => {
      /*el.value = el.value
        .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/g, "")
        .substring(0, 5);*/
      if (el.value.length > 5) {
        el.value = el.value.substring(0, 5);
      }
    });

    // 6. 확인 버튼 묶음 (아래로 95px)
    const confirmBtnImg = this.add
      .image(0, 170, "uibtn")
      .setDisplaySize(width * 0.35, height * 0.065)
      .setInteractive({ useHandCursor: true });

    const confirmBtnText = this.add
      .text(0, 170, "확인", {
        fontFamily: "Jua",
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // 7. 컨테이너에 자식들 추가
    popupContainer.add([
      popupBg,
      titleText,
      inputElement,
      confirmBtnImg,
      confirmBtnText,
    ]);

    const closeNicknamePopup = () => {
      if (popupContainer && popupContainer.active) popupContainer.destroy();
      if (overlay && overlay.active) overlay.destroy();
      this.isJoinPopupOpen = false;
      if (this.currentJoinPopupCloseHandler === closeNicknamePopup) {
        this.currentJoinPopupCloseHandler = null;
      }
    };

    this.currentJoinPopupCloseHandler = closeNicknamePopup;

    // --- 이벤트 처리 ---
    confirmBtnImg.on("pointerdown", async () => {
      const inputNickname = el.value.trim();

      // 입력값이 비어있으면 에러 메시지 표시하고 리턴
      if (!inputNickname) {
        const errorMessage = "닉네임을 입력해주세요.";

        if (typeof this.addGameLog === "function") {
          this.addGameLog(errorMessage, "#e74c3c");
        } else if (typeof this.showToast === "function") {
          this.showToast(errorMessage, "#e74c3c");
        } else {
          console.log(errorMessage);
        }

        el.focus(); // 포커스 다시 주기
        return;
      }

      // 로딩 상태 표시
      confirmBtnText.setText("확인 중...");
      confirmBtnImg.removeInteractive();

      try {
        // 닉네임 중복 체크 API 호출
        const response = await fetch(`${SERVER_URL}/api/check-nickname`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ nickname: inputNickname }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 409) {
            // 중복된 닉네임인 경우 - 에러 메시지 표시하고 다시 입력 받기
            const errorMessage = `닉네임이 이미 사용 중입니다`;

            // 현재 씬에 따라 적절한 메시지 표시 함수 사용
            if (typeof this.addGameLog === "function") {
              this.addGameLog(errorMessage, "#e74c3c");
            } else if (typeof this.showToast === "function") {
              this.showToast(errorMessage, "#e74c3c");
            } else {
              console.log(errorMessage);
            }

            // 버튼 상태 복원하여 다시 입력할 수 있도록 함
            confirmBtnText.setText("확인");
            confirmBtnImg.setInteractive({ useHandCursor: true });
            el.focus(); // 포커스 다시 주기
            el.select(); // 기존 텍스트를 선택 상태로 만들어 쉽게 수정할 수 있도록 함
            return;
          } else {
            throw new Error(result.error || `HTTP ${response.status}`);
          }
        }

        // 중복되지 않은 경우 - 닉네임 사용 가능
        const finalNickname = result.nickname;

        // 닉네임을 localStorage에 저장
        try {
          localStorage.setItem("nickname", finalNickname);
        } catch (e) {
          console.warn("localStorage 저장 실패:", e);
        }

        closeNicknamePopup();

        if (callback) callback(finalNickname);
      } catch (error) {
        console.error("닉네임 체크 실패:", error);
        // 에러 발생 시 원본 닉네임 사용하고 localStorage에 저장
        try {
          localStorage.setItem("nickname", inputNickname);
        } catch (e) {
          console.warn("localStorage 저장 실패:", e);
        }

        const errorMessage =
          "닉네임 확인 중 오류가 발생했습니다. 입력된 닉네임을 사용합니다.";

        // 현재 씬에 따라 적절한 메시지 표시 함수 사용
        if (typeof this.addGameLog === "function") {
          this.addGameLog(errorMessage, "#e74c3c");
        } else if (typeof this.showToast === "function") {
          this.showToast(errorMessage, "#e74c3c");
        } else {
          console.log(errorMessage);
        }

        closeNicknamePopup();
        if (callback) callback(inputNickname);
      }
    });
  }

  showWaiting(
    roomId,
    players = [],
    isHost = false,
    maxPlayers = 4,
    roomName = "대기실",
    roomNumber = null,
  ) {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;

    // 1. 메인 화면 UI 파괴
    if (this.mainUIContainer) {
      this.mainUIContainer.destroy();
      this.mainUIContainer = null;
    }
    if (this.joinPopupContainer) {
      this.joinPopupContainer.destroy();
      this.joinPopupContainer = null;
    }
    if (this.joinInputElement) {
      this.joinInputElement.destroy();
      this.joinInputElement = null;
    }
    if (this.lobbyChatInputElement) {
      this.lobbyChatInputElement.destroy();
      this.lobbyChatInputElement = null;
    }

    // 기존 대기실 UI 제거
    if (this.lobbyUIContainer) {
      this.lobbyUIContainer.destroy();
    }
    this.lobbyUIContainer = this.add.container(0, 0).setDepth(100);

    // 배경
    const bg = this.add
      .image(centerX, height * 0.5, "gamebg")
      .setDisplaySize(width, height * 1.0)
      .setDepth(0);
    this.lobbyUIContainer.add(bg);

    const itemLabel = this.currentItemMode === false ? "노템전" : "아이템전";
    const modeLabel =
      this.currentGameMode === "timeattack" ? "타임어택" : "올인";
    const modePrefix = `(${itemLabel}) (${modeLabel}) `;
    const roomDisplayName = `${modePrefix}${roomName}`;
    const roomHeaderText =
      typeof roomNumber === "number"
        ? `${roomNumber}.${roomDisplayName}`
        : roomDisplayName;

    // 입장 코드 (방 제목 표시)
    const codeText = this.add
      .text(centerX, height * 0.075, roomHeaderText, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        fill: "#ffff00",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setDepth(10)
      .setOrigin(0.5);
    this.lobbyUIContainer.add(codeText);

    // 참가자 수
    /*const countText = this.add
      .text(
        centerX,
        height * 0.14,
        `참가자: ${players.length} / ${maxPlayers}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.045}px`,
          fill: "#ffffff",
        },
      )
      .setOrigin(0.5);
    this.lobbyUIContainer.add(countText);*/

    /* =======================================================
       플레이어 카드 UI (위 2명 / 아래 2명)
       슬롯 위치: [0]=왼쪽위, [1]=오른쪽위, [2]=왼쪽아래, [3]=오른쪽아래
    ======================================================= */
    const slotPositions = [
      { x: centerX - width * 0.18, y: height * 0.24 },
      { x: centerX + width * 0.18, y: height * 0.24 },
      { x: centerX - width * 0.18, y: height * 0.44 },
      { x: centerX + width * 0.18, y: height * 0.44 },
    ];

    const cardW = width * 0.3;
    const cardH = height * 0.18;
    const profileSize = width * 0.14;
    const levelSize = width * 0.07;
    const hasPlayerBgTexture = this.textures.exists("playerbg");

    // 빈 슬롯 4개 먼저 그리기
    for (let i = 0; i < 4; i++) {
      const pos = slotPositions[i];
      const cardLeft = pos.x - cardW / 2;
      const cardTop = pos.y - cardH / 2;
      let emptyCard;
      if (hasPlayerBgTexture) {
        emptyCard = this.add
          .image(pos.x, pos.y, "playerbg")
          .setDisplaySize(cardW, cardH)
          .setAlpha(1.0);
      } else {
        emptyCard = this.add.graphics();
        emptyCard.fillStyle(0x000000, 0.25);
        emptyCard.fillRoundedRect(cardLeft, cardTop, cardW, cardH, 20);
        emptyCard.lineStyle(2, 0xffffff, 0.2);
        emptyCard.strokeRoundedRect(cardLeft, cardTop, cardW, cardH, 20);
      }
      this.lobbyUIContainer.add(emptyCard);

      const emptyTxt = this.add
        .text(pos.x, pos.y, "대기 중...", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#ffffff",
        })
        .setOrigin(0.5);
      this.lobbyUIContainer.add(emptyTxt);

      const isEmptySlot = i >= players.length;
      const canAddAi = isHost && isEmptySlot && players.length < maxPlayers;
      if (canAddAi) {
        const aiBtnY = pos.y + cardH * 0.21;
        const aiBtn = this.add
          .image(pos.x, aiBtnY, "uibtn")
          .setDisplaySize(cardW * 0.55, height * 0.045)
          .setTint(0x3498db)
          .setInteractive({ useHandCursor: true });
        const aiBtnText = this.add
          .text(pos.x, aiBtnY, "AI추가", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.03}px`,
            color: "#ffffff",
            fontWeight: "bold",
          })
          .setOrigin(0.5);
        this.lobbyUIContainer.add([aiBtn, aiBtnText]);

        aiBtn.on("pointerdown", () => {
          if (this.aiAddPending) return;
          this.aiAddPending = true;
          this.sound.play("btn", { volume: 0.1 });
          this.tweens.add({
            targets: [aiBtn, aiBtnText],
            scaleX: "*=0.95",
            scaleY: "*=0.95",
            duration: 80,
            yoyo: true,
            ease: "Quad.easeInOut",
            onComplete: () => {
              socket.emit("addAiPlayer");
              this.time.delayedCall(400, () => {
                this.aiAddPending = false;
              });
            },
          });
        });
      }
    }

    // 플레이어 카드 그리기
    players.forEach((p, i) => {
      if (i >= 4) return;
      const pos = slotPositions[i];
      const cardLeft = pos.x - cardW / 2;
      const cardTop = pos.y - cardH / 2;
      const isThisPlayerHost = p.id === this.hostId;
      const isMe = p.id === socket.id;
      const isReady = isThisPlayerHost || p.isReady;

      // 카드 배경 (준비 상태에 따라 색상 변경)
      const borderColor = isReady ? 0x2ecc71 : isMe ? 0xf1c40f : 0x4a4a6a;
      let cardBg;
      if (hasPlayerBgTexture) {
        cardBg = this.add
          .image(pos.x, pos.y, "playerbg")
          .setDisplaySize(cardW, cardH)
          .setTint(borderColor)
          .setAlpha(1.0);
      } else {
        cardBg = this.add.graphics();
        const bgColor = isReady ? 0x1a4a1a : 0x1a1a2e;
        cardBg.fillStyle(bgColor, 0.9);
        cardBg.fillRoundedRect(cardLeft, cardTop, cardW, cardH, 20);
        cardBg.lineStyle(3, borderColor, 1);
        cardBg.strokeRoundedRect(cardLeft, cardTop, cardW, cardH, 20);
      }
      this.lobbyUIContainer.add(cardBg);

      // 프로필 이미지 - 애니메이션 적용
      const baseAvatarKey = /^player_[1-4]$/.test(p.avatarKey)
        ? p.avatarKey
        : `player_${i + 1}`;
      const avatarTextureKey = this.textures.exists(`${baseAvatarKey}_1`)
        ? `${baseAvatarKey}_1`
        : this.getAvatarDisplayKey(baseAvatarKey) || "player_1_frame_1";
      const profileX = cardLeft + profileSize * 1.1;

      const profileImg = this.add
        .sprite(profileX, pos.y - cardH * 0.0, avatarTextureKey)
        .setDisplaySize(profileSize * 2, profileSize * 2);
      this.lobbyUIContainer.add(profileImg);
      this.applyAvatarAnimation(profileImg, baseAvatarKey);

      if (isHost && !isThisPlayerHost) {
        profileImg.setInteractive({ useHandCursor: true });
        profileImg.on("pointerdown", () => {
          this.sound.play("btn", { volume: 0.1 });
          const kickBtnY = cardTop + cardH - height * 0.03;
          const kickBtn = this.add
            .rectangle(
              profileX,
              kickBtnY,
              profileSize * 1.8,
              height * 0.045,
              0xe74c3c,
              0.9,
            )
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(2, 0xffffff, 1)
            .setDepth(50);

          const kickBtnText = this.add
            .text(profileX, kickBtnY, "강퇴하기", {
              fontFamily: GAME_FONTS.main,
              fontSize: `${width * 0.035}px`,
              color: "#ffffff",
              fontWeight: "bold",
              stroke: "#000000",
              strokeThickness: 2,
            })
            .setOrigin(0.5)
            .setDepth(50);

          this.lobbyUIContainer.add([kickBtn, kickBtnText]);

          kickBtn.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            this.tweens.add({
              targets: [kickBtn, kickBtnText],
              scaleX: "*=0.95",
              scaleY: "*=0.95",
              duration: 80,
              yoyo: true,
              ease: "Quad.easeInOut",
              onComplete: () => {
                socket.emit("kickPlayer", { targetId: p.id });
                kickBtn.destroy();
                kickBtnText.destroy();
              },
            });
          });

          this.time.delayedCall(5000, () => {
            if (kickBtn && kickBtn.active) {
              kickBtn.destroy();
              kickBtnText.destroy();
            }
          });
        });
      }

      // 방장 왕관 표시 (박스 왼쪽 상단)
      if (isThisPlayerHost) {
        const crownTxt = this.add
          .text(cardLeft + width * 0.03, cardTop + height * 0.03, "👑", {
            fontSize: `${width * 0.08}px`,
          })
          .setOrigin(0.5);
        this.lobbyUIContainer.add(crownTxt);
      }

      // 닉네임 텍스트 (버튼 대신 텍스트로 표시, 준비 상태에 따라 색상 변경)
      let displayName = p.nickname;
      if (displayName.length > 6)
        displayName = displayName.substring(0, 6) + "..";

      const levelLabel = `Lv.${p.level || 1}`;
      displayName = `${levelLabel} ${displayName}`;

      // 준비 상태에 따라 색상 결정
      let nameColor = "#aaaaaa"; // 기본: 대기 중 (회색)
      if (isThisPlayerHost)
        nameColor = "#f1c40f"; // 방장: 노란색
      else if (isReady)
        nameColor = "#2ecc71"; // 준비 완료: 초록색
      else if (isMe) nameColor = "#ffffff"; // 나(대기): 흰색

      const nameTxt = this.add
        .text(pos.x, pos.y + cardH / 2 + height * 0.015, displayName, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.038}px`,
          color: nameColor,
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      this.lobbyUIContainer.add(nameTxt);
    });

    /* ======================
     대기실 채팅 UI
     ====================== */
    const chatAreaWidth = width * 0.75;
    const chatAreaHeight = height * 0.14;
    const chatAreaX = centerX;
    const chatAreaY = height * 0.64;

    const chatBg = this.add
      .image(chatAreaX, chatAreaY * 1.012, "chatbg")
      .setDisplaySize(chatAreaWidth, chatAreaHeight * 1.3)
      .setDepth(5);

    this.lobbyUIContainer.add(chatBg);

    this.lobbyChatLayout = {
      startX: chatAreaX - chatAreaWidth / 2 + width * 0.05,
      startY: chatAreaY - chatAreaHeight / 2 + height * 0.01,
      lineSpacing: chatAreaHeight / 5,
    };
    this.updateLobbyChatDisplay();

    const chatInputY = height * 0.74;
    const chatInputW = chatAreaWidth * 0.72;
    const chatInputH = height * 0.03;
    const chatSendW = chatAreaWidth * 0.2;
    const chatGap = chatAreaWidth * 0.04;

    const chatInputX = centerX - (chatSendW + chatGap) / 2;
    const chatSendX = centerX + (chatInputW + chatGap) / 2;

    this.lobbyChatInputElement = this.add
      .dom(chatInputX * 0.51, chatInputY * 1.01, "input")
      .setDepth(30)
      .setOrigin(0.5);

    const chatInputEl = this.lobbyChatInputElement.node;
    chatInputEl.placeholder = "메시지 입력";
    chatInputEl.maxLength = 20;
    Object.assign(chatInputEl.style, {
      width: `${chatInputW}px`,
      height: `${chatInputH}px`,
      fontSize: `${width * 0.03}px`,
      fontFamily: "'Jua', sans-serif",
      textAlign: "left",
      padding: "6px 10px",
      border: "2px solid #5d4037",
      borderRadius: "10px",
      backgroundColor: "#ffffff",
      outline: "none",
      color: "#000",
    });

    const sendBtnImg = this.add
      .image(chatSendX, chatInputY * 1.03, "uibtn")
      .setDisplaySize(chatSendW, chatInputH * 1.5)
      .setInteractive({ useHandCursor: true })
      .setTint(0x3498db)
      .setDepth(20);
    const sendBtnText = this.add
      .text(chatSendX, chatInputY * 1.03, "전송", {
        fontFamily: GAME_FONTS.main,
        color: "#fff",
        fontSize: `${width * 0.04}px`,
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.lobbyUIContainer.add([sendBtnImg, sendBtnText]);

    // 만약 초대(또는 기타 팝업)이 열려있다면 새로 생성된 입력창은 숨김 처리
    if (this.isJoinPopupOpen) {
      this.setLobbyChatInputHidden(true);
    }

    const sendLobbyChat = () => {
      const rawMessage = chatInputEl.value || "";
      const message = rawMessage.trim().slice(0, 20);
      if (!message) return;
      const now = Date.now();
      if (
        this.lobbyChatLastSent &&
        this.lobbyChatLastSent.message === message &&
        now - this.lobbyChatLastSent.time < 300
      ) {
        return;
      }
      this.lobbyChatLastSent = { message, time: now };
      socket.emit("lobbyChatMessage", { message });
      chatInputEl.value = "";
    };

    sendBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [sendBtnImg, sendBtnText],
        scale: "*=0.95",
        duration: 80,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => sendLobbyChat(),
      });
    });

    chatInputEl.addEventListener("keydown", (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        event.preventDefault();
        sendLobbyChat();
      }
    });

    /* ======================
     시작하기 / 준비하기 / 상점 / 초대하기 / 나가기 버튼
     ====================== */
    const mainBtnY = height * 0.83;
    const btnWidth = width * 0.18;
    const btnHeight = height * 0.065;
    const btnGap = width * 0.015;
    const totalWidth = btnWidth * 4 + btnGap * 3;
    const startX = centerX - totalWidth / 2;

    if (isHost) {
      // 방장: 시작하기 버튼 (첫 번째)
      const startBtnImg = this.add
        .image(startX + btnWidth / 2, mainBtnY, "uibtn")
        .setDisplaySize(btnWidth, btnHeight)
        .setTint(0xe67e22)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });
      const startBtnText = this.add
        .text(startX + btnWidth / 2, mainBtnY, "시작하기", {
          fontFamily: GAME_FONTS.main,
          color: "#fff",
          fontSize: `${width * 0.03}px`,
          fontWeight: "bold",
        })
        .setDepth(20)
        .setOrigin(0.5);
      this.lobbyUIContainer.add([startBtnImg, startBtnText]);

      startBtnImg.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: [startBtnImg, startBtnText],
          scale: "*=0.95",
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
          onComplete: () => {
            const currentCount = this.currentPlayers.length;
            if (currentCount <= 1) {
              this.showToast(
                "함께 할 유저가 필요합니다! (최소 2인)",
                "#e74c3c",
              );
            } else {
              // roomNumber가 없더라도 server-side에서는 socket 연결 기반으로
              // 방을 판단할 수 있으므로, currentRoomId가 있으면 시작 요청을 허용합니다.
              if (!this.currentRoomNumber && !this.currentRoomId) {
                this.showToast(
                  "방 정보가 없습니다. 다시 입장해주세요",
                  "#e74c3c",
                );
                return;
              }
              console.log("🚀 startGameRequest emit", {
                roomId: this.currentRoomNumber,
                myId: socket.id,
                players: (this.currentPlayers || []).map((p) => ({
                  id: p.id,
                  nickname: p.nickname,
                  isReady: !!p.isReady,
                })),
              });
              let ackArrived = false;
              socket.emit("startGameRequest", (ackPayload) => {
                ackArrived = true;
                console.log("🛰️ startGameRequest ack", ackPayload);
              });
              setTimeout(() => {
                if (!ackArrived) {
                  console.warn(
                    "⚠️ startGameRequest ack 미수신 (서버 미도달/구버전 서버 가능)",
                    {
                      serverUrl: SERVER_URL,
                      myId: socket.id,
                    },
                  );
                }
              }, 1200);
            }
          },
        });
      });
    } else {
      // 일반 유저: 준비하기 버튼 (첫 번째)
      const myReadyState =
        players.find((p) => p.id === socket.id)?.isReady || false;
      const readyBtnImg = this.add
        .image(startX + btnWidth / 2, mainBtnY, "uibtn")
        .setDisplaySize(btnWidth, btnHeight)
        .setTint(myReadyState ? 0x2ecc71 : 0x3498db)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });
      const readyBtnText = this.add
        .text(
          startX + btnWidth / 2,
          mainBtnY,
          myReadyState ? "준비중!" : "준비",
          {
            fontFamily: GAME_FONTS.main,
            color: "#fff",
            fontSize: `${width * 0.03}px`,
            fontWeight: "bold",
          },
        )
        .setDepth(20)
        .setOrigin(0.5);
      this.lobbyUIContainer.add([readyBtnImg, readyBtnText]);

      readyBtnImg.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: [readyBtnImg, readyBtnText],
          scale: "*=0.95",
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
          onComplete: () => {
            readyBtnImg.disableInteractive();
            socket.emit("toggleReady");
            this.time.delayedCall(300, () => {
              if (readyBtnImg && readyBtnImg.active) {
                readyBtnImg.setInteractive({ useHandCursor: true });
              }
            });
          },
        });
      });
    }

    // 상점 버튼 (두 번째)
    const shopBtnImg = this.add
      .image(startX + btnWidth + btnGap + btnWidth / 2, mainBtnY, "uibtn")
      .setDisplaySize(btnWidth, btnHeight)
      .setTint(0xffd700)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    const shopBtnText = this.add
      .text(startX + btnWidth + btnGap + btnWidth / 2, mainBtnY, "상점", {
        fontFamily: GAME_FONTS.main,
        color: "#fff",
        fontSize: `${width * 0.03}px`,
        fontWeight: "bold",
      })
      .setDepth(20)
      .setOrigin(0.5);
    this.lobbyUIContainer.add([shopBtnImg, shopBtnText]);

    shopBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [shopBtnImg, shopBtnText],
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.showShopPopup();
        },
      });
    });

    // 초대하기 버튼 (세 번째)
    const inviteBtnImg = this.add
      .image(startX + (btnWidth + btnGap) * 2 + btnWidth / 2, mainBtnY, "uibtn")
      .setDisplaySize(btnWidth, btnHeight)
      .setTint(0x9b59b6)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    const inviteBtnText = this.add
      .text(startX + (btnWidth + btnGap) * 2 + btnWidth / 2, mainBtnY, "초대", {
        fontFamily: GAME_FONTS.main,
        color: "#fff",
        fontSize: `${width * 0.03}px`,
        fontWeight: "bold",
      })
      .setDepth(20)
      .setOrigin(0.5);
    this.lobbyUIContainer.add([inviteBtnImg, inviteBtnText]);

    inviteBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [inviteBtnImg, inviteBtnText],
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          socket.emit("getOnlineUsers");
        },
      });
    });

    // 나가기 버튼 (네 번째)
    const exitBtnImg = this.add
      .image(startX + (btnWidth + btnGap) * 3 + btnWidth / 2, mainBtnY, "uibtn")
      .setDisplaySize(btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true })
      .setTint(0xe74c3c);
    const exitBtnText = this.add
      .text(
        startX + (btnWidth + btnGap) * 3 + btnWidth / 2,
        mainBtnY,
        "나가기",
        {
          fontFamily: GAME_FONTS.main,
          color: "#fff",
          fontSize: `${width * 0.03}px`,
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5);
    this.lobbyUIContainer.add([exitBtnImg, exitBtnText]);

    exitBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [exitBtnImg, exitBtnText],
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.leaveCurrentRoom();
        },
      });
    });
  }

  addLobbyChatMessage(message) {
    if (!this.lobbyChatMessages) this.lobbyChatMessages = [];
    if (!this.lobbyChatTexts) this.lobbyChatTexts = [];

    this.lobbyChatMessages.push(message);
    if (this.lobbyChatMessages.length > 5) {
      this.lobbyChatMessages.shift();
    }

    this.updateLobbyChatDisplay();
  }

  updateLobbyChatDisplay() {
    if (!this.lobbyChatLayout || !this.lobbyUIContainer) return;

    const { startX, startY, lineSpacing } = this.lobbyChatLayout;

    if (this.lobbyChatTexts && this.lobbyChatTexts.length > 0) {
      this.lobbyChatTexts.forEach((txt) => txt.destroy());
    }
    this.lobbyChatTexts = [];

    const messages = this.lobbyChatMessages || [];
    messages.forEach((message, index) => {
      const chatText = this.add
        .text(startX, startY + index * lineSpacing, message, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${this.cameras.main.width * 0.032}px`,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
          backgroundColor: "#00000044",
        })
        .setOrigin(0, 0)
        .setDepth(20);

      this.lobbyUIContainer.add(chatText);
      this.lobbyChatTexts.push(chatText);
    });
  }

  setLobbyChatInputHidden(hidden) {
    if (!this.lobbyChatInputElement || !this.lobbyChatInputElement.node) {
      return;
    }

    const inputEl = this.lobbyChatInputElement.node;
    inputEl.style.visibility = hidden ? "hidden" : "visible";
    inputEl.style.pointerEvents = hidden ? "none" : "auto";

    if (hidden && typeof inputEl.blur === "function") {
      inputEl.blur();
    }
  }

  showDailyRewardInfoPopup(message) {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.6)
      .setDepth(4000)
      .setInteractive();

    const popupBg = this.add
      .image(centerX, centerY, "profilebg")
      .setDepth(4001)
      .setDisplaySize(width * 0.78, height * 0.26);

    const msgText = this.add
      .text(centerX, centerY - 30, message, {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.04}px`,
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width * 0.62 },
      })
      .setOrigin(0.5)
      .setDepth(4002);

    const closePopup = () => {
      [overlay, popupBg, msgText, okBtn, okTxt].forEach((el) => {
        if (el) el.destroy();
      });
      this.isJoinPopupOpen = false;
      if (this.currentJoinPopupCloseHandler === closePopup) {
        this.currentJoinPopupCloseHandler = null;
      }
    };

    this.currentJoinPopupCloseHandler = closePopup;

    const okBtn = this.add
      .image(centerX, centerY + 55, "uibtn")
      .setDisplaySize(width * 0.32, height * 0.06)
      .setInteractive({ useHandCursor: true })
      .setDepth(4002)
      .setTint(0x22c55e);

    const okTxt = this.add
      .text(centerX, centerY + 55, "확인", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.04}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    okBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      closePopup();
    });
  }

  showWeeklyRewardPopup() {
    if (this.isWeeklyRewardPopupOpen) return;
    if (this.currentJoinPopupCloseHandler) {
      try {
        this.currentJoinPopupCloseHandler();
      } catch (e) {}
    }

    this.isWeeklyRewardPopupOpen = true;
    this.isJoinPopupOpen = true;
    if (this.dailyRewardBtnBg && this.dailyRewardBtnBg.input) {
      this.dailyRewardBtnBg.disableInteractive();
    }

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.6)
      .setDepth(4000)
      .setInteractive();

    const popupBg = this.add
      .image(centerX, centerY, "profilebg")
      .setDepth(4001)
      .setDisplaySize(width * 0.85, height * 0.75);

    const titleText = this.add
      .text(centerX, centerY - height * 0.3, "출석 보상", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4002);

    const closeBtn = this.add
      .image(centerX + width * 0.34, centerY - height * 0.31, "uibtn")
      .setDisplaySize(width * 0.1, height * 0.05)
      .setDepth(4002)
      .setTint(0xffaaaa)
      .setInteractive({ useHandCursor: true });

    const closeTxt = this.add
      .text(centerX + width * 0.34, centerY - height * 0.31, "닫기", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.03}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    const kstNow = this.getKstNow();
    const todayStr = this.dailyRewardTodayDate || this.formatDateYmd(kstNow);
    const lastCheckin = this.dailyRewardLastCheckinDate;
    const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];

    const dayOfWeek = kstNow.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const weekStart = new Date(kstNow);
    weekStart.setDate(kstNow.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const rows = [];
    const rowStartY = centerY - height * 0.22;
    const rowGap = height * 0.07;

    for (let i = 0; i < 7; i += 1) {
      const rowDate = new Date(weekStart);
      rowDate.setDate(weekStart.getDate() + i);
      const rowDateStr = this.formatDateYmd(rowDate);
      const isToday = rowDateStr === todayStr;
      const isClaimed = lastCheckin && rowDateStr === lastCheckin;
      const canClaim = isToday && this.dailyRewardAvailable;

      const rowY = rowStartY + rowGap * i;
      const rowBg = this.add
        .rectangle(centerX, rowY, width * 0.72, height * 0.055, 0x0f172a, 0.7)
        .setDepth(4002);

      const dayText = this.add
        .text(centerX - width * 0.28, rowY, dayLabels[i], {
          fontFamily:
            typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
          fontSize: `${width * 0.04}px`,
          color: isToday ? "#facc15" : "#ffffff",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4003);

      const amountText = this.add
        .text(centerX - width * 0.05, rowY, `+${this.dailyRewardAmount}`, {
          fontFamily:
            typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
          fontSize: `${width * 0.036}px`,
          color: "#22c55e",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4003);

      let statusText = "미수령";
      if (isClaimed) statusText = "받음";
      if (isToday && this.dailyRewardAvailable) statusText = "받기";

      const statusLabel = this.add
        .text(centerX + width * 0.2, rowY, statusText, {
          fontFamily:
            typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
          fontSize: `${width * 0.032}px`,
          color: canClaim ? "#ffffff" : "#cbd5f5",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4003);

      let claimBtn = null;
      let claimTxt = null;
      if (canClaim) {
        claimBtn = this.add
          .image(centerX + width * 0.27, rowY, "uibtn")
          .setDisplaySize(width * 0.18, height * 0.045)
          .setDepth(4003)
          .setTint(0x22c55e)
          .setInteractive({ useHandCursor: true });

        claimTxt = this.add
          .text(centerX + width * 0.27, rowY, "받기", {
            fontFamily:
              typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
            fontSize: `${width * 0.03}px`,
            color: "#ffffff",
            fontWeight: "bold",
          })
          .setOrigin(0.5)
          .setDepth(4004);

        claimBtn.on("pointerdown", () => {
          if (this.isDailyRewardClaimPending) return;
          this.sound.play("btn", { volume: 0.1 });
          this.isDailyRewardClaimPending = true;
          if (typeof this.updateDailyRewardButtonState === "function") {
            this.updateDailyRewardButtonState();
          }
          socket.emit("claimDailyReward");
          closePopup();
        });
      }

      rows.push(rowBg, dayText, amountText, statusLabel);
      if (claimBtn) rows.push(claimBtn);
      if (claimTxt) rows.push(claimTxt);
    }

    const helperText = this.add
      .text(centerX, centerY + height * 0.27, "매일 00:00 KST 갱신", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.028}px`,
        color: "#e2e8f0",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    const closePopup = () => {
      [
        overlay,
        popupBg,
        titleText,
        closeBtn,
        closeTxt,
        helperText,
        ...rows,
      ].forEach((el) => {
        if (el) el.destroy();
      });

      this.isWeeklyRewardPopupOpen = false;
      this.isJoinPopupOpen = false;
      this.disableDailyRewardBtnUntil = Date.now() + 300;
      if (this.currentJoinPopupCloseHandler === closePopup) {
        this.currentJoinPopupCloseHandler = null;
      }

      if (typeof this.updateDailyRewardButtonState === "function") {
        this.updateDailyRewardButtonState();
      }
    };

    this.currentJoinPopupCloseHandler = closePopup;

    overlay.on("pointerdown", () => {
      closePopup();
    });

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      closePopup();
    });

    closeTxt.setInteractive({ useHandCursor: true });
    closeTxt.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.08 });
      closePopup();
    });
  }

  showCustomAlert(message, onConfirm) {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.6)
      .setDepth(4000) // 쿠시 씬은 UI가 많으므로 뎁스를 더 높게 잡습니다.
      .setInteractive();

    // 2. 팝업 배경
    const popupBg = this.add
      .image(centerX, centerY, "profilebg")
      .setDepth(4001)
      .setDisplaySize(width * 0.75, height * 0.25);

    // 3. 메시지 텍스트
    const msgText = this.add
      .text(centerX, centerY - 40, message, {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width * 0.6 },
      })
      .setOrigin(0.5)
      .setDepth(4002);

    // 공통 제거 함수
    const closeAlert = () => {
      [
        overlay,
        popupBg,
        msgText,
        confirmBtn,
        confirmTxt,
        cancelBtn,
        cancelTxt,
      ].forEach((el) => {
        if (el) el.destroy();
      });

      this.isJoinPopupOpen = false;
      if (this.currentJoinPopupCloseHandler === closeAlert) {
        this.currentJoinPopupCloseHandler = null;
      }
    };

    this.currentJoinPopupCloseHandler = closeAlert;

    const btnY = centerY + 50;
    const btnGap = width * 0.18;

    // --- 취소 버튼 ---
    const cancelBtn = this.add
      .image(centerX - btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.3, height * 0.06)
      .setInteractive({ useHandCursor: true })
      .setDepth(4002)
      .setTint(0xffaaaa);

    const cancelTxt = this.add
      .text(centerX - btnGap, btnY, "취소", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    cancelBtn.on("pointerdown", () => {
      // 1. 효과음 재생
      this.sound.play("btn", { volume: 0.1 });

      // 2. 햅틱 피드백 (기존 코드 유지)
      if (window.ReactNativeWebView) {
        generateHapticFeedback({ type: "impactLight" }).catch(() => {});
      }

      // 3. 클릭 연출 (버튼과 텍스트 동시 적용)
      this.tweens.add({
        targets: [cancelBtn, cancelTxt],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // 4. 연출이 끝난 후 알림창 닫기
          closeAlert();
        },
      });
    });

    // --- 확인 버튼 ---
    const confirmBtn = this.add
      .image(centerX + btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.3, height * 0.06)
      .setInteractive({ useHandCursor: true })
      .setDepth(4002);

    const confirmTxt = this.add
      .text(centerX + btnGap, btnY, "확인", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    confirmBtn.on("pointerdown", () => {
      // 1. 효과음 재생
      this.sound.play("btn", { volume: 0.1 });

      // 2. 햅틱 피드백 (기본 코드 유지)
      if (window.ReactNativeWebView) {
        generateHapticFeedback({ type: "impactHeavy" }).catch(() => {});
      }

      // 3. 클릭 연출 (버튼과 텍스트 동시 적용)
      this.tweens.add({
        targets: [confirmBtn, confirmTxt],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // 4. 연출이 완전히 끝난 후 알림창을 닫고 다음 동작 실행
          closeAlert();
          if (onConfirm) onConfirm();
        },
      });
    });
  }

  showInvitePopup(users, roomName) {
    this.isJoinPopupOpen = true;

    const { width, height, centerX, centerY } = this.cameras.main;

    this.setLobbyChatInputHidden(true);

    // 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.5)
      .setDepth(4000)
      .setInteractive();

    // 팝업 배경 (invitebg 이미지)
    const popupWidth = width * 0.85;
    const popupHeight = height * 0.55;
    const popupBg = this.add
      .image(centerX, centerY, "invitebg")
      .setDisplaySize(popupWidth, popupHeight)
      .setDepth(4001);

    // 타이틀
    const titleText = this.add
      .text(centerX, centerY - popupHeight / 2 + height * 0.05, "", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffd700",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4002);

    // 서브텍스트
    /*const subText = this.add
      .text(
        centerX,
        centerY - popupHeight / 2 + height * 0.1,
        `방: ${roomName}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#aaa",
          fontWeight: "normal",
        },
      )
      .setOrigin(0.5)
      .setDepth(4002);*/

    // 모든 객체 저장 배열
    const allObjects = [overlay, popupBg, titleText];

    // 삭제 함수 (한 번만 실행)
    let isDestroyed = false;
    const destroyPopup = () => {
      if (isDestroyed) return;
      isDestroyed = true;

      this.setLobbyChatInputHidden(false);

      allObjects.forEach((obj) => {
        if (obj && obj.active) obj.destroy();
      });

      this.isJoinPopupOpen = false;
      if (this.currentJoinPopupCloseHandler === destroyPopup) {
        this.currentJoinPopupCloseHandler = null;
      }
    };

    this.currentJoinPopupCloseHandler = destroyPopup;

    overlay.setInteractive();
    overlay.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      destroyPopup();
    });

    // 유저 리스트 컨테이너
    const listContainerY = centerY;
    const listH = height * 0.35;

    if (!Array.isArray(users) || users.length === 0) {
      const emptyText = this.add
        .text(
          centerX,
          centerY + height * 0.02,
          "초대가능한 플레이어가 없습니다",
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.04}px`,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5)
        .setDepth(4002);

      allObjects.push(emptyText);
    }

    users.forEach((user, index) => {
      const btnY =
        listContainerY - listH / 2 + (index + 1) * (listH / (users.length + 1));
      const userIconX = centerX - popupWidth * 0.28;
      const userTextX = centerX - popupWidth * 0.05;
      const inviteBtnX = centerX + popupWidth * 0.25;

      // 유저 배경 (roombg 이미지)
      const userBg = this.add
        .image(centerX, btnY, "roombg")
        .setDisplaySize(popupWidth * 0.8, height * 0.083)
        .setDepth(4001)
        .setInteractive({ useHandCursor: true });

      // 유저 아이콘
      const baseUserAvatar = /^player_[1-4]$/.test(user.avatarKey)
        ? user.avatarKey
        : "player_1";

      const userIcon = this.add
        .image(
          userIconX,
          btnY,
          this.textures.exists(`${baseUserAvatar}_1`)
            ? `${baseUserAvatar}_1`
            : this.getAvatarDisplayKey(baseUserAvatar) || "player_1_frame_1",
        )
        .setDisplaySize(height * 0.045, height * 0.045)
        .setDepth(4002);

      // 유저명 + 레벨 (한 줄)
      const userInfo = this.add
        .text(userTextX, btnY, `Lv.${user.level} ${user.nickname}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.032}px`,
          color: "#fff",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4002);

      // 초대 버튼 (uibtn 이미지)
      const inviteBtn = this.add
        .image(inviteBtnX, btnY, "uibtn")
        .setDisplaySize(width * 0.12, height * 0.05)
        .setTint(0x3498db)
        .setDepth(4001)
        .setInteractive({ useHandCursor: true });

      const inviteBtnText = this.add
        .text(inviteBtnX, btnY, "초대", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#fff",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(4002);

      inviteBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: [inviteBtn, inviteBtnText],
          scaleX: "*=0.9",
          scaleY: "*=0.9",
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
          onComplete: () => {
            socket.emit("inviteUser", { targetId: user.id });
            this.showToast(`${user.nickname}님을 초대했습니다!`, "#3498db");
          },
        });
      });

      allObjects.push(userBg, userIcon, userInfo, inviteBtn, inviteBtnText);
    });

    // 닫기 버튼 (popupclose 이미지)
    const closeBtn = this.add
      .image(
        centerX + popupWidth / 2 - width * 0.06,
        centerY - popupHeight / 2 + height * 0.03,
        "popupclose",
      )
      .setDisplaySize(width * 0.085, width * 0.085)
      .setDepth(4002)
      .setInteractive({ useHandCursor: true });

    allObjects.push(closeBtn);

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      destroyPopup();
    });
  }

  showInviteReceivePopup(inviteData) {
    this.isJoinPopupOpen = true;

    const { width, height, centerX, centerY } = this.cameras.main;

    this.setLobbyChatInputHidden(true);

    // 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.5)
      .setDepth(4000)
      .setInteractive();

    // 팝업 배경 (popupbg 이미지)
    const popupWidth = width * 0.75;
    const popupHeight = height * 0.3;
    const popupBg = this.add
      .image(centerX, centerY, "profilebg")
      .setDisplaySize(popupWidth, popupHeight)
      .setDepth(4001);

    // 모든 객체 저장 배열
    const allObjects = [overlay, popupBg];

    // 삭제 함수 (한 번만 실행)
    let isDestroyed = false;
    const destroyPopup = () => {
      if (isDestroyed) return;
      isDestroyed = true;

      this.setLobbyChatInputHidden(false);

      allObjects.forEach((obj) => {
        if (obj && obj.active) obj.destroy();
      });

      this.isJoinPopupOpen = false;
      if (this.currentJoinPopupCloseHandler === destroyPopup) {
        this.currentJoinPopupCloseHandler = null;
      }
    };

    this.currentJoinPopupCloseHandler = destroyPopup;

    overlay.setInteractive();
    overlay.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      destroyPopup();
    });

    // 타이틀
    /*const titleText = this.add
      .text(
        centerX,
        centerY - popupHeight / 2 + height * 0.04,
        "초대 받았습니다!",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#3498db",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(4002);*/

    // 초대 정보
    //        `${inviteData.inviterNickname}님이 초대했어요\n${inviteData.roomName}`,

    const infoText = this.add
      .text(
        centerX,
        centerY - height * 0.02,
        `${inviteData.inviterNickname}님이 초대했어요`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#fff",
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setDepth(4002);

    /*const playerCountText = this.add
      .text(
        centerX,
        centerY + height * 0.08,
        `플레이어: ${inviteData.currentPlayers}/${inviteData.maxPlayers}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#aaa",
        },
      )
      .setOrigin(0.5)
      .setDepth(4002);*/

    // 수락 버튼 (uibtn 이미지)
    const acceptBtn = this.add
      .image(centerX - width * 0.15, centerY * 1.12, "uibtn")
      .setDisplaySize(width * 0.2, height * 0.06)
      .setTint(0x2ecc71)
      .setDepth(4001)
      .setInteractive({ useHandCursor: true });

    const acceptBtnText = this.add
      .text(centerX - width * 0.15, centerY * 1.12, "수락", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#fff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4002);

    // 거절 버튼 (uibtn 이미지)
    const declineBtn = this.add
      .image(centerX + width * 0.15, centerY * 1.12, "uibtn")
      .setDisplaySize(width * 0.2, height * 0.06)
      .setTint(0xe74c3c)
      .setDepth(4001)
      .setInteractive({ useHandCursor: true });

    const declineBtnText = this.add
      .text(centerX + width * 0.15, centerY * 1.12, "거절", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#fff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4002);

    allObjects.push(
      infoText,
      // playerCountText,
      acceptBtn,
      acceptBtnText,
      declineBtn,
      declineBtnText,
    );

    // 자동 닫기 (15초)
    let autoCloseTimer = this.time.delayedCall(15000, () => {
      destroyPopup();
    });

    // 중복 클릭 방지 플래그
    let acceptClicked = false;
    acceptBtn.on("pointerdown", () => {
      if (acceptClicked) return;
      acceptClicked = true;

      // 즉시 비활성화하여 추가 클릭을 막음
      try {
        acceptBtn.disableInteractive();
        acceptBtn.setTint(0x999999);
      } catch (e) {}

      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [acceptBtn, acceptBtnText],
        scaleX: "*=0.9",
        scaleY: "*=0.9",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          socket.emit("acceptInvite", { roomId: inviteData.roomId });
          this.showToast("초대를 수락했습니다!", "#2ecc71");
          if (autoCloseTimer) autoCloseTimer.remove();
          destroyPopup();
        },
      });
    });

    declineBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [declineBtn, declineBtnText],
        scaleX: "*=0.9",
        scaleY: "*=0.9",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.showToast("초대를 거절했습니다!", "#e74c3c");
          if (autoCloseTimer) autoCloseTimer.remove();
          destroyPopup();
        },
      });
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    // allow win-avatar animation by default (textures should now exist)
    this.skipWinAvatarAnim = false;
    this.profileStats = {
      level: 1,
      coins: 0,
      experience: 0,
    };
  }

  // helper methods for avatar keys and sprite sheets (also copied to LobbyScene)
  getAvatarAnimKey(baseKey) {
    return `avatar_anim_${baseKey}`;
  }

  getAvatarAnimFrameRate(baseKey) {
    return baseKey === "player_1" || baseKey === "player_2" ? 18 : 2;
  }

  getAvatarAnimMaxFrame(baseKey) {
    return baseKey === "player_1" ? 4 : 2; // player_2 handled dynamically
  }

  // pick a display key for a base avatar; returns null if none found
  getAvatarDisplayKey(baseKey) {
    if (this.textures.exists(`${baseKey}_1`)) return `${baseKey}_1`;
    if (baseKey === "player_1") {
      if (this.textures.exists("player_1_frame_1")) return "player_1_frame_1";
    }
    const sheetKey = `${baseKey}_sprite_a`;
    if (this.textures.exists(sheetKey)) return sheetKey;
    return null;
  }
  safeSyncInventory(reason, extra = {}) {
    try {
      if (typeof this.syncInventoryToServer === "function") {
        this.syncInventoryToServer(reason, extra);
        return;
      }
      if (typeof syncInventoryToServer === "function") {
        try {
          syncInventoryToServer(reason, extra);
          return;
        } catch (e) {}
      }
      if (
        typeof window !== "undefined" &&
        typeof window.syncInventoryToServer === "function"
      ) {
        try {
          window.syncInventoryToServer(reason, extra);
          return;
        } catch (e) {}
      }
      console.warn(
        "safeSyncInventory: no syncInventoryToServer available",
        reason,
        extra,
      );
    } catch (e) {
      console.warn("safeSyncInventory error", e);
    }
  }

  // avatar animation helpers copied from LobbyScene
  ensureAvatarAnimation(baseKey) {
    // sometimes called with `this` bound to a sprite; normalize to scene
    let scene = this;
    if (scene && scene.scene) {
      scene = scene.scene; // whatever owns the sprite
    }
    // if scene still lacks helper, fall back to original this
    if (!scene || typeof scene.getAvatarAnimKey !== "function") {
      scene = this;
    }
    /*console.log(
      "[ensureAvatarAnimation] scene=",
      scene,
      "this=",
      this,
      "constructor=",
      this && this.constructor && this.constructor.name,
    );*/
    const animKey = scene.getAvatarAnimKey(baseKey);
    //console.log("[ensureAvatarAnimation] request", baseKey, animKey);
    if (scene.anims.exists(animKey)) {
      //console.log("[ensureAvatarAnimation] already exists");
      return animKey;
    }

    try {
      if (baseKey === "player_1") {
        if (this.textures.exists("player_1_frame_1")) {
          const frames = [];
          let idx = 1;
          while (true) {
            const textureKey = `player_1_frame_${idx}`;
            if (this.textures.exists(textureKey)) {
              frames.push({ key: textureKey });
              idx += 1;
              continue;
            }
            break;
          }

          if (frames.length > 0) {
            this.anims.create({
              key: animKey,
              frames,
              frameRate: this.getAvatarAnimFrameRate(baseKey),
              repeat: -1,
            });
            return animKey;
          }
        }

        // player_1 uses frame-based assets; no sprite sheet fallback
      }

      if (baseKey === "player_2") {
        if (this.textures.exists("player_2_frame_1")) {
          const frames = [];
          let idx = 1;
          while (true) {
            const textureKey = `player_2_frame_${idx}`;
            if (this.textures.exists(textureKey)) {
              frames.push({ key: textureKey });
              idx += 1;
              continue;
            }
            break;
          }

          if (frames.length > 0) {
            this.anims.create({
              key: animKey,
              frames,
              frameRate: this.getAvatarAnimFrameRate(baseKey),
              repeat: -1,
            });
            return animKey;
          }
        }

        // fallback to legacy split sheet frames
        const frames = [];
        let idx = 1;
        while (true) {
          const textureKey = `player_2_${idx}`;
          if (this.textures.exists(textureKey)) {
            frames.push({ key: textureKey });
            idx += 1;
            continue;
          }
          break;
        }
        if (frames.length > 0) {
          this.anims.create({
            key: animKey,
            frames,
            frameRate: this.getAvatarAnimFrameRate(baseKey),
            repeat: -1,
          });
          return animKey;
        }
      }

      const maxFrame = this.getAvatarAnimMaxFrame(baseKey);
      const frames = [];
      for (let frame = 1; frame <= maxFrame; frame += 1) {
        const textureKey = `${baseKey}_${frame}`;
        if (this.textures.exists(textureKey)) {
          frames.push({ key: textureKey });
        }
      }

      if (frames.length === 0) {
        return null;
      }

      this.anims.create({
        key: animKey,
        frames,
        frameRate: this.getAvatarAnimFrameRate(baseKey),
        repeat: -1,
      });

      return animKey;
    } catch (err) {
      //console.error("[ensureAvatarAnimation] error", err);
      return null;
    }
  }

  applyAvatarAnimation(target, baseKey) {
    // ensure we operate on the scene rather than whatever `this` may be
    const scene = target && target.scene ? target.scene : this;
    /*console.log(
      "[applyAvatarAnimation] scene=",
      scene,
      "this=",
      this,
      "baseKey=",
      baseKey,
      "target=",
      target,
    );*/
    if (!scene || !scene.add) {
      // console.warn("[applyAvatarAnimation] invalid scene, abort");
      return;
    }
    if (!target || !target.active) {
      // console.log("[applyAvatarAnimation] target inactive, abort");
      return;
    }

    if (typeof target.getData === "function") {
      if (target.getData("avatarDisplayWidth") === undefined) {
        target.setData("avatarDisplayWidth", target.displayWidth);
      }
      if (target.getData("avatarDisplayHeight") === undefined) {
        target.setData("avatarDisplayHeight", target.displayHeight);
      }
    }

    const avatarDisplayWidth =
      typeof target.getData === "function"
        ? target.getData("avatarDisplayWidth")
        : target.displayWidth;
    const avatarDisplayHeight =
      typeof target.getData === "function"
        ? target.getData("avatarDisplayHeight")
        : target.displayHeight;

    if (
      typeof target.getData === "function" &&
      target.getData("avatarBaseY") === undefined
    ) {
      target.setData("avatarBaseY", target.y);
    }

    const avatarBaseY =
      typeof target.getData === "function"
        ? target.getData("avatarBaseY")
        : target.y;

    const animKey = this.ensureAvatarAnimation(baseKey);

    // treat player1 and player2 similarly: anchor bottom so varying frame heights
    if (baseKey === "player_1" || baseKey === "player_2") {
      target.setOrigin(0.5, 1);
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
      target.y = avatarBaseY + target.displayHeight * 0.5;
      // set initial texture for player1 or player2
      const firstFrameKey =
        baseKey === "player_1" && this.textures.exists("player_1_frame_1")
          ? "player_1_frame_1"
          : `${baseKey}_1`;
      if (this.textures.exists(firstFrameKey)) {
        target.setTexture(firstFrameKey);
      }
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
      if (animKey) {
        // start the looping animation and keep a reference so we can
        // restart it if Phaser accidentally pauses it (scene sleep,
        // visibility change, external stop call, etc).  this addresses
        // intermittent freezes reported by players.
        const playAnim = () => {
          if (target && target.anims && animKey) {
            target.play(animKey, true);
          }
        };
        playAnim();

        // when animation is paused for any reason, immediately resume
        target.on("animationpause", () => {
          // only restart if sprite still active
          if (target && target.active) {
            playAnim();
          }
        });
        // if the scene is suspended/woken (e.g. visibility change), replay
        if (scene && scene.events && typeof scene.events.on === "function") {
          scene.events.on("resume", () => {
            if (target && target.active) {
              playAnim();
            }
          });
        }

        const fixedBottomY = avatarBaseY + avatarDisplayHeight * 0.5;
        target.on("animationupdate", () => {
          if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
            target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
          }
          target.y = fixedBottomY;
        });
        if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
          target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
        }
        target.y = fixedBottomY;
      }
      return;
    }

    // all other baseKeys (player3/4 etc) fall back to centered origin
    target.setOrigin(0.5, 0.5);
    target.y = avatarBaseY;

    const firstFrameKey = `${baseKey}_1`;

    if (this.textures.exists(firstFrameKey)) {
      target.setTexture(firstFrameKey);
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
    }

    if (animKey) {
      target.play(animKey, true);
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
    }
  }
  init(data) {
    this.roundData = {
      players: data.players || [],
      hostId: data.hostId || null,
      roomId: data.roomId,
      roomName: data.roomName || "대기실",
      maxPlayers: data.maxPlayers || data.max || 4,
      turnIndex: 0,
      isGameStarted: false,
      aiDifficulty: data.aiDifficulty || "normal",
      itemMode: data.itemMode !== false,
      gameMode: data.gameMode || "allin",
      timeAttackEndsAt: data.timeAttackEndsAt || null,
    };

    this.isTutorialMode = !!data.isTutorialMode;
    this.tutorialConfig = data.tutorialConfig || null;

    // 콤보 상태: 같은 플레이어가 연속 정답을 맞출 때 카운트
    this.comboState = {
      lastWinnerId: null,
      count: 0,
      lastTime: 0,
    };

    // 서버가 scene.start로 넘긴 경우에도 nextTurnId를 보관
    this.latestNextTurnId = data.nextTurnId || null;
    if (this.latestNextTurnId && Array.isArray(this.roundData.players)) {
      const idx = this.roundData.players.findIndex(
        (p) => p && p.id === this.latestNextTurnId,
      );
      if (idx >= 0) this.turnIndex = idx;
      else this.turnIndex = 0;
    } else {
      this.turnIndex = 0;
    }

    this.isSingle = !!data.isSingle;
    this.isGameReady = false;
    this.resultContainer = null;

    this.myTurnTimer = null;

    // 할리갈리 전용 데이터
    this.myCards = []; // 내 덱
    this.openCards = {}; // 각 플레이어별 바닥에 오픈된 카드 { playerId: card }
    // 블록(가림) 상태: 여러 먹물 사용이 중첩될 수 있으므로 개별 효과 목록으로 관리
    this.blockActive = false;
    this.blockBy = null; // 마지막으로 사용한 플레이어(선택사항)
    this.blockEffects = []; // [{ id, issuer, remainingTurns }]
    this.tutorialState = null;
    this.questState = null;
    this.timeAttackText = null;
    this.timeAttackTimer = null;
    this.timeAttackUrgentTween = null;
  }

  async create() {
    // GameScene의 init 혹은 create 상단에 추가
    if (this.resultContainer) {
      this.resultContainer.destroy();
      this.resultContainer = null;
    }

    if (this.events && typeof this.events.once === "function") {
      this.events.once("shutdown", () => {
        this.teardownQuestUI();
        if (this.timeAttackTimer) {
          this.timeAttackTimer.remove();
          this.timeAttackTimer = null;
        }
        if (this.timeAttackUrgentTween) {
          this.timeAttackUrgentTween.stop();
          this.timeAttackUrgentTween = null;
        }
        this.timeAttackText = null;
      });
    }

    // 특수카드 사용(턴당 1회) 추적 초기화
    this.specialUsedThisTurn = {}; // { playerId: true }

    // make sure player2 frames are prepared early
    ensurePlayer2Frames(this);

    this.timeAttackTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.updateTimeAttackDisplay();
      },
    });

    const difficultyMultipliers = {
      easy: 1.35,
      normal: 0.9,
      hard: 1.05,
    };
    const aiMultiplier =
      difficultyMultipliers[this.roundData.aiDifficulty] || 1;
    const isHardMode = this.roundData.aiDifficulty === "hard";
    const hardReactionScaleById = {
      AI_1: 0.18,
      AI_2: 0.22,
      AI_3: 0.3,
    };

    const baseAiSettings = [
      {
        id: "AI_1",
        nickname: "초보",
        reactionTime: 2400,
        flipDelay: 1500,
      },
      {
        id: "AI_2",
        nickname: "중급",
        reactionTime: 1800,
        flipDelay: 1250,
      },
      {
        id: "AI_3",
        nickname: "천재",
        reactionTime: 1200,
        flipDelay: 1000,
      },
    ];

    this.aiSettings = baseAiSettings.map((ai) => {
      const hardReactionScale = hardReactionScaleById[ai.id] || 0.4;
      const reactionScale = isHardMode
        ? aiMultiplier * hardReactionScale
        : aiMultiplier;
      const flipScale = aiMultiplier;
      return {
        ...ai,
        reactionTime: Math.max(
          120,
          Math.round(ai.reactionTime * reactionScale),
        ),
        flipDelay: Math.max(250, Math.round(ai.flipDelay * flipScale)),
      };
    });

    if (this.isSingle) {
      // 싱글플레이면 소켓 ID가 아닌 "PLAYER_ME" 혹은 players[0].id를 내 ID로 강제 지정
      this.myId = this.roundData.players[0].id;
      this.turnIndex = 0; // 내 차례부터 시작
      this.isGameStarted = true;
      this.lastEliminationEffectAtByPlayer = {};
      this.initializeSingleDecks();
      this.initQuestSystem();
    } else {
      this.myId = socket.id;
      this.teardownQuestUI();
    }

    this.isPopupOpen = false;
    this.currentJoinPopupCloseHandler = null;
    this.currentGamePopupCloseHandler = null;

    if (!this.roundData) {
      this.roundData = { players: [], hostId: null };
    }

    bgmEnabled = localStorage.getItem("bgmEnabled") !== "false";

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 배경 설정
    this.add
      .image(centerX, height / 2, "gamebg")
      .setDisplaySize(width, height)
      .setDepth(-1)
      .setAlpha(0.9);

    // 플레이어/카드들을 담을 그룹
    this.playerTableGroup = this.add.container(0, 0).setDepth(100);

    // 연출 실행
    this.playOpeningAnimation();
    this.time.delayedCall(800, () => {
      this.showReadyGo();
    });

    // ============================================
    // 1. 공통 소켓 리스너 (방 관리)
    // ============================================
    socket.off("playerJoined").on("playerJoined", (data) => {
      const lastPlayer = Array.isArray(data.players)
        ? data.players[data.players.length - 1]
        : null;
      const candidateNickname =
        typeof data.newPlayerNickname === "string" &&
        data.newPlayerNickname.trim()
          ? data.newPlayerNickname.trim()
          : lastPlayer && typeof lastPlayer.nickname === "string"
            ? lastPlayer.nickname
            : "";

      if (candidateNickname && !data.isRejoin) {
        this.sound.play("pop", { volume: 0.2 });
        this.showToast(`${candidateNickname}님이 입장했습니다!`, "#2ecc71");
      }

      this.roundData.players = data.players;
      this.renderTable(data.players);
    });

    socket.off("playerLeft").on("playerLeft", (data) => {
      this.sound.play("btn", { volume: 0.2 });
      this.showToast(`${data.leftPlayerNickname}님이 나갔습니다.`, "#e74c3c");
      this.roundData.players = data.players;
      this.renderTable(data.players);
    });

    socket.off("hostChanged").on("hostChanged", (data) => {
      this.roundData.hostId = data.hostId;
      this.sound.play("pass", { volume: 0.1 });
      this.showToast(data.message || "방장이 변경되었습니다.", "#f1c40f");
      if (this.resultContainer) this.showResultOverlay(data.players, true);
    });

    socket.off("readyStatusUpdated").on("readyStatusUpdated", (data) => {
      this.roundData.players = data.players;
      this.roundData.hostId = data.hostId;

      if (this.resultContainer && this.resultContainer.active) {
        // 💡 수정: 세 번째 인자로 data를 통째로 넘겨줍니다.
        this.showResultOverlay(data.players, true, data);
      }
    });

    socket.off("myProfile").on("myProfile", (profile) => {
      const prevStats = this.profileStats || {
        level: 1,
        coins: 0,
        experience: 0,
      };
      const prevLevel = Number(prevStats.level) || 1;
      const incomingLevel = Number(profile?.level);
      const incomingCoins = Number(profile?.coins);
      const incomingExperience = Number(profile?.experience);

      const newLevel = Number.isFinite(incomingLevel)
        ? incomingLevel
        : prevLevel;
      const safeCoins = Number.isFinite(incomingCoins)
        ? incomingCoins
        : Number(prevStats.coins) || 0;
      const safeExperience = Number.isFinite(incomingExperience)
        ? incomingExperience
        : Number(prevStats.experience) || 0;

      this.profileStats = {
        level: newLevel,
        coins: safeCoins,
        experience: safeExperience,
      };

      if (newLevel > prevLevel) {
        this.showToast(`레벨 업! Lv.${prevLevel} → Lv.${newLevel}`, "#2ecc71");
      }
      // 서버가 보낸 특수카드 정보가 있으면 로컬에 반영하고 UI 갱신
      try {
        if (
          profile &&
          profile.specialCards &&
          typeof profile.specialCards === "object"
        ) {
          localStorage.setItem(
            "specialCards",
            JSON.stringify(profile.specialCards),
          );
          if (this.roundData && Array.isArray(this.roundData.players)) {
            this.renderTable(this.roundData.players);
          }
        }
      } catch (e) {
        console.warn("failed to apply specialCards from myProfile", e);
      }
    });

    socket.on("startBlocked", (msg) => {
      this.showToast(msg, "#e74c3c");
    });

    // ============================================
    // 2. 할리갈리 전용 소켓 리스너
    // ============================================
    socket.off("gameStart").on("gameStart", (data) => {
      console.log("Gamestart");

      this.resultGameoverPlayed = false;

      // 1. 결과창이 떠 있다면 위로 치우며 제거
      if (this.resultContainer) {
        this.tweens.add({
          targets: this.resultContainer,
          y: -height,
          duration: 500,
          ease: "Back.easeIn",
          onComplete: () => {
            this.resultContainer.destroy();
            this.resultContainer = null;
          },
        });
      }

      // 2. [추가] 게임 상태 및 모드 동기화
      this.isSingle = false; // 멀티플레이임을 명시
      this.isGameStarted = true;
      this.isGameReady = true;
      this.lastEliminationEffectAtByPlayer = {};
      const initialTurnIndex = Array.isArray(data.players)
        ? data.players.findIndex((p) => p.id === data.nextTurnId)
        : -1;
      this.turnIndex = initialTurnIndex >= 0 ? initialTurnIndex : 0;
      // 2. 💡 먼저 서버에서 온 players 데이터를 즉시 반영합니다.
      console.log("📊 게임시작 players 데이터:", data.players); // 디버그용
      console.log("📌 gameStart debug:", {
        nextTurnId: data.nextTurnId,
        initialTurnIndex,
        computedTurnIndex: this.turnIndex,
        mySocketId: socket.id,
        playersIds: Array.isArray(data.players)
          ? data.players.map((p) => p.id)
          : [],
      });
      // 서버가 보낸 nextTurnId를 보관(다른 장소에서 참조 가능하도록)
      this.latestNextTurnId = data.nextTurnId;
      this.roundData.players = data.players.map((p) => {
        // 서버에서 p.myDeck이 올 때 그 길이를 cards로 강제 할당
        const initialCards = p.cards ?? (p.myDeck ? p.myDeck.length : 0);

        return {
          ...p,
          cards: initialCards, // 여기서 숫자가 0이 되지 않도록 보장
          openStack: [], // 💡 추가
          openCard: null,
          isEliminated: false, // 시작 시 탈락 상태 초기화
        };
      });

      this.roundData.hostId = data.hostId; // 방장 정보 동기화
      if (typeof data.itemMode === "boolean") {
        this.roundData.itemMode = data.itemMode;
      }
      if (typeof data.gameMode === "string") {
        this.roundData.gameMode = data.gameMode;
      }
      if (typeof data.timeAttackEndsAt === "number") {
        this.roundData.timeAttackEndsAt = data.timeAttackEndsAt;
      }
      this.roundData.isGameStarted = true;
      this.isGameReady = true;

      // 게임 시작 시 모든 플레이어의 특수 사용 플래그 초기화
      this.specialUsedThisTurn = {};

      // 3. 연출 시작: 클릭 금지 후 애니메이션 및 Ready-Go 예약
      this.canClick = false; // 💡 시작 직후엔 클릭 금지
      this.playOpeningAnimation();

      this.time.delayedCall(800, () => {
        this.showReadyGo();

        // 💡 Ready-Go(약 1.2초)가 완전히 끝난 뒤에 클릭 허용
        this.time.delayedCall(2000, () => {
          const myId = this.isSingle ? this.myId : socket.id;
          const currentTurnId = this.roundData?.players?.[this.turnIndex]?.id;
          // 우선 서버가 보낸 nextTurnId를 신뢰하도록 폴백을 추가
          this.canClick = currentTurnId === myId || data.nextTurnId === myId;
          console.log("🎮 이제 카드를 제출할 수 있습니다.", {
            myId,
            currentTurnId,
            nextTurnIdFromServer: data.nextTurnId,
            turnIndex: this.turnIndex,
            players: this.roundData?.players?.map((p) => p.id),
            canClick: this.canClick,
          });
        });
      });

      this.roundData.hostId = data.hostId; // 방장 정보 동기화

      // 연출 시작 시점에 맞춰 테이블 갱신
      this.renderTable(this.roundData.players);
    });

    // gameStart 리스너 근처에 추가하세요.
    socket.off("turnChanged").on("turnChanged", (data) => {
      const nextIdx = this.roundData.players.findIndex(
        (p) => p.id === data.nextTurnId,
      );

      if (nextIdx !== -1) {
        this.turnIndex = nextIdx;
        const isMyTurnNow =
          data.nextTurnId === (this.isSingle ? this.myId : socket.id);

        // 💡 내 차례가 왔을 때 띵! 소리나 진동(모바일) 주기
        if (isMyTurnNow) {
          this.canClick = true;

          // 모바일이라면 진동 추가 (브라우저 지원 시)
          if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
          }
        } else {
          this.canClick = false;
          this.clearMyTurnTimer();
        }

        // 해당 턴이 시작될 때 그 플레이어의 특수카드 사용 플래그 리셋
        try {
          this.specialUsedThisTurn = this.specialUsedThisTurn || {};
          this.specialUsedThisTurn[data.nextTurnId] = false;
        } catch (e) {
          this.specialUsedThisTurn = {};
        }

        this.renderTable(this.roundData.players);
      }
    });

    socket.off("cardFlipped").on("cardFlipped", (data) => {
      if (this.isSingle) return;

      // (block removal happens after we update openStack below)

      try {
        const cardType = data?.card?.type;
        const cardLabel = cardType
          ? `type=${cardType}`
          : data?.card && Number.isFinite(Number(data.card.fruit))
            ? `fruit=${data.card.fruit} count=${data.card.count}`
            : "unknown";
      } catch (e) {}

      if (data?.card?.type === THUNDER_CARD_TYPE) {
        console.log("⚡ [client] THUNDER cardFlipped:", {
          playerId: data.playerId,
          nextTurnId: data.nextTurnId,
          remainingCount: data.remainingCount,
        });
      }

      // 1. 데이터 갱신
      const player = this.roundData.players.find((p) => p.id === data.playerId);
      const wasEliminated = Boolean(player && player.isEliminated);
      if (player) {
        if (data.openCardStack) {
          player.openStack = data.openCardStack;
        } else {
          if (!player.openStack) player.openStack = [];
          // 애니메이션 전에는 아직 넣지 않습니다 (playCardFlipAnimation 내부에서 처리)
        }
        if (data?.card?.type === THUNDER_CARD_TYPE) {
          player.openCard = data.card;
        }
        player.cards = data.remainingCount ?? player.cards;

        // 💡 탈락 상태 업데이트
        if (typeof data.isEliminated === "boolean") {
          player.isEliminated = data.isEliminated;
          if (player.isEliminated && !wasEliminated) {
            this.maybePlayEliminationEffect(player.id);
          }
        }
      }

      this.showSpecialCardToast(data?.card, data?.playerId);

      if (data?.card?.type === COIN_CARD_TYPE) {
        const reward = Number(data.coinReward) || COIN_CARD_REWARD;
        this.playCoinCardRewardAnimation(data.playerId, reward);
        if (data.playerId === socket.id) {
          if (Number.isFinite(Number(data.coinTotal))) {
            this.profileStats = this.profileStats || {};
            this.profileStats.coins = Number(data.coinTotal);
          }
        }
      }

      // 서버가 알려준 만료된 블록 이펙트를 기준으로 클라이언트 상태를 정리합니다.
      try {
        const expiredIds = Array.isArray(data.expiredBlockEffectIds)
          ? new Set(data.expiredBlockEffectIds)
          : null;
        if (expiredIds && expiredIds.size > 0) {
          this.roundData.players.forEach((p) => {
            if (!p || !Array.isArray(p.openStack)) return;
            p.openStack = p.openStack.filter(
              (c) =>
                !(c && c.type === "blockcard" && expiredIds.has(c.effectId)),
            );
          });

          if (Array.isArray(this.blockEffects)) {
            this.blockEffects = this.blockEffects.filter(
              (e) => !expiredIds.has(e.id),
            );
          }

          this.blockActive =
            Array.isArray(this.blockEffects) && this.blockEffects.length > 0;
          this.blockBy = this.blockActive
            ? this.blockEffects[this.blockEffects.length - 1].issuer
            : null;
        }
      } catch (e) {}

      // 3. 애니메이션 및 테이블 갱신
      this.playCardFlipAnimation(data);
    });

    socket.off("bellResult").on("bellResult", (data) => {
      if (this.myTurnTimer) {
        this.myTurnTimer.remove();
        this.myTurnTimer = null;
      }

      const ringerId = data?.success ? data.winnerId : data?.penaltyId;
      if (!this.isSingle && ringerId && ringerId !== socket.id) {
        if (this.cache.audio.exists("bell")) {
          this.sound.play("bell", { volume: 0.2 });
        }
      }

      this.playFeedback(data.success, data.message);

      // 💡 [수정] prevPlayers를 깊은 복사로 만들어 openStack이 유지되도록 함
      // (서버가 이미 openCardStack을 비운 상태로 보내므로)
      const prevPlayers = this.roundData.players.map((p) => ({
        ...p,
        openStack: p.openStack ? [...p.openStack] : [],
      }));

      const updatedPlayers = data.players.map((serverPlayer) => {
        const localPlayer = this.roundData.players.find(
          (p) => p.id === serverPlayer.id,
        );
        return {
          ...serverPlayer,
          cards:
            serverPlayer.cards ??
            (serverPlayer.myDeck ? serverPlayer.myDeck.length : 0),
          openStack: [], // 서버에서 이미 비워졌으므로 빈 배열로 설정
        };
      });

      this.triggerEliminationEffects(this.roundData.players, updatedPlayers);

      if (data.success) {
        const message = `${data.winnerNickname} ${data.collectedCount}장 획득(${data.reactionTime}초)`;
        this.addGameLog(`${message}`, "#f1c40f");

        // 💡 [추가] 승리 애니메이션 호출 (renderTable은 애니메이션 끝난 후 함수 내부에서 실행됨)
        this.playWinAnimation({
          winnerId: data.winnerId, // 서버에서 승자 ID를 보내준다고 가정
          players: updatedPlayers,
          prevPlayers: prevPlayers, // 바닥 카드가 남아있는 이전 상태 전달
        });

        this.addGameLog(
          `${data.winnerNickname}님 획득! (${data.reactionTime}초)`,
          "#f1c40f",
        );
        // winner case - just update players immediately
        this.roundData.players = updatedPlayers;
        /*this.time.delayedCall(500, () => {
          this.renderTable(this.roundData.players);
        });*/
      } else {
        // 실패 시 콤보 초기화
        if (this.comboState) {
          this.comboState.count = 0;
          this.comboState.lastWinnerId = null;
        }

        // 서버가 자물쇠 자동 사용으로 패널티를 면제했을 때 처리
        if (data.autoLockUsedBy) {
          try {
            const nick = this.getNicknameById(data.autoLockUsedBy);
            this.showToast(
              `${nick}님이 자물쇠로 패널티를 면제했습니다!`,
              "#2ecc71",
            );
            // animation will arrive via specialUsed event shortly

            // 서버가 보낸 플레이어 목록으로 갱신
            if (Array.isArray(data.players) && data.players.length > 0) {
              // 💡 Preserve any open stacks the client already had, since server
              // may send players with emptied stacks. Similar to later lock
              // handling logic.
              this.roundData.players.forEach((oldPlayer) => {
                const newPlayer = updatedPlayers.find(
                  (p) => p.id === oldPlayer.id,
                );
                if (newPlayer) {
                  const preservedOpenStack = oldPlayer.openStack;
                  Object.assign(oldPlayer, newPlayer);
                  oldPlayer.openStack = preservedOpenStack;
                }
              });
              this.renderTable(this.roundData.players);
            }
          } catch (e) {
            console.warn("autoLock handling error", e);
          }
          return;
        }

        // 자동 사용: 패널티 대상이 로컬 플레이어이고 자물쇠(lock, id=4)를 보유한 경우
        const myIdCheck = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
        // 싱글플레이에서는 패널티시 아이템 자동 사용 금지
        if (this.isSingle) {
          this.playPenaltyAnimation({
            penaltyId: data.penaltyId,
            recipients: data.recipients,
            players: updatedPlayers,
          });
          return;
        }
        if (data.penaltyId === myIdCheck) {
          try {
            const owned =
              JSON.parse(localStorage.getItem("specialCards")) || {};
            const lockCount = Number(owned[4] || 0);
            if (lockCount > 0) {
              // 멀티플레이: 서버에 사용 요청을 보낸 뒤 응답(또는 타임아웃)을 기다림
              if (!this.isSingle && socket && socket.connected) {
                let handled = false;
                const timeout = this.time.delayedCall(1200, () => {
                  if (handled) return;
                  handled = true;
                  // 타임아웃 시 패널티 처리 계속
                  this.playPenaltyAnimation({
                    penaltyId: data.penaltyId,
                    recipients: data.recipients,
                    players: updatedPlayers,
                  });
                });

                // 요청 송신 (서버는 콜백으로 수락/거부 응답해야 함)
                socket.emit(
                  "requestUseSpecial",
                  {
                    cardId: 4,
                    reason: "auto_lock_penalty",
                    penaltyId: data.penaltyId,
                  },
                  (res) => {
                    if (handled) return;
                    handled = true;
                    timeout.remove(false);

                    // 서버가 사용을 허용한 경우
                    if (res && res.success) {
                      // 서버가 갱신한 보유 아이템 정보이 있으면 적용
                      if (res.updatedSpecialCards) {
                        localStorage.setItem(
                          "specialCards",
                          JSON.stringify(res.updatedSpecialCards),
                        );
                      } else {
                        // 로컬에서도 차감
                        owned[4] = lockCount - 1;
                        if (owned[4] <= 0) delete owned[4];
                        localStorage.setItem(
                          "specialCards",
                          JSON.stringify(owned),
                        );
                      }

                      // 서버가 플레이어 상태를 함께 보냈으면 적용
                      if (res.players && Array.isArray(res.players)) {
                        // 보존해야 할 openStack 유지
                        this.roundData.players.forEach((oldPlayer) => {
                          const newPlayer = res.players.find(
                            (p) => p.id === oldPlayer.id,
                          );
                          if (newPlayer) {
                            const preservedOpenStack = oldPlayer.openStack;
                            Object.assign(oldPlayer, newPlayer);
                            oldPlayer.openStack = preservedOpenStack;
                          }
                        });
                        this.renderTable(this.roundData.players);
                      } else {
                        // 단순히 UI 갱신
                        this.renderTable(this.roundData.players);
                      }

                      // 인벤토리 동기화 트리거
                      this.safeSyncInventory("autoUseLock", {
                        usedCardId: 4,
                      });
                      this.showToast(
                        "자물쇠 사용: 패널티 면제되었습니다!",
                        "#2ecc71",
                      );
                      return;
                    }

                    this.playPenaltyAnimation({
                      penaltyId: data.penaltyId,
                      recipients: data.recipients,
                      players: updatedPlayers,
                    });
                  },
                );
                return;
              }

              // 오프라인 또는 소켓 미연결일 경우 기존 동작: 로컬 소모하고 패널티 면제
              owned[4] = lockCount - 1;
              if (owned[4] <= 0) delete owned[4];
              localStorage.setItem("specialCards", JSON.stringify(owned));
              this.safeSyncInventory("autoUseLock", { usedCardId: 4 });
              this.showToast(
                "자물쇠 사용: 패널티 면제되었습니다! (오프라인 처리)",
                "#2ecc71",
              );
              if (this.roundData && this.roundData.players)
                this.renderTable(this.roundData.players);
              return;
            }
          } catch (e) {
            console.warn("auto-lock parse error", e);
          }
        }

        // 2. 💡 패널티 애니메이션 호출 시 '이미 업데이트된' 데이터를 직접 넘김
        this.playPenaltyAnimation({
          penaltyId: data.penaltyId,
          recipients: data.recipients,
          players: updatedPlayers, // 👈 중요!
        });

        // 💡 [수정] roundData 업데이트는 playPenaltyAnimation 내부에서 처리됨
        // this.roundData.players = updatedPlayers; (제거 - 바닥 카드 보존을 위해)
      }
    });

    socket.off("specialUsed").on("specialUsed", (data) => {
      console.log("[client specialUsed] received:", data);
      try {
        if (!data) return;
        try {
          this.specialUsedThisTurn = this.specialUsedThisTurn || {};
          if (data.by) this.specialUsedThisTurn[data.by] = true;
        } catch (e) {}

        // 중앙 방패 애니메이션 제거; 대신 각 플레이어 위치에서 개별 효과를 표시함
        // (먹물에는 방패 효과가 없으므로 cardId 6은 무시)
        if (
          Number(data.cardId) !== 6 &&
          Array.isArray(data.shielded) &&
          data.shielded.length > 0
        ) {
          data.shielded.forEach((id) => this.showShieldEffect(id));
        }
        // lock 카드(페널티 면제)도 바로 애니메이션
        if (Number(data.cardId) === 4 && data.by) {
          this.showLockEffect(data.by);
        }
        // (추가적으로 각 카드 특정 애니메이션 끝난 뒤에도 showShieldEffect를 호출함)

        // 도둑 카드 사용 연출: 서버가 보낸 recipients(fromIds)와 by(id)를 사용해 애니메이션 재생
        if (
          Number(data.cardId) === 7 &&
          data.by &&
          Array.isArray(data.recipients) &&
          data.recipients.length > 0
        ) {
          let prevPlayers;
          const pendingSnapshot = this.pendingThiefSnapshot;
          const snapshotFresh =
            pendingSnapshot &&
            pendingSnapshot.by === data.by &&
            (typeof pendingSnapshot.createdAt !== "number" ||
              Date.now() - pendingSnapshot.createdAt < 10000);

          if (snapshotFresh && Array.isArray(pendingSnapshot.players)) {
            prevPlayers = pendingSnapshot.players.map((p) => ({
              ...p,
              openStack: p.openStack ? [...p.openStack] : [],
            }));
            this.pendingThiefSnapshot = null;
          } else {
            prevPlayers = this.roundData.players.map((p) => ({
              ...p,
              openStack: p.openStack ? [...p.openStack] : [],
            }));
          }

          const basePlayers = prevPlayers.map((p) => ({ ...p }));
          const thiefResult = this.buildThiefPlayerSnapshot(
            basePlayers,
            data.by,
            data.recipients,
          );
          const updatedPlayers =
            Array.isArray(data.players) && data.players.length > 0
              ? data.players
              : thiefResult.players;

          this.playThiefAnimation({
            byId: data.by,
            fromIds: data.recipients,
            players: prevPlayers,
            onComplete: () => {
              try {
                if (
                  Array.isArray(updatedPlayers) &&
                  updatedPlayers.length > 0
                ) {
                  this.roundData.players.forEach((oldPlayer) => {
                    const updated = updatedPlayers.find(
                      (p) => p.id === oldPlayer.id,
                    );
                    if (updated) {
                      const preservedOpenStack = oldPlayer.openStack;
                      Object.assign(oldPlayer, updated);
                      oldPlayer.openStack = preservedOpenStack;
                    }
                  });
                  this.updateEliminationStatus();
                  this.renderTable(this.roundData.players);
                }

                const beforeThief = prevPlayers.find((p) => p.id === data.by);
                const afterThief = Array.isArray(updatedPlayers)
                  ? updatedPlayers.find((p) => p.id === data.by)
                  : null;
                const computedStolen =
                  beforeThief && afterThief
                    ? Math.max(
                        0,
                        (Number(afterThief.cards) || 0) -
                          (Number(beforeThief.cards) || 0),
                      )
                    : 0;
                const usingServerPlayers =
                  Array.isArray(data.players) && data.players.length > 0;
                const stolenCount = usingServerPlayers
                  ? computedStolen
                  : typeof thiefResult?.stolenCount === "number"
                    ? thiefResult.stolenCount
                    : computedStolen;
                const toastColor = stolenCount > 0 ? "#2ecc71" : "#f39c12";
                const toastMsg =
                  stolenCount > 0
                    ? `도둑 카드 사용: 총 ${stolenCount}장을 훔쳤습니다!`
                    : "도둑 카드 사용: 획득할 카드가 없습니다.";
                this.showToast(toastMsg, toastColor);
                if (Array.isArray(data.shielded) && data.shielded.length > 0) {
                  data.shielded.forEach((id) => this.showShieldEffect(id));
                }
                if (data.message) this.showToast(data.message, "#2ecc71");
              } catch (e) {
                console.warn("specialUsed merge error", e);
              }
            },
          });
          return;
        }

        // 왕 카드 사용 연출: 서버가 보낸 대상(target) 또는 recipients[0]를 사용
        if (Number(data.cardId) === 8 && data.by) {
          console.log("[client specialUsed] king branch, data:", data);
          const targetId =
            data.target ||
            (Array.isArray(data.recipients) && data.recipients.length > 0
              ? data.recipients[0]
              : null);
          if (targetId) {
            const prevPlayers = this.roundData.players.map((p) => ({
              ...p,
              openStack: p.openStack ? [...p.openStack] : [],
            }));

            this.playKingSwapAnimation({
              byId: data.by,
              targetId,
              players: prevPlayers,
              onComplete: () => {
                try {
                  if (Array.isArray(data.players) && data.players.length > 0) {
                    this.roundData.players.forEach((oldPlayer) => {
                      const newPlayer = data.players.find(
                        (p) => p.id === oldPlayer.id,
                      );
                      if (newPlayer) {
                        const preservedOpenStack = oldPlayer.openStack;
                        Object.assign(oldPlayer, newPlayer);
                        oldPlayer.openStack = preservedOpenStack;
                      }
                    });
                    this.renderTable(this.roundData.players);
                    if (
                      Array.isArray(data.shielded) &&
                      data.shielded.length > 0
                    ) {
                      try {
                        this.showToast(
                          `방패 소모: ${data.shielded.join(",")}`,
                          "#f1c40f",
                        );
                      } catch (e) {}
                      data.shielded.forEach((id) => this.showShieldEffect(id));
                    }
                  }
                  if (data.message) this.showToast(data.message, "#2ecc71");
                } catch (e) {
                  console.warn("specialUsed merge error", e);
                }
              },
            });
            return;
          }
        }

        // 6번 카드: 블록(가림) 카드 처리
        if (Number(data.cardId) === 6 && data.by) {
          console.log("[client specialUsed] block branch, data:", data);
          try {
            // 서버가 보낸 플레이어 상태가 있으면 병합합니다.
            // 서버는 openCardStack에 blockcard를 추가해 보낼 수 있으므로,
            // 가능하면 서버의 openCardStack을 클라이언트 openStack에 즉시 반영합니다.
            if (Array.isArray(data.players) && data.players.length > 0) {
              this.roundData.players.forEach((oldPlayer) => {
                const newPlayer = data.players.find(
                  (p) => p.id === oldPlayer.id,
                );
                if (newPlayer) {
                  const preservedOpenStack = oldPlayer.openStack || [];
                  Object.assign(oldPlayer, newPlayer);
                  if (Array.isArray(newPlayer.openCardStack)) {
                    oldPlayer.openStack = [...newPlayer.openCardStack];
                  } else {
                    oldPlayer.openStack = preservedOpenStack;
                  }
                }
              });
            }

            // 서버가 전달한 effectId가 있으면 등록(클라이언트가 중복으로 openStack을 변경하지 않도록 함)
            if (data.effectId) {
              console.log(
                "[client specialUsed] registering effectId:",
                data.effectId,
              );
              this.blockEffects = this.blockEffects || [];
              this.blockEffects.push({
                id: data.effectId,
                issuer: data.by,
                remainingTurns:
                  typeof data.remainingTurns === "number"
                    ? data.remainingTurns
                    : 2,
                shielded: Array.isArray(data.shielded) ? data.shielded : [],
              });
            }

            this.blockActive = true;
            this.blockBy = data.by;

            this.renderTable(this.roundData.players);
            if (Array.isArray(data.shielded) && data.shielded.length > 0) {
              console.log(
                "[debug] specialUsed (block) shielded ids:",
                data.shielded,
              );
              try {
                this.showToast(
                  `방패 소모: ${data.shielded.join(",")}`,
                  "#f1c40f",
                );
              } catch (e) {}
              data.shielded.forEach((id) => this.showShieldEffect(id));
            }
            if (data.message) this.showToast(data.message, "#f39c12");
          } catch (e) {
            console.warn("specialUsed block merge error", e);
          }
          return;
        }

        // 기본 처리: 즉시 병합
        if (Array.isArray(data.players) && data.players.length > 0) {
          this.roundData.players.forEach((oldPlayer) => {
            const newPlayer = data.players.find((p) => p.id === oldPlayer.id);
            if (newPlayer) {
              const preservedOpenStack = oldPlayer.openStack;
              Object.assign(oldPlayer, newPlayer);
              oldPlayer.openStack = preservedOpenStack;
            }
          });
          this.renderTable(this.roundData.players);
        }
        if (data.message) this.showToast(data.message, "#2ecc71");
      } catch (e) {
        console.warn("specialUsed handler error", e);
      }
    });

    socket.off("specialPlay").on("specialPlay", (data) => {
      try {
        if (!data) return;
        const imageKey =
          data.imageKey ||
          (data.cardId
            ? data.cardId === 6
              ? "block"
              : data.cardId === 7
                ? "thief"
                : data.cardId === 8
                  ? "king"
                  : "block"
            : "block");
        const title = data.title || "특수카드 사용";
        const subtitle = data.subtitle || "특수 효과가 실행됩니다.";
        this.playSpecialAnimation({
          imageKey,
          title,
          subtitle,
          onComplete: () => {},
        });
      } catch (e) {
        console.warn("specialPlay handler error", e);
      }
    });

    socket.off("gameEnded").on("gameEnded", (data) => {
      // 💡 즉시 띄우지 않고 1~1.5초 정도 여유를 줌
      this.time.delayedCall(1000, () => {
        this.playFinishAnimation(() => {
          this.showResultOverlay(data.ranking, false, data);
        });
      });
    });

    // 💡 실시간 플레이어 상태 업데이트 (탈락 표시)
    socket.off("updatePlayerStatus").on("updatePlayerStatus", (data) => {
      if (this.isSingle || !data.players) return;

      data.players.forEach((serverPlayer) => {
        const localPlayer = this.roundData.players.find(
          (p) => p.id === serverPlayer.id,
        );
        if (localPlayer) {
          if (
            !localPlayer.isEliminated &&
            typeof serverPlayer.isEliminated === "boolean" &&
            serverPlayer.isEliminated
          ) {
            console.log("[updatePlayerStatus] eliminated", {
              playerId: serverPlayer.id,
              cards: serverPlayer.cards,
            });
          }
          localPlayer.isEliminated = serverPlayer.isEliminated;
          localPlayer.cards = serverPlayer.cards;
        }
      });

      // UI 즉시 반영
      this.renderTable(this.roundData.players);
    });

    // ============================================
    // 3. UI 및 버튼 배치
    // ============================================

    // [대체함] 할리갈리용 버튼 배치
    this.createHaliGaliButtons(height);

    const moveToLobby = () => {
      if (typeof this.currentGamePopupCloseHandler === "function") {
        this.currentGamePopupCloseHandler();
        return;
      }

      this.showCustomAlert("로비로 이동합니다!", () => {
        this.returnToLobby({ rejoinRoom: false, leaveRoom: true });
      });
    };

    // 홈 버튼 (나가기)
    const exitBtn = this.add
      .image(width * 0.13, height * 0.077, "home")
      .setDisplaySize(width * 0.07, width * 0.07)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);

    exitBtn.on("pointerdown", moveToLobby);

    try {
      this.backHandler = await App.addListener("backButton", () => {
        moveToLobby();
      });
    } catch (error) {
      console.warn("게임 씬 백버튼 리스너 등록 실패", error);
    }

    // 초기 테이블 렌더링
    this.renderTable(this.roundData.players);

    if (this.isTutorialMode) {
      this.activateTutorialGuide();
    }

    // 셧다운 시 리스너 해제
    this.events.once("shutdown", () => {
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("hostChanged");
      socket.off("readyStatusUpdated");
      socket.off("gameStart");
      socket.off("cardFlipped");
      socket.off("bellResult");
      socket.off("gameEnded");
      socket.off("startBlocked");
      socket.off("myProfile");
      if (this.backHandler && typeof this.backHandler.remove === "function") {
        this.backHandler.remove();
      }
    });
  }

  addGameLog(message, color = "#ffffff") {
    if (!this.gameLogs) this.gameLogs = [];
    if (!this.logTexts) this.logTexts = [];

    // 새 메시지 추가
    this.gameLogs.push({ message, color });

    // 최대 5~7개만 유지 (너무 많으면 화면을 가리니까요)
    if (this.gameLogs.length > 8) {
      this.gameLogs.shift();
    }

    this.updateLogDisplay();
  }

  // 3. 로그 화면 갱신 함수 (GameScene 클래스 내부에 추가)
  updateLogDisplay() {
    const startX = 20; // 왼쪽 여백
    const startY = 300; // 상단 여백 (상태바 아래)
    const lineSpacing = 47; // 줄 간격

    // 기존 텍스트 객체 삭제
    this.logTexts.forEach((txt) => txt.destroy());
    this.logTexts = [];

    // 저장된 로그를 순회하며 텍스트 생성
    this.gameLogs.forEach((log, index) => {
      const logTxt = this.add
        .text(startX, startY + index * lineSpacing, log.message, {
          fontFamily: "Jua",
          fontSize: "33px",
          color: log.color,
          stroke: "#000000",
          strokeThickness: 2,
          backgroundColor: "#00000044", // 살짝 반투명 배경을 넣어 가독성 확보
        })
        .setDepth(20); // UI 최상단

      this.logTexts.push(logTxt);
    });
  }

  createHaliGaliButtons(height) {
    const { width } = this.cameras.main;

    // 1. 중앙 종 (Bell)
    this.bellImage = this.add
      .image(width / 2, height * 0.465, "bell") // bell 이미지가 있다고 가정
      .setDisplaySize(width * 0.22, width * 0.22)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.handleRingBell();
      });

    this.bellImage.setData("bellBaseScaleX", this.bellImage.scaleX);
    this.bellImage.setData("bellBaseScaleY", this.bellImage.scaleY);
  }

  getCardKey(card) {
    if (card && card.type === THUNDER_CARD_TYPE) {
      return "thun";
    }

    if (card && card.type === BOMB_CARD_TYPE) {
      return "bomb";
    }

    if (card && card.type === TON_CARD_TYPE) {
      return "ton";
    }

    if (card && card.type === PEN_CARD_TYPE) {
      return "pen";
    }
    if (card && card.type === PLUS1_CARD_TYPE) {
      return "plus1";
    }
    if (card && card.type === COIN_CARD_TYPE) {
      return "coincard";
    }
    if (card && card.type === PLUS2_CARD_TYPE) {
      return "plus2";
    }
    if (card && card.type === NOT5_CARD_TYPE) {
      return "not5";
    }

    if (card && (card.type === "blockcard" || card.type === "block")) {
      return "blockcard";
    }

    const fruitNames = { 1: "strawberry", 2: "banana", 3: "lime", 4: "plum" };
    const fruitName = fruitNames[card.fruit] || "strawberry";
    return `${fruitName}_${card.count}`;
  }

  renderTable(players) {
    if (
      !players ||
      !this.playerTableGroup ||
      !this.cameras ||
      !this.cameras.main ||
      !this.scene ||
      !this.scene.isActive()
    ) {
      return;
    }
    this.playerTableGroup.removeAll(true);
    const { width, height } = this.cameras.main;

    // 싱글/멀티 통합 ID 판정
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const isMyTurnNow = players[this.turnIndex]?.id === myId;
    if (!isMyTurnNow) {
      this.clearMyTurnTimer();
    }

    // 내 위치 인덱스 찾기
    let myIndex = players.findIndex((p) => p.id === myId);
    if (myIndex === -1) myIndex = 0;

    const sortedPlayers = [
      ...players.slice(myIndex),
      ...players.slice(0, myIndex),
    ];

    const playerCount = sortedPlayers.length;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75, rotation: 0 },
            { x: width * 0.5, y: height * 0.18, rotation: 180 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.11, y: height * 0.45, rotation: 90 },
              { x: width * 0.89, y: height * 0.45, rotation: -90 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.11, y: height * 0.45, rotation: 90 },
              { x: width * 0.5, y: height * 0.18, rotation: 180 },
              { x: width * 0.89, y: height * 0.45, rotation: -90 },
            ];

    // initialize mapping of id -> layout for use by shield effect
    this.playerLayouts = {};
    sortedPlayers.forEach((p, i) => {
      if (!p || !pos[i]) return;
      const layout = pos[i];
      this.playerLayouts[p.id] = {
        x: layout.x,
        y: layout.y,
        rotation: layout.rotation,
      };

      this.drawPlayerInfo(p, layout);
      this.drawPlayerDeck(p, layout); // 💡 여기서 숫자가 그려짐
      this.drawSpecialCards(p, layout); // 특수카드 표시

      if (p.openStack && p.openStack.length > 0) {
        this.drawOpenCard(p.openStack, layout);
      }
    });

    // =============================================
    // 바닥 카드 총합 표시 (화면 중앙)
    // =============================================
    const totalStackCount = players.reduce((sum, p) => {
      return sum + (p.openStack ? p.openStack.length : 0);
    }, 0);

    const cx = width * 0.5;
    const cy = height * 0.465;

    if (totalStackCount > 0) {
      // 긴장감 단계: 10장 이상 → 주황, 20장 이상 → 빨강
      const tension = totalStackCount >= 20 ? 2 : totalStackCount >= 10 ? 1 : 0;
      const textColor =
        tension === 2 ? "#ff4444" : tension === 1 ? "#e67e22" : "#ffffff";

      // 총합 숫자 텍스트
      const stackTxt = this.add
        .text(cx, cy - width * 0.025, `${totalStackCount}`, {
          fontFamily: "Jua",
          fontSize: `${width * 0.07}px`,
          color: textColor,
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(200);
      this.playerTableGroup.add(stackTxt);

      // 💥 10장 이상일 때 숫자와 라벨에 역동적인 효과 추가
      if (tension >= 1) {
        const bounceScale = tension === 2 ? 1.15 : 1.08; // 20장 이상이면 더 큰 바운스
        const bounceDuration = tension === 2 ? 300 : 400;
        const shakeIntensity = tension === 2 ? 3 : 2;

        // 바운스 효과
        this.tweens.add({
          targets: [stackTxt],
          scale: bounceScale,
          duration: bounceDuration,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        // 흔들림 효과
        this.tweens.add({
          targets: stackTxt,
          rotation: Phaser.Math.DegToRad(shakeIntensity),
          duration: 100,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      // 화면 테두리 깜빡임 효과 (10장 이상)
      if (tension >= 1) {
        const borderColor = tension === 2 ? 0xe74c3c : 0xe67e22;
        const blinkSpeed = tension === 2 ? 300 : 500;

        // 테두리 오버레이
        const borderOverlay = this.add.graphics();
        borderOverlay.lineStyle(35, borderColor, 1);
        borderOverlay.strokeRect(0, 0, width, height);
        borderOverlay.setDepth(500);
        this.playerTableGroup.add(borderOverlay);

        this.tweens.add({
          targets: borderOverlay,
          alpha: 0,
          duration: blinkSpeed,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        // 💥 전체 화면 연한 깜빡임 효과 추가
        const screenFlashColor = tension === 2 ? 0xff0000 : 0xff8800; // 빨강 또는 주황
        const screenFlashAlpha = tension === 2 ? 0.15 : 0.1; // 연한 투명도

        const screenFlash = this.add.graphics();
        screenFlash.fillStyle(screenFlashColor, screenFlashAlpha);
        screenFlash.fillRect(0, 0, width, height);
        screenFlash.setDepth(499); // 테두리보다 아래
        this.playerTableGroup.add(screenFlash);

        this.tweens.add({
          targets: screenFlash,
          alpha: 0,
          duration: blinkSpeed,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    this.updateTimeAttackDisplay(cx, cy, width);
  }

  updateTimeAttackDisplay(cxOverride, cyOverride, widthOverride) {
    if (!this.roundData || this.roundData.gameMode !== "timeattack") {
      if (this.timeAttackText && this.timeAttackText.active) {
        this.timeAttackText.destroy();
        this.timeAttackText = null;
      }
      return;
    }

    const endsAt = Number(this.roundData.timeAttackEndsAt) || 0;
    const remainingMs = Math.max(0, endsAt - Date.now());
    const remainingSec = Math.floor(remainingMs / 1000);
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const timeLabel = `${mins}:${String(secs).padStart(2, "0")}`;

    const width = widthOverride || this.cameras.main.width;
    const cx = typeof cxOverride === "number" ? cxOverride : width * 0.5;
    const cy =
      typeof cyOverride === "number"
        ? cyOverride
        : this.cameras.main.height * 0.465;

    if (!this.timeAttackText || !this.timeAttackText.active) {
      this.timeAttackText = this.add
        .text(cx, cy + width * 0.035, `타임어택 ${timeLabel}`, {
          fontFamily: "Jua",
          fontSize: `${width * 0.04}px`,
          color: "#ffd166",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(200);
      if (this.playerTableGroup) {
        this.playerTableGroup.add(this.timeAttackText);
      }
    } else {
      this.timeAttackText.setText(`타임어택 ${timeLabel}`);
      this.timeAttackText.setPosition(cx, cy + width * 0.035);
    }

    if (remainingSec <= 10) {
      this.timeAttackText.setColor("#ff3b30");
      if (!this.timeAttackUrgentTween) {
        this.timeAttackUrgentTween = this.tweens.add({
          targets: this.timeAttackText,
          scale: 1.12,
          alpha: 0.6,
          duration: 250,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else {
      this.timeAttackText.setColor("#ffd166");
      if (this.timeAttackUrgentTween) {
        this.timeAttackUrgentTween.stop();
        this.timeAttackUrgentTween = null;
      }
      this.timeAttackText.setScale(1);
      this.timeAttackText.setAlpha(1);
    }
  }

  updateTurnEffect() {
    const isMyTurn =
      this.roundData.players[this.turnIndex]?.id ===
      (this.isSingle ? this.myId : socket.id);

    if (isMyTurn && this.isGameStarted) {
      if (!this.turnOverlay) {
        this.turnOverlay = this.add.graphics();
        this.turnOverlay.lineStyle(10, 0x22c55e, 1);
        this.turnOverlay.strokeRect(
          0,
          0,
          this.cameras.main.width,
          this.cameras.main.height,
        );
        this.turnOverlay.setDepth(1000);

        // 깜빡이는 효과
        this.tweens.add({
          targets: this.turnOverlay,
          alpha: 0.3,
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      if (this.turnOverlay) {
        this.turnOverlay.destroy();
        this.turnOverlay = null;
      }
    }
  }

  clearMyTurnTimer() {
    if (this.myTurnTimer) {
      this.myTurnTimer.remove();
      this.myTurnTimer = null;
    }
  }

  startMyAutoTimer(p, layout) {
    // 1. 기존 타이머가 있다면 즉시 제거
    this.clearMyTurnTimer();

    if (this.isTutorialMode) {
      return;
    }

    //const { width } = this.cameras.main;
    const { width, height } = this.cameras.main;

    const barWidth = width * 0.2; // 5초이므로 가독성을 위해 조금 더 길게 설정
    const barHeight = height * 0.01;
    const barY = layout.y + (layout.rotation === 180 ? -120 : 210);

    // 2. Progress Bar 생성 (처음에는 알파값 0으로 안 보이게 시작 가능)
    const bg = this.add
      .rectangle(layout.x, barY, barWidth, barHeight, 0x000000, 0.5)
      .setDepth(1000)
      .setAlpha(0);
    const bar = this.add
      .rectangle(
        layout.x - barWidth / 2,
        barY,
        barWidth,
        barHeight,
        0x22c55e,
        1,
      )
      .setOrigin(0, 0.5)
      .setDepth(1001)
      .setAlpha(0);

    this.playerTableGroup.add([bg, bar]);

    // 3. UI 애니메이션: 1초 대기(delay) 후 5초 동안 작동
    this.tweens.add({
      targets: [bg, bar],
      alpha: 1, // 1초 뒤에 나타나게 함
      duration: 200,
      delay: 1000, // 💡 1초 딜레이 후 노출 시작
    });

    this.tweens.add({
      targets: bar,
      scaleX: 0,
      delay: 1000, // 💡 1초 뒤에 줄어들기 시작
      duration: 5000, // 💡 5초 동안 줄어듦
      ease: "Linear",
      onUpdate: (tween) => {
        // 남은 시간이 짧아지면 빨간색으로 변경 (80% 진행 시)
        if (tween.progress > 0.8) bar.setFillStyle(0xe74c3c);
      },
      onComplete: () => {
        bg.destroy();
        bar.destroy();
      },
    });

    // 4. 실제 자동 실행 예약: 1초 대기 + 5초 타이머 = 총 6초
    this.myTurnTimer = this.time.delayedCall(6000, () => {
      console.log("⏰ 1초 대기 + 5초 경과! 자동 뒤집기 실행");
      this.handleFlipCard();
    });
  }

  drawPlayerInfo(p, layout) {
    const { width } = this.cameras.main;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const isMe = p.id === myId;

    // 현재 방 데이터에서 턴 인덱스에 해당하는 플레이어인지 확인
    if (typeof this.turnIndex !== "number") this.turnIndex = 0;

    const isMyTurn = this.roundData.players[this.turnIndex]?.id === p.id;
    const cardCount = p.cards ?? (p.myDeck ? p.myDeck.length : 0);
    //const isEliminated = cardCount === 0;
    const isEliminated = p.isEliminated ?? false;

    const nameOffset = 160;

    // 1. 닉네임 텍스트 설정
    let displayNickname = p.nickname;
    let nameColor = isMe ? "#22c55e" : "#ffffff";

    // 차례인 사람 강조 색상 (노란색 계열)
    if (!isEliminated && isMyTurn) {
      if (isMe && !this.isTutorialMode) {
        this.startMyAutoTimer(p, layout);
      }

      nameColor = "#f1c40f";
    }
    if (isEliminated) {
      displayNickname = `[탈락] ${p.nickname}`;
      nameColor = "#999999";
    }

    const nameTxt = this.add
      .text(
        layout.x,
        layout.y + (layout.rotation === 180 ? -nameOffset : nameOffset),
        displayNickname,
        {
          fontFamily: GAME_FONTS.main,
          fontSize:
            isMyTurn && !isEliminated
              ? `${width * 0.045}px`
              : `${width * 0.035}px`, // 차례면 글자 크기 키움
          color: nameColor,
          fontWeight: "bold",
          stroke: isMyTurn && !isEliminated ? "#ffffff" : "#000", // 차례면 흰색 테두리로 강조
          strokeThickness: isMyTurn && !isEliminated ? 5 : 3,
        },
      )
      .setOrigin(0.5);

    // 2. 💡 [차례 연출] 텍스트가 위아래로 통통 튀는 애니메이션 추가
    if (isMyTurn && !isEliminated) {
      this.tweens.add({
        targets: nameTxt,
        y: nameTxt.y - 5, // 10픽셀 위로
        duration: 500,
        yoyo: true, // 다시 돌아옴
        repeat: -1, // 무한 반복
        ease: "Sine.easeInOut",
      });

      // 차례인 사람 뒤에 강조 배경(Halo) 효과 추가 (선택 사항)
      const halo = this.add
        .circle(layout.x, nameTxt.y, 40, 0xf1c40f, 0.2)
        .setDepth(nameTxt.depth - 1);
      this.playerTableGroup.add(halo);

      this.tweens.add({
        targets: halo,
        scale: 1.5,
        alpha: 0,
        duration: 1000,
        repeat: -1,
      });
    }

    this.playerTableGroup.add(nameTxt);
  }

  drawPlayerDeck(p, layout) {
    const { width } = this.cameras.main;

    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const isMe = p.id === myId; // 내 카드인지 확인

    // 💡 카드 장수 결정 로직 통일
    const cardCount = p.cards !== undefined ? p.cards : p.remainingCards || 0;

    const deck = this.add
      .image(layout.x, layout.y, "card_back")
      .setDisplaySize(width * 0.15, width * 0.22);

    // 내 카드 덱인 경우에만 클릭 이벤트 부여
    if (isMe && cardCount > 0) {
      deck.setInteractive({ useHandCursor: true });
      deck.on("pointerdown", () => {
        // 살짝 눌리는 효과 (피드백)
        this.tweens.add({
          targets: deck,
          scale: "*=0.95",
          duration: 50,
          yoyo: true,
          onComplete: () => this.handleFlipCard(), // 카드 뒤집기 함수 호출
        });
      });
    }

    // 💡 카드 장수 표시 (p.cards 데이터 반영)
    const countTxt = this.add
      .text(layout.x, layout.y, cardCount, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`, // 화면 크기에 비례하여 크게 표시
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10); // 카드보다 위에 보이게 설정

    // 텍스트도 클릭 가능하게 하려면(숫자 부분을 눌러도 작동하게)
    if (isMe && cardCount > 0) {
      countTxt.setInteractive({ useHandCursor: true });
      countTxt.on("pointerdown", () => this.handleFlipCard());
    }

    this.playerTableGroup.add([deck, countTxt]);

    if (p.isEliminated) {
      const stampRadius = width * 0.065;
      const stamp = this.add
        .circle(layout.x, layout.y, stampRadius, 0xb91c1c, 0.18)
        .setStrokeStyle(4, 0xef4444, 0.85)
        .setDepth(12)
        .setAngle(-10);
      const stampText = this.add
        .text(layout.x, layout.y, "탈락", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          color: "#ffffff",
          fontWeight: "bold",
          stroke: "#1f2937",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(13)
        .setAngle(-10);

      this.playerTableGroup.add([stamp, stampText]);
    }
  }

  drawSpecialCards(p, layout) {
    const { width, height } = this.cameras.main;
    if (this.isSingle) return;
    if (this.roundData && this.roundData.itemMode === false) return;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const isMe = p.id === myId; // 내 카드인지 확인

    // 나만 특수카드를 표시함
    if (!isMe) return;

    // 새 특수카드 목록 (shop에 등록된 5종)
    const allSpecialCards = [
      { id: 4, key: "lock", name: "자물쇠", cooldown: 12000 },
      { id: 5, key: "shield", name: "방패", cooldown: 12000 },
      { id: 6, key: "ink", name: "먹물", cooldown: 12000 },
      { id: 7, key: "thief", name: "도둑", cooldown: 12000 },
      { id: 8, key: "king", name: "왕", cooldown: 12000 },
    ];

    // localStorage에서 보유한 특수카드 로드
    const specialCardsOwned = JSON.parse(
      localStorage.getItem("specialCards") || "{}",
    );

    // 하단 중앙에 고정 배치
    const cardSize = Math.min(width * 0.12, 100);
    const gap = cardSize + Math.round(width * 0.03);
    const centerX = width / 2;
    const cardY = height - Math.round(height * 0.08);
    const startX = centerX - ((allSpecialCards.length - 1) / 2) * gap;

    allSpecialCards.forEach((card, index) => {
      const cardX = startX + index * gap;
      const count = specialCardsOwned[card.id] || 0;

      // 해당 턴에 이미 특수카드를 사용했는지 확인 (턴당 1회 규칙)
      const myIdForFlag = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
      const usedFlag = (this.specialUsedThisTurn || {})[myIdForFlag] === true;

      if (count > 0) {
        // 보유한 카드: 이미지 또는 대체 텍스트로 표시
        const cardBg = this.add
          .rectangle(
            cardX,
            cardY,
            cardSize,
            cardSize,
            usedFlag ? 0x555555 : 0x1f2937,
            usedFlag ? 0.5 : 0.85,
          )
          .setStrokeStyle(2, usedFlag ? 0xff4444 : 0xffff00, 1)
          .setInteractive({ useHandCursor: !usedFlag });

        let cardImg = null;
        if (this.textures.exists(card.key)) {
          cardImg = this.add
            .image(cardX, cardY - Math.round(cardSize * 0.08), card.key)
            .setDisplaySize(cardSize * 0.8, cardSize * 0.8)
            .setOrigin(0.5)
            .setAlpha(usedFlag ? 0.4 : 1);
        } else {
          cardImg = this.add
            .text(cardX, cardY - Math.round(cardSize * 0.08), card.name, {
              fontFamily: GAME_FONTS.main,
              fontSize: `${cardSize * 0.35}px`,
              color: "#ffffff",
            })
            .setOrigin(0.5)
            .setAlpha(usedFlag ? 0.4 : 1);
        }

        const countTxt = this.add
          .text(
            cardX + Math.round(cardSize * 0.32),
            cardY + Math.round(cardSize * 0.32),
            `x${count}`,
            {
              fontFamily: GAME_FONTS.main,
              fontSize: `${cardSize * 0.28}px`,
              color: "#ffffff",
              fontWeight: "bold",
            },
          )
          .setOrigin(0.5)
          .setAlpha(usedFlag ? 0.4 : 1);

        if (usedFlag) {
          cardBg.disableInteractive();
        } else {
          cardBg.on("pointerdown", () => {
            // Prevent double-clicks: mark as clicked and disable interaction immediately
            if (cardBg._clicked) return;
            cardBg._clicked = true;
            cardBg.disableInteractive();

            if ((this.specialUsedThisTurn || {})[myIdForFlag]) {
              this.showToast(
                "이미 이 턴에 특수카드를 사용했습니다!",
                "#e74c3c",
              );
              return;
            }

            // Optimistic guard so rapid clicks (during tween) won't trigger again
            try {
              this.specialUsedThisTurn = this.specialUsedThisTurn || {};
              this.specialUsedThisTurn[myIdForFlag] = true;
            } catch (e) {}

            this.sound.play("btn", { volume: 0.1 });
            this.tweens.add({
              targets: [cardBg, cardImg, countTxt],
              scale: "*=0.95",
              duration: 100,
              yoyo: true,
              ease: "Quad.easeInOut",
              onComplete: () => {
                this.useSpecialCard(card.id, card.name, card.cooldown || 12000);
              },
            });
          });
        }

        this.playerTableGroup.add([cardBg, cardImg, countTxt]);
      } else {
        // 미보유 카드: 빈 슬롯으로 표시
        const emptyBg = this.add
          .rectangle(cardX, cardY, cardSize, cardSize, 0x444444, 0.25)
          .setStrokeStyle(1, 0x999999, 0.5);
        this.playerTableGroup.add(emptyBg);
      }
    });
  }

  /*drawOpenCard(openCards, layout) {
    if (!openCards) return;
    const { width } = this.cameras.main;

    // 💡 단일 객체로 들어올 경우를 대비해 배열로 래핑
    const cardsArray = Array.isArray(openCards) ? openCards : [openCards];

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);
    const baseX = layout.x + Math.cos(rad) * dist * 0.7;
    const baseY = layout.y + Math.sin(rad) * dist;

    // 1. 서버의 숫자(1~4)를 클라이언트 이미지 키(문자)로 변환
    const fruitNames = {
      1: "strawberry",
      2: "banana",
      3: "lime",
      4: "plum",
    };
    cardsArray.forEach((card, index) => {
      const fruitNames = { 1: "strawberry", 2: "banana", 3: "lime", 4: "plum" };
      const cardKey = `${fruitNames[card.fruit] || "strawberry"}_${card.count}`;

      if (this.textures.exists(cardKey)) {
        // 💡 index를 활용해 위로 갈수록 아주 살짝 어긋나게 배치 (쌓임 효과)
        // 180도 회전된 플레이어는 반대 방향으로 오프셋을 줘야 할 수도 있습니다.
        const stackOffset = index * 2;

        const openCardImg = this.add
          .image(baseX, baseY - stackOffset, cardKey) // Y축으로 살짝씩 위로 쌓음
          .setDisplaySize(width * 0.18, width * 0.25)
          .setAngle(0)
          .setDepth(150 + index); // 나중에 쌓인 카드가 더 위에 보이게

        this.playerTableGroup.add(openCardImg);
      }
    });
  
  }*/

  drawOpenCard(openStack, layout) {
    if (!openStack || !Array.isArray(openStack)) return;
    const { width } = this.cameras.main;

    const player = this.roundData.players.find(
      (p) => p.openStack === openStack,
    );

    const activeBlockIds = Array.isArray(this.blockEffects)
      ? new Set(this.blockEffects.map((e) => e.id))
      : new Set();
    const shouldStripBlockcards =
      (player && player.isEliminated) || activeBlockIds.size === 0;
    const cleanedStack = openStack.filter((card) => {
      if (!(card && card.type === "blockcard")) return true;
      if (shouldStripBlockcards) return false;
      return card.effectId && activeBlockIds.has(card.effectId);
    });
    if (player && cleanedStack.length !== openStack.length) {
      player.openStack = cleanedStack;
    }
    const stackToDraw = player ? player.openStack : cleanedStack;

    // 애니메이션 중에는 최상단(현재 제출 중인) 일반 카드는 표시하지 않되,
    // 항상 blockcard는 표시하도록 처리합니다.
    const fullStack = stackToDraw;
    const cardsToDraw =
      player && player.isFlipping ? fullStack.slice(0, -1) : fullStack;

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);

    // 기본 카드 뭉치 중앙 위치
    const baseX = layout.x + Math.cos(rad) * dist * 0.7;
    const baseY = layout.y + Math.sin(rad) * dist;

    // blockcard가 항상 최상단에 보이도록, 일반 카드와 blockcard를 분리하여 그립니다.
    // 주의: 애니메이션 중일 때는 cardsToDraw에서 최상단 일반 카드를 제외하지만
    // blockcard는 fullStack에서 항상 가져와 그려야 하므로 분리하여 처리합니다.
    const normalCards = (
      player && player.isFlipping ? fullStack.slice(0, -1) : fullStack
    ).filter((c) => !(c && c.type === "blockcard"));
    const blockCards = fullStack.filter((c) => c && c.type === "blockcard");

    // 일반 카드 먼저 그리기
    normalCards.forEach((card, idx) => {
      const index = idx; // 위치 계산용
      const cardKey = this.getCardKey(card);

      let offsetX = 0;
      let offsetY = 0;
      const step = 3;

      if (layout.rotation === 0) offsetY = -index * step;
      else if (layout.rotation === 90) offsetX = index * step;
      else if (layout.rotation === 180) offsetY = index * step;
      else if (layout.rotation === -90 || layout.rotation === 270)
        offsetX = -index * step;

      if (this.textures.exists(cardKey)) {
        const openCardImg = this.add
          .image(baseX + offsetX, baseY + offsetY, cardKey)
          .setDisplaySize(width * 0.18, width * 0.25)
          .setDepth(150 + index);

        this.playerTableGroup.add(openCardImg);
      } else if (card && card.type === THUNDER_CARD_TYPE) {
        const thunderCardBg = this.add
          .rectangle(
            baseX + offsetX,
            baseY + offsetY,
            width * 0.18,
            width * 0.25,
            0x4f46e5,
            0.95,
          )
          .setStrokeStyle(4, 0xfde047, 1)
          .setDepth(150 + index);

        const thunderIcon = this.add
          .text(baseX + offsetX, baseY + offsetY, "⚡", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.08}px`,
            color: "#ffffff",
            stroke: "#111111",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(151 + index);

        this.playerTableGroup.add([thunderCardBg, thunderIcon]);
      }
    });

    // 그 다음 blockcard들을 그립니다. 항상 최상단이 되도록 높은 depth를 설정.
    const BLOCKCARD_BASE_DEPTH = 500000;
    blockCards.forEach((card, index) => {
      const cardKey = this.getCardKey(card);
      const offsetX = 0;
      const offsetY = 0;

      if (this.textures.exists(cardKey)) {
        const openCardImg = this.add
          .image(baseX + offsetX, baseY + offsetY, cardKey)
          .setDisplaySize(width * 0.18, width * 0.25)
          .setDepth(BLOCKCARD_BASE_DEPTH + index);

        try {
          const viewerId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
          // find the effect for this blockcard
          const effect =
            Array.isArray(this.blockEffects) && card && card.effectId
              ? this.blockEffects.find((e) => e.id === card.effectId)
              : null;
          const viewerIsIssuerForThis = effect && effect.issuer === viewerId;
          const viewerIsShieldedForThis =
            effect &&
            Array.isArray(effect.shielded) &&
            effect.shielded.includes(viewerId);
          if (viewerIsIssuerForThis || viewerIsShieldedForThis)
            openCardImg.setAlpha(0.35);
        } catch (e) {}

        this.playerTableGroup.add(openCardImg);
      }
    });
  }

  playWinAnimation(data = {}) {
    // block further inputs by placing a transparent fullscreen overlay
    const { width, height } = this.cameras.main;
    const overlay = this.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(11000)
      .setInteractive();

    if (this._winAvatarSprite && this._winAvatarSprite.active) {
      if (this._winAvatarSprite.anims) {
        this._winAvatarSprite.anims.stop();
      }
      this._winAvatarSprite.off("animationcomplete");
      this._winAvatarSprite.setVisible(false);
    }
    this.avatarAnimInProgress = false;

    // 애니메이션 완료 추적 변수들을 함수 시작 부분에 선언
    let totalCardsToFly = 0;
    let finishedFlys = 0;
    let characterAnimationDone = false;
    let cardAnimationDone = false;

    // 애니메이션이 완전히 끝났는지 체크하는 함수
    const checkAllAnimationsComplete = () => {
      if (characterAnimationDone && cardAnimationDone) {
        this.renderTable(data.players);
        if (overlay) overlay.destroy();
      }
    };

    const skipAvatarAnim =
      typeof data.skipAvatar === "boolean" ? data.skipAvatar : false;

    // inspect `this` context
    // ensure animations are enabled when called
    this.skipWinAvatarAnim = skipAvatarAnim;
    // avoid overlapping avatar animations
    if (this.avatarAnimInProgress) {
      characterAnimationDone = true; // 애니메이션이 이미 진행 중이면 스킵되므로 완료 처리
      // still play other effects but skip creating new sprite
    }
    const { players, prevPlayers, winnerId } = data;

    // 💥 멀티플레이 정답 시 스펙타클한 이펙트
    this.playSuccessEffect();

    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const myIndex = players.findIndex((p) => p.id === myId);
    const winIdx = players.findIndex((p) => p.id === winnerId);

    if (winIdx === -1) return;

    const playerCount = players.length;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75 },
            { x: width * 0.5, y: height * 0.18 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.89, y: height * 0.45 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.5, y: height * 0.18 },
              { x: width * 0.89, y: height * 0.45 },
            ];

    const relWinIdx = (winIdx - myIndex + players.length) % players.length;
    const targetPos = pos[relWinIdx];

    // show single avatar animation at center once (for winner)
    let combo = 0;
    if (!this.skipWinAvatarAnim) {
      try {
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const avatarKey =
          players[winIdx]?.avatarKey ||
          players[winIdx]?.current_character ||
          "player_1";

        // use a reusable sprite instance to avoid allocation overhead
        const needsNewSprite =
          !this._winAvatarSprite ||
          !this._winAvatarSprite.scene ||
          !this._winAvatarSprite.active;
        if (needsNewSprite) {
          if (this._winAvatarSprite) {
            this._winAvatarSprite.destroy();
          }
          this._winAvatarSprite = this.add
            .sprite(centerX, centerY, avatarKey)
            .setDepth(10050)
            .setVisible(false);
        }
        const tempSprite = this._winAvatarSprite;
        tempSprite.x = centerX;
        tempSprite.y = centerY;
        tempSprite.setVisible(true);

        const hideWinAvatar = () => {
          if (!tempSprite || !tempSprite.active) return;
          if (tempSprite.anims) {
            tempSprite.anims.stop();
          }
          tempSprite.off("animationcomplete");
          tempSprite.setVisible(false);
        };

        // mark in-progress to prevent duplicates
        this.avatarAnimInProgress = true;

        const baseTexture =
          this.getAvatarDisplayKey(avatarKey) ||
          (this.textures.exists(avatarKey) ? avatarKey : null);

        if (baseTexture && this.textures.exists(baseTexture)) {
          try {
            tempSprite.setTexture(baseTexture);
            this.applyAvatarAnimation(tempSprite, avatarKey);
            const anim = tempSprite.anims.currentAnim;
            if (anim) {
              anim.repeat = 0;
            }
            const clearFlag = () => {
              this.avatarAnimInProgress = false;
              hideWinAvatar();
              characterAnimationDone = true;
              checkAllAnimationsComplete();
            };
            tempSprite.off("animationcomplete");
            tempSprite.once("animationcomplete", () => {
              clearFlag();
            });
            // safety timeout
            this.time.delayedCall(2000, () => {
              if (tempSprite && tempSprite.active) {
                tempSprite.setVisible(false);
              }
              clearFlag();
            });
          } catch (textureError) {
            hideWinAvatar();
            this.avatarAnimInProgress = false;
            characterAnimationDone = true;
            checkAllAnimationsComplete();
          }
        } else {
          hideWinAvatar();
          this.avatarAnimInProgress = false;
          characterAnimationDone = true;
          checkAllAnimationsComplete();
        }

        combo =
          this.comboState && this.comboState.count ? this.comboState.count : 0;
      } catch (e) {
        this.avatarAnimInProgress = false;
        characterAnimationDone = true; // 에러 발생 시에도 캐릭터 애니메이션 완료 처리
        checkAllAnimationsComplete();
      }
    } else {
      characterAnimationDone = true; // 캐릭터 애니메이션이 비활성화된 경우 즉시 완료 처리
      combo =
        this.comboState && this.comboState.count ? this.comboState.count : 0;
    }
    if (combo > 1 && this.comboState.lastWinnerId === winnerId) {
      const comboText = this.add
        .text(targetPos.x, targetPos.y - height * 0.12, `${combo}콤보!`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.round(width * 0.06)}px`,
          color: "#FFD66B",
          stroke: "#4b2e83",
          strokeThickness: 8,
          fontWeight: "700",
        })
        .setOrigin(0.5)
        .setDepth(10010)
        .setScale(0)
        .setAlpha(0);

      this.tweens.add({
        targets: comboText,
        scale: 1.15,
        alpha: 1,
        duration: 220,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: comboText,
            scale: 1.6,
            alpha: 0,
            y: comboText.y - 50,
            duration: 600,
            delay: 300,
            ease: "Power2.easeIn",
            onComplete: () => comboText.destroy(),
          });
        },
      });

      // 간단한 파티클 버스트
      const burstCount = 12;
      for (let i = 0; i < burstCount; i++) {
        const angle =
          (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.6;
        const speed = 120 + Math.random() * 160;
        const px = this.add
          .circle(
            targetPos.x,
            targetPos.y - height * 0.08,
            width * 0.01,
            0xffd700,
            1,
          )
          .setDepth(10011);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 30;
        this.tweens.add({
          targets: px,
          x: targetPos.x + vx,
          y: targetPos.y - height * 0.08 + vy,
          alpha: 0,
          scale: 0,
          duration: 700 + Math.random() * 300,
          ease: "Power2.easeOut",
          onComplete: () => px.destroy(),
        });
      }

      // 콤보 사운드가 있으면 재생, 없으면 보조 사운드
      if (this.cache && this.cache.audio && this.cache.audio.exists("combo")) {
        this.sound.play("combo", { volume: 0.35 });
      }
    }

    // 1. 전체 날려야 할 카드 총 개수 먼저 계산
    data.prevPlayers.forEach((p) => {
      if (p.openStack) totalCardsToFly += p.openStack.length;
    });

    if (totalCardsToFly === 0) {
      cardAnimationDone = true;
      // 카드 애니메이션이 없어도 캐릭터 애니메이션이 끝날 때까지 기다림
      if (characterAnimationDone) {
        checkAllAnimationsComplete();
      }
      // return 제거하여 캐릭터 애니메이션은 계속 진행되도록 함
    }

    // 💡 [수정] 애니메이션 시작 직후 바닥 카드를 즉시 비우고 렌더링
    // → 애니메이션 중에 기존 카드가 화면에 보이지 않도록 함
    this.roundData.players.forEach((player) => {
      player.openStack = [];
      player.openCard = null;
    });
    this.renderTable(this.roundData.players);

    // 2. 각 플레이어의 스택을 순회하며 모든 카드 생성
    let globalCardIndex = 0; // 💡 전역 카드 인덱스 (슈슈슉 효과)

    prevPlayers.forEach((p, pIndex) => {
      if (p.openStack && p.openStack.length > 0) {
        const relIdx = (pIndex - myIndex + players.length) % players.length;
        const rotations =
          playerCount === 2
            ? [0, 180]
            : playerCount === 3
              ? [0, 90, -90]
              : [0, 90, 180, -90];
        const rotation = rotations[relIdx];
        const dist = width * 0.25;
        const rad = Phaser.Math.DegToRad(rotation - 90);

        const startX = pos[relIdx].x + Math.cos(rad) * dist * 0.7;
        const startY = pos[relIdx].y + Math.sin(rad) * dist;

        // 💡 [핵심] 해당 플레이어의 openStack에 있는 모든 카드를 날림
        p.openStack.forEach((card, cardIdx) => {
          // 💡 [수정] 슈슈슉 느낌 강화: delay 60ms로 증가, duration 300ms
          const delay = globalCardIndex * 60;
          globalCardIndex++;

          const flyCard = this.add
            .image(startX, startY - cardIdx * 2, "card_back") // 기존 쌓여있던 높이 재현
            .setDisplaySize(width * 0.15, width * 0.22)
            .setDepth(2000 + globalCardIndex);

          this.tweens.add({
            targets: flyCard,
            x: targetPos.x,
            y: targetPos.y,
            duration: 300,
            delay: delay,
            ease: "Cubic.out",
            onStart: () => {
              if (this.cache.audio.exists("pass")) {
                this.sound.play("pass", { volume: 0.2 });
              }
            },
            onComplete: () => {
              flyCard.destroy();
              finishedFlys++;

              // 모든 카드가 다 날아갔을 때
              if (finishedFlys === totalCardsToFly) {
                // 3. 데이터 비우기
                this.roundData.players.forEach((player) => {
                  player.openStack = [];
                  player.isFlipping = false;
                });
                cardAnimationDone = true;
                checkAllAnimationsComplete();
              }
            },
          });
        });
      }
    });

    // 함수 마지막에 애니메이션 상태 최종 체크
    // (카드와 캐릭터 애니메이션 모두 즉시 완료되는 경우 대비)
    setTimeout(() => {
      checkAllAnimationsComplete();
    }, 100);
  }

  playCardFlipAnimation(data) {
    if (!data || !this.roundData.players) return;
    const { width, height } = this.cameras.main;
    const cardKey = this.getCardKey(data.card);

    const now = this.time?.now || Date.now();
    const playerId = data.playerId || "";
    const remaining =
      data.remainingCount ?? data.remainingCards ?? data.remaining ?? "";
    const flipSfxKey = `${playerId}|${data.card?.type || ""}|${remaining}`;
    if (!this.lastFlipSfxByPlayer) this.lastFlipSfxByPlayer = {};
    const lastPlayerFlipAt = this.lastFlipSfxByPlayer[playerId] || 0;
    if (
      !lastPlayerFlipAt ||
      now - lastPlayerFlipAt > 200 ||
      !this.lastFlipSfx ||
      this.lastFlipSfx.key !== flipSfxKey ||
      now - this.lastFlipSfx.at > 120
    ) {
      if (this.cache.audio.exists("cardflip")) {
        this.sound.play("cardflip", { volume: 0.4 });
      }
      this.lastFlipSfx = { key: flipSfxKey, at: now };
      this.lastFlipSfxByPlayer[playerId] = now;
    }

    const player = this.roundData.players.find((p) => p.id === data.playerId);
    if (!player) return;

    // 💡 애니메이션 시작 전: 상태만 '뒤집는 중'으로 변경
    player.isFlipping = true;

    // 1. 현재 바닥 상태(새 카드 추가 전)로 렌더링
    this.renderTable(this.roundData.players);

    // 2. 카드 날리기 연출 설정
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const myIndex = this.roundData.players.findIndex((p) => p.id === myId);
    const playerIdx = this.roundData.players.findIndex(
      (p) => p.id === data.playerId,
    );
    const safeMyIndex = myIndex === -1 ? 0 : myIndex;
    const relativeIdx =
      (playerIdx - safeMyIndex + this.roundData.players.length) %
      this.roundData.players.length;

    const playerCount = this.roundData.players.length;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75, rotation: 0 },
            { x: width * 0.5, y: height * 0.18, rotation: 180 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.11, y: height * 0.45, rotation: 90 },
              { x: width * 0.89, y: height * 0.45, rotation: -90 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.11, y: height * 0.45, rotation: 90 },
              { x: width * 0.5, y: height * 0.18, rotation: 180 },
              { x: width * 0.89, y: height * 0.45, rotation: -90 },
            ];

    const startPos = pos[relativeIdx];

    // 💡 1. 현재 쌓여있는 카드의 개수를 파악합니다.
    const currentStackCount = player.openStack ? player.openStack.length : 0;
    const step = 1; // 카드 한 장당 어긋날 간격 (픽셀)

    let targetOffsetX = 0;
    let targetOffsetY = 0;

    // 💡 2. 플레이어 위치(rotation)에 따라 쌓이는 방향으로 오프셋 계산
    // drawOpenCard와 방향을 일치시켜야 '착' 하고 달라붙습니다.
    if (startPos.rotation === 0) {
      targetOffsetY = -currentStackCount * step; // 내 위치: 위로 쌓임
    } else if (startPos.rotation === 90) {
      targetOffsetX = currentStackCount * step; // 왼쪽: 오른쪽으로 쌓임
    } else if (startPos.rotation === 180) {
      targetOffsetY = currentStackCount * step; // 위쪽: 아래로 쌓임
    } else if (startPos.rotation === -90 || startPos.rotation === 270) {
      targetOffsetX = -currentStackCount * step; // 오른쪽: 왼쪽으로 쌓임
    }

    // 제출 중인 카드는 블록카드보다 아래에 보이도록 낮은 depth로 설정
    const tempCard = this.add
      .image(startPos.x, startPos.y, "card_back")
      .setDisplaySize(width * 0.15, width * 0.22)
      .setDepth(100);

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(startPos.rotation - 90);

    const viewerId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const viewerIsIssuer =
      Array.isArray(this.blockEffects) &&
      this.blockEffects.some((e) => e.issuer === viewerId);

    const submitterShielded =
      Array.isArray(this.blockEffects) &&
      this.blockEffects.some(
        (e) => Array.isArray(e.shielded) && e.shielded.includes(data.playerId),
      );

    /*console.log(
      "[flip] viewerId=",
      viewerId,
      "viewerIsIssuer=",
      viewerIsIssuer,
      "submitterShielded=",
      submitterShielded,
      "blockEffects=",
      this.blockEffects,
    );*/
    let revealLogged = false;

    this.tweens.add({
      targets: tempCard,
      x: startPos.x + Math.cos(rad) * dist * 0.7 + targetOffsetX,
      y: startPos.y + Math.sin(rad) * dist + targetOffsetY,
      duration: 300,
      ease: "Cubic.out",
      onUpdate: (tween) => {
        // 블록 효과가 활성화된 경우, 발행자(issuer)만 카드 면을 볼 수 있도록 함
        if (tween.progress > 0.5 && tempCard.texture.key === "card_back") {
          if (
            Array.isArray(this.blockEffects) &&
            this.blockEffects.length > 0 &&
            !viewerIsIssuer &&
            !submitterShielded
          ) {
            // block active and viewer is NOT issuer -> keep back texture (do not reveal)
            if (!revealLogged) {
              /*console.log(
                "[flip] reveal suppressed for viewer=",
                viewerId,
                "cardKey=",
                cardKey,
              );*/
              revealLogged = true;
            }
          } else {
            if (this.textures.exists(cardKey)) {
              if (!revealLogged) {
                /*console.log(
                  "[flip] revealing face for viewer=",
                  viewerId,
                  "cardKey=",
                  cardKey,
                );*/
                revealLogged = true;
              }
              tempCard.setTexture(cardKey);
            }
          }
        }
      },
      onComplete: () => {
        // 💡 애니메이션 종료 후: 이제 배열에 카드를 실제로 추가함
        if (!player.openStack) player.openStack = [];

        // 서버에서 전체 스택을 주지 않은 경우 수동 push, 줬으면 이미 위에서 세팅됨
        if (!data.openCardStack) {
          player.openStack.push(data.card);
        } else {
          player.openStack = data.openCardStack;
        }

        player.isFlipping = false;
        tempCard.destroy();

        // 마지막으로 전체(새 카드 포함) 렌더링
        this.renderTable(this.roundData.players);
      },
    });
  }

  showShieldEffect(playerId) {
    try {
      if (!this.roundData || !Array.isArray(this.roundData.players)) return;
      const players = this.roundData.players;
      const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
      let myIndex = players.findIndex((p) => p.id === myId);
      if (myIndex === -1) myIndex = 0;
      const sortedPlayers = [
        ...players.slice(myIndex),
        ...players.slice(0, myIndex),
      ];
      const playerCount = sortedPlayers.length;
      const { width, height } = this.cameras.main;
      const pos =
        playerCount === 2
          ? [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.5, y: height * 0.18, rotation: 180 },
            ]
          : playerCount === 3
            ? [
                { x: width * 0.5, y: height * 0.75, rotation: 0 },
                { x: width * 0.11, y: height * 0.45, rotation: 90 },
                { x: width * 0.89, y: height * 0.45, rotation: -90 },
              ]
            : [
                { x: width * 0.5, y: height * 0.75, rotation: 0 },
                { x: width * 0.11, y: height * 0.45, rotation: 90 },
                { x: width * 0.5, y: height * 0.18, rotation: 180 },
                { x: width * 0.89, y: height * 0.45, rotation: -90 },
              ];

      const targetIdx = players.findIndex((p) => p.id === playerId);
      if (targetIdx === -1) return;
      const relIdx = (targetIdx - myIndex + players.length) % players.length;
      const layout = pos[relIdx];
      if (!layout) return;

      let baseX, baseY;
      const cardHeight = width * 0.25;
      // if we have a stored deck layout, use that (hand card position)
      if (
        this.playerLayouts &&
        this.playerLayouts[playerId] &&
        typeof this.playerLayouts[playerId].x === "number"
      ) {
        baseX = this.playerLayouts[playerId].x;
        baseY = this.playerLayouts[playerId].y - cardHeight * 0.5 - 8;
      } else {
        // fallback: position shield above the open card area (reuse drawOpenCard math)
        const dist = width * 0.25;
        const rad = Phaser.Math.DegToRad(layout.rotation - 90);
        baseX = layout.x + Math.cos(rad) * dist * 0.7;
        baseY = layout.y + Math.sin(rad) * dist;
        baseY = baseY - cardHeight * 0.5 - 8;
      }
      const specialY = baseY;

      console.log(
        "[debug] showShieldEffect called for",
        playerId,
        "layout=",
        layout,
        "coords=",
        { baseX, baseY, specialY },
      );

      const hasTexture =
        this.textures && this.textures.exists && this.textures.exists("shield");
      if (!hasTexture) console.warn("[debug] shield texture not available");

      const shieldSprite = this.add
        .image(baseX, specialY, "shield")
        .setDisplaySize(48, 48)
        .setDepth(600000)
        .setAlpha(0)
        .setScale(0);

      // pop-in + fade-out effect (longer so user can see)
      this.tweens.add({
        targets: shieldSprite,
        alpha: 1,
        scale: 1,
        duration: 300,
        ease: "Back.out",
        yoyo: true,
        hold: 600,
        onComplete: () => {
          try {
            shieldSprite.destroy();
          } catch (e) {
            console.warn("[debug] error destroying shield sprite", e);
          }
        },
      });
    } catch (e) {
      console.warn("showShieldEffect error", e);
    }
  }

  showLockEffect(playerId) {
    try {
      // duplicate logic from showShieldEffect but use 'lock' texture
      if (!this.roundData || !Array.isArray(this.roundData.players)) return;
      const players = this.roundData.players;
      const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
      let myIndex = players.findIndex((p) => p.id === myId);
      if (myIndex === -1) myIndex = 0;
      const sortedPlayers = [
        ...players.slice(myIndex),
        ...players.slice(0, myIndex),
      ];
      const playerCount = sortedPlayers.length;
      const { width, height } = this.cameras.main;
      const pos =
        playerCount === 2
          ? [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.5, y: height * 0.18, rotation: 180 },
            ]
          : playerCount === 3
            ? [
                { x: width * 0.5, y: height * 0.75, rotation: 0 },
                { x: width * 0.11, y: height * 0.45, rotation: 90 },
                { x: width * 0.89, y: height * 0.45, rotation: -90 },
              ]
            : [
                { x: width * 0.5, y: height * 0.75, rotation: 0 },
                { x: width * 0.11, y: height * 0.45, rotation: 90 },
                { x: width * 0.5, y: height * 0.18, rotation: 180 },
                { x: width * 0.89, y: height * 0.45, rotation: -90 },
              ];

      const targetIdx = players.findIndex((p) => p.id === playerId);
      if (targetIdx === -1) return;
      const relIdx = (targetIdx - myIndex + players.length) % players.length;
      const layout = pos[relIdx];
      if (!layout) return;

      let baseX, baseY;
      const cardHeight = width * 0.25;
      if (
        this.playerLayouts &&
        this.playerLayouts[playerId] &&
        typeof this.playerLayouts[playerId].x === "number"
      ) {
        baseX = this.playerLayouts[playerId].x;
        baseY = this.playerLayouts[playerId].y - cardHeight * 0.5 - 8;
      } else {
        const dist = width * 0.25;
        const rad = Phaser.Math.DegToRad(layout.rotation - 90);
        baseX = layout.x + Math.cos(rad) * dist * 0.7;
        baseY = layout.y + Math.sin(rad) * dist;
        baseY = baseY - cardHeight * 0.5 - 8;
      }
      const lockY = baseY;

      console.log(
        "[debug] showLockEffect called for",
        playerId,
        "layout=",
        layout,
        "coords=",
        { baseX, baseY, lockY },
      );

      const hasTextureLock =
        this.textures && this.textures.exists && this.textures.exists("lock");
      if (!hasTextureLock) console.warn("[debug] lock texture not available");

      const lockSprite = this.add
        .image(baseX, lockY, "lock")
        .setDisplaySize(48, 48)
        .setDepth(600000)
        .setAlpha(0)
        .setScale(0);

      this.tweens.add({
        targets: lockSprite,
        alpha: 1,
        scale: 1,
        duration: 300,
        ease: "Back.out",
        yoyo: true,
        hold: 600,
        onComplete: () => {
          try {
            lockSprite.destroy();
          } catch (e) {
            console.warn("[debug] error destroying lock sprite", e);
          }
        },
      });
    } catch (e) {
      console.warn("showLockEffect error", e);
    }
  }

  playSpecialAnimation({ imageKey, title, subtitle, onComplete }) {
    try {
      const { width, height } = this.cameras.main;
      const container = this.add.container(width * 0.5, height * 0.45);
      container.setDepth(9000);

      const bg = this.add.rectangle(0, 0, 420, 180, 0x000000, 0.6);
      bg.setStrokeStyle(2, 0xffffff, 0.06);
      const img = this.add.image(-140, 0, imageKey).setDisplaySize(120, 120);
      const titleText = this.add
        .text(-50, -28, title, { font: "24px Arial", color: "#ffffff" })
        .setOrigin(0, 0.5);
      const subText = this.add
        .text(-50, 18, subtitle, {
          font: "14px Arial",
          color: "#dddddd",
          wordWrap: { width: 300 },
        })
        .setOrigin(0, 0.5);

      container.add([bg, img, titleText, subText]);
      container.setAlpha(0);
      container.setScale(0.8);

      this.tweens.add({
        targets: container,
        alpha: 1,
        scale: 1,
        duration: 360,
        ease: "Back.out",
        onComplete: () => {
          // 잠깐 유지 후 사라짐
          this.time.delayedCall(900, () => {
            this.tweens.add({
              targets: container,
              alpha: 0,
              scale: 0.9,
              duration: 300,
              onComplete: () => {
                try {
                  container.destroy();
                } catch (e) {}
                try {
                  if (onComplete) onComplete();
                } catch (e) {
                  console.warn("playSpecialAnimation onComplete error", e);
                }
              },
            });
          });
        },
      });
    } catch (e) {
      console.warn("playSpecialAnimation error", e);
      if (onComplete) onComplete();
    }
  }

  // 서버에 특수카드 사용 요청(낙관적 UI 업데이트 포함)
  requestUseSpecialWithOptimistic(cardId, cardName) {
    // 싱글 모드에서는 아이템 사용 금지
    if (this.isSingle) {
      this.showToast(
        "싱글 플레이에서는 아이템을 사용할 수 없습니다.",
        "#e74c3c",
      );
      return;
    }
    try {
      this.showToast(`${cardName} 카드를 사용 요청합니다...`, "#f39c12");
      let handled = false;
      const timeout = this.time.delayedCall(2500, () => {
        if (handled) return;
        handled = true;
        if (Number(cardId) === 7) {
          this.pendingThiefSnapshot = null;
        }
        this.showToast("서버 응답이 없어 사용이 취소되었습니다.", "#e74c3c");
      });

      const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;

      // 낙관적 업데이트: UI와 로컬 인벤토리 차감 (하지만 사용 플래그는 서버 응답 시에 설정)
      try {
        this.pendingSpecialUse = this.pendingSpecialUse || {};
        if (this.pendingSpecialUse[myId]) {
          // 이미 요청 대기 중이면 중복 방지
          timeout.remove(false);
          return;
        }
        this.pendingSpecialUse[myId] = true;

        if (Number(cardId) === 7 && Array.isArray(this.roundData?.players)) {
          try {
            this.pendingThiefSnapshot = {
              by: myId,
              players: this.roundData.players.map((p) => ({
                ...p,
                openStack: p.openStack ? [...p.openStack] : [],
              })),
              createdAt: Date.now(),
            };
          } catch (snapshotErr) {
            console.warn("store thief snapshot failed", snapshotErr);
            this.pendingThiefSnapshot = null;
          }
        }

        const specialCardsOwned =
          JSON.parse(localStorage.getItem("specialCards")) || {};
        specialCardsOwned[cardId] = (specialCardsOwned[cardId] || 0) - 1;
        if (specialCardsOwned[cardId] <= 0) delete specialCardsOwned[cardId];
        localStorage.setItem("specialCards", JSON.stringify(specialCardsOwned));
        this.renderTable(this.roundData.players);
      } catch (e) {
        console.warn("optimistic update failed", e);
      }

      socket.emit("requestUseSpecial", { cardId }, (res) => {
        if (handled) return;
        handled = true;
        timeout.remove(false);
        if (res && res.success) {
          if (res.updatedSpecialCards) {
            localStorage.setItem(
              "specialCards",
              JSON.stringify(res.updatedSpecialCards),
            );
          }
          try {
            if (Array.isArray(res.players) && res.players.length > 0) {
              this.roundData.players.forEach((oldPlayer) => {
                const newPlayer = res.players.find(
                  (p) => p.id === oldPlayer.id,
                );
                if (newPlayer) {
                  const preservedOpenStack = oldPlayer.openStack;
                  Object.assign(oldPlayer, newPlayer);
                  oldPlayer.openStack = preservedOpenStack;
                }
              });
              this.renderTable(this.roundData.players);
            }
          } catch (e) {
            console.warn("merge res.players failed", e);
          }

          const syncKey =
            cardId === 6
              ? "useBlock"
              : cardId === 7
                ? "useThief"
                : cardId === 8
                  ? "useKing"
                  : "useSpecial";
          this.safeSyncInventory(syncKey, { usedCardId: cardId });
          try {
            this.specialUsedThisTurn = this.specialUsedThisTurn || {};
            this.specialUsedThisTurn[myId] = true; // 서버 성공 시 사용 플래그 설정
          } catch (e) {}
          try {
            if (this.pendingSpecialUse) delete this.pendingSpecialUse[myId];
          } catch (e) {}
          this.showToast(`${cardName} 사용 요청을 보냈습니다.`, "#f39c12");
        } else {
          if (Number(cardId) === 7) {
            this.pendingThiefSnapshot = null;
          }
          try {
            const serverCards = (res && res.updatedSpecialCards) || null;
            if (serverCards) {
              localStorage.setItem("specialCards", JSON.stringify(serverCards));
            } else {
              const prev =
                JSON.parse(localStorage.getItem("specialCards") || "{}") || {};
              prev[cardId] = (prev[cardId] || 0) + 1;
              localStorage.setItem("specialCards", JSON.stringify(prev));
            }
          } catch (e) {
            console.warn("rollback failed", e);
          }
          try {
            if (this.pendingSpecialUse) delete this.pendingSpecialUse[myId];
          } catch (e) {}
          this.renderTable(this.roundData.players);
          this.showToast(
            res && res.message ? res.message : "사용 실패",
            "#e74c3c",
          );
        }
      });
    } catch (e) {
      console.warn("requestUseSpecialWithOptimistic failed", e);
    }
  }

  playPenaltyAnimation(data) {
    const { width, height } = this.cameras.main;

    // 💥 멀티플레이 패널티 시 강력한 실패 효과
    this.playFailureEffect();

    // 패널티가 발생하면 현재 콤보를 끊음
    try {
      if (this.comboState) {
        this.comboState.count = 0;
        this.comboState.lastWinnerId = null;
        this.comboState.lastTime = Date.now();
      }
    } catch (e) {
      this.comboState = { lastWinnerId: null, count: 0, lastTime: Date.now() };
    }

    const players = data.players;

    const penaltyIdx = players.findIndex((p) => p.id === data.penaltyId);
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const myIndex = players.findIndex((p) => p.id === myId);

    if (penaltyIdx === -1) return;

    const playerCount = players.length;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75 },
            { x: width * 0.5, y: height * 0.18 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.89, y: height * 0.45 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.5, y: height * 0.18 },
              { x: width * 0.89, y: height * 0.45 },
            ];

    const relPenaltyIdx =
      (penaltyIdx - myIndex + players.length) % players.length;
    const startPos = pos[relPenaltyIdx];

    // 💡 [수정] 서버에서 보내준 recipients가 있다면 그 사람들만, 없으면 살아있는 사람들만 대상으로 함
    let targetPlayers = [];
    if (data.recipients && data.recipients.length > 0) {
      targetPlayers = players.filter((p) => data.recipients.includes(p.id));
    } else {
      targetPlayers = players.filter(
        (p) => p.id !== data.penaltyId && p.cards > 0,
      );
    }

    const perRecipient = data.penaltyPerRecipient || 1;
    const totalCardsToFly = targetPlayers.length * perRecipient;
    if (totalCardsToFly === 0) {
      // 수신자가 없더라도 시각적 피드백을 줌 (작은 카드 흩날림)
      const px = this.add.container();
      for (let i = 0; i < 3; i += 1) {
        const c = this.add
          .image(
            startPos.x + (Math.random() - 0.5) * 20,
            startPos.y + (Math.random() - 0.5) * 10,
            "card_back",
          )
          .setDisplaySize(width * 0.12, width * 0.18)
          .setDepth(2000 + i);
        px.add(c);
        this.tweens.add({
          targets: c,
          x: startPos.x + (Math.random() - 0.5) * dist,
          y: startPos.y + (Math.random() - 0.5) * dist * 0.5,
          alpha: 0,
          angle: (Math.random() - 0.5) * 360,
          duration: 380 + i * 60,
          ease: "Cubic.out",
          onComplete: () => c.destroy(),
        });
      }

      // 바닥 카드 보존을 위해 openStack만 유지하면서 나머지 업데이트
      this.roundData.players.forEach((oldPlayer) => {
        const newPlayer = data.players.find((p) => p.id === oldPlayer.id);
        if (newPlayer) {
          const preservedOpenStack = oldPlayer.openStack;
          Object.assign(oldPlayer, newPlayer);
          oldPlayer.openStack = preservedOpenStack;
        }
      });
      this.time.delayedCall(420, () =>
        this.renderTable(this.roundData.players),
      );
      return;
    }

    // 💡 [중요] 애니메이션 시작 전에 먼저 업데이트된 플레이어 데이터를 반영
    // 단, openStack은 보존 (바닥 카드가 사라지지 않도록)
    this.roundData.players.forEach((oldPlayer) => {
      const newPlayer = data.players.find((p) => p.id === oldPlayer.id);
      if (newPlayer) {
        // openStack을 제외한 나머지 속성만 업데이트
        const preservedOpenStack = oldPlayer.openStack;
        Object.assign(oldPlayer, newPlayer);
        oldPlayer.openStack = preservedOpenStack; // 바닥 카드 보존
      }
    });

    let finishedCount = 0;

    targetPlayers.forEach((player, index) => {
      const realIdx = players.findIndex((p) => p.id === player.id);
      const relTargetIdx =
        (realIdx - myIndex + players.length) % players.length;
      const targetPos = pos[relTargetIdx];
      for (let j = 0; j < perRecipient; j += 1) {
        const offset = (j - (perRecipient - 1) / 2) * (width * 0.02);
        const flyCard = this.add
          .image(startPos.x, startPos.y, "card_back")
          .setDisplaySize(width * 0.135, width * 0.22)
          .setDepth(2000);

        this.tweens.add({
          targets: flyCard,
          x: targetPos.x + offset,
          y: targetPos.y,
          duration: 250,
          delay: index * 25 + j * 10,
          ease: "Cubic.out",
          onStart: () => {},
          onComplete: () => {
            flyCard.destroy();
            finishedCount++;

            if (finishedCount === totalCardsToFly) {
              // 애니메이션이 완전히 끝난 후 테이블 재렌더링
              // (openStack은 이미 보존된 상태이므로 별도 업데이트 불필요)
              this.renderTable(this.roundData.players);
            }
          },
        });
      }
    });
  }

  endSingleGame(result) {
    this.isGameStarted = false;
    this.isGameReady = false;

    if (this.isSingle && !this.isTutorialMode && result === "WIN") {
      this.handleQuestEvent("gameWin");
    }

    // 💡 모든 타이머 중지 (AI의 뒤집기나 종치기 등)
    this.time.removeAllEvents();

    // 1. 점수(카드 장수) 순으로 정렬하여 결과 데이터 생성
    const sortedPlayers = [...this.roundData.players].sort((a, b) => {
      const aCards = Number(a.cards) || 0;
      const bCards = Number(b.cards) || 0;
      return bCards - aCards;
    });

    // 2. 종료 연출(FINISH!) 실행 후 결과창 노출
    this.playFinishAnimation(() => {
      this.showSingleResultOverlay(sortedPlayers, result);
    });
  }

  returnToLobby(options = {}) {
    const rejoinRoom =
      typeof options.rejoinRoom === "boolean"
        ? options.rejoinRoom
        : !this.isSingle;
    const shouldLeaveRoom = options.leaveRoom === true;

    if (
      shouldLeaveRoom &&
      this.roundData &&
      this.roundData.roomId &&
      socket &&
      socket.connected
    ) {
      const roomId = this.roundData.roomId;
      socket.emit("leaveRoom", { roomId }, () => {
        this.scene.start("LobbyScene");
      });
      return;
    }

    if (
      !rejoinRoom ||
      !this.roundData ||
      !this.roundData.roomId ||
      !socket ||
      !socket.connected
    ) {
      this.scene.start("LobbyScene");
      return;
    }

    if (this.resultAutoLeaveTimer) {
      this.resultAutoLeaveTimer.remove();
      this.resultAutoLeaveTimer = null;
    }
    if (this.resultCountdownTimer) {
      this.resultCountdownTimer.remove();
      this.resultCountdownTimer = null;
    }

    const storedNickname = localStorage.getItem("nickname") || "요리사";

    const timeoutId = setTimeout(() => {
      console.log("⚠️ joinRoom 응답 타임아웃, 강제로 LobbyScene 이동");
      this.scene.start("LobbyScene", {
        fromGame: true,
        roomId: this.roundData.roomId,
        players: this.roundData.players,
        hostId: this.roundData.hostId,
        maxPlayers: this.roundData.maxPlayers || 4,
        roomName: this.roundData.roomName || "대기실",
      });
    }, 3000);

    const handlePlayerJoined = (data) => {
      clearTimeout(timeoutId);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("joinRoomError", handleJoinError);

      this.scene.start("LobbyScene", {
        fromGame: true,
        roomId: data.roomId,
        players: data.players,
        hostId: data.hostId,
        maxPlayers: data.max || 4,
        roomName: data.roomName || "대기실",
      });
    };

    const handleJoinError = (error) => {
      clearTimeout(timeoutId);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("joinRoomError", handleJoinError);

      console.log("⚠️ joinRoom 에러:", error);
      this.scene.start("LobbyScene", {
        fromGame: true,
        roomId: this.roundData.roomId,
        players: this.roundData.players,
        hostId: this.roundData.hostId,
        maxPlayers: this.roundData.maxPlayers || 4,
        roomName: this.roundData.roomName || "대기실",
      });
    };

    socket.on("playerJoined", handlePlayerJoined);
    socket.on("joinRoomError", handleJoinError);

    socket.emit("joinRoom", {
      roomId: this.roundData.roomId,
      nickname: storedNickname,
      avatarKey: this.avatarKey || "player_1",
    });
  }

  resetSingleGame() {
    // 1. UI 그룹 청소 (카드, 텍스트 등)
    if (this.playerTableGroup) {
      this.playerTableGroup.removeAll(true);
    }

    // 2. 턴 및 상태 변수 초기화
    this.turnIndex = 0;
    this.isFlipping = false;
    this.canClick = true;

    // 3. 플레이어들의 카드 데이터 초기화 (처음 시작 장수로 리셋)
    // 예: 모든 플레이어에게 다시 20장씩 부여 (기존 게임 설정에 맞춰 조절)
    const initialCardCount = 25;
    this.roundData.players.forEach((p) => {
      p.cards = initialCardCount;
      p.remainingCards = initialCardCount;
      p.openCard = null;
      p.openStack = [];
      p.openStackCount = 0;
      p.isEliminated = false;
      p.isReady = true; // 싱글플레이어는 항상 준비 상태
    });

    this.initializeSingleDecks();

    // 4. 바닥에 깔린 카드 잔상 제거를 위한 렌더링
    this.renderTable(this.roundData.players);
    this.updateTurnEffect();

    this.addGameLog("게임을 다시 시작합니다!", "#2ecc71");
  }

  showSingleResultOverlay(players, result) {
    const { width, height } = this.cameras.main;

    // 기존 결과창이 있다면 제거
    if (this.resultContainer) this.resultContainer.destroy();

    this.resultContainer = this.add.container(0, -height).setDepth(3000);
    const container = this.resultContainer;

    // 배경 (이미지 키 'resultbg' 사용)
    const bg = this.add
      .image(width / 2, height * 0.4, "resultbg")
      .setDisplaySize(width * 1.2, height * 1.3);
    container.add(bg);

    // 결과 타이틀 (WIN / LOSE)
    /*const titleText = result === "WIN" ? "최종 승리!" : "패배...";
    const titleColor = result === "WIN" ? "#2ecc71" : "#e74c3c";
    const titleTxt = this.add
      .text(width / 2, height * 0.2, titleText, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.1}px`,
        color: titleColor,
        stroke: "#000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    container.add(titleTxt);*/

    // 플레이어 리스트
    players.forEach((p, i) => {
      const y = height * 0.35 + i * (height * 0.08);
      const isMe = p.id === (this.myId || "PLAYER_ME");

      const row = this.add.container(width / 2, y);
      const rankTxt = this.add
        .text(-width * 0.15, 0, `${i + 1}위`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: "#334155",
        })
        .setOrigin(0.5);

      const nameTxt = this.add
        .text(-width * 0.05, 0, isMe ? `${p.nickname}` : p.nickname, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: isMe ? "#22c55e" : "#0f172a",
          fontWeight: isMe ? "bold" : "normal",
        })
        .setOrigin(0, 0.5);

      row.add([rankTxt, nameTxt]);
      container.add(row);
    });

    // --- 버튼 영역 ---
    const btnY = height * 0.7;
    const exitBtnY = height * 0.8;

    // 1. 다시 시작 버튼
    const restartBtn = this.add
      .image(width / 2, btnY, "uibtn")
      .setDisplaySize(width * 0.5, height * 0.08)
      .setTint(0xe67e22)
      .setInteractive({ useHandCursor: true });
    const restartTxt = this.add
      .text(width / 2, btnY, "다시 하기", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // showSingleResultOverlay 내부 다시하기 버튼 수정
    restartBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });

      // 1. 모든 타이머와 트윈 중지
      this.time.removeAllEvents();
      this.tweens.killAll();

      // 2. 싱글플레이 데이터 초기화 함수 호출 (아래 2번 참고)
      this.resetSingleGame();

      // 3. 결과창 제거
      if (this.resultContainer) {
        this.resultContainer.destroy();
        this.resultContainer = null;
      }

      // 4. 게임 다시 시작 연출부터 진행
      this.playReadyGoSequence(() => {
        this.isGameStarted = true;
        this.isGameReady = true;
        this.nextTurn();
      });
    });

    // 2. 나가기 버튼
    const exitBtn = this.add
      .image(width / 2, exitBtnY, "uibtn")
      .setDisplaySize(width * 0.5, height * 0.08)
      .setInteractive({ useHandCursor: true });
    const exitTxt = this.add
      .text(width / 2, exitBtnY, "로비로", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    exitBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.returnToLobby({ rejoinRoom: false });
    });

    container.add([restartBtn, restartTxt, exitBtn, exitTxt]);

    // 등장 애니메이션
    this.tweens.add({
      targets: container,
      y: 0,
      duration: 800,
      ease: "Back.easeOut",
    });
  }

  handleFlipCard() {
    if (!this.roundData || !this.roundData.players) return;

    if (this.isSpecialCardPauseActive && this.isSpecialCardPauseActive()) {
      const hasThunder =
        typeof this.hasThunderOnTable === "function"
          ? this.hasThunderOnTable()
          : false;
      if (!hasThunder) return;
    }

    // 💡 1. 게임 시작 연출 중이면 무시
    if (this.canClick === false) {
      console.log("⏳ 아직 시작 연출 중입니다.", {
        canClick: this.canClick,
        turnIndex: this.turnIndex,
        mySocketId: socket.id,
        players: this.roundData?.players?.map((p) => p.id),
      });
      return;
    }

    // 💡 2. 이미 뒤집는 중이면 무시 (연타 방지)
    if (this.isFlipping === true) return;

    if (this.myTurnTimer) {
      this.myTurnTimer.remove();
      this.myTurnTimer = null;
    }

    // 턴 인덱스 보정 (undefined 방지)
    if (typeof this.turnIndex !== "number") this.turnIndex = 0;

    const currentPlayer = this.roundData.players[this.turnIndex];
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;

    if (!currentPlayer || currentPlayer.id !== myId) {
      console.warn("flipBlock: turn mismatch", {
        myId,
        currentPlayerId: currentPlayer && currentPlayer.id,
        turnIndex: this.turnIndex,
        players: this.roundData?.players?.map((p) => p.id),
      });
      this.showToast("당신의 차례가 아닙니다!", "#e74c3c");
      this.canClick = true;
      return;
    }

    if (this.isTutorialMode && this.tutorialState?.requireBellSuccess) {
      this.showToast("먼저 종을 눌러보세요!", "#f1c40f");
      return;
    }

    // 내 차례 검증이 끝난 뒤에만 입력 잠금
    this.canClick = false;

    // --- 클라이언트 잠금 ---
    this.isFlipping = true;

    if (this.isSingle) {
      this.processSingleFlip(myId);
    } else {
      socket.emit("flipCard");
    }

    // 서버 응답이 오지 않더라도 1초 뒤에는 잠금을 강제로 풀어줌 (안전장치)
    this.time.delayedCall(1000, () => {
      this.isFlipping = false;
    });
  }

  // 종 치기 요청 (누구나 언제든 실행 가능)
  handleRingBell() {
    // 1. 게임 준비 상태 확인
    if (!this.isGameReady) return;

    if (this.isSpecialCardPauseActive && this.isSpecialCardPauseActive()) {
      // thunder card should override the pause and allow bell presses
      const hasThunder =
        typeof this.hasThunderOnTable === "function"
          ? this.hasThunderOnTable()
          : false;
      if (!hasThunder) {
        return;
      }
    }

    if (this.isTutorialMode && this.tutorialState?.forbidBell) {
      this.showToast("폭탄 카드일 땐 종을 누를 수 없어요!", "#f97316");
      return;
    }

    const hasOpenCards = Array.isArray(this.roundData?.players)
      ? this.roundData.players.some((player) => {
          const hasOpenStack =
            Array.isArray(player?.openStack) && player.openStack.length > 0;
          const hasOpenCard = Boolean(player?.openCard);
          return hasOpenStack || hasOpenCard;
        })
      : false;

    if (!hasOpenCards) {
      return;
    }

    if (!this.isSingle) {
      const me = this.roundData.players.find((p) => p.id === socket.id);
      if (me && me.isEliminated) return;
    }

    // 2. 종 애니메이션 (반응 속도감을 위해 공통 실행)
    if (this.bellImage) {
      if (this.bellPressTween) {
        this.bellPressTween.stop();
        this.bellPressTween = null;
      }
      const baseScaleX =
        this.bellImage.getData("bellBaseScaleX") ?? this.bellImage.scaleX;
      const baseScaleY =
        this.bellImage.getData("bellBaseScaleY") ?? this.bellImage.scaleY;
      this.bellImage.setScale(baseScaleX, baseScaleY);
      this.bellPressTween = this.tweens.add({
        targets: this.bellImage,
        scaleX: baseScaleX * 0.9,
        scaleY: baseScaleY * 0.9,
        duration: 60,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.bellImage.setScale(baseScaleX, baseScaleY);
          this.bellPressTween = null;
        },
      });
    }

    if (this.cache.audio.exists("bell")) {
      this.sound.play("bell", { volume: 0.2 });
    }

    if (this.isSingle) {
      const totals = this.calculateTotalFruits();
      const isFive = Object.values(totals).some((count) => count === 5);
      const hasThunder = this.hasThunderOnTable();
      const hasBomb = this.hasBombOnTable();
      const hasNot5 = this.hasNot5OnTable ? this.hasNot5OnTable() : false;

      // bomb이 테이블에 있으면 어떤 경우에도 종은 실패
      if (hasBomb) {
        this.playFailureEffect();
        this.processPenaltySingle(this.myId || "PLAYER_ME");
        return;
      }

      const successWindow = hasThunder || (hasNot5 ? !isFive : isFive);

      if (successWindow) {
        // 💥 성공 시 스펙타클한 이펙트 추가
        this.playSuccessEffect();

        this.processSingleBell(this.myId || "PLAYER_ME");
      } else {
        // 💡 실패 시 페널티 로직 실행
        this.processPenaltySingle(this.myId || "PLAYER_ME");
      }
    } else {
      const hasBomb = this.hasBombOnTable();
      if (hasBomb) {
        // UX: 즉시 실패 이펙트 보여주고 서버로도 요청 보내어 일관된 상태 유지
        this.playFailureEffect();
        socket.emit("ringBell");
        return;
      }

      // ── 즉시 정답/실패 시각 피드백 (네트워크 대기 중) ──
      // 서버 판단과 100% 일치하지 않을 수 있지만, 사용자 경험 개선을
      // 위해 가능한 경우 결과를 미리 보여준다.
      try {
        const totals = this.calculateTotalFruits && this.calculateTotalFruits();
        const isFive = totals
          ? Object.values(totals).some((c) => c === 5)
          : false;
        const hasThunder = this.hasThunderOnTable && this.hasThunderOnTable();
        const hasNot5 = this.hasNot5OnTable ? this.hasNot5OnTable() : false;
        const successWindow = hasThunder || (hasNot5 ? !isFive : isFive);
        if (successWindow) {
          // 플레이어가 정답일 가능성이 높으므로 즉시 성공 이펙트만 재생
          this.playSuccessEffect();
        } else {
          this.playFailureEffect();
        }
      } catch (e) {
        console.warn("handleRingBell optimistic feedback failed", e);
      }

      socket.emit("ringBell");
    }
  }

  activateTutorialGuide() {
    if (!this.isTutorialMode) return;

    const rewardCoins = Number(this.tutorialConfig?.rewardCoins);
    this.tutorialState = {
      stageIndex: 0,
      currentStageKey: TUTORIAL_STAGE_CONFIGS[0]?.key || "flip",
      pointerObjects: [],
      rewardCoins: Number.isFinite(rewardCoins) ? rewardCoins : 80,
      requireBellSuccess: false,
      expectedBellType: null,
      forbidBell: false,
      stageRewardsTotal: 0,
      completedStages: new Set(),
      pendingTimers: [],
      pendingBombFollowup: false,
      awaitingPreThunderFlip: false,
      awaitingBombCover: false,
      awaitingWrongBellPlayerFlip: false,
      awaitingWrongBellAiFlip: false,
      requireWrongBellPenalty: false,
    };

    this.setTutorialStage(0);
  }

  getTutorialStageConfig(index = this.tutorialState?.stageIndex || 0) {
    return TUTORIAL_STAGE_CONFIGS[index] || null;
  }

  setTutorialStage(nextIndex) {
    if (!this.isTutorialMode || !this.tutorialState) return;
    if (!Number.isInteger(nextIndex))
      nextIndex = this.tutorialState.stageIndex || 0;

    if (nextIndex >= TUTORIAL_STAGE_CONFIGS.length || nextIndex < 0) {
      this.tutorialState.currentStageKey = null;
      return;
    }

    this.tutorialState.stageIndex = nextIndex;
    const stageConfig = this.getTutorialStageConfig(nextIndex);
    this.tutorialState.currentStageKey = stageConfig?.key || null;
    this.tutorialState.requireBellSuccess = false;
    this.tutorialState.expectedBellType = null;
    this.tutorialState.forbidBell = false;
    this.tutorialState.pendingBombFollowup = false;
    this.tutorialState.awaitingPreThunderFlip = false;
    this.tutorialState.awaitingBombCover = false;
    this.tutorialState.awaitingWrongBellPlayerFlip = false;
    this.tutorialState.awaitingWrongBellAiFlip = false;
    this.tutorialState.requireWrongBellPenalty = false;
    this.clearTutorialPendingTimers();

    if (stageConfig) {
      this.showTutorialMessage(stageConfig);
      this.prepareTutorialScenario(stageConfig.key);
    }
  }

  prepareTutorialScenario(stageKey) {
    if (!this.isTutorialMode || !stageKey) return;
    switch (stageKey) {
      case "flip":
        this.clearTutorialTable();
        this.setTutorialTurn(this.myId || "PLAYER_ME");
        this.canClick = true;
        break;
      case "ringFive":
        this.prepareRingFiveScenario();
        break;
      case "wrongBell":
        this.prepareWrongBellScenario();
        break;
      case "bomb":
        this.prepareBombScenario();
        break;
      case "thunder":
        this.prepareThunderScenario();
        break;
      case "plus1":
        this.preparePlusOneScenario();
        break;
      default:
        break;
    }
  }

  completeTutorialStage(stageKey) {
    if (!this.isTutorialMode || !this.tutorialState) return;
    if (!stageKey) return;

    if (!this.tutorialState.completedStages) {
      this.tutorialState.completedStages = new Set();
    }

    if (this.tutorialState.completedStages.has(stageKey)) {
      return;
    }

    this.tutorialState.completedStages.add(stageKey);
    const stageConfig = TUTORIAL_STAGE_CONFIGS.find((s) => s.key === stageKey);
    const reward = stageConfig?.reward || 0;
    if (reward > 0) {
      this.rewardTutorialCoins(reward, `${stageConfig.title} 완료`);
    }

    const nextIndex = (this.tutorialState.stageIndex || 0) + 1;
    if (nextIndex < TUTORIAL_STAGE_CONFIGS.length) {
      this.setTutorialStage(nextIndex);
    } else {
      this.tutorialState.currentStageKey = null;
      this.tutorialState.requireBellSuccess = false;
      this.tutorialState.expectedBellType = null;
      this.showTutorialCompletionOverlay();
    }
  }

  rewardTutorialCoins(amount, reason) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!this.tutorialState) return;

    this.tutorialState.stageRewardsTotal =
      (this.tutorialState.stageRewardsTotal || 0) + amount;

    if (!this.myProfile) this.myProfile = {};
    const prev = Number(this.myProfile.coins) || 0;
    this.myProfile.coins = prev + amount;
    if (typeof this.updateMyProfileUI === "function") {
      this.updateMyProfileUI();
    }

    this.showToast(`보상 ${amount}💰 (${reason})`, "#22c55e");

    try {
      this.safeSyncInventory("tutorialStageReward", {
        coins: amount,
        reason,
      });
    } catch (e) {
      console.warn("tutorial stage reward sync failed", e);
    }
  }

  clearTutorialTable() {
    if (!Array.isArray(this.roundData?.players)) return;
    this.roundData.players.forEach((p) => {
      p.openStack = [];
      p.openCard = null;
      p.openStackCount = 0;
    });
    this.renderTable(this.roundData.players);
  }

  forceNextCardForPlayer(playerId, card) {
    if (!card || !playerId) return;
    const deck = this.getSingleDeck(playerId);
    deck.push({ ...card });
    const player = this.roundData.players.find((p) => p.id === playerId);
    if (player) {
      player.cards = (Number(player.cards) || 0) + 1;
      player.remainingCards = player.cards;
    }
  }

  prepareRingFiveScenario() {
    const myId = this.myId || "PLAYER_ME";
    const tutor = this.roundData.players.find((p) => p.id !== myId);
    if (!tutor) return;

    this.clearTutorialTable();
    this.setTutorialTurn(myId);
    this.canClick = true;
    this.tutorialState.expectingPlayerFlipForFive = true;
    this.tutorialState.expectingAiFive = false;
    this.tutorialState.requireBellSuccess = false;
    this.tutorialState.expectedBellType = null;
    this.forceNextCardForPlayer(myId, { fruit: 1, count: 2 });
    this.forceNextCardForPlayer(tutor.id, { fruit: 1, count: 3 });
  }

  prepareWrongBellScenario() {
    const myId = this.myId || "PLAYER_ME";
    const tutor = this.roundData.players.find((p) => p.id !== myId);
    if (!tutor) return;

    this.clearTutorialTable();
    this.setTutorialTurn(myId);
    this.canClick = true;
    this.tutorialState.awaitingWrongBellPlayerFlip = true;
    this.tutorialState.awaitingWrongBellAiFlip = false;
    this.tutorialState.requireWrongBellPenalty = false;
    this.tutorialState.requireBellSuccess = false;
    this.tutorialState.expectedBellType = null;
    this.tutorialState.forbidBell = true;
    this.forceNextCardForPlayer(myId, { fruit: 1, count: 3 });
    this.forceNextCardForPlayer(tutor.id, { fruit: 1, count: 1 });
  }

  prepareBombScenario() {
    const myId = this.myId || "PLAYER_ME";
    const tutor = this.roundData.players.find((p) => p.id !== myId);
    this.clearTutorialTable();
    this.setTutorialTurn(myId);
    this.canClick = true;
    this.tutorialState.forbidBell = true;
    this.tutorialState.awaitingBombFlip = true;
    this.tutorialState.pendingBombFollowup = false;
    this.tutorialState.awaitingBombCover = false;
    this.forceNextCardForPlayer(myId, { fruit: 3, count: 2 });
    this.forceNextCardForPlayer(myId, { type: BOMB_CARD_TYPE });
    if (tutor) {
      this.forceNextCardForPlayer(tutor.id, { fruit: 2, count: 5 });
    }
  }

  prepareThunderScenario() {
    const myId = this.myId || "PLAYER_ME";
    const tutor = this.roundData.players.find((p) => p.id !== myId);
    if (!tutor) return;

    this.clearTutorialTable();
    this.setTutorialTurn(myId);
    this.forceNextCardForPlayer(myId, { fruit: 3, count: 3 });
    this.forceNextCardForPlayer(tutor.id, { type: THUNDER_CARD_TYPE });
    this.tutorialState.requireBellSuccess = false;
    this.tutorialState.expectedBellType = null;
    this.tutorialState.awaitingPreThunderFlip = true;
    this.canClick = true;
  }

  preparePlusOneScenario() {
    const myId = this.myId || "PLAYER_ME";
    const tutor = this.roundData.players.find((p) => p.id !== myId);
    if (!tutor) return;

    this.clearTutorialTable();
    this.setTutorialTurn(myId);
    this.forceNextCardForPlayer(myId, { type: PLUS1_CARD_TYPE });
    this.forceNextCardForPlayer(tutor.id, { fruit: 2, count: 4 });
    this.canClick = true;
    this.tutorialState.awaitingPlusOneFlip = true;
    this.tutorialState.waitingForPlusOneBell = false;
    this.tutorialState.requireBellSuccess = false;
    this.tutorialState.expectedBellType = null;
  }

  setTutorialTurn(playerId) {
    if (!this.isTutorialMode || !playerId) return;
    if (!Array.isArray(this.roundData?.players)) return;
    const idx = this.roundData.players.findIndex((p) => p.id === playerId);
    if (idx >= 0) {
      this.turnIndex = idx;
      this.updateTurnEffect();
    }
  }

  scheduleTutorialFlip(playerId, delay = 500) {
    if (!this.isTutorialMode || !playerId) return;
    const timer = this.time.delayedCall(delay, () => {
      this.removeTrackedTutorialTimer(timer);
      if (!this.isGameStarted) return;
      this.setTutorialTurn(playerId);
      this.processSingleFlip(playerId);
    });
    this.trackTutorialTimer(timer);
  }

  trackTutorialTimer(timer) {
    if (!this.tutorialState) return;
    if (!Array.isArray(this.tutorialState.pendingTimers)) {
      this.tutorialState.pendingTimers = [];
    }
    if (timer) {
      this.tutorialState.pendingTimers.push(timer);
    }
  }

  removeTrackedTutorialTimer(timer) {
    if (!timer || !Array.isArray(this.tutorialState?.pendingTimers)) return;
    const idx = this.tutorialState.pendingTimers.indexOf(timer);
    if (idx >= 0) {
      this.tutorialState.pendingTimers.splice(idx, 1);
    }
  }

  clearTutorialPendingTimers() {
    if (!Array.isArray(this.tutorialState?.pendingTimers)) return;
    this.tutorialState.pendingTimers.forEach((timer) => {
      if (timer && typeof timer.remove === "function") {
        timer.remove();
      }
    });
    this.tutorialState.pendingTimers = [];
  }

  showTutorialMessage({ title, description, pointer = null }) {
    if (!this.isTutorialMode) return;
    const { width, height } = this.cameras.main;

    if (!this.tutorialState) {
      this.tutorialState = {
        step: 0,
        pointerObjects: [],
        rewardCoins: 80,
        requireBellSuccess: false,
      };
    }

    if (!this.tutorialState.overlay) {
      const container = this.add
        .container(width / 2, height * 0.92)
        .setDepth(9000);
      const bg = this.add
        .rectangle(0, 0, width * 0.92, height * 0.13, 0x020617, 0.92)
        .setOrigin(0.5)
        .setStrokeStyle(4, 0x38bdf8, 0.85);
      const titleText = this.add
        .text(0, -height * 0.03, title || "", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          color: "#f8fafc",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 5,
        })
        .setOrigin(0.5);
      const descText = this.add
        .text(0, height * 0.02, description || "", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#e2e8f0",
          align: "center",
          wordWrap: { width: width * 0.78 },
          stroke: "#000",
          strokeThickness: 4,
        })
        .setOrigin(0.5);

      container.add([bg, titleText, descText]);
      this.tutorialState.overlay = container;
      this.tutorialState.overlayBg = bg;
      this.tutorialState.titleText = titleText;
      this.tutorialState.descText = descText;
    } else {
      this.tutorialState.overlay.setPosition(width / 2, height * 0.92);
    }

    if (title && this.tutorialState.titleText) {
      this.tutorialState.titleText.setText(title);
    }
    if (description && this.tutorialState.descText) {
      this.tutorialState.descText.setText(description);
    }

    this.updateTutorialPointer(pointer);
  }

  initQuestSystem() {
    if (!this.isSingle || this.isTutorialMode) {
      this.teardownQuestUI();
      return;
    }

    this.teardownQuestUI();
    const snapshot = this.loadQuestProgressSnapshot();
    this.questState = {
      progress: snapshot,
      container: null,
      rows: {},
    };
    this.renderQuestPanel();
  }

  teardownQuestUI() {
    if (this.questState?.container) {
      this.questState.container.destroy();
    }
    if (this.questState) {
      this.questState.container = null;
      this.questState.rows = {};
    }
    this.questState = null;
  }

  loadQuestProgressSnapshot() {
    const safe = {};
    let stored = {};
    try {
      stored = JSON.parse(
        localStorage.getItem(QUEST_PROGRESS_STORAGE_KEY) || "{}",
      );
    } catch (e) {
      stored = {};
    }

    QUEST_CONFIGS.forEach((quest) => {
      const raw = stored[quest.key] || {};
      let count = Math.max(0, Number(raw.count) || 0);
      let stage = Math.max(0, Number(raw.stage) || 0);
      const ready = Boolean(raw.ready);
      let runtime = buildQuestRuntime(quest, { stage, count: 0 });
      const loopGuard = 50;
      let guard = 0;
      while (!ready && count >= runtime.target && guard < loopGuard) {
        count -= runtime.target;
        stage += 1;
        runtime = buildQuestRuntime(quest, { stage, count: 0 });
        guard += 1;
      }
      const entry = {
        count,
        stage,
        ready: ready && runtime ? true : false,
      };
      safe[quest.key] = entry;
    });
    return safe;
  }

  saveQuestProgressSnapshot() {
    if (!this.questState) return;
    try {
      const payload = {};
      QUEST_CONFIGS.forEach((quest) => {
        const entry = this.questState.progress?.[quest.key];
        payload[quest.key] = {
          count: entry ? entry.count : 0,
          stage: entry ? entry.stage || 0 : 0,
          ready: Boolean(entry?.ready),
        };
      });
      localStorage.setItem(QUEST_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("failed to save quest progress", e);
    }
  }

  getQuestRuntimeState(key) {
    if (!this.questState) return null;
    const quest = QUEST_CONFIG_MAP[key];
    const entry = this.questState.progress?.[key];
    if (!quest || !entry) return null;
    const runtime = buildQuestRuntime(quest, entry);
    return { quest, entry, ...runtime };
  }

  renderQuestPanel() {
    if (!this.questState || !QUEST_CONFIGS.length) return;
    if (this.questState.container) {
      this.questState.container.destroy();
    }

    const { width, height } = this.cameras.main;
    const panelWidth = Math.min(width * 0.4, 400);
    const rowHeight = Math.max(height * 0.05, 40);
    const padding = 16;
    const extraPadding = Math.max(12, rowHeight * 0.35);
    const headerHeight = 0;
    const panelHeight =
      padding * 2 +
      extraPadding * 2 +
      headerHeight +
      QUEST_CONFIGS.length * (rowHeight + 6);

    const container = this.add
      .container(width * 0.03, height * 0.55)
      .setDepth(1600);
    container.add([]);

    this.questState.container = container;
    this.questState.rows = {};

    QUEST_CONFIGS.forEach((quest, index) => {
      const rowY =
        padding + extraPadding + headerHeight + index * (rowHeight + 6);
      const rowWidth = panelWidth - padding * 2;
      const row = this.add.container(padding, rowY).setDepth(1601 + index * 2);
      const rowBgPaddingX = Math.max(8, rowWidth * 0.06);
      const rowBgPaddingY = Math.max(4, rowHeight * 0.18);
      const rowBg = this.add
        .image(-rowBgPaddingX, -rowBgPaddingY, "roombg")
        .setOrigin(0, 0)
        .setDisplaySize(
          rowWidth + rowBgPaddingX * 2,
          rowHeight + rowBgPaddingY * 2,
        );
      const rowText = this.add
        .text(12, rowHeight / 2, "", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.max(14, width * 0.03)}px`,
          color: "#f8fafc",
        })
        .setOrigin(0, 0.5);
      rowText.setStroke("#0f172a", 3);
      rowText.y = rowHeight * 0.38;

      const barWidth = rowWidth - 24;
      const barHeight = Math.max(6, rowHeight * 0.18);
      const barY = rowHeight - barHeight * 1.45;
      const progressTrack = this.add
        .rectangle(12, barY, barWidth, barHeight, 0x0f172a, 0.75)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x1d4ed8, 0.55);
      const progressFill = this.add
        .rectangle(12, barY, barWidth, barHeight, 0x38bdf8, 0.95)
        .setOrigin(0, 0.5)
        .setScale(0, 1);
      const progressLabel = this.add
        .text(rowWidth - 12, barY, "0/0", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.max(12, width * 0.025)}px`,
          color: "#f8fafc",
        })
        .setOrigin(1, 0.5);
      progressLabel.setStroke("#0f172a", 3);

      const claimBtnWidth = Math.max(80, rowHeight * 1.5);
      const claimBtnHeight = rowHeight * 0.55;
      const claimBtn = this.add
        .container(rowWidth - claimBtnWidth * 0.48, rowHeight * 0.38)
        .setDepth(2000 + index * 2);
      const claimBg = this.add
        .image(0, 0, "ui_btn")
        .setOrigin(0.5)
        .setDisplaySize(claimBtnWidth * 0.8, claimBtnHeight);
      const claimLabel = this.add
        .text(0, 0, "", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.max(14, width * 0.03)}px`,
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      claimLabel.setStroke("#0f172a", 3);
      claimBtn.add([claimBg, claimLabel]);

      // press effect
      const pressScale = 0.9;
      [claimBg, claimLabel].forEach((obj) => {
        obj.on("pointerdown", () => {
          claimBtn.setScale(pressScale);
        });
        obj.on("pointerup", () => {
          claimBtn.setScale(1);
        });
        obj.on("pointerout", () => {
          claimBtn.setScale(1);
        });
      });

      const triggerClaim = () => this.handleQuestClaim(quest.key);
      claimBg
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", triggerClaim);
      claimLabel
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", triggerClaim);
      claimBtn.setVisible(false);

      row.add([
        rowBg,
        progressTrack,
        progressFill,
        rowText,
        progressLabel,
        claimBtn,
      ]);
      container.add(row);
      this.questState.rows[quest.key] = {
        text: rowText,
        bg: rowBg,
        barTrack: progressTrack,
        barFill: progressFill,
        barLabel: progressLabel,
        barWidth,
        claimBtn,
        claimBg,
        claimLabel,
      };
      this.refreshQuestRow(quest.key);
    });
  }

  refreshQuestRow(key) {
    if (!this.questState) return;
    const row = this.questState.rows?.[key];
    const state = this.getQuestRuntimeState(key);
    if (!row || !state) return;

    row.text.setText(state.title);
    row.text.setColor("#f8fafc");
    if (row.barLabel) {
      row.barLabel.setText(`${state.entry.count}/${state.target}`);
    }
    if (row.barFill) {
      const ratio = Math.max(
        0,
        Math.min(1, state.entry.count / Math.max(1, state.target)),
      );
      row.barFill.setScale(ratio, 1);
    }
    if (row.claimBtn) {
      const ready = Boolean(state.entry.ready);
      row.claimBtn.setVisible(true);
      row.claimBtn.setAlpha(ready ? 1 : 0.85);

      if (row.claimBg) {
        if (typeof row.claimBg.setFillStyle === "function") {
          row.claimBg.setFillStyle(
            ready ? 0x22c55e : 0x3b3f51,
            ready ? 0.95 : 0.65,
          );
        } else {
          // tint image button: yellow when ready, gray when not
          row.claimBg.setTint(ready ? 0xfacc15 : 0x6b7280);
          row.claimBg.setAlpha(ready ? 1 : 0.7);
        }
        if (ready) {
          if (!row.claimBg.input || !row.claimBg.input.enabled) {
            row.claimBg.setInteractive({ useHandCursor: true });
          }
          if (row.claimBg.input) {
            row.claimBg.input.cursor = "pointer";
          }
        } else if (row.claimBg.input && row.claimBg.input.enabled) {
          row.claimBg.disableInteractive();
        }
      }

      if (row.claimLabel) {
        const rewardText = state.quest.rewardCoins
          ? `💰${state.quest.rewardCoins}`
          : "받기";
        row.claimLabel.setText(rewardText);
        row.claimLabel.setAlpha(ready ? 1 : 0.65);
        row.claimLabel.setColor(ready ? "#f8fafc" : "#e2e8f0");
        if (ready) {
          if (!row.claimLabel.input || !row.claimLabel.input.enabled) {
            row.claimLabel.setInteractive({ useHandCursor: true });
          }
          if (row.claimLabel.input) {
            row.claimLabel.input.cursor = "pointer";
          }
        } else if (row.claimLabel.input && row.claimLabel.input.enabled) {
          row.claimLabel.disableInteractive();
        }
      }
    }
  }

  incrementQuestCounter(key, amount = 1) {
    if (!this.questState) return;
    const state = this.getQuestRuntimeState(key);
    if (!state || amount <= 0) return;
    if (state.entry.ready) return;

    state.entry.count = Math.min(
      state.target,
      state.entry.count + (Number(amount) || 0),
    );

    if (state.entry.count >= state.target) {
      state.entry.count = state.target;
      state.entry.ready = true;
      this.refreshQuestRow(key);
      this.saveQuestProgressSnapshot();
      this.onQuestReady(state);
    } else {
      this.refreshQuestRow(key);
      this.saveQuestProgressSnapshot();
    }
  }

  applyThresholdQuest(key, value) {
    if (!this.questState) return;
    const state = this.getQuestRuntimeState(key);
    if (!state || typeof state.threshold !== "number") return;
    if (state.entry.ready) return;
    if (Number(value) < state.threshold) return;
    this.incrementQuestCounter(key, 1);
  }

  tryAdvanceComboQuest() {
    if (!this.questState) return;
    const state = this.getQuestRuntimeState("combo_duo");
    if (!state || state.entry.ready) return;
    const myId = this.myId || "PLAYER_ME";
    if (!this.comboState || this.comboState.lastWinnerId !== myId) return;
    const comboCount = Math.max(0, Number(this.comboState.count) || 0);
    if (comboCount < state.target) return;
    const remaining =
      state.target - Math.min(state.target, state.entry.count || 0);
    if (remaining <= 0) return;
    this.incrementQuestCounter("combo_duo", remaining);
  }

  onQuestReady(state) {
    this.showToast(
      `${state.title} 완료! 수령 버튼을 눌러 보상을 받아요.`,
      "#22c55e",
    );
  }

  handleQuestClaim(key) {
    if (!this.questState) return;
    const state = this.getQuestRuntimeState(key);
    if (!state || !state.entry.ready) {
      this.showToast("아직 수령할 보상이 없어요!", "#f97316");
      return;
    }

    const { quest, entry, title } = state;
    const questKey = quest.key;
    if (quest.rewardCoins) {
      this.rewardQuestCoins(quest.rewardCoins, title, questKey);
    } else {
      this.showToast(`${title} 완료!`, "#22c55e");
    }

    entry.stage = (entry.stage || 0) + 1;
    entry.count = 0;
    entry.ready = false;

    this.saveQuestProgressSnapshot();
    this.refreshQuestRow(questKey);

    const nextState = this.getQuestRuntimeState(questKey);
    if (nextState) {
      this.showToast(`${nextState.title} 시작!`, "#38bdf8");
    }
  }

  handleQuestEvent(eventKey, payload = {}) {
    if (!this.questState || this.isTutorialMode) return;
    const myId = this.myId || "PLAYER_ME";
    switch (eventKey) {
      case "bellSuccess":
        this.incrementQuestCounter("bell_master", 1);
        if (typeof payload.cardsWon === "number") {
          this.applyThresholdQuest("big_haul", payload.cardsWon);
        }
        this.tryAdvanceComboQuest();
        break;
      case "penalty":
        this.incrementQuestCounter("penalty_runner", 1);
        break;
      case "bombOpened":
        this.incrementQuestCounter("bomb_flip", 1);
        break;
      case "thunderOpened":
        this.incrementQuestCounter("thunder_flip", 1);
        break;
      case "gameWin":
        this.incrementQuestCounter("final_victory", 1);
        break;
      default:
        break;
    }
  }

  rewardQuestCoins(amount, reason, questKey) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!this.myProfile) this.myProfile = {};
    const prev = Number(this.myProfile.coins) || 0;
    this.myProfile.coins = prev + amount;
    if (typeof this.updateMyProfileUI === "function") {
      this.updateMyProfileUI();
    }

    this.showToast(`퀘스트 보상 ${amount}💰 (${reason})`, "#22c55e");
    try {
      this.safeSyncInventory("questReward", {
        coins: amount,
        questKey,
      });
    } catch (e) {
      console.warn("quest reward sync failed", e);
    }
  }

  updateTutorialPointer(pointerKey) {
    if (!this.tutorialState) return;

    if (!Array.isArray(this.tutorialState.pointerObjects)) {
      this.tutorialState.pointerObjects = [];
    }

    this.tutorialState.pointerObjects.forEach((obj) => {
      if (!obj) return;
      this.tweens.killTweensOf(obj);
      obj.destroy();
    });
    this.tutorialState.pointerObjects = [];

    if (!pointerKey) return;

    const { width, height } = this.cameras.main;
    const pointerPositions = {
      deck: { x: width * 0.5, y: height * 0.78 },
      bell: { x: width * 0.5, y: height * 0.43 },
    };

    const pos = pointerPositions[pointerKey];
    if (!pos) return;

    const circle = this.add
      .circle(pos.x, pos.y, width * 0.09, 0xffffff, 0.1)
      .setStrokeStyle(5, 0xfff3c4, 0.8)
      .setDepth(9001);
    this.tutorialState.pointerObjects.push(circle);
    this.tweens.add({
      targets: circle,
      scale: { from: 0.85, to: 1.1 },
      alpha: { from: 0.45, to: 0.15 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const arrow = this.add
      .text(pos.x, pos.y - width * 0.1, "👇", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.08}px`,
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(9002);
    this.tutorialState.pointerObjects.push(arrow);
    this.tweens.add({
      targets: arrow,
      y: pos.y - width * 0.07,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  handleTutorialAfterFlip(playerId) {
    if (!this.isTutorialMode || !this.tutorialState) return;

    const myId = this.myId || "PLAYER_ME";
    const isMe = playerId === myId;
    const stageKey = this.tutorialState.currentStageKey;
    if (!stageKey) return;

    if (stageKey === "flip" && isMe) {
      this.completeTutorialStage("flip");
      return;
    }

    if (stageKey === "ringFive") {
      if (isMe && this.tutorialState.expectingPlayerFlipForFive) {
        this.tutorialState.expectingPlayerFlipForFive = false;
        this.tutorialState.expectingAiFive = true;
        this.showTutorialMessage({
          title: "좋아요!",
          description: "AI가 카드를 내서 합계가 5가 되면 종을 눌러요.",
        });
        const tutor = this.roundData.players.find((p) => p.id !== myId);
        if (tutor) {
          this.scheduleTutorialFlip(tutor.id, 3000);
        }
        return;
      }

      if (!isMe && this.tutorialState.expectingAiFive) {
        const totals = this.calculateTotalFruits();
        const hasFive = Object.values(totals).some((count) => count === 5);
        const hasBomb = this.hasBombOnTable();
        if (hasFive && !hasBomb) {
          this.tutorialState.expectingAiFive = false;
          this.tutorialState.requireBellSuccess = true;
          this.tutorialState.expectedBellType = "ringFive";
          this.showTutorialMessage({
            title: "지금이 기회!",
            description: "바닥 합이 5개입니다. 종을 눌러 카드를 가져가세요!",
            pointer: "bell",
          });
        }
        return;
      }
    }

    if (stageKey === "bomb" && isMe && this.tutorialState.awaitingBombCover) {
      this.tutorialState.awaitingBombCover = false;
      this.tutorialState.forbidBell = false;
      this.tutorialState.requireBellSuccess = true;
      this.tutorialState.expectedBellType = "bombSafe";
      this.showTutorialMessage({
        title: "폭탄이 가려졌어요!",
        description:
          "이제 폭탄이 보이지 않으니 합계 5일 때 종을 눌러 카드를 가져가요!",
        pointer: "bell",
      });
      return;
    }

    if (stageKey === "wrongBell") {
      if (isMe && this.tutorialState.awaitingWrongBellPlayerFlip) {
        this.tutorialState.awaitingWrongBellPlayerFlip = false;
        this.tutorialState.awaitingWrongBellAiFlip = true;
        this.canClick = false;
        this.showTutorialMessage({
          title: "과일 숫자를 살펴봐요",
          description:
            "지금은 합계가 3장입니다. AI가 한 장을 더 내려줄 때까지 기다려요.",
        });
        const tutor = this.roundData.players.find((p) => p.id !== myId);
        if (tutor) {
          this.scheduleTutorialFlip(tutor.id, 3000);
        }
        return;
      }

      if (!isMe && this.tutorialState.awaitingWrongBellAiFlip) {
        this.tutorialState.awaitingWrongBellAiFlip = false;
        this.tutorialState.requireWrongBellPenalty = true;
        this.tutorialState.forbidBell = false;
        this.setTutorialTurn(myId);
        this.canClick = false;
        this.showTutorialMessage({
          title: "이번엔 일부러 틀려봐요",
          description:
            "바닥 합계가 5가 아닐때 종을 누르면 패널티가 받아요. 눌러보세요!",
          pointer: "bell",
        });
        return;
      }
    }

    if (stageKey === "thunder" && isMe) {
      if (this.tutorialState.awaitingPreThunderFlip) {
        this.tutorialState.awaitingPreThunderFlip = false;
        this.canClick = false;
        this.showTutorialMessage({
          title: "준비하세요",
          description:
            "내 카드는 3장이지만 상대가 번개를 내면 합계 5가 아니어도 종을 눌러야 해요.",
        });
        const tutor = this.roundData.players.find((p) => p.id !== myId);
        if (tutor) {
          this.scheduleTutorialFlip(tutor.id, 3000);
        }
        return;
      }
    }

    if (
      stageKey === "plus1" &&
      !isMe &&
      this.tutorialState.waitingForPlusOneBell
    ) {
      const totals = this.calculateTotalFruits();
      const hasFive = Object.values(totals).some((count) => count === 5);
      const hasBomb = this.hasBombOnTable();
      if (hasFive && !hasBomb) {
        this.tutorialState.requireBellSuccess = true;
        this.tutorialState.expectedBellType = "plus1";
        this.showTutorialMessage({
          title: "+1 효과!",
          description:
            "카드 숫자에 +1이 적용되어 5가 되었습니다. 종을 눌러보세요!",
          pointer: "bell",
        });
      }
    }
  }

  handleTutorialCardDrawn(playerId, card) {
    if (!this.isTutorialMode || !this.tutorialState) return;
    const myId = this.myId || "PLAYER_ME";
    const isMe = playerId === myId;
    const stageKey = this.tutorialState.currentStageKey;
    if (!stageKey) return;

    if (stageKey === "bomb" && isMe && card?.type === BOMB_CARD_TYPE) {
      this.tutorialState.awaitingBombFlip = false;
      this.tutorialState.pendingBombFollowup = true;
      this.tutorialState.awaitingBombCover = false;
      this.canClick = false;
      this.showTutorialMessage({
        title: "폭탄 등장!",
        description:
          "폭탄이 깔린 동안에는 합이 5가 되어도 종을 누르면 실패예요. 잠시만 기다려요.",
        pointer: null,
      });
      const tutor = this.roundData.players.find((p) => p.id !== myId);
      if (tutor) {
        this.scheduleTutorialFlip(tutor.id, 3000);
      } else {
        this.time.delayedCall(3000, () => {
          this.tutorialState.forbidBell = false;
          this.tutorialState.pendingBombFollowup = false;
          this.completeTutorialStage("bomb");
        });
      }
      return;
    }

    if (
      stageKey === "bomb" &&
      !isMe &&
      this.tutorialState.pendingBombFollowup
    ) {
      const totals = this.calculateTotalFruits();
      const hasFive = Object.values(totals).some((count) => count === 5);
      if (hasFive || card?.count === 5) {
        this.tutorialState.pendingBombFollowup = false;
        this.tutorialState.awaitingBombCover = true;
        this.tutorialState.forbidBell = true;
        this.canClick = true;
        this.setTutorialTurn(myId);
        this.showTutorialMessage({
          title: "아직은 금지!",
          description:
            "상대 카드가 5여도 폭탄이 보이는 동안엔 종을 누르면 안 돼요. 내 덱을 한 번 더 눌러 폭탄을 덮어보세요!",
          pointer: "deck",
        });
      }
      return;
    }

    if (stageKey === "thunder" && !isMe && card?.type === THUNDER_CARD_TYPE) {
      if (this.hasBombOnTable()) {
        return;
      }
      this.tutorialState.requireBellSuccess = true;
      this.tutorialState.expectedBellType = "thunder";
      this.showTutorialMessage({
        title: "번개 카드!",
        description:
          "내가 낸 카드는 3이라 합이 5가 아니어도 번개가 나오면 즉시 종을 쳐서 카드를 가져가요!",
        pointer: "bell",
      });
      return;
    }

    if (stageKey === "plus1" && isMe && card?.type === PLUS1_CARD_TYPE) {
      this.tutorialState.awaitingPlusOneFlip = false;
      this.tutorialState.waitingForPlusOneBell = true;
      this.showTutorialMessage({
        title: "+1 활성화",
        description:
          "이제 바닥 모든 카드 숫자에 +1이 적용됩니다. 합계를 잘 살펴보세요!",
      });
      this.canClick = false;
      const tutor = this.roundData.players.find((p) => p.id !== myId);
      if (tutor) {
        this.scheduleTutorialFlip(tutor.id, 3000);
      }
    }
  }

  handleTutorialBellResolved(winnerId) {
    if (!this.isTutorialMode || !this.tutorialState) return;

    const myId = this.myId || "PLAYER_ME";
    if (winnerId !== myId) return;
    if (!this.tutorialState.requireBellSuccess) return;

    const stageKey = this.tutorialState.currentStageKey;
    const expectedType = this.tutorialState.expectedBellType;

    if (stageKey === "ringFive" && expectedType === "ringFive") {
      this.tutorialState.requireBellSuccess = false;
      this.tutorialState.expectedBellType = null;
      this.completeTutorialStage("ringFive");
      return;
    }

    if (stageKey === "bomb" && expectedType === "bombSafe") {
      this.tutorialState.requireBellSuccess = false;
      this.tutorialState.expectedBellType = null;
      this.completeTutorialStage("bomb");
      return;
    }

    if (stageKey === "thunder" && expectedType === "thunder") {
      this.tutorialState.requireBellSuccess = false;
      this.tutorialState.expectedBellType = null;
      this.completeTutorialStage("thunder");
      return;
    }

    if (stageKey === "plus1" && expectedType === "plus1") {
      this.tutorialState.requireBellSuccess = false;
      this.tutorialState.expectedBellType = null;
      this.tutorialState.waitingForPlusOneBell = false;
      this.completeTutorialStage("plus1");
    }
  }

  showTutorialCompletionOverlay() {
    if (!this.isTutorialMode || !this.tutorialState) return;
    if (this.tutorialState.completionShown) return;
    this.tutorialState.completionShown = true;

    this.updateTutorialPointer(null);
    this.clearTutorialPendingTimers();
    if (this.tutorialState.overlay) {
      this.tutorialState.overlay.destroy();
      this.tutorialState.overlay = null;
    }

    const { width, height } = this.cameras.main;
    const container = this.add.container(0, 0).setDepth(10000);
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setInteractive();
    const panel = this.add
      .image(width / 2, height / 2, "profilebg")
      .setDisplaySize(width * 0.8, height * 0.45);

    const title = this.add
      .text(width / 2, height * 0.36, "튜토리얼 완료!", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.075}px`,
        color: "#ffe082",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const desc = this.add
      .text(
        width / 2,
        height * 0.45,
        "게임방법을 완벽하게 익혔어요!\n싱글플레이를 통해\n실력을 쌓아보세요!",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.045}px`,
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width * 0.6 },
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5);

    /*const stageBonus = this.tutorialState.stageRewardsTotal || 0;
    const stageBonusText = this.add
      .text(width / 2, height * 0.47, `단계 보상 합계: +${stageBonus} 코인`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        color: "#facc15",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);*/

    const reward = this.tutorialState.rewardCoins || 80;
    const rewardText = this.add
      .text(width / 2, height * 0.53, `추가보상: +${reward} 코인`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#22c55e",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const confirmBtn = this.add
      .image(width / 2, height * 0.62, "ui_btn")
      .setDisplaySize(width * 0.35, height * 0.07)
      .setTint(0x22c55e)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add
      .text(width / 2, height * 0.62, "보상 받기", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    container.add([
      dim,
      panel,
      title,
      desc,
      //stageBonusText,
      rewardText,
      confirmBtn,
      confirmTxt,
    ]);

    const finalizeTutorial = () => {
      this.sound.play("btn", { volume: 0.12 });
      this.hasCompletedTutorial = true;
      try {
        localStorage.setItem(TUTORIAL_STATE_KEY, "true");
      } catch (e) {
        console.warn("failed to persist tutorial completion", e);
      }

      try {
        this.safeSyncInventory("tutorialReward", { coins: reward });
      } catch (e) {
        console.warn("tutorial reward sync failed", e);
      }

      this.isGameStarted = false;
      this.canClick = false;
      this.time.removeAllEvents();

      container.destroy();
      this.scene.start("LobbyScene", {
        fromTutorial: true,
        tutorialCompleted: true,
        rewardCoins: reward,
      });
    };

    confirmBtn.on("pointerdown", () => {
      this.tweens.add({
        targets: [confirmBtn, confirmTxt],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 90,
        yoyo: true,
        onComplete: finalizeTutorial,
      });
    });
  }

  playThiefAnimation({
    byId,
    fromIds = [],
    players = this.roundData.players,
    onComplete,
  } = {}) {
    if (!Array.isArray(players) || players.length === 0) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const { width, height } = this.cameras.main;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const myIndex = players.findIndex((p) => p.id === myId);
    const targetIdx = players.findIndex((p) => p.id === byId);
    if (targetIdx === -1) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const playerCount = players.length;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75 },
            { x: width * 0.5, y: height * 0.18 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.89, y: height * 0.45 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.5, y: height * 0.18 },
              { x: width * 0.89, y: height * 0.45 },
            ];

    const relTargetIdx =
      (targetIdx - myIndex + players.length) % players.length;
    const targetPos = pos[relTargetIdx];

    // Prepare start positions for each giver
    const giverIndices = fromIds
      .map((id) => players.findIndex((p) => p.id === id))
      .filter((idx) => idx !== -1);

    let total = giverIndices.length;
    if (total === 0) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    let finished = 0;
    giverIndices.forEach((gIdx, i) => {
      const relIdx = (gIdx - myIndex + players.length) % players.length;
      const rotations =
        playerCount === 2
          ? [0, 180]
          : playerCount === 3
            ? [0, 90, -90]
            : [0, 90, 180, -90];
      const rotation = rotations[relIdx];
      // thief는 각 플레이어의 덱에서 카드를 가져오므로 시작 위치를 덱(layout) 위치로 설정
      const startX = pos[relIdx].x + (Math.random() - 0.5) * 12;
      const startY = pos[relIdx].y + (Math.random() - 0.5) * 12;

      const flyCard = this.add
        .image(startX, startY, "card_back")
        .setDisplaySize(width * 0.14, width * 0.2)
        .setDepth(3000 + i);

      const delay = i * 120;
      this.tweens.add({
        targets: flyCard,
        x: targetPos.x + (Math.random() - 0.5) * 20,
        y: targetPos.y + (Math.random() - 0.5) * 20,
        duration: 420,
        delay,
        ease: "Cubic.out",
        onComplete: () => {
          flyCard.destroy();
          finished++;
          // 작은 파티클
          const px = this.add
            .circle(targetPos.x, targetPos.y, width * 0.01, 0xfff1c2, 1)
            .setDepth(4000);
          this.tweens.add({
            targets: px,
            alpha: 0,
            scale: 0,
            duration: 300,
            ease: "Power2.easeOut",
            onComplete: () => px.destroy(),
          });

          if (finished === total) {
            if (typeof onComplete === "function") onComplete();
          }
        },
      });
    });
  }

  playKingSwapAnimation({
    byId,
    targetId,
    players = this.roundData.players,
    onComplete,
  } = {}) {
    if (!Array.isArray(players) || players.length === 0) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const { width, height } = this.cameras.main;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const myIndex = players.findIndex((p) => p.id === myId);
    const byIdx = players.findIndex((p) => p.id === byId);
    const targetIdx = players.findIndex((p) => p.id === targetId);
    if (byIdx === -1 || targetIdx === -1) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    const playerCount = players.length;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75 },
            { x: width * 0.5, y: height * 0.18 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.89, y: height * 0.45 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75 },
              { x: width * 0.11, y: height * 0.45 },
              { x: width * 0.5, y: height * 0.18 },
              { x: width * 0.89, y: height * 0.45 },
            ];

    const relBy = (byIdx - myIndex + players.length) % players.length;
    const relTarget = (targetIdx - myIndex + players.length) % players.length;
    const fromPos = pos[relBy];
    const toPos = pos[relTarget];

    // 두 장의 카드가 서로 교차 이동
    const cardA = this.add
      .image(fromPos.x + (Math.random() - 0.5) * 12, fromPos.y, "card_back")
      .setDisplaySize(width * 0.14, width * 0.2)
      .setDepth(3000);
    const cardB = this.add
      .image(toPos.x + (Math.random() - 0.5) * 12, toPos.y, "card_back")
      .setDisplaySize(width * 0.14, width * 0.2)
      .setDepth(3001);

    this.tweens.add({
      targets: cardA,
      x: toPos.x + (Math.random() - 0.5) * 20,
      y: toPos.y + (Math.random() - 0.5) * 10,
      angle: 360,
      scale: 0.95,
      duration: 420,
      ease: "Cubic.out",
    });

    this.tweens.add({
      targets: cardB,
      x: fromPos.x + (Math.random() - 0.5) * 20,
      y: fromPos.y + (Math.random() - 0.5) * 10,
      angle: -360,
      scale: 0.95,
      duration: 420,
      ease: "Cubic.out",
      onComplete: () => {
        cardA.destroy();
        cardB.destroy();
        // 파티클 효과
        const px = this.add
          .circle(
            (fromPos.x + toPos.x) / 2,
            (fromPos.y + toPos.y) / 2,
            width * 0.015,
            0xfff1c2,
            1,
          )
          .setDepth(4000);
        this.tweens.add({
          targets: px,
          alpha: 0,
          scale: 0,
          duration: 320,
          ease: "Power2.easeOut",
          onComplete: () => px.destroy(),
        });

        if (typeof onComplete === "function") onComplete();
      },
    });
  }

  checkFruitCountForAI() {
    if (!this.isSingle || this.isTutorialMode) return;

    const totals = this.calculateTotalFruits();
    const isFive = Object.values(totals).some((count) => count === 5);
    const hasThunder = this.hasThunderOnTable();
    const hasBomb = this.hasBombOnTable();
    const hasNot5 = this.hasNot5OnTable ? this.hasNot5OnTable() : false;

    if (hasBomb) return; // bomb이 있으면 AI는 절대 종을 치지 않음

    const successWindow = hasThunder || (hasNot5 ? !isFive : isFive);

    if (successWindow) {
      this.aiSettings.forEach((ai) => {
        const aiData = this.roundData.players.find((p) => p.id === ai.id);
        // 카드가 있는(>0) AI이면서 탈락 상태가 아닌 경우에만 종을 침
        if (aiData && Number(aiData.cards) > 0 && !aiData.isEliminated) {
          // 기존 예약된 타이머가 있다면 취소하거나 겹치지 않게 관리
          const delay = ai.reactionTime + Math.random() * 1000;
          this.time.delayedCall(delay, () => {
            this.handleAiRingBell(ai.id);
          });
        }
      });
    }
  }

  processSingleFlip(playerId) {
    const myId = this.myId || "PLAYER_ME";
    const player = this.roundData.players.find((p) => p.id === playerId);
    if (!player) return;

    // 1. 현재 카드 수 확인
    let currentCards = Number(player.cards) || 0;
    if (currentCards <= 0) {
      this.nextTurn();
      return;
    }

    // 2. 카드 차감 로직 시작
    player.cards = currentCards - 1;
    player.remainingCards = player.cards;

    // 바닥에 쌓인 카드 개수 증가
    if (player.openStackCount === undefined) player.openStackCount = 0;
    player.openStackCount += 1;

    // 💡 [수정] 카드 장수가 변했으므로 상태 갱신
    this.updateEliminationStatus();

    // 3. 플레이어 덱에서 카드 1장 추출 (싱글도 고정 덱 사용)
    const playerDeck = this.getSingleDeck(playerId);
    const randomCard =
      playerDeck.length > 0 ? playerDeck.pop() : this.createRandomFruitCard();

    // 즉시 현재 보여지는 카드로 설정
    player.openCard = randomCard;

    const specialPauseMs = this.showSpecialCardToast(randomCard, playerId);

    // --- 핵심 수정: 싱글플레이에서는 로컬 openStack을 직접 누적 ---
    if (!player.openStack || !Array.isArray(player.openStack))
      player.openStack = [];
    player.openStack.push(randomCard); // 즉시 누적해서 기존 바닥 카드들이 유지되게 함

    if (randomCard?.type === COIN_CARD_TYPE) {
      const reward = COIN_CARD_REWARD;
      this.playCoinCardRewardAnimation(playerId, reward);
      if (playerId === myId) {
        this.profileStats = this.profileStats || {};
        this.profileStats.coins =
          (Number(this.profileStats.coins) || 0) + reward;
        if (this.myProfile) {
          this.myProfile.coins = (Number(this.myProfile.coins) || 0) + reward;
        }
        const nickname =
          localStorage.getItem("nickname") ||
          (this.myProfile && this.myProfile.nickname) ||
          "요리사";
        if (socket && socket.connected) {
          socket.emit("updateProfile", {
            nickname,
            id: nickname,
            coins: this.profileStats.coins,
          });
        }
      }
    }

    if (!this.isTutorialMode && playerId === myId) {
      if (randomCard?.type === BOMB_CARD_TYPE) {
        this.handleQuestEvent("bombOpened");
      }
      if (randomCard?.type === THUNDER_CARD_TYPE) {
        this.handleQuestEvent("thunderOpened");
      }
    }

    if (this.isTutorialMode) {
      this.handleTutorialCardDrawn(playerId, randomCard);
    }

    const animationData = {
      playerId: playerId,
      card: randomCard,
      remainingCards: player.cards,
      // playCardFlipAnimation 내부에서 중복 push를 방지하도록 현재 스택 전달
      openCardStack: [...player.openStack],
    };

    // 4. 애니메이션 및 UI 갱신
    this.playCardFlipAnimation(animationData);

    // 즉시 렌더링 (새 카드가 기존 스택 위에 쌓인 것을 바로 보여줌)
    this.renderTable(this.roundData.players);

    if (this.isTutorialMode) {
      this.handleTutorialAfterFlip(playerId, randomCard);
    }

    // 5. 💡 마지막 카드를 낸 순간 알림 (기사회생 독려)
    if (playerId === myId && player.cards === 0) {
      this.showToast(
        "마지막 카드를 제출했습니다! 종을 쳐서 카드를 획득하세요!",
        "#f39c12",
      );
    }

    // 6. 다음 턴으로 진행
    if (specialPauseMs > 0) {
      this.time.delayedCall(specialPauseMs, () => {
        if (!this.isGameStarted) return;
        this.nextTurn();
        this.checkFruitCountForAI();
      });
    } else {
      this.nextTurn();
      this.checkFruitCountForAI();
    }
  }
  // AI가 종을 치는 로직
  handleAiRingBell(aiId) {
    if (!this.isSingle || !this.isGameStarted || this.isTutorialMode) return;

    // 방어: 호출 시점에 이미 탈락했거나 카드가 0장인 AI는 처리하지 않음
    const aiPlayer = this.roundData.players.find((p) => p.id === aiId);
    if (!aiPlayer || Number(aiPlayer.cards) <= 0 || aiPlayer.isEliminated)
      return;

    // 1. 과일이 여전히 5개인지 다시 확인 (이미 플레이어가 쳤을 수 있음)
    const totals = this.calculateTotalFruits();
    const isFive = Object.values(totals).some((count) => count === 5);
    const hasThunder = this.hasThunderOnTable();
    const hasNot5 = this.hasNot5OnTable ? this.hasNot5OnTable() : false;
    const successWindow = hasThunder || (hasNot5 ? !isFive : isFive);
    if (!successWindow) return;

    // 💥 AI도 정답 시 스펙타클한 이펙트
    this.playSuccessEffect();

    // 2. 사운드 재생 (캐시 확인 포함)
    if (this.cache.audio.exists("bell")) {
      this.sound.play("bell", { volume: 0.2 });
    }
    // AI도 기존 사운드를 중단하고 재생
    // AI: reuse shared sound if exists
    // 3. 승리 처리
    this.processSingleBell(aiId);
  }

  // 💥 정답 시 스펙타클한 이펙트
  playSuccessEffect() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 화면 전체 플래시 효과 (흰색 깜빡임)
    const flash = this.add
      .rectangle(centerX, centerY, width, height, 0xffffff, 1)
      .setDepth(10000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    // 2. 카메라 셰이크
    this.cameras.main.shake(400, 0.01);

    // 3. "PERFECT!" 텍스트 애니메이션
    const perfectText = this.add
      .text(centerX, centerY - height * 0.1, "성공!", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.15}px`,
        color: "#FFD700",
        fontWeight: "bold",
        stroke: "#FF6B6B",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(10001)
      .setScale(0)
      .setAlpha(0);

    this.tweens.add({
      targets: perfectText,
      scale: 1.2,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
      onComplete: () => {
        // 잠시 유지 후 사라짐
        this.tweens.add({
          targets: perfectText,
          scale: 1.5,
          alpha: 0,
          y: centerY - height * 0.2,
          duration: 400,
          delay: 300,
          ease: "Power2.easeIn",
          onComplete: () => perfectText.destroy(),
        });
      },
    });

    // 4. 파티클 효과 - 황금 별 폭발
    const particles = [];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 200 + Math.random() * 200;

      const particle = this.add
        .circle(centerX, centerY, width * 0.02, 0xffd700, 1)
        .setDepth(10002);

      particles.push(particle);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.tweens.add({
        targets: particle,
        x: centerX + vx,
        y: centerY + vy,
        alpha: 0,
        scale: 0,
        duration: 800,
        ease: "Power2.easeOut",
        onComplete: () => particle.destroy(),
      });
    }

    // 5. 별 이모지가 bell 중앙에서 360도로 폭발하는 효과
    const bellY = height * 0.465; // bell의 y 위치
    const starCount = 20;

    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const distance = width * 0.4 + Math.random() * width * 0.2;

      const star = this.add
        .text(centerX, bellY, "⭐", {
          fontSize: `${width * 0.03}px`, // 크기 축소
        })
        .setOrigin(0.5)
        .setDepth(10003)
        .setAlpha(0);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = bellY + Math.sin(angle) * distance;

      // 약간의 지연을 주어 파도치듯 퍼지는 효과
      this.time.delayedCall(i * 10, () => {
        this.tweens.add({
          targets: star,
          x: targetX,
          y: targetY,
          alpha: 1,
          rotation: Math.PI * 2 + Math.random() * Math.PI,
          scale: 1 + Math.random() * 0.5,
          duration: 300 + Math.random() * 200, // 더 빨리 흩어짐
          ease: "Power2.easeOut",
          onComplete: () => {
            // 도착 후 서서히 사라짐
            this.tweens.add({
              targets: star,
              alpha: 0,
              scale: 0,
              duration: 150, // 더 빨리 사라짐
              ease: "Power2.easeIn",
              onComplete: () => star.destroy(),
            });
          },
        });
      });
    }
  }

  // 💥 틀렸을 때 강력한 패널티 효과
  playFailureEffect() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 화면 전체 붉은 플래시 효과
    const flash = this.add
      .rectangle(centerX, centerY, width, height, 0xff3333, 0.8)
      .setDepth(10000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    // 2. 더 강한 카메라 흔들림
    this.cameras.main.shake(500, 0.015);

    // 3. "WRONG!" 텍스트 표시
    const wrongText = this.add
      .text(centerX, centerY, "땡!", {
        fontSize: `${width * 0.12}px`,
        fontFamily: "Arial Black",
        color: "#ff0000",
        stroke: "#ffffff",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(10001)
      .setAlpha(0)
      .setScale(0);

    this.tweens.add({
      targets: wrongText,
      scale: 1.3,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: wrongText,
          y: centerY - height * 0.15,
          alpha: 0,
          scale: 0.8,
          duration: 400,
          delay: 200,
          ease: "Power2.easeIn",
          onComplete: () => wrongText.destroy(),
        });
      },
    });

    // 4. 붉은 파티클 폭발 효과
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = Math.random() * width * 0.3;

      const particle = this.add
        .circle(centerX, centerY, width * 0.015, 0xff0000, 1)
        .setDepth(10002);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = centerY + Math.sin(angle) * distance;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0.3,
        duration: 500 + Math.random() * 300,
        ease: "Power2.easeOut",
        onComplete: () => particle.destroy(),
      });
    }

    // 5. ❌ 이모지가 중앙에서 폭발하는 효과
    const bellY = height * 0.465;
    const xCount = 15;

    for (let i = 0; i < xCount; i++) {
      const angle = (Math.PI * 2 * i) / xCount;
      const distance = width * 0.35 + Math.random() * width * 0.2;

      const xMark = this.add
        .text(centerX, bellY, "❌", {
          fontSize: `${width * 0.04}px`,
        })
        .setOrigin(0.5)
        .setDepth(10003)
        .setAlpha(0);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = bellY + Math.sin(angle) * distance;

      this.time.delayedCall(i * 15, () => {
        this.tweens.add({
          targets: xMark,
          x: targetX,
          y: targetY,
          alpha: 1,
          rotation: Math.PI * 2 + Math.random() * Math.PI,
          scale: 1 + Math.random() * 0.5,
          duration: 400 + Math.random() * 200,
          ease: "Power2.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: xMark,
              alpha: 0,
              scale: 0,
              duration: 200,
              ease: "Power2.easeIn",
              onComplete: () => xMark.destroy(),
            });
          },
        });
      });
    }
  }

  playEliminationEffect(playerId) {
    const sceneActive =
      this.scene && typeof this.scene.isActive === "function"
        ? this.scene.isActive()
        : true;
    if (!sceneActive) {
      console.log("[elimination] aborted (scene inactive)", {
        playerId,
        sceneKey: this.scene && this.scene.key,
      });
      return;
    }

    if (!this.cameras || !this.cameras.main) {
      console.log("[elimination] aborted (no camera)", {
        playerId,
        sceneKey: this.scene && this.scene.key,
      });
      return;
    }

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const flash = this.add
      .rectangle(centerX, centerY, width, height, 0x0f172a, 0.35)
      .setDepth(10000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    this.cameras.main.shake(420, 0.018);

    const stampRadius = width * 0.2;
    const stamp = this.add
      .circle(centerX, centerY, stampRadius, 0xb91c1c, 0.22)
      .setDepth(10000)
      .setAlpha(0)
      .setScale(0.12);
    stamp.setStrokeStyle(12, 0xef4444, 0.7);

    const stampRing = this.add
      .circle(centerX, centerY, stampRadius * 0.72, 0x000000, 0)
      .setDepth(10000)
      .setAlpha(0)
      .setScale(0.12);
    stampRing.setStrokeStyle(7, 0xfca5a5, 0.8);

    const shockwave = this.add
      .circle(centerX, centerY, stampRadius * 0.4, 0xffffff, 0)
      .setDepth(9999)
      .setAlpha(0.6)
      .setScale(0.6);
    shockwave.setStrokeStyle(6, 0xfbbf24, 0.9);

    const text = this.add
      .text(centerX, centerY, "탈락", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.16}px`,
        color: "#f8fafc",
        fontWeight: "bold",
        stroke: "#1f2937",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(10001)
      .setAlpha(0)
      .setScale(0.35);

    console.log("[elimination] rendered", {
      playerId,
      depth: text.depth,
      alpha: text.alpha,
      scale: text.scaleX,
    });

    this.tweens.add({
      targets: [stamp, stampRing, text],
      alpha: 1,
      scale: (target) => (target === text ? 1.45 : 1.12),
      duration: 220,
      ease: "Back.out",
      onComplete: () => {
        this.tweens.add({
          targets: shockwave,
          alpha: 0,
          scale: 2.1,
          duration: 260,
          ease: "Sine.out",
          onComplete: () => shockwave.destroy(),
        });
        this.tweens.add({
          targets: [stamp, stampRing, text],
          angle: { from: -3.5, to: 3.5 },
          duration: 420,
          ease: "Sine.inOut",
          yoyo: true,
          repeat: 2,
        });
        this.tweens.add({
          targets: [stamp, stampRing, text],
          y: centerY - height * 0.1,
          alpha: 0,
          scale: (target) => (target === text ? 0.95 : 0.9),
          duration: 1000,
          delay: 760,
          ease: "Sine.in",
          onComplete: () => {
            stamp.destroy();
            stampRing.destroy();
            text.destroy();
          },
        });
      },
    });
  }

  maybePlayEliminationEffect(playerId) {
    if (!playerId) return;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    if (playerId !== myId) return;
    if (!this.lastEliminationEffectAtByPlayer) {
      this.lastEliminationEffectAtByPlayer = {};
    }
    if (this.lastEliminationEffectAtByPlayer[playerId]) {
      console.log("[elimination] skip duplicate", {
        playerId,
        lastAt: this.lastEliminationEffectAtByPlayer[playerId],
      });
      return;
    }
    this.lastEliminationEffectAtByPlayer[playerId] = Date.now();
    console.log("[elimination] play", { playerId });
    this.playEliminationEffect(playerId);
  }

  triggerEliminationEffects(prevPlayers, nextPlayers) {
    if (!Array.isArray(prevPlayers) || !Array.isArray(nextPlayers)) return;
    const prevMap = new Map(prevPlayers.map((p) => [p.id, p]));
    nextPlayers.forEach((p) => {
      if (!p || !p.isEliminated) return;
      const prev = prevMap.get(p.id);
      if (prev && prev.isEliminated) return;
      this.maybePlayEliminationEffect(p.id);
    });
  }

  processPenaltySingle(failedPlayerId) {
    if (!this.isSingle || !this.isGameStarted) return;

    const players = this.roundData.players;
    const loser = players.find((p) => p.id === failedPlayerId);
    if (!loser || (Number(loser.cards) || 0) <= 0) return;

    // 자동 자물쇠 처리: 패널티 대상이 로컬 플레이어이고 자물쇠(lock, id=4)를 보유한 경우
    try {
      const myIdCheck = this.myId || "PLAYER_ME";
      if (failedPlayerId === myIdCheck) {
        const owned = JSON.parse(localStorage.getItem("specialCards")) || {};
        const lockCount = Number(owned[4] || 0);
        if (lockCount > 0) {
          // 로컬 차감
          owned[4] = lockCount - 1;
          if (owned[4] <= 0) delete owned[4];
          localStorage.setItem("specialCards", JSON.stringify(owned));
          // 인벤토리 동기화 시도
          try {
            this.safeSyncInventory("autoUseLock", { usedCardId: 4 });
          } catch (e) {
            /* ignore */
          }
          this.showToast(
            "자물쇠 사용: 패널티 면제되었습니다! (싱글)",
            "#2ecc71",
          );
          // UI 갱신
          if (this.roundData && this.roundData.players)
            this.renderTable(this.roundData.players);
          return;
        }
      }
    } catch (e) {
      console.warn("processPenaltySingle auto-lock error", e);
    }

    if (!this.isTutorialMode && failedPlayerId === (this.myId || "PLAYER_ME")) {
      this.handleQuestEvent("penalty");
    }

    // 💥 패널티 발생 시 강력한 실패 효과
    this.playFailureEffect();

    //const recipients = players.filter(
    //  (p) => p.id !== failedPlayerId && (Number(p.cards) || 0) > 0
    //);
    // 1. 카드를 받을 대상자들 추출 (나 제외 & 탈락자 제외)
    const recipients = players.filter(
      (p) =>
        p.id !== failedPlayerId &&
        !p.isEliminated &&
        (Number(p.cards) || 0) >= 0,
    );

    // 3. 페널티 실행 (받을 사람이 없어도 내 카드는 깎혀야 규칙에 맞음)
    const hasPen = this.hasPenOnTable();
    const perRecipient = hasPen ? 2 : 1;
    const penaltyAmount = recipients.length * perRecipient; // 생존자 수 * 페널티 수
    const myCurrentCards = Number(loser.cards) || 0;
    const loserDeck = this.getSingleDeck(failedPlayerId);

    if (penaltyAmount > 0) {
      // 생존자들에게 줄 카드가 충분할 때
      if (myCurrentCards >= penaltyAmount) {
        loser.cards = myCurrentCards - penaltyAmount;
        recipients.forEach((p) => {
          p.cards = (Number(p.cards) || 0) + perRecipient;
          p.remainingCards = p.cards;

          const recipientDeck = this.getSingleDeck(p.id);
          for (let k = 0; k < perRecipient; k += 1) {
            const movedCard =
              loserDeck.length > 0
                ? loserDeck.pop()
                : this.createRandomFruitCard();
            recipientDeck.unshift(movedCard);
          }
        });
      } else {
        // 카드가 부족하면 가진 걸 다 줌 (0장이 됨)
        let cardsToGive = myCurrentCards;
        loser.cards = 0;
        // 한 장씩 순서대로 배분
        for (let i = 0; i < cardsToGive; i++) {
          if (recipients[i]) {
            recipients[i].cards += 1;
            recipients[i].remainingCards = recipients[i].cards;
            const recipientDeck = this.getSingleDeck(recipients[i].id);
            const movedCard =
              loserDeck.length > 0
                ? loserDeck.pop()
                : this.createRandomFruitCard();
            recipientDeck.unshift(movedCard);
          }
        }
      }
      this.addGameLog("틀렸습니다! 카드를 나눠줍니다", "#e74c3c");
    } else {
      // 만약 나 빼고 다 탈락한 상태라면? 1장만 버리게 하거나 유지
      this.addGameLog("틀렸습니다! 카드를 나눠줍니다", "#e74c3c");
    }

    // 💡 [핵심] 멀티플레이 애니메이션 함수와 호환되는 데이터 객체 생성
    const penaltyData = {
      players: players,
      penaltyId: failedPlayerId,
      recipients: recipients.map((p) => p.id), // ID 배열만 추출
      penaltyPerRecipient: perRecipient,
    };

    // 💡 애니메이션 실행
    this.playPenaltyAnimation(penaltyData);

    // 4. 데이터 동기화 및 UI 갱신
    loser.remainingCards = loser.cards;
    // 💡 [수정] 페널티 후 상태 갱신 및 렌더링
    this.updateEliminationStatus();
    console.log("[penalty] after updateEliminationStatus", {
      failedPlayerId,
      cards: loser.cards,
      isEliminated: loser.isEliminated,
      hasBellSuccessWindow: (() => {
        try {
          const totals = this.calculateTotalFruits();
          const isFiveExists = Object.values(totals).some((c) => c === 5);
          const hasThunder = this.hasThunderOnTable();
          const hasNot5 = this.hasNot5OnTable ? this.hasNot5OnTable() : false;
          const hasBomb = this.hasBombOnTable();
          return (
            hasThunder || (hasNot5 ? !isFiveExists : isFiveExists) || hasBomb
          );
        } catch (e) {
          return "error";
        }
      })(),
    });
    if ((Number(loser.cards) || 0) <= 0 && !loser.isEliminated) {
      loser.isEliminated = true;
      console.log("[penalty] force elimination", {
        failedPlayerId,
        cards: loser.cards,
      });
      this.maybePlayEliminationEffect(loser.id);
    }
    this.renderTable(players);

    // 5. 내 카드가 0이 되었다면 패배 판정을 위해 턴 체크
    if (loser.id === (this.myId || "PLAYER_ME") && loser.cards <= 0) {
      this.nextTurn();
    }

    if (
      this.isTutorialMode &&
      this.tutorialState?.currentStageKey === "wrongBell" &&
      this.tutorialState.requireWrongBellPenalty &&
      failedPlayerId === (this.myId || "PLAYER_ME")
    ) {
      this.tutorialState.requireWrongBellPenalty = false;
      this.tutorialState.forbidBell = true;
      this.canClick = false;
      this.showTutorialMessage({
        title: "패널티 체험 완료",
        description:
          "합계가 5가 아닐 때 종을 치면 카드가 줄어듭니다. 항상 합계를 확인하세요!",
      });
      const timer = this.time.delayedCall(1400, () => {
        this.removeTrackedTutorialTimer(timer);
        this.completeTutorialStage("wrongBell");
      });
      this.trackTutorialTimer(timer);
    }
  }

  nextTurn() {
    if (!this.isSingle || !this.isGameStarted) return;

    if (this.isTutorialMode) {
      this.isFlipping = false;
      return;
    }

    if (this.myTurnTimer) {
      this.myTurnTimer.remove();
      this.myTurnTimer = null;
    }

    this.canClick = true;
    this.isFlipping = false; // 혹시 남아있을 수 있는 뒤집기 잠금도 해제

    const myId = this.myId || "PLAYER_ME";

    // 1. 현재 카드가 1장이라도 있는 '실제 생존자' 명단 추출
    const survivors = this.roundData.players.filter(
      (p) => (Number(p.cards) || 0) > 0,
    );
    const isMeAlive = survivors.some((p) => p.id === myId);

    // 2. 🏆 [승리 조건] 나만 살아있고 나머지 AI는 모두 0장일 때
    if (survivors.length === 1 && isMeAlive) {
      this.endSingleGame("WIN");
      return;
    }

    // 3. 턴 인덱스 이동
    this.turnIndex = (this.turnIndex + 1) % this.roundData.players.length;
    let nextPlayer = this.roundData.players[this.turnIndex];

    // 싱글플레이: 다음 플레이어의 특수 사용 플래그 초기화 (턴당 1회 규칙)
    try {
      this.specialUsedThisTurn = this.specialUsedThisTurn || {};
      if (nextPlayer && nextPlayer.id)
        this.specialUsedThisTurn[nextPlayer.id] = false;
    } catch (e) {
      this.specialUsedThisTurn = {};
    }

    // 4. 💀 [패배 조건] 다음 차례가 나인데, 내 카드가 0장이라면 (기사회생 실패)
    if (nextPlayer.id === myId && (Number(nextPlayer.cards) || 0) <= 0) {
      this.endSingleGame("LOSE");
      return;
    }

    // 5. [AI 스킵] 다음 차례 AI가 카드가 없다면 다음 사람으로 스킵
    if (nextPlayer.id !== myId && (Number(nextPlayer.cards) || 0) <= 0) {
      // 💡 주의: 무한 루프 방지를 위해 생존자가 있을 때만 재귀 호출
      if (survivors.length > 0) {
        this.nextTurn();
      }
      return;
    }

    this.renderTable(this.roundData.players);

    // 6. 다음 차례가 AI라면 카드 뒤집기 예약
    if (nextPlayer.id.startsWith("AI_")) {
      const aiSetting = this.aiSettings.find((ai) => ai.id === nextPlayer.id);
      const baseDelay = aiSetting ? aiSetting.flipDelay : 1500;
      const delay = baseDelay + Math.random() * 400;

      this.time.delayedCall(delay, () => {
        if (this.isGameStarted) {
          this.processSingleFlip(nextPlayer.id);
        }
      });
    }
  }

  processSingleBell(winnerId) {
    if (!this.isSingle) return;

    this.time.removeAllEvents();

    // 1. 애니메이션 기준이 되는 이전 상태를 먼저 보존
    const prevPlayers = this.roundData.players.map((p) => ({
      ...p,
      openStack: p.openStack ? [...p.openStack] : [],
    }));

    // 2. 바닥 카드(실제 객체)를 수집
    const collectedCards = [];
    prevPlayers.forEach((p) => {
      if (Array.isArray(p.openStack) && p.openStack.length > 0) {
        collectedCards.push(...p.openStack);
      }
    });

    const totalCollected = collectedCards.length;

    // 가져갈 카드가 없으면 리턴 (중복 실행 방지)
    if (totalCollected === 0) return;

    const winnerIdx = this.roundData.players.findIndex(
      (p) => p.id === winnerId,
    );
    const winner = this.roundData.players[winnerIdx];

    if (!winner) return;

    winner.cards = (Number(winner.cards) || 0) + totalCollected;
    winner.remainingCards = winner.cards;
    const winnerDeck = this.getSingleDeck(winner.id);
    winnerDeck.unshift(...collectedCards);

    // 콤보 갱신: 같은 플레이어가 연속으로 획득했는지 확인
    if (this.comboState && this.comboState.lastWinnerId === winner.id) {
      this.comboState.count = (this.comboState.count || 0) + 1;
    } else if (this.comboState) {
      this.comboState.count = 1;
      this.comboState.lastWinnerId = winner.id;
    } else {
      this.comboState = {
        lastWinnerId: winner.id,
        count: 1,
        lastTime: Date.now(),
      };
    }
    if (this.comboState) this.comboState.lastTime = Date.now();

    if (!this.isTutorialMode && winner.id === (this.myId || "PLAYER_ME")) {
      this.handleQuestEvent("bellSuccess", { cardsWon: totalCollected });
    }

    // 3. 턴 인덱스를 승자로 고정
    this.turnIndex = winnerIdx;
    // 승리로 인해 턴이 바뀐 경우 해당 플레이어의 특수카드 사용 플래그를 초기화
    try {
      this.specialUsedThisTurn = this.specialUsedThisTurn || {};
      if (winner && winner.id) this.specialUsedThisTurn[winner.id] = false;
    } catch (e) {
      this.specialUsedThisTurn = {};
    }
    this.addGameLog(
      `${winner.nickname}님이 카드 ${totalCollected}장을 획득!`,
      "#f1c40f",
    );

    // 4. 애니메이션 이후 상태(바닥 초기화)를 생성
    const updatedPlayers = this.roundData.players.map((p) => {
      const clone = { ...p };
      if (p.id === winner.id) {
        clone.cards = winner.cards;
        clone.remainingCards = winner.remainingCards;
      }

      clone.openCard = null;
      clone.openStack = [];
      clone.openStackCount = 0;

      return clone;
    });

    // 5. 애니메이션 실행 (싱글은 캐릭터 연출만 생략)
    this.playWinAnimation({
      winnerId: winner.id,
      players: updatedPlayers,
      prevPlayers: prevPlayers,
      skipAvatar: this.isSingle,
    });

    // 즉시 로컬 상태 업데이트 (애니메이션이 끝나면 openStack은 playWinAnimation에서 비워집니다)
    this.roundData.players = updatedPlayers;

    // 상태 갱신
    this.updateEliminationStatus();
    this.updateTurnEffect();

    // 승자 다음 동작 예약 (AI는 뒤집기, 플레이어는 다시 입력 허용)
    if (winner && winner.id.startsWith("AI_")) {
      this.time.delayedCall(1500, () => {
        if (this.isGameStarted) {
          this.processSingleFlip(winner.id);
        }
      });
    } else {
      this.canClick = true;
      this.isFlipping = false;
    }

    if (this.isTutorialMode) {
      this.handleTutorialBellResolved(winnerId);
    }
  }

  createRandomFruitCard() {
    return {
      fruit: Math.floor(Math.random() * 4) + 1,
      count: Math.floor(Math.random() * 5) + 1,
    };
  }

  getSingleDeck(playerId) {
    if (!this.singleDeckByPlayer) {
      this.singleDeckByPlayer = {};
    }

    if (!Array.isArray(this.singleDeckByPlayer[playerId])) {
      this.singleDeckByPlayer[playerId] = [];
    }

    return this.singleDeckByPlayer[playerId];
  }

  initializeSingleDecks() {
    if (!this.isSingle || !Array.isArray(this.roundData?.players)) return;

    this.singleDeckByPlayer = {};

    const tutorialDeckLayout =
      this.isTutorialMode && this.tutorialConfig?.deckLayout
        ? this.tutorialConfig.deckLayout
        : null;

    if (tutorialDeckLayout) {
      this.roundData.players.forEach((player) => {
        const layout = Array.isArray(tutorialDeckLayout[player.id])
          ? tutorialDeckLayout[player.id]
          : [];
        const normalized = layout.map((card) => ({ ...card })).reverse();
        this.singleDeckByPlayer[player.id] = normalized;
        const cardCount = normalized.length;
        player.cards = cardCount;
        player.remainingCards = cardCount;
        player.openStack = [];
        player.openCard = null;
      });
      return;
    }

    const deckSlots = [];
    this.roundData.players.forEach((player) => {
      const cardCount = Math.max(0, Number(player.cards) || 0);
      const deck = [];

      for (let index = 0; index < cardCount; index += 1) {
        deck.push(this.createRandomFruitCard());
        deckSlots.push({ playerId: player.id, slotIndex: index });
      }

      this.singleDeckByPlayer[player.id] = deck;
    });

    const thunderCount = Math.min(SINGLE_THUNDER_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < thunderCount; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: THUNDER_CARD_TYPE };
    }
    // Bomb 카드도 동일하게 주입 (옵션)
    const bombCount = Math.min(SINGLE_BOMB_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < bombCount; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: BOMB_CARD_TYPE };
    }
    // Plus1 카드 주입 (싱글)
    const plus1Count = Math.min(SINGLE_PLUS1_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < plus1Count; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: PLUS1_CARD_TYPE };
    }
    // Coin 카드 주입 (싱글)
    const coinCount = Math.min(SINGLE_COIN_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < coinCount; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: COIN_CARD_TYPE };
    }
    // Plus2 카드 주입 (싱글)
    const plus2Count = Math.min(SINGLE_PLUS2_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < plus2Count; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: PLUS2_CARD_TYPE };
    }
    // Not5 카드 주입 (싱글)
    const not5Count = Math.min(SINGLE_NOT5_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < not5Count; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: NOT5_CARD_TYPE };
    }
  }

  updateEliminationStatus() {
    if (!this.roundData || !this.roundData.players) return;

    const totals = this.calculateTotalFruits();
    const isFiveExists = Object.values(totals).some((count) => count === 5);
    const hasThunder = this.hasThunderOnTable();
    const hasNot5 = this.hasNot5OnTable ? this.hasNot5OnTable() : false;
    const hasBomb = this.hasBombOnTable();
    const hasBellSuccessWindow =
      hasThunder || (hasNot5 ? !isFiveExists : isFiveExists);

    this.roundData.players.forEach((p) => {
      if (!p) return;

      const wasEliminated = Boolean(p.isEliminated);
      if (wasEliminated) return;

      const hasDeck = (Number(p.cards) || 0) > 0;

      // 1. 낼 카드가 없고 바닥에 5도 없으면 -> 즉시 탈락
      //    단, 바닥에 bomb 카드가 있다면 5가 있더라도 즉시 탈락 처리
      if (!hasDeck && (!hasBellSuccessWindow || hasBomb)) {
        p.isEliminated = true;
        this.maybePlayEliminationEffect(p.id);
      }
      // 2. 낼 카드가 생기면 (종을 쳐서 먹었을 때) -> 생존 유지
      else if (hasDeck) {
        p.isEliminated = false;
      }
      // 3. 카드는 0장이지만 바닥에 5가 있으면 -> 유보 (isEliminated 유지)
    });
  }

  // 과일 개수 계산 보조 함수
  calculateTotalFruits() {
    const totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const plus1Active = this.hasPlus1OnTable();
    const plus2Active = this.hasPlus2OnTable ? this.hasPlus2OnTable() : false;
    const extraPerCard = (plus1Active ? 1 : 0) + (plus2Active ? 2 : 0);

    this.roundData.players.forEach((p) => {
      if (!p) return;
      const top =
        Array.isArray(p.openStack) && p.openStack.length > 0
          ? p.openStack[p.openStack.length - 1]
          : p.openCard;
      // If the player is eliminated and the top is a bomb, ignore it for totals.
      if (p.isEliminated && top?.type === BOMB_CARD_TYPE) return;
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
  hasThunderOnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (!player) return false;
      const top =
        Array.isArray(player?.openStack) && player.openStack.length > 0
          ? player.openStack[player.openStack.length - 1]
          : player?.openCard;
      if (player.isEliminated && top?.type === BOMB_CARD_TYPE) return false;
      return top?.type === THUNDER_CARD_TYPE;
    });
  }

  hasBombOnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (!player) return false;
      const top =
        Array.isArray(player?.openStack) && player.openStack.length > 0
          ? player.openStack[player.openStack.length - 1]
          : player?.openCard;
      // If player is eliminated and their top is a bomb, ignore it.
      if (player.isEliminated && top?.type === BOMB_CARD_TYPE) return false;
      return top?.type === BOMB_CARD_TYPE;
    });
  }

  hasPenOnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (!player) return false;
      const top =
        Array.isArray(player?.openStack) && player.openStack.length > 0
          ? player.openStack[player.openStack.length - 1]
          : player?.openCard;
      if (player.isEliminated && top?.type === BOMB_CARD_TYPE) return false;
      return top?.type === PEN_CARD_TYPE;
    });
  }

  hasNot5OnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (!player) return false;
      const top =
        Array.isArray(player?.openStack) && player.openStack.length > 0
          ? player.openStack[player.openStack.length - 1]
          : player?.openCard;
      if (player.isEliminated && top?.type === BOMB_CARD_TYPE) return false;
      return top?.type === NOT5_CARD_TYPE;
    });
  }

  hasPlus1OnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (!player) return false;
      const top =
        Array.isArray(player?.openStack) && player.openStack.length > 0
          ? player.openStack[player.openStack.length - 1]
          : player?.openCard;
      if (player.isEliminated && top?.type === BOMB_CARD_TYPE) return false;
      return top?.type === PLUS1_CARD_TYPE;
    });
  }

  hasPlus2OnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (Array.isArray(player?.openStack) && player.openStack.length > 0) {
        const top = player.openStack[player.openStack.length - 1];
        return top?.type === PLUS2_CARD_TYPE;
      }
      return player?.openCard?.type === PLUS2_CARD_TYPE;
    });
  }

  // 닉네임 가져오기 보조 함수
  getNicknameById(id) {
    const player = this.roundData.players.find((p) => p.id === id);
    return player ? player.nickname : "AI";
  }

  isSpecialCardPauseActive() {
    return Date.now() < (this.specialCardPauseUntil || 0);
  }

  startSpecialCardPause(durationMs = 1400) {
    const now = Date.now();
    const until = now + durationMs;
    this.specialCardPauseUntil = Math.max(
      this.specialCardPauseUntil || 0,
      until,
    );
    this.canClick = false;

    if (typeof this.clearMyTurnTimer === "function") {
      this.clearMyTurnTimer();
    }

    if (this.specialCardPauseTimer) {
      this.specialCardPauseTimer.remove(false);
      this.specialCardPauseTimer = null;
    }

    const remaining = this.specialCardPauseUntil - now;
    this.specialCardPauseTimer = this.time.delayedCall(remaining, () => {
      if (Date.now() < (this.specialCardPauseUntil || 0)) return;
      this.specialCardPauseUntil = 0;
      if (!this.isGameStarted) return;
      if (this.isTutorialMode) return;

      const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
      const currentPlayer = this.roundData?.players?.[this.turnIndex];
      this.canClick = Boolean(currentPlayer && currentPlayer.id === myId);
    });

    return durationMs;
  }

  playSpecialCardCenterReveal(imageKey) {
    if (!imageKey || !this.textures.exists(imageKey)) return;

    const { width, height } = this.cameras.main;
    const centerX = width * 0.5;
    const centerY = height * 0.45;

    if (this.specialCardCenterContainer) {
      this.specialCardCenterContainer.destroy();
      this.specialCardCenterContainer = null;
    }

    const container = this.add.container(centerX, centerY).setDepth(9500);
    const glow = this.add
      .circle(0, 0, width * 0.12, 0xffffff, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    const img = this.add
      .image(0, 0, imageKey)
      .setDisplaySize(width * 0.3, width * 0.3)
      .setAlpha(0)
      .setScale(0.6);

    container.add([glow, img]);
    this.specialCardCenterContainer = container;

    this.tweens.add({
      targets: img,
      alpha: 1,
      scale: 1.08,
      duration: 340,
      ease: "Back.out",
      onComplete: () => {
        this.tweens.add({
          targets: [img, glow],
          scale: 1.12,
          duration: 180,
          yoyo: true,
          repeat: 1,
          ease: "Sine.inOut",
        });
        this.tweens.add({
          targets: container,
          angle: { from: -4, to: 4 },
          duration: 80,
          yoyo: true,
          repeat: 5,
          ease: "Sine.inOut",
        });
        this.tweens.add({
          targets: [img, glow],
          alpha: 0,
          scale: 1.15,
          duration: 520,
          ease: "Sine.in",
          delay: 520,
          onComplete: () => {
            if (container && container.active) container.destroy();
            if (this.specialCardCenterContainer === container) {
              this.specialCardCenterContainer = null;
            }
          },
        });
      },
    });
  }

  showSpecialCardToast(card, playerId) {
    const type = card?.type;
    if (!type) return 0;
    const effectTypes = new Set([
      BOMB_CARD_TYPE,
      THUNDER_CARD_TYPE,
      TON_CARD_TYPE,
      PLUS1_CARD_TYPE,
      COIN_CARD_TYPE,
    ]);
    if (effectTypes.has(type) && this.cache?.audio?.exists("effect")) {
      this.sound.play("effect", { volume: 0.18 });
    }
    const labels = {
      [BOMB_CARD_TYPE]: "폭탄",
      [THUNDER_CARD_TYPE]: "번개",
      [PLUS1_CARD_TYPE]: "+1",
      [TON_CARD_TYPE]: "회오리",
      [COIN_CARD_TYPE]: "코인",
    };
    const label = labels[type];
    if (!label) return 0;
    const nickname = playerId ? this.getNicknameById(playerId) : "";
    const prefix = nickname ? `${nickname} ` : "";
    this.showToast(`${label} 카드 등장!`, "#f39c12");

    const revealKeyMap = {
      [BOMB_CARD_TYPE]: "bomb_img",
      [TON_CARD_TYPE]: "ton_img",
    };
    const revealKey = revealKeyMap[type];
    if (revealKey) {
      const pauseMs = this.startSpecialCardPause();
      this.playSpecialCardCenterReveal(revealKey);
      return pauseMs;
    }

    return 0;
  }

  getPlayerLayoutForId(playerId) {
    if (this.playerLayouts && this.playerLayouts[playerId]) {
      return this.playerLayouts[playerId];
    }
    if (!this.roundData || !Array.isArray(this.roundData.players)) return null;

    const players = this.roundData.players;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    let myIndex = players.findIndex((p) => p.id === myId);
    if (myIndex === -1) myIndex = 0;

    const sortedPlayers = [
      ...players.slice(myIndex),
      ...players.slice(0, myIndex),
    ];
    const playerCount = sortedPlayers.length;
    const { width, height } = this.cameras.main;
    const pos =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height * 0.75, rotation: 0 },
            { x: width * 0.5, y: height * 0.18, rotation: 180 },
          ]
        : playerCount === 3
          ? [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.11, y: height * 0.45, rotation: 90 },
              { x: width * 0.89, y: height * 0.45, rotation: -90 },
            ]
          : [
              { x: width * 0.5, y: height * 0.75, rotation: 0 },
              { x: width * 0.11, y: height * 0.45, rotation: 90 },
              { x: width * 0.5, y: height * 0.18, rotation: 180 },
              { x: width * 0.89, y: height * 0.45, rotation: -90 },
            ];

    const targetIdx = sortedPlayers.findIndex((p) => p.id === playerId);
    if (targetIdx === -1 || !pos[targetIdx]) return null;

    return pos[targetIdx];
  }

  playCoinCardRewardAnimation(playerId, amount) {
    if (!playerId || !Number.isFinite(Number(amount))) return;

    const layout = this.getPlayerLayoutForId(playerId);
    if (!layout) return;

    const { width } = this.cameras.main;
    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);
    const startX = layout.x + Math.cos(rad) * dist * 0.7;
    const startY = layout.y + Math.sin(rad) * dist;
    const targetX = layout.x;
    const targetY = layout.y;
    const coinCount = 18;
    const lift = width * 0.1;
    const spread = width * 0.12;
    const coinSize = width * 0.05;

    for (let i = 0; i < coinCount; i += 1) {
      const coin = this.add
        .image(startX, startY, "coin")
        .setDisplaySize(coinSize, coinSize)
        .setDepth(1200)
        .setAlpha(0)
        .setScale(0.6);

      const burstX = startX + (Math.random() - 0.5) * spread;
      const burstY = startY - lift - Math.random() * lift * 0.3;

      this.tweens.add({
        targets: coin,
        x: burstX,
        y: burstY,
        alpha: 1,
        scale: 1,
        duration: 320,
        delay: i * 30,
        ease: "Back.out",
        onComplete: () => {
          this.tweens.add({
            targets: coin,
            x: targetX,
            y: targetY,
            alpha: 0.15,
            scale: 0.35,
            duration: 750,
            ease: "Cubic.in",
            onComplete: () => {
              coin.destroy();
            },
          });
        },
      });
    }
  }

  // 특수카드 사용 함수
  useSpecialCard(cardId, cardName, cooldown) {
    // 턴 검증: 자신의 턴에서만 사용 가능
    try {
      const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
      const currentTurnPlayer = Array.isArray(this.roundData?.players)
        ? this.roundData.players[this.turnIndex]
        : null;
      const currentTurnId = currentTurnPlayer ? currentTurnPlayer.id : null;
      if (currentTurnId !== myId) {
        this.showToast("자신의 턴에만 사용할 수 있습니다!", "#e74c3c");
        return;
      }
    } catch (e) {
      // 방어적 처리
    }

    // (쿨타임 시스템 제거) 대신 '턴당 1회 사용' 여부는 drawSpecialCards에서 검사하고,
    // 사용 성공 시 this.specialUsedThisTurn[myId]를 true로 설정합니다.

    // localStorage 보유 확인
    const specialCardsOwned =
      JSON.parse(localStorage.getItem("specialCards")) || {};
    const count = specialCardsOwned[cardId] || 0;
    if (count <= 0) {
      this.showToast("보유한 카드가 없습니다!", "#e74c3c");
      return;
    }

    // 멀티플레이에서 서버와 특수카드 데이터 동기화
    if (!this.isSingle && socket && socket.connected) {
      socket.emit("syncSpecialCards", specialCardsOwned, (response) => {
        if (response && response.success) {
          // 서버에서 동기화된 데이터로 localStorage 업데이트
          localStorage.setItem(
            "specialCards",
            JSON.stringify(response.specialCards),
          );
          // 동기화 후 실제 카드 사용 진행
          this.useSpecialCardAfterSync(cardId, cardName, cooldown);
        } else {
          this.showToast("서버와 동기화에 실패했습니다.", "#e74c3c");
        }
      });
      return;
    }

    // 싱글플레이에서는 바로 진행
    this.useSpecialCardAfterSync(cardId, cardName, cooldown);
  }

  // 동기화 후 실제 특수카드 사용 로직
  useSpecialCardAfterSync(cardId, cardName, cooldown) {
    // localStorage 보유 확인 (동기화 후 재확인)
    const specialCardsOwned =
      JSON.parse(localStorage.getItem("specialCards")) || {};
    const count = specialCardsOwned[cardId] || 0;
    if (count <= 0) {
      this.showToast("보유한 카드가 없습니다!", "#e74c3c");
      return;
    }

    // thief 카드 (id=7) 동작
    if (Number(cardId) === 7) {
      // 멀티플레이: 중앙 애니메이션 재생 후 서버 요청/낙관 업데이트 수행
      if (!this.isSingle && socket && socket.connected) {
        this.requestUseSpecialWithOptimistic(7, cardName);
        return;
      }

      // 싱글플레이: 상대방의 카드를 1장 랜덤으로 가져옴
      try {
        const myId = this.myId || "PLAYER_ME";
        const players = this.roundData.players;
        const givers = players.filter(
          (p) => p && p.id !== myId && !p.isEliminated,
        );

        // 애니메이션을 위해 현재 상태 복사
        const prevPlayers = players.map((p) => ({
          ...p,
          openStack: p.openStack ? [...p.openStack] : [],
        }));

        const myDeck = this.getSingleDeck(myId);
        const stealOrder = [];
        let stolenCount = 0;

        givers.forEach((giver) => {
          if (!giver || (Number(giver.cards) || 0) <= 0) return;
          const giverDeck = this.getSingleDeck(giver.id);
          if (!Array.isArray(giverDeck) || giverDeck.length === 0) return;
          const moved = giverDeck.pop();
          if (!moved) return;
          myDeck.unshift(moved);
          stealOrder.push(giver.id);
          stolenCount += 1;
          giver.cards = Math.max(0, Number(giver.cards) - 1);
          giver.remainingCards = giver.cards;
        });

        if (stolenCount === 0) {
          // 카드 줄 플레이어가 없으면 바로 처리
          specialCardsOwned[cardId] = count - 1;
          if (specialCardsOwned[cardId] <= 0) delete specialCardsOwned[cardId];
          localStorage.setItem(
            "specialCards",
            JSON.stringify(specialCardsOwned),
          );
          this.safeSyncInventory("useThief", { usedCardId: 7 });
          // 사용 성공으로 마크 (턴당 1회 규칙)
          try {
            const myId = this.myId || "PLAYER_ME";
            this.specialUsedThisTurn = this.specialUsedThisTurn || {};
            this.specialUsedThisTurn[myId] = true;
          } catch (e) {}
          this.renderTable(this.roundData.players);
          this.showToast("도둑 카드 사용: 획득할 카드가 없습니다.", "#f39c12");
        } else {
          // 즉시 카드 이동 및 UI 반영 (낙관적 적용)
          try {
            const me = players.find((p) => p.id === myId);
            if (me) {
              me.cards = (me.cards || 0) + stolenCount;
              me.remainingCards = me.cards;
            }

            // 로컬 카드 소모 및 서버 동기화 트리거
            specialCardsOwned[cardId] = count - 1;
            if (specialCardsOwned[cardId] <= 0)
              delete specialCardsOwned[cardId];
            localStorage.setItem(
              "specialCards",
              JSON.stringify(specialCardsOwned),
            );
            this.safeSyncInventory("useThief", { usedCardId: 7 });

            // 사용 성공으로 마크 (턴당 1회 규칙)
            try {
              this.specialUsedThisTurn = this.specialUsedThisTurn || {};
              this.specialUsedThisTurn[myId] = true;
            } catch (e) {}

            this.updateEliminationStatus();
            this.renderTable(this.roundData.players);

            // 애니메이션은 이전 상태(prevPlayers)를 기준으로 재생
            this.playThiefAnimation({
              byId: myId,
              fromIds: stealOrder,
              players: prevPlayers,
              onComplete: () => {
                this.showToast(
                  `도둑 카드 사용: 총 ${stolenCount}장을 훔쳤습니다!`,
                  "#2ecc71",
                );
              },
            });
          } catch (e) {
            console.warn("thief optimistic apply error", e);
          }
        }
      } catch (e) {
        console.warn("useSpecialCard thief single error", e);
      }

      return;
    }

    // king 카드 (id=8) 처리
    if (Number(cardId) === 8) {
      // 멀티플레이: 애니메이션 재생 후 서버 요청
      if (!this.isSingle && socket && socket.connected) {
        this.requestUseSpecialWithOptimistic(8, cardName);
        return;
      }

      // 싱글플레이: 애니메이션으로 교환 연출 후 실제 덱 교환 적용
      try {
        const myId = this.myId || "PLAYER_ME";
        const players = this.roundData.players;
        // 가장 많은 카드를 가진 플레이어(자기 제외, 탈락자 제외)
        const candidates = players.filter(
          (p) => p.id !== myId && !p.isEliminated,
        );
        if (candidates.length === 0) {
          this.showToast("교환 대상 플레이어가 없습니다.", "#e74c3c");
          return;
        }
        let target = candidates[0];
        candidates.forEach((c) => {
          if ((Number(c.cards) || 0) > (Number(target.cards) || 0)) target = c;
        });

        // 애니메이션을 위한 상태 스냅샷
        const prevPlayers = players.map((p) => ({
          ...p,
          openStack: p.openStack ? [...p.openStack] : [],
        }));

        this.playKingSwapAnimation({
          byId: myId,
          targetId: target.id,
          players: prevPlayers,
          onComplete: () => {
            try {
              // 실제 덱 교환
              const myDeck = this.getSingleDeck(myId);
              const targetDeck = this.getSingleDeck(target.id);
              const tmp = myDeck.splice(
                0,
                myDeck.length,
                ...targetDeck.slice(),
              );
              targetDeck.splice(0, targetDeck.length, ...tmp);

              // 라운드 데이터 카드 수 갱신
              const me = players.find((p) => p.id === myId);
              const tp = players.find((p) => p.id === target.id);
              if (me) {
                me.cards = myDeck.length;
                me.remainingCards = me.cards;
              }
              if (tp) {
                tp.cards = targetDeck.length;
                tp.remainingCards = tp.cards;
              }

              // 로컬 인벤토리 차감 및 동기화 트리거
              const specialCardsOwned =
                JSON.parse(localStorage.getItem("specialCards")) || {};
              specialCardsOwned[cardId] = (specialCardsOwned[cardId] || 0) - 1;
              if (specialCardsOwned[cardId] <= 0)
                delete specialCardsOwned[cardId];
              localStorage.setItem(
                "specialCards",
                JSON.stringify(specialCardsOwned),
              );
              try {
                this.specialUsedThisTurn = this.specialUsedThisTurn || {};
                this.specialUsedThisTurn[myId] = true;
              } catch (e) {}
              this.updateEliminationStatus();
              this.renderTable(this.roundData.players);
              this.safeSyncInventory("useKing", { usedCardId: 8 });
              this.showToast("왕 카드 사용: 덱을 교환했습니다!", "#2ecc71");
            } catch (e) {
              console.warn("useSpecialCard king single error", e);
            }
          },
        });
      } catch (e) {
        console.warn("useSpecialCard king single error", e);
      }

      return;
    }

    // 블록(먹물) 카드 (id=6) 처리
    if (Number(cardId) === 6) {
      // 멀티플레이: 중앙 애니메이션 재생 후 서버 요청/낙관 업데이트 수행
      if (!this.isSingle && socket && socket.connected) {
        this.requestUseSpecialWithOptimistic(6, cardName);
        return;
      }

      // 싱글플레이: 로컬에서 즉시 블록카드를 각 플레이어 오픈스택에 추가
      try {
        const myId = this.myId || "PLAYER_ME";
        const specialCardsOwned =
          JSON.parse(localStorage.getItem("specialCards")) || {};
        specialCardsOwned[cardId] = (specialCardsOwned[cardId] || 0) - 1;
        if (specialCardsOwned[cardId] <= 0) delete specialCardsOwned[cardId];
        localStorage.setItem("specialCards", JSON.stringify(specialCardsOwned));
        this.specialUsedThisTurn = this.specialUsedThisTurn || {};
        this.specialUsedThisTurn[myId] = true;

        // create effect and add blockcards with effectId
        try {
          const effectId = `block_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
          this.blockEffects = this.blockEffects || [];
          // compute survivors (should be only alive players)
          const survivorsCount = Array.isArray(this.roundData.players)
            ? this.roundData.players.filter((p) => !p.isEliminated).length
            : 1;
          this.blockEffects.push({
            id: effectId,
            issuer: myId,
            remainingTurns: survivorsCount * 2,
          });

          this.roundData.players.forEach((p) => {
            if (!p || p.isEliminated) return;
            if (!p.openStack) p.openStack = [];
            const top = p.openStack[p.openStack.length - 1];
            if (!top || top.type !== "blockcard") {
              p.openStack.push({ type: "blockcard", issuer: myId, effectId });
            }
          });

          this.blockActive = true;
          this.blockBy = myId;
          this.renderTable(this.roundData.players);
          this.safeSyncInventory("useBlock", { usedCardId: 6 });
          this.showToast(
            "가림 카드 사용: 바닥 위에 blockcard가 추가되었습니다!",
            "#f39c12",
          );
        } catch (e) {
          console.warn("useSpecialCard block single error", e);
        }
      } catch (e) {
        console.warn("useSpecialCard block single error", e);
      }

      return;
    }

    // 기본(기타) 카드 사용: 로컬 차감 + 턴당 1회 플래그 설정
    this.showToast(`${cardName} 카드를 사용했습니다!`, "#2ecc71");
    specialCardsOwned[cardId] = count - 1;
    localStorage.setItem("specialCards", JSON.stringify(specialCardsOwned));
    try {
      const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
      this.specialUsedThisTurn = this.specialUsedThisTurn || {};
      this.specialUsedThisTurn[myId] = true;
    } catch (e) {}
    if (this.roundData && this.roundData.players)
      this.renderTable(this.roundData.players);
  }

  // 카드 뒤집기 버튼을 눌렀을 때 실행되는 함수

  // GameScene 클래스 내부 어딘가 (showResultOverlay 아래 추천)
  playReadyGoSequence(onComplete) {
    const { width, height } = this.cameras.main;

    const readyTxt = this.add
      .text(width / 2, height / 2, "READY", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.15}px`,
        color: "#f1c40f",
        stroke: "#000000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(5000)
      .setScale(0);

    this.tweens.add({
      targets: readyTxt,
      scale: 1,
      duration: 500,
      ease: "Back.out",
      onComplete: () => {
        this.time.delayedCall(500, () => {
          readyTxt.setText("GO!");
          readyTxt.setColor("#2ecc71");

          this.tweens.add({
            targets: readyTxt,
            scale: 1.5,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              readyTxt.destroy();
              if (onComplete) onComplete();
            },
          });
        });
      },
    });
  }

  showResultOverlay(players, isUpdate = false, resultData = null) {
    // 기존 게임 로그 데이터 및 텍스트 객체 제거
    if (this.logTexts) {
      this.logTexts.forEach((txt) => txt.destroy());
      this.logTexts = [];
    }
    if (this.gameLogs) {
      this.gameLogs = [];
    }

    if (!players || players.length === 0) return;

    // only play the gameover effect when showing final results, not on
    // minor UI updates (ready/host changes).  a prior update call could flip
    // the guard, preventing the real end‑of‑game sound from firing — making it
    // appear to "skip" occasionally.
    if (!isUpdate) {
      if (!this.resultGameoverPlayed) {
        this.resultGameoverPlayed = true;

        const bgm = this.sound.get("bgm");
        const originalBgmVolume =
          bgm && typeof bgm.volume === "number" ? bgm.volume : null;
        if (bgm && bgm.isPlaying && originalBgmVolume !== null) {
          this.tweens.add({
            targets: bgm,
            volume: Math.max(0.01, originalBgmVolume * 0.25),
            duration: 300,
            ease: "Sine.easeOut",
          });
        }

        const gameoverSound = this.sound.add("gameover", {
          volume: 0,
          loop: false,
        });

        // debug logging for intermittent failures
        console.log("[sound] playing gameover", gameoverSound);
        gameoverSound.play().catch((err) => {
          console.warn("gameover sound play failed", err);
        });

        this.tweens.add({
          targets: gameoverSound,
          volume: 1,
          duration: 300,
          ease: "Sine.easeOut",
        });

        const durationMs = Number(gameoverSound.duration || 0) * 1000;
        if (durationMs > 600) {
          this.time.delayedCall(durationMs - 400, () => {
            if (!gameoverSound || !gameoverSound.isPlaying) return;
            this.tweens.add({
              targets: gameoverSound,
              volume: 0,
              duration: 300,
              ease: "Sine.easeIn",
            });
          });
        }

        gameoverSound.once("complete", () => {
          try {
            gameoverSound.destroy();
          } catch (e) {}
          if (bgm && bgm.isPlaying && originalBgmVolume !== null) {
            this.tweens.add({
              targets: bgm,
              volume: originalBgmVolume,
              duration: 300,
              ease: "Sine.easeOut",
            });
          }
        });
      } else {
        // already played earlier in this result display
        console.log("[sound] gameover skipped because already played", {
          players,
          isUpdate,
        });
      }
    }

    const { width, height } = this.cameras.main;

    if (this.resultAutoLeaveTimer) {
      this.resultAutoLeaveTimer.remove();
      this.resultAutoLeaveTimer = null;
    }
    if (this.resultCountdownTimer) {
      this.resultCountdownTimer.remove();
      this.resultCountdownTimer = null;
    }

    if (this.resultContainer) {
      const prevY = this.resultContainer.y;
      this.resultContainer.destroy();
      this.resultContainer = this.add
        .container(0, isUpdate ? prevY : -height)
        .setDepth(3000);
    } else {
      this.resultContainer = this.add.container(0, -height).setDepth(3000);
    }

    const container = this.resultContainer;

    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setInteractive();
    const podiumBg = this.add
      .image(width / 2, height / 2, "resultbg")
      .setDisplaySize(width * 1.0, height * 1.0);

    container.add([overlay, podiumBg]);

    const resolveAvatarKey = (player) => {
      const directKey =
        player?.avatarKey || player?.characterKey || player?.current_character;
      if (typeof directKey === "string" && /^player_[1-4]$/.test(directKey)) {
        return directKey;
      }

      const roundPlayer = Array.isArray(this.roundData?.players)
        ? this.roundData.players.find((p) => p.id === player?.id)
        : null;
      const roundKey =
        roundPlayer?.avatarKey ||
        roundPlayer?.characterKey ||
        roundPlayer?.current_character;
      if (typeof roundKey === "string" && /^player_[1-4]$/.test(roundKey)) {
        return roundKey;
      }

      return "player_1";
    };

    const rankedPlayers = Array.isArray(players) ? players.slice(0, 3) : [];
    const podiumPositions = [
      { x: width * 0.5, y: height * 0.54 },
      { x: width * 0.23, y: height * 0.6 },
      { x: width * 0.79, y: height * 0.62 },
    ];

    rankedPlayers.forEach((player, index) => {
      const pos = podiumPositions[index];
      if (!pos) return;

      const avatarBaseKey = resolveAvatarKey(player);
      const resultAvatarTexture =
        this.getAvatarDisplayKey(avatarBaseKey) ||
        this.getAvatarDisplayKey("player_1") ||
        "player_1_frame_1";
      const avatar = this.add
        .sprite(pos.x, pos.y, resultAvatarTexture)
        .setDisplaySize(width * 0.345, width * 0.345)
        .setOrigin(0.5, 1);

      this.applyAvatarAnimation(avatar, avatarBaseKey);

      const nameText = this.add
        .text(
          pos.x,
          pos.y + width * 0.14,
          player?.nickname || player?.id || "요리사",
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.038}px`,
            color: "#ffffff",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5, 0);

      container.add([avatar, nameText]);
    });

    const countdownText = this.add
      .text(width / 2, height * 0.76, "20초뒤 대기실로 이동합니다.. (20)", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const confirmBtn = this.add
      .image(width / 2, height * 0.83, "uibtn")
      .setDisplaySize(width * 0.45, height * 0.075)
      .setInteractive({ useHandCursor: true });
    const confirmTxt = this.add
      .text(width / 2, height * 0.83, "확인", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    container.add([countdownText, confirmBtn, confirmTxt]);

    const playCoinCollectAnimation = () => {
      if (isUpdate || !this.textures.exists("coin")) {
        return;
      }

      const coinCountByRank = [30, 20, 10];
      const floorYMin = height * 0.72;
      const floorYMax = height * 0.86;
      const floorXMin = width * 0.2;
      const floorXMax = width * 0.8;
      let coinSequence = 0;

      rankedPlayers.forEach((_, rankIndex) => {
        const targetPos = podiumPositions[rankIndex];
        const coinCount = coinCountByRank[rankIndex] || 0;
        if (!targetPos || coinCount <= 0) {
          return;
        }
        const expReward =
          Number(rankedPlayers[rankIndex]?.earnedExperience) ||
          Number(players?.[rankIndex]?.earnedExperience) ||
          0;

        const targetX = targetPos.x;
        const targetY = targetPos.y - width * 0.14;
        let didShowRewardText = false;

        for (let index = 0; index < coinCount; index += 1) {
          const startX = Phaser.Math.FloatBetween(floorXMin, floorXMax);
          const startY = Phaser.Math.FloatBetween(floorYMin, floorYMax);
          const coin = this.add
            .image(startX, startY, "coin")
            .setDisplaySize(width * 0.038, width * 0.038)
            .setAlpha(0.95);

          container.add(coin);

          const bounceDelay = Phaser.Math.Between(0, 120);
          const flyDelay = 800 + coinSequence * 24;
          coinSequence += 1;
          const bounceHeight = Phaser.Math.Between(10, 18);
          const bounceDuration = Phaser.Math.Between(120, 160);
          const bounceTween = this.tweens.add({
            targets: coin,
            y: startY - bounceHeight,
            angle: Phaser.Math.Between(-10, 10),
            duration: bounceDuration,
            delay: bounceDelay,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });

          if (!didShowRewardText) {
            didShowRewardText = true;
            this.time.delayedCall(flyDelay, () => {
              playRewardTextAnimation(rankIndex, coinCount);
              if (expReward > 0) {
                playExpTextAnimation(rankIndex, expReward);
              }
            });
          }

          this.time.delayedCall(flyDelay, () => {
            if (!coin || !coin.active) {
              return;
            }
            if (bounceTween) {
              bounceTween.stop();
            }

            this.tweens.add({
              targets: coin,
              x: targetX + Phaser.Math.Between(-10, 10),
              y: targetY + Phaser.Math.Between(-10, 10),
              angle: Phaser.Math.Between(-180, 180),
              scale: 0.2,
              alpha: 0,
              duration: 500,
              ease: "Cubic.easeIn",
              onComplete: () => {
                if (coin && coin.active) {
                  coin.destroy();
                }
              },
            });
          });
        }
      });
    };

    const playRewardTextAnimation = (rankIndex, rewardCoin) => {
      if (isUpdate) {
        return;
      }

      const pos = podiumPositions[rankIndex];
      if (!pos || rewardCoin <= 0) {
        return;
      }

      const rewardText = this.add
        .text(pos.x, pos.y - width * 0.2, `+${rewardCoin}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.058}px`,
          color: "#ffd84d",
          fontWeight: "bold",
          stroke: "#5a3b00",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.6);

      container.add(rewardText);

      this.tweens.add({
        targets: rewardText,
        alpha: 1,
        scale: 1,
        duration: 220,
        ease: "Back.easeOut",
        onComplete: () => {
          if (!rewardText || !rewardText.active) {
            return;
          }

          this.tweens.add({
            targets: rewardText,
            y: rewardText.y - width * 0.09,
            alpha: 0,
            scale: 1.08,
            duration: 820,
            ease: "Sine.easeOut",
            onComplete: () => {
              if (rewardText && rewardText.active) {
                rewardText.destroy();
              }
            },
          });
        },
      });
    };

    const playExpTextAnimation = (rankIndex, rewardExp) => {
      if (isUpdate || rewardExp <= 0) {
        return;
      }

      const pos = podiumPositions[rankIndex];
      if (!pos) {
        return;
      }

      const expText = this.add
        .text(pos.x, pos.y - width * 0.14, `EXP + ${rewardExp}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.045}px`,
          color: "#7dd3fc",
          fontWeight: "bold",
          stroke: "#0f172a",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.6);

      container.add(expText);

      this.tweens.add({
        targets: expText,
        alpha: 1,
        scale: 1,
        duration: 220,
        ease: "Back.easeOut",
        onComplete: () => {
          if (!expText || !expText.active) {
            return;
          }

          this.tweens.add({
            targets: expText,
            y: expText.y - width * 0.07,
            alpha: 0,
            scale: 1.05,
            duration: 720,
            ease: "Sine.easeOut",
            onComplete: () => {
              if (expText && expText.active) {
                expText.destroy();
              }
            },
          });
        },
      });
    };

    const goToLobby = () => {
      this.returnToLobby();
    };

    confirmBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [confirmBtn, confirmTxt],
        scale: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          goToLobby();
        },
      });
    });

    let remainSeconds = 20;
    this.resultCountdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        remainSeconds -= 1;
        if (remainSeconds <= 0) {
          remainSeconds = 0;
        }
        countdownText.setText(
          `20초뒤 대기실로 이동합니다.. (${remainSeconds})`,
        );
      },
    });

    this.resultAutoLeaveTimer = this.time.delayedCall(20000, () => {
      goToLobby();
    });

    if (!isUpdate) {
      this.tweens.add({
        targets: container,
        y: 0,
        duration: 800,
        ease: "Back.easeOut",
        onComplete: () => {
          playCoinCollectAnimation();
        },
      });
    } else {
      container.y = 0;
    }
  }

  playFeedback(isSuccess, message = "") {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    if (isSuccess) {
      // 성공 피드백: 초록색 화면 반짝임 + PERFECT!
      try {
        if (window.ReactNativeWebView) {
          generateHapticFeedback({ type: "impactHeavy" }).catch(() => {});
        }
      } catch (e) {}

      const rect = this.add
        .rectangle(centerX, centerY, width, height, 0x22c55e, 0.3)
        .setDepth(5000);
      this.tweens.add({
        targets: rect,
        alpha: 0,
        duration: 500,
        onComplete: () => rect.destroy(),
      });

      /*const feedbackText = this.add
        .text(centerX, centerY, "SUCCESS!", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.15}px`,
          fill: "#ffffff",
          fontWeight: "bold",
          stroke: "#22c55e",
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(5001)
        .setScale(0);

      this.tweens.add({
        targets: feedbackText,
        scale: 1,
        duration: 500,
        ease: "Back.easeOut",
        onComplete: () => {
          this.time.delayedCall(1000, () => {
            this.tweens.add({
              targets: feedbackText,
              alpha: 0,
              scale: 1.5,
              duration: 300,
              onComplete: () => feedbackText.destroy(),
            });
          });
        },
      });*/
    } else {
      // 실패 피드백: 빨간색 화면 반짝임 + 화면 흔들림
      const rect = this.add
        .rectangle(centerX, centerY, width, height, 0xef4444, 0.4)
        .setDepth(5000);
      this.tweens.add({
        targets: rect,
        alpha: 0,
        duration: 400,
        onComplete: () => rect.destroy(),
      });

      this.cameras.main.shake(250, 0.015);

      // 실패 메시지 토스트 (예: "실패! 카드 1장씩 나눔")
      if (message) {
        //this.showToast(message, "#ef4444");
        this.addGameLog(message, "#ef4444");
      }
    }
  }

  playFinishAnimation(callback) {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 게임 조작 차단
    this.isGameReady = false;

    // "FINISH!" 텍스트 연출
    const finishText = this.add
      .text(centerX, centerY, "게임종료!", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.18}px`,
        fill: "#ef4444", // danger 색상
        fontWeight: "bold",
        stroke: "#ffffff",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(3000)
      .setScale(5)
      .setAlpha(0);

    // 쾅! 하고 나타나는 애니메이션
    this.tweens.add({
      targets: finishText,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: "Bounce.easeOut",
      onComplete: () => {
        // 1초 뒤에 위로 사라지며 콜백 실행
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: finishText,
            y: -100,
            alpha: 0,
            duration: 500,
            ease: "Power2",
            onComplete: () => {
              finishText.destroy();
              if (callback) callback(); // 애니메이션 끝나고 결과창 띄우기
            },
          });
        });
      },
    });

    // 화면 전체 살짝 어둡게 암전 효과
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0)
      .setDepth(2500);
    this.tweens.add({ targets: overlay, alpha: 0.5, duration: 400 });
  }

  playOpeningAnimation() {
    const { width, height } = this.cameras.main;

    // 1. 왼쪽 천막 생성 및 배치
    const leftCurtain = this.add
      .image(0, 0, "slide")
      .setOrigin(0, 0)
      .setDisplaySize(width / 2, height) // 화면 절반 너비로 설정
      .setDepth(2000);

    // 2. 오른쪽 천막 생성 및 배치
    const rightCurtain = this.add
      .image(width / 2, 0, "slide")
      .setOrigin(0, 0)
      .setDisplaySize(width / 2, height) // 화면 절반 너비로 설정
      .setDepth(2000)
      .setFlipX(true); // 오른쪽은 대칭(반전)시켜서 자연스럽게 표현 (선택사항)

    // 3. 문이 열리는 애니메이션 (Tween)
    this.tweens.add({
      targets: leftCurtain,
      x: -width / 2, // 왼쪽 밖으로 이동
      duration: 1200,
      ease: "Cubic.easeInOut",
    });

    this.tweens.add({
      targets: rightCurtain,
      x: width, // 오른쪽 밖으로 이동
      duration: 1200,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        leftCurtain.destroy();
        rightCurtain.destroy();
      },
    });
  }

  showReadyGo() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    this.sound.play("readygo", { volume: 0.2 });

    // "레디" 텍스트 생성
    const readyText = this.add
      .text(centerX, centerY, "READY", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.15}px`,
        fill: "#f59e0b", // warning 색상 계열
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setScale(0);

    // 연출 시퀀스
    this.tweens.add({
      targets: readyText,
      scale: 1,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        // 1초 대기 후 "고!"로 변경
        this.time.delayedCall(400, () => {
          readyText.setText("GO!");
          readyText.setFill("#22c55e"); // success 색상 계열

          this.tweens.add({
            targets: readyText,
            scale: 1.5,
            alpha: 0,
            duration: 300,
            ease: "Power2",
            onComplete: () => {
              readyText.destroy();
              this.isGameReady = true; // 이제부터 조작 가능
              try {
                const myId = this.isSingle ? this.myId : socket.id;
                const currentTurnId =
                  this.roundData?.players?.[this.turnIndex]?.id;
                const serverNext = this.latestNextTurnId || null;
                this.canClick = currentTurnId === myId || serverNext === myId;
              } catch (e) {}
            },
          });
        });
      },
    });
  }

  showToast(message, color = "#ffffff") {
    this.isToastOpen = true;

    const { width, height } = this.cameras.main;

    if (!this.toastLayer || !this.toastLayer.scene) {
      this.toastLayer = this.add.container(0, 0).setDepth(1000000);
      this.toastLayer.setScrollFactor(0);
    }
    this.toastLayer.setVisible(true);
    this.toastLayer.setActive(true);
    this.children.bringToTop(this.toastLayer);

    const toast = this.add.container(width / 2, -80).setDepth(1000001);
    toast.setScrollFactor(0);

    const txt = this.add
      .text(0, 0, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.floor(width * 0.05)}px`,
        color: color,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, "#000000", 6, true, true);

    const paddingX = Math.floor(width * 0.04);
    const paddingY = Math.floor(width * 0.018);
    const bg = this.add
      .rectangle(
        0,
        0,
        Math.min(width * 0.86, txt.width + paddingX * 2),
        txt.height + paddingY * 2,
        0x000000,
        0.85,
      )
      .setOrigin(0.5);

    toast.add([bg, txt]);
    this.toastLayer.add(toast);

    try {
      this.sound.play("pass", { volume: 0.5 });
    } catch (e) {}

    this.tweens.add({
      targets: toast,
      y: height * 0.22,
      duration: 400,
      ease: "Back.easeOut",
      onStart: () => {},
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          if (toast.scene) {
            this.tweens.add({
              targets: toast,
              y: -100,
              duration: 300,
              ease: "Power2.easeIn",
              onComplete: () => {
                toast.destroy();
                this.activeToast = null;
                this.isToastOpen = false;
              },
            });
          }
        });
      },
    });
  }

  buildThiefPlayerSnapshot(playersSnapshot = [], thiefId, recipientIds = []) {
    if (!Array.isArray(playersSnapshot) || playersSnapshot.length === 0) {
      return { players: null, stolenCount: 0 };
    }

    const clones = playersSnapshot.map((p) => ({ ...p }));
    const thief = clones.find((p) => p.id === thiefId);
    let stolenCount = 0;
    const handled = new Set();

    recipientIds.forEach((id) => {
      if (handled.has(id)) return;
      handled.add(id);
      const target = clones.find((p) => p.id === id);
      if (!target || target.isEliminated) return;
      const current = Math.max(0, Number(target.cards) || 0);
      if (current <= 0) return;
      target.cards = current - 1;
      target.remainingCards = target.cards;
      stolenCount += 1;
    });

    if (thief && stolenCount > 0) {
      const base = Math.max(0, Number(thief.cards) || 0);
      thief.cards = base + stolenCount;
      thief.remainingCards = thief.cards;
    }

    return { players: clones, stolenCount };
  }

  showCustomAlert(message, onConfirm) {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.6)
      .setDepth(4000)
      .setInteractive();

    // 2. 팝업 배경
    const popupBg = this.add
      .image(centerX, centerY, "profilebg")
      .setDepth(4001)
      .setDisplaySize(width * 0.75, height * 0.23);

    // 3. 메시지 텍스트
    const msgText = this.add
      .text(centerX, height * 0.46, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        align: "center",
        wordWrap: { width: width * 0.6 },
      })
      .setOrigin(0.5)
      .setDepth(4002);

    // 공통 제거 함수
    const closeAlert = () => {
      [
        overlay,
        popupBg,
        msgText,
        confirmBtn,
        confirmTxt,
        cancelBtn,
        cancelTxt,
      ].forEach((el) => {
        if (el) el.destroy();
      });

      if (this.currentGamePopupCloseHandler === closeAlert) {
        this.currentGamePopupCloseHandler = null;
      }
    };

    this.currentGamePopupCloseHandler = closeAlert;

    const btnY = height * 0.54;
    const btnGap = width * 0.15;

    // --- 취소 버튼 ---
    const cancelBtn = this.add
      .image(centerX - btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.23, height * 0.06)
      .setInteractive({ useHandCursor: true })
      .setDepth(4002)
      .setTint(0xffaaaa);

    const cancelTxt = this.add
      .text(centerX - btnGap, btnY, "취소", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    cancelBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [cancelBtn, cancelTxt],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          closeAlert();
        },
      });
    });

    // --- 확인 버튼 ---
    const confirmBtn = this.add
      .image(centerX + btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.23, height * 0.06)
      .setInteractive({ useHandCursor: true })
      .setDepth(4002);

    const confirmTxt = this.add
      .text(centerX + btnGap, btnY, "확인", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    confirmBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [confirmBtn, confirmTxt],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          closeAlert();
          if (onConfirm) onConfirm();
        },
      });
    });
  }

  showInvitePopup(users, roomName) {
    const { width, height, centerX, centerY } = this.cameras.main;

    // 배경
    const popupWidth = width * 0.85;
    const popupHeight = height * 0.55;
    const popupBg = this.add
      .image(centerX, centerY, "invitebg")
      .setDisplaySize(popupWidth, popupHeight)
      .setDepth(300)
      .setInteractive();

    // 타이틀
    const titleText = this.add
      .text(centerX, centerY - popupHeight / 2 + height * 0.05, "초대하기", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffd700",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(301);

    // 서브텍스트
    const subText = this.add
      .text(
        centerX,
        centerY - popupHeight / 2 + height * 0.1,
        `방: ${roomName}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#aaa",
          fontWeight: "normal",
        },
      )
      .setOrigin(0.5)
      .setDepth(301);

    // 유저 리스트 컨테이너
    const listContainerY = centerY;
    const listH = height * 0.35;
    const userButtons = [];

    if (!Array.isArray(users) || users.length === 0) {
      const emptyText = this.add
        .text(
          centerX,
          centerY + height * 0.02,
          "초대가능한 플레이어가 없습니다",
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.04}px`,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5)
        .setDepth(302);

      userButtons.push(emptyText);
    }

    users.forEach((user, index) => {
      const btnY =
        listContainerY - listH / 2 + (index + 1) * (listH / (users.length + 1));
      const userIconX = centerX - popupWidth * 0.31;
      const userTextX = centerX - popupWidth * 0.21;
      const inviteBtnX = centerX + popupWidth * 0.26;

      // 유저 배경
      const userBg = this.add
        .image(centerX, btnY, "roombg")
        .setDisplaySize(popupWidth * 0.8, height * 0.068)
        .setDepth(301)
        .setInteractive({ useHandCursor: true });

      // 유저 아이콘
      const baseUserAvatar = /^player_[1-4]$/.test(user.avatarKey)
        ? user.avatarKey
        : "player_1";

      const userIcon = this.add
        .image(
          userIconX,
          btnY,
          this.textures.exists(`${baseUserAvatar}_1`)
            ? `${baseUserAvatar}_1`
            : this.getAvatarDisplayKey(baseUserAvatar) || "player_1_frame_1",
        )
        .setDisplaySize(height * 0.045, height * 0.045)
        .setDepth(302);

      // 유저명 + 레벨 (한 줄)
      const userInfo = this.add
        .text(userTextX, btnY, `Lv.${user.level} ${user.nickname}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.032}px`,
          color: "#fff",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(302);

      // 초대 버튼
      const inviteBtn = this.add
        .rectangle(inviteBtnX, btnY, width * 0.12, height * 0.05, 0x3498db, 1)
        .setStrokeStyle(2, 0x2980b9, 1)
        .setDepth(301)
        .setInteractive({ useHandCursor: true });

      const inviteBtnText = this.add
        .text(inviteBtnX, btnY, "초대", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#fff",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(302);

      inviteBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: [inviteBtn, inviteBtnText],
          scaleX: "*=0.9",
          scaleY: "*=0.9",
          duration: 100,
          yoyo: true,
          ease: "Quad.easeInOut",
          onComplete: () => {
            socket.emit("inviteUser", { targetId: user.id });
            this.showToast(`${user.nickname}님을 초대했습니다!`, "#3498db");
            this.time.delayedCall(500, () => {
              popupBg.destroy();
              titleText.destroy();
              subText.destroy();
              userButtons.forEach((btn) => {
                if (btn && btn.active) btn.destroy();
              });
            });
          },
        });
      });

      userButtons.push(userBg, userIcon, userInfo, inviteBtn, inviteBtnText);
    });

    // 닫기 버튼 (popupclose 이미지)
    const closeBtn = this.add
      .image(
        centerX + popupWidth / 2 - width * 0.06,
        centerY - popupHeight / 2 + height * 0.03,
        "popupclose",
      )
      .setDisplaySize(width * 0.085, width * 0.085)
      .setDepth(302)
      .setInteractive({ useHandCursor: true });

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      popupBg.destroy();
      titleText.destroy();
      subText.destroy();
      closeBtn.destroy();
      userButtons.forEach((btn) => {
        if (btn && btn.active) btn.destroy();
      });
    });

    // 사용자가 클릭한 영역 외 팝업 배경 클릭 시 닫기
    popupBg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      popupBg.destroy();
      titleText.destroy();
      subText.destroy();
      closeBtn.destroy();
      userButtons.forEach((btn) => {
        if (btn && btn.active) btn.destroy();
      });
    });
  }

  showInviteReceivePopup(inviteData) {
    const { width, height, centerX, centerY } = this.cameras.main;

    // 배경
    const popupWidth = width * 0.75;
    const popupHeight = height * 0.35;
    const popupBg = this.add
      .rectangle(centerX, centerY, popupWidth, popupHeight, 0x1a1a2e, 0.95)
      .setDepth(300)
      .setStrokeStyle(3, 0x3498db, 1);

    // 타이틀
    const titleText = this.add
      .text(
        centerX,
        centerY - popupHeight / 2 + height * 0.04,
        "초대 받았습니다!",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#3498db",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(301);

    // 초대 정보
    const infoText = this.add
      .text(
        centerX,
        centerY - height * 0.02,
        `${inviteData.inviterNickname}\n${inviteData.roomName}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          color: "#fff",
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setDepth(301);

    const playerCountText = this.add
      .text(
        centerX,
        centerY + height * 0.08,
        `플레이어: ${inviteData.currentPlayers}/${inviteData.maxPlayers}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#aaa",
        },
      )
      .setOrigin(0.5)
      .setDepth(301);

    // 수락 버튼
    const acceptBtn = this.add
      .rectangle(
        centerX - width * 0.15,
        centerY + popupHeight / 2 - height * 0.05,
        width * 0.2,
        height * 0.06,
        0x2ecc71,
        1,
      )
      .setStrokeStyle(2, 0x27ae60, 1)
      .setDepth(301)
      .setInteractive({ useHandCursor: true });

    const acceptBtnText = this.add
      .text(
        centerX - width * 0.15,
        centerY + popupHeight / 2 - height * 0.05,
        "수락",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#fff",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(302);

    // 거절 버튼
    const declineBtn = this.add
      .rectangle(
        centerX + width * 0.15,
        centerY + popupHeight / 2 - height * 0.05,
        width * 0.2,
        height * 0.06,
        0xe74c3c,
        1,
      )
      .setStrokeStyle(2, 0xc0392b, 1)
      .setDepth(301)
      .setInteractive({ useHandCursor: true });

    const declineBtnText = this.add
      .text(
        centerX + width * 0.15,
        centerY + popupHeight / 2 - height * 0.05,
        "거절",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#fff",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(302);

    // 자동 닫기 (15초)
    let autoCloseTimer = this.time.delayedCall(15000, () => {
      if (popupBg && popupBg.active) {
        destroyPopup();
      }
    });

    const destroyPopup = () => {
      if (autoCloseTimer) autoCloseTimer.remove();
      popupBg.destroy();
      titleText.destroy();
      infoText.destroy();
      playerCountText.destroy();
      acceptBtn.destroy();
      acceptBtnText.destroy();
      declineBtn.destroy();
      declineBtnText.destroy();
    };

    acceptBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [acceptBtn, acceptBtnText],
        scaleX: "*=0.9",
        scaleY: "*=0.9",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          socket.emit("acceptInvite", { roomId: inviteData.roomId });
          this.showToast("초대를 수락했습니다!", "#2ecc71");
          destroyPopup();
        },
      });
    });

    declineBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.tweens.add({
        targets: [declineBtn, declineBtnText],
        scaleX: "*=0.9",
        scaleY: "*=0.9",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          this.showToast("초대를 거절했습니다!", "#e74c3c");
          destroyPopup();
        },
      });
    });
  }
}

// share animation helpers with LobbyScene as well
if (typeof LobbyScene !== "undefined" && typeof GameScene !== "undefined") {
  LobbyScene.prototype.ensureAvatarAnimation =
    GameScene.prototype.ensureAvatarAnimation;
  LobbyScene.prototype.applyAvatarAnimation =
    GameScene.prototype.applyAvatarAnimation;

  // also copy underlying helpers so lobby scene can resolve keys
  [
    "getAvatarAnimKey",
    "getAvatarAnimFrameRate",
    "getAvatarAnimMaxFrame",
    "getAvatarDisplayKey",
  ].forEach((fn) => {
    if (typeof GameScene.prototype[fn] === "function") {
      LobbyScene.prototype[fn] = GameScene.prototype[fn];
    }
  });
}
// pick scale mode based on orientation.  portrait devices get ENVELOP
// which fills the width and crops top/bottom; landscape devices use FIT
// so the full 9:16 world is visible with black bars on the shorter axis.
// the body background color has already been set to match the game, so
// the "bars" are invisible.
const isPortraitInit = window.innerHeight > window.innerWidth;
const initialMode = isPortraitInit ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;

const config = {
  type: Phaser.AUTO,
  parent: "game-container", // 🔹 위에서 만든 div ID와 일치해야 함
  width: 1080, // 기준 해상도 (세로형 게임 기준, 내부 논리 크기)
  height: 1920,
  backgroundColor: "#0f172a",
  scale: {
    mode: initialMode,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    resolution: window.devicePixelRatio || 1,
  },
  dom: { createContainer: true }, // ✅ 여기를 추가
  scene: [LobbyScene, GameScene],
};

const game = new Phaser.Game(config);

// adjust when orientation/size changes
window.addEventListener("resize", () => {
  if (!game || !game.scale) return;
  const portrait = window.innerHeight > window.innerWidth;
  const mode = portrait ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;
  if (game.scale.scaleMode !== mode) {
    // Phaser 3에서는 setMode 대신 다른 방식 사용
    game.scale.scaleMode = mode;
    game.scale.refresh();
  }

  // camera bounds update (optional)
  if (game.scene && game.scene.keys) {
    Object.values(game.scene.keys).forEach((scene) => {
      if (scene && scene.cameras && scene.cameras.main) {
        scene.cameras.main.setBounds(0, 0, game.scale.width, game.scale.height);
      }
    });
  }
});
