# SemunCraft

## Overview

SemunCraft is a **browser-based strategy game** (no build step; the only external dependency is PeerJS for multiplayer) that combines chess-like piece mechanics with real-time-strategy elements like spawning, merging units, and map hazards.

The goal: **destroy the enemy King** while building up your army through a merge-chain system.

**To play**: open the online version at https://chicago-wongdontrihan.github.io/SemunCraft/SemunCraft.html, or double-click `SemunCraft.html` locally. No server or build step needed (multiplayer and the optional Claude opponent need an internet connection).

---

## Game Board

- **9x9 grid** with alternating light/dark tiles (like a chess board, but larger). Campaign levels use their own board sizes.
- Coordinate system uses algebraic notation (a-i columns, 1-9 rows).
- **White King** starts on b2 (bottom-left area); **Black King** starts on h8 (top-right area). Each King starts with 3 pawns on the adjacent tiles closest to the enemy King.
- **Five resource tiles** share the board with them (`RESOURCE_SQUARES` in `js/state.js` and `js/engine.js`): a **gold mine at e5**, the same three squares from both Kings; and for each side a **mine** (f2 for White, d8 for Black) and an **Elixir spring** (b6 for White, h4 for Black), four squares from its own King and six from the other's — a near tile to hold and a far one to raid. The tiles and the obstacles are mirrored through the board's centre, so the race for them starts even.

---

## Pieces & Stats

