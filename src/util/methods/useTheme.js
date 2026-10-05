import { useSelector } from 'react-redux';

// Returns true in dark mode. Reads Redux only — mixing in AsyncStorage let a
// stale stored 'dark' win over the live setting.
export const useTheme = () => useSelector(store => store.theme.theme) === 'dark';
