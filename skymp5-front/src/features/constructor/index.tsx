import React, { useState, useRef, useEffect } from 'react';

import '../login/styles.scss';
import './styles.scss';

import { SkyrimFrame } from '../../components/SkyrimFrame/SkyrimFrame';
import { SkyrimInput } from '../../components/SkyrimInput/SkyrimInput';
import { SkyrimHint } from '../../components/SkyrimHint/SkyrimHint';
import Button from '../../constructorComponents/button';
import Icon from '../../constructorComponents/icon';
import CheckBox from '../../constructorComponents/checkbox';
import Text from '../../constructorComponents/text';
import Chat from '../../constructorComponents/chat';
import SkillsMenu from '../skillsMenu';
import TestMenu from '../testMenu';

type ElementTag =
  | 'BUTTON_STYLE_GITHUB' | 'BUTTON_STYLE_PATREON'
  | 'BUTTON_STYLE_FRAME' | 'BUTTON_STYLE_FRAME_LEFT' | 'BUTTON_STYLE_FRAME_RIGHT'
  | 'ICON_STYLE_MAIL' | 'ICON_STYLE_KEY' | 'ICON_STYLE_DISCORD' | 'ICON_STYLE_SKYMP'
  | 'ELEMENT_STYLE_MARGIN_EXTENDED'
  | 'HINT_STYLE_LEFT' | 'HINT_STYLE_RIGHT'
  | 'ELEMENT_SAME_LINE';

type ElementType =
  | 'button' | 'text' | 'inputText' | 'inputPass' | 'checkBox' | 'icon';

interface ConstructorElement {
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
  onInput?: (value: string) => void;
  setChecked?: (value: boolean) => void;
}

interface FormWidget {
  type: 'form';
  caption?: string;
  elements: ConstructorElement[];
}

interface ChatWidget {
  type: 'chat';
  messages: unknown;
  send: (message: string) => void;
  placeholder?: string;
  isInputHidden?: boolean;
}

type Widget = FormWidget | ChatWidget;

interface ConstructorProps {
  elem: Widget;
  width?: number;
  height?: number;
  dynamicSize?: boolean;
}

const styles = [
  'BUTTON_STYLE_GITHUB',
  'BUTTON_STYLE_PATREON',
  'BUTTON_STYLE_FRAME',
  'BUTTON_STYLE_FRAME_LEFT',
  'BUTTON_STYLE_FRAME_RIGHT',
  'ICON_STYLE_MAIL',
  'ICON_STYLE_KEY',
  'ICON_STYLE_DISCORD',
  'ICON_STYLE_SKYMP'
];

