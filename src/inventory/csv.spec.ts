import { parseCsv, toCsv } from './csv';

describe('parseCsv()', () => {
  it('splits plain rows and fields', () => {
    expect(parseCsv('sku,on_hand\nA-1,5\nB-2,0')).toEqual([
      ['sku', 'on_hand'],
      ['A-1', '5'],
      ['B-2', '0'],
    ]);
  });

  it('keeps commas and newlines inside quoted fields', () => {
    expect(parseCsv('sku,product\nA-1,"Cable, 2m\nbraided"\n')).toEqual([
      ['sku', 'product'],
      ['A-1', 'Cable, 2m\nbraided'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('name\n"The ""Pro"" model"')).toEqual([['name'], ['The "Pro" model']]);
  });

  it('accepts CRLF line endings without leaving stray carriage returns', () => {
    expect(parseCsv('sku,on_hand\r\nA-1,5\r\n')).toEqual([
      ['sku', 'on_hand'],
      ['A-1', '5'],
    ]);
  });

  it('strips a leading UTF-8 BOM (Excel exports)', () => {
    expect(parseCsv('﻿sku,on_hand\nA-1,5')[0]).toEqual(['sku', 'on_hand']);
  });

  it('keeps empty fields, including a trailing one', () => {
    expect(parseCsv('a,,c\nd,e,')).toEqual([
      ['a', '', 'c'],
      ['d', 'e', ''],
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('toCsv()', () => {
  it('quotes only fields that need it and ends every row with CRLF', () => {
    expect(
      toCsv([
        ['sku', 'product'],
        ['A-1', 'Cable, 2m'],
        ['B-2', 'Say "hi"'],
      ]),
    ).toBe('sku,product\r\nA-1,"Cable, 2m"\r\nB-2,"Say ""hi"""\r\n');
  });

  it.each(['=SUM(A1:A2)', '+1', '-1', '@cmd', '\tx'])(
    'neutralises the formula-looking cell %p',
    (value) => {
      expect(toCsv([[value]])).toBe(`'${value}\r\n`);
    },
  );

  it('neutralises and quotes a formula cell that also needs quoting', () => {
    expect(toCsv([['=HYPERLINK("x")']])).toBe(`"'=HYPERLINK(""x"")"\r\n`);
  });

  it('round-trips through parseCsv', () => {
    const rows = [
      ['sku', 'product', 'variant'],
      ['A-1', 'Cable, "braided"', 'Line\nbreak'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
