import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it('renders its label', async () => {
    await render(<Button label="Save customer" onPress={() => {}} />);
    expect(screen.getByText('Save customer')).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save customer" onPress={onPress} />);
    fireEvent.press(screen.getByText('Save customer'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save customer" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Save customer'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a loading indicator instead of the label when loading', async () => {
    await render(<Button label="Save customer" onPress={() => {}} loading />);
    expect(screen.queryByText('Save customer')).toBeNull();
  });
});
