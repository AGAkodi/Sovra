# Review: first cut (2026-11-09)

Checked with `hyperframes check` (passes) and snapshots at 2, 13, 18.8, 26.5, 36, 42.2, 47.5, 61.5, 73, 86 and 87.75 s.

**Works**
- Frame 0 shows the first case file, which matters because it's the thumbnail.
- Every incident carries its date and source credit.
- The replays carry the "Replayed on NEAR testnet" label.
- Every transaction hash and figure is real: tx hashes match `docs/SECURITY_TESTS.md`, and the receipt values were read from NEAR RPC.
- The end card holds for 3 s.

**Open**
- **No sound.** `film_silent` warns. Music needs a free HyperFrames/HeyGen sign-in; sound effects come after.
- **Two placeholders** wait for the owner's own screen recordings: Freeze in Meteor (replays, 22–28 s local) and Approve in Meteor (normal day, 10.8–14 s local).
- **The NearBlocks page couldn't be captured** (Cloudflare bot check), so the receipts are rebuilt from RPC data. A real NearBlocks screenshot can replace them.
- **`text_below_floor`** fires for about 0.5 s while the incident cards shrink into the key. That's deliberate.
