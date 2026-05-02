import React, { useCallback, useEffect, useRef, useState } from "react";

import { SkyrimButton } from "@/components/SkyrimButton/SkyrimButton";
import { SkyrimInput } from "@/components/SkyrimInput/SkyrimInput";

import {
  AccountCharacter,
  requestCreateCharacter,
  requestDeleteCharacter,
  requestPlay,
  requestRenameCharacter,
} from "./authBridge";
import { LoginLocale } from "./index";

interface CharacterSelectFormProps {
  locale: LoginLocale;
  characters: AccountCharacter[];
  inFlight: boolean;
  errorMessage: string | null;
}

type RowMode = "view" | "edit" | "confirmDelete";

const ROW_WIDTH = 320;
const HALF_BUTTON_WIDTH = 156;
const ROW_GAP = 8;
const SMALL_BUTTON_HEIGHT = 36;

const rowContainerStyle: React.CSSProperties = {
  width: ROW_WIDTH,
  padding: "8px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
};

const sideBySideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: ROW_GAP,
  width: ROW_WIDTH,
  justifyContent: "space-between",
};

const noticeStyle: React.CSSProperties = {
  width: ROW_WIDTH,
  textAlign: "center",
  color: "rgba(157, 158, 158, 0.85)",
};

const nameLabelStyle: React.CSSProperties = {
  width: ROW_WIDTH,
  textAlign: "center",
  color: "#b6b6b6",
  fontSize: 22,
  lineHeight: "26px",
  fontFamily: "Bankir-Retro, serif",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const CharacterSelectForm = (props: CharacterSelectFormProps) => {
  const [rowMode, setRowMode] = useState<Record<number, RowMode>>({});
  const [renameDraft, setRenameDraft] = useState<Record<number, string>>({});
  const renameInputKey = useRef<Record<number, number>>({});

  // After successful rename or deletion, reset that row to view mode.
  const charactersKey = props.characters.map((c) => `${c.profileId}:${c.name}`).join("|");
  useEffect(() => {
    setRowMode({});
    setRenameDraft({});
  }, [charactersKey]);

  const handleCreate = useCallback(() => {
    if (props.inFlight) return;
    requestCreateCharacter();
  }, [props.inFlight]);

  const handlePlay = useCallback(
    (profileId: number) => {
      if (props.inFlight) return;
      requestPlay(profileId);
    },
    [props.inFlight],
  );

  const setRow = (profileId: number, mode: RowMode) =>
    setRowMode((prev) => ({ ...prev, [profileId]: mode }));

  const startRename = (c: AccountCharacter) => {
    setRenameDraft((prev) => ({ ...prev, [c.profileId]: c.name }));
    renameInputKey.current[c.profileId] = (renameInputKey.current[c.profileId] ?? 0) + 1;
    setRow(c.profileId, "edit");
  };

  const cancelRow = (profileId: number) => {
    setRow(profileId, "view");
  };

  const submitRename = (c: AccountCharacter) => {
    if (props.inFlight) return;
    const next = (renameDraft[c.profileId] ?? c.name).trim();
    if (next.length === 0 || next === c.name) {
      cancelRow(c.profileId);
      return;
    }
    const duplicate = props.characters.some(
      (other) =>
        other.profileId !== c.profileId && other.name.trim().toLowerCase() === next.toLowerCase(),
    );
    if (duplicate) return;
    requestRenameCharacter(c.profileId, next);
  };

  const submitDelete = (profileId: number) => {
    if (props.inFlight) return;
    requestDeleteCharacter(profileId);
  };

  const renderRow = (c: AccountCharacter) => {
    const mode = rowMode[c.profileId] ?? "view";

    if (mode === "edit") {
      const draft = (renameDraft[c.profileId] ?? c.name).trim();
      const duplicate =
        draft.length > 0 &&
        props.characters.some(
          (other) =>
            other.profileId !== c.profileId &&
            other.name.trim().toLowerCase() === draft.toLowerCase(),
        );
      const canSave = !props.inFlight && draft.length > 0 && draft !== c.name && !duplicate;

      return (
        <div key={c.profileId} style={rowContainerStyle}>
          <SkyrimInput
            key={renameInputKey.current[c.profileId]}
            labelText=""
            initialValue={c.name}
            width={ROW_WIDTH}
            onInput={(e) =>
              setRenameDraft((prev) => ({
                ...prev,
                [c.profileId]: (e.target as HTMLInputElement).value,
              }))
            }
            placeholder={props.locale.LOGIN.CHARACTER_NAME_PLACEHOLDER}
            type={"text"}
            name={`rename-${c.profileId}`}
          />
          {duplicate ? (
            <div style={{ ...noticeStyle, color: "#ff8a8a" }}>{props.locale.LOGIN.NAME_TAKEN}</div>
          ) : null}
          <div style={sideBySideStyle}>
            <SkyrimButton
              name=""
              disabled={!canSave}
              width={HALF_BUTTON_WIDTH}
              height={SMALL_BUTTON_HEIGHT}
              onClick={() => submitRename(c)}
              text={props.locale.LOGIN.SAVE_BUTTON_TEXT}
            />
            <SkyrimButton
              name=""
              disabled={false}
              width={HALF_BUTTON_WIDTH}
              height={SMALL_BUTTON_HEIGHT}
              onClick={() => cancelRow(c.profileId)}
              text={props.locale.LOGIN.CANCEL_BUTTON_TEXT}
            />
          </div>
        </div>
      );
    }

    if (mode === "confirmDelete") {
      return (
        <div key={c.profileId} style={rowContainerStyle}>
          <div style={noticeStyle}>{`${props.locale.LOGIN.CONFIRM_DELETE} (${c.name})`}</div>
          <div style={sideBySideStyle}>
            <SkyrimButton
              name=""
              disabled={props.inFlight}
              width={HALF_BUTTON_WIDTH}
              height={SMALL_BUTTON_HEIGHT}
              onClick={() => submitDelete(c.profileId)}
              text={props.locale.LOGIN.CONFIRM_YES}
            />
            <SkyrimButton
              name=""
              disabled={false}
              width={HALF_BUTTON_WIDTH}
              height={SMALL_BUTTON_HEIGHT}
              onClick={() => cancelRow(c.profileId)}
              text={props.locale.LOGIN.CONFIRM_NO}
            />
          </div>
        </div>
      );
    }

    return (
      <div key={c.profileId} style={rowContainerStyle}>
        <div style={nameLabelStyle} title={c.name}>
          {c.name}
        </div>
        <SkyrimButton
          name=""
          disabled={props.inFlight}
          width={ROW_WIDTH}
          onClick={() => handlePlay(c.profileId)}
          text={props.locale.LOGIN.PLAY_BUTTON_TEXT}
        />
        <div style={sideBySideStyle}>
          <SkyrimButton
            name=""
            disabled={props.inFlight}
            width={HALF_BUTTON_WIDTH}
            height={SMALL_BUTTON_HEIGHT}
            onClick={() => startRename(c)}
            text={props.locale.LOGIN.EDIT_BUTTON_TEXT}
          />
          <SkyrimButton
            name=""
            disabled={props.inFlight}
            width={HALF_BUTTON_WIDTH}
            height={SMALL_BUTTON_HEIGHT}
            onClick={() => setRow(c.profileId, "confirmDelete")}
            text={props.locale.LOGIN.DELETE_BUTTON_TEXT}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={"login-form--content_main"}>
      {props.characters.length === 0 ? (
        <div style={{ padding: "8px 0" }}>{props.locale.LOGIN.NO_CHARACTERS_HINT}</div>
      ) : null}

      {props.characters.map(renderRow)}

      <div className={"login-form--content_main__button"}>
        <SkyrimButton
          name=""
          disabled={props.inFlight}
          onClick={handleCreate}
          text={props.locale.LOGIN.CREATE_CHARACTER_BUTTON_TEXT}
        />
      </div>

      {props.errorMessage ? (
        <div
          className={"login-form--content_main__error"}
          style={{ color: "#ff8a8a", padding: "8px 0" }}
        >
          {props.errorMessage}
        </div>
      ) : null}
    </div>
  );
};

export default CharacterSelectForm;
