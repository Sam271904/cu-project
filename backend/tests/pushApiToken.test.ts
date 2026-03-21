import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { extractPushApiToken, isPushApiAuthorized } from '../src/auth/pushApiToken';

function reqWithHeaders(h: http.IncomingHttpHeaders): http.IncomingMessage {
  return { headers: h } as http.IncomingMessage;
}

describe('pushApiToken helpers', () => {
  it('extractPushApiToken reads Bearer and X-PIH-Token', () => {
    expect(extractPushApiToken(reqWithHeaders({ authorization: 'Bearer abc' }))).toBe('abc');
    expect(extractPushApiToken(reqWithHeaders({ authorization: 'bearer xyz' }))).toBe('xyz');
    expect(extractPushApiToken(reqWithHeaders({ 'x-pih-token': 'secret' }))).toBe('secret');
  });

  it('isPushApiAuthorized allows all when expected token unset', () => {
    expect(isPushApiAuthorized(reqWithHeaders({}), null)).toBe(true);
    expect(isPushApiAuthorized(reqWithHeaders({}), '')).toBe(true);
  });

  it('isPushApiAuthorized requires match when expected set', () => {
    expect(isPushApiAuthorized(reqWithHeaders({}), 'tok')).toBe(false);
    expect(isPushApiAuthorized(reqWithHeaders({ authorization: 'Bearer tok' }), 'tok')).toBe(true);
    expect(isPushApiAuthorized(reqWithHeaders({ authorization: 'Bearer nope' }), 'tok')).toBe(false);
  });
});
