export interface AccountCharacter {
  profileId: number;
  name: string;
}

export interface RemoteAuthGameData {
  session: string;
  email: string;
  characters: AccountCharacter[];
  selectedProfileId?: number;
}

export interface LocalAuthGameData {
  profileId: number;
}

export interface AuthGameData {
  remote?: RemoteAuthGameData;
  local?: LocalAuthGameData;
}

export const authGameDataStorageKey = "authGameData";
