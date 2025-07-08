import { useEffect, useRef } from "react";

/**
 * Initializes Web Scoket connections between clients
 * Handles transfer of sequence state for data synchronization
 * Closes web socket connection on unmount
 * @param handleRemoteUpdate
 * @returns A function that receives a request to modify document and transfers document to subscribed clients
 */

import { type CRDTDocument } from "../utils/crdt";

export function useWebSocketSync(myDoc: CRDTDocument) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // TODO: make port an environment variable
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => console.log("[WebSocket] Connected");
    ws.onerror = (err) => console.error("[WebSocket] Error:", err);
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const incomingDoc: CRDTDocument = response;
        myDoc.mergeFrom(incomingDoc);
      } catch (err) {
        console.error("[WebSocket] Data retrieval failed:", err);
      }
    };

    ws.onclose = () => {
      console.warn("[WebSocket] Connection closed");
      wsRef.current = null;
    };

    return () => {
      // ws.close();
    };
  }, []);

  const sendUpdate = () => {
    wsRef.current?.send(JSON.stringify(myDoc));
  };

  return { sendUpdate };
}
