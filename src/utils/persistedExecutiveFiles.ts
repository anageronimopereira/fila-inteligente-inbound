export type ExecutiveFileSlot =
  | "openProjects"
  | "closedProjects"
  | "lostProjects"
  | "cancellationProjects"
  | "newProjects"
  | "delinquencyProjects"
  | "contractValueProjects";

interface PersistedExecutiveFileRecord {
  slot: ExecutiveFileSlot;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

const DB_NAME = "mercos-ops-dashboard-files";
const STORE_NAME = "executive-files";
const DB_VERSION = 1;

export async function saveExecutiveFile(slot: ExecutiveFileSlot, file: File | null): Promise<void> {
  if (!file) {
    return;
  }

  const database = await openDatabase();
  await runStoreRequest(database, "readwrite", (store) =>
    store.put({
      slot,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      blob: file,
    } satisfies PersistedExecutiveFileRecord),
  );
}

export async function readExecutiveFiles(): Promise<Partial<Record<ExecutiveFileSlot, File>>> {
  const database = await openDatabase();
  const records = await runStoreRequest<PersistedExecutiveFileRecord[]>(database, "readonly", (store) =>
    store.getAll(),
  );

  return records.reduce<Partial<Record<ExecutiveFileSlot, File>>>((accumulator, record) => {
    accumulator[record.slot] = new File([record.blob], record.name, {
      type: record.type,
      lastModified: record.lastModified,
    });
    return accumulator;
  }, {});
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "slot" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runStoreRequest<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = execute(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
