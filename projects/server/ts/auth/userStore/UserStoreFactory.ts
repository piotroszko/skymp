import { FileUserStore } from "./FileUserStore";
import { IUserStore } from "./IUserStore";
import { MongoUserStore } from "./MongoUserStore";

export interface UserStoreFactoryOptions {
  offlineMode: boolean;
  dataDir: string;
  databaseUri?: string;
  databaseName?: string;
}

export async function createUserStore(opts: UserStoreFactoryOptions): Promise<IUserStore> {
  if (opts.offlineMode) {
    const store = new FileUserStore(opts.dataDir);
    await store.init();
    return store;
  }

  if (!opts.databaseUri || !opts.databaseName) {
    throw new Error("Online mode requires databaseUri and databaseName in server-settings.json");
  }

  const store = new MongoUserStore(opts.databaseUri, opts.databaseName);
  await store.init();
  return store;
}
