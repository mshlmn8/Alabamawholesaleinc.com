// The application page's checklist and steps (AW-296): the checklist items
// carry a plain bullet, not a number or a ticked box (AW-250), and include
// the optional document photos; the steps are the numbered list. The status panels and the service notice take the status and callout
// colours through their classes (AW-295).
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APPLICATION_CHECKLIST } from '../../data/onboarding.js';
import { APPLY_TITLES, pageMeta } from '../../lib/meta.js';
import { ApplyPage, applyView } from './ApplyPage.jsx';

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
    // The form's optional uploads are on the list too, marked optional (AW-250).
    expect(titles).toContain('Photos of your license and resale certificate (optional)');
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

  // The application has a status while it is under review; once a trade rep
  // has decided, the account does (NEW-047).
  it('heads the status panel APPLICATION STATUS under review and ACCOUNT STATUS after', () => {
    const eyebrows = ['pending', 'approved', 'suspended'].map((status) => {
      const view = page({ profile: { id: 'p', name: 'Test Buyer', email: 'buyer@example.test', status }, account: 'ready' });
      const panel = view.container.querySelector('.status-panel');
      const pair = [panel.querySelector('.eyebrow').textContent, panel.querySelector('h2').textContent];
      view.unmount();
      return pair;
    });
    expect(eyebrows).toEqual([['APPLICATION STATUS', 'Pending approval'], ['ACCOUNT STATUS', 'Approved'], ['ACCOUNT STATUS', 'On hold']]);
  });

  // The side nav names the page as its crumb does once there is an account
  // (NEW-047); a guest keeps the apply label.
  it('names its side-nav entry Trade account for every signed-in view, and the apply label for a guest', () => {
    const navCurrent = () => screen.getByRole('navigation', { name: 'Help and policies' }).querySelector('a[aria-current="page"]');
    const guest = page();
    expect(navCurrent().textContent).toBe('Apply for a trade account');
    expect(document.querySelector('.crumbs').textContent).toContain('Trade account');
    guest.unmount();
    for (const props of [
      { profile: null, account: 'loading' },
      { profile: null, account: 'no-profile' },
      ...['pending', 'approved', 'suspended'].map((status) => ({ profile: { id: 'p', email: 'buyer@example.test', status }, account: 'ready' })),
    ]) {
      const view = page(props);
      expect(navCurrent().textContent, props.account).toBe('Trade account');
      expect(navCurrent().getAttribute('href')).toBe('/apply');
      view.unmount();
    }
  });
});

