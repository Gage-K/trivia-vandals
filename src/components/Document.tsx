import { useState, useRef } from "react";
export default function Document({ document }) {
  const prevText = useRef("");

  function onChange(e) {
    console.log(e);
  }

  return (
    <div className={"Document"}>
      <h2>Hi mom! I'm a documenet</h2>
      <form>
        <textarea onChange={(e) => onChange(e)}></textarea>
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
