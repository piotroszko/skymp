import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { FrameButton } from "./FrameButton";

const meta: Meta<typeof FrameButton> = {
  title: "buttons/FrameButton",
  component: FrameButton,
};
export default meta;

type Story = StoryObj<typeof FrameButton>;

export const Default: Story = {
  args: {
    disabled: false,
    variant: "DEFAULT",
    text: "Test",
    width: 320,
    height: 60,
  },
};

export const Left: Story = {
  args: {
    disabled: false,
    variant: "LEFT",
    text: "Test",
    width: 320,
    height: 60,
  },
};

export const Right: Story = {
  args: {
    disabled: false,
    variant: "RIGHT",
    text: "Test",
    width: 320,
    height: 60,
  },
};
