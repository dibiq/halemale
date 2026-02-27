const io = require("socket.io-client");

const SERVER = "http://localhost:8080";

function createClient(name) {
  const socket = io(SERVER, { transports: ["websocket"], forceNew: true });
  socket.on("connect", () => console.log(`${name} connected: ${socket.id}`));
  socket.on("disconnect", () => console.log(`${name} disconnected`));
  socket.on("myProfile", (p) => console.log(`${name} myProfile`, p));
  socket.on("joinRoomSuccess", (d) =>
    console.log(`${name} joinRoomSuccess`, d),
  );
  socket.on("specialPlay", (d) => console.log(`${name} specialPlay`, d));
  socket.on("specialUsed", (d) => console.log(`${name} specialUsed`, d));
  socket.on("startBlocked", (msg) => console.log(`${name} startBlocked`, msg));
  socket.on("startGame", (d) => console.log(`${name} startGame`, d));
  socket.on("playerJoined", (d) =>
    console.log(
      `${name} playerJoined`,
      d.players && d.players.map((p) => p.nickname),
    ),
  );
  return socket;
}

(async () => {
  const A = createClient("Host");
  const B = createClient("Guest");

  await new Promise((r) => setTimeout(r, 800));

  A.emit("setNickname", { nickname: "HostSim" });
  B.emit("setNickname", { nickname: "GuestSim" });

  // Host createRoom
  A.emit("createRoom", { nickname: "HostSim", maxPlayers: 2, isPublic: true });

  // wait for room creation
  let roomId = null;
  A.on("roomCreated", (d) => {
    console.log("Host got roomCreated", d);
    roomId = d.roomId;
    // Guest joins
    setTimeout(() => {
      B.emit("joinRoom", { roomId: roomId, nickname: "GuestSim" });
    }, 300);

    // after both join, mark Guest ready then Host requests start
    setTimeout(() => {
      console.log("Guest toggling ready");
      B.emit("toggleReady");
    }, 600);

    setTimeout(() => {
      console.log("Host requesting startGameRequest");
      A.emit("startGameRequest", (ack) =>
        console.log("Host startGameRequest ack", ack),
      );
    }, 1100);

    // after start, try using special
    setTimeout(() => {
      console.log("Host attempting to use special card 7 (thief)");
      A.emit("requestUseSpecial", { cardId: 7 }, (res) =>
        console.log("Host requestUseSpecial cb", res),
      );
    }, 2200);

    // Guest also attempts
    setTimeout(() => {
      console.log("Guest attempting to use special card 7 (thief)");
      B.emit("requestUseSpecial", { cardId: 7 }, (res) =>
        console.log("Guest requestUseSpecial cb", res),
      );
    }, 2600);
  });

  // safety exit
  setTimeout(() => {
    console.log("Simulation done");
    process.exit(0);
  }, 8000);
})();
