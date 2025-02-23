const WebSocket = require("ws");

const projectRooms = {};

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws, req) => {
  const apiKey = req.headers["sec-websocket-protocol"];
  const urlParams = new URLSearchParams(req.url.split("?")[1]);
  const channelName = urlParams.get("channel") || "default";

  // TODO: 등록된 apiKey 확인하는 과정 필요
  if (!apiKey) {
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
      projectRooms[apiKey][channelName].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(cursorData));
        }
      });
    } catch (error) {
      console.error(`메시지 처리 중 에러 발생: ${error.message}`);
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
