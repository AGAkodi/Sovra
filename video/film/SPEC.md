# SPEC: Sovra, "It already happened"

GOAL:    The viewer learns that AI agents have already lost real money because they could move it themselves, watches Sovra pay, hold and refuse live on NEAR testnet, remembers "a budget, not a blank cheque", and opens sovra-near.vercel.app.

OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.

TIME:    88 s x 30 = 2640 frames. Music unknown until chosen; plan on a 90 BPM grid (20 frames a beat, 80 a bar). Payoff lands at 67 s, mark at 83 s.

LOOK:
- **Ground:** graphite #141415 (the product's own page colour), no grain. The deep ground is #0f0f10, only for the incident world.
- **Ink:** #ededed primary, #a1a1a6 secondary, #85858b meta. Hairlines are #ededed at 8%.
- **Accent:** brass #c9a86a. Only on:
  - one highlighted word per title;
  - the allowance dial;
  - the slip's countdown ring;
  - the end-card notch.
- **Semantic colours:** red #e5484d only on refusals and losses; green #4cc38a only on "Paid".
- **Display:** Instrument Serif 400, 96 px (8.9% of the height), tracking -2%. Big figures are 160 px.
- **Body:** Geist 400/500, 32 px, tracking 0. Figures, dates and hashes are Geist Mono 400, 28 px.
- **Medium:**
  - Incident world: case files. Cards #19191b with a 1 px hairline, radius 16, the date in Geist Mono brass, the sourcing in Geist 22 px #85858b. The source line is the only small text, and it is a credit, not a reading line.
  - Product world: the real Sovra UI at 1.6–2x, captured at 2x device pixels.
- **Light and depth:** no glow, no bloom. The only shadow is 0 24px 48px rgba(0,0,0,0.35) under the slip and the dial card. Vignette 0%.

OBJECTS:
- **Chat bubble** (Freysa): a message typed into an agent chat, ending "…approveTransfer". Its counter "≈ $47,000" drains to "$0" in red mono.
- **Breached dashboard** (AIXBT): an admin panel with two prompt lines "send 55.5 ETH to …"; the ETH figure slides out of frame.
- **Memory card** (Princeton): a stored-memory card. The line "pay: 0x8f2…a91c" overwrites itself to "pay: 0x4e7…d03b" with a red underline.
- **Wallet key:** a line-drawn key, 2 px brass stroke, 320 px wide. The three incident cards fall into its bow.
- **Allowance dial:** the product's own 240° gauge, with ticks, needle and brass arc.
- **Slip:** the product's approval slip, captured live: the payee, 2.5 in serif, the brass countdown ring.
- **Proof rows:** the landing page's attack table, captured live; the red "Refused" dots and hashes stay real.
- **NEAR receipt:** the real NearBlocks page of tx GC1BPjH5…, captured.
- **Meteor approval and freeze:** the owner's own recordings. Until they arrive, these are labelled placeholders ("Your recording: Approve in Meteor") at the right size.

MOTION:
- **Eases:** enter expo.out 18 frames; move power2.inOut 15 frames; exit power3.in 9 frames; camera push power2.inOut 24 frames.
- **Titles:** per-word blur 6 px→0 and opacity 0→1, 4 frames each, 2 frames apart, no translate. They hold dead still, then blur out in 6 frames.
- **Punch-ins:** a wrapper's scale goes 1→1.8 over 18 frames with x/y on the same ease; the UI then holds still while it acts.
- **Transitions:** 4 kinds, each with a cause:
  - object becomes the world (the key bow grows into the Sovra mark);
  - carry across (an incident's key word carried into the product screen that answers it);
  - blur swap on one stage (inside the product world);
  - iris from the click (the Run button opens the result).
- **Hard cuts:** only inside a scene (punch-ins), never between worlds.

SHOTS:
| Frames | Shot | Hero move | Reads (window) | Sound | Handoff |
|---|---|---|---|---|---|
| 0–120 | 1 Freysa | the chat message types in, the counter drains 47,000→0 | "Nov 2024" · "An AI agent was talked into paying out" (2.2 s) · credit | low pulse, keys | the card slides up and back |
| 120–240 | 2 AIXBT | two prompt lines appear, "55.5 ETH" flies out right | "Mar 2025" · "Its controls were breached" (1.6 s) | two clicks | the card stacks behind the first |
| 240–360 | 3 Princeton | the memory address overwrites itself | "2025" · "A fake memory paid the attacker" (2 s) | glitch tick | the card stacks on top |
| 360–480 | 4 Thread | the 3 cards fall into the key's bow; the key turns 15° | "Each agent could move the money itself" (2.4 s) | the pulse drops out | the bow grows |
| 480–630 | 5 Reveal | the bow becomes the brass notch; the Sovra wordmark | "So I built Sovra" (1.4 s) → "Let your agent pay. Keep the final say" (2.6 s) | dial tick, chord | the notch carries into the UI |
| 630–930 | 6 Replay: talked into it | Home → Hidden instructions → Run; the invoice line underlines; the result "Stopped by the vault" | label "Replayed on NEAR testnet" · "Talked into paying? The vault says no" | thud | "Refused" carried to the receipt |
| 930–1230 | 7 Replay: fake memory | proof row "recipient swapped" → "Signature check failed" → NearBlocks receipt slides up | "Recipient swapped? The signature fails" | thud | the receipt shrinks into Settings |
| 1230–1530 | 8 Replay: controls breached | Settings "Agent key: can only call request_payment" → freeze recording → "Couldn't pay, vault was frozen" | "Controls breached? One signature freezes it" | latch | the unfreeze button press |
| 1530–2010 | 9 Normal day | Routine → Paid, the dial needle swings; Unusual → slip, ring counts → Meteor recording → Done | "Routine pays itself" · "Unusual waits for you" | tick, held note, approval click | the slip collapses into a proof row |
| 2010–2310 | 10 Payoff | 9 proof rows tick in red, one per beat; the counter lands on "0 NEAR moved" | "9 attacks. 0 NEAR moved" (2.2 s) | 9 ticks, riser into impact | pull back to the dial |
| 2310–2490 | 11 Claim | the dial alone, the needle settles | "A budget, not a blank cheque" (2.4 s) | resolve | the needle becomes the notch |
| 2490–2640 | 12 End card | the notch fills tick by tick, the wordmark wipes in | "Sovra" · sovra-near.vercel.app · "Live on NEAR testnet" (held 3 s) | final tick | — |

BANNED:
- the defaults list;
- the product UI tilted in 3D;
- a title over a dimmed screenshot;
- news-site logos or screenshots of articles (sources are credited as text);
- any number not in SCRIPT-D.md's sources or the product;
- implying Sovra would have saved the specific funds in those incidents;
- a voice;
- the brass accent on more than one word per title.

QA:
- f60: the counter is mid-drain and the source credit is legible.
- f420: the three cards in the key, the title fully landed.
- f560: the mark and the wordmark, centred, not docked.
- f800: the "Replayed on NEAR testnet" label is visible with the real UI.
- f1100: the real NearBlocks receipt, sharp at 1.6x.
- f1400: the freeze placeholder is clearly labelled.
- f1800: the slip ring is visible.
- f2200: 9 rows and "0 NEAR moved".
- f2600: the end card with the URL, held.
