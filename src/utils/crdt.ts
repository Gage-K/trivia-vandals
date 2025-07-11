/**
 * Represents the ID of an item (i.e., a single character) in the document
 */
type Id = [agent: string, seq: number];

/**
 * Represents the metadata of an item (i.e., a single character) in the document.
 * @property content - the character itself
 * @property id - the ID metadata associated with the item
 * @property originLeft - the ID of the item to the left of the current item at time of insertion
 * @property originRight - the ID of the item to the right of the current item at time of insertion
 * @property deleted - whether the item has been deleted
 */
type Item = {
  content: string; // 1 char
  id: Id;
  originLeft: Id | null;
  originRight: Id | null;
  deleted: boolean;
};

/**
 * Represents the version of the document for each agent
 */
type Version = Record<string, number>;

/**
 * Represents the document itself
 * @property content - the list of Items in the document
 * @property version - the Version of the document for each agent
 */
export type Doc = {
  content: Item[];
  version: Version;
};

/**
 * Creates a new Document
 * @returns A new Doc object
 */
function createDoc(): Doc {
  return {
    content: [],
    version: {},
  };
}

/**
 * Gets the content of the document as a string, filtering out deleted items
 * @param doc - The document to get the content of
 * @returns The content of the document as a string
 */
function getContent(doc: Doc): string {
  let content = "";
  for (const item of doc.content) {
    if (!item.deleted) {
      content += item.content;
    }
  }
  return content;
}

/**
 * Finds the item at a given position in the document
 * @param doc - The document to find the item in
 * @param pos - The position to find the item at
 * @param stick_end - Whether to stick to the end of the document
 * @returns The index of the item at the given position
 */
const findItemAtPos = (
  doc: Doc,
  pos: number,
  stick_end: boolean = false
): number => {
  // TODO: fix the naming convention of stick_end
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

/**
 * Inserts a single character into the document
 * @param doc - The document to insert the character into
 * @param agent - The agent inserting the character
 * @param pos - The position to insert the character at
 * @param text - The character to insert
 */
function localInsertOne(doc: Doc, agent: string, pos: number, text: string) {
  const idx = findItemAtPos(doc, pos, true);
  const seq = (doc.version[agent] ?? -1) + 1;

  // Integrates the new item into the document with all of the necessary metadata
  integrate(doc, {
    content: text,
    id: [agent, seq],
    deleted: false,
    originLeft: doc.content[idx - 1]?.id ?? null,
    originRight: doc.content[idx]?.id ?? null,
  });
}

/**
 * Inserts an item into the document from a local agent
 * @param doc - The document to insert the string into
 * @param agent - The agent inserting the string
 * @param pos - The position to insert the string at
 * @param text - The string to insert
 */
export function localInsert(
  doc: Doc,
  agent: string,
  pos: number,
  text: string
) {
  // Turn single content string into an array of characters
  const content = [...text];

  // loop through each character in the string and insert it into the document
  for (const c of content) {
    localInsertOne(doc, agent, pos, c);
    pos++;
  }
}

/**
 * Inserts an item into the document from a remote agent
 * @param doc - The document to insert the item into
 * @param item - The item to insert
 */
function remoteInsert(doc: Doc, item: Item) {
  integrate(doc, item);
}

/**
 * Deletes a range of characters from the document
 * @param doc - The document to delete the characters from
 * @param pos - The position to start deleting from
 * @param delLen - The number of characters to delete
 */
function localDelete(doc: Doc, pos: number, delLen: number) {
  while (delLen > 0) {
    const idx = findItemAtPos(doc, pos, false);
    doc.content[idx].deleted = true;
    delLen--;
  }
}

/**
 * Checks if two IDs are equal
 * @param a - The first ID
 * @param b - The second ID
 * @returns True if the IDs are equal, false otherwise
 */
const idEq = (a: Id | null, b: Id | null): boolean =>
  // TODO: naming convention is a bit confusing
  a == b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1]);

/**
 * Finds the index of an item in the document by its ID
 * @param doc - The document to find the item in
 * @param id - The ID of the item to find
 * @returns The index of the item in the document, or null if the item is not found
 */
function findItemIdxAtId(doc: Doc, id: Id | null): number | null {
  // Validate that the ID is not null
  if (id == null) return null;

  // Loop through the document and check if the ID of the item matches the ID we're looking for
  // If it does, return the index of the item
  for (let i = 0; i < doc.content.length; i++) {
    if (idEq(doc.content[i].id, id)) return i;
  }

  // If the item is not found, throw an error
  throw Error(`Item with id ${id} cannot be found in document`);
}

/**
 * Integrates a new item into the document
 * @param doc - The document to integrate the item into
 * @param newItem - The item to integrate into the document
 */
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
  }
  doc.content.splice(destIdx, 0, newItem);
}

/**
 * Checks if an item is in the version of the document
 * @param id - The ID of the item to check
 * @param version - The version of the document to check
 * @returns True if the item is in the version, false otherwise
 */
function isInVersion(id: Id | null, version: Version): boolean {
  // ID Validation
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
}

function canInsertNow(item: Item, doc: Doc): boolean {
  // We need item ID to *not* be in doc version, but originLeft and originRight should be in doc version
  // We're also inserting each item from each agent in sequence

  const [agent, seq] = item.id;
  return (
    !isInVersion(item.id, doc.version) &&
    (seq === 0 || isInVersion([agent, seq - 1], doc.version)) &&
    isInVersion(item.originLeft, doc.version) &&
    isInVersion(item.originRight, doc.version)
  );
}

/**
 * Merges a source document into a destination document. Loops through source document and inserts items into destination document if they are not already in the destination document.
 * @param dest - The destination document to merge into
 * @param src - The source document to merge from
 */
export function mergeInto(dest: Doc, src: Doc) {
  const missing: (Item | null)[] = src.content.filter(
    (item) => !isInVersion(item.id, dest.version)
  );

  // Keeps track of the number of items that have not been examined to be merged yet
  let remaining = missing.length;

  // Loop through the remaining items and insert them into the destination document
  while (remaining > 0) {
    // Find the next item in remaining and insert it.
    let mergedOnThisPass = 0;

    // Loop through the remaining items and insert them into the destination document
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

/**
 * Represents a CRDT Document
 * @property inner - The Doc object itself
 * @property agent - The agent associated with the document
 * @method ins - Inserts a string into the document
 * @method del - Deletes a range of characters from the document
 * @method getString - Gets the content of the document as a string
 * @method mergeFrom - Merges another CRDTDocument into the current document
 * @method reset - Resets the document to its initial state
 */
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
