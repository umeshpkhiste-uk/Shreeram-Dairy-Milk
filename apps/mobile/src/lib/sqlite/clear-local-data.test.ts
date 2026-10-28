import * as SQLite from 'expo-sqlite';

import { clearAllLocalData } from './clear-local-data';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

describe('clearAllLocalData', () => {
  it('deletes every local table inside one transaction', () => {
    const execSync = jest.fn();
    const withTransactionSync = jest.fn((cb: () => void) => cb());
    (SQLite.openDatabaseSync as jest.Mock).mockReturnValue({
      execSync,
      withTransactionSync,
      getFirstSync: jest.fn(() => ({ user_version: 1 })),
    });

    clearAllLocalData();

    expect(withTransactionSync).toHaveBeenCalledTimes(1);
    const statements = execSync.mock.calls.map((call) => call[0] as string);
    expect(statements).toEqual([
      'delete from sync_outbox',
      'delete from local_deliveries',
      'delete from cached_customers',
      'delete from cached_milk_types',
      'delete from sync_meta',
    ]);
  });
});
