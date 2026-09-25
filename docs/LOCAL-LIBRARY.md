# Local customer, product and invoice library

The FI, DE and ES invoice editors share one device-local IndexedDB library. Each country has its own working draft. Customer records can be used across the editors; products, named business profiles and saved invoice copies retain their country context. The interface is available in Finnish, English, German and Spanish.

Customers include contact and billing details and payment terms. Products/services include a product name, optional description, unit, price, VAT default and whether that price includes VAT. Business profiles include sender details, IBAN and payment/VAT defaults. Catalog selections fill the editable invoice, using either the library list or the selectors beside business/customer fields and invoice rows. Addresses retain line breaks. Library payment terms are limited to whole days from 0 to 365; VAT entry accepts decimal commas and normalizes the value before checking the country rates. Product names and descriptions are combined in the invoice line; older products without a separate name remain usable. Saved invoices contain independent copies of the details and line items. Opening one makes a working copy linked to that invoice. Saving updates the same record and retains the previous data in its version history; saving unchanged data adds no version. Duplicating starts an unlinked draft with a new number and dates, and its first save creates a new unpaid invoice. Opening or duplicating alone does not change saved invoice data. An invoice number already used by another record on the same country page is rejected on save. Different VAT-inclusive price modes require an explicit user correction before inserting a product.

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

## Invoice identity and history

Saved invoices keep their UUID when updated. The working draft stores an optional `invoiceId`; it survives reload and backup replacement. Starting a new invoice, duplicating, deleting the linked record or clearing local data removes that link. Saving commits the invoice data and its working draft together. A failed save cannot advance the active identity or discard an older version. Invoice saves capture their target ID before asynchronous work and lock the form/library until completion; queued draft writes likewise capture their identity. Explicit invoice saves enforce the form constraints and focus invalid fields; incomplete working drafts can still autosave. Previous versions can be opened as a draft and explicitly saved back to the same invoice. Existing backup records without history/status remain supported; no old invoice copies are silently consolidated.

Invoice records optionally include `history` (prior data and timestamp) and `status` (`paid` or `unpaid`, defaulting to unpaid for old records). Status is manual; dates never imply payment. Editing invoice data keeps its status; a new duplicate starts unpaid. History is included in encrypted backups and retained on merge conflicts. There is no automatic history pruning; existing overall record/archive size limits still apply. Deleting an invoice deletes its versions too, with an explicit confirmation.

Library rows show invoice totals using the same cent-rounding calculation as the invoice, due dates and payment status. Sorting offers newest/oldest and, for invoices, earliest due date or highest total. Date searches accept displayed local dates as well as ISO dates. Empty categories and searches display an explanation.

## Save feedback, record selection and keyboard use

Draft autosave and explicit invoice saves use distinct messages. Editing fields, selecting saved data or changing line items clears the prior invoice confirmation and indicates that an existing invoice needs updating. Customer/business selections are retained in the working draft. Their inline Save buttons become Update buttons after selection or initial save; the update dialog includes an explicit “Save as new” checkbox. Changes made in that dialog also populate the current invoice form. Same-name picker entries include business ID/address and, when still identical, a short record identifier. Existing duplicates are not merged automatically.

Starting a new invoice retains the selected business but clears the customer. Opening another saved invoice clears these selections; restoring/reloading a working draft restores valid selection IDs. Payment-status actions retain focus on the corresponding action. Deletion focuses the next available record, or the category selector when no records remain, and announces the result locally.

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
NODE_PATH=/home/rauno/laskupaja-ops/tools/browser/node_modules node tests/library-features.browser.cjs
NODE_PATH=/home/rauno/laskupaja-ops/tools/browser/node_modules node tests/library-regressions.browser.cjs
```

Browser tests run isolated localhost servers, temporary Chromium profiles and synthetic records. Device-file tests use real browser file streams, with the picker and permissions controlled by the test. Tests cover encryption/tampering, migration, duplication, snapshots, import merge, fresh-context restore, stale tabs, unavailable storage, opt-out, local save failures, historical rates, backup rotation, reconnect and failed/interrupted writes. The fallback is simulated in Chromium; Safari/Firefox and native operating-system picker interactions require separate manual validation.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
