import { renderHook } from '@testing-library/react-native';

import { usePressGuard } from './use-press-guard';

describe('usePressGuard', () => {
  it('calls through on the first invocation', async () => {
    const onPress = jest.fn();
    const { result } = await renderHook(() => usePressGuard(onPress, 500));
    result.current();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('swallows a second call that lands inside the cooldown', async () => {
    const onPress = jest.fn();
    const { result } = await renderHook(() => usePressGuard(onPress, 500));
    result.current();
    result.current();
    result.current();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls through again once the cooldown has elapsed', async () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    const { result } = await renderHook(() => usePressGuard(onPress, 500));
    result.current();
    jest.advanceTimersByTime(600);
    result.current();
    expect(onPress).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does nothing when no handler is given', async () => {
    const { result } = await renderHook(() => usePressGuard(undefined));
    expect(() => result.current()).not.toThrow();
  });

  it('forwards arguments through to the handler', async () => {
    const onPress = jest.fn();
    const { result } = await renderHook(() => usePressGuard(onPress, 500));
    const event = { nativeEvent: {} };
    result.current(event);
    expect(onPress).toHaveBeenCalledWith(event);
  });
});
