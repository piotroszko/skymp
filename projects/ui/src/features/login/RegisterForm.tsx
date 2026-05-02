import React, { useCallback, useEffect, useState } from "react";

import { SkyrimButton } from "@/components/SkyrimButton/SkyrimButton";
import { SkyrimInput } from "@/components/SkyrimInput/SkyrimInput";

import { LoginLocale } from "./index";
import { requestRegister } from "./authBridge";

interface RegisterFormProps {
  locale: LoginLocale;
  setRegister: (value: boolean) => void;
  inFlight: boolean;
  errorMessage: string | null;
}

interface RegisterData {
  email: string;
  password: string;
  password_verify: string;
}

const RegisterForm = (props: RegisterFormProps) => {
  const [data, setData] = useState<RegisterData>({ email: "", password: "", password_verify: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setData((prev) => ({ ...prev, [target.name]: target.value }));
    setLocalError(null);
  };

  const passwordsMatch = data.password.length > 0 && data.password === data.password_verify;
  const canSubmit = !props.inFlight && data.email.length > 3 && data.password.length >= 1 && passwordsMatch;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    if (!passwordsMatch) {
      setLocalError(props.locale.LOGIN.PASSWORDS_DO_NOT_MATCH ?? "passwords do not match");
      return;
    }
    requestRegister(data.email, data.password);
  }, [canSubmit, data, passwordsMatch, props.locale]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    };
    document.addEventListener("keypress", listener);
    return () => document.removeEventListener("keypress", listener);
  }, [handleSubmit]);

  const errorMessage = props.errorMessage ?? localError;

  return (
    <div className={"login-form--content_main"}>
      <div className={"login-form--content_main__email"}>
        <div className={"login-form--content_main__label"}>
          <span className={"login-form--content_main__label___text"}>{props.locale.LOGIN.EMAIL}</span>
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
          <span className={"login-form--content_main__label___text"}>{props.locale.LOGIN.PASSWORD}</span>
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
          <span className={"login-form--content_main__label___text"}>{props.locale.LOGIN.PASSWORD_VERIFY}</span>
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
      {errorMessage ? (
        <div className={"login-form--content_main__error"} style={{ color: "#ff8a8a", padding: "8px 0" }}>
          {errorMessage}
        </div>
      ) : null}
      <div className={"login-form--content_main__button"}>
        <SkyrimButton
          name=""
          disabled={!canSubmit}
          onClick={handleSubmit}
          text={props.locale.LOGIN.REGISTER_BUTTON_TEXT}
        />
      </div>
      <div className={"login-form--content_main__button"}>
        <SkyrimButton
          name=""
          disabled={false}
          onClick={() => props.setRegister(false)}
          text={props.locale.LOGIN.BACK}
        />
      </div>
    </div>
  );
};

export default RegisterForm;
