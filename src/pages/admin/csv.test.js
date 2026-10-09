// CSV for the admin back office (AW-114): RFC 4180 quoting, CRLF and a BOM,
// the formula guard, parsing and a round trip, and the download.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOM, CsvError, csvCell, downloadCsv, parseCsv, toCsv, unguardCell } from './csv.js';

describe('toCsv', () => {
  it('starts with a BOM, ends records with CRLF and quotes only where needed', () => {
    const text = toCsv([['id', 'name', 'price'], [1, 'Kite, red', 12.5], [2, 'Say "hi"', null], [3, 'Two\nlines', '']]);
    expect(text.startsWith(BOM)).toBe(true);
    expect(text.slice(1)).toBe('id,name,price\r\n1,"Kite, red",12.5\r\n2,"Say ""hi""",\r\n3,"Two\nlines",\r\n');
  });

  it('defuses cells a spreadsheet would run as a formula', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('\rx')).toBe('"\'\rx"');
    expect(csvCell('=HYPERLINK("http://x.test","a")')).toBe('"\'=HYPERLINK(""http://x.test"",""a"")"');
    // Numbers and booleans are data, not text someone typed.
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(false)).toBe('false');
    expect(csvCell('Kite')).toBe('Kite');
    expect(csvCell("'quoted")).toBe("'quoted");
  });
});

describe('parseCsv', () => {
  it('reads quotes, doubled quotes, commas and line breaks inside quotes', () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\r\nlines"\r\nd,,f\n')).toEqual([
      ['a', 'b, c', 'say "hi"', 'two\r\nlines'],
      ['d', '', 'f'],
    ]);
  });

  it('drops a BOM, accepts LF, CRLF and CR line ends, and adds no record for a final line break', () => {
    expect(parseCsv(`${BOM}sku,name\nAW-1,One\rAW-2,Two\r\n`)).toEqual([['sku', 'name'], ['AW-1', 'One'], ['AW-2', 'Two']]);
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
    expect(parseCsv('a,')).toEqual([['a', '']]);
    expect(parseCsv('""')).toEqual([['']]);
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('a\n\nb\n')).toEqual([['a'], [''], ['b']]);
  });

  it('keeps a stray quote inside an unquoted cell, and refuses a quote that never closes', () => {
    expect(parseCsv('5" pipe,x')).toEqual([['5" pipe', 'x']]);
    expect(() => parseCsv('a,"b\nc,d')).toThrow(CsvError);
    expect(() => parseCsv('a,"b\nc,d')).toThrow('line 1');
  });

  it('round-trips what toCsv writes, the formula guard included', () => {
    const records = [
      ['id', 'sku', 'name', 'price', 'active'],
      ['1', 'AW-KITE', 'Kite "Red", 1oz', '12.50', 'true'],
      ['2', 'AW-X', '=1+1', '', 'false'],
      ['3', 'AW-Y', 'Line one\r\nline two', '0.10', 'true'],
      ['4', 'AW-Z', '-dash first', '', 'true'],
    ];
    const back = parseCsv(toCsv(records));
    expect(back[2][2]).toBe("'=1+1");
    expect(back.map((record) => record.map(unguardCell))).toEqual(records);
  });

  it('unguards only what the guard added', () => {
    expect(unguardCell("'=A1")).toBe('=A1');
    expect(unguardCell("'-1")).toBe('-1');
    expect(unguardCell("'tis")).toBe("'tis");
    expect(unguardCell('plain')).toBe('plain');
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.useRealTimers());

  it('clicks a temporary download link for a Blob, then lets the URL go', async () => {
    vi.useFakeTimers();
    const urls = { createObjectURL: vi.fn(() => 'blob:aw/1'), revokeObjectURL: vi.fn() };
    const clicked = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record() {
      clicked.push({ href: this.getAttribute('href'), download: this.download, attached: document.body.contains(this) });
    });
    const blob = downloadCsv('products-2026-10-08.csv', toCsv([['a'], ['b']]), { urls });
    expect(clicked).toEqual([{ href: 'blob:aw/1', download: 'products-2026-10-08.csv', attached: true }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(blob.type).toBe('text/csv;charset=utf-8');
    // The bytes start with the UTF-8 BOM, so Excel reads the file as UTF-8.
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x62, 0x0d, 0x0a]);
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:aw/1');
    click.mockRestore();
  });
});
