export interface AnimListItem {
  name: string;
}

interface AnimListState {
  show: boolean;
  list: AnimListItem[];
}

type AnimListAction = {
  type: string;
  data?: { show: boolean; list?: AnimListItem[] | null };
};

const defaultState: AnimListState = {
  show: false,
  list: [],
};

export const animListReducer = (
  state: AnimListState = defaultState,
  action: AnimListAction,
): AnimListState => {
  switch (action.type) {
    case "UPDATE_ANIMLIST_SHOW": {
      return {
        ...state,
        show: action.data!.show,
        list: action.data!.list != null ? action.data!.list : [],
      };
    }
  }
  return state;
};
