type Id = [agent: string, seq: number];

type Item = {
  content: string; // 1 char
  id: Id;
  originLeft: Id | null;
  originRight: Id | null;
  deleted: boolean;
};

type Version = Record<string, number>;

export type Doc = {
  content: Item[];
  version: Version;
};

function createDoc(): Doc {
  return {
    content: [],
    version: {},
  };
}

function getContent(doc: Doc): string {
  // return doc.content.filter(item => !item.deleted)
  //   .map(item => item.content)
  //   .join('')

  let content = "";
  for (const item of doc.content) {
    if (!item.deleted) {
      content += item.content;
    }
  }
  return content;
}

const findItemAtPos = (
  doc: Doc,
  pos: number,
  stick_end: boolean = false
): number => {
  // QUESTION: stick end important????
  let i = 0;

  for (; i < doc.content.length; i++) {
    const item = doc.content[i];
    if (stick_end && pos === 0) return i;
    else if (item.deleted) continue;
    else if (pos === 0) return i;
    pos--;
  }

  if (pos === 0) return i;
  else {
    console.log("pos:", pos);
    throw Error("past end of the document");
  }
};

function localInsertOne(doc: Doc, agent: string, pos: number, text: string) {
  const idx = findItemAtPos(doc, pos, true);
  const seq = (doc.version[agent] ?? -1) + 1;
  integrate(doc, {
    content: text,
    id: [agent, seq],
    deleted: false,
    originLeft: doc.content[idx - 1]?.id ?? null,
    originRight: doc.content[idx]?.id ?? null,
  });
}

export function localInsert(
  doc: Doc,
  agent: string,
  pos: number,
  text: string
) {
  const content = [...text];
  for (const c of content) {
    localInsertOne(doc, agent, pos, c);
    pos++;
  }
}

function remoteInsert(doc: Doc, item: Item) {
  integrate(doc, item);
}

function localDelete(doc: Doc, pos: number, delLen: number) {
  while (delLen > 0) {
    const idx = findItemAtPos(doc, pos, false);
    doc.content[idx].deleted = true;
    delLen--;
  }
}

const idEq = (a: Id | null, b: Id | null): boolean =>
  a == b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1]);

function findItemIdxAtId(doc: Doc, id: Id | null): number | null {
  if (id == null) return null;

  for (let i = 0; i < doc.content.length; i++) {
    if (idEq(doc.content[i].id, id)) return i;
  }

  throw Error("can't find item");
}

function integrate(doc: Doc, newItem: Item) {
  const [agent, seq] = newItem.id;
  const lastSeen = doc.version[agent] ?? -1;
  if (seq !== lastSeen + 1) {
    throw Error("Operations out of order");
  }

  // Mark the item in the document version.
  doc.version[agent] = seq;

  // add new item into doc at the right location
  const left = findItemIdxAtId(doc, newItem.originLeft) ?? -1;
  let destIdx = left + 1;
  const right =
    newItem.originRight == null
      ? doc.content.length
      : findItemIdxAtId(doc, newItem.originRight)!;
  let scanning = false;

  for (let i = destIdx; ; i++) {
    if (!scanning) destIdx = i;
    // if we reach the end of the document, just insert
    if (i === doc.content.length) break;
    if (i === right) break; // no ambiguity / concurrency, insert here

    const other = doc.content[i];

    const oleft = findItemIdxAtId(doc, other.originLeft) ?? -1;
    const oright =
      other.originRight == null
        ? doc.content.length
        : findItemIdxAtId(doc, other.originRight)!;

    // The logic below summarizes to:
    if (
      oleft < left ||
      (oleft === left && oright === right && newItem.id[0] < other.id[0])
    )
      break;
    if (oleft === left) scanning = oright < right;

    // This is the same code as the above 2 lines, but written out the long way:
    //   if (oleft < left) {
    //     // Top row. Insert, insert, arbitrary (insert)
    //     break;
    //   } else if (oleft === left) {
    //     // Middle row.
    //     if (oright < right) {
    //       // This is tricky. We're looking at an item we *might* insert after - but we can't tell yet!
    //       scanning = true;
    //       continue;
    //     } else if (oright === right) {
    //       // Raw conflict. Order based on user agents.
    //       if (newItem.id[0] < other.id[0]) break;
    //       else {
    //         scanning = false;
    //         continue;
    //       }
    //     } else {
    //       // oright > right
    //       scanning = false;
    //       continue;
    //     }
    //   } else {
    //     // oleft > left
    //     // Bottom row. Arbitrary (skip), skip, skip
    //     continue;
    //   }
  }
  doc.content.splice(destIdx, 0, newItem);
}

function isInVersion(id: Id | null, version: Version): boolean {
  if (id === null) {
    return true;
  }
  const [agent, seq] = id;
  const highestSeq = version[agent];
  if (highestSeq == null) {
    return false;
  } else {
    // We've seen this version already
    return highestSeq >= seq;
  }

  // return highestSeq != null && highestSeq >= seq
}

