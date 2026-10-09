// The application page's checklist and steps (AW-296): the checklist items
// carry the drawn check box, not a number as well; the steps are the numbered
// list. The status panels and the service notice take the status and callout
// colours through their classes (AW-295).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APPLICATION_CHECKLIST } from '../../data/onboarding.js';
import { ApplyPage } from './ApplyPage.jsx';

// The documents panel needs the auth provider; these tests are about the page around it.
vi.mock('../../components/DocumentUploads.jsx', () => ({ ApplicationDocuments: () => null }));

const page = (props) => render(
  <ApplyPage profile={null} account="signed-out" isBackendConfigured onApplyClick={vi.fn()} onLoginClick={vi.fn()} onResetClick={vi.fn()} {...props} />,
);

describe('ApplyPage', () => {
  it('titles each checklist item without a number in front', () => {
    page();
    const card = screen.getByRole('region', { name: 'Application checklist' });
    const titles = [...card.querySelectorAll('.checklist li > b')].map((b) => b.textContent);
    expect(titles).toEqual(APPLICATION_CHECKLIST.map((item) => item.title));
    for (const title of titles) expect(title).not.toMatch(/^\d|·/);
  });

  it('numbers the three steps with the ordered list, not in the text', () => {
    page();
    const steps = within(screen.getByRole('region', { name: 'Three steps to wholesale pricing' })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0].closest('ol').className).toBe('next-steps');
    for (const step of steps) expect(step.textContent).not.toMatch(/^\d/);
  });

  it('shows the unavailable notice as an error callout', () => {
    page({ isBackendConfigured: false });
    expect(screen.getByRole('status').className).toBe('form-error support-alert');
  });

  it('marks the status panel with the account status', () => {
    for (const status of ['pending', 'approved', 'suspended']) {
      const view = page({ profile: { id: 'p', name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', status }, account: 'ready' });
      expect(view.container.querySelector('.status-panel').className).toBe(`status-panel status-${status}`);
      view.unmount();
    }
  });
});
