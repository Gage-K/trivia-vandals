import { useEffect, useRef } from "react";
// import { type CRDTDocument } from "../utils/crdt";
import { CRDTDocument } from "../utils/crdt";
/**
 * Initializes Web Socket connections between clients
 * Handles transfer of sequence state for data synchronization
 * Closes web socket connection on unmount
 * @param myDoc - The CRDT document to sync
 * @returns A function that receives a request to modify document and transfers document to subscribed clients
 */
export function useWebSocketSync(
  myDoc: CRDTDocument,
  onRemoteUpdate: () => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  // const isUpdatingRef = useRef(false); // is necessary?

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = () => {
      try {
        ws = new WebSocket("ws://localhost:8080");
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[WebSocket] Connected");
          // Clear any reconnection timeout
        };

        ws.onerror = (err) => {
          console.error("[WebSocket] Error:", err);
        };

        ws.onmessage = (event) => {
          try {
            // if (isUpdatingRef.current) return;

            // TODO: make some way to ensure that this response type is a CRDTDocument
            const response = JSON.parse(event.data);
            // console.log("here is the response", response);
            if (response.agent === myDoc.agent) return;
            console.log(
              `[WebSocket] ${myDoc.agent} received remote update from ${response.agent}:`,
              response
            );

            const tempDoc = new CRDTDocument(response.agent || "unknown agent");
            tempDoc.inner = response.inner;
            // console.log("this is tempdoc", tempDoc);
            myDoc.mergeFrom(tempDoc);
            onRemoteUpdate();
            // console.log("Here is the new doc", myDoc.inner);
            // isUpdatingRef.current = false;
          } catch (err) {
            console.error("[WebSocket] Data retrieval failed:", err);
          }
        };

        ws.onclose = (event) => {
          console.warn(
            "[WebSocket] Connection closed",
            event.code,
            event.reason
          );
          wsRef.current = null;
        };
      } catch (error) {
        console.error("[WebSocket] Failed to create connection:", error);
      }
    };

    connect();

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounting");
      }
    };
  }, [myDoc]);

  const sendUpdate = (doc: CRDTDocument) => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN
      // && !isUpdatingRef.current
    ) {
      try {
        const serializedDoc = JSON.stringify(doc);
        wsRef.current.send(serializedDoc);
        console.log(`[WebSocket] ${doc.agent} sent update`);
      } catch (error) {
        console.error("[WebSocket] Failed to send update:", error);
      }
    }
  };

  return { sendUpdate, myDoc };
}
