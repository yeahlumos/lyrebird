// Keep shared diary photos separate from the existing single-person diary DB.
async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lyrebird-resonance", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readImage(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("images").objectStore("images").get(id);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveImages(relationshipId: string, files: File[]): Promise<string[]> {
  const ids = files.map(() => `${relationshipId}/${crypto.randomUUID()}`);
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      files.forEach((file, index) => transaction.objectStore("images").put(file, ids[index]));
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
    return ids;
  } finally { db.close(); }
}
export async function deleteImages(ids: string[], relationshipId?: string) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");
      ids.forEach((id) => store.delete(id));
      if (relationshipId) store.delete(IDBKeyRange.bound(`${relationshipId}/`, `${relationshipId}/\uffff`));
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
