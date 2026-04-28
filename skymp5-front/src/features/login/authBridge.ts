import { useEffect, useRef } from "react";

export interface AccountCharacter {
  profileId: number;
  name: string;
}

export interface AuthResult {
  type:
    | "registerResult"
    | "loginResult"
    | "createCharacterResult"
    | "deleteCharacterResult"
    | "renameCharacterResult"
    | "playResult"
    | "connectionDenied";
  ok?: boolean;
  error?: string;
  characters?: AccountCharacter[];
}

const SESSION_DETAIL_EVENT = "skymp:authResult";
const SHOW_SCREEN_EVENT = "skymp:authShowScreen";

const sendMessage = (...args: unknown[]) => {
  const platform = window.skyrimPlatform;
  if (platform && typeof platform.sendMessage === "function") {
    platform.sendMessage(...args);
  } else {
    // eslint-disable-next-line no-console
    console.log("[auth-bridge] sendMessage not available", args);
  }
};

export const requestRegister = (email: string, password: string) =>
  sendMessage("authRegisterAttempt", email, password);

export const requestLogin = (email: string, password: string) =>
  sendMessage("authLoginAttempt", email, password);

export const requestCreateCharacter = (name: string) =>
  sendMessage("authCreateCharacter", name);

export const requestDeleteCharacter = (profileId: number) =>
  sendMessage("authDeleteCharacter", profileId);

export const requestRenameCharacter = (profileId: number, name: string) =>
  sendMessage("authRenameCharacter", profileId, name);

export const requestPlay = (profileId: number) =>
  sendMessage("authPlay", profileId);

export const useAuthResult = (cb: (result: AuthResult) => void) => {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AuthResult>).detail;
      if (detail) {
        ref.current(detail);
      }
    };
    window.addEventListener(SESSION_DETAIL_EVENT, handler);
    return () => window.removeEventListener(SESSION_DETAIL_EVENT, handler);
  }, []);
};

export const useAuthVisibility = (cb: (visible: boolean) => void) => {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ visible?: boolean }>).detail;
      ref.current(!!detail?.visible);
    };
    window.addEventListener(SHOW_SCREEN_EVENT, handler);
    sendMessage("authReady");
    return () => window.removeEventListener(SHOW_SCREEN_EVENT, handler);
  }, []);
};
