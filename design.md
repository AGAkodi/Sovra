# design.md: Sovra frontend source of truth

Every screen, component and string in `frontend/` follows this file. If code and this file disagree, this file wins. Change the file first, then the code.

Method: [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (@heydamir), CC BY 4.0.

**Status: signed off 2026-11-09.** Direction: vault room, brass. Name on screen: **Sovra** (the logo is the wordmark "Sovra" in Geist 500 with a flat brass notch glyph; "Throttle" is retired from the UI). Workflow: code-led, screenshots for review, no Figma.

---

## 1. Direction

| | |
|---|---|
| **Product** | A vault that lets your AI agent pay for things on its own, inside limits you set, and asks you before anything unusual leaves |
| **Character** | Composed, protective, exact |
| **World** | A private bank's vault room after hours: brushed steel, a brass dial, a ledger, one warm lamp |
| **Moments** | (1) Home: the **allowance dial**, a drawn brass gauge of today's spending against the budget, with the spendable balance set large beside it. (2) Approvals: the **held payment** shown as a cheque-like slip waiting for your signature, with a countdown ring |
| **Signature** | The **throttle notch**: a six-step lever showing the agent's authority level (1 = free to pay, 6 = blocked), used wherever a level appears and nowhere else |

**What "premium" means here.** Not glow, glass or gradients. It means:

- restraint: quiet graphite surfaces and one brass accent
- material: a dial and a slip that look made, not drawn
- type with a voice: a serif for the big numbers and titles
- generous, exact spacing
- copy that sounds like a private banker: short, calm, never alarmed, never cute

**Name.** The product is **Sovra**. Docs and the README follow the UI rename in step 1.

**Who it's for.** A person, not an ops team, who lets an AI agent spend money for them. They are not a blockchain expert. Across a whole session they need to answer:

- Is my money safe?
- What did my agent pay for?
- Is anything waiting for me?
- How do I change the limits, or stop everything?

NEAR, signatures and transaction hashes are proof that's available, never the first thing on screen.

---

## 2. Voice and copy

- **Second person, plain words.** "Your agent paid 0.3 NEAR to sovra-worker" not "Transfer confirmed on-chain (Logged & Monitored)".
- **Calm about danger.** "Stopped. Nothing left the vault." Not "ATTACK BLOCKED".
- **Short.** Titles 1–3 words. Buttons are verbs: Approve, Decline, Freeze, Save limits.
- **No** exclamation marks, trailing periods on labels, uppercase labels, hype words, emoji, or "AI-powered".
- **Numbers** always carry their unit and comparison: "2.5 NEAR, 8× this agent's usual", "4.2 of 15 NEAR today".
- **Times** are local and relative ("2 min ago", "Today 08:14"); UTC lives in a tooltip.
- **Proof is a link, not text.** A hash shows as a quiet "View on NEAR ↗", with the short mono hash in the tooltip or drawer.

### Glossary (old → new)

| Old | New |
|---|---|
| Overview | Home |
| Agent Monitor | Agent |
| Payment Requests | Payments |
| Approvals | Approvals (badge = waiting count) |
| Policy Studio | Limits |
| Audit Trail | Activity |
| Settings | Settings |
| Emergency Freeze / Freeze Agent / Release Freeze | Freeze spending / Freeze / Unfreeze |
| Authority level L1…L6 | Level 1…6, with names: Free to pay · Watched · Slowed · Watched closely · Needs you · Blocked |
| Composite risk 34/100 | Risk 34 |
| Trust score | Trust |
| Status: Confirmed onchain | Paid |
| Owner approved · paid | Paid after your approval |
| Needs approval / pending_approval | Waiting for you |
| Rejected onchain | Stopped by the vault |
| Refused by vault | Couldn't pay (with the reason, e.g. "vault was frozen", "not enough funds") |
| Rejected by owner | You declined |
| Blocked by risk engine | Stopped by risk check |
| RPC error · outcome unknown | Network issue, nothing assumed |
| Approval expired | Expired, funds released |
| Agent declined | Agent refused this invoice |
| Policy vN / Draft → vN+1 | Limits version N · Unsaved changes |
| Per-tx cap / Daily budget | Most per payment / Daily limit |
| Whitelist | Approved recipients |
| Max risk for autonomous | Ask me above risk |
| Spendable / held / storage | Available / Waiting / Reserved by NEAR |

The six authority-level names live in one place in code (`levels.ts`) and are reused everywhere.

---

## 3. Information architecture and flows

**Navigation (sidebar, in this order):** Home, Approvals, Payments, Activity, Agent, Limits, then Settings at the bottom. The freeze control sits under the nav, always visible.

Approvals moves to second place because it is the only screen that asks something of you.

**Flows**

1. **Glance** (most visits): Home → see the balance, today against the limit, the agent's level, and anything waiting. Done in 5 seconds.
2. **Decide**: Home banner "1 payment is waiting for you" → Approvals → read the slip → Approve or Decline → sign in the wallet → toast "Paid" → the slip leaves with a short fade.
3. **Understand**: any payment row → drawer: what was paid, why it was allowed or stopped (the risk factors in plain words), what the agent said, and proof.
4. **Adjust**: Limits → edit → see the live preview of what changes → Save limits → sign → "Limits updated, version 3".
5. **Stop**: Freeze spending (sidebar) → confirm sheet ("Your agent won't be able to pay anyone until you unfreeze") → sign → the whole app shows a calm frozen state (a steel-grey banner, not red).
6. **Try it** (demo visitors): Home → "Try a scenario" (routine, spike, injection) → the result card explains what happened.

**Wallet states** change what owner actions show:

| State | What the owner sees |
|---|---|
| Not connected | Actions visible, disabled, with one line: "Connect your wallet to approve" |
| Connected as someone else | Same, but the line says which account owns the vault |
| Owner | Actions enabled |

---

## 4. Tokens

### Color, dark (default)

Graphite ramp. Surfaces never read as blue, brown or green.

| Token | Value | Use |
|---|---|---|
| `bg-deep` | `#0f0f10` | Sidebar |
| `bg` | `#141415` | Page |
| `surface` | `#19191b` | Cards |
| `raised` | `#232325` | Inputs, active row, hover |
| `line` | `#ededed` at 8% | Hairlines |
| `text` | `#ededed` | Primary |
| `text-2` | `#a1a1a6` | Secondary |
| `text-3` | `#85858b` | Muted, meta, icons |
| `brass` | `#c9a86a` | The accent: primary action, selection, the one figure that matters, "Needs you" |
| `brass-ink` | `#141415` | Text on brass |
| `positive` | `#4cc38a` | Paid, healthy |
| `negative` | `#e5484d` | Stopped, blocked, errors |
| `frozen` | `#8b95a1` | Frozen state (steel, deliberately not red) |

### Color, light (phase 2)

| Token | Value |
|---|---|
| `bg` | `#fafafa` |
| `surface` | `#ffffff` |
| `raised` | `#f4f4f5` |
| `text` / `text-2` / `text-3` | `#171717` / `#525252` / `#737373` |
| `brass` (fill) | `#b8944f`, dark text on it |
| `brass` (ink) | `#8a6a2f`, for text and lines on white |
| `positive` / `negative` | `#16a34a` / `#dc2626` |

### Levels

Shown with the throttle notch plus a word, never as colored pills.

| Level | Name | Ink |
|---|---|---|
| 1 | Free to pay | `positive` |
| 2 | Watched | `positive` |
| 3 | Slowed | `text-2` |
| 4 | Watched closely | `text-2` |
| 5 | Needs you | `brass` |
| 6 | Blocked | `negative` |

### Type

| Role | Family | Size / line | Weight |
|---|---|---|---|
| Interface | Geist | — | 400, 500 (600 rare) |
| Figures, IDs, hashes | Geist Mono | — | tabular figures everywhere |
| Display (page titles, the balance, slip amount) | Instrument Serif | — | 400 only, never for labels or buttons |
| Meta, counts | Geist Mono | 12 / 16 | 400 |
| Caption, secondary | Geist | 13 / 20 | 400 |
| Body, nav | Geist | 14 / 20 | 400–500 |
| Section title | Geist | 16 / 24 | 500 |
| Card figure | Geist Mono | 28 / 32 | 500 |
| Page title | Instrument Serif | 36 / 40 | 400 |
| Hero figure (balance, slip amount) | Instrument Serif | 64 / 64 | 400, −0.02em |

Minimum text size is **12px** (the current 10–11px text goes). Sentence case everywhere, no italics, no letter spacing under 16px.

### Spacing, radius, depth, motion

- **Spacing:** 4px grid. Scale 4 8 12 16 20 24 32 40 48 64.
  - Cards 24 padding; compact panels 16; page edge 32 (16 on mobile).
  - Between cards 16; between sections 48.
- **Rows:**
  - Nav rows 36 tall, 2 apart; section label 24 above, 8 below.
  - Table rows 48.
  - Buttons 36 (nav, inline) or 44 (primary in a sheet or slip).
- **Radius:** controls 8, cards 14, panels and drawer 18, slip 16. Nested: inner = outer − padding, never below 4. Pills only for the count badge.
- **Depth:**
  - Dark: surface steps and hairlines only.
  - Active nav row: `raised` with `inset 0 1px 0 rgba(255,255,255,0.06)`.
  - The slip and the dial may have one soft neutral shadow `0 24px 48px rgba(0,0,0,0.35)`.
- **Motion:**
  - One curve, `cubic-bezier(0.22,1,0.36,1)`. Hover 140ms, menus 180ms, sheets and drawer 360ms.
  - Page content fades and rises 8px once on load, staggered 50ms across up to 6 blocks.
  - Changed numbers tween. Press scale 0.98.
  - No pulse, no ping, no `transition-all`, no hover scale.
- **Icons:** lucide, 16px, stroke 1.5, `text-3` (secondary when active), 10px gap to the label.

---

## 5. Components

- **Button:**
  - Primary: `brass` fill, `brass-ink` text.
  - Secondary: `raised` fill, hairline, `text`.
  - Quiet: text only.
  - Destructive: `raised` with `negative` text; it only becomes filled inside the confirm sheet.
  - One primary per view.
- **Stat:** label (13, `text-2`), figure (Geist Mono 28), and a context line (12, `text-3`), e.g. "of 15 NEAR today". No icons, no sparklines.
- **Throttle notch** (signature): six 4×12 ticks with 2px gaps on a hairline track.
  - Ticks up to the current level are filled in that level's ink; the rest are `line`.
  - Sizes: S (rows), M (cards), L (Agent screen, with labels under each tick).
- **Status text:** a 6px dot in the status ink plus the plain-words status from the glossary. No pill backgrounds.
- **Payment row:** recipient (with an avatar initial), what it was for (one line), amount (mono, right-aligned), status, relative time.
  - Level, risk and IDs live in the drawer, not the row.
- **Drawer** (480 wide, `surface`, radius 18 on the left edge), in this order:
  1. amount (serif) and status
  2. "Why" in plain sentences built from the reason codes ("8× this agent's usual payment", "recipient is on your approved list")
  3. risk factors as thin bars
  4. what the agent said
  5. the task
  6. proof (hashes, policy version, attestation)
- **Sheets:**
  - Confirmations for approve, decline, freeze and save limits, bottom-anchored on mobile.
  - Each states the consequence in one sentence, then opens the wallet.
- **Toasts:** wallet progress ("Waiting for your wallet", "Sent to NEAR", "Paid"), bottom-right, one at a time.
- **Banners:**
  - frozen (steel)
  - waiting approvals (brass hairline, the only place brass appears at banner scale)
  - offline (negative)
  - stale ("Showing the last known state")
- **Empty states:** one sentence plus one action, e.g. "Nothing is waiting for you" plus "See payments".
- **Loading:** skeletons in `raised` at the real layout's shapes. No spinners except inside buttons.

---

## 6. Screens

Each screen keeps its current features and content. These are the layouts and moments it gets.

### Home

- **Header:** "Home" (serif title); the date as meta; on the right, the wallet.
- **Row 1, the moment:**
  - Left, two-thirds: the **allowance dial**, a 240° brass arc showing today's spend against the daily limit, with a tick for "most per payment" and the remaining amount in the centre.
  - Right: **Available** balance in serif 64, with "Waiting" and "Reserved by NEAR" as quiet lines under it.
- **Row 2:** three compact stats: Trust (with its change today), Level (notch M + name), Last risk.
- **Banner** if anything is waiting.
- **Recent payments:** 6 rows, then "See all".
- **Try a scenario:** a quiet panel at the bottom listing the three scenarios with one line each. The result card appears in place.

### Approvals

- **Title** "Approvals", with a count.
- **The moment:** one **slip** per waiting payment, styled like a cheque:
  - payee
  - amount in serif 64
  - "for" line from the invoice
  - why it's waiting (plain words)
  - countdown ring (brass) with "Funds release in 41 min if you don't decide"
  - Decline (secondary) and Approve (primary)
- **Below:** "Recent decisions" (last 5).
- **Empty:** "Nothing is waiting for you".

### Payments

- **Filters** as a segmented control: All, Paid, Waiting, Stopped, Expired. Plus Search.
- **Table** of payment rows; on phones it becomes cards.
- **Row click** opens the drawer.

### Activity

- **The full log**, grouped by day.
- **Each entry** gets one sentence ("You froze spending", "Agent's trust rose to 25.7 after a paid invoice"), a proof link, and an "Unverified" note where a receipt is missing.
- **Filters:** All, Payments, Your actions, System.
- **Export** stays as a quiet button.

### Agent

- **Header:** agent name and account, key scope as one line ("Can only ask the vault to pay; can't move funds itself").
- **The moment:** a **trust line** over the last 7 days (from `TrustUpdated` events), with each change annotated on hover ("+2 paid invoice", "−30 injection attempt").
- **Notch L:** the six levels explained in one line each.
- **Baseline facts:** usual payment, payments today, approved recipients, history size.
- **Scenarios:** the same three, with longer descriptions.

### Limits

- **Title** with "Version 2" and an "Unsaved changes" tag when edited.
- **Left:** the fields (Most per payment, Daily limit, Approved recipients only, Ask me above risk), each with one plain sentence.
- **Right:** **What changes**: the three demo invoices and how each would be handled, updating live.
- **Footer:** Discard and Save limits (opens the sheet, then the wallet).

### Settings

- **Read-only groups:** Wallet and vault (owner, contract, network), Agent (account, key scope), Connections (RPC, API, LLM model, storage), each with a copy button.
- **Footer:** "Theme" (Dark / Light / System) once light ships.

---

## 7. Build order (screen by screen)

**Progress:** 1 Foundation ✅ · 2 Home ✅ · 3 Approvals ✅ (2026-11-09). Screens not yet rebuilt use legacy colour aliases in `tailwind.config.js` so they sit in the new palette until their step.

Each step ships on its own, deployed, before the next starts.

1. **Foundation:**
   - tokens in `tailwind.config.js` and `index.css`, and fonts
   - components: Button, Stat, Notch, StatusText, Drawer shell, Sheet, Toast, Banner, Skeleton
   - the app shell (sidebar, header, freeze control)
   - copy glossary in `copy.ts` and `levels.ts`
2. Home (dial and balance)
3. Approvals (slip)
4. Payments and the drawer
5. Activity
6. Agent (trust line; needs a small `GET /trust` or a filter on `/events`)
7. Limits
8. Settings, then the light theme

**Definition of done for each screen**

- It passes the unslop checklist: 4px grid, one accent, no uppercase or tracked labels, 12px minimum, tabular figures, no glow or pulse, and the template check.
- It's checked at 1440 and 390 wide.
- It's checked in loading, empty, stale and owner/non-owner states.
- Screenshots are updated in `docs/screenshots/`.
- Copy is taken from the glossary.

---

## 8. Figma (optional)

The Figma connector reads designs into code: frames, variables, screenshots. Two ways to use it:

- **Design-led:** you (or a designer) draw a screen in Figma from this file, share the frame link, and I build from it. Section 4 maps one-to-one to Figma variables.
- **Code-led:** I build from this file, then screenshot each screen into `docs/screenshots/` for review. No Figma needed.

The code-led path is faster for the deadline. Figma can still be used for the trust line or the dial if you want to draw them by hand.
