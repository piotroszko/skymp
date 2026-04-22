const path = require("path");

module.exports = {
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-docs",
  ],
  webpackFinal: async (config) => {
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve("babel-loader"),
          options: {
            presets: [
              require.resolve("@babel/preset-env"),
              [require.resolve("@babel/preset-react"), { runtime: "automatic" }],
              require.resolve("@babel/preset-typescript"),
            ],
          },
        },
      ],
    });
    config.resolve.extensions.push(".ts", ".tsx");

    config.module.rules.push({
      test: /\.scss$/,
      use: ["style-loader", "css-loader", "sass-loader"],
      include: path.resolve(__dirname, "../"),
    });
    return config;
  },
};