function canInsertNow(item: Item, doc: Doc): boolean {
  // WE need item id to not be in doc.versions, but originLeft and originRight to be in
  // We're also inserting each item from each agen in sequence.

  const [agent, seq] = item.id;
  return (
    !isInVersion(item.id, doc.version) &&
    (seq === 0 || isInVersion([agent, seq - 1], doc.version)) &&
    isInVersion(item.originLeft, doc.version) &&
    isInVersion(item.originRight, doc.version)
  );
}

export function mergeInto(dest: Doc, src: Doc) {
  // // TODO: store list of thigns that are seen, things that have been deleted, etc
  // // so we can do something like
  // for (const item of src.content) {
  //   // if not exists in doc or doesn't have equiv origins
  //   remoteInsert(dest, item);
  // }

  const missing: (Item | null)[] = src.content.filter(
    (item) => !isInVersion(item.id, dest.version)
  );
  let remaining = missing.length;

  while (remaining > 0) {
    // Find the next item in remaining and insert it.
    let mergedOnThisPass = 0;

    for (let i = 0; i < missing.length; i++) {
      const item = missing[i];
      if (item === null) continue;
      if (!canInsertNow(item, dest)) continue;

      // Insert it.
      remoteInsert(dest, item);
      missing[i] = null;
      remaining--;
      mergedOnThisPass++;
    }

    if (mergedOnThisPass === 0) throw Error("Not making progress");
  }

  let srcIdx = 0,
    destIdx = 0;
  while (srcIdx < src.content.length) {
    const srcItem = src.content[srcIdx];
    let destItem = dest.content[destIdx];

    while (!idEq(srcItem.id, destItem.id)) {
      destIdx++;
      destItem = dest.content[destIdx];
    }

    if (srcItem.deleted) {
      destItem.deleted = true;
    }

    srcIdx++;
    destIdx++;
  }
}

export class CRDTDocument {
  inner: Doc;
  agent: string;

  constructor(agent: string) {
    this.inner = createDoc();
    this.agent = agent;
  }

  ins(pos: number, text: string) {
    localInsert(this.inner, this.agent, pos, text);
  }

  del(pos: number, delLen: number) {
    localDelete(this.inner, pos, delLen);
  }

  getString() {
    return getContent(this.inner);
  }

  mergeFrom(other: CRDTDocument) {
    mergeInto(this.inner, other.inner);
  }

  reset() {
    this.inner = createDoc();
  }
}

// const doc1 = createDoc()
// const doc2 = createDoc()

// localInsert(doc1, 'a', 0, 'A')
// localInsert(doc2, 'b', 0, 'B')

// mergeInto(doc1, doc2)
// mergeInto(doc2, doc1)

// console.log('doc1 has content', getContent(doc1))
// console.log('doc2 has content', getContent(doc2))

// localDelete(doc1, 0, 1)
// console.log('doc1 has content', getContent(doc1))

// mergeInto(doc2, doc1)
// console.log('doc2 has content', getContent(doc2))

// console.table(doc2.content)

// localInsertOne(doc1, 'seph', 0, 'a')
// mergeInto(doc2, doc1)

// localInsertOne(doc1, 'seph', 1, 'b')
// localInsertOne(doc1, 'seph', 0, 'c')
// console.log('doc1 has content', getContent(doc1))
// console.table(doc1.content)

// mergeInto(doc2, doc1)
// console.log('doc2 has content', getContent(doc2))

// console.table(doc2.content)
// const doc1 = createDoc();
// const doc2 = createDoc();
//
// localInsert(doc1, "a", 0, "A");
// localInsert(doc2, "b", 0, "B");
//
// mergeInto(doc1, doc2);
// mergeInto(doc2, doc1);
//
// console.log("doc1 has content", getContent(doc1));
// console.log("doc2 has content", getContent(doc2));
//
// localDelete(doc1, 0, 1);
// console.log("doc1 has content", getContent(doc1));
//
// mergeInto(doc2, doc1);
// console.log("doc2 has content", getContent(doc2));
//
// console.table(doc2.content);
//
// localInsert(doc2, "b", 1, "C");
// console.table(doc2.content);
// console.log("doc1 has content", getContent(doc1));
// console.log("doc2 has content", getContent(doc2));
// mergeInto(doc1, doc2);
// console.log("doc1 has content", getContent(doc1));
// console.log("doc2 has content", getContent(doc2));
// console.table(doc1.content);
// localInsert(doc2, "b", 2, "WHP");
// console.table(doc2.content);
// console.log("doc2 has content", getContent(doc2));
// localDelete(doc2, 0, 2);
// console.table(doc2.content);
// // console.log("doc2 has content", getContent(doc2));
// mergeInto(doc1, doc2);
// console.log("doc1 has content", getContent(doc1));

// localInsertOne(doc1, "seph", 0, "a");
// mergeInto(doc2, doc1);
// localInsertOne(doc1, "seph", 1, "b");
// localInsertOne(doc1, "seph", 0, "c");
// console.log("doc1 has content", getContent(doc1));
// console.table(doc1.content);

// mergeInto(doc2, doc1);
// console.log("doc2 has content", getContent(doc2));

// console.table(doc2.content);
