# OAuth consent return under strict CSP

Chrome enforces `form-action 'self'` across a form POST's redirect chain. The
previous POST consumed human consent and issued a code, then returned 302 to
ChatGPT. An isolated Chrome reproduction processed the POST but blocked the
cross-origin callback with a CSP violation.

The POST now ends with HTTP 200 and a normal `Volver a ChatGPT` link. Its target
is the already validated, exact registered callback with the original state and
one authorization code. The link expires with that code after 60 seconds. The
response is no-store/no-referrer and has strict CSP without scripts. No origin,
CSRF, session, identity, scope, TTL, PKCE, single-use or revocation checks change.

Run focused tests with the existing dependency package (no installation needed):

```
PIXELTEC_TEST_DEPENDENCY_BASE=/path/to/installed-mcp/package.json \
MCP_SYNTHETIC_HTML_OUTPUT=/tmp/wo626-synthetic-return.html \
node --test scripts/qa/mcp-consent-return.test.mjs
MCP_SYNTHETIC_HTML_OUTPUT=/tmp/wo626-synthetic-return.html \
node scripts/qa/mcp-consent-browser.mjs --legacy
MCP_SYNTHETIC_HTML_OUTPUT=/tmp/wo626-synthetic-return.html \
node scripts/qa/mcp-consent-browser.mjs
```

The browser test uses Chrome on macOS, a temporary private profile and loopback
CDP/HTTP. It maps only the synthetic callback origin to a second loopback origin,
retains the actual response HTML/CSP and simulates clicking the return link. It
never uses a personal browser session or the production endpoint. The issuer
regressions use an in-memory test store, not a real database or OAuth grant.

Deploy requires the normal release and capacity controls. No migration, signing
key rotation or scope change is required. Preserve the active private MCP config.
Rollback is the previous image/SHA 5ad253bd1303e77e92d37a8e6dc1b2d5f08a56ea,
with the same config; its old callback defect remains. Revoke the orphan grant
through the owner's official connections UI before the next observed connection.
Do not resubmit a consumed consent form or revive its expired code.
