import { mapAuthError, normalizeEmail, isValidEmail } from '../src/util/authErrors';

test('network and rate-limit errors are not reported as a wrong password', () => {
  expect(mapAuthError('auth/network-request-failed')).toEqual({
    form: 'No connection. Check your internet and try again.',
  });
  expect(mapAuthError('auth/too-many-requests').password).toBeUndefined();
});

test('credential errors land on the right field', () => {
  expect(mapAuthError('auth/wrong-password').password).toBeTruthy();
  expect(mapAuthError('auth/user-not-found').email).toBeTruthy();
  expect(mapAuthError('auth/invalid-credential').form).toBeTruthy();
});

test('a trailing space from autocomplete does not fail validation', () => {
  expect(normalizeEmail(' me@example.com ')).toBe('me@example.com');
  expect(isValidEmail('me@example.com ')).toBe(true);
  expect(isValidEmail('not-an-email')).toBe(false);
});
