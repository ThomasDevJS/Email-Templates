# Review: slice 8b (editor in direction A, recipients, leave guard, "Reads as")

Verdict: FAIL (head 671c7a7, base 7ce6810). Draft; details follow.

Blocker 1: image insert lands at the start of the document when the dialog is confirmed with Enter (editor.ts:600, async width read).
Blocker 2: a second exit while the leave question is open opens a second "Leave without saving?" dialog (app.ts:290-302, editor.ts:957).
