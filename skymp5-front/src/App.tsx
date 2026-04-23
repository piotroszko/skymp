import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import AnimList from "./features/animList";
import Constructor from "./features/constructor";
import Chat from "./features/constructor/components/chat";
import { Widget } from "./features/constructor/types";
import SkillsMenu from "./features/skillsMenu";
import TestMenu from "./features/testMenu";

interface AppProps {
  elem?: Widget[];
  height?: number;
  width?: number;
}

function App({ elem, height, width }: AppProps) {
  const dispatch = useDispatch();
  const [isLoggined] = useState(false);
  const [widgets, setWidgets] = useState<Widget[] | null>(elem ?? null);

  const onWindowFocus = useCallback(() => {
    const focus = document.hasFocus();
    dispatch({ type: "UPDATE_APP_BROWSERFOCUS", data: focus });
  }, [dispatch]);

  const onMoveWindow = useCallback((e: MouseEvent) => {
    if (window.isMoveWindow && typeof window.moveWindow === "function") {
      window.moveWindow(e.clientX, e.clientY);
    }
  }, []);

  const onMouseUp = useCallback(() => {
    if (window.isMoveWindow) window.isMoveWindow = false;
    window.moveWindow = null;
  }, []);

  const handleWidgetUpdate = useCallback((newWidgets: Widget[]) => {
    setWidgets(newWidgets);
  }, []);

  useEffect(() => {
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("blur", onWindowFocus);
    window.mp = {
      send: (type, data) => {
        try {
          window.skymp?.send({ type, data });
        } catch {
          console.log(type, data);
        }
      },
    };

    try {
      window.skymp?.on("error", console.error);
      window.skymp?.on("message", (action) => {
        window.storage?.dispatch(action);
      });
    } catch {
      // no-op
    }

    window.isMoveWindow = false;
    window.addEventListener("mousemove", onMoveWindow);
    window.addEventListener("mouseup", onMouseUp);

    window.skyrimPlatform?.widgets?.addListener(handleWidgetUpdate);

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("blur", onWindowFocus);
      window.removeEventListener("mousemove", onMoveWindow);
      window.removeEventListener("mouseup", onMouseUp);
      window.skyrimPlatform?.widgets?.removeListener(handleWidgetUpdate);
    };
  }, [onWindowFocus, onMoveWindow, onMouseUp, handleWidgetUpdate]);

  if (isLoggined) {
    const noopSend = (_message: string) => {};
    return (
      <div className={`App ${!("skyrimPlatform" in window) ? "bg" : ""}`}>
        <AnimList />
        <Chat />
        <SkillsMenu send={noopSend} />
        <TestMenu send={noopSend} />
      </div>
    );
  }

  if (widgets) {
    return (
      <div style={{ position: "static" }}>
        {widgets.map((widget, index) => (
          <Constructor
            key={
              index.toString() +
              widget.type +
              (widget.type === "form" ? widget.elements + String(widget.caption) : "chat")
            }
            dynamicSize={true}
            elem={widget}
            height={height || 704}
            width={width || 512}
          />
        ))}
      </div>
    );
  }

  return <></>;
}

export default App;
