// Sign-in (email + password), sign-up (business onboarding), pending-approval
// and password-reset screens on the 2A dialog shell. On sign-up a profile row
// is created as a pending customer. Owner access is a separate admin step, not
// part of public signup.
//
// After a sign-in the dialog waits for the account's profile: a pending or
// suspended account sees its status, an approved one closes the dialog, and a
// profile that does not load gets a message with Try again and Sign out
// instead of a silent close (AW-089). A sign-in finished in another tab
// closes the password form here too (AW-335).
//
// The dialog owns its ModalLayer. Every way out (×, Escape, Back, the
// backdrop, Done) goes through requestClose, which asks before a half-typed
// application is thrown away (AW-018); the backdrop is ignored while there
// are typed answers. The answers are not kept between openings on purpose:
// an EIN and licence numbers held in memory or sessionStorage would show to
// the next person on a shared store computer.
//
// 'Check your inbox' and 'Confirm your email first' can send the
// confirmation email again, once a minute (AW-016); the password reset step
// can send its link again, on its own minute (AW-259).
//
// License documents chosen on the application (AW-085) upload right after a
// sign-up that returns a session; one that fails is listed with Try again.
// With email confirmation on there is no session yet: the files stay in
// this dialog's state (never in localStorage or sessionStorage) and upload
// here once the applicant confirms the email in this browser, which signs
// in another tab and reaches this one (AW-335). A session for any other
// email never gets them.
//
// The sign-in, application and reset forms check themselves before sending
// (AW-173): what is missing or mistyped shows under its field, and the first
// one takes focus (Field and ValidatedForm, ./Field.jsx). The application's
// phone must have ten digits (AW-247), checked the same way.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { COMPANY, TERMS_VERSION } from '../data/content.js';
import { APPLICATION_TIMEOUT_MESSAGE, isRateLimitError } from '../lib/errors.js';
import { isTimeoutError } from '../lib/network.js';
import { friendlyAuthError } from '../lib/authErrors.js';
import { PHONE_ERROR, PHONE_EXAMPLE, PHONE_PATTERN, PHONE_REQUIRED, PHONE_TITLE, usPhone } from '../lib/phone.js';
import { LICENSE_REQUIRED, RESALE_REQUIRED } from '../lib/fieldErrors.js';
import { Link, restoreOverlayEntry } from '../lib/router.js';
import { announce } from '../lib/announce.js';
import { APPLICATION_CHECKLIST } from '../data/onboarding.js';
import { DELIVERY_ROUTE_STATES } from '../data/quoteRules.js';
import { APPLY_INSTEAD, APPLY_LABEL, SIGN_IN_INSTEAD } from '../data/terms.js';
import { US_STATES, stateName } from '../data/usStates.js';
import { DOCUMENT_TYPES, documentErrorMessage, shortFileName, uploadSelectedProof } from '../lib/documents.js';
import { ServiceUnavailable } from './ServiceUnavailable.jsx';
import { CallOrEmail } from './ContactLinks.jsx';
import { DocumentUploads } from './DocumentUploads.jsx';
import { Field, ValidatedForm } from './Field.jsx';
import { Icon } from './Icon.jsx';
import { ModalLayer } from './ModalLayer.jsx';
import { PASSWORD_MIN_LENGTH, PasswordField } from './PasswordField.jsx';

const BUSINESS_TYPES = ['Convenience Store','Smoke Shop','Vape Shop','Liquor Store','Grocery / Bodega','Auto Parts','Hookah Lounge','Other'];
// The values stored in profiles.expected_volume stay as they were; the
// options show them with the site's unspaced en dash, '$5K–$15K' (AW-282).
const VOLUMES = ['Under $5K','$5K — $15K','$15K — $50K','$50K — $100K','$100K+'];
const volumeLabel = (value) => value.replace(' — ', '–');
// A store outside the delivery routes is told how orders would reach it,
// instead of the list offering only nearby states and 'Other' (AW-282). No
// state chosen yet (an empty default) is no store off the routes.
// TODO(owner): Do you accept trade accounts from stores outside AL, MS and GA, for will-call only? (AW-282)
const ROUTE_STATE_NAMES = DELIVERY_ROUTE_STATES.map(stateName);
// No Array.prototype.at: the build targets Safari 14, which lacks it (NEW-019).
const ROUTE_STATES_TEXT = `${ROUTE_STATE_NAMES.slice(0, -1).join(', ')} and ${ROUTE_STATE_NAMES[ROUTE_STATE_NAMES.length - 1]}`;
const outOfAreaHint = (code) => (!code || DELIVERY_ROUTE_STATES.includes(code)
  ? null
  : `Our delivery routes cover ${ROUTE_STATES_TEXT}. For a store in ${stateName(code) || 'another state'}, ask the trade desk how orders would reach you.`);

// How long "Signing you in…" waits for the account before saying so.
export const CHECKING_TIMEOUT_MS = 10000;
// How long Resend waits before it can send the confirmation email, or Send
// again the reset link, once more (AW-016, AW-259). Supabase limits these
// emails too; see RESEND_RATE_LIMITED.
export const RESEND_COOLDOWN_MS = 60000;
export const RESEND_RATE_LIMITED = 'We just sent one. Wait a minute, then try again.';
// Screens that ask a signed-out visitor for something. When a session appears
// while one is open (a sign-in in another tab), the dialog moves on. The
// application form and checklist are left alone, so typed answers stay.
const SIGNED_OUT_MODES = ['signin', 'reset', 'reset-sent', 'unconfirmed'];
// Screens after a sign-in here (or in another tab): that account is the one
// in use, so typed application answers no longer need guarding.
const SIGNED_IN_MODES = ['checking', 'status', 'profile-error'];

const isUnconfirmedEmail = (err) => err?.code === 'email_not_confirmed' || /email not confirmed/i.test(err?.message || '');

