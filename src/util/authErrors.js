// Maps Firebase Auth error codes to field-level / form-level messages, so a
// network failure never reads as "wrong password".
// Returns { email?, password?, form? }.
export const mapAuthError = (code, mode = 'signIn') => {
  switch (code) {
    case 'auth/invalid-email':
      return { email: 'Enter a valid email address.' };
    case 'auth/user-not-found':
      return { email: 'No account found with this email.' };
    case 'auth/wrong-password':
      return { password: 'Incorrect password. Try again or reset it.' };
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return { form: 'Email or password is incorrect.' };
    case 'auth/email-already-in-use':
      return { email: 'This email is already registered. Try signing in.' };
    case 'auth/weak-password':
      return { password: 'Use at least 6 characters.' };
    case 'auth/user-disabled':
      return { form: 'This account has been disabled.' };
    case 'auth/too-many-requests':
      return { form: 'Too many attempts. Wait a few minutes or reset your password.' };
    case 'auth/network-request-failed':
      return { form: 'No connection. Check your internet and try again.' };
    default:
      return {
        form: mode === 'signUp'
          ? "Couldn't create your account. Try again."
          : "Couldn't sign in. Try again.",
      };
  }
};

// Autocomplete often appends a trailing space; Firebase rejects it.
export const normalizeEmail = email => (email || '').trim();

export const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
