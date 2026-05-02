import React, { ReactNode } from "react";

import discordSVG from "@/assets/img/discord.svg";
import mailSVG from "@/assets/img/mail.svg";
import passwordSVG from "@/assets/img/password.svg";
import skympSVG from "@/assets/img/skymp.svg";

interface IconProps {
  css?: string;
  text?: string;
  width?: number;
  height?: number;
  disabled?: boolean;
}

const Icon = ({ css, text = "" }: IconProps) => {
  let image: ReactNode = "";

  switch (css) {
    case "ICON_STYLE_MAIL":
      image = <img src={mailSVG} />;
      break;
    case "ICON_STYLE_KEY":
      image = <img src={passwordSVG} />;
      break;
    case "ICON_STYLE_SKYMP":
      image = <img src={skympSVG} />;
      break;
    case "ICON_STYLE_DISCORD":
      image = <img src={discordSVG} />;
      break;
    default:
      break;
  }

  return (
    <div className={"login-form--content_main__label"}>
      <span className={"login-form--content_main__label___text"}>{text}</span>
      {image}
    </div>
  );
};

export default Icon;
