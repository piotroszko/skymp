import * as fs from "fs";
import * as path from "path";
import { IUserStore, UserCharacter, UserRecord, normalizeEmail } from "./IUserStore";

export class FileUserStore implements IUserStore {
  private readonly usersDir: string;
  private readonly counterPath: string;
  private readonly indexPath: string;
  private emailIndex: Map<string, number> = new Map();
  private nextId = 1;

  constructor(dataDir: string) {
    this.usersDir = path.join(dataDir, "users");
    this.counterPath = path.join(this.usersDir, "_counter.json");
    this.indexPath = path.join(this.usersDir, "_email_index.json");
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.usersDir)) {
      fs.mkdirSync(this.usersDir, { recursive: true });
    }

    if (fs.existsSync(this.counterPath)) {
      const raw = JSON.parse(fs.readFileSync(this.counterPath, "utf8"));
      if (typeof raw.nextId === "number" && raw.nextId >= 1) {
        this.nextId = raw.nextId;
      }
    }

    if (fs.existsSync(this.indexPath)) {
      const raw = JSON.parse(fs.readFileSync(this.indexPath, "utf8"));
      this.emailIndex = new Map(Object.entries(raw));
    } else {
      await this.rebuildIndex();
    }
  }

  private async rebuildIndex(): Promise<void> {
    this.emailIndex = new Map();
    const files = fs.readdirSync(this.usersDir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    for (const file of files) {
      try {
        const record: UserRecord = JSON.parse(fs.readFileSync(path.join(this.usersDir, file), "utf8"));
        this.emailIndex.set(record.email, record.userId);
      } catch (e) {
        console.error(`FileUserStore: failed to parse ${file}: ${e}`);
      }
    }
    this.persistIndex();
  }

  private persistIndex(): void {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.emailIndex.entries()) {
      obj[k] = v;
    }
    this.atomicWrite(this.indexPath, JSON.stringify(obj, null, 2));
  }

  private persistCounter(): void {
    this.atomicWrite(this.counterPath, JSON.stringify({ nextId: this.nextId }, null, 2));
  }

  private atomicWrite(target: string, contents: string): void {
    const tmp = target + ".tmp";
    fs.writeFileSync(tmp, contents);
    fs.renameSync(tmp, target);
  }

  private userPath(userId: number): string {
    return path.join(this.usersDir, `${userId}.json`);
  }

  private allocateId(): number {
    const id = this.nextId;
    this.nextId += 1;
    this.persistCounter();
    return id;
  }

  private writeRecord(record: UserRecord): void {
    this.atomicWrite(this.userPath(record.userId), JSON.stringify(record, null, 2));
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = normalizeEmail(email);
    const userId = this.emailIndex.get(normalized);
    if (userId === undefined) {
      return null;
    }
    return this.getById(userId);
  }

  async getById(userId: number): Promise<UserRecord | null> {
    const p = this.userPath(userId);
    if (!fs.existsSync(p)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(p, "utf8")) as UserRecord;
  }

  async create(email: string, passwordHash: string): Promise<UserRecord> {
    const normalized = normalizeEmail(email);
    if (this.emailIndex.has(normalized)) {
      throw new Error("Email already registered");
    }

    const record: UserRecord = {
      userId: this.allocateId(),
      email: normalized,
      passwordHash,
      characters: [],
      createdAt: Date.now(),
    };

    this.writeRecord(record);
    this.emailIndex.set(normalized, record.userId);
    this.persistIndex();
    return record;
  }

  async addCharacter(userId: number, name: string): Promise<UserCharacter> {
    const record = await this.getById(userId);
    if (!record) {
      throw new Error("User not found");
    }

    const character: UserCharacter = {
      profileId: this.allocateId(),
      name,
      createdAt: Date.now(),
    };

    record.characters.push(character);
    this.writeRecord(record);
    return character;
  }

  async deleteCharacter(userId: number, profileId: number): Promise<void> {
    const record = await this.getById(userId);
    if (!record) {
      throw new Error("User not found");
    }
    const before = record.characters.length;
    record.characters = record.characters.filter((c) => c.profileId !== profileId);
    if (record.characters.length === before) {
      throw new Error("Character not found");
    }
    this.writeRecord(record);
  }

  async renameCharacter(userId: number, profileId: number, newName: string): Promise<UserCharacter> {
    const record = await this.getById(userId);
    if (!record) {
      throw new Error("User not found");
    }
    const character = record.characters.find((c) => c.profileId === profileId);
    if (!character) {
      throw new Error("Character not found");
    }
    character.name = newName;
    this.writeRecord(record);
    return character;
  }
}
