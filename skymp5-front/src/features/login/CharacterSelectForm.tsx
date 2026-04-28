import React, { useCallback, useState } from "react";

import { SkyrimButton } from "@/components/SkyrimButton/SkyrimButton";
import { SkyrimInput } from "@/components/SkyrimInput/SkyrimInput";

import { LoginLocale } from "./index";
import { AccountCharacter, requestCreateCharacter, requestPlay } from "./authBridge";

interface CharacterSelectFormProps {
  locale: LoginLocale;
  characters: AccountCharacter[];
  inFlight: boolean;
  errorMessage: string | null;
}

const CharacterSelectForm = (props: CharacterSelectFormProps) => {
  const [showCreate, setShowCreate] = useState(props.characters.length === 0);
  const [name, setName] = useState("");

  const handleCreate = useCallback(() => {
    if (props.inFlight) return;
    if (name.trim().length === 0) return;
    requestCreateCharacter(name.trim());
  }, [name, props.inFlight]);

  const handlePlay = useCallback(
    (profileId: number) => {
      if (props.inFlight) return;
      requestPlay(profileId);
    },
    [props.inFlight],
  );

  return (
    <div className={"login-form--content_main"}>
      {props.characters.length === 0 && !showCreate ? (
        <div style={{ padding: "8px 0" }}>{props.locale.LOGIN.NO_CHARACTERS_HINT}</div>
      ) : null}

      {props.characters.map((c) => (
        <div className={"login-form--content_main__button"} key={c.profileId}>
          <SkyrimButton
            name=""
            disabled={props.inFlight}
            onClick={() => handlePlay(c.profileId)}
            text={`${c.name} — ${props.locale.LOGIN.PLAY_BUTTON_TEXT}`}
          />
        </div>
      ))}

      {showCreate ? (
        <>
          <div className={"login-form--content_main__email"}>
            <div className={"login-form--content_main__label"}>
              <span className={"login-form--content_main__label___text"}>
                {props.locale.LOGIN.CHARACTER_NAME}
              </span>
            </div>
            <SkyrimInput
              labelText=""
              initialValue=""
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder={props.locale.LOGIN.CHARACTER_NAME_PLACEHOLDER}
              type={"text"}
              name={"name"}
            />
          </div>
          <div className={"login-form--content_main__button"}>
            <SkyrimButton
              name=""
              disabled={props.inFlight || name.trim().length === 0}
              onClick={handleCreate}
              text={props.locale.LOGIN.CREATE_CHARACTER_BUTTON_TEXT}
            />
          </div>
          {props.characters.length > 0 ? (
            <div className={"login-form--content_main__button"}>
              <SkyrimButton
                name=""
                disabled={false}
                onClick={() => setShowCreate(false)}
                text={props.locale.LOGIN.BACK}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className={"login-form--content_main__button"}>
          <SkyrimButton
            name=""
            disabled={false}
            onClick={() => setShowCreate(true)}
            text={props.locale.LOGIN.CREATE_CHARACTER_BUTTON_TEXT}
          />
        </div>
      )}

      {props.errorMessage ? (
        <div className={"login-form--content_main__error"} style={{ color: "#ff8a8a", padding: "8px 0" }}>
          {props.errorMessage}
        </div>
      ) : null}
    </div>
  );
};

export default CharacterSelectForm;
