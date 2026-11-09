# Frontend UI guidance

Use this when changing the CaptainMorgue preview. User decisions take precedence.

## Typography

Use one complete recipe from frontend/src/typography.css. Titles use text-title-h1 through h6 (Funnel Display medium); labels use text-label-xl through xxs (Geist medium); prose uses text-paragraph-xl through xxs (Geist regular); eyebrows use text-subheading-lg through xxs (Geist medium, uppercase). Existing component selectors share those definitions. Do not add separate font size, weight or tracking to component CSS. Source: CostGraph apps/dashboard/src/styles/typography.css.

## Information hierarchy

Keep the current request, agent state, human blocker and next action visible. Put tool traces in Evidence, receipts in History and routing in Details. Keep conflicts and failed actions visible. Use Incident, Requests, Crew and Record as destination names. Preserve drafts when navigating.

## Panels

Open inspectors in the page layout, with supplementary content only. Persist a 360-720px desktop width; provide pointer and keyboard resizing, Escape, close and focus restoration. Stack inline on narrow screens. Use native scrolling for the hackathon.

## Interaction taste

Apply [Emil's design-engineering skill](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md): motion should explain state or acknowledge an action. Keep feedback brief, leave repeated navigation immediate, and use restrained transform/opacity changes. Honor reduced motion and maintain readable state labels. Do not add an animation dependency for this preview.

## Review

Run the frontend build, Storybook build and relevant browser tests. Check an approval, feedback return, disconnected state, keyboard navigation and narrow viewport. Preview actions must remain visibly simulated until the backend contract exists.
