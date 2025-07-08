import "./App.css";
import Document from "./components/Document";

function App() {
  return (
    <>
      <h1>Trivia Vandals</h1>
      <div className={"text-boxes"}>
        <Document agent="a" />
        <div className="divider"></div>
        <Document agent="b" />
      </div>
    </>
  );
}

export default App;
