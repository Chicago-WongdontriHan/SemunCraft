# SemunCraft: Kingdom - Jungle War

## Overview

SemunCraft is a **browser-based strategy game** (no external dependencies aside from PeerJS for multiplayer) that combines chess-like piece mechanics with real-time-strategy elements like spawning, merging units, and map hazards.

The goal: **destroy the enemy King** while building up your army through a merge-chain system.

**To play**: double-click `Run.html` in a browser. No server or build step needed.

---

## Game Board

- **9x9 grid** with alternating light/dark tiles (like a chess board, but larger).
- Coordinate system uses algebraic notation (a-i columns, 1-9 rows).
- **White King** starts at row 7, column 1 (bottom-left area); **Black King** starts at row 1, column 7 (top-right area).

---

## Pieces & Stats

| Piece | Glyph | HP | Movement | Attack |
|-------|-------|----|----------|--------|
| **Pawn** | ♙/♟ | 1 | 1 step, any of 8 directions | Adjacent (8 dirs) |
| **Knight** | ♘/♞ | 4 | L-shape jump (2+1), jumps over pieces | L-shape range |
| **Bishop** | ♗/♝ | 2 | Diagonal up to 2 squares | Diagonal up to 2 (sliding); also heals allies with mana |
| **Rook** | ♖/♜ | 4 | Cardinal up to 2 squares (sliding) | Cardinal up to 3 squares, **piercing** (goes through pieces) |
| **Queen** | ♛ | 5 | All 8 directions up to 2 squares (sliding) | All directions up to 2 squares (excluding L-shapes) |
| **King** | ♔/♚ | 5 | Adjacent 1 step | Adjacent; also **spawns new pawns** |
| **Siege Tower** | 🏰 | 4 | **Cannot move** | Cardinal up to 4 squares, 2 damage, piercing. Right-click to un-siege back into two rooks (same HP). |

---

## The Merge Chain

The core progression mechanic. Drag one piece onto an adjacent ally to merge them into a stronger unit:

```
♙ + ♙  -->  ♘  (Pawn + Pawn = Knight)
♙ + ♘  -->  ♗  (Pawn + Knight = Bishop)
♘ + ♘  -->  ♖  (Knight + Knight = Rook)
♘ + ♗  -->  ♛  (Knight + Bishop = Queen)
♖ + ♖  -->  🏰  (Rook + Rook = Siege Tower)
```

Merged pieces spawn at full HP for their new type.

---

## Spawning

- The **King** can spawn pawns on adjacent empty tiles.
- Spawn quota starts at **8** and increases by 1 every 6 turns (`8 + floor(turnCount / 6)`).
- Spawning is your only way to create new units -- everything else comes from merging.

---

## Bishop Healing & Mana

- Bishops have a **mana** resource (max 2).
- Dragging a Bishop onto a wounded friendly unit **heals 2 HP** and costs 1 mana. Healing only occurs when the player explicitly spends their turn on it.
- Mana regenerates: **+1 mana every 3 white turns**.
- If the player did not spend the turn healing with a bishop, that bishop automatically attacks enemies within its attack range.

---

## Combat System

- **Drag-to-target**: Drag a piece onto an enemy to lock it as an attack target.
- **Auto-attacks**: At the end of each turn, all pieces with enemies in range automatically fire.
- Attack damage is 1 per hit (except Siege Tower which deals 2).
- The piece that moved/acted during the turn is excluded from the auto-attack phase.
- **Priority targeting**: auto-attack prefers the enemy King, then the lowest-HP enemy, then untargeted enemies.

---

## Turn Flow (Single-Player)

1. **White's turn**: Player moves/merges/spawns/sets targets.
2. **White auto-attacks** fire (excluding the piece that just acted).
3. **Black auto-attacks** fire.
4. **Black AI** takes its action (spawn, merge, or advance).
5. Return to step 1.

---

## AI Strategies

The AI picks a strategy at game start:

- **Easy mode** (`easy_rook_rush`): Spawns pawns, merges to knights, merges to a rook, then charges.
- **Hard mode** picks randomly from:
  - `pawn_troops` -- Swarm with pawns.
  - `knight_attack` -- Merge to knights and rush.
  - `pawn_knight` -- Balanced pawn/knight mix.
  - `bishop_pawn` -- Build bishops for healing support.
  - `rook_pawn` -- Rush to rook/queen as fast as possible.
