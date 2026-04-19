# game.js 일반 일일 보상 vs 광고 보상 차이 분석

## 📋 전체 비교 요약

| 항목              | 일반 일일 보상               | 광고 보상                    |
| ----------------- | ---------------------------- | ---------------------------- |
| **UI 진입**       | 메인 "출석체크" 버튼         | 메인 "출석체크" 버튼         |
| **팝업 표시**     | showWeeklyRewardPopup()      | showWeeklyRewardPopup()      |
| **선택 방식**     | 요일 셀 클릭 (canClaim=true) | 요일 셀 클릭 (isVideo=true)  |
| **광고 필요**     | ❌ 없음                      | ✅ 필수                      |
| **광고 로드**     | N/A                          | loadFullScreenAd()           |
| **광고 재생**     | N/A                          | showFullScreenAd()           |
| **서버 요청**     | ❓ 누락됨                    | socket.emit("claimAdReward") |
| **서버 응답**     | socket.on("dailyReward")     | ❓ 미처리됨                  |
| **코인 업데이트** | setCoinsAbsolute() 호출      | UI 업데이트 없음 ⚠️          |
| **UI 반영**       | 즉시 반영                    | **업데이트 안 됨**           |
| **스탠프 표시**   | 서버 응답 후                 | UI 예정인데 미구현           |

---

## 1️⃣ 일반 일일 보상 처리 흐름

### 1.1 팝업 열기 (라인 3767)

```javascript
dailyRewardBtnBg.on("pointerdown", () => {
  if (Date.now() < this.disableDailyRewardBtnUntil) return;
  this.showWeeklyRewardPopup(); // ← 팝업 열기
});
```

### 1.2 팝업 UI 구성 (라인 10483~10720)

- 요일별 셀 생성
- canClaim=true: 클레임 가능 (클릭 가능)
- isVideo=false: 일반 보상
- 코인 아이콘 + 보상 금액 표시

```javascript
const rewardAmount = isVideo ? 100 : this.dailyRewardAmount;
coinNum = this.add.text(rowX, rowY + rowHeight * 0.45, `${rewardAmount}`, ...)
```

### 1.3 행(셀) 클릭 핸들러 (라인 10722)

```javascript
if (canClaim || isVideo) {
  const scene = this;
  rowBg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
    if (isVideo) {
      // 광고 보상 처리 (라인 10726~11015)
      ...
      return;  // ← 광고만 처리됨
    }
    // ❌ 일반 보상 처리는 HERE 본래 있어야 함 (라인 11016~)
    // 현재 코드는 미완성으로 보임
  });
}
```

### 1.4 ⚠️ 문제점: 일반 보상 요청 코드 누락

**일반 보상 클릭 후 서버 요청 코드가 찾을 수 없음!**

- "claimDailyReward" 검색 → 주석에만 나타남 (라인 10776)
- socket.emit() 호출이 없음
- 추정: 코드 개발 중에 미완성 상태로 남겨짐

### 1.5 서버 응답 처리 (라인 3230~3265)

```javascript
socket.off("dailyReward").on("dailyReward", (payload) => {
  const amount = Number(payload && payload.amount) || 0;
  if (amount <= 0) return;

  // ✅ 코인 UI 즉시 업데이트
  if (this.myProfile) {
    if (Number.isFinite(Number(payload.totalCoins))) {
      this.setCoinsAbsolute(Number(payload.totalCoins), { sync: false }); // ← 핵심
    } else {
      this.updateMyProfileUI();
    }
  }

  // UI 텍스트 업데이트
  if (this.shopCoinText && this.myProfile) {
    this.shopCoinText.setText(`💰 ${this.myProfile.coins}`);
  }
  if (this.coinShopCurrentCoinText && this.myProfile) {
    this.coinShopCurrentCoinText.setText(
      `현재 보유: 💰 ${this.myProfile.coins}`,
    );
  }

  // 상태 초기화
  this.dailyRewardAvailable = false;
  this.isDailyRewardClaimPending = false;

  // 마크 설정
  if (payload && payload.date) {
    this.markDailyRewardClaimed(payload.date);
  }

  // 버튼 상태 업데이트
  this.updateDailyRewardButtonState();
});
```

### 1.6 setCoinsAbsolute() 함수 (라인 756~800)

```javascript
setCoinsAbsolute(total, options = {}) {
  try {
    const next = Number.isFinite(Number(total)) ? Number(total) : null;
    if (next === null) return null;

    // 1. myProfile 업데이트
    if (!this.myProfile || typeof this.myProfile !== "object") {
      this.myProfile = { level: 1, coins: 0, experience: 0 };
    }
    this.myProfile.coins = next;  // ← 코인 절대값 설정

    // 2. UI 업데이트
    if (typeof this.updateMyProfileUI === "function") {
      this.updateMyProfileUI();  // ← 즉시 UI 반영
    } else {
      if (this.shopCoinText && typeof this.shopCoinText.setText === "function") {
        this.shopCoinText.setText(`💰 ${next}`);  // ← 직접 업데이트
      }
      if (this.coinShopCurrentCoinText && typeof this.coinShopCurrentCoinText.setText === "function") {
        this.coinShopCurrentCoinText.setText(`현재 보유: 💰 ${next}`);  // ← 직접 업데이트
      }
    }

    // 3. 동기화 (선택)
    if (options.sync && typeof this.safeSyncInventory === "function") {
      this.safeSyncInventory("setCoinsAbsolute", { coins: next, sync: true });
    }
    return next;
  } catch (e) {
    console.warn("setCoinsAbsolute failed", e);
    return null;
  }
}
```

