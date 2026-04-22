import React, { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";

import "../login/styles.scss";
import "./styles.scss";

import { SkyrimFrame } from "../../components/SkyrimFrame/SkyrimFrame";
import { SkyrimInput } from "../../components/SkyrimInput/SkyrimInput";
import { SkyrimHint } from "../../components/SkyrimHint/SkyrimHint";
import Button from "./components/button";
import Icon from "./components/icon";
import CheckBox from "./components/checkbox";
import Text from "./components/text";
import Chat from "./components/chat";
import SkillsMenu from "../skillsMenu";
import TestMenu from "../testMenu";
import { ConstructorProps, HintEntry, LineItem } from "./types";
import { computeFormLayout } from "./utils";

const Constructor = (props: ConstructorProps) => {
  const contentMainRef = useRef<HTMLDivElement>(null);
  const [fwidth, setFwidth] = useState(props.width || 512);
  const [fheight, setFheight] = useState(props.height || 704);

  const formLayout = useMemo(
    () =>
      props.elem.type === "form"
        ? computeFormLayout(props.elem.elements)
        : { bodyLines: [] as LineItem[][], hintsArr: [] as HintEntry[] },
    [props.elem],
  );

  const [hints, setHints] = useState<HintEntry[]>(formLayout.hintsArr);

  useEffect(() => {
    if (!props.dynamicSize) return;
    if (props.elem.type !== "form") return;
    const node = contentMainRef.current;
    if (!node || !node.clientHeight || !node.clientWidth) return;
    setFwidth(node.clientWidth + 60 < 257 ? 257 : node.clientWidth + 60);
    setFheight(node.clientHeight + 96);
  }, [props.elem, props.dynamicSize]);

  const rend = props.elem;
  switch (rend.type) {
    case "form": {
      const { bodyLines } = formLayout;
      const setHintState = (index: number, state: boolean) => {
        setHints((prev) =>
          prev.map((hint) => (hint.id === index ? { ...hint, isOpened: state } : hint)),
        );
      };
      let hintIndex = 0;
      const body: ReactNode[] = [];
      bodyLines.forEach((line, lineIndex) => {
        const arr: ReactNode[] = [];
        let containerStyle: CSSProperties | undefined;
        line.forEach((obj, elementIndex) => {
          let curElem: ReactNode;
          const hasHint = obj.element.hint !== undefined;
          const key = `${lineIndex}-${elementIndex}-${obj.element.type}`;
          if (obj.style) {
            containerStyle = obj.style;
          }
          switch (obj.element.type) {
            case "button":
              curElem = (
                <Button
                  disabled={obj.element.isDisabled}
                  css={obj.css}
                  text={obj.element.text}
                  onClick={obj.element.click}
                  width={obj.element.width}
                  height={obj.element.height}
                />
              );
              break;
            case "text":
              curElem = <Text text={obj.element.text} />;
              break;
            case "inputText":
              curElem = (
                <SkyrimInput
                  labelText=""
                  disabled={obj.element.isDisabled}
                  initialValue={
                    typeof obj.element.initialValue === "string" ? obj.element.initialValue : ""
                  }
                  placeholder={obj.element.placeholder ?? ""}
                  type="text"
                  name={String(obj.index)}
                  width={obj.element.width}
                  height={obj.element.height}
                  onInput={obj.element.onInput}
                />
              );
              break;
            case "inputPass":
              curElem = (
                <SkyrimInput
                  labelText=""
                  disabled={obj.element.isDisabled}
                  initialValue={
                    typeof obj.element.initialValue === "string" ? obj.element.initialValue : ""
                  }
                  placeholder={obj.element.placeholder ?? ""}
                  type="password"
                  name={String(obj.index)}
                  width={obj.element.width}
                  height={obj.element.height}
                  onInput={obj.element.onInput}
                />
              );
              break;
            case "checkBox":
              curElem = (
                <CheckBox
                  disabled={obj.element.isDisabled ?? false}
                  initialValue={
                    typeof obj.element.initialValue === "boolean" ? obj.element.initialValue : false
                  }
                  text={obj.element.text ?? ""}
                  setChecked={obj.element.setChecked ?? (() => { })}
                />
              );
              break;
            case "icon":
              curElem = (
                <Icon
                  disabled={obj.element.isDisabled}
                  css={obj.css}
                  text={obj.element.text}
                  width={obj.element.width}
                  height={obj.element.height}
                />
              );
              break;
          }
          if (curElem !== undefined) {
            const hint = hints[hintIndex];
            arr.push(
              hasHint && hint ? (
                <div key={key}>
                  <SkyrimHint
                    active=""
                    text={hint.text}
                    isOpened={hint.isOpened}
                    left={hint.direction}
                  />
                  <div
                    onMouseOver={() => setHintState(obj.index, true)}
                    onMouseOut={() => setHintState(obj.index, false)}
                  >
                    {curElem}
                  </div>
                </div>
              ) : (
                <div key={key}>{curElem}</div>
              ),
            );
            if (hasHint) hintIndex++;
          }
        });
        body.push(
          <div style={containerStyle ?? {}} key={`${lineIndex}container`} className="container">
            {arr}
          </div>,
        );
      });

      return (
        <div className="login">
          <div className="login-form" style={{ width: `${fwidth}px`, height: `${fheight}px` }}>
            <div className="login-form--content">
              {rend.caption !== undefined ? (
                <div className="login-form--content_header">{rend.caption}</div>
              ) : (
                ""
              )}
              <div className="login-form--content_main" ref={contentMainRef}>
                {body}
              </div>
            </div>
            <SkyrimFrame name="" width={fwidth} height={fheight} />
          </div>
        </div>
      );
    }
    case "chat":
      return (
        <>
          <SkillsMenu send={rend.send} />
          <Chat
            messages={rend.messages}
            send={rend.send}
            placeholder={rend.placeholder}
            isInputHidden={rend.isInputHidden}
          />
          <TestMenu send={rend.send} />
        </>
      );
    default:
      return null;
  }
};

export default Constructor;
