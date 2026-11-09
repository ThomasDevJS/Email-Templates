# Spike S4: draft insert on Gmail web, Android and iOS (owner instruction sheet)

Purpose: find which HTML survives `UpdateDraftBodyAction` with `IN_PLACE_INSERT` and `MUTABLE_HTML`, and the largest body that inserts, so ADR-0004 gets its final allowlist and size cap (largest size that inserts on all 3 clients, divided by 2). Time: about 20 minutes per client. Run on the dev deployment after slice 4 is deployed.

The harness is TEMPORARY: the "Spike S4 (temporary, admins)" section of the sidebar home, the add-on callbacks `onSpikeCard` and `onSpikeInsert`, and the admin-only server op `spike.s4`. Slice 4's handoff lists the files. Nothing in the sanitizer allowlist or the 100 KB cap changes until these results are in.

What one fixture insert does: the add-on calls `spike.s4` (admin only on the server) with the fixture ID, gets the static fixture HTML, and inserts it at the cursor. The inserted body ends with one extra line:
`[S4 F6: 51276 bytes, add-on callback 812 ms, server 300 ms]`
- `add-on callback`: from the start of the click callback to the response being built, in Apps Script time. It includes the server round trip.
- `server`: time inside the server op.
- Gmail's own time to apply the response is not visible to the add-on. Measure click to body change with a phone stopwatch as well.

Fixtures (ADR-0004 "Slice 4 spike plan"):

| ID | Content | Check |
| -- | ------- | ----- |
| F1 | 3 paragraphs, bold, italic, underline, link to google.com | inserts at the cursor, editable, link opens |
| F2 | colors (`color`, `background-color`, `rgb()`), font sizes (10px, 16px, 24px, `large`), 4 font families, `<font>` tag, bold/italic/strike by style, `line-height`, centered paragraph, margin, padding, border | each property kept: yes or no |
| F3 | bullet list with a nested item, ordered list, ordered list `start=5 type=a`, blockquote | structure kept |
| F4 | 3x3 table, `border=1`, cell padding, `border-collapse`, widths | table kept, borders shown |
| F5 | Google logo from gstatic.com with `width=600` | image shows, width 600 kept |
| F6 | 50 KB of formatted paragraphs | inserts; time |
| F7 | 200 KB of formatted paragraphs | inserts or fails; time or error text |
| F8 | all 5 placeholders (fallbacks for missing values) and 2 prompts filled with `Q3 <review> & "plan"` and a two-line value | your name, title, phone, department, the recipient's first name; prompt text shown literally, the second value on 2 lines |
| F9 | one short line | inserts at a mid-line cursor; replaces a selection |

## Steps (Gmail web on Chrome, the acceptance target)

1. `npm run deploy -- dev`. Your account must be in `ADMIN_EMAILS` (setup adds the owner). Reopen the sidebar.
2. Compose a new message. To: one Migway colleague (for F8). Open Migway Templates. The home card ends with "Spike S4 (temporary, admins)". Tap "Insert test fixtures".
3. Click into the body. For F1 to F8, one at a time: put the cursor on an empty line, start the stopwatch, tap the fixture's Insert, stop when the body changes. Record the stopwatch time, the `add-on callback` value from the inserted line, and what survived. Clear the body between fixtures (Ctrl+A, Delete).
4. F9 twice: (a) type `Hello world`, click between `Hello` and `world`, Insert; (b) select `world`, Insert. Record where the text landed and whether the selection was replaced.
5. Send the F2, F3, F4, F5 and F8 drafts to your own address. Open each in Gmail web and record anything that differs from the draft.
6. If F7 fails, repeat with F6 to confirm F6 still works, and note the exact error or behavior.

## Steps (Gmail Android and iOS)

7. Open the Gmail app signed in to the same account. Compose, open the add-on from the compose menu (three dots, Migway Templates). If the add-on does not appear, write "not available" in the table and stop for that client.
8. Repeat steps 3 and 4. Mobile has no Ctrl+A: discard the draft and start a new one between fixtures.
9. Send F2 and F4 to your own address and open them in Gmail web.

## Results (fill in)

Date:              Tester:              Build (sha):

Inserted: y or n. Kept: what survived, or the properties lost. Times in ms.

### Gmail web (Chrome)

| Fixture | Inserted | Kept / lost | Callback ms | Stopwatch ms | Recipient view (sent) |
| ------- | -------- | ----------- | ----------- | ------------ | --------------------- |
| F1 | | | | | |
| F2 | | | | | |
| F3 | | | | | |
| F4 | | | | | |
| F5 | | | | | |
| F6 | | | | | |
| F7 | | | | | |
| F8 | | | | | |
| F9 mid-line | | | | | |
| F9 selection | | | | | |

### Gmail Android

| Fixture | Inserted | Kept / lost | Callback ms | Stopwatch ms | Recipient view (sent) |
| ------- | -------- | ----------- | ----------- | ------------ | --------------------- |
| F1 | | | | | |
| F2 | | | | | |
| F3 | | | | | |
| F4 | | | | | |
| F5 | | | | | |
| F6 | | | | | |
| F7 | | | | | |
| F8 | | | | | |
| F9 mid-line | | | | | |
| F9 selection | | | | | |

### Gmail iOS

| Fixture | Inserted | Kept / lost | Callback ms | Stopwatch ms | Recipient view (sent) |
| ------- | -------- | ----------- | ----------- | ------------ | --------------------- |
| F1 | | | | | |
| F2 | | | | | |
| F3 | | | | | |
| F4 | | | | | |
| F5 | | | | | |
| F6 | | | | | |
| F7 | | | | | |
| F8 | | | | | |
| F9 mid-line | | | | | |
| F9 selection | | | | | |

## What the results decide

- Allowlist: any tag, attribute or style property lost on Gmail web leaves the sanitizer allowlist (ADR-0004). Losses on mobile only are recorded and kept (A7: mobile is best effort).
- Size cap: largest fixture size that inserts on all clients that show the add-on, divided by 2. F6 and F7 bracket it; if F7 inserts everywhere, the cap stays 100 KB.
- Apply budget: the web stopwatch times feed the "apply under 2 s p95" target (spec section 12).
- After the results: the architect updates ADR-0004, and the implementer removes the harness (`spike.s4`, `onSpikeCard`, `onSpikeInsert`, `src/shared/spike/`, the home section).
