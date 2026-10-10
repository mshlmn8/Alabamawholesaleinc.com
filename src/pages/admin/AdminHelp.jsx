// "How to use Admin" on the admin home (/admin, AW-030, AW-031; owner answer
// 2026-10): the everyday jobs the owner and staff do here, in a few steps
// each, with a link to the section. Folded by default (a <details>, like
// the order cards' staff notes), so the orders stay at the top. Making
// someone staff is an admin's job; staff are told to ask.

import { Link } from '../../lib/router.js';
import { adminHref } from '../../lib/adminRoutes.js';
import { Icon } from '../../components/Icon.jsx';

// The jobs, in the order the panel lists them. admin: only an admin can do
// it (staff read `staff` instead of `steps`).
export const HELP_TOPICS = Object.freeze([
  {
    id: 'photo',
    title: 'Change a product photo',
    steps: 'In Products, search for the product and choose Edit. Under Photo, choose Upload a photo (JPEG, PNG or WebP, up to 5 MB), then Save product. Uploading another photo replaces it.',
    link: { section: 'products', label: 'Go to Products' },
  },
  {
    id: 'sell-unit',
    title: 'Set sell units',
    steps: 'One product: Edit it in Products and fill in Sell unit, what a quantity of 1 is (such as box of 24), then Save product. Many at once: tick the products (No sell unit lists the ones without), choose Set sell unit, type it and confirm.',
    link: { section: 'products', query: { unit: 'none' }, label: 'Products with no sell unit' },
  },
  {
    id: 'homepage',
    title: 'Edit the home page’s photos',
    steps: 'In Homepage, choose Add a photo: pick one of the site’s photos or upload your own, describe what it shows and choose the department it links to. Move photos up or down, turn them off, or edit them.',
    link: { section: 'homepage', label: 'Go to Homepage' },
  },
  {
    id: 'settings',
    title: 'Change the announcements, phone, email, hours or address',
    steps: 'In Site settings, change what you need and choose Save site settings. Every page shows the change. “Use the site’s own” puts a group back as it was.',
    link: { section: 'settings', label: 'Go to Site settings' },
  },
  {
    id: 'approve',
    title: 'Approve an account',
    steps: 'In Accounts, the Pending list shows new applications. Choose Details to check the license numbers and View each license document, then Approve. Email applicant writes the approval email in your own mail app.',
    link: { section: 'accounts', label: 'Pending accounts' },
  },
  {
    id: 'staff',
    title: 'Make someone staff',
    admin: true,
    steps: 'In Accounts, choose All, find the person’s account and set its Role to Staff, with a reason. Staff can use all of Admin except changing roles and pricing tiers. Set the role back to Customer to take it away.',
    staff: 'Only an admin can make someone staff or change pricing tiers. Ask the owner.',
    link: { section: 'accounts', query: { status: 'all' }, label: 'All accounts' },
  },
]);

// admin: the signed-in account is an approved admin (staff read the
// admin-only steps as "ask the owner").
export function AdminHelp({ admin = false }) {
  return (
    <details className="admin-help">
      <summary>
        <Icon name="help" className="admin-help-icon" />
        <h2>How to use Admin</h2>
        <Icon name="plus" className="admin-help-plus" /><Icon name="minus" className="admin-help-minus" />
      </summary>
      <ol className="admin-help-list">
        {HELP_TOPICS.map((topic) => {
          const allowed = admin || !topic.admin;
          return (
            <li key={topic.id}>
              <h3>{topic.title}</h3>
              <p>{allowed ? topic.steps : topic.staff}</p>
              {allowed && <Link className="text-link" to={adminHref({ section: topic.link.section, query: topic.link.query })}>{topic.link.label}</Link>}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
