import { combineReducers } from "@reduxjs/toolkit";

import { animListReducer } from "../features/animList/reducer";
import { chatReducer } from "../features/chat/reducer";
import { appReducer } from "../reducers/app";
import { commandReducer } from "../reducers/command";

export const rootReducer = combineReducers({
  commandReducer,
  appReducer,
  chatReducer,
  animListReducer,
});
