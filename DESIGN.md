# Design System: ARE Agent Studio — Mobile Signal Control Room

## 1. Visual Theme & Atmosphere

ARE Agent Studio is a calm evidence-control instrument, not a sci-fi dashboard.

The visual language is a premium field instrument: dark, precise, quiet, trustworthy, and immediately readable on a phone held in one hand. The product guides a human through Capture → Learn → Run → Evidence while keeping device authority and provenance explicit.

**Atmosphere**
- Density: 4/10 — balanced mobile application.
- Variance: 6/10 — restrained asymmetry.
- Motion: 3/10 — restrained fluidity.
- Visual priority: task > state > provenance > technical detail.
- Every visible group should answer: “What can I do here, what do I need first, and what happens next?”

### Physical APK evidence to eliminate

The supplied APK screenshots show:
- multiple navigation layers rendered at once;
- oversized gray browser/native-looking controls;
- concatenated state labels such as “DeviceLocalAgentIdleADBOff”;
- repeated Game Profile controls;
- task navigation competing with technical navigation;
- excessive vertical text before the first actionable control;
- weak separation between navigation, state, task content and safety state.

These are release-blocking visual defects.

### Research grounding

Mobile HCI research shows that hidden gesture interactions can reduce discoverability. Required capabilities therefore stay visible or explicitly reachable through labeled controls. AgentLens research supports non-invasive, task-sensitive visual intervention rather than forcing the user into constant full-screen agent views.

---

## 2. Color Palette & Roles

Use one restrained neutral palette with one accent family only.

