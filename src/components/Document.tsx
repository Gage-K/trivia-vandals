import { CRDTDocument } from "../utils/crdt.ts";
import { useMemo, useRef, useState, useCallback } from "react";
import { useWebSocketSync } from "../hooks/useWebSocketSync.tsx";
import calcDiff from "../utils/diff.ts";

/**
 * The Document component is the main component that displays the document and handles the user's input.
 * It uses the useWebSocketSync hook to send and receive updates from the WebSocket server.
 * It also uses the useMemo hook to memoize the CRDTDocument object so that it doesn't re-render when the document is updated.
 * @param props - The agent associated with the Document component
 * @returns The Document component
 */
export default function Document(props: { agent: string }) {
  const { agent } = props;

  // State for the text in the document—this is what gets rendered to the user
  const [text, setText] = useState("");

  // Memoized CRDTDocument object to optimize performance
  const doc = useMemo(() => {
    return new CRDTDocument(agent);
  }, [agent]);

  // Ref to store the previous text value to calculate the diff
  const oldText = useRef<string>(doc.getString());

  /**
   * Handles the user's input, updates the CRDTDocument object and state, and sends the update to the WebSocket server
   * @param e - The event object from the textarea
   */
  function onDocChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newText: string = e.target.value.replace(/\r\n/g, "\n"); // standardizes line breaks for all OSs
    const { pos, del, ins } = calcDiff(oldText.current, newText);
    if (del > 0) doc.del(pos, del);
    if (ins !== "") doc.ins(pos, ins);
    sendUpdate(doc);
    oldText.current = newText;
    setText(newText);
  }

  // Callback function to handle remote updates from the WebSocket server and update the local state
  const handleRemoteUpdate = useCallback(() => {
    const newText = doc.getString();
    setText(newText);
    oldText.current = newText;
  }, [doc]);

  const { sendUpdate } = useWebSocketSync(doc, handleRemoteUpdate);

  return (
    <div className={"Document"}>
      <h2>Hi mom! I'm a documenet</h2>
      <form>
        <textarea onChange={onDocChange} value={text}></textarea>
        <br />
      </form>
    </div>
  );
}
