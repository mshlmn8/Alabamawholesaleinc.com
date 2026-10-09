// Customer policy pages: delivery, privacy, and trade terms.

import { COMPANY, FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM, POLICIES_UPDATED } from '../../data/content.js';
import { formatMoney, formatMoneyShort } from '../../lib/format.js';
import { Link } from '../../lib/router.js';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { PageHead, SupportLayout, ContactStrip, POLICY_LINKS, supportApplyLabel } from './SupportShell.jsx';
import { POLICY_TEXT } from './policyText.js';

// The titles and intros are in policyText.js, which the head tags read too.
export { POLICY_TITLES, POLICY_INTROS } from './policyText.js';

// Shared with TERMS_VERSION, the version an application accepts (AW-019).
const UPDATED = POLICIES_UPDATED;

// Each policy is a list of sections; `body` items are paragraphs (string or JSX)
// or `{ list: [...] }` bullet groups.
// TODO(owner): Order cutoff, delivery days, the fee under $1,500, tobacco receiving rules and the damage-claim process for the Delivery policy. (AW-130)
// TODO(owner): Returns, damage, credit, tax, risk of loss, liability and governing law for the Trade terms, ideally with counsel. (AW-028)
const POLICIES = {
  shipping: {
    eyebrow: 'CUSTOMER POLICIES',
    ...POLICY_TEXT.shipping,
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
    ...POLICY_TEXT.privacy,
    updated: true,
    sections: [
      // TODO(owner): Provide or approve the privacy policy details: service providers used, data sharing, retention periods for uploaded license and EIN documents, and the contact method for access or deletion requests. Apart from the store address, license files and agreement record now named under 'What we collect' (AW-019), the published sections below are unchanged. (AW-027)
      // TODO(owner): approve this wording, and say how long application
      // details, license files and the agreement record are kept; no
      // retention period is stated until you do (AW-019).
      // TODO(owner): Signed-in accounts' carts are now saved with the account
      // (public.carts: the products and quantities in the cart, no prices),
      // so they follow the buyer to another device. Should "What we collect"
      // name it, how long is a saved cart kept, and may a buyer ask for it to
      // be deleted? The text below is unchanged until you decide. (AW-334)
      { heading: 'What we collect', body: [
        { list: [
          'Application details: your name, business name, phone, business email, business type, store street address, city, state and ZIP, federal EIN, state retail tobacco license number, resale certificate number and expected monthly volume.',
          'License documents: the state retail tobacco license and resale certificate files you upload with an application. They are kept in private storage that only you and the trade desk can open.',
          'Your agreement: when you accepted the Trade terms and Privacy policy and which version, and when you confirmed you are 21 or older.',
          'Orders: business and contact details, delivery address, the items requested, delivery preferences and notes.',
        ] },
      ] },
      { heading: 'Why we collect it', body: [
        { list: [
          'To review trade account applications.',
          'To prepare quotes, process orders, and contact you about them.',
        ] },
      ] },
      // TODO(owner): This section repeats the contact strip below it; it stays as privacy-policy wording until you approve the contact method for access or deletion requests (AW-027), and may then go. (AW-276)
      { heading: 'Contact the trade desk', body: [
        <>Questions about what we collect: <CallOrEmail before="call" after="." /></>,
      ] },
    ],
  },
  terms: {
    eyebrow: 'CUSTOMER POLICIES',
    ...POLICY_TEXT.terms,
    updated: true,
    sections: [
      { heading: 'Who can buy', body: [
        // TODO(owner): Is a tobacco license required for every trade account, or only for tobacco, vapor, and nicotine? This sentence is unchanged until you decide. (AW-129)
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
        <>Orders are delivered on our own trucks when the stop is on a delivery route in Alabama, Mississippi or Georgia, or collected at the Birmingham warehouse during business hours. See <Link to="/shipping">Delivery</Link> for how that works.</>,
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

// signedIn: the side nav calls /apply 'Trade account' (NEW-047).
export function PolicyPage({ kind, signedIn = false }) {
  const policy = POLICIES[kind];
  if (!policy) return null;
  const crumb = POLICY_LINKS.find(l => l.page === kind)?.label || policy.title;

  return (
    <section className="support-page">
      <PageHead crumb={crumb} eyebrow={policy.eyebrow} title={policy.title}>
        <p>{policy.intro}</p>
      </PageHead>
      {/* The page head's eyebrow already says CUSTOMER POLICIES (AW-220):
          the side nav leaves its own off. */}
      <SupportLayout current={kind} navLabel={null} applyLabel={supportApplyLabel(signedIn)}>
        <article className="policy-body">
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
          {/* The contact strip right below has the phone and email (AW-276). */}
          {policy.updated && <p className="support-note">{`Last updated ${UPDATED}.`}</p>}
        </article>
      </SupportLayout>
      <ContactStrip />
    </section>
  );
}
