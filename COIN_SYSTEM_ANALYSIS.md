# 🎮 게임 코인 지급 방식 종합 분석

## 📊 4가지 코인 지급 시스템 비교

---

## 1️⃣ **싱글 퀘스트 완료** - 코인 지급

### 📍 위치

- **함수**: `rewardQuestCoins()` (라인 911~951)
- **호출처**: 퀘스트 완료 시 LobbyScene에서 호출

### 🔄 지급 흐름

```
[퀘스트 완료]
  ↓
[rewardQuestCoins(amount, reason, questKey)]
  ↓
[서버에서 언제 코인을 주는가?]
  └─ 미제공: 클라이언트에서 먼저 로컬 업데이트
  ↓
[클라이언트에서 로컬 업데이트 여부?]
  ✅ YES - modifyCoins() 호출 (라인 924)
  ↓
[socket 이벤트 처리]
  ✅ sync=true로 emitInventory("questReward") 호출 (라인 942)
```

### 📝 코드 상세

#### 라인 911-951: rewardQuestCoins()

```javascript
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

    // ✅ 라인 924: modifyCoins로 로컬 업데이트 (sync=true)
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

    // ✅ 라인 942-945: 명시적으로 서버 동기화
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
```

### ✅ 특징

- **로컬 먼저 업데이트**: ✅ YES (modifyCoins 즉시 호출)
- **서버 응답 후 검증**: ✅ YES (emitInventory로 동기화)
- **사용 방식**: `modifyCoins()` (델타 방식)
- **특이점**: LobbyScene에서 직접 처리 (게임 진행 중 아님)

---

## 2️⃣ **싱글플레이 게임 종료** - 코인 지급

### 📍 위치

- **함수**: `showResultOverlay()` (라인 23714~24050)
- **호출처**: 게임 종료 후 GameScene에서 호출

### 🔄 지급 흐름

```
[게임 종료]
  ↓
[showResultOverlay(players, isUpdate=false)]
  ↓
[서버 finalCoins가 있는가?]
  ├─ YES: 서버값 우선 적용 (라인 23726-23733)
  │   └─ this.myProfile.coins = myData.finalCoins
  │
  └─ NO (싱글플레이): 클라이언트에서 순위 보상 계산 (라인 23737-23760)
      └─ modifyCoins(rankReward, { sync: false, reason: 'rankReward' })
  ↓
[최종 코인값 보존 및 서버 동기화]
  ✅ this._postGameFinalCoins = finalCoins (라인 23779)
  ✅ emitInventory('gameEnded') (라인 23785)
```

### 📝 코드 상세

#### 라인 23714-23795: showResultOverlay()

