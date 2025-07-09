import { createServer } from "http";
import { WebSocketServer } from "ws";

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[Server] Client connected");
  ws.on("message", (message) => {
    console.log("[Server] Received:", message.toString());
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on("close", () => {
    console.log("[Server] Connection closed");
  });

  ws.on("error", (error) => {
    console.error("[Server] WebSocket error:", error);
  });
});

server.listen(8080, () => {
  console.log("[Server] Listening on ws://localhost:8080");
});

process.on("SIGINT", () => {
  console.log("[Server] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