- Hard mode also uses `hardTacticalAI` which scores pieces by proximity to the white King and advances the most threatening unit.
- **Reactive behavior**: When a black piece is hit and the AI cannot attack back from its current position, it either moves a piece that can counter-attack the attacker, or flees from the position under attack. The choice is random, but if the opponent piece has lower HP, the AI prefers attacking.

---

## Map Themes

Three selectable themes that change visuals, obstacles, ambient wildlife, and background music:

| Theme | Obstacle | Neutral Animal | Aggressive Animal |
|-------|----------|----------------|-------------------|
| **Jungle** | Trees (🌳) | Monkey (🐒, 2HP) | Snake (🐍, 1HP) |
| **Desert** | Sandstone (🟧) | Camel (🐪, 3HP) | -- |
| **Ocean** | Sea Rocks (🪨) | Crab (🦀, 1HP) | Shark (🦈, 2HP) |

- Obstacles are **impassable** and block line-of-sight for sliding attacks.
- Obstacles are placed in small clusters, avoiding the first/last 3 rows (king zones).
- Neutral animals roam the map and can be attacked/killed by any piece.

---

## Multiplayer (PvP)

- Uses **PeerJS** (WebRTC) for peer-to-peer connections.
- A **BroadcastChannel** lobby lets players on the same browser/device discover rooms.
- One player hosts, the other joins. Host plays White, guest plays Black.
- Game state is serialized and sent over the data channel after each turn.

---

## Audio

- **Procedural BGM**: Randomly plays notes from a theme-specific musical scale using the Web Audio API (oscillators + envelopes). No audio files needed.
- **SFX**: All sound effects are synthesized in real-time (spawn, move, attack, hit, kill, merge, heal, win, lose, etc.).
- Volume controls for BGM and SFX are available in the settings modal.

---

## Tutorial

An interactive tutorial walks new players through these stages:

1. **King & Spawning** -- King spawns a pawn, introducing the spawn mechanic first
2. **Pawn** -- Pawn movement, attacking, then merge (Pawn + Pawn = Knight)
3. **Knight** -- Knight L-shape movement, attacking, then merge (Pawn + Knight = Bishop)
4. **Bishop** -- Bishop diagonal movement, attacks, healing with mana, then merge (Knight + Knight = Rook)
5. **Rook** -- Rook cardinal movement, piercing attacks, then merge (Rook + Rook = Siege Tower), and un-siege
6. **Queen** -- Knight + Bishop merge into Queen
7. **Tutorial complete** -- starts an Easy game

---

## UI Layout

- **Top bar**: Game title, API key input (unused placeholder), status text, turn counter.
- **Left panel**: Merge guide chart and paginated unit reference cards.
- **Center**: The 9x9 game board with piece auras, HP pips, and coordinate labels.
- **Right panel**: Action buttons (Spawn, Target, Skip Turn, New Game), and PvP controls.
- **Bottom bar**: Game log and an AI "thinking" indicator dot.

---

## Project Structure

The codebase is split into functional files for maintainability. All JS files use classic `<script>` tags (no ES modules), so it works via `file://` with a double-click.

