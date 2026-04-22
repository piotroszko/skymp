import { CSSProperties } from "react";
import { ConstructorElement, HintEntry, LineItem, styles } from "./types";

export const computeFormLayout = (
  elements: ConstructorElement[],
): { bodyLines: LineItem[][]; hintsArr: HintEntry[] } => {
  const hintsArr: HintEntry[] = [];
  const bodyLines: LineItem[][] = [];
  for (let i = 0; i < elements.length; i++) {
    const currentElem = elements[i];
    if (!currentElem) continue;
    let newline = true;
    let css: string | undefined;
    let hintIsLeft = true;
    let style: CSSProperties = {};
    const tags = currentElem.tags;
    if (tags !== undefined && tags.length !== 0) {
      for (const tag of tags) {
        if (i === elements.length - 1) {
          style = { marginBottom: "35px" };
        }
        if (tag === "ELEMENT_STYLE_MARGIN_EXTENDED") {
          style = { marginTop: "30px" };
          if (i === elements.length - 1) {
            style = { marginTop: "48px", marginBottom: "48px" };
          }
        } else if (tag === "HINT_STYLE_LEFT") {
          hintIsLeft = true;
        } else if (tag === "HINT_STYLE_RIGHT") {
          hintIsLeft = false;
        } else if (styles.includes(tag)) {
          css = tag;
        } else if (tag === "ELEMENT_SAME_LINE") {
          newline = false;
        }
      }
      const prevElem = elements[i - 1];
      if (
        i > 1 &&
        prevElem &&
        prevElem.type.match(/(icon|checkBox)/) &&
        prevElem.text &&
        currentElem.type.match(/(input|button)/)
      ) {
        const styleKeys = Object.keys(style) as (keyof CSSProperties)[];
        if (styleKeys.length !== 0) {
          const adjusted: Record<string, string> = {};
          for (const k of styleKeys) {
            const v = style[k];
            if (typeof v === "string") {
              adjusted[k] = `${parseInt(v, 10) - 14}px`;
            }
          }
          style = adjusted as CSSProperties;
        } else {
          style = { marginTop: "4px" };
        }
      }
    }
    if (currentElem.hint !== undefined) {
      hintsArr.push({ id: i, text: currentElem.hint, isOpened: false, direction: hintIsLeft });
    }
    const obj: LineItem = {
      index: i,
      css,
      style,
      element: currentElem,
    };
    if (newline) {
      bodyLines.push([obj]);
    } else {
      const lastLine = bodyLines[bodyLines.length - 1];
      if (lastLine) lastLine.push(obj);
      else bodyLines.push([obj]);
    }
  }
  return { bodyLines, hintsArr };
};