| Piece | Glyph | HP | Movement | Attack |
|-------|-------|----|----------|--------|
| **Pawn** | ♙/♟ | 1 | 1 step, any of 8 directions; 2 squares dead ahead, or 2 along its own rank either way, on its first move | Adjacent (8 dirs) |
| **Fortified Pawn** | ♙/♟ in a helmet | 3 | As a pawn | As a pawn |
| **Knight** | ♘/♞ | 4 | L-shape jump (2+1), jumps over pieces | L-shape range |
| **Paladin** | ♘/♞ (twin knights) | 3 | L-shape jump (2+1), jumps over pieces | L-shape range; **always destroys** the target, and the Paladin **leaps onto the cleared square** as part of the attack. **Never fires on its own** — it only strikes a target the player has locked themselves (drag or right-click), unlike every other piece, which auto-fires at whatever's in range. No merges, no delayed orders |
| **Bishop** | ♗/♝ | 3 (2 until 2026-10-04: at 3 Gold, a Knight and a pawn, it had half a Knight's HP) | Diagonal up to 2 squares (sliding) | Diagonal up to 2 (sliding); also heals allies, and strips enemy helmets, with mana |
| **Rook** | ♖/♜ | 4 | Cardinal up to 2 squares (sliding) | Cardinal up to 3 squares, **piercing** (goes through pieces) |
| **Guardian** | ♖/♞ (knight in a tower) | 5 | Cardinal up to 2 squares (sliding), like a rook | **Every square a rook or a knight could hit from there** — a straight cardinal shot **flies clear to the farthest tile it can reach and damages every piece along that whole line** (friendlies spared), not only the one it was aimed at; a knight's-reach shot hits only the target. Keeps a **farther watch than most pieces (3 squares, not 2)**. No merges, no delayed orders |
| **Queen** | ♛ | 5 | All 8 directions up to 2 squares (sliding) | All 8 directions up to 2 squares (not L-shapes); not blocked by pieces or obstacles |
| **King** | ♔/♚ | 5 | Adjacent 1 step | Adjacent; also **spawns new pawns** |
| **Siege Tower** | 🏰 | 4 | **One square, ordered a turn ahead** | Cardinal, **2 to 4 squares away — never the square right beside it**, **2 damage, lobbed clean over everything** — obstacles and pieces alike (`siegeRange` in `js/constants.js`, `siegeLine` in `js/engine.js`) — and the **shell bursts**: every piece on the 8 squares around the one it hit takes **1**, friend or foe alike, so a hit catches the whole 3×3, 2 in the middle and 1 around it (`siegeSplash` in `js/combat.js` and `js/engine.js`). It never steps anywhere of its own accord: a move is given as a **delayed order** to an adjacent square (`orderTargets` in `js/actions.js`), it rolls there at the head of the next turn, and **it does not fire on the turn it is ordered, nor on the turn it moves** (its order is always one turn ahead, so the turn it is given is its moving turn and it holds its fire then, like any piece; then `runOrders` marks it `rolled`, the attacks that turn pass it over, and the next `turnUpkeep` clears the mark). Right-click it (or tap it twice) to un-siege back into two rooks, each with the tower's current HP (one rook if no tile next to it is free). |
| **Mage** | ✦ | 3 | Diagonal up to 2 squares (sliding), like a bishop | Eight fire trajectories, shaped like the '상' (elephant) piece in Korean janggi (one orthogonal step, then two more continuing the same diagonal — trimmed short rather than dropped where the board's edge cuts across it, so it still fires with whatever length is left); hitting an enemy anywhere on a trajectory **burns the whole line** for 1 damage each, friendlies spared, drawn regardless of where along it the enemy stands, as a wall of fire that catches tile by tile down the line and lingers a turn afterward (cosmetic, no extra damage). **Sees along its own trajectories even through fog it hasn't otherwise explored** — its own flame lights the way. Has **mana** (max 2, regenerates like a bishop's); for 2 mana, casts a **Meteor** instead of attacking (below). No merges, no delayed orders |

---

## The Merge Chain

The core progression mechanic. Drag one piece onto an adjacent ally to merge them into a stronger unit:

```
♙ + ♙  -->  ♘  (Pawn + Pawn = Knight)
♙(fortified) + ♙  -->  ♖  (Fortified Pawn + Pawn = Rook; two fortified pawns make one too)
♙ + ♘  -->  ♗  (Pawn + Knight = Bishop)
♘ + ♘  -->  ♞♞ (Paladin)  (Knight + Knight = Paladin, for 3 Elixir)
♘ + ♗  -->  ♛  (Knight + Bishop = Queen)
♖ + ♖  -->  🏰  (Rook + Rook = Siege Tower, for 1 Elixir)
♖ + ♘  -->  ♖♞ (Guardian)  (Rook + Knight = Guardian, for 1 Elixir)
♗ + ♖  -->  ✦  (Bishop + Rook = Mage, for 2 Elixir)
```

- Merged pieces spawn at full HP for their new type; a new Bishop or Mage starts with 1 mana.
- A Knight can also merge with a piece one L-jump away, and that merge doesn't use up your turn — a
  Guardian's own merge partners (adjacent only, since it moves like a rook) come from that same knight
  merge-partner scan, restricted to its own reach.
- Dragging a Bishop onto a Knight asks whether to heal it or merge into a Queen; onto a Rook, whether to heal it or merge into a **Mage**.
- **The top tier costs Elixir**, paid at the moment of merging (`ELIXIR_COST` in `js/state.js` and `js/engine.js`): **Paladin 3, Mage 2, Guardian 1, Siege 1**. Without the Elixir the two pieces simply don't merge. With a Rook at 3 Gold, that puts a Paladin at 4 Gold + 3 Elixir, a Guardian at 5 + 1, a Mage at 6 + 2 and a Siege Tower at 6 + 1 — against a Queen's 5 Gold and no Elixir. The Mage is drawn as the Bishop rising out of a short tower, the design from the title screen (`pieces/combined/make.js`, shipped to the game in `pieces/units-art.js` by `node pieces/combined/make-game-units.js`).
- A fortified pawn merges only with a pawn, into a **Rook** — 3 Gold, one helmet and one plain pawn (two fortified pawns make a Rook too, at 4). Two plain pawns still make a Knight, so the helmet is what decides between the two.
- The **Paladin** (twin knights) and **Guardian** (a knight rising out of a short rook tower) are drawn the same way as the Mage — designs from `pieces/combined/make.js`, the title screen's own art, shipped to the game in `pieces/units-art.js`.
- **Paladin, Guardian and Mage take no delayed orders** (`NO_ORDER_TYPES` in `js/state.js` and `js/engine.js`): each is a piece whose attack already resolves in one committed motion (a kill-and-leap, a line of damage, a spell), so there is nothing left for an order to book ahead of time.
- The **Merge** button merges the first adjacent pair it finds (Rook + Rook, Rook + Knight and the Mage are drag-only).

---

## Spawning

- The **King** spawns pawns on adjacent empty tiles: click the King, then an empty tile next to it (or press **Spawn** to place one on the free tile closest to the enemy King).
- **Gold** starts at **8** and earns **a sixth a turn**, and a sixth more for every turn that ends with a pawn of yours on the **gold mine** (`8 + (turnCount + mineTurns) / 6`, `GOLD_START` / `GOLD_TURNS` in `js/state.js`, written the same way in `js/engine.js` so both land on the same number — turns are counted as whole numbers and divided once, never summed in sixths). A pawn from the King costs 1 Gold, so spawning waits until a whole Gold is in hand. The AI earns Gold on the same terms.
- **Fortify** spends 1 Gold from the same purse: the selected pawn becomes a **fortified pawn** — the same pawn for moving and attacking, but with **3 HP**; it merges only with a pawn, into a Rook (the helmet was paid for, so never into a Knight), and can't work a spring or a mine. Its armour **mends 1 HP five turns after the last hit it took** (`FORTIFIED_MEND`, counted in `turnUpkeep` / the engine's `upkeep` from the turn of the hit, so a pawn left alone climbs back to 3 HP), drawn with an iron helmet and a heater shield in its team’s colour. It takes the pawn’s turn, as spawning takes the King’s, and a pawn is fortified only once (`fortifyAt` in `js/actions.js`, `fortify` in `js/engine.js`; `goldSpent` keeps the count). Levels without spawning have no Gold, so no fortifying either. The AI doesn’t fortify yet.
- **Strip** (2026-10-02, the answer to a march of helmeted pawns): a **bishop** with at least **1 mana** (`STRIP_MANA`) can take the helmet off an **enemy fortified pawn** **within 2 squares of it, in any direction** — the 5×5 around it, over pieces and obstacles alike, but only a pawn it can see and not one in undergrowth cover (`stripReach`; at first it was the bishop's own diagonal reach, widened the same day) — **for good**. The pawn is a plain 1-HP pawn again (a wounded one too), it can **never be fortified again**, and it wears a **cracked helmet** in the top right corner of its square so both players can tell (`stripped` on the piece; `STRIP_BADGE_SVG` in `js/render.js`). Like a heal or a Scry it is the bishop's turn: it spends the mana, resets the same mana clock, doesn't shoot as well that turn, and steps out of any undergrowth cover it was in. A side effect worth knowing: a stripped pawn can no longer go into a Rook (which takes a helmet). To strip, select the bishop and pick **Strip (1 mana)** on its on-board chooser beside Scry — it is lit when the bishop has the mana and an enemy helmet within 2 squares, and otherwise says why not — then tap one of the helmets that glow orange; a tap anywhere else puts it away (`startStrip` / `stripTargets` / `castStrip` in `js/actions.js`, `strip` in `js/engine.js`, checked against each other by the parity tests). **Master** strips when it judges it worth the turn. The **networks** strip from **encoding version 3** on (2026-10-03, below), which gives Strip a slot of its own and stripped pawns a channel; the version-1 and version-2 networks (Easy, Medium, Hard) can't, since in their encodings it would share the target lock's slot.
- Spawning is your only way to create new units -- everything else comes from merging. Campaign levels don't allow spawning.

---

## The Spring and the Mine

Five tiles on the board are worth holding (`RESOURCE_TILES`, `RESOURCE_SQUARES` in `js/state.js`), and only **plain pawns** work them — a pawn parked on one is a pawn that fights nowhere else, so holding all five costs most of an army:

- A **gold mine** (e5, f2, d8) pays by being held: every turn that ends with a pawn of yours on one adds **another sixth of Gold**, so income runs from +0.17 with none to **+0.67** with all three (`mineTurns`, `heldTiles`; credited by `creditResources` in `endTurn` / `finishBlackTurn` and in the engine's `finishTurn`). While a pawn stands on one the tile pulses gold with a large **+0.16** badge on its top edge, and the Gold line in the panel lights up with the raised rate.
- An **Elixir spring** (b6, h4) pays the same way, every turn that ends with a pawn of yours on one banking **half an Elixir** (`ELIXIR_RATE`, 0.5) — but a spring is a well, not a tap (2026-09-27): it holds **`SPRING_CAP` (3) Elixir of its own**, full at the start of the game, and pays out of that reservoir, not endlessly. Six turns of holding one (`3 / 0.5`) runs it dry. A spring below its cap gains **1 Elixir back every `SPRING_REFILL` (5) turns** it goes undisturbed — a steady drip, not a one-time wait-then-snap-to-full — and being drawn from resets that countdown, so it only climbs while left alone, whether or not anyone is currently standing on it; abandoning a drained spring lets it recover, but the other side can't hurry it along either. This is tracked as a plain per-spring countdown rather than a shared timestamp (`cooldown` in `js/state.js` / `js/engine.js`), on purpose: in real PvP each browser only ever knows its own side's turn count (`turnsOf`), so a clock the two peers could disagree about would let the same spring drift out of sync between them. The tile pulses green with a **+0.5** badge while it still has some left, and a grey **dry** badge once it doesn't; a second badge in the opposite corner (bottom-left) always shows the current stock as **X/3**, dry or full, fog or not — a hover tooltip alone doesn't reach a phone (`js/render.js`'s `springStockBadge`; `springTip` still gives the fuller wording on hover, for a mouse). A Paladin's 3 Elixir is still six turns of holding a spring at full (three with both), but a second Paladin from the *same* spring means waiting out its regen first.
- Elixir is banked on its own (`elixir`) and pays for the top tier: **Paladin 3, Mage 2, Guardian 1, Siege 1** (`ELIXIR_COST`).
- Both kinds of tile only work for a **plain pawn** (a fortified pawn earns nothing there), and say so: until one stands on a tile, it carries a badge with **the game's own pawn, in your colour** (white or black), ringed green (spring) or gold (mine) — a knight or a fortified pawn parked there still shows it, because it earns nothing. Under fog the badge sits larger in the middle of the square, as the tile's landmark, and hovering the square explains the tile (`pawnNeededBadge`, `RESOURCE_TIPS` in `js/render.js`).
- All five are **landmarks**: a coloured dot marks each one through the fog, because both sides know where they are from the start.
- Both sides are paid the same way, automatically, so neither the built-in AI nor the trained networks need a move for it. `fortify` and `meteor` are left out of the networks' action map (`legalMap` in `rl/encoding.js`) until they are trained again. Likewise the networks see a Mage, Paladin or Guardian on the queen's, knight's or rook's channels respectively (`TYPE_ALIAS` in the same file) until they are trained with channels of their own, and Black's built-in AI's own range table (`js/ai.js`, the counter-attack and repositioning heuristics) has no case for any of the three, so it falls back to treating them as adjacent-range only when judging whether a threat is already covered. The built-in AI pays Elixir for its merges like anyone else (`bMerge` in `js/ai.js` and `js/engine.js`), so it fields a Paladin only once a pawn of its own has stood on a spring for three turns.

---

## Bishop Healing & Mana

- Bishops have a **mana** resource (max 2).
- Dragging a Bishop onto a wounded friendly unit on its diagonal **heals 2 HP** (up to max HP) and costs 1 mana. Healing only occurs when the player explicitly spends their turn on it.
- Mana regenerates: **+1 mana every 3 turns** after the bishop last healed.
- If the player did not spend the turn healing with a bishop, that bishop automatically attacks enemies within its attack range.

---

## Combat System

- **Drag-to-target**: Drag a piece onto an enemy to lock it as that piece's target (this uses your turn). You can also right-click a piece and then click a target, which doesn't use your turn.
- **Auto-attacks**: At the end of a turn, pieces with enemies in range automatically fire — except the **Paladin**, whose lance is too final to trust to auto-targeting: it only strikes a target the player has locked themselves (dragged onto, or right-clicked), and otherwise holds its ground even with an enemy in range.
- Attack damage is 1 per hit, except the Siege Tower's: 2 on the square it hits and 1 on each of the 8 around it, whoever is standing there — its own side included.
- The piece that moved or healed this turn doesn't auto-attack.
- **Targeting**: a locked target in range comes first. Otherwise a piece prefers the enemy King, then an enemy no other piece is already firing at, then the lowest-HP enemy (bishops: the King, then the lowest HP).
- You can't target enemies hidden by fog of war.

---

## Delayed Orders

An order is a move written down for later. The **Delay** button at the top of the actions panel counts
the turns: press it and the next move you make is not made — it is booked for that many turns ahead, and
the piece keeps its place, its action and its auto-attack for this turn. Several orders can therefore be
stacked so they land together (`MAX_DELAY`, `ORDER_BUDGET`, `orderCost` in `js/state.js` and `js/engine.js`).

- **The button** (`bumpDelay` in `js/actions.js`): each press adds a turn and the count comes back round
  to none, so nothing is needed to clear it. A **pawn** (fortified or not) counts up to 3 and then back
  to 0; anything else is simply **on or off**, because one order is all a whole-turn piece can give. The
  order itself is held to the same limit (`maxDelay` in `js/state.js` and `js/engine.js`): a pawn's up to
  **3 turns** ahead, every other piece's — a siege tower's roll included — **exactly 1**, so a count wound
  up for a pawn reads 1 once a knight is picked and sends it no further. The **King** takes no orders at
  all, like the Paladin, Guardian and Mage (`NO_ORDER_TYPES`). The count starts every
  turn at **0** (`orderTurns`, reset in `turnUpkeep`), and while it stands the squares the piece can
  reserve are ringed amber instead of green. An order is a move or a strike and nothing else, so while
  the counter stands **no piece merges or heals**: the Merge button greys out, a piece dropped on one of
  its own says so instead, and a bishop is not offered the choice. Setting the Delay back to 0 gives
  both back.
- **What it costs**: an **order budget** of one a turn. A pawn's order costs **half**, so two pawns can be
  sent in one turn; every other piece costs the whole of it. **With half the turn spent on a pawn's order,
  what is left of the turn is another pawn's order — a pawn with no order out yet — or nothing**: no spawn,
  move, helmet, merge, target lock, Scry, Meteor, Strip or unsiege on top of an order; each of those takes
  a whole turn of its own (the user, 2026-10-04; `ordersOnly` in `js/state.js`, the end of `legalActions`
  in the engine). Until then the other half could hold any one action, and the trained networks spent
  about 72% of their turns that way — an order plus a spawn, a move or a helmet — which was most of the
  pawn march's tempo. When the budget can no longer pay for another order **the turn passes by itself** —
  one order from a knight, or two from pawns, and play moves on without pressing Skip (`placeOrder`; in the
  engine the `order` action simply stops keeping the turn); after one pawn's order, Next turn ends it.
- **Where**: any square the piece could move to **if the board were empty** (`orderTargets`, which takes
  every other piece off and asks the ordinary movement code). An order reserves a square, not a path, and
  whoever is standing there today may well be gone by the time it comes due — so a pawn ordered onto
  another pawn does not merge with it now, it goes there later if the square has cleared.
- **Its moving turn**: the last turn a piece stands on its old square — when its order has one turn
  left, and goes off at the head of its side's next turn — it **holds its fire**: it shoots from the
  square it lands on, not from the one it is leaving (2026-10-02; `heldFire` in `js/game.js`, `holdsFire`
  in the engine). For an order one turn ahead that is the turn it is given; the earlier turns of a 2- or
  3-turn order fire as usual. One piece, one shot a turn: before this, a pawn ordered a turn ahead fired
  from its old square that turn and from its new one the next, so sending pawns by order beat walking
  them — a walked piece gives up its shot — and the trained network's whole plan was a march of helmeted
  pawns by order.
- **When it comes due**: an order counts down at the start of its side's turn and is carried out the
  moment it reaches nought — at the **head of that turn**, before its side does anything else
  (`runOrders`, from `turnUpkeep`, mirrored in the engine's `upkeep`). The move plays out where you can
  watch it, so the rest of the turn is decided on the board as it then stands. Then:
  - the square is **empty and still reachable** → the piece moves there (and the square flashes amber),
    and it **fires from its new square** at the end of that same turn, never from the one it left: the
    order lands at the head of its side's turn, so it has already arrived by the time that side's volley
    goes off (2026-10-02). Only a **Siege Tower** holds its fire that turn — it spent the turn rolling.
    (On 2026-09-28 every arriving piece was made to hold its fire; that was the wrong reading of "attack
    only after the move is done" and was put back);
  - an **enemy** stands there and it is in reach → the move becomes an **attack** (1 damage — it can
    finish a game), and that strike is the piece's **one shot** that turn: it doesn't fire again in the
    volley from the square it never left. A siege tower's ordered square is always the one beside it,
    which its shell can't reach, so an enemy there simply makes its order lapse;
  - a **friend** stands there, or the piece can no longer reach it → the order simply **lapses**, and the
    log says so.
- **On the board**: your piece with an order out keeps an amber ring, and the square it is going to shows
  a **ghost of that piece with the turns left on it** (`orderMarks` in `js/render.js`) — a 0 means it goes
  off at the end of this turn. Only your own orders are drawn; an enemy's are as hidden as the rest of its
  plans. Two orders on one square draw the one that arrives first.
- **Black orders too**: `order` is a normal action in the engine, so the built-in AI and the trained
  networks use it (`order` is left out of their action map in `rl/encoding.js` until they are trained
  with it).

---

## Fog of War

- You only see tiles within 2 squares of your own pieces — except a **Guardian**'s farther watch (3 squares) and a **Mage**'s own fire trajectories (any distance along one of its eight lines, lit by its own flame), both a standing property of the piece, not something cast (`isTileVisible`/`tileVisibility` in `js/state.js`, `visible` in `js/engine.js`).
- Tiles you've never seen are covered in solid grey. Tiles you've seen before but can't see now are under a see-through grey veil with their terrain faded: terrain shows, enemy pieces don't.
- The grey has a slight tint of each map's colour (`fogCover` in `js/scenery.js`), and the minimap shows fog in the same colours.
- **The AI has normal sight, whatever Map Cheat says** (Map Cheat is for the person at the screen). In a regular single-player game (Easy, Medium, Hard) **Black's attacks reach only tiles Black can see**: within 2 squares of one of its pieces (3 of a Guardian), lit by its own scry, or along its Mage's fire. It still *reads* where your pieces stand — the networks are handed the whole board — but a Rook or a Siege shooting 3 or 4 squares out needs a spotter beside its target or a Bishop's scry, exactly as yours do. That is why Scry matters to the AI too. Implemented in `aiSightLimited` and `visibleTo` (`js/state.js`, used by `computeActions` in `js/combat.js` and `getDragDests` in `js/movement.js`) and, in the engine, by the `aiSight` option of `newGame`; `AI_SIGHT` in `js/state.js` turns it off. The campaign, the training ground and PvP keep their own rules (the campaign's enemies still see the whole map). The AI vs AI mode gives both networks normal sight.
- **Scrying** (`scry` in engine.js, `castScry` in actions.js): a bishop may spend **both** its mana to light **any 3x3 on the board**, seen or not — scrying has no range — for its next **2 turns**. It costs the bishop's turn, like a heal, so its mana is a fork: heal 2 HP, or see nine tiles. The lit squares carry a blue ring and a countdown. To cast, tap the bishop and press **Scry** on the board (or in the panel): the whole board glows, and a tap on any square lights the 3x3 around it. A tap on the board’s edge lights the full 3x3 just inside it rather than a clipped one, and with a mouse the 3x3 is previewed before the click (`scryArea`, `scryCenterFor` in `js/actions.js`). It also sees into the jungle's undergrowth: an enemy hiding in the lit 3x3 shows up and can be hit while the light lasts. The opponent isn't told.
- **Map Cheat** turns fog off. Regular games start with it off; the tutorial and most campaign levels start with it on.
- **Meteor** (`castMeteor` in `js/actions.js`, the `meteor` action in `js/engine.js`): a Mage may spend **both** its mana to drop a meteor on a **2×2**, aimed by its **middle**: the tap picks the corner where four squares meet nearest it (`meteorAnchorFromPoint` in `js/drag.js`), and the meteor lands on those four. The corner has to be **within 2 squares of the Mage**, so every square the meteor lands on is **within 3** of it: the 2×2 has to lie inside the 7×7 around the Mage, which is lit up on the board while aiming (`METEOR_REACH`, `meteorArea` / `meteorReach` in `js/state.js` and `js/engine.js`). The reach is the same distance out in every direction, and it doesn't depend on sight — fog or no fog, and however far the Mage's fire trajectories run. A tap anywhere else just puts the meteor away, the same as tapping outside a Scry's reach. With a mouse the 2×2 it would land on is also previewed under the pointer, the same way Scry's own 3x3 is (`showMeteorPreview` in `js/drag.js`). The engine's `meteor` action names the 2×2 by its top-left square. It strikes **2 of the caster's own turns later**, dealing **2 damage to every piece on the 2×2**, friend or foe alike. From the moment it's cast, the target tiles carry a pulsing fire ring and a turn countdown, drawn through fog **for both sides** — a meteor is a bright enough warning that hiding it would be pointless — so the opponent has those two turns to clear the square or accept the hit. After it strikes, the same ground **keeps smouldering for one more turn** — cosmetic only, no further damage — the same lingering mark a Mage's own fire trajectory leaves (`flareTiles` in `js/state.js`, `s.flares` in `js/engine.js`).

---

## Zoom & Minimap

- Zoom is continuous, from the whole board (1x) up to 4x. Pinch with two fingers, turn the mouse wheel over the board, or press **🔍+ / 🔍−**; the wheel and a pinch zoom around the point under your fingers, the buttons around the middle of the board.
- When the board is bigger than its frame, drag it to slide the view (one finger, or the mouse anywhere that isn't one of your own pieces). The arrows around the board still slide it a square at a time (hold to keep going), and dragging one of your own pieces still moves that piece.
- The whole board is always drawn inside a frame that clips it, so zooming and sliding never change what the game knows; while a pinch or a drag is in progress the board is only moved and scaled, and the squares are laid out again at the new size when it ends (`applyBoardView` / `previewBoardView` / `commitBoardView` in `js/resize.js`, the gestures in `js/drag.js`).
- The minimap in the right panel shows the whole map, your fog, and a box around the part you are looking at. On phones, where that panel is hidden, the same map sits at the left of the button strip under the board at all times, so the strip never changes size; the box appears on it once you zoom in. Tapping either one jumps the view there.

---

## Turn Flow (Single-Player)

1. **White's orders come due**: the ones that counted down to nought move or strike, before anything else, and the board is left for White to read.
1. **White's turn**: Player moves/merges/spawns/heals/sets a target — or books a delayed order, which leaves the turn in hand until the order budget runs out.
2. **White auto-attacks** fire (excluding the piece that moved or healed).
3. **Black's orders come due**, newborn highlights clear and its bishops/Mages regain mana — the same start-of-turn upkeep White just had, now for Black.
4. **Black AI** takes its action (spawn, merge, or move).
5. **Black auto-attacks** fire (excluding the piece that just moved or healed) — Black used to fire *before* choosing its move instead, which meant nothing was ever excluded and it effectively got a free shot every round White never gets (fixed 2026-09-28).
6. Return to step 1, for White.

---

## AI

- **Single Player** (🌿 Easy, ⚔ Medium, 🔥 Hard): Black is a neural network trained by reinforcement learning (see Trained AI Opponents below). Easy and Medium are early checkpoints of the first training run; Hard is the network from the end of an 8-hour continuation.
  - **Easy** (update 100): beats the built-in Easy AI in about 90% of games but loses to the built-in Hard AI.
  - **Medium** (update 400): beats the built-in Hard AI in about 75% of games.
  - **Hard** (update 10,547): beats the built-in Hard AI in 99.7% of games, and the network it continued from (update 929) in 98.7%.
- **Built-in AI** (`ai.js`): the scripted opponents. They play the campaign, and Single Player turns if the trained network can't load. Easy (`easy_rook_rush`) spawns pawns, merges to knights, merges to a rook, then charges.
- **Built-in Hard AI** picks one strategy at random at game start. The strategy decides what to merge and when to spawn:
  - `pawn_troops` -- Swarm with pawns (up to 6), no merging.
  - `knight_attack` -- Merge pawns into up to 3 knights.
  - `pawn_knight` -- Up to 2 knights with pawn support.
  - `bishop_pawn` -- Build up to 2 bishops (and the knights to make them).
  - `rook_pawn` -- Climb the merge chain to a rook and a queen.
- When its strategy has nothing to merge or spawn, the built-in Hard AI moves with `hardTacticalAI`: one piece per turn, farthest from your King first so the army arrives together; pieces already in attack range hold position.
- **Campaign** uses `campaignAI`: no spawning; it repositions threatened pieces (to counter-attack or retreat), otherwise advances toward your King (or your nearest piece if there's no King).
- **Reactive behavior** (the built-in AI and Claude): When a black piece is hit and the AI cannot attack back from its current position, it either moves a piece that can counter-attack the attacker, or flees from the position under attack. The choice is random, but if the attacking piece's HP is no higher than the victim's, the AI prefers attacking.
- **Claude (optional)**: On Hard, enter an Anthropic API key in the top bar and Claude (`claude-opus-5`, via the Anthropic SDK loaded from a CDN) picks Black's action each turn instead of the trained network, guided by a strategy picked at game start (shown in the log). The reactive behavior still runs first. Refusals fall back server-side (`fallbacks: "default"`); if the key is rejected, a request fails or the reply isn't a usable action, the trained network plays that turn.

---

## Map Themes

Four selectable themes that change visuals, obstacles, ambient wildlife, and background music. Forest is the default:

| Theme | Obstacle | Neutral Animal | Aggressive Animal | Special |
|-------|----------|----------------|-------------------|---------|
| **Forest** | Trees (🌳) | Deer (🦌, 2HP) | Wolf (🐺, 1HP) | -- |
| **Jungle** | Palms (🌴, half of them drawn as water holes) and temple ruins (🏛) | Monkey (🐒, 2HP) | Snake (🐍, 1HP) | Patches of undergrowth (🌿) hide the pieces standing in them (below) |
| **Desert** | Sandstone (🟧) | Camel (🐪, 3HP) | Mummy (🧟, 2HP) | One sandstone block is a pyramid the mummy starts next to |
| **Ocean** | Sea Rocks (🪨) | Crab (🦀, 1HP) | Shark (🦈, 2HP) | A tornado (🌪, 3HP) roams and occasionally spawns an enemy 2HP pawn |

- Obstacles are **impassable** and stop bishop, rook and Siege Tower attacks. Queens and knights fire over them.
- Obstacles are placed in small clusters, avoiding the first/last 3 rows (king zones), then **mirrored through the centre of the board** so neither side is nearer to cover, to the spring or to the mine; the map always keeps a cardinal and a diagonal route between the two King zones (when one is cleared, its mirror goes with it). The jungle places its palm clumps first, then one small temple ruin, then two or so patches of undergrowth.
- **Water holes** (jungle only, appearance): a palm square is drawn either as the palm or as a water hole — muddy bank, lily pad, reeds. It is the same impassable tile either way; the square itself picks which (`scHash` in `js/scenery.js`, as the ground stickers do), so no game randomness is touched and the two can fall unevenly on a board whose blocked squares are mirrored.
- **Undergrowth** (jungle only): walkable tiles that don't block movement or shots. A piece standing in undergrowth is hidden from the other side, even one right next to it, unless a bishop of that side scries it — it isn't drawn, isn't on the minimap, and can't be targeted or attacked, by drag, right-click, a lock or an auto-attack. It can still attack out of cover, and doing so gives it away: firing from undergrowth, or taking a hit while in it (including a delayed order that arrives on its square and discovers it — below), reveals it for as long as it keeps standing on that same square (`exposedAt`, stamped wherever damage is dealt and stale-checked once a turn in `turnUpkeep` / the engine's `upkeep`). Moving to a different tile judges it fresh there: hidden again if that tile is undergrowth too, plainly visible otherwise. This applies to both sides and with or without fog (Map Cheat draws hidden pieces faintly but they still can't be hit). The rule lives in `inCover` / `isConcealedFrom` (movement.js) and `inCover` / `concealed` (engine.js), and the trained AI's observation leaves hidden pieces out too.
- **An order that arrives on a hidden enemy's square** discovers it regardless of cover and strikes it, the same as any other order that finds an enemy where it was reserved to go (`rawAttack` in `getDragDests` / `getDests`, which keeps a concealed square in for this one purpose — `runOrders` in js/game.js and js/engine.js). Every other way of picking a target still can't reach a piece it can't see.
- The board is drawn to match the pieces (`js/scenery.js`): flat rounded tiles with a thin gap, a small sticker low on some free tiles (grass, leaves and toadstools in the forest; monstera, vines, puddles and hibiscus in the jungle; dunes and cacti in the desert; ripples, starfish and coral in the ocean) and a drawing that fills each impassable tile. Which sticker a tile gets is a hash of its row and column, so a map always looks the same and no game random numbers are used.
- **Animals are switched off** for now: `ANIMALS_ON` in `js/constants.js` (and the same switch in `js/engine.js`). Map generation still draws the same random numbers for them, so boards and enemy strategies are unchanged, but nothing is placed and the roaming loop never starts. The system stays in `js/animals.js`.
- When switched on, animals roam in real time: two neutral and one aggressive per map. Any piece can attack them; aggressive animals bite adjacent pieces, and animals sometimes bump pieces aside. Campaign levels and multiplayer games never had them.

### Named maps (2026-09-28)

Single Player's pre-game screen (opened by the **Single Player** button, before **Start Game**) picks a **map** from one list, grouped Random / Curated / My Maps (`js/maps.js`):

- **Random** — one entry per theme (Forest/Jungle/Desert/Ocean), each a fresh `generateMap()` roll every game, exactly as maps always worked before this existed.
- **Curated** — five named, fixed layouts shipped with the game (Open Plains, Twin Ridges, Ironwall, The Narrows, Crossfire), each one obstacle list frozen from the same generator (so each already has a guaranteed rook path and bishop path between the two King zones) and a theme baked in — picking a map also picks its skin, there's no separate theme choice for a named map.
- **My Maps** — anything saved from **Training mode's Map tab**: build a ground there (its existing obstacle-placement brushes — pick a tile, tap the board, tap again to clear), then **💾 Save Map**, name it, and it's written to the browser's own storage (`localStorage`, key `semuncraft-custom-maps`) and shows up in this same list from then on. Only a 9x9 ground can be saved — Single Player never plays any other size.

A map only ever fixes the obstacle layout and the theme; the mines and springs, the roaming animals and everything else `generateMap()` places are exactly the same regardless of which map is chosen (`placeResourcesAndExtras` in `js/themes.js`, shared by both the random path and a fixed map's `loadMap` in `js/maps.js`).

---

## Campaign

Twelve hand-built levels in four acts, unlocked in order. Progress is saved in the browser (localStorage).

| # | Level | Board | Map | Objective |
|---|-------|-------|-----|-----------|
| 1 | The Last Three | 5x5 | Forest | Destroy the raider |
| 2 | The Narrow Pass | 3x7 | Forest | Hold the pass for 10 turns |
| 3 | The Maze | 9x9 | Forest | Walk the Queen to the far edge |
| 4 | Open War | 9x9 | Forest | Destroy every enemy piece (fog of war) |
| 5 | Desert Crossing | 9x5 | Desert | Reach the gate on the far side |
| 6 | The Mint | 9x9 | Desert | Hold the Mint floor for 10 turns — **spawning unlocks here** |
| 7 | Clash in the Dunes | 8x8 | Desert | Destroy the enemy King (no merging; armies set up as in chess) |
| 8 | Twin Forts | 11x7 | Desert | Destroy every enemy piece |
| 9 | Green Silence | 9x9 | Jungle | Destroy every enemy piece (they hide in undergrowth) |
| 10 | The Spring | 9x9 | Jungle | Walk Wren to the spring — and keep her alive |
| 11 | Island Siege | 5x9 | Ocean | Destroy every enemy piece |
| 12 | The Mirror Citadel | 11x11 | Ocean | Destroy the Mirror King |

- **Objectives** (`checkCampaignWin` in campaign.js, mirrored by `campaignResult` in engine.js, both reading only the board and the turn count): `destroy_all`, `destroy_king`, `reach` (a piece — of `reachType`, if set — stands on one of the level's `squares`), `survive` (last `surviveTurns` turns out), `hold` (stand on a goal square once those turns are up), plus `protect` (losing your last piece of that type loses the level). Goal squares glow gold on the board. A level can also place named ground with `tiles`, which is how the jungle levels grow their undergrowth.
- **Enemy behaviour** (`enemy` on a level, in both `campaignAI`s): *hunter* (the default) walks at your King, *turtle* holds the ground it was given and only answers threats (Twin Forts, Island Siege), *raider* goes for your weakest piece (Green Silence), and *net* hands Black to a trained network — the Mirror King plays the way you do, by the level's own rules (`netAiSnapshot` passes the level along).
- Whoever **started** the level with a King loses it by losing him — a level where only you have a King is not already won.
- You lose if all your pieces (or your King, on levels with Kings) are destroyed, **or if the level's turns run out**. The deadline is a rule, checked in `checkCampaignWin` (campaign.js) and mirrored in `campaignResult` (engine.js), so the engine ends a level exactly where the game does.
- **Three stars**, shown before the level and scored after it (`levelStars` in campaign.js): winning at all, winning inside `par` (well inside the deadline), and the level's own challenge — lose no piece, keep your King untouched, or beat a tighter turn count (`CHALLENGES`). The counters behind them (`campaignLost`, `campaignKingHit`) are in state.js.
- **The briefing card** (`showBriefing`) is a level's front page: where you are, two lines of dialogue, the objective with its deadline, and the three stars. Choosing a level opens it instead of starting at once, so a finished level can be read again without replaying it. Defeat says what went wrong ("Out of turns", "Your King has fallen").

### The story: The Hollow Crown

The King's Gold is stolen, so no new pawns can be minted — which is why the early levels have no spawning — and the Mirror Court, your own pieces in black, marches out of the wood. A small cast carries it (`SPEAKERS` in campaign.js, each drawn with its own piece art): the **King** (tired, practical), **Pip** the first pawn (eager, asks what the player is thinking), **Wren** the bishop (keeper of the Elixir spring) and the **Mirror King** (your words, turned cold; he speaks when you lose). A level shows at most two lines before it and one after.

---

## Playing It as a Phone App

The game installs as a home-screen app (a Progressive Web App): no App Store, no Apple account, and every commit reaches the phone by itself.

- **iPhone / iPad**: open https://chicago-wongdontrihan.github.io/SemunCraft/SemunCraft.html in **Safari**, tap **Share** (the square with an arrow), then **Add to Home Screen** (if there is an **Open as Web App** switch, leave it on), then **Add**. The SemunCraft icon opens the game full-screen, without Safari's bars.
- **Android**: open the same link in Chrome and choose **Install app** (or **Add to Home screen**) from the menu.
- **Updates**: the app loads the live site, so a new commit shows up the next time it is opened (GitHub Pages takes about a minute to publish, and a copy of the old page can linger for up to ten minutes). A game left open in the background checks when it comes back to the front, and every ten minutes, and offers **A new version of SemunCraft is ready → Reload** (`js/update.js`, which compares the `?v=` tag of the live page with its own).
- **Saved progress**: the installed app keeps its own storage, separate from Safari's, so campaign stars earned in the browser don't carry over.
- **Files**: `manifest.webmanifest` (name, start page, standalone display, colours, icons), the `<link rel="manifest">` / `apple-touch-icon` / `apple-mobile-web-app-*` tags in `SemunCraft.html` and `index.html`, and `icons/` — the White King and a pawn on a Forest board, drawn from the game's own pieces by `node img/make-app-icons.js` (it renders the PNGs with a headless Chrome or Edge). There is no service worker, so the game needs a connection; that is also what keeps every launch on the newest version.

---

## The Training Ground

A sandbox off the main menu (`js/training.js`). The board is either being **built** or being **played**,
and the palette says which — the two buttons at its top. Nothing ends here: when a king falls the log
says so and play carries on.

- **Edit**: a **tap** puts down whatever is in hand, a **drag carries the piece under it to any square**
  (the sandbox has no rules about where a piece may stand — and it carries the piece even with something
  else in hand, because a tap is how you place), and the **right button lifts** whatever is on a square —
  the unit first, the tile under it next. On an empty square a drag slides a zoomed-in board, as it does
  in a game.
- **Play**: every click is an ordinary game move again — move, merge, order, target, spawn.
- **The palette** takes the left panel's place, where the unit cards normally are, and reads at the same
  size as the Gold and Elixir counts above it. **Edit / Play** sits above everything — the Play button
  turns into **Pause** once the AI has a side, so a match can be stopped from wherever you are — and
  under it three tabs, **Units**, **Map** and **Play**, whose names the panel's header takes:
  - **Units**: a **White / Black** switch, every unit in the game (pawn, fortified pawn, knight,
    paladin, bishop, rook, guardian, siege, queen, mage, king) and a **Scarecrow**, **Default** — the
    line-up a normal game opens with, dealt onto whatever board is laid out — and **Clear units**.
    The **Scarecrow** is the sandbox's own target dummy, for trying the other units' attacks on: **5 HP**,
    on **neither side** (colour `n`, `NEUTRAL` in `js/constants.js`), so it comes out the same whichever
    colour is picked, it never moves, merges, takes an order or fires, and **both sides fire at it** —
    every "can this be hit" check asks whether a piece is anyone not of the attacker's side (`isFoe` in
    `js/constants.js` and `js/engine.js`). It takes every hit like any other piece — but the
    hit that would floor it stands it **straight back up at full health** instead (`standUp` in
    `js/constants.js` and `js/engine.js`, called wherever damage lands). Each hit floats up off it as a
    number, and the log says what it took, where that left it, and its running total (`scarecrowHit` in
    `js/combat.js`). A Paladin's lance strikes it for its full health without leaping in, since there is
    no cleared square to leap to.
  - **A side with nothing on the board skips its turn**: when the turn passes to a side with no units
    while the other side has some (the Scarecrow counts for neither), it goes straight back
    (`trainSideIdle` / `trainPassIdle` in `js/training.js`, from `trainAfterPass`, and on switching to
    **Play**), so a board of one colour plays turn after turn of that side. With both sides empty the
    turn passes as usual.
  - **Map**: the board's two sides on their own counters (**3 to 12 each way**; a new size lays out fresh
    ground with the two kings on it, since the pieces cannot follow it), the four **maps**, and the
    ground itself: the **Elixir spring**, the **gold mine** and the map's own tiles, the impassable ones
    carrying a no-entry mark.
  - **Play**: **AI White** and **AI Black**, **which AI** they are (Easy, Med, Hard — the same trained
    networks Single Player uses — or Bot, the engine's built-in one, which needs no download), how fast
    it plays (**Speed 1× to 8×**, off the same 700 ms beat an AI vs AI match keeps, and on a single timer
    so the turns cannot stack up), and the two purses: **Gold** and **Elixir** for the side in hand, with
    a **∞ Purses** switch that fills both and empties them again.

  An **eraser** and **Drop brush** sit at the foot of every tab. Pick something and tap a square, or drag
  it from the palette onto the board. A unit replaces whatever stands there, a tile is taken away by
  tapping it again, and only one king a side: placing another moves it.
- **Changing the map** changes only the look. Every unit keeps its square, the spring and the mine keep
  theirs, and each obstacle becomes that map's own kind: a tree turns into a palm, a dune, a sea rock.
  Anything the new map has no name for (the jungle's undergrowth, elsewhere) is cleared away, and its
  animals do not follow it. The music does, so the jungle's piphat starts as soon as the jungle does.
- **The AI can take a side** — or both, which plays a match out of the arrangement you built. Both the
  networks and the built-in bot play Black, so White's turn is handed to them on a board with the colours
  swapped; the move that comes back is played through the game's own handlers, exactly as a tap would be
  (`trainAiTurn`, which fetches `js/engine.js` and the chosen model on demand, and lets the built-in bot
  stand in while a network is still coming).
- **With one side yours and the fog on**, the board stays at **your** view while the AI takes its turn:
  `viewColor()` (js/state.js) is the side the AI has *not* taken, and the fog, the explored squares and
  the board's own marks all follow it rather than the side to move.
- **With both sides the AI's and the fog on**, the view follows whoever is to move (`viewColor()` falls
  through to `myColor()`, which is `turn` in training) — so a merge's own turn doesn't hand over, and the
  view with it, until its flash has actually finished playing (`MERGE_ANIM_MS` in js/constants.js; the
  same beat the `knightLJump` case, which keeps the turn, has no reason to wait for).
- **Both sides' resources** are on show here, as they are in an AI vs AI match — a game shows only your
  own. Each colour keeps its own Gold, its own turn count and its own spawn ledger (`turnsOf`,
  `spawnLedger` in `js/state.js`), so one king spawning does not empty the other's purse.
- **The window stays filled** whatever shape the board is: the panels keep the height the screen gives
  them, and a wide, shallow board sits in the middle of that rather than shrinking the whole UI into a
  strip (`resizeBoard` in `js/resize.js`).
- On a phone the palette wraps into the strip above the board rather than disappearing with the cards.
- The fog is lifted at the start (Map Cheat is on) — a sandbox with fog over it would hide its own
  experiment — and the ordinary panel, resources, merges, orders and auto-attacks all behave exactly as
  they do in a game, because it *is* the game with the AI taken out (`myColor` returns whichever side is
  to move, `endTurn` hands over the way it does in multiplayer, and the turn button says whose turn it
  is passing on).

---

## Multiplayer (PvP)

- Uses **PeerJS** (WebRTC) for peer-to-peer connections, with public STUN/TURN servers so players on different networks can connect.
- The host shares their peer ID and the other player pastes it to join. A **BroadcastChannel** lobby also lists rooms open in the same browser.
- Host plays White and deals the board (pieces, terrain and theme); guest plays Black.
- Each turn, the player acts, that player's pieces auto-attack (excluding the piece that moved or healed), and then the game state is sent to the opponent. Each side fires once per round.
- Fog of war applies to both players.
- **Play On** (on the game-over card of a plain game — not a campaign level, a PvP match or AI vs AI): the game is decided, but the board is still there. It hands the turn back to White and the pieces fight on without the king that fell; nothing else ends a plain game, so it runs until the other king goes too, and then you can play on again (`keepPlaying` in `js/game.js`). With no king of your own, Spawn is greyed out.
- **Rematch** deals a new board from the host; a guest's Rematch asks the host for one. Going back to the menu ends the match.

---

## Audio

- **Medieval BGM** (`js/music.js`): each map theme has its own dance tune in a medieval mode -- a lively D Dorian estampie (forest), a slow E Phrygian lament (desert) and a lilting 6/8 A Aeolian carol (ocean) — the jungle plays something else entirely (below). A small synthesized band plays it: recorder, shawm, fiddle and harp take turns on the melody over lute chords or harp arpeggios, a bass, a drone and bells, with a pop drum beat: kick, a snare backbeat and hi-hats (on the beat in the quieter section, every eighth note in the fuller one), tom fills at section ends and crash cymbals on section starts. The dance's two sections trade instruments each time the tune repeats, and repeats add ornaments and a second voice a fifth below. No audio files needed.
- **SFX**: All sound effects are synthesized in real-time (move, attack, hit, heal, win, lose, etc.).
- **Piece voices** (`PIECE_VOICES` in `js/audio.js`): every piece type has its own voice, heard when one arrives (a spawned pawn, a merged piece, the rooks of an unsieged tower) and, sinking, when one falls: a squeaky pip for the pawn, hoofbeats and a whinny for the knight, chapel bells for the bishop, a stone thud and a low horn for the rook, a trumpet fanfare for the queen, a deep horn over a drum for the king and iron clanks with a cannon boom for the siege tower. Both sides' pieces use them, and every heal (a bishop's drop, a locked heal at the end of the turn, Black's heals) plays a warm, rising healing chime.
- **The music starts with the app** (`bgmAutoStart` in `js/audio.js`, called on load): it plays over the title screen, not from the first game, and follows the map theme picked there. A browser only lets sound out after the page has been touched — always so on a phone — so when the audio is held back it starts on the first touch, click or key anywhere, the title screen's own buttons included; notes scheduled meanwhile wait silently, because a held context's clock doesn't run. Coming back to the app resumes the tune, since a phone suspends audio in the background.
- **The jungle’s piphat** (`thaiPhrase`, `THAI` in `js/music.js`): the jungle left the band for a Thai ensemble. Its tuning is **seven equal steps to the octave**, as Thai instruments are tuned, so every degree falls between the Western ones — that, more than the notes, is what makes it sound Thai (`tuning:'equal7'`). A **khong wong** gong circle carries the melody a note to the beat, a **ranat ek** runs above it on hardwood bars in octaves and neighbours, a **pi nai** reed holds a line over every fourth beat, the **ching** keeps time (ringing on the weak beats, damped on the strong), and **klong** drums play the cycle under it. There is no drone and no harmony: `bgmSetDrone` fades the hurdy-gurdy out for this map and back in for the others.
- Volume controls for BGM and SFX are available in the settings modal.

---

## Tutorial

An interactive 7-step tutorial:

1. **King & Pawn** -- spawn a pawn from the King, move and attack with it, then merge Pawn + Pawn = Knight
2. **Knight** -- L-shape movement and attacking, then merge Pawn + Knight = Bishop
3. **Bishop** -- diagonal movement, attacking and healing with mana, then merge Knight + Knight = Rook
4. **Rook** -- cardinal movement and piercing attacks, then merge Rook + Rook = Siege Tower
5. **Siege Tower** -- let it fire at a distant queen, then un-siege it back into two rooks
6. **Queen** -- merge Knight + Bishop = Queen, then move and attack with it
7. **Tutorial complete** -- starts an Easy game

---

## UI Layout

- **Campaign menu**: the level list is sized from the same `--tw` (title width) the main menu uses, so its names, numbers and stars scale with the screen and read at the menu’s size rather than at a fixed 10–13px.
- **Title screen**: the SemunCraft title over a war scene drawn from the game's own pieces, including the combined-unit designs (Guardian, Paladin, Mage) and cannons: *Battle Lines* on wide screens (two armies on a rolling checkerboard field, each king on its castle roof) and *The Clash* on tall ones (the armies meeting with spears, cannonballs and smoke). The scenes are `img/title-wide.svg` and `img/title-tall.svg`, drawn by `node img/make-title-wallpapers.js`. The menu sits on a translucent card and scales with the screen.
- **Design** (the `--leather-*`, `--gold*`, `--parch*` and `--btn-*` tokens at the top of `SemunCraft.html`): everything outside the board is one system — leather panels in the map's own colour behind a gold frame, section headers on gold ribbons with a notched foot, bevelled plaque buttons (solid gold for the main one on a panel), and sunken boxes for anything that shows a value. A map theme only re-sets the tokens, so the panels, bars, buttons, popups, the settings card, the tutorial card and the overlays all follow it. Button icons are drawn in one line style in `UI_ICONS` (`js/ui.js`) and requested with `data-icon`, so no button falls back to an emoji.
- **Font**: all UI text uses Lilita One (`fonts/LilitaOne.woff2`, SIL Open Font License in `fonts/OFL.txt`) through the `--ui-font` variable; room/peer IDs and the API key field stay monospace so similar characters stay distinct.
- **Top bar**: Game title, optional Anthropic API key (Claude plays Black on Hard), status text, turn counter, and ⚙ Audio settings.
- **Left panel**: The Gold and Elixir counters and paginated unit reference cards (in the training ground the cards give way to the unit palette) (the fortified pawn has a card of its own). The counters are measured after every render (`fitResources` in `js/ui.js`): the panel first takes any width the board isn't using, then the line shrinks a step at a time, and the names go before a number could ever be cut.
- **Resources** (`renderResources` in `js/ui.js`): **Gold** is what the King spends to spawn pawns and what fortifying costs (8 to start, a sixth a turn, a sixth more while a pawn holds the mine, 1 each, so the count is often a fraction), and **Elixir** is what a pawn draws from a spring — a bishop’s mana is its own heal charge, not this. On desktop each resource has **a line of its own** — icon, name, count, and for Gold this turn’s income (+0.17, lit gold and higher for every mine held), and for Elixir the springs held — and AI vs AI shows White and Black in two columns. On a phone the two sit side by side in the strip above the board, which stays one line.
- **Center**: The game board with HP pips, bishop mana pips, coordinate labels, and pan arrows when zoomed in (the board can also be dragged to slide it).
- **Right panel**: **Menu | Settings** at the top (where the move hint used to be — Settings opens the audio card, so a game needs no ⚙ button of its own; the fixed one stays on the title screen), then the **Delay** counter — a block one and a half columns wide and two rows tall, pressed often when it's up — then the action buttons, then Map View (minimap, zoom, Map Cheat). **The rest of the panel holds only what the piece in hand can do** (`syncPieceButtons` in `js/ui.js`, called from every render): **Spawn** only while the King is up, **Fortify** only for a plain pawn, the piece’s own action (**Scry (2)** for a bishop, **Meteor** for a Mage) only when it has one, **Delay** only for a piece that could take an order (or already has one standing, so it can still be cleared back to 0 — `canOrder(selIdx)||orderTurns>0`, the same condition the on-board chooser uses), **Merge** while a merge is ready, and the turn button (**Next turn**, or **End White's turn** in the training ground) always. Nothing is shown greyed out for a piece it does not belong to. AI vs AI swaps the player’s buttons for Pause, Speed and New Match.
- **Bottom bar**: Game log and an AI "thinking" indicator dot.
- **Mobile**: In portrait, the resource counters become a strip above the board, kept to one line (two in AI vs AI would push the board down; AI vs AI's own White/Black AI picker is the one row it adds under the strip), and the status line is clipped to one line for the same reason and the buttons wrap into finger-sized rows below it (unit cards, minimap and hint are hidden). The status line wraps, and the board keeps its full size when zoomed in: the pan arrows are hidden (drag the board instead) and the small map in the button strip below shows where the view is. A double tap never zooms the page (the board has its own pinch zoom). On short landscape screens the side panels shrink and the layout is centered. Touch devices get touch wording (tap a siege tower twice instead of right-clicking).

### Controls

- Drag a piece onto a highlighted tile. On touch screens you can also tap a piece, then tap a tile.
- Click the King, then an adjacent tile, to spawn. The King opens an on-board **Spawn / Move** chooser.
- Dropping (or tapping) a bishop onto one of your knights asks **Heal** or **Merge → Queen** (onto a rook, with the Elixir: **Merge → Mage (2 Elixir)**) on the same kind of on-board chooser (`showDropChoice` in `js/actions.js`); a tap anywhere else puts it away.
- Tapping one of your pawns or bishops opens the same kind of chooser for it: **Fortify (1 Gold)** while it is a plain pawn, **Scry (2 mana)** for a bishop (`syncPieceChooser` in `js/actions.js`). It sits past the piece’s reach (a pawn’s 3x3, a bishop’s 5x5) on its own side of the board, so it never covers a square the piece can act on. The side panel’s buttons follow every tap too (`syncPieceButtons`, called from `render`).
- **Delay**: press **Delay** until it shows the number of turns you want, then move a piece as usual.
  The same counter sits on the board beside whatever piece is in hand (and on the King's own chooser), so
  it need not be reached for across the panel — the move is written down instead of made, and your turn is still yours until the order budget runs out. Pressing past the last turn comes back to none (`bumpDelay`, `placeOrder` in `js/actions.js`).
- Select 2-3 pawns/knights (click them, or drag a box over them from an empty tile) and drag one to move them together.
- Right-click a piece, then click a target, to lock a target. Right-click (or tap twice) a Siege Tower to un-siege.
- **Esc** clears the current selection.

---

## Project Structure

The codebase is split into functional files for maintainability. All JS files use classic `<script>` tags (no ES modules), so it works via `file://` with a double-click.

```
SemunCraft/
  SemunCraft.html       -- Entry point: HTML structure, CSS, loads all scripts
  index.html            -- the site root: opens SemunCraft.html
  manifest.webmanifest  -- makes the game installable on a phone's home screen
  icons/                -- the app icons (SVG sources and PNGs), from img/make-app-icons.js
  SemunCraft_Explained.md
  arXiv/
    SemunCraft_old.html -- Original single-file version (untracked backup)
  pieces/               -- Piece artwork, one set per map theme
    pieces.js           -- pieceSVG(): piece silhouettes, team colours with per-type tints,
                           outline/halo, faces
    forest.js           -- forest colours and ground (grass, flower)
    jungle.js           -- jungle colours and ground (monstera leaf, hibiscus)
    desert.js           -- desert colours and ground (sand, cactus)
    ocean.js            -- ocean colours and ground (ripples, bubbles)
    preview.html        -- gallery of every set plus a solid-silhouette check
  js/
    constants.js        -- Board dimensions (COLS/ROWS, 9x9 by default), coordinate helpers
                           (idx, ROW, COL, adj8, kJumps), range functions, piece glyphs & stats
    state.js            -- Global state: game state (pieces, turn, over), spawn quotas, drag
                           state, viewport, fog of war, campaign, PvP and AI state, piece cards
    audio.js            -- Web Audio API: audio context, all SFX (spawn, attack, merge,
                           heal, etc.), volume controls
    music.js            -- Medieval background music: per-theme tunes played by a synthesized
                           band (recorder, shawm, fiddle, harp, lute, bass, drone, bells)
                           over a drum groove (startBgm, stopBgm)
    movement.js         -- isTileBlocked(), getDragDests() (valid moves/merges/attacks/heals
                           per piece), BFS pathfinding (stepToward, getPath), queenRange()
    themes.js           -- THEMES object (forest/jungle/desert/ocean tile types, colors, animals),
                           selectMap(), generateMap()
    scenery.js          -- tileArt(): the sticker drawn on each board tile (scenery on free
                           tiles, a full drawing on impassable ones)
    render.js           -- render() (rebuilds the visible board DOM: fog, action guide, highlights),
                           sqElAt(), flashSq(), spawnFlash(), mergeFlash()
    combat.js           -- sqCenter(), attack animations (emoji projectiles, the pawn's
                           sword swing, SVG cannonball), computeActions() (auto-targeting),
                           executeActions(), applyActions(), showDeath()
    animals.js          -- Neutral animal system: startAnimalLoop(),
                           updateAnimals() (roaming, biting, pushing pieces),
                           renderAnimalOverlay(), mummy SVG builder
    actions.js          -- Player action execution: executeDrop() (move/merge/attack/heal/
                           group move), handleClick() (king spawn, selection, tap-to-move),
                           doSpawn(), doMergeAll(), doSkip(), animatePieceMove(),
                           targeting (right-click, unsiege)
    ui.js               -- syncUI(), addLog(), setStatus(), showMoveHint() (Easy mode),
                           renderPcCards(), game over / rematch / menu, Map Cheat toggle,
                           zoom and pan buttons, renderMinimap()
    tutorial.js         -- 7-step interactive tutorial: TUTORIAL_STEPS array, tutBoard(),
                           tutCheckAction(), startTutorial(), tutAutoNext()
    campaign.js         -- CAMPAIGN_LEVELS, level select, startCampaignLevel(),
                           checkCampaignWin(), handleCampaignEnd() (stars, saved progress)
    pvp.js              -- PeerJS multiplayer: myColor(), isMyTurn(), broadcastState(),
                           onPeerData(), lobby (host / find rooms / join by ID),
                           BroadcastChannel discovery
    ai.js               -- Black AI: aiAct() (who plays Black's turn), pickStrategy(), the
                           built-in AI (Hard build orders strategy_*, easy_rook_rush,
                           hardTacticalAI(), reactiveAI(), campaignAI(), fallbackAI()) and
                           the optional Claude opponent (askClaude, applyBlackMove)
    game.js             -- Core game flow: startGame(), initGame(), startWhiteTurn(),
                           turnUpkeep(), endTurn() (single-player: white attacks -> black
                           attacks -> AI turn; PvP: mover's attacks -> send state),
                           finishBlackTurn()
    drag.js             -- Input handling: mouse/touch drag listeners on the board,
                           box selection (multi-select pieces), ghost element
    resize.js           -- resizeBoard() (responsive desktop/mobile layout), window
                           resize/load/keydown event listeners
    engine.js           -- Headless rules engine: the same rules with no DOM or timers and
                           seeded randomness, for AI training, tests and the trained AI (see
                           Headless Engine below)
    nn.js               -- the trained policy network in plain JavaScript; runs the weights
                           in models/
    netai.js            -- trained AI: loads the engine, network and weights when needed and
                           plays Black's turn in Single Player (see Trained AI Opponents below)
    aivsai.js           -- AI vs AI mode: watch the two most-trained networks play (see
                           AI vs AI below)
    update.js           -- offers a reload when a newer version is live (the phone app)
  models/               -- trained networks for the browser, written by rl/export_web.py
    easy.js, medium.js  -- early checkpoints, played by the Easy and Medium difficulties
    ai-1.js, ai-2.js    -- the two most-trained networks (Hard plays ai-1)
  rl/                   -- Reinforcement learning environment (see Reinforcement Learning
                           Environment below)
    encoding.js         -- board -> network input planes and network output -> engine
                           action, seen from one side, in two versions (1: the networks in
                           models/ today, 2: the current rules); also loads in the browser
    worker.js           -- Node process running games for Python (JSON lines on stdin/stdout)
    scripted.js         -- hand-written opponent for training and testing a network (see
                           Scripted Opponent below); loads in Node or as a classic script
    levels.js           -- reads the campaign levels from js/campaign.js for Node tools
    semuncraft_env.py   -- SemunCraftVecEnv: many games stepped at once across workers
    ppo.py              -- policy/value network and masked PPO (PyTorch); also a quick
                           learning check
    train.py            -- curriculum and self-play training with checkpoints and
                           evaluation games (see Training below)
    export_web.py       -- exports trained networks to models/ and checks js/nn.js against
                           PyTorch (see AI vs AI below)
    test_env.py         -- Python tests and speed benchmark for the environment
    test_ppo.py         -- PPO tests and a policy-head speed benchmark
  tests/                -- Node.js tests for the engine, the RL encoding and the network
    original-game.js    -- loads the game's rule scripts in Node with a fake DOM and a
                           virtual clock
    parity.test.js      -- plays identical games through the original code and the
                           engine and compares the state after every action
    netai.test.js       -- Single Player games with Black's moves applied by js/netai.js,
                           compared with the engine after every turn
    engine.test.js      -- determinism, rule invariants and speed of the engine
    encoding.test.js    -- action indices, the rotated view for Black, observation
                           planes and the worker protocol
    nn.test.js          -- js/nn.js against PyTorch, run by rl/export_web.py
```

### Headless Engine

`js/engine.js` holds the game rules without the browser: no DOM, no timers, and all randomness drawn from a seed stored in the game state, so games can be simulated fast and replayed exactly. It loads as a classic script (global `SemunEngine`) or in Node (`require('./js/engine.js')`). The regular game still runs its own rules: the engine runs AI vs AI and applies the trained AI's moves in Single Player, and the parity tests keep the two in step.

```js
const E = require('./js/engine.js');
const s = E.newGame({ seed: 42, mode: 'pvp' }); // also: difficulty, theme, level, fog, aiSight, maxTurns
const actions = E.legalActions(s);              // [{ type, from, to }, ...]
E.step(s, actions[0]);                          // applies it plus any end-of-turn attacks; returns events
E.botTurn(s);                                   // classic mode only: Black's turn by the built-in AI
const copy = E.clone(s);                        // fully independent, down to a piece's pending order
// a state rebuilt from the browser game's variables (js/netai.js), and one action applied without
// the attacks that follow it; continues is true when the same side moves again (knight L-jump merge)
const t = E.fromSnapshot({ cols: 9, rows: 9, board, tiles, turn: 'b', turnCount, spawns, targets, hitBy, acted });
const { events, continues } = E.act(t, E.legalActions(t)[0]);
```

- **Modes:** `classic` is the single-player order (White acts, White fires, Black fires, Black acts). In `pvp`, each side acts and then its own pieces fire, the same for both colors, which suits self-play.
- **Actions:** `move`, `merge`, `target` (lock onto an enemy), `heal`, `healLock` (a bishop dropped on a wounded adjacent knight, choosing Heal), `spawn`, `unsiege` and `skip`. After a knight's L-jump merge the same side moves again.
- **Built-in AI:** Easy, the five Hard strategies and the campaign AI are ported with their quirks and draw random numbers in the same order as `ai.js`.
- **Not modelled yet:** animals, group moves and free right-click targeting. The engine also refuses spawns in campaign levels; the game only disables the Spawn button there, so clicking the King still spawns.
- **Tests** (need Node.js, not the game): `node tests/parity.test.js [seeds] [section]`, `node tests/netai.test.js [games]` and `node tests/engine.test.js [games]`. Random self-play runs at about 90,000 actions per second on one CPU core.

### Reinforcement Learning Environment

`rl/` turns the engine into a training environment for Python. Games run in Node worker processes (`rl/worker.js`, found on PATH, in `%LOCALAPPDATA%\Programs\node-v*-win-x64`, or through `SEMUNCRAFT_NODE`), and `rl/semuncraft_env.py` steps many of them at once. The Python side needs only NumPy; `rl/ppo.py` also needs PyTorch.

```python
import numpy as np
from semuncraft_env import SemunCraftVecEnv, sample_legal

rng = np.random.default_rng()
with SemunCraftVecEnv(num_envs=64, config={"mode": "classic", "levels": [0, 1]}) as env:
    obs = env.reset()                    # (64, 54, 11, 11) float32 in [0, 1]
    masks = env.action_masks()           # (64, 19240) bool, True = legal
    obs, rewards, dones, infos = env.step(sample_legal(masks, rng))
```

- **Turn order and opponents:** `mode` picks the turn order: `"classic"` is the single-player order (each side acts, then fires, its mover excluded — Black used to fire before acting until 2026-09-28) and `"pvp"` the networked one. `opponent` is `"bot"` (the built-in AI; classic only, with the agent on White; set `difficulty` or campaign `levels`), `"scripted"` (`rl/scripted.js`, below: either colour in either mode, standard games only), `"random"`, or `"external"`: a Python function `(obs, masks, env_ids) -> actions` that picks the other side's moves, such as a copy of the network for self-play. `on_new_game(env_index)` runs whenever a game starts, for example to choose its opponent. Against a random, scripted or external opponent, `agentColor` picks the agent's side (random by default) and `agentBlack` how often a random side comes out Black (0.5 by default; training uses 0.67, because the game's AI plays Black). `blackOrders: false` takes Black's delayed orders away in the classic order (the agent's and its opponent's, scripted or a network; White's stay), for the reason under Training. Classic games default to the bot, pvp games to a random player.
- **Sight:** `aiSight` (on by default) gives every side normal sight: its attacks, its target locks and its Meteors reach only what it can see (within 2 squares of one of its pieces, 3 of a Guardian, lit by a Scry, or along a Mage's fire), fog or not. The observation still shows where the enemy stands (`fog` is what hides pieces); the **visible** plane shows the side's real sight, so a network can learn to spot and to Scry. Campaign levels keep their own rules.
- **Encoding versions** (`rl/encoding.js`): a network is played in the version it was trained on. **Version 2** (the latest, the default everywhere) covers the current rules; **version 1** is what the networks in `models/` today were trained on, kept so they still play. `createEncoder({version})` picks one; the worker takes `encoding` in its `init` message (`SemunCraftVecEnv(..., encoding=)`) and reports `channels`, `slots` and `onBoard`; `ENCODINGS` in `rl/semuncraft_env.py` lists them for Python. `rl/export_web.py` writes a network's version into its meta (`encoding`, `onBoard`), and `js/netai.js` builds the matching encoder for each model (a model without one is version 1, played with its old all-ones visible plane).
- **View:** the agent always sees the board from its own side. For Black the board is rotated 180° and own and enemy swap, so one network can play both colors. Boards sit in the top-left corner of an 11×11 grid, so every campaign level fits.
- **Observation, version 2** (54 channels): own and enemy pieces by type (22: pawn, **helmeted pawn**, knight, bishop, rook, queen, king, siege, **mage, paladin, guardian**); HP as a fraction and out of 5; bishop/mage mana; pawns that can still double-step; a Siege that rolled this turn (it doesn't fire); own pieces hidden in undergrowth; own and enemy target locks (the locking piece and the locked square); own and enemy **delayed orders** (the piece and the square it's headed for, by turns left); own and enemy **Meteors on their way** (by turns left); obstacles, undergrowth, **mines and springs**; board cells; the cells the side can see; own and enemy **Gold** and **Elixir**; the **order budget** left this turn; turns taken out of the cap; whether merging and spawning are allowed; whether the turn order is classic; and whether the agent moves first each round (White in the classic order, where the two sides don't take their turns the same way). Enemy pieces, locks and orders show only where the side's fog lets it see (with fog off, everywhere) and not inside undergrowth.
- **Actions, version 2** (11×11×159 + 1 = 19,240): each cell (the piece's own square) has 81 slots for "act on the square up to 4 rows and 4 columns away" — move onto an empty tile, merge with a friendly piece, lock onto an enemy, heal a wounded ally, and on the piece's own square unsiege a tower or **put a helmet on a pawn**; then "spawn a pawn here", "**Scry** the 3×3 centred here", "**Meteor** on the 2×2 whose top-left corner (as the side sees the board) is here", and 75 **order** slots, 5×5 destinations for each delay of 1–3 turns (every piece that takes orders moves at most 2 squares). The last index is skip. A bishop on a wounded adjacent knight means heal; to get a Queen, merge the knight onto the bishop. A Scry or Meteor names only where it lands: if two casters could cast it, the one with nothing to shoot at this turn casts it, then the nearer. Only a target lock more than 4 squares away has no slot. Mask out illegal actions.
- **Version 3** (2026-10-03, the latest; 55 channels, 11×11×160 + 1 = 19,361 actions): version 2 with one channel and one slot more, both at the end so a version-2 network's weights keep their places — channel 54 marks a pawn whose helmet a bishop **stripped** (own or enemy, where the side sees it), and slot 159 of each cell is **"strip the helmet on this square"**, named like a Scry by the square it acts on (when two bishops could strip the same helmet, `legalMap` picks one the way it picks a caster). `upgrade_state` in `rl/ppo.py` grows a version-2 network into it: the new channel's weights start at nought, so it plays exactly as it did, and the Strip slot starts with nought weights and the average bias of the 81 offset slots, an ordinary action's odds. `rl/train.py --resume <v2 checkpoint> --to-encoding 3` does that, starts Adam over, and grows the league's older snapshots the same way as they load. Version 2 stays for the networks trained on it.
- **Version 1** (32 channels, 11×11×82 + 1 = 9,923 actions): 7 piece types (a Mage, Paladin or Guardian shows on the queen's, knight's or rook's channel, a helmeted pawn as a pawn), no Gold/Elixir/tiles/orders/Meteor planes, and no slots for Scry, orders, helmets or the Meteor.
- **Rewards:** +1 for a win, −1 for a loss, 0 for a draw at `maxTurns` (both sides' turns together, 300 by default). `shaping` adds a potential-based bonus for material (what each piece costs now, in Gold with an Elixir as one, × its health) and King health. Gold and Elixir in hand count for nothing, so spending them — a spawn, a helmet, a top-tier merge — reads as a gain and the shaping pushes the army to be built. (The first version-2 run counted them, which made buying neutral and hoarding rewarded, and that network hardly built anything.) With `gamma` set to the learner's discount it doesn't change which play is best.
- **Tests:** `node tests/encoding.test.js` checks, for both versions, that every legal action gets an index that decodes back to it, that Black's rotated view matches White's view of the mirrored board (orders, Meteors, Scry, Gold and Elixir included), the observation planes, and the worker protocol. `python rl/test_env.py` tests the Python side, checks `ENCODINGS` against the worker, and measures speed with random actions (64 games on 16 workers): about 8,600 agent moves per second against the built-in AI and about 2,000 against the scripted AI, whose turns take ~3.5 ms each. `python rl/test_ppo.py` tests the PPO pieces on both network shapes.
- **Learning check:** `python rl/ppo.py --levels 0 --minutes 5` trains a small convolutional network (4 residual blocks, about 320,000 parameters) with masked PPO and prints its win rate as it goes. With 64 games in parallel on an RTX 4080 it trains at about 8,000 moves per second. On Pawn School the win rate went from 4% to 100% in about 40 seconds. In the standard game against the Easy AI (`--difficulty easy --shaping 0.5 --minutes 10`) it went from 2% to over 90% in under 2 minutes, and from about 4½ minutes on it won 99–100% of games, in about 19 moves each. The Easy AI is a simple scripted rush with little defense, so this shows the setup learns, not that the agent is strong.

### Scripted Opponent

`rl/scripted.js` (global `SemunScripted` in a browser, or `require` in Node) is a small hand-written player for measuring a trained network and, if wanted, for training against. It is **not** the campaign AI in `ai.js`, which keeps playing the campaign and Single Player fallback. It carries no rules of its own: every move it considers comes from `legalActions`, and each is judged by playing it on `E.clone(state)` with `E.step`, once for the move and again after the opponent passes (so it sees what its move leaves in the enemy's reach, a Siege shell's splash on its own pieces included). When a rule changes (a range, a splash, a price, the spring rate), what it sees changes with it; only the constants at the top of the file are judgement calls.

- **What it values**, in Gold: each unit at about what it costs to make (scaled by its health), the two Kings' health, Gold and Elixir in hand (an Elixir counts as a Gold up to a Paladin's 3 and hardly at all beyond, so a spring's income is there to be spent), and every mine and spring a plain pawn holds. Springs come first: at `ELIXIR_RATE` 0.5 a spring pays three times what a mine pays — a dry one (its own reservoir spent, `s.springs`) only a quarter of that, worth holding but not fighting for until it refills. Free pawns walk to a tile nobody holds; the rest of the army closes on the enemy King, harder as the game goes on and harder still with a material lead already in hand (2026-09-27: without the lead term, a big enough lead had nothing pulling it toward the kill, and every spawn paid for itself in raw material regardless, so a dominant position could just keep spawning and merging instead of finishing — against the trained network this meant draws in about half its games, at 200+ turns each; with the lead term, those became mostly wins instead, in fewer turns). Two of its pieces side by side that could merge into something dearer are worth half the merge's gain, **each piece in one such pair only**: counted per pair, a block of four Knights made merging look like losing five other pairs, and it built almost no Paladins. A Meteor still on its way counts against whoever stands under it, either side.
- **Normal sight:** it has the sight of a player with Map Cheat off, and no more. It reads the whole board it is handed, but the engine lets a side with `aiSight` attack only what it sees, so a Rook or Siege firing 3 or 4 squares out needs a spotter next to the target or a Scry. `playTurn` switches `aiSight` on for the side it plays, and `chooseAction` plans as if it were on. It Scrys only a 3×3 with an enemy it can't see in it, and judges the Scry by what its pieces then hit at the end of the turn. It picks up the Rook → Siege / Guardian / Mage chain because a helmeted pawn (`FORTIFIED`, 2.6) and a Rook (4.2) are priced to make it worth building.
- **Delayed orders:** a pawn's order costs half the turn's budget; the Siege, which moves no other way, is ordered too. An order is judged by what it changes once the turn is over and the opponent has passed (`afterPass`). Until 2026-10-04 the other half of the turn was free, so most turns a pawn walked a square on its order while the King spawned or two pieces merged (about 50 orders a game), and an order went first when it gained more than `ORDER_GAIN` over not giving it. Since the other half can go only on a second pawn's order, an order on a fresh turn gives up the turn's move, spawn or merge: the two best orders from different pawns, their gains added, must beat the best ordinary action by `ORDER_GAIN`, and with half the turn spent an order only has to beat passing. It orders far less now (about one turn in twenty against a random player, mostly two pawns at once). The same day Knights & Paladins got `eco` 2.2 and `seek` 2 (from 1.8 and 1.4): with one action a turn its Knights won before the Elixir for a Paladin came in, in 7 of 12 games against Hard; holding the springs harder brought Paladins back in 9 of 12, all 12 won. Only one-turn orders are given, and only for pawns and the Siege: any other piece's order takes the whole budget and would be a slower way to make a move it can make now.
- **What it leaves out:** campaign objectives, `unsiege`, heal-locks, target locks (except the Paladin's, which fires on nothing else), longer orders, and moving its King — unless an enemy piece is within two squares of it.
- **Strategies (2026-10-02):** each game it draws one of eight strategies (`PROFILES`, `pickProfile`) and keeps it to the end, so it no longer builds helmets and Rooks and marches every game. A strategy only reweighs the same evaluation: `tech` leans toward its own line of units (and below 1 against what it isn't), `only` names the top-tier units (Queen, Paladin, Guardian, Mage, Siege) it will merge into at all, `eco`/`seek` how hard it holds mines and springs, and `onset` (drawn per game from a range) the turn before which it builds rather than attacks — or until its army reaches `armyGoal`; `guard` keeps pieces home until then. Measured against the old built-in Hard AI, 10-12 games each:

  | Strategy | What it fields | First strike | Tiles held |
  |---|---|---|---|
  | Balanced | the original: helmets, Rooks, a Siege (what any caller gets when it names no strategy) | turn ~6 | 0.5 |
  | Rush | helmets, Rooks, some knights, all forward from turn 1 | turn ~7-16 | 0.2 |
  | Knights & Paladins | ~3 knights, ~2.6 Paladins | turn ~26 | 1.8 |
  | Bishops & Mages | ~2 knights, ~2 bishops, ~2 Mages, few Rooks | turn ~27 | 1.6 |
  | Queens & Bishops | knights, bishops, queens (~0.7 a game) | turn ~22 | 1.0 |
  | Rooks & Sieges | Rooks and ~2 Sieges | turn ~22 | 1.1 |
  | Rooks & Mages | ~3 Rooks, ~1.7 Mages | turn ~28 | 1.4 |
  | Fortress | holds the tiles, then Sieges, Paladins, Guardians, Mages, and comes with everything late | turn ~52-61 | 2.4-2.9 |
  | Bishop Guard | bishops early and kept as bishops (no top tier at all), held between its King and the enemy and drawn to enemy helmets to strip them (`stripHunt`) — the user's answer to the march of helmeted pawns (2026-10-03) | late (turn 40-70) | — |

  Bishop Guard does strip: against the Rush network (`v3-strip2` update 34,556) it took off 2.2 helmets a game, in 17 games of 24 — Rush peaks at about three — but it still lost 21 of 24 (Balanced, on the same maps, 23 of 24). Two stronger versions, more bishops and a tighter guard, or a harder pull toward the helmets, lost 24 and 23 of 24: every pawn turned into a bishop is a pawn missing from the defence while the march comes on, and a bishop's strip is its whole turn. Master's one-move search may simply not be the player to show what stripping can do — but as it stands it is no answer to the march, so no network has been trained against it yet.

  In a Single Player game Master draws its strategy on its first move and says which in the log ("Master plays: Fortress"); in AI vs AI each Master side draws one per match. Leaning alone wasn't enough: judged one move deep, mid-fight, a merge's own worth is small next to everything else that move changes, so the `only` list and a "rendezvous" pull (a strategy's own top-tier ingredients drawn together from up to four squares apart) are what made the lines actually appear.
- **King defense (2026-10-02):** the network trained under the fixed turn order (`v2-turnfix`) beat every game of this AI with one early knight rush. The search had two blind spots: the King could never move, and a move that saved it looked like nothing much at the first look, so it never made the shortlist that gets the second, deeper look. `kingSafety` now counts, at every look, each enemy piece whose fire would land on its King (the engine's own `computeActions`, so a Knight standing *next to* the King — out of its own L-reach — rightly counts for nothing), the others within three squares, and up to three of its own pieces near the King against them; the King may step when pressed; and while its King is under fire the drive toward the enemy King is cut to a fifth, defend first. Against `v2-turnfix` (24 games a strategy, the network sampling at temperature 1, with arriving orders firing as of 2026-10-02 — which makes its pawn-order rush stronger), Master went from losing every game to winning most with every strategy: Knights & Paladins 22-1, Bishops & Mages 23-1, Queens & Bishops 23-0, Fortress 20-1, Rooks & Mages 19-3, Rush 18-5, Balanced 18-6, Rooks & Sieges 17-6 (wins-losses, the rest draws). Balanced and Rooks & Sieges carry `threat:1.5` because at the default they only broke even. `tests/scripted.test.js` hunts the King with a lone Knight in three setups for three strategies: the Knight dies and the King takes no hit.
- **Use:** `chooseAction(state)` for `state.turn`, `playTurn(state)` until the turn passes (like `botTurn`), `evaluate(state, colour, profile)`; both take `{orders: false}` to leave its orders out and `{profile}` for the game's strategy (`pickProfile(rand)` once a game, or a name; none at all is `balanced`). The worker's `scriptedProfile` (`"random"` by default) does the drawing per game and records it as the game's `scenario.strategy`, and `rl/train.py`'s evaluation splits its results against the scripted AI by strategy as well as by colour. In the worker, `opponent: "scripted"` plays either colour in either turn order. It is deterministic (a position-hash tie-break instead of the game's random stream) and takes about 1.5 ms a decision, 3.5 ms a turn (each candidate is played on one copy of the state, carried through its later looks).
- **Strength:** 24 of 24 against a random player in both turn orders and as either colour; against the old built-in AI as White in the classic order, about 37 wins in 40 against Easy and 35 in 40 against Hard (both sides on normal sight), a mixed army (about 2 Paladins, 4–5 Rooks, half a Siege and a Mage a game) and 3 to 6 helmets. Its Scry is rare (about 0.3 a game against Hard): most fights are inside two squares, where everyone already sees. The deployed Hard network (as Black, against it as White) wins 18 of 30 with normal sight and 18 of 30 without, so the new rule costs that network nothing measurable. Against the trained network (48 games each colour), tuning the lead term's own strength (`LEAD_PUSH`) from no pull at all up to 10 per Gold of lead: no pull won 22 and drew 26 (as White, averaging 233 turns) and won 34, drew 14 (as Black, 242 turns), with a Gold-equivalent army of about 43 (up to 92) by the time it won; `LEAD_PUSH=10` wins 43 and draws 0 (as White, 91 turns), wins 40 and draws 1 (as Black, 117 turns), with an army of about 16 (up to 30) — not just fewer draws but a smaller, faster win, because it commits once it's actually ahead instead of piling up far more force than the win needed. A gentler pull (1/6 of a turn's push per Gold, tried first) split the difference: fewer draws than no pull at all, but the army stayed about the same size (43) as never pulling, since a real opponent keeps building too and the pull only firms up once the game is already lopsided. A cap on total army worth past a multiple of the enemy's own (tried and dropped) ran into the same problem from the other side, and it discouraged perfectly good merges into a dearer piece along with it. `node tests/scripted.test.js` checks legality and repeatability, that nothing it fires on is out of its sight, a 90% win rate against a random player, no more losses than wins against the built-in AI, that it spawns, holds tiles and builds Elixir-tier units, that it Scrys a Queen a Siege could then hit, that it gives orders, two pawns to a turn and nothing beside them, that a dominant position keeps closing the distance to the enemy King rather than only building, and speed.
- **`clone` and orders:** writing it turned up that `clone` (and `fromSnapshot`) shared a piece's pending `order` object with the original, so a simulated turn counted the real order down. They copy it now, and `tests/engine.test.js` checks it.

### Training

`rl/train.py` trains one network in three stages, moving on once it wins often enough. Every game is played in the classic turn order with normal sight (`aiSight`), and a new run observes and acts in encoding version 2 (`--encoding`; a resumed run keeps its checkpoint's version, and the runs before version 2 count as version 1):

1. **Easy:** White against the Easy AI, until it wins 90% of its last 400 games. A version-2 network gets there in about 2 minutes.
2. **Hard:** White against the Hard AI (a random strategy each game), with a quarter of the games still against Easy, until it wins 75% — about a minute more.
3. **League:** most games are self-play in the single-player turn order; the rest are against the scripted AI (`--league-scripted`, 10%), Easy (`--league-easy`, 5%) and Hard (`--league-hard`, 15%). Where the opponent allows either color (self-play, the scripted AI) the agent plays Black two games in three (`--black-share`), because the game's AI plays Black, and this is where it learns to.

There is no stage against the scripted AI on purpose. The first version-2 run had one, and a fresh network cannot beat it at all: the stage ate 37 of the run's 60 minutes without a single win, and because half of those games were as Black with no win among them, the network learned to *stall* as Black — 89% draws against a random White over 290 turns, while winning 97% as White. The scripted AI stays a small league share (so there are wins to learn from) and the yardstick in evaluations. The same run also gave orders in 70–93% of its moves and hardly built an army: orders take 75 of the 159 action slots, so an untrained policy starts there. A fresh network now starts with its order, Scry and Meteor logits lowered (`SLOT_BIAS` in `rl/ppo.py`), which makes its first policy roughly even over kinds of action (orders about 19% of moves instead of 60%). That was not enough by itself: the second run (`v2-second`, 30 minutes) still gave orders in 67–81% of its moves and still stalled as Black (34% wins and 66% draws against a random White, over 250 turns, while winning 98% as White in 43 turns).

The cause is a rule of the single-player order, not the training: all orders come due once a round, at the start of White's turn (`turnUpkeep` in `js/game.js`, `upkeep` in the engine). A White pawn that arrives by order fires in White's volley that same round, before anything can shoot it. A Black pawn that arrives by order is shot at in White's volley *before* Black's volley. Built as the same position for each colour in the engine, White's ordered pawn kills the enemy pawn and then dies, and Black's just dies. Orders are a trap for Black, and a network that leans on them for White and gives Black the same policy learns to stall. (PvP is symmetric: each side's orders come due at the start of its own turn.) The rule is left as it is, and training deals with it: **Black's orders are left out at first** (`--black-orders later`, the default; `always` and `never` too), for the agent and for its opponent alike, until Black wins `--black-orders-winrate` (35%) of its self-play games over `--window` games, at least `--black-orders-min-updates` (300) league updates in, or after `--black-orders-max-updates` (3,000) league updates whatever it wins. Then they are switched on for both sides (logged as "Black may give orders now", and the `black_orders` column of `log.csv`), and the network learns where they are safe, for instance onto squares no enemy piece can hit. The scripted AI as Black follows the same switch. Evaluations use whichever rule is in force. A self-play opponent is the current network (`--latest-prob`, half the games), one of the last `--pool` (10) snapshots, or, with `--hall-every N`, a hall of fame of snapshots from every N-th update that are never dropped (`--hall-prob`). Only 4 recent snapshots and 1 hall-of-fame network are in play at a time, swapped every 10 updates (`--active-opponents`, `--refresh-opponents`), so each step runs only a handful of networks.

A stage also ends after 400 updates without reaching its win rate. Games against the scripted AI are about four times slower to simulate than against the built-in one, and every step waits for the slowest worker, so the trainer now spreads games over up to 28 workers (`--workers`; this machine has 32 cores). Shaping starts at 0.5 and fades to 0 over the first 400 league updates, leaving only win/loss rewards. The network has 6 residual blocks of 96 channels (about a million parameters) and plays 192 games at a time. On CUDA it trains in bfloat16 mixed precision with channels-last tensors, about 2.7× faster per minibatch than float32 on an RTX 4080. `--lr-end` and `--entropy-end` lower the learning rate and the entropy bonus linearly over the run's `--minutes`.

`--draw-penalty` and `--turn-penalty` (both 0 by default, `worker.js`) push back against turtling. Win +1, loss −1 and a draw worth exactly 0 leave a network with a dominant, safe position no reason to risk attacking to finish the game rather than sitting on the lead until `maxTurns` — the 8-hour `v2-long` network does this (2026-09-27): it out-builds Easy and Hard but often wins by building an army and closing in only slowly, and a game it should win can time out a draw instead. `--draw-penalty` makes a draw cost something, scaled up further by any material lead the agent still held when the turn cap was reached (a draw that was always going to be level isn't punished as hard as one it should have won) — but capped at `DRAW_FLOOR` (−0.5, half of a loss's −1): losing must always cost far more than any draw, or a large enough lead would make throwing the game away look better than a mere draw, which is backwards. (The first version of this had no cap: a lead past about 2.3 — a handful of extra decent pieces, not an extreme case — already made a draw cost more than losing outright at the recommended `--draw-penalty 0.3`.) `--turn-penalty` is a small constant cost on every one of the agent's own decisions, so winning in fewer moves is worth a little more than winning slowly. Neither touches `info["outcome"]` (still 0/1/−1) or the win-rate stats and stage promotions built from it — only the reward PPO trains on. A 30-minute check resumed from `v2-long` with `--draw-penalty 0.3 --turn-penalty 0.005` cut its draws against the scripted AI from 56%/47% (White/Black) to 19%/8%, and its games got shorter (244→199 turns as White, 256→142 as Black) — it stopped stalling. But its win rate against the scripted AI fell too (0%→0%, losses 42%/53%→81%/92%): 30 minutes was enough to make it stop turtling, not enough to relearn how to press the attack well, and this check run also reset the learning rate and entropy bonus to their un-annealed defaults instead of continuing from `v2-long`'s converged values (`lr` 5e-5, `entropy_coef` 0.002), which likely added noise of its own. A longer continuation should carry those forward (e.g. `--lr 5e-5 --entropy 0.003`, annealing further) rather than resetting them.

`--resource-bonus` (0 by default; `resourceBonus` in `worker.js`) pays the agent, once each of its turns, that much for every mine or spring it holds beyond the number its opponent holds, counted after the opponent has had its turn to contest them. It fades linearly to 0 over `--resource-anneal` updates (2,000 by default), counted from the start of the run — a resumed run starts it over at full weight. It exists because nothing else in the reward ever paid for the economy: once the material shaping had faded, only wins counted, and in self-play both copies of the network rushed, so a pawn sent to hold a mine was a pawn missing from the attack and was punished before the tile could pay off. After about seven hours of mostly-self-play training across two runs (2026-10-02), the network held 0.03 tiles a turn against Master's 0.42 and had never built a high-tier piece. The bonus is a temporary push to hold tiles long enough to find out what they are worth; once it is gone, the network keeps holding them only if that wins games. Every map has five resource tiles, so at the weight first tried, 0.003, holding three more than the opponent for a 50-turn game is worth about 0.45, under half a win.

`--merge-bonus` (0 by default; `mergeBonus` in `worker.js`) pays the agent for each merge it makes, times what the merge makes (`MERGE_TIER`: a Knight or Rook 1, a Bishop 2, the Queen and the top tier 3), with its next reward; unsieging a Siege takes the Siege's back, so splitting one and merging it again earns nothing. It fades out over `--merge-anneal` updates (2,000 by default) from the start of the run, like `--resource-bonus`. It was added on 2026-10-03 because the networks had stopped merging altogether — a march of helmeted pawns needs no merges — and a network that never merges never has a bishop, so encoding 3's Strip (above) went unused: in about 38,000 positions against Master the network never once had a strip to make. With it, the network made one Knight a game — from its two starting pawns, the cheapest merge there is — and stopped there, never making the Bishop. So `--bishop-bonus` (`bishopBonus` in `worker.js`) sets what a merge that makes a Bishop pays instead of its tier, fading with `--merge-bonus` over `--merge-anneal`; the run that followed used 0.4 a Bishop against 0.1 a Knight, fading over 4,000 updates. Two more bonuses fade the same way: `--strip-bonus` (`stripBonus`) pays for each helmet the agent strips, and `--elixir-unit-bonus` (`elixirUnitBonus`) for each merge that makes a unit costing Elixir, times its Elixir (a Paladin 3, a Mage 2, a Guardian or a Siege 1; unsieging takes a Siege's back). They came on the user's word (2026-10-04, "strip has not been properly used so far"), after the Queen army had shown that a bonus alone teaches a habit that lasts only as long as it pays — the march came back within about 1,500 updates of the bonus ending — and a Bishop Guard Master that stripped 2.2 helmets a game still lost 21 of 24 to the march. Weighted by Elixir, though, that bonus paid most for the Paladin, the cheapest of the four to build, and the run built Paladins and nothing else (and, once the bonuses were gone, found the Paladin's one-hit kill on the King). So `--elixir-unit-weights` (`elixirUnitWeights`) sets what each unit counts for instead — `paladin=1,siege=4,guardian=3,mage=4` with `--elixir-unit-bonus 0.25` pays a Mage or a Siege 1.0, a Guardian 0.75 and a Paladin 0.25 (the user, 2026-10-04) — and `--rook-bonus` (`rookBonus`) pays for a merge that makes a Rook, as `--bishop-bonus` does for a Bishop: a Mage, a Guardian and a Siege all start from a Rook, a Rook from a helmeted pawn, and the networks had long stopped buying helmets, so with the 3-HP Bishop they built eleven Bishops a game and stripped three or four helmets, one Rook short of a Mage every time.

```bash
python rl/train.py --minutes 60
python rl/train.py --resume <run folder>/latest.pt --minutes 60
# the 8-hour continuation behind the Hard AI
python rl/train.py --resume <run folder>/latest.pt --minutes 480 --lr-end 5e-5 --entropy-end 0.002 --league-easy 0.05 --league-hard 0.15 --pool 20 --snapshot-every 100 --latest-prob 0.4 --hall-every 1000 --hall-prob 0.2 --eval-every 500
```

- **Output:** a new folder under `%LOCALAPPDATA%\semuncraft-rl\runs` (outside Google Drive) with `log.csv` (win rates by opponent, entropy, learning rate, speed), `eval.csv`, `snapshots/` (every `--snapshot-every` updates, 50 by default, plus `league_start.pt` and `run_start_<update>.pt`), `latest.pt` (everything needed to resume) and `final.pt` (the network's weights).
- **Evaluation:** every 200 updates (`--eval-every`), 100 games from the same seeds each time against Easy, against Hard (with win rates by strategy) and against the scripted AI (by color); in the league stage also, by color, against the network from the start of the league, the network from the start of this run (twice: sampling moves as in training, and with the trained network always playing its most likely move) and the network from the previous evaluation.
- **Stopping:** a run ends after `--minutes`. `latest.pt` is saved with every snapshot, so killing the process loses at most one snapshot interval.
- **Version 2 runs so far:** `v2-first` (60 minutes, the four-stage trainer described above) reached 98% against Easy and 92% against Hard but 0% against the scripted AI and stalled as Black; it was not exported. The networks in `models/` are still the version 1 ones below until a run beats them.
- **The runs behind the browser AIs:** the first run (60 minutes) passed the Easy stage at update 99 and the Hard stage at 365, then played the league until update 929 (11.4M training moves); Easy and Medium are its updates 100 and 400. The 8-hour continuation started from its last network and reached update 10,547 (129.6M training moves, 3.05M games, about 4,200 moves per second). From update 1,500 on, it won 93–100% of its evaluation games against the built-in Hard AI and 90–100% against the network it started from; at its last two evaluations it won every game against Easy and Hard and 98–100% against its starting network.

### Trained AI Opponents

Single Player has eight difficulties. **Easy**, **Medium** and **Hard** are unchanged, below. **Trained** and **Master**, added 2026-09-27, use the current version-2 pipeline: **Trained** plays `models/trained.js`, the network in training now: the `v3-halfturn` run at update 44,800 (2026-10-04), Rush retrained under the half-turn order rule (after a pawn's order, only another pawn's order or the end of the turn), mostly by self-play with Master's strategies in 15% of its games, just after its fading bonuses for stripping helmets, for Bishops and for Elixir units (`--strip-bonus 0.5 --bishop-bonus 0.2 --elixir-unit-bonus 0.25`, faded out over its first 4,000 updates) ran out. While they paid it stopped marching pawns, held the springs and built an army of **Paladins** (update 43,000: about 9.5 a game, five on the board at once; 20-3-1 against Master in 24 games, about 126 turns each; it hardly stripped, 0.25 a game). Once they were gone it found that a Paladin's hit — which takes all of whatever it strikes (`dmg = t.hp`) — **kills a King outright**: two Knights, 3 Elixir from a spring by about its eighth turn, a Paladin by about its tenth, and a target lock on the enemy King. Against Master it won 23 and drew 1 of 24, in about 23 of its turns a game (update 44,200: 24-0 in 13); head to head it beat Rush 17-7 and the Paladin army it came from (update 40,500) 21-0-3. (Before it, Trained was update 40,500 of the same run, the Paladin army, 11-6-7 against Master; and before that the `v3-strip2` run at update 32,000, an army of **Queens** — each a Knight and a Bishop — that held the gold mines and had stopped buying helmets; it beat Master 60% under the old order rule and, untrained, Rush 19-4-1 under the half-turn rule.) **Rush** (⚡, added 2026-10-03, kept on the user's word for its rushing) plays `models/rush.js`, the strongest network yet: the `v3-rook2` run's last (update 51,467, 2026-10-05), trained under the half-turn order rule and the 3-HP Bishop. The `v3-rook` run before it (from `v3-halfturn` update 43,000) paid fading bonuses for Rooks (`--rook-bonus`), for Mages, Sieges, Guardians and Paladins weighted 1.0, 1.0, 0.75 and 0.25 (`--elixir-unit-weights`), for Bishops and for strips; while they paid it built first an army of Bishops that stripped three or four helmets a game, then, once it had found the helmet that a Rook needs, Rooks, Sieges, Mages and Guardians — right as the bonuses ran out (update 47,700) a Guardian army that held the most mines and springs of any network yet and beat Master 10-0-2 — and then, on wins alone, it went back to the march of helmeted pawns, now two pawn orders every turn. It beat Master in all 24 of 24 games, in about 49 of its turns each, and in head-to-head games the Rush before it (`v3-elite` update 40,132) 23-1 and Trained (`v3-halfturn` update 44,800) 23-1. (Earlier Rushes: `v3-elite` update 40,132, `v3-strip2` update 34,556, `v3-merge` update 28,600.) **Strip** (✂, 2026-10-04) plays `models/strip.js`, the `v3-elite` run at update 36,000, caught mid-way through fading bonuses for stripping helmets and for Elixir units: it builds bishops (about ten a game, three on the board at once) and strips about four helmets a game against Master — but plays slow and draws, 1 win, 7 losses and 16 draws in 24 games against Master; it is there to show the bishop's Strip in use (once the bonuses had faded, the same run went back to the march). **Guardians** (🛡️, 2026-10-05) plays `models/guardians.js`, the `v3-rook` run at update 47,700, caught just as its fading bonuses for Rooks, Mages, Guardians, Sieges, Bishops and strips ran out: an army of **Guardians** (about three a game, two on the board at once) that holds more mines and springs than any network before it (1.4 tiles a turn). It beat Master 10-0-2 in 12 games, and head to head drew even with the Rush before the current one (8-7-1) and beat Trained 9-5-2; on wins alone the same run went back to the march, and the current Rush beats it 14-2. It is there to show the Guardian army in play. All four play at temperature 0.5 (earlier Trained networks: `v2-long` update 4,983, `v2-final` update 11,248, `v2-turnfix` update 17,702, `v2-vsmaster` update 18,900 — the march under the old rule, where an ordered pawn still fired from its old square the turn it was ordered — `v2-resource` update 23,847, `v2-resource15` update 27,330, the first to hold mines, and `v3-merge` update 28,600, the first Rush); **Master** is the scripted AI (`rl/scripted.js`, above) itself, plugged into the same one-action-at-a-time interface as a network (`NETAI_LEVELS.master`, `model: null`) — it beats the old Easy and Hard AIs (about 37/40 and 35/40) and loses about four games in five to Trained. Both give delayed orders and use Scry like any other network or the scripted AI standalone.

In Single Player a trained network plays Black. **Easy** plays `models/easy.js` (update 100 of the first training run) and **Medium** `models/medium.js` (update 400); both pick moves by sampling their policy, as in training. **Hard** plays `models/ai-1.js`, the last network of the 8-hour run (update 10,547), at temperature 0.25, and **Trained** `models/trained.js` at temperature 0.5 (not tuned the way Hard's was): it leans toward its most likely moves but keeps some variety. Over 1,000 games each against itself playing normally, temperatures 0, 0.05, 0.25, 0.5 and 1 scored within a few points of each other, and 0.25 scored best (53%, counting draws as half); at every temperature it beat the built-in Hard AI in 99.5–99.7% of games. It beats the network the run started from (update 929) in 98.7% of games, Medium and Easy in 99.8–99.9%, and its own checkpoints from updates 10,000, 9,000, 8,000 and 6,000 by 54–36, 57–30, 64–22 and 80–9 (wins–losses per 100 games; the rest were draws).

- **How a turn works:** `js/netai.js` turns the game's variables (pieces, terrain, turn counters, spawns, target locks) into an engine state with `SemunEngine.fromSnapshot`, the network picks a legal move, and `SemunEngine.act` applies just that move. The board and target locks are copied back into the game, the move is animated and logged, and the game's own `finishBlackTurn()` carries on, so attacks and upkeep still run through the original code. After a knight's L-jump merge the network moves again. `tests/netai.test.js` plays games through this path (random moves stand in for the network) and checks the game against the engine after every turn.
- **Who plays Black** (`aiAct()` in `ai.js`): the scripted enemy in the tutorial, the built-in campaign AI in the campaign, Claude on Hard when an API key is entered, and the trained network (or, on Master, the scripted AI) otherwise. If a network — or, on Master, the scripted AI's code — can't load, the built-in AI plays the turn.
- **Loading:** starting a game loads the engine, `rl/encoding.js`, `js/nn.js`, `rl/scripted.js` and (Easy through Trained) that difficulty's weights (2.8 MB) in the background; if Black's first turn comes first, the status shows "Loading the AI…" until they arrive. A move takes about 100 ms for a network; Master's is the scripted AI's own decision, about 2 ms. Each side reads the whole board, as in training, but attacks only what Black can see (normal sight, `aiSightLimited` — Easy through Master all count as Single Player for this), and doesn't see animals. Each model is played in the encoding version its meta names (`netAiEncoderFor`); Easy, Medium and Hard are version 1, Trained is version 2.
- **Changing the models:** the difficulty → model table is `NETAI_LEVELS` at the top of `js/netai.js`; an entry with `model: null` (Master) plays `SemunScripted.chooseAction` directly instead of a network. `python rl/export_web.py --checkpoints <run folder>/snapshots/update_000100.pt <run folder>/snapshots/update_000400.pt --names easy medium` writes Easy and Medium; `--checkpoints <run>/latest.pt --names trained --out models` (an absolute `--out`, or Node's `require` in `tests/nn.test.js` can't find the file on Windows) writes Trained; `--run <run folder>` writes `ai-1` and `ai-2` (see below).

### AI vs AI

**🤖 AI vs AI** on the main menu shows two of Single Player's difficulties playing each other on the selected map theme, and the result screen keeps a running score for White and for Black.

- **Who plays:** right under the resources, White and Black each have **🧠 Trained / 👑 Master / ⚡ Rush / ✂ Strip / 🛡️ Guardians** buttons (three and two on a phone) (`#aivsai-pick`, `aiVsAiPick` in `js/aivsai.js`): **Trained** is the current version-2 network, **Master** the scripted AI (`rl/scripted.js`), and both sides may pick the same one — Trained against itself, or two Masters, each playing its own strategy. The default is Trained (White) against Master (Black); the picks are remembered in the browser (`localStorage`, a convenience — a blocked storage just means the default). A pick starts a fresh match with the new pairing and starts the score over, since a match or a score half played by another AI wouldn't mean much; each side keeps its colour from match to match. On a phone they sit under the resource strip, each side's five buttons beside its name, three and two. `AIVSAI_CHOICES` lists the `NETAI_LEVELS` entries (`js/netai.js`) offered. `aiVsAiLabel` names each side on the status line: a network with its training update from the model's own meta, Master with the strategy it drew for this match. Both sides play at temperature 1 ("as trained"), not each difficulty's own tuned sampling.
- **How it runs:** matches are simulated by `js/engine.js` (the game's rules, checked by the parity tests) and drawn on the normal board: pieces slide, hits flash and the log lists every move, including a helmet, an order, a Scry or a Meteor. Both AIs play in the single-player turn order with normal sight (`aiSight`, so a Rook or Siege needs a spotter or a Scry, same as Single Player); the viewer sees the whole board (Map Cheat is forced on) and there are no animals.
- **Controls:** Pause, Speed (1×, 2×, 4× or 8×; at 4× and faster, animations and sounds are skipped) and New Match take the place of Spawn, Merge and the turn button. Menu ends the match.
- **Files:** `js/aivsai.js` is the mode; it calls `netAiChoose` (`js/netai.js`) for whichever of the two is to move, the same function Single Player uses, so a scripted side (Master) or a network of any encoding version works without special-casing here. The first time it starts, it loads `js/engine.js`, `rl/encoding.js`, `js/nn.js`, `rl/scripted.js` and each side's weights, if it has any (half precision, 2.8 MB). This works on GitHub Pages and from a double-clicked `SemunCraft.html`.
- **Updating the AIs:** `python rl/export_web.py --run <run folder>` exports a run's two most-trained networks as `ai-1` and `ai-2` (`ai-1` also plays Hard) and checks `js/nn.js` against PyTorch on real positions; `--checkpoints <path> --names <name> --out <absolute path to models>` exports one network under any name (Trained's `models/trained.js` was made this way — an absolute `--out` matters on Windows, or `tests/nn.test.js`'s `require` can't find the file). Bump the `?v=` version in `SemunCraft.html` when you publish new weights or change `js/aivsai.js`/`js/netai.js` — a browser that already loaded the page under the old `?v=` keeps its cached copies of these files until it does.

### Script Load Order

The scripts are loaded in a specific order in `SemunCraft.html` because later files depend on globals/functions from earlier ones:

1. `constants.js` -- everything depends on `idx`, `adj8`, `ROWS`, `COLS`
2. `state.js` -- declares all globals (`pieces`, `turn`, `animals`, etc.)
3. `audio.js` -- `SFX` object and the audio context used by many modules
4. `music.js` -- `startBgm` / `stopBgm` (uses the audio context from audio.js)
5. `pieces/pieces.js`, then `pieces/forest.js`, `jungle.js`, `desert.js`, `ocean.js` -- `pieceSVG` used by render, drag, actions, combat and ui
6. `movement.js` -- `isTileBlocked`, `getDragDests` needed by render/combat
7. `themes.js` -- `THEMES`, `generateMap` needed by game init
8. `scenery.js`, then `render.js` -- `tileArt()` for each tile; `render()`, `flashSq()` needed by combat/actions
9. `combat.js` -- `computeActions`, `executeActions` needed by game turn flow
10. `animals.js` -- animal loop functions needed by game init
11. `actions.js` -- `executeDrop`, `handleClick` needed by drag handlers
12. `ui.js` -- `syncUI`, `setStatus` needed by game/tutorial
13. `tutorial.js` -- tutorial system (calls render, actions, UI)
14. `campaign.js` -- level data and campaign flow (calls render, UI)
15. `training.js` -- the training ground's palette and its brush (calls render, UI; `trainingMode` itself lives in state.js so the rest of the game can see it)
15. `pvp.js` -- `myColor`, `isMyTurn` needed by game/drag
16. `ai.js` -- AI strategies (calls combat, movement, render)
17. `game.js` -- `initGame`, `endTurn` (orchestrates everything)
18. `drag.js` -- event listeners (calls executeDrop, handleClick)
19. `resize.js` -- window listeners (calls resizeBoard, render)
20. `netai.js` -- trained AI (called by `ai.js` and `game.js` during play; loads `engine.js`, `rl/encoding.js`, `nn.js` and the trained weights only when a game needs them)
21. `aivsai.js` -- AI vs AI mode (calls render, UI and animation helpers; gets the networks from `netai.js`)
22. `update.js` -- stands alone: checks the live page's version and shows the reload banner

---

## Other Technical Details

- No build step, no frameworks. Works offline via `file://`, except multiplayer (PeerJS servers) and the optional Claude opponent.
- **Web hosting (GitHub Pages)**: every path is relative, so the game runs under the `/SemunCraft/` subfolder; all external resources use HTTPS; `index.html` forwards the site root to `SemunCraft.html`.
- **Releases**: the local `<script>` tags in `SemunCraft.html` end in `?v=<version>`. Bump it on every release -- GitHub Pages lets browsers cache files for 10 minutes, and the version keeps a returning visitor from mixing old cached scripts with new ones.
- **Browser support**: current Chrome, Edge, Firefox and Safari. The layout needs at least Chrome/Edge 87, Firefox 66 or Safari 14.1 (iOS 14.5). Hiding the game controls behind the mobile title screen needs Chrome 105, Firefox 121 or Safari 15.4 and is simply skipped on older versions. On iPhones, the ring/silent switch mutes the game's Web Audio sound.
- All rendering is **DOM-based** (no canvas) -- each square is a grid cell with CSS classes for highlighting.
- Drag-and-drop is implemented via mouse/touch events with a floating ghost element; on touch screens the drag starts on touchstart so iOS doesn't cancel the gesture.
- Attack animations use flying emoji projectiles, SVG cannonballs and SVG arrow overlays. The Mage's own attack draws a wall of flame down its whole trajectory, tile by tile from the caster outward, rather than a single flash at the end (`svgFireLine`/`svgFlameShape` in `js/combat.js`). The Siege Tower fires a **flaming shell** in a high arc, trailing fire and embers, that bursts into flame on the square it hits — and the fire **runs out to the 8 squares around it**, the ones its splash damages, the straight neighbours a beat ahead of the corners, each catching, burning a moment and dying down (`svgFireShell`); the damage lands as the fire reaches them. A Rook's shot is still a plain cannonball with a small burst (`svgCannonball`). The Guardian's spiked ball — a big iron ball most of a third of a square across, with eight conical spikes — flies to the farthest tile its shot can reach on a cardinal hit — the same tile the path damage extends to — and stops at its one target on an L-jump hit, which has no such line (`svgSpikedBall`). Shots in flight are drawn on `#wep-overlay` at **z-index 8**: over every piece they pass (piece art is 1, HP pips 5, a piece on an obstacle 6) and under the fog (9), so a shot into the fog goes out of sight like anything else there. A pawn (and a fortified pawn, the same drawing in a helmet) swings its own sword instead: the blade sweeps **120°**, from 30° back over the shoulder to 90° forward, and the pawn goes with it — stepping back as the blade lifts and driving forward through the blow, along the line to that enemy whichever way it lies, diagonals included — the sword is drawn and turned on its own (`pieceSword` / `pieceWithoutSword` in `pieces/pieces.js`, turning about the hand). The drawing is mirrored for an enemy on the left, so the sword hand always leads and the shield falls to the hand on the far side (`attackAnim` in `js/combat.js`), and the blade is heard cutting the air as it comes round (`SFX.swing`, its rush scheduled across the strike).
- Board auto-resizes to fit the viewport, with separate portrait and landscape mobile layouts.
- Pieces are drawn as SVG from the `pieces/` folder. Each type has its own cute silhouette and size: a small round pawn holding a sword and a buckler (fortified: an iron helmet and a heater shield in its team’s colour), a horse-head knight, a mitred bishop with a green healing cross and a staff, a castle rook, a slim queen with long hair, a tall three-point crown and a sceptre, a broad bearded king under a flat crown with a cross, and a stub tower with a cannon barrel out of the roof for the siege tower. Bodies use the team colour (light White, dark Black) with a slight tint per type -- knights bluish, bishops greenish, rooks brick, queens pink, kings gold, siege towers stone. A dark outline plus a contrasting halo keeps them readable on any tile. Map themes only change crown/gem colours and the ground under each piece: grass and a flower (jungle), sand and a cactus (desert), ripples and bubbles (ocean). Open `pieces/preview.html` to see every set, including a solid-silhouette check.
- The three combined units are composited rather than drawn from scratch (`pieces/combined/make.js`): the **Mage** is a bishop rising out of a short rook tower, staff in hand; the **Paladin** is twin knights, the front one a half-step ahead; the **Guardian** is a knight rising out of a short rook tower, the same way the Mage does. `node pieces/combined/make-game-units.js` bakes all three, in every colour and map theme, into `pieces/units-art.js`, which `pieceSVG` (`pieces/pieces.js`) reads before falling back to `PIECE_SHAPES` — so these three are the one place a piece's board art isn't just its own entry in that table. Re-run it after changing `pieces/pieces.js`, a theme set, or `pieces/combined/make.js` itself. The same drawings are what stand in the title screen's armies (`img/make-title-wallpapers.js`).
