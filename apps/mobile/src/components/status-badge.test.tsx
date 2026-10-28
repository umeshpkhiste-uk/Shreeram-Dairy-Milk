import { render, screen } from '@testing-library/react-native';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the given label', async () => {
    await render(<StatusBadge label="Delivered" tone="success" />);
    expect(screen.getByText('Delivered')).toBeTruthy();
  });

  it('defaults to a neutral tone', async () => {
    await render(<StatusBadge label="Pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});
