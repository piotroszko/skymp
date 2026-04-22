/* eslint-disable no-unused-vars */
interface SkyrimPlatform {
  widgets?: import("./utils/Widgets").Widgets;
  sendMessage?: (message: string) => void;
}

interface Window {
  skyrimPlatform?: SkyrimPlatform;
  needToScroll?: boolean;
  scrollToLastMessage?: () => void;
  playSound?: (name: string) => void;
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
