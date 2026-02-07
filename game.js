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

const SERVER_URL = "https://skewer-master.onrender.com";

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

    for (let i = 1; i <= 5; i++) {
      this.load.image(
        `ingre${i}`,
        `${ASSET_SERVER}/images/m${i}.png${VERSION}`
      );
    }

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

          this.scene.start("KushiScene", singleGameData);
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

      this.scene.start("KushiScene", data);
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

    const ingreKeys = ["ingre1", "ingre2", "ingre3", "ingre4", "ingre5"];
    const ingreSize = width * 0.08;
    const rotateRadius = width * 0.1; // 식재료들이 도는 원의 반지름

    const ingreSprites = [];

    ingreKeys.forEach((key, index) => {
      const angle = (360 / ingreKeys.length) * index; // 초기 각도 배치
      const rad = Phaser.Math.DegToRad(angle);

      const x = rotateRadius * Math.cos(rad);
      const y = rotateRadius * Math.sin(rad);

      const ingre = this.add
        .image(x, y, key)
        .setDisplaySize(ingreSize, ingreSize)
        .setAlpha(0); // 처음엔 숨김

      loadingContainer.add(ingre);
      ingreSprites.push(ingre);

      // 각 식재료의 등장 및 회전 애니메이션
      this.tweens.timeline({
        targets: ingre,
        ease: "Sine.easeInOut",
        loop: -1, // 무한 반복
        delay: index * 200, // 순차적으로 등장
        tweens: [
          { alpha: 1, duration: 300 }, // 등장
          { y: y - 10, duration: 500, yoyo: true, repeat: -1, offset: 0 }, // 위아래로 살짝 움직임
          { angle: 360, duration: 3000, repeat: -1, offset: 0, ease: "Linear" }, // 제자리 회전
        ],
      });
    });

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

  /*showJoinCodePopup(callback) {
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
    };

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
  }*/

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
            const maxCount = this.currentMax;

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
              socket.emit("requestNextRecipe");
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

class KushiScene extends Phaser.Scene {
  constructor() {
    super("KushiScene");
  }
  init(data) {
    // data가 아예 없을 때를 대비
    console.log("1. init에서 받은 raw data:", data);

    this.roundData = {
      players: data.players || [],
      hostId: data.hostId || null,
      roomId: data.roomId,
    };

    this.targetRecipes = data.recipes || [];
    this.isSingle = !!data.isSingle;

    this.allSkewerSubmission = [];
    this.currentSkewer = [];
    this.isAlreadySubmitted = false;
    this.isGameReady = false;
    this.resultContainer = null;
  }

