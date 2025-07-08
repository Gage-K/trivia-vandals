export default function Document({ document }) {
  return (
    <div>
      <h2>Hi mom! I'm a documenet</h2>
      <form>
        <textarea></textarea>
        <button onClick={() => mergeInto()}>mergeInto</button>
        <button onClick={() => localDelete()}>localDelete</button>
        <button onClick={() => localInsert()}>localInsert</button>
      </form>
    </div>
  );
}
