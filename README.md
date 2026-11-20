# PantryPilot

CS 3300 Project 2 - Team 20.

A shared pantry and meal-planning application for tracking inventory, reducing
food waste, and coordinating household shopping.

## Run locally

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Pantry inventory starter (MMF 1)

- Add and edit items with quantity, unit, category, and storage location.
- Search by name, category, or location.
- Consume a positive custom quantity, including decimals, up to the amount in stock.
- Restore one unit; edit for other inventory adjustments.
- Remove items with confirmation and review the activity history.
- Keep inventory and history across reloads using browser local storage.

Consumption rejects blank, nonnumeric, non-finite, zero, negative, and over-stock amounts.
Successful consumption records the amount and unit in activity history. Decimal
results are normalized to 15 significant digits for ordinary pantry quantities;
this prototype is not intended for arbitrary-precision measurement.
Quantities cannot be negative. Items begin empty; no sample data is inserted.
This is a single-browser prototype, not the complete shared-household MMF.
Data is not synchronized between tabs, devices, or users. Clearing browser
storage deletes it. Java 21, Spring Boot, PostgreSQL, authentication, and
shared-household persistence are planned follow-up work.

## Verification

```sh
npm run build
npx playwright install chromium
npm test
```

The build type-checks TypeScript and creates the production bundle in `dist/`.
Browser tests cover the inventory workflow, reload persistence, quantity
validation, decimal remainders, failed storage writes, and invalid saved data.
