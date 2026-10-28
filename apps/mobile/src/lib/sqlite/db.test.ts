/**
 * The versioned-migration runner (`migrate()` in db.ts) is what makes local
 * database upgrades safe across app updates and restarts — see
 * docs/security-review.md, "Local database migrations". Exercised here with
 * a fake `expo-sqlite` database that just records what ran, since the real
 * native module isn't available under Jest.
 */
function makeFakeDatabase(initialUserVersion: number) {
  const executed: string[] = [];
  let userVersion = initialUserVersion;

  const database = {
    getFirstSync: jest.fn(() => ({ user_version: userVersion })),
    execSync: jest.fn((sql: string) => {
      executed.push(sql);
      const match = /pragma user_version\s*=\s*(\d+)/i.exec(sql);
      if (match) userVersion = Number(match[1]);
    }),
    withTransactionSync: jest.fn((cb: () => void) => cb()),
  };

  return { database, executed, getUserVersion: () => userVersion };
}

describe('getDb migration runner', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('runs every migration statement and advances PRAGMA user_version on a brand-new database', () => {
    const { database, executed, getUserVersion } = makeFakeDatabase(0);
    jest.doMock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => database) }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require('./db');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MIGRATIONS, LATEST_VERSION } = require('./schema');

    getDb();

    const expectedStatementCount = MIGRATIONS.reduce(
      (n: number, m: { statements: string[] }) => n + m.statements.length,
      0,
    );
    const createStatements = executed.filter((s) => !/^pragma/i.test(s));
    expect(createStatements).toHaveLength(expectedStatementCount);
    expect(getUserVersion()).toBe(LATEST_VERSION);
  });

  it('is idempotent across an app restart: re-opening an already-migrated database re-runs nothing', () => {
    const { database, executed } = makeFakeDatabase(1);
    jest.doMock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => database) }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require('./db');
    getDb();

    expect(executed).toHaveLength(0);
  });

  it('refuses to open a local database newer than the app understands, instead of silently corrupting it', () => {
    const { database } = makeFakeDatabase(999);
    jest.doMock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => database) }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require('./db');
    expect(() => getDb()).toThrow(/newer than the app supports/);
  });
});
