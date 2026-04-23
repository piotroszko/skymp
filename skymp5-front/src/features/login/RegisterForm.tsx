import React, { useEffect, useState } from "react";

import { SkyrimButton } from "@/components/SkyrimButton/SkyrimButton";
import { SkyrimInput } from "@/components/SkyrimInput/SkyrimInput";

import { LoginLocale } from "./index";

interface RegisterFormProps {
  locale: LoginLocale;
  setRegister: (value: boolean) => void;
}

interface RegisterData {
  email: string;
  password: string;
}

const RegisterForm = (props: RegisterFormProps) => {
  const [data, setData] = useState<RegisterData>({
    email: "",
    password: "",
  });
  const [isButtonBack, setButtonBack] = useState(true);
  const [isButtonDisabled, setButtonDisabled] = useState(true);
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.name === "password_verify") {
      console.log(data.password, target.value);
      setButtonDisabled(data.password !== target.value);
    } else {
      setData({ ...data, [target.name]: target.value });
      if (data.email.length > 5 && data.password.length > 3) {
        console.log(true);
        setButtonBack(false);
      } else {
        setButtonBack(true);
      }
    }

    console.log(data);
  };
  const handleSubmit = () => {
    console.log("submit", data);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      console.log(e.key, isButtonBack, e.key === "Enter");
      if (e.key === "Enter" && !isButtonBack) {
        handleSubmit();
      }
    };
    document.addEventListener("keypress", listener);
    return () => document.removeEventListener("keypress", listener);
  }, [data, isButtonBack]);
  return (
    <div className={"login-form--content_main"}>
      <div className={"login-form--content_main__email"}>
        <div className={"login-form--content_main__label"}>
          <span className={"login-form--content_main__label___text"}>
            {props.locale.LOGIN.EMAIL}
          </span>
          <img src={require("@/assets/img/mail.svg").default} alt="" />
        </div>
        <SkyrimInput
          labelText=""
          initialValue=""
          onInput={handleInput}
          placeholder={props.locale.LOGIN.EMAIL_PLACEHOLDER}
          type={"text"}
          name={"email"}
        />
      </div>
      <div className={"login-form--content_main__password"}>
        <div className={"login-form--content_main__label"}>
          <span className={"login-form--content_main__label___text"}>
            {props.locale.LOGIN.PASSWORD}
          </span>
          <img src={require("@/assets/img/password.svg").default} alt="" />
        </div>
        <SkyrimInput
          labelText=""
          initialValue=""
          onInput={handleInput}
          placeholder={props.locale.LOGIN.PASSWORD_PLACEHOLDER}
          type={"password"}
          name={"password"}
        />
      </div>
      <div className={"login-form--content_main__password"}>
        <div className={"login-form--content_main__label"}>
          <span className={"login-form--content_main__label___text"}>
            {props.locale.LOGIN.PASSWORD_VERIFY}
          </span>
          <img src={require("@/assets/img/password.svg").default} alt="" />
        </div>
        <SkyrimInput
          labelText=""
          initialValue=""
          onInput={handleInput}
          placeholder={props.locale.LOGIN.PASSWORD_VERIFY_PLACEHOLDER}
          type={"password"}
          name={"password_verify"}
        />
      </div>
      <div className={"login-form--content_main__button"}>
        <SkyrimButton
          name=""
          disabled={!isButtonBack && isButtonDisabled}
          onClick={() => {
            if (isButtonBack) {
              props.setRegister(false);
            } else {
              console.log(data);
            }
          }}
          text={isButtonBack ? props.locale.LOGIN.BACK : props.locale.LOGIN.LOGIN_BUTTON_TEXT}
        />
      </div>
    </div>
  );
};

export default RegisterForm;
