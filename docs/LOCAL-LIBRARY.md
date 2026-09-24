# Local customer, product and invoice library

The FI, DE and ES invoice editors share one device-local IndexedDB library. Each country has its own working draft. Customer records can be used across the editors; products, named business profiles and saved invoice copies retain their country context. The interface is available in Finnish, English, German and Spanish.

Customers include contact and billing details and payment terms. Products/services include a product name, optional description, unit, price, VAT default and whether that price includes VAT. Business profiles include sender details, IBAN and payment/VAT defaults. Catalog selections fill the editable invoice. Product names and descriptions are combined in the invoice line; older products without a separate name remain usable. Saved invoices contain independent copies of the details and line items. Opening one makes a working copy; duplicating one generates a new number and dates. Neither operation changes the stored snapshot. Different VAT-inclusive price modes require an explicit user correction before inserting a product.

The library is a native collapsible panel, closed by default. Storage and backup status remain visible outside it. Save invoice is in the final action row beside print and new invoice, with local success/error feedback.

## Persistence

`js/library-store.js` owns the versioned schema, IndexedDB transactions, import validation, merge and backup encryption. `js/library.js` owns the catalog interface and device backup lifecycle. `js/library-i18n.js` contains the four-language interface copy. `js/invoice.js` connects the editor to the library.

The database is `laskupaja-library`, with `data` and `settings` stores. A transaction reads and checks the expected library ID/revision before writing. A stale tab receives a conflict and cannot overwrite a newer state. BroadcastChannel also makes the conflict visible. Records have UUIDs and modification timestamps. A restore merge keeps differing records with new IDs, retaining both versions for review; imported drafts become saved invoice copies. Replace and merge commit atomically. Importing settings or backup permissions is not supported.

Legacy localStorage draft/profile/number data is removed only after migration commits. Malformed legacy records remain untouched and an error is shown. Because old drafts have no country identity, their values are retained in the first invoice editor opened; review that draft's country and defaults. Stored line-item VAT values are preserved even when no longer in the current default dropdown. Existing remembering opt-out and language preferences remain supported.

“Clear saved data” removes the library, working drafts, visible form and backup connection. Disabling remembering removes saved records and the backup connection but keeps the current invoice on screen for temporary use. Existing backup files remain on the user's device. A later explicit re-enable saves the visible form again.

## Backup and recovery

Backups use Web Crypto PBKDF2-SHA256 (600,000 iterations, random 16-byte salt) and AES-256-GCM (random 12-byte IV). Passwords require at least 12 characters and are kept only in the current page's memory. They are not stored in IndexedDB or included in the file. Losing the password makes an encrypted backup unrecoverable. Browser-local records themselves are not encrypted at rest by this application.

The portable encrypted format contains a validated archive of up to five complete library snapshots. Input file size is capped at 25 MiB; schema version, collection size, text bounds, record IDs and data shapes are checked before changes are committed. Downloads contain the current snapshot and have distinct timestamped filenames. Keep multiple downloads to retain earlier versions.

Where the file picker API is supported, users can select an external file and authorize updates. Each successful update retains up to four previous snapshots, writes and closes the file, then reads back the committed bytes before reporting success. Automatic writes occur after changes while the page is open and unlocked. Reloading requires selecting the backup file and entering the password again. File permissions may also need renewal. No background backup is promised while the page is closed.

The connection persists the last confirmed content hash, library ID, backed-up revision and successful-write time. Native file handles are held only during the open session; saved status never claims to restore file permissions. Before a write, the app checks permission and the actual file hash. Changes made by another device/app or an unexpected library are not silently overwritten. A new/empty library cannot overwrite an existing backup. The browser's Web Locks API serializes same-origin backup writers; exclusive file streams and a second hash check narrow local races. No file API can provide atomic coordination with an arbitrary external cloud-sync client, so this is not cross-device sync.

The file picker is capability-detected. Unsupported browsers receive explicit manual-download guidance. Browser-managed OPFS is never offered as a backup destination; tests use it only as a controlled file-stream fixture. A backup on the same device does not protect against losing that device. Store an independent copy elsewhere. A prepared download is not represented as a verified external backup.

Restore decrypts and validates first, then previews versions, record counts and conflicts. Users explicitly choose replacement or merge. Existing records remain intact if decryption, validation or the transaction fails. Restores detach the current backup connection so users must check the intended destination again.

## Privacy and limits

All three invoice editors load first-party scripts only. Their CSP blocks outgoing connections and form submissions. User record contents do not enter URLs, analytics or logs. Public pages retain their existing analytics. All pages share the same origin, so origin isolation is not a security boundary between the public pages and the editor; a compromised same-origin page could access IndexedDB. The library is not a password-protected local vault and cannot protect an unlocked browser profile from another person or malicious extensions.

There is no account, remote database or cloud synchronization. Signing into Chrome on another device does not restore the library. A random library ID is not a hardware identifier. Future paid sync needs a separate recovery, conflict and security design. No paid service or dependency was introduced.

## Verification

From the site checkout:

```sh
node tests/reference.test.js
node tests/increment.test.js
python3 tests/integrity.py
python3 scripts/eu_vat.py --check
node --test tests/library-core.test.cjs
NODE_PATH=/home/rauno/laskupaja-ops/tools/browser/node_modules node tests/library.browser.cjs
NODE_PATH=/home/rauno/laskupaja-ops/tools/browser/node_modules node tests/library-backup.browser.cjs
NODE_PATH=/home/rauno/laskupaja-ops/tools/browser/node_modules node tests/library-recovery.browser.cjs
```

Browser tests run isolated localhost servers, temporary Chromium profiles and synthetic records. Device-file tests use real browser file streams, with the picker and permissions controlled by the test. Tests cover encryption/tampering, migration, duplication, snapshots, import merge, fresh-context restore, stale tabs, unavailable storage, opt-out, local save failures, historical rates, backup rotation, reconnect and failed/interrupted writes. The fallback is simulated in Chromium; Safari/Firefox and native operating-system picker interactions require separate manual validation.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
