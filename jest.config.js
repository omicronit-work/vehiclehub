module.exports = {
  preset: 'react-native',
  // The preset only transforms .js/.ts/.tsx; this app's components are .jsx.
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-firebase|@react-native-google-signin|@react-native-documents|@notifee|@react-navigation|toastify-react-native|react-native-.*|react-redux|@reduxjs|redux|immer|reselect|toggle-switch-react-native)/)',
  ],
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js', './jest.setup.js'],
};
