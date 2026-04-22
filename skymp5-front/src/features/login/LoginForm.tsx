import React, { useEffect, useState } from "react";
import { SkyrimButton } from "../../components/SkyrimButton/SkyrimButton";
import { SkyrimInput } from "../../components/SkyrimInput/SkyrimInput";
import { toggleClass } from "../../utils/toggleClass";
import { SkyrimHint } from "../../components/SkyrimHint/SkyrimHint";
import { LoginLocale } from "./index";

interface LoginFormProps {
  locale: LoginLocale;
  setRegister: (value: boolean) => void;
}

interface LoginData {
  email: string;
  password: string;
}

const LoginForm = (props: LoginFormProps) => {
  const [data, setData] = useState<LoginData>({
    email: localStorage.getItem("email") ? (localStorage.getItem("email") as string) : "",
    password: localStorage.getItem("password") ? (localStorage.getItem("password") as string) : "",
  });
  const [isButtonDisabled, setButtonDisabled] = useState(
    !(localStorage.getItem("email") && localStorage.getItem("password")),
  );
  const [isRemember, setRemember] = useState(true);
  const [isRegisterHintOpened, setRegisterHintOpened] = useState(false);
  const [isRememberHintOpened, setRememberHintOpened] = useState(false);
  const [isPasswordShowed] = useState(false);
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setData({ ...data, [target.name]: target.value });
    if (data.email.length > 5 && data.password.length > 3) {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
    if (target.value === "") {
      setButtonDisabled(true);
    }
  };
  const handleLogin = (credentials: LoginData) => {
    if (isRemember) {
      localStorage.setItem("email", credentials.email);
      localStorage.setItem("password", credentials.password);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isButtonDisabled) {
        handleLogin(data);
      }
    };
    document.addEventListener("keypress", listener);
    return () => document.removeEventListener("keypress", listener);
  }, [data, isButtonDisabled]);
  return (
    <div className={"login-form--content_main"}>
      <div className={"login-form--content_main__email"}>
        <div className={"login-form--content_main__label"}>
          <span className={"login-form--content_main__label___text"}>
            {props.locale.LOGIN.EMAIL}
          </span>
          <img src={require("../../img/mail.svg").default} alt="" />
        </div>
        <SkyrimInput
          labelText=""
          initialValue={localStorage.getItem("email") ?? ""}
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
          <img src={require("../../img/password.svg").default} alt="" />
        </div>
        <SkyrimInput
          labelText=""
          initialValue={localStorage.getItem("password") ?? ""}
          onInput={handleInput}
          placeholder={props.locale.LOGIN.PASSWORD_PLACEHOLDER}
          type={isPasswordShowed ? "text" : "password"}
          name={"password"}
        />
      </div>
      <div className={"login-form--content_main__footer"}>
        <div className={"login-form--content_main__label login-form--content_main__container"}>
          <SkyrimHint
            active=""
            text={props.locale.LOGIN.REMEMBER_HINT}
            isOpened={isRememberHintOpened}
            left={true}
          />
          <span className={"login-form--content_main__label___text"}>
            {props.locale.LOGIN.REMEMBER_PLACEHOLDER}
          </span>
          <label
            htmlFor="cbtest"
            className={"checkbox active"}
            onClick={(e) => {
              if (isRemember) setRemember(false);
              else setRemember(true);
              toggleClass(e.target as Element, "active");
            }}
            onMouseOver={() => {
              setRememberHintOpened(true);
            }}
            onMouseOut={() => setRememberHintOpened(false)}
          />
        </div>
        <div
          className={`skymp-input button ${!isButtonDisabled ? "disabled" : ""}`}
          onClick={() => {
            if (isButtonDisabled) {
              props.setRegister(true);
            }
          }}
          onMouseOver={() => {
            if (isButtonDisabled) {
              setRegisterHintOpened(true);
            }
          }}
          onMouseOut={() => setRegisterHintOpened(false)}
        >
          <span className={"skymp-input_text"}>{props.locale.LOGIN.REGISTER_BUTTON}</span>
          <SkyrimHint
            active=""
            text={props.locale.LOGIN.REGISTER_HINT}
            isOpened={isRegisterHintOpened}
            left={false}
          />
        </div>
      </div>
      <div className={"login-form--content_main__button"}>
        <SkyrimButton
          name=""
          disabled={isButtonDisabled}
          onClick={() => {
            handleLogin(data);
          }}
          text={props.locale.LOGIN.LOGIN_BUTTON_TEXT}
        />
      </div>
    </div>
  );
};

export default LoginForm;
