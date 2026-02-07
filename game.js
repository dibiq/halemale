import { getUserKeyForGame } from "@apps-in-toss/web-framework";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { title } from "process";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";

async function handleGetUserKey() {
  const result = await getUserKeyForGame();

  if (!result) {
    console.warn("지원하지 않는 앱 버전이에요.");
  } else if (result === "INVALID_CATEGORY") {
    console.error("게임 카테고리가 아닌 미니앱이에요.");
  } else if (result === "ERROR") {
    console.error("사용자 키 조회 중 오류가 발생했어요.");
  } else if (result.type === "HASH") {
    console.log("사용자 키:", result.hash);
    // 여기에서 사용자 키를 사용해 게임 데이터를 관리할 수 있어요.
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

    this.load.image("title", `${ASSET_SERVER}/images/title.png${VERSION}`);
    this.load.image("mybg", `${ASSET_SERVER}/images/mybg.png${VERSION}`);
    this.load.image("bar", `${ASSET_SERVER}/images/bar.png${VERSION}`);
    this.load.image("itembg", `${ASSET_SERVER}/images/itembg.png${VERSION}`);
    this.load.image("uibtn", `${ASSET_SERVER}/images/ui_btn.png${VERSION}`);
    this.load.image("slide", `${ASSET_SERVER}/images/slide.png${VERSION}`);
    this.load.image("chef", `${ASSET_SERVER}/images/chef.png${VERSION}`);
    this.load.image(
      "resultbg",
      `${ASSET_SERVER}/images/resultbg.png${VERSION}`
    );
    this.load.image("soundon", `${ASSET_SERVER}/images/soundon.png${VERSION}`);
    this.load.image(
      "soundoff",
      `${ASSET_SERVER}/images/soundoff.png${VERSION}`
    );
    this.load.image("popupbg", `${ASSET_SERVER}/images/popupbg2.png${VERSION}`);
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
          `${ASSET_SERVER}/images/cards/${fruit}_${count}.png${VERSION}`
        );
      }
    });

    // 카드 뒷면 로드
    this.load.image(
      "card_back",
      `${ASSET_SERVER}/images/cards/card_back.png${VERSION}`
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

    this.currentJoinPopupCloseHandler = null;

    const savedNickname = localStorage.getItem("nickname");

    if (!savedNickname) {
      // 2. 저장된 닉네임이 없으면 팝업 표시
      this.showNicknamePopup((nickname) => {
        localStorage.setItem("nickname", nickname); // 로컬에 영구 저장

        // 서버로 전송
        socket.emit("setNickname", nickname);
        this.myNickname = nickname; // 현재 씬 변수에 저장
      });
    } else {
      // 3. 이미 닉네임이 있다면 팝업 없이 바로 서버로 전송
      this.myNickname = savedNickname;
      socket.emit("setNickname", savedNickname);

      // (선택 사항) 로딩 중이라면 바로 메인 화면으로 진입하는 로직 실행
      console.log(`반가워요, ${savedNickname} 요리사님!`);
    }

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

    const title = this.add
      .image(centerX, height * 0.2, "title")
      .setDisplaySize(width * 0.9, height * 0.6)
      .setDepth(1) // 레이어 순서를 가장 뒤로
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
    const btnW = width * 0.6; // 단일 버튼이므로 크기를 조금 더 키움
    const btnH = height * 0.07;

    const multiBtn = this.add.container(x, y);

    // 1. 버튼 배경 이미지
    const multiBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(btnW, btnH)
      .setInteractive();

    // 2. 버튼 텍스트
    const multiBtnText = this.add
      .text(0, 0, "멀티플레이", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
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
            const myNickname = localStorage.getItem("nickname") || "요리사";

            // 로딩창 표시
            this.showLoading("방 생성 중...");

            // 🔹 서버에 방 생성 요청 (최대 인원 4인 고정)
            socket.emit("createRoom", {
              nickname: myNickname,
              maxPlayers: 4,
            });
          } else {
            this.showToast("인터넷 연결이 필요합니다!", "#ffffff"); // 초록색 토스트
          }
        },
      });
    });

    // 인원 선택 버튼들 [2, 3, 4] 아래에 추가
    const singleBtnY = height * 0.51; // 기존 0.4보다 위쪽인 0.3으로 설정
    const singleBtnW = width * 0.6; // 너비를 좀 더 넓게
    const singleBtnH = height * 0.07;

    const singleBtn = this.add.container(centerX, singleBtnY);
    const singleBtnImg = this.add
      .image(0, 0, "uibtn")
      .setDisplaySize(singleBtnW, singleBtnH)
      .setInteractive()
      .setTint(0xffd700); // 금색 포인트

    singleBtn.add([
      singleBtnImg,
      this.add
        .text(0, 0, "싱글플레이", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#ffffff",
          fontWeight: "bold",
        })
        .setOrigin(0.5),
    ]);

    singleBtnImg.on("pointerdown", () => {
      this.sound.play("pop", { volume: 0.1 });
      console.log("single");
      this.tweens.add({
        targets: [singleBtnImg, singleBtn.list[1]],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          const singleGameData = {
            roomId: "SINGLE",
            maxPlayers: 1,
            isSingle: true,
            // 🔹 중요: roundData 객체로 감싸서 멀티플레이와 구조를 통일합니다.

            players: [
              {
                id: socket.id || "local-player",
                nickname: localStorage.getItem("nickname") || "나",
                score: 0,
              },
            ],
            hostId: socket.id || "local-player",

            // 🔹 recipes는 그대로 최상위에 두어도 create에서 this.targetRecipes로 잘 받을 겁니다.
            recipes: Array.from({ length: 3 }, () =>
              Array.from({ length: 3 }, () => ({
                id: Math.floor(Math.random() * 5) + 1,
                angle: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
              }))
            ),
          };

          this.scene.start("GameScene", singleGameData);
        },
      });
    });

    // 방 코드 입력 버튼 (비율 적용)
    const joinBtnY = height * 0.6;

    const joinBtnImg = this.add
      .image(centerX, joinBtnY, "uibtn")
      .setDisplaySize(width * 0.6, height * 0.08)
      .setTint(0xe67e22)
      .setInteractive();

    // 2. 버튼 텍스트 생성
    const joinBtnText = this.add
      .text(centerX, joinBtnY, "방 코드 입력하기", {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.055}px`,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // 3. 클릭 이벤트 연출 추가
    joinBtnImg.on("pointerdown", () => {
      this.checkConnection();

      // 효과음 재생 (기존 'btn' 사용)
      this.sound.play("btn", { volume: 0.1 });

      // 버튼과 글자가 함께 눌리는 연출
      this.tweens.add({
        targets: [joinBtnImg, joinBtnText],
        scaleX: "*=0.95", // 현재 크기에서 5% 축소
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true, // 다시 원래 크기로 돌아옴
        onComplete: () => {
          if (this.isOnline) {
            this.showJoinCodePopup((data) => {
              if (data && data.roomId) {
                // data가 { roomId, nickname } 객체이므로 그대로 전송
                socket.emit("joinRoom", data);

                if (window.ReactNativeWebView) {
                  generateHapticFeedback({ type: "success" }).catch(() => {});
                }
              }
            });
          } else {
            this.showToast("인터넷 연결이 필요합니다!", "#ffffff"); // 초록색 토스트
          }
        },
      });
    });

    socket.off("roomCreated").on("roomCreated", (data) => {
      this.isRoomOpen = true;

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
      console.log("players 숫자 :", data.players.length);

      this.createBlocker(); // 함수 호출

      this.hideLoading();

      this.cleanupPopup();

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
              "#2ecc71"
            );
          }
        }
      });
    });

    // 3. 플레이어 퇴장 리스너
    socket.off("playerLeft").on("playerLeft", (data) => {
      this.refreshLobbyUI(data);
      this.showToast(`${data.nickname}님이 나갔습니다.`, "#e74c3c");
    });

    socket.on("startBlocked", (msg) => {
      this.showToast(
        msg || "아직 준비되지 않은 플레이어가 있습니다!",
        "#e74c3c"
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
      .image(150, 50, bgmOn ? "soundon" : "soundoff")
      .setOrigin(1, 0)
      .setDepth(10)
      .setScale(0.8)
      .setInteractive();

    // [핵심] 생성한 모든 객체를 메인 컨테이너에 추가
    this.mainUIContainer.add([title, bgmBtn]);
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
      0.8
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

    console.log("players 숫자 in refresh:", data.players.length);

    // 로그로 현재 상태 확인
    console.log(
      `[Sync] 방:${this.currentRoomId}, 나:${socket.id}, 방장:${this.hostId}, 방장여부:${isHost}`
    );

    // UI 그리기 (기존 함수 호출)
    this.showWaiting(
      this.currentRoomId,
      this.currentPlayers,
      isHost,
      this.currentMax
    );
  }

  // 로딩 화면 표시 및 제거 함수
  showLoading(message) {
    const { width, height } = this.cameras.main;

    // 기존 로딩창이 있다면 제거
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
    this.time.delayedCall(10000, () => {
      if (this.loadingContainer) {
        this.hideLoading();
        this.showToast("연결 시간이 초과되었습니다.");
      }
    });
  }

  hideLoading() {
    if (this.loadingContainer) {
      this.loadingContainer.destroy();
      this.loadingContainer = null;
    }
  }

  showToast(message, color = "#ffffff") {
    this.isToastOpen = true;

    if (!this.cameras || !this.cameras.main) return;

    const { width, height } = this.cameras.main;
    console.log("렌더링 위치:", width / 2, 150); // 좌표 확인용

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
        this.time.delayedCall(2500, () => {
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
    const popupY = height * 0.3;

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
      .setDisplaySize(width * 0.75, height * 0.35);

    // 4. 안내 텍스트
    const titleText = this.add
      .text(centerX, popupY - 90, "방 코드를 입력하세요.", {
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
      .dom(centerX - 25, popupY - 25, "input")
      .setDepth(201); // 컨테이너보다 살짝 높게

    const el = this.joinInputElement.node;
    el.placeholder = "코드 입력";
    Object.assign(el.style, {
      width: `${width * 0.5}px`,
      height: "45px",
      fontSize: "24px",
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
    const btnY = popupY + 95;
    const btnGap = width * 0.18;

    const cancelBtnImg = this.add
      .image(centerX - btnGap, btnY, "uibtn")
      .setDisplaySize(width * 0.3, height * 0.08)
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
      .setDisplaySize(width * 0.3, height * 0.08)
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
    const popupY = height * 0.33;

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
      .setDisplaySize(width * 0.7, height * 0.33);

    // 4. 안내 텍스트 (위로 90px)
    const titleText = this.add
      .text(0, -80, "아이디를 입력하세요.\n(입력후 변경불가! 최대5글자)", {
        fontFamily: "Jua",
        fontSize: `${width * 0.05}px`,
        color: "#ffffff",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // 5. Phaser DOM Input (중앙에서 약간 보정)
    const inputElement = this.add.dom(-25, -10, "input");
    const el = inputElement.node;
    el.placeholder = "닉네임 입력";
    Object.assign(el.style, {
      width: `${width * 0.5}px`,
      height: "45px",
      fontSize: "24px",
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
      .image(0, 85, "uibtn")
      .setDisplaySize(width * 0.35, height * 0.08)
      .setInteractive({ useHandCursor: true });

    const confirmBtnText = this.add
      .text(0, 85, "확인", {
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

  showWaiting(roomId, players = [], isHost = false, maxPlayers = 2) {
    console.log("players 숫자 in Waiting:", players.length);

    const { width, height } = this.cameras.main;
    const centerX = width / 2;

    // 1. 메인 화면 UI (타이틀, 사운드버튼 등) 파괴
    if (this.mainUIContainer) {
      this.mainUIContainer.destroy();
      this.mainUIContainer = null;
    }

    // 2. 입장 코드 팝업 컨테이너 파괴
    if (this.joinPopupContainer) {
      this.joinPopupContainer.destroy();
      this.joinPopupContainer = null;
    }

    // 3. 입력창 DOM 요소 파괴 (이게 중요!)
    if (this.joinInputElement) {
      this.joinInputElement.destroy();
      this.joinInputElement = null;
    }

    // 기존 대기실 UI가 있다면 제거 (중복 생성 방지)
    if (this.lobbyUIContainer) {
      this.lobbyUIContainer.destroy();
    }
    this.lobbyUIContainer = this.add.container(0, 0).setDepth(100);

    // 2. 배경 (컨테이너에 추가)
    const bg = this.add
      .image(centerX, height / 2, "mybg")
      .setDisplaySize(width, height * 1.2)
      .setDepth(0);
    this.lobbyUIContainer.add(bg);

    // 3. 입장 코드 (roomId가 undefined면 기존 변수 사용)
    const codeText = this.add
      .text(
        centerX,
        height * 0.15,
        `입장코드: ${roomId || this.currentRoomId}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.08}px`,
          fill: "#ffff00",
          fontWeight: "bold",
        }
      )
      .setDepth(10)
      .setOrigin(0.5);
    this.lobbyUIContainer.add(codeText);

    // 4. 참가자 수
    const countText = this.add
      .text(centerX, height * 0.25, `참가자: ${players.length} / 4`, {
        fontFamily: GAME_FONTS.main,
        fontSize: `${width * 0.05}px`,
        fill: "#fff",
      })
      .setOrigin(0.5);
    this.lobbyUIContainer.add(countText);

    /* =======================================================
       5. 플레이어 리스트 패널 (배경 박스) 생성
    ======================================================= */
    const listTopY = height * 0.32; // 리스트 시작 높이
    const itemHeight = height * 0.05; // 한 줄당 높이
    const panelWidth = width * 0.5; // 패널 가로 길이
    const panelPadding = height * 0.08;
    const panelHeight = players.length * itemHeight + panelPadding;
    const panelY = listTopY + panelHeight / 2 - panelPadding / 2;

    // 라운드 박스 그리기
    const listPanel = this.add.graphics();
    listPanel.fillStyle(0x000000, 0.5); // 검정색, 50% 투명도
    listPanel.fillRoundedRect(
      centerX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      15 // 모서리 곡률
    );
    this.lobbyUIContainer.add(listPanel);

    /* =======================================================
       6. 플레이어 리스트 텍스트 렌더링
    ======================================================= */
    const textStartX = centerX - panelWidth / 2 + width * 0.05;

    players.forEach((p, i) => {
      const isThisPlayerHost = p.id === this.hostId;
      const isMe = p.id === socket.id;

      const isReadyState = isThisPlayerHost || p.isReady;
      const statusColor = isReadyState ? "#00ff00" : "#ffffff";
      const circleIcon = isReadyState ? "●" : "○";

      let pName = p.nickname;
      if (isThisPlayerHost) pName = `${pName} 👑`;

      const pText = this.add
        .text(
          textStartX, // 왼쪽 정렬된 시작 좌표
          listTopY + i * itemHeight + panelPadding / 4,
          `${circleIcon} ${pName}`,
          {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.06}px`,
            color: isMe ? "#ffff00" : statusColor,
            stroke: isReadyState ? "#004400" : "#000000",
            strokeThickness: isReadyState ? 2 : 0,
            fontWeight: "bold",
          }
        )
        .setOrigin(0, 0.5); // ⭐ 핵심: 원점을 왼쪽(0)으로 설정하여 왼쪽 정렬

      this.lobbyUIContainer.add(pText);
    });

    /* ======================
     시작 / 나가기 버튼 로직 (기존과 동일하되 컨테이너에 add)
     ====================== */
    const mainBtnY = height * 0.615;
    const mainBtnImg = this.add
      .image(centerX, mainBtnY, "uibtn")
      .setDisplaySize(width * 0.6, height * 0.085)
      .setTint(0xe67e22)
      .setDepth(20)
      .setInteractive();

    const mainBtnText = this.add
      .text(centerX, mainBtnY, isHost ? "시작하기" : "준비하기", {
        fontFamily: GAME_FONTS.main,
        color: "#fff",
        fontSize: `${width * 0.055}px`,
        fontWeight: "bold",
      })
      .setDepth(20)
      .setOrigin(0.5);

    this.lobbyUIContainer.add([mainBtnImg, mainBtnText]);

    // 시작/나가기 버튼 클릭 이벤트
    // 시작/나가기 버튼 클릭 이벤트
    mainBtnImg.on("pointerdown", () => {
      // 효과음 재생
      this.sound.play("pop", { volume: 0.1 });

      // 1. 클릭 연출 추가 (이미지와 텍스트 동시 적용)
      this.tweens.add({
        targets: [mainBtnImg, mainBtnText],
        scaleX: "*=0.95", // 현재 크기에서 5% 축소
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true, // 다시 원래 크기로 복구
        onComplete: () => {
          // 2. 애니메이션이 끝난 후 기존 로직 실행
          console.log("시작 버튼 클릭 연출 완료");

          if (isHost) {
            const currentCount = this.currentPlayers.length;
            // 1. 방장 혼자 있을 때 (가장 먼저 체크)
            if (currentCount <= 1) {
              this.showToast(
                "함께 할 유저가 필요합니다! (최소 2인)",
                "#e74c3c"
              );
              console.log("시작 거부: 혼자 있음");
            }
            // 3. 모든 조건 만족 시 게임 시작
            else {
              //socket.emit("requestNextRecipe"); 이건 쿠시용
              socket.emit("startGameRequest");
              console.log("게임 시작 요청 전송");
            }
          } else {
            // 중복 클릭 방지
            mainBtnImg.disableInteractive();
            socket.emit("toggleReady");

            this.time.delayedCall(300, () => {
              if (mainBtnImg && mainBtnImg.active) {
                mainBtnImg.setInteractive();
              }
            });
          }
        },
      });
    });

    // 방장용 추가 나가기 버튼
    const exitBtnY = height * 0.715;
    const exitBtnImg = this.add
      .image(centerX, exitBtnY, "uibtn")
      .setDisplaySize(width * 0.6, height * 0.08)
      .setInteractive()
      .setTint(isHost ? 0xffffff : 0xffaaaa);

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
      // 1. 효과음 재생
      this.sound.play("pop", { volume: 0.1 });

      // 2. 클릭 연출 (이미지와 텍스트 동시 적용)
      this.tweens.add({
        targets: [exitBtnImg, exitBtnText],
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // 3. 연출이 눈에 보인 직후에 페이지 새로고침
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

    // 할리갈리 전용 데이터
    this.myCards = []; // 내 덱
    this.openCards = {}; // 각 플레이어별 바닥에 오픈된 카드 { playerId: card }
  }

  create() {
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
      .image(centerX, centerY - 90, "mybg")
      .setDisplaySize(width, height)
      .setDepth(-1)
      .setAlpha(0.6);

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
      this.showToast(`${data.nickname}님이 나갔습니다.`, "#e74c3c");
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
        this.showResultOverlay(data.players, true);
      }
    });

    socket.on("startBlocked", (msg) => {
      this.showToast(msg, "#e74c3c");
    });

    // ============================================
    // 2. 할리갈리 전용 소켓 리스너
    // ============================================
    socket.off("gameStart").on("gameStart", (data) => {
      if (this.resultContainer) this.resultContainer.destroy();

      // 💡 수정: 서버의 myDeck.length를 cards 속성으로 매핑
      this.roundData.players = data.players.map((p) => ({
        ...p,
        cards: p.cards || (p.myDeck ? p.myDeck.length : 0),
        openCard: null, // 시작 시 바닥 카드는 비움
      }));

      this.roundData.isGameStarted = true;
      this.isGameReady = true;

      this.renderTable(this.roundData.players); // 갱신된 roundData 사용
    });

    socket.off("cardFlipped").on("cardFlipped", (data) => {
      this.playCardFlipAnimation(data);
    });

    socket.off("bellResult").on("bellResult", (data) => {
      this.playFeedback(data.success, data.message);

      if (data.success) {
        // 성공 로직 (기존과 동일)
        this.roundData.players = data.players.map((p) => ({
          ...p,
          cards: p.cards || (p.myDeck ? p.myDeck.length : 0),
          openCard: null,
        }));
        this.showToast(`${data.winnerNickname}님이 카드를 획득! 🔔`, "#f1c40f");
        this.time.delayedCall(500, () => {
          this.renderTable(this.roundData.players);
        });
      } else {
        // 💡 실패 시: 먼저 내 로컬 데이터를 서버 데이터로 동기화!
        this.roundData.players = data.players.map((p) => ({
          ...p,
          cards: p.cards || (p.myDeck ? p.myDeck.length : 0),
        }));

        // 그 다음 애니메이션 실행 (애니메이션이 끝나면 갱신된 데이터를 그리도록 함)
        this.playPenaltyAnimation({
          penaltyId: data.penaltyId,
          players: this.roundData.players, // 갱신된 데이터 전달
        });
      }
    });

    socket.off("gameEnded").on("gameEnded", (data) => {
      this.playFinishAnimation(() => {
        this.showResultOverlay(data.ranking);
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
    });
  }

  createHaliGaliButtons(height) {
    const { width } = this.cameras.main;

    // 1. 중앙 종 (Bell)
    this.bellImage = this.add
      .image(width / 2, height / 2, "bell") // bell 이미지가 있다고 가정
      .setDisplaySize(width * 0.25, width * 0.25)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.handleRingBell());

    // 2. 카드 뒤집기 버튼 (하단)
    const flipBtn = this.add
      .image(width / 2, height * 0.85, "uibtn")
      .setDisplaySize(width * 0.5, height * 0.08)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.handleFlipCard());

    this.add
      .text(width / 2, height * 0.85, "카드 뒤집기", {
        fontFamily: GAME_FONTS.main,
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  renderTable(players) {
    this.playerTableGroup.removeAll(true);
    const { width, height } = this.cameras.main;

    // 1. 플레이어 위치 계산 (내 기준 상대적 배치)
    // socket.id를 기준으로 본인을 항상 하단(0번)에 배치하는 로직이 추가되면 좋습니다.
    const myIndex = players.findIndex((p) => p.id === socket.id);
    const safeIndex = myIndex === -1 ? 0 : myIndex;

    const sortedPlayers = [
      ...players.slice(myIndex),
      ...players.slice(0, myIndex),
    ];

    // 4인 기준 좌표 (0:하단, 1:좌측, 2:상단, 3:우측)
    const pos = [
      { x: width * 0.5, y: height * 0.75, rotation: 0 },
      { x: width * 0.18, y: height * 0.45, rotation: 90 },
      { x: width * 0.5, y: height * 0.18, rotation: 180 },
      { x: width * 0.82, y: height * 0.45, rotation: -90 },
    ];

    sortedPlayers.forEach((p, i) => {
      const layout = pos[i];
      if (!layout) return;

      // 플레이어 정보 표시 (닉네임, 남은 카드 수)
      this.drawPlayerInfo(p, layout);

      // 2. 플레이어 카드 덱 (뒷면) 그리기
      this.drawPlayerDeck(p, layout);

      // 3. 바닥에 오픈된 카드 그리기
      if (p.openCard) {
        this.drawOpenCard(p.openCard, layout);
      }
    });
  }

  getCardKey(card) {
    const fruitNames = { 1: "strawberry", 2: "banana", 3: "lime", 4: "plum" };
    const fruitName = fruitNames[card.fruit] || "strawberry";
    return `${fruitName}_${card.count}`;
  }

  playPenaltyAnimation(data) {
    const { width, height } = this.cameras.main;
    const players = this.roundData.players;

    const penaltyIdx = players.findIndex((p) => p.id === data.penaltyId);
    const myIndex = players.findIndex((p) => p.id === socket.id);

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

    // 💡 수정한 부분 1: 날려야 할 총 카드 개수 계산
    const targetPlayers = players.filter((p) => p.id !== data.penaltyId);
    const totalCardsToFly = targetPlayers.length;
    let finishedCount = 0;

    targetPlayers.forEach((player) => {
      // player 객체에서 실제 전체 인덱스를 다시 찾음 (좌표용)
      const realIdx = players.findIndex((p) => p.id === player.id);
      const relTargetIdx =
        (realIdx - myIndex + players.length) % players.length;
      const targetPos = pos[relTargetIdx];

      const flyCard = this.add
        .image(startPos.x, startPos.y, "card_back")
        .setDisplaySize(width * 0.1, width * 0.15)
        .setDepth(2000);

      this.tweens.add({
        targets: flyCard,
        x: targetPos.x,
        y: targetPos.y,
        duration: 500,
        ease: "Cubic.out", // Back.out 보다 깔끔하게 꽂히는 Cubic.out 추천
        delay: Math.random() * 200,
        onStart: () => {
          this.sound.play("pop", { volume: 0.1, detune: 500 });
        },
        onComplete: () => {
          flyCard.destroy();
          finishedCount++;

          // 💡 수정한 부분 2: 모든 카드가 도착했을 때만 딱 한 번 실행
          if (finishedCount === totalCardsToFly) {
            console.log("모든 패널티 카드 도착! 테이블 갱신");
            this.renderTable(data.players);
          }
        },
      });
    });
  }

  playCardFlipAnimation(data) {
    // 1. 데이터가 없으면 실행 중단
    if (!data || !this.roundData.players) return;

    const { width, height } = this.cameras.main;

    // 2. 서버의 숫자(1~4)를 클라이언트 이미지 키(문자)로 변환 (매핑)
    // 서버 설정에 따라 숫자 순서를 맞춰주세요 (1:딸기, 2:바나나, 3:라임, 4:자두)
    const fruitNames = {
      1: "strawberry",
      2: "banana",
      3: "lime",
      4: "plum",
    };

    const fruitName = fruitNames[data.card.fruit] || "strawberry";
    const cardKey = this.getCardKey(data.card);

    // [디버깅용 로그] 엑스박스가 뜨면 이 로그를 확인하세요
    console.log(
      `[CardFlip] 서버전달:${data.card.fruit} -> 매핑된이름:${fruitName} -> 최종키:${cardKey}`
    );

    // 3. 현재 메모리의 플레이어 데이터 업데이트 (도착 후 상태 반영용)
    const playerIdx = this.roundData.players.findIndex(
      (p) => p.id === data.playerId
    );
    const myIndex = this.roundData.players.findIndex((p) => p.id === socket.id);

    if (playerIdx !== -1) {
      this.roundData.players[playerIdx].openCard = data.card; // 바닥 카드 정보 업데이트
      this.roundData.players[playerIdx].cards = data.remainingCount; // 남은 카드 수 업데이트
    }

    // 4. 애니메이션 출발/도착 위치 계산
    const relativeIdx =
      (playerIdx - myIndex + this.roundData.players.length) %
      this.roundData.players.length;
    const pos = [
      { x: width * 0.5, y: height * 0.75, rotation: 0 },
      { x: width * 0.18, y: height * 0.45, rotation: 90 },
      { x: width * 0.5, y: height * 0.18, rotation: 180 },
      { x: width * 0.82, y: height * 0.45, rotation: -90 },
    ];

    const startPos = pos[relativeIdx];
    if (!startPos) return this.renderTable(this.roundData.players);

    // 5. 애니메이션용 임시 카드 생성 (처음엔 뒷면)
    const tempCard = this.add
      .image(startPos.x, startPos.y, "card_back")
      .setDisplaySize(width * 0.15, width * 0.22)
      .setAngle(startPos.rotation)
      .setDepth(1000);

    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(startPos.rotation - 90);
    const targetX = startPos.x + Math.cos(rad) * dist;
    const targetY = startPos.y + Math.sin(rad) * dist;

    // 6. 트윈 애니메이션
    this.tweens.add({
      targets: tempCard,
      x: targetX,
      y: targetY,
      duration: 300,
      ease: "Cubic.out",
      onStart: () => {
        this.sound.play("pop", { volume: 0.1 });
      },
      onUpdate: (tween) => {
        // 50% 진행 시점에 앞면 텍스처로 교체 (뒤집기 효과)
        if (tween.progress > 0.5 && tempCard.texture.key === "card_back") {
          // 이미지가 로드되어 있는지 확인 후 적용
          if (this.textures.exists(cardKey)) {
            tempCard.setTexture(cardKey);
            tempCard.setDisplaySize(width * 0.18, width * 0.25);
          } else {
            console.error(`🚨 텍스처를 찾을 수 없습니다: ${cardKey}`);
          }
        }
      },
      onComplete: () => {
        tempCard.destroy(); // 임시 카드 제거
        this.renderTable(this.roundData.players); // 최종 상태로 테이블 다시 그리기
      },
    });
  }

  drawPlayerInfo(p, layout) {
    const { width } = this.cameras.main;
    const isMe = p.id === socket.id;

    // 위치 계산을 위한 오프셋
    const nameOffset = 80; // 닉네임 위치
    const cardOffset = 110; // 카드 숫자 위치 (닉네임보다 조금 더 아래)

    // 1. 닉네임 텍스트
    const nameTxt = this.add
      .text(
        layout.x,
        layout.y + (layout.rotation === 180 ? -nameOffset : nameOffset),
        p.nickname,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: isMe ? "#22c55e" : "#ffffff",
          fontWeight: "bold",
          stroke: "#000",
          strokeThickness: 3,
        }
      )
      .setOrigin(0.5);

    // 2. 카드 숫자 텍스트 추가
    // p.cards가 없으면 0으로 표시 (위에서 만든 매핑 로직 덕분에 숫자가 들어올 거예요)
    const cardCount =
      p.cards !== undefined ? p.cards : p.myDeck ? p.myDeck.length : 0;

    const cardTxt = this.add
      .text(
        layout.x,
        layout.y + (layout.rotation === 180 ? -cardOffset : cardOffset),
        `🂠 ${cardCount}`,
        {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.03}px`,
          color: "#f1c40f", // 황금색 계열로 강조
          fontWeight: "bold",
          stroke: "#000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5);

    // 그룹에 추가하여 관리
    this.playerTableGroup.add(nameTxt);
    this.playerTableGroup.add(cardTxt);
  }

  drawPlayerDeck(p, layout) {
    const { width } = this.cameras.main;
    // 카드 덱 이미지는 preload에서 'card_back'으로 로드했다고 가정
    const deck = this.add
      .image(layout.x, layout.y, "card_back")
      .setDisplaySize(width * 0.15, width * 0.22)
      .setAngle(layout.rotation);

    // 남은 카드 장수 표시
    const countTxt = this.add
      .text(layout.x, layout.y, p.cards || "0", {
        fontFamily: GAME_FONTS.main,
        fontSize: "20px",
        color: "#ffffff",
        fontWeight: "bold",
      })
      .setOrigin(0.5);

    this.playerTableGroup.add([deck, countTxt]);
  }

  drawOpenCard(card, layout) {
    const { width } = this.cameras.main;

    // 1. 서버의 숫자(1~4)를 클라이언트 이미지 키(문자)로 변환
    const fruitNames = {
      1: "strawberry",
      2: "banana",
      3: "lime",
      4: "plum",
    };
    const fruitName = fruitNames[card.fruit] || "strawberry";
    const cardKey = `${fruitName}_${card.count}`;

    // 2. 좌표 계산
    const dist = width * 0.25;
    const rad = Phaser.Math.DegToRad(layout.rotation - 90);
    const ox = layout.x + Math.cos(rad) * dist;
    const oy = layout.y + Math.sin(rad) * dist;

    // 3. 이미지 생성 (키가 존재하는지 확인)
    if (this.textures.exists(cardKey)) {
      const openCardImg = this.add
        .image(ox, oy, cardKey)
        .setDisplaySize(width * 0.18, width * 0.25)
        .setAngle(layout.rotation)
        .setDepth(150);

      this.playerTableGroup.add(openCardImg);
    } else {
      console.error(`🚨 drawOpenCard 에러: 키를 찾을 수 없음 - ${cardKey}`);
    }
  }

  drawBell(x, y) {
    const { width } = this.cameras.main;
    this.bellImage = this.add
      .image(x, y, "bell")
      .setDisplaySize(width * 0.25, width * 0.25)
      .setInteractive({ useHandCursor: true })
      .setDepth(200);

    this.bellImage.on("pointerdown", () => this.handleRingBell());
  }

  // 카드 뒤집기 요청 (내 차례일 때 실행)
  handleFlipCard() {
    if (!this.isGameReady) return;
    socket.emit("flipCard");
    this.sound.play("pop", { volume: 0.1 }); // 카드 넘기는 소리
  }
  // 종 치기 요청 (누구나 언제든 실행 가능)
  handleRingBell() {
    if (!this.isGameReady) return;
    socket.emit("ringBell");

    // 클라이언트에서 즉시 종 애니메이션 (반응 속도감을 위해)
    if (this.bellImage) {
      this.tweens.add({
        targets: this.bellImage,
        scale: 0.8,
        duration: 50,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
    }
  }
  showResultOverlay(players, isUpdate = false) {
    if (!this.roundData) return;
    if (!players || players.length === 0) return;

    const { width, height } = this.cameras.main;
    const currentHostId = this.roundData.hostId;
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
    const myInfo =
      players.find(
        (p) => (p.id || p.nickname) === (socket.id || socket.nickname)
      ) || null;

    const bg = this.add
      .image(width / 2, height / 2, "resultbg")
      .setDisplaySize(width * 1.2, height * 1.4);
    container.add(bg);

    // --- 플레이어 리스트 매핑 (할리갈리 버전) ---
    players.forEach((p, i) => {
      const y = height * 0.35 + i * (height * 0.08);
      const row = this.add.container(width / 2, y);

      // 서버 응답 데이터 구조에 따른 방어 코드 (p.id가 없을 경우 p.nickname 사용)
      const isThisPlayerHost = p.id === currentHostId;
      let displayName = p.nickname;

      if (isThisPlayerHost) {
        displayName = `● ${displayName} 👑`;
      } else {
        // 결과창에서는 준비 상태 대신 카드 장수를 보여주는 것이 좋습니다.
        displayName = `● ${displayName}`;
      }

      const rankTxt = this.add
        .text(-width * 0.25, 0, `${i + 1}위`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: "#334155",
        })
        .setOrigin(0.5);

      const nameTxt = this.add
        .text(-width * 0.1, 0, displayName, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: isThisPlayerHost ? "#e67e22" : "#0f172a",
          fontWeight: "bold",
        })
        .setOrigin(0, 0.5);

      // 할리갈리 전용: 남은 카드 수 표시
      const scoreValue = p.cards !== undefined ? `${p.cards}장` : "";
      const scoreTxt = this.add
        .text(width * 0.25, 0, scoreValue, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: "#2563eb",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      row.add([rankTxt, nameTxt, scoreTxt]);
      container.add(row);
    });

    const btnY = height * 0.75;
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

      startBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });
        startBtn.disableInteractive();
        startBtn.setAlpha(0.5);

        // 할리갈리 서버의 게임 시작 요청 이벤트
        socket.emit("startGameRequest");
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

      const feedbackText = this.add
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
      });
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
      if (message) this.showToast(message, "#ef4444");
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
        this.time.delayedCall(2000, () => {
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
      this.isPopupOpen = false;
      this.currentJoinPopupCloseHandler = null;
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
}

const config = {
  type: Phaser.AUTO,
  parent: "game-container", // 🔹 위에서 만든 div ID와 일치해야 함
  width: 480,
  height: 854,
  backgroundColor: "#0f172a",
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true }, // ✅ 여기를 추가
  scene: [LobbyScene, GameScene],
};

new Phaser.Game(config);
