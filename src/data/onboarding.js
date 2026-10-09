// Trade-account onboarding copy shared by the application dialog and the
// support pages. Delivery states follow the owner-confirmed route list; the
// storefront never promises a stop — customers call to confirm.

export const APPLICATION_CHECKLIST = [
  { title: 'Federal EIN', detail: 'Your 9-digit Employer Identification Number.' },
  // TODO(owner): Is a tobacco license required for every trade account, or only for buying tobacco, vapor, and nicotine products? Checklist and form still disagree until you decide. (AW-129)
  { title: 'State retail tobacco license number', detail: 'Issued by the state your store is in. Required before you can buy tobacco or vapor products.' },
  { title: 'Resale certificate number', detail: 'Your sales tax resale or exemption certificate for the store.' },
  // The form's optional uploads (AW-250).
  { title: 'Photos of your license and resale certificate (optional)', detail: 'A PDF or a clear photo of each. Upload them with the application or later from your account.' },
  { title: 'Store details', detail: 'Legal business name, store type, and the store’s street address.' },
  { title: 'Account contact', detail: 'Your name, a phone number, and the business email you will sign in with.' },
];

export const DELIVERY_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'GA', name: 'Georgia' },
];

// States off the delivery routes, for the service-area check.
// TODO(owner): Do any delivery routes reach Tennessee or another state not listed? Tennessee shows as outside the routes until you say. (AW-270)
export const OTHER_STATES = [
  ['AR', 'Arkansas'], ['FL', 'Florida'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['NC', 'North Carolina'],
  ['SC', 'South Carolina'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['VA', 'Virginia'], ['XX', 'Another state'],
].map(([code, name]) => ({ code, name }));
