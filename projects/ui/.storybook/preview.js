import "!style-loader!css-loader!sass-loader!../src/main.scss";

export const parameters = {
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};
