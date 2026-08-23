import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/ui/jetpack-compose', () => {
  const react = require('react') as typeof import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    react.createElement(react.Fragment, null, children);
  const host =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      react.createElement(name, props, children);
  const DropdownMenuItem = Object.assign(host('DropdownMenuItem'), { Text: passthrough });

  return {
    ExposedDropdownMenuBox: passthrough,
    ExposedDropdownMenu: passthrough,
    DropdownMenuItem,
    OutlinedButton: host('OutlinedButton'),
    Icon: host('Icon'),
    Spacer: host('Spacer'),
    Text: passthrough,
  };
});

jest.mock('../assets/icons/expand_more.xml', () => 1, { virtual: true });

jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  menuAnchor: () => ({}),
  fillMaxWidth: () => ({}),
  weight: () => ({}),
  width: () => ({}),
}));

import { AppDropdown } from '../components/ui/AppDropdown.android';

const options = [
  { label: 'Follow system', value: 'system' },
  { label: 'English', value: 'en' },
];

describe('AppDropdown Android', () => {
  it('selects an option from the selector menu', () => {
    const onSelect = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppDropdown options={options} selectedValue="system" onSelect={onSelect} />
      );
    });

    act(() => {
      renderer.root.findAllByType('DropdownMenuItem' as never)[1].props.onClick();
    });

    expect(onSelect).toHaveBeenCalledWith('en');
  });
});
