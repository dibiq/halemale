const puppeteer = require("puppeteer");

(async () => {
  const serverUrl = "http://localhost:5173";
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();

  pageA.on("console", (msg) => console.log("A>", msg.text()));
  pageB.on("console", (msg) => console.log("B>", msg.text()));
  const logsA = [];
  const logsB = [];
  pageA.on("console", (msg) => logsA.push(msg.text()));
  pageB.on("console", (msg) => logsB.push(msg.text()));

  await pageA.goto(serverUrl, { waitUntil: "networkidle2" });
  await pageB.goto(serverUrl, { waitUntil: "networkidle2" });

  // wait for game to initialize
  await new Promise((r) => setTimeout(r, 1500));

  // run scenario in page context: set nicknames and perform actions via socket
  const setupScript = `(() => {
    return new Promise((resolve) => {
      // socket is created in game.js as 'socket' variable global
      const waitForSocket = () => {
        if (window.socket && window.socket.connected) return resolve(true);
        setTimeout(waitForSocket, 200);
      };
      waitForSocket();
    });
  })()`;

  await pageA.evaluate(setupScript);
  await pageB.evaluate(setupScript);

  // set nicknames
  await pageA.evaluate(() => {
    socket.emit("setNickname", { nickname: "PuppetHost" });
  });
  await pageB.evaluate(() => {
    socket.emit("setNickname", { nickname: "PuppetGuest" });
  });

  // Host create room
  const roomId = await pageA.evaluate(() => {
    return new Promise((res) => {
      socket.emit("createRoom", {
        nickname: "PuppetHost",
        maxPlayers: 2,
        isPublic: true,
      });
      socket.on("roomCreated", (d) => {
        res(d.roomId);
      });
    });
  });
  console.log("roomId", roomId);

  // Guest join
  await pageB.evaluate((rid) => {
    socket.emit("joinRoom", { roomId: rid, nickname: "PuppetGuest" });
  }, roomId);
  await new Promise((r) => setTimeout(r, 500));

  // Guest buy shield (5)
  await pageB.evaluate(() => {
    socket.emit("buySpecialCard", { cardId: 5, cardPrice: 0 });
  });
  await new Promise((r) => setTimeout(r, 300));

  // Guest toggle ready
  await pageB.evaluate(() => {
    socket.emit("toggleReady");
  });
  await new Promise((r) => setTimeout(r, 300));

  // Host request start
  await pageA.evaluate(() => {
    socket.emit("startGameRequest", (ack) => console.log("start ack", ack));
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Host uses thief
  await pageA.evaluate(() => {
    socket.emit("requestUseSpecial", { cardId: 7 }, (res) =>
      console.log("host reqUseSpecial cb", res),
    );
  });

  // wait for animations and results
  // wait until either page logs a shield event or timeout
  const endTime = Date.now() + 5000;
  while (Date.now() < endTime) {
    if (
      logsA.some((l) => l.includes("[debug] specialUsed shielded ids")) ||
      logsB.some((l) => l.includes("[debug] specialUsed shielded ids"))
    )
      break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // take screenshots
  await pageA.screenshot({ path: "puppet_host.png", fullPage: true });
  await pageB.screenshot({ path: "puppet_guest.png", fullPage: true });

  await browser.close();
  console.log("puppet test done");
  process.exit(0);
})();
