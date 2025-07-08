import * as diff from "fast-diff";
import { CRDTDocument } from "../utils/crdt.ts";
import { useMemo } from "react";
import { useWebSocketSync } from "../hooks/useWebSocket.tsx";

export default function Document(props: { agent: string }) {
  const { agent } = props;

  const doc = useMemo(() => {
    return new CRDTDocument(agent);
  }, [agent]);

  const { sendUpdate } = useWebSocketSync(doc);

  function onDocChange(e) {
    const newText = e.target.value;
    const resultDiff = diff.default(doc.getString(), newText);

    let pos = 0;
    while (resultDiff.length > 0) {
      const [operation, content] = resultDiff.shift();
      if (operation === 0) {
        // KEEP
      } else if (operation === -1) {
        // DELETE
        doc.del(pos, content.length);
      } else if (operation === 1) {
        // INSERT
        doc.ins(pos, content);
      }
      pos += content.length;
    }
    console.log(doc.getString());
    sendUpdate();
  }

  return (
    <div className={"Document"}>
      <h2>Hi mom! I'm a documenet</h2>
      <form>
        <textarea onChange={onDocChange} />
        <br />
      </form>
    </div>
  );
}