### 1.7 일반 보상 UI 업데이트 과정

1. 서버에서 "dailyReward" 이벤트 발신
2. socket.on("dailyReward") 수신
3. **setCoinsAbsolute() 호출** → myProfile.coins 업데이트
4. **updateMyProfileUI() 호출** → 모든 UI 요소 갱신
5. **shopCoinText.setText()** → 상점 코인 표시 업데이트
6. **coinShopCurrentCoinText.setText()** → 코인 구매 UI 업데이트

### ✅ 일반 보상 처리 방식

- **타이밍**: 서버 응답 후 즉시
- **업데이트 대상**: myProfile, shopCoinText, coinShopCurrentCoinText
- **UI 반영**: 지연 없이 즉시 반영 ✅

---

## 2️⃣ 광고 보상 처리 흐름

### 2.1 팝업에서 광고 보상 행 준비 (라인 10662)

```javascript
const rewardAmount = isVideo ? 100 : this.dailyRewardAmount; // isVideo=true인 경우 100 고정
```

### 2.2 광고 보상 행 클릭 (라인 10722~10726)

```javascript
rowBg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
  if (isVideo) {
    // ← 여기부터 광고 보상 처리 시작 (라인 10726~11015)
    scene.sound.play("btn", { volume: 0.4 });
```

### 2.3 광고 로드/재생 파이프라인 (라인 10726~11012)

#### 2.3.1 광고 그룹 ID 확인

```javascript
const getAdGroupId = () => {
  return (
    window.__INTEGRATED_AD_GROUP_ID ||
    localStorage.getItem("integratedAdGroupId") ||
    "ait-ad-test-interstitial-id"
  );
};
```

#### 2.3.2 광고 지원 여부 확인

```javascript
const canUseAd = () => {
  if (!loadFullScreenAd || !showFullScreenAd) return false;
  return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
};
```

#### 2.3.3 광고 상태 확인

```javascript
const isGameAdLoaded =
  scene.registry.get("gameAdLoaded") || scene.isGameAdLoaded;
const isGameAdLoading =
  scene.registry.get("gameAdLoading") || scene.isGameAdLoading;

// 상태 3가지:
// 1. 이미 로드됨 → 바로 재생 (라인 10920)
// 2. 로드 중 → 대기 (라인 10971)
// 3. 아직 안 함 → 로드 시작 (라인 10976)
```

#### 2.3.4 광고가 이미 로드된 경우 (라인 10920)

```javascript
if (isGameAdLoaded) {
  scene.isDailyRewardClaimPending = true;
  scene.registry.set("gameAdShowing", true);

  scene.unregisterShowAd = showFullStreamAd({
    options: { adGroupId },
    onEvent: (event) => {
      if (event.type === "closed" || event.type === "completed" || ...) {
        scene.registry.set("gameAdShowing", false);
        scene.showToast("📺 광고 종료됨! 보상 처리 중...", "#38bdf8");

        // ⏱️ 500ms 지연 후 보상 처리
        scene.time.delayedCall(500, () => {
          applyDailyAdReward();  // ← 보상 처리 함수 호출
        });
      }
    },
    onError: (error) => {...}
  });
  return;
}
```

#### 2.3.5 광고가 없는 경우 - 로드 시작 (라인 10976)

```javascript
scene.isGameAdLoading = true;
scene.registry.set("gameAdLoading", true);

scene.unregisterGameAd = loadFullScreenAd({
  options: { adGroupId: adGroupId_attendance },
  onEvent: (event) => {
    if (event.type === "loaded") {
      console.log("[daily-ad] ✅ 광고 로드 완료");
      scene.isGameAdLoaded = true;
      scene.isGameAdLoading = false;
      scene.registry.set("gameAdLoaded", true);
      scene.registry.set("gameAdLoading", false);
      scene.showToast("광고 준비 완료! 다시 클릭하면 재생됩니다.", "#FFD700");
    }
  },
  onError: (error) => {
    scene.showToast("광고 준비 실패", "#e74c3c");
    scene.isGameAdLoading = false;
    scene.registry.set("gameAdLoading", false);
  },
});
return; // ← 광고 로드 후 재시도 대기
```

### 2.4 보상 처리 함수 applyDailyAdReward() (라인 10753~10883)

#### 2.4.1 함수 시작

```javascript
const applyDailyAdReward = () => {
  try {
    console.log('[daily-ad] ========== 보상 시작 ==========');
    scene.showToast("🎁 보상 처리 시작...", "#3498db");
```

#### 2.4.2 ✅ 서버 요청 (라인 10786)

