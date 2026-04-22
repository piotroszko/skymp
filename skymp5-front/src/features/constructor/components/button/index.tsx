import React from "react";

import { FrameButton } from "@/components/FrameButton/FrameButton";
import { ImageButton } from "@/components/ImageButton/ImageButton";
import { SkyrimButton } from "@/components/SkyrimButton/SkyrimButton";
import patreonImage from "@/assets/img/patreon.svg";
import githubImage from "@/assets/img/github.svg";

interface ButtonProps {
  css?: string;
  text?: string;
  onClick?: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
}

const Button = ({
  css,
  text = "",
  onClick,
  width,
  height,
  disabled = false,
}: ButtonProps) => {
  switch (css) {
    case "BUTTON_STYLE_FRAME":
      return (
        <FrameButton
          name=""
          disabled={disabled}
          variant="DEFAULT"
          text={text}
          onClick={onClick}
          width={width}
          height={height}
        />
      );
    case "BUTTON_STYLE_FRAME_LEFT":
      return (
        <FrameButton
          name=""
          disabled={disabled}
          variant="LEFT"
          text={text}
          onClick={onClick}
          width={width}
          height={height}
        />
      );
    case "BUTTON_STYLE_FRAME_RIGHT":
      return (
        <FrameButton
          name=""
          disabled={disabled}
          variant="RIGHT"
          text={text}
          onClick={onClick}
          width={width}
          height={height}
        />
      );
    case "BUTTON_STYLE_PATREON":
      return (
        <ImageButton
          name=""
          disabled={disabled}
          src={patreonImage}
          onClick={onClick}
          width={width}
          height={height}
        />
      );
    case "BUTTON_STYLE_GITHUB":
      return (
        <ImageButton
          name=""
          disabled={disabled}
          src={githubImage}
          onClick={onClick}
          width={width}
          height={height}
        />
      );
    default:
      return (
        <SkyrimButton
          name=""
          disabled={disabled}
          text={text}
          onClick={onClick}
          width={width}
          height={height}
        />
      );
  }
};

export default Button;
