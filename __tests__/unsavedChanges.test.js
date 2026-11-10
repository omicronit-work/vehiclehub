import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useUnsavedChanges, useDiscardConfirm } from '../src/util/methods/useUnsavedChanges';

// The dialog element is inspected via props, never rendered.
jest.mock('../src/components/AdBanner', () => () => null);

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

test('useDiscardConfirm closes straight away when clean and asks when dirty', () => {
  const discard = jest.fn();
  let api;
  const Probe = ({ dirty }) => {
    api = useDiscardConfirm(dirty, discard);
    return null;
  };
  let root;
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<Probe dirty={false} />);
  });

  ReactTestRenderer.act(() => api[0]());
  expect(discard).toHaveBeenCalledTimes(1);
  expect(api[1].props.visible).toBe(false);

  ReactTestRenderer.act(() => root.update(<Probe dirty />));
  ReactTestRenderer.act(() => api[0]());
  expect(discard).toHaveBeenCalledTimes(1);
  expect(api[1].props.visible).toBe(true);

  ReactTestRenderer.act(() => api[1].props.onConfirm());
  expect(discard).toHaveBeenCalledTimes(2);
  expect(api[1].props.visible).toBe(false);
});
