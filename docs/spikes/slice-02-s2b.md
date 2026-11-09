# Spike S2b: Drive read and write timing (owner instruction sheet)

Purpose: measure the Drive costs that ADR-0002 assumed, so Q17 keeps or reopens Drive-only storage. Time: about 10 minutes. Run after spike S2 (docs/spikes/slice-02-s2.md) on the dev deployment.

What `spike.s2b` does (admin only, web app only): builds an index-shaped JSON file of the ADR-0002 size (`1x` about 0.87 MB, `10x` about 8.6 MB), creates it in "Migway Templates Data", reads it back, rewrites it, moves it to the Drive trash, and returns the 3 timings in milliseconds. It touches no live data file.

Thresholds (ADR-0002 Q17): read of the 0.85 MB file under 2,000 ms and write under 2,000 ms. The response marks them as `readPass` and `writePass`.

## Steps

1. Open the dev web app URL, DevTools Console, context `userCodeAppPanel`, paste the `call` helper from the S2 sheet.
2. Run `call("spike.s2b", {})` 5 times, waiting for each answer. Expected shape:
   `{"ok":true,"data":{"size":"1x","bytes":870...,"roundTripOk":true,"createMs":...,"readMs":...,"writeMs":...,"thresholdMs":2000,"readPass":true,"writePass":true}}`
3. Run `call("spike.s2b", { size: "10x" })` 3 times. The 10x figures feed the ADR-0002 Revisit rule (split the index above 3 MB); they have no pass threshold. Drive documents a 5 MB limit for multipart uploads, so this call may fail; record the exact error text in the table instead of timings.
4. Run `call("profile.me", {})` once. Record which of `name`, `title`, `department`, `phone` are filled (Q9: `domain_public` fields).
5. Drive, Trash: the `spike-s2b.json` files are there; nothing else in "Migway Templates Data" changed.

`roundTripOk: false` means the file read back differs from what was written. Stop and report it.

## Results (fill in)

Date:              Tester:

| Run | Size | createMs | readMs | writeMs | readPass | writePass |
| --- | ---- | -------- | ------ | ------- | -------- | --------- |
| 1   | 1x   |          |        |         |          |           |
| 2   | 1x   |          |        |         |          |           |
| 3   | 1x   |          |        |         |          |           |
| 4   | 1x   |          |        |         |          |           |
| 5   | 1x   |          |        |         |          |           |
| 6   | 10x  |          |        |         |          |           |
| 7   | 10x  |          |        |         |          |           |
| 8   | 10x  |          |        |         |          |           |

p95 of the 5 `1x` runs = the highest value. Keep Drive-only storage if the highest `readMs` and the highest `writeMs` are both under 2,000. Otherwise ADR-0002 reopens with option 1 (Sheets) and its consent cost.

`profile.me` fields filled: name ( ) title ( ) department ( ) phone ( ). A missing title or phone triggers Q9 (`searchDirectoryPeople`).

## Results 2026-11-09 (owner, dev deployment, Advanced Drive service, `drive.file` scope)

| Measure | Run 1 | Run 2 | Threshold |
|---|---|---|---|
| Size written | 821,410 bytes (1x) | 821,410 bytes | |
| create | 1,221 ms | 1,130 ms | |
| read (`alt: media`) | 549 ms | 809 ms | 2,000 ms, pass |
| update (whole file) | 1,148 ms | 1,132 ms | 2,000 ms, pass |
| Read length | | 821,410 | equals written |

Findings:
- Q16: the Advanced Drive service works on `drive.file` alone for create, update, get media and trash.
- Q17: thresholds met with margin. Drive-only storage (ADR-0002 option 2) stands.
- `alt: 'media'` on a JSON file returns the content parsed into an object with keys reordered (`items` first). `mediaToText` re-serializes it. Byte-exact round trips are impossible through this path; JSON-equal round trips are what the store needs. The REST client (`DRIVE_CLIENT=rest`) returns exact text if ever required.
- Save budget estimate in ADR-0002 (index write about 1 s) matches the measured 1.1 s.
