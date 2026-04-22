import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import App from "./App";
import { store } from "./redux/store";
import { Widgets } from "./utils/Widgets";

import "./main.scss";

if (!window.skyrimPlatform) {
  window.skyrimPlatform = {};
  window.needToScroll = true;
}

const platform = window.skyrimPlatform;
if (!platform.widgets) {
  platform.widgets = new Widgets([]);
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App elem={platform.widgets!.get()} />
    </Provider>
  </React.StrictMode>,
);

// Called from skymp5-functions-lib, chatProperty.ts
window.scrollToLastMessage = () => {
  const list = document.querySelector<HTMLElement>("#chat > .chat-main > .list > .chat-list");
  if (list != null && window.needToScroll) {
    list.scrollTop = list.offsetHeight * list.offsetHeight;
  }
};

window.playSound = (name: string) => {
  new Audio(require("./sound/" + name).default).play();
};

if (platform.sendMessage) {
  platform.sendMessage("front-loaded");
}
