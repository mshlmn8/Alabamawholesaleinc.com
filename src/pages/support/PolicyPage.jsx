// Customer policy pages: delivery, privacy, and trade terms.

import { COMPANY, FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../../data/content.js';
import { formatMoney, formatMoneyShort } from '../../lib/format.js';
import { CallOrEmail, PhoneLink, EmailLink } from '../../components/ContactLinks.jsx';
import { PageHead, PolicyNav, ContactStrip, POLICY_LINKS } from './SupportShell.jsx';

const UPDATED = 'September 2026';

// Each policy is a list of sections; `body` items are paragraphs (string or JSX)
// or `{ list: [...] }` bullet groups.
const POLICIES = {
  shipping: {
    eyebrow: 'CUSTOMER POLICIES',
    title: 'Delivery',
    intro: 'How orders leave the Birmingham warehouse: on our own trucks along routes in Alabama, Mississippi and Georgia, or will-call pickup during business hours.',
    sections: [
      { heading: 'How we deliver', body: [
        `Alabama Wholesale delivers on its own trucks along routes in Alabama, Mississippi and Georgia. When your store is on a delivery route, orders arrive the next day on our truck. Free delivery applies to orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} when the stop is on a delivery route.`,
        'Routes are planned stop by stop, so they do not reach every address in those states. The trade desk confirms whether a route passes your store when your account is set up, and again when you order.',
      ] },
      { heading: 'Minimum order', body: [
        `The minimum order is ${formatMoney(ORDER_MINIMUM)}.`,
      ] },
      { heading: 'Will-call pickup', body: [
        `Will-call is pickup at ${COMPANY.addressLine1}, ${COMPANY.addressLine2} during business hours: ${COMPANY.hoursLine1}, ${COMPANY.hoursLine2}. Order ahead and have your order reference and business name ready at the counter.`,
      ] },
      { heading: 'Receiving your order', body: [
        'Count the cases and check for damage when the order arrives or when you collect it.',
      ] },
      { heading: 'Tobacco and vapor products', body: [
        'Tobacco and vapor products are supplied to licensed retail businesses only and are delivered to the licensed business on the account. We do not sell or deliver to consumers.',
      ] },
    ],
  },
  privacy: {
    eyebrow: 'CUSTOMER POLICIES',
    title: 'Privacy',
    intro: 'What Alabama Wholesale collects from trade customers, and why.',
    updated: true,
    sections: [
      { heading: 'What we collect', body: [
        { list: [
          'Application details: your name, business name, phone, business email, business type, store state, federal EIN, state retail tobacco license number, resale certificate number and expected monthly volume.',
          'Orders: business and contact details, delivery address, the items requested, delivery preferences and notes.',
        ] },
      ] },
      { heading: 'Why we collect it', body: [
        { list: [
          'To review trade account applications.',
          'To prepare quotes, process orders, and contact you about them.',
        ] },
      ] },
      { heading: 'Contact the trade desk', body: [
        <>Questions about what we collect: <CallOrEmail before="call" after="." /></>,
      ] },
    ],
  },
  terms: {
    eyebrow: 'CUSTOMER POLICIES',
    title: 'Trade terms',
    intro: 'The basics of buying from Alabama Wholesale: who can open an account, how pricing and quotes work, and what we ask of retail customers.',
    updated: true,
    sections: [
      { heading: 'Who can buy', body: [
        'Alabama Wholesale sells to licensed retail businesses only. We do not sell to consumers. Applicants must be 21 or older and provide a federal EIN, a state retail tobacco license number for the store, and a resale certificate number. We verify these before the first order.',
      ] },
      { heading: 'Account approval', body: [
        'Applications are reviewed by a trade rep. Wholesale pricing and ordering unlock when the account is approved. We may decline, pause or close an account whose licensing cannot be verified or is no longer valid.',
      ] },
      { heading: 'Pricing and quotes', body: [
        'Wholesale prices shown after sign-in apply to the approved account that is signed in and are not for publication. A quote request is not an order: the trade desk confirms pricing, availability and delivery before an order is accepted. Prices and availability can change until then.',
      ] },
      { heading: 'Orders and delivery', body: [
        `The minimum order is ${formatMoney(ORDER_MINIMUM)}.`,
        <>Orders are delivered on our own trucks when the stop is on a delivery route in Alabama, Mississippi or Georgia, or collected at the Birmingham warehouse during business hours. See <button className="text-link" type="button" data-nav="shipping">Delivery</button> for how that works.</>,
      ] },
      { heading: 'Payment', body: [
        'Payment methods are cash, checks, and electronic wiring and transfers.',
      ] },
      { heading: 'Resale and compliance', body: [
        'Products are supplied for resale in your licensed store. You are responsible for following the federal, state and local laws that apply to selling them, including age verification, licensing and tax requirements for tobacco and vapor products.',
      ] },
      { heading: 'Your login', body: [
        <>Keep your account credentials confidential. Orders placed with your login are treated as placed by your business, so let us know right away if you think someone else has access: <CallOrEmail before="call" after="." /></>,
      ] },
      { heading: 'Changes', body: [
        'If these terms change, the new version is posted here with an updated date.',
      ] },
    ],
  },
};

export const POLICY_TITLES = Object.fromEntries(Object.entries(POLICIES).map(([k, v]) => [k, v.title]));
export const POLICY_INTROS = Object.fromEntries(Object.entries(POLICIES).map(([k, v]) => [k, v.intro]));

export function PolicyPage({ kind, goHome, navigate }) {
  const policy = POLICIES[kind];
  if (!policy) return null;
  const crumb = POLICY_LINKS.find(l => l.page === kind)?.label || policy.title;

  // Inline cross-links inside policy copy are plain buttons tagged with data-nav.
  const onBodyClick = (e) => {
    const target = e.target.closest('[data-nav]');
    if (target) navigate({ page: target.dataset.nav });
  };

  return (
    <section className="support-page">
      <PageHead goHome={goHome} crumb={crumb} eyebrow={policy.eyebrow} title={policy.title}>
        <p>{policy.intro}</p>
      </PageHead>
      <div className="policy-layout">
        <PolicyNav current={kind} navigate={navigate} />
        {/* Delegated handler for the [data-nav] cross-links in the policy text, which are
            real buttons, so keyboard activation bubbles here too. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <article className="policy-body" onClick={onBodyClick}>
          {policy.sections.map((section, i) => (
            <section key={section.heading} aria-labelledby={`policy-${kind}-${i}`}>
              <h2 id={`policy-${kind}-${i}`}>{section.heading}</h2>
              {section.body.map((item, j) => (
                item && typeof item === 'object' && Array.isArray(item.list)
                  ? <ul key={j}>{item.list.map((li, k) => <li key={k}>{li}</li>)}</ul>
                  : <p key={j}>{item}</p>
              ))}
            </section>
          ))}
          <p className="support-note">
            <span>{policy.updated ? `Last updated ${UPDATED}. ` : ''}</span>Questions about this policy? Call <PhoneLink /> or email <EmailLink />.
          </p>
        </article>
      </div>
      <ContactStrip navigate={navigate} />
    </section>
  );
}
