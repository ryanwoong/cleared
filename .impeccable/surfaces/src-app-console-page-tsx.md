---
version: 1
slug: "src-app-console-page-tsx"
primary_target: "src/app/console/page.tsx"
related_targets: ["src/app/(member)/layout.tsx","src/app/(auth)/layout.tsx","src/app/layout.tsx"]
---

## Direction contract

THESIS: Cleared reads like the signage bolted beside each machine. Every verdict is a safety sign: green means safe to use, yellow means warning or supervision, red means stop, blue means mandatory (checkups), and black means the machine is out of service. It refuses the default grey SaaS dashboard, where status is a small pill lost in neutral cards.

OWN-WORLD: Warm off-white workshop ground (#f2f2ef) with white enamel plates on 3px near-black (#111) keylines and 10px radius. The shell is a black top bar with a safety-yellow (#ffd200) underline on the active tab and yellow count chips. The palette is ISO 7010 green #009a44, yellow #ffd200, red #c8102e, blue #005eb8 and black. Barlow Condensed 800 uppercase is the display and sign-band voice; Barlow is the text voice. Hazard stripes appear only where a machine is out of service. Pictograms are drawn icons (lucide), never glyphs.

STORY: A member opens the app beside a machine and sees one full-screen sign that says whether they may use it, in a single glance. Staff see the whole shop as a wall of signs: faults, out of service, due and overdue checkups. They act from it, reporting faults, ending sessions and printing labels.

FIRST VIEWPORT: Console home. Top: a 68px black bar with the logo, a tabbed nav with live yellow counts, and a yellow "Report a fault" action at the right. Below it, an uppercase condensed headline with the live timestamp. Next, four sign plates in a row, each with a full-width coloured band holding a drawn pictogram and an uppercase label, and an 88px count. Under those, a 3-of-4 column Active sessions table beside an Out of service panel headed by a hazard stripe. Signature move: a sign flip. When a status changes, the sign's band rotates on its horizontal axis (rotateX), using one spring with a single overshoot. The member pass and the board tiles use the same move; it is instant under reduced motion.

FORM: Shop Safety Sign (ISO 7010 workshop signage), position 1 on the ordered grounded list; chosen by the user as IMPECCABLE'S PICK over the roll. seed:76d9dee080417208

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
