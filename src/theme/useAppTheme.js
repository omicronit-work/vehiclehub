import { useSelector } from 'react-redux';
import { themes } from './tokens';

// Redux is the only theme source of truth (App loads the saved choice into
// it before the splash hides), so every screen agrees on light/dark.
export const useAppTheme = () => {
  const theme = useSelector(state => state.theme.theme);
  return theme === 'dark' ? themes.dark : themes.light;
};
