interface AppState {
  isBrowserFocus: boolean;
}

type AppAction = { type: string; data?: any };

const defaultState: AppState = {
  isBrowserFocus: false,
};

export const appReducer = (state: AppState = defaultState, action: AppAction): AppState => {
  switch (action.type) {
    case "UPDATE_APP_BROWSERFOCUS": {
      return {
        ...state,
        isBrowserFocus: action.data,
      };
    }
  }

  return state;
};
