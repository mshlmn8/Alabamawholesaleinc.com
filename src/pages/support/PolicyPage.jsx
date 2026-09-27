// Customer policy pages: shipping & delivery, returns & damaged goods,
// privacy, and trade terms. Copy states only confirmed operations; anything
// not yet confirmed by the owner is worded neutrally and points to the trade
// desk instead of promising a specific rule.

import React from 'react';
import { COMPANY, FREE_DELIVERY_THRESHOLD } from '../../data/content.js';
import { PageHead, PolicyNav, ContactStrip, CallOrEmail, PhoneLink, EmailLink, POLICY_LINKS } from './SupportShell.jsx';

const money = (n) => `$${Number(n).toLocaleString('en-US')}`;
const UPDATED = 'September 2026';

// Each policy is a list of sections; `body` items are paragraphs (string or JSX)
// or `{ list: [...] }` bullet groups.
const POLICIES = {
  shipping: {
    eyebrow: 'CUSTOMER POLICIES',
    title: 'Shipping & delivery',
    intro: 'How orders leave the Birmingham warehouse: on our own trucks along routes in Alabama, Mississippi and Georgia, or across the will-call counter.',
    sections: [
      { heading: 'How we deliver', body: [
        `Alabama Wholesale delivers on its own trucks along routes in Alabama, Mississippi and Georgia. When your store is on a delivery route, orders arrive the next day on our truck. Free delivery applies to orders over ${money(FREE_DELIVERY_THRESHOLD)} when the stop is on a delivery route.`,
        'Routes are planned stop by stop, so they do not reach every address in those states. The trade desk confirms whether a route passes your store when your account is set up, and again when you order.',
      ] },
      { heading: 'Scheduling and cutoffs', body: [
        'Delivery timing and any order cutoff are confirmed by the trade desk when you place your order. If you need a specific day, put it in the order notes or call.',
      ] },
      { heading: 'Stores that are not on a route', body: [
        <>If no route passes your store, call <PhoneLink /> and a trade rep will go over your options, including will-call pickup at the warehouse.</>,
      ] },
      { heading: 'Will-call pickup', body: [
        `Orders can be collected at ${COMPANY.addressLine1}, ${COMPANY.addressLine2} during business hours: ${COMPANY.hoursLine1}, ${COMPANY.hoursLine2}. Order ahead and have your order reference and business name ready at the counter.`,
      ] },
      { heading: 'Receiving your order', body: [
        'Count the cases and check for damage when the order arrives or when you collect it. Report shortages, damage, or a wrong item as described in Returns & damaged goods.',
      ] },
      { heading: 'Tobacco and vapor products', body: [
        'Tobacco and vapor products are supplied to licensed retail businesses only and are delivered to the licensed business on the account. We do not sell or deliver to consumers.',
      ] },
    ],
  },
  returns: {
    eyebrow: 'CUSTOMER POLICIES',
    title: 'Returns & damaged goods',
    intro: 'What to do if something arrives short, damaged, or not what you ordered.',
    sections: [
      { heading: 'Check your order on arrival', body: [
        'Count the cases and look for damage while the driver is there, or before you leave the will-call counter. Catching a problem at hand-over is the fastest way to get it fixed.',
      ] },
      { heading: 'Report shortages and damage', body: [
        <>Let us know as soon as possible after delivery or pickup. <CallOrEmail before="Call" after=" with:" /></>,
        { list: [
          'Your business name and the order reference number.',
          'The product, variant and quantity affected.',
          'Photos of any damaged cases or items, if you can take them.',
        ] },
        'The trade desk will confirm how the shortage or damage is resolved.',
      ] },
      { heading: 'Wrong item received', body: [
        'If you received something you did not order, keep it unopened and contact the trade desk. A rep will tell you how the swap is handled.',
      ] },
      { heading: 'Returning products', body: [
        'Call the trade desk before bringing anything back or handing it to a driver. A trade rep will tell you whether the item can be returned and how. Whether a return is accepted depends on the product and its condition, and tobacco and vapor products are subject to the rules of the state your store is in.',
      ] },
      { heading: 'Questions', body: [
        <>Anything not covered here, <CallOrEmail before="call" after="." /></>,
      ] },
    ],
  },
  privacy: {
    eyebrow: 'CUSTOMER POLICIES',
    title: 'Privacy',
    intro: 'What Alabama Wholesale collects from trade customers, why, and who can see it.',
    updated: true,
    sections: [
      { heading: 'Who we are', body: [
        <>{COMPANY.name}, {COMPANY.addressLine1}, {COMPANY.addressLine2}. Questions about this policy: <CallOrEmail before="call" after="." /></>,
      ] },
      { heading: 'What we collect', body: [
        { list: [
          'Trade account applications: your name, business name, phone, business email, business type, store state, federal EIN, state retail tobacco license number, resale certificate number and expected monthly volume.',
          'Account credentials: your email address and a password. Passwords are stored in hashed form by our authentication provider; we never see them.',
          'Quotes and orders: business and contact details, ship-to address, the items requested, delivery preferences and notes.',
          'Information stored in your browser: your 21+ confirmation, cart contents and sign-in session are kept in your browser’s local storage so the site works between visits.',
          'Server logs: our hosting provider keeps standard logs (IP address, browser type, pages requested) to run and secure the site.',
        ] },
        'This site does not use advertising trackers.',
      ] },
      { heading: 'How we use it', body: [
        { list: [
          'To confirm that a business is licensed to buy the products it applies for.',
          'To set up, approve and manage your trade account and its pricing.',
          'To prepare quotes, process orders, schedule deliveries and will-call pickups, and contact you about them.',
          'To keep the sales records required for tobacco distribution and tax reporting.',
        ] },
      ] },
      { heading: 'Who we share it with', body: [
        'We do not sell customer information. Account and order data is stored with the service providers that host this site and its database, and is used only to run the storefront. We share information when the law requires it, for example with state tax or tobacco regulators.',
      ] },
      { heading: 'How long we keep it', body: [
        'Account and order records are kept while your account is active and for as long as tax and tobacco-sales record-keeping requires afterwards.',
      ] },
      { heading: 'Your choices', body: [
        <>You can ask for a copy of the information we hold about your business, ask us to correct it, or ask us to close your account: <CallOrEmail before="call" after="." /> Some records must be kept for the retention periods above even after an account is closed.</>,
      ] },
      { heading: 'Age restriction', body: [
        'This site is for licensed retail businesses and adults 21 or older. We do not knowingly collect information from anyone under 21.',
      ] },
      { heading: 'Changes', body: [
        'If this policy changes, the new version is posted here with an updated date.',
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
        'Wholesale prices shown after sign-in apply to the approved account that is signed in and are not for publication. A quote request is not an order: the trade desk confirms pricing, availability, freight and delivery before an order is accepted. Prices and availability can change until then.',
      ] },
      { heading: 'Orders and delivery', body: [
        <>Orders are delivered on our own trucks when the stop is on a delivery route in Alabama, Mississippi or Georgia, or collected at the Birmingham warehouse. See <button className="text-link" type="button" data-nav="shipping">Shipping &amp; delivery</button> for how that works.</>,
      ] },
      { heading: 'Payment', body: [
        'Payment options for your account are confirmed with you when the account is approved.',
      ] },
      { heading: 'Resale and compliance', body: [
        'Products are supplied for resale in your licensed store. You are responsible for following the federal, state and local laws that apply to selling them, including age verification, licensing and tax requirements for tobacco and vapor products.',
      ] },
      { heading: 'Returns', body: [
        <>Shortages, damage and returns are handled as described in <button className="text-link" type="button" data-nav="returns">Returns &amp; damaged goods</button>.</>,
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
            {policy.updated ? `Last updated ${UPDATED}. ` : ''}Questions about this policy? Call <PhoneLink /> or email <EmailLink />.
          </p>
        </article>
      </div>
      <ContactStrip navigate={navigate} />
    </section>
  );
}