```
SemunCraft/
  Run.html              -- Entry point: HTML structure, CSS, loads all scripts
  SemunCraft.html       -- Original single-file version (backup)
  SemunCraft_Explained.md
  js/
    constants.js        -- Board dimensions (9x9), coordinate helpers (idx, ROW, COL,
                           adj8, kJumps), range functions, piece glyphs & stats
    state.js            -- All global variable declarations: game state (pieces, turn,
                           over), drag state, PvP state, AI state, piece card data
    audio.js            -- Web Audio API: procedural BGM synthesis (theme-specific
                           scales), all SFX (spawn, attack, merge, heal, etc.),
                           volume controls
    movement.js         -- isTileBlocked(), getDragDests() (computes valid moves/
                           merges/attacks/heals per piece), BFS pathfinding
                           (stepToward, getPath), queenRange()
    themes.js           -- THEMES object (jungle/desert/ocean tile types, colors,
                           animals), THEME_SVG_DECOS (themed enemy piece art),
                           buildBlackPieceSVG(), selectMap(), generateMap()
    render.js           -- render() (rebuilds entire board DOM each frame), sqElAt(),
                           flashSq(), spawnFlash(), mergeFlash() visual effects
    combat.js           -- sqCenter(), attack animations (emoji projectiles, SVG
                           spear/cannonball), computeActions() (auto-targeting),
                           executeActions(), applyActions(), showDeath()
    animals.js          -- Neutral animal system: startAnimalLoop(),
                           updateAnimals() (roaming, biting, pushing pieces),
                           renderAnimalOverlay(), mummy SVG builder
    actions.js          -- Player action execution: executeDrop() (move/merge/attack/
                           heal logic), handleClick() (king spawn, piece selection),
                           doSpawn(), doMergeAll(), doSkip(), animatePieceMove(),
                           targeting (right-click, unsiege)
    ui.js               -- syncUI() (button states), addLog(), setStatus(),
                           showMoveHint() (easy mode), renderPcCards() (unit
                           reference), showDiff(), showGameOver(), goIntro()
    tutorial.js         -- 8-step interactive tutorial: TUTORIAL_STEPS array,
                           tutBoard(), tutCheckAction(), startTutorial(),
                           tutAutoNext() (auto-advance on merge)
    pvp.js              -- PeerJS multiplayer: myColor(), isMyTurn(),
                           broadcastState(), PvP lobby (host/join/refresh rooms),
                           BroadcastChannel discovery, onPeerData()
    ai.js               -- Black AI: pickStrategy(), 6 strategies (easy_rook_rush,
                           pawn_troops, knight_attack, etc.), hardTacticalAI(),
                           fallbackAI(), Claude API integration (askClaude,
                           applyBlackMove)
    game.js             -- Core game flow: initGame(), startGame(), startWhiteTurn(),
                           endTurn() (orchestrates white auto-attacks -> black
                           auto-attacks -> AI turn), finishBlackTurn()
    drag.js             -- Input handling: mouse/touch drag listeners on the board,
                           box selection (multi-select pieces), ghost element
    resize.js           -- resizeBoard() (responsive layout), window resize/load/
                           keydown event listeners
```

### Script Load Order

The scripts are loaded in a specific order in `Run.html` because later files depend on globals/functions from earlier ones:

1. `constants.js` -- everything depends on `idx`, `adj8`, `ROWS`, `COLS`
2. `state.js` -- declares all globals (`pieces`, `turn`, `animals`, etc.)
3. `audio.js` -- `SFX` object used by many modules
4. `movement.js` -- `isTileBlocked`, `getDragDests` needed by render/combat
5. `themes.js` -- `THEMES`, `generateMap` needed by game init
6. `render.js` -- `render()`, `flashSq()` needed by combat/actions
7. `combat.js` -- `computeActions`, `executeActions` needed by game turn flow
8. `animals.js` -- animal loop functions needed by game init
9. `actions.js` -- `executeDrop`, `handleClick` needed by drag handlers
10. `ui.js` -- `syncUI`, `setStatus` needed by game/tutorial
11. `tutorial.js` -- tutorial system (calls render, actions, UI)
12. `pvp.js` -- `myColor`, `isMyTurn` needed by game/drag
13. `ai.js` -- AI strategies (calls combat, movement, render)
14. `game.js` -- `initGame`, `endTurn` (orchestrates everything)
15. `drag.js` -- event listeners (calls executeDrop, handleClick)
16. `resize.js` -- window listeners (calls resizeBoard, render)

---

## Other Technical Details

- No build step, no frameworks. Works offline via `file://`.
- All rendering is **DOM-based** (no canvas) -- each square is a grid cell with CSS classes for highlighting.
- Drag-and-drop is implemented via mouse/touch events with a floating ghost element.
- Attack animations use flying emoji projectiles and SVG arrow overlays.
- Board auto-resizes to fit the viewport.
- Black pieces get **theme-specific SVG decorations** (vines for jungle, scarabs for desert, tentacles for ocean).