  create() {
    this.isPopupOpen = false;
    this.currentJoinPopupCloseHandler = null;

    // 만약 init에서 안 했다면 여기서라도 강제로 생성
    if (!this.roundData) {
      console.log("no data in creat");
      //this.roundData = { players: [], hostId: null };
    }

    console.log("player length in create ", this.roundData.players.length);

    bgmEnabled = localStorage.getItem("bgmEnabled") !== "false";

    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    //this.add.rectangle(centerX, centerY, width, height, COLORS.bg);
    this.add
      .image(centerX, centerY - 90, "mybg")
      .setDisplaySize(width, height * 1)
      .setDepth(-1) // 레이어 순서를 가장 뒤로
      .setAlpha(0.6); // 게임 화면은 집중을 위해 약간 어둡게 처리(선택사항)

    this.playerTableGroup = this.add.container(0, 0).setDepth(100);

    // 1. 천막 애니메이션 실행
    this.playOpeningAnimation();

    // 2. 카운트다운 연출 함수 호출
    // 천막이 절반쯤 열렸을 때(약 0.8초 후) READY GO 시작
    this.time.delayedCall(800, () => {
      this.showReadyGo();
    });

    // 1. 플레이어 입장
    socket.off("playerJoined").on("playerJoined", (data) => {
      // 입장 효과음
      this.sound.play("pop", { volume: 0.2 });
      this.showToast(`${data.nickname}님이 입장했습니다!`, "#2ecc71");
      console.log("players 숫자 :", data.players.length);

      this.roundData.players = data.players;
      if (this.renderTable) this.renderTable(data.players);
    });

    // 2. 플레이어 퇴장 (추가됨)
    socket.off("playerLeft").on("playerLeft", (data) => {
      // 퇴장 효과음 (약간 낮은 톤이나 짧은 소리)
      this.sound.play("btn", { volume: 0.2 });
      this.showToast(`${data.nickname}님이 나갔습니다.`, "#e74c3c");

      this.roundData.players = data.players;
      if (this.renderTable) this.renderTable(data.players);
    });

    // 3. 방장 변경
    socket.off("hostChanged").on("hostChanged", (data) => {
      this.roundData.hostId = data.hostId;

      // 방장 변경 알림 (중요한 정보이므로 화려한 소리)
      this.sound.play("irassai", { volume: 0.1 });

      // 서버가 보내준 통합 메시지가 있으면 그걸 쓰고, 없으면 기본 문구 출력
      const toastMsg = data.message || "방장이 변경되었습니다.";
      this.showToast(toastMsg, "#f1c40f");

      if (this.resultContainer) {
        this.showResultOverlay(
          this.lastResultPlayers || this.roundData.players
        );
      }
    });

    socket.on("startBlocked", (msg) => {
      this.showToast(
        msg || "아직 준비되지 않은 플레이어가 있습니다!",
        "#e74c3c"
      );
    });

    // KushiScene.js의 readyStatusUpdated 리스너 수정
    socket.off("readyStatusUpdated").on("readyStatusUpdated", (data) => {
      if (!data || !data.players) return;

      this.roundData.players = data.players;
      this.roundData.hostId = data.hostId;

      // 결과창이 이미 떠 있다면 애니메이션 없이 데이터만 갱신
      if (this.resultContainer && this.resultContainer.active) {
        // 💡 true 인자를 넘겨서 '갱신 모드'임을 알림
        this.showResultOverlay(data.players, true);
      }
    });

    // 4. 다음 게임 시작 리스너 (방장이 '계속하기' 눌렀을 때 서버가 보내는 신호)
    socket.off("gameStart").on("gameStart", (data) => {
      if (this.resultContainer) this.resultContainer.destroy();
      console.log(" gameStart ", data.players.length);

      this.scene.restart({
        roundData: { players: data.players, hostId: data.hostId },
        recipes: data.recipes,
        isSingle: data.isSingle,
      });
    });

    App.addListener("backButton", () => {
      if (this.isPopupOpen) {
        this.currentJoinPopupCloseHandler();
      } else {
        this.showCustomAlert("로비로 이동합니다!", () => {
          window.location.reload();
        });
      }
    });

    this.showOrdersDisplay(height * 0.185);
    this.createInputArea(height - height * 0.1);
    this.createControlButtons(height - height * 0.2);

    const margin = width * 0.87;
    const btnX = width - margin;
    const btnY = height * 0.077;

    // 2. 홈 이미지 버튼 생성
    const exitBtn = this.add
      .image(btnX, btnY, "home") // 미리 preload에서 'home'으로 로드했다고 가정
      .setDisplaySize(width * 0.07, width * 0.07) // 가로세로 비율 유지 (정사각형 권장)
      .setInteractive({ useHandCursor: true })
      .setDepth(100);

    // 4. 클릭 이벤트 및 햅틱 피드백
    exitBtn.on("pointerdown", () => {
      // 버튼이 눌리는 듯한 연출 (살짝 작아졌다가 커짐)
      this.tweens.add({
        targets: exitBtn,
        scale: exitBtn.scale * 0.9,
        duration: 50,
        yoyo: true,
      });

      // 토스 햅틱 추가 (가벼운 클릭감)
      if (window.ReactNativeWebView) {
        generateHapticFeedback({ type: "impactLight" }).catch(() => {});
      }

      // 나가기 확인
      this.showCustomAlert("로비로 이동합니다!", () => {
        window.location.reload();
      });
    });

    socket.off("result").on("result", (data) => {
      this.playFeedback(data.success);
      if (data.success) {
        this.allSkewerSubmission = [];
        this.currentSkewer = [];
      }
    });

    socket.off("updateScores").on("updateScores", (p) => {
      this.roundData.players = p;
      // 결과창이 떠 있는 상태라면 결과창만 다시 그림
      if (this.resultContainer && this.resultContainer.active) {
        this.showResultOverlay(p);
      }
      this.renderTable(p);
    });

    socket.off("recipeEnded").on("recipeEnded", (data) => {
      // 서버가 { players, hostId } 형태로 보내므로 맞춰서 저장
      const players = data.players || data;
      if (data.hostId) {
        this.roundData.hostId = data.hostId;
      }

      this.lastResultPlayers = players;

      if (this.resultContainer) return;

      this.playFinishAnimation(() => {
        this.showResultOverlay(players);
      });
    });

    this.renderTable(this.roundData.players);

    this.events.once("shutdown", () => {
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("hostChanged");
      socket.off("readyStatusUpdated");
      socket.off("gameStart"); // 추가
      socket.off("result");
      socket.off("updateScores");
      socket.off("recipeEnded");
      socket.off("startBlocked"); // 추가
    });
  }

