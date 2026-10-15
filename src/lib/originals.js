const DATABASE = "folio-original-files";
const STORE = "files";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(
        new Error(
          "Your browser cannot save original files. Enable browser storage and try again.",
        ),
      );
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Original file storage could not be opened. Please check your browser storage settings.",
        ),
      );
    request.onblocked = () =>
      reject(
        new Error(
          "File storage is busy in another tab. Close the other Folio tab and try again.",
        ),
      );
  });
}

export async function saveOriginal(id, file) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction
      .objectStore(STORE)
      .put({ id, file, storedAt: new Date().toISOString() });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        new Error(
          "The original file could not be saved. Your browser storage may be full; remove unused files and try again.",
        ),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(
        new Error(
          "Saving the original file was interrupted. Please try uploading again.",
        ),
      );
    };
  });
}

export async function getOriginal(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    let original = null;
    request.onsuccess = () => {
      original = request.result?.file || null;
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(original);
    };
    transaction.onerror = () => {
      database.close();
      reject(
        new Error("The original file could not be read from browser storage."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error("Reading the original file was interrupted."));
    };
  });
}

export async function clearOriginals() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error("Stored original files could not be cleared."));
    };
  });
}