```javascript
showResultOverlay(players, isUpdate = false, resultData = null) {
    this.isResultOverlayActive = true;

    // 🔴 게임 종료 직후 → 현재 코인값을 즉시 서버 저장
    if (!isUpdate) {
      const currentCoins = Number(this.myProfile?.coins) || 0;

      // finalCoins가 있으면 우선 적용 (순위 보상 등)
      if (resultData && Array.isArray(resultData.ranking)) {
        const mySocketId = this.isSingle ? (this.myId || "PLAYER_ME") : (socket && socket.id);
        const myData = resultData.ranking.find(p => String(p.id) === String(mySocketId));

        // ✅ 라인 23726: 서버 finalCoins 적용
        if (myData && typeof myData.finalCoins === 'number' && myData.finalCoins >= 0) {
          console.log('[result] 서버 최종값 적용', {
            isSingle: this.isSingle,
            serverFinalCoins: myData.finalCoins,
            clientBeforeCoins: currentCoins,
            earnedCoins: myData.earnedCoins,
          });
          this.myProfile.coins = myData.finalCoins;  // 직접 수정
        }
      }

      // 🔴 [싱글플레이] finalCoins가 없으면 순위 보상을 클라이언트에서 계산
      if (this.isSingle && (!resultData || !Array.isArray(resultData.ranking))) {
        if (Array.isArray(players) && players.length > 0) {
          const myId = this.myId || "PLAYER_ME";
          const myRankIndex = players.findIndex(p => String(p.id) === String(myId));
          if (myRankIndex >= 0) {
            const baseRewardCoins = [30, 20, 10];
            const multiplier = this.roundData?.gameMultiplier || 1;
            const baseReward = baseRewardCoins[myRankIndex] || 0;
            const rankReward = Math.floor(baseReward * multiplier);

            if (rankReward > 0) {
              const beforeCoins = Number(this.myProfile?.coins) || 0;
              console.log('[result] 싱글플레이 순위 보상 추가', {
                myRankIndex: myRankIndex + 1,
                baseReward,
                multiplier,
                rankReward,
                beforeCoins: beforeCoins,
              });

              // ✅ 라인 23758: modifyCoins로 업데이트 (sync=false)
              this.modifyCoins(rankReward, { sync: false, reason: 'rankReward' });

              console.log('[result] 순위 보상 적용 완료', {
                afterCoins: this.myProfile.coins,
                delta: this.myProfile.coins - beforeCoins
              });
            }
          }
        }
      }

      // 현재 코인값을 즉시 저장
      const finalCoins = Number(this.myProfile?.coins) || 0;
      console.log('[result] 게임 종료 → 코인 저장', {
        isSingle: this.isSingle,
        finalCoins: finalCoins,
        timestamp: new Date().toISOString()
      });

      // ✅ 라인 23779: 게임 결과 최종 코인 보존
      this._postGameFinalCoins = finalCoins;
      console.log('[result] 게임 결과 최종 코인 보존', {
        finalCoins,
        isSingle: this.isSingle,
        timestamp: new Date().toISOString()
      });

      // ✅ 라인 23785: 서버 동기화
      try {
        if (typeof this.emitInventory === 'function') {
          this.emitInventory('gameEnded', { requireServerProfile: false });
        }
      } catch (e) {
        console.warn('[result] 저장 실패', e);
      }
    }

    // ... 결과 UI 렌더링 ...
  }
```

### ✅ 특징

- **로컬 먼저 업데이트**: ✅ YES
  - 멀티: 서버 `finalCoins` 직접 수정 (라인 23733)
  - 싱글: `modifyCoins()` 호출 (라인 23758)
- **서버 응답 후 검증**: ✅ YES (emitInventory로 확인)
- **사용 방식**:
  - 싱글: `modifyCoins()` (델타)
  - 멀티: 직접 수정 (절대값)
- **보존**: `_postGameFinalCoins` 변수에 저장 (로비 복귀 시 복원용)

---

## 3️⃣ **싱글플레이 광고보상** - 코인 지급

### 📍 위치

- **함수**: `applyAdReward()` (라인 24304~24380)
- **호출처**: 결과 화면에서 "광고보상" 버튼 클릭 시

### 🔄 지급 흐름

```
[광고보상 버튼 클릭]
  ↓
[showFullScreenAd() 호출 (라인 24295)]
  ↓
[광고 종료 이벤트 감지]
  └─ event.type = "closed" | "completed" | "dismissed" (라인 24310)
  ↓
[applyAdReward() 호출 (라인 24315)]
  ↓
[✅ 로컬 업데이트 - 직접 수정 방식]
  ├─ this.myProfile.coins = newCoins (라인 24323)
  ├─ this.updateMyProfileUI(this.myProfile) (라인 24324)
  └─ localStorage.setItem("profileCoins", String(newCoins)) (라인 24327)
  ↓
[✅ 서버 동기화]
  └─ this.emitInventory("adReward", {...}) (라인 24329)
```

### 📝 코드 상세

#### 라인 24260-24370: 광고보상 흐름

