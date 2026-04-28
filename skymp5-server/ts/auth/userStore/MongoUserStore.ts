import { Collection, MongoClient } from "mongodb";
import { IUserStore, UserCharacter, UserRecord, normalizeEmail } from "./IUserStore";

interface CounterDoc {
  _id: string;
  value: number;
}

export class MongoUserStore implements IUserStore {
  private client: MongoClient | null = null;
  private users: Collection<UserRecord> | null = null;
  private counters: Collection<CounterDoc> | null = null;

  constructor(
    private readonly uri: string,
    private readonly dbName: string,
    private readonly usersCollection = "users",
    private readonly countersCollection = "counters",
  ) {}

  async init(): Promise<void> {
    this.client = new MongoClient(this.uri);
    await this.client.connect();
    const db = this.client.db(this.dbName);
    this.users = db.collection<UserRecord>(this.usersCollection);
    this.counters = db.collection<CounterDoc>(this.countersCollection);

    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.users.createIndex({ userId: 1 }, { unique: true });
  }

  private async allocateId(): Promise<number> {
    if (!this.counters) {
      throw new Error("MongoUserStore not initialized");
    }
    const result = await this.counters.findOneAndUpdate(
      { _id: "userStore" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    if (!result || typeof result.value !== "number") {
      throw new Error("Failed to allocate id");
    }
    return result.value;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    if (!this.users) {
      throw new Error("MongoUserStore not initialized");
    }
    return this.users.findOne({ email: normalizeEmail(email) });
  }

  async getById(userId: number): Promise<UserRecord | null> {
    if (!this.users) {
      throw new Error("MongoUserStore not initialized");
    }
    return this.users.findOne({ userId });
  }

  async create(email: string, passwordHash: string): Promise<UserRecord> {
    if (!this.users) {
      throw new Error("MongoUserStore not initialized");
    }
    const normalized = normalizeEmail(email);
    const existing = await this.users.findOne({ email: normalized });
    if (existing) {
      throw new Error("Email already registered");
    }

    const record: UserRecord = {
      userId: await this.allocateId(),
      email: normalized,
      passwordHash,
      characters: [],
      createdAt: Date.now(),
    };

    await this.users.insertOne(record);
    return record;
  }

  async addCharacter(userId: number, name: string): Promise<UserCharacter> {
    if (!this.users) {
      throw new Error("MongoUserStore not initialized");
    }
    const character: UserCharacter = {
      profileId: await this.allocateId(),
      name,
      createdAt: Date.now(),
    };
    const result = await this.users.updateOne(
      { userId },
      { $push: { characters: character } },
    );
    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }
    return character;
  }

  async deleteCharacter(userId: number, profileId: number): Promise<void> {
    if (!this.users) {
      throw new Error("MongoUserStore not initialized");
    }
    const result = await this.users.updateOne(
      { userId },
      { $pull: { characters: { profileId } } },
    );
    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }
    if (result.modifiedCount === 0) {
      throw new Error("Character not found");
    }
  }

  async renameCharacter(userId: number, profileId: number, newName: string): Promise<UserCharacter> {
    if (!this.users) {
      throw new Error("MongoUserStore not initialized");
    }
    const result = await this.users.findOneAndUpdate(
      { userId, "characters.profileId": profileId },
      { $set: { "characters.$.name": newName } },
      { returnDocument: "after" },
    );
    if (!result) {
      throw new Error("Character not found");
    }
    const character = result.characters.find((c) => c.profileId === profileId);
    if (!character) {
      throw new Error("Character not found");
    }
    return character;
  }
}
