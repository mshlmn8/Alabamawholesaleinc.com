// A list of values that wraps between them (AW-304), with its dots held to
// the word before them (NEW-082) and the product code kept whole.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PART_SEPARATOR, TextParts, joinParts } from './TextParts.jsx';

const spans = () => [...document.querySelectorAll('.text-parts > span')];

describe('TextParts', () => {
  it('ends every part but the last with a no-break space, the dot and a space (NEW-082)', () => {
    expect(PART_SEPARATOR).toBe('\u00a0· ');
    render(<TextParts parts={['Cigars & Cigarillos', '', 'Disposable Vapes', null, 'Wraps']} />);
    // Empty values are left out; the dot can't start a line, and a line can
    // break after it.
    expect(spans().map((s) => s.textContent)).toEqual(['Cigars & Cigarillos\u00a0· ', 'Disposable Vapes\u00a0· ', 'Wraps']);
    expect(document.querySelector('.text-parts').textContent).toBe('Cigars & Cigarillos\u00a0· Disposable Vapes\u00a0· Wraps');
    // Read aloud it is the values joined with ' · '.
    expect(document.querySelector('.text-parts').textContent.replace(/\u00a0/g, ' ')).toBe('Cigars & Cigarillos · Disposable Vapes · Wraps');
    expect(joinParts(['Cigars & Cigarillos', '', 'Wraps'])).toBe('Cigars & Cigarillos\u00a0· Wraps');
    expect(document.querySelector('.sku-part')).toBeNull();
  });

  it('marks the product code, wherever it is in the line, with its whole code as the title (AW-304)', () => {
    const { rerender } = render(<TextParts parts={['AW-MENTAL-HEALTH-PREROLLS-2PK', 'Sold by the 2-pack', '$1.00 each']} code="AW-MENTAL-HEALTH-PREROLLS-2PK" />);
    let code = document.querySelector('.sku-part');
    expect(code).toBe(spans()[0]);
    expect(code.textContent).toBe('AW-MENTAL-HEALTH-PREROLLS-2PK\u00a0· ');
    expect(code.getAttribute('title')).toBe('AW-MENTAL-HEALTH-PREROLLS-2PK');
    expect(spans().filter((s) => s.hasAttribute('class') || s.hasAttribute('title'))).toHaveLength(1);
    rerender(<TextParts parts={['Mental Health', 'AW-MENTAL-HEALTH-PREROLLS-2PK']} code="AW-MENTAL-HEALTH-PREROLLS-2PK" />);
    code = document.querySelector('.sku-part');
    expect(code).toBe(spans()[1]);
    expect(code.textContent).toBe('AW-MENTAL-HEALTH-PREROLLS-2PK');
    // No code given (the home rails leave the SKU off): no code part.
    rerender(<TextParts parts={['Mental Health']} code={null} />);
    expect(document.querySelector('.sku-part')).toBeNull();
  });
});