- **Off-Black Canvas** (#070B10) — application background; never pure black.
- **Deep Surface** (#0D151D) — workspace surface.
- **Raised Surface** (#121D26) — cards, sheets, menus, dialogs.
- **Structural Steel** (#263540) — dividers and structural borders.
- **Primary Ink** (#F4F7F8) — primary text.
- **Secondary Ink** (#B5C1C8) — body/help text.
- **Quiet Ink** (#7D8B93) — metadata.
- **Signal Teal** (#67D9CF) — the sole accent for active, focus and primary interaction.

Rules:
- No purple/neon AI aesthetic.
- No rainbow or decorative neon gradients.
- No pure black (#000000).
- Do not communicate state through color alone.
- Safety-critical red/amber is semantic only and must remain text-labeled.
- No glow effects as a hierarchy substitute.

---

## 3. Typography Architecture

The final UI must never expose browser-default/native fallback typography as the primary visual language.

- **UI / Display:** Geist, Satoshi or Outfit.
- **Body:** same family as UI for consistency.
- **Mono:** JetBrains Mono for IDs, timestamps, hashes, telemetry and dense numeric data.
- **Do not use:** Inter in the final premium UI, generic serif fonts, browser-default fallback typography as the primary design.

Scale:
- Screen title: 28–32px, weight 700–800.
- Workspace title: 24–28px, weight 700.
- Section title: 18–20px, weight 650–700.
- Body: 16px minimum on mobile; line-height about 1.45–1.6.
- Secondary/help: 14px minimum.
- Metadata: 12–13px.
- Avoid enormous headings that push core actions below the fold.

Measure:
- Body copy normally 60–65 characters per line.
- Status values are separate cells or pills with real whitespace.
- Never concatenate multiple status labels.

---

## 4. Global Navigation

### Mobile: one navigation stack, not multiple bars

The viewport contains at most:
1. a compact header;
2. one contextual tool strip when needed;
3. one fixed five-item bottom navigation.

The header contains:
- ARE Agent Studio identity;
- exactly one Game Profile control;
- compact safety/status summary.

Primary destinations:
- Home
- Capture
- Learn
- Run
- Evidence

Advanced is a secondary tools sheet and is never rendered as a second persistent navigation bar.

### Bottom navigation

- 5 destinations only.
- 48×48px minimum touch target; 52–56px preferred.
- Icon + text label.
- Active state = Signal Teal + restrained surface treatment + clear current state.
- Never render a duplicate bottom navigation elsewhere.
- Keep content clear of the bottom bar using safe-area spacing.

### Contextual tool navigation

Only the selected group's tools are shown.
Use explicit labels such as:
- Observe & Record
- Genre Logic
- Tactical Memory
- Policy Training
- DAgger
- Playstyle
- Agent
- Verify Runtime
- Benchmark
- Dataset Sync
- Forge Control Room

The page itself never horizontally scrolls. A compact tool strip may scroll internally if required.

---

## 5. Advanced Tools

Advanced contains:
- Ops Correction Learning
- Terminal CLI
- Codebase Export

Display as one bottom sheet / anchored panel with:
- clear title;
- one sentence per tool;
- one clear close affordance;
- current selection highlighted;
- no duplicate primary navigation inside the sheet.

---

## 6. Home / Start Here

Home is a decision surface.

Top:
- eyebrow: START HERE
- title: “Was möchtest du tun?”
- concise explanation;
- first meaningful action should appear quickly.

Core flow is shown in four vertically ordered stages:

### 1 — Capture
Observe a real screen and record human demonstrations.

### 2 — Learn
Use observed frame/action pairs for training and human correction.

### 3 — Run
Inspect predictions and only separately permit Android output when deliberately armed.

### 4 — Evidence
Inspect receipts, synchronization, runtime verification and provenance.

Each stage contains:
- number;
- title;
- purpose;
- prerequisite;
- expected result;
- one dominant CTA.

Do not use four oversized identical cards. Use a numbered vertical rhythm, a subtle left stage rail, restrained surfaces and whitespace.

### Home status

Place Current State after the primary task path:
- DEVICE
- AGENT
- ADB
- DATA

Each gets its own semantic region.

---

## 7. Workspace Context Header

Every non-Home workspace starts with:
- stage marker;
- workspace title;
- one-sentence purpose;
- Voraussetzung;
- Ergebnis;
- Weiter.

Keep this compact. Do not duplicate the Home manifesto inside every workspace.

When there is an obvious next action, there is only one dominant CTA.

---

## 8. Status & Provenance

Correct presentation:

**DEVICE**
Not connected

**AGENT**
Idle

**ADB**
DISARMED

**DATA**
Private

Incorrect:

**DeviceLocalAgentIdleADBOff**

Use explicit provenance text:
- Local observed
- Forge observed
- Derived
- Verified
- Partial
- Unavailable

Never invent values to fill empty states.

---

## 9. Agent Authority & Consent

Agent authority is visible, bounded and revocable.

### Action Preview

For consequential actions show:
- Action
- Target
- Parameters
- Authority
- Expected result

The primary action names the act, e.g. **Arm ADB output**, never generic **OK**.

### Default authority

- least privilege by default;
- one-time authority before standing authority;
- standing duration and scope shown next to the choice;
- never preselect “always allow”;
- revocation remains one affordance away.

### Friction

- reversible: direct confirmation;
- undoable: confirmation + honest undo;
- irreversible: explicit consequences + deliberate confirmation.

### Receipts

Every consequential action shows a receipt with:
- action;
- time;
- authority;
- provenance;
- verification status.

No UI claims “verified” without supporting receipt/provenance.

---

## 10. Core Components

### Buttons
- Primary: restrained Signal Teal.
- Secondary: outlined/quiet.
- Destructive: semantic red + text.
- Minimum 48×48px mobile.
- Action-specific labels.
- Tactile active state using transform only.
- No outer glow.

Good:
- Capture öffnen
- Learn öffnen
- Run öffnen
- Evidence öffnen
- ADB-Ausgabe armieren
- Verbindung erneut prüfen

Bad:
- OK
- Go
- Do it
- unlabeled icon-only primary actions

### Cards
- Radius 14–18px.
- One structural border.
- Subtle background-tinted shadow.
- Use elevation only where hierarchy requires it.
- Avoid card-inside-card nesting.

### Inputs
- Label above.
- Helper text below when needed.
- Error text directly below.
- Signal Teal focus ring.
- No floating labels.
- Native controls must be intentionally restyled; browser-default controls are not acceptable.

### Loading
Use layout-matched skeletons.
Do not use generic full-screen spinner screens for routine work.

### Empty states
Every empty state answers:
- what is missing;
- why it matters;
- one next action.

### Errors
Inline and contextual:
- what failed;
- what the user can do now.

Never use browser alert/confirm/prompt for routine product feedback.

---

## 11. Responsive Layout

### Mobile < 768px
Strict single-column content.

### Tablet/Desktop ≥ 768px
Use the same information architecture with additional workspace width. Two-column task layouts are allowed only when they improve execution.

### Spacing scale
4 / 8 / 12 / 16 / 24 / 32px.

### Required validation sizes
- 360×800
- 393×852
- 412×915

At every mobile target:
- no duplicate navigation;
- no clipped title;
- no horizontal page overflow;
- no overlap;
- no concatenated metadata;
- no primary CTA hidden below unnecessary content;
- no second Game Profile control.

---

## 12. Desktop Layout

- max-width: 1200–1320px;
- task hierarchy stays identical to mobile;
- dense workspaces may use two columns;
- never fall back to a generic three-column SaaS feature grid;
- technical details remain secondary to the current task.

---

## 13. Motion

Motion clarifies state; it does not decorate the screen.

- press/focus: 100–160ms;
- sheet/panel: 180–260ms;
- workspace transition: 220–320ms;
- animate transform and opacity only;
- respect prefers-reduced-motion;
- no perpetual bounce, floating UI, full-screen shimmer, or attention-grabbing decorative loops.

---

## 14. Accessibility

- 44px is the minimum acceptable target; 48px+ preferred.
- Visible focus.
- Native semantic controls.
- Explicit labels and descriptions.
- Live regions for important state changes.
- No color-only semantics.
- Scrollable regions remain accessible.
- Modal focus is trapped and begins on the least-destructive action.
- Decline/cancel is always safe and explicit.

---

## 15. Android WebView Runtime Contract

ARE Agent Studio is a bundled Android WebView application.

Therefore:
- critical styles must be locally bundled for release builds;
- external CDN styling must never be the only source of layout-critical CSS;
- APK build success is insufficient evidence of visual correctness;
- the published APK must be tested for rendered UI and control styling;
- native browser defaults leaking into the application are release-blocking defects;
- boot/recovery UI must remain readable even when the React client fails.

The Android release flow must treat runtime asset reachability as a separate verification dimension from APK packaging.

---

## 16. Stitch Screen Set

Use Google Stitch to define these screens from this document:

1. Home / Start Here
2. Capture workspace
3. Learn workspace
4. Run workspace
5. Evidence workspace
6. Advanced tools sheet
7. ADB Action Preview / authority state
8. Action Receipt / verification state

For every Stitch screen:
- left anchored/asymmetric composition;
- clean spatial zones;
- one dominant CTA;
- restrained dark surfaces;
- Signal Teal as the single accent;
- provenance visible;
- realistic state text;
- no overlapping navigation;
- no ornamental graphs unless they support a user task.

---

## 17. Never-Ship Anti-Patterns

- duplicate navigation;
- duplicate Game Profile control;
- concatenated state strings;
- browser-default gray controls;
- hidden required gestures;
- purple/neon AI gradients;
- pure black;
- Inter as the final premium UI font;
- generic serif typography;
- neon outer glows;
- giant headings that push actions below the fold;
- equal three-column feature grids;
- excessive nested cards;
- unlabeled icon-only primary actions;
- browser alert/confirm/prompt;
- unverifiable “Verified” claims;
- standing agent authority preselected;
- hidden revocation;
- fabricated metrics/evidence/device state;
- release styling that depends exclusively on an external CDN.

---

## 18. Implementation Contract

This document is a design contract, not an implementation.

Subsequent implementation must:
- preserve all 14 SystemMode capabilities;
- preserve evidence-bound provenance;
- preserve ADB separation and human authority;
- preserve current product behavior unless a design change explicitly requires behavior work;
- use this file as the single visual source of truth;
- validate screenshots at 360×800, 393×852 and 412×915;
- treat visible runtime divergence from this system as a defect requiring correction.

**Design intent:** reduce visual complexity by improving hierarchy and context, not by deleting capabilities.
