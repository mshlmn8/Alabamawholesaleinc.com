// Customer policy pages: delivery, privacy, and trade terms.

import {
  DELIVERY_POLICY_UPDATED_ON, FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM, POLICIES_UPDATED_ON, STORAGE, policyDateLabel,
} from '../../data/content.js';
import { formatMoney, formatMoneyShort } from '../../lib/format.js';
import { Link, SCROLL_STORE } from '../../lib/router.js';
import { useSite } from '../../lib/siteSettings.js';
import { AUTH_STORAGE_KEY } from '../../lib/supabase.js';
import { AGE_CONFIRMATION_DAYS, CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT } from '../../lib/ageGate.js';
import { CHUNK_RELOAD_KEY } from '../../lib/chunks.js';
import { CallOrEmail, VolumePricing } from '../../components/ContactLinks.jsx';
import { PageHead, SupportLayout, ContactStrip, POLICY_LINKS, supportApplyLabel } from './SupportShell.jsx';
import { POLICY_TEXT } from './policyText.js';

// The titles and intros are in policyText.js, which the head tags read too.
export { POLICY_TITLES, POLICY_INTROS } from './policyText.js';

// A policy's 'Last updated' date: the ISO date for <time dateTime> and the
// words the page prints (AW-277). The Privacy policy and Trade terms share
// POLICIES_UPDATED_ON, which is also the version an application accepts
// (TERMS_VERSION, AW-019); the Delivery policy has its own.
const dated = (on) => ({ on, label: policyDateLabel(on) });
const POLICIES_DATE = dated(POLICIES_UPDATED_ON);
const DELIVERY_DATE = dated(DELIVERY_POLICY_UPDATED_ON);

// How long the 21+ answer stays in the browser (src/lib/ageGate.js), in the
// privacy policy's words.
const AGE_ANSWER_KEPT = `It lasts ${AGE_CONFIRMATION_DAYS} days${CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT ? ', and signing out removes it' : ''}.`;

// The will-call address and hours staff set in Admin -> Site settings
// (AW-030), or content.js's. One root element (AW-039).
function WillCallPickup() {
  const site = useSite();
  return <span>{`Will-call is pickup at ${site.addressLine1}, ${site.addressLine2} during business hours: ${site.hoursLines.join(', ')}. Order ahead and have your order reference and business name ready at the counter.`}</span>;
}

