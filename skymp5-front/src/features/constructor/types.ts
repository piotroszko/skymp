import React, { CSSProperties } from "react";

export type ElementTag =
  | "BUTTON_STYLE_GITHUB"
  | "BUTTON_STYLE_PATREON"
  | "BUTTON_STYLE_FRAME"
  | "BUTTON_STYLE_FRAME_LEFT"
  | "BUTTON_STYLE_FRAME_RIGHT"
  | "ICON_STYLE_MAIL"
  | "ICON_STYLE_KEY"
  | "ICON_STYLE_DISCORD"
  | "ICON_STYLE_SKYMP"
  | "ELEMENT_STYLE_MARGIN_EXTENDED"
  | "HINT_STYLE_LEFT"
  | "HINT_STYLE_RIGHT"
  | "ELEMENT_SAME_LINE";

export type ElementType = "button" | "text" | "inputText" | "inputPass" | "checkBox" | "icon";

export interface ConstructorElement {
  type: ElementType;
  text?: string;
  tags?: ElementTag[];
  hint?: string;
  isDisabled?: boolean;
  initialValue?: string | boolean;
  placeholder?: string;
  width?: number;
  height?: number;
  click?: () => void;
  onInput?: React.FormEventHandler<HTMLInputElement>;
  setChecked?: (value: boolean) => void;
}

export interface FormWidget {
  type: "form";
  caption?: string;
  elements: ConstructorElement[];
}

export interface ChatWidget {
  type: "chat";
  messages: unknown;
  send: (message: string) => void;
  placeholder?: string;
  isInputHidden?: boolean;
}

export type Widget = FormWidget | ChatWidget;

export interface ConstructorProps {
  elem: Widget;
  width?: number;
  height?: number;
  dynamicSize?: boolean;
}

export interface HintEntry {
  id: number;
  text: string;
  isOpened: boolean;
  direction: boolean;
}

export interface LineItem {
  index: number;
  css: string | undefined;
  style: CSSProperties;
  element: ConstructorElement;
}

export const styles: ElementTag[] = [
  "BUTTON_STYLE_GITHUB",
  "BUTTON_STYLE_PATREON",
  "BUTTON_STYLE_FRAME",
  "BUTTON_STYLE_FRAME_LEFT",
  "BUTTON_STYLE_FRAME_RIGHT",
  "ICON_STYLE_MAIL",
  "ICON_STYLE_KEY",
  "ICON_STYLE_DISCORD",
  "ICON_STYLE_SKYMP",
];
