import { getUserKeyForGame } from "@apps-in-toss/web-framework";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { title } from "process";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";

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

const SERVER_URL = "https://halemale.onrender.com";

const socket = io(SERVER_URL, {
  transports: ["websocket", "polling"], // 웹소켓 우선 사용
  withCredentials: true,
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

  init() {
    // 1. 필요한 상태를 미리 체크 (비동기)
    this.isOnline = false;
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
    this.load.on("progress", (value) => {
      loadingText.setText(`로딩 중... ${Math.floor(value * 100)}%`);
    });

    // 로드 완료 시 컨테이너 제거
    this.load.on("complete", () => {
      loadingContainer.destroy();
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

    this.load.image("mybg", `${ASSET_SERVER}/images/mybg.png${VERSION}`);
    this.load.image("gamebg", `${ASSET_SERVER}/images/gamebg.png${VERSION}`);

    this.load.image("roombg", `${ASSET_SERVER}/images/roombg.png${VERSION}`);

    this.load.image("bar", `${ASSET_SERVER}/images/bar.png${VERSION}`);
    this.load.image("itembg", `${ASSET_SERVER}/images/itembg.png${VERSION}`);
    this.load.image("uibtn", `${ASSET_SERVER}/images/ui_btn.png${VERSION}`);
    this.load.image("btnbg", `${ASSET_SERVER}/images/btnbg.png${VERSION}`);

    this.load.image("slide", `${ASSET_SERVER}/images/slide.png${VERSION}`);
    this.load.image("chef", `${ASSET_SERVER}/images/chef.png${VERSION}`);
    this.load.image(
      "player_1",
      `${ASSET_SERVER}/images/player_1.png${VERSION}`,
    );
    this.load.image(
      "player_2",
      `${ASSET_SERVER}/images/player_2.png${VERSION}`,
    );
    this.load.image(
      "player_3",
      `${ASSET_SERVER}/images/player_3.png${VERSION}`,
    );
    this.load.image(
      "player_4",
      `${ASSET_SERVER}/images/player_4.png${VERSION}`,
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
  }

  async create() {
    this.isJoinPopupOpen = false;
    this.isToastOpen = false;
    this.isRoomOpen = false;
    this.isSingle = false; // 로비는 항상 멀티플레이
    this.coinShopElements = []; // 코인 팝업 요소들

    this.currentJoinPopupCloseHandler = null;

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

    if (!this.sound.get("bgm")) {
      if (bgmEnabled) {
        this.sound.play("bgm", { loop: true, volume: 0.05 });
      }
    }

    this.add
      .image(centerX, height / 2, "mybg")
      .setDisplaySize(width, height * 1.1)
      .setDepth(0) // 레이어 순서를 가장 뒤로
      .setAlpha(1); // 게임 화면은 집중을 위해 약간 어둡게 처리(선택사항)

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
      if (
        profile &&
        typeof profile.avatarKey === "string" &&
        /^player_[1-4]$/.test(profile.avatarKey)
      ) {
        const idx = this.profileAvatarKeys.indexOf(profile.avatarKey);
        if (idx >= 0) {
          this.profileAvatarIndex = idx;
          localStorage.setItem("profileAvatarKey", profile.avatarKey);
          this.updateProfileAvatarUI();
        }
      }

      // 특수카드 저장
      if (profile && typeof profile.specialCards === "object") {
        localStorage.setItem(
          "specialCards",
          JSON.stringify(profile.specialCards),
        );
      }

      this.updateMyProfileUI(profile);
    });

    this.backHandler = await App.addListener("backButton", ({ canGoBack }) => {
      // 2. 알림창(Alert)이 떠 있는지 우선 확인
      if (this.isJoinPopupOpen) {
        this.currentJoinPopupCloseHandler();
      } else if (this.isRoomOpen) {
        this.showCustomAlert("로비로 이동합니다!", () => {
          window.location.reload();
        });
      } else if (this.isToastOpen) {
        App.exitApp();
      } else {
        this.showToast("한 번더 누르면 종료됩니다", "#f1c40f");
      }
    });

    /* =======================================================
   멀티 플레이 버튼 (단일 버튼, 4인 기준)
======================================================= */
    const x = centerX; // 화면 중앙
    const y = height * 0.42;
    const btnW = width * 0.5; // 단일 버튼이므로 크기를 조금 더 키움
    const btnH = height * 0.07;

    const multiBtn = this.add.container(x, y);

    const profileCenterY = y - height * 0.02;
    const profileSize = width * 0.2;
    const profileContainer = this.add.container(centerX, profileCenterY);

    // 프로필 배경 이미지
    const profileBg = this.add
      .image(0, y * 0.1, "btnbg")
      .setDisplaySize(profileSize * 2.3, profileSize * 2.1)
      .setAlpha(1.0);

    this.profileImage = this.add
      .image(0, 0, this.profileAvatarKeys[this.profileAvatarIndex])
      .setDisplaySize(profileSize, profileSize);

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

    this.profileCoinText = this.add
      .text(0, profileSize * 1.02, `코인 ${this.myProfile.coins}`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.04}px`,
        color: "#ffd700",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    this.profileExpText = this.add
      .text(
        0,
        profileSize * 1.24,
        `EXP ${this.myProfile.experience % XP_PER_LEVEL}/${XP_PER_LEVEL}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.032}px`,
          color: "#ffffff",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5);

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
      this.profileCoinText,
      this.profileExpText,
    ]);

    avatarLeftBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
      this.changeProfileAvatar(-1);
    });

    avatarRightBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
      this.changeProfileAvatar(1);
    });

    this.updateMyProfileUI();
    this.updateProfileAvatarUI();

    const multiBtnImg = this.add
      .image(0, y * 0.47, "uibtn")
      .setDisplaySize(btnW, btnH * 1.2)
      .setInteractive();

    // 2. 버튼 텍스트
    const multiBtnText = this.add
      .text(0, y * 0.47, "멀티플레이", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
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
        scaleX: 0.9,
        scaleY: 0.9,
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

    // 인원 선택 버튼들 [2, 3, 4] 아래에 추가
    const singleBtnY = height * 0.5; // 싱글플레이 버튼 위치
    const singleBtnW = width * 0.5;
    const singleBtnH = height * 0.07;

    const singleBtn = this.add.container(centerX, singleBtnY);
    const singleBtnImg = this.add
      .image(0, y * 0.5, "uibtn")
      .setDisplaySize(singleBtnW, singleBtnH * 1.2)
      .setInteractive()
      .setTint(0xffd700); // 금색 포인트

    singleBtn.add([
      singleBtnImg,
      this.add
        .text(0, y * 0.5, "싱글플레이", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.06}px`,
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
          // socket.id가 없으면 고정 ID 사용 (싱글플레이 전용)
          const myId = socket.id || "PLAYER_ME";
          const myNickname = localStorage.getItem("nickname") || "나";

          const singleGameData = {
            roomId: "SINGLE",
            maxPlayers: 4,
            isSingle: true,
            hostId: myId, // 내가 방장

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
        },
      });
    });

    /* =======================================================
   상점 버튼 추가
======================================================= */
    const shopBtnY = height * 0.58; // 싱글플레이 버튼 아래
    const shopBtnW = width * 0.5;
    const shopBtnH = height * 0.07;

    const shopBtn = this.add.container(centerX, shopBtnY);
    const shopBtnImg = this.add
      .image(0, y * 0.53, "uibtn")
      .setDisplaySize(shopBtnW, shopBtnH * 1.2)
      .setInteractive()
      .setTint(0xff69b4); // 핑크 포인트

    const shopBtnText = this.add
      .text(0, y * 0.53, "🎁 상점", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
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
      this.isRoomOpen = true;

      console.log(
        "📥 roomCreated 받은 데이터:",
        JSON.stringify(data.players, null, 2),
      );

      this.hideLoading(); // 🔹 로딩창 끄기
      this.showToast("방 생성 성공!", "#2ecc71"); // 초록색 토스트

      this.createBlocker(); // 함수 호출

      this.refreshLobbyUI({
        roomId: data.roomId,
        players: data.players,
        max: data.maxPlayers,
        hostId: socket.id,
      });
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

      console.log(
        "📥 playerJoined 받은 데이터:",
        JSON.stringify(data.players, null, 2),
      );

      // UI를 먼저 동기화해서 데이터 구조를 잡습니다.
      this.refreshLobbyUI(data);

      // 🔹 0.1초 뒤에 토스트를 띄워 UI에 가려지지 않게 합니다.
      this.time.delayedCall(100, () => {
        if (data.players && data.players.length > 0) {
          const lastPlayer = data.players[data.players.length - 1];
          // 내가 방금 들어온 게 아닐 때만 알림
          if (lastPlayer.id !== socket.id) {
            console.log("새 유저 입장 토스트 실행!");
            this.showToast(
              `${lastPlayer.nickname}님이 입장했습니다!`,
              "#2ecc71",
            );
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
      const nickname = data.leftPlayerNickname || "알 수 없는 요리사";
      this.refreshLobbyUI(data);
      this.showToast(`${nickname}님이 나갔습니다.`, "#e74c3c");
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
      .image(250, 150, bgmOn ? "soundon" : "soundoff")
      .setOrigin(1, 0)
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

    // LobbyScene의 create() 내부
    this.events.once("shutdown", () => {
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("roomCreated");
      socket.off("joinRoomError");
      socket.off("recipeEnded");
      this.backHandler.remove();
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
      !this.profileExpText
    ) {
      return;
    }

    this.profileLevelText.setText(`${this.myProfile.level}`);
    this.profileIdText.setText(this.myProfile.nickname);
    this.profileCoinText.setText(`코인 ${this.myProfile.coins}`);
    this.profileExpText.setText(
      `EXP ${this.myProfile.experience % XP_PER_LEVEL}/${XP_PER_LEVEL}`,
    );
  }

  changeProfileAvatar(step) {
    if (
      !Array.isArray(this.profileAvatarKeys) ||
      this.profileAvatarKeys.length === 0
    ) {
      return;
    }

    const total = this.profileAvatarKeys.length;
    this.profileAvatarIndex =
      ((Number(this.profileAvatarIndex) || 0) + step + total) % total;

    const selectedKey = this.profileAvatarKeys[this.profileAvatarIndex];
    localStorage.setItem("profileAvatarKey", selectedKey);
    this.updateProfileAvatarUI();
  }

  updateProfileAvatarUI() {
    if (!this.profileImage || !this.profileAvatarKeys) {
      return;
    }

    const textureKey =
      this.profileAvatarKeys[this.profileAvatarIndex] || "player_1";
    this.profileImage.setTexture(textureKey);
  }

  getSelectedAvatarKey() {
    const current =
      Array.isArray(this.profileAvatarKeys) &&
      this.profileAvatarKeys[this.profileAvatarIndex];

    if (typeof current === "string" && /^player_[1-4]$/.test(current)) {
      return current;
    }

    const saved = localStorage.getItem("profileAvatarKey");
    if (typeof saved === "string" && /^player_[1-4]$/.test(saved)) {
      return saved;
    }

    return "player_1";
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
    );
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

  showShopPopup() {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.5;

    // 특수카드 데이터 (가격과 설명 포함)
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

    if (this.shopPopupContainer) this.shopPopupContainer.destroy();
    this.shopPopupContainer = this.add.container(0, 0).setDepth(200);

    // 반투명 배경
    const overlay = this.add
      .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.5)
      .setInteractive();
    overlay.on("pointerdown", () => {
      this.closeShopPopup();
    });

    // 팝업 배경
    const popupBg = this.add
      .rectangle(centerX, popupY, width * 0.8, height * 0.6, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0xffd700, 1);

    // 제목
    const titleText = this.add
      .text(centerX, popupY - height * 0.25, "✨ 상점", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.07}px`,
        color: "#ffd700",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    // 현재 코인 표시
    this.shopCoinText = this.add
      .text(
        centerX,
        popupY - height * 0.19,
        `보유: 💰 ${this.myProfile.coins}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          color: "#ffd700",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5);

    // 코인 구매 버튼
    const coinBuyBtn = this.add
      .circle(
        centerX + width * 0.25,
        popupY - height * 0.19,
        width * 0.04,
        0x4ecdc4,
        0.8,
      )
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });

    const coinBuyBtnText = this.add
      .text(centerX + width * 0.25, popupY - height * 0.19, "+", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.045}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    coinBuyBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.1 });
      this.showCoinShopPopup();
    });

    // 카드 표시 영역 초기화
    let currentCardIndex = 0;
    const cardDisplayContainer = this.add.container(centerX, popupY);

    const updateCardDisplay = () => {
      // 기존 카드 객체들 제거
      cardDisplayContainer.removeAll(true);

      // localStorage에서 보유 수량 읽기
      const specialCardsOwned =
        JSON.parse(localStorage.getItem("specialCards")) || {};
      const ownedCount =
        specialCardsOwned[specialCards[currentCardIndex].id] || 0;

      const card = specialCards[currentCardIndex];
      const cardBg = this.add
        .rectangle(0, -20, width * 0.6, height * 0.22, 0x2d2d44, 0.9)
        .setStrokeStyle(2, 0x39ff14, 1);

      const cardName = this.add
        .text(0, -60, card.name, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          color: "#39ff14",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      const cardDesc = this.add
        .text(0, -25, card.description, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#ffffff",
          align: "center",
          wordWrap: { width: width * 0.5 },
        })
        .setOrigin(0.5);

      const cardPrice = this.add
        .text(0, 20, `💰 ${card.price}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.04}px`,
          color: "#ffd700",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      // 보유 수량 표시
      const ownedText = this.add
        .text(0, 45, `보유중: ${ownedCount}개`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.032}px`,
          color: "#2ecc71",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      cardDisplayContainer.add([
        cardBg,
        cardName,
        cardDesc,
        cardPrice,
        ownedText,
      ]);
    };

    updateCardDisplay();

    // 왼쪽 버튼
    const leftBtn = this.add
      .circle(centerX - width * 0.35, popupY, width * 0.06, 0x39ff14, 0.8)
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });

    const leftIcon = this.add
      .text(centerX - width * 0.35, popupY, "<", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    leftBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
      currentCardIndex =
        (currentCardIndex - 1 + specialCards.length) % specialCards.length;
      updateCardDisplay();
    });

    // 오른쪽 버튼
    const rightBtn = this.add
      .circle(centerX + width * 0.35, popupY, width * 0.06, 0x39ff14, 0.8)
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });

    const rightIcon = this.add
      .text(centerX + width * 0.35, popupY, ">", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.06}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    rightBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
      currentCardIndex = (currentCardIndex + 1) % specialCards.length;
      updateCardDisplay();
    });

    // 구매 버튼
    const buyBtn = this.add
      .rectangle(
        centerX,
        popupY + height * 0.18,
        width * 0.4,
        height * 0.07,
        0x39ff14,
        0.8,
      )
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });

    const buyBtnText = this.add
      .text(centerX, popupY + height * 0.18, "구매", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#000000",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    buyBtn.on("pointerdown", () => {
      const card = specialCards[currentCardIndex];
      if (this.myProfile.coins >= card.price) {
        this.sound.play("pop", { volume: 0.1 });
        this.myProfile.coins -= card.price;
        localStorage.setItem("profileCoins", String(this.myProfile.coins));

        // 특수카드 저장 (로컬)
        let specialCardsOwned =
          JSON.parse(localStorage.getItem("specialCards")) || {};
        if (!specialCardsOwned[card.id]) {
          specialCardsOwned[card.id] = 0;
        }
        specialCardsOwned[card.id] += 1;
        localStorage.setItem("specialCards", JSON.stringify(specialCardsOwned));

        // 💰 코인 텍스트 실시간 업데이트
        this.shopCoinText.setText(`보유: 💰 ${this.myProfile.coins}`);

        // 카드 표시 업데이트 (보유 수량 변경 반영)
        updateCardDisplay();

        this.updateMyProfileUI();

        // 🔹 서버에 구매 정보 전송 (멀티플레이인 경우)
        if (!this.isSingle && socket.connected) {
          socket.emit("buySpecialCard", {
            cardId: card.id,
            cardPrice: card.price,
          });
        }

        this.showToast(`${card.name} 구매 완료!`, "#2ecc71");
      } else {
        this.sound.play("pop", { volume: 0.08 });
        this.showToast("코인이 부족합니다!", "#e74c3c");
      }
    });

    // 닫기 버튼
    const closeBtn = this.add
      .circle(
        centerX + width * 0.35,
        popupY - height * 0.27,
        width * 0.05,
        0xff6b6b,
        0.8,
      )
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true });

    const closeBtnIcon = this.add
      .text(centerX + width * 0.35, popupY - height * 0.27, "✕", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    closeBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
      this.closeShopPopup();
    });

    this.shopPopupContainer.add([
      overlay,
      popupBg,
      titleText,
      this.shopCoinText,
      coinBuyBtn,
      coinBuyBtnText,
      cardDisplayContainer,
      leftBtn,
      leftIcon,
      rightBtn,
      rightIcon,
      buyBtn,
      buyBtnText,
      closeBtn,
      closeBtnIcon,
    ]);

    this.currentShopPopupCloseHandler = () => {
      this.closeShopPopup();
    };
  }

  showCoinShopPopup() {
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

    // 팝업 배경
    const popupBg = this.add
      .rectangle(centerX, popupY, width * 0.85, height * 0.5, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0x4ecdc4, 1)
      .setDepth(1002);
    this.coinShopElements.push(popupBg);

    // 제목
    const titleText = this.add
      .text(centerX, popupY - height * 0.2, "💎 코인 구매", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.07}px`,
        color: "#4ecdc4",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1003);
    this.coinShopElements.push(titleText);

    // 현재 보유 코인
    const currentCoinText = this.add
      .text(
        centerX,
        popupY - height * 0.135,
        `현재 보유: 💰 ${this.myProfile.coins}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#ffd700",
          fontWeight: "bold",
        },
      )
      .setOrigin(0.5)
      .setDepth(1003);
    this.coinShopElements.push(currentCoinText);

    // 닫기 버튼
    const closeBtn = this.add
      .circle(
        centerX + width * 0.4,
        popupY - height * 0.215,
        width * 0.04,
        0xff6b6b,
        0.8,
      )
      .setStrokeStyle(2, 0xffffff, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(1003);
    this.coinShopElements.push(closeBtn);

    const closeBtnIcon = this.add
      .text(centerX + width * 0.4, popupY - height * 0.215, "✕", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.04}px`,
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1004);
    this.coinShopElements.push(closeBtnIcon);

    closeBtn.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.08 });
      this.closeCoinShopPopup();
    });

    // 코인 상품 버튼들 배치
    const productSpacing = width * 0.27;
    const productStartX = centerX - (productSpacing * 2) / 2;

    coinProducts.forEach((product, index) => {
      const productX = productStartX + index * productSpacing;
      const productY = popupY + height * 0.05;

      // 상품 배경
      const productBg = this.add
        .rectangle(
          productX,
          productY,
          width * 0.22,
          height * 0.18,
          0x2d2d44,
          0.9,
        )
        .setStrokeStyle(2, 0x4ecdc4, 1)
        .setDepth(1003);
      this.coinShopElements.push(productBg);

      // 상품 버튼
      const productBtn = this.add
        .rectangle(productX, productY, width * 0.22, height * 0.18, 0x4ecdc4, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(1003);
      this.coinShopElements.push(productBtn);

      // 상품 텍스트
      const productText = this.add
        .text(productX, productY, product.display, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#ffd700",
          fontWeight: "bold",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(1004);
      this.coinShopElements.push(productText);

      productBtn.on("pointerdown", () => {
        this.sound.play("pop", { volume: 0.1 });
        this.buyCoin(product.amount);
      });

      productBtn.on("pointerover", () => {
        productBg.setStrokeStyle(3, 0xffd700, 1);
      });

      productBtn.on("pointerout", () => {
        productBg.setStrokeStyle(2, 0x4ecdc4, 1);
      });
    });
  }

  buyCoin(amount) {
    // 🔹 코인 추가
    this.myProfile.coins += amount;
    localStorage.setItem("profileCoins", String(this.myProfile.coins));

    // 🔹 스토어의 코인 텍스트 업데이트 (상점 팝업이 뒤에 있을 때)
    if (this.shopCoinText) {
      this.shopCoinText.setText(`보유: 💰 ${this.myProfile.coins}`);
    }

    // 🔹 서버에 전송 (멀티플레이인 경우)
    if (!this.isSingle && socket.connected) {
      socket.emit("addCoins", { amount });
    }

    // 🔹 프로필 업데이트
    this.updateMyProfileUI();

    this.showToast(`💰 ${amount} 코인 추가되었습니다!`, "#2ecc71");

    // 🔹 코인 팝업 닫기
    this.closeCoinShopPopup();
  }

  closeCoinShopPopup() {
    if (this.coinShopElements && Array.isArray(this.coinShopElements)) {
      this.coinShopElements.forEach((element) => {
        if (element) element.destroy();
      });
      this.coinShopElements = [];
    }
  }

  closeShopPopup() {
    this.isJoinPopupOpen = false;
    if (this.shopPopupContainer) {
      this.shopPopupContainer.destroy();
      this.shopPopupContainer = null;
    }
  }

  showPublicRoomsPopup() {
    this.isJoinPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const popupY = height * 0.4;

    // 로딩 표시
    this.showLoading("방 목록 로딩 중...");

    // 공개 방 목록 가져오기
    fetch(`${SERVER_URL}/api/public-rooms`)
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
          .rectangle(centerX, height * 0.5, width, height, 0x000000, 0.55)
          .setInteractive();

        // 3. 팝업 배경 이미지
        const popupBg = this.add
          .image(centerX, popupY, "popupbg")
          .setDisplaySize(width * 0.7, height * 0.5);

        // 4. 제목 텍스트
        const titleText = this.add
          .text(centerX, popupY * 0.48, "멀티플레이", {
            fontFamily: "Jua",
            fontSize: `${width * 0.08}px`,
            color: "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5);

        // 5. 탭 버튼들 (3가지 선택) - popupbg 하단에 uibtn 이미지로 배치
        // popupbg 하단 = popupY + popupbg높이/2 부근
        const popupHalfH = (height * 0.6) / 2;
        const tabY = popupY + popupHalfH - height * 0.075; // popupbg 하단 안쪽
        const tabBtnW = width * 0.16;
        const tabBtnH = height * 0.05;
        const tabGap = width * 0.195;

        let currentTab = "browse"; // 기본 탭
        const allTabs = []; // 모든 탭 저장

        // 먼저 배경과 제목을 컨테이너에 추가
        this.joinPopupContainer.add([overlay, popupBg, titleText]);

        const createTabButton = (label, tabName, posX) => {
          const isActive = currentTab === tabName;
          const tabImg = this.add
            .image(posX, tabY, "uibtn")
            .setDisplaySize(tabBtnW, tabBtnH * 1.1)
            .setTint(isActive ? 0x2ecc71 : 0x7f8c8d)
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
              tab.img.setTint(tab.name === tabName ? 0x2ecc71 : 0x7f8c8d);
            });

            // 콘텐츠 업데이트
            updateTabContent(tabName);
          };

          tabImg.on("pointerdown", onTabClick);
          tabText.on("pointerdown", onTabClick);

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
              })
              .setOrigin(0.5);
            container.add(emptyText);
            return;
          }

          const roomItemHeight = height * 0.065;
          const maxVisibleRooms = 4;
          const roomsPerPage = 4;
          const listWidth = width * 0.6;

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

              const roomNo = startIdx + i + 1;
              const publicTag = room.isPublic === false ? "🔒" : "🌐";
              const playingTag = isPlaying ? " 🎮플레이중" : "";
              const roomTitle = room.roomName || `${room.hostNickname}의 방`;
              const roomInfo = `${roomNo}. ${publicTag} ${roomTitle}${playingTag}  (${room.playerCount}/${room.maxPlayers})`;
              const roomText = this.add
                .text(-listWidth / 2 + 10, itemY, roomInfo, {
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
            .dom(centerX * -0.35, contentY * -0.25, "input")
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
          fetch(`${SERVER_URL}/api/public-rooms`)
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
              t.img.setTint(t.name === tab.name ? 0x2ecc71 : 0x7f8c8d);
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
              this.showToast("새로운 방이 생겼어요!", "#2ecc71");
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
    };

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

    // --- 이벤트 처리 ---
    confirmBtnImg.once("pointerdown", () => {
      const nickname = el.value.trim() || "요리사";

      // 컨테이너와 오버레이만 지우면 끝!
      // 개별 요소(텍스트, 이미지 등)를 일일이 destroy할 필요가 없습니다.
      popupContainer.destroy();
      overlay.destroy();

      if (callback) callback(nickname);
    });
  }

  showWaiting(roomId, players = [], isHost = false, maxPlayers = 4) {
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

    // 기존 대기실 UI 제거
    if (this.lobbyUIContainer) {
      this.lobbyUIContainer.destroy();
    }
    this.lobbyUIContainer = this.add.container(0, 0).setDepth(100);

    // 배경
    const bg = this.add
      .image(centerX, height / 2, "gamebg")
      .setDisplaySize(width, height * 1.2)
      .setDepth(0);
    this.lobbyUIContainer.add(bg);

    // 입장 코드
    const codeText = this.add
      .text(
        centerX,
        height * 0.08,
        `입장코드: ${roomId || this.currentRoomId}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.065}px`,
          fill: "#ffff00",
          fontWeight: "bold",
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setDepth(10)
      .setOrigin(0.5);
    this.lobbyUIContainer.add(codeText);

    // 참가자 수
    const countText = this.add
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
    this.lobbyUIContainer.add(countText);

    /* =======================================================
       플레이어 카드 UI (위 2명 / 아래 2명)
       슬롯 위치: [0]=왼쪽위, [1]=오른쪽위, [2]=왼쪽아래, [3]=오른쪽아래
    ======================================================= */
    const slotPositions = [
      { x: centerX - width * 0.25, y: height * 0.3 },
      { x: centerX + width * 0.25, y: height * 0.3 },
      { x: centerX - width * 0.25, y: height * 0.52 },
      { x: centerX + width * 0.25, y: height * 0.52 },
    ];

    const cardW = width * 0.38;
    const cardH = height * 0.18;
    const profileSize = width * 0.14;
    const levelSize = width * 0.07;

    // 빈 슬롯 4개 먼저 그리기
    for (let i = 0; i < 4; i++) {
      const pos = slotPositions[i];
      const emptyCard = this.add.graphics();
      emptyCard.fillStyle(0x000000, 0.25);
      emptyCard.fillRoundedRect(
        pos.x - cardW / 2,
        pos.y - cardH / 2,
        cardW,
        cardH,
        20,
      );
      emptyCard.lineStyle(2, 0xffffff, 0.2);
      emptyCard.strokeRoundedRect(
        pos.x - cardW / 2,
        pos.y - cardH / 2,
        cardW,
        cardH,
        20,
      );
      this.lobbyUIContainer.add(emptyCard);

      const emptyTxt = this.add
        .text(pos.x, pos.y, "대기 중...", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#888888",
        })
        .setOrigin(0.5);
      this.lobbyUIContainer.add(emptyTxt);
    }

    // 플레이어 카드 그리기
    players.forEach((p, i) => {
      if (i >= 4) return;
      const pos = slotPositions[i];
      const isThisPlayerHost = p.id === this.hostId;
      const isMe = p.id === socket.id;
      const isReady = isThisPlayerHost || p.isReady;

      // 카드 배경 (준비 상태에 따라 색상 변경)
      const cardBg = this.add.graphics();
      const bgColor = isReady ? 0x1a4a1a : 0x1a1a2e;
      const borderColor = isReady ? 0x2ecc71 : isMe ? 0xf1c40f : 0x4a4a6a;
      cardBg.fillStyle(bgColor, 0.9);
      cardBg.fillRoundedRect(
        pos.x - cardW / 2,
        pos.y - cardH / 2,
        cardW,
        cardH,
        20,
      );
      cardBg.lineStyle(3, borderColor, 1);
      cardBg.strokeRoundedRect(
        pos.x - cardW / 2,
        pos.y - cardH / 2,
        cardW,
        cardH,
        20,
      );
      this.lobbyUIContainer.add(cardBg);

      // 프로필 이미지 (chef)
      const profileImg = this.add
        .image(
          pos.x - cardW / 2 + profileSize * 1.3,
          pos.y - cardH * 0.05,
          /^player_[1-4]$/.test(p.avatarKey) ? p.avatarKey : `player_${i + 1}`,
        )
        .setDisplaySize(profileSize * 2, profileSize * 2);
      this.lobbyUIContainer.add(profileImg);

      // 레벨 배지 (프로필 왼쪽 아래 모서리)
      const levelBg = this.add.graphics();
      levelBg.fillStyle(0xe67e22, 1);
      levelBg.fillCircle(
        pos.x - cardW / 2 + profileSize * 0.8 - profileSize * 0.35,
        pos.y - cardH * 0.05 + profileSize * 0.35,
        levelSize * 0.55,
      );
      this.lobbyUIContainer.add(levelBg);

      const levelTxt = this.add
        .text(
          pos.x - cardW / 2 + profileSize * 0.8 - profileSize * 0.35,
          pos.y - cardH * 0.05 + profileSize * 0.35,
          String(p.level || 1), // 💡 플레이어의 실제 레벨 사용
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${levelSize * 0.7}px`,
            color: "#ffffff",
            fontWeight: "bold",
          },
        )
        .setOrigin(0.5);
      this.lobbyUIContainer.add(levelTxt);

      // 방장 왕관 표시
      if (isThisPlayerHost) {
        const crownTxt = this.add
          .text(pos.x + cardW * 0.3, pos.y - cardH * 0.38, "👑", {
            fontSize: `${width * 0.05}px`,
          })
          .setOrigin(0.5);
        this.lobbyUIContainer.add(crownTxt);
      }

      // 닉네임 텍스트 (버튼 대신 텍스트로 표시, 준비 상태에 따라 색상 변경)
      let displayName = p.nickname;
      if (displayName.length > 6)
        displayName = displayName.substring(0, 6) + "..";

      // 방장 표시 포함
      if (isThisPlayerHost) displayName = `👑 ${displayName}`;

      // 준비 상태에 따라 색상 결정
      let nameColor = "#aaaaaa"; // 기본: 대기 중 (회색)
      if (isThisPlayerHost)
        nameColor = "#f1c40f"; // 방장: 노란색
      else if (isReady)
        nameColor = "#2ecc71"; // 준비 완료: 초록색
      else if (isMe) nameColor = "#ffffff"; // 나(대기): 흰색

      const nameTxt = this.add
        .text(pos.x, pos.y + cardH * 0.28, displayName, {
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
     시작하기 / 준비하기 / 나가기 버튼
     ====================== */
    const mainBtnY = height * 0.73;
    const exitBtnY = height * 0.82;

    if (isHost) {
      // 방장: 시작하기 버튼
      const startBtnImg = this.add
        .image(centerX, mainBtnY, "uibtn")
        .setDisplaySize(width * 0.6, height * 0.075)
        .setTint(0xe67e22)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });
      const startBtnText = this.add
        .text(centerX, mainBtnY, "시작하기", {
          fontFamily: GAME_FONTS.main,
          color: "#fff",
          fontSize: `${width * 0.055}px`,
          fontWeight: "bold",
        })
        .setDepth(20)
        .setOrigin(0.5);
      this.lobbyUIContainer.add([startBtnImg, startBtnText]);

      startBtnImg.on("pointerdown", () => {
        this.sound.play("pop", { volume: 0.1 });
        this.tweens.add({
          targets: [startBtnImg, startBtnText],
          scaleX: "*=0.95",
          scaleY: "*=0.95",
          duration: 50,
          yoyo: true,
          onComplete: () => {
            const currentCount = this.currentPlayers.length;
            if (currentCount <= 1) {
              this.showToast(
                "함께 할 유저가 필요합니다! (최소 2인)",
                "#e74c3c",
              );
            } else {
              socket.emit("startGameRequest");
            }
          },
        });
      });
    } else {
      // 일반 유저: 준비하기 버튼
      const myReadyState =
        players.find((p) => p.id === socket.id)?.isReady || false;
      const readyBtnImg = this.add
        .image(centerX, mainBtnY, "uibtn")
        .setDisplaySize(width * 0.6, height * 0.075)
        .setTint(myReadyState ? 0x2ecc71 : 0x3498db)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });
      const readyBtnText = this.add
        .text(centerX, mainBtnY, myReadyState ? "준비완료!" : "준비하기", {
          fontFamily: GAME_FONTS.main,
          color: "#fff",
          fontSize: `${width * 0.055}px`,
          fontWeight: "bold",
        })
        .setDepth(20)
        .setOrigin(0.5);
      this.lobbyUIContainer.add([readyBtnImg, readyBtnText]);

      readyBtnImg.on("pointerdown", () => {
        this.sound.play("pop", { volume: 0.1 });
        this.tweens.add({
          targets: [readyBtnImg, readyBtnText],
          scaleX: "*=0.95",
          scaleY: "*=0.95",
          duration: 50,
          yoyo: true,
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

    // 나가기 버튼
    const exitBtnImg = this.add
      .image(centerX, exitBtnY, "uibtn")
      .setDisplaySize(width * 0.6, height * 0.07)
      .setInteractive({ useHandCursor: true })
      .setTint(0xffaaaa);
    const exitBtnText = this.add
      .text(centerX, exitBtnY, "나가기", {
        fontFamily: GAME_FONTS.main,
        color: "#fff",
        fontSize: `${width * 0.055}px`,
        fontWeight: "bold",
      })
      .setOrigin(0.5);
    this.lobbyUIContainer.add([exitBtnImg, exitBtnText]);

    exitBtnImg.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.1 });
      this.tweens.add({
        targets: [exitBtnImg, exitBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          window.location.reload();
        },
      });
    });
  }

  showCustomAlert(message, onConfirm) {
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
    };

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
      turnIndex: 0,
      isGameStarted: false,
    };

    this.isSingle = !!data.isSingle;
    this.isGameReady = false;
    this.resultContainer = null;

    this.myTurnTimer = null;

    // 할리갈리 전용 데이터
    this.myCards = []; // 내 덱
    this.openCards = {}; // 각 플레이어별 바닥에 오픈된 카드 { playerId: card }
  }

  create() {
    // GameScene의 init 혹은 create 상단에 추가
    if (this.resultContainer) {
      this.resultContainer.destroy();
      this.resultContainer = null;
    }
    this.aiSettings = [
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

    if (this.isSingle) {
      // 싱글플레이면 소켓 ID가 아닌 "PLAYER_ME" 혹은 players[0].id를 내 ID로 강제 지정
      this.myId = this.roundData.players[0].id;
      this.turnIndex = 0; // 내 차례부터 시작
      this.isGameStarted = true;
    } else {
      this.myId = socket.id;
    }

    this.isPopupOpen = false;
    this.currentJoinPopupCloseHandler = null;

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
      this.sound.play("pop", { volume: 0.2 });
      this.showToast(`${data.nickname}님이 입장했습니다!`, "#2ecc71");
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

      localStorage.setItem("profileLevel", String(newLevel));
      localStorage.setItem(
        "profileCoins",
        String(
          Number(profile?.coins) ||
            Number(localStorage.getItem("profileCoins")) ||
            0,
        ),
      );
      localStorage.setItem(
        "profileExperience",
        String(
          Number(profile?.experience) ||
            Number(localStorage.getItem("profileExperience")) ||
            0,
        ),
      );

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
      this.turnIndex = 0;
      this.canClick = false; // 💡 시작 직후엔 클릭 금지

      // 2. 모든 플레이어에게 공통 연출 실행
      this.playOpeningAnimation();

      this.time.delayedCall(800, () => {
        this.showReadyGo();

        // 💡 Ready-Go(약 1.2초)가 완전히 끝난 뒤에 클릭 허용
        this.time.delayedCall(2000, () => {
          this.canClick = true;
          console.log("🎮 이제 카드를 제출할 수 있습니다.");
        });
      });

      // 3. 💡 [핵심 수정] 데이터 갱신 로직 강화
      console.log("📊 게임시작 players 데이터:", data.players); // 디버그용
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

        // 💡 내 차례가 왔을 때 띵! 소리나 진동(모바일) 주기
        if (data.nextTurnId === (this.isSingle ? this.myId : socket.id)) {
          this.canClick = true;
          this.sound.play("pop", { volume: 0.5 }); // 기존에 있는 pop 사운드 활용

          // 모바일이라면 진동 추가 (브라우저 지원 시)
          if (window.navigator.vibrate) {
            window.navigator.vibrate(100);
          }
        }

        this.renderTable(this.roundData.players);
      }
    });

    socket.off("cardFlipped").on("cardFlipped", (data) => {
      if (this.isSingle) return;

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

        // 💡 [수정] 렌더링 제거 - playPenaltyAnimation 내부 완료 후에만 호출
        this.roundData.players = updatedPlayers;
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

    // ============================================
    // 3. UI 및 버튼 배치
    // ============================================

    // [대체함] 할리갈리용 버튼 배치
    this.createHaliGaliButtons(height);

    // 홈 버튼 (나가기)
    const exitBtn = this.add
      .image(width * 0.13, height * 0.077, "home")
      .setDisplaySize(width * 0.07, width * 0.07)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);

    exitBtn.on("pointerdown", () => {
      this.showCustomAlert("로비로 이동합니다!", () => {
        window.location.reload();
      });
    });

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

    // 내 위치 인덱스 찾기
    let myIndex = players.findIndex((p) => p.id === myId);
    if (myIndex === -1) myIndex = 0;

    const sortedPlayers = [
      ...players.slice(myIndex),
      ...players.slice(0, myIndex),
    ];

    const pos = [
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

  startMyAutoTimer(p, layout) {
    // 1. 기존 타이머가 있다면 즉시 제거
    if (this.myTurnTimer) {
      this.myTurnTimer.remove();
      this.myTurnTimer = null;
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
        fontSize: "22px", // 가독성을 위해 살짝 키움
        color: "#ffffff",
        fontWeight: "bold",
        stroke: "#000",
        strokeThickness: 3,
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

    // 특수카드 데이터 정의 (총 5개)
    const allSpecialCards = [
      {
        id: 1,
        name: "🧲",
        description: "자석",
        emoji: "🧲",
      },
      {
        id: 2,
        name: "💣",
        description: "폭탄",
        emoji: "💣",
      },
      {
        id: 3,
        name: "⭐",
        description: "별",
        emoji: "⭐",
      },
      {
        id: 4,
        name: "🔥",
        description: "불",
        emoji: "🔥",
      },
      {
        id: 5,
        name: "❄️",
        description: "얼음",
        emoji: "❄️",
      },
    ];

    // localStorage에서 보유한 특수카드 로드
    const specialCardsOwned =
      JSON.parse(localStorage.getItem("specialCards")) || {};

    // 카드 배치 (내 카드 바로 아래에 가로 5개)
    const cardSize = width * 0.08; // 특수카드 크기
    const startX = layout.x - (cardSize * 2.5 + width * 0.02 * 2); // 중앙 정렬
    const cardY = layout.y + width * 0.15; // 내 카드 밑에 배치
    const cardGap = cardSize + width * 0.02; // 카드 간격

    allSpecialCards.forEach((card, index) => {
      const cardX = startX + index * cardGap;
      const count = specialCardsOwned[card.id] || 0;

      if (count > 0) {
        // 보유한 카드: 컬러풀하게 표시
        const cardBg = this.add
          .rectangle(cardX, cardY, cardSize, cardSize, 0x2ecc71, 0.7)
          .setStrokeStyle(2, 0xffd700, 1);

        const cardEmoji = this.add
          .text(cardX, cardY - cardSize * 0.15, card.emoji, {
            fontFamily: "Arial",
            fontSize: `${cardSize * 0.6}px`,
          })
          .setOrigin(0.5);

        const cardCount = this.add
          .text(cardX, cardY + cardSize * 0.25, `x${count}`, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${cardSize * 0.4}px`,
            color: "#ffffff",
            fontWeight: "bold",
          })
          .setOrigin(0.5);

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

    const fruitNames = { 1: "strawberry", 2: "banana", 3: "lime", 4: "plum" };

    cardsToDraw.forEach((card, index) => {
      const cardKey = `${fruitNames[card.fruit] || "strawberry"}_${card.count}`;

      if (this.textures.exists(cardKey)) {
        // 💡 [핵심 수정] 플레이어 위치(rotation)에 따라 쌓이는 방향 결정
        // rotation 0(하단): 위로(-Y), 90(좌측): 오른쪽(+X), 180(상단): 아래로(+Y), -90(우측): 왼쪽(-X)
        let offsetX = 0;
        let offsetY = 0;
        const step = 3; // 카드 한 장당 어긋나는 픽셀 거리 (취향껏 조절)

        if (layout.rotation === 0) offsetY = -index * step;
        else if (layout.rotation === 90) offsetX = index * step;
        else if (layout.rotation === 180) offsetY = index * step;
        else if (layout.rotation === -90 || layout.rotation === 270)
          offsetX = -index * step;

        const openCardImg = this.add
          .image(baseX + offsetX, baseY + offsetY, cardKey)
          .setDisplaySize(width * 0.18, width * 0.25)
          .setDepth(150 + index); // 나중 카드가 위로 오게

        this.playerTableGroup.add(openCardImg);
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

    const pos = [
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
    prevPlayers.forEach((p, pIndex) => {
      if (p.openStack && p.openStack.length > 0) {
        const relIdx = (pIndex - myIndex + players.length) % players.length;
        const rotation = [0, 90, 180, -90][relIdx];
        const dist = width * 0.25;
        const rad = Phaser.Math.DegToRad(rotation - 90);

        const startX = pos[relIdx].x + Math.cos(rad) * dist * 0.7;
        const startY = pos[relIdx].y + Math.sin(rad) * dist;

        // 💡 [핵심] 해당 플레이어의 openStack에 있는 모든 카드를 날림
        p.openStack.forEach((card, cardIdx) => {
          // 💡 [수정] 더 빠른 "슈슈슉" 느낌: delay 25ms, duration 250ms
          const delay = cardIdx * 25;

          const flyCard = this.add
            .image(startX, startY - cardIdx * 2, "card_back") // 기존 쌓여있던 높이 재현
            .setDisplaySize(width * 0.15, width * 0.22)
            .setDepth(2000 + cardIdx);

          this.tweens.add({
            targets: flyCard,
            x: targetPos.x,
            y: targetPos.y,
            duration: 250,
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

    const pos = [
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

    const pos = [
      { x: width * 0.5, y: height * 0.75 },
      { x: width * 0.18, y: height * 0.45 },
      { x: width * 0.5, y: height * 0.18 },
      { x: width * 0.82, y: height * 0.45 },
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

    const totalCardsToFly = targetPlayers.length;
    if (totalCardsToFly === 0) {
      this.renderTable(data.players);
      return;
    }

    let finishedCount = 0;
    // 💡 [수정] 애니메이션 시작 직전 렌더링 제거 → 애니메이션 완료 후만 렌더링

    targetPlayers.forEach((player, index) => {
      const realIdx = players.findIndex((p) => p.id === player.id);
      const relTargetIdx =
        (realIdx - myIndex + players.length) % players.length;
      const targetPos = pos[relTargetIdx];

      const flyCard = this.add
        .image(startPos.x, startPos.y, "card_back")
        .setDisplaySize(width * 0.135, width * 0.22)
        .setDepth(2000);

      this.tweens.add({
        targets: flyCard,
        x: targetPos.x,
        y: targetPos.y,
        duration: 250,
        delay: index * 25, // 💡 [수정] 더 빠른 "슈슈슉" 느낌
        ease: "Cubic.out",
        // delay: 0, // 💡 한 장씩 확실히 빠지는걸 보여주려면 딜레이를 없애거나 짧게 조절
        onStart: () => {
          this.sound.play("pop", { volume: 0.1, detune: 500 });
        },
        onComplete: () => {
          flyCard.destroy();
          finishedCount++;

          if (finishedCount === totalCardsToFly) {
            // 애니메이션이 완전히 끝난 후 테이블 갱신 (서버 데이터 반영)
            this.renderTable(players);
          }
        },
      });
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
      p.openStackCount = 0;
      p.isEliminated = false;
      p.isReady = true; // 싱글플레이어는 항상 준비 상태
    });

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
      console.log("⏳ 아직 시작 연출 중입니다.");
      return;
    }

    this.canClick = false;
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
      this.showToast("당신의 차례가 아닙니다!", "#e74c3c");
      return;
    }

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

      if (isFive) {
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
      socket.emit("ringBell");
    }
  }

  checkFruitCountForAI() {
    if (!this.isSingle) return;

    const totals = this.calculateTotalFruits();
    const isFive = Object.values(totals).some((count) => count === 5);

    if (isFive) {
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

    // 3. 랜덤 카드 생성 및 데이터 설정
    const randomCard = {
      fruit: Math.floor(Math.random() * 4) + 1,
      count: Math.floor(Math.random() * 5) + 1,
    };

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
    if (!isFive) return;

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

    // 3. 페널티 실행 (받을 사람이 없어도 내 카드는 깎여야 규칙에 맞음)
    const penaltyAmount = recipients.length; // 생존자 수만큼 차감
    const myCurrentCards = Number(loser.cards) || 0;

    if (penaltyAmount > 0) {
      // 생존자들에게 줄 카드가 충분할 때
      if (myCurrentCards >= penaltyAmount) {
        loser.cards = myCurrentCards - penaltyAmount;
        recipients.forEach((p) => {
          p.cards = (Number(p.cards) || 0) + 1;
          p.remainingCards = p.cards;
        });
      } else {
        // 카드가 부족하면 가진 걸 다 줌 (0장이 됨)
        let cardsToGive = myCurrentCards;
        loser.cards = 0;
        // 한 장씩 순서대로 배분
        for (let i = 0; i < cardsToGive; i++) {
          if (recipients[i]) recipients[i].cards += 1;
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

    // 6. 다음 차례가 AI라면 카드 뒤집기 예약
    if (nextPlayer.id.startsWith("AI_")) {
      this.time.delayedCall(1500, () => {
        if (this.isGameStarted) {
          this.processSingleFlip(nextPlayer.id);
        }
      });
    }
  }

  processSingleBell(winnerId) {
    if (!this.isSingle) return;

    this.time.removeAllEvents();

    // 1. 💡 바닥에 실제로 쌓인 카드 장수 모두 합산
    let totalCollected = 0;
    this.roundData.players.forEach((p) => {
      if (p.openStackCount && p.openStackCount > 0) {
        totalCollected += p.openStackCount;
        p.openStackCount = 0; // 가져갔으므로 초기화
      }
      p.openCard = null; // 현재 보여지는 카드 이미지 정보 초기화
    });

    // 가져갈 카드가 없으면 리턴 (중복 실행 방지)
    if (totalCollected === 0) return;

    const winnerIdx = this.roundData.players.findIndex(
      (p) => p.id === winnerId,
    );
    const winner = this.roundData.players[winnerIdx];

    if (winner) {
      winner.cards = (Number(winner.cards) || 0) + totalCollected;
      winner.remainingCards = winner.cards;

      // 2. 💡 턴 인덱스를 승자로 강제 고정
      this.turnIndex = winnerIdx;

      this.addGameLog(
        `${winner.nickname}님이 카드 ${totalCollected}장을 획득!`,
        "#f1c40f",
      );
    }

    // --- 멀티플레이와 동일한 시각적 처리 적용 (애니메이션 + 데이터 교체)
    const prevPlayers = this.roundData.players.map((p) => ({
      ...p,
      openStack: p.openStack ? [...p.openStack] : [],
    }));

    const updatedPlayers = this.roundData.players.map((p) => {
      const clone = { ...p };
      if (p.id === (winner && winner.id)) {
        clone.cards = winner.cards;
        clone.remainingCards = winner.remainingCards;
      }
      // playWinAnimation은 prevPlayers의 openStack을 사용해 애니메이션을 수행하고,
      // 완료 시 this.roundData.players의 openStack을 비우므로 여기에는 기존 스택을 넣어둡니다.
      clone.openStack = p.openStack ? [...p.openStack] : [];
      return clone;
    });

    // 애니메이션 실행 (멀티와 동일한 흐름)
    this.playWinAnimation({
      winnerId: winner ? winner.id : null,
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

  updateEliminationStatus() {
    if (!this.roundData || !this.roundData.players) return;

    const totals = this.calculateTotalFruits();
    const isFiveExists = Object.values(totals).some((count) => count === 5);

    this.roundData.players.forEach((p) => {
      // 이미 탈락한 사람은 상태를 유지 (한번 죽으면 끝)
      if (p.isEliminated) return;

      const hasDeck = (Number(p.cards) || 0) > 0;

      // 1. 낼 카드가 없고 바닥에 5도 없으면 -> 즉시 탈락
      if (!hasDeck && !isFiveExists) {
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
    this.roundData.players.forEach((p) => {
      if (p.openCard) {
        totals[p.openCard.fruit] += p.openCard.count;
      }
    });
    return totals;
  }

  // 닉네임 가져오기 보조 함수
  getNicknameById(id) {
    const player = this.roundData.players.find((p) => p.id === id);
    return player ? player.nickname : "AI";
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

  showResultOverlay(players, isUpdate = false, data = null) {
    // 1. 💡 기존 게임 로그 데이터 및 텍스트 객체 완전 제거
    if (this.logTexts) {
      this.logTexts.forEach((txt) => txt.destroy());
      this.logTexts = [];
    }
    if (this.gameLogs) {
      this.gameLogs = []; // 데이터 배열도 비워야 나중에 다시 그려지지 않습니다.
    }

    // 💡 data 인자 추가    if (!this.roundData) return;
    if (!players || players.length === 0) return;

    const { width, height } = this.cameras.main;
    const currentHostId = (data && data.hostId) || this.roundData.hostId; // 데이터에서 받은 hostId 우선 사용
    const isHost = socket.id === currentHostId;

    // --- 컨테이너 생성 및 초기화 로직 유지 ---
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
    // myInfo를 찾을 때 닉네임 혼용을 피하고 socket.id로만 찾습니다.
    const myInfo = players.find((p) => p.id === socket.id) || null;

    const bg = this.add
      .image(width / 2, height / 2, "resultbg")
      .setDisplaySize(width * 1.2, height * 1.1);
    container.add(bg);

    // --- 플레이어 리스트 매핑 (할리갈리 버전) ---
    const listStartY = height * 0.43; // 시작점 (원하는 만큼 조절)

    players.forEach((p, i) => {
      const y = listStartY + i * (height * 0.075);
      const row = this.add.container(width / 2, y);

      const isThisPlayerHost = p.id === currentHostId;
      const isMe = p.id === socket.id; // 💡 내가 누구인지 명확히 판별

      let displayName = p.nickname;
      if (isThisPlayerHost) displayName = `${displayName} 👑`;
      if (isMe) displayName = `${displayName}`;

      // 1. 순위 텍스트
      const rankTxt = this.add
        .text(-width * 0.15, 0, `${i + 1}위`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: "#334155",
        })
        .setOrigin(0.5);

      // 2. 닉네임 텍스트 (색상 로직 수정)
      let nameColor = "#0f172a"; // 기본 검정색 계열
      if (isThisPlayerHost)
        nameColor = "#e67e22"; // 방장은 주황색
      else if (p.isReady) nameColor = "#2ecc71"; // 준비 완료면 초록색 (방장 아닐 때만)

      const nameTxt = this.add
        .text(-width * 0.07, 0, displayName, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: nameColor, // 💡 여기서 결정된 색상을 적용
          fontWeight: isMe ? "bold" : "normal", // 내 이름은 굵게
        })
        .setOrigin(0, 0.5);

      const currentCoins = Number(p.currentCoins ?? p.finalCoins ?? 0) || 0;
      const earnedCoins = Number(p.earnedCoins) || 0;
      const finalCoins =
        Number(p.finalCoins ?? currentCoins + earnedCoins) || 0;
      const currentLevel = Number(p.currentLevel ?? p.finalLevel ?? 1) || 1;
      const finalLevel = Number(p.finalLevel ?? currentLevel) || currentLevel;
      const finalExperience = Number(
        p.finalExperience ?? p.currentExperience ?? 0,
      );
      const earnedExp = Number(p.earnedExperience) || 0;
      const leveledUp =
        typeof p.leveledUp === "boolean"
          ? p.leveledUp
          : finalLevel > currentLevel;

      const coinTxt = this.add
        .text(
          width * 0.2,
          -height * 0.012,
          `코인 ${currentCoins} / +${earnedCoins} → ${finalCoins}`,
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.026}px`,
            fill: "#0f172a",
            fontWeight: "bold",
          },
        )
        .setOrigin(0.5);

      const levelLine = leveledUp
        ? `Lv.${currentLevel} → Lv.${finalLevel} (레벨업!)`
        : `Lv.${currentLevel}  EXP ${finalExperience} (+${earnedExp})`;

      const levelTxt = this.add
        .text(width * 0.2, height * 0.014, levelLine, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.024}px`,
          fill: leveledUp ? "#e67e22" : "#0f172a",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      row.add([rankTxt, nameTxt, coinTxt, levelTxt]);
      container.add(row);
    });

    const btnY = height * 0.74;
    const exitBtnY = height * 0.84;

    // --- 방장/일반유저 버튼 로직 ---
    if (isHost) {
      const startBtn = this.add
        .image(width / 2, btnY, "uibtn")
        .setDisplaySize(width * 0.5, height * 0.08)
        .setTint(0xe67e22)
        .setInteractive({ useHandCursor: true });
      const startTxt = this.add
        .text(width / 2, btnY, "다시 시작", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#ffffff",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      /*startBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        startBtn.disableInteractive();
        startBtn.setAlpha(0.5);

        // 💡 기존의 playReadyGoSequence 호출을 지우고 서버에 요청만 보냅니다.
        // 연출은 서버 응답(gameStart)을 받은 모든 플레이어 화면에서 동시에 실행됩니다.
        socket.emit("startGameRequest");
      });*/

      startBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });

        // 버튼 클릭 피드백 (눌리는 연출)
        this.tweens.add({
          targets: [startBtn, startTxt],
          scale: "*=0.95",
          duration: 50,
          yoyo: true,
          onComplete: () => {
            // 💡 일단 요청을 보냅니다.
            socket.emit("startGameRequest");

            // 💡 [수정] 즉시 disable하지 말고, 연속 클릭 방지만 위해 1초 정도만 막아둡니다.
            startBtn.disableInteractive();
            this.time.delayedCall(1000, () => {
              if (this.resultContainer && this.resultContainer.active) {
                startBtn.setInteractive(); // 1초 뒤 다시 활성화 (실패했을 경우 대비)
              }
            });
          },
        });
      });
      container.add([startBtn, startTxt]);
    } else {
      const isReady = myInfo ? myInfo.isReady : false;
      const readyBtn = this.add
        .image(width / 2, btnY, "uibtn")
        .setDisplaySize(width * 0.5, height * 0.08)
        .setTint(isReady ? 0x2ecc71 : 0x94a3b8)
        .setInteractive({ useHandCursor: true });
      const readyTxt = this.add
        .text(width / 2, btnY, isReady ? "준비완료!" : "준비하기", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#ffffff",
        })
        .setOrigin(0.5);

      readyBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        this.tweens.add({
          targets: readyBtn,
          scaleX: "*=0.95",
          scaleY: "*=0.95",
          duration: 50,
          yoyo: true,
          onComplete: () => {
            socket.emit("toggleReady");
          },
        });
      });
      container.add([readyBtn, readyTxt]);
    }

    // --- 나가기 버튼 ---
    const exitBtnImg = this.add
      .image(width / 2, exitBtnY, "uibtn")
      .setDisplaySize(width * 0.5, height * 0.08)
      .setInteractive({ useHandCursor: true });
    const exitBtnText = this.add
      .text(width / 2, exitBtnY, "나가기", {
        fontFamily: GAME_FONTS.main,
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: `${width * 0.055}px`,
      })
      .setOrigin(0.5);

    exitBtnImg.on("pointerdown", () => {
      this.sound.play("btn", { volume: 0.1 });
      this.showCustomAlert("로비로 이동합니다!", () => {
        window.location.reload();
      });
    });

    container.add([exitBtnImg, exitBtnText]);

    if (!isUpdate) {
      this.tweens.add({
        targets: container,
        y: 0,
        duration: 800,
        ease: "Back.easeOut",
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
    this.isPopupOpen = true;

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height * 0.4;

    // 1. 배경 어둡게
    const overlay = this.add
      .rectangle(centerX, centerY, width, height, 0x000000, 0.6)
      .setDepth(4000) // 쿠시 씬은 UI가 많으므로 뎁스를 더 높게 잡습니다.
      .setInteractive();

    // 2. 팝업 배경
    const popupBg = this.add
      .image(centerX, centerY, "popupbg")
      .setDepth(4001)
      .setDisplaySize(width * 0.75, height * 0.2);

    // 3. 메시지 텍스트
    const msgText = this.add
      .text(centerX, centerY * 0.87, message, {
        fontFamily:
          typeof GAME_FONTS !== "undefined" ? GAME_FONTS.main : "Arial",
        fontSize: `${width * 0.06}px`,
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
      this.isPopupOpen = false;
      this.currentJoinPopupCloseHandler = null;
    };

    this.currentJoinPopupCloseHandler = closeAlert;

    const btnY = centerY * 1.1;
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
