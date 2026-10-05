import { useState, useEffect } from 'react';
import { Keyboard } from 'react-native';

export const useKeyboardBehavior = () => {
  const [behaviour, setBehaviour] = useState('padding');

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setBehaviour('padding'));
    const hide = Keyboard.addListener('keyboardDidHide', () => setBehaviour(undefined));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return behaviour;
};
