import React, { useState } from "react";

import "./styles.scss";
import * as en from "@/assets/locales/en.json";
import * as ru from "@/assets/locales/ru.json";
import { SkyrimFrame } from "@/components/SkyrimFrame/SkyrimFrame";

import { AccountCharacter, useAuthResult } from "./authBridge";
import CharacterSelectForm from "./CharacterSelectForm";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

export type LoginLocale = typeof en;

type Phase = "login" | "register" | "characters";

const LoginPage = () => {
  const locale: LoginLocale = navigator.language !== "ru-RU" ? en : ru;
  const [phase, setPhase] = useState<Phase>("login");
  const [characters, setCharacters] = useState<AccountCharacter[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  useAuthResult((result) => {
    setInFlight(false);
    switch (result.type) {
      case "registerResult":
        if (result.ok) {
          setErrorMessage(null);
          setPhase("login");
        } else {
          setErrorMessage(result.error ?? "Registration failed");
        }
        return;
      case "loginResult":
        if (result.ok) {
          setErrorMessage(null);
          setCharacters(result.characters ?? []);
          setPhase("characters");
        } else {
          setErrorMessage(result.error ?? "Login failed");
        }
        return;
      case "createCharacterResult":
        if (result.ok) {
          setErrorMessage(null);
          setCharacters(result.characters ?? characters);
        } else {
          setErrorMessage(result.error ?? "Could not create character");
        }
        return;
      case "deleteCharacterResult":
        if (result.ok) {
          setErrorMessage(null);
          setCharacters(result.characters ?? characters);
        } else {
          setErrorMessage(result.error ?? "Could not delete character");
        }
        return;
      case "renameCharacterResult":
        if (result.ok) {
          setErrorMessage(null);
          setCharacters(result.characters ?? characters);
        } else {
          setErrorMessage(result.error ?? "Could not rename character");
        }
        return;
      case "playResult":
        if (!result.ok) {
          setErrorMessage(result.error ?? "Could not start play");
        }
        return;
      case "connectionDenied":
        setErrorMessage(result.error ?? "Connection denied");
        return;
    }
  });

  const setRegister = (value: boolean) => {
    setErrorMessage(null);
    setPhase(value ? "register" : "login");
  };

  const headerText =
    phase === "register"
      ? locale.LOGIN.HEADER_TEXT_REGISTER
      : phase === "characters"
        ? locale.LOGIN.HEADER_TEXT_CHARACTERS
        : locale.LOGIN.HEADER_TEXT_LOGIN;

  return (
    <div className={"login"}>
      <div className={"login-form"}>
        <div className={"login-form--content"}>
          <div className={"login-form--content_header"}>{headerText}</div>
          {phase === "register" ? (
            <RegisterForm
              locale={locale}
              setRegister={setRegister}
              inFlight={inFlight}
              errorMessage={errorMessage}
            />
          ) : phase === "characters" ? (
            <CharacterSelectForm
              locale={locale}
              characters={characters}
              inFlight={inFlight}
              errorMessage={errorMessage}
            />
          ) : (
            <LoginForm
              locale={locale}
              setRegister={setRegister}
              inFlight={inFlight}
              errorMessage={errorMessage}
            />
          )}
        </div>
        <SkyrimFrame name="" />
      </div>
    </div>
  );
};

export default LoginPage;