const Constructor = (props: ConstructorProps) => {
  const contentMainRef = useRef<HTMLDivElement>(null);
  const [fwidth, setFwidth] = useState(props.width || 512);
  const [fheight, setFheight] = useState(props.height || 704);

  useEffect(() => {
    if (props.dynamicSize) {
      switch (props.elem.type) {
        case 'form':
          {
            const isContentInitialized = contentMainRef && contentMainRef.current && contentMainRef.current.clientHeight && contentMainRef.current.clientWidth;
            if (isContentInitialized) {
              setFwidth(contentMainRef.current.clientWidth + 60 < 257 ? 257 : contentMainRef.current.clientWidth + 60);
              setFheight(contentMainRef.current.clientHeight + 96);
            }
          }
          break;
        default:
          break;
      }
    }
  }, [props.elem]);

  const rend = props.elem;
  switch (rend.type) {
    case 'form':
      const result: { header: string | undefined; body: any[] } = {
        header: rend.caption,
        body: []
      };
      const hintsArr: any[] = [];
      const bodyLines: any[][] = [];
      const allElems = rend.elements;
      for (let i = 0; i < allElems.length; i++) {
        let newline = true;
        let css: string | undefined;
        let hintIsLeft = true;
        let style: any = {};
        if (allElems[i].tags !== undefined) {
          if (allElems[i].tags.length !== 0) {
            for (let j = 0; j < allElems[i].tags.length; j++) {
              if (i === allElems.length - 1) {
                style = {
                  marginBottom: '35px'
                };
              }
              if (allElems[i].tags[j] === 'ELEMENT_STYLE_MARGIN_EXTENDED') {
                style = {
                  marginTop: '30px'
                };
                if (i === allElems.length - 1) {
                  style = {
                    marginTop: '48px',
                    marginBottom: '48px'
                  };
                }
              } else if (allElems[i].tags[j] === 'HINT_STYLE_LEFT') {
                hintIsLeft = true;
              } else if (allElems[i].tags[j] === 'HINT_STYLE_RIGHT') {
                hintIsLeft = false;
              } else if (styles.includes(allElems[i].tags[j])) {
                css = allElems[i].tags[j];
              } else if (allElems[i].tags[j] === 'ELEMENT_SAME_LINE') {
                newline = false;
              }
            }
            if (i > 1 && allElems[i - 1].type.match(/(icon|checkBox)/) && allElems[i - 1].text && allElems[i].type.match(/(input|button)/)) {
              if (Object.keys(style).length !== 0) {
                for (const k in style) {
                  style[k] = `${parseInt(style[k]) - 14}px`;
                }
              } else {
                style = {
                  marginTop: '4px'
                };
              }
              console.log(style, allElems[i]);
            }
          }
        }
        if (allElems[i].hint !== undefined) {
          hintsArr.push({ id: i, text: allElems[i].hint, isOpened: false, direction: hintIsLeft });
        }
        const obj = {
          index: i,
          css: css,
          style: style,
          element: allElems[i]
        };
        if (newline) bodyLines.push([obj]);
        else bodyLines[bodyLines.length - 1].push(obj);
      }
      const [hints, setHints] = useState(hintsArr);
      const setHintState = (index: number, state: boolean) => {
        const newArr = [...hints];
        hints.forEach((hint: any, ind: number) => {
          if (hint.id === index) { newArr[ind].isOpened = state; }
        });
        setHints(newArr);
      };
      let hintIndex = 0;
      bodyLines.forEach((line, lineIndex) => {
        const arr: any[] = [];
        let style: any;
        line.forEach((obj, elementIndex) => {
          let curElem;
          const hasHint = obj.element.hint !== undefined;
          const key = lineIndex + '-' + elementIndex + '-' + obj.element.type;
          if (obj.style) {
            style = obj.style;
          }
          switch (obj.element.type) {
            case 'button':
              curElem = <Button disabled={obj.element.isDisabled} css={obj.css} text={obj.element.text} onClick={obj.element.click} width={obj.element.width} height={obj.element.height} />;
              break;
            case 'text':
              curElem = <Text text={obj.element.text} />;
              break;
            case 'inputText':
              curElem = <SkyrimInput labelText="" disabled={obj.element.isDisabled} initialValue={obj.element.initialValue} placeholder={obj.element.placeholder} type={'text'} name={obj.index} width={obj.element.width} height={obj.element.height} onInput={obj.element.onInput} />;
              break;
            case 'inputPass':
              curElem = <SkyrimInput labelText="" disabled={obj.element.isDisabled} initialValue={obj.element.initialValue} placeholder={obj.element.placeholder} type={'password'} name={obj.index} width={obj.element.width} height={obj.element.height} onInput={obj.element.onInput} />;
              break;
            case 'checkBox':
              curElem = <CheckBox disabled={obj.element.isDisabled} initialValue={obj.element.initialValue} text={obj.element.text} setChecked={obj.element.setChecked} />;
              break;
            case 'icon':
              curElem = (<Icon disabled={obj.element.isDisabled} css={obj.css} text={obj.element.text} width={obj.element.width} height={obj.element.height} />);
              break;
          }
          if (curElem !== undefined) {
            arr.push(
              (hasHint)
                ? (<div key={key}>
                  <SkyrimHint
                    active=""
                    text={hints[hintIndex].text}
                    isOpened={hints[hintIndex].isOpened}
                    left={hints[hintIndex].direction}
                  />
                  <div
                    onMouseOver={() => setHintState(obj.index, true)}
                    onMouseOut={() => setHintState(obj.index, false)}
                  >
                    {curElem}
                  </div>
                </div>
                )
                : (
                  <div>
                    {curElem}
                  </div>
                )
            );
            if (hasHint) hintIndex++;
          }
        });
        result.body.push(<div style={style || {}} key={lineIndex + 'container'} className={'container'}>{arr}</div>);
      });

      return (
        <div className={'login'} >
          <div className={'login-form'} style={{ width: `${fwidth}px`, height: `${fheight}px` }}>
            <div className={'login-form--content'}>
              {(result.header !== undefined)
                ? (
                  <div className={'login-form--content_header'}>
                    {result.header}
                  </div>
                )
                : ''
              }
              <div className={'login-form--content_main'} ref={contentMainRef}>
                {result.body}
              </div>
            </div>
            <SkyrimFrame name="" width={fwidth} height={fheight} />
          </div>
        </div>
      );
    case 'chat':
      return (
        <>
          <SkillsMenu send={rend.send} />
          <Chat messages={rend.messages} send={rend.send} placeholder={rend.placeholder} isInputHidden={rend.isInputHidden} />
          <TestMenu send={rend.send} />
        </>
      );
    default:
      break;
  }
};

export default Constructor;
