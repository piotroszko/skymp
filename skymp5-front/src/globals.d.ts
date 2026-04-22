/* eslint-disable no-unused-vars */
interface SkyrimPlatform {
  widgets?: import("./utils/Widgets").Widgets;
  sendMessage?: (message: string) => void;
}

interface Mp {
  send: (type: string, data: unknown) => void;
}

interface Skymp {
  send: (payload: { type: string; data: unknown }) => void;
  on: (event: "error" | "message", cb: (action: unknown) => void) => void;
}

interface ReduxStorage {
  dispatch: (action: unknown) => void;
}

interface ChatMessagePartGlobal {
  text: string;
  color: string;
  opacity: number;
  type: string[];
}

interface ChatMessageGlobal {
  category?: string;
  opacity?: number;
  text: ChatMessagePartGlobal[];
}

interface Window {
  skyrimPlatform?: SkyrimPlatform;
  needToScroll?: boolean;
  scrollToLastMessage?: () => void;
  playSound?: (name: string) => void;
  mp?: Mp;
  skymp?: Skymp;
  storage?: ReduxStorage;
  isMoveWindow?: boolean;
  moveWindow?: ((x: number, y: number) => void) | null;
  chatMessages?: ChatMessageGlobal[];
}

declare module "*.png" {
  const value: string;
  export = value;
}

declare module "*.svg" {
  const value: string;
  export = value;
}

declare module "*.wav" {
  const src: string;
  export default src;
}

declare module "*.scss";
declare module "*.sass";
declare module "*.css";
