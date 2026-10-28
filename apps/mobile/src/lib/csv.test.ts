import { toCsv } from './csv';

describe('toCsv', () => {
  it('joins headers and rows with CRLF', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']]);
    expect(csv).toBe('A,B\r\n1,2');
  });

  it('quotes a field containing a comma, quote, or newline', () => {
    const csv = toCsv(['Name'], [['Smith, John']]);
    expect(csv).toBe('Name\r\n"Smith, John"');
  });

  it('escapes an embedded quote by doubling it', () => {
    const csv = toCsv(['Note'], [['She said "hi"']]);
    expect(csv).toBe('Note\r\n"She said ""hi"""');
  });

  it('leaves plain numbers and text unquoted', () => {
    const csv = toCsv(['Amount'], [[100.5]]);
    expect(csv).toBe('Amount\r\n100.5');
  });
});
