import {
  generateHapticFeedback,
  getUserKeyForGame,
  IAP,
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";
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
const TUTORIAL_PROGRESS_KEY = "tutorialProgress";

// 광고 및 인앱결제 상수
const REMOVE_ADS_PRODUCT_SKU = "ait.0000018169.c994af03.c3660ae3e9.1852918968";
const REMOVE_ADS_PRODUCT_NAME = "광고제거";

function getIntegratedAdGroupId() {
  if (typeof window === "undefined") return null;

  return (
    window.__INTEGRATED_AD_GROUP_ID ||
    localStorage.getItem("integratedAdGroupId") ||
    "ait-ad-test-interstitial-id"
  );
}

function canUseIntegratedAd() {
  try {
    if (
      !loadFullScreenAd ||
      !showFullScreenAd ||
      typeof loadFullScreenAd.isSupported !== "function" ||
      typeof showFullScreenAd.isSupported !== "function"
    ) {
      return false;
    }

    return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
  } catch (error) {
    console.warn("IntegratedAd 지원 여부 확인 실패", error);
    return false;
  }
}

// Reward character key (저장/잠금 해제에 사용되는 아이디)
const PREMIUM_BEAR_KEY = "player_2"; // 보상으로 지급되는 캐릭터 키 (player_2)

function loadTutorialProgress() {
  try {
    const raw = localStorage.getItem(TUTORIAL_PROGRESS_KEY) || "";
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isInteger(parsed.stageIndex)) parsed.stageIndex = 0;
    if (!Array.isArray(parsed.completedStages)) parsed.completedStages = [];
    parsed.completedStages = parsed.completedStages.filter(
      (x) => typeof x === "string",
    );
    return parsed;
  } catch (e) {
    console.warn("loadTutorialProgress failed", e);
    return null;
  }
}

function saveTutorialProgress(progress) {
  try {
    if (!progress || typeof progress !== "object") return;
    const payload = {
      stageIndex: Number(progress.stageIndex) || 0,
      completedStages: Array.isArray(progress.completedStages)
        ? [...progress.completedStages]
        : [],
    };
    localStorage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("saveTutorialProgress failed", e);
  }
}

function clearTutorialProgress() {
  try {
    localStorage.removeItem(TUTORIAL_PROGRESS_KEY);
  } catch (e) {
    console.warn("clearTutorialProgress failed", e);
  }
}

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
    rewardCoins: 20,
  },
  {
    key: "big_haul",
    type: "threshold",
    titleTemplate: "카드 {threshold}장 획득하기",
    descriptionTemplate: "한 번의 정답으로 카드 {threshold}장을 가져가세요.",
    initialTarget: 1,
    targetIncrement: 1,
    initialThreshold: 5,
    thresholdIncrement: 1,
    rewardCoins: 30,
  },
  {
    key: "penalty_runner",
    type: "count",
    titleTemplate: "패널티 {target}회 받기",
    descriptionTemplate: "실수로 종을 쳐서 패널티를 {target}번 받아보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 20,
  },
  {
    key: "bomb_flip",
    type: "count",
    titleTemplate: "폭탄 {target}회 오픈",
    descriptionTemplate: "내 덱에서 폭탄 카드를 총 {target}번 뒤집어보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 20,
  },
  {
    key: "combo_duo",
    type: "count",
    titleTemplate: "{target}콤보 성공",
    descriptionTemplate: "정답을 연속 {target}번 맞춰 콤보를 달성하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 30,
  },
  {
    key: "thunder_flip",
    type: "count",
    titleTemplate: "번개 {target}회 오픈",
    descriptionTemplate: "내 덱에서 번개 카드를 총 {target}번 뒤집어보세요.",
    initialTarget: 3,
    targetIncrement: 1,
    rewardCoins: 18,
  },
];

const MULTI_QUEST_CONFIGS = [
  {
    key: "single_play",
    type: "count",
    titleTemplate: "싱글플레이 {target}회 참여",
    descriptionTemplate: "싱글 플레이를 {target}회 시작해보세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 80,
  },
  {
    key: "single_win",
    type: "count",
    titleTemplate: "싱글플레이 {target}회 우승",
    descriptionTemplate: "싱글 플레이에서 {target}회 승리하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 120,
  },
  {
    key: "multi_play",
    type: "count",
    titleTemplate: "멀티플레이 {target}회 참여",
    descriptionTemplate: "멀티 플레이를 {target}회 시작해보세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 60,
  },
  {
    key: "multi_win",
    type: "count",
    titleTemplate: "멀티플레이 {target}회 우승",
    descriptionTemplate: "멀티 플레이에서 {target}회 1위를 달성하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 150,
  },
  {
    key: "shop_buy",
    type: "count",
    titleTemplate: "상점에서 아이템 {target}회 구매",
    descriptionTemplate: "상점에서 아이템을 {target}회 구매하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 80,
  },
  {
    key: "watch_ad",
    type: "count",
    titleTemplate: "광고보상 {target}회 시청",
    descriptionTemplate: "광고 보상을 {target}회 시청하세요.",
    initialTarget: 1,
    targetIncrement: 1,
    rewardCoins: 50,
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
    description: "카드를 눌러 제출하세요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "ringFive",
    title: "2단계 · 카드 획득",
    description: "과일이 5개 되면 종을 눌러요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "wrongBell",
    title: "3단계 · 패널티",
    description: "실수로 종을 누르면 카드를 한 장씩 뺏겨요.",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "bomb",
    title: "4단계 · 특수카드: 폭탄",
    description:
      "폭탄이 나오면 절대 누르지 마세요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "thunder",
    title: "5단계 · 특수카드: 번개",
    description:
      "번개가 나오면 즉시 종을 눌러 카드를 가져가요!",
    pointer: "deck",
    reward: 20,
  },
  {
    key: "plus1",
    title: "6단계 · 특수카드: +1",
    description:
      "+1 카드가 있으면 모든 카드 숫자에 +1이 더해져요.",
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
});

socket.off("connect").on("connect", () => {

});

socket.off("disconnect").on("disconnect", (reason) => {

});

socket.off("serverHello").on("serverHello", (payload) => {

});

// -----------------------------------------------------------------------------
// utility for cutting player sprite sheet into frames (columns)
// called early in both LobbyScene and GameScene so UI can display when owned.
function ensurePlayerFrames(scene, spriteKey, prefix) {
  try {
    if (!scene || !scene.textures) {
      return;
    }
    if (!scene.textures.exists(spriteKey)) {
      return;
    }
    const tex = scene.textures.get(spriteKey);
    const img = tex.getSourceImage();
    if (!img || !img.width || !img.height) {
      return;
    }

    const cols = 10;
    const rows = 10;
    const w = img.width;
    const h = img.height;
    const frameW = Math.floor(w / cols) || w;
    const frameH = Math.floor(h / rows) || h;

    let idx = 1;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
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
          continue;
        }

        const key = `${prefix}_${idx}`;
        idx += 1;
        if (scene.textures.exists(key)) continue;

        const canvasTex = scene.textures.createCanvas(key, frameW, frameH);
        const ctx = canvasTex.getContext();
        ctx.drawImage(img, -c * frameW, -r * frameH);
        canvasTex.refresh();
      }
    }
  } catch (e) {
    // ignore
  }
}

function ensurePlayer2Frames(scene) {
  ensurePlayerFrames(scene, "player_2_sprite", "player_2");
}

function ensurePlayer3Frames(scene) {
  ensurePlayerFrames(scene, "player_3_sprite", "player_3");
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

function showCoinBurstEffect(scene, targetX, targetY, amount = 0) {
  if (!scene || !scene.add || !scene.tweens) return;

  try {
    const coinCenter = scene.add
      .image(targetX, targetY, "coin")
      .setDisplaySize(48, 48)
      .setDepth(10000)
      .setScrollFactor(0)
      .setScale(0.1)
      .setAlpha(0);

    scene.tweens.add({
      targets: coinCenter,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: "Back.out",
      onComplete: () => {
        scene.tweens.add({
          targets: coinCenter,
          alpha: 0,
          scale: 0.7,
          duration: 200,
          delay: 160,
          onComplete: () => coinCenter.destroy(),
        });
      },
    });

    const colors = ["#f59e0b", "#facc15", "#fdba74", "#f97316", "#fde68a"];
    const burstCount = 20;
    for (let i = 0; i < burstCount; i += 1) {
      const angle = (Math.PI * 2 * i) / burstCount;
      const speed = 60 + Math.random() * 140;
      const particle = scene.add
        .circle(
          targetX,
          targetY,
          6 + Math.random() * 6,
          colors[i % colors.length],
          1,
        )
        .setDepth(10000)
        .setScrollFactor(0);

      scene.tweens.add({
        targets: particle,
        x: targetX + Math.cos(angle) * speed,
        y: targetY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.3,
        duration: 700 + Math.random() * 160,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }

    if (amount > 0) {
      const amountText = scene.add
        .text(targetX, targetY - 30, `+${amount}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: "32px",
          color: "#fde68a",
          stroke: "#f97316",
          strokeThickness: 4,
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(10001)
        .setScrollFactor(0);

      scene.tweens.add({
        targets: amountText,
        y: targetY - 70,
        alpha: 0,
        scale: 1.3,
        duration: 900,
        ease: "Sine.easeOut",
        onComplete: () => amountText.destroy(),
      });
    }
  } catch (e) {
    console.warn("showCoinBurstEffect error", e);
  }
}

let bgmEnabled = localStorage.getItem("bgmEnabled") !== "false";

class LobbyScene extends Phaser.Scene {
  constructor() {
    super("LobbyScene");
  }

  init() {
    // 광고 관련 상태 변수
    this.isOnline = false;
    this.isLobbyIntegratedAdLoaded = false;
    this.isLobbyIntegratedAdLoading = false;
    this.unregisterLobbyIntegratedAdLoad = null;
    this.adBtnImg = null;
    this.adBtnText = null;
    this.lobbyAdLoadTimeout = null;
    this.lastLobbyAdToastAt = 0;

    // 인앱결제(IAP) 관련 상태 변수
    this.iapRemoveAdsSku = null;
    this.iapRemoveAdsAmountLabel = "";
    this.isIapProductLoading = false;
    this.isIapPurchasing = false;
    this.iapBtnImg = null;
    this.iapBtnText = null;
    this.iapPurchaseCleanup = null;

    // 🎮 모바일 최적화 설정
    const isMobileDevice = window.innerWidth < 768 || /mobile|android|iphone|ipad/i.test(navigator.userAgent.toLowerCase());
    const isLowEndDevice = navigator.deviceMemory ? navigator.deviceMemory <= 2 : performance.memory ? performance.memory.jsHeapSizeLimit < 512 * 1024 * 1024 : false;
    
    // 저사양 모바일 감지:
    // - 화면 너비 < 768px (모바일)
    // - RAM <= 2GB 또는 힙 크기 < 512MB
    this.isMobileOptimized = isMobileDevice;
    this.isLowEndDevice = isLowEndDevice;
    
    // 애니메이션 설정 (저사양 기기에서는 감소)
    this.particleCountMultiplier = isLowEndDevice ? 0.4 : (isMobileDevice ? 0.6 : 1.0);
    this.animationDurationMultiplier = isLowEndDevice ? 0.7 : (isMobileDevice ? 0.85 : 1.0);
    
    // 동시 실행 애니메이션 제한
    this.maxConcurrentAnims = isLowEndDevice ? 5 : (isMobileDevice ? 8 : 20);
    this.currentAnimCount = 0;
    
    console.log(`[Optimization] Mobile: ${isMobileDevice}, LowEnd: ${isLowEndDevice}, ParticleMultiplier: ${this.particleCountMultiplier}`);
  }

  // avatar helper methods (copied from GameScene) so lobby can use same logic
  getAvatarAnimKey(baseKey) {
    return `avatar_anim_${baseKey}`;
  }

  getAvatarAnimFrameRate(baseKey) {
    // player_1/player_2/player_3/player_4 모두 빠른 프레임으로 재생
    return baseKey === "player_1" || baseKey === "player_2" || baseKey === "player_3" || baseKey === "player_4" ? 18 : 2;
  }

  getAvatarAnimMaxFrame(baseKey) {
    // player_1/player_2/player_3/player_4은 최대 91 프레임을 사용하여 자연스럽게 재생
    return /^player_[1-4]$/.test(baseKey) ? 91 : 2;
  }

  setCoinsAbsolute(total, options = {}) {
    try {
      const next = Number.isFinite(Number(total)) ? Number(total) : null;
      if (next === null) {
        return null;
      }
      if (!this.myProfile || typeof this.myProfile !== "object") {
        this.myProfile = { level: 1, coins: 0, experience: 0 };
      }
      this.myProfile.coins = next;

      if (typeof this.updateMyProfileUI === "function") {
        this.updateMyProfileUI();
      } else {
        if (this.shopCoinText && typeof this.shopCoinText.setText === "function") {
          this.shopCoinText.setText(`💰 ${next}`);
        }
        if (
          this.coinShopCurrentCoinText &&
          typeof this.coinShopCurrentCoinText.setText === "function"
        ) {
          this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${next}`);
        }
      }

      // 🔴 [보안] 코인은 로컬 저장소에 저장하지 않음 (서버에서만 관리)

      if (options.sync && typeof this.safeSyncInventory === "function") {
        try {
          this.safeSyncInventory("setCoinsAbsolute", {
            coins: next,
            sync: true,
          });
        } catch (e) {
          console.warn("LobbyScene.setCoinsAbsolute safeSyncInventory failed", e);
        }
      }
      return next;
    } catch (e) {
      console.warn("LobbyScene.setCoinsAbsolute failed", e);
      return null;
    }
  }

  // Start a pending coin deduction for optimistic UI updates.
  // This records the original coin total and updates UI to show predicted value.
  startPendingCoinDeduction(price) {
    try {
      if (!Number.isFinite(Number(price)) || Number(price) <= 0) return false;
      if (!this.myProfile) this.myProfile = { coins: 0 };
      if (this.coinPurchaseInProgress) return false; // already pending
      this.coinPurchaseInProgress = true;
      this.pendingCoinDeduction = Number(price) || 0;
      this.pendingOriginalCoins = Number(this.myProfile.coins) || 0;
      const predicted = Math.max(0, this.pendingOriginalCoins - this.pendingCoinDeduction);
      this.myProfile.coins = predicted;
      if (this.shopCoinText && typeof this.shopCoinText.setText === "function") {
        this.shopCoinText.setText(`💰 ${predicted}`);
      }
      if (
        this.coinShopCurrentCoinText &&
        typeof this.coinShopCurrentCoinText.setText === "function"
      ) {
        this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${predicted}`);
      }
      if (typeof this.updateMyProfileUI === "function") {
        this.updateMyProfileUI();
      }
      return true;
    } catch (e) {
      console.warn("startPendingCoinDeduction failed", e);
      return false;
    }
  }

  // Cancel an in-progress pending deduction and restore original coin count
  cancelPendingCoinDeduction() {
    try {
      if (!this.coinPurchaseInProgress) return false;
      const orig = Number(this.pendingOriginalCoins) || 0;
      this.pendingCoinDeduction = 0;
      this.pendingOriginalCoins = 0;
      this.coinPurchaseInProgress = false;
      this.setCoinsAbsolute(orig, { sync: false });
      return true;
    } catch (e) {
      console.warn("cancelPendingCoinDeduction failed", e);
      return false;
    }
  }

  modifyCoins(delta, options = {}) {
    try {
      const amount = Number(delta) || 0;
      if (!this.myProfile || typeof this.myProfile !== "object") {
        this.myProfile = { level: 1, coins: 0, experience: 0 };
      }
      const prev = Number(this.myProfile.coins) || 0;
      const next = prev + amount;
      this.myProfile.coins = next;

      if (typeof this.updateMyProfileUI === "function") {
        this.updateMyProfileUI();
      } else {
        if (this.shopCoinText && typeof this.shopCoinText.setText === "function") {
          this.shopCoinText.setText(`💰 ${next}`);
        }
        if (
          this.coinShopCurrentCoinText &&
          typeof this.coinShopCurrentCoinText.setText === "function"
        ) {
          this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${next}`);
        }
      }

      try {
        localStorage.setItem('profileCoins', String(next));
      } catch (e) {
        console.warn('[LobbyScene.modifyCoins] localStorage persist failed', e);
      }

      if (options.sync && typeof this.safeSyncInventory === "function") {
        try {
          this.safeSyncInventory("modifyCoins", {
            coins: next,
            delta: amount,
            questMode: true,
          });
        } catch (e) {
          console.warn("LobbyScene.modifyCoins safeSyncInventory failed", e);
        }
      }
      return next;
    } catch (e) {
      console.warn("LobbyScene.modifyCoins failed", e);
      return null;
    }
  }

  rewardQuestCoins(amount, reason, questKey) {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const beforeCoins = Number(this.myProfile?.coins) || 0;
    console.log(`🎯 [rewardQuestCoins] 싱글퀘스트 보상 시작`, {
      questKey,
      reason,
      amount: Number(amount),
      beforeCoins,
      isSingle: this.isSingle,
      timestamp: new Date().toISOString()
    });

    this.modifyCoins(Number(amount), { sync: true, reason: 'questReward', questKey });
    
    const afterCoins = Number(this.myProfile?.coins) || 0;
    console.log(`✅ [rewardQuestCoins] 퀘스트 보상 적용됨`, {
      questKey,
      amount: Number(amount),
      beforeCoins,
      afterCoins,
      delta: afterCoins - beforeCoins
    });
    
    if (!this.isSingle) {
      this.showToast(`퀘스트 보상 ${amount}💰 (${reason})`, "#22c55e");
    }
    
    // Explicitly sync quest reward to server with full coins amount
    try {
      if (typeof this.emitInventory === "function") {
        this.emitInventory("questReward", { 
          amount: Number(amount),
          questKey,
          reason,
          requireServerProfile: false 
        });
        console.log(`🛰️ [rewardQuestCoins] 서버로 동기화됨`, { amount, questKey });
      }
    } catch (e) {
      console.warn("LobbyScene.rewardQuestCoins emitInventory failed", e);
    }
  }

  // === IAP (인앱결제) 관련 헬퍼 메서드 ===
  normalizeIapText(value) {
    return String(value || "")
      .replace(/\s/g, "")
      .toLowerCase();
  }

  parseIapErrorMessage(error) {
    if (!error) return "원인을 확인할 수 없어요.";

    if (typeof error === "string") return error;

    if (error instanceof Error && error.message) return error.message;

    if (typeof error === "object") {
      if (typeof error.code === "string") {
        return error.code;
      }

      if (typeof error.message === "string") {
        return error.message;
      }

      try {
        return JSON.stringify(error);
      } catch (_e) {
        return "에러 객체를 문자열로 변환하지 못했어요.";
      }
    }

    return String(error);
  }

  updateIapButtonState() {
    if (!this.iapBtnImg || !this.iapBtnText) return;

    if (localStorage.getItem("adsRemoved") === "true") {
      this.iapBtnImg.setTint(0x16a34a);
      this.iapBtnText.setText("광고 제거됨");
      return;
    }

    if (this.isIapPurchasing) {
      this.iapBtnImg.setTint(0xf59e0b);
      this.iapBtnText.setText("결제 진행중...");
      return;
    }

    if (this.isIapProductLoading) {
      this.iapBtnImg.setTint(0x6b7280);
      this.iapBtnText.setText("광고제거 상품 조회중...");
      return;
    }

    if (this.iapRemoveAdsSku) {
      const amountSuffix = this.iapRemoveAdsAmountLabel
        ? ` ${this.iapRemoveAdsAmountLabel}`
        : "";
      this.iapBtnImg.setTint(0x2563eb);
      this.iapBtnText.setText(`광고제거 구매${amountSuffix}`);
      return;
    }

    this.iapBtnImg.setTint(0x6b7280);
    this.iapBtnText.setText("광고제거 상품 없음");
  }

  async prepareRemoveAdsProduct() {
    if (localStorage.getItem("adsRemoved") === "true") {
      this.updateIapButtonState();
      return;
    }

    if (!IAP || typeof IAP.getProductItemList !== "function") {
      this.updateIapButtonState();
      this.showToast("인앱결제를 지원하지 않는 환경입니다.", "#f1c40f");
      return;
    }

    if (this.isIapProductLoading) return;

    this.isIapProductLoading = true;
    this.updateIapButtonState();

    try {
      const response = await IAP.getProductItemList();
      const products = response?.products ?? [];

      const targetProductBySku = products.find((product) => {
        return product?.sku === REMOVE_ADS_PRODUCT_SKU;
      });

      const targetProductByName = products.find((product) => {
        return (
          this.normalizeIapText(product?.displayName) ===
          this.normalizeIapText(REMOVE_ADS_PRODUCT_NAME)
        );
      });

      const targetProduct = targetProductBySku || targetProductByName;

      if (!targetProduct) {
        this.iapRemoveAdsSku = null;
        this.iapRemoveAdsAmountLabel = "";
        this.showToast(
          `'${REMOVE_ADS_PRODUCT_NAME}' 상품을 찾을 수 없어요.`,
          "#e74c3c",
        );
        return;
      }

      this.iapRemoveAdsSku = targetProduct.sku;
      this.iapRemoveAdsAmountLabel = targetProduct.displayAmount || "";
    } catch (error) {
      this.iapRemoveAdsSku = null;
      this.iapRemoveAdsAmountLabel = "";
      this.showToast(
        `상품 조회 실패: ${this.parseIapErrorMessage(error)}`,
        "#e74c3c",
      );
    } finally {
      this.isIapProductLoading = false;
      this.updateIapButtonState();
    }
  }

  purchaseRemoveAdsProduct() {
    if (localStorage.getItem("adsRemoved") === "true") {
      this.showToast("이미 광고 제거가 적용되어 있어요.", "#2ecc71");
      return;
    }

    if (!IAP || typeof IAP.createOneTimePurchaseOrder !== "function") {
      this.showToast("인앱결제를 지원하지 않는 환경입니다.", "#f1c40f");
      return;
    }

    if (!this.iapRemoveAdsSku) {
      this.showToast(
        "상품을 찾는 중이에요. 잠시 후 다시 시도해주세요.",
        "#f1c40f",
      );
      this.prepareRemoveAdsProduct();
      return;
    }

    if (this.isIapPurchasing) {
      this.showToast("결제가 이미 진행 중입니다.", "#f1c40f");
      return;
    }

    this.isIapPurchasing = true;
    this.updateIapButtonState();

    const cleanup = IAP.createOneTimePurchaseOrder({
      options: {
        sku: this.iapRemoveAdsSku,
        processProductGrant: async ({ orderId }) => {
          try {
            localStorage.setItem("adsRemoved", "true");

            if (IAP && typeof IAP.completeProductGrant === "function") {
              await IAP.completeProductGrant({ params: { orderId } });
            }

            return true;
          } catch (error) {
            console.error("상품 지급 처리 실패", error);
            this.showToast("상품 지급 처리에 실패했어요.", "#e74c3c");
            return false;
          }
        },
      },
      onEvent: (event) => {
        this.isIapPurchasing = false;

        if (event?.type === "success") {
          localStorage.setItem("adsRemoved", "true");
          this.showToast("광고 제거 결제가 완료되었어요!", "#2ecc71");
        }

        this.updateIapButtonState();

        if (typeof this.iapPurchaseCleanup === "function") {
          this.iapPurchaseCleanup();
          this.iapPurchaseCleanup = null;
        }
      },
      onError: (error) => {
        this.isIapPurchasing = false;
        this.updateIapButtonState();
        this.showToast(
          `결제 실패: ${this.parseIapErrorMessage(error)}`,
          "#e74c3c",
        );

        if (typeof this.iapPurchaseCleanup === "function") {
          this.iapPurchaseCleanup();
          this.iapPurchaseCleanup = null;
        }
      },
    });

    this.iapPurchaseCleanup = cleanup;
  }

  clearLobbyAdLoadTimeout() {
    if (this.lobbyAdLoadTimeout) {
      this.lobbyAdLoadTimeout.remove(false);
      this.lobbyAdLoadTimeout = null;
    }
  }

  // === 광고 관련 헬퍼 메서드 ===
  parseIntegratedAdErrorMessage(error) {
    if (!error) return "원인을 확인할 수 없어요.";

    if (typeof error === "string") return error;

    if (error instanceof Error && error.message) return error.message;

    if (typeof error === "object") {
      if (typeof error.message === "string") return error.message;
      if (typeof error.reason === "string") return error.reason;
      if (typeof error.code === "string") return `code: ${error.code}`;
      try {
        return JSON.stringify(error);
      } catch (_e) {
        return "에러 객체를 문자열로 변환하지 못했어요.";
      }
    }

    return String(error);
  }

  showLobbyAdDiagnosticToast(message, color = "#f1c40f") {
    const now = Date.now();
    if (now - this.lastLobbyAdToastAt < 1800) return;

    this.lastLobbyAdToastAt = now;
    this.showToast(message, color);
  }

  updateLobbyAdButtonState() {
    if (!this.adBtnImg || !this.adBtnText) return;

    if (this.isLobbyIntegratedAdLoaded) {
      this.adBtnImg.setTint(0x8b5cf6);
      this.adBtnText.setText("광고 보기");
      return;
    }

    if (this.isLobbyIntegratedAdLoading) {
      this.adBtnImg.setTint(0x6b7280);
      this.adBtnText.setText("광고 로딩중...");
      return;
    }

    this.adBtnImg.setTint(0x6b7280);
    this.adBtnText.setText("광고 준비중");
  }

  prepareLobbyIntegratedAd() {
    const adGroupId = getIntegratedAdGroupId();
    if (!adGroupId) {
      this.isLobbyIntegratedAdLoading = false;
      this.isLobbyIntegratedAdLoaded = false;
      this.updateLobbyAdButtonState();
      this.showLobbyAdDiagnosticToast(
        "광고 ID가 설정되지 않았어요.",
        "#e74c3c",
      );
      return;
    }

    if (!canUseIntegratedAd()) {
      this.isLobbyIntegratedAdLoading = false;
      this.isLobbyIntegratedAdLoaded = false;
      this.updateLobbyAdButtonState();
      this.showLobbyAdDiagnosticToast(
        "광고 미지원 환경이에요. 토스 앱/버전을 확인해 주세요.",
      );
      return;
    }

    if (this.isLobbyIntegratedAdLoaded || this.isLobbyIntegratedAdLoading)
      return;

    this.isLobbyIntegratedAdLoading = true;
    this.updateLobbyAdButtonState();
    this.clearLobbyAdLoadTimeout();

    this.lobbyAdLoadTimeout = this.time.delayedCall(8000, () => {
      if (this.isLobbyIntegratedAdLoading && !this.isLobbyIntegratedAdLoaded) {
        this.isLobbyIntegratedAdLoading = false;
        this.updateLobbyAdButtonState();
        this.showLobbyAdDiagnosticToast(
          "광고 로딩이 지연되고 있어요. 네트워크 또는 앱 버전을 확인해 주세요.",
        );
      }
    });

    if (typeof this.unregisterLobbyIntegratedAdLoad === "function") {
      this.unregisterLobbyIntegratedAdLoad();
      this.unregisterLobbyIntegratedAdLoad = null;
    }

    this.unregisterLobbyIntegratedAdLoad = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === "loaded") {
          this.clearLobbyAdLoadTimeout();
          this.isLobbyIntegratedAdLoading = false;
          this.isLobbyIntegratedAdLoaded = true;
          this.updateLobbyAdButtonState();
        }
      },
      onError: (error) => {
        this.clearLobbyAdLoadTimeout();
        this.isLobbyIntegratedAdLoading = false;
        this.isLobbyIntegratedAdLoaded = false;
        this.updateLobbyAdButtonState();
        console.warn("Lobby IntegratedAd load 실패", error);
        this.showLobbyAdDiagnosticToast(
          `광고 로드 실패: ${this.parseIntegratedAdErrorMessage(error)}`,
          "#e74c3c",
        );
      },
    });
  }

  tryShowLobbyIntegratedAd() {
    if (!canUseIntegratedAd()) {
      this.showToast("광고 기능을 지원하지 않는 환경입니다.", "#f1c40f");
      return;
    }

    if (!this.isLobbyIntegratedAdLoaded) {
      this.showToast(
        "광고 로딩 중입니다. 잠시 후 다시 시도해주세요.",
        "#f1c40f",
      );
      this.prepareLobbyIntegratedAd();
      return;
    }

    const adGroupId = getIntegratedAdGroupId();
    if (!adGroupId) {
      this.showToast("광고 설정이 없습니다.", "#e74c3c");
      return;
    }

    this.isLobbyIntegratedAdLoaded = false;
    this.updateLobbyAdButtonState();

    showFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        switch (event.type) {
          case "dismissed":
          case "failedToShow":
            this.prepareLobbyIntegratedAd();
            break;
          default:
            break;
        }
      },
      onError: (error) => {
        console.warn("Lobby IntegratedAd show 실패", error);
        this.showLobbyAdDiagnosticToast(
          `광고 표시 실패: ${this.parseIntegratedAdErrorMessage(error)}`,
          "#e74c3c",
        );
        this.prepareLobbyIntegratedAd();
      },
    });
  }

  getAvatarDisplayKey(baseKey) {
    if (this.textures.exists(`${baseKey}_1`)) return `${baseKey}_1`;
    if (baseKey === "player_1") {
      if (this.textures.exists("player_1_frame_1")) return "player_1_frame_1";
    }
    if (baseKey === "player_2") {
      if (this.textures.exists("player_2_frame_1")) return "player_2_frame_1";
    }
    if (baseKey === "player_3") {
      if (this.textures.exists("player_3_frame_1")) return "player_3_frame_1";
    }
    if (baseKey === "player_4") {
      if (this.textures.exists("player_4_frame_1")) return "player_4_frame_1";
    }
    const sheetKey = `${baseKey}_sprite_a`;
    if (this.textures.exists(sheetKey)) return sheetKey;
    return null;
  }

  ensureAvatarAnimation(baseKey) {
    let scene = this;
    if (scene && scene.scene) {
      scene = scene.scene;
    }
    if (!scene || typeof scene.getAvatarAnimKey !== "function") {
      scene = this;
    }
    const animKey = scene.getAvatarAnimKey(baseKey);

    // If animation already exists but frame set may have grown (deferred loading),
    // late-rebuild for updated sprite data.
    const existingAnim = scene.anims.get(animKey);
    if (existingAnim && existingAnim.frames && existingAnim.frames.length > 0) {
      const existingFrameKeys = new Set(existingAnim.frames.map((f) => f.textureKey));
      const candidateKeys = [];
      if (baseKey === "player_1") {
        if (scene.textures.exists("player_1_frame_1")) {
          let idx = 1;
          while (scene.textures.exists(`player_1_frame_${idx}`)) {
            candidateKeys.push(`player_1_frame_${idx}`);
            idx += 1;
          }
        }
      } else if (baseKey === "player_2") {
        let idx = 1;
        while (scene.textures.exists(`player_2_${idx}`)) {
          candidateKeys.push(`player_2_${idx}`);
          idx += 1;
        }
        if (candidateKeys.length <= 1 && scene.textures.exists("player_2_frame_1")) {
          idx = 1;
          while (scene.textures.exists(`player_2_frame_${idx}`)) {
            candidateKeys.push(`player_2_frame_${idx}`);
            idx += 1;
          }
        }
      } else {
        const maxFrame = this.getAvatarAnimMaxFrame(baseKey);
        for (let frame = 1; frame <= maxFrame; frame += 1) {
          if (scene.textures.exists(`${baseKey}_${frame}`)) {
            candidateKeys.push(`${baseKey}_${frame}`);
          }
        }
        // player_3 uses frame files named player_3_frame_1..N (same as player_2 fallback).
        if (scene.textures.exists(`${baseKey}_frame_1`)) {
          let idx = 1;
          while (scene.textures.exists(`${baseKey}_frame_${idx}`)) {
            candidateKeys.push(`${baseKey}_frame_${idx}`);
            idx += 1;
          }
        }
      }

      const hasNewFrames = candidateKeys.some((k) => !existingFrameKeys.has(k));
      if (!hasNewFrames) {
        return animKey;
      }

      scene.anims.remove(animKey);
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
      }
      if (baseKey === "player_1" || baseKey === "player_2" || baseKey === "player_3" || baseKey === "player_4") {
        const playerKey = baseKey;
        const maxFrame = this.getAvatarAnimMaxFrame(baseKey);

        // 1) Prefer player_n_# frames (generated by ensurePlayerFrames or direct folder loading)
        let frames = [];
        for (let idx = 1; idx <= maxFrame; idx += 1) {
          const textureKey = `${playerKey}_${idx}`;
          if (this.textures.exists(textureKey)) {
            frames.push({ key: textureKey });
          }
        }
        if (frames.length > 1) {
          this.anims.create({
            key: animKey,
            frames,
            frameRate: this.getAvatarAnimFrameRate(baseKey),
            repeat: -1,
          });
          return animKey;
        }

        // 2) Fallback to player_n_frame_# sequence
        if (this.textures.exists(`${playerKey}_frame_1`)) {
          frames = [];
          for (let idx = 1; idx <= maxFrame; idx += 1) {
            const textureKey = `${playerKey}_frame_${idx}`;
            if (this.textures.exists(textureKey)) {
              frames.push({ key: textureKey });
            }
          }
          if (frames.length > 1) {
            this.anims.create({
              key: animKey,
              frames,
              frameRate: this.getAvatarAnimFrameRate(baseKey),
              repeat: -1,
            });
            return animKey;
          }
        }

        // 3) If only a single texture exists, still create an animation to avoid no-play states.
        frames = [];
        idx = 1;
        while (true) {
          const textureKey = `${playerKey}_${idx}`;
          if (this.textures.exists(textureKey)) {
            frames.push({ key: textureKey });
            idx += 1;
            continue;
          }
          break;
        }
        if (frames.length === 1) {
          this.anims.create({
            key: animKey,
            frames,
            frameRate: this.getAvatarAnimFrameRate(baseKey),
            repeat: -1,
          });
          return animKey;
        }

        if (this.textures.exists(`${playerKey}_frame_1`)) {
          frames = [];
          idx = 1;
          while (true) {
            const textureKey = `${playerKey}_frame_${idx}`;
            if (this.textures.exists(textureKey)) {
              frames.push({ key: textureKey });
              idx += 1;
              continue;
            }
            break;
          }
          if (frames.length === 1) {
            this.anims.create({
              key: animKey,
              frames,
              frameRate: this.getAvatarAnimFrameRate(baseKey),
              repeat: -1,
            });
            return animKey;
          }
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
      return null;
    }
  }

  applyAvatarAnimation(target, baseKey) {
    const scene = target && target.scene ? target.scene : this;
    if (!scene || !scene.add) return;
    if (!target || !target.active) return;

    if (typeof target.getData === "function") {
      if (target.getData("avatarDisplayWidth") === undefined) {
        target.setData("avatarDisplayWidth", target.displayWidth);
      }
      if (target.getData("avatarDisplayHeight") === undefined) {
        target.setData("avatarDisplayHeight", target.displayHeight);
      }
    }
    let avatarDisplayWidth =
      typeof target.getData === "function"
        ? target.getData("avatarDisplayWidth")
        : target.displayWidth;
    let avatarDisplayHeight =
      typeof target.getData === "function"
        ? target.getData("avatarDisplayHeight")
        : target.displayHeight;

    // 최소 크기 방어: 초기 로딩/프레임 변경 과정에서 과도히 작아지는 문제 방지
    const MIN_AVATAR_SIZE = Math.max(64, Math.round((target.scene?.scale?.width || 1080) * 0.08));
    avatarDisplayWidth = Math.max(
      avatarDisplayWidth || 0,
      target.displayWidth || 0,
      MIN_AVATAR_SIZE,
    );
    avatarDisplayHeight = Math.max(
      avatarDisplayHeight || 0,
      target.displayHeight || 0,
      MIN_AVATAR_SIZE,
    );

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
    if (baseKey === "player_1" || baseKey === "player_2" || baseKey === "player_3" || baseKey === "player_4") {
      target.setOrigin(0.5, 1);
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
      target.y = avatarBaseY + target.displayHeight * 0.5;
      const firstFrameKey =
        (baseKey === "player_1" && this.textures.exists("player_1_frame_1"))
          ? "player_1_frame_1"
          : (baseKey === "player_2" && this.textures.exists("player_2_frame_1"))
          ? "player_2_frame_1"
          : (baseKey === "player_3" && this.textures.exists("player_3_frame_1"))
          ? "player_3_frame_1"
          : (baseKey === "player_4" && this.textures.exists("player_4_frame_1"))
          ? "player_4_frame_1"
          : `${baseKey}_1`;
      if (firstFrameKey && this.textures.exists(firstFrameKey)) {
        target.setTexture(firstFrameKey);
      }
      if (animKey) {
        target.play(animKey, true);
        if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
          target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
        }
      }
    } else {
      if (animKey) {
        target.play(animKey, true);
      } else if (
        avatarDisplayWidth > 0 &&
        avatarDisplayHeight > 0 &&
        this.textures.exists(baseKey)
      ) {
        target.setTexture(baseKey);
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
    }
  }

  showCoinBurst(targetX, targetY, amount = 0) {
    // GameScene에 정의된 것 재활용
    if (
      typeof GameScene !== "undefined" &&
      GameScene.prototype &&
      typeof GameScene.prototype.showCoinBurst === "function"
    ) {
      try {
        return GameScene.prototype.showCoinBurst.call(this, targetX, targetY, amount);
      } catch (e) {
        console.warn("LobbyScene showCoinBurst via GameScene failed", e);
      }
    }

    // fallback (간단한 팝업 스타일)
    try {
      const burstText = this.add
        .text(targetX, targetY - 20, `+${amount}💰`, {
          fontFamily: GAME_FONTS.main,
          fontSize: "32px",
          color: "#facc15",
          stroke: "#000000",
          strokeThickness: 4,
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(10000);

      this.tweens.add({
        targets: burstText,
        y: targetY - 80,
        alpha: 0,
        duration: 800,
        ease: "Sine.easeOut",
        onComplete: () => {
          try {
            burstText.destroy();
          } catch (e) {}
        },
      });
    } catch (e) {
      console.warn("LobbyScene fallback showCoinBurst error", e);
    }
  }

  ensureQuestCoinBurst() {
    if (typeof this.playQuestCoinBurst === "function") return;

    this.playQuestCoinBurst = (x, y, amount = 0) => {
      try {
        if (typeof this.showCoinBurst === "function") {
          this.showCoinBurst(x, y, amount);
          return;
        }

        showCoinBurstEffect(this, x, y, amount);
      } catch (e) {
        console.warn("LobbyScene playQuestCoinBurst fallback failed", e);
        try {
          showCoinBurstEffect(this, x, y, amount);
        } catch (err) {
          // ignore
        }
      }
    };
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

    // If we came from the tutorial completion flow, record that request so
    // we can immediately start a single easy match instead of staying in the lobby.
    this.autoStartSingleAfterTutorial =
      data && data.fromTutorial && data.autoStartSingle;
    this.fromSingleGame = !!(data && data.fromSingle);
    this.fromTutorial = !!(data && data.fromTutorial);

    // Allow callers to explicitly prevent automatic single-start (e.g. when
    // returning from a single match via back/navigation). This prevents a
    // loop where the lobby auto-starts a new single match on every return.
    this.preventAutoStartSingleAfterTutorial = !!(
      data && data.preventAutoStartSingleAfterTutorial
    );

    // Ensure reward popup helpers are bound to the instance if they exist.
    if (typeof this.showPremiumBearIntroPopup === "function") {
      this.showPremiumBearIntroPopup = this.showPremiumBearIntroPopup.bind(this);
    }
    if (typeof this.showPremiumBearOfferPopup === "function") {
      this.showPremiumBearOfferPopup = this.showPremiumBearOfferPopup.bind(this);
    }
    if (typeof this.showPremiumBearAcquiredPopup === "function") {
      this.showPremiumBearAcquiredPopup = this.showPremiumBearAcquiredPopup.bind(this);
    }
    if (typeof this.isPremiumBearUnlocked === "function") {
      this.isPremiumBearUnlocked = this.isPremiumBearUnlocked.bind(this);
    }

    // Provide an instance helper to always be able to render the acquired popup
    // even if the prototype method is missing due to build ordering.
    this.createInlinePremiumBearPopup = () => {
      try {
        console.debug('[premium] createInlinePremiumBearPopup invoked');
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;
        const ov = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.92).setInteractive();
        try { ov.on('pointerdown', (e) => { e.stopPropagation && e.stopPropagation(); }); } catch (e) {}

        let key = null;
        try {
          key = this.getAvatarDisplayKey(PREMIUM_BEAR_KEY) || (this.textures.exists(PREMIUM_BEAR_KEY) ? PREMIUM_BEAR_KEY : null) || 'player_1';
        } catch (e) {
          key = this.textures.exists(PREMIUM_BEAR_KEY) ? PREMIUM_BEAR_KEY : 'player_1';
        }

        const iconSz = Math.min(w * 0.5, h * 0.45);
        const ic = this.add.image(w / 2, h * 0.45, key).setDisplaySize(iconSz, iconSz).setDepth(50002).setOrigin(0.5);
        const by = h * 0.78;
        const b = this.add.image(w / 2, by, 'ui_btn').setDisplaySize(w * 0.36, h * 0.08).setTint(0x22c55e);
        const bt = this.add.text(w / 2, by, '받기', {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.max(18, w * 0.05)}px`,
          color: '#ffffff',
          fontWeight: 'bold',
          stroke: '#000000',
          strokeThickness: 5,
        }).setOrigin(0.5).setDepth(50003);

        const cont = this.add.container(0, 0, [ov, ic, b, bt]).setDepth(50001);
        const closeInline = () => { try { if (cont) { cont.destroy(); } } catch (e) {} };

        const enableInline = () => {
          try {
            b.setInteractive({ useHandCursor: true });
            b.on('pointerdown', () => {
              try { this.sound.play('btn', { volume: 0.12 }); } catch (e) {}
              closeInline();
              try { this.unlockPremiumBear(); } catch (e) { console.warn('[premium] inline unlock failed', e); }
            });
          } catch (e) {
            console.warn('[premium] inline enable failed', e);
            try { this.unlockPremiumBear(); closeInline(); } catch (err) {}
          }
        };

        if (this.time && typeof this.time.delayedCall === 'function') {
          this.time.delayedCall(150, enableInline);
        } else {
          setTimeout(enableInline, 150);
        }
      } catch (e) {
        console.warn('[premium] createInlinePremiumBearPopup error', e);
      }
    };
    // If the proper method is missing for any reason, point it to the inline helper
    try {
      if (typeof this.showPremiumBearAcquiredPopup !== 'function') {
        this.showPremiumBearAcquiredPopup = this.createInlinePremiumBearPopup;
      }
    } catch (e) {}

    // Expose a global, scene-agnostic helper to force-show the acquired popup.
    try {
      try { window.__HalemaleLastGameScene = this; } catch (e) {}
      window.__halemale_showPremiumBearAcquiredPopup = () => {
        try {
          const gs = (typeof window !== 'undefined' && window.game && window.game.scene && window.game.scene.keys && window.game.scene.keys['GameScene']) || window.__HalemaleLastGameScene || null;
          if (gs) {
            if (typeof gs.showPremiumBearAcquiredPopup === 'function') {
              try { gs.showPremiumBearAcquiredPopup(); return; } catch (e) { console.warn('[premium] global helper -> instance fn failed', e); }
            }
            if (typeof gs.createInlinePremiumBearPopup === 'function') {
              try { gs.createInlinePremiumBearPopup(); return; } catch (e) { console.warn('[premium] global helper -> inline fn failed', e); }
            }
          }

          // DOM fallback: create a minimal overlay so user sees the reward.
          try {
            const id = 'halemale-premium-dom-popup';
            if (document.getElementById(id)) return;
            const wrapper = document.createElement('div');
            wrapper.id = id;
            Object.assign(wrapper.style, {
              position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
              background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483646,
            });
            const inner = document.createElement('div');
            inner.style.textAlign = 'center';
            inner.style.color = '#fff';
            inner.style.maxWidth = '640px';
            inner.style.padding = '24px';
            inner.innerHTML = '<h2 style="color:#ffd700;margin-bottom:12px">플레이어 2 획득!</h2><p style="margin-bottom:18px">싱글 플레이 1등 보상입니다. 받기를 눌러 잠금 해제하세요.</p>';
            const btn = document.createElement('button');
            btn.textContent = '받기';
            Object.assign(btn.style, { padding: '10px 18px', fontSize: '16px', cursor: 'pointer' });
            btn.addEventListener('click', () => {
              try { localStorage.setItem('ownedCharacters', JSON.stringify([PREMIUM_BEAR_KEY])); } catch (e) {}
              try { if (gs && typeof gs.unlockPremiumBear === 'function') gs.unlockPremiumBear(); } catch (e) {}
              try { document.body.removeChild(wrapper); } catch (e) {}
            });
            inner.appendChild(btn);
            wrapper.appendChild(inner);
            document.body.appendChild(wrapper);
          } catch (e) {
            console.warn('[premium] DOM fallback failed', e);
          }

        } catch (e) {
          console.warn('[premium] __halemale_showPremiumBearAcquiredPopup failed', e);
        }
      };
    } catch (e) {}
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

      // Load deferred/heavy assets in the background once the lobby is visible.
      if (typeof this.loadDeferredAssets === "function") {
        // Small delay lets the initial scene render before starting more IO.
        setTimeout(() => this.loadDeferredAssets(), 50);
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
    const PLAYER3_SPRITE_VERSION = VERSION
      ? `${VERSION}&p3=20260227_1`
      : "?p3=20260227_1";
    const PLAYER4_SPRITE_VERSION = VERSION
      ? `${VERSION}&p4=20260228_1`
      : "?p4=20260228_1";

    this.load.image(
      "popupclose",
      `${ASSET_SERVER}/images/popupclose.png${VERSION}`,
    );

    // NOTE: mainbg frames are deferred to avoid blocking initial load.
    // We still load the *first frame* so the lobby can show a valid texture
    // while the rest loads in the background.
    this.load.image(
      "mainbg_frame_1",
      `assets/images/bg_sprite/1.png${VERSION}`,
    );
    this.load.image(
      "player_1_frame_1",
      `assets/images/player_1_sprite/1.png${PLAYER1_SPRITE_VERSION}`,
    );
    this.load.image(
      "player_2_frame_1",
      `assets/images/player_2_sprite/1.png${PLAYER2_SPRITE_VERSION}`,
    );

    this.load.image(
      "player_3_frame_1",
      `assets/images/player_3_sprite/1.png${PLAYER3_SPRITE_VERSION}`,
    );
    this.load.image(
      "player_4_frame_1",
      `assets/images/player_4_sprite/1.png${PLAYER4_SPRITE_VERSION}`,
    );

    // Remaining frames are deferred and loaded in loadDeferredAssets().
    // If `mainbg_frame_1` is not available, the code will fall back to `mainbg`.
    // (See loadDeferredAssets())

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

    // NOTE: player_1 animation frames are deferred to avoid long initial loading.
    // They will be loaded in the background after the lobby UI is ready.
    // (See loadDeferredAssets())

    // NOTE: player_2 animation frames are deferred to avoid long initial loading.
    // They will be loaded in the background after the lobby UI is ready.
    // (See loadDeferredAssets())

    // 플레이어 애니메이션용 이미지 (player_3/player_4은 sprite로 대체)
    // (기존 player_4_1/player_4_2는 더 이상 사용하지 않음)
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
    this.load.audio("bubble", `${ASSET_SERVER}/sounds/bubble.mp3${VERSION}`);

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

  loadDeferredAssets() {
    if (this._deferredAssetsLoading || this._deferredAssetsLoaded) return;
    this._deferredAssetsLoading = true;

    const cam = (this.cameras && this.cameras.main) || null;
    const width = cam?.width || (this.scale && this.scale.width) || 0;
    const height = cam?.height || (this.scale && this.scale.height) || 0;
    const centerX = width ? width * 0.5 : 0;
    const centerY = height ? height * 0.5 : 0;

    // 추가 리소스 로딩 오버레이 표시
    const overlayBg = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setDepth(10000)
      .setInteractive();

    const overlayContainer = this.add
      .container(0, 0)
      .setDepth(10001);

    const titleText = this.add
      .text(centerX, centerY - 28, "추가 리소스 로딩중", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.max(18, width * 0.045)}px`,
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const progressText = this.add
      .text(centerX, centerY + 20, "로딩 중... 0%", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.max(16, width * 0.035)}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    overlayContainer.add([overlayBg, titleText, progressText]);
    this._deferredLoadingOverlay = overlayContainer;

    this._deferredLoadingProgressHandler = (value) => {
      if (progressText && progressText.active) {
        progressText.setText(`로딩 중... ${Math.floor((value || 0) * 100)}%`);
      }
    };

    this.load.on("progress", this._deferredLoadingProgressHandler);

    const ASSET_SERVER = "https://halemale.onrender.com/assets";
    const VERSION = "?v=2";

    const PLAYER1_SPRITE_VERSION = VERSION
      ? `${VERSION}&p1=20260221_8`
      : "?p1=20260221_8";
    const PLAYER2_SPRITE_VERSION = VERSION
      ? `${VERSION}&p2=20260227_1`
      : "?p2=20260227_1";
    const PLAYER3_SPRITE_VERSION = VERSION
      ? `${VERSION}&p3=20260227_1`
      : "?p3=20260227_1";
    const PLAYER4_SPRITE_VERSION = VERSION
      ? `${VERSION}&p4=20260228_1`
      : "?p4=20260228_1";

    // deferred frame loads (reduces initial startup time)
    // We already loaded frame 1 early for placeholders.
    for (let i = 2; i <= 47; i += 1) {
      this.load.image(
        `mainbg_frame_${i}`,
        `assets/images/bg_sprite/${i}.png${VERSION}`,
      );
    }

    // Frame 1 is loaded early so the avatar has a valid placeholder.
    for (let i = 2; i <= 91; i += 1) {
      this.load.image(
        `player_1_frame_${i}`,
        `assets/images/player_1_sprite/${i}.png${PLAYER1_SPRITE_VERSION}`,
      );
    }

    // Frame 1 is loaded early so the avatar has a valid placeholder.
    for (let i = 2; i <= 91; i += 1) {
      this.load.image(
        `player_2_frame_${i}`,
        `assets/images/player_2_sprite/${i}.png${PLAYER2_SPRITE_VERSION}`,
      );
    }

    // Frame 1 is loaded early so the avatar has a valid placeholder.
    for (let i = 2; i <= 91; i += 1) {
      this.load.image(
        `player_3_frame_${i}`,
        `assets/images/player_3_sprite/${i}.png${PLAYER3_SPRITE_VERSION}`,
      );
    }
    for (let i = 2; i <= 91; i += 1) {
      this.load.image(
        `player_4_frame_${i}`,
        `assets/images/player_4_sprite/${i}.png${PLAYER4_SPRITE_VERSION}`,
      );
    }

    // (Optional) also make player_3_sprite available for sheet-based convenience.
    // If you have a single sprite sheet `player_3_sprite` asset, load it here.
    // this.load.image(
    //   "player_3_sprite",
    //   `assets/images/player_3_sprite.png${PLAYER3_SPRITE_VERSION}`,
    // );
    
    this.load.once("complete", () => {
      if (this._deferredLoadingProgressHandler) {
        this.load.off("progress", this._deferredLoadingProgressHandler);
        this._deferredLoadingProgressHandler = null;
      }
      if (this._deferredLoadingOverlay) {
        this._deferredLoadingOverlay.destroy();
        this._deferredLoadingOverlay = null;
      }
      this._deferredAssetsLoaded = true;
      this._deferredAssetsLoading = false;

      // if nickname popup was queued while deferred loading, show now
      try {
        if (this._queuedNicknamePopup && typeof this._queuedNicknamePopup === 'function') {
          this._queuedNicknamePopup();
          this._queuedNicknamePopup = null;
        }
      } catch (e) {
        console.warn('queued nickname popup failed', e);
      }

      // Ensure the shop UI reflects newly available player_3 frames, if already open.
      try {
        if (this.isShopOpen && typeof renderShopContent === "function") {
          renderShopContent();
        }
      } catch (e) {
        console.warn("loadDeferredAssets: renderShopContent refresh failed", e);
      }

      // Refresh any animations that depend on the newly loaded frames.
      try {
        if (typeof this._applyDeferredAnimations === "function") {
          this._applyDeferredAnimations();
        }
      } catch (e) {
        console.warn("Deferred animation refresh failed", e);
      }
    });

    this.load.start();
  }

  async create() {
    const scene = this;
    this.isJoinPopupOpen = false;
    this.isToastOpen = false;
    this.isRoomOpen = false;
    this.lastBackPressedAt = 0;
    this._queuedNicknamePopup = null; // 추가 리소스 로딩 완료 시점에 팝업 표시 예약
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
    this._lastResultPlayersHash = null;
    // ensure player frames exist for lobby avatars
    ensurePlayerFrames(this, "player_1_sprite", "player_1");
    ensurePlayerFrames(this, "player_2_sprite", "player_2");
    ensurePlayerFrames(this, "player_3_sprite", "player_3");

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
        const isExperienceSync =
          typeof reason === "string" && reason.indexOf("experience") >= 0;

        // If we are syncing experience gains, allow it even if we haven't yet
        // received a full server profile snapshot (prevents lost XP during early game).
        if (requireServerProfile && !this.hasServerProfileSnapshot && !isExperienceSync) {
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

        const safeCoins = Number(this.myProfile && this.myProfile.coins);
        if (Number.isFinite(safeCoins)) {
          payload.coins = safeCoins;
        }

        const safeAvetime = Number(this.myProfile && this.myProfile.avetime);
        if (Number.isFinite(safeAvetime)) {
          payload.avetime = safeAvetime;
        }

        const includeExperience = options.includeExperience !== false;
        const safeLevel = Number(this.myProfile && this.myProfile.level);
        if (includeExperience && Number.isFinite(safeLevel)) {
          payload.level = safeLevel;
        }

        const safeExperience = Number(this.myProfile && this.myProfile.experience);
        if (includeExperience && Number.isFinite(safeExperience)) {
          payload.experience = safeExperience;
        }

        // Include owned characters in the payload.
        // If the server profile isn't fully available yet, use locally stored owned characters.
        const filterOwnedKeys = (keys) =>
          Array.isArray(keys)
            ? keys.filter(
                (key) =>
                  typeof key === "string" &&
                  (/^player_[1-4]$/.test(key) || key === PREMIUM_BEAR_KEY),
              )
            : [];

        const localOwnedChars = filterOwnedKeys(
          JSON.parse(localStorage.getItem("ownedCharacters") || "[]") || [],
        );

        const ownedCharacters = filterOwnedKeys(
          this.myProfile && this.myProfile.owned_characters,
        );

        const mergedOwnedCharacters = Array.from(
          new Set([...ownedCharacters, ...localOwnedChars]),
        );

        if (mergedOwnedCharacters.length > 0) {
          payload.ownedCharacters = mergedOwnedCharacters;
          payload.owned_characters = mergedOwnedCharacters;
        }

        const currentCharacter = this.getSelectedAvatarKey();
        if (
          typeof currentCharacter === "string" &&
          (/^(player_[1-4]|premium_bear)$/.test(currentCharacter))
        ) {
          payload.currentCharacter = currentCharacter;
          payload.current_character = currentCharacter;
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

    // allow other methods to sync inventory (e.g. reward unlocks)
    this.emitInventory = emitInventory;

    if (!savedNickname) {
      // 2. 저장된 닉네임이 없으면 팝업 표시 (추가 리소스 로딩 후에)
      const showNicknameFunc = () => {
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
      };

      if (this._deferredAssetsLoaded) {
        showNicknameFunc();
      } else {
        this._queuedNicknamePopup = showNicknameFunc;
      }
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

      // If we arrived from a completed tutorial, automatically start the
      // easy single-player game.
      if (
        this.autoStartSingleAfterTutorial &&
        this.hasCompletedTutorial &&
        !this.preventAutoStartSingleAfterTutorial
      ) {
        // 플래그를 초기화하여 한 번만 자동 시작되도록 보장합니다.
        this.autoStartSingleAfterTutorial = false;
        this.preventAutoStartSingleAfterTutorial = false;
        this.startSingleGame("easy");
        return;
      }

      this.scheduleTutorialOverlay();

      // If a tutorial is in progress (not completed), resume it immediately.
      const savedTutorial = loadTutorialProgress();
      if (
        !this.hasCompletedTutorial &&
        savedTutorial &&
        !this.isRoomOpen &&
        !this.currentRoomId
      ) {
        this.startTutorialGame();
      }
    }

    this.profileAvatarKeys = ["player_1", "player_2", "player_3", "player_4", PREMIUM_BEAR_KEY].filter(
      (key, idx, arr) => arr.indexOf(key) === idx,
    );
    const savedAvatarKey = localStorage.getItem("profileAvatarKey");
    const savedAvatarIndex = this.profileAvatarKeys.indexOf(savedAvatarKey);
    this.profileAvatarIndex = savedAvatarIndex >= 0 ? savedAvatarIndex : 0;
    const initialAvatarKey =
      typeof savedAvatarKey === "string" &&
      (/^(player_[1-4]|player_2)$/.test(savedAvatarKey))
        ? savedAvatarKey
        : this.profileAvatarKeys[this.profileAvatarIndex] || "player_1";

    const storedOwnedCharacters = (() => {
      try {
        const raw = localStorage.getItem("ownedCharacters");
        const parsed = JSON.parse(raw || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    })();

    const initialOwnedCharacters = Array.from(
      new Set(
        ["player_1", ...storedOwnedCharacters].filter(
          (key) => typeof key === "string" && /^(player_[1-4]|player_2)$/.test(key),
        ),
      ),
    );

    // 🔴 [보안] 코인은 반드시 서버에서만 로드 (로컬 저장소 사용 금지)
    this.myProfile = {
      nickname: this.myNickname || savedNickname || "요리사",
      level: 1,
      coins: 0,  // 서버로부터 받을 때까지 기본값
      experience: 0,
      owned_characters: initialOwnedCharacters,
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

    // Weekly attendance state (for Monday-to-Sunday display)
    this.getDailyRewardWeekKey = (date) => {
      const kstNow = date
        ? new Date(new Date(date).toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
        : this.getKstNow();
      const dayOfWeek = (kstNow.getDay() + 6) % 7; // Monday=0
      const weekStart = new Date(kstNow);
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      return this.formatDateYmd(weekStart);
    };

    this.loadDailyRewardWeekState = () => {
      try {
        const raw = localStorage.getItem("weeklyDailyRewardState");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            return parsed;
          }
        }
      } catch (e) {
        // ignore
      }
      return { weekKey: null, days: {} };
    };

    this.saveDailyRewardWeekState = () => {
      try {
        localStorage.setItem(
          "weeklyDailyRewardState",
          JSON.stringify(this.dailyRewardWeekState || { weekKey: null, days: {} }),
        );
      } catch (e) {
        // ignore
      }
    };

    this.ensureWeeklyRewardState = () => {
      const weekKey = this.getDailyRewardWeekKey();
      const state = this.loadDailyRewardWeekState();
      if (state.weekKey !== weekKey) {
        state.weekKey = weekKey;
        state.days = {};
      }

      // Mark any past days this week as missed if not claimed.
      const today = this.formatDateYmd(this.getKstNow());
      const weekStart = new Date(weekKey);
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const str = this.formatDateYmd(d);
        if (str < today && !state.days[str]) {
          state.days[str] = "missed";
        }
      }

      this.dailyRewardWeekState = state;
      this.saveDailyRewardWeekState();
    };

    this.markDailyRewardClaimed = (dateStr) => {
      if (!dateStr) return;
      this.ensureWeeklyRewardState();
      this.dailyRewardWeekState.days = this.dailyRewardWeekState.days || {};
      this.dailyRewardWeekState.days[dateStr] = "claimed";
      this.dailyRewardWeekState.weekKey = this.getDailyRewardWeekKey(dateStr);
      this.saveDailyRewardWeekState();
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
      this.dailyRewardBtnText.setText(`출석체크`);

      this.dailyRewardBtn.setVisible(true);
      this.updateDailyRewardCountdownText();

      if (this.isWeeklyRewardPopupOpen) {
        this.dailyRewardBtnBg.disableInteractive();
      }

      // disable any pulsing animation entirely
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

      // always stop pulse tween and reset scale to avoid growth
      if (this.dailyRewardPulseTween) {
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
          // guard against multiple instances – if bgm already playing, bail out
          const existing = this.sound.get("bgm");
          if (existing && existing.isPlaying) return;
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

      // Keep reference so we can refresh animation once deferred assets finish loading
      this._lobbyBgSprites = quadSprites;
      this._lobbyBgIsSplit = true;
      this._lobbyBgSize = { width: totalBgW, height: totalBgH };
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

      this._lobbyBgSprites = [lobbyBg];
      this._lobbyBgIsSplit = false;
      this._lobbyBgSize = { width: totalBgW, height: totalBgH };
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
      // DEBUG: 확인용
      console.debug("[DEBUG] myProfile received", {
        ratio: profile.ratio,
        bellCorrect: profile.bellCorrect,
        bellTotal: profile.bellTotal,
      });
      // cache on socket so new scenes can initialize from existing data
      try {
        socket.profile = profile;
      } catch (e) {}
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
            if (
              typeof key === "string" &&
              /^(player_[1-4]|player_2)$/.test(key)
            ) {
              normalized[key] = true;
            }
          });
        } else if (rawValue && typeof rawValue === "object") {
          Object.entries(rawValue).forEach(([key, value]) => {
            if (
              typeof key === "string" &&
              /^(player_[1-4]|player_2)$/.test(key)
            ) {
              normalized[key] = !!value;
            }
          });
        }

        normalized.player_1 = true;
        return normalized;
      };

      let mergedOwnedCharacters = normalizeOwnedCharacters({});

      // Local storage can contain owned characters (e.g. rewards granted in the app)
      // that haven't yet been reflected in the server snapshot.
      try {
        const stored = JSON.parse(localStorage.getItem("ownedCharacters") || "[]");
        if (Array.isArray(stored) && stored.length > 0) {
          const localOwned = {};
          stored.forEach((key) => {
            if (
              typeof key === "string" &&
              /^(player_[1-4]|player_2)$/.test(key)
            ) {
              localOwned[key] = true;
            }
          });
          mergedOwnedCharacters = normalizeOwnedCharacters({
            ...mergedOwnedCharacters,
            ...localOwned,
          });
        }
      } catch (e) {
        // ignore invalid/malformed local data
      }

      if (profile && Array.isArray(profile.owned_characters)) {
        const ownedCharactersFromServer = {};
        profile.owned_characters.forEach((key) => {
          if (
            typeof key === "string" &&
            /^(player_[1-4]|player_2)$/.test(key)
          ) {
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

      // 멀티플레이 결과(JUDGEMENT) 동안 코인/프로필 업데이트를 지연.
      // 종료 시점에 서버가 프로필을 푸시하면, 결과 연출이 끝난 후 반영해야 어색함을 줄임.
if (this.isGameEnded || this.isResultOverlayActive) {
        this._deferredMyProfile = profile;
        console.debug("myProfile update deferred until post-result", {
          profile,
        });
      } else {
        this.updateMyProfileUI(profile);
      }
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

      // Weekly state (claimed/missed) should persist across sessions and reset each Monday
      try {
        this.ensureWeeklyRewardState();
        if (this.dailyRewardLastCheckinDate) {
          this.markDailyRewardClaimed(this.dailyRewardLastCheckinDate);
        }
      } catch (e) {
        // ignore
      }

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
        if (Number.isFinite(Number(payload.totalCoins))) {
          this.setCoinsAbsolute(Number(payload.totalCoins), { sync: false });
        } else {
          this.updateMyProfileUI();
        }
      }

      if (!(this.isGameEnded && !this.isSingle)) {
        if (this.shopCoinText && this.myProfile) {
          this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
        }
        if (this.coinShopCurrentCoinText && this.myProfile) {
          this.coinShopCurrentCoinText.setText(
            `현재 보유: 💰 ${this.myProfile.coins}`,
          );
        }
      }

      // no toast needed; reward is shown on panel itself

      this.dailyRewardAvailable = false;
      this.dailyRewardLastCheckinDate =
        payload && payload.date
          ? payload.date
          : this.dailyRewardLastCheckinDate;
      this.isDailyRewardClaimPending = false;

      // Persist claimed status in weekly state
      try {
        if (payload && payload.date) {
          this.markDailyRewardClaimed(payload.date);
        }
      } catch (e) {
        // ignore
      }

      if (typeof this.updateDailyRewardButtonState === "function") {
        this.updateDailyRewardButtonState();
      }
    });

    // 💡 케릭터 구매 이벤트 핸들러 추가
    socket.off("buyCharacterError").on("buyCharacterError", (message) => {
      this.showToast(message || "케릭터 구매에 실패했습니다.", "#e74c3c");
      // If we had an optimistic pending deduction, revert it on error
      try {
        if (this.coinPurchaseInProgress) {
          this.cancelPendingCoinDeduction();
        }
      } catch (e) {
        console.warn("failed to revert pending coin deduction", e);
      }
    });

    // Special card purchase error -> revert optimistic deduction if present
    socket.off("buySpecialCardError").on("buySpecialCardError", (message) => {
      this.showToast(message || "특수카드 구매에 실패했습니다.", "#e74c3c");
      try {
        if (this.coinPurchaseInProgress) {
          this.cancelPendingCoinDeduction();
        }
      } catch (e) {
        console.warn("failed to revert pending coin deduction for special card", e);
      }
    });

    // 💡 케릭터 착용 에러 이벤트 핸들러 추가
    socket.off("equipCharacterError").on("equipCharacterError", (message) => {
      this.showToast(message || "착용에 실패했습니다.", "#e74c3c");
    });

    socket.off("characterPurchased").on("characterPurchased", (data) => {
      console.log("🎭 케릭터 구매 성공:", data);

      // 서버 응답 기반으로 UI만 업데이트 (로컬스토리지 저장 없음)
      const isMyPurchase =
        data &&
        (data.playerId === socket.id ||
          data.userId === this.myProfile?.userId ||
          data.id === socket.id);
      if (isMyPurchase) {
        // Clear pending state and reconcile with server-provided coins when available
        try {
          this.coinPurchaseInProgress = false;
          const pending = Number(this.pendingCoinDeduction) || 0;
          this.pendingCoinDeduction = 0;
          this.pendingOriginalCoins = 0;
          if (data && typeof data.newCoins === "number") {
            this.setCoinsAbsolute(Number(data.newCoins), { sync: false });
          } else if (pending) {
            // If server didn't send the updated coin total, keep optimistic amount as current
            if (this.shopCoinText) {
              this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
            }
            if (this.coinShopCurrentCoinText) {
              this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${this.myProfile.coins}`);
            }
          }
        } catch (e) {
          console.warn("characterPurchased reconciliation failed", e);
        }
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
        this.setCoinsAbsolute(Number(data.newCoins), { sync: false });
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
        this.showCustomAlert("메인으로 이동합니다!", () => {
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
        scaleX: 0.95,
        scaleY: 0.95,
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
        scaleX: 0.95,
        scaleY: 0.95,
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

    // If deferred assets already finished while create() was running,
    // ensure animations are updated.
    if (this._deferredAssetsLoaded && typeof this._applyDeferredAnimations === "function") {
      this._applyDeferredAnimations();
    }

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
      .text(0, 0, "출석체크", {
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

    const buttonPress = (targets, onComplete, opts = {}) => {
      if (!Array.isArray(targets)) targets = [targets];
      // default: tint-based feedback (no scale change)
      const downDuration = typeof opts.downDuration === "number" ? opts.downDuration : 50;
      const upDuration = typeof opts.upDuration === "number" ? opts.upDuration : 100;

      // helper: darken a hex tint by factor
      const darkenTint = (tint, factor = 0.85) => {
        if (typeof tint !== "number") return tint;
        const r = Math.max(0, Math.min(255, Math.round(((tint >> 16) & 0xff) * factor)));
        const g = Math.max(0, Math.min(255, Math.round(((tint >> 8) & 0xff) * factor)));
        const b = Math.max(0, Math.min(255, Math.round((tint & 0xff) * factor)));
        return (r << 16) | (g << 8) | b;
      };

      // record original tints/colors and cancel any pending restores
      const originalTints = new Map();
      const originalTextColors = new Map();
      targets.forEach((t) => {
        try {
          if (t._pressRestore) {
            try { t._pressRestore.remove(false); } catch (e) {}
            t._pressRestore = null;
          }
          if (typeof t.setTint === "function") {
            const orig = typeof t.tintTopLeft === "number" ? t.tintTopLeft : 0;
            originalTints.set(t, orig);
          } else if (typeof t.setStyle === "function" && t.style && t.style.color) {
            originalTextColors.set(t, t.style.color);
          }
        } catch (e) {}
      });

      // apply immediate tint (or text color) to indicate press, then restore
      targets.forEach((t) => {
        try {
          if (typeof t.setTint === "function") {
            const orig = originalTints.get(t) || 0;
            const darker = darkenTint(orig || 0xffffff, 0.85);
            t.setTint(darker);
          } else if (typeof t.setStyle === "function" && t.style && t.style.color) {
            // convert '#rrggbb' or 'rgb()' to hex fallback: darken hex if possible
            let col = t.style.color;
            if (col && col.startsWith("#") && col.length === 7) {
              const r = parseInt(col.slice(1, 3), 16);
              const g = parseInt(col.slice(3, 5), 16);
              const b = parseInt(col.slice(5, 7), 16);
              const dr = Math.max(0, Math.round(r * 0.85)).toString(16).padStart(2, "0");
              const dg = Math.max(0, Math.round(g * 0.85)).toString(16).padStart(2, "0");
              const db = Math.max(0, Math.round(b * 0.85)).toString(16).padStart(2, "0");
              t.setStyle({ color: `#${dr}${dg}${db}` });
            }
          }
        } catch (e) {}
      });

      // schedule restore after down+up durations
      const total = downDuration + upDuration;
      targets.forEach((t) => {
        try {
          t._pressRestore = this.time.delayedCall(total, () => {
            try {
              if (typeof t.setTint === "function") {
                const orig = originalTints.get(t);
                if (typeof orig === "number" && orig !== 0) t.setTint(orig);
                else t.clearTint && t.clearTint();
              } else if (typeof t.setStyle === "function" && originalTextColors.has(t)) {
                t.setStyle({ color: originalTextColors.get(t) });
              }
            } catch (e) {}
            t._pressRestore = null;
            if (typeof onComplete === "function") onComplete();
          });
        } catch (e) {}
      });
    };

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
      buttonPress([adRewardBtnImg, adRewardBtnText], () => {
        this.tryShowLobbyIntegratedAd();
        if (typeof this.incrementMultiQuestCounter === "function") {
          this.incrementMultiQuestCounter("watch_ad", 1);
        }
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

    // expose badge elements for external updates
    this.questBadge = questBadge;
    this.questBadgeText = questBadgeText;

    questBtn.add([questBtnImg, questBtnText]);
    questBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      buttonPress([questBtnImg, questBtnText], () => {
        this.showQuestPopup();
      });
    });
    questBtn.add([questBadge, questBadgeText]);

    this.hasQuestRewardReady = () => {
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

    this.updateQuestBadgeState = () => {
      const shouldShow = this.hasQuestRewardReady();
      try {
        const stored = JSON.parse(
          localStorage.getItem(MULTI_QUEST_PROGRESS_STORAGE_KEY) || "{}",
        );

      } catch (e) {
      }
      if (this.questBadge) this.questBadge.setVisible(shouldShow);
      if (this.questBadgeText) this.questBadgeText.setVisible(shouldShow);

      if (shouldShow) {
        if (!this.questBadgeTween) {
          this.questBadgeTween = this.tweens.add({
            targets: [this.questBadge, this.questBadgeText],
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
        if (this.questBadge) this.questBadge.setScale(1);
        if (this.questBadgeText) this.questBadgeText.setScale(1);
      }
    };

    this.updateQuestBadgeState();

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
      buttonPress([shopBtnImg, shopBtnText], () => {
        this.showShopPopup();
      });
    });

    socket.off("roomCreated").on("roomCreated", (data) => {
      // if we were in the middle of leaving when the server responds,
      // clear the flag so the lobby UI will actually update.
      this.isLeavingRoom = false;

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
      // joining a new room should also clear any previous-leave state
      this.isLeavingRoom = false;
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
      // mark that lobby received gameStart (used by start request fallback)
      try {
        this._gameStartReceived = true;
      } catch (e) {}

      // 🔹 중요: 게임이 시작되면 로비 관련 경고 리스너들을 미리 끕니다.
      socket.off("startBlocked");
      socket.off("readyStatusUpdated");
      socket.off("joinRoomError");

      // 로딩창이 혹시 떠 있다면 닫아줍니다.
      this.hideLoading();

      if (typeof data?.itemMode !== "boolean") {
        data.itemMode = this.currentItemMode !== false;
      }

      // 안전: 서버가 players를 보내지 않을 수 있으므로 이전 플레이어 목록을 보존
      if (!Array.isArray(data.players) || !data.players.length) {
        data.players = Array.isArray(this.roundData?.players) ? this.roundData.players : [];
      }

      // 멀티플레이 참여 퀘스트 카운트는 게임 종료 시에만 올립니다.
      // (시작 시 카운트하면 재접속/재시작 시 중복 집계가 됩니다.)
      // this.incrementMultiQuestCounter("multi_play", 1);

      console.log("LobbyScene: received gameStart, starting GameScene", {playersLen: Array.isArray(data.players)?data.players.length:0});
      // Ensure stale GameScene state is fully reset before new match.
      try {
        if (this.scene.isActive("GameScene")) {
          this.scene.stop("GameScene");
        }
      } catch (e) {
        console.warn("LobbyScene: stop GameScene failed", e);
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

  applyDeferredProfileUpdates() {
    if (!this._deferredMyProfile) return;

    this._isApplyingDeferredProfile = true;
    try {
      this.updateMyProfileUI(this._deferredMyProfile);
    } catch (e) {
      console.warn("applyDeferredProfileUpdates failed", e);
    }
    this._isApplyingDeferredProfile = false;
    this._deferredMyProfile = null;
    // After applying any server snapshot, also apply deferred coin deltas
    try {
      this.applyDeferredCoins();
    } catch (e) {
      console.warn('applyDeferredProfileUpdates -> applyDeferredCoins failed', e);
    }
  }

  // Helper to set the detailed '보유코인' label (long form). Skips on multiplayer game end.
  setProfileCoinLabel(text) {
    try {
      if (this.isGameEnded && !this.isSingle) {
        console.debug('setProfileCoinLabel skipped due to game end', { text });
        return;
      }
      if (this.profileCoinTxt && this.profileCoinTxt.active && typeof this.profileCoinTxt.setText === 'function') {
        this.profileCoinTxt.setText(text);
      }
    } catch (e) {
      console.warn('setProfileCoinLabel failed', e);
    }
  }

  // Helper to set the compact profile coin text (e.g. 'X 123'). Skips on multiplayer game end.
  setProfileCoinShort(text) {
    try {
      if (this.isGameEnded && !this.isSingle) {
        console.debug('setProfileCoinShort skipped due to game end', { text });
        return;
      }
      if (this.profileCoinText && this.profileCoinText.active && typeof this.profileCoinText.setText === 'function') {
        this.profileCoinText.setText(text);
      }
    } catch (e) {
      console.warn('setProfileCoinShort failed', e);
    }
  }
 

  updateMyProfileUI(profile = {}) {
    // 게임 종료 후에는 즉시 프로필을 갱신하지 않고, 결과 시상 연출 중에만 최종 갱신을 적용하도록 합니다.
    if (this.isGameEnded && !this._isApplyingDeferredProfile) {
      console.debug("updateMyProfileUI skipped because game ended", {
        profile,
      });
      return;
    }

    // In singleplayer we do not show/update multiplayer profile UI.
    // Guard against stale/destroyed text objects from a previous multiplayer session.
    if (
      this.isSingle &&
      !this.profileNameTxt &&
      !this.profileLevelTxt &&
      !this.profileCoinsTxt &&
      !this.profileIdText &&
      !this.profileCoinText &&
      !this.profileExpBarFill &&
      !this.profileExpText &&
      !this.profileReactTxt
    ) {
      return;
    }

    const prev = this.myProfile || {};
    const prevRatioVal = Number(prev.ratio);

    // Load localStorage bell stats and derive local accuracy ratio.
    const localCorrect = Number(localStorage.getItem("bellCorrect")) || 0;
    const localTotal = Number(localStorage.getItem("bellTotal")) || 0;
    const localRatio = localTotal > 0 ? Math.round((localCorrect / localTotal) * 100) : null;

    // Incoming server ratio is ignored for multiplayer; local data has priority.
    const initialRatio =
      localRatio !== null
        ? localRatio
        : Number.isFinite(prevRatioVal) && prevRatioVal >= 0
        ? prevRatioVal
        : 0;
    const prevLevel = Number(prev.level) || 1;
    const hasIncomingStats =
      typeof profile.level !== "undefined" ||
      typeof profile.coins !== "undefined" ||
      typeof profile.experience !== "undefined";

    const normalizeCharacterKey = (value) =>
      typeof value === "string" && /^(player_[1-4]|premium_bear)$/.test(value)
        ? value
        : null;

    const incomingOwnedCharacters = Array.isArray(profile.owned_characters)
      ? profile.owned_characters
      : Array.isArray(prev.owned_characters)
        ? prev.owned_characters
        : [];

    const normalizedOwnedCharacters = Array.from(
      new Set(
        ["player_1"].concat(
          incomingOwnedCharacters.filter(
            (key) =>
              typeof key === "string" && /^(player_[1-4]|premium_bear)$/.test(key),
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

    let resolvedCoins = Number(profile.coins ?? prev.coins ?? 0) || 0;
    if (this.fromSingleGame || this.isSingle) {
      const storedCoins = Number(localStorage.getItem("profileCoins")) || 0;
      resolvedCoins = Math.max(resolvedCoins, storedCoins);
    }

    this.myProfile = {
      ...prev,
      ...profile,
      nickname:
        profile.nickname ||
        prev.nickname ||
        localStorage.getItem("nickname") ||
        "요리사",
      level: Number(profile.level ?? prev.level ?? 1) || 1,
      coins: resolvedCoins,
      experience: Number(profile.experience ?? prev.experience ?? 0) || 0,
      // ratio is derived from bell stats (bellCorrect/bellTotal)
      // to avoid relying on an inconsistent cached value.
      ratio: initialRatio,
      owned_characters: normalizedOwnedCharacters,
      current_character: normalizedCurrentCharacter,
      avatarKey: normalizedAvatarKey,
    };

    // keep bell accuracy totals in sync with localStorage only
    if (!this.bellStats) {
      this.bellStats = { correct: 0, total: 0 };
    }

    // Profile payload may include server-side bell stats; ignore them for multiplayer.
    // Instead, re-load from localStorage if needed (local data wins).
    const storedCorrect = Number(localStorage.getItem("bellCorrect")) || 0;
    const storedTotal = Number(localStorage.getItem("bellTotal")) || 0;
    if (storedTotal > 0) {
      this.bellStats.correct = storedCorrect;
      this.bellStats.total = storedTotal;
    }

    // derived ratio from local stats
    if (this.bellStats.total > 0) {
      this.myProfile.ratio = Math.round(
        (this.bellStats.correct / this.bellStats.total) * 100,
      );
    } else {
      this.myProfile.ratio = 0;
    }

    if (typeof window !== "undefined") {
      window.bellStats = { ...this.bellStats };
    }

    if (
      hasIncomingStats &&
      this.hasReceivedProfileStats &&
      this.myProfile.level > prevLevel
    ) {
      console.debug(
        `레벨 업 감지(서버): Lv.${prevLevel} → Lv.${this.myProfile.level}`,
      );
    }
    if (hasIncomingStats) {
      this.hasReceivedProfileStats = true;
    }

    // combined text exists check
    // if server provided avetime and our local samples empty, seed it
    if (
      typeof this.myProfile.avetime === 'number' &&
      (!Array.isArray(this.reactionTimes) || this.reactionTimes.length === 0)
    ) {
      this.reactionTimes = [this.myProfile.avetime];
    }

    const safeSetText = (txtObj, value) => {
      try {
        if (txtObj && txtObj.active && typeof txtObj.setText === 'function') {
          txtObj.setText(value);
        }
      } catch (e) {
        console.warn('[safeSetText] text update failed', e);
      }
    };

    if (
      !this.profileIdText ||
      !this.profileCoinText ||
      !this.profileExpBarFill ||
      !this.profileExpText
    ) {
      // still update game-screen profile if exists
      safeSetText(this.profileNameTxt, this.myProfile.nickname || '');
      safeSetText(this.profileLevelTxt, `Lv ${this.myProfile.level}`);
      safeSetText(this.profileCoinsTxt, `Coins: ${this.myProfile.coins}`);
      // also update detailed profile label (guarded inside helper)
      this.setProfileCoinLabel(`보유코인: ${this.myProfile.coins}`);
      return;
    }

    // update combined level+nickname text (safe)
    safeSetText(
      this.profileIdText,
      `LV.${this.myProfile.level} ${this.myProfile.nickname}`,
    );
    safeSetText(this.profileCoinText, `X ${this.myProfile.coins}`);
    // also update game-screen card if present
    // 멀티플레이에서 게임 종료 후 하단 우측 UI(반응속도/정답률/보유코인)는 업데이트하지 않음
    if (this.isGameEnded && !this.isSingle && !this._isApplyingDeferredProfile) {
      console.debug('skip bottom-right UI update (updateMyProfileUI early)', { profile });
      return;
    }

    safeSetText(this.profileNameTxt, this.myProfile.nickname || "");
    safeSetText(this.profileLevelTxt, `Lv ${this.myProfile.level}`);
    safeSetText(this.profileCoinsTxt, `Coins: ${this.myProfile.coins}`);

    // 경험치 바 업데이트
    const currentExp = this.myProfile.experience % XP_PER_LEVEL;
    const expRatio = currentExp / XP_PER_LEVEL;
    const cam = (this.cameras && this.cameras.main) || null;
    const width = cam?.width || (this.scale && this.scale.width) || 0;
    const height = cam?.height || (this.scale && this.scale.height) || 0;
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

  // Helper: determine whether given playerId refers to an AI/bot.
  isPlayerAi(playerId) {
    try {
      if (!playerId) return false;
      // Prefer explicit server-provided flag when available
      if (Array.isArray(this.roundData?.players)) {
        const p = this.roundData.players.find((x) => x && x.id === playerId);
        if (p && typeof p.isBot === "boolean") return !!p.isBot;
      }
      // Fallback to common id patterns used by client or server
      return typeof playerId === "string" && (/^AI_/i.test(playerId) || /^AI_BOT_/i.test(playerId) || playerId.startsWith("AI_BOT_"));
    } catch (e) {
      return false;
    }
  }

  getOwnedProfileAvatarKeys() {
    const allKeys = Array.isArray(this.profileAvatarKeys)
      ? this.profileAvatarKeys
      : [];
    if (allKeys.length === 0) {
      return ["player_1"];
    }

    const ownedFromProfile = Array.isArray(this.myProfile?.owned_characters)
      ? this.myProfile.owned_characters
      : [];

    const ownedFromStorage = (() => {
      try {
        const stored = JSON.parse(localStorage.getItem("ownedCharacters") || "[]");
        return Array.isArray(stored) ? stored : [];
      } catch (e) {
        return [];
      }
    })();

    const ownedSet = new Set([
      "player_1",
      ...ownedFromProfile,
      ...ownedFromStorage,
    ]);

    const ownedKeys = Array.from(
      new Set(allKeys.filter((key) => ownedSet.has(key))),
    );
    return ownedKeys.length > 0 ? ownedKeys : ["player_1"];
  }

  isPremiumBearUnlocked() {
    try {
      const profileHas = Array.isArray(this.myProfile?.owned_characters)
        ? this.myProfile.owned_characters.includes(PREMIUM_BEAR_KEY)
        : false;

      // Fallback: check local storage for persisted unlock state.
      let storedHas = false;
      try {
        const stored = JSON.parse(localStorage.getItem("ownedCharacters") || "[]");
        storedHas = Array.isArray(stored) && stored.includes(PREMIUM_BEAR_KEY);
      } catch (err) {
        storedHas = false;
      }

      const result = profileHas || storedHas;
      console.debug("[premium] isPremiumBearUnlocked ->", { profileHas, storedHas, result });
      return result;
    } catch (e) {
      console.warn("[premium] isPremiumBearUnlocked failed", e);
      return false;
    }
  }

  unlockPremiumBear() {
    if (!this.myProfile) this.myProfile = {};
    if (!Array.isArray(this.myProfile.owned_characters)) {
      this.myProfile.owned_characters = [];
    }
    if (!this.myProfile.owned_characters.includes(PREMIUM_BEAR_KEY)) {
      this.myProfile.owned_characters.push(PREMIUM_BEAR_KEY);
    }

    try {
      localStorage.setItem(
        "ownedCharacters",
        JSON.stringify(this.myProfile.owned_characters),
      );
    } catch (e) {
      // ignore
    }

    // 바로 서버 저장 시도 (싱글플레이에서는 서버 연결이 없으므로 스킵)
    try {
      if (!this.isSingle && socket && socket.connected) {
        const resolvedPlayerId =
          this.myProfile.nickname ||
          localStorage.getItem("nickname") ||
          this.myNickname ||
          "요리사";

        const characterId =
          typeof this.getCharacterIdFromKey === "function"
            ? this.getCharacterIdFromKey(PREMIUM_BEAR_KEY)
            : 2;

        socket.emit("buyCharacter", {
          id: resolvedPlayerId,
          userId: resolvedPlayerId,
          player_id: resolvedPlayerId,
          nickname: this.myProfile.nickname || resolvedPlayerId,
          playerId: socket.id,
          characterKey: PREMIUM_BEAR_KEY,
          characterId,
          characterPrice: 0,
          currentCharacter: PREMIUM_BEAR_KEY,
          current_character: PREMIUM_BEAR_KEY,
          coins: Number(this.myProfile.coins) || 0,
        });
      }
    } catch (e) {
      console.warn("[premium] server unlock attempt failed", e);
    }

    if (typeof this.emitInventory === "function") {
      // Emit immediately (fallback) so local persistence is synced even if
      // server profile snapshot isn't ready.
      this.emitInventory("premiumBearUnlocked", { requireServerProfile: false });

      // Also attempt a full sync that requires server profile when available.
      setTimeout(() => {
        try {
          if (typeof this.emitInventory === "function") {
            this.emitInventory("premiumBearUnlocked");
          }
        } catch (e) {
          /* ignore */
        }
      }, 250);
    }
    // Update avatar UI so owned characters reflect immediately
    try {
      if (typeof this.updateProfileAvatarUI === "function") {
        this.updateProfileAvatarUI();
      }
    } catch (e) {
      // ignore
    }

    // If the shop is open, refresh its content so the unlocked character appears immediately.
    try {
      if (this.isShopOpen && typeof renderShopContent === "function") {
        renderShopContent();
      }
    } catch (e) {
      // ignore
    }
  }

  // Shows a *reward intro* popup after tutorial completes.
  // The user must press 확인 to proceed to single-play start.
  showPremiumBearIntroPopup(onConfirm) {
    if (this._premiumBearIntroPopup) return;

    const { width, height } = this.cameras.main;

    // Full-screen black overlay (semi-opaque)
    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
      .setInteractive();

    // Large centered character image (premium bear)
    const iconSize = Math.min(width * 0.5, height * 0.45);

    const createBearIcon = () => {
      const possibleKeys = [
        "player_3_frame_1",
        "player_3_1",
        "player_3_2",
        "player_3_sprite",
        "player_3",
        "player_2_frame_1",
        "player_2_1",
        "player_2_2",
        "player_2_sprite",
        "player_2",
      ];
      const resolvedKey = possibleKeys.find((k) => this.textures && typeof this.textures.exists === 'function' && this.textures.exists(k));
      if (resolvedKey) {
        return this.add
          .image(width / 2, height * 0.45, resolvedKey)
          .setDisplaySize(iconSize, iconSize)
          .setDepth(12001)
          .setOrigin(0.5);
      }

      const g = this.add.graphics().setDepth(12001);
      const cx = width / 2;
      const cy = height * 0.45;
      const r = iconSize * 0.42;
      const earR = r * 0.28;

      g.fillStyle(0xd7b06b, 1);
      g.fillCircle(cx, cy, r);
      g.fillCircle(cx - r * 0.5, cy - r * 0.55, earR);
      g.fillCircle(cx + r * 0.5, cy - r * 0.55, earR);

      g.fillStyle(0x4c3028, 1);
      g.fillCircle(cx - r * 0.2, cy + r * 0.05, r * 0.15);
      g.fillCircle(cx + r * 0.2, cy + r * 0.05, r * 0.15);

      g.fillStyle(0x2c1b10, 1);
      g.fillCircle(cx, cy + r * 0.2, r * 0.2);

      return g;
    };

    const icon = createBearIcon();

    // Confirm button below the character
    const btnY = height * 0.78;
    const btn = this.add
      .image(width / 2, btnY, "ui_btn")
      .setDisplaySize(width * 0.36, height * 0.08)
      .setTint(0x22c55e);
    const btnTxt = this.add
      .text(width / 2, btnY, "확인", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.max(18, width * 0.05)}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(12002);

    const container = this.add.container(0, 0, [overlay, icon, btn, btnTxt]);
    // Ensure acquired popup is above result overlay and other UI
    container.setDepth(40001);
    this._premiumBearIntroPopup = container;

    const close = () => {
      if (this._premiumBearIntroPopup) {
        this._premiumBearIntroPopup.destroy();
        this._premiumBearIntroPopup = null;
      }
    };

    // Prevent immediate tap-through by delaying interaction enablement
    this.time.delayedCall(150, () => {
      if (!btn || !btn.active) return;
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.12 });
        close();
        if (typeof onConfirm === "function") onConfirm();
      });
    });
  }

  showPremiumBearOfferPopup(onConfirm) {
    if (this._premiumBearOfferPopup) return;

    const { width, height } = this.cameras.main;
    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
      .setInteractive();

    const panel = this.add
      .rectangle(width / 2, height / 2, width * 0.78, height * 0.65, 0x111111, 0.96)
      .setStrokeStyle(2, 0xffffff, 0.25);

    const title = this.add
      .text(width / 2, height * 0.27, "플레이어 2 보상!", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffd700",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const desc = this.add
      .text(
        width / 2,
        height * 0.35,
        "싱글플레이에서 1등하면 플레이어 2를 획득할 수 있어요!",
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.037}px`,
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width * 0.64 },
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5);

    const offerIconSize = Math.min(width * 0.42, width * 0.42);
    const offerKeyCandidates = [
      "player_3_frame_1",
      "player_3_1",
      "player_3_2",
      "player_3_sprite",
      "player_3",
      "player_2_frame_1",
      "player_2_1",
      "player_2_2",
      "player_2_sprite",
      "player_2",
    ];
    const offerKey = offerKeyCandidates.find(
      (k) => this.textures && typeof this.textures.exists === "function" && this.textures.exists(k),
    );
    const icon = this.add
      .image(width / 2, height * 0.52, offerKey || "player_1")
      .setDisplaySize(offerIconSize, offerIconSize)
      .setDepth(10001);

    const btn = this.add
      .image(width / 2, height * 0.8, "ui_btn")
      .setDisplaySize(width * 0.38, height * 0.08)
      .setTint(0x22c55e)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add
      .text(width / 2, height * 0.8, "획득", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    const container = this.add.container(0, 0, [overlay, panel, title, desc, icon, btn, btnTxt]);
    container.setDepth(12000);
    this._premiumBearOfferPopup = container;

    const close = () => {
      if (this._premiumBearOfferPopup) {
        this._premiumBearOfferPopup.destroy();
        this._premiumBearOfferPopup = null;
      }
    };

    btn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.12 });
      close();
      if (typeof onConfirm === "function") onConfirm();
    });
  }

  showPremiumBearAcquiredPopup(onConfirm, alreadyOwned = false) {
    if (this._premiumBearAcquiredPopup) return;

    console.debug("[premium] showPremiumBearAcquiredPopup called", { alreadyOwned });

    try {
      const { width, height } = this.cameras.main;
      const overlay = this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
        .setInteractive();
      try {
        overlay.on("pointerdown", (e) => {
          e.stopPropagation && e.stopPropagation();
        });
      } catch (e) {}

      // Centered character image and a bottom confirm button
      const iconSize = Math.min(width * 0.5, height * 0.45);
      const titleText = alreadyOwned ? "플레이어 2 보유 중" : "플레이어 2 획득!";
      /*const subtitleText = alreadyOwned
        ? "이미 보유 중입니다. 계속 진행하세요."
        : "1등 보상으로 획득할 수 있습니다!";*/

   
      const title = this.add
        .text(width / 2, height * 0.27, titleText, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.06}px`,
          color: "#ffd700",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5);

      /*const desc = this.add
        .text(width / 2, height * 0.35, subtitleText, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.037}px`,
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width * 0.64 },
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5);*/

      const createBearIcon = () => {
        // Prefer premium bear frames if available; fallback to player_1 if missing.
        const possibleKeys = [
          "player_2_frame_1",
          "player_2_1",
          "player_2_2",
          "player_2_sprite",
          "player_2",
        ];
        const resolvedKey = possibleKeys.find(
          (k) => this.textures && typeof this.textures.exists === "function" && this.textures.exists(k),
        );
        const textureKey = resolvedKey || "player_1";

        const sprite = this.add
          .sprite(width / 2, height * 0.45, textureKey)
          .setDisplaySize(iconSize, iconSize)
          .setDepth(40002)
          .setOrigin(0.5);

        try {
          if (typeof this.applyAvatarAnimation === "function") {
            this.applyAvatarAnimation(sprite, PREMIUM_BEAR_KEY);
          }
        } catch (e) {
          console.warn("[premium] applyAvatarAnimation failed", e);
          if (textureKey && this.textures.exists(textureKey)) {
            sprite.setTexture(textureKey);
          }
        }

        return sprite;
      };

      const icon = createBearIcon();

      const particleTimer = this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
          const count = Phaser.Math.Between(5, 8);
          for (let i = 0; i < count; i += 1) {
            const color = Phaser.Display.Color.RandomRGB();
            const particle = this.add
              .star(
                width / 2 + Phaser.Math.FloatBetween(-iconSize * 0.5, iconSize * 0.5),
                height * 0.55 + Phaser.Math.FloatBetween(-iconSize * 0.08, iconSize * 0.08),
                5,
                Phaser.Math.FloatBetween(12, 18),
                Phaser.Math.FloatBetween(16, 22),
                color.color,
              )
              .setDepth(40001)
              .setScale(1.1)
              .setAlpha(0.92);

            const destinationX = width / 2 + Phaser.Math.FloatBetween(-iconSize * 0.9, iconSize * 0.9);
            const destinationY = height * 0.15 + Phaser.Math.FloatBetween(-20, 20);

            this.tweens.add({
              targets: particle,
              x: destinationX,
              y: destinationY,
              alpha: 0,
              angle: Phaser.Math.Between(160, 560),
              duration: Phaser.Math.Between(750, 1100),
              ease: "Cubic.out",
              onComplete: () => {
                try {
                  particle.destroy();
                } catch (e) {}
              },
            });
          }
        },
      });

      // Keep reference to clear with close
      const confettiTimer = particleTimer;

      const btnY = height * 0.63;
      const btn = this.add
        .image(width / 2, btnY, "ui_btn")
        .setDisplaySize(width * 0.36, height * 0.08)
        .setTint(0x22c55e);
      const btnTxt = this.add
        .text(width / 2, btnY, "받기", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.max(18, width * 0.05)}px`,
          color: "#ffffff",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(40003);

      const container = this.add.container(0, 0, [overlay, title, icon, btn, btnTxt]);
      container.setDepth(12000);
      this._premiumBearAcquiredPopup = container;

      const close = () => {
        try {
          if (particleTimer) {
            particleTimer.remove(false);
          }
        } catch (e) {}
        if (this._premiumBearAcquiredPopup) {
          this._premiumBearAcquiredPopup.destroy();
          this._premiumBearAcquiredPopup = null;
        }
      };

      const enableBtn = () => {
        try {
          btn.setInteractive({ useHandCursor: true });
          btn.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.12 });
            close();
            try {
              this.unlockPremiumBear();
            } catch (e) {
              console.warn("unlockPremiumBear failed", e);
            }
            if (typeof onConfirm === 'function') {
              onConfirm();
            }
          });
        } catch (e) {
          console.warn("[premium] enableBtn failed", e);
          try {
            this.unlockPremiumBear();
            close();
            if (typeof onConfirm === 'function') {
              onConfirm();
            }
          } catch (err) {}
        }
      };

      if (this.time && typeof this.time.delayedCall === "function") {
        this.time.delayedCall(150, enableBtn);
      } else {
        setTimeout(enableBtn, 150);
      }
    } catch (e) {
      console.warn("[premium] showPremiumBearAcquiredPopup failed", e);
      // fallback minimal popup so at least it's visible.
      this.add
        .text(this.cameras.main.width / 2, this.cameras.main.height / 2, "새로운 캐릭터 획득!", {
          fontFamily: GAME_FONTS.main,
          fontSize: "24px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setDepth(11000);
    }
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
    // 튜토리얼은 닉네임 입력 직후 바로 시작
    console.debug("[DEBUG] scheduleTutorialOverlay called", {
      hasCompletedTutorial: this.hasCompletedTutorial,
      isRoomOpen: this.isRoomOpen,
      currentRoomId: this.currentRoomId,
      sceneActive: this.scene ? this.scene.isActive("LobbyScene") : false,
    });

    if (this.hasCompletedTutorial) return;
    if (this.isRoomOpen || this.currentRoomId) return;
    if (!this.scene.isActive("LobbyScene")) return;

    // 방금 닉네임 입력 후 초기 진입 시 호출되는 경우에만 실행.
    // (이미 튜토리얼이 진행 중이거나 완료된 상태라면 스킵)
    console.debug("[DEBUG] scheduleTutorialOverlay -> starting tutorial");
    this.startTutorialGame();
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

    // Restore lobby exit button once tutorial finishes
    if (this.tutorialExitBtn) {
      this.tutorialExitBtn
        .setVisible(true)
        .setInteractive({ useHandCursor: true });
    }
  }

  getAvatarAnimMaxFrame(baseKey) {
    // player_1/player_2/player_3/player_4 모두 91 프레임까지 허용
    return /^player_[1-4]$/.test(baseKey) ? 91 : 2;
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
      if (this.anims.exists(animKey)) {
        // Recreate animation if new frames arrived.
        this.anims.remove(animKey);
      }
      const frames = frameKeys.map((key) => ({ key }));
      this.anims.create({
        key: animKey,
        frames,
        frameRate: 12,
        skipMissedFrames: false,
        repeat: -1,
      });
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

  _applyDeferredAnimations() {
    // When deferred assets finish loading, make sure any created animation
    // gets re-applied to the lobby background / avatar sprites.
    const mybgAnimKey = this.ensureMybgAnimation();

    if (mybgAnimKey && Array.isArray(this._lobbyBgSprites)) {
      if (Array.isArray(mybgAnimKey)) {
        this._lobbyBgSprites.forEach((sprite, idx) => {
          const key = mybgAnimKey[idx];
          if (sprite && key) {
            sprite.play(key, true);
            if (this._lobbyBgSize) {
              sprite.setDisplaySize(this._lobbyBgSize.width / 2, this._lobbyBgSize.height / 2);
            }
          }
        });
      } else {
        this._lobbyBgSprites.forEach((sprite) => {
          if (!sprite || !sprite.active || typeof sprite.play !== "function") return;
          try {
            sprite.play(mybgAnimKey, true);
            if (this._lobbyBgSize) {
              sprite.setDisplaySize(this._lobbyBgSize.width, this._lobbyBgSize.height);
            }
          } catch (e) {
            console.warn("_applyDeferredAnimations: background sprite play failed", e);
          }
        });
      }
    }

    // Re-apply avatar animation if the frames are now available.
    if (this.profileImage && typeof this.updateProfileAvatarUI === "function") {

      const baseKey = this.getSelectedAvatarKey();

      // Force recreate animation to ensure newly loaded frames are used.
      const animKey = this.getAvatarAnimKey(baseKey);
      if (this.anims.exists(animKey)) {
        this.anims.remove(animKey);
      }
      const newAnimKey = this.ensureAvatarAnimation(baseKey);

      // Re-apply pose/animation to existing sprite
      this.updateProfileAvatarUI();
      if (newAnimKey && this.profileImage && this.profileImage.anims) {
        try {
          this.profileImage.play(newAnimKey, true);
        } catch (e) {
          console.warn("failed to play avatar animation", e);
        }

      }
    }
  }

  getAvatarAnimKey(baseKey) {
    return `avatar_anim_${baseKey}`;
  }

  getAvatarAnimFrameRate(baseKey) {
    // player_1/player_2/player_3/player_4 모두 빠른 프레임으로 재생
    return baseKey === "player_1" || baseKey === "player_2" || baseKey === "player_3" || baseKey === "player_4" ? 18 : 2;
  }

  getAvatarAnimMaxFrame(baseKey) {
    // player_1/player_2/player_3/player_4은 최대 91 프레임을 사용하여 자연스럽게 재생
    return /^player_[1-4]$/.test(baseKey) ? 91 : 2;
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
    if (baseKey === "player_3") {
      if (this.textures.exists("player_3_frame_1")) return "player_3_frame_1";
    }
    if (baseKey === "player_4") {
      if (this.textures.exists("player_4_frame_1")) return "player_4_frame_1";
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
    if (typeof data.max === "number") {
      this.currentMax = data.max;
    } else if (typeof this.currentMax !== "number") {
      this.currentMax = 4;
    }
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
   
    try {
      const dbg = (data.players || []).map((p) => ({ id: p.id, nickname: p.nickname, isReady: !!p.isReady }));
    } catch (e) {
    }

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
      this.isLeavingRoom = false;
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
      if (this.lobbyChatInputElement) {
        try {
          this.lobbyChatInputElement.destroy();
        } catch (e) {
          // ignore
        }
        this.lobbyChatInputElement = null;
      }
      if (socket && socket.roomId === roomId) {
        socket.roomId = null;
      }

      // When leaving a multiplayer room, show the main lobby UI without restarting the scene.
      // This avoids reloading the room screen (it can feel like a refresh) and keeps state
      // like selected avatar, settings, and any cached UI intact.
      if (this.mainUIContainer) {
        try {
          this.mainUIContainer.setVisible(true).setActive(true);
        } catch (e) {
          // if it was destroyed for some reason, fall back to restarting.
          this.scene.start("LobbyScene");
        }
      } else {
        this.scene.start("LobbyScene");
      }
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

  clearActiveToast() {
    // stop any pending removals or tweens and destroy active toast
    if (this._toastClearTimer) {
      this._toastClearTimer.remove(false);
      this._toastClearTimer = null;
    }
    if (this._toastClearTimeoutId) {
      try {
        window.clearTimeout(this._toastClearTimeoutId);
      } catch (e) {}
      this._toastClearTimeoutId = null;
    }
    if (this._toastFallbackTimeoutId) {
      try {
        window.clearTimeout(this._toastFallbackTimeoutId);
      } catch (e) {}
      this._toastFallbackTimeoutId = null;
    }
    if (this._toastFallbackCheckIntervalId) {
      try {
        window.clearInterval(this._toastFallbackCheckIntervalId);
      } catch (e) {}
      this._toastFallbackCheckIntervalId = null;
    }
    if (this.activeToastTween) {
      try {
        this.activeToastTween.stop();
      } catch (e) {}
      this.activeToastTween = null;
    }
    if (this.activeToast) {
      try {
        this.activeToast.destroy();
      } catch (e) {}
      this.activeToast = null;
    }
    if (this.toastLayer) {
      try {
        this.toastLayer.removeAll(true);
      } catch (e) {}
      try {
        this.toastLayer.setVisible(false);
        this.toastLayer.setActive(false);
      } catch (e) {}
    }
    this.isToastOpen = false;
  }

  showToast(message, color = "#ffffff") {
    // Ensure previous toasts are fully cleared before showing a new one.
    this.clearActiveToast();

    this.isToastOpen = true;

    if (!this.cameras || !this.cameras.main) return;

    const { width, height } = this.cameras.main;

    // if a previous toast is still hanging around, remove it immediately
    if (
      this.toastLayer &&
      this.toastLayer.list &&
      this.toastLayer.list.length
    ) {
      this.toastLayer.removeAll(true);
    }

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
    this.activeToast = toast;
    this.activeToastTween = this.tweens.add({
      targets: toast,
      y: height * 0.22,
      duration: 300,
      ease: "Sine.easeOut",
      onStart: () => {
        toast.y = height * 0.19;
      },
      onComplete: () => {
        this._toastClearTimer = this.time.delayedCall(1000, () => {
          // always clean up the toast even if the scene was paused
          if (toast.scene) {
            this.tweens.add({
              targets: toast,
              y: -100,
              duration: 300,
              ease: "Power2.easeIn",
              onComplete: () => {
                this.clearActiveToast();
              },
            });
          } else {
            this.clearActiveToast();
          }
        });

        // Backup timer using native setTimeout in case Phaser timer doesn't run
        if (typeof window !== "undefined" && !this._toastClearTimeoutId) {
          this._toastClearTimeoutId = window.setTimeout(() => {
            this.clearActiveToast();
          }, 1300);
        }
      },
    });

    // *Extra* fallback for cases where tweens/timers never complete (e.g., scene pause)
    // This ensures the toast does not stay stuck indefinitely.
    if (typeof window !== "undefined" && !this._toastFallbackTimeoutId) {
      this._toastFallbackTimeoutId = window.setTimeout(() => {
        this.clearActiveToast();
      }, 2500);
    }
    // Additional safety: periodic check to ensure toast is removed even if timers/tweens
    // are stuck (some environments pause Phaser timers). This interval will be
    // cleared by `clearActiveToast` when cleanup occurs.
    if (typeof window !== "undefined" && !this._toastFallbackCheckIntervalId) {
      this._toastFallbackCheckIntervalId = window.setInterval(() => {
        try {
          // if activeToast is missing from scene or inactive, attempt cleanup
          if (!this.activeToast || !this.activeToast.scene || !this.activeToast.active) {
            this.clearActiveToast();
          }
        } catch (e) {
          try {
            this.clearActiveToast();
          } catch (e2) {}
        }
      }, 800);
    }
  }

  // specialized toast for coin rewards (uses image + number)
  showCoinToast(amount) {
    if (!this.cameras || !this.cameras.main) return;
    const { width, height } = this.cameras.main;

    if (!this.toastLayer || !this.toastLayer.scene) {
      this.toastLayer = this.add.container(0, 0).setDepth(1000000);
      this.toastLayer.setScrollFactor(0);
    }
    this.toastLayer.setVisible(true);
    this.toastLayer.setActive(true);
    this.children.bringToTop(this.toastLayer);

    const toast = this.add
      .container(width / 2, height * 0.22)
      .setDepth(1000001);
    toast.setScrollFactor(0);

    const coinSize = width * 0.06;
    const coinImg = this.add
      .image(0, -coinSize * 0.3, "coin")
      .setDisplaySize(coinSize, coinSize)
      .setDepth(1000002);

    const txt = this.add
      .text(0, coinSize * 0.4, `${amount}`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.floor(width * 0.05)}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(1000002);

    const paddingX = Math.floor(width * 0.04);
    const paddingY = Math.floor(width * 0.018);
    const bgW = Math.max(coinSize, txt.width) + paddingX * 2;
    const bgH = coinSize + txt.height + paddingY * 2;
    const bg = this.add
      .rectangle(0, 0, bgW, bgH, 0x000000, 0.85)
      .setOrigin(0.5)
      .setDepth(1000001);

    toast.add([bg, coinImg, txt]);
    this.toastLayer.add(toast);

    try {
      this.sound.play("pass", { volume: 0.5 });
    } catch (e) {}

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
          } else {
            try {
              toast.destroy();
            } catch (e) {}
            this.activeToast = null;
            this.isToastOpen = false;
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

    // 싱글플레이에서 사용하는 초기 카드 수 (이 값이 전체 카드 총합의 기준입니다)
    // (디버깅용으로 6장으로 설정)
    this.singleInitialCardCount = 6;

    const singleGameData = {
      roomId: "SINGLE",
      maxPlayers: 4,
      isSingle: true,
      hostId: myId, // 내가 방장
      aiDifficulty: aiDifficulty || "normal",
      gameMode: "allin",
      timeAttackEndsAt: null,

      // 나를 항상 0번 인덱스에 배치
      players: [
        {
          id: myId,
          nickname: myNickname,
          cards: 6,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
        {
          id: "AI_1",
          nickname: "초보 요리사",
          cards: 6,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
        {
          id: "AI_2",
          nickname: "중급 요리사",
          cards: 6,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
        {
          id: "AI_3",
          nickname: "천재 요리사",
          cards: 6,
          isReady: true,
          openCard: null,
          openCardStack: [],
        },
      ],
      // ... 나머지 recipes 로직
    };

    // If the lobby was entered from the tutorial completion flow, mark
    // the upcoming single game as tutorial-origin so reward conditions can apply.
    try {
      const pendingPremiumBearReward =
        localStorage.getItem("pendingPremiumBearReward") === "true";

      if (this.autoStartSingleAfterTutorial || pendingPremiumBearReward) {
        // Tutorial-origin single should be eligible for the premium-bear win reward.
        singleGameData.fromTutorial = true;
      }

      if (this.autoStartSingleAfterTutorial) {
        singleGameData.isTutorialMode = true;
        this.autoStartSingleAfterTutorial = false;
      }

      // If we use the pending reward tuple, we don't want this to repeat.
      if (pendingPremiumBearReward) {
        try {
          localStorage.removeItem("pendingPremiumBearReward");
        } catch (e) {
          console.warn("remove pendingPremiumBearReward failed", e);
        }
      }
    } catch (e) {
      console.warn("startSingleGame tutorial reward init failed", e);
    }

    this.scene.start("GameScene", singleGameData);
  }

  startTutorialGame() {
    // If socket isn't ready yet (e.g. on a fresh reload), defer tutorial start.
    if (!socket || !socket.connected) {
      this.time.delayedCall(200, () => {
        if (!this.hasCompletedTutorial) {
          this.startTutorialGame();
        }
      });
      return;
    }

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
    // overlay.on("pointerdown", () => {
    //   this.closeSingleDifficultyPopup();
    // });

    const popupBg = this.add
      .image(centerX, popupY, "invitebg")
      .setDisplaySize(width * 0.7, height * 0.5);

    const titleText = this.add
      .text(centerX, popupY - height * 0.26, "싱글플레이", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.max(24, width * 0.1)}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(4002);

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

    const popupObjects = [overlay, popupBg, titleText, closeBtn];

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

      // if we're currently sitting in a room, update our local player record
      // and re-render the waiting screen so the lobby avatar reflects the change.
      // Avoid forcing room UI when no room is open (e.g., main menu character change).
      const isInRoom =
        this.isRoomOpen ||
        Boolean(this.currentRoomId) ||
        Number.isFinite(this.currentRoomNumber) ||
        (Array.isArray(this.currentPlayers) && this.currentPlayers.length > 0);

      if (Array.isArray(this.currentPlayers)) {
        const me = this.currentPlayers.find((p) => p.id === socket.id);
        if (me) {
          me.avatarKey = avatarKey;
          me.currentCharacter = avatarKey;
        }
      }
      if (this.scene.isActive("LobbyScene") && isInRoom) {
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
    this.isShopOpen = true;
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
        price: 220,
      },
      {
        id: 5,
        key: "shield",
        icon: "shield",
        name: "방패",
        description: "공격을 막아서 카드를 지켜요",
        price: 210,
      },
      {
        id: 6,
        key: "ink",
        icon: "block",
        name: "먹물",
        description: "상대방 카드에 먹물을 뿌려요",
        price: 200,
      },
      {
        id: 7,
        key: "thief",
        icon: "thief",
        name: "도둑",
        description: "모두에게서 카드 3장씩 뺏어와요",
        price: 260,
      },
      {
        id: 8,
        key: "king",
        icon: "king",
        name: "왕",
        description: "특수한 보너스 효과를 부여합니다",
        price: 320,
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
        price: 260,
      },
      {
        key: "player_3",
        name: "댄서 곰돌이",
        description: "경쾌한 댄스 무브를 가진 캐릭터",
        price: 420,
      },
      {
        key: "player_4",
        name: "관리 곰돌이",
        description: "전용 스프라이트 애니메이션으로 움직이는 캐릭터",
        price: 560,
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
          if (typeof key === "string" && /^(player_[1-4]|premium_bear)$/.test(key)) {
            normalized[key] = true;
          }
        });
      } else if (rawValue && typeof rawValue === "object") {
        Object.entries(rawValue).forEach(([key, value]) => {
          if (typeof key === "string" && /^(player_[1-4]|premium_bear)$/.test(key)) {
            normalized[key] = !!value;
          }
        });
      }

      normalized.player_1 = true;
      return normalized;
    };

    const getOwnedCharacters = () => {
      const owned = {};

      // 1) 서버 프로필에서 소유 캐릭터 가져오기
      if (this.myProfile && Array.isArray(this.myProfile.owned_characters)) {
        this.myProfile.owned_characters.forEach((key) => {
          if (typeof key === "string" && /^(player_[1-4])$/.test(key)) {
            owned[key] = true;
          }
        });
      }

      // 2) 로컬 저장소에서 획득한 캐릭터도 보장
      try {
        const stored = JSON.parse(localStorage.getItem("ownedCharacters") || "[]");
        if (Array.isArray(stored)) {
          stored.forEach((key) => {
            if (typeof key === "string" && /^(player_[1-4])$/.test(key)) {
              owned[key] = true;
            }
          });
        }
      } catch (e) {
        // ignore malformed storage
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

      // Persist to local storage so reward-based unlocks are preserved even
      // if the server profile doesn't yet include them.
      try {
        localStorage.setItem("ownedCharacters", JSON.stringify(ownedList));
      } catch (e) {
        // ignore
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
        const safeAvetime = Number(this.myProfile.avetime);
        if (Number.isFinite(safeAvetime)) {
          payload.avetime = safeAvetime;
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
        const isExperienceGain =
          typeof reason === "string" && reason.indexOf("experience") >= 0;

        const safeLevel = Number(this.myProfile.level);
        if (
          Number.isFinite(safeLevel) &&
          (typeof payload.level === "undefined" || !isExperienceGain)
        ) {
          payload.level = safeLevel;
        }

        const safeExperience = Number(this.myProfile.experience);
        if (
          Number.isFinite(safeExperience) &&
          (typeof payload.experience === "undefined" || !isExperienceGain)
        ) {
          payload.experience = safeExperience;
        }
      }

      // Avoid sending accuracy ratio over the network; use localStorage-based ratio.
      // const safeRatio = Number(this.myProfile.ratio);
      // if (Number.isFinite(safeRatio)) {
      //   payload.ratio = safeRatio;
      // }

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
    // overlay click no longer closes the shop; user must use close button
    // overlay.on("pointerdown", () => {
    //   this.closeShopPopup();
    // });

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
      { key: "character", label: "캐릭터" },
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

          // ensure frame sequence is generated for players with the sprite sheet
          if (key === "player_1" || key === "player_2" || key === "player_3" || key === "player_4") {
            ensurePlayerFrames(this, "player_1_sprite", "player_1");
            ensurePlayerFrames(this, "player_2_sprite", "player_2");
            ensurePlayerFrames(this, "player_3_sprite", "player_3");
            ensurePlayerFrames(this, "player_4_sprite", "player_4");
          }

          let avatarTexture = null;
          if (this.textures.exists(`${key}_1`)) {
            avatarTexture = `${key}_1`;
          } else if (this.textures.exists(`${key}`)) {
            avatarTexture = `${key}`;
          } else if (this.textures.exists(`${key}_frame_1`)) {
            avatarTexture = `${key}_frame_1`;
          } else if (this.textures.exists(`${key}_sprite`)) {
            avatarTexture = `${key}_sprite`;
          } else if (this.textures.exists("player_1_frame_1")) {
            avatarTexture = "player_1_frame_1";
          }

          avatarSprite = this.add
            .sprite(0, height * 0.0, avatarTexture)
            .setDisplaySize(width * 0.3, width * 0.3);

          const animKey = this.ensureAvatarAnimation(character.key);
          if (!animKey && (character.key === "player_3" || character.key === "player_4")) {
            console.debug(`${character.key} animation key not found`, {
              frame1: this.textures.exists(`${character.key}_frame_1`),
              frame2: this.textures.exists(`${character.key}_frame_2`),
              sprite: this.textures.exists(`${character.key}_sprite`),
            });
          }
          if (avatarSprite && animKey && avatarSprite.anims) {
            try {
              avatarSprite.play(animKey, true);
            } catch (err) {
              console.warn("shop avatar animation play failed", err);
            }
          } else {
            this.applyAvatarAnimation(avatarSprite, character.key);
          }
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
        const currentCoins = Number(this.myProfile.coins) || 0;
        const price = Number(card.price) || 0;

        // Keep inventory state in sync with localStorage
        const specialCardsOwned =
          JSON.parse(localStorage.getItem("specialCards") || "{}") || {};

        if (currentCoins >= price) {
          if (!this.isSingle && socket && socket.connected) {
            // Multiplayer: don't apply authoritative modifyCoins immediately to avoid double-deduction.
            this.startPendingCoinDeduction(price);
          } else {
            // Single-player: apply immediately and sync as before.
            this.modifyCoins(Number(0 - price) || -price, { sync: true });
          }

          // Quest counter update should never block the purchase flow.
          try {
            if (typeof this.incrementMultiQuestCounter === "function") {
              this.incrementMultiQuestCounter("shop_buy", 1);
            }
          } catch (e) {
            console.warn("incrementMultiQuestCounter failed", e);
          }

          if (!specialCardsOwned[card.id]) {
            specialCardsOwned[card.id] = 0;
          }
          specialCardsOwned[card.id] += 1;
          try {
            localStorage.setItem(
              "specialCards",
              JSON.stringify(specialCardsOwned),
            );
          } catch (e) {
            console.warn("localStorage specialCards write failed", e);
          }

          // UI updated by modifyCoins

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
          // 멀티플레이에서 가격 처리 중 중복 차감 방지: 안전한 낙관적 차감 시작
          const price = Number(character.price) || 0;
          this.startPendingCoinDeduction(price);

          // Optimistically mark as owned/equipped for immediate UI feedback.
          ownedCharacters[character.key] = true;
          saveOwnedCharacters(ownedCharacters);
          this.equipCharacter(character.key);
          renderShopContent();
          return;
        } else {
          // 싱글플레이어 모드에서만 로컬 처리
          this.myProfile.coins -= character.price;
          if (!(this.isGameEnded && !this.isSingle)) {
            this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
          }

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

      // Debug: log what's being saved for easier troubleshooting

      // Debug: log when multi_win changes (uses localStorage content)
      if (payload.multi_win) {

      }
    } catch (e) {
      console.warn("failed to save multi quest progress", e);
    }
  }

  incrementMultiQuestCounter(key, amount = 1) {
    try {

      // If the helper methods are missing for any reason (bundling differences),
      // fall back to the safe localStorage path.
      if (typeof this.buildQuestPopupSnapshot !== "function" || typeof this.saveMultiQuestProgressSnapshot !== "function") {

        return this.incrementMultiQuestCounterFallback(key, amount);
      }

      const snapshot = this.buildQuestPopupSnapshot();
      if (!snapshot) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {

        return;
      }
      const quest = MULTI_QUEST_CONFIGS.find((q) => q.key === key);
      if (!quest) {
        return;
      }

      const entry = snapshot[key];
      if (entry.ready) {
        return;
      }

      const runtime = buildQuestRuntime(quest, entry);
      const newCount = Math.min(runtime.target, (entry.count || 0) + (Number(amount) || 0));
      entry.count = newCount;


      if (newCount >= runtime.target) {
        entry.ready = true;
      }

      snapshot[key] = entry;
      this.saveMultiQuestProgressSnapshot(snapshot);

      // Keep UI in sync if the quest popup is open
      if (this.questState && this.questState.progress && this.questState.progress[key]) {
        this.questState.progress[key] = entry;
        if (typeof this.refreshQuestRow === "function") {
          this.refreshQuestRow(key);
        }
      }

      // Immediately update the badge state in case a new reward became available
      if (typeof this.updateQuestBadgeState === "function") {
        this.updateQuestBadgeState();
      }

      // If the quest became ready, show notification
      if (entry.ready) {
        this.showToast(`${runtime.title} 완료! 보상을 받으세요.`, "#22c55e");
      }
    } catch (e) {
      console.warn("incrementMultiQuestCounter failed", e);
    }
  }

  incrementMultiQuestCounterFallback(key, amount = 1) {
    try {

      const raw = localStorage.getItem(MULTI_QUEST_PROGRESS_STORAGE_KEY) || "{}";
      const stored = JSON.parse(raw);
      const quest = MULTI_QUEST_CONFIGS.find((q) => q.key === key);
      if (!quest) {
        return;
      }

      const entry = stored[key] || { count: 0, stage: 0, ready: false };
      if (entry.ready) {
        return;
      }

      const runtime = buildQuestRuntime(quest, entry);
      entry.count = Math.min(runtime.target, (entry.count || 0) + (Number(amount) || 0));
      if (entry.count >= runtime.target) {
        entry.ready = true;
      }

      stored[key] = entry;
      localStorage.setItem(MULTI_QUEST_PROGRESS_STORAGE_KEY, JSON.stringify(stored));

      if (typeof this.updateQuestBadgeState === "function") {
        this.updateQuestBadgeState();
      }
    } catch (e) {
      console.warn("incrementMultiQuestCounterFallback failed", e);
    }
  }

  showQuestPopup() {
    this.isJoinPopupOpen = true;
    this.setLobbyChatInputHidden(true);

    // Make sure burst helper exists before any claim UI can use it.
    if (typeof this.ensureQuestCoinBurst === "function") {
      this.ensureQuestCoinBurst();
    }

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
    // do not close quest popup when clicking outside; use close button instead
    // overlay.on("pointerdown", () => {
    //   this.closeQuestPopup();
    // });

    const panelW = width * 0.86;
    const panelH = height * 0.7;

    // background image like public rooms popup
    const popupBg = this.add
      .image(centerX, centerY, "invitebg")
      .setDisplaySize(panelW, panelH);

    const titleText = this.add
      .text(centerX, centerY - panelH * 0.5, "퀘스트", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.max(24, width * 0.1)}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(4002);

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

    this.questPopupContainer.add([overlay, popupBg, titleText]);

    const snapshot = this.buildQuestPopupSnapshot();
    const rowHeight = Math.max(height * 0.055, 40);
    // more vertical breathing room between quest rows
    const rowGap = Math.max(height * 0.023, 12);
    const listStartY = centerY - panelH * 0.28;
    const rowWidth = panelW * 0.86;
    const barHeight = Math.max(6, rowHeight * 0.2);

    MULTI_QUEST_CONFIGS.forEach((quest, index) => {
      const entry = snapshot[quest.key] || { count: 0, stage: 0, ready: false };
      const runtime = buildQuestRuntime(quest, entry);
      const rowY = listStartY + index * (rowHeight + rowGap);

      // use the same room background used by other popups for visual consistency
      let rowBg;
      if (this.textures.exists("roombg")) {
        rowBg = this.add
          .image(centerX, rowY, "roombg")
          // shrink width a bit and increase height for padding
          .setDisplaySize(rowWidth * 0.92, rowHeight * 1.3);
      } else {
        rowBg = this.add
          .rectangle(centerX, rowY, rowWidth, rowHeight, 0x1f2937, 0.85)
          .setStrokeStyle(1, 0x475569, 0.7);
      }

      const rowText = this.add
        .text(centerX - rowWidth * 0.38, rowY - rowHeight * 0.12, "", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`, // even smaller for extra padding
          color: "#e2e8f0",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5);
      rowText.setText(runtime.title);

      const barX = centerX - rowWidth * 0.38;
      const barY = rowY + rowHeight * 0.22;
      const barW = rowWidth * 0.62;
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

      const claimX = centerX + rowWidth * 0.33;
      const claimY = rowY;
      const claimW = rowHeight * 1.0;
      const claimH = rowHeight * 0.55;

      let claimBg;
      if (this.textures.exists("ui_btn")) {
        claimBg = this.add
          .image(claimX, claimY, "ui_btn")
          .setDisplaySize(claimW * 1.05, claimH * 1.3)
          .setTint(entry.ready ? 0x22c55e : 0x3b3f51)
          .setAlpha(entry.ready ? 0.95 : 0.65);
      } else {
        claimBg = this.add
          .rectangle(
            claimX,
            claimY,
            claimW * 1.05,
            claimH * 1.3,
            entry.ready ? 0x22c55e : 0x3b3f51,
            entry.ready ? 0.95 : 0.65,
          )
          .setStrokeStyle(2, 0x15803d, 0.9);
      }
      const rewardLabel =
        typeof quest.rewardCoins === "number" && quest.rewardCoins > 0
          ? `💰${quest.rewardCoins}`
          : "받기";
      const claimText = this.add
        .text(claimX, claimY, rewardLabel, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.032}px`,
          color: entry.ready ? "#f8fafc" : "#94a3b8",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      if (entry.ready) {
        console.log("ready");

        const handleClaim = () => {
          console.debug("[claimBtn] clicked", { questKey: quest.key, ready: entry.ready, rewardCoins: quest.rewardCoins });
          this.sound.play("btn", { volume: 0.08 });
          if (!entry.ready) {
            this.showToast("아직 수령할 보상이 없어요!", "#f97316");
            return;
          }
          if (quest.rewardCoins) {
            // play sound + burst animation from button location
            try {
              this.sound.play("pop", { volume: 0.3 });
            } catch (e) {}

            if (typeof this.ensureQuestCoinBurst === "function") {
              this.ensureQuestCoinBurst();
            }

            if (typeof this.playQuestCoinBurst === "function") {
              this.playQuestCoinBurst(claimX, claimY, quest.rewardCoins);
            }

            if (typeof this.rewardQuestCoins === "function") {
              this.rewardQuestCoins(quest.rewardCoins, runtime.title, quest.key);
            } else {
              // Fallback: some builds may lose method binding, so apply reward manually.
              const amount = Number(quest.rewardCoins) || 0;
              if (amount > 0) {
                if (typeof this.modifyCoins === "function") {
                  this.modifyCoins(Number(amount), { sync: true });
                } else {
                  // Defensive fallback for legacy LobbyScene.
                  this.myProfile = this.myProfile || {};
                  this.myProfile.coins = (Number(this.myProfile.coins) || 0) + amount;
                  if (typeof this.updateMyProfileUI === "function") {
                    this.updateMyProfileUI();
                  }
                  // Sync to server when modifyCoins is unavailable
                  try {
                    if (typeof this.emitInventory === "function") {
                      this.emitInventory("questReward", { 
                        amount: amount,
                        questKey: quest.key,
                        requireServerProfile: false 
                      });
                    }
                  } catch (e) {
                    console.warn("quest reward sync failed (fallback)", e);
                  }
                }
                if (!this.isSingle) {
                  this.showToast(`퀘스트 보상 ${amount}💰 (${runtime.title})`, "#22c55e");
                }
              }
            }
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

          // Update badge state immediately after claiming reward
          if (typeof this.updateQuestBadgeState === "function") {
            this.updateQuestBadgeState();
          }

          this.closeQuestPopup();
          this.showQuestPopup();
        };
        const claimAction = () => {
          console.debug("[claimButton] pressed", { questKey: quest.key, ready: entry.ready });
          if (entry.ready) {
            handleClaim();
          } else {
            this.showToast("아직 수령할 보상이 없어요!", "#f97316");
          }
        };

        claimBg
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", claimAction);
        claimText
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", claimAction);
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

    this.questPopupContainer.add([closeBtn]);
    this.currentJoinPopupCloseHandler = () => this.closeQuestPopup();

    // === 광고 및 인앱결제 초기화 ===
    // 광고 및 IAP 제품 준비
    if (typeof this.prepareRemoveAdsProduct === "function") {
      try {
        this.prepareRemoveAdsProduct();
      } catch (e) {
        console.warn("[LobbyScene.create] prepareRemoveAdsProduct failed", e);
      }
    }

    if (typeof this.prepareLobbyIntegratedAd === "function") {
      try {
        this.prepareLobbyIntegratedAd();
      } catch (e) {
        console.warn("[LobbyScene.create] prepareLobbyIntegratedAd failed", e);
      }
    }
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

      // 즉시 UI에 반영 (낙관적 업데이트)
      this.myProfile.coins = Number(this.myProfile.coins || 0) + Number(amount);
      if (this.shopCoinText) {
        this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
      }
      if (this.coinShopCurrentCoinText) {
        this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${this.myProfile.coins}`);
      }
      if (typeof this.updateMyProfileUI === "function") {
        this.updateMyProfileUI();
      }

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
    this.isShopOpen = !!this.shopPopupContainer;
  }

  closeShopPopup() {
    this.isJoinPopupOpen = false;
    this.isShopOpen = false;
    if (this.shopPopupContainer) {
      this.shopPopupContainer.destroy();
      this.shopPopupContainer = null;
    }
    this.currentShopPopupCloseHandler = null;
    this.setLobbyChatInputHidden(false);
  }

  showPublicRoomsPopup() {
    this.isJoinPopupOpen = true;

    // Ensure we always start with a fresh room list when opening the popup.
    if (typeof rooms !== "undefined") {
      rooms = [];
    }

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    // 로딩 표시
    this.showLoading("방 목록 로딩 중...");

    // 공개 방 목록 가져오기 (캐시 방지)
    fetch(`${SERVER_URL}/api/rooms`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((rooms) => {
        this.hideLoading(); // ✅ 방 목록 로드 완료 시 로딩창 닫기

        // 안전장치: 서버에서 방 생성 이벤트를 놓쳤을 때도 요청 가능
        socket.emit("requestPublicRooms");
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
            // 방 만들기 탭을 이미 보고 있을 때, 다시 누르면 방 생성 트리거
            if (tabName === "create" && currentTab === "create") {
              attemptCreateRoom();
              return;
            }

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

        // Create form state (persist across tab toggles)
        const createFormState = {
          roomName: "",
          isPublic: true,
          password: "",
          isItemMode: true,
          isTimeAttack: true,
        };

        const attemptCreateRoom = () => {
          const myNickname = localStorage.getItem("nickname") || "요리사";
          const roomName = createFormState.roomName.trim() || `${myNickname}의 방`;
          const password = createFormState.isPublic
            ? null
            : createFormState.password.trim();

          if (!createFormState.isPublic && (!password || password.length < 4)) {
            this.showToast("비밀번호 4자리를 입력해주세요!", "#e74c3c");
            return false;
          }

          this.currentItemMode = createFormState.isItemMode;
          this.showLoading("방 생성 중...");
          socket.emit("createRoom", {
            nickname: myNickname,
            avatarKey: this.getSelectedAvatarKey(),
            maxPlayers: 4,
            isPublic: createFormState.isPublic,
            itemMode: createFormState.isItemMode,
            gameMode: createFormState.isTimeAttack ? "timeattack" : "allin",
            roomName,
            password,
          });
          closePopupWithCleanup();
          return true;
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
          const roomNameInputY = contentY * -0.3; // 내려서 간격 확보
          const passwordInputY = contentY * -0.16; // 입력칸도 아래
          const publicToggleY = height * 0.01; // 올라감
          const itemToggleY = height * 0.065; // 아래 토글도 위로
          const modeToggleY = itemToggleY; // same row
          const createBtnY = height * 0.155;

          // 방 이름 입력창 (DOM 절대 좌표)
          const roomNameInput = this.add
            .dom(centerX * -0.32, roomNameInputY, "input")
            .setDepth(1102);
          const nameEl = roomNameInput.node;
          nameEl.placeholder = "방 이름 입력 (선택, 최대10자)";
          nameEl.value = createFormState.roomName;
          Object.assign(nameEl.style, {
            width: `${width * 0.45}px`,
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
            createFormState.roomName = nameEl.value;
          });

          // 공개/비공개 각각 버튼
          let isPublic = createFormState.isPublic;
          let isItemMode = createFormState.isItemMode;
          let isTimeAttack = createFormState.isTimeAttack;
          const btnGapX = width * 0.12; // 간격 줄임

          const publicBtnImg = this.add
            .image(-btnGapX, publicToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x3498db)
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
            .setTint(0x7f8c8d)
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
            .dom(centerX * -0.32, passwordInputY, "input")
            .setDepth(1102);
          const pwEl = pwInput.node;
          pwEl.placeholder = "비밀번호 (숫자 4자리)";
          pwEl.type = "password";
          pwEl.value = createFormState.password;
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
            display: "none",
          });
          pwEl.addEventListener("input", () => {
            pwEl.value = pwEl.value.replace(/[^0-9]/g, "").substring(0, 4);
            createFormState.password = pwEl.value;
          });

          pwInput.setVisible(false);
          const updateToggle = (pub) => {
            isPublic = pub;
            createFormState.isPublic = pub;
            publicBtnImg.setTint(pub ? 0x3498db : 0x7f8c8d);
            privateBtnImg.setTint(pub ? 0x7f8c8d : 0xe67e22);
            pwEl.style.display = pub ? "none" : "block";
            pwInput.setVisible(!pub);
            if (pub) {
              pwEl.value = "";
              createFormState.password = "";
            }
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

          // 아이템전 토글 단일 버튼 (왼쪽)
          const itemToggleImg = this.add
            .image(-btnGapX, itemToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(isItemMode ? 0x2ecc71 : 0x7f8c8d)
            .setInteractive({ useHandCursor: true });
          const itemToggleText = this.add
            .text(
              -btnGapX,
              itemToggleY,
              isItemMode ? "🎯 아이템전" : "🚫 노템전",
              {
                fontFamily: "Jua",
                fontSize: `${width * 0.03}px`,
                color: "#ffffff",
                fontWeight: "bold",
              },
            )
            .setOrigin(0.5);

          const updateItemToggle = () => {
            createFormState.isItemMode = isItemMode;
            itemToggleImg.setTint(isItemMode ? 0x2ecc71 : 0x7f8c8d);
            itemToggleText.setText(isItemMode ? "🎯 아이템전" : "🚫 노템전");
          };

          itemToggleImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            isItemMode = !isItemMode;
            updateItemToggle();
            if (isItemMode) {
              this.showToast("게임에서 아이템을 사용할 수 있습니다", "#2ecc71");
            } else {
              this.showToast("게임에서 아이템을 사용할 수 없습니다", "#e74c3c");
            }
          });
          itemToggleText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            isItemMode = !isItemMode;
            updateItemToggle();
            if (isItemMode) {
              this.showToast("게임에서 아이템을 사용할 수 있습니다", "#2ecc71");
            } else {
              this.showToast("게임에서 아이템을 사용할 수 없습니다", "#e74c3c");
            }
          });

          // 게임 모드 토글 단일 버튼 (오른쪽)
          const modeToggleImg = this.add
            .image(btnGapX, itemToggleY, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(isTimeAttack ? 0xf1c40f : 0x7f8c8d)
            .setInteractive({ useHandCursor: true });
          const modeToggleText = this.add
            .text(
              btnGapX,
              itemToggleY,
              isTimeAttack ? "⏱ 타임어택" : "💰 올인",
              {
                fontFamily: "Jua",
                fontSize: `${width * 0.03}px`,
                color: "#ffffff",
                fontWeight: "bold",
              },
            )
            .setOrigin(0.5);

          const updateModeToggle = () => {
            createFormState.isTimeAttack = isTimeAttack;
            modeToggleImg.setTint(isTimeAttack ? 0xf1c40f : 0x7f8c8d);
            modeToggleText.setText(isTimeAttack ? "⏱ 타임어택" : "💰 올인");
          };

          modeToggleImg.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            isTimeAttack = !isTimeAttack;
            updateModeToggle();
            if (isTimeAttack) {
              this.showToast("타임어택 모드가 선택되었습니다", "#f1c40f");
            } else {
              this.showToast("올인 모드가 선택되었습니다", "#f1c40f");
            }
          });
          modeToggleText.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.1 });
            isTimeAttack = !isTimeAttack;
            updateModeToggle();
            if (isTimeAttack) {
              this.showToast("타임어택 모드가 선택되었습니다", "#f1c40f");
            } else {
              this.showToast("올인 모드가 선택되었습니다", "#34495e");
            }
          });

          // 방 만들기 UI (버튼은 탭 클릭으로 대체)
          container.add([
            roomNameInput,
            publicBtnImg,
            publicBtnText,
            privateBtnImg,
            privateBtnText,
            itemToggleImg,
            itemToggleText,
            modeToggleImg,
            modeToggleText,
            pwInput,
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
          fetch(`${SERVER_URL}/api/rooms`, { cache: "no-store" })
            .then((res) => res.json())
            .then((freshRooms) => {
              console.log("[RoomList] refreshed rooms", freshRooms?.length);
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
            // 방 만들기 탭을 이미 보고 있을 때 다시 누르면 방 생성 시도
            if (tab.name === "create" && currentTab === "create") {
              attemptCreateRoom();
              return;
            }

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

    // 1. 메인 화면 UI 숨기기 (나중에 다시 보여줄 수 있도록 파괴하지 않음)
    if (this.mainUIContainer) {
      try {
        this.mainUIContainer.setVisible(false).setActive(false);
      } catch (e) {
        // in case the container was destroyed elsewhere
        this.mainUIContainer = null;
      }
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
        if (this._deferredAssetsLoading) {
          this.showToast(
            "추가 에셋 로딩 중입니다. 로딩이 완료될 때까지 기다려주세요.",
            "#f1c40f",
          );
          return;
        }

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
                try {
                  // If server accepted start but never emits `gameStart` back
                  // within a short window, fallback to starting the GameScene
                  // locally using the current lobby player list so UI doesn't
                  // remain blank.
                  const self = this;
                  setTimeout(() => {
                    const received = !!self._gameStartReceived;
                    if (!received) {
                      console.warn("startGameRequest ack received but no gameStart event; falling back to local start", { ackPayload });
                      const fallbackPlayers = (self.currentPlayers || []).map((p) => ({
                        id: p.id,
                        nickname: p.nickname || p.name || p.playerName || p.id,
                        cards: p.cards ?? p.remainingCards ?? (p.myDeck ? p.myDeck.length : 0),
                        myDeck: p.myDeck || [],
                      }));
                      const data = {
                        players: fallbackPlayers,
                        hostId: ackPayload.hostId || socket.id,
                        roomId: ackPayload.roomId || self.currentRoomNumber || null,
                        nextTurnId: ackPayload.nextTurnId || null,
                        itemMode: typeof ackPayload.itemMode === 'boolean' ? ackPayload.itemMode : self.currentItemMode,
                      };
                      try {
                        self.scene.start("GameScene", data);
                      } catch (e) {
                        console.warn("fallback scene.start failed", e);
                      }
                    }
                  }, 1200);
                } catch (e) {
                  console.warn("startGameRequest ack handler fallback failed", e);
                }
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
            console.log("emit: toggleReady", { myId: socket.id });
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

    const titleText = this.add
      .text(centerX, centerY * 0.23, "출석체크", {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4002);

    const msgText = this.add
      .text(centerX, centerY - 15, message, {
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
      [overlay, popupBg, titleText, msgText, okBtn, okTxt, closeBtn].forEach((el) => {
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

    // overlay does not dismiss on click (close button only)
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.7)
      .setDepth(4000)
      .setInteractive();

    // use the same background as quest popup
    const panelW = width * 0.86;
    const panelH = height * 0.7;
    const popupBg = this.add
      .image(centerX, centerY, "invitebg")
      .setDepth(4001)
      .setDisplaySize(panelW * 1.1, panelH * 0.6);

    const titleText = this.add
      .text(centerX, centerY - panelH * 0.32, "출석체크", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.max(54, width * 0.1)}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(4003);

    // close button like quest popup
    const closeBtn = this.add
      .image(centerX + panelW * 0.45, centerY - panelH * 0.25, "popupclose")
      .setDisplaySize(width * 0.1, width * 0.1)
      .setDepth(4002)
      .setInteractive({ useHandCursor: true });

    // Ensure weekly attendance state is loaded and any missed days are marked
    try {
      this.ensureWeeklyRewardState();
    } catch (e) {
      // ignore
    }
    this.claimedDailyDates = new Set(
      Object.entries(this.dailyRewardWeekState?.days || {})
        .filter(([, status]) => status === "claimed")
        .map(([date]) => date),
    );

    const kstNow = this.getKstNow();
    const todayStr = this.dailyRewardTodayDate || this.formatDateYmd(kstNow);
    const lastCheckin = this.dailyRewardLastCheckinDate;
    const dayLabels = [
      "월요일",
      "화요일",
      "수요일",
      "목요일",
      "금요일",
      "토요일",
      "일요일",
      "영상",
    ];

    const dayOfWeek = kstNow.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const weekStart = new Date(kstNow);
    weekStart.setDate(weekStart.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    if (!this.claimedDailyDates) this.claimedDailyDates = new Set();

    const rows = [];
    const rowGap = height * 0.07;
    const rowWidth = rowGap * 1.3; // enlarge panels
    const rowHeight = rowWidth * 0.8; // maintain aspect
    const cols = 4;
    const hGap = rowGap * 0.12; // horizontal space between columns
    const vGap = rowGap * 0.7; // increased vertical spacing
    const totalWidth = rowWidth * cols + (cols - 1) * hGap;
    const totalHeight = rowHeight * 2 + vGap;
    const startX = centerX - totalWidth / 2 + rowWidth / 2;
    const startY = centerY - totalHeight / 2 + rowHeight / 2;
    const gapX = hGap;
    const gapY = vGap;

    for (let i = 0; i < dayLabels.length; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rowX = startX + col * (rowWidth + gapX);
      const rowY = startY + row * (rowHeight + gapY);
      const isVideo = i === dayLabels.length - 1;

      let isToday = false;
      let isClaimed = false;
      let isMissed = false;
      let canClaim = false;
      let rowDateStr = null;
      if (!isVideo) {
        const rowDate = new Date(weekStart);
        rowDate.setDate(weekStart.getDate() + i);
        rowDateStr = this.formatDateYmd(rowDate);
        isToday = rowDateStr === todayStr;

        const status =
          (this.dailyRewardWeekState && this.dailyRewardWeekState.days)
            ? this.dailyRewardWeekState.days[rowDateStr]
            : null;
        isClaimed = status === "claimed";
        isMissed = status === "missed";

        canClaim = isToday && this.dailyRewardAvailable && !isClaimed;
      }

      let rowBg;
      if (this.textures.exists("playerbg")) {
        rowBg = this.add
          .image(rowX, rowY, "playerbg")
          .setDepth(4002)
          .setDisplaySize(rowWidth, rowHeight * 1.4);
      } else {
        rowBg = this.add
          .rectangle(rowX, rowY, rowWidth, rowHeight * 1.4, 0x0f172a, 0.7)
          .setDepth(4002)
          .setStrokeStyle(1, 0x475569, 0.7);
      }

      const isMissedGrey = !isClaimed && isMissed && !isVideo;
      const baseTextColor = isToday
        ? "#facc15"
        : isMissedGrey
        ? "#888888"
        : "#ffffff";

      const dayText = this.add
        .text(rowX, rowY - rowHeight * 0.35, dayLabels[i], {
          fontFamily:
            typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
          fontSize: `${width * 0.04}px`,
          color: baseTextColor,
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(4003);

      /*const amountText = this.add
        .text(
          rowX,
          rowY - rowHeight * 0.05,
          isVideo ? "" : `+${this.dailyRewardAmount}`,
          {
            fontFamily:
              typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
            fontSize: `${width * 0.036}px`,
            color: "#22c55e",
            fontWeight: "bold",
          },
        )
        .setOrigin(0.5)
        .setDepth(4003);*/

      // coin icon + number instead of text
      let coinImg = null;
      let coinNum = null;
      if (!isVideo) {
        coinImg = this.add
          .image(rowX, rowY + rowHeight * 0.1, "coin")
          .setDisplaySize(rowWidth * 0.5, rowWidth * 0.5)
          .setDepth(4003);
        coinNum = this.add
          .text(rowX, rowY + rowHeight * 0.45, `${this.dailyRewardAmount}`, {
            fontFamily:
              typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
            fontSize: `${width * 0.04}px`,
            color: isMissedGrey ? "#888888" : "#ffffff",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(4003);

        if (isMissedGrey) {
          coinImg.setTint(0x888888);
        }
      }
      // status labels: 획득 / 놓침
      let statusLabel = null;

      // already claimed
      if (isClaimed && !isVideo) {
        statusLabel = this.add
          .text(rowX, rowY, "획득", {
            fontFamily:
              typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
            fontSize: `${width * 0.055}px`,
            color: "#ffffff",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(4004)
          .setScale(0);
        statusLabel.setRotation(-0.3);

        this.tweens.add({
          targets: statusLabel,
          scale: 1,
          duration: 450,
          ease: "Back.out",
        });
      }

      // missed day (past days without claim)
      // (no longer display a '놓침' label; instead greys out the day icon/text)
      if (!isClaimed && isMissed && !isVideo) {
        // intentional no-op
      }

      if (canClaim || isVideo) {
        const scene = this;
        rowBg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
          if (isVideo) {
            scene.sound.play("btn", { volume: 0.1 });
            scene.showToast("광고 보상은 준비 중입니다!", "#38bdf8");
            return;
          }
          if (scene.isDailyRewardClaimPending) return;
          scene.sound.play("btn", { volume: 0.1 });
          scene.isDailyRewardClaimPending = true;
          if (typeof scene.updateDailyRewardButtonState === "function") {
            scene.updateDailyRewardButtonState();
          }
          showCoinBurstEffect(scene, rowX, rowY, scene.dailyRewardAmount);
          socket.emit("claimDailyReward");
          // immediately mark this day claimed and add stamp
          if (rowDateStr) {
            this.claimedDailyDates.add(rowDateStr);
            try {
              this.markDailyRewardClaimed(rowDateStr);
            } catch (e) {
              // ignore
            }
            const stamp = this.add
              .text(rowX, rowY, "획득", {
                fontFamily:
                  typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
                fontSize: `${width * 0.055}px`,
                color: "#ffffff",
                fontWeight: "bold",
                stroke: "#000000",
                strokeThickness: 4,
              })
              .setOrigin(0.5)
              .setDepth(4004)
              .setScale(0);
            stamp.setRotation(-0.3);
            this.tweens.add({
              targets: stamp,
              scale: 1,
              duration: 450,
              ease: "Back.out",
            });
            rows.push(stamp);
          }
        });
      }

      if (statusLabel) {
        if (coinImg) rows.push(rowBg, dayText, coinImg, coinNum, statusLabel);
        else rows.push(rowBg, dayText, statusLabel);
      } else {
        if (coinImg) rows.push(rowBg, dayText, coinImg, coinNum);
        else rows.push(rowBg, dayText);
      }
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
      [overlay, popupBg, titleText, closeBtn, helperText, ...rows].forEach((el) => {
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

    // overlay.on("pointerdown", () => {
    //   closePopup();
    // });

    closeBtn.on("pointerdown", () => {
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

    // Debug: show what users list looks like (helps find missing nickname problems)
    console.log("[Invite] showInvitePopup users:", users);

    this.setLobbyChatInputHidden(true);

    // 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.5)
      .setDepth(30000)
      .setInteractive();

    // 팝업 배경 (invitebg 이미지)
    const popupWidth = width * 0.85;
    const popupHeight = height * 0.55;
    const popupBg = this.add
      .image(centerX, centerY, "invitebg")
      .setDisplaySize(popupWidth, popupHeight)
      .setDepth(30001);

    // 타이틀
    const titleText = this.add
      .text(centerX, centerY - popupHeight / 2 + height * 0.05, "", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffd700",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30002);

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
    // overlay.on("pointerdown", () => {
    //   this.sound.play("btn", { volume: 0.1 });
    //   destroyPopup();
    // });

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

    // Ensure users is an array (defensive) and add safe defaults
    const safeUsers = Array.isArray(users) ? users : [];
    safeUsers.forEach((user, index) => {
      const safeUser = {
        id: user?.id || null,
        nickname: user?.nickname || user?.name || "알 수 없는 요리사",
        level: Number(user?.level) || 1,
        avatarKey: user?.avatarKey || "player_1",
      };

      const btnY =
        listContainerY - listH / 2 + (index + 1) * (listH / (safeUsers.length + 1));
      const userIconX = centerX - popupWidth * 0.31;
      // 아이콘 오른쪽에 여유를 두고 텍스트 배치
      const userTextX = userIconX + height * 0.045 / 2 + width * 0.03;
      const inviteBtnX = centerX + popupWidth * 0.26;

      // 유저 배경 (roombg 이미지)
      const userBg = this.add
        .image(centerX, btnY, "roombg")
        .setDisplaySize(popupWidth * 0.8, height * 0.083)
        .setDepth(30002)
        .setInteractive({ useHandCursor: true });

      // 유저 아이콘
      const baseUserAvatar = /^player_[1-4]$/.test(safeUser.avatarKey)
        ? safeUser.avatarKey
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
        .setDepth(30003);

      // 유저명 + 레벨 (한 줄)
      console.log("[Invite] rendering user", safeUser);
      const userInfo = this.add
        .text(userTextX, btnY, `Lv.${safeUser.level} ${safeUser.nickname}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.044}px`,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 4,
          fontWeight: "bold",
          shadow: {
            offsetX: 1,
            offsetY: 1,
            color: "#000000",
            blur: 2,
            stroke: true,
            fill: true,
          },
        })
        .setOrigin(0, 0.5)
        .setDepth(30004);

      // 초대 버튼 (uibtn 이미지)
      const inviteBtn = this.add
        .image(inviteBtnX, btnY, "uibtn")
        .setDisplaySize(width * 0.12, height * 0.05)
        .setTint(0x3498db)
        .setDepth(30005)
        .setInteractive({ useHandCursor: true });

      const inviteBtnText = this.add
        .text(inviteBtnX, btnY, "초대", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#fff",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(30006);

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
            socket.emit("inviteUser", { targetId: safeUser.id });
            this.showToast(`${safeUser.nickname}님을 초대했습니다!`, "#3498db");
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
      .setDepth(30002)
      .setInteractive({ useHandCursor: true });

    allObjects.push(closeBtn);

    closeBtn.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      destroyPopup();
    });
  }

  showInviteReceivePopup(inviteData) {
    this.isJoinPopupOpen = true;

    // If other popups are open (tutorial / daily reward / quest / shop), close them first.
    if (typeof this.currentTutorialCloseHandler === "function") {
      try {
        this.currentTutorialCloseHandler();
      } catch (e) {}
      this.currentTutorialCloseHandler = null;
    }
    if (typeof this.currentJoinPopupCloseHandler === "function") {
      try {
        this.currentJoinPopupCloseHandler();
      } catch (e) {}
      this.currentJoinPopupCloseHandler = null;
    }
    if (typeof this.currentShopPopupCloseHandler === "function") {
      try {
        this.currentShopPopupCloseHandler();
      } catch (e) {}
      this.currentShopPopupCloseHandler = null;
    }

    const { width, height, centerX, centerY } = this.cameras.main;

    this.setLobbyChatInputHidden(true);

    // 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.5)
      .setDepth(30000)
      .setInteractive();

    // 팝업 배경 (popupbg 이미지)

    // remove outside click closing for invite receive
    // overlay.setInteractive();
    // overlay.on("pointerdown", () => {
    //   this.sound.play("btn", { volume: 0.1 });
    //   destroyPopup();
    // });
    const popupWidth = width * 0.75;
    const popupHeight = height * 0.3;
    const popupBg = this.add
      .image(centerX, centerY, "profilebg")
      .setDisplaySize(popupWidth, popupHeight)
      .setDepth(30001);

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
      .setDepth(30002);

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
      .setDepth(30001)
      .setInteractive({ useHandCursor: true });

    const acceptBtnText = this.add
      .text(centerX - width * 0.15, centerY * 1.12, "수락", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#fff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30002);

    // 거절 버튼 (uibtn 이미지)
    const declineBtn = this.add
      .image(centerX + width * 0.15, centerY * 1.12, "uibtn")
      .setDisplaySize(width * 0.2, height * 0.06)
      .setTint(0xe74c3c)
      .setDepth(30001)
      .setInteractive({ useHandCursor: true });

    const declineBtnText = this.add
      .text(centerX + width * 0.15, centerY * 1.12, "거절", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#fff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30002);

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
    this._hasAwardExperienceRun = false; // 첫 공격 성과(1회) 이후부터 레벨업 토스트 허용

    // reaction time samples recorded during the current game
    this.reactionTimes = [];
    // Game-end state flag for avoiding late `bellResult` accuracy drift.
    this.isGameEnded = false;
    // Toggle optimistic (client-side) flip animations in multiplayer.
    // Set to false to make multiplayer use the same server-driven animation
    // flow as singleplayer.
    this.useOptimisticFlip = false;

    // correct/total bell press tracking for accuracy ratio
    // Seed from localStorage to avoid server-dependent multiplayer accuracy.
    const seedCorrect = Number(localStorage.getItem("bellCorrect")) || 0;
    const seedTotal = Number(localStorage.getItem("bellTotal")) || 0;
    this.bellStats = { correct: seedCorrect, total: seedTotal };

    // indicators for result overlay flow
    this.isResultOverlayActive = false;
    this._deferredMyProfile = null;
    this._isApplyingDeferredProfile = false;
    this._deferredCoinsDelta = 0;
    this._isApplyingDeferredCoins = false;
    this._allowCoinTextUpdateForNextUI = false;
    this._initialProfileApplied = false;
    // Flag set when the big "게임종료!" text is visible on screen
    this.isResultTextVisible = false;
  }

  applyDeferredProfileUpdates() {
    if (!this._deferredMyProfile) return;

    this._isApplyingDeferredProfile = true;
    try {
      // 🔴 [보안] 서버에서 받은 프로필을 절대적으로 신뢰
      const incoming = { ...this._deferredMyProfile };
      
      console.log('[result] applyDeferredProfileUpdates called', {
        serverCoins: incoming.coins,
        applyingServerCoins: true
      });
      
      this.updateMyProfileUI(incoming);
    } catch (e) {
      console.warn("applyDeferredProfileUpdates failed", e);
    }
    this._isApplyingDeferredProfile = false;
    this._deferredMyProfile = null;
  }

  // Centralized coin update helper: apply delta immediately or defer during result overlay
  modifyCoins(delta, options = {}) {
    try {
      console.log('[modifyCoins] called', { delta, options });
      const sync = !!options.sync;
      const force = !!options.force;
      const coinCardUpdate = !!options.coinCardUpdate;

      // If result overlay active or game has ended, defer applying coins unless forced.
      if ((this.isResultOverlayActive || this.isGameEnded) && !force) {
        this._deferredCoinsDelta = (this._deferredCoinsDelta || 0) + Number(delta || 0);
        console.debug('modifyCoins deferred', { delta, deferred: this._deferredCoinsDelta });
        return;
      }

      if (!this.myProfile) this.myProfile = {};
      const prev = Number(this.myProfile.coins) || 0;
      const next = prev + Number(delta || 0);
      this.myProfile.coins = next;
      console.log('[modifyCoins] applied', { prev, delta: Number(delta || 0), next });
      
      // 🔴 [보안] 코인은 로컬 저장소에 저장하지 않음 (서버에서만 관리)
      // 싱글플레이도 서버와 동기화되어야 함

      // Decide whether to update UI now.
      const isLiveMultiplayer =
        !this.isSingle && this.isGameStarted && !this.isResultOverlayActive && !this.isGameEnded;
      const skipUI = !!(this.isGameEnded && !this.isSingle && !force);
      const allowLiveUI = coinCardUpdate || force;

      if (isLiveMultiplayer && !allowLiveUI) {
        // During live multiplayer session, avoid showing coin update in top profile
        // until actual coin-card event triggers. Keep underlying value updated.
        console.debug('modifyCoins skipped live multiplayer coin UI update', { delta, iAmCoinCardUpdate: coinCardUpdate });
      } else if (!skipUI) {
        console.debug('modifyCoins updating profile UI', { delta, coinCardUpdate, isLiveMultiplayer, skipUI, force, thisCoin: this.myProfile?.coins });
        try {
          this._isApplyingDeferredProfile = true;
          if (typeof this.updateMyProfileUI === 'function') {
            this._allowCoinTextUpdateForNextUI = coinCardUpdate || this._allowCoinTextUpdateForNextUI;
            this.updateMyProfileUI();
            this._allowCoinTextUpdateForNextUI = false;
          }
        } catch (e) {
          console.warn('modifyCoins updateMyProfileUI failed', e);
        } finally {
          this._isApplyingDeferredProfile = false;
        }

        if (this.shopCoinText) {
          try { this.shopCoinText.setText(`💰 ${this.myProfile.coins}`); } catch (e) {}
        }
        if (this.coinShopCurrentCoinText) {
          try { this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${this.myProfile.coins}`); } catch (e) {}
        }
      } else {
        console.debug('modifyCoins skipped UI update because game ended (multiplayer)', { delta });
      }

      if (sync) {
        try {
          if (typeof this.emitInventory === 'function') {
            this.emitInventory('coinsChanged', { requireServerProfile: false });
          } else if (socket && socket.emit) {
            socket.emit('updatePlayerCoins', { coins: this.myProfile.coins });
          }
        } catch (e) {
          console.warn('modifyCoins sync failed', e);
        }
      }
    } catch (e) {
      console.warn('modifyCoins error', e);
    }
  }

  setCoinsAbsolute(total, options = {}) {
    const next = Number.isFinite(Number(total)) ? Number(total) : null;
    if (next === null) return;
    const prev = Number(this.myProfile?.coins) || 0;
    const delta = next - prev;
    
    if (delta !== 0) {
      console.log('💰 [setCoinsAbsolute] 절대값으로 코인 설정', {
        prev,
        next,
        delta,
        sync: options?.sync
      });
    }
    
    this.modifyCoins(delta, options);
  }

  applyDeferredCoins() {
    if (!this._deferredCoinsDelta || this._deferredCoinsDelta === 0) return;
    if (this._isApplyingDeferredCoins) return;
    this._isApplyingDeferredCoins = true;
    try {
      const delta = this._deferredCoinsDelta || 0;
      this._deferredCoinsDelta = 0;
      // force apply even if overlay state somehow still true
      this.modifyCoins(delta, { sync: true, force: true });
    } catch (e) {
      console.warn('applyDeferredCoins failed', e);
    }
    this._isApplyingDeferredCoins = false;
  }

  // replicate lobby's profile updater so GameScene has its own
  updateMyProfileUI(profile = {}) {
    try {
      // identical logic to LobbyScene version; keeps game UI in sync
      const prev = this.myProfile || {};
      const prevRatioVal = Number(prev.ratio);

      const localCorrect = Number(localStorage.getItem("bellCorrect")) || 0;
      const localTotal = Number(localStorage.getItem("bellTotal")) || 0;
      const localRatio = localTotal > 0 ? Math.round((localCorrect / localTotal) * 100) : null;

      const initialRatio =
        localRatio !== null
          ? localRatio
          : Number.isFinite(prevRatioVal) && prevRatioVal >= 0
          ? prevRatioVal
          : 0;

      const prevLevel = Number(prev.level) || 1;
      const hasIncomingStats =
        typeof profile.level !== "undefined" ||
        typeof profile.coins !== "undefined" ||
        typeof profile.experience !== "undefined";

      const normalizeCharacterKey = (value) =>
        typeof value === "string" && /^(player_[1-4]|premium_bear)$/.test(value)
          ? value
          : null;

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

      // Decide coin value carefully: for single-player prefer locally-persisted
      // coin value if it's larger than the server snapshot to avoid losing
      // freshly-awarded single-player rewards that may not be synced immediately.
      let incomingCoins = Number.isFinite(Number(profile.coins))
        ? Number(profile.coins)
        : Number(prev.coins) || 0;

      try {
        const stored = Number(localStorage.getItem("profileCoins")) || 0;
        incomingCoins = Math.max(incomingCoins, stored, Number(prev.coins) || 0);
      } catch (e) {
        console.warn("[updateMyProfileUI] failed to read profileCoins from localStorage", e);
      }

      // 🔴 [중요] 멀티플레이 결과 화면 중 코인 업데이트
      // 이미 applyDeferredProfileUpdates에서 대비했으므로, 여기서는 로컬 값 우선
      const shouldHoldCoinUi =
        !this.isSingle && (this.isGameEnded || this.isResultOverlayActive) && !this._isApplyingDeferredProfile;
      if (shouldHoldCoinUi && !this._isApplyingDeferredProfile) {
        // applyDeferredProfileUpdates에서 처리 중 아니면 현재 값 유지
        incomingCoins = Number(prev.coins) || 0;
        console.debug('[ui] 결과 화면 중 코인 UI 유지 (applyDeferredProfileUpdates 대기)', { incomingCoins });
      } else if (this._isApplyingDeferredProfile) {
        // applyDeferredProfileUpdates에서 호출 중이면 로컬 값 우선
        const localCurrentCoins = Number(this.myProfile?.coins) || 0;
        incomingCoins = Math.max(incomingCoins, localCurrentCoins);
        console.log('[ui] applyDeferredProfileUpdates 처리 중 - 로컬 코인 우선', { incomingCoins, localCurrentCoins });
      }

      console.log('[result] updateMyProfileUI coin merge', {
        profileCoins: Number(profile.coins),
        prevCoins: Number(prev.coins),
        localCoins: Number(localStorage.getItem("profileCoins")) || 0,
        incomingCoins,
        isApplyingDeferred: this._isApplyingDeferredProfile,
      });

      this.myProfile = {
        ...prev,
        ...profile,
        nickname:
          profile.nickname ||
          prev.nickname ||
          localStorage.getItem("nickname") ||
          "요리사",
        level: Number(profile.level ?? prev.level ?? 1) || 1,
        coins: Number.isFinite(incomingCoins) ? incomingCoins : 0,
        experience: Number(profile.experience ?? prev.experience ?? 0) || 0,
        ratio: initialRatio,
        owned_characters: normalizedOwnedCharacters,
        current_character: normalizedCurrentCharacter,
        avatarKey: normalizedAvatarKey,
      };

      if (
        hasIncomingStats &&
        this.hasReceivedProfileStats &&
        this.myProfile.level > prevLevel
      ) {
        // 서버 동기화 레벨 증가는 로컬 경험치 반영 후에만 알림
        console.debug(
          `[level sync] Lv.${prevLevel} → Lv.${this.myProfile.level} (toast suppressed)`,
        );
      }
      if (hasIncomingStats) {
        this.hasReceivedProfileStats = true;
      }

      // seed reaction sample from server snapshot if we don't have any local data yet
      // only use it when the value is a positive number (0 means "no data").
      // In singleplayer we don't track average reaction time.
      if (
        !this.isSingle &&
        typeof this.myProfile.avetime === 'number' &&
        this.myProfile.avetime > 0 &&
        (!Array.isArray(this.reactionTimes) || this.reactionTimes.length === 0)
      ) {
        this.reactionTimes = [this.myProfile.avetime];
      }

      // update any game-screen text refs (wrapped safely to prevent crashes if the text object has been destroyed)
      const safeSetText = (txtObj, value) => {
        try {
          // Some Phaser text objects can become invalid/destroyed during scene
          // transitions. Guard against that to avoid noisy console warnings.
          if (
            txtObj &&
            !txtObj.destroyed &&
            txtObj.active &&
            typeof txtObj.setText === "function"
          ) {
            txtObj.setText(value);
          }
        } catch (e) {
          // ignore phantom errors when the object is partially destroyed
        }
      };

      safeSetText(this.profileNameTxt, this.myProfile.nickname || "");
      safeSetText(
        this.profileLevelTxt,
        `Lv ${this.myProfile.level} ${this.myProfile.nickname || ""}`,
      );
      const isLiveMultiplayer =
        !this.isSingle && this.isGameStarted && !this.isResultOverlayActive && !this.isGameEnded;
      const isFirstUpdate = !this._initialProfileApplied;
      if (isFirstUpdate) {
        this._initialProfileApplied = true;
      }
      const shouldShowProfileCoinText =
        (this.isSingle || !isLiveMultiplayer || isFirstUpdate) &&
        !(this.isResultOverlayActive || this.isGameEnded);
      const shouldShowLiveCoinText = isLiveMultiplayer && this._allowCoinTextUpdateForNextUI;

      if (shouldShowProfileCoinText || shouldShowLiveCoinText) {
        console.log('[profile UI] 업데이트 보유코인 텍스트', {
          isSingle: this.isSingle,
          isLiveMultiplayer,
          isResultOverlayActive: this.isResultOverlayActive,
          isGameEnded: this.isGameEnded,
          allowCoinText: this._allowCoinTextUpdateForNextUI,
          coins: this.myProfile.coins,
        });
        safeSetText(this.profileCoinsTxt, `Coins: ${this.myProfile.coins}`);
      } else {
        console.log('[profile UI] 보유코인 텍스트 갱신 생략', {
          isSingle: this.isSingle,
          isLiveMultiplayer,
          isResultOverlayActive: this.isResultOverlayActive,
          isGameEnded: this.isGameEnded,
          allowCoinText: this._allowCoinTextUpdateForNextUI,
          coins: this.myProfile.coins,
        });
      }

      this.setProfileCoinLabel(`보유코인: ${this.myProfile.coins}`);
      this._allowCoinTextUpdateForNextUI = false;

      // make sure the react-time display stays in sync as well
      safeSetText(
        this.profileReactTxt,
        `반응속도: ${this.computeAvgReaction().toFixed(2)}s`,
      );

      if (
        this.profileRatioTxt &&
        this.profileRatioTxt.active &&
        !this.profileRatioTxt.destroyed &&
        typeof this.profileRatioTxt.setText === "function"
      ) {
        const prevRatioVal = Number(prev.ratio) || 0;
        const ratioVal = Number(this.myProfile.ratio) || 0;
        const oldText = this.profileRatioTxt.text;
        const newText = `정답률: ${ratioVal}%`;
        if (oldText !== newText) {
          safeSetText(this.profileRatioTxt, newText);

          // 색상 변경: 상승=빨 red, 하락=파 blue, 유지=white
          let color = "#ffffff";
          if (ratioVal > prevRatioVal) {
            color = "#ff4d4d";
          } else if (ratioVal < prevRatioVal) {
            color = "#4da6ff";
          }
          try {
            if (color !== "#ffffff") {
              try {
                this.profileRatioTxt.setColor(color);
              } catch (e) {
                // ignore if text object is invalid/destroyed
              }
              this._ratioColorTimeout = setTimeout(() => {
                try {
                  if (
                    this.profileRatioTxt &&
                    typeof this.profileRatioTxt.setColor === "function"
                  ) {
                    this.profileRatioTxt.setColor("#ffffff");
                  }
                } catch (e) {
                  // ignore errors when object is gone
                }
                this._ratioColorTimeout = null;
              }, 550);
            }
          } catch (e) {
            // ignore
          }

          // Animate to highlight the change
          try {
            this.tweens.add({
              targets: this.profileRatioTxt,
              scaleX: 1.15,
              scaleY: 1.15,
              duration: 140,
              yoyo: true,
              ease: "Sine.easeOut",
            });
          } catch (e) {
            // ignore if tween not available
          }
        }
      }

      // combine with lobby-style text if present (rare inside GameScene but safe)
    } catch (e) {
      console.warn("[updateMyProfileUI] exception swallowed", e);
    }
    if (this.profileIdText) {
      this.profileIdText.setText(`LV.${this.myProfile.level} ${this.myProfile.nickname}`);
    }
    this.setProfileCoinShort(`X ${this.myProfile.coins}`);

    // experience bar update (if game scene uses it)
    if (this.profileExpBarFill && this.profileExpText) {
      const currentExp = this.myProfile.experience % XP_PER_LEVEL;
      const expRatio = currentExp / XP_PER_LEVEL;

      const layout = this.profileExpBarLayout;
      let x = 0;
      let y = 0;
      let width = 0;
      let height = 0;

      if (layout && typeof layout === "object") {
        x = layout.x;
        y = layout.y;
        width = layout.width;
        height = layout.height;
      } else {
        const { width: screenW } = this.cameras.main;
        const profileSize = screenW * 0.2;
        width = profileSize * 0.9;
        height = screenW * 0.032;
        y = profileSize * 1.18 - height / 2;
        x = profileSize * 0.4 - width / 2;
      }

      this.profileExpBarFill.clear();
      this.profileExpBarFill.fillStyle(0x2ecc71, 1);
      this.profileExpBarFill.fillRoundedRect(
        x,
        y,
        width * expRatio,
        height,
        8,
      );

      this.profileExpText.setText(`EXP  ${currentExp}/${XP_PER_LEVEL}`);
    }
  }

  // compute average of recorded reactionTimes, return number (seconds)
  computeAvgReaction() {
    try {
      if (!Array.isArray(this.reactionTimes) || this.reactionTimes.length === 0) {
        return 0;
      }
      // filter out non-positive values which may be placeholder/invalid
      const valid = this.reactionTimes.filter((v) => Number.isFinite(v) && v > 0);
      if (valid.length === 0) return 0;
      const sum = valid.reduce((a, b) => a + b, 0);
      return sum / valid.length;
    } catch (e) {
      console.warn("computeAvgReaction failed", e);
      return 0;
    } finally {
      // 인텐셔널: 현재 이 함수는 로컬 인메모리 계산이므로 꼭 cleanup이 필요하지 않습니다.
    }
  }

  // helper methods for avatar keys and sprite sheets (also copied to LobbyScene)
  getAvatarAnimKey(baseKey) {
    return `avatar_anim_${baseKey}`;
  }

  getAvatarAnimFrameRate(baseKey) {
    // player_1/player_2/player_3/player_4 모두 빠른 프레임으로 재생
    return baseKey === "player_1" ||
      baseKey === "player_2" ||
      baseKey === "player_3" ||
      baseKey === "player_4"
      ? 18
      : 2;
  }

  getAvatarAnimMaxFrame(baseKey) {
    // player_1/player_2/player_3/player_4 모두 풀 프레임(최대 91) 재생
    return /^player_[1-4]$/.test(baseKey) ? 91 : 2;
  }

  // choose current avatar key, mirror LobbyScene logic
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

  // returns avatar keys the player actually owns (used by selection logic)
  getOwnedProfileAvatarKeys() {
    const allKeys = Array.isArray(this.profileAvatarKeys)
      ? this.profileAvatarKeys
      : [];
    if (allKeys.length === 0) {
      return ["player_1"];
    }

    const ownedFromProfile = Array.isArray(this.myProfile?.owned_characters)
      ? this.myProfile.owned_characters
      : [];

    const ownedFromStorage = (() => {
      try {
        const stored = JSON.parse(localStorage.getItem("ownedCharacters") || "[]");
        return Array.isArray(stored) ? stored : [];
      } catch (e) {
        return [];
      }
    })();

    const ownedSet = new Set([
      "player_1",
      ...ownedFromProfile,
      ...ownedFromStorage,
    ]);

    const ownedKeys = allKeys.filter((key) => ownedSet.has(key));
    return ownedKeys.length > 0 ? ownedKeys : ["player_1"];
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
    if (baseKey === "player_3") {
      if (this.textures.exists("player_3_frame_1")) return "player_3_frame_1";
    }
    if (baseKey === "player_4") {
      if (this.textures.exists("player_4_frame_1")) return "player_4_frame_1";
    }
    const sheetKey = `${baseKey}_sprite_a`;
    if (this.textures.exists(sheetKey)) return sheetKey;
    return null;
  }

  getValidCharacterTextureKey(baseKey) {
    const candidates = [
      this.getAvatarDisplayKey && this.getAvatarDisplayKey(baseKey),
      baseKey,
      `${baseKey}_1`,
      `${baseKey}_sprite_a`,
      `${baseKey}_frame_1`,
      `${baseKey}_frame_2`,
    ];

    for (const k of candidates) {
      if (!k) continue;
      try {
        if (this.textures && typeof this.textures.exists === "function" && this.textures.exists(k)) {
          return k;
        }
      } catch (e) {}
    }

    return null;
  }

  // wrapper for baseline calculation (server function also defined in index.js)
  getHumanReactionBaseline(room) {
    if (
      typeof window !== "undefined" &&
      typeof getHumanReactionBaseline === "function"
    ) {
      try {
        return getHumanReactionBaseline(room);
      } catch (e) {
        console.warn("baseline helper error", e);
        return 0;
      }
    }
    return 0;
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

    const animKey = scene.getAvatarAnimKey(baseKey);

    try {
      if (baseKey === "player_3" || baseKey === "player_4") {
        const maxFrame = this.getAvatarAnimMaxFrame(baseKey);
        if (this.textures.exists(`${baseKey}_frame_1`)) {
          const frames = [];
          for (let idx = 1; idx <= maxFrame; idx += 1) {
            const textureKey = `${baseKey}_frame_${idx}`;
            if (this.textures.exists(textureKey)) {
              frames.push({ key: textureKey });
            }
          }
          if (frames.length > 0) {
            const existingAnim = scene.anims.get(animKey);
            if (existingAnim) {
              scene.anims.remove(animKey);
            }
            this.anims.create({
              key: animKey,
              frames,
              frameRate: this.getAvatarAnimFrameRate(baseKey),
              repeat: -1,
            });
            return animKey;
          }
        }

        // fallback to legacy two-frame assets if any
        const fallbackFrames = [];
        for (let idx = 1; idx <= 2; idx += 1) {
          const textureKey = `${baseKey}_${idx}`;
          if (this.textures.exists(textureKey)) {
            fallbackFrames.push({ key: textureKey });
          }
        }
        if (fallbackFrames.length > 0) {
          const existingAnim = scene.anims.get(animKey);
          if (existingAnim) {
            scene.anims.remove(animKey);
          }
          this.anims.create({
            key: animKey,
            frames: fallbackFrames,
            frameRate: this.getAvatarAnimFrameRate(baseKey),
            repeat: -1,
          });
          return animKey;
        }
      }

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
 
            const existingAnim = scene.anims.get(animKey);
            if (existingAnim) {
              const existingLen = existingAnim.frames
                ? existingAnim.frames.length
                : 0;

              if (existingLen >= frames.length) {
                return animKey;
              }
              scene.anims.remove(animKey);
            }
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

            const existingAnim = scene.anims.get(animKey);
            if (existingAnim) {
              scene.anims.remove(animKey);
            }
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
          const existingAnim = scene.anims.get(animKey);
          if (
            existingAnim &&
            existingAnim.frames &&
            existingAnim.frames.length >= frames.length
          ) {
            return animKey;
          }
          if (existingAnim) {
            scene.anims.remove(animKey);
          }
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
      return null;
    }
  }

  applyAvatarAnimation(target, baseKey) {
    // ensure we operate on the scene rather than whatever `this` may be
    const scene = target && target.scene ? target.scene : this;

    if (!scene || !scene.add) {
      return;
    }
    if (!target || !target.active) {
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
      const firstFrameKey = this.getAvatarDisplayKey(baseKey) || `${baseKey}_1`;
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
    // Prefer incoming players, but fall back to existing GameScene roundData
    // or LobbyScene.roundData when available (defensive against missing payloads).
    const lobbyScene = this.scene && typeof this.scene.get === 'function' ? this.scene.get('LobbyScene') : null;
    const lobbyPlayers = Array.isArray(lobbyScene?.roundData?.players) ? lobbyScene.roundData.players : [];
    const existingPlayers = Array.isArray(this.roundData?.players) ? this.roundData.players : lobbyPlayers;
    const incomingPlayers = Array.isArray(data.players) && data.players.length ? data.players : existingPlayers;
    if (!Array.isArray(incomingPlayers) || incomingPlayers.length === 0) {
      console.warn("GameScene.init: players missing or empty; falling back to existing/lobby players", {
        existingPlayersLen: Array.isArray(existingPlayers) ? existingPlayers.length : 0,
        lobbyPlayersLen: Array.isArray(lobbyPlayers) ? lobbyPlayers.length : 0,
        dataPlayersLen: Array.isArray(data.players) ? data.players.length : null,
      });
    }

    this.roundData = {
      players: incomingPlayers,
      hostId: data.hostId ?? this.roundData?.hostId ?? null,
      roomId: data.roomId ?? this.roundData?.roomId ?? null,
      roomName: data.roomName || this.roundData?.roomName || "대기실",
      maxPlayers: data.maxPlayers || data.max || this.roundData?.maxPlayers || 4,
      turnIndex: 0,
      isGameStarted: false,
      aiDifficulty: data.aiDifficulty || this.roundData?.aiDifficulty || "normal",
      itemMode: typeof data.itemMode === "boolean" ? data.itemMode : this.roundData?.itemMode !== false,
      gameMode: data.gameMode || this.roundData?.gameMode || "allin",
      timeAttackEndsAt: data.timeAttackEndsAt || this.roundData?.timeAttackEndsAt || null,
      gameMultiplier: 1, // 배수 시스템: 1배, 2배, 3배, 5배, 10배
    };
    
    // 배수 애니메이션 실행 flag
    this._multiplierAnimationShown = false;
    
    this.pendingGameStartData = data && Array.isArray(this.roundData.players) && this.roundData.players.length ? data : null;

    this.isTutorialMode = !!data.isTutorialMode;
    this.fromTutorial = !!data.fromTutorial;
    this.tutorialConfig = data.tutorialConfig || null;

    // Reset tracking flags so each new game correctly counts single play progress.
    this._hasIncrementedSinglePlayQuest = false;

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
    // In singleplayer mode we do not track average reaction time / avetime.
    if (this.isSingle) {
      this.reactionTimes = [];
    }
    // renderTable 예약 플래그 초기화 (게임 시작 시 항상 false)
    this._renderTableScheduled = false;
    this._renderTableLatestPlayers = null;
    this.isGameReady = false;
    this.resultContainer = null;

    this.myTurnTimer = null;

    // AI watchdog retry counter
    this._aiTurnWatchRetries = 0;
    this._aiAutoNotifyTimer = null;
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
    const gameScene = this;

    // ✅ GameScene에서도 emitInventory 메서드 정의 (싱글플레이/멀티플레이 모두에서 코인 동기화)
    if (typeof this.emitInventory !== 'function') {
      this.emitInventory = (reason = 'game', options = {}) => {
        try {
          if (!socket || !socket.connected) return;
          
          const payload = {
            reason,
            coins: Number(this.myProfile?.coins) || 0,
            nickname: this.myNickname || localStorage.getItem('nickname') || '요리사',
          };

          socket.emit('syncPlayerInventory', payload);
          socket.emit('syncInventory', payload);
          socket.emit('updatePlayerInventory', payload);
          socket.emit('updateProfile', payload);
          socket.emit('savePlayerProfile', payload);
          console.log(`🛰️ [GameScene] inventory synced (${reason})`, { coins: payload.coins });
        } catch (e) {
          console.warn('[GameScene] emitInventory failed', reason, e);
        }
      };
    }

    // Track whether we've already incremented the main-menu quest for this single-run.
    // This prevents double-counting if the same scene instance is reused between matches.
    this._hasIncrementedSinglePlayQuest = false;

    // Ensure legacy code paths do not crash when helper methods are missing.
    // (Some builds may drop method definitions due to bundling or reset.)
    if (typeof this.isPlayerAi !== "function") {
      this.isPlayerAi = (playerId) => {
        if (!playerId) return false;
        if (Array.isArray(this.roundData?.players)) {
          const p = this.roundData.players.find((x) => x && x.id === playerId);
          if (p && typeof p.isBot === "boolean") return !!p.isBot;
        }
        return typeof playerId === "string" && (/^AI_/i.test(playerId) || /^AI_BOT_/i.test(playerId) || playerId.startsWith("AI_BOT_"));
      };
    }

    // Local helper (closure) to reliably detect AI ids inside socket callbacks
    const isPlayerAiLocal = (playerId) => {
      try {
        if (!playerId) return false;
        if (Array.isArray(gameScene.roundData?.players)) {
          const p = gameScene.roundData.players.find((x) => x && x.id === playerId);
          if (p && typeof p.isBot === "boolean") return !!p.isBot;
        }
        return typeof playerId === "string" && (/^AI_/i.test(playerId) || /^AI_BOT_/i.test(playerId) || playerId.startsWith("AI_BOT_"));
      } catch (e) {
        return false;
      }
    };

    // Ensure premium bear popup helpers are available in GameScene (copy from LobbyScene if needed).
    try {
      if (typeof this.createInlinePremiumBearPopup !== 'function' && typeof LobbyScene !== 'undefined' && typeof LobbyScene.prototype.createInlinePremiumBearPopup === 'function') {
        this.createInlinePremiumBearPopup = LobbyScene.prototype.createInlinePremiumBearPopup.bind(this);
      }
      if (typeof this.showPremiumBearAcquiredPopup !== 'function' && typeof LobbyScene !== 'undefined' && typeof LobbyScene.prototype.showPremiumBearAcquiredPopup === 'function') {
        this.showPremiumBearAcquiredPopup = LobbyScene.prototype.showPremiumBearAcquiredPopup.bind(this);
      }
      if (typeof this.isPremiumBearUnlocked !== 'function' && typeof LobbyScene !== 'undefined' && typeof LobbyScene.prototype.isPremiumBearUnlocked === 'function') {
        this.isPremiumBearUnlocked = LobbyScene.prototype.isPremiumBearUnlocked.bind(this);
      }
      if (typeof this.unlockPremiumBear !== 'function' && typeof LobbyScene !== 'undefined' && typeof LobbyScene.prototype.unlockPremiumBear === 'function') {
        this.unlockPremiumBear = LobbyScene.prototype.unlockPremiumBear.bind(this);
      }
    } catch (e) {
      console.warn('[premium] GameScene premium helper bind failed', e);
    }

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
        if (this._timeAttackOverTween) {
          this._timeAttackOverTween.stop();
          this._timeAttackOverTween = null;
        }
        if (this._timeAttackOverBlinkTween) {
          this._timeAttackOverBlinkTween.stop();
          this._timeAttackOverBlinkTween = null;
        }
        if (this._ratioColorTimeout) {
          clearTimeout(this._ratioColorTimeout);
          this._ratioColorTimeout = null;
        }
        if (this._aiRingTimers) {
          Object.values(this._aiRingTimers).forEach((t) => {
            try {
              if (t) t.remove();
            } catch (e) {
              // ignore
            }
          });
          this._aiRingTimers = null;
        }
        this.timeAttackText = null;
      });
    }

    // 특수카드 사용(턴당 1회) 추적 초기화
    this.specialUsedThisTurn = {}; // { playerId: true }

    // make sure repositionProfileCard method exists on `this`
    // (defined further down outside create())

    // create profile card method
    const createProfileCard = () => {
      const cardW = this.cameras.main.width * 0.24;
      const cardH = this.cameras.main.height * 0.14;
      this.profileCardBaseW = cardW;
      this.profileCardBaseH = cardH;
      const safePaddingLocal = Math.max(this.cameras.main.width * 0.06, 24);
      // temporarily place offscreen and hide; we'll reposition when deck exists
      // depth should be above basic UI but below most animating cards
      const card = this.add
        .container(-9999, -9999)
        .setDepth(100) // match other UI elements, not the sliding cards
        .setScrollFactor(0)
        .setVisible(false);
      // no need for bringToTop; depth already correct
      
      // background plate
      const bg = this.add
        .rectangle(0, 0, cardW, cardH, 0x000000, 0.6)
        .setStrokeStyle(2, 0xffffff);

      // layout helpers
      const padding = Math.max(cardW * 0.06, 10);
      const leftX = -cardW / 2 + padding;
      const levelY = -cardH * 0.28;
      const expBarY = levelY + cardH * 0.18;

      // level + nickname text (top)
      const levelTxt = this.add
        .text(
          leftX,
          levelY,
          `Lv ${this.myProfile?.level || 1} ${this.myProfile?.nickname || ""}`,
          {
            fontFamily: "Jua",
            fontSize: `${cardH * 0.14}px`,
            color: "#f1c40f",
          },
        )
        .setOrigin(0, 0.5);
      // keep reference for later updates
      this.profileLevelTxt = levelTxt;

      const currentExp = Number(this.myProfile?.experience || 0);
      const expRatio = (currentExp % XP_PER_LEVEL) / XP_PER_LEVEL;
      const expBarWidth = cardW * 0.7;
      const expBarHeight = cardH * 0.11;
      const expBarX = leftX;

      const expBg = this.add.graphics();
      expBg.fillStyle(0x555555, 1);
      expBg.fillRoundedRect(
        expBarX,
        expBarY - expBarHeight / 2,
        expBarWidth,
        expBarHeight,
        6,
      );
      expBg.setDepth(1);

      const expFill = this.add.graphics();
      expFill.fillStyle(0x2ecc71, 1);
      expFill.fillRoundedRect(
        expBarX,
        expBarY - expBarHeight / 2,
        expBarWidth * expRatio,
        expBarHeight,
        6,
      );
      expFill.setDepth(1);

      const expTxt = this.add
        .text(expBarX + expBarWidth * 0.05, expBarY, `EXP ${currentExp % XP_PER_LEVEL}/${XP_PER_LEVEL}`, {
          fontFamily: "Jua",
          fontSize: `${cardH * 0.09}px`,
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);
      this.profileExpBarBg = expBg;
      this.profileExpBarFill = expFill;
      this.profileExpText = expTxt;

      // store layout for consistent updates (prevents misalignment)
      this.profileExpBarLayout = {
        x: expBarX,
        y: expBarY - expBarHeight / 2,
        width: expBarWidth,
        height: expBarHeight,
      };

      // display average reaction time (Avg) and accuracy (정답률)
      const avgRaw = this.computeAvgReaction();
      const avg = avgRaw.toFixed(2);
      const reactTxt = this.add
        .text(leftX, cardH * 0.06, `반응속도: ${avg}s`, {
          fontFamily: "Jua",
          fontSize: `${cardH * 0.13}px`,
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);
      const ratio = Number(this.myProfile?.ratio ?? 0) || 0;
      const ratioTxt = this.add
        .text(leftX, cardH * 0.22, `정답률: ${ratio}%`, {
          fontFamily: "Jua",
          fontSize: `${cardH * 0.13}px`,
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);

      const coinTxt = this.add
        .text(leftX, cardH * 0.34, `보유코인: ${this.myProfile?.coins || 0}`, {
          fontFamily: "Jua",
          fontSize: `${cardH * 0.13}px`,
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);

      card.add([bg, levelTxt, expBg, expFill, expTxt, reactTxt, ratioTxt, coinTxt]);
      this.profileCard = card;
      // keep reference to react/ratio/coin text for updates
      this.profileReactTxt = reactTxt;
      this.profileRatioTxt = ratioTxt;
      this.profileCoinTxt = coinTxt;
      // populate text immediately if profile already known
      if (typeof this.updateMyProfileUI === 'function') {
        this.updateMyProfileUI();
      }
      // flush any pending exp gain animations (if xp was earned before the UI was ready)
      this.flushPendingExpGainAnimations();

      // make visible once repositioned (if deck already exists it will happen immediately)
      if (this.myDeckSprite && typeof this.repositionProfileCard === 'function') {
        this.repositionProfileCard();
      }
    };
    // call immediately (only for multiplayer; singleplayer does not show a profile panel)
    if (!this.isSingle) {
      createProfileCard();
    }

    // initialize with cached profile data if available (important for multiplayer)
    if (typeof socket !== 'undefined' && socket.profile) {
      this.updateMyProfileUI(socket.profile);
    }
    // if deck already exists (rare), move profile to its right straight away
    if (!this.isSingle && this.myDeckSprite && typeof this.repositionProfileCard === 'function') {
      this.repositionProfileCard();
    }

    // make sure player2/player3 frames are prepared early
    ensurePlayer2Frames(this);
    ensurePlayer3Frames(this);

    this.timeAttackTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.updateTimeAttackDisplay();
      },
    });

    const difficultyMultipliers = {
      // slower AI speeds to give players more time to react.
      // Easy mode is currently a bit too slow, so make it slightly faster.
      easy: 1.15,
      normal: 1.2,
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

    // 싱글플레이(튜토리얼 제외)에서는 AI 제출 속도를 1.3초로 고정한다.
    // (기존 느리게 조절하던 로직을 제거하고 요청대로 고정 딜레이를 적용)
    if (this.isSingle && !this.isTutorialMode) {
      this.aiSettings = this.aiSettings.map((ai) => ({
        ...ai,
        reactionTime: 1300,
        flipDelay: 1300,
      }));
    }

    // 싱글플레이 하드 모드에서는 추가로 더 느리게 하는 이전 로직은 제거

    // Ensure quest counter helpers always exist (avoids `undefined` on certain builds)
    // NOTE: we try not to override the class prototype methods so the real
    // implementation (with logging + save logic) can execute.
    const sharedIncrement = LobbyScene?.prototype?.incrementMultiQuestCounter;
    if (typeof sharedIncrement === "function") {
      // Use the LobbyScene implementation when GameScene doesn't have it.
      if (typeof this.incrementMultiQuestCounter !== "function") {

        this.incrementMultiQuestCounter = sharedIncrement.bind(this);
      }
    }

    const sharedFallback = LobbyScene?.prototype?.incrementMultiQuestCounterFallback;
    if (typeof sharedFallback === "function") {
      if (typeof this.incrementMultiQuestCounterFallback !== "function") {

        this.incrementMultiQuestCounterFallback = sharedFallback.bind(this);
      }
    }

    // Ensure helper methods called by the shared implementation are also available
    const sharedBuildSnapshot = LobbyScene?.prototype?.buildQuestPopupSnapshot;
    if (typeof sharedBuildSnapshot === "function" && typeof this.buildQuestPopupSnapshot !== "function") {

      this.buildQuestPopupSnapshot = sharedBuildSnapshot.bind(this);
    }

    const sharedSaveSnapshot = LobbyScene?.prototype?.saveMultiQuestProgressSnapshot;
    if (typeof sharedSaveSnapshot === "function" && typeof this.saveMultiQuestProgressSnapshot !== "function") {

      this.saveMultiQuestProgressSnapshot = sharedSaveSnapshot.bind(this);
    }

    // Last resort: attach a no-op if nothing is available
    if (typeof this.incrementMultiQuestCounter !== "function") {

      this.incrementMultiQuestCounter = (key, amount = 1) => {
        if (typeof this.incrementMultiQuestCounterFallback === "function") {
          this.incrementMultiQuestCounterFallback(key, amount);
        }
      };
    }

    if (typeof this.incrementMultiQuestCounterFallback !== "function") {

      this.incrementMultiQuestCounterFallback = (key, amount = 1) => {
        // fallback no-op if method missing
      };
    }

    if (this.isSingle) {
      // 싱글플레이면 소켓 ID가 아닌 "PLAYER_ME" 혹은 players[0].id를 내 ID로 강제 지정
      this.myId = this.roundData.players[0].id;
      this.turnIndex = 0; // 내 차례부터 시작
      this.isGameStarted = true;
      this.lastEliminationEffectAtByPlayer = {};
      this.initializeSingleDecks();

      // 기존 싱글퀘스트 유지
      this.initQuestSystem();

      // 싱글 플레이 참여 카운트는 게임이 정상 종료된 시점(승/패)에서만 올리도록 함
      // (시작 후 바로 나갔다가 재입장하는 꼼수를 방지)
      this._hasIncrementedSinglePlayQuest = false;
    } else {
      this.myId = socket.id;
      this.teardownQuestUI();

      // Multiplayer play count will be tracked when the match ends.
      this._hasCountedMultiPlayForMatch = false;
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

    // 이전 게임 결과/UI 잔상을 제거 (재시작 시 안전)
    try {
      if (this.resultContainer) {
        this.resultContainer.destroy();
        this.resultContainer = null;
      }
    } catch (e) {
      console.warn("GameScene.create: clearing old resultContainer failed", e);
    }

    // 이전 게임의 로그 또한 남아있지 않도록 초기화
    try {
      if (this.logTexts) {
        this.logTexts.forEach((t) => { try { t.destroy(); } catch (e) {} });
        this.logTexts = [];
      }
      if (this.gameLogs) {
        this.gameLogs = [];
      }
    } catch (e) {
      console.warn("GameScene.create: clearing old game logs failed", e);
    }

    try {
      if (this.playerTableGroup) {
        this.playerTableGroup.destroy();
      }
    } catch (e) {
      console.warn("GameScene.create: destroying old playerTableGroup failed", e);
    }

    // 플레이어/카드들을 담을 그룹
    this.playerTableGroup = this.add.container(0, 0).setDepth(1000);
    try {
      this.playerTableGroup.setVisible(true).setAlpha(1);
      this.playerTableGroup.setScrollFactor(0, 0);  // UI는 화면 고정 (0, 0)
      this.children.bringToTop(this.playerTableGroup);
      console.log('[GameScene.create] playerTableGroup 생성:', {
        depth: 1000,
        scrollFactor: `${this.playerTableGroup.scrollFactorX}, ${this.playerTableGroup.scrollFactorY}`,
      });
    } catch (e) {
      console.warn("GameScene.create: restoring playerTableGroup visibility/depth failed", e);
    }

    // renderTable scheduling reset as extra safety
    this._renderTableScheduled = false;
    this._renderTableLatestPlayers = null;

    // If scene was started with player data (e.g. via LobbyScene.scene.start),
    // render immediately so the UI is not blank.
    try {
      const playersAtStart = Array.isArray(this.roundData?.players) ? this.roundData.players : [];
      console.log("GameScene.create: starting with players", { len: playersAtStart.length, ids: playersAtStart.map(p => p && p.id) });
      if (playersAtStart.length) {
        this.renderTable(playersAtStart);
      }
    } catch (e) {
      console.warn("GameScene.create: renderTable fallback failed", e);
    }

    // If LobbyScene transitioned directly with a gameStart payload, apply it.
    // persisted in pendingGameStartData, will be handled after socket handlers are registered below

    // Debug: add force-win button for tutorial-started single games
    if (
      this.isSingle &&
      (this.isTutorialMode || this.roundData?.roomId === "TUTORIAL" || this.roundData?.isTutorialMode || this.tutorialConfig)
    ) {
      try {
        // ensure top-level debug container exists and is above toasts
        if (!this.debugUI || !this.debugUI.scene) {
          this.debugUI = this.add.container(0, 0).setDepth(999999999);
          this.debugUI.setScrollFactor(0);
          this.debugUI.setVisible(true);
          this.debugUI.setAlpha(1);
        }
        const btnX = this.cameras.main.width - 80;
        const btnY = 40;
        const forceBtn = this.add
          .image(btnX, btnY, "ui_btn")
          .setDisplaySize(140, 46)
          .setInteractive({ useHandCursor: true });
        const forceTxt = this.add
          .text(btnX, btnY, "강제승리", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${Math.max(12, this.cameras.main.width * 0.012)}px`,
            color: "#ffffff",
            fontWeight: "bold",
          })
          .setOrigin(0.5);
        this.debugUI.add([forceBtn, forceTxt]);
        this.children.bringToTop(this.debugUI);
        this._debugForceWinBtn = forceBtn;
        this._debugForceWinTxt = forceTxt;
        forceBtn.on("pointerdown", () => {
          this.sound.play("btn", { volume: 0.12 });
          console.debug("[debug] tutorial force-win pressed");
          try {
            if (typeof this.endSingleGame === "function") {
              this.endSingleGame("WIN");
            } else {
              const proto = GameScene?.prototype?.endSingleGame;
              if (typeof proto === "function") proto.call(this, "WIN");
            }
          } catch (e) {
            console.warn("[debug] force-win failed", e);
          }
        });
      } catch (e) {
        console.warn("[debug] failed to create force-win button", e);
      }
    }

    // Debug: add 'complete tutorial' button to directly show completion overlay
    if (
      this.isSingle &&
      (this.isTutorialMode || this.roundData?.roomId === "TUTORIAL" || this.roundData?.isTutorialMode || this.tutorialConfig)
    ) {
      try {
        if (!this.debugUI || !this.debugUI.scene) {
          this.debugUI = this.add.container(0, 0).setDepth(999999999);
          this.debugUI.setScrollFactor(0);
          this.debugUI.setVisible(true);
          this.debugUI.setAlpha(1);
        }
        const cbtnX = this.cameras.main.width - 80;
        const cbtnY = 100;
        const completeBtn = this.add
          .image(cbtnX, cbtnY, "ui_btn")
          .setDisplaySize(140, 46)
          .setInteractive({ useHandCursor: true });
        const completeTxt = this.add
          .text(cbtnX, cbtnY, "튜토리얼 완료", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${Math.max(12, this.cameras.main.width * 0.012)}px`,
            color: "#ffffff",
            fontWeight: "bold",
          })
          .setOrigin(0.5);
        this.debugUI.add([completeBtn, completeTxt]);
        this.children.bringToTop(this.debugUI);
        this._debugCompleteTutorialBtn = completeBtn;
        this._debugCompleteTutorialTxt = completeTxt;

        completeBtn.on("pointerdown", () => {
          this.sound.play("btn", { volume: 0.12 });
          console.debug("[debug] complete tutorial pressed");
          try {
            if (typeof this.showTutorialCompletionOverlay === "function") {
              this.showTutorialCompletionOverlay();
            } else if (typeof this.completeTutorialStage === "function") {
              try {
                this.hasCompletedTutorial = true;
                localStorage.setItem(TUTORIAL_STATE_KEY, "true");
              } catch (err) {}
            }
          } catch (e) {
            console.warn("[debug] complete tutorial failed", e);
          }
        });
      } catch (e) {
        console.warn("[debug] failed to create complete-tutorial button", e);
      }
    }

    // 연출은 applyGameStartPayload에서 처리됩니다
    // 이곳에서는 socket 핸들러 등록 후 pendingGameStartData를 통해 애니메이션이 시작됩니다

    // Ensure debug UI stays on top after opening animations that may reorder depths.
    try {
      if (this.time && typeof this.time.delayedCall === "function") {
        // multiple delayed attempts to ensure debugUI stays above dynamically-created UI
        [200, 1200, 3000].forEach((d) => {
          try {
            this.time.delayedCall(d, () => {
              try {
                if (this.debugUI && this.debugUI.scene) {
                  this.debugUI.setDepth(999999999);
                  this.debugUI.setVisible(true);
                  this.children.bringToTop(this.debugUI);
                  console.debug(`[debug] brought debugUI to top after ${d}ms`);
                }
              } catch (e) {
                console.warn('[debug] bringToTop debugUI failed', e);
              }
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Persistent DOM debug overlay to survive Phaser scene replacements.
    try {
      (function createPersistentDebugOverlay(scene) {
        try { window.__HalemaleLastGameScene = scene; } catch (e) {}
        const id = "halemale-debug-overlay";
        if (!document.getElementById(id)) {
          const wrapper = document.createElement("div");
          wrapper.id = id;
          Object.assign(wrapper.style, {
            position: "fixed",
            top: "12px",
            right: "12px",
            zIndex: "2147483647",
            pointerEvents: "none",
          });

          const makeBtn = (text, onClick) => {
            const b = document.createElement("button");
            b.textContent = text;
            Object.assign(b.style, {
              display: "block",
              marginBottom: "8px",
              width: "140px",
              height: "40px",
              fontSize: "13px",
              pointerEvents: "auto",
              opacity: "0.95",
              cursor: "pointer",
            });
            b.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const s = window.__HalemaleLastGameScene || (window.game && window.game.scene && window.game.scene.keys && window.game.scene.keys["GameScene"]);
              if (s) onClick(s);
            });
            return b;
          };

          const btnWin = makeBtn("강제승리 (DOM)", (s) => {
            try {
              if (typeof s.endSingleGame === "function") s.endSingleGame("WIN");
              else {
                const proto = GameScene?.prototype?.endSingleGame;
                if (typeof proto === "function") proto.call(s, "WIN");
              }
            } catch (e) {
              console.warn("DOM force-win failed", e);
            }
          });

          const btnComplete = makeBtn("튜토리얼 완료 (DOM)", (s) => {
            try {
              if (typeof s.showTutorialCompletionOverlay === "function") s.showTutorialCompletionOverlay();
              else {
                s.hasCompletedTutorial = true;
                try { localStorage.setItem(TUTORIAL_STATE_KEY, "true"); } catch (e) {}
              }
            } catch (e) {
              console.warn("DOM complete-tutorial failed", e);
            }
          });

          wrapper.appendChild(btnWin);
          wrapper.appendChild(btnComplete);
          document.body.appendChild(wrapper);
        } else {
          try { window.__HalemaleLastGameScene = scene; } catch (e) {}
        }
      })(this);
    } catch (e) {
      console.warn("failed to create persistent DOM debug overlay", e);
    }

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
      try {
        console.log('[socket.myProfile] received', profile);
      } catch (e) {}
      // cache again in case stats update separately
      try { socket.profile = profile; } catch (e) {}
      // update local profile stats for toast/etc
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

      // make sure the game-scene profile UI also reflects the full profile
      if (typeof this.updateMyProfileUI === 'function') {
        // If server only sent a coin update (common for single-player end flows),
        // treat it as a delta instead of overwriting the entire profile.coins.
        const hasOnlyCoins =
          typeof profile.coins !== 'undefined' &&
          typeof profile.level === 'undefined' &&
          typeof profile.experience === 'undefined' &&
          (Object.keys(profile).length === 1 || (Object.keys(profile).length === 2 && profile.coins !== undefined));

        if (hasOnlyCoins && this.isSingle) {
          const coinDelta = Number(profile.coins) || 0;
          if (this.isGameEnded || this.isResultOverlayActive) {
            // defer coin delta until after result overlay (keeps underlying UI stable)
            this._deferredCoinsDelta = (this._deferredCoinsDelta || 0) + coinDelta;
            console.debug('socket.myProfile: deferred coin delta (single)', { coinDelta, deferred: this._deferredCoinsDelta });
          } else {
            // apply immediately as a delta (do not emit back to server)
            try {
              this.modifyCoins(coinDelta, { sync: false, coinCardUpdate: true });
            } catch (e) {
              console.warn('socket.myProfile: modifyCoins failed', e);
            }
          }
          // mark that we have at least a server snapshot for other stats
          this.hasServerProfileSnapshot = true;
        } else {
          // 멀티플레이 결과(시상식) 연출 중이거나 게임이 종료된 상태라면
          // 프로필(특히 코인) 업데이트를 즉시 적용하지 않고 지연 저장합니다.
          if (this.isGameEnded || this.isResultOverlayActive) {
            const localCoins = Number(this.myProfile?.coins) || 0;
            const incomingCoins = Number(profile?.coins) || 0;
            console.log('[socket.myProfile] 결과 화면 중 프로필 업데이트 지연', { 
              localCoins,
              incomingCoins,
              willPreferLocal: localCoins > incomingCoins
            });
            this._deferredMyProfile = profile;
            console.debug("myProfile update deferred until post-result (socket.myProfile)", { profile });
          } else if (!this.isSingle) {
            // Live multiplayer: avoid profile UI show during match; coin display only from coincard updates.
            console.debug("myProfile update held during live multiplayer (socket.myProfile)", { profile });
            this._deferredMyProfile = profile;
          } else {
            this.updateMyProfileUI(profile);
            this.hasServerProfileSnapshot = true;
          }
        }
      }

      if (newLevel > prevLevel) {
        console.debug(`level up suppressed (profile sync): Lv.${prevLevel} → Lv.${newLevel}`);
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

    // Helper: if the next turn belongs to a bot, ensure a watchdog is running
    // so that the game never gets stuck waiting for a bot move.
    const scheduleAiWatchdog = (nextTurnId) => {
      try {
        if (this._aiTurnWatchTimer) {
          try {
            this._aiTurnWatchTimer.remove();
          } catch (e) {}
          this._aiTurnWatchTimer = null;
          this._aiTurnWatchRetries = 0;
        }
        if (typeof nextTurnId === "string" && isPlayerAiLocal(nextTurnId)) {
          if (this._aiPaused) {
            // AI temporarily paused (e.g. during results), do not schedule watchdog
            return;
          }
          const aiPlayerId = nextTurnId;
          this._aiTurnWatchRetries = 0;

          const attemptAiRequest = () => {
            const current = this.roundData.players[this.turnIndex];
            if (!current || current.id !== aiPlayerId) return;
            const hasOpen = Array.isArray(current.openStack) && current.openStack.length > 0;
            if (socket && socket.connected) {
              try {
                socket.emit("requestAiMove", { playerId: aiPlayerId, hasOpenStack: hasOpen });
              } catch (e) {
                console.warn("emit requestAiMove failed", e);
              }
              this.showToast("AI 응답 지연, 서버에 요청을 보냈습니다.", "#f39c12");
              this._aiTurnWatchRetries += 1;
              if (this._aiTurnWatchRetries < 3) {
                try {
                  this._aiTurnWatchTimer = this.time.delayedCall(5000, attemptAiRequest);
                } catch (e) {
                  this._aiTurnWatchTimer = null;
                }
              } else {
                try {
                  socket.emit("requestAiMove", { playerId: aiPlayerId, force: true, hasOpenStack: hasOpen });
                } catch (e) {}
              }
            }
          };

          const scheduleHostSkip = () => {
            if (!socket || !socket.connected) return;
            const isHost = socket.id === this.roundData.hostId;
            if (!isHost) return;
            try {
              socket.emit("forceSkipTurn", {
                roomId: this.roundData.roomId,
                playerId: aiPlayerId,
              });
            } catch (e) {
              console.warn("emit forceSkipTurn failed", e);
            }
          };

          try {
            this._aiTurnWatchTimer = this.time.delayedCall(8000, attemptAiRequest);
          } catch (e) {
            this._aiTurnWatchTimer = null;
          }

          try {
            if (this._botSkipTimer) {
              try {
                this._botSkipTimer.remove();
              } catch (e) {}
              this._botSkipTimer = null;
            }
            this._botSkipTimer = this.time.delayedCall(13000, scheduleHostSkip);
          } catch (e) {
            this._botSkipTimer = null;
          }

          try {
            if (this._aiAutoNotifyTimer) {
              try {
                this._aiAutoNotifyTimer.remove();
              } catch (e) {}
              this._aiAutoNotifyTimer = null;
            }
            this._aiAutoNotifyTimer = this.time.delayedCall(6000, () => {
              const current = this.roundData.players[this.turnIndex];
              if (!current || current.id !== aiPlayerId) return;
              if (socket && socket.connected) {
                try {
                  socket.emit("requestAiMove", { playerId: aiPlayerId, reason: "auto_timeout" });
                } catch (e) {
                  console.warn("emit requestAiMove(auto_timeout) failed", e);
                }
              }
            });
          } catch (e) {
            this._aiAutoNotifyTimer = null;
          }
        }
      } catch (e) {
        console.warn("ai watchdog error", e);
      }
    };

    // ============================================
    // 2. 할리갈리 전용 소켓 리스너
    // ============================================

    this.applyGameStartPayload = (data) => {
      try {
        console.log('[applyGameStartPayload] 호출됨', {
          isSingle: this.isSingle,
          _multiplierAnimationShown: this._multiplierAnimationShown,
          playersLength: Array.isArray(data?.players) ? data.players.length : 0,
        });

        if (!data || !Array.isArray(data.players) || data.players.length === 0) {
          console.log('[applyGameStartPayload] 데이터 유효성 검사 실패');
          return;
        }

        this.resultGameoverPlayed = false;
        this._lastResultPlayersHash = null;

        this.blockEffects = [];
        this.blockActive = false;
        this.blockBy = null;

        this.specialCardPauseUntil = 0;
        this.allowBellBecauseThunder = false;
        this.optimisticBellHandled = false;
        this.specialUsedThisTurn = {};
        this._optimisticFlipById = {};
        this._pendingServerOpenStackById = {};

        if (this._aiTurnWatchTimer) {
          try { this._aiTurnWatchTimer.remove(); } catch (e) {}
          this._aiTurnWatchTimer = null;
          this._aiTurnWatchRetries = 0;
        }
        if (this.myTurnTimer) {
          this.myTurnTimer.remove();
          this.myTurnTimer = null;
        }
        if (this.specialCardPauseTimer) {
          try { this.specialCardPauseTimer.remove(); } catch (e) {}
          this.specialCardPauseTimer = null;
        }

        this._aiPaused = false;
        this._aiTurnWatchRetries = 0;

        if (this.resultContainer) {
          try {
            this.resultContainer.destroy();
          } catch (e) {
            console.warn("applyGameStartPayload: resultContainer destroy failed", e);
          }
          this.resultContainer = null;
        }

        this.isSingle =
          data && typeof data.isSingle === "boolean"
            ? data.isSingle
            : this.isSingle;
        this._startOfMatchCoins = Number(this.myProfile?.coins) || 0; // 시작 시점 코인 스냅샷
        
        // 🔴 [중요] roomId 설정 - 배수 애니메이션에서 서버로 전송할 때 필요
        if (data?.roomId) {
          this.currentRoomId = data.roomId;
          console.log('[applyGameStartPayload] roomId 설정', { roomId: this.currentRoomId });
        }
        
        // 🔴 [배수 초기화] 새 게임은 배수 미정 (애니메이션에서 설정됨)
        this.roundData.gameMultiplier = 1; // 기본값 (게임 시작 후 애니메이션에서 업데이트됨)
        // 🔴 [중요] 플래그도 반드시 초기화! 다음 게임에서 애니메이션이 실행되도록
        this._multiplierAnimationShown = false;
        this._multiplierAnimationPlaying = false;
        
        console.log('[applyGameStartPayload] 배수 초기화', { 
          gameMultiplier: this.roundData.gameMultiplier,
          _multiplierAnimationShown: this._multiplierAnimationShown,
          isSingle: this.isSingle
        });
        
        this.isGameEnded = false; // 새 게임 시작 시 종료 플래그 리셋
        this.isResultOverlayActive = false;
        this.isGameStarted = true;
        this.isGameReady = true;
        this.lastEliminationEffectAtByPlayer = {};
        this._initialProfileApplied = false;

        // 3연속 진행시 남아있는 액션 잠금/타이머 초기화(플립/턴/AI)
        this.isFlipping = false;
        this.canClick = false;
        this.clearMyTurnTimer();
        if (this._aiTurnWatchTimer) {
          try { this._aiTurnWatchTimer.remove(); } catch (e) {}
          this._aiTurnWatchTimer = null;
          this._aiTurnWatchRetries = 0;
        }
        if (this._aiAutoNotifyTimer) {
          try { this._aiAutoNotifyTimer.remove(); } catch (e) {}
          this._aiAutoNotifyTimer = null;
        }
        if (this._aiStuckChecker) {
          try { this._aiStuckChecker.remove(); } catch (e) {}
          this._aiStuckChecker = null;
        }

        // Re-sync deferred profile/coins from previous match and update UI immediately
        try {
          if (this._deferredMyProfile) {
            this.applyDeferredProfileUpdates();
          }
          this.applyDeferredCoins();

          // 🔴 [보안] 코인은 반드시 서버 값만 신뢰 (로컬 값 무시)
          // Ensure we show the latest known server profile on start.
          if (socket && socket.profile) {
            this.myProfile = this.myProfile || {};
            
            // 🔴 [중요] 서버 코인을 절대적으로 신뢰
            if (Number.isFinite(Number(socket.profile.coins))) {
              const serverCoins = Number(socket.profile.coins);
              this.myProfile.coins = serverCoins;  // 서버 코인만 사용
              
              console.log('[applyGameStartPayload] 코인 동기화 (서버 신뢰)', {
                serverCoins,
                appliedCoins: this.myProfile.coins
              });
            }
            if (typeof socket.profile.level !== 'undefined') {
              this.myProfile.level = Number(socket.profile.level) || this.myProfile.level || 1;
            }
            if (typeof socket.profile.experience !== 'undefined') {
              this.myProfile.experience = Number(socket.profile.experience) || this.myProfile.experience || 0;
            }
          }

          if (typeof this.updateMyProfileUI === 'function') {
            this._allowCoinTextUpdateForNextUI = true;
            // Prefer local cached myProfile (most up-to-date) over stale socket.profile
            // in case server profile sync is delayed during rapid reconnect/restart.
            this.updateMyProfileUI(this.myProfile);
          }
        } catch (e) {
          console.warn('applyGameStartPayload initial profile/coins sync failed', e);
        }

        const initialTurnIndex = data.players.findIndex((p) => p.id === data.nextTurnId);
        this.turnIndex = initialTurnIndex >= 0 ? initialTurnIndex : 0;
        this.latestNextTurnId = data.nextTurnId;

        this.roundData.players = data.players.map((p) => ({
          ...p,
          cards: p.cards ?? (p.myDeck ? p.myDeck.length : 0),
          openStack: Array.isArray(p.openStack) ? p.openStack : [],
          openCard: p.openCard ?? null,
          isEliminated: p.isEliminated ?? false,
        }));

        this.roundData.hostId = data.hostId || this.roundData.hostId;
        if (typeof data.itemMode === "boolean") this.roundData.itemMode = data.itemMode;
        if (typeof data.gameMode === "string") this.roundData.gameMode = data.gameMode;
        if (typeof data.timeAttackEndsAt === "number") this.roundData.timeAttackEndsAt = data.timeAttackEndsAt;
        this.roundData.isGameStarted = true;

        this.specialUsedThisTurn = {};
        this._lastCardFlipAt = Date.now();
        this._lastAiStuckRequestAt = 0;

        this.canClick = false;
        this.playOpeningAnimation();

        // 멀티플레이는 커튼 후에 배수 애니메이션 실행, 싱글플레이는 기존 흐름
        if (!this.isSingle && !this._multiplierAnimationShown) {
          // 멀티플레이: 커튼 열림 → 배수 애니메이션 → Ready-Go
          this._multiplierAnimationShown = true;
          this._multiplierAnimationPlaying = true; // 배수 애니메이션 진행 중 플래그
          
          this.time.delayedCall(1200, () => {
            console.log('[applyGameStartPayload] 커튼 열림 → 배수 애니메이션 시작');
            this.playMultiplierSelectionAnimation(); // 5초 (3초 회전 + 2초 표시)

            this.time.delayedCall(5000, () => {
              this.showReadyGo();
              this.time.delayedCall(2000, () => {
                const myId = this.isSingle ? this.myId : socket.id;
                const currentTurnId = this.roundData?.players?.[this.turnIndex]?.id;
                this.canClick = currentTurnId === myId || data.nextTurnId === myId;
                
                // ✅ 배수 애니메이션 완료
                this._multiplierAnimationPlaying = false;
                console.log("🎮 배수 애니메이션 완료, 게임 시작 준비 완료", {
                  myId,
                  currentTurnId,
                  nextTurnId: data.nextTurnId,
                  canClick: this.canClick,
                });
                
                try {
                  this.updateTurnEffect && typeof this.updateTurnEffect === 'function' && this.updateTurnEffect();
                  if (this.canClick && this.myDeckSprite) {
                    try { this.applyDeckPulse(this.myDeckSprite); } catch (e) {}
                  }
                } catch (e) {}
                
                // ✅ 배수 애니메이션 완료 후, 내 턴이면 타이머 시작
                if (this.canClick) {
                  const myPlayerLayout = this.playerLayouts && this.playerLayouts[myId];
                  const myPlayer = this.roundData.players.find(p => p.id === myId);
                  if (myPlayer && myPlayerLayout) {
                    this.startMyAutoTimer(myPlayer, myPlayerLayout);
                  }
                }
              });
            });
          });
        } else {
          // 싱글플레이: 기존 흐름
          this.time.delayedCall(800, () => {
            this.showReadyGo();
            this.time.delayedCall(2000, () => {
              const myId = this.isSingle ? this.myId : socket.id;
              const currentTurnId = this.roundData?.players?.[this.turnIndex]?.id;
              this.canClick = currentTurnId === myId || data.nextTurnId === myId;
              console.log("🎮 game ready", { myId, currentTurnId, nextTurnId: data.nextTurnId, turnIndex: this.turnIndex, canClick: this.canClick });
              try {
                // Ensure visual turn effects are applied once UI is visible
                this.updateTurnEffect && typeof this.updateTurnEffect === 'function' && this.updateTurnEffect();
                if (this.canClick && this.myDeckSprite) {
                  try { this.applyDeckPulse(this.myDeckSprite); } catch (e) {}
                }
              } catch (e) {}
            });
          });
        }

        this.renderTable(this.roundData.players);
      } catch (e) {
        console.warn("applyGameStartPayload failed", e);
      }
    };

    socket.off("gameStart").on("gameStart", (data) => {
      console.log("🎮 [gameStart 이벤트] 수신됨");
      console.log("Gamestart");
      this.showToast("gameStart event received", "#ff0");
      this.applyGameStartPayload(data);
    });

    // Handle pending gameStart data from LobbyScene transition
    if (this.pendingGameStartData) {
      console.log("📋 [GameScene] pendingGameStartData 발견, applyGameStartPayload 호출");
      this.applyGameStartPayload(this.pendingGameStartData);
      this.pendingGameStartData = null;
    }

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
        scheduleAiWatchdog(data.nextTurnId);
      }
    });

    socket.off("cardFlipped").on("cardFlipped", (data) => {
      if (this.isSingle) return;

      const myId = this.isSingle
        ? this.myId
        : typeof socket !== "undefined"
        ? socket.id
        : null;

      // record last flip time so periodic watchdog knows activity occurred
      this._lastCardFlipAt = Date.now();

      // clear any AI watchdog when any card flip arrives
      try {
        if (this._aiTurnWatchTimer) {
          try {
            this._aiTurnWatchTimer.remove();
          } catch (e) {}
          this._aiTurnWatchTimer = null;
          this._aiTurnWatchRetries = 0;
        }
        if (this._aiAutoNotifyTimer) {
          try { this._aiAutoNotifyTimer.remove(); } catch (e) {}
          this._aiAutoNotifyTimer = null;
        }
      } catch (e) {}

      // log AI/human and thunder
      if (data.playerId && isPlayerAiLocal(data.playerId)) {
      }
      if (data?.card?.type === THUNDER_CARD_TYPE) {
        // allow immediate bell presses even if pause still active
        this.allowBellBecauseThunder = true;
        // clear after short delay (give time for server state update)
        this.time.delayedCall(300, () => {
          this.allowBellBecauseThunder = false;
        });
      }

      // 1. 데이터 갱신
      const player = this.roundData.players.find((p) => p.id === data.playerId);
      const wasEliminated = Boolean(player && player.isEliminated);
      const isOptimisticFlip =
        data.playerId &&
        this._optimisticFlipById &&
        this._optimisticFlipById[data.playerId];

      if (player) {
        // If we're in an optimistic flip state, delay stacking the new open card
        // until the optimistic animation has finished (avoids double-visual).
        if (!isOptimisticFlip) {
          if (data.openCardStack) {
            // Queue server-provided stack to be applied after animation completes
            this._pendingServerOpenStackById = this._pendingServerOpenStackById || {};
            this._pendingServerOpenStackById[data.playerId] = data.openCardStack;
          } else {
            if (!player.openStack) player.openStack = [];
            // 애니메이션 전에는 아직 넣지 않습니다 (playCardFlipAnimation 내부에서 처리)
          }
        } else {
          // store server data for later application after optimistic animation ends
          const state = this._optimisticFlipById[data.playerId];
          if (state) {
            state.serverData = data;
          }
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
        const newTotal = Number.isFinite(Number(data.coinTotal))
          ? Number(data.coinTotal)
          : undefined;

        // Only play the coin reward animation for the local player.
        if (data.playerId === myId) {
          this.playCoinCardRewardAnimation(data.playerId, reward, newTotal);
        }

        if (data.playerId === myId) {
          if (Number.isFinite(Number(data.coinTotal))) {
            const serverCoinTotal = Number(data.coinTotal);
            const prevCoins = Number(this.myProfile?.coins) || 0;
            const delta = serverCoinTotal - prevCoins;
            
            console.log('💰 [cardReward] 코인카드 보상 수신 및 적용', {
              reward: Number(data.coinReward) || COIN_CARD_REWARD,
              prevCoins,
              serverCoinTotal,
              delta,
              isSingle: this.isSingle
            });
            
            this.profileStats = this.profileStats || {};
            this.profileStats.coins = serverCoinTotal;
            // 🔴 중요: coinCardUpdate는 true, 하지만 sync도 true로 설정하여 서버 동기화
            this.setCoinsAbsolute(serverCoinTotal, { sync: true, coinCardUpdate: true });
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
      // suppress duplicate results that arrive shortly after one another
      // (server or network may accidentally send a second copy).
      const now = Date.now();
      if (
        this.lastBellResultAt &&
        now - this.lastBellResultAt < 1500 &&
        data.success &&
        this.lastBellResultWinner === data.winnerId
      ) {
        // still update players in case they were changed, but skip
        // animations/logging below
        if (Array.isArray(data.players)) {
          // quickly sync minimal player fields to avoid rendering glitches
          this.roundData.players = data.players.map((p) => ({
            ...p,
            cards: p.cards ?? (p.myDeck ? p.myDeck.length : 0),
            openStack: Array.isArray(p.openStack) ? p.openStack : [],
            openCard: p.openCard ?? null,
            isEliminated: !!p.isEliminated,
          }));
        }
      }
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

      // update local accuracy stat (correct / total) for this session
      if (!this.isSingle) {
        // 게임 종료 / 종료 직후의 결과는 반영하지 않기
        if (this.isGameEnded || this.isResultTextVisible || this.isResultOverlayActive) {
          console.debug("bellResult skipped on end stage", {
            isGameEnded: this.isGameEnded,
            isResultTextVisible: this.isResultTextVisible,
            isResultOverlayActive: this.isResultOverlayActive,
            data,
          });
          return;
        }
          try {
            // Prefer server-provided counters when available to avoid double-counting.
            const myId = socket?.id;
            const isSelfBell =
              !this.isSingle &&
              (data.winnerId === myId || data.penaltyId === myId);

          if (data.success && data.winnerId === socket.id) {
            this.updateBellAccuracy({ correct: 1, total: 1 });
          } else if (!data.success && data.penaltyId === socket.id) {
            this.updateBellAccuracy({ correct: 0, total: 1 });
          }
        } catch (e) {
          /* ignore */
        }
      }

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
        // if we already showed optimistic success for this bell, skip only the animation,
        // but still update state, log, and record reaction.
        let skipAnimation = false;
        if (data.winnerId === socket.id && this.optimisticBellHandled) {
          skipAnimation = true;
          this.roundData.players = updatedPlayers;
          // do not return here; continue to processing
        }

        // record reaction time for myself and refresh profile text
        // (Skip reaction time tracking in singleplayer to avoid avetime growth.)
        if (
          !this.isSingle &&
          data.winnerId === socket.id &&
          typeof data.reactionTime !== 'undefined'
        ) {
          const rt = parseFloat(data.reactionTime);
          if (!isNaN(rt)) {
            this.reactionTimes = this.reactionTimes || [];
            this.reactionTimes.push(rt);
            // update stored average so later sync sends it
            const newAvg = this.computeAvgReaction();
            this.myProfile = this.myProfile || {};
            this.myProfile.avetime = newAvg;
            if (!(this.isGameEnded && !this.isSingle)) {
              if (this.profileReactTxt) {
                const avgVal = newAvg.toFixed(2);
                this.profileReactTxt.setText(`Avg: ${avgVal}s`);
              }
            } else {
              console.debug('skip profileReactTxt update due to game end');
            }
            // we no longer sync on every ring; final average will be sent at game end
            // (this reduces unnecessary socket traffic)
          }
        }

        const message = `${data.winnerNickname} ${data.collectedCount}장 획득(${data.reactionTime}초)`;
        this.addGameLog(`${message}`, "#f1c40f");

        // 💡 [수정] 승리 애니메이션 호출 (renderTable은 애니메이션 끝난 후 함수 내부에서 실행됨)
        if (!skipAnimation) {
          this.playWinAnimation({
            winnerId: data.winnerId, // 서버에서 승자 ID를 보내준다고 가정
            players: updatedPlayers,
            prevPlayers: prevPlayers, // 바닥 카드가 남아있는 이전 상태 전달
            winnerNickname: data.winnerNickname,
            collectedCount: data.collectedCount,
          });
        }

        // winner case - just update players immediately
        this.roundData.players = updatedPlayers;

        // 멀티플레이: 로컬 플레이어가 카드를 획득했으면 즉시 경험치 지급
        console.log('[bellResult] winnerId=', data.winnerId, 'collectedCount=', data.collectedCount, 'socket.id=', socket && socket.id, 'isSingle=', this.isSingle);
        try {
          if (
            !this.isSingle &&
            data.success &&
            data.winnerId === socket.id &&
            Number.isFinite(Number(data.collectedCount)) &&
            Number(data.collectedCount) > 0
          ) {
            const baseGained = Number(data.collectedCount) || 0;
            const multiplier = this.roundData?.gameMultiplier || 1;
            const gained = baseGained * multiplier; // 배수 적용
            if (typeof this.awardExperience === "function") {
              console.log('[bellResult] invoking awardExperience', gained, '(base:', baseGained, 'x', multiplier, ')');
              this.awardExperience(gained);
            }
          }
        } catch (e) {
          console.warn("awardExperience failed", e);
        }
        /*this.time.delayedCall(500, () => {
          this.renderTable(this.roundData.players);
        });*/
      } else {
        // 실패 시 콤보 초기화
        if (this.comboState) {
          this.comboState.count = 0;
          this.comboState.lastWinnerId = null;
        }

        // 서버가 자물쇠 자동 사용으로 패널티를 면제했을 때 처리 (멀티 전용)
        if (data.autoLockUsedBy) {
          // 싱글플레이에서는 서버가 autoLockUsedBy 를 보내더라도 이를 무시합니다.
          if (!this.isSingle) {
            try {
              const nick = this.getNicknameById(data.autoLockUsedBy);

              // Prevent duplicate toast when the server also emits a specialUsed event.
              this._suppressNextLockToast = {
                id: data.autoLockUsedBy,
                timestamp: Date.now(),
              };
              // animation will arrive via specialUsed event shortly

              // 서버가 보낸 플레이어 목록으로 갱신
              if (Array.isArray(data.players) && data.players.length > 0) {
                // 💡 Preserve any open stacks the client already had, since server
                // may send players with emptied stacks. Similar to later lock
                // handling logic.
                this.roundData.players.forEach((oldPlayer) => {
                  const newPlayer = updatedPlayers.find((p) => p.id === oldPlayer.id);
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
          // 싱글플레이인 경우 autoLockUsedBy는 무시하고 패널티 처리를 계속 진행합니다.
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
              if (this.roundData && this.roundData.players)
                this.renderTable(this.roundData.players);
              return;
            }
          } catch (e) {
            console.warn("auto-lock parse error", e);
          }
        }

        // 2. 💡 패널티 애니메이션 호출 시 '이미 업데이트된' 데이터를 직접 넘김
        if (Array.isArray(updatedPlayers)) {
          this.playPenaltyAnimation({
            penaltyId: data.penaltyId,
            recipients: data.recipients,
            players: updatedPlayers, // 👈 중요!
          });
        } else {
          console.warn("playPenaltyAnimation called with invalid updatedPlayers", updatedPlayers);
        }

        // 💡 [수정] roundData 업데이트는 playPenaltyAnimation 내부에서 처리됨
        // this.roundData.players = updatedPlayers; (제거 - 바닥 카드 보존을 위해)
      }
    });

    socket.off("specialUsed").on("specialUsed", (data) => {
      try {
        if (!data) return;
        try {
          this.specialUsedThisTurn = this.specialUsedThisTurn || {};
          if (data.by) this.specialUsedThisTurn[data.by] = true;
        } catch (e) {}

        // 싱글플레이에서는 자물쇠/방패 효과를 무시합니다 (상점 아이템은 멀티 전용)
        if (!this.isSingle) {
          // 중앙 방패 애니메이션 제거; 대신 각 플레이어 위치에서 개별 효과를 표시함
          // (먹물에는 방패 효과가 없으므로 cardId 6은 무시)
          if (Number(data.cardId) !== 6 && Array.isArray(data.shielded) && data.shielded.length > 0) {
            data.shielded.forEach((id) => this.showShieldEffect(id));
          }
          // lock 카드(페널티 면제)도 바로 애니메이션
          if (Number(data.cardId) === 4 && data.by) {
            this.showLockEffect(data.by);
          }
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
                if (!this.isSingle && Array.isArray(data.shielded) && data.shielded.length > 0) {
                  data.shielded.forEach((id) => this.showShieldEffect(id));
                }
              } catch (e) {
                console.warn("specialUsed merge error", e);
              }
            },
          });
          return;
        }

        // 왕 카드 사용 연출: 서버가 보낸 대상(target) 또는 recipients[0]를 사용
        if (Number(data.cardId) === 8 && data.by) {
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
                    if (!this.isSingle && Array.isArray(data.shielded) && data.shielded.length > 0) {
                      data.shielded.forEach((id) => this.showShieldEffect(id));
                    }
                  }
                  // message toast omitted for special card.

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
          try {
            // 서버가 보낸 플레이어 상태가 있으면 병합합니다.
            // 서버는 openCardStack에 blockcard를 추가해 보낼 수 있으므로,
            // 가능하면 서버의 openCardStack을 클라이언트 openStack에 즉시 반영합니다.
            if (Array.isArray(data.players) && data.players.length > 0) {
              this.roundData.players.forEach((oldPlayer) => {
                const newPlayer = data.players.find((p) => p.id === oldPlayer.id);
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

            // 블록/실드 효과는 멀티에서만 적용합니다. 싱글플레이에서는 UI만 갱신.
            if (!this.isSingle) {
              // 서버가 전달한 effectId가 있으면 등록(클라이언트가 중복으로 openStack을 변경하지 않도록 함)
              if (data.effectId) {
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
                data.shielded.forEach((id) => this.showShieldEffect(id));
              }
            } else {
              // 싱글플레이: block/shield 효과는 적용하지 않음. UI만 반영했으므로 렌더만 끝냄.
              this.renderTable(this.roundData.players);
            }
            // message toast omitted for special card.

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
        if (data.message) {
          // For auto-lock, bellResult already shows a toast; suppress the
          // duplicate toast from specialUsed.
          if (
            Number(data.cardId) === 4 &&
            this._suppressNextLockToast &&
            this._suppressNextLockToast.id === data.by &&
            Date.now() - (this._suppressNextLockToast.timestamp || 0) < 2000
          ) {
            this._suppressNextLockToast = null;
          } else {
            this.showToast(data.message, "#2ecc71");
          }
        }
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
      this._renderTableScheduled = false; // 게임 종료 시 다음 게임 시작을 위해 스케줄 상태 초기화
      // 결과 텍스트/시상 연출과 같은 최종 단계가 시작됐음을 즉시 표시
      this.isResultTextVisible = true;
      const isMultiplayerWin = !this.isSingle && data && data.winnerId === socket.id;
      // Count multiplayer participation once per match. It should only increase when
      // the match has fully ended (to prevent double-counting due to rejoining/restarting).
      if (!this.isSingle && !this._hasCountedMultiPlayForMatch) {
        this._hasCountedMultiPlayForMatch = true;
        if (typeof this.incrementMultiQuestCounter === "function") {
          this.incrementMultiQuestCounter("multi_play", 1);
        }
      }

      // mark game ended to avoid terminal bell events affecting ratio
      this.isGameEnded = true;
      console.debug('gameEnded flag set', { time: Date.now(), isGameEnded: this.isGameEnded });

      if (isMultiplayerWin) {

        // Use the class prototype method if possible (to avoid instance overrides).
        const protoInc =
          GameScene?.prototype?.incrementMultiQuestCounter ||
          LobbyScene?.prototype?.incrementMultiQuestCounter;
        if (typeof protoInc === "function") {
          protoInc.call(this, "multi_win", 1);
        } else if (typeof this.incrementMultiQuestCounter === "function") {
          this.incrementMultiQuestCounter("multi_win", 1);
        } else {
          this.incrementMultiQuestCounterFallback("multi_win", 1);
        }

      } else if (!this.isSingle && data) {
        // debug: report why win wasn't counted
      }
      if (data && data.serverDebug) {
        data.serverDebug.forEach((ln) => console.log("  ", ln));
      }
      if (data && data.avetimeById) {
      }
      // sync final average reaction time when match ends
      // Prefer instance method `this.emitInventory` when available; fall back
      // to a global `emitInventory` if present. Protect against ReferenceError.

      // allow next match to recompute ratio properly
      this.isGameEnded = true;
      console.debug('gameEnded flag reaffirmed', { time: Date.now(), isGameEnded: this.isGameEnded });
      // Avoid pushing bell stats to server; accuracy data is local-only.
      // (Local storage updates are handled in updateBellAccuracy.)
      // Ensure any AI timers/actions are stopped when match ends so
      // they don't leak into subsequent matches while result UI is shown.
      try {
        if (this._aiTurnWatchTimer) {
          try { this._aiTurnWatchTimer.remove(); } catch (e) {}
          this._aiTurnWatchTimer = null;
        }
        if (this._aiAutoNotifyTimer) {
          try { this._aiAutoNotifyTimer.remove(); } catch (e) {}
          this._aiAutoNotifyTimer = null;
        }
        if (this._aiStuckChecker) {
          try { this._aiStuckChecker.remove(); } catch (e) {}
          this._aiStuckChecker = null;
        }
        this._aiTurnWatchRetries = 0;
        // mark AI as paused while showing results
        this._aiPaused = true;
      } catch (e) {}

      // 💡 즉시 띄우지 않고 1~1.5초 정도 여유를 줌
      this.time.delayedCall(100, () => {
        this.playFinishAnimation(() => {
          // 🔴 [중요] 결과창 진입 직전 모든 지연된 코인 적용
          try {
            console.log('🎮 [gameEnd] 결과창 진입 전 지연된 코인 적용', {
              deferredCoins: this._deferredCoinsDelta,
              isSingle: this.isSingle
            });
            this.applyDeferredCoins();
          } catch (e) {
            console.warn('[gameEnd] applyDeferredCoins 실패', e);
          }

          if (this.isSingle) {
            // 싱글 플레이는 전용 결과창을 사용.
            this.showSingleResultOverlay(data.ranking, data.result || "WIN");
          } else {
            this.showResultOverlay(data.ranking, false, data);
          }
        });
      });
    });

    // Respond to server's request for a final profile sync (include experience)
    socket.off("requestProfileSync").on("requestProfileSync", (payload) => {
      try {
        const currentLevel = Number(this.myProfile?.level) || 1;
        const currentExperience = Number(this.myProfile?.experience) || 0;
   
        // Send a dedicated final sync event so the server can reliably
        // update finalizeGame values even if the normal sync path is skipped.
        socket.emit("finalProfileSync", {
          reason: "final",
          level: currentLevel,
          experience: currentExperience,
          nickname: this.myProfile?.nickname || localStorage.getItem("nickname"),
          id: socket.id,
        });

        // Also attempt to sync other profile fields (coins/items), but do not
        // require the server profile snapshot for this particular emit.
        try {
          if (typeof this.emitInventory === 'function') {
            this.emitInventory('final', { includeExperience: true, requireServerProfile: false });
          } else if (typeof emitInventory === 'function') {
            emitInventory('final', { includeExperience: true, requireServerProfile: false });
          }
        } catch (e) {
          console.warn('requestProfileSync emitInventory skipped', e);
        }
      } catch (e) {
        console.warn("requestProfileSync handler failed", e);
      }
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
      console.debug("[moveToLobby] 호출", {
        isSingle: this.isSingle,
        isRoomOpen: this.isRoomOpen,
        roundRoomId: this.roundData?.roomId,
        currentRoomId: this.currentRoomId,
      });

      if (typeof this.currentGamePopupCloseHandler === "function") {
        this.currentGamePopupCloseHandler();
        return;
      }

      this.showCustomAlert("코인 및 경험치를 포기하고\n로비로 이동합니다!", () => {
        // 바로 로비로 전환 (지연 없이), 백그라운드로 leaveRoom만 발송.
        try {
          this.scene.start("LobbyScene", { preventAutoStartSingleAfterTutorial: true });
        } catch (e) {
          console.warn("moveToLobby: immediate LobbyScene start failed", e);
          this.scene.start("LobbyScene");
        }

        if (socket && socket.connected && this.roundData?.roomId) {
          try {
            socket.emit("leaveRoom", { roomId: this.roundData.roomId });
          } catch (e) {
            console.warn("moveToLobby: background leaveRoom emit failed", e);
          }
        }
      });
    };

    // 홈 버튼 (나가기)
    const exitBtn = this.add
      .image(width * 0.13, height * 0.077, "home")
      .setDisplaySize(width * 0.07, width * 0.07)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);

    // During tutorial, hide/disable the lobby exit button to prevent leaving mid-tutorial.
    if (this.isTutorialMode) {
      exitBtn.setVisible(false).disableInteractive();
    }

    // Keep a ref so we can restore it after tutorial completes.
    this.tutorialExitBtn = exitBtn;

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
    // Prevent renderTable from being called repeatedly in the same frame.
    // This reduces stutter when many network updates arrive quickly.
    if (this._renderTableScheduled) {

      this._renderTableLatestPlayers = players;
      return;
    }
    this._renderTableScheduled = true;
    this._renderTableLatestPlayers = players;

    this.time.delayedCall(0, () => {
      this._renderTableScheduled = false;
      if (this._renderTableLatestPlayers) {
        this._renderTableImmediate(this._renderTableLatestPlayers);
      }
    });

  }

  _renderTableImmediate(players) {
    if (
      !players ||
      !this.playerTableGroup ||
      !this.cameras ||
      !this.cameras.main ||
      !this.scene
    ) {
      try {
        console.warn("_renderTableImmediate: skipping render due to missing context", {
          playersPresent: !!players,
          playerTableGroup: !!this.playerTableGroup,
          cameras: !!this.cameras,
          camerasMain: !!this.cameras?.main,
          scene: !!this.scene,
          sceneActive: !!(this.scene && typeof this.scene.isActive === 'function' ? this.scene.isActive() : false),
        });
      } catch (e) {}
      return;
    }
    try {
  
    } catch (e) {}
    
    
    this.playerTableGroup.removeAll(true);
    
    
    if (this.playerTableGroup) {
      this.playerTableGroup.setVisible(true).setAlpha(1).setDepth(1000);
      try {
        this.children.bringToTop(this.playerTableGroup);
      } catch (e) {}
    }
    
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

      try {
      } catch (e) {}

      this.drawPlayerInfo(p, layout);
      this.drawPlayerDeck(p, layout); // 💡 여기서 숫자가 그려짐
      this.drawSpecialCards(p, layout); // 특수카드 표시

      // Always render the open stack + current open card (if exists).
      // This prevents the open card from disappearing mid-flip.
      const stackToRender = Array.isArray(p.openStack) ? p.openStack : [];
      this.drawOpenCard(stackToRender, layout, {
        isFlipping: p.isFlipping,
        currentCard: p.openCard,
      });
    });

    // =============================================
    // 바닥 카드 총합 표시 (화면 중앙)
    // =============================================
    const totalStackCount = players.reduce((sum, p) => {
      return sum + (p.openStack ? p.openStack.length : 0);
    }, 0);
    

    // 매 프레임 렌더 이후 턴 효과 업데이트 (현재 턴 강조)
    if (typeof this.updateTurnEffect === "function") {
      this.updateTurnEffect();
    }

    const cx = width * 0.5;
    const cy = height * 0.465;
    
    // ✅ 배수 정보는 항상 표시 (카드 제출 여부 상관없이)
    const multiplier = this.roundData?.gameMultiplier || 1;
    const multiplierTxt = this.add
      .text(cx, cy - width * 0.11, `${multiplier}배 판`, {
        fontFamily: "Jua",
        fontSize: `${width * 0.035}px`,
        color: "#FFD700",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.playerTableGroup.add(multiplierTxt);
    

    // 카드 합계는 0보다 클 때만 표시
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
        .setDepth(2000);  // 뎁스를 훨씬 높게
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
      if (this.timeAttackUrgentTween) {
        this.timeAttackUrgentTween.stop();
        this.timeAttackUrgentTween = null;
      }
      if (this._timeAttackOverTween) {
        this._timeAttackOverTween.stop();
        this._timeAttackOverTween = null;
      }
      if (this._timeAttackOverBlinkTween) {
        this._timeAttackOverBlinkTween.stop();
        this._timeAttackOverBlinkTween = null;
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

    if (remainingSec <= 0) {
      // Time over: show a message, bounce, and blink
      this.timeAttackText.setText("타임오버");
      this.timeAttackText.setColor("#ff3b30");
      this.timeAttackText.setTint(0xff3b30);

      // stop urgent tween if running
      if (this.timeAttackUrgentTween) {
        this.timeAttackUrgentTween.stop();
        this.timeAttackUrgentTween = null;
      }

      if (!this._timeAttackOverTween) {
        this._timeAttackOverTween = this.tweens.add({
          targets: this.timeAttackText,
          scale: 1.3,
          duration: 250,
          yoyo: true,
          repeat: -1,
          ease: "Back.easeOut",
        });
      }

      if (!this._timeAttackOverBlinkTween) {
        this._timeAttackOverBlinkTween = this.tweens.add({
          targets: this.timeAttackText,
          alpha: 0.3,
          duration: 250,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else if (remainingSec <= 10) {
      this.timeAttackText.setColor("#ff3b30");
      this.timeAttackText.setTint(0xffffff);
      if (this._timeAttackOverTween) {
        this._timeAttackOverTween.stop();
        this._timeAttackOverTween = null;
      }
      if (this._timeAttackOverBlinkTween) {
        this._timeAttackOverBlinkTween.stop();
        this._timeAttackOverBlinkTween = null;
      }
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
      this.timeAttackText.setTint(0xffffff);
      if (this.timeAttackUrgentTween) {
        this.timeAttackUrgentTween.stop();
        this.timeAttackUrgentTween = null;
      }
      if (this._timeAttackOverTween) {
        this._timeAttackOverTween.stop();
        this._timeAttackOverTween = null;
      }
      if (this._timeAttackOverBlinkTween) {
        this._timeAttackOverBlinkTween.stop();
        this._timeAttackOverBlinkTween = null;
      }
      this.timeAttackText.setScale(1);
      this.timeAttackText.setAlpha(1);
    }
  }

  updateTurnEffect() {
    const myId = this.myId || (socket && socket.id) || (this.isSingle ? "PLAYER_ME" : null);
    const currentTurnId = this.roundData.players[this.turnIndex]?.id;
    const isMyTurn = currentTurnId === myId;
    const isCurrentHumanTurn = isMyTurn;

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

      const activeDeck =
        this.playerDeckSprites && currentTurnId
          ? this.playerDeckSprites[currentTurnId]
          : null;

      if (activeDeck && activeDeck.active) {
        this.applyDeckPulse(activeDeck);
      }

      // 카드 영역을 강조 (내 턴 알리기) — 싱글/멀티 모두에서 myDeck을 찾아서 펄스 적용
      try {
        const myDeck =
          (this.playerDeckSprites && myId && this.playerDeckSprites[myId]) ||
          this.myDeckSprite;
        if (myDeck && myDeck.active) {
          this.applyDeckPulse(myDeck);
        }
      } catch (e) {
        try { if (this.myDeckSprite) this.myDeckSprite.clearTint(); } catch (err) {}
      }
    } else {
      if (this.turnOverlay) {
        this.turnOverlay.destroy();
        this.turnOverlay = null;
      }
      this.clearDeckPulse();
      if (this.turnDeckSprite && this.turnDeckSprite.active) {
        try { this.turnDeckSprite.clearTint(); } catch (e) {}
      }
      if (this.myDeckSprite && this.myDeckSprite.active) {
        try { this.myDeckSprite.clearTint(); } catch (e) {}
      }
      this.turnDeckSprite = null;
    }
  }

  applyDeckPulse(deck) {
    if (!deck || !deck.active) return;

    // if we're switching targets, clear tint on old target
    try {
      if (this.deckPulseTarget && this.deckPulseTarget !== deck) {
        try { this.deckPulseTarget.clearTint(); } catch (e) {}
      }
    } catch (e) {}

    if (this.deckPulseTween) {
      try { this.deckPulseTween.stop(); } catch (e) {}
      this.deckPulseTween = null;
    }
    this.deckPulseTarget = deck;

    const sc = 0xffffff;
    const ec = 0x2ecc71;
    const sr = (sc >> 16) & 0xff;
    const sg = (sc >> 8) & 0xff;
    const sb = sc & 0xff;
    const er = (ec >> 16) & 0xff;
    const eg = (ec >> 8) & 0xff;
    const eb = ec & 0xff;

    this.deckPulseTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 700,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        try {
          const v = tween.getValue() / 100;
          const r = Math.round(sr + (er - sr) * v);
          const g = Math.round(sg + (eg - sg) * v);
          const b = Math.round(sb + (eb - sb) * v);
          const color = (r << 16) | (g << 8) | b;
          if (deck && deck.active) {
            deck.setTint(color);
          }
          // small probe log when tint is set
        
        } catch (e) {}
      },
    });
    // Immediately apply an initial tint so user sees the effect even if
    // tween callbacks haven't run yet due to timing/scheduling.
    try {
      const immediateColor = ec; // end color (green)
      if (deck && deck.setTint) {
        deck.setTint(immediateColor);
      }
    } catch (e) {
    }
  }

  clearDeckPulse() {
    if (this.deckPulseTween) {
      try { this.deckPulseTween.stop(); } catch (e) {}
      this.deckPulseTween = null;
    }
    try {
      if (this.deckPulseTarget) {
        try { this.deckPulseTarget.clearTint(); } catch (e) {}
        this.deckPulseTarget = null;
      }
    } catch (e) {}
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

    // ✅ 배수 애니메이션이 진행 중이면 타이머를 시작하지 않음
    if (this._multiplierAnimationPlaying) {
      console.log("⏸️ 배수 애니메이션 진행 중 - 카드 제출 타이머 시작 차단");
      return;
    }

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
      this.handleFlipCard();
    });
  }

  drawPlayerInfo(p, layout) {
    try {
    } catch (e) {}
    const { width } = this.cameras.main;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const isMe = p.id === myId;

    // 현재 방 데이터에서 턴 인덱스에 해당하는 플레이어인지 확인
    if (typeof this.turnIndex !== "number") this.turnIndex = 0;

    const isMyTurn = this.roundData.players[this.turnIndex]?.id === p.id;
    const cardCount =
      Number.isFinite(Number(p.cards))
        ? Number(p.cards)
        : Number.isFinite(Number(p.remainingCards))
        ? Number(p.remainingCards)
        : p.myDeck && Array.isArray(p.myDeck)
        ? p.myDeck.length
        : 0;
    //const isEliminated = cardCount === 0;
    const isEliminated = p.isEliminated ?? false;

    const nameOffset = 160;

    // 1. 닉네임 텍스트 설정
    let displayNickname =
      p.nickname || p.name || p.playerName || p.id || "플레이어";
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
      // Ensure deck pulse is synced with nickname animation. Delayed
      // by 0 ticks so it runs after drawPlayerDeck (which may run after
      // drawPlayerInfo in some render flows).
      try {
        this.time.delayedCall(0, () => {
          try {
            // Do not apply visual turn pulse for AI/bot players
            if (typeof this.isPlayerAi === 'function' && this.isPlayerAi(p.id)) return;
            const deck = this.playerDeckSprites && p && this.playerDeckSprites[p.id];
            if (deck && deck.active) {
              this.applyDeckPulse(deck);
            } else if (isMe && this.myDeckSprite && this.myDeckSprite.active) {
              this.applyDeckPulse(this.myDeckSprite);
            }
          } catch (e) {}
        });
      } catch (e) {}
    }

    this.playerTableGroup.add(nameTxt);
  }

  drawPlayerDeck(p, layout) {
    const { width } = this.cameras.main;

    const myId = this.isSingle ? this.myId || "PLAYER_ME" : (this.myId || (socket && socket.id));
    const isMe = p.id === myId;

    const cardCount = p.cards !== undefined ? p.cards : p.remainingCards || 0;

    const deck = this.add
      .image(layout.x, layout.y, "card_back")
      .setDisplaySize(width * 0.14, width * 0.20)
      .setTint(isMe ? 0x7ae1ff : 0xffffff);

    if (!this.playerDeckSprites) {
      this.playerDeckSprites = {};
    }
    const prevDeck = this.playerDeckSprites[p.id];
    this.playerDeckSprites[p.id] = deck;
    if (prevDeck && prevDeck !== deck) {
      try { prevDeck.clearTint(); } catch (e) {}
      try { if (prevDeck.destroy && typeof prevDeck.destroy === 'function') prevDeck.destroy(); } catch (e) {}
    }

    if (isMe) {
      this.myDeckSprite = deck;
      if (typeof this.profileCard !== 'undefined') {
        this.time.delayedCall(0, () => {
          if (typeof this.repositionProfileCard === 'function') {
            this.repositionProfileCard();
          }
        });
      }
    }

    const currentTurnId = this.roundData?.players?.[this.turnIndex]?.id;
    const isMyTurn = currentTurnId === myId;

    if (isMyTurn && isMe) {
      // ensure pulse applied after any immediate layout changes
      this.time.delayedCall(0, () => this.applyDeckPulse(deck));
    } else if (isMe) {
      this.clearDeckPulse();
      try { deck.clearTint(); } catch (e) {}
    }

    if (isMe && cardCount > 0) {
      deck.setInteractive({ useHandCursor: true });
      deck.on("pointerdown", () => {
        try { this.handleFlipCard(); } catch (e) {}
        this.tweens.add({
          targets: deck,
          scale: "*=0.95",
          duration: 50,
          yoyo: true,
        });
      });
    }

    const countTxt = this.add
      .text(layout.x, layout.y, cardCount, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(101);

    this.playerTableGroup.add([deck, countTxt]);
  }

  repositionProfileCard() {
    // move profile card to the right of my deck and make visible
    if (!this.profileCard || !this.myDeckSprite) return;
    const baseMargin = Math.max(this.cameras.main.width * 0.02, 12);
    const extraOffset = Math.max(this.cameras.main.width * 0.02, 24); // push further right
    //const newX = this.myDeckSprite.x + this.myDeckSprite.displayWidth / 2 + baseMargin + extraOffset;
    const newX = this.myDeckSprite.x + this.myDeckSprite.displayWidth * 2;

    const newY = this.myDeckSprite.y;
    this.profileCard.setPosition(newX, newY);
    if (!this.profileCard.visible) this.profileCard.setVisible(true);
  }

  drawPlayerDeck(p, layout) {
    const { width } = this.cameras.main;

    const resolvedMyId = this.isSingle ? this.myId || "PLAYER_ME" : (this.myId || (socket && socket.id));
    const isMe = p.id === resolvedMyId; // 내 카드인지 확인

    // 💡 카드 장수 결정 로직 통일
    const cardCount = p.cards !== undefined ? p.cards : p.remainingCards || 0;

    const deck = this.add
      .image(layout.x, layout.y, "card_back")
      .setDisplaySize(width * 0.14, width * 0.20)
      .setTint(isMe ? 0x7ae1ff : 0xffffff);

    // Keep mapping from player ID to deck sprite for turn effects.
    if (!this.playerDeckSprites) {
      this.playerDeckSprites = {};
    }
    this.playerDeckSprites[p.id] = deck;

    if (isMe) {
      // keep reference for later animation (also used by existing logic)
      this.myDeckSprite = deck;
      // once my deck exists, reposition the profile card above and to the right of it
      if (typeof this.profileCard !== 'undefined') {
        // delay a tick to ensure container sizes are available
        this.time.delayedCall(0, () => {
          if (typeof this.repositionProfileCard === 'function') {
            this.repositionProfileCard();
          }
        });
      }
    }
    if (isMe && cardCount > 0) {
      deck.setInteractive({ useHandCursor: true });
      deck.on("pointerdown", () => {
        try { this.handleFlipCard(); } catch (e) {}
        // 살짝 눌리는 효과 (피드백)
        this.tweens.add({
          targets: deck,
          scale: "*=0.95",
          duration: 50,
          yoyo: true,
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

    const currentTurnId = this.roundData?.players?.[this.turnIndex]?.id;
    const isCurrentTurn = p.id === currentTurnId;
    // resolvedMyId already defined at top of drawPlayerDeck
    // const isMe is already defined above, so no redeclaration.

    if (isMe && isCurrentTurn && !p.isEliminated) {
      this.applyDeckPulse(deck);
    } else if (isMe) {
      this.clearDeckPulse();
      try { deck.clearTint(); } catch (e) {}
    }

    this.playerTableGroup.add([deck, countTxt]);

    // draw stamp if player has been eliminated at any point
    if (p.isEliminated || p._eliminatedStamp) {
      // mark the flag so future draws know player was eliminated
      p._eliminatedStamp = true;
      // only draw once per deck sprite creation
      if (!deck.getData("elimStamped")) {
        deck.setData("elimStamped", true);
        const stampRadius = width * 0.065;
        const stamp = this.add
          .circle(layout.x, layout.y, stampRadius, 0xb91c1c, 0.18)
          .setStrokeStyle(4, 0xef4444, 0.85)
          .setDepth(12)
          .setAngle(-10)
          .setScale(1); // immediately visible
        const stampText = this.add
          .text(layout.x, layout.y, "탈락", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.04}px`,
            color: "#dc2626",
            fontWeight: "bold",
            stroke: "#ffffff",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(13)
          .setAngle(-10)
          .setScale(1);

        this.playerTableGroup.add([stamp, stampText]);
        // no animation, just static label
      }
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
              // 이미 특수카드를 사용한 경우 별도 토스트 없이 차단
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

  drawOpenCard(openStack, layout, options = {}) {
    if (!Array.isArray(openStack)) return;
    const { width } = this.cameras.main;

    const player = this.roundData.players.find(
      (p) => p.openStack === openStack,
    );
    const currentCard = options.currentCard || (player ? player.openCard : null);

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

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);

    // 기본 카드 뭉치 중앙 위치
    const baseX = layout.x + Math.cos(rad) * dist * 0.7;
    const baseY = layout.y + Math.sin(rad) * dist;

    const fullStack = stackToDraw;
    const cardsToDraw = fullStack; // 항상 전체 스택을 그립니다

    // blockcard가 항상 최상단에 보이도록, 일반 카드와 blockcard를 분리하여 그립니다.
    const normalCards = cardsToDraw.filter((c) => !(c && c.type === "blockcard"));
    const blockCards = cardsToDraw.filter((c) => c && c.type === "blockcard");

    // If there is a current card (not yet added to the stack), draw it last.
    // (currentCard variable is already set above)

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

      const alpha = 1;

      if (this.textures.exists(cardKey)) {
        const openCardImg = this.add
          .image(baseX + offsetX, baseY + offsetY, cardKey)
          .setDisplaySize(width * 0.18, width * 0.25)
          .setDepth(150 + index)
          .setAlpha(alpha);

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
          .setDepth(150 + index)
          .setAlpha(alpha);

        const thunderIcon = this.add
          .text(baseX + offsetX, baseY + offsetY, "⚡", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.12}px`,
            color: "#ffffff",
          })
          .setOrigin(0.5)
          .setDepth(151 + index)
          .setAlpha(alpha);

        this.playerTableGroup.add([thunderCardBg, thunderIcon]);
      }
    });

    // 3) 현재 오픈 카드(아직 스택에 들어가지 않은 카드)가 있다면
    //    열어둔 카드 위에 새로 표시합니다. (플립 애니메이션 후에 설정됩니다)
    if (currentCard) {
      const cardKey = this.getCardKey(currentCard);
      const offsetX = 0;
      const offsetY = 0;
      if (this.textures.exists(cardKey)) {
        const openCardImg = this.add
          .image(baseX + offsetX, baseY + offsetY, cardKey)
          .setDisplaySize(width * 0.18, width * 0.25)
          .setDepth(160 + (normalCards.length || 0));
        this.playerTableGroup.add(openCardImg);
      }
    }

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

    // 정답 플레이어명 및 획득 카드 텍스트 표시
    const winnerPlayer = players[winIdx] || {};
    const winnerName =
      data.winnerNickname || winnerPlayer.nickname || winnerPlayer.name || "플레이어";
    const gainedCards =
      typeof data.collectedCount === "number"
        ? data.collectedCount
        : Math.max(
            0,
            (players[winIdx]?.cards || 0) - (prevPlayers?.find((p) => p.id === winnerId)?.cards || 0),
          );

    // Only show win text for real players (not AI/bots)
    if (!this.isPlayerAi(winnerId)) {
      const winInfoText = this.add
        .text(targetPos.x, targetPos.y, `${winnerName}님 정답! ${gainedCards}장 획득!`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${Math.round(width * 0.07)}px`,
          color: "#ffff00",
          stroke: "#000000",
          strokeThickness: 6,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(10011)
        .setAlpha(0);

      this.tweens.add({
        targets: winInfoText,
        alpha: 1,
        y: height * 0.35,
        duration: 250,
        ease: "Power2.easeOut",
        yoyo: true,
        hold: 1700,
        repeat: 0,
        onComplete: () => {
          if (winInfoText) {
            winInfoText.destroy();
          }
        },
      });
    }

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
        console.log("[playWinAnimation] avatarKey:", avatarKey, "winnerId:", winnerId);

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
            .setDepth(11100)
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
          console.log("[playWinAnimation] baseTexture:", baseTexture, "exists:true");
          try {
            tempSprite.setTexture(baseTexture);
            this.applyAvatarAnimation(tempSprite, avatarKey);
            try {
              console.log('[playWinAnimation] postApply animState', tempSprite.anims && { isPlaying: tempSprite.anims.isPlaying, currentAnim: tempSprite.anims.currentAnim && tempSprite.anims.currentAnim.key, currentFrame: tempSprite.anims.currentFrame && tempSprite.anims.currentFrame.textureKey });
            } catch (e) {}
            try {
              if (tempSprite.anims) {
                if (!tempSprite.anims.currentAnim) {
                    const fallbackAnim = this.ensureAvatarAnimation(avatarKey);
                    console.log('[playWinAnimation] fallbackAnim:', fallbackAnim);
                    if (fallbackAnim) {
                      try {
                        tempSprite.play(fallbackAnim, true);
                      } catch (e) {
                        console.warn("fallback play failed", e);
                      }
                    }
                  }
                const anim = tempSprite.anims.currentAnim;
                if (anim) {
                  anim.repeat = 0;
                }
              }
            } catch (e) {
              console.warn("win avatar anim start failed", e);
            }
            const clearFlag = () => {
              this.avatarAnimInProgress = false;
              hideWinAvatar();
              characterAnimationDone = true;
              checkAllAnimationsComplete();
            };
            tempSprite.off("animationcomplete");
            tempSprite.once("animationcomplete", () => {
              console.log('[playWinAnimation] animationcomplete fired for', avatarKey);
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

    // In singleplayer, avoid running two overlapping card-flight animations for the same player.
    if (this.isSingle && data.playerId) {
      this._singleFlipInProgress = this._singleFlipInProgress || {};
      if (this._singleFlipInProgress[data.playerId]) return;
      this._singleFlipInProgress[data.playerId] = true;
    }

    // If optimistic flips are enabled, and we have an optimistic animation
    // for this player, coordinate server data with that animation. If
    // optimistic flips are disabled, always run the server-driven animation
    // so multiplayer matches singleplayer flow.
    if (this.useOptimisticFlip && !this.isSingle && data.playerId && this._optimisticFlipById && this._optimisticFlipById[data.playerId]) {
      const state = this._optimisticFlipById[data.playerId];
      if (!state.done) {
        // animation still running: hold server data until arrival
        state.serverData = data;
        return;
      }
      // animation already finished: apply server state and clean up
      this.applyFlipServerData(data);
      delete this._optimisticFlipById[data.playerId];
      return;
    }
    const { width, height } = this.cameras.main;
    const cardKey = this.getCardKey(data.card);
    if (data?.card?.type === THUNDER_CARD_TYPE) {
      // thunder is special: enable bell interaction in case the player
      // tries to tap the bell manually. the server will also process the
      // win automatically, so we do not apply the normal special-card
      // pause here (it would only delay the next flip).
      this.allowBellBecauseThunder = true;
      this.time.delayedCall(500, () => {
        this.allowBellBecauseThunder = false;
      });
    }

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
    if (!player) {
      if (this.isSingle && data.playerId && this._singleFlipInProgress) {
        delete this._singleFlipInProgress[data.playerId];
      }
      return;
    }

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
      .setDepth(2000); // 날아가는 카드를 항상 다른 바닥 카드 위에 렌더

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

    this.tweens.add({
      targets: tempCard,
      x: startPos.x + Math.cos(rad) * dist * 0.7 + targetOffsetX,
      y: startPos.y + Math.sin(rad) * dist + targetOffsetY,
      duration: 100 * (this.animationDurationMultiplier || 1), // 모바일 최적화: 동적 애니메이션 시간
      ease: "Power2.out",
      onComplete: () => {
        // 💡 애니메이션 종료 후: 싱글플레이는 이미 openStack에 추가되어 있으므로
        // 추가/대체 로직을 실행하지 않습니다.
        if (!this.isSingle) {
          if (!player.openStack) player.openStack = [];

          // 서버에서 전체 스택을 주지 않은 경우 수동 push, 줬으면 이미 위에서 세팅됨
          if (!data.openCardStack) {
            player.openStack.push(data.card);
          } else {
            player.openStack = data.openCardStack;
          }
        }

        player.isFlipping = false;

// 싱글플레이는 openStack이 이미 업데이트되어 있으므로 별도 처리가 필요 없습니다.

        // Apply pending cards after animation finishes.
        if (data.playerId) {
          const p = this.roundData.players.find((pl) => pl.id === data.playerId);
          if (p) {
            // 1) If singleplayer had a pending flip, apply it.
            if (this.isSingle) {
              const pending =
                this._pendingSingleFlip && this._pendingSingleFlip[data.playerId];
              if (pending) {
                if (!p.openStack || !Array.isArray(p.openStack)) p.openStack = [];
                p.openStack.push(pending);
                p.openCard = pending; // apply the card after animation completes
                delete this._pendingSingleFlip[data.playerId];
              }
            }

            // 2) For multiplayer: if server sent an open stack earlier, apply it now.
            if (!this.isSingle) {
              this._pendingServerOpenStackById =
                this._pendingServerOpenStackById || {};
              const pendingStack =
                this._pendingServerOpenStackById[data.playerId];
              if (pendingStack) {
                p.openStack = Array.isArray(pendingStack)
                  ? pendingStack.slice()
                  : [];
                delete this._pendingServerOpenStackById[data.playerId];
              } else {
                // fallback: if server didn't send a stack, push the card from animation data
                if (!p.openStack) p.openStack = [];
                if (!data.openCardStack) p.openStack.push(data.card);
                else p.openStack = data.openCardStack;
              }

              // Match singleplayer behavior: set current openCard to played card.
              p.openCard = data.card;
            }
          }
        }

        // In singleplayer, allow another flip animation after this one finishes.
        if (this.isSingle && data.playerId && this._singleFlipInProgress) {
          delete this._singleFlipInProgress[data.playerId];
        }

        // 간단히 날아가도록: 중간에 색상 변경이나 크기 변화를 하지 않고 바로 정리
        try { tempCard.destroy(); } catch (e) {}

        // 마지막으로 전체(새 카드 포함) 렌더링
        this.renderTable(this.roundData.players);

        // 싱글플레이 시, 카드가 바닥에 깔린 직후에 AI가 종을 칠지 평가합니다.
        // (카드가 실제로 반영된 이후로 호출되어야 합니다.)
        if (this.isSingle) {
          this.checkFruitCountForAI();
        }
      },
    });
  }

  applyFlipServerData(data) {
    if (!data || !this.roundData || !Array.isArray(this.roundData.players)) return;
    const player = this.roundData.players.find((p) => p.id === data.playerId);
    if (!player) return;

    // If the player is currently running a flip animation, queue the server
    // update to be applied after animation completes so visual order is correct.
    if (player.isFlipping && !this.isSingle) {
      this._pendingServerOpenStackById = this._pendingServerOpenStackById || {};
      if (data.openCardStack) this._pendingServerOpenStackById[data.playerId] = data.openCardStack;
      else this._pendingServerOpenStackById[data.playerId] = [data.card];
      return;
    }

    if (!player.openStack) player.openStack = [];
    if (data.openCardStack) {
      player.openStack = data.openCardStack;
    } else {
      player.openStack.push(data.card);
    }

    // Keep current card in sync as in singleplayer.
    player.openCard = data.card;

    player.isFlipping = false;
    this.renderTable(this.roundData.players);
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

  
      const hasTexture =
        this.textures && this.textures.exists && this.textures.exists("shield");
      if (!hasTexture) console.warn("[debug] shield texture not available");

      const shieldSprite = this.add
        .image(baseX, specialY, "shield")
        .setDisplaySize(10, 10)
        .setDepth(600000)
        .setAlpha(0)
        .setScale(0);

      // pop-in + fade-out effect (longer so user can see)
      this.tweens.add({
        targets: shieldSprite,
        alpha: 1,
        scale: 0.5,
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

      const hasTextureLock =
        this.textures && this.textures.exists && this.textures.exists("lock");
      if (!hasTextureLock) console.warn("[debug] lock texture not available");

      const lockSprite = this.add
        .image(baseX, lockY, "lock")
        .setDisplaySize(10, 10)
        .setDepth(600000)
        .setAlpha(0)
        .setScale(0);

      this.tweens.add({
        targets: lockSprite,
        alpha: 1,
        scale: 0.5,
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

      const bg = this.add.rectangle(0, 0, 520, 220, 0x000000, 0.75);
      bg.setStrokeStyle(3, 0xffffff, 0.08);
      const img = this.add.image(-170, 0, imageKey).setDisplaySize(150, 150);
      const titleText = this.add
        .text(-80, -32, title, { font: "45px Arial", color: "#ffffff", fontStyle: 'bold' })
        .setOrigin(0, 0.5);
      const subText = this.add
        .text(-80, 35, subtitle, {
          font: "30px Arial",
          color: "#ffffff",
          wordWrap: { width: 350 },
        })
        .setOrigin(0, 0.5);

      container.add([bg, img, titleText, subText]);
      container.setAlpha(0);
      container.setScale(0.85);

      this.tweens.add({
        targets: container,
        alpha: 1,
        scale: 1.05,
        duration: 560,
        ease: "Back.out",
        onComplete: () => {
          // 잠깐 유지 후 사라짐
          this.time.delayedCall(1000, () => {
            this.tweens.add({
              targets: container,
              alpha: 0,
              scale: 1.0,
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

  showLevelUpEffect(prevLevel, newLevel) {
    try {
      console.debug("showLevelUpEffect", prevLevel, "->", newLevel);
      const camera = this.cameras.main;
      const centerX = camera ? camera.midPoint.x : this.scale.width * 0.5;
      const centerY = camera ? camera.midPoint.y : this.scale.height * 0.4;
      const effectContainer = this.add.container(centerX, centerY);
      effectContainer.setDepth(1000000);
      effectContainer.setAlpha(0);
      effectContainer.setScrollFactor(0);

      const glow = this.add
        .circle(0, 0, 115, 0xffff00, 0.26)
        .setDepth(1000001)
        .setAlpha(0)
        .setScrollFactor(0);

      const text = this.add
        .text(0, 0, `레벨 업! Lv.${newLevel}`, {
          font: "56px Arial",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 6,
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(1000002)
        .setScale(0.75)
        .setAlpha(0)
        .setScrollFactor(0);

      effectContainer.add([glow, text]);

      this.tweens.add({
        targets: effectContainer,
        alpha: 1,
        duration: 180,
        ease: "Cubic.easeOut",
      });

      this.tweens.add({
        targets: glow,
        alpha: 0.8,
        scale: 1.7,
        duration: 420,
        ease: "Back.out",
      });

      this.tweens.add({
        targets: text,
        scale: 1.2,
        alpha: 1,
        duration: 300,
        ease: "Back.out",
        yoyo: true,
        hold: 520,
      });

      this.time.delayedCall(1000, () => {
        this.tweens.add({
          targets: effectContainer,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            try {
              effectContainer.destroy();
            } catch (e) {}
          },
        });
      });

      // 꽃가루 파티클 폭발 (레벨업 텍스트 중심)
      const particleColors = ["#f9a8d4", "#a78bfa", "#67e8f9", "#fcd34d", "#fb7185"];
      const particleCount = 24;
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = 160 + Math.random() * 220;
        const hex = particleColors[i % particleColors.length];
        const colorNum = Number(`0x${hex.replace('#', '')}`);
        const particle = this.add
          .circle(centerX, centerY, 8 + Math.random() * 8, colorNum, 1)
          .setDepth(1000005)
          .setScrollFactor(0);

        const tx = centerX + Math.cos(angle) * speed;
        const ty = centerY + Math.sin(angle) * speed;

        this.tweens.add({
          targets: particle,
          x: tx,
          y: ty,
          alpha: 0,
          scale: 0.5,
          duration: 700 + Math.random() * 200,
          ease: "Power2.easeOut",
          onComplete: () => {
            try {
              particle.destroy();
            } catch (e) {}
          },
        });
      }
    } catch (e) {
      console.warn("showLevelUpEffect error", e);
    }
  }

  showCoinBurst(targetX, targetY, amount = 0) {
    try {
      const burstDepth = 1000005;
      const burstCount = 20;
      const coinRadius = 7;

      // 중앙 코인 아이콘 점핑
      const coinCenter = this.add
        .image(targetX, targetY, "coin")
        .setDisplaySize(coinRadius * 7, coinRadius * 7)
        .setDepth(burstDepth)
        .setScrollFactor(0)
        .setScale(0.1)
        .setAlpha(0);

      this.tweens.add({
        targets: coinCenter,
        alpha: 1,
        scale: 1.2,
        duration: 180,
        ease: "Back.out",
        onComplete: () => {
          this.tweens.add({
            targets: coinCenter,
            alpha: 0,
            scale: 0.7,
            duration: 220,
            delay: 160,
            onComplete: () => coinCenter.destroy(),
          });
        },
      });

      // 파티클 꽃가루 폭발
      const colors = ["#f59e0b", "#facc15", "#fdba74", "#f97316", "#fde68a"];
      for (let i = 0; i < burstCount; i += 1) {
        const angle = (Math.PI * 2 * i) / burstCount;
        const speed = 90 + Math.random() * 180;
        const particle = this.add
          .circle(targetX, targetY, coinRadius * (0.45 + Math.random() * 0.65), colors[i % colors.length], 1)
          .setDepth(burstDepth)
          .setScrollFactor(0);

        const destX = targetX + Math.cos(angle) * speed;
        const destY = targetY + Math.sin(angle) * speed;

        this.tweens.add({
          targets: particle,
          x: destX,
          y: destY,
          alpha: 0,
          scale: 0.4,
          duration: 650 + Math.random() * 150,
          ease: "Cubic.easeOut",
          onComplete: () => {
            try {
              particle.destroy();
            } catch (e) {}
          },
        });
      }

      // 숫자 텍스트 표시
      if (amount > 0) {
        const amountText = this.add
          .text(targetX, targetY - 40, `+${amount}`, {
            fontFamily: GAME_FONTS.main,
            fontSize: "38px",
            color: "#fde68a",
            stroke: "#f97316",
            strokeThickness: 4,
            fontWeight: "bold",
          })
          .setOrigin(0.5)
          .setDepth(burstDepth + 1)
          .setScrollFactor(0);

        this.tweens.add({
          targets: amountText,
          y: targetY - 80,
          alpha: 0,
          scale: 1.3,
          duration: 900,
          ease: "Sine.easeOut",
          onComplete: () => {
            try {
              amountText.destroy();
            } catch (e) {}
          },
        });
      }
    } catch (e) {
      console.warn("showCoinBurst error", e);
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
      //this.showToast(`${cardName} 카드를 사용 요청합니다...`, "#f39c12");
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
          //this.showToast(`${cardName} 사용 요청을 보냈습니다.`, "#f39c12");
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
          .setDisplaySize(width * 0.15, width * 0.22)
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

    if (this.isSingle && !this.isTutorialMode) {
      // Ensure participation is counted even if the start-time increment did not run.
      if (
        !this._hasIncrementedSinglePlayQuest &&
        typeof this.incrementMultiQuestCounter === "function"
      ) {
        this.incrementMultiQuestCounter("single_play", 1);
        this._hasIncrementedSinglePlayQuest = true;
      }

      if (result === "WIN") {
        this.handleQuestEvent("gameWin");
        if (typeof this.incrementMultiQuestCounter === "function") {

          this.incrementMultiQuestCounter("single_win", 1);
        }
      }
    }
    if (!this.isSingle && result === "WIN") {
      // Multiplayer win
      if (typeof this.incrementMultiQuestCounter === "function") {
        this.incrementMultiQuestCounter("multi_win", 1);
      }
    }

    // 💡 모든 타이머 중지 (AI의 뒤집기나 종치기 등)
    this.time.removeAllEvents();

    // 1. 결과 정렬: 생존자(비탈락) 우선, 그다음 카드 장수, 마지막으로 바닥 카드 갯수로 비교
    const sortedPlayers = [...this.roundData.players].sort((a, b) => {
      const aAlive = (!a.isEliminated && (Number(a.cards) || 0) > 0) ? 1 : 0;
      const bAlive = (!b.isEliminated && (Number(b.cards) || 0) > 0) ? 1 : 0;
      if (aAlive !== bAlive) return bAlive - aAlive; // 생존자 먼저

      const aCards = Number(a.cards) || 0;
      const bCards = Number(b.cards) || 0;
      if (aCards !== bCards) return bCards - aCards; // 카드 많은 순

      const aFloor = (Array.isArray(a.openStack) ? a.openStack.length : 0) + (a.openCard ? 1 : 0);
      const bFloor = (Array.isArray(b.openStack) ? b.openStack.length : 0) + (b.openCard ? 1 : 0);
      return bFloor - aFloor; // 바닥 카드 많은 순
    });

    // 2. 종료 연출(FINISH!) 실행 후 결과창 노출 (멀티플레이 결과창과 동일하게)
    this.playFinishAnimation(() => {
      // 🔴 [중요] 결과창 진입 직전 모든 지연된 코인 적용
      try {
        console.log('🎮 [singleplayGameEnd] 결과창 진입 전 지연된 코인 적용 시작', {
          deferredCoins: this._deferredCoinsDelta,
          currentCoins: Number(this.myProfile?.coins) || 0
        });
        this.applyDeferredCoins();
        console.log('✅ [singleplayGameEnd] 모든 지연 코인 적용 완료', {
          finalCoins: Number(this.myProfile?.coins) || 0
        });
      } catch (e) {
        console.warn('[singleplayGameEnd] applyDeferredCoins 실패', e);
      }

      // 멀티플레이 결과창과 동일한 podium/캐릭터 연출을 재활용
      this.showResultOverlay(sortedPlayers.slice(0, 3), false, {
        result,
      });

      const myId = this.myId || socket?.id || "PLAYER_ME";
      const hasPremiumBear =
        typeof this.isPremiumBearUnlocked === "function"
          ? this.isPremiumBearUnlocked()
          : false;

      // More robust detection + diagnostics when tutorial-origin single games
      const winnerId = sortedPlayers[0] && sortedPlayers[0].id;
      const playersList = Array.isArray(this.roundData?.players) ? this.roundData.players.map(p => ({ id: p.id, nickname: p.nickname })) : [];
      const resolvedMyId = myId || (playersList[0] && playersList[0].id) || null;

      const normalizedResult = typeof result === 'string' ? result.toUpperCase() : result;
      const isWin = normalizedResult === 'WIN' || normalizedResult === 'WON';

      const iAmWinner = !!(
        winnerId &&
        resolvedMyId &&
        String(winnerId) === String(resolvedMyId)
      );

      // If winner detected as me, show reward popup for tutorial-origin single games.
      // Reward should cover both pure tutorial-mode games and the follow-up single game after tutorial.
      const tutorialRewardEligible =
        this.isSingle && (this.isTutorialMode || this.fromTutorial);
      if (isWin && iAmWinner && tutorialRewardEligible) {

        const alreadyOwned = !!hasPremiumBear;

        // Ensure reward is unlocked locally even if user doesn't click the popup.
        if (!alreadyOwned) {
          const safeUnlockPremiumBear = () => {
            try {
              if (typeof this.unlockPremiumBear === "function") {
                this.unlockPremiumBear();
                return;
              }
            } catch (e) {
            }

            // Fallback: directly update profile + localStorage
            try {
              if (!this.myProfile) this.myProfile = {};
              if (!Array.isArray(this.myProfile.owned_characters)) {
                this.myProfile.owned_characters = [];
              }
              if (!this.myProfile.owned_characters.includes(PREMIUM_BEAR_KEY)) {
                this.myProfile.owned_characters.push(PREMIUM_BEAR_KEY);
              }
              try {
                localStorage.setItem(
                  "ownedCharacters",
                  JSON.stringify(this.myProfile.owned_characters),
                );
              } catch (e) {
                // ignore
              }
            } catch (e) {
              console.warn("[premium] auto-unlock failed (fallback)", e);
            }
          };

          safeUnlockPremiumBear();
        }

        const showPremiumPopupWithFallback = () => {

          try {
            if (typeof this.showPremiumBearAcquiredPopup === 'function') {
              this.showPremiumBearAcquiredPopup();
              return;
            }
          } catch (e) {
          }

          const fallbackToInline = () => {
            if (typeof this.createInlinePremiumBearPopup === 'function') {
              try {
                this.createInlinePremiumBearPopup();
                return true;
              } catch (e) {
              }
            }

            if (typeof window !== 'undefined' && typeof window.__halemale_showPremiumBearAcquiredPopup === 'function') {
              try {
                window.__halemale_showPremiumBearAcquiredPopup();
                return true;
              } catch (e) {
              }
            }

            if (typeof document !== 'undefined') {
              try {
                const id = 'halemale-premium-popup-fallback';
                if (!document.getElementById(id)) {
                  const wrapper = document.createElement('div');
                  wrapper.id = id;
                  Object.assign(wrapper.style, {
                    position: 'fixed',
                    left: '0',
                    top: '0',
                    right: '0',
                    bottom: '0',
                    background: 'rgba(0,0,0,0.92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2147483647,
                    color: '#fff',
                    padding: '20px',
                    textAlign: 'center',
                  });
                  const inner = document.createElement('div');
                  inner.innerHTML = '<div style="font-size:22px;margin-bottom:12px;color:#ffd700;">플레이어 2 획득!</div><div style="margin-bottom:18px;">싱글 승리 보상입니다. 계속하려면 닫기 버튼을 눌러주세요.</div>';
                  const button = document.createElement('button');
                  button.textContent = '닫기';
                  Object.assign(button.style, { padding: '10px 16px', fontSize: '16px', borderRadius: '4px', cursor: 'pointer' });
                  button.addEventListener('click', () => { wrapper.remove(); });
                  inner.appendChild(button);
                  wrapper.appendChild(inner);
                  document.body.appendChild(wrapper);
                }
                return true;
              } catch (e) {
                console.warn('[premium] DOM fallback failed', e);
              }
            }
            return false;
          };

          const didFallback = fallbackToInline();
          if (!didFallback) {
            console.warn('[premium] no reward popup function available after fallback');
          }
        };
        // Wait for avatar texture to be available to avoid showing missing-texture box.
        const showAcquiredPopupWithRetry = (attempts = 0) => {
          try {
            const candidates = [
              (this.getAvatarDisplayKey && this.getAvatarDisplayKey(PREMIUM_BEAR_KEY)),
              PREMIUM_BEAR_KEY,
              PREMIUM_BEAR_KEY + '_1',
              PREMIUM_BEAR_KEY + '_sprite_a',
              PREMIUM_BEAR_KEY + '_frame_1',
              'player_1',
            ];
            let found = false;
            for (const k of candidates) {
              if (!k) continue;
              try {
                if (this.textures && typeof this.textures.exists === 'function' && this.textures.exists(k)) {
                  found = true;
                  break;
                }
              } catch (e) {}
            }

            if (found || attempts >= 20) {
              // proceed to show popup (either valid texture found or max attempts reached)
              showPremiumPopupWithFallback();
              return;
            }

            // retry shortly to wait for assets to load
            const delay = 100; // ms
            if (this.time && typeof this.time.delayedCall === 'function') {
              this.time.delayedCall(delay, () => showAcquiredPopupWithRetry(attempts + 1));
            } else {
              setTimeout(() => showAcquiredPopupWithRetry(attempts + 1), delay);
            }
          } catch (e) {
            // On error, fall back to direct call
            try { showPremiumPopupWithFallback(); } catch (err) {}
          }
        };

        showAcquiredPopupWithRetry(0);

        // Mark one-time tutorial-related premium reward as consumed.
        try {
          this.fromTutorial = false;
          localStorage.removeItem("pendingPremiumBearReward");
        } catch (e) {
          console.warn("clear premium bear reward flag failed", e);
        }
      }

      // Force-show for tutorial-origin single games as a fallback if popup didn't appear.
      try {
        if ((this.isTutorialMode || this.fromTutorial) && isWin && iAmWinner && !this._premiumBearPopupForcedShown) {
          console.debug('[premium] forcing acquired popup for tutorial game');
          this._premiumBearPopupForcedShown = true;
          try {
            if (typeof this.showPremiumBearAcquiredPopup === "function") {
              // small delay to allow result overlay animations to finish
              if (this.time && typeof this.time.delayedCall === "function") {
                this.time.delayedCall(200, () => { try { this.showPremiumBearAcquiredPopup(); } catch (e) {} });
              } else {
                setTimeout(() => { try { this.showPremiumBearAcquiredPopup(); } catch (e) {} }, 200);
              }
            }
          } catch (e) {
            console.warn('[premium] force show failed', e);
          }
        }
      } catch (e) {}
    });
  }

  returnToLobby(options = {}) {
    const rejoinRoom =
      typeof options.rejoinRoom === "boolean"
        ? options.rejoinRoom
        : !this.isSingle;
    const shouldLeaveRoom = options.leaveRoom === true;

    const preventAutoStart = () => {
      try {
        const lobbyScene = this.scene.get("LobbyScene");
        if (lobbyScene) {
          lobbyScene.preventAutoStartSingleAfterTutorial = true;
        }
      } catch (e) {
        // ignore if lobby scene isn't available
      }
    };

    if (
      shouldLeaveRoom &&
      this.roundData &&
      this.roundData.roomId
    ) {
      const roomId = this.roundData.roomId;

      const startLobbyScene = () => {
        preventAutoStart();
        this.scene.start("LobbyScene", {
          preventAutoStartSingleAfterTutorial: true,
        });
      };

      if (socket && socket.connected) {
        socket.emit("leaveRoom", { roomId }, startLobbyScene);
      } else {
        startLobbyScene();
      }
      return;
    }

    if (
      !rejoinRoom ||
      !this.roundData ||
      !this.roundData.roomId ||
      !socket ||
      !socket.connected
    ) {
      preventAutoStart();
      try {
        if (this.scene.isActive("GameScene")) {
          this.scene.stop("GameScene");
        }
      } catch (e) {
      }
      this.scene.start("LobbyScene", {
        preventAutoStartSingleAfterTutorial: true,
        fromSingle: this.isSingle,
      });
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

    // Ensure the game scene is stopped while we move to lobby/rejoin workflow.
    try {
      if (this.scene.isActive("GameScene")) {
        this.scene.stop("GameScene");
      }
    } catch (e) {
    }

    try {
      if (this.cameras && this.cameras.main) {
        this.cameras.main.setVisible(false);
      }
    } catch (e) {
      // ignore error
    }

    const storedNickname = localStorage.getItem("nickname") || "요리사";

    // Immediately switch to LobbyScene to avoid blank transition lag.
    this.scene.start("LobbyScene", {
      fromGame: true,
      roomId: this.roundData.roomId,
      players: this.roundData.players,
      hostId: this.roundData.hostId,
      maxPlayers: this.roundData.maxPlayers || 4,
      roomName: this.roundData.roomName || "대기실",
      preventAutoStartSingleAfterTutorial: true,
    });

    // Rejoin the room in background; lobby UI will be updated by LobbyScene listeners.
    if (socket && socket.connected && this.roundData?.roomId) {
      try {
        socket.emit("joinRoom", {
          roomId: this.roundData.roomId,
          nickname: storedNickname,
          avatarKey: this.avatarKey || "player_1",
        });
      } catch (e) {
      }
    }

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
    // 전체 카드 수는 startSingleGame()에서 설정한 initialCardCount를 따르도록.
    const initialCardCount = this.singleInitialCardCount || 20;
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
    this.ensureSingleTotalCards();
  }

  showSingleResultOverlay(players, result) {
    const { width, height } = this.cameras.main;

    // hide profile card while single-game result is showing
    if (this.profileCard) {
      this.profileCard.setVisible(false);
    }

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
      // reveal profile card again once the overlay is dismissed
      if (this.profileCard) {
        this.profileCard.setVisible(true);
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
      try {
        this.scene.start("LobbyScene", {
          preventAutoStartSingleAfterTutorial: true,
        });
      } catch (e) {
        console.warn("showSingleResultOverlay exit to lobby failed", e);
        this.returnToLobby({ rejoinRoom: false, leaveRoom: true });
      }
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

    // block all flips while a special‑card pause is active. previously we
    // allowed flips when a thunder card was present (to let players keep
    // going during the pause), but that created a window where the client
    // would unlock after 1s while the server still hadn't advanced the
    // turn. the result was two submissions in a row. simply denying
    // flips until the pause expires prevents the problem and matches the
    // server's behaviour.
    if (this.isSpecialCardPauseActive && this.isSpecialCardPauseActive()) {
      return;
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


    // 내 차례 검증이 끝난 뒤에만 입력 잠금
    this.canClick = false;
    // Optimistic UX (멀티플레이 전용): play a quick 'prep' (backward) motion then immediately
    // animate a temp card flying to the open-stack area so user feels instant feedback.
    // Disabled when `this.useOptimisticFlip` is false so multiplayer uses the
    // same server-driven animation path as singleplayer.
    if (!this.isSingle && this.myDeckSprite && this.useOptimisticFlip) {
      const origY = this.myDeckSprite.y;
      // backward prep (opposite of submit direction)
      this.tweens.add({
        targets: this.myDeckSprite,
        y: origY + 12,
        duration: 70,
        ease: "Quad.easeOut",
        onComplete: () => {
          try {
            // compute target position mirroring playCardFlipAnimation logic
            if (!this.roundData || !Array.isArray(this.roundData.players)) return;
            const { width, height } = this.cameras.main;
            const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
            let myIndex = this.roundData.players.findIndex((p) => p.id === myId);
            if (myIndex === -1) myIndex = 0;
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

            const startPos = pos[0]; // for my view the open-area base is pos[0]
            const currentPlayer = this.roundData.players.find((p) => p.id === myId);
            const currentStackCount = currentPlayer && currentPlayer.openStack ? currentPlayer.openStack.length : 0;
            const step = 1;
            let targetOffsetX = 0;
            let targetOffsetY = 0;
            if (startPos.rotation === 0) targetOffsetY = -currentStackCount * step;
            else if (startPos.rotation === 90) targetOffsetX = currentStackCount * step;
            else if (startPos.rotation === 180) targetOffsetY = currentStackCount * step;
            else if (startPos.rotation === -90 || startPos.rotation === 270) targetOffsetX = -currentStackCount * step;

            const dist = width * 0.25;
            const rad = Phaser.Math.DegToRad(startPos.rotation - 90);
            const targetX = startPos.x + Math.cos(rad) * dist * 0.7 + targetOffsetX;
            const targetY = startPos.y + Math.sin(rad) * dist + targetOffsetY;

            // create a temp visual card from deck -> open area
            const tempCard = this.add
              .image(this.myDeckSprite.x, this.myDeckSprite.y, "card_back")
              .setDisplaySize(this.myDeckSprite.displayWidth, this.myDeckSprite.displayHeight)
              .setDepth(2000);

            // mark optimistic flip so the server-side animation is suppressed
            // and the local animation is used instead.
            this._optimisticFlipById = this._optimisticFlipById || {};
            this._optimisticFlipById[myId] = {
              done: false,
              serverData: null,
            };

            this.tweens.add({
              targets: tempCard,
              x: targetX,
              y: targetY,
              duration: 300,
              ease: "Cubic.out",
              onStart: () => {
                if (this.cache.audio.exists("pass")) {
                  this.sound.play("pass", { volume: 0.2 });
                }
              },
              onComplete: () => {
                try {
                  tempCard.destroy();
                } catch (e) {}

                // Multiplayer: coordinate with server update
                if (this._optimisticFlipById && this._optimisticFlipById[myId]) {
                  const state = this._optimisticFlipById[myId];
                  state.done = true;
                  // If server update already arrived, apply it now (so face animation happens after flight)
                  if (state.serverData) {
                    this.applyFlipServerData(state.serverData);
                    delete this._optimisticFlipById[myId];
                  }
                }
              },
            });
          } catch (e) {
            console.warn("optimistic flip failed", e);
          }
        },
      });
    }

    // --- 클라이언트 잠금 ---
    this.isFlipping = true;

    if (this.isSingle) {
      // In singleplayer we use the regular flip animation path (processSingleFlip)
      // and avoid the optimistic “temporary card flies” duplication.
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
      if (!hasThunder && !this.allowBellBecauseThunder) {
        return; // do not lock canClick yet
      }
    }

    if (this.isTutorialMode && this.tutorialState?.forbidBell) {
      this.showToast("폭탄 카드일 땐 종을 누를 수 없어요!", "#f97316");
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
          // 플레이어가 정답일 가능성이 높으므로 즉시 작은 성공 피드백만 재생합니다.
          // 전체 카드 획득 애니메이션은 서버의 `bellResult` 확정이 도착한 후에만 재생됩니다.
          this.playSuccessEffect();
          // lightweight local feedback for pressing the bell
          try {
            //this.showToast("종을 눌렀습니다. 결과를 기다리는 중...", "#f1c40f");
          } catch (e) {}
        } else {
          // 실패가 예상되었지만, 실제 패널티가 발생할지는 서버 판단에 따릅니다.
          // 따라서 '땡' 애니메이션은 서버에서 패널티가 확정된 후에만 재생됩니다.
          //this.playFeedback(false, "틀렸습니다.");
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

    // Load progress from localStorage so the player can resume where they left off.
    const savedProgress = this.loadTutorialProgress();

    this.tutorialState = {
      stageIndex: savedProgress?.stageIndex ?? 0,
      currentStageKey:
        TUTORIAL_STAGE_CONFIGS[savedProgress?.stageIndex ?? 0]?.key || "flip",
      pointerObjects: [],
      rewardCoins: Number.isFinite(rewardCoins) ? rewardCoins : 80,
      requireBellSuccess: false,
      expectedBellType: null,
      forbidBell: false,
      stageRewardsTotal: 0,
      completedStages: new Set(
        Array.isArray(savedProgress?.completedStages)
          ? savedProgress.completedStages
          : [],
      ),
      pendingTimers: [],
      pendingBombFollowup: false,
      awaitingPreThunderFlip: false,
      awaitingBombCover: false,
      awaitingWrongBellPlayerFlip: false,
      awaitingWrongBellAiFlip: false,
      requireWrongBellPenalty: false,
    };

    this.setTutorialStage(this.tutorialState.stageIndex || 0);
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

    // Persist progress so reloads reconnect to the same stage.
    this.saveTutorialProgress();

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
      this.clearTutorialProgress();
      this.showTutorialCompletionOverlay();
    }
  }

  rewardTutorialCoins(amount, reason) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!this.tutorialState) return;

    this.tutorialState.stageRewardsTotal =
      (this.tutorialState.stageRewardsTotal || 0) + amount;

    this.modifyCoins(Number(amount), { sync: true });

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

  loadTutorialProgress() {
    return loadTutorialProgress();
  }

  saveTutorialProgress() {
    saveTutorialProgress(this.tutorialState);
  }

  clearTutorialProgress() {
    clearTutorialProgress();
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
    // single-play quests should not spam toast notifications
    if (this.isSingle) return;
    this.showToast(
      `${state.title} 완료! 수령 버튼을 눌러 보상을 받아요.`,
      "#22c55e",
    );
  }

  ensureQuestCoinBurst() {
    if (typeof this.playQuestCoinBurst === "function") return;

    this.playQuestCoinBurst = (x, y, amount = 12) => {
      try {
        // 메인(출석보상+퀘스트)에서 사용하는 showCoinBurstEffect 스타일로 통일
        showCoinBurstEffect(this, x, y, amount);
      } catch (e) {
        console.warn("ensureQuestCoinBurst fallback failed", e);
        try {
          showCoinBurstEffect(this, x, y, amount);
        } catch (inner) {
          console.warn("ensureQuestCoinBurst final fallback failed", inner);
        }
      }
    };
  }

  handleQuestClaim(key) {
    console.debug("[handleQuestClaim] called", { key, questState: !!this.questState });
    this.ensureQuestCoinBurst();
    if (!this.questState) return;
    const state = this.getQuestRuntimeState(key);
    console.debug("[handleQuestClaim] state", { state });
    if (!state || !state.entry.ready) {
      if (!this.isSingle) {
        this.showToast("아직 수령할 보상이 없어요!", "#f97316");
      }
      return;
    }

    const { quest, entry, title } = state;
    const questKey = quest.key;
    if (quest.rewardCoins) {
      if (typeof this.ensureQuestCoinBurst === "function") {
        this.ensureQuestCoinBurst();
      }
      try {
        this.sound.play("bubble", { volume: 0.3 });
      } catch (e) {}
      let burstX = this.cameras.main.centerX;
      let burstY = this.cameras.main.centerY;
      if (this.questState && this.questState.rows) {
        const row = this.questState.rows[questKey];
        if (row && row.claimBtn) {
          const pt = row.claimBtn
            .getWorldTransformMatrix()
            .transformPoint(0, 0);
          burstX = pt.x;
          burstY = pt.y;
        }
      }
      if (typeof this.playQuestCoinBurst === "function") {
        this.playQuestCoinBurst(burstX, burstY, quest.rewardCoins);
      }
      this.rewardQuestCoins(quest.rewardCoins, title, questKey);
    } else {
      if (!this.isSingle) {
        this.showToast(`${title} 완료!`, "#22c55e");
      }
    }

    entry.stage = (entry.stage || 0) + 1;
    entry.count = 0;
    entry.ready = false;

    this.saveQuestProgressSnapshot();
    this.refreshQuestRow(questKey);

    const nextState = this.getQuestRuntimeState(questKey);
    if (nextState && !this.isSingle) {
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
        // keep backwards compatibility for any existing quest keys
        if (typeof eventKey === "string") {
          this.incrementQuestCounter(eventKey, 1);
        }
        break;
    }
  }

  rewardQuestCoins(amount, reason, questKey) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.modifyCoins(Number(amount), { sync: true });

    if (!this.isSingle) {
      this.showToast(`퀘스트 보상 ${amount}💰 (${reason})`, "#22c55e");
    }
    try {
      this.safeSyncInventory("questReward", {
        coins: amount,
        questKey,
      });
    } catch (e) {
      console.warn("quest reward sync failed", e);
    }
  }

  // 즉시 경험치 부여: 멀티플레이에서 카드 획득 시 호출
  awardExperience(amount) {
    try {
      console.log('[awardExperience] called with', amount, 'profile=', this.myProfile && { level: this.myProfile.level, experience: this.myProfile.experience });
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        console.log('[awardExperience] invalid amount', amount);
        return;
      }
      if (!this.myProfile) this.myProfile = {};
      const xpGain = Number(amount) || 0;
      const prevExpTotal = Number(this.myProfile.experience || 0);
      const prevLevel = Number(this.myProfile.level || 1) || 1;
      let newTotal = prevExpTotal + xpGain;
      let leveled = false;

      // 처리: 레벨업이 발생하면 레벨 증가 및 경험치 롤오버
      while (newTotal >= XP_PER_LEVEL) {
        newTotal -= XP_PER_LEVEL;
        this.myProfile.level = (Number(this.myProfile.level) || 1) + 1;
        leveled = true;
      }
      this.myProfile.experience = newTotal;

      // 로그: 갱신된 값
      console.log('[awardExperience] xpGain=', xpGain, 'newExp=', this.myProfile.experience, 'newLevel=', this.myProfile.level);

      // UI 즉시 갱신
      if (typeof this.updateMyProfileUI === "function") {
        this.updateMyProfileUI();
      }

      // 경험치 획득 애니메이션 (progress bar + floating text)
      // 항상 트윈/텍스트를 시도해서 보이지 않는 경우가 없도록 함.
      this.playExpGainAnimation(xpGain);

      // 떠오르는 +N XP 텍스트
      try {
        const expBounds =
          this.profileExpText && typeof this.profileExpText.getBounds === "function"
            ? this.profileExpText.getBounds()
            : null;
        const { width, height } = this.cameras.main;
        const hasVisibleBounds =
          expBounds &&
          expBounds.centerX >= 0 &&
          expBounds.centerX <= width &&
          expBounds.top >= 0 &&
          expBounds.top <= height;
        const x = hasVisibleBounds ? expBounds.centerX : width * 0.1;
        const y = hasVisibleBounds ? expBounds.top - 20 : height * 0.06;
        const txt = this.add
          .text(x, y, `+${xpGain} XP`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${this.cameras.main.width * 0.032}px`,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4,
            fontWeight: "bold",
          })
          .setOrigin(0.5)
          .setDepth(1000005)
          .setScrollFactor(0);
        this.tweens.add({
          targets: txt,
          y: y - 36,
          alpha: 0,
          duration: 900,
          ease: "Power1",
          onComplete: () => {
            try {
              txt.destroy();
            } catch (e) {}
          },
        });
      } catch (e) {
        /* ignore */
      }

      // 효과음: bubble
      try {
        if (this.cache && this.cache.audio && this.cache.audio.exists("bubble")) {
          this.sound.play("bubble", { volume: 0.45 });
        }
      } catch (e) {}

      // 서버 동기화
      try {
        this.safeSyncInventory("experienceGain", {
          experience: xpGain,
          level: Number(this.myProfile.level) || prevLevel,
        });
      } catch (e) {
        console.warn("experience sync failed", e);
      }

      // 레벨업 효과 애니메이션
      if (leveled) {
        const newLv = Number(this.myProfile.level) || prevLevel;
        this.showLevelUpEffect(prevLevel, newLv);
        console.debug(`level up effect triggered: Lv.${prevLevel} → Lv.${newLv}`);
      }
      this._hasAwardExperienceRun = true;
    } catch (e) {
      console.warn("awardExperience error", e);
    }
  }

  updateBellAccuracy({ correct = 0, total = 0 } = {}) {
    // 게임 종료 후 이벤트는 정확도에 반영하지 않는다.
    // isGameStarted 플래그는 멀티에서 event race로 때때로 false일 수 있으므로 생략.
    if (this.isGameEnded) {
      console.debug("updateBellAccuracy skipped because game ended", {
        correct,
        total,
        isGameEnded: this.isGameEnded,
        isGameStarted: this.isGameStarted,
      });
      return;
    }

    try {
      if (!this.bellStats) {
        this.bellStats = { correct: 0, total: 0 };
      }

      // If we already have server-loaded bell stats (from myProfile) but haven't
      // applied them yet (total still 0), apply them now so the first correct
      // doesn't jump to 100%.
      if (this.bellStats.total === 0) {
        const profileSource = this.myProfile || socket?.profile;
        const seededTotal = Number(profileSource?.bellTotal);
        const seededCorrect = Number(profileSource?.bellCorrect);
        if (Number.isFinite(seededTotal) && seededTotal > 0) {
          this.bellStats.total = seededTotal;
          this.bellStats.correct = Number.isFinite(seededCorrect)
            ? seededCorrect
            : 0;
        }
      }

      // DEBUG: log bell stats right before applying the new correct/total update
      console.debug("[DEBUG] updateBellAccuracy - before", {
        incoming: { correct, total },
        bellStats: { ...this.bellStats },
        socketProfile: socket?.profile,
      });

      this.bellStats.correct += Number(correct) || 0;
      this.bellStats.total += Number(total) || 0;
      const ratio = this.bellStats.total > 0
        ? Math.round((this.bellStats.correct / this.bellStats.total) * 100)
        : (Number(this.myProfile?.ratio) || 0);
      this.myProfile = this.myProfile || {};
      this.myProfile.ratio = ratio;
      if (this.isGameEnded && !this.isSingle) {
        console.debug('skip profileRatioTxt update (updateBellAccuracy) due to game end');
      } else if (this.profileRatioTxt && typeof this.profileRatioTxt.setText === "function") {
        const oldText = this.profileRatioTxt.text;
        const newText = `정답률: ${ratio}%`;
        if (oldText !== newText) {
          this.profileRatioTxt.setText(newText);

          // color animation: rise=red, fall=blue, then reset to white
          const prevRatio = Number(this.myProfile.ratio ?? 0);
          const currentRatio = Number(ratio);
          let highlightColor = "#ffffff";
          if (currentRatio > prevRatio) {
            highlightColor = "#ff4d4d"; // 상승: 빨간
          } else if (currentRatio < prevRatio) {
            highlightColor = "#4da6ff"; // 하락: 파랑
          }
          try {
            // kill previous tweens/timeouts so we can always re-run
            this.tweens.killTweensOf(this.profileRatioTxt);
            if (this._ratioColorTimeout) {
              clearTimeout(this._ratioColorTimeout);
              this._ratioColorTimeout = null;
            }
            this.profileRatioTxt.setScale(1);
            if (highlightColor !== "#ffffff") {
              this.profileRatioTxt.setColor(highlightColor);
              this._ratioColorTimeout = setTimeout(() => {
                if (this.profileRatioTxt && typeof this.profileRatioTxt.setColor === "function") {
                  this.profileRatioTxt.setColor("#ffffff");
                }
                this._ratioColorTimeout = null;
              }, 550);
            }
            this.tweens.add({
              targets: this.profileRatioTxt,
              scaleX: 1.15,
              scaleY: 1.15,
              duration: 140,
              yoyo: true,
              ease: "Sine.easeOut",
            });
          } catch (e) {
            // ignore if tweens are unavailable
          }
        }
      }

      // Persist bell accuracy locally and do not sync ratio to server.
      try {
        localStorage.setItem("bellCorrect", String(this.bellStats.correct));
        localStorage.setItem("bellTotal", String(this.bellStats.total));
        localStorage.setItem("bellRatio", String(ratio));
      } catch (e) {
        console.warn("updateBellAccuracy localStorage save failed", e);
      }
      if (typeof window !== "undefined") {
        window.bellStats = { ...this.bellStats };
      }
    } catch (e) {
      console.warn("updateBellAccuracy failed", e);
    }
  }

  playExpGainAnimation(xpGain) {
    // highlight and pulse the exp bar
    const hasBar = this.profileExpBarFill && this.profileExpText;
    if (hasBar) {
      try {
        if (typeof this.profileExpBarFill.setVisible === "function") {
          this.profileExpBarFill.setVisible(true);
        }
        if (typeof this.profileExpText.setVisible === "function") {
          this.profileExpText.setVisible(true);
        }
        if (typeof this.profileExpBarFill.setDepth === "function") {
          this.profileExpBarFill.setDepth(13000);
        }
        if (typeof this.profileExpText.setDepth === "function") {
          this.profileExpText.setDepth(13001);
        }

        this.tweens.killTweensOf(this.profileExpBarFill);
        this.tweens.add({
          targets: this.profileExpBarFill,
          alpha: { from: 1, to: 0.4 },
          duration: 220,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
        });
      } catch (e) {
        /* ignore */
      }
    }

    // floating text feedback (uses bar position if available)
    try {
      const expBounds =
        this.profileExpText && typeof this.profileExpText.getBounds === "function"
          ? this.profileExpText.getBounds()
          : null;
      const { width, height } = this.cameras.main;
      const hasVisibleBounds =
        expBounds &&
        expBounds.centerX >= 0 &&
        expBounds.centerX <= width &&
        expBounds.top >= 0 &&
        expBounds.top <= height;
      const baseX = hasVisibleBounds ? expBounds.centerX : width * 0.5;
      const baseY = hasVisibleBounds ? expBounds.top - 10 : height * 0.15;
      console.log("[EXP ANIM] playing at", { baseX, baseY, xpGain, hasBar });
      const txt = this.add
        .text(baseX, baseY, `+${xpGain} XP`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${this.cameras.main.width * 0.032}px`,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 4,
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(1000005)
        .setScrollFactor(0);

      this.tweens.add({
        targets: txt,
        y: baseY - 60,
        alpha: 0,
        scale: { from: 1, to: 1.25 },
        duration: 1600,
        ease: "Sine.easeOut",
        onComplete: () => {
          try {
            txt.destroy();
          } catch (e) {}
        },
      });
    } catch (e) {
      /* ignore */
    }

    // If EXP bar isn't available, no toast is shown by design (level-up effect handled visually).
    if (!hasBar) {
      console.log('[EXP GAIN] no bar available, skip toast fallback', xpGain);
    }
  }

  scheduleExpGainAnimation(xpGain) {
    if (!Number.isFinite(xpGain) || xpGain <= 0) return;

    if (this.profileExpBarFill) {
      this.playExpGainAnimation(xpGain);
      return;
    }

    if (!Array.isArray(this._pendingExpGainAnimations)) {
      this._pendingExpGainAnimations = [];
    }
    this._pendingExpGainAnimations.push(xpGain);
  }

  flushPendingExpGainAnimations() {
    if (!Array.isArray(this._pendingExpGainAnimations) || !this._pendingExpGainAnimations.length) {
      return;
    }
    const pending = [...this._pendingExpGainAnimations];
    this._pendingExpGainAnimations = [];
    pending.forEach((xpGain) => {
      try {
        this.playExpGainAnimation(xpGain);
      } catch (e) {
        console.warn("flushPendingExpGainAnimations failed", e);
      }
    });
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

    // Outer ring (expanded, semi-transparent) for clear touch guidance
    const outerRing = this.add
      .circle(pos.x, pos.y, width * 0.12, 0xfff1b8, 0.20)
      .setStrokeStyle(8, 0xffd44f, 0.95)
      .setDepth(9001);
    this.tutorialState.pointerObjects.push(outerRing);
    this.tweens.add({
      targets: outerRing,
      scale: { from: 0.9, to: 1.2 },
      alpha: { from: 0.5, to: 0.1 },
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const innerCircle = this.add
      .circle(pos.x, pos.y, width * 0.08, 0xffffff, 0.35)
      .setStrokeStyle(6, 0xfcc419, 0.95)
      .setDepth(9002);
    this.tutorialState.pointerObjects.push(innerCircle);
    this.tweens.add({
      targets: innerCircle,
      scale: { from: 0.95, to: 1.05 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const arrow = this.add
      .text(pos.x, pos.y - width * 0.12, "👇", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.12}px`,
        color: "#fffbeb",
        stroke: "#8b5cf6",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(9003);
    this.tutorialState.pointerObjects.push(arrow);
    this.tweens.add({
      targets: arrow,
      y: pos.y - width * 0.07,
      duration: 560,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const label = this.add
      .text(pos.x, pos.y, "여기를 눌러주세요", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.04}px`,
        color: "#ffffff",
        backgroundColor: "rgba(255, 148, 58, 0.9)",
        padding: { x: 10, y: 6 },
        align: "center",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(9004);
    this.tutorialState.pointerObjects.push(label);
    this.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0.6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  handleTutorialAfterFlip(playerId, card) {
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
          description: "과일이 5개 되면 종을 눌러요.",
        });
        const tutor = this.roundData.players.find((p) => p.id !== myId);
        if (tutor) {
          this.scheduleTutorialFlip(tutor.id, 3000);
        }
        return;
      }

      if (!isMe && this.tutorialState.expectingAiFive) {
        // The card for this flip may not yet be reflected in openCard/openStack
        // when this handler runs, so we add it manually for tutorial checks.
        const totals = this.calculateTotalFruits();
        const player = this.roundData.players.find((p) => p.id === playerId);
        const plus1Active = this.hasPlus1OnTable();
        const plus2Active = this.hasPlus2OnTable ? this.hasPlus2OnTable() : false;
        const extraPerCard = (plus1Active ? 1 : 0) + (plus2Active ? 2 : 0);

        const applyCard = (card, sign = 1) => {
          if (
            !card ||
            !Number.isFinite(Number(card.fruit)) ||
            !Number.isFinite(Number(card.count))
          )
            return;
          const fruit = Number(card.fruit);
          const count = Number(card.count);
          totals[fruit] = Math.max(0, (totals[fruit] || 0) + sign * (count + extraPerCard));
        };

        // Subtract the current top card's contribution if it exists.
        const currentTop =
          player && Array.isArray(player.openStack) && player.openStack.length > 0
            ? player.openStack[player.openStack.length - 1]
            : player && player.openCard
            ? player.openCard
            : null;
        applyCard(currentTop, -1);
        applyCard(card || null, 1);

        const hasFive = Object.values(totals).some((count) => count === 5);
        const hasBomb = this.hasBombOnTable();
        if (hasFive && !hasBomb) {
          this.tutorialState.expectingAiFive = false;
          this.tutorialState.requireBellSuccess = true;
          this.tutorialState.expectedBellType = "ringFive";
          this.showTutorialMessage({
            title: "지금이 기회!",
            description: "종을 눌러 카드를 획득하세요!",
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
          "종을 눌러 카드를 획득하세요!",
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
            "AI가 한 장을 더 내려줄 때까지 기다려요.",
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
          title: "패널티 체험하기",
          description:
            "합계가 5가 아닐때 종을 누르면 패널티 받아요!",
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
          title: "번개카드는 선착순 누르기",
          description:
            "번개가 나오면 종을 눌러요.(단,폭탄이 없는 경우에만)",
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
      // When an AI flips a card, openStack/openCard may not yet include it.
      // We need to calculate totals as if the flip is already visible.
      const cardTotal = (c) => {
        if (
          !c ||
          !Number.isFinite(Number(c.fruit)) ||
          !Number.isFinite(Number(c.count))
        )
          return null;
        return { fruit: Number(c.fruit), count: Number(c.count) };
      };

      const plus1Active =
        this.hasPlus1OnTable() || (card && card.type === PLUS1_CARD_TYPE);
      const plus2Active =
        (this.hasPlus2OnTable ? this.hasPlus2OnTable() : false) ||
        (card && card.type === PLUS2_CARD_TYPE);
      const extraPerCard = (plus1Active ? 1 : 0) + (plus2Active ? 2 : 0);

      const totals = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const applyTotals = (c) => {
        const t = cardTotal(c);
        if (!t) return;
        totals[t.fruit] = (totals[t.fruit] || 0) + t.count + extraPerCard;
      };

      // count current visible table
      this.roundData.players.forEach((p) => {
        if (!p) return;
        const top =
          Array.isArray(p.openStack) && p.openStack.length > 0
            ? p.openStack[p.openStack.length - 1]
            : p.openCard;
        applyTotals(top);
      });

      // Ensure the flipped card is considered if it affects totals (e.g. fruit card)
      if (card && card.type !== PLUS1_CARD_TYPE && card.type !== PLUS2_CARD_TYPE) {
        applyTotals(card);
      }

      const hasFive = Object.values(totals).some((count) => count === 5);
      const hasBomb = this.hasBombOnTable();
      if (hasFive && !hasBomb) {
        this.tutorialState.requireBellSuccess = true;
        this.tutorialState.expectedBellType = "plus1";
        this.showTutorialMessage({
          title: "+1 효과!",
          description:
            "+1이 적용되어 5가 되었습니다. 종을 눌러보세요!",
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
          "폭탄이 나오면 절대 누르지 마세요!",
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
            "카드를 제출해 폭탄을 제거하세요!",
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
          "즉시 종을 쳐서 카드를 획득하세요!",
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
          "이제 바닥 모든 카드 숫자에 +1이 적용됩니다.",
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

    const self = this;

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
    const awardedItems = {
      4: 1, // 자물쇠 1개
    };
    const rewardText = this.add
      .text(
        width / 2,
        height * 0.53,
        `우승하고 보상을 받아보세요`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          color: "#22c55e",
          fontWeight: "bold",
          stroke: "#000",
          strokeThickness: 5,
        },
      )
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
        // 튜토리얼 후 첫 싱글 승리 시 명품곰돌이 지급 보장 플래그
        localStorage.setItem("pendingPremiumBearReward", "true");
      } catch (e) {
        console.warn("failed to set pendingPremiumBearReward", e);
      }

      try {
        // Give coins + a starter special card (lock) for completing the tutorial.
        this.safeSyncInventory("tutorialReward", {
          coins: reward,
          specialCards: awardedItems,
        });

        // Also persist locally for immediate UI state.
        try {
          const localSpecial =
            JSON.parse(localStorage.getItem("specialCards") || "{}") || {};
          Object.entries(awardedItems).forEach(([id, count]) => {
            localSpecial[id] = (Number(localSpecial[id]) || 0) + Number(count);
          });
          localStorage.setItem("specialCards", JSON.stringify(localSpecial));
        } catch (e) {
          console.warn("failed to persist tutorial special cards", e);
        }
      } catch (e) {
        console.warn("tutorial reward sync failed", e);
      }

      // 화면 중앙에서 코인 폭발 애니메이션 실행 (토스트 제거)
      try {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const burstAmount = Math.min(25, Math.max(12, Math.round(reward / 4)));
        if (typeof this.playQuestCoinBurst === "function") {
          this.playQuestCoinBurst(centerX, centerY, burstAmount);
        }
      } catch (e) {
        console.warn("tutorial coin burst failed", e);
      }

      this.isGameStarted = false;
      this.canClick = false;
      this.time.removeAllEvents();

      container.destroy();

      const beginSingleEasy = () => {
        this.scene.start("LobbyScene", {
          fromTutorial: true,
          tutorialCompleted: true,
          rewardCoins: reward,
          autoStartSingle: true,
        });
      };

      // 항상 튜토리얼 완료 후에는 보상 안내 팝업을 보여주고
      // 확인 버튼을 누른 뒤에 싱글플레이가 시작되도록 합니다.
      if (typeof self.showPremiumBearIntroPopup === "function") {
        self.showPremiumBearIntroPopup(beginSingleEasy);
      } else {
        // 폴백: helper가 없는 경우 간단한 확인 팝업을 직접 띄워서
        // 사용자가 명시적으로 확인할 때만 싱글이 시작되게 합니다.
        try {
          const { width, height } = this.cameras.main;
          const overlay = this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.92)
            .setInteractive();
          /*const panel = this.add
            .rectangle(width / 2, height / 2, width * 0.78, height * 0.65, 0x111111, 0.96)
            .setStrokeStyle(2, 0xffffff, 0.25);*/
          const txt = this.add
            .text(
              width / 2,
              height * 0.63,
              "싱글플레이에서 1등을 하면 획득할 수 있어요!",
              {
                fontFamily: GAME_FONTS.main,
                fontSize: `${width * 0.037}px`,
                color: "#ffffff",
                align: "center",
                wordWrap: { width: width * 0.64 },
                stroke: "#000000",
                strokeThickness: 4,
              },
            )
            .setOrigin(0.5);
          const btn = this.add
            .image(width / 2, height * 0.73, "ui_btn")
            .setDisplaySize(width * 0.38, height * 0.08)
            .setTint(0x22c55e)
            .setInteractive({ useHandCursor: true });
          const btnTxt = this.add
            .text(width / 2, height * 0.73, "확인", {
              fontFamily: GAME_FONTS.main,
              fontSize: `${width * 0.05}px`,
              color: "#ffffff",
              fontWeight: "bold",
              stroke: "#000000",
              strokeThickness: 5,
            })
            .setOrigin(0.5);

          // Show player_2 icon in the reward intro fallback.
          const createFallbackRewardIcon = () => {
            const iconSize = Math.min(width * 0.5, height * 0.45);
            const resolvedKey =
              typeof this.getValidCharacterTextureKey === "function"
                ? this.getValidCharacterTextureKey("player_2")
                : null;
            if (resolvedKey) {
              return this.add
                .image(width / 2, height * 0.45, resolvedKey)
                .setDisplaySize(iconSize, iconSize)
                .setDepth(12001)
                .setOrigin(0.5);
            }

            const g = this.add.graphics().setDepth(12001);
            const cx = width / 2;
            const cy = height * 0.45;
            const r = iconSize * 0.42;
            const earR = r * 0.28;

            g.fillStyle(0xd7b06b, 1);
            g.fillCircle(cx, cy, r);
            g.fillCircle(cx - r * 0.5, cy - r * 0.55, earR);
            g.fillCircle(cx + r * 0.5, cy - r * 0.55, earR);

            g.fillStyle(0x4c3028, 1);
            g.fillCircle(cx - r * 0.2, cy + r * 0.05, r * 0.15);
            g.fillCircle(cx + r * 0.2, cy + r * 0.05, r * 0.15);

            g.fillStyle(0x2c1b10, 1);
            g.fillCircle(cx, cy + r * 0.2, r * 0.2);
            return g;
          };

          const fallbackIcon = createFallbackRewardIcon();
          const tmpContainer = this.add.container(0, 0, [overlay, txt, fallbackIcon, btn, btnTxt]);
          tmpContainer.setDepth(12000);

          const closeTmp = () => {
            if (tmpContainer) {
              tmpContainer.destroy();
            }
          };

          btn.on("pointerdown", () => {
            this.sound.play("btn", { volume: 0.12 });
            closeTmp();
            beginSingleEasy();
          });
        } catch (e) {
          // 만약 팝업 생성조차 실패하면 최후의 수단으로 바로 시작
          console.warn("premium intro fallback failed", e);
          beginSingleEasy();
        }
      }
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

    // count duplicates to know how many cards per giver
    const counts = giverIndices.reduce((acc, idx) => {
      acc[idx] = (acc[idx] || 0) + 1;
      return acc;
    }, {});
    let total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    let finished = 0;
    // iterate over each giver index and animate its count sequentially
    let animIndex = 0;
    Object.keys(counts).forEach((gIdxStr) => {
      const gIdx = Number(gIdxStr);
      const numCards = counts[gIdx];
      for (let j = 0; j < numCards; j += 1) {
        const i = animIndex++;
        const relIdx = (gIdx - myIndex + players.length) % players.length;
        const rotations =
          playerCount === 2
            ? [0, 180]
            : playerCount === 3
              ? [0, 90, -90]
              : [0, 90, 180, -90];
        const rotation = rotations[relIdx];
        const startX = pos[relIdx].x + (Math.random() - 0.5) * 12;
        const startY = pos[relIdx].y + (Math.random() - 0.5) * 12;

        const flyCard = this.add
          .image(startX, startY, "card_back")
          .setDisplaySize(width * 0.15, width * 0.22)
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
      }
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
          .image(x, y, "card_back")
          .setDisplaySize(width * 0.15, width * 0.22)
          .setDepth(3000);
    const cardB = this.add
      .image(x, y, data.card) 
      .setDisplaySize(width * 0.15, width * 0.22)
      .setDepth(1100);

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
      this._aiRingTimers = this._aiRingTimers || {};
      this.aiSettings.forEach((ai) => {
        const aiData = this.roundData.players.find((p) => p.id === ai.id);
        // 카드가 있는(>0) AI이면서 탈락 상태가 아닌 경우에만 종을 침
        if (aiData && Number(aiData.cards) > 0 && !aiData.isEliminated) {
          // 한 번 예약된 타이머가 있으면 그대로 두고, 없으면 새로 예약
          if (this._aiRingTimers[ai.id]) return;

          // AI가 정답을 인지하고 반응하는 딜레이
          const baseReaction = ai.reactionTime || 1200;
          // 최대 delay가 너무 길면 플레이어가 반응할 기회를 잃으므로 적당히 제한
          const delay = Math.max(
            500,
            Math.min(2200, Math.round(baseReaction * 0.9 + Math.random() * 400)),
          );

          this._aiRingTimers[ai.id] = this.time.delayedCall(delay, () => {
            this._aiRingTimers[ai.id] = null;
            this.handleAiRingBell(ai.id);
          });
        }
      });
    } else {
      // successWindow가 꺼지면 예약된 AI 벨 타이머 취소
      if (this._aiRingTimers) {
        Object.values(this._aiRingTimers).forEach((t) => {
          if (t) {
            try {
              t.remove();
            } catch (e) {
              // ignore
            }
          }
        });
        this._aiRingTimers = null;
      }
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

    // 기존에 바닥에 보이던 카드(있다면)도 쌓아두기
    if (player.openCard) {
      if (!player.openStack || !Array.isArray(player.openStack)) player.openStack = [];
      // 중복 삽입 방지: 이미 스택의 최상단에 같은 카드가 들어있다면 다시 push하지 않음
      const last = player.openStack[player.openStack.length - 1];
      const sameByRef = last === player.openCard;
      const sameByValue =
        last && player.openCard &&
        last.type === player.openCard.type &&
        (last.type === THUNDER_CARD_TYPE || last.type === BOMB_CARD_TYPE ||
          (Number(last.fruit) === Number(player.openCard.fruit) && Number(last.count) === Number(player.openCard.count)));
      if (!sameByRef && !sameByValue) {
        player.openStack.push(player.openCard);
      }
    }

    // 카드 애니메이션이 끝난 뒤에 openCard를 갱신하도록 대기
    this._pendingSingleFlip = this._pendingSingleFlip || {};
    this._pendingSingleFlip[playerId] = randomCard;

    // In singleplayer we don't wait for server confirmations, so don't use optimistic
    // flip state tracking. The flip animation will complete and update state directly.
    // (This keeps the singleplayer flip animation from being skipped.)

    const specialPauseMs = this.showSpecialCardToast(randomCard, playerId);


    if (randomCard?.type === COIN_CARD_TYPE) {
      const reward = COIN_CARD_REWARD;
      const newTotal =
        (Number(this.profileStats?.coins) || 0) + reward;
      this.playCoinCardRewardAnimation(playerId, reward, newTotal);
      if (playerId === myId) {
        this.profileStats = this.profileStats || {};
        this.profileStats.coins = newTotal;
        this.setCoinsAbsolute(newTotal, { sync: false });
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

    // Ensure openStack is always an array to avoid spread errors
    if (!player.openStack || !Array.isArray(player.openStack)) {
      player.openStack = [];
    }

    const animationData = {
      playerId: playerId,
      card: randomCard,
      remainingCards: player.cards,
      // 현재 오픈 스택(업데이트된 상태)을 전달하여, 애니메이션 후에도 유지
      openCardStack: [...player.openStack],
    };

    // 4. 애니메이션 및 UI 갱신
    // `playCardFlipAnimation` will render at the end of the animation.
    this.playCardFlipAnimation(animationData);

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
        this.ensureSingleTotalCards();
      });
    } else {
      this.nextTurn();
      this.checkFruitCountForAI();
      this.ensureSingleTotalCards();
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
    if (!this.isMobileOptimized) {
      // 웹/PC 버전: 원래대로
      return this._playSuccessEffectFull();
    }
    
    // 📱 모바일 최적화 버전
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 화면 플래시 (더 짧은 시간)
    const flash = this.add
      .rectangle(centerX, centerY, width, height, 0xffffff, 1)
      .setDepth(10000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200, // 300 → 200ms
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    // 2. 더 약한 카메라 셰이크
    this.cameras.main.shake(250, 0.005); // 400, 0.01 → 250, 0.005

    // 3. 성공 텍스트 (간소화)
    const perfectText = this.add
      .text(centerX, centerY - height * 0.1, "성공!", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.12}px`, // 0.15 → 0.12
        color: "#FFD700",
        fontWeight: "bold",
        stroke: "#FF6B6B",
        strokeThickness: 8, // 12 → 8
      })
      .setOrigin(0.5)
      .setDepth(10001)
      .setScale(0)
      .setAlpha(0);

    this.tweens.add({
      targets: perfectText,
      scale: 1.1, // 1.2 → 1.1
      alpha: 1,
      duration: 150, // 200 → 150ms
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: perfectText,
          scale: 1.3,
          alpha: 0,
          y: centerY - height * 0.18,
          duration: 300, // 400 → 300ms
          delay: 200,
          ease: "Power2.easeIn",
          onComplete: () => perfectText.destroy(),
        });
      },
    });

    // 4. 파티클 효과 (개수 감소)
    const particleCount = Math.round(15 * this.particleCountMultiplier); // 30 → 15
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 150 + Math.random() * 150; // 200 + 200 → 150 + 150

      const particle = this.add
        .circle(centerX, centerY, width * 0.015, 0xffd700, 1) // 0.02 → 0.015
        .setDepth(10002);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.tweens.add({
        targets: particle,
        x: centerX + vx,
        y: centerY + vy,
        alpha: 0,
        scale: 0,
        duration: 600, // 800 → 600ms
        ease: "Power2.easeOut",
        onComplete: () => particle.destroy(),
      });
    }

    // 5. 별 이모지 (간소화)
    const bellY = height * 0.465;
    const starCount = Math.round(12 * this.particleCountMultiplier); // 20 → 12

    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const distance = width * 0.3 + Math.random() * width * 0.15; // 0.4 + 0.2 → 0.3 + 0.15

      const star = this.add
        .text(centerX, bellY, "⭐", {
          fontSize: `${width * 0.025}px`, // 0.03 → 0.025
        })
        .setOrigin(0.5)
        .setDepth(10003)
        .setAlpha(0);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = bellY + Math.sin(angle) * distance;

      this.time.delayedCall(i * 5, () => { // 10 → 5ms 딜레이
        this.tweens.add({
          targets: star,
          x: targetX,
          y: targetY,
          alpha: 1,
          rotation: Math.PI * 2 + Math.random() * Math.PI,
          scale: 1 + Math.random() * 0.3, // 0.5 → 0.3
          duration: 250 + Math.random() * 150, // 300 + 200 → 250 + 150
          ease: "Power2.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: star,
              alpha: 0,
              scale: 0,
              duration: 100, // 150 → 100
              ease: "Power2.easeIn",
              onComplete: () => star.destroy(),
            });
          },
        });
      });
    }
  }

  _playSuccessEffectFull() {
    // 웹/PC 전체 효과 버전
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 화면 플래시
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

    // 3. 성공 텍스트
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
        this.tweens.add({
          targets: perfectText,
          scale: 1.3,
          alpha: 0,
          y: centerY - height * 0.18,
          duration: 400,
          delay: 200,
          ease: "Power2.easeIn",
          onComplete: () => perfectText.destroy(),
        });
      },
    });

    // 4. 파티클 효과
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 200 + Math.random() * 200;

      const particle = this.add
        .circle(centerX, centerY, width * 0.02, 0xffd700, 1)
        .setDepth(10002);

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

    // 5. 별 이모지
    const bellY = height * 0.465;
    const starCount = 20;

    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const distance = width * 0.4 + Math.random() * width * 0.2;

      const star = this.add
        .text(centerX, bellY, "⭐", {
          fontSize: `${width * 0.03}px`,
        })
        .setOrigin(0.5)
        .setDepth(10003)
        .setAlpha(0);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = bellY + Math.sin(angle) * distance;

      this.time.delayedCall(i * 10, () => {
        this.tweens.add({
          targets: star,
          x: targetX,
          y: targetY,
          alpha: 1,
          rotation: Math.PI * 2 + Math.random() * Math.PI,
          scale: 1 + Math.random() * 0.5,
          duration: 300 + Math.random() * 200,
          ease: "Power2.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: star,
              alpha: 0,
              scale: 0,
              duration: 150,
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
    if (!this.isMobileOptimized) {
      // 웹/PC 버전: 원래대로
      return this._playFailureEffectFull();
    }
    
    // 📱 모바일 최적화 버전
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. 화면 붉은 플래시 (더 약함)
    const flash = this.add
      .rectangle(centerX, centerY, width, height, 0xff3333, 0.5) // 0.8 → 0.5
      .setDepth(10000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300, // 400 → 300ms
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    // 2. 더 약한 카메라 흔들림
    this.cameras.main.shake(350, 0.008); // 500, 0.015 → 350, 0.008

    // 3. 실패 텍스트 (간소화)
    const wrongText = this.add
      .text(centerX, centerY, "땡!", {
        fontSize: `${width * 0.1}px`, // 0.12 → 0.1
        fontFamily: "Arial Black",
        color: "#ff0000",
        stroke: "#ffffff",
        strokeThickness: 6, // 8 → 6
      })
      .setOrigin(0.5)
      .setDepth(10001)
      .setAlpha(0)
      .setScale(0);

    this.tweens.add({
      targets: wrongText,
      scale: 1.2, // 1.3 → 1.2
      alpha: 1,
      duration: 150, // 200 → 150ms
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: wrongText,
          y: centerY - height * 0.12,
          alpha: 0,
          scale: 0.8,
          duration: 300, // 400 → 300ms
          delay: 150, // 200 → 150ms
          ease: "Power2.easeIn",
          onComplete: () => wrongText.destroy(),
        });
      },
    });

    // 4. 붉은 파티클 (간소화)
    const particleCount = Math.round(20 * this.particleCountMultiplier); // 40 → 20
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = Math.random() * width * 0.2; // 0.3 → 0.2

      const particle = this.add
        .circle(centerX, centerY, width * 0.012, 0xff0000, 1) // 0.015 → 0.012
        .setDepth(10002);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = centerY + Math.sin(angle) * distance;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0.2,
        duration: 500, // 600 → 500ms
        ease: "Power2.easeOut",
        onComplete: () => particle.destroy(),
      });
    }

    // 5. ❌ 이모지 (간소화)
    const bellY = height * 0.465;
    const xCount = Math.round(10 * this.particleCountMultiplier); // 15 → 10

    for (let i = 0; i < xCount; i++) {
      const angle = (Math.PI * 2 * i) / xCount;
      const distance = width * 0.3 + Math.random() * width * 0.15; // 0.35 + 0.2 → 0.3 + 0.15

      const xMark = this.add
        .text(centerX, bellY, "❌", {
          fontSize: `${width * 0.032}px`, // 0.04 → 0.032
        })
        .setOrigin(0.5)
        .setDepth(10003)
        .setAlpha(0);

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = bellY + Math.sin(angle) * distance;

      this.time.delayedCall(i * 8, () => { // 15 → 8ms
        this.tweens.add({
          targets: xMark,
          x: targetX,
          y: targetY,
          alpha: 1,
          rotation: Math.PI * 2 + Math.random() * Math.PI,
          scale: 1 + Math.random() * 0.3, // 0.5 → 0.3
          duration: 300 + Math.random() * 150, // 400 + 200 → 300 + 150
          ease: "Power2.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: xMark,
              alpha: 0,
              scale: 0,
              duration: 150, // 200 → 150
              ease: "Power2.easeIn",
              onComplete: () => xMark.destroy(),
            });
          },
        });
      });
    }
  }

  _playFailureEffectFull() {
    // 웹/PC 전체 효과 버전
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

    // 강한 붉은 플래시 + 비네트
    const flash = this.add
      .rectangle(centerX, centerY, width, height, 0xff1111, 0.5)
      .setDepth(10000)
      .setAlpha(0);

    this.tweens.add({
      targets: flash,
      alpha: 0.7,
      duration: 200,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 1000,
      delay: 260,
      ease: "Quad.easeIn",
      onComplete: () => flash.destroy(),
    });

    // 도장 텍스트 + 배경 요소
    const stampRadius = width * 0.22;
    const stamp = this.add
      .circle(centerX, centerY, stampRadius, 0xb91c1c, 0.22)
      .setDepth(10001)
      .setAlpha(0)
      .setScale(0.1);
    stamp.setStrokeStyle(14, 0xef4444, 0.85);

    const stampRing = this.add
      .circle(centerX, centerY, stampRadius * 0.75, 0x000000, 0)
      .setDepth(10000)
      .setAlpha(0)
      .setScale(0.1);
    stampRing.setStrokeStyle(10, 0xff8888, 0.9);

    const text = this.add
      .text(centerX, centerY, "탈락", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.19}px`,
        color: "#fff5f5",
        fontWeight: "900",
        stroke: "#1f2937",
        strokeThickness: 14,
      })
      .setOrigin(0.5)
      .setDepth(10002)
      .setAlpha(0)
      .setScale(0.25);

    // Stamp bounce (도장 찍히는 느낌)
    this.tweens.add({
      targets: [stamp, stampRing, text],
      alpha: 1,
      scale: (target) => (target === text ? 1.55 : 1.1),
      duration: 240,
      ease: "Back.out",
      onComplete: () => {
        // 소리나 추가 효과를 여기에 넣을 수 있음
        const shockwave = this.add
          .circle(centerX, centerY, stampRadius * 0.4, 0xffffff, 0.4)
          .setDepth(9998)
          .setAlpha(0)
          .setScale(0.4);
        shockwave.setStrokeStyle(8, 0xfbbf24, 0.95);
        this.tweens.add({
          targets: shockwave,
          alpha: 0.85,
          scale: 2.3,
          duration: 300,
          ease: "Sine.out",
          onComplete: () => {
            this.tweens.add({
              targets: shockwave,
              alpha: 0,
              duration: 260,
              ease: "Sine.in",
              onComplete: () => shockwave.destroy(),
            });
          },
        });

        // 서서히 사라지는 효과
        this.tweens.add({
          targets: [stamp, stampRing, text],
          alpha: 0,
          duration: 680,
          delay: 420,
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
    this.ensureSingleTotalCards();

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
    if (this.isPlayerAi(nextPlayer.id)) {
      const aiSetting = this.aiSettings.find((ai) => ai.id === nextPlayer.id);
      const baseDelay = aiSetting ? aiSetting.flipDelay : 1500;

      // 튜토리얼 종료 후 싱글플레이 AI 카드 제출 속도 고정(1.3초)
      let adjustedBaseDelay = baseDelay;
      if (this.isSingle && !this.isTutorialMode) {
        adjustedBaseDelay = 1300;
      } else if (this.isSingle) {
        // 튜토리얼 모드에서는 난이도에 따라 빠르기/느리기 조절
        const diff = this.roundData?.aiDifficulty;
        if (diff === "normal") {
          adjustedBaseDelay = Math.round(baseDelay * 0.8);
        } else if (diff === "hard") {
          adjustedBaseDelay = Math.round(baseDelay * 1.2);
        }
      }

      // Ensure AI doesn't flip again before its own reaction time (so bell can happen first)
      const minDelay = aiSetting ? aiSetting.reactionTime + 800 : 2200;
      const delay = Math.max(adjustedBaseDelay + Math.random() * 400, minDelay);

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
      if (!Array.isArray(p.openStack) || p.openStack.length === 0) return;
      collectedCards.push(...p.openStack);
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
      winnerNickname: winner.nickname || winner.name || "플레이어",
      collectedCount: totalCollected,
    });

    // 즉시 로컬 상태 업데이트 (애니메이션이 끝나면 openStack은 playWinAnimation에서 비워집니다)
    this.roundData.players = updatedPlayers;

    // 상태 갱신
    this.updateEliminationStatus();
    this.updateTurnEffect();
    this.ensureSingleTotalCards();

    // 승자 다음 동작 예약 (AI는 뒤집기, 플레이어는 다시 입력 허용)
    if (winner && this.isPlayerAi(winner.id)) {
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

  playMultiplierSelectionAnimation() {
    // 배수 선택 애니메이션: 1배, 2배, 3배, 5배, 10배 중 하나를 3초에 걸쳐 선택
    console.log('[playMultiplierSelectionAnimation] 시작', {
      isSingle: this.isSingle,
      hasCamera: !!this.cameras?.main,
      hasAdd: !!this.add,
    });
    
    if (this.isSingle) {
      console.log('[playMultiplierSelectionAnimation] 싱글플레이이므로 리턴');
      return; // 멀티플레이만 실행
    }
    
    const { width, height } = this.cameras.main;
    console.log('[playMultiplierSelectionAnimation] 카메라 정보:', { width, height });
    const centerX = width / 2;
    const centerY = height / 2;
    
    const multipliers = [1, 2, 3, 5, 10];
    let currentValue = multipliers[0];
    let finalMultiplier = 1;
    let animationCompleted = false;
    
    // 배경 어두운 오버레이
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0)
      .setDepth(11000);
    
    console.log('[playMultiplierSelectionAnimation] 오버레이 생성 완료');
    
    this.tweens.add({
      targets: overlay,
      alpha: 0.7,
      duration: 300,
      ease: "Power2.easeInOut",
    });
    
    // 배수 디스플레이 - 큰 네모칸
    const boxSize = Math.min(width * 0.4, height * 0.25);
    const box = this.add
      .rectangle(centerX, centerY - height * 0.1, boxSize, boxSize, 0x2d5016, 0.9)
      .setStrokeStyle(5, 0xffd700)
      .setDepth(11001);
    
    // 숫자만 변경되는 텍스트 (여러 개 겹쳐서 동시에 변경)
    const numberTexts = [];
    for (let i = 0; i < 3; i++) {
      const numText = this.add
        .text(centerX - boxSize * 0.12, centerY - height * 0.1, `${currentValue}`, {
          fontFamily: "Arial Black",
          fontSize: `${boxSize * 0.35}px`,
          color: "#FFD700",
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(11002 + i)
        .setAlpha(1);
      numberTexts.push(numText);
    }
    
    // "배" 글자 - 고정 (숫자 오른쪽)
    const unitText = this.add
      .text(centerX + boxSize * 0.08, centerY - height * 0.1, "배", {
        fontFamily: "Arial Black",
        fontSize: `${boxSize * 0.25}px`,
        color: "#FFD700",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(11002)
      .setAlpha(1);
    
    // 안내 텍스트
    const instructionText = this.add
      .text(centerX, centerY + height * 0.15, "배수가 결정 중입니다...", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(11001)
      .setAlpha(0);
    
    this.tweens.add({
      targets: instructionText,
      alpha: 1,
      duration: 200,
    });
    
    // 3초 동안 슬롯 애니메이션 (점점 느려지다가 멈춤)
    let lastChangeTime = Date.now();
    const animationDuration = 3000; // 3초 애니메이션
    const animationStartTime = Date.now();
    
    console.log('[playMultiplierSelectionAnimation] 슬롯 애니메이션 시작');
    
    const updateMultiplier = () => {
      const now = Date.now();
      const elapsed = now - animationStartTime;
      const progress = Math.min(elapsed / animationDuration, 1); // 0 ~ 1
      
      if (progress >= 1 && !animationCompleted) {
        console.log('[playMultiplierSelectionAnimation] 3초 완료 - 최종 배수 결정');
        animationCompleted = true;
        
        // 최종 배수를 가중치 있게 선택
        const rand = Math.random() * 100;
        if (rand < 5) finalMultiplier = 10; // 5% 확률
        else if (rand < 15) finalMultiplier = 5; // 10% 확률
        else if (rand < 40) finalMultiplier = 3; // 25% 확률
        else if (rand < 70) finalMultiplier = 2; // 30% 확률
        else finalMultiplier = 2; // 30% 확률
        
        currentValue = finalMultiplier;
        this.roundData.gameMultiplier = finalMultiplier;
        
        // 🔴 [로그] 배수 저장 확인
        console.log('[playMultiplierSelectionAnimation] ✅ 배수 저장 완료', { 
          finalMultiplier,
          storedValue: this.roundData.gameMultiplier,
          roomId: this.roomId,
          isSingle: this.isSingle
        });
        
        // 숫자 텍스트 최종 업데이트
        numberTexts.forEach(numText => {
          numText.setText(`${finalMultiplier}`);
          numText.setScale(1.3);
        });
        
        // 박스와 숫자 텍스트 강조
        this.tweens.add({
          targets: [box, ...numberTexts],
          scale: 1.2,
          duration: 200,
          ease: "Power2.easeOut",
          yoyo: true,
          hold: 100,
        });
        
        // 안내 텍스트 변경
        instructionText.setText(`🎉 ${finalMultiplier}배 판입니다! 🎉`);
        instructionText.setColor("#FFD700");
        
        // 2초 후 사라짐
        this.time.delayedCall(2000, () => {
          // 🔴 [서버 전송] 배수 정보를 서버로 전송 - 서버에서 보상 계산에 사용
          try {
            if (typeof socket !== 'undefined' && socket) {
              const multiplierPayload = {
                roomId: this.currentRoomId,  // ← 수정: this.roomId → this.currentRoomId
                gameMultiplier: finalMultiplier,
                timestamp: Date.now(),
              };
              
              console.log('[playMultiplierSelectionAnimation] 배수 서버 전송 시작', multiplierPayload);
              
              socket.emit('setGameMultiplier', multiplierPayload, (ack) => {
                console.log('[playMultiplierSelectionAnimation] 서버 배수 설정 확인됨', { 
                  finalMultiplier, 
                  ack,
                  received: ack?.received,
                  saved: ack?.saved 
                });
              });
              
              // 재확인: 약간 뒤에 다시 전송 (서버 수신 확인용)
              this.time.delayedCall(500, () => {
                socket.emit('getGameMultiplier', { roomId: this.currentRoomId }, (current) => {  // ← 수정
                  console.log('[playMultiplierSelectionAnimation] 서버 배수 재확인', { 
                    sent: finalMultiplier, 
                    serverCurrent: current?.gameMultiplier 
                  });
                });
              });
            }
          } catch (e) {
            console.warn('[playMultiplierSelectionAnimation] 서버 배수 전송 실패', e);
          }

          this.tweens.add({
            targets: [overlay, box, ...numberTexts, unitText, instructionText],
            alpha: 0,
            duration: 500,
            ease: "Power2.easeIn",
            onComplete: () => {
              try { overlay.destroy(); } catch (e) {}
              try { box.destroy(); } catch (e) {}
              numberTexts.forEach(t => { try { t.destroy(); } catch (e) {} });
              try { unitText.destroy(); } catch (e) {}
              try { instructionText.destroy(); } catch (e) {}
            },
          });
        });
        
        return; // 애니메이션 완료
      }
      
      // 🔄 슬롯 회전 중: 점차 느려지는 효과
      if (!animationCompleted) {
        // progress에 따라 변경 간격 계산
        // 0~0.7 (0~2.1초): 50ms간격 (빠른 회전)
        // 0.7~1.0 (2.1~3초): 점점 느려짐 (50ms → 300ms)
        let changeInterval;
        if (progress < 0.7) {
          changeInterval = 50; // 빠른 회전 (더 연속적인 느낌)
        } else {
          // 마지막 1초: 50ms → 300ms로 점차 증가
          const slowProgress = (progress - 0.7) / 0.3; // 0~1
          changeInterval = 50 + (300 - 50) * slowProgress; // 50 → 300
        }
        
        // 변경 간격이 지났으면 숫자 바꾸기
        if (now - lastChangeTime >= changeInterval) {
          currentValue = multipliers[Math.floor(Math.random() * multipliers.length)];
          
          // 모든 숫자 텍스트 업데이트
          numberTexts.forEach(numText => {
            numText.setText(`${currentValue}`);
          });
          
          lastChangeTime = now;
          
          // 마지막 구간에서는 시각적 피드백 추가
          if (progress > 0.7) {
            numberTexts.forEach(numText => {
              numText.setScale(0.95 + Math.random() * 0.1); // 약간의 진동 효과
            });
          }
        }
      }
      
      // 재귀 호출: 15ms마다 확인 (더 부드러운 60+fps)
      if (!animationCompleted) {
        this.time.delayedCall(15, updateMultiplier);
      }
    };
    
    console.log('[playMultiplierSelectionAnimation] 슬롯 애니메이션 함수 시작');
    updateMultiplier();
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
        p._eliminatedStamp = true; // remember forever
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

      // 멀티플레이처럼, 바닥의 최상단 카드(가장 마지막에 열린 카드)만 계산합니다.
      const top =
        Array.isArray(p.openStack) && p.openStack.length > 0
          ? p.openStack[p.openStack.length - 1]
          : p.openCard;

      // If the player is eliminated and the top is a bomb, ignore it.
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

  getSingleTotalCardCount() {
    if (!this.isSingle || !this.roundData || !Array.isArray(this.roundData.players))
      return 0;

    let total = 0;
    this.roundData.players.forEach((p) => {
      total += Number(p.cards) || 0;
      if (Array.isArray(p.openStack)) total += p.openStack.length;
      // count the currently displayed openCard if it's not already included
      if (p.openCard) {
        const last = Array.isArray(p.openStack) && p.openStack.length > 0
          ? p.openStack[p.openStack.length - 1]
          : null;
        const sameByRef = last === p.openCard;
        const sameByValue = last && p.openCard && last.type === p.openCard.type && (last.type === THUNDER_CARD_TYPE || last.type === BOMB_CARD_TYPE || (Number(last.fruit) === Number(p.openCard.fruit) && Number(last.count) === Number(p.openCard.count)));
        if (!sameByRef && !sameByValue) total += 1;
      }
    });
    return total;
  }

  ensureSingleTotalCards() {
    if (!this.isSingle || !this.roundData || !Array.isArray(this.roundData.players))
      return;

    const expected =
      (Number(this.singleInitialCardCount) || 0) *
      (this.roundData.players ? this.roundData.players.length : 0);
    if (!expected) return;

    const current = this.getSingleTotalCardCount();
    if (current <= expected) return;

    const surplus = current - expected;
    console.warn("[card] total exceeds expected", {
      expected,
      current,
      surplus,
    });

    // surplus를 가장 카드가 많은 플레이어에서 차감
    let maxPlayer = null;
    this.roundData.players.forEach((p) => {
      if (!maxPlayer || (Number(p.cards) || 0) > (Number(maxPlayer.cards) || 0)) {
        maxPlayer = p;
      }
    });
    if (!maxPlayer) return;

    const reduce = Math.min(surplus, Number(maxPlayer.cards) || 0);
    maxPlayer.cards = Math.max(0, (Number(maxPlayer.cards) || 0) - reduce);
    maxPlayer.remainingCards = maxPlayer.cards;

    const deck = this.getSingleDeck(maxPlayer.id);
    if (Array.isArray(deck)) {
      for (let i = 0; i < reduce && deck.length > 0; i += 1) {
        deck.pop();
      }
    }

    console.warn("[card] adjusted surplus", {
      playerId: maxPlayer.id,
      reduce,
      newCards: maxPlayer.cards,
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
    //this.showToast(`${label} 카드 등장!`, "#f39c12");

    // special toasts (plus1 or thunder) can sometimes persist when single-
    // player timing is tight; we rely on showToast's built-in cleanup.
    // (Do not clear immediately or it will disappear instantly.)

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

  playCoinCardRewardAnimation(playerId, amount, newTotal) {
    if (!playerId || !Number.isFinite(Number(amount))) return;

    // Only animate when the coin reward is for the local player.
    // This prevents bot players from showing coin animations on the local UI.
    const myId = this.isSingle
      ? this.myId
      : typeof socket !== "undefined"
      ? socket.id
      : null;
    if (playerId !== myId) return;

    const layout = this.getPlayerLayoutForId(playerId);
    if (!layout) return;

    const { width } = this.cameras.main;
    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);
    const startX = layout.x + Math.cos(rad) * dist * 0.7;
    const startY = layout.y + Math.sin(rad) * dist;
    const coinCount = 18;
    const lift = width * 0.1;
    const spread = width * 0.12;
    const coinSize = width * 0.05;

    // target for coins should be the profile coin text if available,
    // otherwise fallback to player layout position.
    let targetX = layout.x;
    let targetY = layout.y;
    if (this.profileCoinTxt && this.profileCoinTxt.active) {
      const bounds = this.profileCoinTxt.getBounds();
      targetX = bounds.centerX;
      targetY = bounds.centerY;
    }

    // Determine the numeric range for coin count animation
    const currentCoins = this.profileCoinTxt
      ? Number((this.profileCoinTxt.text || "").replace(/[^0-9]/g, "")) || 0
      : Number(this.myProfile?.coins) || 0;
    const finalCoins = Number.isFinite(Number(newTotal))
      ? Number(newTotal)
      : currentCoins + Number(amount);

    let completed = 0;
    const onCoinArrived = () => {
      completed += 1;
      if (completed !== coinCount) return;

      // Animate coin total change once all coins reached the target
      if (this.profileCoinTxt && this.profileCoinTxt.active) {
        this.tweens.addCounter({
          from: currentCoins,
          to: finalCoins,
          duration: 800,
          ease: "Linear",
          onUpdate: (tween) => {
            const value = Math.round(tween.getValue());
            this.setProfileCoinLabel(`보유코인: ${value}`);
          },
          onComplete: () => {
            this.setProfileCoinLabel(`보유코인: ${finalCoins}`);
          },
        });
      }
    };

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
              onCoinArrived();
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
    // 시상대 결과 중에는 프로필 즉시 반영 금지
    this.isResultOverlayActive = true;

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
      // allow replaying gameover for a new result set even if a prior
      // display in this session already played it.  Track the last
      // players hash so different matches will still trigger sound.
      const playersHash = Array.isArray(players)
        ? players.map((p) => String(p.id)).join("|")
        : "";

      if (!this.resultGameoverPlayed || this._lastResultPlayersHash !== playersHash) {
        this.resultGameoverPlayed = true;
        this._lastResultPlayersHash = playersHash;

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
        // expose on the scene so other handlers (confirm/auto-leave/new-game)
        // can stop it if the user advances before it finishes.
        try {
          this._currentGameoverSound = gameoverSound;
        } catch (e) {}

        // debug logging for intermittent failures
        console.log("[sound] playing gameover", gameoverSound);
        // Phaser Audio.play does not return a promise, just call directly
        try {
          gameoverSound.play();
        } catch (err) {
          console.warn("gameover sound play failed", err);
        }

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
          try {
            if (this._currentGameoverSound === gameoverSound) this._currentGameoverSound = null;
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

    // hide profile card while the result overlay is visible
    if (this.profileCard) {
      this.profileCard.setVisible(false);
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

    const resultOverlayBaselineCoins =
      Number(this.myProfile?.coins) || Number(this._startOfMatchCoins) || 0;
    console.log('[result] overlay baseline coins 설정 (모든 보상 누적됨)', { 
      resultOverlayBaselineCoins,
      currentProfileCoins: Number(this.myProfile?.coins),
      startOfMatchCoins: Number(this._startOfMatchCoins),
      deferredCoins: this._deferredCoinsDelta,
      note: '🔴 이 값이 게임 중 모든 보상(퀘스트, 카드, 순위)을 포함해야 함'
    });

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
      .setDisplaySize(width * 0.45, height * 0.075);
    const confirmTxt = this.add
      .text(width / 2, height * 0.83, "코인 획득중..", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    let isResultReadyToConfirm = false;
    const enableConfirmButton = () => {
      isResultReadyToConfirm = true;
      try {
        confirmBtn.setInteractive({ useHandCursor: true });
      } catch (e) {
        // ignore
      }
      confirmBtn.setAlpha(1);
      confirmTxt.setAlpha(1);
      confirmTxt.setText("확인");
    };
    const disableConfirmButton = () => {
      isResultReadyToConfirm = false;
      try {
        if (confirmBtn.disableInteractive) {
          confirmBtn.disableInteractive();
        }
      } catch (e) {
        // ignore
      }
      confirmBtn.setAlpha(0.5);
      confirmTxt.setAlpha(0.5);
      confirmTxt.setText("확인");
    };

    disableConfirmButton();

    container.add([countdownText, confirmBtn, confirmTxt]);

    const playCoinCollectAnimation = () => {
      if (isUpdate || !this.textures.exists("coin")) {
        // If coin textures are unavailable, still allow user to proceed.
        if (!isUpdate) {
          enableConfirmButton();
        }
        return;
      }

      const baseRankRewardCoins =
        (typeof RANK_REWARD_COINS !== "undefined" && Array.isArray(RANK_REWARD_COINS) && RANK_REWARD_COINS.length > 0)
          ? RANK_REWARD_COINS
          : [30, 20, 10];
      
      // 배수 적용: 게임 배수가 설정되었으면 각 순위별 코인에 배수 적용
      const multiplier = this.roundData?.gameMultiplier || 1;
      const rankRewardCoins = baseRankRewardCoins.map(coin => Math.floor(coin * multiplier));
      
      // 🔴 [중요] 확인 버튼 핸들러에서 접근할 수 있도록 this에 저장
      this._resultRankRewardCoins = rankRewardCoins;
      this._resultBaselineCoins = resultOverlayBaselineCoins;
      this._resultRankedPlayers = rankedPlayers;
      
      const coinCountByRank = rankRewardCoins;
      const floorYMin = height * 0.72;
      const floorYMax = height * 0.86;
      const floorXMin = width * 0.2;
      const floorXMax = width * 0.8;
      let coinSequence = 0;

      // 🔴 [수정] totalRankCoins도 배수 미적용 기준으로 계산 (코인 애니메이션이 baseRankRewardCoins 기준이므로)
      const totalRankCoins = rankedPlayers.reduce(
        (sum, _, idx) => sum + (baseRankRewardCoins[idx] || 0),
        0,
      );
      console.log('[result] playCoinCollectAnimation start', { 
        totalRankCoins, 
        rankedPlayersCount: rankedPlayers.length,
        baseRankRewardCoins,
        multiplier,
        rankRewardCoins,
      });
      let arrivedCoins = 0;
      let rewardApplied = false;

      const applyDeferredRewards = () => {
        if (rewardApplied) return;
        rewardApplied = true;

        try {
          const coinCountByRank = rankRewardCoins;
          let awardedForMe = 0;
          const mySocketId = this.isSingle ? (this.myId || "PLAYER_ME") : (socket && socket.id);
          console.log('[result] computing awardedForMe', { mySocketId, rankedPlayers });
          
          // 배수 미적용 기본 보상 계산 (서버가 주는 코인)
          let baseAwardedForMe = 0;
          let myRankIdx = -1;
          
          rankedPlayers.forEach((p, idx) => {
            try {
              if (!p || typeof p.id === 'undefined') return;
              if (!mySocketId) return;
              if (String(p.id) === String(mySocketId)) {
                baseAwardedForMe += Number(baseRankRewardCoins[idx] || 0); // 배수 미적용
                awardedForMe += Number(coinCountByRank[idx] || 0); // 배수 적용
                myRankIdx = idx;
                console.log(`🏁 [result/ranking] 내 순위 감지됨 (순위: ${idx + 1})`, {
                  rank: idx + 1,
                  playerId: String(p.id),
                  baseReward: baseRankRewardCoins[idx] || 0,
                  appliedReward: coinCountByRank[idx] || 0,
                  multiplier,
                  cumulativeTotal: baselineCoins + awardedForMe
                });
              }
            } catch (e) {
              // ignore per-player comparison issues
            }
          });
          console.log('[result] 🎮 게임 순위 보상 계산 완료', { 
            awardedForMe, 
            baseAwardedForMe, 
            multiplier, 
            myRankIdx: myRankIdx + 1,
            mySocketId 
          });

          if (awardedForMe > 0) {
            const serverCoins = Number(this._deferredMyProfile?.coins);
            const currentCoins = Number(this.myProfile?.coins) || 0;
            const baselineCoins = Number(resultOverlayBaselineCoins) || 0;
            
            // 🔴 [중요] 최종 보상은 배수가 적용된 전체 금액(awardedForMe)을 기준으로 계산
            // 서버가 배수를 포함했든 안 했든, 클라이언트가 최종 보정을 책임짐
            const expectedFinalCoins = baselineCoins + awardedForMe; // 배수 포함 최종값
            
            let missingCoins = 0;
            if (Number.isFinite(serverCoins) && serverCoins >= 0) {
              // 서버에서 받은 코인 vs 예상 최종 코인
              if (serverCoins >= expectedFinalCoins) {
                // 서버가 이미 배수를 포함했거나, 초과로 준 경우
                missingCoins = 0;
                console.log('[result/reward] serverCoins already satisfies expected reward (배수 포함)', { 
                  serverCoins, 
                  expectedFinalCoins,
                  missingCoins 
                });
              } else {
                // 서버가 부족한 경우 (배수 미적용 또는 부분 적용)
                missingCoins = expectedFinalCoins - serverCoins;
                console.log('[result/reward] serverCoins is lower than expected, adding missing (배수 적용된 전체)', { 
                  serverCoins, 
                  expectedFinalCoins, 
                  missingCoins 
                });
              }
            } else {
              // 서버 코인 정보 없는 경우: 현재 코인에서 예상 최종값까지 계산
              missingCoins = Math.max(0, expectedFinalCoins - currentCoins);
              console.log('[result/reward] no server coin snapshot, fallback with multiplier applied', { 
                currentCoins, 
                expectedFinalCoins,
                missingCoins 
              });
            }

            if (missingCoins > 0) {
              try {
                const beforeModify = Number(this.myProfile?.coins) || 0;
                this.modifyCoins(missingCoins, { sync: true, force: true, coinCardUpdate: true, reason: 'rankReward', rank: myRankIdx + 1 });
                const afterModify = Number(this.myProfile?.coins) || 0;
                console.log('💰 [result/reward] 게임 순위 보상 적용됨', { 
                  beforeModify,
                  missingCoins, 
                  afterModify,
                  expectedFinalCoins,
                  delta: afterModify - beforeModify,
                  isSingle: this.isSingle
                });
              } catch (e) {
                console.warn('[result/reward] modifyCoins failed', e);
              }
            } else {
              console.log('[result/reward] no additional coins needed', { serverCoins, expectedFinalCoins, missingCoins });
            }
          }
        } catch (e) {
          console.warn('[result] applyDeferredRewards failed', e);
        }

        enableConfirmButton();
      };

      const tryApplyDeferred = () => {
        if (rewardApplied) return;
        if (totalRankCoins > 0 && arrivedCoins < totalRankCoins) return;

        applyDeferredRewards();
      };

      rankedPlayers.forEach((_, rankIndex) => {
        const targetPos = podiumPositions[rankIndex];
        // 🔴 [수정] 애니메이션 개수는 기본 보상 기준, 텍스트 표시는 배수 적용 기준으로 분리
        const animationCoinCount = baseRankRewardCoins[rankIndex] || 0; // 애니메이션 개수 (배수 미적용)
        const rewardCoinCount = rankRewardCoins[rankIndex] || 0; // 보상 텍스트 (배수 적용)
        
        if (!targetPos || animationCoinCount <= 0) {
          return;
        }

        const targetX = targetPos.x;
        const targetY = targetPos.y - width * 0.14;
        let didShowRewardText = false;

        for (let index = 0; index < animationCoinCount; index += 1) {
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
              playRewardTextAnimation(rankIndex, rewardCoinCount); // 배수 적용된 보상 표시
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
                arrivedCoins += 1;
                tryApplyDeferred();
              },
            });
          });
        }
      });

      if (totalRankCoins === 0) {
        tryApplyDeferred();
      }
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

    // EXP end-of-game text animation removed — XP is shown during gameplay

    const goToLobby = () => {
      // 🔴 [보안] 클라이언트에서 코인 검증/조정하지 않음
      // 서버에서 배수 적용된 코인을 최종 확정한 후 클라이언트에 전송
      // 클라이언트는 서버 코인을 절대적으로 신뢰
      
      this.isResultOverlayActive = false;

      // 싱글 플레이일 경우에는 멀티 재입장 조건 없이 바로 메인 로비로 이동
      if (this.isSingle) {
        try {
          if (this.resultContainer) {
            this.resultContainer.destroy();
            this.resultContainer = null;
          }
          if (this.playerTableGroup) {
            this.playerTableGroup.setVisible(true).setAlpha(1).setDepth(100);
          }
        } catch (e) {
          console.warn("goToLobby(single): cleanup failed", e);
        }

        // Ensure any deferred profile update and coins are applied before leaving.
        try {
          if (this._deferredMyProfile) {
            this.applyDeferredProfileUpdates();
          }
          this.applyDeferredCoins();
        } catch (e) {
          console.warn("goToLobby(single): applyDeferred profile/coins failed", e);
        }

        // Sync final single-player coin state to server/local.
        try {
          const finalCoins = Number(this.myProfile?.coins) || 0;
          console.log(`🌟 [goToLobby/single] 최종 코인 동기화 시작`, {
            finalCoins,
            startCoins: this._startOfMatchCoins,
            gained: finalCoins - (this._startOfMatchCoins || 0),
            isSingle: true,
            timestamp: new Date().toISOString()
          });

          if (typeof this.emitInventory === "function") {
            this.emitInventory("postProfileSync", { requireServerProfile: false });
            console.log(`🛰️ [goToLobby/single] 서버 동기화 완료`, { finalCoins });
          }
        } catch (e) {
          console.warn("goToLobby(single): postProfileSync emit failed", e);
        }

        try {
          if (this.scene.isActive("GameScene")) this.scene.stop("GameScene");
        } catch (e) {
          console.warn("goToLobby(single): stop GameScene failed", e);
        }
        try {
          this.scene.start("LobbyScene", {
            preventAutoStartSingleAfterTutorial: true,
            fromSingle: true,
          });
        } catch (e) {
          console.warn("goToLobby(single): start LobbyScene failed", e);
        }
        return;
      }

      // Ensure main game table is visible and on top before switching scenes.
      try {
        if (this.playerTableGroup) {
          this.playerTableGroup.setVisible(true).setAlpha(1).setDepth(100);
          this.children.bringToTop(this.playerTableGroup);
        }
      } catch (e) {
        console.warn("goToLobby: failed to restore playerTableGroup visibility", e);
      }
      try {
        if (this.resultContainer) {
          this.resultContainer.destroy();
          this.resultContainer = null;
        }
      } catch (e) {
        console.warn("goToLobby: failed to destroy old resultContainer", e);
      }

      // stop any playing gameover sound immediately when user leaves result
      try {
        if (this._currentGameoverSound) {
          try {
            // Ensure any tweens targeting the sound are killed before destroying
            this.tweens.killTweensOf(this._currentGameoverSound);
          } catch (e) {}
          try {
            this._currentGameoverSound.stop();
          } catch (e) {}
          try {
            this._currentGameoverSound.destroy();
          } catch (e) {}
          this._currentGameoverSound = null;
        }
      } catch (e) {}

      // Cancel auto timers to avoid double-transition.
      try {
        if (this.resultAutoLeaveTimer) {
          this.resultAutoLeaveTimer.remove(false);
          this.resultAutoLeaveTimer = null;
        }
        if (this.resultCountdownTimer) {
          this.resultCountdownTimer.remove(false);
          this.resultCountdownTimer = null;
        }
      } catch (e) {}

      // Hide the current scene entirely before switching.
      try {
        if (this.playerTableGroup) {
          this.playerTableGroup.setVisible(false);
        }
        if (this.resultContainer) {
          this.resultContainer.setVisible(false);
        }
        this.cameras.main.setVisible(false);
      } catch (e) {
        console.warn("goToLobby: hide visuals failed", e);
      }

      // 종료/시상대 후 지연된 프로필 업데이트가 있으면 반영
      try {
        if (this._deferredMyProfile) {
          this.applyDeferredProfileUpdates();
        }
        this.applyDeferredCoins();
      } catch (e) {
        console.warn("goToLobby: failed to apply deferred profile/coins", e);
      }

      // ensure singleplayer coins are synced/kept to server (or local fallback)
      try {
        if (typeof this.emitInventory === "function") {
          this.emitInventory("postProfileSync", { requireServerProfile: false });
        }
      } catch (e) {
        console.warn("goToLobby: postProfileSync emit failed", e);
      }

      // Stop GameScene and return to lobby while keeping multiplayer room context.
      try {
        if (this.scene.isActive("GameScene")) {
          this.scene.stop("GameScene");
        }
      } catch (e) {
        console.warn("goToLobby: stop GameScene failed", e);
      }

      try {
        this.returnToLobby({ rejoinRoom: !this.isSingle, leaveRoom: false });
      } catch (e) {
        console.warn("goToLobby: returnToLobby failed", e);
        try {
          this.scene.start("LobbyScene", { preventAutoStartSingleAfterTutorial: true });
        } catch (err) {
          console.warn("goToLobby: fallback start LobbyScene failed", err);
        }
      }
    };

    confirmBtn.on("pointerdown", () => {
      if (!isResultReadyToConfirm) {
        this.sound.play("btn", { volume: 0.1 });
        if (typeof this.showToast === "function") {
          this.showToast("코인 업데이트가 완료된 후에 이동합니다.", "#f1c40f");
        }
        return;
      }

      this.sound.play("btn", { volume: 0.1 });
      
      // 🔴 [최종 보장] 확인 버튼 클릭 시 최종 코인 검증
      try {
        const rankRewardCoins = this._resultRankRewardCoins || [];
        const baselineCoins = this._resultBaselineCoins || 0;
        const rankedPlayersData = this._resultRankedPlayers || [];
        
        const myRank = rankedPlayersData.findIndex(p => 
          p && String(p.id) === String(socket?.id)
        );
        if (myRank >= 0 && myRank < 3) {
          const awardedAmount = rankRewardCoins[myRank] || 0;
          const expectedFinalCoins = baselineCoins + awardedAmount;
          const currentCoins = Number(this.myProfile?.coins) || 0;
          
          console.log('[result/final] 확인 버튼 클릭 시 최종 검증', { 
            currentCoins, 
            expectedFinalCoins,
            myRank,
            awardedAmount
          });
          
          // 최종 검증: 부족하면 추가
          if (currentCoins < expectedFinalCoins) {
            const finalMissing = expectedFinalCoins - currentCoins;
            console.log('[result/final] 최종 보장: 부족한 코인 추가', { 
              currentCoins, 
              expectedFinalCoins, 
              finalMissing 
            });
            this.modifyCoins(finalMissing, { sync: true, force: true, coinCardUpdate: true });
          } else {
            console.log('[result/final] 이미 최종 금액 도달', { currentCoins, expectedFinalCoins });
          }
        }
      } catch (e) {
        console.warn('[result/final] 최종 검증 실패', e);
      }
      
      goToLobby();
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
          this.isResultOverlayActive = true;
          // resultbg 위치 애니메이션 완료 후 코인 수급 처리를 시작
          playCoinCollectAnimation();
        },
      });
    } else {
      container.y = 0;
      this.isResultOverlayActive = true;
      enableConfirmButton();
      // 업데이트 모드에서는 이미 결과창이 끝난 상태로 간주하고 바로 실행
      playCoinCollectAnimation();
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
    // mark that the big finish text is visible so UI updates should be paused
    try { this.isResultTextVisible = true; } catch (e) {}

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
              try { finishText.destroy(); } catch (e) {}
              try { this.isResultTextVisible = false; } catch (e) {}
              // 결과표시가 시작되고 나면 종료 플래그 그대로 유지
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

  clearActiveToast() {
    if (this._toastClearTimer) {
      this._toastClearTimer.remove(false);
      this._toastClearTimer = null;
    }
    if (this._toastClearTimeoutId) {
      try {
        window.clearTimeout(this._toastClearTimeoutId);
      } catch (e) {}
      this._toastClearTimeoutId = null;
    }
    if (this.activeToastTween) {
      try {
        this.activeToastTween.stop();
      } catch (e) {}
      this.activeToastTween = null;
    }
    if (this.activeToast) {
      try {
        this.activeToast.destroy();
      } catch (e) {}
      this.activeToast = null;
    }
    if (this.toastLayer) {
      try {
        this.toastLayer.removeAll(true);
      } catch (e) {}
      try {
        this.toastLayer.setVisible(false);
        this.toastLayer.setActive(false);
      } catch (e) {}
    }
    this.isToastOpen = false;
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
        stroke: "#000000",
            strokeThickness: 3,
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

    // 로그로 전달받은 유저 목록 확인
    console.log("[Invite] showInvitePopup users:", users);

    // 기본값 보장 (undefined / null 대응)
    const safeUsers = Array.isArray(users) ? users : [];

    // 배경
    const popupWidth = width * 0.85;
    const popupHeight = height * 0.55;
    const popupBg = this.add
      .image(centerX, centerY, "invitebg")
      .setDisplaySize(popupWidth, popupHeight)
      .setDepth(30000)
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
      .setDepth(30001);

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
      .setDepth(30001);

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
        .setDepth(30002);

      userButtons.push(emptyText);
    }

    safeUsers.forEach((user, index) => {
      const safeUser = {
        id: user?.id || null,
        nickname: user?.nickname || user?.name || "알 수 없는 요리사",
        level: Number(user?.level) || 1,
        avatarKey: user?.avatarKey || "player_1",
      };

      const btnY =
        listContainerY - listH / 2 + (index + 1) * (listH / (safeUsers.length + 1));
      const userIconX = centerX - popupWidth * 0.31;
      const userTextX = userIconX + width * 0.08; // ensure text is right of icon
      const inviteBtnX = centerX + popupWidth * 0.26;

      // 유저 배경
      const userBg = this.add
        .image(centerX, btnY, "roombg")
        .setDisplaySize(popupWidth * 0.8, height * 0.068)
        .setDepth(301)
        .setInteractive({ useHandCursor: true });

      // 유저 아이콘
      const baseUserAvatar = /^player_[1-4]$/.test(safeUser.avatarKey)
        ? safeUser.avatarKey
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
        .setDepth(30002);

      // 유저명 + 레벨 (한 줄)
      const userInfo = this.add
        .text(userTextX, btnY, `Lv.${safeUser.level} ${safeUser.nickname}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.032}px`,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          fontWeight: "bold",
        })
        .setOrigin(0.5)
        .setDepth(30002);

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
            socket.emit("inviteUser", { targetId: safeUser.id });
            this.showToast(`${safeUser.nickname}님을 초대했습니다!`, "#3498db");
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
      .setDepth(30000)
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
      .setDepth(30001);

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
      .setDepth(30001);

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
      .setDepth(30001);

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
      .setDepth(30001)
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
      .setDepth(30002);

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
      .setDepth(30001)
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
      .setDepth(30002);

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
};

// Ensure defensive fallback methods exist on prototypes in case some build
// or earlier initialization path failed to attach them to the class.
try {
  if (typeof GameScene !== 'undefined') {
    if (typeof GameScene.prototype.setProfileCoinLabel !== 'function') {
      GameScene.prototype.setProfileCoinLabel = function (text) {
        try {
          if (this.isGameEnded && !this.isSingle) return;
          if (this.profileCoinTxt && this.profileCoinTxt.active && typeof this.profileCoinTxt.setText === 'function') {
            this.profileCoinTxt.setText(text);
          }
        } catch (e) {
          // swallow
        }
      };
    }
    if (typeof GameScene.prototype.setProfileCoinShort !== 'function') {
      GameScene.prototype.setProfileCoinShort = function (text) {
        try {
          if (this.isGameEnded && !this.isSingle) return;
          if (this.profileCoinText && this.profileCoinText.active && typeof this.profileCoinText.setText === 'function') {
            this.profileCoinText.setText(text);
          }
        } catch (e) {
          // swallow
        }
      };
    }
  }
  if (typeof LobbyScene !== 'undefined') {
    if (typeof LobbyScene.prototype.setProfileCoinLabel !== 'function') {
      LobbyScene.prototype.setProfileCoinLabel = GameScene.prototype.setProfileCoinLabel;
    }
    if (typeof LobbyScene.prototype.setProfileCoinShort !== 'function') {
      LobbyScene.prototype.setProfileCoinShort = GameScene.prototype.setProfileCoinShort;
    }

    if (typeof LobbyScene.prototype.safeSyncInventory !== 'function') {
      LobbyScene.prototype.safeSyncInventory = function (reason, extra = {}) {
        try {
          if (typeof this.syncInventoryToServer === 'function') {
            this.syncInventoryToServer(reason, extra);
            return;
          }
          if (typeof syncInventoryToServer === 'function') {
            try {
              syncInventoryToServer(reason, extra);
              return;
            } catch (e) {}
          }
          if (
            typeof window !== 'undefined' &&
            typeof window.syncInventoryToServer === 'function'
          ) {
            try {
              window.syncInventoryToServer(reason, extra);
              return;
            } catch (e) {}
          }

          // Fallback direct emit for LobbyScene.
          if (typeof socket !== 'undefined' && socket && socket.connected) {
            const resolvedPlayerId =
              this.myProfile?.nickname ||
              localStorage.getItem('nickname') ||
              this.myNickname ||
              '요리사';

            const specialCardsOwned = JSON.parse(
              localStorage.getItem('specialCards') || '{}',
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
              nickname: this.myProfile?.nickname,
              playerId: socket.id,
              items,
              specialCards: specialCardsOwned,
              ...extra,
            };

            if (this.myProfile && Number.isFinite(Number(this.myProfile.coins))) {
              payload.coins = Number(this.myProfile.coins);
            }
            if (this.myProfile && Number.isFinite(Number(this.myProfile.level))) {
              payload.level = Number(this.myProfile.level);
            }
            if (this.myProfile && Number.isFinite(Number(this.myProfile.experience))) {
              payload.experience = Number(this.myProfile.experience);
            }
            // 멀티 정답률은 서버 전송하지 않고 로컬로만 관리합니다.
            //if (this.myProfile && Number.isFinite(Number(this.myProfile.ratio))) {
            //  payload.ratio = Number(this.myProfile.ratio);
            //}

            socket.emit('syncPlayerInventory', payload);
            socket.emit('syncInventory', payload);
            socket.emit('updatePlayerInventory', payload);
            socket.emit('updateProfile', payload);
            socket.emit('savePlayerProfile', payload);
            return;
          }

          console.warn('LobbyScene.safeSyncInventory: no syncInventoryToServer available and no socket', reason, extra);
        } catch (e) {
          console.warn('LobbyScene.safeSyncInventory error', e);
        }
      };
    }

    if (typeof LobbyScene.prototype.modifyCoins !== 'function') {
      LobbyScene.prototype.modifyCoins = function (delta, options = {}) {
        try {
          const amount = Number(delta) || 0;
          if (!this.myProfile || typeof this.myProfile !== 'object') {
            this.myProfile = { level: 1, coins: 0, experience: 0 };
          }
          const prev = Number(this.myProfile.coins) || 0;
          const next = prev + amount;
          this.myProfile.coins = next;

          if (typeof this.updateMyProfileUI === 'function') {
            this.updateMyProfileUI();
          }

          if (options.sync) {
            this.safeSyncInventory('modifyCoins', { coins: next, delta: amount, ...options });
          }

          return next;
        } catch (e) {
          console.warn('LobbyScene.modifyCoins failed', e);
          return null;
        }
      };
    }

    if (typeof LobbyScene.prototype.rewardQuestCoins !== 'function') {
      LobbyScene.prototype.rewardQuestCoins = function (amount, reason, questKey) {
        if (!Number.isFinite(amount) || amount <= 0) return;
        this.modifyCoins(Number(amount), { sync: true });
        if (!this.isSingle && typeof this.showToast === 'function') {
          this.showToast(`퀘스트 보상 ${amount}💰 (${reason})`, '#22c55e');
        }
        try {
          this.safeSyncInventory('questReward', { coins: Number(amount), questKey, reason });
        } catch (e) {
          console.warn('LobbyScene.rewardQuestCoins sync failed', e);
        }
      };
    }
  }
} catch (e) {
  // ignore
}

// Defensive wrapper: ensure updateMyProfileUI respects game-end guard regardless
try {
  if (typeof GameScene !== 'undefined' && typeof GameScene.prototype.updateMyProfileUI === 'function') {
    const _origUpdate = GameScene.prototype.updateMyProfileUI;
    GameScene.prototype.updateMyProfileUI = function (profile) {
      try {
        if (this.isGameEnded && !this._isApplyingDeferredProfile) {
          console.debug('updateMyProfileUI skipped by wrapper due to isGameEnded', { profile });
          return;
        }
      } catch (e) {
        // ignore
      }
      return _origUpdate.call(this, profile);
    };
  }
} catch (e) {
  // ignore
}
/* prettier-ignore-file */

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
window.game = game; // 디버그용으로 전역에 노출

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
