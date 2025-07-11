import { CRDTDocument } from "../utils/crdt.ts";
import { useMemo, useRef, useState, useCallback } from "react";
import { useWebSocketSync } from "../hooks/useWebSocketSync.tsx";
import calcDiff from "../utils/diff.ts";

export default function Document(props: { agent: string }) {
  const { agent } = props;
  const [text, setText] = useState("");

  const doc = useMemo(() => {
    return new CRDTDocument(agent);
  }, [agent]);

  const oldText = useRef<string>(doc.getString());

  function onDocChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newText: string = e.target.value.replace(/\r\n/g, "\n"); // standardizes line breaks for all OSs
    const { pos, del, ins } = calcDiff(oldText.current, newText);
    if (del > 0) doc.del(pos, del);
    if (ins !== "") doc.ins(pos, ins);
    sendUpdate(doc);
    oldText.current = newText;
    setText(newText);
  }

  const handleRemoteUpdate = useCallback(() => {
    const newText = doc.getString();
    setText(newText);
    oldText.current = newText;
  }, [doc]);

  const { sendUpdate, myDoc } = useWebSocketSync(doc, handleRemoteUpdate);

  /*
  We need to have some onRemoteUpdate function that gets called when a remote change is received
  pass this into the useWebSocketSync hook
  When remote update arrives, component should update its local text state and old text ref to match merged document
  isUpdatingFromRemote flag can help prevent handling onChange events triggered by our own remote updates

  User types --> onDocChange --> apply to CRDT --> send to WebSocket --> update local state
  WebSocket receives --> merge into CRDT --> trigger onRemoteUpdate --> update local state
  */

  console.log(`client ${doc.agent}`, myDoc);

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
