import * as diff from "fast-diff";
import { CRDTDocument } from "../utils/crdt.ts";
import { useMemo } from "react";

export default function Document(props: { agent: string }) {
  const { agent } = props;

  const doc = useMemo(() => {
    return new CRDTDocument(agent);
  }, [agent]);

  function onDocChange(e) {
    // const newText = e.target.value;
    // const resultDiff = diff.default(doc.getString(), newText);

    const newText = e.target.value;
    // console.log(newText);
    const resultDiff = diff.default(doc.getString(), newText);
    // console.log(resultDiff);

    let pos = 0;
    while (resultDiff.length > 0) {
      const [operation, content] = resultDiff.shift();
      // console.log(operation, content);
      if (operation === 0) {
        // console.log("keep");
      } else if (operation === -1) {
        // console.log("delete: ", content, "at position:", pos);
        doc.del(pos, content.length);
      } else if (operation === 1) {
        // console.log("insert");
        doc.ins(pos, content);
      }
      pos += content.length;
      // console.log("doc:", doc.getString());
    }
  }

  // useEffect(() => {}, []);

  return (
    <div className={"Document"}>
      <h2>Hi mom! I'm a documenet</h2>
      <form>
        <textarea onChange={onDocChange} />
        <br />
        <div className={"button-container"}>
          <button onClick={() => mergeInto()}>mergeInto</button>
          <button onClick={() => localDelete()}>localDelete</button>
          <button onClick={() => localInsert()}>localInsert</button>
        </div>
      </form>
    </div>
  );
}
