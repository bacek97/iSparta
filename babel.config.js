module.exports = {
  plugins: [
    [
      'react-native-worklets-core/plugin',
      {
        functionsToWorkletize: [
          {
            name: 'useFrameProcessor',
            args: [0],
          },
        ],
      },
    ],
  ],
  presets: ['module:@react-native/babel-preset'],
};