```javascript
// 광고보상 버튼 클릭
this.sound.play("btn", { volume: 0.4 });
console.log("[result] 광고보상 버튼 클릭 - 보상 광고 시청");

const adGroupId = getAdGroupId();
if (!adGroupId) {
  if (typeof this.showToast === "function") {
    this.showToast("광고를 불러올 수 없습니다.", "#e74c3c");
  }
  setResultAdDebug("광고 groupId를 찾을 수 없습니다.");
  return;
}

// ✅ 라인 24295: showFullScreenAd 호출
setResultAdDebug("광고 재생 시도");
showFullScreenAd({
  options: { adGroupId },
  onEvent: (event) => {
    console.log("[ad] 광고 이벤트:", event.type);
    setResultAdDebug(`광고 이벤트: ${event.type}`);

    // ✅ 라인 24310: 광고 종료 이벤트 감지
    if (
      event.type === "closed" ||
      event.type === "completed" ||
      event.type === "dismissed"
    ) {
      this.time.delayedCall(500, () => {
        applyAdReward(); // ✅ 라인 24315
      });
    }
  },
  onError: (error) => {
    console.warn("[ad] 광고 오류:", error);
    setResultAdDebug(`광고 오류: ${error?.message || String(error)}`);
    if (typeof this.showToast === "function") {
      this.showToast("광고 재생 중 오류가 발생했습니다.", "#e74c3c");
    }
  },
});

// ✅ applyAdReward() 함수
const applyAdReward = () => {
  adRewardWatched = true;

  // 기존 코인 가져오기
  const currentCoins = Number(this.myProfile?.coins) || 0;

  // 순위 보상 계산
  const baseRankRewardCoins = [30, 20, 10];
  const multiplier = this.roundData?.gameMultiplier || 1;
  let totalRankReward = 0;

  rankedPlayers.forEach((_, idx) => {
    const baseReward = baseRankRewardCoins[idx] || 0;
    totalRankReward += baseReward * multiplier;
  });

  // 광고 보상: 순위 보상의 5배
  const adReward = Math.floor(totalRankReward * 5);
  const newCoins = currentCoins + adReward;

  console.log("[result] 광고보상 적용", {
    currentCoins,
    totalRankReward,
    adReward,
    newCoins,
  });
  setResultAdDebug(`광고 보상 적용: ${adReward} 코인 (총 ${newCoins})`);

  // ✅ 라인 24323: 직접 코인 업데이트 (setCoinsAbsolute 미사용)
  this.myProfile.coins = newCoins;

  // ✅ 라인 24324: UI 즉시 업데이트
  this.updateMyProfileUI(this.myProfile);

  // 광고보상 토스트
  if (typeof this.showToast === "function") {
    this.showToast(`🎉 광고보상 ${adReward} 코인 획득!`, "#FFD700");
  }

  // 광고보상 버튼 상태 업데이트
  updateResultAdButtonState();

  // ✅ 라인 24327-24330: 서버 동기화
  try {
    localStorage.setItem("profileCoins", String(newCoins));
    if (typeof this.emitInventory === "function") {
      this.emitInventory("adReward", {
        adReward,
        newCoins,
        totalRankReward,
      });
    }
  } catch (e) {
    console.warn("[result] 광고보상 동기화 실패", e);
  }

  // 다음 라운드 광고 사전 로드
  // ...
};
```

### ✅ 특징

- **로컬 먼저 업데이트**: ✅ YES (라인 24323 - 직접 수정)
- **서버 응답 후 검증**: ✅ YES (라인 24329 - emitInventory)
- **사용 방식**: `this.myProfile.coins = newCoins` (직접 수정, setCoinsAbsolute 미사용)
- **특이점**:
  - GameScene에서 처리 (결과 화면에서만)
  - `setCoinsAbsolute()` 미사용 (직접 수정)
  - `modifyCoins()` 미사용 (델타 아님, 절대값 직접 설정)
  - localStorage에 저장

---

## 4️⃣ **멀티플레이 우승 보상** - 코인 지급

### 📍 위치

- **socket 이벤트**: `socket.on("myProfile")` (라인 13982~14060)
- **처리 시점**: 게임 진행 중 또는 게임 종료 후

### 🔄 지급 흐름

