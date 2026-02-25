import { getUserKeyForGame } from "@apps-in-toss/web-framework";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { title } from "process";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";

const THUNDER_CARD_TYPE = "thunder";
const SINGLE_THUNDER_CARD_COUNT = 3;
const BOMB_CARD_TYPE = "bomb";
const SINGLE_BOMB_CARD_COUNT = 1;
const TON_CARD_TYPE = "ton";
const SINGLE_TON_CARD_COUNT = 1;
const PEN_CARD_TYPE = "pen";
const SINGLE_PEN_CARD_COUNT = 1;
const PLUS1_CARD_TYPE = "plus1";
const SINGLE_PLUS1_CARD_COUNT = 1;
const PLUS2_CARD_TYPE = "plus2";
const SINGLE_PLUS2_CARD_COUNT = 1;
const MULT2_CARD_TYPE = "mult2";
const SINGLE_MULT2_CARD_COUNT = 1;

function handleGetUserKey() {
  // ReactNativeWebView가 있는지 먼저 확인
  if (typeof ReactNativeWebView !== "undefined") {
    ReactNativeWebView.postMessage(JSON.stringify({ type: "GET_USER_KEY" }));
  } else {
    // 브라우저 환경일 경우 임시 키 발급 또는 에러 방지 처리
    console.warn(
      "ReactNativeWebView를 찾을 수 없습니다. 브라우저 모드로 동작합니다.",
    );
    return "GUEST_USER";
  }
}

const PRODUCTION_HOSTS = new Set([
  "halemale.onrender.com",
  "halemale-client.onrender.com",
  "halemale.apps.tossmini.com",
  "halemale.private-apps.tossmini.com",
  "skewer-master.apps.tossmini.com",
  "skewer-master.private-apps.tossmini.com",
]);
const browserHost =
  typeof window !== "undefined" ? window.location.hostname : "";
const isProductionBrowser = PRODUCTION_HOSTS.has(browserHost);
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
  console.log(`🛰️ [serverDebug][${ts}][room:${roomId}] ${event}`, payload);
});

socket.off("connect").on("connect", () => {
  console.log("🔌 socket connected", {
    serverUrl: SERVER_URL,
    socketId: socket.id,
  });
});

socket.off("disconnect").on("disconnect", (reason) => {
  console.warn("🔌 socket disconnected", {
    serverUrl: SERVER_URL,
    reason,
  });
});