```javascript
// 광고 보상을 서버에 요청
console.log("[daily-ad] 서버에 광고 보상 요청 - claimDailyReward 이미트");

socket.emit("claimAdReward"); // ← 광고 보상 이벤트 전송
console.log('[daily-ad] ✅ socket.emit("claimAdReward") 호출');
scene.showToast("✅ 서버 요청 완료!", "#27ae60");
```

#### 2.4.3 UI 이펙트 (라인 10793~10830)

```javascript
// 1. 코인 폭발 이펙트
showCoinBurstEffect(scene, rowX, rowY, 100);

// 2. "획득" 스탠프 표시
const stamp = scene.add.text(rowX, rowY, "획득", {...})
  .setOrigin(0.5).setDepth(4004).setScale(0);
stamp.setRotation(-0.3);
scene.tweens.add({
  targets: stamp,
  scale: 1,
  duration: 450,
  ease: "Back.out"
});

// 3. 토스트 표시
scene.showToast(`🎉 광고보상 100 코인 획득!`, "#FFD700");
```

#### 2.4.4 상태 초기화 (라인 10835~10849)

```javascript
scene.isGameAdLoaded = false;
scene.isGameAdShowing = false;
scene.isGameAdLoading = false;
scene.isDailyRewardClaimPending = false;
scene.registry.set("gameAdLoaded", false);
scene.registry.set("gameAdShowing", false);
scene.registry.set("gameAdLoading", false);
```

### 2.5 ⚠️ 문제점: 광고 보상의 서버 응답 처리 없음

**socket.emit("claimAdReward") 후 응답 처리가 없음!**

- socket.on("adRewardSuccess") 또는 유사한 리스너가 없음
- 서버에서 "dailyReward" 이벤트를 발신해도 UI가 업데이트되지 않음
- 광고 후 500ms 지연만 있고, 서버 응답 대기 없음

### ❌ 광고 보상 UI 업데이트 문제

1. socket.emit("claimAdReward") 전송
2. **UI는 로컬에서만 업데이트됨**
   - 코인 폭발 이펙트 표시
   - 스탠프 표시
   - 토스트 표시
3. **myProfile.coins는 업데이트 안 됨** ⚠️
4. **shopCoinText는 업데이트 안 됨** ⚠️
5. 서버에서 "dailyReward" 이벤트를 보내도 클라이언트에서 수신 안 함

---

## 📊 두 보상의 핵심 차이

### 코인 UI 업데이트 방식

#### ✅ 일반 일일 보상

```
서버 요청 → socket.emit() [예상]
                ↓
         서버 처리
                ↓
         socket.on("dailyReward")  ← 서버 응답
                ↓
         setCoinsAbsolute() 호출
                ↓
         myProfile.coins 업데이트
                ↓
         updateMyProfileUI() 호출
                ↓
         모든 코인 텍스트 업데이트 ✅
```

#### ❌ 광고 보상

```
광고 재생 (500ms 지연)
         ↓
socket.emit("claimAdReward")  ← 요청 전송
         ↓
서버 처리 (응답 대기 안 함)
         ↓
로컬 UI 업데이트만 수행
  - 코인 폭발 이펙트
  - 스탠프
  - 토스트
         ↓
myProfile.coins 업데이트 안 됨 ⚠️
shopCoinText 업데이트 안 됨 ⚠️
```

---

## 🔧 수정이 필요한 부분

### 1. 일반 일일 보상

- **라인 11016 이후**: 서버 요청 코드 필요
  ```javascript
  } else {  // 일반 보상
    scene.sound.play("btn", { volume: 0.4 });

    // 서버에 보상 요청
    socket.emit("claimDailyReward");  // ← 추가 필요

    scene.isDailyRewardClaimPending = true;
    scene.showToast("💳 서버 요청 중...", "#3498db");
    // 나머지 처리는 socket.on("dailyReward")에서 수행
  }
  ```

### 2. 광고 보상

- **라인 10786 이후**: socket.on("adRewardSuccess") 또는 유사한 리스너 필요

  ```javascript
  socket.emit("claimAdReward");

  // 서버 응답 처리 필요
  socket.once("adRewardSuccess", (payload) => {
    if (this.myProfile) {
      this.setCoinsAbsolute(Number(payload.totalCoins), { sync: false });
    }
    // UI 업데이트...
  });
  ```

### 3. 또는 통일된 방식으로

- 광고 보상도 일반 보상과 동일하게 "dailyReward" 이벤트 사용
- socket.emit("claimAdReward") 대신 socket.emit("claimDailyReward", { isAdReward: true })

---

## 📝 결론

| 측면                       | 상태                             |
| -------------------------- | -------------------------------- |
| 일반 일일 보상 서버 요청   | ❓ 미구현 (코드 누락)            |
| 일반 일일 보상 UI 업데이트 | ✅ setCoinsAbsolute() 호출됨     |
| 광고 보상 서버 요청        | ✅ socket.emit("claimAdReward")  |
| 광고 보상 UI 업데이트      | ❌ 미구현 (myProfile 미업데이트) |

**핵심 문제**: 광고 보상 후 서버 응답이 클라이언트 UI(myProfile.coins)에 반영되지 않음