// The page head, intro and contact strip follow the account (AW-098), and a
// guest can start an application from the first screen (AW-242).
describe('ApplyPage for each account state', () => {
  const PROFILE = { id: 'p', name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test' };
  const as = (status) => ({ profile: { ...PROFILE, status }, account: 'ready' });
  const head = () => document.querySelector('.page-head');
  const eyebrow = () => head().querySelector('.eyebrow').textContent;
  const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;
  const intro = () => head().querySelector('h1 + p').textContent;
  const strip = () => {
    const aside = screen.getByRole('complementary', { name: 'Contact the trade desk' });
    return [aside.querySelector('.eyebrow').textContent, aside.querySelector('h2').textContent];
  };
  const startButtons = () => screen.queryAllByRole('button', { name: 'Apply for a trade account' });

  it('invites a guest to apply, with the apply button in the page head and on the checklist', () => {
    const onApplyClick = vi.fn();
    const onLoginClick = vi.fn();
    page({ onApplyClick, onLoginClick });
    expect(eyebrow()).toBe('OPEN AN ACCOUNT');
    expect(h1()).toBe('Apply for a trade account');
    expect(intro()).toBe('Alabama Wholesale sells exclusively to licensed retail businesses — 21+, no consumer sales. Here is what to have ready, and what happens after you apply.');
    expect(strip()).toEqual(['RATHER TALK IT THROUGH?', 'Apply with a trade rep']);
    const [first, last] = startButtons();
    expect(startButtons()).toHaveLength(2);
    expect(head().contains(first)).toBe(true);
    expect(screen.getByRole('region', { name: 'Application checklist' }).contains(last)).toBe(true);
    fireEvent.click(first);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
    const signIns = screen.getAllByRole('button', { name: 'Already have an account? Sign in' });
    expect(signIns).toHaveLength(2);
    expect(head().contains(signIns[0])).toBe(true);
    fireEvent.click(signIns[0]);
    expect(onLoginClick).toHaveBeenCalledTimes(1);
    // No arrow glyphs on the buttons (styles.test).
    expect(head().querySelector('.dialog-actions').textContent).toBe('Apply for a trade accountAlready have an account? Sign in');
  });

  it('offers the phone in the page head without a backend', () => {
    page({ isBackendConfigured: false });
    const call = within(head()).getByRole('link', { name: /^Apply by phone · / });
    expect(call.getAttribute('href')).toMatch(/^tel:/);
    expect(startButtons()).toHaveLength(0);
  });

  it('promises nothing while the account loads', () => {
    page({ account: 'loading' });
    expect(eyebrow()).toBe('TRADE ACCOUNT');
    expect(h1()).toBe('Trade account');
    expect(intro()).toBe('Alabama Wholesale sells exclusively to licensed retail businesses — 21+, no consumer sales.');
    expect(strip()).toEqual(['QUESTIONS?', 'Talk to the warehouse']);
    expect(startButtons()).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Application checklist' })).toBeNull();
    expect(screen.getByText('Checking for your application…')).toBeTruthy();
  });

  it('tells an applicant under review where the application stands', () => {
    page(as('pending'));
    expect(eyebrow()).toBe('APPLICATION UNDER REVIEW');
    expect(h1()).toBe('Your trade account');
    expect(intro()).toBe('Your application is with a trade rep. Here is where it stands, and the license documents you can add while you wait.');
    expect(intro()).not.toMatch(/what to have ready|business day/);
    expect(strip()).toEqual(['QUESTIONS ABOUT YOUR APPLICATION?', 'Talk to a trade rep']);
    expect(startButtons()).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Pending approval' })).toBeTruthy();
  });

  it('points an approved account at the catalog, My account and Quick Reorder', () => {
    page(as('approved'));
    expect(eyebrow()).toBe('ACCOUNT ACTIVE');
    expect(h1()).toBe('Your trade account');
    expect(intro()).toMatch(/^Your trade account is active\. /);
    const links = within(head().querySelector('h1 + p')).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([['the catalog', '/catalog'], ['My account', '/account'], ['Quick Reorder', '/account#quick-reorder']]);
    expect(strip()).toEqual(['QUESTIONS?', 'Talk to the warehouse']);
    expect(startButtons()).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Application checklist' })).toBeNull();
  });

  it('tells an account on hold who to call, and never invites it to apply again', () => {
    page(as('suspended'));
    expect(eyebrow()).toBe('ACCOUNT ON HOLD');
    expect(h1()).toBe('Your trade account');
    expect(intro()).toMatch(/^Ordering is paused on this account\. Call .+ or email .+ and a trade rep will help you sort it out\.$/);
    const contacts = within(head().querySelector('h1 + p')).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(contacts).toEqual([expect.stringMatching(/^tel:/), expect.stringMatching(/^mailto:/)]);
    expect(strip()).toEqual(['ACCOUNT ON HOLD?', 'Talk to a trade rep']);
    expect(startButtons()).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Application checklist' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'On hold' })).toBeTruthy();
  });

  // A signed-in account's profile still loading, or failed: never the
  // guest's Apply and Sign in (NEW-002).
  it('offers no guest Apply or Sign in while a signed-in account’s profile loads', () => {
    page({ profile: null, account: 'loading' });
    expect(h1()).toBe('Trade account');
    expect(startButtons()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Already have an account? Sign in' })).toBeNull();
  });

  it('offers Try again and Sign out to a signed-in account whose profile did not load (NEW-002)', () => {
    const onRetry = vi.fn();
    const onSignOut = vi.fn();
    const view = page({ profile: null, account: 'no-profile', onRetry, onSignOut });
    expect(eyebrow()).toBe('TRADE ACCOUNT');
    expect(h1()).toBe('Your trade account');
    expect(intro()).toBe('Alabama Wholesale sells exclusively to licensed retail businesses — 21+, no consumer sales.');
    expect(strip()).toEqual(['QUESTIONS?', 'Talk to the warehouse']);
    expect(startButtons()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Already have an account? Sign in' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Application checklist' })).toBeNull();
    expect(screen.getByText(/didn’t load/).closest('.account-problem')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    view.rerender(<ApplyPage profile={null} account="no-profile" isBackendConfigured onRetry={onRetry} retrying onSignOut={onSignOut} signingOut />);
    expect(screen.getByRole('button', { name: 'Trying again…' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Signing out…' }).disabled).toBe(true);
  });

  // The tab says what the h1 says, in every view (AW-131): App titles /apply
  // by the same view (route.applyAs), and pending or suspended accounts no
  // longer get a title their heading doesn't have.
  it('heads every view with the words of its page title', () => {
    const views = [
      ['guest', { profile: null, account: 'signed-out' }],
      ['loading', { profile: null, account: 'loading' }],
      ['no-profile', { profile: null, account: 'no-profile' }],
      ...['pending', 'approved', 'suspended'].map((status) => [status, as(status)]),
    ];
    for (const [applyAs, props] of views) {
      const view = page(props);
      const title = pageMeta({ page: 'apply', applyAs }, [], []).title;
      expect(applyView(props.profile, props.account)).toBe(applyAs);
      expect(h1(), applyAs).toBe(APPLY_TITLES[applyAs]);
      expect(title.split(' · ')[0], applyAs).toBe(h1());
      view.unmount();
    }
  });

  it('chooses the view from the account', () => {
    expect(applyView(null, 'loading')).toBe('loading');
    expect(applyView(null, 'no-profile')).toBe('no-profile');
    expect(applyView({ status: 'approved' }, 'loading')).toBe('loading');
    expect(applyView(null, 'signed-out')).toBe('guest');
    expect(applyView({ status: 'suspended' }, 'ready')).toBe('suspended');
    expect(applyView({ status: 'mystery' }, 'ready')).toBe('pending');
  });
});
