import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useRef } from "react";
import Document from "./components/Document";

import {
  mergeInto,
  localDelete,
  localInsert,
  createDoc,
} from "./utils/crdt.ts";

function App() {
  const doc1 = useRef(createDoc());
  const doc2 = useRef(createDoc());
  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <Document document={doc1} />
      <Document document={doc2} />
    </>
  );
}

export default App;