```
[멀티플레이 게임 진행]
  ↓
[서버에서 우승 판정 및 순위 보상 계산]
  ↓
[socket.emit("myProfile", profile) 전송]
  ↓
[클라이언트 socket.on("myProfile") 수신 (라인 13982)]
  ↓
[🔴 중요: 게임 진행 중인가?]
  ├─ YES (진행 중): 로컬 코인이 더 높으면 유지 (라인 14011-14016)
  │   └─ if (localCoins > safeCoins) { finalCoins = localCoins }
  │
  └─ NO (게임 종료): 서버값 적용
      └─ finalCoins = safeCoins
  ↓
[✅ 절대값 수정 - 로컬 먼저]
  └─ this.myProfile.coins = finalCoins (라인 14022)
  ↓
[✅ UI 업데이트]
  └─ updateMyProfileUI() (라인 14043)
```

### 📝 코드 상세

#### 라인 13982-14060: socket.on("myProfile")

```javascript
socket.off("myProfile").on("myProfile", (profile) => {
  try {
    console.log("[socket.myProfile] received", profile);
  } catch (e) {}

  // 🔴 [일관성] profileStats는 사용하지 않고, myProfile로만 관리
  const prevStats = {
    level: 1,
    coins: Number(this.myProfile?.coins) || 0,
    experience: 0,
  };
  const prevLevel = Number(prevStats.level) || 1;
  const incomingLevel = Number(profile?.level);
  const incomingCoins = Number(profile?.coins);
  const incomingExperience = Number(profile?.experience);

  const newLevel = Number.isFinite(incomingLevel) ? incomingLevel : prevLevel;
  const safeCoins = Number.isFinite(incomingCoins)
    ? incomingCoins
    : Number(this.myProfile?.coins) || 0;
  const safeExperience = Number.isFinite(incomingExperience)
    ? incomingExperience
    : 0;

  // 🔴 [중요] 게임 진행 중에는 로컬 코인이 더 높으면 유지
  let finalCoins = safeCoins;
  if (this.isGameStarted && !this.isGameEnded && !this.isResultOverlayActive) {
    const localCoins = Number(this.myProfile?.coins) || 0;
    // ✅ 라인 14015: 진행 중이면 로컬값이 더 높으면 유지
    if (localCoins > safeCoins) {
      finalCoins = localCoins;
    }
  }

  // 🔴 [일관성] myProfile에 새 값 할당
  this.myProfile = this.myProfile || {};
  this.myProfile.level = newLevel;
  // ✅ 라인 14022: 절대값으로 수정 (setCoinsAbsolute 미사용)
  this.myProfile.coins = finalCoins;
  this.myProfile.experience = safeExperience;

  // 이전 profileStats도 최신 상태로 유지 (레거시 코드용)
  this.profileStats = {
    level: newLevel,
    coins: finalCoins,
    experience: safeExperience,
  };

  // make sure the game-scene profile UI also reflects the full profile
  if (typeof this.updateMyProfileUI === "function") {
    // If server only sent a coin update (common for single-player end flows),
    // treat it as a delta instead of overwriting the entire profile.coins.
    const hasOnlyCoins =
      typeof profile.coins !== "undefined" &&
      typeof profile.level === "undefined" &&
      typeof profile.experience === "undefined" &&
      (Object.keys(profile).length === 1 ||
        (Object.keys(profile).length === 2 && profile.coins !== undefined));

    if (hasOnlyCoins && this.isSingle) {
      const coinDelta = Number(profile.coins) || 0;
      if (this.isGameEnded || this.isResultOverlayActive) {
        // defer coin delta until after result overlay
        this._deferredCoinsDelta = (this._deferredCoinsDelta || 0) + coinDelta;
        console.debug("socket.myProfile: deferred coin delta (single)", {
          coinDelta,
          deferred: this._deferredCoinsDelta,
        });
      } else {
        // apply immediately as a delta (do not emit back to server)
        try {
          // ✅ 라인 14051: modifyCoins로 업데이트 (sync=false, coinCardUpdate=true)
          this.modifyCoins(Number(0 - price) || -price, { sync: true });
        } catch (e) {
          console.warn("socket.myProfile: modifyCoins failed", e);
        }
      }
    } else {
      // ✅ 라인 14043: 전체 프로필 업데이트
      if (typeof this.updateMyProfileUI === "function") {
        this._allowCoinTextUpdateForNextUI =
          coinCardUpdate || this._allowCoinTextUpdateForNextUI;
        this.updateMyProfileUI();
        this._allowCoinTextUpdateForNextUI = false;
      }
    }
  }
});
```

