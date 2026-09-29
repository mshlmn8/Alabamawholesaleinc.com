// Trade-account onboarding copy shared by the application dialog and the
// support pages. Delivery states follow the owner-confirmed route list; the
// storefront never promises a stop — customers call to confirm.

export const APPLICATION_CHECKLIST = [
  { title: 'Federal EIN', detail: 'Your 9-digit Employer Identification Number.' },
  { title: 'State retail tobacco license number', detail: 'Issued by the state your store is in. Required before you can buy tobacco or vapor products.' },
  { title: 'Resale certificate number', detail: 'Your sales tax resale or exemption certificate for the store.' },
  { title: 'Store details', detail: 'Legal business name, store type, and the store’s street address.' },
  { title: 'Account contact', detail: 'Your name, a phone number, and the business email you will sign in with.' },
];

export const DELIVERY_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'GA', name: 'Georgia' },
];

export const OTHER_STATES = [
  ['AR', 'Arkansas'], ['FL', 'Florida'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['NC', 'North Carolina'],
  ['SC', 'South Carolina'], ['TX', 'Texas'], ['VA', 'Virginia'], ['XX', 'Another state'],
].map(([code, name]) => ({ code, name }));
