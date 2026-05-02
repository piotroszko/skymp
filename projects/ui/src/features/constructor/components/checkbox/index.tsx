import React, { useState } from "react";

import "./styles.scss";

interface CheckBoxProps {
  text: string;
  setChecked: (newValue: boolean) => void;
  initialValue: boolean;
  disabled: boolean;
}

const CheckBox = ({ text, setChecked, initialValue, disabled }: CheckBoxProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <div className={"checkbox_container login-form--content_main__container"}>
      <span className={"checkbox_text"}>{text}</span>
      <label
        onClick={() => {
          if (!disabled) {
            const newval = !value;
            setValue(newval);
            if (setChecked !== undefined) {
              setChecked(newval);
            }
          }
        }}
        className={value ? "checkbox active" : "checkbox"}
        style={{ opacity: disabled ? 0.6 : 1.0 }}
      />
    </div>
  );
};

export default CheckBox;
