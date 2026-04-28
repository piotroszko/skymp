export interface UserCharacter {
  profileId: number;
  name: string;
  createdAt: number;
}

export interface UserRecord {
  userId: number;
  email: string;
  passwordHash: string;
  characters: UserCharacter[];
  createdAt: number;
}

export interface IUserStore {
  init(): Promise<void>;
  findByEmail(email: string): Promise<UserRecord | null>;
  getById(userId: number): Promise<UserRecord | null>;
  create(email: string, passwordHash: string): Promise<UserRecord>;
  addCharacter(userId: number, name: string): Promise<UserCharacter>;
  deleteCharacter(userId: number, profileId: number): Promise<void>;
  renameCharacter(userId: number, profileId: number, newName: string): Promise<UserCharacter>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
