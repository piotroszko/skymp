import React from "react";

import "./styles.scss";

interface TextProps {
  text?: string;
}

const Text = ({ text = "" }: TextProps) => {
  return (
    <div className={"skyrimText"}>
      <span>{text}</span>
    </div>
  );
};

export default Text;
