import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { useUnsavedChanges, confirmDiscard } from '../src/util/methods/useUnsavedChanges';

const renderDirty = (snapshot, cleanKey) => {
  let dirty;
  const Probe = props => {
    dirty = useUnsavedChanges(props.snapshot, props.cleanKey);
    return null;
  };
  let root;
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<Probe snapshot={snapshot} cleanKey={cleanKey} />);
  });
  return {
    get dirty() {
      return dirty;
    },
    update: (s, k) =>
      ReactTestRenderer.act(() => root.update(<Probe snapshot={s} cleanKey={k} />)),
  };
};

test('an untouched form is clean, an edited one is dirty', () => {
  const probe = renderDirty({ brand: '' });
  expect(probe.dirty).toBe(false);
  probe.update({ brand: 'Toyota' });
  expect(probe.dirty).toBe(true);
  probe.update({ brand: '' });
  expect(probe.dirty).toBe(false);
});

test('prefilled values count as clean when cleanKey changes with them', () => {
  const probe = renderDirty({ brand: '' }, 0);
  probe.update({ brand: 'Honda' }, 1); // edit sheet prefill
  expect(probe.dirty).toBe(false);
  probe.update({ brand: 'Hondaa' }, 1);
  expect(probe.dirty).toBe(true);
});

test('confirmDiscard closes straight away when clean and asks when dirty', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const discard = jest.fn();

  confirmDiscard(false, discard);
  expect(discard).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();

  confirmDiscard(true, discard);
  expect(discard).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(1);
  const buttons = alert.mock.calls[0][2];
  buttons.find(b => b.text === 'Discard').onPress();
  expect(discard).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});
