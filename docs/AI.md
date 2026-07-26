# Soldier AI — algorithm reference

## Difficulty presets

`src/bots.js` exports the shared `DIFFICULTY` table used by both Strike
soldiers and Versus bot players:

| Preset | Aim start | Aim floor | Tighten rad/s | Reaction | Burst pause | Grenade p/f | Speed | HP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 0.20 | 0.055 | 0.04 | 0.75 s | 1.3 s | 0.002 | 0.85× | 0.85× |
| Normal | 0.14 | 0.030 | 0.06 | 0.45 s | 0.85 s | 0.004 | 0.95× | 1.0× |
| Hard | 0.10 | 0.020 | 0.09 | 0.28 s | 0.55 s | 0.007 | 1.0× | 1.1× |
| Expert | 0.07 | 0.012 | 0.13 | 0.16 s | 0.35 s | 0.010 | 1.05× | 1.2× |

In co-op Survival the preset instead scales wave HP/speed. The host picks
the room difficulty in the lobby; solo picks it in mission setup.

## Versus bot players

Offline Versus fills the match with **bot players** (`BotPlayer`) that play
by player rules: real weapon definitions with magazines and reload times,
armor plates that absorb before health, health regen after 4.5 s, grenade
throws, respawns 3 s after death, kill/score tracking on the shared
scoreboard, and a resupply at a 5-kill streak. They target the nearest
visible combatant — the human or each other — using the same
perception/aim pipeline described below.


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

## 7. Tactical maneuvers (difficulty-gated)

AI is not a straight-line rusher: both the Strike soldiers and the bot
"virtual players" (`src/bots.js`) pick maneuvers from a repertoire gated
by the selected difficulty:

| Difficulty | Repertoire |
| --- | --- |
| Easy | Basic movement only — engages in the open, backs off to reload |
| Normal | Uses cover when reloading, occasional flanking arcs |
| Hard | Full cover use, persistent flanking, retreats when below 35% HP, peek-fires around lost contacts |
| Expert | Everything above plus suppression fire and coordinated team roles |

Mechanics:

- **Flanking** — instead of pushing straight in, flankers hold a
  persistent side (`flankSign`, re-rolled every ~6 s) and weight their
  approach with a wide perpendicular arc, so they arrive at the target's
  side or rear.
- **Cover-seeking retreat** — when reloading or below 35% HP, the bot
  moves away from its target, probing back/left/right paths at 2 Hz and
  choosing the first whose endpoint the target can no longer see
  (raycast against world colliders).
- **Peek-firing** — when line of sight breaks but the target was seen in
  the last 2.5 s, the bot sidesteps around the obstruction to re-acquire
  rather than waiting.
- **Suppression (expert)** — with fresh target memory but no line of
  sight, the bot cracks rounds over the last known position every
  ~0.3–0.6 s (no aim cheat: it shoots where the target WAS).
- **Team coordination (expert)** — bots on the same team alternate
  `advance` / `overwatch` roles on the tactic clock, so one element holds
  and fires while the other pushes.
- **Flash & smoke aware** — flashbangs stun AI for 3 s (with LOS), and
  smoke spheres block every AI perception raycast.

## 8. Grenades

All tiers can cook grenades at 8–30 m with tier-scaled probability
(easy 0.2%/frame → expert 1%/frame while a target is held).