socket.off("serverHello").on("serverHello", (payload) => {
  console.log("🧭 serverHello", {
    serverUrl: SERVER_URL,
    ...payload,
  });
});

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
    this.pendingRoomData = data && data.fromGame ? data : null;
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

    // 1. 기존 loadingText 삭제 후 이 코드를 넣으세요
    const loadingContainer = this.add.container(width / 2, height / 2);

    // 회전하는 스피너 (이미지 없이 코드로만 그림)
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

    const loadingText = this.add
      .text(0, 60, "데이터를 불러오는 중...", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.04}px`,
        fill: "#ffffff",
      })
      .setOrigin(0.5);

    loadingContainer.add([spinner, loadingText]);

    // 진행률 표시 (선택사항 - % 숫자가 올라감)
    const onLoadProgress = (value) => {
      if (!loadingText || !loadingText.active) return;
      loadingText.setText(`로딩 중... ${Math.floor(value * 100)}%`);
    };
    this.load.on("progress", onLoadProgress);

    // 로드 완료 시 컨테이너 제거
    this.load.once("complete", () => {
      this.load.off("progress", onLoadProgress);
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

    let ASSET_SERVER = "";
    let VERSION = "";

    if (this.isOnline) {
      ASSET_SERVER = "https://cushi-assets.onrender.com";
      VERSION = "?v=2";
    } else {
      ASSET_SERVER = "assets";
      VERSION = "";
    }

    const PLAYER1_SPRITE_VERSION = VERSION
      ? `${VERSION}&p1=20260221_8`
      : "?p1=20260221_8";
    const MYBG_SPRITE_VERSION = VERSION
      ? `${VERSION}&mbg=20260221_3`
      : "?mbg=20260221_3";

    this.load.image(
      "popupclose",
      `${ASSET_SERVER}/images/popupclose.png${VERSION}`,
    );

    this.load.image("mybg", `${ASSET_SERVER}/images/mybg.png${VERSION}`);
    this.load.spritesheet(
      "mybg_sprite_a",
      `${ASSET_SERVER}/images/mybg_sprite_a.png${MYBG_SPRITE_VERSION}`,
      {
        frameWidth: 416,
        frameHeight: 752,
      },
    );
    this.load.spritesheet(
      "mybg_sprite_b",
      `${ASSET_SERVER}/images/mybg_sprite_b.png${MYBG_SPRITE_VERSION}`,
      {
        frameWidth: 416,
        frameHeight: 752,
      },
    );
    this.load.spritesheet(
      "mybg_sprite_c",
      `${ASSET_SERVER}/images/mybg_sprite_c.png${MYBG_SPRITE_VERSION}`,
      {
        frameWidth: 416,
        frameHeight: 752,
      },
    );
    this.load.spritesheet(
      "mybg_sprite_d",
      `${ASSET_SERVER}/images/mybg_sprite_d.png${MYBG_SPRITE_VERSION}`,
      {
        frameWidth: 416,
        frameHeight: 752,
      },
    );

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

    this.load.image("bar", `${ASSET_SERVER}/images/bar.png${VERSION}`);
    this.load.image("multbg", `${ASSET_SERVER}/images/multbg.png${VERSION}`);

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
      "mult2",
      `${ASSET_SERVER}/images/cards/special/ongame_mult2.png${VERSION}`,
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
    this.load.image("chef", `${ASSET_SERVER}/images/chef.png${VERSION}`);
    this.load.image("storebg", `${ASSET_SERVER}/images/storebg.png${VERSION}`);

    this.load.spritesheet(
      "player_1_sprite_a",
      `${ASSET_SERVER}/images/player_1_sprite_a.png${PLAYER1_SPRITE_VERSION}`,
      {
        frameWidth: 480,
        frameHeight: 640,
      },
    );
    this.load.spritesheet(
      "player_1_sprite_b",
      `${ASSET_SERVER}/images/player_1_sprite_b.png${PLAYER1_SPRITE_VERSION}`,
      {
        frameWidth: 480,
        frameHeight: 640,
      },
    );
    this.load.spritesheet(
      "player_1_sprite_c",
      `${ASSET_SERVER}/images/player_1_sprite_c.png${PLAYER1_SPRITE_VERSION}`,
      {
        frameWidth: 480,
        frameHeight: 640,
      },
    );
    this.load.spritesheet(
      "player_1_sprite_d",
      `${ASSET_SERVER}/images/player_1_sprite_d.png${PLAYER1_SPRITE_VERSION}`,
      {
        frameWidth: 480,
        frameHeight: 640,
      },
    );

    // 플레이어 애니메이션용 이미지
    this.load.image(
      "player_1_1",
      `${ASSET_SERVER}/images/player_1_1.png${VERSION}`,
    );
    this.load.image(
      "player_1_2",
      `${ASSET_SERVER}/images/player_1_2.png${VERSION}`,
    );
    this.load.image(
      "player_1_3",
      `${ASSET_SERVER}/images/player_1_3.png${VERSION}`,
    );
    this.load.image(
      "player_1_4",
      `${ASSET_SERVER}/images/player_1_4.png${VERSION}`,
    );
    this.load.image(
      "player_2_1",
      `${ASSET_SERVER}/images/player_2_1.png${VERSION}`,
    );
    this.load.image(
      "player_2_2",
      `${ASSET_SERVER}/images/player_2_2.png${VERSION}`,
    );
    this.load.image(
      "player_3_1",
      `${ASSET_SERVER}/images/player_3_1.png${VERSION}`,
    );
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
    this.load.image("popupbg", `${ASSET_SERVER}/images/popupbg.png${VERSION}`);
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
    this.load.audio("btn", `${ASSET_SERVER}/sounds/btn.wav${VERSION}`);
    this.load.audio("spin", `${ASSET_SERVER}/sounds/spin.wav${VERSION}`);
    this.load.audio("readygo", `${ASSET_SERVER}/sounds/readygo.mp3${VERSION}`);
    this.load.audio("irassai", `${ASSET_SERVER}/sounds/irassai.mp3${VERSION}`);
    this.load.audio("yare", `${ASSET_SERVER}/sounds/yare.mp3${VERSION}`);
    this.load.audio("yosi", `${ASSET_SERVER}/sounds/yosi.mp3${VERSION}`);
    this.load.audio("pass", `${ASSET_SERVER}/sounds/pass.wav${VERSION}`);
  }

  async create() {
    this.isJoinPopupOpen = false;
    this.isToastOpen = false;
    this.isRoomOpen = false;
    this.lastBackPressedAt = 0;
    this.backPressExitWindowMs = 2000;
    this.isSingle = false; // 로비는 항상 멀티플레이
    this.coinShopElements = []; // 코인 팝업 요소들

    this.lobbyChatMessages = this.lobbyChatMessages || [];
    this.lobbyChatTexts = [];
    this.lobbyChatLayout = null;
    this.lobbyChatInputElement = null;
    this.lobbyChatLastSent = null;

    // 특수카드 쿨타임 추적 객체 초기화
    this.specialCardCooldowns = {}; // { cardId: endTime }
    this.specialCardCooldownTimers = {}; // { cardId: timerId }

    this.currentJoinPopupCloseHandler = null;
    this.currentShopPopupCloseHandler = null;

    const savedNickname = localStorage.getItem("nickname");

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
      });
    } else {
      // 3. 이미 닉네임이 있다면 팝업 없이 바로 서버로 전송
      this.myNickname = savedNickname;
      socket.emit("setNickname", {
        nickname: savedNickname,
        avatarKey: this.getSelectedAvatarKey(),
      });

      // (선택 사항) 로딩 중이라면 바로 메인 화면으로 진입하는 로직 실행
      console.log(`반가워요, ${savedNickname} 요리사님!`);
    }

    this.myProfile = {
      nickname: this.myNickname || savedNickname || "요리사",
      level: Number(localStorage.getItem("profileLevel")) || 1,
      coins: Number(localStorage.getItem("profileCoins")) || 0,
      experience: Number(localStorage.getItem("profileExperience")) || 0,
    };
    this.hasReceivedProfileStats = false;

    this.profileAvatarKeys = ["player_1", "player_2", "player_3", "player_4"];
    const savedAvatarKey = localStorage.getItem("profileAvatarKey");
    const savedAvatarIndex = this.profileAvatarKeys.indexOf(savedAvatarKey);
    this.profileAvatarIndex = savedAvatarIndex >= 0 ? savedAvatarIndex : 0;

    bgmEnabled = localStorage.getItem("bgmEnabled") !== "false";

    handleGetUserKey();

    // 1. 먼저 컨테이너를 준비합니다.
    if (!this.mainUIContainer) {
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
          this.sound.play("bgm", { loop: true, volume: 0.05 });
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

    const lobbyBg = this.add
      .sprite(centerX, height / 2, "mybg")
      .setDisplaySize(width, height * 1.1)
      .setDepth(0)
      .setAlpha(1);

    const mybgAnimKey = this.ensureMybgAnimation();
    if (mybgAnimKey && this.canUseMybgSpriteSheets()) {
      lobbyBg.setTexture("mybg_sprite_a", 0);
      lobbyBg.play(mybgAnimKey, true);
      lobbyBg.setDisplaySize(width, height * 1.1);
    } else if (this.textures.exists("mybg")) {
      lobbyBg.setTexture("mybg");
      lobbyBg.setDisplaySize(width, height * 1.1);
    }

    socket.off("hostChanged").on("hostChanged", (data) => {
      if (data.players) this.currentPlayers = data.players;
      this.hostId = data.hostId;

      this.refreshLobbyUI(data);

      if (data.message) {
        this.time.delayedCall(100, () => {
          this.sound.play("irassai", { volume: 0.1 });
          this.showToast(data.message, "#f1c40f");
        });
      }
    });

    socket.off("myProfile").on("myProfile", (profile) => {
      const normalizeSpecialCardId = (rawId) => {
        if (rawId === null || rawId === undefined) return null;

        const numericId = Number(rawId);
        if (Number.isFinite(numericId) && numericId >= 1 && numericId <= 3) {
          return numericId;
        }

        const idText = String(rawId).toLowerCase().trim();
        const idMap = {
          magnet: 1,
          bomb: 2,
          star: 3,
          자석: 1,
          폭탄: 2,
          별: 3,
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

      let mergedOwnedCharacters = normalizeOwnedCharacters(
        JSON.parse(localStorage.getItem("ownedCharacters") || "{}"),
      );

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
        localStorage.setItem(
          "ownedCharacters",
          JSON.stringify(mergedOwnedCharacters),
        );
      }

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
            localStorage.setItem("profileAvatarKey", profile.current_character);
            this.updateProfileAvatarUI();
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
            localStorage.setItem("profileAvatarKey", profile.avatarKey);
            this.updateProfileAvatarUI();
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
          console.warn(
            "특수카드 데이터 파싱 실패: 기존 로컬 데이터를 유지합니다.",
          );
        } else {
          localStorage.setItem("specialCards", JSON.stringify(parsed));
        }
      }

      this.updateMyProfileUI(profile);
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
          window.location.reload();
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
          window.location.reload();
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
    const y = height * 0.42;
    const btnH = height * 0.07;

    const actionBtnY = height * 0.8;
    const actionBtnW = width * 0.28;
    const actionBtnGap = width * 0.03;
    const actionBtnOffset = actionBtnW + actionBtnGap;

    const multiBtn = this.add.container(centerX - actionBtnOffset, actionBtnY);

    const profileCenterY = y;
    const profileSize = width * 0.2;
    const profileContainer = this.add.container(centerX, profileCenterY);

    // 프로필 배경 이미지
    const profileBg = this.add
      .image(0, y * 0.1, "profilebg")
      .setDisplaySize(profileSize * 2.3, profileSize * 2.5)
      .setAlpha(1.0);

    // 프로필 이미지를 스프라이트로 생성하고 애니메이션 적용
    const currentKey = this.getSelectedAvatarKey();
    // 존재하는 텍스처를 우선 사용, 없으면 안전한 플레이스홀더로 폴백
    let currentAvatarTexture = null;
    if (this.textures.exists(`${currentKey}_1`)) {
      currentAvatarTexture = `${currentKey}_1`;
    } else if (this.textures.exists(`${currentKey}`)) {
      currentAvatarTexture = `${currentKey}`;
    } else if (this.textures.exists("player_1_sprite_a")) {
      currentAvatarTexture = "player_1_sprite_a";
    } else {
      currentAvatarTexture = "chef"; // 안전한 기본 이미지
    }
    const currentIdx = this.profileAvatarKeys.indexOf(currentKey);
    this.profileAvatarIndex = currentIdx >= 0 ? currentIdx : 0;
    this.profileImage = this.add
      .sprite(0, 0, currentAvatarTexture)
      .setDisplaySize(profileSize, profileSize);
    this.applyAvatarAnimation(this.profileImage, currentKey);

    const avatarLeftBtn = this.add
      .circle(-profileSize * 0.75, 0, profileSize * 0.14, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });

    const avatarLeftIcon = this.add
      .text(-profileSize * 0.75, 0, "<", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    const avatarRightBtn = this.add
      .circle(profileSize * 0.75, 0, profileSize * 0.14, 0x000000, 0.55)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });

    const avatarRightIcon = this.add
      .text(profileSize * 0.75, 0, ">", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    const levelBadge = this.add
      .circle(
        -profileSize * 0.35,
        profileSize * 0.35,
        profileSize * 0.2,
        0xe67e22,
      )
      .setStrokeStyle(2, 0xffffff, 1);

    this.profileLevelText = this.add
      .text(-profileSize * 0.35, profileSize * 0.35, "1", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.035}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    this.profileIdText = this.add
      .text(0, profileSize * 0.72, this.myProfile.nickname, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // 코인 + 경험치 표시 영역 (한 줄)
    const statY = profileSize * 1.06;
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
      profileBg,
      this.profileImage,
      avatarLeftBtn,
      avatarLeftIcon,
      avatarRightBtn,
      avatarRightIcon,
      levelBadge,
      this.profileLevelText,
      this.profileIdText,
      this.profileStatusBg,
      this.profileCoinText,
      this.profileExpBarBg,
      this.profileExpBarFill,
      this.profileExpText,
    ]);

    avatarLeftBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
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
      this.sound.play("pop", { volume: 0.08 });
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

    const multiBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(actionBtnW, btnH * 1.2)
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
      this.sound.play("pop", { volume: 0.1 });

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

    const singleBtn = this.add.container(centerX, actionBtnY);
    const singleBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(actionBtnW, btnH * 1.2)
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
      this.sound.play("pop", { volume: 0.1 });
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
    const shopBtn = this.add.container(centerX + actionBtnOffset, actionBtnY);
    const shopBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(actionBtnW, btnH * 1.2)
      .setInteractive()
      .setTint(0xff69b4); // 핑크 포인트

    const shopBtnText = this.add
      .text(0, 0, "🎁 상점", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.042}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    shopBtn.add([shopBtnImg, shopBtnText]);

    shopBtnImg.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.1 });
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

      /*console.log(
        "📥 roomCreated 받은 데이터:",
        JSON.stringify(data.players, null, 2),
      );*/

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
      this.createBlocker(); // 함수 호출

      this.hideLoading();

      this.cleanupPopup();

      /*console.log(
        "📥 playerJoined 받은 데이터:",
        JSON.stringify(data.players, null, 2),
      );*/

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

    socket.off("joinRoomSuccess").on("joinRoomSuccess", (data) => {
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
      this.refreshLobbyUI(data);
    });

    // ======================================
    // 1️⃣ 초기화
    // ======================================
    let bgmOn = localStorage.getItem("bgmEnabled") !== "false";

    // BGM 인스턴스 만들기 (한 번만)
    let bgm = this.sound.get("bgm");
    if (!bgm) {
      bgm = this.sound.add("bgm", { loop: true, volume: 0.05 });
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
        window.location.reload();
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
    this.mainUIContainer.add([bgmBtn]);
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

    this.myProfile = {
      nickname:
        profile.nickname ||
        prev.nickname ||
        localStorage.getItem("nickname") ||
        "요리사",
      level: Number(profile.level ?? prev.level ?? 1) || 1,
      coins: Number(profile.coins ?? prev.coins ?? 0) || 0,
      experience: Number(profile.experience ?? prev.experience ?? 0) || 0,
    };

    localStorage.setItem("profileLevel", String(this.myProfile.level));
    localStorage.setItem("profileCoins", String(this.myProfile.coins));
    localStorage.setItem(
      "profileExperience",
      String(this.myProfile.experience),
    );

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

    if (
      !this.profileLevelText ||
      !this.profileIdText ||
      !this.profileCoinText ||
      !this.profileExpBarFill ||
      !this.profileExpText
    ) {
      return;
    }

    this.profileLevelText.setText(`${this.myProfile.level}`);
    this.profileIdText.setText(this.myProfile.nickname);
    this.profileCoinText.setText(`X ${this.myProfile.coins}`);

    // 경험치 바 업데이트
    const currentExp = this.myProfile.experience % XP_PER_LEVEL;
    const expRatio = currentExp / XP_PER_LEVEL;
    const { width } = this.cameras.main;
    const profileSize = width * 0.2;
    const expBarWidth = profileSize * 0.9;
    const expBarHeight = width * 0.032;
    const statY = profileSize * 1.06;
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

    let owned = {};
    try {
      owned = JSON.parse(localStorage.getItem("ownedCharacters") || "{}");
    } catch (err) {
      owned = {};
    }

    const ownedKeys = allKeys.filter(
      (key) => key === "player_1" || !!owned[key],
    );
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
    this.updateProfileAvatarUI();

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

  getAvatarAnimMaxFrame(baseKey) {
    return baseKey === "player_1" ? 4 : 2;
  }

  getMybgAnimKey() {
    return "mybg_anim";
  }

  getMybgSpriteSheets() {
    return [
      { key: "mybg_sprite_a", frameCount: 25 },
      { key: "mybg_sprite_b", frameCount: 25 },
      { key: "mybg_sprite_c", frameCount: 25 },
      { key: "mybg_sprite_d", frameCount: 16 },
    ];
  }

  canUseMybgSpriteSheets() {
    const spriteSheetKeys = this.getMybgSpriteSheets().map((item) => item.key);
    if (!spriteSheetKeys.every((key) => this.textures.exists(key))) {
      return false;
    }

    const renderer = this.sys?.game?.renderer;
    const maxTextureSize =
      typeof renderer?.maxTextureSize === "number"
        ? renderer.maxTextureSize
        : 4096;

    return spriteSheetKeys.every((key) => {
      const texture = this.textures.get(key);
      const source = texture?.getSourceImage();
      const width = Number(source?.width) || 0;
      const height = Number(source?.height) || 0;

      return (
        width > 0 &&
        height > 0 &&
        width <= maxTextureSize &&
        height <= maxTextureSize
      );
    });
  }

  ensureMybgAnimation() {
    const animKey = this.getMybgAnimKey();
    if (this.anims.exists(animKey)) {
      return animKey;
    }

    if (!this.canUseMybgSpriteSheets()) {
      return null;
    }

    const frames = [];
    this.getMybgSpriteSheets().forEach(({ key: textureKey, frameCount }) => {
      const texture = this.textures.get(textureKey);
      const availableFrames = Math.max(0, (texture.frameTotal || 1) - 1);
      const totalFrames = Math.min(frameCount, availableFrames);
      if (totalFrames <= 0) {
        return;
      }

      frames.push(
        ...this.anims.generateFrameNumbers(textureKey, {
          start: 0,
          end: totalFrames - 1,
        }),
      );
    });

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
    return baseKey === "player_1" ? 18 : 2;
  }

  getPlayer1SpriteSheets() {
    return [
      { key: "player_1_sprite_a", frameCount: 25 },
      { key: "player_1_sprite_b", frameCount: 25 },
      { key: "player_1_sprite_c", frameCount: 21 },
      { key: "player_1_sprite_d", frameCount: 20 },
    ];
  }

  canUsePlayer1SpriteSheets() {
    const spriteSheetKeys = this.getPlayer1SpriteSheets().map(
      (item) => item.key,
    );
    if (!spriteSheetKeys.every((key) => this.textures.exists(key))) {
      return false;
    }

    const renderer = this.sys?.game?.renderer;
    const maxTextureSize =
      typeof renderer?.maxTextureSize === "number"
        ? renderer.maxTextureSize
        : 4096;

    return spriteSheetKeys.every((key) => {
      const texture = this.textures.get(key);
      const source = texture?.getSourceImage();
      const width = Number(source?.width) || 0;
      const height = Number(source?.height) || 0;

      return (
        width > 0 &&
        height > 0 &&
        width <= maxTextureSize &&
        height <= maxTextureSize
      );
    });
  }

  ensureAvatarAnimation(baseKey) {
    const animKey = this.getAvatarAnimKey(baseKey);
    if (this.anims.exists(animKey)) {
      return animKey;
    }

    if (baseKey === "player_1" && this.canUsePlayer1SpriteSheets()) {
      const sheetMetas = this.getPlayer1SpriteSheets()
        .map(({ key: textureKey, frameCount }) => {
          const texture = this.textures.get(textureKey);
          const availableFrames = Math.max(0, (texture.frameTotal || 1) - 1);
          const totalFrames = Math.min(
            Math.max(0, frameCount),
            availableFrames,
          );
          return { textureKey, totalFrames };
        })
        .filter((item) => item.totalFrames > 0);

      const sheetMap = new Map(
        sheetMetas.map((item) => [item.textureKey, item.totalFrames]),
      );
      const frames = [];
      for (let row = 0; row < 10; row += 1) {
        for (let col = 0; col < 10; col += 1) {
          const localRow = row < 5 ? row : row - 5;
          const localCol = col < 5 ? col : col - 5;
          const textureKey =
            row < 5
              ? col < 5
                ? "player_1_sprite_a"
                : "player_1_sprite_b"
              : col < 5
                ? "player_1_sprite_c"
                : "player_1_sprite_d";
          const frameIndex = localRow * 5 + localCol;
          const totalFrames = sheetMap.get(textureKey) || 0;
          if (frameIndex >= totalFrames) {
            continue;
          }
          frames.push({ key: textureKey, frame: frameIndex });
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
  }

  applyAvatarAnimation(target, baseKey) {
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

    if (baseKey === "player_1" && this.canUsePlayer1SpriteSheets()) {
      target.setOrigin(0.5, 1);
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
      target.y = avatarBaseY + target.displayHeight * 0.5;
      target.setTexture(this.getPlayer1SpriteSheets()[0].key, 0);
      if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
        target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
      }
      if (animKey) {
        target.play(animKey, true);
        if (avatarDisplayWidth > 0 && avatarDisplayHeight > 0) {
          target.setDisplaySize(avatarDisplayWidth, avatarDisplayHeight);
        }
      }
      return;
    }

    if (baseKey === "player_1") {
      return;
    }

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

  updateProfileAvatarUI() {
    if (!this.profileImage || !this.profileAvatarKeys) {
      return;
    }

    const baseKey = this.getSelectedAvatarKey();
    const selectedIndex = this.profileAvatarKeys.indexOf(baseKey);
    if (selectedIndex >= 0) {
      this.profileAvatarIndex = selectedIndex;
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

    console.log("차단막이 생성되었습니다.");
    return this.lobbyBlocker;
  }

  // 1. 모든 소켓 이벤트를 처리할 공통 데이터 업데이트 함수
  refreshLobbyUI(data) {
    if (!this.scene.isActive()) return;

    // 서버가 주는 데이터가 있으면 갱신, 없으면 기존값 유지 (undefined 방지)
    this.currentRoomId = data.roomId || this.currentRoomId;
    this.currentPlayers = data.players || [];
    this.currentMax = data.max || this.currentMax;
    this.hostId = data.hostId || this.hostId;
    this.currentRoomName = data.roomName || this.currentRoomName || "대기실";
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

  showToast(message, color = "#ffffff") {
    this.isToastOpen = true;

    if (!this.cameras || !this.cameras.main) return;

    const { width, height } = this.cameras.main;

    if (this.activeToast) this.activeToast.destroy();

    // 1. 컨테이너 생성 및 절대 좌표 고정
    const toast = this.add.container(width / 2, -100);

    // Phaser 3에서 안전하게 사용 가능한 최상위 뎁스
    toast.setDepth(999999);
    toast.setScrollFactor(0); // 카메라 이동 무시
    this.activeToast = toast;

    // 2. 배경 (약간 더 두껍고 눈에 띄게)
    const bg = this.add.rectangle(0, 0, width * 0.85, 70, 0x111111, 0.95);
    bg.setStrokeStyle(3, 0xffffff, 1);

    // 3. 텍스트 (글자 크기를 조금 더 키움)
    const txt = this.add
      .text(0, 0, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${Math.floor(width * 0.05)}px`,
        color: color,
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    toast.add([bg, txt]);

    // 4. 효과음 재생 (재생되는지 다시 확인)
    this.sound.play("pop", { volume: 0.5 });

    // 5. 애니메이션 (y좌표를 150이 아닌 화면 전체 높이의 15% 지점으로)
    this.tweens.add({
      targets: toast,
      y: height * 0.15,
      duration: 400,
      ease: "Back.easeOut",
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

  showJoinCodePopup(callback) {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    // 1. 전용 컨테이너 생성 (Scene에 변수로 저장하여 외부에서 접근 가능하게 함)
    // 기존에 존재한다면 먼저 지우고 새로 생성 (중복 방지)
    if (this.joinPopupContainer) this.joinPopupContainer.destroy();
    this.joinPopupContainer = this.add.container(0, 0).setDepth(200);

    // 2. 반투명 배경
    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.5)
      .setInteractive();

    // 3. 팝업 배경 이미지
    const popupBg = this.add
      .image(centerX, popupY, "popupbg")
      .setDisplaySize(width * 0.7, height * 0.24);

    // 4. 안내 텍스트
    const titleText = this.add
      .text(centerX, popupY - 160, "방 코드를 입력하세요.", {
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
      this.sound.play("pop", { volume: 0.1 });

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

    // showJoinCodePopup 내부 confirmBtnImg 로직
    confirmBtnImg.on("pointerdown", () => {
      const code = el.value.trim();

      // 1. 클릭 효과음
      this.sound.play("pop", { volume: 0.1 });

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
  }

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
      this.sound.play("pop", { volume: 0.1 });
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
        this.sound.play("pop", { volume: 0.1 });
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

  showShopPopup() {
    this.isJoinPopupOpen = true;
    this.setLobbyChatInputHidden(true);

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.5;

    const specialCards = [
      {
        id: 1,
        name: "🧲 자석",
        description: "모든 과일을 끌어당깁니다",
        price: 100,
      },
      {
        id: 2,
        name: "💣 폭탄",
        description: "상대방 카드를 날립니다",
        price: 150,
      },
      {
        id: 3,
        name: "⭐ 별",
        description: "2배 점수 획득",
        price: 200,
      },
    ];

    const characterItems = [
      {
        key: "player_1",
        name: "🍳 기본 요리사",
        description: "기본 제공 캐릭터",
        price: 0,
      },
      {
        key: "player_2",
        name: "🧑‍🍳 요리사 2",
        description: "단단한 스킬의 베테랑",
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
      const owned = normalizeOwnedCharacters(
        JSON.parse(localStorage.getItem("ownedCharacters") || "{}"),
      );
      localStorage.setItem("ownedCharacters", JSON.stringify(owned));
      return owned;
    };

    const saveOwnedCharacters = (ownedCharacters) => {
      const normalized = normalizeOwnedCharacters(ownedCharacters);
      localStorage.setItem("ownedCharacters", JSON.stringify(normalized));
    };

    const getCharacterIdFromKey = (characterKey) => {
      const match = /^player_(\d+)$/.exec(String(characterKey || ""));
      return match ? Number(match[1]) : null;
    };

    const syncInventoryToServer = (reason, extra = {}) => {
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

      const ownedCharacters = Object.entries(getOwnedCharacters())
        .filter(([, owned]) => !!owned)
        .map(([key]) => key);

      const currentCharacter = this.getSelectedAvatarKey();
      const payload = {
        reason,
        id: resolvedPlayerId,
        userId: resolvedPlayerId,
        player_id: resolvedPlayerId,
        nickname: this.myProfile.nickname,
        playerId: socket.id,
        coins: Number(this.myProfile.coins) || 0,
        items,
        specialCards: specialCardsOwned,
        ownedCharacters,
        currentCharacter,
        owned_characters: ownedCharacters,
        current_character: currentCharacter,
        ...extra,
      };

      socket.emit("syncPlayerInventory", payload);
      socket.emit("syncInventory", payload);
      socket.emit("updatePlayerInventory", payload);
      socket.emit("updateProfile", payload);
      socket.emit("savePlayerProfile", payload);
    };

    const equipCharacter = (avatarKey) => {
      const idx = this.profileAvatarKeys.indexOf(avatarKey);
      if (idx >= 0) {
        this.profileAvatarIndex = idx;
        localStorage.setItem("profileAvatarKey", avatarKey);
        this.updateProfileAvatarUI();

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
      .image(centerX, coinDisplayY, "itembg")
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
        this.sound.play("pop", { volume: 0.08 });
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
        color: "#ffffff",
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
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const buyBtn = this.add
      .image(centerX, buyButtonY, "ui_btn")
      .setDisplaySize(width * 0.35, height * 0.07)
      .setTint(shopBuyBtnTint)
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

        const nameText = this.add
          .text(0, -80, card.name, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.07}px`,
            color: "#39ff14",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 5,
          })
          .setOrigin(0.5);

        const descText = this.add
          .text(0, -25, card.description, {
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
          .text(0, 25, `💰 ${card.price}`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.05}px`,
            color: "#ffd700",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5);

        const ownedText = this.add
          .text(0, 65, `보유중: ${ownedCount}개`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.035}px`,
            color: "#2ecc71",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        cardDisplayContainer.add([nameText, descText, priceText, ownedText]);

        buyBtnText.setText("구매하기");
      }

      if (currentTab === "character") {
        const character = characterItems[index];
        const ownedCharacters = getOwnedCharacters();
        const isOwned = !!ownedCharacters[character.key];
        const isEquipped =
          this.profileAvatarKeys[this.profileAvatarIndex] === character.key;

        const nameText = this.add
          .text(0, -80, character.name, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.065}px`,
            color: "#4ecdc4",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 5,
          })
          .setOrigin(0.5);

        const descText = this.add
          .text(0, -25, character.description, {
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
          .text(0, 25, character.price > 0 ? `💰 ${character.price}` : "무료", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.05}px`,
            color: "#ffd700",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 4,
          })
          .setOrigin(0.5);

        const ownedText = this.add
          .text(0, 65, isOwned ? "보유중" : "미보유", {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.035}px`,
            color: isOwned ? "#2ecc71" : "#ff6b6b",
            fontWeight: "bold",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        cardDisplayContainer.add([nameText, descText, priceText, ownedText]);

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

      this.sound.play("pop", { volume: 0.08 });
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

      this.sound.play("pop", { volume: 0.08 });
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
      this.sound.play("pop", { volume: 0.1 });
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
          localStorage.setItem("profileCoins", String(this.myProfile.coins));

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

          syncInventoryToServer("buySpecialCard", {
            boughtItemId: card.id,
          });

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
          equipCharacter(character.key);
          this.showToast(`${character.name} 착용 완료!`, "#2ecc71");
          renderShopContent();
          return;
        }

        if (this.myProfile.coins < character.price) {
          this.showToast("코인이 부족합니다!", "#e74c3c");
          return;
        }

        this.myProfile.coins -= character.price;
        localStorage.setItem("profileCoins", String(this.myProfile.coins));
        this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);

        ownedCharacters[character.key] = true;
        saveOwnedCharacters(ownedCharacters);
        equipCharacter(character.key);
        this.updateMyProfileUI();

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
            nickname: this.myProfile.nickname,
            playerId: socket.id,
            characterKey: character.key,
            characterId,
            characterPrice: character.price,
            currentCharacter: character.key,
            current_character: character.key,
            ownedCharacters: Object.keys(ownedCharacters).filter(
              (key) => ownedCharacters[key],
            ),
            owned_characters: Object.keys(ownedCharacters).filter(
              (key) => ownedCharacters[key],
            ),
            coins: Number(this.myProfile.coins) || 0,
          };

          socket.emit("buyCharacter", characterPayload);
          socket.emit("purchaseCharacter", characterPayload);
          socket.emit("characterPurchased", characterPayload);
        }

        syncInventoryToServer("buyCharacter", {
          boughtCharacter: character.key,
          bought_character: character.key,
        });
        this.showToast(`${character.name} 구매 완료!`, "#2ecc71");
        renderShopContent();
        return;
      }

      if (currentTab === "coin") {
        const product = coinProducts[tabIndexes.coin];
        this.buyCoin(product.amount);
        this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
        syncInventoryToServer("buyCoin", {
          boughtCoinAmount: product.amount,
        });
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
      this.sound.play("pop", { volume: 0.08 });
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

  showCoinShopPopup() {
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
      this.sound.play("pop", { volume: 0.08 });
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
        this.sound.play("pop", { volume: 0.1 });
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
  }

  buyCoin(amount) {
    // 🔹 코인 추가
    this.myProfile.coins += amount;
    localStorage.setItem("profileCoins", String(this.myProfile.coins));

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

    // 🔹 서버에 전송 (멀티플레이인 경우)
    if (!this.isSingle && socket.connected) {
      socket.emit("addCoins", { amount });
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
            this.sound.play("pop", { volume: 0.1 });

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
              const itemY = pageIndex * (roomItemHeight + 10);

              const isPlaying = room.isGameStarted === true;

              const itemBg = this.add
                .image(0, itemY, "roombg")
                .setDisplaySize(listWidth, roomItemHeight)
                .setTint(isPlaying ? 0x555555 : 0xffffff)
                .setInteractive({ useHandCursor: true });

              const roomNo = i + 1;
              const publicTag = room.isPublic === false ? "🔒" : "🌐";
              const playingTag = isPlaying ? " 🎮플레이중" : "";
              const roomTitle = room.roomName || `${room.hostNickname}의 방`;
              const roomInfo = `${roomNo}. ${publicTag} ${roomTitle}${playingTag}  (${room.playerCount}/${room.maxPlayers})`;
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
                this.sound.play("pop", { volume: 0.1 });

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
            const pageButtonY = (maxVisibleRooms + 1) * (roomItemHeight + 10);
            const buttonGap = width * 0.15;

            // 이전 버튼
            const prevBtnBg = this.add
              .rectangle(
                -buttonGap,
                pageButtonY,
                width * 0.2,
                height * 0.05,
                0x3498db,
              )
              .setInteractive({ useHandCursor: true });
            const prevBtnText = this.add
              .text(-buttonGap, pageButtonY, "◀ 이전", {
                fontFamily: "Jua",
                fontSize: `${width * 0.028}px`,
                color: "#ffffff",
              })
              .setOrigin(0.5);

            // 다음 버튼
            const nextBtnBg = this.add
              .rectangle(
                buttonGap,
                pageButtonY,
                width * 0.2,
                height * 0.05,
                0x3498db,
              )
              .setInteractive({ useHandCursor: true });
            const nextBtnText = this.add
              .text(buttonGap, pageButtonY, "다음 ▶", {
                fontFamily: "Jua",
                fontSize: `${width * 0.028}px`,
                color: "#ffffff",
              })
              .setOrigin(0.5);

            // 페이지 표시
            const pageIndicator = this.add
              .text(0, pageButtonY, `${currentPage + 1}/${totalPages}`, {
                fontFamily: "Jua",
                fontSize: `${width * 0.028}px`,
                color: "#cccccc",
              })
              .setOrigin(0.5);

            // 버튼 상태 업데이트
            const updateButtonStates = () => {
              if (currentPage === 0) {
                prevBtnBg.setFillStyle(0x7f8c8d);
                prevBtnBg.disableInteractive();
              } else {
                prevBtnBg.setFillStyle(0x3498db);
                prevBtnBg.setInteractive({ useHandCursor: true });
              }

              if (currentPage === totalPages - 1) {
                nextBtnBg.setFillStyle(0x7f8c8d);
                nextBtnBg.disableInteractive();
              } else {
                nextBtnBg.setFillStyle(0x3498db);
                nextBtnBg.setInteractive({ useHandCursor: true });
              }

              pageIndicator.setText(`${currentPage + 1}/${totalPages}`);
            };

            updateButtonStates();

            // 이전 버튼 클릭
            prevBtnBg.on("pointerdown", () => {
              if (currentPage > 0) {
                this.sound.play("pop", { volume: 0.1 });
                currentPage--;
                displayRoomsPage();
                updateButtonStates();
              }
            });

            prevBtnText.on("pointerdown", () => {
              if (currentPage > 0) {
                this.sound.play("pop", { volume: 0.1 });
                currentPage--;
                displayRoomsPage();
                updateButtonStates();
              }
            });

            // 다음 버튼 클릭
            nextBtnBg.on("pointerdown", () => {
              if (currentPage < totalPages - 1) {
                this.sound.play("pop", { volume: 0.1 });
                currentPage++;
                displayRoomsPage();
                updateButtonStates();
              }
            });

            nextBtnText.on("pointerdown", () => {
              if (currentPage < totalPages - 1) {
                this.sound.play("pop", { volume: 0.1 });
                currentPage++;
                displayRoomsPage();
                updateButtonStates();
              }
            });

            container.add([
              prevBtnBg,
              prevBtnText,
              nextBtnBg,
              nextBtnText,
              pageIndicator,
            ]);
          }
        };

        const showRoomCreateForm = (container) => {
          // 방 이름 입력창 (DOM 절대 좌표)
          const roomNameInput = this.add
            .dom(centerX * -0.36, contentY * -0.25, "input")
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
          const btnGapX = width * 0.13;
          const toggleY = height * 0.01;

          const publicBtnImg = this.add
            .image(-btnGapX, toggleY * 4, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x3498db) // 활성 상태 (파란색)
            .setInteractive({ useHandCursor: true });
          const publicBtnText = this.add
            .text(-btnGapX, toggleY * 4, "🌐 공개", {
              fontFamily: "Jua",
              fontSize: `${width * 0.033}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          const privateBtnImg = this.add
            .image(btnGapX, toggleY * 4, "uibtn")
            .setDisplaySize(width * 0.22, height * 0.05)
            .setTint(0x7f8c8d) // 비활성 상태 (회색)
            .setInteractive({ useHandCursor: true });
          const privateBtnText = this.add
            .text(btnGapX, toggleY * 4, "🔒 비공개", {
              fontFamily: "Jua",
              fontSize: `${width * 0.033}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          // 비밀번호 입력창 (비공개 선택 시 표시)
          const pwInput = this.add
            .dom(centerX * -0.35, contentY * -0.1, "input")
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
            this.sound.play("pop", { volume: 0.1 });
            updateToggle(true);
          });
          publicBtnText.on("pointerdown", () => {
            this.sound.play("pop", { volume: 0.1 });
            updateToggle(true);
          });
          privateBtnImg.on("pointerdown", () => {
            this.sound.play("pop", { volume: 0.1 });
            updateToggle(false);
          });
          privateBtnText.on("pointerdown", () => {
            this.sound.play("pop", { volume: 0.1 });
            updateToggle(false);
          });

          // 방 만들기 버튼
          const createBtnImg = this.add
            .image(0, height * 0.13, "uibtn")
            .setDisplaySize(width * 0.25, height * 0.06)
            .setTint(0x2ecc71)
            .setInteractive({ useHandCursor: true });
          const createBtnText = this.add
            .text(0, height * 0.13, "만들기", {
              fontFamily: "Jua",
              fontSize: `${width * 0.042}px`,
              color: "#ffffff",
              fontWeight: "bold",
            })
            .setOrigin(0.5);

          createBtnImg.on("pointerdown", () => {
            this.sound.play("pop", { volume: 0.1 });
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

                this.showLoading("방 생성 중...");
                socket.emit("createRoom", {
                  nickname: myNickname,
                  avatarKey: this.getSelectedAvatarKey(),
                  maxPlayers: 4,
                  isPublic: isPublic,
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
              this.sound.play("pop", { volume: 0.1 });
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
            this.sound.play("pop", { volume: 0.1 });
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

        // 6. 나가기 버튼 (Home으로)
        const cancelBtnImg = this.add
          .image(centerX, popupY * 1.75, "uibtn")
          .setDisplaySize(width * 0.3, height * 0.065)
          .setInteractive({ useHandCursor: true })
          .setTint(0xffaaaa);
        const cancelBtnText = this.add
          .text(centerX, popupY * 1.75, "나가기", {
            fontFamily: "Jua",
            fontSize: `${width * 0.055}px`,
            color: "#ffffff",
          })
          .setOrigin(0.5);

        // 나가기 버튼을 컨테이너에 추가
        this.joinPopupContainer.add([cancelBtnImg, cancelBtnText]);

        // 나가기 버튼 클릭 이벤트
        cancelBtnImg.on("pointerdown", () => {
          this.sound.play("pop", { volume: 0.1 });

          if (window.ReactNativeWebView) {
            generateHapticFeedback({ type: "impactLight" }).catch(() => {});
          }

          this.tweens.add({
            targets: [cancelBtnImg, cancelBtnText],
            scaleX: "*=0.95",
            scaleY: "*=0.95",
            duration: 50,
            yoyo: true,
            onComplete: () => {
              closePopupWithCleanup();
              // 씬 재시작 없이 팝업만 닫음 (mainUIContainer 유지)
            },
          });
        });
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
      this.sound.play("pop", { volume: 0.1 });
      closePwPopup();
    });

    confirmBtnImg.on("pointerdown", () => {
      const pw = pwEl.value.trim();
      if (!pw || pw.length < 4) {
        this.showToast("비밀번호 4자리를 입력해주세요!", "#e74c3c");
        return;
      }
      this.sound.play("pop", { volume: 0.1 });
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

    // 3. 팝업 배경 이미지 (컨테이너 내부 0, 0 위치)
    const popupBg = this.add
      .image(0, 0, "popupbg")
      .setDisplaySize(width * 0.7, height * 0.28);

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
    confirmBtnImg.once("pointerdown", () => {
      const nickname = el.value.trim() || "요리사";

      closeNicknamePopup();

      if (callback) callback(nickname);
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

    const roomHeaderText =
      typeof roomNumber === "number" ? `${roomNumber}.${roomName}` : roomName;

    // 입장 코드 (방 제목 표시)
    const codeText = this.add
      .text(centerX, height * 0.075, roomHeaderText, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.065}px`,
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
        : "player_1_1";
      const profileX = cardLeft + profileSize * 1.1;

      const profileImg = this.add
        .sprite(profileX, pos.y - cardH * 0.05, avatarTextureKey)
        .setDisplaySize(profileSize * 2, profileSize * 2);
      this.lobbyUIContainer.add(profileImg);
      this.applyAvatarAnimation(profileImg, baseAvatarKey);

      if (isHost && !isThisPlayerHost) {
        profileImg.setInteractive({ useHandCursor: true });
        profileImg.on("pointerdown", () => {
          this.sound.play("pop", { volume: 0.1 });
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
            this.sound.play("pop", { volume: 0.1 });
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
      .setDisplaySize(chatSendW, chatInputH)
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
      this.sound.play("pop", { volume: 0.1 });
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
        this.sound.play("pop", { volume: 0.1 });
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
        this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
      this.tweens.add({
        targets: [exitBtnImg, exitBtnText],
        scale: "*=0.95",
        duration: 100,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
          window.location.reload();
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
      .image(centerX, centerY, "popupbg")
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
      this.sound.play("pop", { volume: 0.1 });

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
      this.sound.play("pop", { volume: 0.1 });

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
      this.sound.play("pop", { volume: 0.1 });
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
            : "player_1_1",
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
        this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
    const popupHeight = height * 0.35;
    const popupBg = this.add
      .image(centerX, centerY, "popupbg")
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
      this.sound.play("pop", { volume: 0.1 });
      destroyPopup();
    });

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
      .setDepth(4002);

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
      .setDepth(4002);

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
      .setDepth(4002);

    // 수락 버튼 (uibtn 이미지)
    const acceptBtn = this.add
      .image(
        centerX - width * 0.15,
        centerY + popupHeight / 2 - height * 0.05,
        "uibtn",
      )
      .setDisplaySize(width * 0.2, height * 0.06)
      .setTint(0x2ecc71)
      .setDepth(4001)
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
      .setDepth(4002);

    // 거절 버튼 (uibtn 이미지)
    const declineBtn = this.add
      .image(
        centerX + width * 0.15,
        centerY + popupHeight / 2 - height * 0.05,
        "uibtn",
      )
      .setDisplaySize(width * 0.2, height * 0.06)
      .setTint(0xe74c3c)
      .setDepth(4001)
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
      .setDepth(4002);

    allObjects.push(
      titleText,
      infoText,
      playerCountText,
      acceptBtn,
      acceptBtnText,
      declineBtn,
      declineBtnText,
    );

    // 자동 닫기 (15초)
    let autoCloseTimer = this.time.delayedCall(15000, () => {
      destroyPopup();
    });

    acceptBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
  }

  async create() {
    // GameScene의 init 혹은 create 상단에 추가
    if (this.resultContainer) {
      this.resultContainer.destroy();
      this.resultContainer = null;
    }

    // 특수카드 쿨타임 추적 객체 초기화
    this.specialCardCooldowns = {}; // { cardId: endTime }
    this.specialCardCooldownTimers = {}; // { cardId: timerId }

    const difficultyMultipliers = {
      easy: 1.4,
      normal: 1,
      hard: 0.75,
    };
    const aiMultiplier =
      difficultyMultipliers[this.roundData.aiDifficulty] || 1;

    const baseAiSettings = [
      {
        id: "AI_1",
        nickname: "초보",
        reactionTime: 2500,
        flipDelay: 1500,
      }, // 느림
      {
        id: "AI_2",
        nickname: "중급",
        reactionTime: 1800,
        flipDelay: 1200,
      }, // 보통
      {
        id: "AI_3",
        nickname: "천재",
        reactionTime: 1200,
        flipDelay: 1000,
      }, // 빠름
    ];

    this.aiSettings = baseAiSettings.map((ai) => ({
      ...ai,
      reactionTime: Math.round(ai.reactionTime * aiMultiplier),
      flipDelay: Math.round(ai.flipDelay * aiMultiplier),
    }));

    if (this.isSingle) {
      // 싱글플레이면 소켓 ID가 아닌 "PLAYER_ME" 혹은 players[0].id를 내 ID로 강제 지정
      this.myId = this.roundData.players[0].id;
      this.turnIndex = 0; // 내 차례부터 시작
      this.isGameStarted = true;
      this.initializeSingleDecks();
    } else {
      this.myId = socket.id;
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
      this.sound.play("irassai", { volume: 0.1 });
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
      const prevLevel = Number(localStorage.getItem("profileLevel")) || 1;
      const newLevel = Number(profile?.level) || prevLevel;
      const incomingCoins = Number(profile?.coins);
      const incomingExperience = Number(profile?.experience);
      const safeCoins = Number.isFinite(incomingCoins)
        ? incomingCoins
        : Number(localStorage.getItem("profileCoins")) || 0;
      const safeExperience = Number.isFinite(incomingExperience)
        ? incomingExperience
        : Number(localStorage.getItem("profileExperience")) || 0;

      localStorage.setItem("profileLevel", String(newLevel));
      localStorage.setItem("profileCoins", String(safeCoins));
      localStorage.setItem("profileExperience", String(safeExperience));

      if (newLevel > prevLevel) {
        this.showToast(`레벨 업! Lv.${prevLevel} → Lv.${newLevel}`, "#2ecc71");
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
      this.roundData.isGameStarted = true;
      this.isGameReady = true;

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
          this.sound.play("pop", { volume: 0.5 }); // 기존에 있는 pop 사운드 활용

          // 모바일이라면 진동 추가 (브라우저 지원 시)
          if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
          }
        } else {
          this.canClick = false;
          this.clearMyTurnTimer();
        }

        this.renderTable(this.roundData.players);
      }
    });

    socket.off("cardFlipped").on("cardFlipped", (data) => {
      if (this.isSingle) return;

      if (data?.card?.type === THUNDER_CARD_TYPE) {
        console.log("⚡ [client] THUNDER cardFlipped:", {
          playerId: data.playerId,
          nextTurnId: data.nextTurnId,
          remainingCount: data.remainingCount,
        });
      }

      // 1. 데이터 갱신
      const player = this.roundData.players.find((p) => p.id === data.playerId);
      if (player) {
        if (data.openCardStack) {
          player.openStack = data.openCardStack;
        } else {
          if (!player.openStack) player.openStack = [];
          // 애니메이션 전에는 아직 넣지 않습니다 (playCardFlipAnimation 내부에서 처리)
        }
        player.cards = data.remainingCount ?? player.cards;

        // 💡 탈락 상태 업데이트
        if (typeof data.isEliminated === "boolean") {
          player.isEliminated = data.isEliminated;
        }
      }

      // 3. 애니메이션 및 테이블 갱신
      this.playCardFlipAnimation(data);
    });

    socket.off("bellResult").on("bellResult", (data) => {
      if (this.myTurnTimer) {
        this.myTurnTimer.remove();
        this.myTurnTimer = null;
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
        this.roundData.players = updatedPlayers;
        /*this.time.delayedCall(500, () => {
          this.renderTable(this.roundData.players);
        });*/
      } else {
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
        window.location.reload();
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
      .on("pointerdown", () => this.handleRingBell());
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
    if (card && card.type === PLUS2_CARD_TYPE) {
      return "plus2";
    }
    if (card && card.type === MULT2_CARD_TYPE) {
      return "mult2";
    }

    const fruitNames = { 1: "strawberry", 2: "banana", 3: "lime", 4: "plum" };
    const fruitName = fruitNames[card.fruit] || "strawberry";
    return `${fruitName}_${card.count}`;
  }

  renderTable(players) {
    if (!players || !this.playerTableGroup) return;
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

    sortedPlayers.forEach((p, i) => {
      if (!p || !pos[i]) return;
      const layout = pos[i];

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

    if (totalStackCount > 0) {
      const cx = width * 0.5;
      const cy = height * 0.465;

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
      if (isMe) {
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
  }

  drawSpecialCards(p, layout) {
    const { width, height } = this.cameras.main;
    const myId = this.isSingle ? this.myId || "PLAYER_ME" : socket.id;
    const isMe = p.id === myId; // 내 카드인지 확인

    // 나만 특수카드를 표시함
    if (!isMe) return;

    // 특수카드 데이터 정의 (총 5개) - 쿨타임 추가
    const allSpecialCards = [
      {
        id: 1,
        name: "🧲",
        description: "자석",
        emoji: "🧲",
        cooldown: 10000, // 10초
      },
      {
        id: 2,
        name: "💣",
        description: "폭탄",
        emoji: "💣",
        cooldown: 15000, // 15초
      },
      {
        id: 3,
        name: "⭐",
        description: "별",
        emoji: "⭐",
        cooldown: 20000, // 20초
      },
      {
        id: 4,
        name: "🔥",
        description: "불",
        emoji: "🔥",
        cooldown: 12000, // 12초
      },
      {
        id: 5,
        name: "❄️",
        description: "얼음",
        emoji: "❄️",
        cooldown: 18000, // 18초
      },
    ];

    // localStorage에서 보유한 특수카드 로드
    const specialCardsOwned =
      JSON.parse(localStorage.getItem("specialCards")) || {};

    // 카드 배치 (내 아이디 아래에 가로 5개)
    const cardSize = width * 0.12; // 특수카드 크기 (1.5배 증가)
    const startX = layout.x - (cardSize * 2.3 + width * 0.02 * 2); // 중앙 정렬
    const cardY = layout.y + width * 0.28; // 닉네임 아래에 배치
    const cardGap = cardSize + width * 0.04; // 카드 간격

    allSpecialCards.forEach((card, index) => {
      const cardX = startX + index * cardGap;
      const count = specialCardsOwned[card.id] || 0;

      // 쿨타임 체크
      const now = Date.now();
      const cooldownEnd = this.specialCardCooldowns[card.id] || 0;
      const isOnCooldown = now < cooldownEnd;
      const remainingTime = isOnCooldown
        ? Math.ceil((cooldownEnd - now) / 1000)
        : 0;

      if (count > 0) {
        // 보유한 카드: 버튼으로 표시
        // 쿨타임 중이면 회색/어두운 배경, 아니면 초록색 배경
        const bgColor = isOnCooldown ? 0x555555 : 0x2ecc71;
        const bgAlpha = isOnCooldown ? 0.5 : 0.7;
        const borderColor = isOnCooldown ? 0xff4444 : 0xffd700;

        const cardBg = this.add
          .rectangle(cardX, cardY, cardSize, cardSize, bgColor, bgAlpha)
          .setStrokeStyle(3, borderColor, 1)
          .setInteractive({ useHandCursor: !isOnCooldown });

        const cardEmoji = this.add
          .text(cardX, cardY - cardSize * 0.15, card.emoji, {
            fontFamily: "Arial",
            fontSize: `${cardSize * 0.6}px`,
          })
          .setOrigin(0.5)
          .setAlpha(isOnCooldown ? 0.3 : 1);

        const cardCount = this.add
          .text(cardX, cardY + cardSize * 0.25, `x${count}`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${cardSize * 0.3}px`,
            color: "#ffffff",
            fontWeight: "bold",
          })
          .setOrigin(0.5)
          .setAlpha(isOnCooldown ? 0.3 : 1);

        // 쿨타임 오버레이 및 시각적 효과
        if (isOnCooldown) {
          // 남은 시간 텍스트 (크게 표시)
          const cooldownText = this.add
            .text(cardX, cardY, `${remainingTime}`, {
              fontFamily: GAME_FONTS.main,
              fontSize: `${cardSize * 0.7}px`,
              color: "#ffffff",
              fontWeight: "bold",
              stroke: "#ff0000",
              strokeThickness: 6,
            })
            .setOrigin(0.5);

          // 원형 쿨타임 진행 표시 (더 두껍고 밝게)
          const progress = 1 - (cooldownEnd - now) / card.cooldown;
          const cooldownCircle = this.add.graphics();
          cooldownCircle.lineStyle(6, 0xff3333, 1);
          const startAngle = -90; // 위쪽부터 시작
          const endAngle = startAngle + 360 * progress;
          cooldownCircle.beginPath();
          cooldownCircle.arc(
            cardX,
            cardY,
            cardSize * 0.48,
            Phaser.Math.DegToRad(startAngle),
            Phaser.Math.DegToRad(endAngle),
            false,
          );
          cooldownCircle.strokePath();

          this.playerTableGroup.add([cooldownText, cooldownCircle]);

          // 버튼 비활성화
          cardBg.disableInteractive();
        } else {
          // 클릭 이벤트 추가 (쿨타임이 아닐 때만)
          cardBg.on("pointerdown", () => {
            this.sound.play("pop", { volume: 0.1 });
            this.tweens.add({
              targets: [cardBg, cardEmoji, cardCount],
              scale: "*=0.95",
              duration: 100,
              yoyo: true,
              ease: "Quad.easeInOut",
              onComplete: () => {
                this.useSpecialCard(card.id, card.name, card.cooldown);
              },
            });
          });
        }

        this.playerTableGroup.add([cardBg, cardEmoji, cardCount]);
      } else {
        // 미보유 카드: 흰색 빈 칸
        const emptyBg = this.add
          .rectangle(cardX, cardY, cardSize, cardSize, 0x444444, 0.4)
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
    const cardsToDraw =
      player && player.isFlipping ? openStack.slice(0, -1) : openStack;

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);

    // 기본 카드 뭉치 중앙 위치
    const baseX = layout.x + Math.cos(rad) * dist * 0.7;
    const baseY = layout.y + Math.sin(rad) * dist;

    cardsToDraw.forEach((card, index) => {
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
          .setDepth(150 + index); // 나중 카드가 위로 오게

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
  }

  playWinAnimation(data) {
    const { width, height } = this.cameras.main;
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

    let totalCardsToFly = 0;
    let finishedFlys = 0;

    // 1. 전체 날려야 할 카드 총 개수 먼저 계산
    prevPlayers.forEach((p) => {
      if (p.openStack) totalCardsToFly += p.openStack.length;
    });

    if (totalCardsToFly === 0) {
      this.renderTable(players);
      return;
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
            onComplete: () => {
              flyCard.destroy();
              finishedFlys++;

              // 모든 카드가 다 날아갔을 때
              if (finishedFlys === totalCardsToFly) {
                // 3. 데이터 비우기 및 최종 렌더링
                this.roundData.players.forEach((player) => {
                  player.openStack = [];
                  player.isFlipping = false;
                });
                this.renderTable(this.roundData.players);
                this.sound.play("pop", { volume: 0.3 });
              }
            },
          });
        });
      }
    });
  }

  playCardFlipAnimation(data) {
    if (!data || !this.roundData.players) return;
    const { width, height } = this.cameras.main;
    const cardKey = this.getCardKey(data.card);

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

    const tempCard = this.add
      .image(startPos.x, startPos.y, "card_back")
      .setDisplaySize(width * 0.15, width * 0.22)
      .setDepth(2000);

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(startPos.rotation - 90);

    this.tweens.add({
      targets: tempCard,
      x: startPos.x + Math.cos(rad) * dist * 0.7 + targetOffsetX,
      y: startPos.y + Math.sin(rad) * dist + targetOffsetY,
      duration: 300,
      ease: "Cubic.out",
      onUpdate: (tween) => {
        if (tween.progress > 0.5 && tempCard.texture.key === "card_back") {
          if (this.textures.exists(cardKey)) tempCard.setTexture(cardKey);
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

  playPenaltyAnimation(data) {
    const { width, height } = this.cameras.main;

    // 💥 멀티플레이 패널티 시 강력한 실패 효과
    this.playFailureEffect();

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
      // 바닥 카드 보존을 위해 openStack만 유지하면서 나머지 업데이트
      this.roundData.players.forEach((oldPlayer) => {
        const newPlayer = data.players.find((p) => p.id === oldPlayer.id);
        if (newPlayer) {
          const preservedOpenStack = oldPlayer.openStack;
          Object.assign(oldPlayer, newPlayer);
          oldPlayer.openStack = preservedOpenStack;
        }
      });
      this.renderTable(this.roundData.players);
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
          onStart: () => {
            this.sound.play("pop", { volume: 0.1, detune: 500 });
          },
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
      window.location.reload(); // 로비로 돌아가는 가장 확실한 방법
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
      this.tweens.add({
        targets: this.bellImage,
        scale: "*=0.7", // 원래 스케일에 맞춰 조절 (기존 0.8 유지)
        duration: 50,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
    }

    if (this.isSingle) {
      const totals = this.calculateTotalFruits();
      const isFive = Object.values(totals).some((count) => count === 5);
      const hasThunder = this.hasThunderOnTable();
      const hasBomb = this.hasBombOnTable();

      // bomb이 테이블에 있으면 어떤 경우에도 종은 실패
      if (hasBomb) {
        this.playFailureEffect();
        this.processPenaltySingle(this.myId || "PLAYER_ME");
        return;
      }

      if (isFive || hasThunder) {
        // 💥 성공 시 스펙타클한 이펙트 추가
        this.playSuccessEffect();
        // 성공 사운드
        this.sound.play("irassai", { volume: 0.3 });

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
      socket.emit("ringBell");
    }
  }

  checkFruitCountForAI() {
    if (!this.isSingle) return;

    const totals = this.calculateTotalFruits();
    const isFive = Object.values(totals).some((count) => count === 5);
    const hasThunder = this.hasThunderOnTable();
    const hasBomb = this.hasBombOnTable();

    if (hasBomb) return; // bomb이 있으면 AI는 절대 종을 치지 않음

    if (isFive || hasThunder) {
      this.aiSettings.forEach((ai) => {
        const aiData = this.roundData.players.find((p) => p.id === ai.id);
        // 카드가 있는 AI만 종을 침
        if (aiData && aiData.cards >= 0) {
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

    // --- 핵심 수정: 싱글플레이에서는 로컬 openStack을 직접 누적 ---
    if (!player.openStack || !Array.isArray(player.openStack))
      player.openStack = [];
    player.openStack.push(randomCard); // 즉시 누적해서 기존 바닥 카드들이 유지되게 함

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

    // 5. 💡 마지막 카드를 낸 순간 알림 (기사회생 독려)
    if (playerId === myId && player.cards === 0) {
      this.showToast(
        "마지막 카드를 제출했습니다! 종을 쳐서 카드를 획득하세요!",
        "#f39c12",
      );
    }

    // 6. 다음 턴으로 진행
    this.nextTurn();
    this.checkFruitCountForAI();
  }
  // AI가 종을 치는 로직
  handleAiRingBell(aiId) {
    if (!this.isSingle || !this.isGameStarted) return;

    // 1. 과일이 여전히 5개인지 다시 확인 (이미 플레이어가 쳤을 수 있음)
    const totals = this.calculateTotalFruits();
    const isFive = Object.values(totals).some((count) => count === 5);
    const hasThunder = this.hasThunderOnTable();
    if (!isFive && !hasThunder) return;

    // 💥 AI도 정답 시 스펙타클한 이펙트
    this.playSuccessEffect();

    // 2. 사운드 재생 (캐시 확인 포함)
    if (this.cache.audio.exists("bell")) {
      this.sound.play("bell", { volume: 0.2 });
    } else if (this.cache.audio.exists("pop")) {
      this.sound.play("pop", { volume: 0.2 });
    }
    this.sound.play("irassai", { volume: 0.3 });

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

    // 텍스트 등장 애니메이션
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

  processPenaltySingle(failedPlayerId) {
    if (!this.isSingle || !this.isGameStarted) return;

    const players = this.roundData.players;
    const loser = players.find((p) => p.id === failedPlayerId);
    if (!loser || (Number(loser.cards) || 0) <= 0) return;

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
    this.renderTable(players);

    // 5. 내 카드가 0이 되었다면 패배 판정을 위해 턴 체크
    if (loser.id === (this.myId || "PLAYER_ME") && loser.cards <= 0) {
      this.nextTurn();
    }
  }

  nextTurn() {
    if (!this.isSingle || !this.isGameStarted) return;

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

    // 3. 턴 인덱스를 승자로 고정
    this.turnIndex = winnerIdx;
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

    // 5. 애니메이션 실행 (멀티와 동일한 흐름)
    this.playWinAnimation({
      winnerId: winner.id,
      players: updatedPlayers,
      prevPlayers: prevPlayers,
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
    // Mult2 카드 주입 (싱글)
    const mult2Count = Math.min(SINGLE_MULT2_CARD_COUNT, deckSlots.length);
    for (let index = 0; index < mult2Count; index += 1) {
      const pickIndex = Math.floor(Math.random() * deckSlots.length);
      const picked = deckSlots.splice(pickIndex, 1)[0];
      if (!picked) continue;

      const deck = this.singleDeckByPlayer[picked.playerId];
      if (!Array.isArray(deck)) continue;
      deck[picked.slotIndex] = { type: MULT2_CARD_TYPE };
    }
  }

  updateEliminationStatus() {
    if (!this.roundData || !this.roundData.players) return;

    const totals = this.calculateTotalFruits();
    const isFiveExists = Object.values(totals).some((count) => count === 5);
    const hasThunder = this.hasThunderOnTable();
    const hasBellSuccessWindow = isFiveExists || hasThunder;

    this.roundData.players.forEach((p) => {
      // 이미 탈락한 사람은 상태를 유지 (한번 죽으면 끝)
      if (p.isEliminated) return;

      const hasDeck = (Number(p.cards) || 0) > 0;

      // 1. 낼 카드가 없고 바닥에 5도 없으면 -> 즉시 탈락
      if (!hasDeck && !hasBellSuccessWindow) {
        p.isEliminated = true;
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
    const mult2Active = this.hasMult2OnTable ? this.hasMult2OnTable() : false;
    const multiplier = mult2Active ? 2 : 1;
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
        totals[top.fruit] += (base + extraPerCard) * multiplier;
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

  hasMult2OnTable() {
    if (!this.roundData || !Array.isArray(this.roundData.players)) return false;

    return this.roundData.players.some((player) => {
      if (!player) return false;
      const top =
        Array.isArray(player?.openStack) && player.openStack.length > 0
          ? player.openStack[player.openStack.length - 1]
          : player?.openCard;
      if (player.isEliminated && top?.type === BOMB_CARD_TYPE) return false;
      return top?.type === MULT2_CARD_TYPE;
    });
  }

  // 닉네임 가져오기 보조 함수
  getNicknameById(id) {
    const player = this.roundData.players.find((p) => p.id === id);
    return player ? player.nickname : "AI";
  }

  // 특수카드 사용 함수
  useSpecialCard(cardId, cardName, cooldown) {
    // 게임이 진행중이 아니면 사용 불가
    /*if (!this.isGameStarted) {
      this.showToast("게임 중에만 사용할 수 있습니다!", "#e74c3c");
      return;
    }*/

    // 쿨타임 확인
    const now = Date.now();
    const cooldownEnd = this.specialCardCooldowns[cardId] || 0;
    if (now < cooldownEnd) {
      const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);
      this.showToast(
        `${cardName} 카드는 ${remainingSeconds}초 후에 사용할 수 있습니다!`,
        "#e74c3c",
      );
      return;
    }

    // localStorage에서 보유한 특수카드 확인
    const specialCardsOwned =
      JSON.parse(localStorage.getItem("specialCards")) || {};
    const count = specialCardsOwned[cardId] || 0;

    if (count <= 0) {
      this.showToast("보유한 카드가 없습니다!", "#e74c3c");
      return;
    }

    // 카드 사용 로직 (추후 구현)
    this.showToast(`${cardName} 카드를 사용했습니다!`, "#2ecc71");

    // 카드 개수 차감
    specialCardsOwned[cardId] = count - 1;
    localStorage.setItem("specialCards", JSON.stringify(specialCardsOwned));

    // 쿨타임 설정
    this.specialCardCooldowns[cardId] = now + cooldown;

    // 쿨타임 동안 UI 업데이트 타이머 시작
    if (this.specialCardCooldownTimers[cardId]) {
      this.specialCardCooldownTimers[cardId].remove();
    }

    this.specialCardCooldownTimers[cardId] = this.time.addEvent({
      delay: 100, // 0.1초마다 업데이트
      callback: () => {
        const timeLeft = this.specialCardCooldowns[cardId] - Date.now();
        if (timeLeft <= 0) {
          // 쿨타임 종료
          this.specialCardCooldownTimers[cardId].remove();
          delete this.specialCardCooldownTimers[cardId];
          delete this.specialCardCooldowns[cardId];
        }
        // UI 갱신
        if (this.roundData && this.roundData.players) {
          this.renderTable(this.roundData.players);
        }
      },
      loop: true,
    });

    // UI 갱신을 위해 테이블 다시 렌더링
    if (this.roundData && this.roundData.players) {
      this.renderTable(this.roundData.players);
    }
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
          this.sound.play("pop", { volume: 0.2 });

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

  showResultOverlay(players, isUpdate = false) {
    // 기존 게임 로그 데이터 및 텍스트 객체 제거
    if (this.logTexts) {
      this.logTexts.forEach((txt) => txt.destroy());
      this.logTexts = [];
    }
    if (this.gameLogs) {
      this.gameLogs = [];
    }

    if (!players || players.length === 0) return;

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
      .image(width / 2, height * 0.46, "resultbg")
      .setDisplaySize(width * 1.0, height * 1.0);

    container.add([overlay, podiumBg]);

    const resultAnimKey = "result_player_1_anim";
    if (
      !this.anims.exists(resultAnimKey) &&
      [
        "player_1_sprite_a",
        "player_1_sprite_b",
        "player_1_sprite_c",
        "player_1_sprite_d",
      ].every((key) => this.textures.exists(key))
    ) {
      const frameCounts = {
        player_1_sprite_a: 25,
        player_1_sprite_b: 25,
        player_1_sprite_c: 21,
        player_1_sprite_d: 20,
      };
      const frames = [];
      for (let row = 0; row < 10; row += 1) {
        for (let col = 0; col < 10; col += 1) {
          const localRow = row < 5 ? row : row - 5;
          const localCol = col < 5 ? col : col - 5;
          const textureKey =
            row < 5
              ? col < 5
                ? "player_1_sprite_a"
                : "player_1_sprite_b"
              : col < 5
                ? "player_1_sprite_c"
                : "player_1_sprite_d";
          const frameIndex = localRow * 5 + localCol;
          if (frameIndex >= frameCounts[textureKey]) {
            continue;
          }
          frames.push({ key: textureKey, frame: frameIndex });
        }
      }

      if (frames.length > 0) {
        this.anims.create({
          key: resultAnimKey,
          frames,
          frameRate: 18,
          repeat: -1,
        });
      }
    }

    const rankedPlayers = Array.isArray(players) ? players.slice(0, 3) : [];
    const podiumPositions = [
      { x: width * 0.5, y: height * 0.58 },
      { x: width * 0.23, y: height * 0.64 },
      { x: width * 0.79, y: height * 0.66 },
    ];

    rankedPlayers.forEach((player, index) => {
      const pos = podiumPositions[index];
      if (!pos) return;

      const avatar = this.add
        .sprite(pos.x, pos.y, "player_1_sprite_a", 0)
        .setDisplaySize(width * 0.23, width * 0.23)
        .setOrigin(0.5, 1);

      if (this.anims.exists(resultAnimKey)) {
        avatar.play(resultAnimKey, true);
      }

      const nameText = this.add
        .text(
          pos.x,
          pos.y + width * 0.03,
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

    const goToLobby = () => {
      if (this.resultAutoLeaveTimer) {
        this.resultAutoLeaveTimer.remove();
        this.resultAutoLeaveTimer = null;
      }
      if (this.resultCountdownTimer) {
        this.resultCountdownTimer.remove();
        this.resultCountdownTimer = null;
      }
      this.scene.start("LobbyScene", {
        fromGame: true,
        roomId: this.roundData.roomId,
        players: this.roundData.players,
        hostId: this.roundData.hostId,
        maxPlayers: this.roundData.maxPlayers || 4,
        roomName: this.roundData.roomName || "대기실",
      });
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

      this.sound.play("yosi", { volume: 0.2 });

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
      console.log("실패 연출 실행 시작"); // 디버깅용
      // 실패 피드백: 빨간색 화면 반짝임 + 화면 흔들림
      this.sound.play("yare", { volume: 0.2 });

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
                console.log(
                  "🎮 (ReadyGo) 카드를 제출할 수 있는지:",
                  this.canClick,
                  {
                    myId,
                    currentTurnId,
                    serverNext,
                    turnIndex: this.turnIndex,
                  },
                );
              } catch (e) {
                console.warn(
                  "(ReadyGo) canClick 계산 실패",
                  e && e.stack ? e.stack : e,
                );
              }
            },
          });
        });
      },
    });
  }

  showToast(message, color = "#ffffff") {
    const { width } = this.cameras.main;

    // 토스트 컨테이너
    const toast = this.add.container(width / 2, -50).setDepth(10000);

    // 배경 (반투명 검정 바)
    const bg = this.add.rectangle(0, 0, width * 0.7, 40, 0x000000, 0.7);
    bg.setStrokeStyle(2, 0xffffff, 0.5); // 테두리

    // 텍스트
    const txt = this.add
      .text(0, 0, message, {
        fontFamily: GAME_FONTS.main,
        fontSize: "18px",
        color: color,
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    toast.add([bg, txt]);

    // 효과음 재생 (이미 로드된 'pop'이나 'btn' 사운드 활용)
    this.sound.play("pop", { volume: 0.2 });

    // 애니메이션: 내려왔다가 잠시 머물고 다시 올라가기
    this.tweens.add({
      targets: toast,
      y: 60, // 화면 상단에서 60px 지점까지 내려옴
      duration: 500,
      ease: "Back.easeOut",
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          // 2초 대기
          this.tweens.add({
            targets: toast,
            y: -50,
            duration: 500,
            ease: "Power2.easeIn",
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
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
      .image(centerX, centerY, "popupbg")
      .setDepth(4001)
      .setDisplaySize(width * 0.75, height * 0.25);

    // 3. 메시지 텍스트
    const msgText = this.add
      .text(centerX, centerY - 40, message, {
        fontFamily: GAME_FONTS.main,
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

      if (this.currentGamePopupCloseHandler === closeAlert) {
        this.currentGamePopupCloseHandler = null;
      }
    };

    this.currentGamePopupCloseHandler = closeAlert;

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
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(4003);

    cancelBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.1 });
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
      .setDisplaySize(width * 0.3, height * 0.06)
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
      this.sound.play("pop", { volume: 0.1 });
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
            : "player_1_1",
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
        this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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
      this.sound.play("pop", { volume: 0.1 });
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

const config = {
  type: Phaser.AUTO,
  parent: "game-container", // 🔹 위에서 만든 div ID와 일치해야 함
  width: 1080, // 기준 해상도 (세로형 게임 기준)
  height: 1920,
  backgroundColor: "#0f172a",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true }, // ✅ 여기를 추가
  scene: [LobbyScene, GameScene],
};

new Phaser.Game(config);
