# v16 — Expanded Shop & Inventory

## New features

- `/shop category` — filter shop by category: roles, cosmetics, boosts, tickets, special.
- `/shop item` — show details for a specific item.
- `/buy item` — buys any enabled shop item by ID.
- `/inventory` — shows inventory and active boosts.
- `/use item` — uses boosts, tickets and special items from inventory.
- `/gift coins` — gifts coins to another member.
- `/gift item` — gifts transferable inventory items to another member.

## New default items

- `xp_boost_24h` — x2 XP for 24 hours after `/use`.
- `coin_boost_24h` — x2 daily coins for 24 hours after `/use`.
- `raffle_ticket` — ticket for manual giveaways.
- `custom_role_request` — special item for requesting a custom role through a ticket.

## Web panel changes

The shop admin page now supports item types:

- `role`
- `cosmetic`
- `boost`
- `ticket`
- `custom`

For boost items, configure:

- `boostType`: `xp` or `coins`
- `multiplier`: for example `2`
- `durationHours`: for example `24`

## Recommended check

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

Then test in Discord:

```text
/shop category:Бусты
/buy item:xp_boost_24h
/inventory
/use item:xp_boost_24h
/gift item user:@member item:raffle_ticket
```
