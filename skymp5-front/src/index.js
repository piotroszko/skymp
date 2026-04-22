import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

import { store } from './redux/store';
import { Provider } from 'react-redux';

import { Widgets } from './utils/Widgets';

import './main.scss';

if (!window.skyrimPlatform) {
  window.skyrimPlatform = {};
  window.needToScroll = true;
}

if (!window.skyrimPlatform.widgets) {
  window.skyrimPlatform.widgets = new Widgets([]);
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App elem={window.skyrimPlatform.widgets.get()} />
    </Provider>
  </React.StrictMode>
);

// Called from skymp5-functions-lib, chatProperty.ts
window.scrollToLastMessage = () => {
  const _list = document.querySelector('#chat > .chat-main > .list > .chat-list');
  if (_list != null && window.needToScroll) { _list.scrollTop = _list.offsetHeight * _list.offsetHeight; }
};

window.playSound = (name) => {
  (new Audio(require('./sound/' + name).default)).play();
};

if (window.skyrimPlatform?.sendMessage) {
  window.skyrimPlatform.sendMessage('front-loaded');
}
