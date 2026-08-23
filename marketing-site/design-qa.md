**Comparison target**

- Source visual truth: `/workspace/scratch/a79368b20bea/generated_images/exec-ac13ef1f-055f-4ed0-a5f8-fbd18ccb9b35.png`
- Implemented route: the marketing-site root in its initial, live-metrics-loading state.
- Intended viewport: desktop landscape, matching the source's two-column Signal Control Room composition.

**Capture evidence**

- Source image opened and inspected: 992 × 1588 px.
- Implementation screenshot: unavailable.
- Primary interactions implemented for later visual verification: navigation scrolls to its sections; the early-access CTA routes to the access section when checkout is unconfigured; verified external links open only from the public metrics response; loading and unavailable metric states are visible.
- Console check: unavailable because the local Vite dependency build could not be started.

**Findings**

- [P0] Browser-rendered implementation is not available for comparison.
  Location: local preview / visual QA.
  Evidence: the environment's npm execution path fails before it can install the pinned React/Vite dependencies; `marketing-site/dist/client/index.html` therefore does not exist and the Sites packaging regression correctly fails before a build.
  Impact: visual fidelity, responsive behavior, interactions, and console state cannot truthfully be passed without a browser-rendered capture.
  Fix: run the pinned dependency installation in a network-capable build environment, then run `npm run build`, `npm run test:sites`, start the preview, capture the root at the intended desktop and mobile viewports, compare it side-by-side with the source visual, and resolve any P0/P1/P2 findings.

**Required fidelity surfaces**

- Fonts and typography: implemented with Manrope and DM Mono to approximate the reference's display/body and compact console labels; not browser-verified.
- Spacing and layout rhythm: implemented as a two-column hero, right-side glass console, access panels, and three learn cards; not browser-verified.
- Colors and tokens: implemented with near-black, cyan, emerald, and restrained violet; based on the inspected source visual; not browser-verified.
- Image quality and asset fidelity: hero and all three learning panels use locally bundled raster assets in the same art direction; no placeholder or hand-drawn icon asset is used; not browser-verified.
- Copy and content: public values are dynamically fetched from the aggregate-only metrics contract and show `—` when unavailable; static copy does not claim a published dataset, APK, or verified action count.

**Comparison history**

- No visual comparison iteration could start because a rendered implementation capture is missing.

**Implementation checklist**

1. Restore a network-capable dependency install and produce `dist/client/index.html`.
2. Run the existing public metrics and Sites package regressions.
3. Open the site in the cloud browser and capture desktop plus mobile states.
4. Compare the captures against the selected source image and fix any actionable P0/P1/P2 findings.

**Follow-up polish**

- After the blocking visual pass, tune text wrapping and card/image crops at the measured desktop and mobile widths.

final result: blocked
