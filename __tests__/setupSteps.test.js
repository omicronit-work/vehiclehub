import AsyncStorage from '@react-native-async-storage/async-storage';
import { planSetup, saveSetup } from '../src/modals/setup/setupSteps';
import { setLanguage } from '../src/i18n';

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => setLanguage('en'));

test('a fresh phone asks for language, country and currency in one go', async () => {
  expect(await planSetup({ beforeSignIn: true })).toEqual(['language', 'country', 'currency']);
});

test('only what is still unknown is asked', async () => {
  await setLanguage('th');
  expect(await planSetup({ beforeSignIn: true })).toEqual(['country', 'currency']);

  await saveSetup({ beforeSignIn: true }, { country: 'TH', currency: 'THB' });
  expect(await planSetup({ beforeSignIn: true })).toEqual([]);
});
