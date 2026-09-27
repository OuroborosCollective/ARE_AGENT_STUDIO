# Mobile APK UX Architecture — ARE Agent Studio

## Product outcome

The Android APK should make the full ARE Agent Studio capability set understandable and operable for first-time users without hiding required actions, while retaining fast access for expert users.

The mobile product is a task-oriented evidence-bound control studio, not a miniature desktop dashboard.

## Canonical mobile information architecture

Bottom navigation (5 items):
- Home — orientation, readiness, next action, recent activity.
- Capture — observe, record, game/genre context, frame/action timeline, publication eligibility.
- Learn — genre logic, tactical memory, policy training, DAgger, playstyle.
- Run — autonomous agent, device connection, ADB arm state, runtime verification, benchmark.
- Evidence — dataset sync, receipts/hashes, Forge Control Room, publication state.

Secondary:
- Advanced drawer — operation-correction learning, terminal, code export, technical diagnostics.
- Search / command palette — expert shortcut to any capability, with labels and categories.
- Recent actions — last-used workflows, not a replacement for navigation.

## Home screen contract

Top:
- ARE Agent Studio identity
- single status line: Device / Agent / ADB / Data
- clear semantic state chips with text, not color alone

Primary section:
"Was möchtest du tun?"
Cards:
1. Capture a session
2. Teach the policy
3. Run the agent
4. Verify evidence

Each card shows:
- what it does
- prerequisite
- expected result
- current readiness
- one primary button

Secondary:
- "Continue where you left off" with the most recent task
- "Evidence status" compact readout
- Help entry with contextual explanations

## Capture screen

Order:
1. Source/device readiness
2. Observe surface
3. Record toggle
4. latest frame/action
5. sample count and timing
6. publication eligibility
7. optional advanced exports

The live device surface remains dominant; control density stays low.

## Learn screen

Use a vertical stepper / staged disclosure:
- Understand game type
- Review tactical memory
- Train
- Correct with DAgger
- Tune playstyle

Show only the stage-specific controls initially. Expert shortcuts expose direct jumps.

## Run screen

Safety-first order:
1. Device connection
2. Agent preview
3. Human takeover statement
4. ADB bridge state
5. Start / Stop
6. live prediction + confidence
7. runtime verification

Never combine "Start agent" and "Arm ADB" into one ambiguous action.
The distinction between prediction and device execution must remain visually explicit.

## Evidence screen

Use an evidence timeline:
- Local observation
- Dataset receipt
- Runtime verification
- External/Forge readback
- publication gate

Each item shows provenance and whether it is observed, derived, verified, unavailable, or blocked.

Unknown values render as "—".

## Advanced

Technical functions move here:
- Ops correction learning
- Terminal CLI
- Codebase export
- low-level diagnostics

They remain fully reachable and searchable; they are simply not part of the novice mental model.

## Persistent safety/evidence rail

Compact, collapsible on small phones:
Device: connected/disconnected
Agent: idle/running
ADB: disarmed/armed
Data: local/private/public-eligible
Truth: observed/derived/verified/blocked

Tap opens the relevant screen, never performs a side effect.

## Interaction rules

- No required functionality may depend on undiscoverable gestures.
- Native semantic buttons/links and accessible names.
- Visible focus support.
- App-owned confirmation dialogs for destructive/security-sensitive actions.
- No browser alert/confirm/prompt in product flows.
- Primary touch targets: 56dp where practical; minimum 48dp.
- Keep primary action count to one per card/screen section.
- Preserve list/table state when returning to parent flow.
- Loading, empty, no-result, error and blocked states preserve layout.
- Never use color alone for semantic state.
- Motion is sparse and purposeful; respect reduced-motion.
- Use plain-language labels first, technical detail second.
- Expert detail is available behind disclosure instead of occupying the initial viewport.

## Visual direction

Keep the existing ARE visual identity but reduce simultaneous neon accents.
Signature element: a thin "evidence spine" connecting the user's task stages and showing where claims originate.

Palette:
- Deep graphite: #0A0D14
- Slate surface: #111827
- Elevated surface: #172033
- Evidence cyan: #58C7E8
- Verified green: #52D69B
- Warning amber: #E7B95B
- Danger red: #E66A6A
- Text white: #F5F7FA

Typography:
- Display: Space Grotesk, restrained use
- Body: Inter
- Data/technical: JetBrains Mono

Geometry:
- 16dp page padding on phones
- 12dp standard gap
- 16dp card radius
- 1px borders at low contrast
- reserve consistent 56dp action rows

## Quantitative checks

For 360dp width with 16dp side padding:
usable width = 328dp.
A 2-column card layout with 12dp gap gives 158dp/card.
Avoid more than 2 columns on narrow phones.

For 393dp width:
usable width = 361dp.
Two columns with 12dp gap gives 174.5dp/card.

For 412dp width:
usable width = 380dp.
Two columns with 12dp gap gives 184dp/card.

Use a single-column flow for primary tasks. Use 2 columns only for secondary summary cards.

## Accessibility

Target WCAG 2.2 AA baseline.
Do not rely on icon-only controls for primary tasks.
Do not obscure focused controls with sticky bottom navigation or the virtual keyboard.
Use accessible status announcements for state transitions such as recording started/stopped, ADB armed/disarmed, sync success/failure.

## Capability mapping

Observe & Record -> Capture
Genre Logic -> Learn
Tactical Memory -> Learn
Policy Training -> Learn
DAgger -> Learn
Playstyle -> Learn
Autonomous Agent -> Run
Runtime Verification -> Run
Calibration Benchmark -> Run
Dataset Server -> Evidence
Forge Control Room -> Evidence
Ops Correction -> Advanced
Terminal CLI -> Advanced
Codebase Export -> Advanced

## Migration strategy

1. Build a shared mobile navigation model without changing SystemMode or protected truth-path services.
2. Replace the mobile long-form selector with bottom navigation + task sub-navigation.
3. Add Home/Start Here as the first visible surface.
4. Add persistent safety/evidence rail.
5. Add advanced drawer and search.
6. Preserve existing mode components, rendering them under the new task shells.
7. Replace browser alerts used by task flows with accessible in-app feedback components where touched.
8. Add mobile interaction/truth regression tests.
9. Verify at 360x800, 393x852, 412x915 and a compact landscape case.
10. Run full existing CI gate and Android APK build.

## Non-goals

- No protected schema changes.
- No changes to prediction/dataset/receipt truth boundaries.
- No new execution authority.
- No removal of expert capability.
- No hidden autonomous execution.