// The field a refused submit is about, by the error's code (NEW-003): a weak
// password is the password's fault; a taken, unknown or mistyped email the
// email's. Focus goes there when the refusal took it from the submit button.
// An unconfirmed email opens a step of its own, whose heading takes focus.
const EMAIL_CODES = new Set(['invalid_credentials', 'user_already_exists', 'email_exists', 'email_address_invalid', 'validation_failed']);
function refusedField(err, { email, password }) {
  const code = typeof err?.code === 'string' ? err.code : '';
  if (password && (code === 'weak_password' || err?.name === 'AuthWeakPasswordError')) return password;
  if (email && EMAIL_CODES.has(code)) return email;
  return null;
}

// TODO(owner): Approve the consent checkbox wording. The Trade terms / Privacy
// version it records is TERMS_VERSION in ../data/content.js. (AW-019)

// The three selects start empty and are required, so an answer is one the
// applicant chose, not a default nobody looked at (AW-091).
const EMPTY_SIGNUP = {
  email: '', password: '', name: '', business: '', phone: '',
  ein: '', license_no: '', resale_cert_no: '',
  business_type: '', state: '', expected_volume: '',
  // The store's address (AW-092) and the two required boxes (AW-019).
  store_street: '', store_city: '', store_zip: '',
  agreeTerms: false, ageConfirmed: false,
};

// True for RESEND_COOLDOWN_MS after start(); each start begins a new minute.
function useCooldown() {
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!round) return undefined;
    const id = window.setTimeout(() => setRound(0), RESEND_COOLDOWN_MS);
    return () => window.clearTimeout(id);
  }, [round]);
  return [round > 0, () => setRound((r) => r + 1)];
}

// A select's first, unpickable option, shown until the applicant chooses (AW-091).
const choose = <option value="" disabled>Select…</option>;

// The chosen files of `types`, for uploadSelectedProof.
const filesOf = (proof, types) => Object.fromEntries(types.map((type) => [type, proof[type]]));
const PROOF_UPLOADING = 'Uploading your documents…';
// What an upload of the application's documents came to (AW-085): per
// failed document type its sentence, and one line for the status.
function proofOutcome(results) {
  const done = DOCUMENT_TYPES.filter((doc) => results?.[doc.id]?.ok);
  const missed = DOCUMENT_TYPES.filter((doc) => results?.[doc.id] && !results[doc.id].ok);
  const failed = Object.fromEntries(missed.map((doc) => [doc.id, documentErrorMessage(results[doc.id].error)]));
  const name = (doc) => doc.label.toLowerCase();
  let status = '';
  if (done.length && missed.length) status = `Your ${name(done[0])} is uploaded. Your ${name(missed[0])} didn’t upload.`;
  else if (missed.length) status = missed.length === 1 ? `Your ${name(missed[0])} didn’t upload.` : 'Your documents didn’t upload.';
  else if (done.length) status = done.length === 1 ? `Your ${name(done[0])} is uploaded.` : 'Your documents are uploaded.';
  return { failed, status };
}