### ✅ 특징

- **로컬 먼저 업데이트**: ✅ YES (라인 14022 - 직접 수정)
- **서버 응답 후 검증**: ✅ YES (서버에서 보낸 값이 authoritative)
- **사용 방식**:
  - 절대값 직접 수정: `this.myProfile.coins = finalCoins` (라인 14022)
  - setCoinsAbsolute 미사용
  - modifyCoins 미사용
- **특이점**:
  - 게임 진행 중: 로컬값이 더 높으면 유지 (충돌 방지)
  - 게임 종료 후: 서버값 적용 (authoritative)

---

## 📋 4가지 시스템 비교 요약

| 항목                 | 싱글 퀘스트     | 싱글 게임 종료             | 광고보상    | 멀티 우승보상 |
| -------------------- | --------------- | -------------------------- | ----------- | ------------- |
| **라인**             | 911~951         | 23714~23795                | 24260~24370 | 13982~14060   |
| **씬**               | LobbyScene      | GameScene                  | GameScene   | GameScene     |
| **로컬 먼저**        | ✅ YES          | ✅ YES                     | ✅ YES      | ✅ YES        |
| **서버 동기화**      | ✅ YES          | ✅ YES                     | ✅ YES      | ✅ YES        |
| **사용 방식**        | `modifyCoins()` | `modifyCoins()` / 직접수정 | 직접수정    | 직접수정      |
| **함수**             | modifyCoins     | modifyCoins / 직접         | 직접        | 직접          |
| **setCoinsAbsolute** | ❌ 미사용       | ❌ 미사용                  | ❌ 미사용   | ❌ 미사용     |
| **절대값 vs 델타**   | 델타            | 델타/절대값                | 절대값      | 절대값        |
| **localStorage**     | ❌ 아니오       | ❌ 아니오                  | ✅ 예       | ❌ 아니오     |

---

## 🚨 동기화 위험 요소 분석

### 1️⃣ **출석체크 광고보상과의 불일치**

- ✅ 결과 화면 광고보상: LobbyScene `adReward` 리스너 없음
- ❌ 출석체크 광고보상: LobbyScene에 리스너가 필요하지만 없음 (라인 13098은 GameScene)
- **영향**: 출석체크 광고보상이 UI에 반영되지 않음

### 2️⃣ **singPlayAuto 저장과의 불일치**

- ✅ 광고보상: `localStorage.setItem("profileCoins")` 호출 (라인 24327)
- ❌ 다른 시스템: localStorage에 저장하지 않음 (라인 12094 코멘트)
- **영향**: 페이지 새로고침 시 광고보상만 유지됨

### 3️⃣ **setCoinsAbsolute 미사용**

- `setCoinsAbsolute()` (라인 12140)는 정의되어 있지만 **어디서도 호출되지 않음**
- 대신 모든 곳에서 직접 수정: `this.myProfile.coins = value`
- **영향**: setCoinsAbsolute의 디버깅 로깅이 작동하지 않음

### 4️⃣ **멀티 결과 코인 처리**

- 멀티 게임 종료 시 `finalCoins`가 있으면 우선 적용 (라인 23726)
- 하지만 멀티에서는 항상 서버에서 `finalCoins`를 보내므로 싱글만 주의
- **영향**: 싱글플레이에서 서버 응답 지연 시 로컬값 사용

---

## 🔴 출석체크와의 일관성 검토

### 출석체크 광고보상 (index.js 라인 2492~2530)

