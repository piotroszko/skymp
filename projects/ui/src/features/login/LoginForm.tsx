import React, { useCallback, useEffect, useState } from "react";

import { SkyrimButton } from "@/components/SkyrimButton/SkyrimButton";
import { SkyrimInput } from "@/components/SkyrimInput/SkyrimInput";

import { requestLogin } from "./authBridge";
import { LoginLocale } from "./index";

interface LoginFormProps {
  locale: LoginLocale;
  setRegister: (value: boolean) => void;
  inFlight: boolean;
  errorMessage: string | null;
}

interface LoginData {
  email: string;
  password: string;
}

const rememberedEmail = (): string => {
  try {
    return localStorage.getItem("auth_email") ?? "";
  } catch {
    return "";
  }
};

const LoginForm = (props: LoginFormProps) => {
  const [data, setData] = useState<LoginData>({ email: rememberedEmail(), password: "" });
  const [isRemember, setRemember] = useState(true);

  const isButtonDisabled = props.inFlight || data.email.length < 3 || data.password.length < 1;

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setData((prev) => ({ ...prev, [target.name]: target.value }));
  };

  const handleLogin = useCallback(() => {
    if (isButtonDisabled) return;
    if (isRemember) {
      try {
        localStorage.setItem("auth_email", data.email);
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem("auth_email");
      } catch {
        // ignore
      }
    }
    requestLogin(data.email, data.password);
  }, [data, isButtonDisabled, isRemember]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleLogin();
      }
    };
    document.addEventListener("keypress", listener);
    return () => document.removeEventListener("keypress", listener);
  }, [handleLogin]);

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
          initialValue={data.email}
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
      <div className={"login-form--content_main__footer"}>
        <div className={"login-form--content_main__label login-form--content_main__container"}>
          <span className={"login-form--content_main__label___text"}>
            {props.locale.LOGIN.REMEMBER_PLACEHOLDER}
          </span>
          <label
            htmlFor="cbtest"
            className={`checkbox${isRemember ? " active" : ""}`}
            onClick={() => setRemember((v) => !v)}
          />
        </div>
        <div className={`skymp-input button`} onClick={() => props.setRegister(true)}>
          <span className={"skymp-input_text"}>{props.locale.LOGIN.REGISTER_BUTTON}</span>
        </div>
      </div>
      {props.errorMessage ? (
        <div
          className={"login-form--content_main__error"}
          style={{ color: "#ff8a8a", padding: "8px 0" }}
        >
          {props.errorMessage}
        </div>
      ) : null}
      <div className={"login-form--content_main__button"}>
        <SkyrimButton
          name=""
          disabled={isButtonDisabled}
          onClick={handleLogin}
          text={props.locale.LOGIN.LOGIN_BUTTON_TEXT}
        />
      </div>
    </div>
  );
};

export default LoginForm;
