// @vitest-environment node
// Reading Netlify forms from HTML, and the local stand-in for Netlify's form
// endpoint that `vite` and `vite preview` use (AW-024).
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { formsStandIn, netlifyForms, netlifyHoneypot } from './netlify-forms.mjs';

const HTML = `
  <form name="order-notification" data-netlify="true" netlify-honeypot="bot-field" hidden>
    <input type="hidden" name="form-name" value="order-notification" />
    <input name="bot-field" /><textarea name="items"></textarea><select name="pick"></select>
  </form>
  <form name="plain"><input name="q" /></form>
  <form netlify name="old-style"><input name="email" /></form>`;

describe('netlifyForms', () => {
  it('lists each Netlify form and its fields, and skips other forms', () => {
    expect(netlifyForms(HTML)).toEqual({
      'order-notification': ['form-name', 'bot-field', 'items', 'pick'],
      'old-style': ['email'],
    });
    expect(netlifyForms('<p>no forms</p>')).toEqual({});
  });

  it('reads the honeypot field', () => {
    expect(netlifyHoneypot(HTML, 'order-notification')).toBe('bot-field');
    expect(netlifyHoneypot(HTML, 'old-style')).toBeNull();
    expect(netlifyHoneypot(HTML, 'missing')).toBeNull();
  });
});

// A fake Connect request with a body, and a response that records its end.
function post(body, { method = 'POST', type = 'application/x-www-form-urlencoded' } = {}) {
  const req = Object.assign(new EventEmitter(), { method, headers: { 'content-type': type } });
  const res = { statusCode: 0, headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end: vi.fn() };
  const next = vi.fn();
  const done = new Promise((resolve) => { res.end.mockImplementation((text) => resolve(text)); });
  return { req, res, next, done, send: () => { req.emit('data', Buffer.from(body)); req.emit('end'); } };
}

describe('formsStandIn', () => {
  const handler = formsStandIn(() => ['order-notification']);

  it('answers a post for a declared form with 200, and keeps nothing', async () => {
    const call = post('form-name=order-notification&bot-field=&reference=ALW-O-1');
    handler(call.req, call.res, call.next);
    call.send();
    expect(await call.done).toMatch(/nothing is kept or emailed/);
    expect(call.res.statusCode).toBe(200);
    expect(call.res.headers['cache-control']).toBe('no-store');
    expect(call.next).not.toHaveBeenCalled();
  });

  it('answers a post for any other form with 404, as Netlify does', async () => {
    const call = post('form-name=quote&business=x');
    handler(call.req, call.res, call.next);
    call.send();
    await call.done;
    expect(call.res.statusCode).toBe(404);
  });

  it('leaves every other request to the next handler', () => {
    for (const options of [{ method: 'GET' }, { type: 'application/json' }]) {
      const call = post('form-name=order-notification', options);
      handler(call.req, call.res, call.next);
      expect(call.next).toHaveBeenCalledTimes(1);
      expect(call.res.end).not.toHaveBeenCalled();
    }
  });
});