// Each policy is a list of sections; `body` items are paragraphs (string or JSX)
// or `{ list: [...] }` bullet groups.
// TODO(owner): Order cutoff, delivery days, the fee under $1,500, tobacco receiving rules and the damage-claim process for the Delivery policy. (AW-130)
// The Delivery policy (/shipping) and Delivery & service area (/delivery)
// are both kept and link to each other (AW-130, NEW-043): the policy holds
// the terms of delivery and pickup, the other page the route states and the
// service area check.
// TODO(owner): Returns, damage, credit, tax, risk of loss, liability and governing law for the Trade terms, ideally with counsel. (AW-028)
const POLICIES = {
  shipping: {
    eyebrow: 'CUSTOMER POLICIES',
    ...POLICY_TEXT.shipping,
    // TODO(owner): The Delivery policy keeps its 'Last updated September 2026' (DELIVERY_POLICY_UPDATED_ON in content.js), now that the Privacy policy and Trade terms print the day they last changed. Confirm that date, or give the day its delivery facts last changed. (AW-130)
    updated: DELIVERY_DATE,
    sections: [
      { heading: 'How we deliver', body: [
        `Alabama Wholesale delivers on its own trucks along routes in Alabama, Mississippi and Georgia. When your store is on a delivery route, orders arrive the next day on our truck. Free delivery applies to orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} when the stop is on a delivery route.`,
        'Routes are planned stop by stop, so they do not reach every address in those states. The trade desk confirms whether a route passes your store when your account is set up, and again when you order.',
        <>See <Link to="/delivery">Delivery &amp; service area</Link> for the states our routes cover, and to check your store.</>,
      ] },
      { heading: 'Minimum order', body: [
        `The minimum order is ${formatMoney(ORDER_MINIMUM)}.`,
      ] },
      { heading: 'Will-call pickup', body: [
        <WillCallPickup key="will-call" />,
      ] },
      { heading: 'Receiving your order', body: [
        'Count the cases and check for damage when the order arrives or when you collect it.',
      ] },
      { heading: 'Tobacco and vapor products', body: [
        'Tobacco and vapor products are supplied to licensed retail businesses only and are delivered to the licensed business on the account. We do not sell or deliver to consumers.',
      ] },
    ],
  },
  // A plain-language account of what this site does with personal
  // information (AW-027, owner answer 2026-10), written from the code:
  //   - collected: the application (AuthModal, auth.jsx signUp), license
  //     files (src/lib/documents.js, the private 'application-documents'
  //     bucket), the agreement record (20261008195000), the account record
  //     (status, tier, approval, profile_status_log, staff notes), orders
  //     (submit_quote, order_events, order notes) and the saved cart
  //     (src/lib/cartSync.js, 20261012110000, AW-334).
  //   - services: Supabase (database, sign-in and its emails, storage),
  //     Netlify (hosting and the order email, src/lib/orderNotification.js)
  //     and Gmail, where the orders inbox and the public email are (AW-127:
  //     if the email moves to another provider, say so here). These are the
  //     only off-site services: netlify.toml's CSP allows *.supabase.co alone,
  //     and PolicyPage.test.jsx fails when a new host isn't named below.
  //   - who sees it: the row-level security of 20261014120000 (the account
  //     itself, and approved admin or staff accounts); carts are the
  //     account's own only.
  //   - the browser: every key the site stores (STORAGE in content.js,
  //     AUTH_STORAGE_KEY, SCROLL_STORE, CHUNK_RELOAD_KEY); the test checks
  //     each one is named.
  //   - how long: the owner's words, "while your account is active and as
  //     long as needed for tax and licensing records".
  // Requests for a copy, a correction or deletion go to the phone and email
  // staff set in Admin -> Site settings (CallOrEmail, useSite).
  privacy: {
    eyebrow: 'CUSTOMER POLICIES',
    ...POLICY_TEXT.privacy,
    updated: POLICIES_DATE,
    sections: [
      { heading: 'What we collect', body: [
        { list: [
          'Your sign-in: your business email address and a password.',
          'Your application: your name, business name, phone, business type, the store’s street address, city, state and ZIP, federal EIN, state retail tobacco license number, resale certificate number and expected monthly volume.',
          'License documents: the state retail tobacco license and resale certificate files you upload (PDF, JPG or PNG).',
          'Your agreement: when you accepted the Trade terms and Privacy policy and which version, and when you confirmed you are 21 or older.',
          'Your account record: whether the account is pending approval, approved or on hold, its pricing tier, when it was approved and by whom, a history of those changes, and notes our staff add about the account.',
          'Orders: the business and contact name, email, phone, delivery or will-call pickup, preferred date, delivery address, the items and quantities, your notes, and the updates and notes our staff add while preparing the order.',
          'Your saved cart: while you are signed in, the products, options and quantities in your cart are saved with your account, so the cart follows you to another phone or computer. No prices are saved with it.',
        ] },
      ] },
      { heading: 'Why we collect it', body: [
        { list: [
          'To review trade account applications and check your licenses, because we sell to licensed retail businesses only.',
          'To prepare and deliver your orders, and to contact you about them and about your account.',
          'To keep our tax and licensing records.',
          'To keep your account secure, so only you and our trade desk see your prices, documents and orders.',
        ] },
        'We don’t sell your information, and we don’t use it for advertising.',
      ] },
      { heading: 'Who handles it for us', body: [
        'The website runs on these services:',
        { list: [
          'Supabase: our database, sign-in and private file storage. Your account, application, license documents, orders and saved cart are kept there. Supabase also sends the emails that confirm your email address and reset your password.',
          'Netlify: hosts the website. When you place an order, the site sends a copy of it, without prices, to Netlify, which emails it to our orders inbox so staff can prepare it.',
          'Gmail (Google): our email inboxes, including the orders inbox. Order copies and any email you send us are kept there.',
        ] },
        'Like any website host, Supabase and Netlify see technical details of each visit, such as your IP address and browser, and keep them in their logs to run and protect their service. The site has no ads, analytics or tracking tools, and sets no cookies of its own.',
      ] },
      { heading: 'Who can see it', body: [
        { list: [
          'You, when you are signed in: your account, license documents and order history.',
          'Our trade desk: the owner and staff accounts in our admin area see applications, license documents, accounts and orders, to review applications and prepare orders. The admin area never shows your password or your saved cart.',
          'License documents are kept in private storage, never at a public web address. You and the trade desk open them through a private link that stops working within minutes.',
        ] },
        'Outside our business, only the services above handle your information. We share it otherwise only when the law requires it, for example with a tax or licensing authority.',
      ] },
      { heading: 'In your browser', body: [
        'The site keeps a few things in your browser’s storage, not in cookies, so it works the way you expect. These stay until they expire or are removed:',
        { list: [
          <><code>{AUTH_STORAGE_KEY}</code> and keys starting <code>{`${AUTH_STORAGE_KEY}-`}</code>: your sign-in session (never your password), so you stay signed in on this browser. Signing out removes them.</>,
          <><code>{STORAGE.age}</code>: your answer that you are 21 or older, and when you gave it, so the site doesn’t ask on every visit. {AGE_ANSWER_KEPT}</>,
          <><code>{`${STORAGE.cart}:…`}</code> and <code>{`${STORAGE.cartLegacy}:…`}</code>: the cart on this device, with its products, options and quantities: one for guests and one for each account signed in here. When you sign out, the site shows an empty guest cart, and your account’s cart stays on this device for the next time you sign in here.</>,
        ] },
        'These are kept for this browser tab only, and go when you close it:',
        { list: [
          <><code>{STORAGE.quoteDraft}</code>: what you typed at checkout, so leaving the page or reloading it keeps your answers. Placing the order or signing out removes it.</>,
          <><code>{STORAGE.receipt}</code>: your last order confirmation, with its reference and contact details, so a reload keeps it on screen. Signing out removes it.</>,
          <><code>{STORAGE.ageDeclined}</code>: that you answered No to the age question.</>,
          <><code>{SCROLL_STORE}</code>: where you were on each page, so Back takes you to the same spot.</>,
          <><code>{CHUNK_RELOAD_KEY}</code>: a note that the page reloaded once to pick up an update to the site.</>,
        ] },
        'Clearing this site’s data in your browser removes all of them: you are signed out and the cart on this device is emptied.',
      ] },
      { heading: 'How long we keep it', body: [
        'We keep your account, application, license documents and orders while your account is active and as long as needed for tax and licensing records.',
        { list: [
          'When you upload a new license file, the earlier one is kept too, as the record of what we checked.',
          'Your saved cart is replaced each time the cart changes, and is deleted with your account.',
          'Order copies sent through Netlify stay in our Netlify form records and our inbox until we delete them.',
        ] },
      ] },
      { heading: 'How we protect it', body: [
        { list: [
          'Pages and information travel over an encrypted connection (HTTPS).',
          'Supabase stores your password scrambled, so nobody can read it, our staff included.',
          'The database checks every request: an account can read only its own records, and only approved trade desk accounts can open anyone else’s.',
          'On a shared store computer, sign out when you are done. My account also has Sign out of all devices, which ends your sign-in everywhere.',
        ] },
        'If you think someone else has your login, tell us right away.',
      ] },
      { heading: 'Get a copy, a correction or deletion', body: [
        <>To get a copy of the information we hold about you, have it corrected, or have it deleted, <CallOrEmail before="call" after="." /></>,
        'We check that the request comes from the account holder before we act on it. We delete what we no longer need; records needed for tax and licensing stay until they are no longer needed.',
        <>Your account details and order history are in <Link to="/account">My account</Link> whenever you are signed in.</>,
      ] },
      { heading: 'Changes to this policy', body: [
        'If this policy changes, the new version is posted here with a new date.',
      ] },
    ],
  },
  terms: {
    eyebrow: 'CUSTOMER POLICIES',
    ...POLICY_TEXT.terms,
    updated: POLICIES_DATE,
    sections: [
      { heading: 'Who can buy', body: [
        // TODO(owner): Is a tobacco license required for every trade account, or only for tobacco, vapor, and nicotine? This sentence is unchanged until you decide. (AW-129)
        'Alabama Wholesale sells to licensed retail businesses only. We do not sell to consumers. Applicants must be 21 or older and provide a federal EIN, a state retail tobacco license number for the store, and a resale certificate number. We verify these before the first order.',
      ] },
      { heading: 'Account approval', body: [
        'Applications are reviewed by a trade rep. Wholesale pricing and ordering unlock when the account is approved. We may decline, pause or close an account whose licensing cannot be verified or is no longer valid.',
      ] },
      { heading: 'Pricing and orders', body: [
        'Wholesale prices shown after sign-in apply to the approved account that is signed in and are not for publication. Orders are placed from an approved account, and the trade desk confirms pricing, availability and delivery before an order is accepted and prepared. Prices and availability can change until then.',
      ] },
      { heading: 'Orders and delivery', body: [
        `The minimum order is ${formatMoney(ORDER_MINIMUM)}.`,
        <>Orders are delivered on our own trucks when the stop is on a delivery route in Alabama, Mississippi or Georgia, or collected at the Birmingham warehouse during business hours. See the <Link to="/shipping">Delivery policy</Link> for how that works.</>,
      ] },
      // No credit (Net-30) terms and no published volume discounts; volume
      // pricing is agreed with the trade desk (AW-025, owner answer 2026-10).
      { heading: 'Payment', body: [
        'Payment methods are cash, checks, and electronic wiring and transfers.',
        <><VolumePricing /></>,
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
          {/* The contact strip right below has the phone and email (AW-276).
              The date is a <time> with its ISO value (AW-277). */}
          {policy.updated && <p className="support-note">Last updated <time dateTime={policy.updated.on}>{policy.updated.label}</time>.</p>}
        </article>
      </SupportLayout>
      <ContactStrip />
    </section>
  );
}
