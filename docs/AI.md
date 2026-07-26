# Soldier AI — algorithm reference

`src/soldiers.js` implements the armed AI soldiers used by **SQUAD STRIKE**
mode. They fight with the regular weapon arsenal (SMG / AR / DMR / shotgun,
assigned randomly at spawn) and are tuned to feel like human opponents
rather than aimbots. This document describes the exact algorithm.

## Update pipeline (per bot, per frame)

```
perceive → aim-model update → state transition → steer → integrate physics
        → weapon handling (burst discipline / reload) → animate
```

## 1. Perception

- A line-of-sight raycast from the bot's eye (y+1.55) to the player's eye
  runs on a **0.15 s tick**, staggered per bot with a random phase so a
  whole squad never raycasts on the same frame.
- Sight range is 60 units; world colliders block sight.
- **Target memory**: on every successful sight the bot stores
  `lastSeen` (player position) and resets `lastSeenAge`. When sight is
  lost the bot keeps hunting that memory for 6 seconds.

## 2. Aim model (the "human hands")

- `aimError` is the half-angle (radians) of an error cone applied to every
  shot direction.
- On **fresh acquisition**: `aimError = 0.14` and a reaction delay of
  `0.35–0.55 s` must elapse before the first shot.
- While line of sight is held, error tightens linearly at **0.06 rad/s**
  down to a floor of `0.025` — the longer you stand still in the open, the
  deadlier they get.
- Losing sight resets the error to 0.14. Taking a hit adds **+0.05 flinch**
  (capped at 0.16), so suppressive fire genuinely degrades their aim.
- Error sampling uses the average of two uniforms (triangular distribution),
  which clusters shots toward the center like real spray patterns.

## 3. Ballistics

Each shot is a true hitscan, not a dice roll:

1. Sample a direction = (unit vector to the player's eye) + error offsets.
2. Raycast world geometry to get the wall distance.
3. Slab-test the ray against the player's AABB (0.8 × 1.8 × 0.8).
4. If the player intersection is closer than the wall, apply damage
   (weapon damage × 0.5 balance factor, `bullet` damage type — the
   COMBAT HELMET equipment reduces it); otherwise spawn impact sparks
   where the ray landed.
5. A tracer and muzzle flash are drawn either way, so near-misses are
   visible and readable.

## 4. State machine

| State | Enter when | Behavior |
| --- | --- | --- |
| **ENGAGE** | has line of sight | Strafe perpendicular to the player (sign flips every 1.6–3.6 s), close in beyond 140% of the weapon's preferred range, back off inside 60%. Preferred ranges: shotgun 6, SMG 9, AR 14, DMR 22. |
| **COVER** | reloading | Pick the nearest collider ≥1.2 units tall within 25 units and move to the point 2.2 units behind it (on the far side from the player). With no cover available, back away while strafing. |
| **HUNT** | sight lost < 6 s ago | Move to `lastSeen`; on arrival with no contact, go idle until re-acquisition. |

Squad **separation steering** (inverse-distance repulsion inside 2 units)
prevents stacking; the same axis-resolved AABB physics as the player
handles collision, so bots slide along walls rather than sticking.

## 5. Firing discipline

- Weapons fire in **bursts**: SMG 5–9 rounds, AR 3–6, DMR 1–2, shotgun 1,
  at the weapon's real fire rate, followed by a 0.5–1.2 s pause.
- Magazines are real: after `magSize` rounds the bot spends
  `reloadTime × 1.15` reloading — and retreats to COVER while doing it.
  That reload window is the intended punish opportunity.

## 6. Squad/match logic (SoldierManager)

- Keeps a 4-bot squad alive: each death schedules a respawn 3 s later at a
  spawn point ≥25 units from the player.
- Match target: **30 eliminations within 300 s**. The player redeploys
  2.5 s after death (streak resets); the mission fails only on timeout
  with the target unmet.

## Attack helicopter (killstreak)

`src/warfare.js` — at a 12 killstreak an ally helicopter orbits the player
(r = 16, h = 13) for 30 s. Every second it raycasts for a visible hostile
and fires a 3-round burst (65% hit chance per round, 14 damage) with
visible tracers. Line of sight is honored, so enemies under bunker roofs
are safe from it.