```javascript
socket.on("claimAdReward", async (data) => {
  const adRewardCoins = 100;
  const previousCoins = socket.coins || 0;
  socket.coins = previousCoins + adRewardCoins;  // 서버 메모리 업데이트

  savePlayer(..., socket.coins, ...)  // DB 저장

  socket.emit("adReward", {
    amount: adRewardCoins,
    totalCoins: socket.coins
  })  // 클라이언트에 응답
})
```

### 클라이언트 응답 처리 (game.js 라인 13098)

```javascript
socket.off("adReward").on("adReward", (data) => {
  if (typeof gameScene.setCoinsAbsolute === "function") {
    gameScene.setCoinsAbsolute(data.totalCoins, { sync: false });
  }
});
```

### ❌ 문제점

1. **리스너 위치**: GameScene create()에만 등록 (LobbyScene에 없음)
2. **출석체크는 LobbyScene에서 실행**: 라인 10763 applyDailyAdReward()
3. **결과**: 서버에서 보낸 `adReward` 이벤트를 받아도 LobbyScene에서 처리 안 됨

---

## ✅ 권장 개선안

### 1. LobbyScene에도 adReward 리스너 추가

```javascript
socket.off("adReward").on("adReward", (data) => {
  if (typeof this.setCoinsAbsolute === "function") {
    this.setCoinsAbsolute(data.totalCoins, { sync: false });
  }
});
```

### 2. setCoinsAbsolute 실제 사용 검토

- 현재 정의만 되어 있고 호출되지 않음
- 모든 절대값 수정을 `setCoinsAbsolute()`로 통일하거나 제거

### 3. localStorage 정책 통일

- 광고보상만 localStorage 저장 중
- 서버-클라이언트 일관성을 위해 localStorage 사용 최소화

### 4. modifyCoins() vs 직접수정 정책

- 델타: `modifyCoins(delta, {sync:true})`
- 절대값: `setCoinsAbsolute(value, {sync:true})`로 통일
- 현재는 섞여 있음 (일부는 직접 수정)

---

## 📊 코인 흐름도

```
[코인 지급 발생]
├─ 싱글 퀘스트 완료
│  └─ rewardQuestCoins()
│     ├─ modifyCoins(delta, {sync:true})
│     └─ emitInventory("questReward")
│
├─ 싱글 게임 종료 (순위 보상)
│  └─ showResultOverlay()
│     ├─ this.modifyCoins(rankReward, {sync:false}) [싱글]
│     ├─ this.myProfile.coins = finalCoins [멀티]
│     └─ emitInventory('gameEnded')
│
├─ 광고보상 (결과 화면)
│  └─ applyAdReward()
│     ├─ this.myProfile.coins = newCoins [직접 수정]
│     ├─ this.updateMyProfileUI()
│     ├─ localStorage.setItem("profileCoins")
│     └─ emitInventory("adReward")
│
└─ 멀티 우승보상
   └─ socket.on("myProfile")
      ├─ this.myProfile.coins = finalCoins [직접 수정]
      └─ updateMyProfileUI()
         └─ [선택적] modifyCoins(delta) [싱글 일부만]
```

---

## 🎯 결론

### 현황

1. **로컬 먼저 업데이트**: 모든 시스템이 로컬에서 먼저 업데이트
2. **서버 동기화**: 모두 서버로 동기화 (신뢰성 확보)
3. **사용 방식 불일치**:
   - 싱글 퀘스트: `modifyCoins()`
   - 싱글 게임 종료: `modifyCoins()` + 직접수정
   - 광고보상: 직접수정
   - 멀티: 직접수정

### 위험요소

1. 출석체크 광고보상이 LobbyScene에서 반영 안 됨
2. localStorage 정책 불일치
3. setCoinsAbsolute() 미사용 (데드코드)

### 해결필요

1. LobbyScene에 adReward 리스너 추가
2. 절대값/델타 업데이트 방식 통일
3. localStorage 사용 정책 명확화
