class X {playCardFlipAnimation(data) {
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
    this.tweens.add({
      targets: tempCard,
      x: startPos.x + Math.cos(rad) * dist * 0.7 + targetOffsetX,
      y: startPos.y + Math.sin(rad) * dist + targetOffsetY,
      duration: 300,
      ease: "Cubic.out",
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

        tempCard.destroy();

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

                // Ensure the table is updated immediately so the card doesn't flash
                // in/out by waiting for the next render tick.
                this.renderTable(this.roundData.players);
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
            }
          }
        }

        // In singleplayer, allow another flip animation after this one finishes.
        if (this.isSingle && data.playerId && this._singleFlipInProgress) {
          delete this._singleFlipInProgress[data.playerId];
        }

        // 마지막으로 전체(새 카드 포함) 렌더링
        this.renderTable(this.roundData.players);
      },
    });
  }}
