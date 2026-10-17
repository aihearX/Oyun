/* global jest */
// AsyncStorage: bellek içi taklit (persist ara katmanı için).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
