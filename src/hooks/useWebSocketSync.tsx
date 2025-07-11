import { useEffect, useRef } from "react";
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

  useEffect(() => {
    let ws: WebSocket | null = null;

    // Handles the logic for connecting to the WebSocket server and receiving messages from other clients
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

        // Fires when a message (i.e. a CRDTDocument from another client) is received
        ws.onmessage = (event) => {
          try {
            // Parse the CRDTDocument from the received message
            const response = JSON.parse(event.data);

            // If the received document is from the same agent, do nothing
            if (response.agent === myDoc.agent) return;

            // Create a new cached CRDTDocument from the received message
            const tempDoc = new CRDTDocument(response.agent || "unknown agent");
            tempDoc.inner = response.inner;

            // Merge the received document into the local document
            myDoc.mergeFrom(tempDoc);

            // Trigger the onRemoteUpdate function to update the local state
            onRemoteUpdate();
          } catch (err) {
            console.error("[WebSocket] Data retrieval failed:", err);
          }
        };

        // Fires in clean up function to close the connection
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

    // Clean up function to terminate the connection when the component unmounts
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounting");
      }
    };
  }, [myDoc, onRemoteUpdate]);

  /**
   * Sends the CRDTdocument to the WebSocket server to then be distributed to other clients
   * @param doc - The local document to send to the WebSocket server
   */
  const sendUpdate = (doc: CRDTDocument) => {
    // Only send the update if the connection is open
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        // Serialize the document to a JSON string
        const serializedDoc = JSON.stringify(doc);
        // Send the serialized document to the WebSocket server
        wsRef.current.send(serializedDoc);
        // Log the update to the console
        console.log(`[WebSocket] ${doc.agent} sent update`);
      } catch (error) {
        console.error("[WebSocket] Failed to send update:", error);
      }
    }
  };

  // Return the function to send updates to the WebSocket server from any component
  return { sendUpdate };
}
