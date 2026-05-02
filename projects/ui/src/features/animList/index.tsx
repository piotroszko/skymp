import React from "react";
import { connect } from "react-redux";

import "./styles.scss";
import { AnimListItem } from "./reducer";

interface AnimListStateProps {
  show: boolean;
  list: AnimListItem[];
}

interface AnimListDispatchProps {
  updateShow: (data: { show: boolean; list?: AnimListItem[] | null }) => void;
}

type AnimListProps = AnimListStateProps & AnimListDispatchProps;

class AnimList extends React.Component<AnimListProps> {
  componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown.bind(this));
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown.bind(this));
  }

  onKeyDown(_e: KeyboardEvent) {
    // no-op
  }

  getAnimList() {
    return this.props.list.map((anim, index) => (
      <div
        className="anim"
        key={`anim-${index}`}
        onClick={() => {
          this.props.updateShow({ show: false });
          window.mp?.send("cef::chat:send", `/anim ${index}`);
        }}
      >
        {anim.name}
      </div>
    ));
  }

  render() {
    return this.props.show ? <div id="animList">{this.getAnimList()}</div> : null;
  }
}

const mapStateToProps = (state: { animListReducer: AnimListStateProps }): AnimListStateProps => {
  const defaultState = state.animListReducer;
  return {
    show: defaultState.show,
    list: defaultState.list,
  };
};

const mapDispatchToProps = (
  dispatch: (action: { type: string; data: unknown }) => void,
): AnimListDispatchProps => ({
  updateShow: (data) =>
    dispatch({
      type: "UPDATE_ANIMLIST_SHOW",
      data,
    }),
});

export default connect(mapStateToProps, mapDispatchToProps)(AnimList);
