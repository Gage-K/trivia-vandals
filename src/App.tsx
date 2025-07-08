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
      <h1>Trivia Vandals</h1>
      <Document document={doc1} />
      <Document document={doc2} />
    </>
  );
}

export default App;
