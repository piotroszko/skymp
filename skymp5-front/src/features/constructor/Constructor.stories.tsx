import type { Meta, StoryObj } from "@storybook/react-webpack5";
import Constructor from ".";
import type { ChatWidget, FormWidget } from "./types";

const meta: Meta<typeof Constructor> = {
  title: "features/Constructor",
  component: Constructor,
};
export default meta;

type Story = StoryObj<typeof Constructor>;

const formWidget: FormWidget = {
  type: "form",
  caption: "Sign in",
  elements: [
    { type: "text", text: "Welcome back, traveler." },
    {
      type: "inputText",
      placeholder: "Username",
      initialValue: "",
      width: 320,
      height: 48,
    },
    {
      type: "inputPass",
      placeholder: "Password",
      initialValue: "",
      width: 320,
      height: 48,
    },
    {
      type: "checkBox",
      text: "Remember me",
      initialValue: false,
    },
    {
      type: "button",
      text: "Login",
      width: 320,
      height: 60,
    },
    {
      type: "icon",
      text: "",
      width: 48,
      height: 48,
      tags: ["ICON_STYLE_KEY"],
      hint: "Your secret key",
    },
  ],
};

export const Form: Story = {
  args: {
    elem: formWidget,
    width: 512,
    height: 704,
  },
};

export const FormDynamicSize: Story = {
  args: {
    elem: formWidget,
    dynamicSize: true,
  },
};

const chatWidget: ChatWidget = {
  type: "chat",
  messages: [],
  send: () => undefined,
  placeholder: "Type a message...",
  isInputHidden: false,
};

export const Chat: Story = {
  args: {
    elem: chatWidget,
  },
};