export function AuthModal({ initialMode = 'signin', onClose, onSignOut, signingOut = false }) {
  const {
    signIn, signUp, resetPassword, resendConfirmation, refreshProfile,
    session, profile, profileReady, profileRefreshing, loading, isBackendConfigured,
  } = useAuth();
  // signin | checklist | signup | sent | status | checking | profile-error
  // | reset | reset-sent | unconfirmed
  // initialMode 'signup' starts at the checklist; 'application' skips straight to the form.
  const [mode, setMode] = useState(initialMode === 'signup' ? 'checklist' : initialMode === 'application' ? 'signup' : initialMode);
  const [afterSignup, setAfterSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Counts the sends that have ended, so the focus effect below runs after
  // each one, even one refused so fast that `submitting` never showed true.
  const [sendsEnded, setSendsEnded] = useState(0);
  const endSend = () => { setSubmitting(false); setSendsEnded((n) => n + 1); };
  const [error, setError] = useState(null);
  const [signin, setSignin] = useState({ email: '', password: '' });
  // Opened for a reset while signed in ('Forgot it?' on /reset-password),
  // the link is for this account: its email is filled in (NEW-067).
  const [resetEmail, setResetEmail] = useState(() => (initialMode === 'reset' && session?.user?.email) || '');
  const [signup, setSignup] = useState(EMPTY_SIGNUP);
  // The application's refusal that is about one field, { id, message },
  // said under that field until it changes (NEW-003).
  const [signupRefusal, setSignupRefusal] = useState(null);
  const refusalFor = (id) => (signupRefusal?.id === id ? signupRefusal.message : '');
  const [proof, setProof] = useState({});
  const [proofErrors, setProofErrors] = useState({});
  // Files chosen on an application that returned no session, held until
  // the applicant's own session reaches this tab (AW-085).
  const [proofWaiting, setProofWaiting] = useState(false);
  // Per document type, why its file didn't upload; the line that says how
  // the last upload went; and a Try again running.
  const [proofFailed, setProofFailed] = useState({});
  const [proofStatus, setProofStatus] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  // A confirmation email sent again: to whom, and whether the minute before
  // the next one is still running (AW-016). The reset link has its own
  // minute, and resetAgain says the last one went from Send again (AW-259).
  const [resentTo, setResentTo] = useState('');
  const [cooling, startCooling] = useCooldown();
  const [resetCooling, startResetCooling] = useCooldown();
  const [resetAgain, setResetAgain] = useState(false);
  // The 'Discard your application?' bar (AW-018).
  const [confirming, setConfirming] = useState(false);
  const titleRef = useRef(null);
  const dialogRef = useRef(null);
  const keepEditingRef = useRef(null);
  const resendRef = useRef(null);
  // The submit button of the form on show (sign-in, application or reset).
  const submitRef = useRef(null);
  // Where focus was when the discard bar opened, for Keep editing.
  const focusBeforeConfirm = useRef(null);
  // A send is running, and how it started: { kind: 'resend' } (Resend or
  // Send again) or { kind: 'submit', fromButton } (a form, from its focused
  // submit button or not); and the field a refusal is about, { id, message }
  // with the message when it is said under that field. See the focus effect
  // below.
  const submittingFrom = useRef(null);
  const refusedAt = useRef(null);
  // The session the application's files went up with, for Try again; and
  // whether the held files have been sent.
  const proofSession = useRef(null);
  const heldSent = useRef(false);
  const onCloseRef = useRef(onClose);
  // Keep the latest onClose for the timers and effects below.
  useLayoutEffect(() => { onCloseRef.current = onClose; });
  // Focus trap, inert background, Escape and focus restore come from the
  // ModalLayer this dialog is rendered in; data-autofocus marks the first field.

  // Each step swaps the dialog content, so the new step starts at the top
  // (AW-096) and its heading takes focus, also on a return to the first step
  // (AW-090). The step shown last is compared, not a first-run flag: under
  // StrictMode the effect runs twice on open, and the opening step's own
  // data-autofocus field keeps focus.
  const shownMode = useRef(mode);
  useEffect(() => {
    if (shownMode.current === mode) return;
    shownMode.current = mode;
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // The session the dialog was opened with, once auth has loaded (AW-335).
  const userId = session?.user?.id ?? null;
  const [openedWith, setOpenedWith] = useState(loading ? undefined : userId);
  if (openedWith === undefined && !loading) setOpenedWith(userId);
  const signedInMeanwhile = openedWith === null && userId !== null && SIGNED_OUT_MODES.includes(mode);

  // After a sign-in (here or in another tab), wait for the account's profile.
  const waiting = mode === 'checking' || signedInMeanwhile;
  const settled = waiting && !loading && !!session && profileReady && !profileRefreshing;
  // A sign-in that timed out here went through after all (AW-194): its error is moot.
  if (settled && error) setError(null);
  if (settled && profile && profile.status !== 'approved') setMode('status');
  else if (settled && !profile) setMode('profile-error');
  else if (mode === 'profile-error' && !loading && !session) setMode('signin');
  const approved = settled && profile?.status === 'approved';
  useEffect(() => {
    if (approved) onCloseRef.current();
  }, [approved]);
  // A profile that takes too long gets the same message as one that failed,
  // instead of the dialog closing on its own.
  useEffect(() => {
    if (mode !== 'checking') return undefined;
    const id = window.setTimeout(() => setMode('profile-error'), CHECKING_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [mode]);

  // Where focus goes when a send has finished (NEW-003). A button disabled
  // (or hidden) while it had focus drops focus to <body> (Chrome) or leaves
  // it on a dead control.
  // - A refusal said under its field (the application's email already in
  //   use, or a weak password) works like the form's own check: that field
  //   takes focus, and its message is read out if it already had focus.
  // - Otherwise focus stays where it is, unless it was lost that way. Then,
  //   after Resend or Send again, it goes to that button if it can be used
  //   again (it failed), else to the dialog's heading; after Sign in or Send
  //   reset link pressed with focus on it, to the field the refusal is about
  //   (refusedField), else back to the button, scrolled into view.
  // A step that changed has already focused its heading, and Enter pressed in
  // a field leaves focus there.
  useEffect(() => {
    const from = submittingFrom.current;
    if (!from || submitting) return;
    submittingFrom.current = null;
    const refusal = refusedAt.current;
    refusedAt.current = null;
    const dialog = dialogRef.current;
    const active = document.activeElement;
    const usable = (el) => (el && el.isConnected && !el.disabled ? el : null);
    const field = usable(refusal ? dialog?.querySelector(`#${refusal.id}`) : null);
    if (refusal?.message && field) {
      if (field === active) announce(refusal.message);
      else field.focus();
      return;
    }
    if (active && active !== document.body && !active.disabled && dialog?.contains(active)) return;
    if (from.kind === 'resend') {
      (usable(resendRef.current) || titleRef.current)?.focus({ preventScroll: true });
    } else if (from.fromButton) {
      (field || usable(submitRef.current) || titleRef.current)?.focus();
    }
  }, [submitting, sendsEnded]);
  // A form is sending: note whether its submit button has the focus that
  // `disabled` is about to drop (NEW-003).
  const noteSubmitFocus = () => {
    submittingFrom.current = { kind: 'submit', fromButton: !!submitRef.current && document.activeElement === submitRef.current };
    refusedAt.current = null;
  };

  // Held files go up once, when a session for the email that applied
  // appears (AW-085): a confirmation in this browser while 'Check your inbox'
  // is open, or a sign-in here from that step, on any step after it
  // (NEW-015). The status step then says how the upload went.
  const heldEmail = signup.email.trim().toLowerCase();
  const sessionEmail = String(session?.user?.email || '').toLowerCase();
  const applicantSession = afterSignup && !!session?.user?.id && sessionEmail !== '' && sessionEmail === heldEmail;
  const heldReady = proofWaiting && applicantSession;
  // Once the applicant's session has reached this tab, the email is
  // confirmed: 'Check your inbox' says so and stops offering Resend (NEW-015).
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  if (applicantSession && !emailConfirmed) setEmailConfirmed(true);
  useEffect(() => {
    if (!heldReady || heldSent.current) return;
    heldSent.current = true;
    proofSession.current = session;
    const types = DOCUMENT_TYPES.filter((doc) => proof[doc.id]).map((doc) => doc.id);
    uploadSelectedProof(session, filesOf(proof, types)).then(({ results }) => {
      const outcome = proofOutcome(results);
      setProofFailed(outcome.failed);
      setProofStatus(outcome.status);
      setProofWaiting(false);
    });
  }, [heldReady, session, proof]);

  // Typed application answers (AW-018). Guarded in every mode, so they stay
  // guarded after 'Back to the checklist' or 'Already have an account? Sign in',
  // until the application is sent or a sign-in here makes it moot.
  const touched = Object.keys(EMPTY_SIGNUP).some((k) => signup[k] !== EMPTY_SIGNUP[k]) || Object.values(proof).some(Boolean);
  const dirty = touched && !afterSignup && !SIGNED_IN_MODES.includes(mode);
  // Held documents not sent yet are guarded too (NEW-015): they live only in
  // this dialog, so closing it loses them. Once their upload has started,
  // closing no longer stops it.
  const heldUnsent = proofWaiting && !heldReady;
  const guarded = dirty || heldUnsent;
  if (confirming && !guarded) setConfirming(false);
  // The bar's first button takes focus, which also scrolls the bar into view.
  // A bar that goes away by itself (the documents started uploading) hands
  // focus to the heading if it had it.
  const barShown = useRef(false);
  useEffect(() => {
    if (confirming) {
      barShown.current = true;
      keepEditingRef.current?.focus();
      return;
    }
    if (!barShown.current) return;
    barShown.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || !dialogRef.current?.contains(active)) titleRef.current?.focus({ preventScroll: true });
  }, [confirming]);
  // Resend and Sign in go from 'Check your inbox' once the email is
  // confirmed here; focus on one of them moves to the heading.
  useEffect(() => {
    const active = document.activeElement;
    if (mode === 'sent' && emailConfirmed && (!active || active === document.body)) titleRef.current?.focus({ preventScroll: true });
  }, [mode, emailConfirmed, applicantSession]);

  const keepEditing = () => {
    setConfirming(false);
    const back = focusBeforeConfirm.current;
    focusBeforeConfirm.current = null;
    const target = back && back !== document.body && back.isConnected && dialogRef.current?.contains(back) ? back : titleRef.current;
    // Scrolls the field back into view if the bar's focus scrolled it away.
    target?.focus();
  };
  // ×, Escape, Back, Done: close, unless that would throw away typed
  // answers or documents not sent yet. Then the bar asks first, and a second
  // Escape or Back answers Keep editing (Keep it open). restoreOverlayEntry()
  // puts back the history entry Back took, so the next Back still belongs to
  // the dialog (AW-065).
  const requestClose = () => {
    if (confirming) {
      keepEditing();
      restoreOverlayEntry();
    } else if (guarded) {
      focusBeforeConfirm.current = document.activeElement;
      setConfirming(true);
      restoreOverlayEntry();
    } else {
      onClose();
    }
  };

  const setS = (k) => (e) => setSignin({ ...signin, [k]: e.target.value });
  const setU = (k) => (e) => setSignup({ ...signup, [k]: e.target.value });
  const switchMode = (next) => { setError(null); setSignupRefusal(null); setMode(next); };

  const handleSignin = async (e) => {
    e.preventDefault();
    noteSubmitFocus();
    setSubmitting(true); setError(null);
    try { await signIn(signin); setMode('checking'); }
    catch (err) {
      // An account whose confirmation link expired (AW-015) can ask for a new one.
      if (isUnconfirmedEmail(err)) setMode('unconfirmed');
      // Supabase's own text is never shown (AW-084).
      else {
        const id = refusedField(err, { email: 'aw-email' });
        refusedAt.current = id && { id };
        setError(friendlyAuthError(err, { what: 'Account sign-in', fallback: 'We couldn’t sign you in. Try again in a moment.' }));
      }
    }
    finally { endSend(); }
  };

  // Sends the sign-up confirmation email to `email` again (AW-015, AW-016).
  const handleResend = async (email) => {
    submittingFrom.current = { kind: 'resend' };
    setSubmitting(true); setError(null);
    try {
      await resendConfirmation(email);
      setResentTo(email);
      startCooling();
    } catch (err) {
      setError(isRateLimitError(err)
        ? RESEND_RATE_LIMITED
        : friendlyAuthError(err, { what: 'Email confirmation', fallback: 'We couldn’t send a new confirmation link. Try again in a moment.' }));
    } finally { endSend(); }
  };

  const retryProfile = () => {
    setError(null);
    setMode('checking');
    refreshProfile();
  };

  const onProof = (type, file, problem) => {
    setProofErrors(prev => ({ ...prev, [type]: problem }));
    setProof(prev => ({ ...prev, [type]: file }));
  };

  // The form's own check (ValidatedForm): the browser's pattern lets through
  // text with the right characters only; the phone needs ten digits (AW-247).
  // An empty phone gets its own 'Enter a phone number.' (data-required-message).
  const validateSignup = () => (signup.phone.trim() && !usPhone(signup.phone) ? { 'aw-su-phone': PHONE_ERROR } : {});

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    // A number staff can call (AW-247): ten digits, sent as (205) 555-0123.
    // validateSignup has said so under the field; this is only a guard.
    const phone = usPhone(signup.phone);
    if (!phone) return;
    noteSubmitFocus();
    setSignupRefusal(null);
    setSubmitting(true);
    try {
      const data = await signUp({
        ...signup,
        phone: phone.formatted,
        terms_accepted: signup.agreeTerms,
        terms_version: TERMS_VERSION,
        age_confirmed: signup.ageConfirmed,
      });
      const chosen = DOCUMENT_TYPES.filter(doc => proof[doc.id]).map(doc => doc.id);
      // Each chosen file goes up now when there is a session; one that fails
      // doesn't stop the other (AW-085). Email confirmation leaves no
      // session: the files are held, and storage isn't called.
      if (data?.session && chosen.length) {
        proofSession.current = data.session;
        const { results } = await uploadSelectedProof(data.session, filesOf(proof, chosen));
        const outcome = proofOutcome(results);
        setProofFailed(outcome.failed);
        setProofStatus(outcome.status);
      }
      setProofWaiting(chosen.length > 0 && !data?.session);
      setAfterSignup(true);
      setMode(data?.session ? 'status' : 'sent');
    }
    catch (err) {
      // A timed-out application may have gone through (AW-194): its
      // confirmation email says so.
      const message = isTimeoutError(err) ? APPLICATION_TIMEOUT_MESSAGE
        : friendlyAuthError(err, { what: 'The online application', fallback: 'We couldn’t send your application. Try again in a moment.' });
      // An email already in use, or a weak password, is said under that
      // field, which takes focus (NEW-003); anything else in the form's alert.
      const id = refusedField(err, { email: 'aw-su-email', password: 'aw-su-pass' });
      if (id) {
        refusedAt.current = { id, message };
        setSignupRefusal({ id, message });
      } else {
        setError(message);
      }
    }
    finally { endSend(); }
  };

  // Try again for the application's files that didn't upload: only those,
  // with the session they went up with (the current one, once refreshed).
  // When none is left to retry, focus goes to the heading, as the button
  // that had it is gone.
  const retryProof = async () => {
    const types = DOCUMENT_TYPES.filter((doc) => proofFailed[doc.id] && proof[doc.id]).map((doc) => doc.id);
    const held = proofSession.current;
    const withSession = session?.user?.id && session.user.id === held?.user?.id ? session : held;
    if (proofBusy || !types.length || !withSession) return;
    setProofBusy(true);
    setProofStatus(PROOF_UPLOADING);
    const { results } = await uploadSelectedProof(withSession, filesOf(proof, types));
    const outcome = proofOutcome(results);
    setProofFailed(outcome.failed);
    setProofStatus(outcome.status);
    setProofBusy(false);
    if (!Object.keys(outcome.failed).length) titleRef.current?.focus({ preventScroll: true });
  };

  // Sends the password reset link to resetEmail, from the form or from Send
  // again on 'Check your inbox'. Each send starts the minute before Send
  // again can be used (AW-259).
  const sendResetLink = async (again) => {
    if (again) submittingFrom.current = { kind: 'resend' };
    else noteSubmitFocus();
    setSubmitting(true); setError(null);
    try {
      await resetPassword(resetEmail);
      setResetAgain(again);
      startResetCooling();
      setMode('reset-sent');
    } catch (err) {
      const id = again ? null : refusedField(err, { email: 'aw-reset-email' });
      refusedAt.current = id && { id };
      setError(again && isRateLimitError(err)
        ? RESEND_RATE_LIMITED
        : friendlyAuthError(err, { what: 'Password reset', fallback: 'We couldn’t send the reset link. Try again in a moment.' }));
    } finally { endSend(); }
  };
  const handleReset = (e) => {
    e.preventDefault();
    sendResetLink(false);
  };
  // Sign in keeps the email typed for the reset link, and the reset form the
  // one typed for sign-in (AW-259).
  const backToSignin = () => {
    if (resetEmail) setSignin((s) => ({ ...s, email: resetEmail }));
    switchMode('signin');
  };
  // From 'Check your inbox': sign in with the email the application used (AW-260).
  const signInWithApplication = () => {
    setSignin((s) => ({ ...s, email: signup.email }));
    switchMode('signin');
  };

  const status = profile?.status || 'pending';
  const stateHint = outOfAreaHint(signup.state);
  const kicker = {
    signin: 'EXISTING ACCOUNTS',
    checklist: 'NEW ACCOUNTS · LICENSED RETAILERS ONLY',
    signup: 'NEW ACCOUNTS · LICENSED RETAILERS ONLY',
    sent: 'CONFIRM YOUR EMAIL',
    status: status === 'suspended' ? 'ACCOUNT ON HOLD' : 'APPLICATION UNDER REVIEW',
    checking: 'EXISTING ACCOUNTS',
    'profile-error': 'EXISTING ACCOUNTS',
    reset: 'PASSWORD HELP',
    'reset-sent': 'PASSWORD HELP',
    unconfirmed: 'CONFIRM YOUR EMAIL',
  }[mode];
  const title = {
    signin: 'Sign in',
    checklist: APPLY_LABEL,
    signup: APPLY_LABEL,
    sent: 'Check your inbox',
    status: status === 'suspended' ? 'Your account needs attention' : 'Your account is pending approval',
    checking: 'Signing you in…',
    'profile-error': 'We couldn’t load your account',
    reset: 'Reset your password',
    'reset-sent': 'Check your inbox',
    unconfirmed: 'Confirm your email first',
  }[mode];
  // One string, so Google Translate cannot strand a piece of it (AW-039).
  const applicantName = profile?.name || signup.name;
  const applicantBusiness = profile?.business || signup.business;
  const statusMessage = `${afterSignup ? 'Thanks' : 'Welcome back'}${applicantName ? `, ${applicantName}` : ''}. `
    + `${applicantBusiness ? `We have the application for ${applicantBusiness}. ` : ''}`
    + `A trade rep is reviewing your license information and will contact you at ${profile?.email || signup.email} when your account is approved. Wholesale pricing and ordering unlock at that point.`;
  const unavailableWhat = { signin: 'Account sign-in', checking: 'Account sign-in', checklist: 'The online application', signup: 'The online application', reset: 'Password reset', unconfirmed: 'Email confirmation' }[mode];
  // Said once a confirmation email has gone again, until Resend can be used again.
  const resendStatus = cooling
    ? `Sent again to ${resentTo}. It can take a few minutes; check your spam folder too. You can ask for another in a minute.`
    : '';
  // While Send again waits out the minute after a reset link went, why it
  // can't be used yet; after Send again, also that it went (AW-259).
  let resetStatus = '';
  if (resetCooling) resetStatus = resetAgain ? `Sent again to ${resetEmail}. You can ask for another in a minute.` : 'You can ask for another link in a minute.';

  // The application's files that didn't upload, each with its reason, then
  // Try again or My account (AW-085). Shown on 'Check your inbox' after the
  // held files went up, and on the status step after a sign-up.
  const failedProof = DOCUMENT_TYPES.filter((doc) => proofFailed[doc.id]);
  const proofProblem = failedProof.length > 0 && (
    <div className="proof-failed">
      <ul className="proof-failed-list">
        {failedProof.map((doc) => (
          <li key={doc.id}>
            <b title={proof[doc.id]?.name}>{`${doc.label}: ${shortFileName(proof[doc.id]?.name)}`}</b>
            <span>{proofFailed[doc.id]}</span>
          </li>
        ))}
      </ul>
      <p className="checklist-note">
        <button className="text-link" type="button" onClick={retryProof} aria-disabled={proofBusy ? 'true' : undefined}>
          <span>{proofBusy ? 'Trying again…' : 'Try again'}</span>
        </button>
        {' '}<span>{failedProof.length === 1 ? 'or add it from' : 'or add them from'}</span>{' '}
        <Link to="/account#documents" onClick={onClose}>My account</Link>.
      </p>
    </div>
  );
  // Always rendered on those two steps, so each outcome is read out.
  const proofLine = <p className="checklist-note proof-status" role="status">{heldReady ? PROOF_UPLOADING : proofStatus}</p>;

  const dialog = (
    // Backdrop click is a mouse shortcut; Escape (ModalLayer) and the Close button are the keyboard paths.
    // With typed answers it does nothing: a stray click must not end the application (AW-018).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div className="overlay" onClick={guarded ? undefined : onClose}>
      {/* Keeps clicks inside the dialog from reaching the backdrop. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div className="dialog scale-in" role="dialog" aria-modal="true" aria-labelledby="auth-title" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        {/* One header row: the step's kicker beside the ×, so the first
            field and the submit button fit a landscape phone (AW-245). */}
        <div className="dialog-top">
          <p className="kicker">{kicker}</p>
          <button className="icon-btn" type="button" onClick={requestClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {confirming && (
          <div className="notice discard-confirm" role="group" aria-labelledby="aw-discard-title">
            <p id="aw-discard-title">{dirty
              ? 'Discard your application? What you’ve typed will be lost.'
              : 'Your documents haven’t been sent. Close anyway? You can add them from My account.'}</p>
            <div className="discard-actions">
              <button ref={keepEditingRef} className="button ghost sm" type="button" aria-describedby="aw-discard-title" onClick={keepEditing}>{dirty ? 'Keep editing' : 'Keep it open'}</button>
              <button className="button sm" type="button" onClick={onClose}>{dirty ? 'Discard' : 'Close anyway'}</button>
            </div>
          </div>
        )}
        <h2 id="auth-title" ref={titleRef} tabIndex={-1}>{title}</h2>

        {mode === 'signin' && <p className="desc">Sign in to view wholesale pricing, build orders and see your order history.</p>}
        {mode === 'checklist' && <p className="desc">Alabama Wholesale sells exclusively to licensed retail businesses. Have these on hand before you start. The application takes a few minutes.</p>}
        {/* TODO(owner): How long does approval actually take, what should the application promise, and is Net-30 offered (with credit verification)? Kept as published. (AW-246, AW-272, AW-025) */}
        {/* TODO(owner): A Cloudflare Turnstile site key, so Supabase can require a CAPTCHA on sign-up. (AW-206) */}
        {mode === 'signup' && <p className="desc">Alabama Wholesale sells exclusively to licensed retail businesses. Most applications are approved within one business day. Net-30 terms available with credit verification.</p>}
        {/* TODO(owner): "within one business day" is kept as published; see the AW-246 row in docs/OWNER-TODO.md. (AW-246) */}
        {mode === 'sent' && <p className="desc">We sent a confirmation link to <strong>{signup.email}</strong>. Click it to activate your account — a trade rep will verify your license within one business day.</p>}
        {mode === 'checking' && <p className="desc" aria-live="polite">One moment while we load your account.</p>}
        {mode === 'profile-error' && <p className="desc">We signed you in but couldn’t load your account. <CallOrEmail before="Try again, or call" after=" and a trade rep will help you." /></p>}
        {/* Unchanged after a send: the status line under the button says it
            went, once (NEW-069). */}
        {mode === 'unconfirmed' && (
          <p className="desc">{`${signin.email} isn’t confirmed yet. Open the confirmation link we emailed when you applied, or send a new one. Links work once and expire after a while.`}</p>
        )}
        {mode === 'reset' && <p className="desc">Enter the business email on your account and we’ll send a link to choose a new password.</p>}
        {mode === 'reset-sent' && <p className="desc">If an account exists for <strong>{resetEmail}</strong>, a password reset link is on its way. The link works once. If it doesn’t arrive within a few minutes, check your spam folder. <CallOrEmail before="Still nothing? Call" /></p>}
        {mode === 'status' && (
          status === 'suspended'
            ? <p className="desc">Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>
            : <p className="desc">{statusMessage}</p>
        )}

        {unavailableWhat && !isBackendConfigured && <ServiceUnavailable what={unavailableWhat} />}

        {mode === 'signin' && (
          <ValidatedForm onSubmit={handleSignin}>
            <div className="form-grid">
              <Field id="aw-email" label="Business email" full>
                <input id="aw-email" type="email" name="email" value={signin.email} onChange={setS('email')} required autoComplete="email" inputMode="email" data-autofocus />
              </Field>
              <PasswordField id="aw-pass" className="full" label="Password" name="password" value={signin.password} onChange={setS('password')} required autoComplete="current-password" />
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button ref={submitRef} className="button" type="submit" disabled={submitting || !isBackendConfigured}><span>{submitting ? 'Signing in…' : 'Sign in'}</span></button>
              <button className="text-link" type="button" onClick={() => { setResetEmail(signin.email || resetEmail); switchMode('reset'); }}>Forgot password?</button>
              <button className="text-link" type="button" onClick={() => switchMode('checklist')}>{APPLY_INSTEAD}</button>
            </div>
          </ValidatedForm>
        )}

        {mode === 'checking' && (
          <div className="dialog-actions">
            <button className="text-link" type="button" onClick={requestClose}>Continue browsing</button>
          </div>
        )}

        {mode === 'profile-error' && (
          <div className="dialog-actions">
            <button className="button" type="button" onClick={retryProfile} data-autofocus>Try again</button>
            {onSignOut && (
              <button className="text-link" type="button" onClick={onSignOut} disabled={signingOut}><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
            )}
            <button className="text-link" type="button" onClick={requestClose}>Continue browsing</button>
          </div>
        )}

        {mode === 'unconfirmed' && (
          <>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              {/* Back once the minute after a send is over (AW-016). */}
              {!cooling && (
                <button ref={resendRef} className="button" type="button" onClick={() => handleResend(signin.email)} disabled={submitting || !isBackendConfigured} data-autofocus>
                  <span>{submitting ? 'Sending…' : 'Send a new confirmation link'}</span>
                </button>
              )}
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
            </div>
            <p className="checklist-note" role="status">{resendStatus}</p>
          </>
        )}

        {mode === 'checklist' && (
          <>
            <h3 className="checklist-heading">What you’ll need</h3>
            <ul className="checklist">
              {APPLICATION_CHECKLIST.map(item => (
                <li key={item.title}><b>{item.title}</b><span>{item.detail}</span></li>
              ))}
            </ul>
            <p className="checklist-note">Missing one of these? <CallOrEmail after=" and a trade rep can talk you through the application." /></p>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={() => switchMode('signup')} data-autofocus>Continue to the application</button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>{SIGN_IN_INSTEAD}</button>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <ValidatedForm onSubmit={handleSignup} validate={validateSignup} onChange={(e) => { if (signupRefusal && e.target.id === signupRefusal.id) setSignupRefusal(null); }}>
            <p className="form-note">All fields are required unless marked optional.</p>
            {/* Three groups, each under its legend, then the optional
                documents (AW-243). */}
            <fieldset className="form-grid form-section">
              <legend>Your login</legend>
              <Field id="aw-su-name" label="Your name" full>
                <input id="aw-su-name" name="name" value={signup.name} onChange={setU('name')} required autoComplete="name" data-autofocus />
              </Field>
              <Field id="aw-su-email" label="Business email" error={refusalFor('aw-su-email')}>
                <input id="aw-su-email" type="email" name="email" value={signup.email} onChange={setU('email')} required autoComplete="email" inputMode="email" />
              </Field>
              <Field id="aw-su-phone" label="Phone" hint="Ten digits, the number we should call about this account.">
                <input
                  id="aw-su-phone" type="tel" name="tel" value={signup.phone} onChange={setU('phone')}
                  required autoComplete="tel" inputMode="tel" placeholder={PHONE_EXAMPLE} pattern={PHONE_PATTERN} title={PHONE_TITLE}
                  data-required-message={PHONE_REQUIRED}
                />
              </Field>
              <PasswordField id="aw-su-pass" className="full" label="Password" name="new-password" value={signup.password} onChange={setU('password')} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" showRule error={refusalFor('aw-su-pass')} />
            </fieldset>
            <fieldset className="form-grid form-section">
              <legend>Your store</legend>
              <Field id="aw-su-business" label="Business name" full>
                <input id="aw-su-business" name="organization" value={signup.business} onChange={setU('business')} required autoComplete="organization" />
              </Field>
              <Field id="aw-su-type" label="Business type">
                <select id="aw-su-type" name="business_type" value={signup.business_type} onChange={setU('business_type')} required autoComplete="off">{choose}{BUSINESS_TYPES.map(o => <option key={o}>{o}</option>)}</select>
              </Field>
              <Field id="aw-su-state" label="Store state" hint={stateHint}>
                <select id="aw-su-state" name="state" value={signup.state} onChange={setU('state')} required autoComplete="address-level1" aria-describedby={stateHint ? 'aw-su-state-hint' : undefined}>{choose}{US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
              </Field>
              <Field id="aw-su-street" label="Store street address" full>
                <input id="aw-su-street" name="address-line1" value={signup.store_street} onChange={setU('store_street')} required maxLength={200} autoComplete="address-line1" />
              </Field>
              <Field id="aw-su-city" label="City">
                <input id="aw-su-city" name="address-level2" value={signup.store_city} onChange={setU('store_city')} required maxLength={100} autoComplete="address-level2" />
              </Field>
              <Field id="aw-su-zip" label="ZIP">
                <input id="aw-su-zip" name="postal-code" value={signup.store_zip} onChange={setU('store_zip')} required maxLength={5} inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" title="Enter a 5-digit ZIP code." />
              </Field>
              <Field id="aw-su-volume" label="Expected monthly volume" full>
                <select id="aw-su-volume" name="expected_volume" value={signup.expected_volume} onChange={setU('expected_volume')} required autoComplete="off">{choose}{VOLUMES.map(v => <option key={v} value={v}>{volumeLabel(v)}</option>)}</select>
              </Field>
            </fieldset>
            <fieldset className="form-grid form-section">
              <legend>Licensing</legend>
              <Field id="aw-su-ein" label="Federal EIN" hint="9 digits, for example 12-3456789." full>
                <input id="aw-su-ein" name="ein" value={signup.ein} onChange={setU('ein')} required inputMode="numeric" pattern="[0-9]{2}-?[0-9]{7}" title="Enter the 9-digit EIN, for example 12-3456789." placeholder="12-3456789" autoComplete="off" aria-describedby="aw-su-ein-hint" />
              </Field>
              {/* TODO(owner): Is a tobacco license required for every trade account, or only for tobacco, vapor, and nicotine? This field stays required for every application until you decide. (AW-129) */}
              <Field id="aw-su-license" label="State retail tobacco license #" hint="From the state where the store is licensed.">
                <input id="aw-su-license" name="license_no" value={signup.license_no} onChange={setU('license_no')} required autoComplete="off" aria-describedby="aw-su-license-hint" data-required-message={LICENSE_REQUIRED} />
              </Field>
              <Field id="aw-su-resale" label="Resale certificate #" hint="Sales tax resale or exemption certificate.">
                <input id="aw-su-resale" name="resale_cert_no" value={signup.resale_cert_no} onChange={setU('resale_cert_no')} required autoComplete="off" aria-describedby="aw-su-resale-hint" data-required-message={RESALE_REQUIRED} />
              </Field>
            </fieldset>
            <DocumentUploads
              disabled={submitting || !isBackendConfigured}
              files={proof}
              errors={proofErrors}
              onPick={onProof}
            />
            {/* Consent and 21+ (AW-019). The policies open in a new tab so the
                answers typed here stay put. */}
            <div className="consent-block">
              <Field id="aw-su-terms" inline label={<>
                  I agree to the <Link to={{ page: 'terms' }} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>Trade terms<span className="sr-only"> (opens in a new tab)</span></Link>
                  {' '}and <Link to={{ page: 'privacy' }} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>Privacy policy<span className="sr-only"> (opens in a new tab)</span></Link>
                </>}>
                <input id="aw-su-terms" name="agreeTerms" type="checkbox" checked={signup.agreeTerms} onChange={e => setSignup({ ...signup, agreeTerms: e.target.checked })} required />
              </Field>
              <Field id="aw-su-age" label="I am 21 or older" inline>
                <input id="aw-su-age" name="ageConfirmed" type="checkbox" checked={signup.ageConfirmed} onChange={e => setSignup({ ...signup, ageConfirmed: e.target.checked })} required />
              </Field>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button ref={submitRef} className="button" type="submit" disabled={submitting || !isBackendConfigured}><span>{submitting ? 'Submitting…' : 'Submit application'}</span></button>
              <button className="text-link" type="button" onClick={() => switchMode('checklist')}>Back to the checklist</button>
              <button className="text-link" type="button" onClick={() => switchMode('signin')}>{SIGN_IN_INSTEAD}</button>
            </div>
          </ValidatedForm>
        )}

        {mode === 'sent' && (
          <>
            <h3 className="checklist-heading">What happens next</h3>
            <ol className="next-steps">
              {/* Done once the applicant's session reaches this tab (NEW-015). */}
              {emailConfirmed ? (
                <li><b>Email confirmed.</b><span>Thanks. Your account is active.</span></li>
              ) : (
                <li><b>Confirm your email.</b><span>Open the link in that email. Not there after a few minutes? Check your spam folder. Already have an account with this email? Sign in below.</span></li>
              )}
              <li><b>We review your application.</b><span>A trade rep checks your EIN, state retail tobacco license and resale certificate.</span></li>
              {/* The application went with a checked number (AW-247), shown as sent. */}
              <li><b>You hear from us.</b><span>{`We’ll email you or call ${usPhone(signup.phone)?.formatted ?? signup.phone} when your account is approved. Wholesale pricing and ordering unlock then.`}</span></li>
            </ol>
            {/* The files aren't sent yet (AW-085). */}
            {proofWaiting && (
              <p className="checklist-note">Your documents aren’t sent yet. Keep this page open: once you confirm your email in this browser, they upload here. Otherwise, add them later from My account, under License documents, or email them to <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>
            )}
            {proofLine}
            {proofProblem}
            {/* No email? Send it again, once a minute (AW-016). Not once the
                email is confirmed (NEW-015). */}
            {!emailConfirmed && (
              <div className="resend">
                <button ref={resendRef} className="text-link" type="button" onClick={() => handleResend(signup.email)} disabled={submitting || cooling || !isBackendConfigured}>
                  <span>{submitting ? 'Sending…' : 'Resend confirmation email'}</span>
                </button>
                <p className="checklist-note" role="status">{resendStatus}</p>
              </div>
            )}
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={requestClose} data-autofocus>Done</button>
              {/* The step's one Sign in (NEW-069); signed in as the applicant
                  already, there is nothing to sign in to. */}
              {!applicantSession && <button className="text-link" type="button" onClick={signInWithApplication}>Sign in</button>}
            </div>
          </>
        )}

        {mode === 'status' && (
          <>
            {error && <p className="form-error" role="alert">{error}</p>}
            {proofLine}
            {proofProblem}
            {status !== 'suspended' && (
              <>
                <h3 className="checklist-heading">While you wait</h3>
                <ul className="checklist">
                  <li><b>Pricing unlocks on approval.</b><span>Wholesale prices and checkout appear as soon as a trade rep approves the account.</span></li>
                  <li><b>Questions?</b><span><CallOrEmail /></span></li>
                </ul>
              </>
            )}
            {/* On hold, calling or emailing the trade desk is the one thing
                to do, so those are the actions (AW-097). */}
            <div className="dialog-actions">
              {status === 'suspended' ? (
                <>
                  <a className="button" href={`tel:${COMPANY.phoneRaw}`} data-autofocus>{`Call ${COMPANY.phone}`}</a>
                  <a className="button ghost" href={`mailto:${COMPANY.email}`}>Email the trade desk</a>
                </>
              ) : (
                <>
                  {/* My account's documents panel (AW-085). */}
                  <Link className="button" to="/account#documents" onClick={onClose} data-autofocus>View account status</Link>
                  <Link className="text-link" to="/catalog" onClick={onClose}>Browse the catalog</Link>
                </>
              )}
              <button className="text-link" type="button" onClick={requestClose}>Close</button>
            </div>
          </>
        )}

        {mode === 'reset' && (
          <ValidatedForm onSubmit={handleReset}>
            <div className="form-grid">
              <Field id="aw-reset-email" label="Business email" full>
                <input id="aw-reset-email" type="email" name="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoComplete="email" inputMode="email" data-autofocus />
              </Field>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button ref={submitRef} className="button" type="submit" disabled={submitting || !isBackendConfigured}><span>{submitting ? 'Sending…' : 'Send reset link'}</span></button>
              <button className="text-link" type="button" onClick={backToSignin}>Back to sign in</button>
            </div>
          </ValidatedForm>
        )}

        {mode === 'reset-sent' && (
          <>
            {/* No email? Send the link again, once a minute (AW-259). */}
            <div className="resend">
              <button ref={resendRef} className="text-link" type="button" onClick={() => sendResetLink(true)} disabled={submitting || resetCooling || !isBackendConfigured}>
                <span>{submitting ? 'Sending…' : 'Send again'}</span>
              </button>
              <p className="checklist-note" role="status">{resetStatus}</p>
            </div>
            <p className="form-error" role="alert">{error}</p>
            <div className="dialog-actions">
              <button className="button" type="button" onClick={requestClose} data-autofocus>Done</button>
              <button className="text-link" type="button" onClick={backToSignin}>Back to sign in</button>
            </div>
          </>
        )}

        {mode === 'signup' && <p className="fine">21+ licensed businesses only. By applying you confirm all store staff handling tobacco products meet federal and state age requirements.</p>}
      </div>
    </div>
  );
  return <ModalLayer onClose={requestClose}>{dialog}</ModalLayer>;
}