  // KushiScene 클래스 내부에 추가
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

  // 1. 결과창을 보여주기 전, 종료 선언 애니메이션
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

  showOrdersDisplay(yPos) {
    const { width, height } = this.cameras.main;
    const cardW = width * 0.2;
    const cardH = height * 0.2;
    const spacing = width * 0.22;
    const startX = width / 2 - (spacing * (this.targetRecipes.length - 1)) / 2;

    this.targetRecipes.forEach((recipe, i) => {
      const x = startX + i * spacing;
      const count = recipe.length;

      this.add
        .text(x, yPos * 0.57, `주문 ${i + 1}`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.035}px`,
          color: "#ffffff",
          fontWeight: "bold",
        })
        .setDepth(5)
        .setOrigin(0.5);

      this.add
        .sprite(x, yPos + 10, "itembg") // 위치를 약간 조정
        .setDisplaySize(cardW, cardH) // 굵기를 얇게 조절
        .setAlpha(1)
        .setDepth(1);

      this.add
        .sprite(x, yPos + 15, "bar") // 위치를 약간 조정
        .setDisplaySize(cardW * 0.1, cardH * 0.8) // 굵기를 얇게 조절
        .setAlpha(0.9)
        .setDepth(1);

      recipe.forEach((ingre, j) => {
        const startY = yPos + 12 + (count - 1) * (cardH * 0.08);
        const iy = startY - j * (cardH * 0.185);
        this.add
          .sprite(x, iy, `ingre${ingre.id}`)
          .setDisplaySize(cardW * 0.5, cardW * 0.5)
          .setAngle(ingre.angle)
          .setDepth(2);
      });
    });
  }

  renderTable(players) {
    if (!players || !Array.isArray(players)) {
      //console.warn("renderTable: players 데이터가 없거나 배열이 아닙니다!");
      //return;
    }

    this.playerTableGroup.removeAll(true);

    const { width, height } = this.cameras.main;
    const myId = socket.id;

    const others = players.filter((pl) => pl.id !== myId);
    if (others.length > 3) others.length = 3;
    console.log("[DEBUG] others 수:", others.length);
    console.log(
      "others IDs:",
      others.map((p) => p.id)
    );

    const zones = [width * 0.25, width * 0.5, width * 0.75];
    const otherY = height * 0.38;

    players.forEach((p) => {
      const isMe = p.id === myId;

      // ❌ p 수정 금지
      const renderPlayer = {
        ...p,
        currentSkewer: isMe ? this.currentSkewer : p.currentSkewer || [],
        completedSkewers: isMe
          ? this.allSkewerSubmission
          : p.completedSkewers || [],
      };

      if (isMe || this.isSingle) {
        this.drawPlayerSkewers(
          renderPlayer,
          { x: width / 2, y: height * 0.57, scale: 0.95 },
          true
        );
      } else {
        const otherIdx = others.findIndex((pl) => pl.id === p.id);
        if (otherIdx < 3) {
          const panelW = width * 0.25;
          const panelH = height * 0.14;

          this.playerTableGroup.add(
            this.add
              .rectangle(
                zones[otherIdx],
                otherY,
                panelW,
                panelH,
                0xffffff,
                0.03
              )
              .setStrokeStyle(1, 0x475569, 0.5)
          );

          this.drawPlayerSkewers(
            renderPlayer,
            { x: zones[otherIdx], y: otherY, scale: 0.45 },
            false
          );
        }
      }
    });
  }

  drawPlayerSkewers(p, layout, isMe) {
    const { width, height } = this.cameras.main;
    const { x, y, scale } = layout;
    const nameColor = isMe ? "#22c55e" : "#ffffff";

    if (isMe || this.isSingle) {
      console.log(" → 내 꼬치 그리기");
      const mainStickH = height * 0.28 * scale;

      const stick = this.add
        .sprite(x, y + 30, "bar")
        .setDisplaySize(width * 0.05 * scale, mainStickH * 1.15) // 너비는 적절히 조절
        .setOrigin(0.5)
        .setDepth(101); // 재료보다 뒤에 위치시키기 위해 낮은 depth 설정

      console.log("막대기 객체 생성 완료:", stick.x, stick.y);

      this.playerTableGroup.add(stick);

      this.currentSkewer.forEach((item, j) => {
        const iy = y + mainStickH * 0.4 - j * (height * 0.06 * scale);
        const img = this.add
          .sprite(x, iy, `ingre${item.id}`)
          .setDisplaySize(width * 0.18 * scale, width * 0.18 * scale)
          .setAngle(item.angle)
          .setDepth(102); // 재료는 막대기보다 위로

        img
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", (ptr, lx, ly, ev) => {
            ev.stopPropagation();
            this.sound.play("spin", { volume: 0.2 });
            item.angle = (item.angle + 90) % 360;
            img.setAngle(item.angle);
            this.sync();

            // --- 추가: 회전할 때마다 마지막 꼬치 정답인지 체크 ---
            const currentOrderIdx = this.allSkewerSubmission.length;
            if (currentOrderIdx === this.targetRecipes.length - 1) {
              if (
                this.isSkewerCorrect(
                  this.targetRecipes[currentOrderIdx],
                  this.currentSkewer
                )
              ) {
                console.log("🎯 회전으로 마지막 정답 완성! (힌트만)");
                this.playSubmitHint(); // 효과음 코드는 여기서 삭제됨
              }
            }
          });
        this.playerTableGroup.add(img);
      });

      // 내가 완성한 것들은 왼쪽으로 나열
      if (p.completedSkewers) {
        p.completedSkewers.forEach((old, sIdx) => {
          const ox = x - width * 0.12 * (p.completedSkewers.length - sIdx);

          this.playerTableGroup.add(
            this.add
              .sprite(ox, y, "bar")
              .setDisplaySize(width * 0.04, height * 0.15)
              .setAlpha(0.9)
              .setDepth(1)
          );

          old.forEach((item, j) => {
            const iy = y + height * 0.04 - j * (height * 0.03);
            this.playerTableGroup.add(
              this.add
                .sprite(ox, iy, `ingre${item.id}`)
                .setDisplaySize(width * 0.08, width * 0.08)
                .setAngle(item.angle)
                .setAlpha(0.9)
            );
          });
        });
      }
    } else {
      // --- [상대방 UI: 패널 & 3막대 고정 시스템 유지] ---
      const stickGap = width * 0.07 * scale;
      const stickH = height * 0.25 * scale;
      console.log(" → 상대방 패널 그리기 시작");
      console.log("[DEBUG] 상대방 좌표 & 스케일", {
        x,
        y,
        scale,
        stickGap,
        stickH,
      });

      // 상대방은 누가 누구인지 알아야 하므로 이름 유지
      this.playerTableGroup.add(
        this.add
          .text(x, y - stickH * 0.65, p.nickname, {
            fontFamily: GAME_FONTS.main,
            fontSize: `${width * 0.035}px`,
            fill: nameColor,
            fontWeight: "bold",
          })
          .setOrigin(0.5)
      );

      for (let i = 0; i < 3; i++) {
        const sx = x + (i - 1) * stickGap;
        console.log(`  막대 ${i + 1} 생성 위치: sx=${sx}, y=${y}`);
        const stick = this.add
          .sprite(sx, y, "bar")
          .setDisplaySize(width * 0.03 * scale, stickH)
          .setOrigin(0.5)
          .setDepth(1);
        this.playerTableGroup.add(stick);

        let skewerData = [];
        let isAlpha = 1;

        if (p.completedSkewers && p.completedSkewers[i]) {
          skewerData = p.completedSkewers[i];
          isAlpha = 0.9;
          stick.setAlpha(0.9); // 완성된 꼬치는 막대기도 반투명하게
        } else if ((p.completedSkewers ? p.completedSkewers.length : 0) === i) {
          skewerData = p.currentSkewer || [];
          isAlpha = 1;
        }

        skewerData.forEach((item, j) => {
          const iy = y + stickH * 0.35 - j * (height * 0.045 * scale);
          const img = this.add
            .sprite(sx, iy, `ingre${item.id}`)
            .setDisplaySize(width * 0.09 * scale, width * 0.09 * scale)
            .setAngle(item.angle)
            .setAlpha(isAlpha)
            .setDepth(2);
          this.playerTableGroup.add(img);
        });
      }
    }
  }

  createInputArea(yPos) {
    const { width, height } = this.cameras.main;
    const areaH = height * 0.15;
    this.add.rectangle(width / 2, yPos, width, areaH, 0x1e293b);

    this.add
      .image(width / 2, yPos, "itembg")
      .setDisplaySize(width, height * 0.2)
      .setDepth(0) // 레이어 순서를 가장 뒤로
      .setAlpha(0.8); // 게임 화면은 집중을 위해 약간 어둡게 처리(선택사항)

    [1, 2, 3, 4, 5].forEach((id, i) => {
      const x = (width / 6) * (i + 1);

      this.add
        .circle(x, yPos, width * 0.07, 0x334155)
        .setStrokeStyle(3, COLORS.primary);

      const btn = this.add
        .sprite(x, yPos, `ingre${id}`)
        .setDisplaySize(width * 0.16, width * 0.16)
        .setInteractive();

      btn.on("pointerdown", () => {
        if (!this.isGameReady || this.isAlreadySubmitted) return;

        if (this.currentSkewer.length < 4) {
          this.sound.play("btn", { volume: 0.1 });
          this.currentSkewer.push({ id, angle: 0 });
          this.sync();

          const currentOrderIdx = this.allSkewerSubmission.length;
          const isLastRecipe =
            currentOrderIdx === this.targetRecipes.length - 1;

          if (isLastRecipe) {
            const target = this.targetRecipes[currentOrderIdx];
            // 현재 꽂힌 개수가 목표 개수와 같을 때만 검사
            if (this.currentSkewer.length === target.length) {
              if (this.isSkewerCorrect(target, this.currentSkewer)) {
                console.log("🎯 마지막 정답 일치!");
                this.playSubmitHint();
              } else {
                console.log("❌ 마지막 꼬치 진행 중 (아직 정답 아님)");
              }
            }
          }
        }
      });
    });
  }

  createControlButtons(btnY) {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const btnW = width * 0.18;
    const btnH = height * 0.055;
    const btnGap = width * 0.23;

    const btnData = [
      {
        txt: "취소",
        col: COLORS.danger,
        x: centerX - btnGap * 1.4,
        act: () => {
          if (this.currentSkewer.length === 0) return;

          this.currentSkewer.pop();
          this.sync();
        },
      },
      {
        txt: "초기화",
        col: COLORS.warning,
        x: centerX - btnGap * 0.5,
        act: () => {
          if (confirm("초기화?")) {
            this.allSkewerSubmission = [];
            this.currentSkewer = [];
            socket.emit("updateProgress", { count: 0, completedList: [] });
            this.sync();
          }
        },
      },
      {
        txt: "다음",
        col: COLORS.primary,
        x: centerX + btnGap * 0.5,
        act: () => this.handleNext(),
      },
      {
        txt: "제출",
        col: COLORS.success,
        x: centerX + btnGap * 1.4,
        act: () => this.handleSubmit(),
        isSubmit: true, // 제출 버튼임을 표시하는 플래그 추가
      },
    ];

    btnData.forEach((b) => {
      // 1. 버튼 배경 이미지 생성 및 색상 적용
      const img = this.add
        .image(b.x, btnY, "uibtn")
        .setDisplaySize(btnW, btnH)
        .setInteractive()
        .setTint(b.col);

      // 2. 버튼 텍스트 생성 (애니메이션을 위해 변수에 할당)
      const txt = this.add
        .text(b.x, btnY, b.txt, {
          fontFamily: GAME_FONTS.main,
          color: "#fff",
          fontWeight: "bold",
          fontSize: `${width * 0.035}px`,
        })
        .setOrigin(0.5);

      if (b.txt === "제출") {
        this.submitBtnImg = img;
        this.submitBtnText = txt;
      }

      // 3. 클릭 이벤트 + 연출 적용
      img.on("pointerdown", () => {
        // 게임 준비 전이거나 이미 제출했다면 무시
        if (!this.isGameReady || this.isAlreadySubmitted) return;

        // 효과음 재생
        this.sound.play("pop", { volume: 0.1 });

        // 버튼과 텍스트가 함께 눌리는 연출 (Tween)
        this.tweens.add({
          targets: [img, txt], // 이미지와 텍스트 둘 다 선택
          scaleX: "*=0.92", // 현재 크기에서 약 8% 축소
          scaleY: "*=0.92",
          duration: 50,
          yoyo: true, // 다시 원래대로
          onComplete: () => {
            // 연출이 살짝 보인 후 실제 기능 실행
            b.act();
          },
        });
      });
    });
  }

  playSubmitHint() {
    if (!this.submitBtnImg || !this.submitBtnText || this.isHintPlaying) return;
    this.isHintPlaying = true;

    const startX = this.submitBtnImg.x;

    this.tweens.add({
      targets: [this.submitBtnImg, this.submitBtnText],
      x: startX + 5, // 오른쪽으로 5px 이동
      duration: 40, // 아주 빠르게
      yoyo: true, // 다시 왼쪽으로
      repeat: 7, // 총 8번 흔들림
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.isHintPlaying = false;
        this.submitBtnImg.x = startX; // 위치 원상복구
        this.submitBtnText.x = startX;
      },
    });
  }

  handleNext() {
    const currentOrderIdx = this.allSkewerSubmission.length;

    // 마지막 주문(3번째)인데 '다음'을 누른 경우
    if (currentOrderIdx === this.targetRecipes.length - 1) {
      // 효과음 하나 재생해주고
      this.sound.play("btn", { volume: 0.1 });

      // 안내 메시지 (알럿 대신 텍스트 연출을 추천하지만, 우선 확실한 알럿으로)
      alert("마지막 꼬치입니다! 완성 후 바로 '제출' 버튼을 눌러주세요! 🍢");
      return;
    }

    // 이미 모든 주문을 리스트에 넣었는데 또 누른 경우
    if (currentOrderIdx >= this.targetRecipes.length) {
      return alert("모든 주문이 완료되었습니다. '제출'을 눌러주세요!");
    }

    if (this.currentSkewer.length === 0) return;

    // (기존 정답 확인 및 리스트 이동 로직...)
    if (
      this.isSkewerCorrect(
        this.targetRecipes[currentOrderIdx],
        this.currentSkewer
      )
    ) {
      this.playFeedback(true);
      this.allSkewerSubmission.push([...this.currentSkewer]);
      socket.emit("updateProgress", {
        count: this.allSkewerSubmission.length,
        completedList: this.allSkewerSubmission,
      });
      this.currentSkewer = [];
      this.sync();
    } else {
      this.playFeedback(false);
    }
  }

  handleSubmit() {
    if (this.isAlreadySubmitted) return;

    let final = [...this.allSkewerSubmission];
    if (this.currentSkewer.length > 0) final.push([...this.currentSkewer]);

    // 1. 개수 체크
    if (final.length < this.targetRecipes.length) {
      return alert("주문이 남았습니다!");
    }

    // 2. 마지막 꼬치 정답 여부 최종 확인
    const lastIdx = this.targetRecipes.length - 1;
    const lastTarget = this.targetRecipes[lastIdx];
    const lastSubmitted = this.currentSkewer;

    if (this.isSkewerCorrect(lastTarget, lastSubmitted)) {
      // ✅ 모든 것이 완벽할 때만 이랏샤이!
      this.time.delayedCall(300, () => {
        this.sound.play("irassai", { volume: 0.1 });
      });
      // ✅ 2. 주방장 이미지 연출 (빵! 나타나기)
      const { width, height } = this.cameras.main;
      const chef = this.add
        .image(width / 2, height / 2, "chef") // preload에 등록한 키값
        .setDepth(5000) // 최상단 레이어
        .setScale(0) // 처음엔 안보임
        .setAlpha(0);

      this.tweens.add({
        targets: chef,
        scale: 1, // 원래 크기로
        alpha: 1, // 선명하게
        duration: 300,
        ease: "Back.easeOut", // 팍! 튀어나오는 느낌
        onComplete: () => {
          // 0.8초 동안 보여줬다가 사라짐
          this.time.delayedCall(800, () => {
            this.tweens.add({
              targets: chef,
              scale: 1.5, // 커지면서
              alpha: 0, // 투명해짐
              duration: 300,
              onComplete: () => chef.destroy(),
            });
          });
        },
      });

      console.log("🎊 최종 제출 성공! 이랏샤이!");
    } else {
      // 마지막 꼬치가 틀렸다면
      this.playFeedback(false);
      return;
    }

    // 3. 분기 처리 (싱글 vs 멀티)
    this.isAlreadySubmitted = true;

    if (this.isSingle) {
      // -------------------------------------------
      // 🔹 싱글모드: 즉시 결과 화면으로 이동
      // -------------------------------------------
      // 2. 약간의 딜레이를 주어 여운을 남김 (1500ms = 1.5초)
      this.time.delayedCall(1500, () => {
        this.playFinishAnimation(() => {
          // 내 점수 업데이트 (보이지는 않지만 데이터 관리를 위해)
          this.roundData.players[0].score += 500;

          // 최종 결과창 호출
          this.showResultOverlay(this.roundData.players);
        });
      });
    } else {
      // -------------------------------------------
      // 🔹 멀티모드: 기존 서버 전송
      // -------------------------------------------
      socket.emit("submit", final);
    }
  }

  sync() {
    // 1. 싱글 모드일 때: 서버에 보내지 않고 내 화면만 즉시 갱신
    if (this.isSingle) {
      this.renderTable(this.roundData.players);
      console.log("싱글 모드: 로컬 화면 갱신 완료");
    }
    // 2. 멀티 모드일 때: 기존처럼 서버에 데이터 전송
    else {
      socket.emit("syncMySkewer", this.currentSkewer);
    }
  }

  showResultOverlay(players, isUpdate = false) {
    if (!this.roundData) return;
    if (!players || players.length === 0) return;

    const { width, height } = this.cameras.main;
    const currentHostId = this.roundData.hostId;
    const isHost = socket.id === currentHostId;

    // --- ⬇️ 컨테이너 생성 로직 최적화 ⬇️ ---
    if (this.resultContainer) {
      const prevY = this.resultContainer.y; // 현재 위치 기억
      this.resultContainer.destroy();
      // 업데이트 중이면 현재 위치(0)에, 새로 만드는 거면 화면 위(-height)에 생성
      this.resultContainer = this.add
        .container(0, isUpdate ? prevY : -height)
        .setDepth(3000);
    } else {
      this.resultContainer = this.add.container(0, -height).setDepth(3000);
    }

    const container = this.resultContainer;
    const myInfo = players.find((p) => p.id === socket.id) || null;

    const bg = this.add
      .image(width / 2, height / 2, "resultbg")
      .setDisplaySize(width * 1.2, height * 1.4);
    container.add(bg);

    players.forEach((p, i) => {
      const y = height * 0.35 + i * (height * 0.08);
      const row = this.add.container(width / 2, y);
      const isThisPlayerHost = p.id === this.roundData.hostId;
      let displayName = p.nickname;

      if (isThisPlayerHost) {
        displayName = `● ${displayName} 👑`;
      } else {
        displayName = p.isReady ? `● ${displayName}` : `○ ${displayName}`;
      }

      const rankTxt = this.add
        .text(-width * 0.2, 0, `${i + 1}위`, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: "#334155",
        })
        .setOrigin(0.5);

      const nameTxt = this.add
        .text(-width * 0.1, 0, displayName, {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.05}px`,
          fill: !isThisPlayerHost && p.isReady ? "#2ecc71" : "#0f172a",
          fontWeight: "bold",
        })
        .setOrigin(0, 0.5);

      row.add([rankTxt, nameTxt]);
      container.add(row);
    });

    const btnY = height * 0.72;
    const exitBtnY = height * 0.81;

    if (isHost || this.isSingle) {
      console.log("방장 UI 생성");

      const startBtn = this.add
        .image(width / 2, btnY, "uibtn")
        .setDisplaySize(width * 0.5, height * 0.08)
        .setTint(0xe67e22)
        .setInteractive({ useHandCursor: true });
      const startTxt = this.add
        .text(width / 2, btnY, "계속하기", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.055}px`,
          color: "#ffffff",
          fontWeight: "bold",
        })
        .setOrigin(0.5);

      startBtn.on("pointerdown", () => {
        this.sound.play("btn", { volume: 0.1 });

        // 💡 중복 클릭 방지: 시작 요청 후 버튼 비활성화
        startBtn.disableInteractive();
        startBtn.setAlpha(0.5);

        if (this.isSingle) {
          const nextData = {
            ...this.roundData,
            recipes: this.generateRandomRecipes(),
            isSingle: true,
          };
          this.scene.restart(nextData);
        } else {
          socket.emit("requestNextRecipe");
        }
      });
      container.add([startBtn, startTxt]);
    } else {
      console.log("일반 유저 UI 생성");
      // 💡 myInfo가 없을 경우 기본값 false 처리
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
        // 1. 효과음 재생
        this.sound.play("btn", { volume: 0.1 });

        // 2. 클릭 연출 (readyBtn과 그 위의 텍스트가 있다면 함께 적용)
        // 만약 텍스트 변수명이 다르다면 배열에 추가해 주세요 (예: [readyBtn, readyBtnText])
        this.tweens.add({
          targets: readyBtn,
          scaleX: "*=0.95",
          scaleY: "*=0.95",
          duration: 50,
          yoyo: true,
          onComplete: () => {
            // 3. 연출이 끝난 후 서버에 토글 신호 전송
            socket.emit("toggleReady");
            console.log("emit: toggleReady");
          },
        });
      });
      container.add([readyBtn, readyTxt]);
    }

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
      // 1. 효과음 재생
      this.sound.play("btn", { volume: 0.1 });

      // 2. 클릭 연출 (이미지와 텍스트 동시 적용)
      this.tweens.add({
        targets: [exitBtnImg, exitBtnText], // 글자도 변수명에 맞춰 함께 움직임
        scaleX: "*=0.95",
        scaleY: "*=0.95",
        duration: 50,
        yoyo: true,
        onComplete: () => {
          // 3. 연출이 끝난 후 커스텀 알림창 띄우기
          this.showCustomAlert("로비로 이동합니다!", () => {
            window.location.reload();
          });
        },
      });
    });

    container.add([exitBtnImg, exitBtnText]);

    // --- ⬇️ 애니메이션 실행 조건 ⬇️ ---
    if (!isUpdate) {
      this.tweens.add({
        targets: container,
        y: 0,
        duration: 800,
        ease: "Back.easeOut",
      });
    } else {
      container.y = 0; // 업데이트 시에는 즉시 위치 고정
    }
  }

  // KushiScene 클래스 하단 어딘가에 추가 (싱글모드용)
  generateRandomRecipes() {
    // 예시: 랜덤하게 3개의 꼬치 레시피 생성 로직
    return Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => ({
        id: Math.floor(Math.random() * 5) + 1,
        angle: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
      }))
    );
  }

  isSkewerCorrect(target, submitted) {
    if (!target || !submitted || target.length !== submitted.length)
      return false;

    const getNormAngle = (a) => {
      let angle = Math.round(a) % 360;
      if (angle < 0) angle += 360;
      return angle;
    };

    for (let i = 0; i < target.length; i++) {
      const tId = String(target[i].id);
      const sId = String(submitted[i].id);
      const tAngle = getNormAngle(target[i].angle);
      const sAngle = getNormAngle(submitted[i].angle);

      if (tId !== sId || tAngle !== sAngle) {
        return false; // 불일치 시 즉시 종료
      }
    }
    return true;
  }

  playFeedback(isSuccess) {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    if (isSuccess) {
      try {
        generateHapticFeedback({ type: "error" });
        // 또는 가벼운 느낌을 원하면 type: "impactLight"
      } catch (e) {
        console.error("Haptic feedback failed", e);
      }

      const rect = this.add
        .rectangle(centerX, centerY, width, height, 0x22c55e, 0.3)
        .setDepth(100);
      this.tweens.add({
        targets: rect,
        alpha: 0,
        duration: 500,
        onComplete: () => rect.destroy(),
      });

      this.sound.play("yosi", { volume: 0.2 });

      // 2. "GOOD!" 텍스트 추가 (새로운 코드)
      const feedbackText = this.add
        .text(centerX, centerY, "PERFECT!", {
          fontFamily: GAME_FONTS.main,
          fontSize: `${width * 0.12}px`,
          fill: "#ffffff",
          fontWeight: "bold",
          stroke: "#22c55e",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(101)
        .setScale(0); // 처음엔 크기 0

      // 3. 빵! 나타나는 애니메이션
      this.tweens.add({
        targets: feedbackText,
        scale: 1, // 원래 크기로
        y: centerY - 50, // 살짝 위로 이동
        duration: 500,
        ease: "Back.easeOut", // 튀어나오는 느낌
        onComplete: () => {
          // 잠시 머물렀다 사라짐
          this.tweens.add({
            targets: feedbackText,
            alpha: 0,
            duration: 50,
            delay: 100,
            onComplete: () => feedbackText.destroy(),
          });
        },
      });

      this.sound.play("btn", { volume: 0.1 });
    } else {
      this.sound.play("yare", { volume: 0.2 });

      const rect = this.add
        .rectangle(centerX, centerY, width, height, 0xef4444, 0.4)
        .setDepth(100);
      this.tweens.add({
        targets: rect,
        alpha: 0,
        duration: 400,
        onComplete: () => rect.destroy(),
      });
      this.cameras.main.shake(250, 0.015);
    }
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
  scene: [LobbyScene, KushiScene],
};

new Phaser.Game(config);
