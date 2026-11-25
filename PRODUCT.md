# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Members (students)** at a university or library makerspace. They stand at, or walk toward, a laser cutter, 3D printer, CNC mill, lathe or welder, usually holding their own phone. Job: find a free machine they are allowed to use, scan its QR sticker, see their pass, record a session, and get to work.
- **Supervisors / trainers (student staff).** Know at a glance who is certified for what; sign people off in under 30 seconds.
- **Maintenance technicians.** Work the fault queue and due/overdue checkups; log every service per machine.
- **Coordinator / admin (buyer).** Configure machines, rooms, certifications, members, labels and settings; answer audit questions in minutes.

## Product Purpose

Cleared puts the "is this person cleared to use this machine?" answer at the machine. Member side: live machine status board (Available, In use, Out of service, Supervision required, Issue reported) and a per-machine pass (CLEARED, SUPERVISION REQUIRED, NOT CLEARED, OUT OF SERVICE). Staff side: console with fault queue, checkups, per-machine service log, machine/room/member/certification management, printable QR labels and door poster.

Success: a student goes from scan to accurate pass and a recorded session in under 15 seconds; a coordinator configures the space in under 30 minutes.

## Positioning

A lightweight point-of-use certification check plus machine status and service log for education makerspaces, without adopting a full makerspace suite (no memberships, billing, bookings, inventory or hardware). QR stickers and students' own phones only.

## Operating Context

- Members use phones, often one-handed, in a workshop: noise, gloves, bright or uneven light, standing at the machine.
- Staff use the console on laptops or desktops at a front desk, plus phones on the floor.
- Printed artifacts: QR label sheets and a door poster (Letter paper, print styles exist).
- Status updates arrive by polling (no websockets).

## Capabilities and Constraints

- Next.js 16 on Cloudflare Workers Free (OpenNext) + D1 + Better Auth; Tailwind v4, shadcn/Radix components, lucide icons, sonner toasts.
- $0 only: no paid services or libraries.
- Fonts: one self-hosted font bundled with the app is allowed (user-approved, Nov 2026); no external font or asset requests at runtime.
- Status is always colour + icon + word via `<StatusBadge>`; status tokens in `globals.css` must keep 4.5:1 contrast (unit-tested, 6-digit hex).
- Reduced motion must disable movement (existing global rule).
- Axe accessibility checks run in Playwright E2E.
- Cleared is decision support and record keeping. It does not verify presence, lock machines, or replace a supervisor.

## Brand Commitments

- Name: Cleared (working name). Pass words are fixed: CLEARED, SUPERVISION REQUIRED, NOT CLEARED, OUT OF SERVICE.
- Context: ENTI 333 (Fall 2026) class project; the instructor wants a high-quality, colourful, dynamic interface that does not read as a generic AI-built frontend.

## Evidence on Hand

- Product requirements: `docs/PRD.md`. Demo seed data: `scripts/seed.ts`, `docs/seed.md`.
- No customers, interviews, testimonials, or revenue exist. Never fabricate them.

## Product Principles

1. The answer lives at the machine: the pass verdict is the loudest thing on its screen.
2. Status must be unmistakable at a glance, from a distance, and without relying on colour.
3. Fast over clever: every member action finishes in seconds on a phone.
4. Staff screens are tools: scanability and consistency before expression.

## Accessibility & Inclusion

WCAG AA contrast, keyboard access, visible focus, reduced-motion support, and colour-independent status (icon + word). Verified by axe in E2E.
