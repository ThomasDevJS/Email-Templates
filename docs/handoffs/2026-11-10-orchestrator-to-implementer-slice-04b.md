# Handoff: orchestrator to implementer, slice 4b (smoke defects)

Source: owner smoke run through the Claude Chrome extension on dev build 9bbd262, 2026-11-10. Smoke "Slice 3" and "Slice 4" in docs/ops/smoke.md. Folder "My templates" stood in for "Smoke 3". Times below are from the Apps Script execution log unless marked "observed".

## Already fixed (9bbd262, do not redo)
- HtmlService rewrote the inline bundle and cut `//` to the end of the line. `inlineHtml` in scripts/lib/html.mjs now ships the bundle as one string literal run through an indirect eval. Served script equals the local build.

## Defects to fix

1. Conflict dialog, "Open their version" (smoke Slice 3 step 6). Tab B saved version 4. Tab A (on version 3) saved, got the dialog, chose "Open their version". Status read "Loaded the latest version. Your changes were discarded." The header still read "Version 3" and tab B's word was missing. Expected: body and header of version 4. `src/web/views/editor.ts:285`. Check the client state, `template.get` and the body and index caches on the server.
2. Same dialog: after Esc the focus stayed on the body. Expected: focus on Save.
3. History restore (step 7): the confirm dialog stayed open about 3 s after confirm (observed). Close it or show a busy state at once.
4. `version.restore` logs `"targetId":""`. Log the template ID.
5. `web.open` logs `"requestId":""`. Add-on request IDs are UUIDs (`Utilities.getUuid()` in `src/addon/client/serverClient.ts:130`); web app IDs use `XXXXXXXX-XXXXXX`. Use one format on both surfaces, the web format.
6. Library row actions are missing. Wireframe 03 lists Edit, Duplicate, Move, History, Delete (menu, keyboard Enter and Shift+F10). `src/web` calls none of `template.delete`, `template.move`, `template.duplicate`. `template.duplicate` is still a `LATER_SLICE_OPS` stub. Build the row menu and the 3 actions, the duplicate handler with policy row and role-matrix tests, and a confirm for Delete (soft delete; Trash view and restore stay in slice 5 or 6 if not built). Smoke Slice 4 step 7 needs Delete.
7. Tree keyboard (step 2): arrow keys and Enter did not select a folder in the real page (observed through the extension, unverified by hand). Check focus handling in the HtmlService iframe case: the tree must take focus by Tab and by click, and `aria-activedescendant` or roving tabindex must work without a prior click.

## Performance (targets: BRIEF section 9)

| Point | Add-on function | Add-on duration | doPost duration | Handler durationMs |
|---|---|---|---|---|
| First sidebar open | onComposeOpen | 4.064 s | 1.381 s | 250 (`sidebar.home`) |
| Open folder | onOpenFolder | 3.005 s | 1.437 s | 346 (`sidebar.home`) |
| Insert, no prompt, first use | onInsert | 4.07 s | 2.419 s | 1314 (`template.apply`) |
| Prompt card Insert | onPromptInsert | 2.083 s | 0.671 s | 78 (`template.apply`) |
| Prompt card Insert | onPromptInsert | 2.317 s | 0.902 s | 89 (`template.apply`) |
| Spike F9 | onSpikeInsert | 1.692 s callback | n/a | 55 |

- Targets: apply under 2 s p95, sidebar load under 3 s. Both missed. Sidebar first open was about 6 s on screen.
- doPost spends 0.6 to 1.1 s outside the handler. The add-on spends 1.4 to 2.7 s outside the server call.
- Observed in the web app: each save about 10 s, library first load 4 to 10 s (extension estimates, not log values).
- Add-on executions show "No logs are available" in the execution log; only doPost lines appear.

Wanted, with Pattern A unchanged (ADR-0003):
a. Instrument. The rpc log line gains the time from execution start to handler start and the total. The add-on sends its own phase times (token, fetch, total of the previous call or of this call before the fetch) so the server line carries them. Write paths log phase times (lock wait, Drive reads, Drive writes, cache).
b. Count Properties, Cache, Drive, Lock, Directory and UrlFetch calls per request on `sidebar.home`, `template.apply`, `template.list`, `folder.list`, `template.update`. Put the before and after table in your handoff.
c. Cut waste on those paths: one `getProperties()` per execution; no script lock on reads; no `maintain` work on read requests; no Drive call on a cache hit; sender profile and body cached; why `onOpenFolder` calls `sidebar.home` again when the view cache is warm; why the first `template.apply` took 1314 ms.
d. No new scopes, no new services, no architecture change. List anything larger as a proposal.

## Not defects
- Sidebar home showed the empty state on the first run because no template existed.
- Folder card lacked a template created 1 minute earlier until "Open library" cleared the view cache (10 min TTL, by design). Proposal welcome, no build.
- `applyCount` rises when the prompt card opens (review decision c).

## Owner checks still open (not yours)
F9 mid-line by hand, "Edit in library" overlay, paste of a `javascript:` link, second account steps, Android and iOS.
