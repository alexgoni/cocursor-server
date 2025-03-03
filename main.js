const WebSocket = require("ws");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const wss = new WebSocket.Server({ port: 8080 });
const projectRooms = {};

wss.on("connection", async (ws, req) => {
  const apiKey = req.headers["sec-websocket-protocol"];
  const urlParams = new URLSearchParams(req.url.split("?")[1]);
  const channelName = urlParams.get("channel") || "default";

  if (!apiKey) {
    ws.send(JSON.stringify({ type: "error", message: "API Key is required" }));
    ws.close();
    return;
  }

  try {
    // 🔥 Firestore에서 API Key 검증
    const apiKeyDoc = await db.collection("apiKeys").doc(apiKey).get();
    if (!apiKeyDoc.exists || !apiKeyDoc.data().active) {
      console.log(`[거부됨] 잘못된 API Key: ${apiKey}`);
      ws.send(JSON.stringify({ type: "error", message: "Invalid API Key" }));
      ws.close();
      return;
    }
  } catch (error) {
    console.error("API Key 검증 중 오류 발생:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Server error during API Key validation",
      })
    );
    ws.close();
    return;
  }

  // 프로젝트 방이 없으면 생성
  if (!projectRooms[apiKey]) {
    projectRooms[apiKey] = {};
  }

  // 채널이 없으면 생성
  if (!projectRooms[apiKey][channelName]) {
    projectRooms[apiKey][channelName] = new Set();
  }

  // 현재 유저를 해당 프로젝트 & 채널에 추가
  projectRooms[apiKey][channelName].add(ws);

  console.log(`[${apiKey} - ${channelName}] 새로운 사용자 연결`);

  ws.on("message", (data) => {
    try {
      const cursorData = JSON.parse(data);
      const message = { type: "cursor", ...cursorData };
      projectRooms[apiKey][channelName].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    } catch (error) {
      console.error(`메시지 처리 중 에러 발생: ${error.message}`);
      ws.send(
        JSON.stringify({ type: "error", message: "Invalid message format" })
      );
    }
  });

  ws.on("close", () => {
    projectRooms[apiKey][channelName].delete(ws);
    console.log(`[${apiKey} - ${channelName}] 사용자가 연결 종료`);

    // 채널이 비었으면 채널 삭제
    if (projectRooms[apiKey][channelName].size === 0) {
      delete projectRooms[apiKey][channelName];
    }

    // 프로젝트 방이 비었으면 프로젝트 방 삭제
    if (Object.keys(projectRooms[apiKey]).length === 0) {
      delete projectRooms[apiKey];
    }
  });
});

console.log("🚀 WebSocket 관리 서버가 8080 포트에서 실행 중...");
