import React, { useState } from "react";

import "./styles.scss";
import * as en from "@/assets/locales/en.json";
import * as ru from "@/assets/locales/ru.json";
import { SkyrimFrame } from "@/components/SkyrimFrame/SkyrimFrame";
import { SkyrimHint } from "@/components/SkyrimHint/SkyrimHint";

import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

export type LoginLocale = typeof en;

const LoginPage = () => {
  const locale: LoginLocale = navigator.language !== "ru-RU" ? en : ru;
  const [isGithubHintOpened, setGithubHintOpened] = useState(false);
  const [isPatreonHintOpened, setPatreonHintOpened] = useState(false);
  const [isRegister, setRegister] = useState(false);
  return (
    <div className={"login"}>
      <div className={"login-form"}>
        <div className={"login-form--content"}>
          <div className={"login-form--content_header"}>
            {isRegister ? locale.LOGIN.HEADER_TEXT_REGISTER : locale.LOGIN.HEADER_TEXT_LOGIN}
          </div>
          <div className={"login-form--content_social"}>
            <a
              href={"https://github.com/skyrim-multiplayer/skymp"}
              target={"_blank"}
              rel="noreferrer"
              className={"login-form--content_social__link"}
              onMouseOver={() => {
                setGithubHintOpened(true);
              }}
              onMouseOut={() => setGithubHintOpened(false)}
            >
              <SkyrimHint
                active=""
                text={locale.LOGIN.GITHUB_HINT}
                isOpened={isGithubHintOpened}
                left={true}
              />
              <img src={require("@/assets/img/github.svg").default} alt={"Fork me on Github"} />
            </a>
            <a
              href={"https://github.com/skyrim-multiplayer/skymp"}
              target={"_blank"}
              rel="noreferrer"
              className={"login-form--content_social__link"}
              onMouseOver={() => {
                setPatreonHintOpened(true);
              }}
              onMouseOut={() => setPatreonHintOpened(false)}
            >
              <SkyrimHint
                active=""
                text={locale.LOGIN.PATREON_HINT}
                isOpened={isPatreonHintOpened}
                left={false}
              />
              <img src={require("@/assets/img/patreon.svg").default} alt={"Become a Patron"} />
            </a>
          </div>
          {isRegister ? (
            <RegisterForm locale={locale} setRegister={setRegister} />
          ) : (
            <LoginForm locale={locale} setRegister={setRegister} />
          )}
        </div>
        <SkyrimFrame name="" />
      </div>
    </div>
  );
};

export default LoginPage;
