# SemunCraft: Kingdom - Jungle War

## Overview

SemunCraft is a **browser-based strategy game** (no build step; the only external dependency is PeerJS for multiplayer) that combines chess-like piece mechanics with real-time-strategy elements like spawning, merging units, and map hazards.

The goal: **destroy the enemy King** while building up your army through a merge-chain system.

**To play**: open the online version at https://chicago-wongdontrihan.github.io/SemunCraft/SemunCraft.html, or double-click `SemunCraft.html` locally. No server or build step needed (multiplayer and the optional Claude opponent need an internet connection).

---

## Game Board

- **9x9 grid** with alternating light/dark tiles (like a chess board, but larger). Campaign levels use their own board sizes.
- Coordinate system uses algebraic notation (a-i columns, 1-9 rows).
- **White King** starts on b2 (bottom-left area); **Black King** starts on h8 (top-right area). Each King starts with 3 pawns on the adjacent tiles closest to the enemy King.

---

## Pieces & Stats

| Piece | Glyph | HP | Movement | Attack |
|-------|-------|----|----------|--------|
| **Pawn** | ♙/♟ | 1 | 1 step, any of 8 directions; 2 straight forward on its first move | Adjacent (8 dirs) |
| **Knight** | ♘/♞ | 4 | L-shape jump (2+1), jumps over pieces | L-shape range |
| **Bishop** | ♗/♝ | 2 | Diagonal up to 2 squares (sliding) | Diagonal up to 2 (sliding); also heals allies with mana |
| **Rook** | ♖/♜ | 4 | Cardinal up to 2 squares (sliding) | Cardinal up to 3 squares, **piercing** (goes through pieces) |
| **Queen** | ♛ | 5 | All 8 directions up to 2 squares (sliding) | All 8 directions up to 2 squares (not L-shapes); not blocked by pieces or obstacles |
| **King** | ♔/♚ | 5 | Adjacent 1 step | Adjacent; also **spawns new pawns** |
| **Siege Tower** | 🏰 | 4 | **Cannot move** | Cardinal up to 4 squares, 2 damage, piercing. Right-click it (or tap it twice) to un-siege back into two rooks, each with the tower's current HP (one rook if no tile next to it is free). |

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

- Merged pieces spawn at full HP for their new type; a new Bishop starts with 1 mana.
- A Knight can also merge with a piece one L-jump away, and that merge doesn't use up your turn.
- Dragging a Bishop onto a Knight asks whether to heal it or merge into a Queen.
- The **Merge** button merges the first adjacent pair it finds (Rook + Rook is drag-only).

---

## Spawning

- The **King** spawns pawns on adjacent empty tiles: click the King, then an empty tile next to it (or press **Spawn** to place one on the free tile closest to the enemy King).
- Spawn quota starts at **8** and increases by 1 every 6 turns (`8 + floor(turnCount / 6)`). The AI has its own quota on the same schedule.
- Spawning is your only way to create new units -- everything else comes from merging. Campaign levels don't allow spawning.

---

## Bishop Healing & Mana

- Bishops have a **mana** resource (max 2).
- Dragging a Bishop onto a wounded friendly unit on its diagonal **heals 2 HP** (up to max HP) and costs 1 mana. Healing only occurs when the player explicitly spends their turn on it.
- Mana regenerates: **+1 mana every 3 turns** after the bishop last healed.
- If the player did not spend the turn healing with a bishop, that bishop automatically attacks enemies within its attack range.

---

## Combat System

- **Drag-to-target**: Drag a piece onto an enemy to lock it as that piece's target (this uses your turn). You can also right-click a piece and then click a target, which doesn't use your turn.
- **Auto-attacks**: At the end of a turn, pieces with enemies in range automatically fire.
- Attack damage is 1 per hit (except Siege Tower which deals 2).
- The piece that moved or healed this turn doesn't auto-attack.
- **Targeting**: a locked target in range comes first. Otherwise a piece prefers the enemy King, then an enemy no other piece is already firing at, then the lowest-HP enemy (bishops: the King, then the lowest HP).
- You can't target enemies hidden by fog of war.

---

## Fog of War

- You only see tiles within 2 squares of your own pieces.
- Tiles you've seen before but can't see now stay hazy: terrain and piece range auras show, enemy pieces don't. Tiles you've never seen are fully covered.
- The AI is not affected by fog.
- **Map Cheat** turns fog off. Regular games start with it off; the tutorial and most campaign levels start with it on.

---

## Zoom & Minimap

- **🔍+ / 🔍−** zoom between the full board and a 5x5 window. Arrows around the board pan the view (hold to keep panning).
- The minimap in the right panel shows the whole map, your fog, and the current view.

---

## Turn Flow (Single-Player)

1. **White's turn**: Player moves/merges/spawns/heals/sets a target.
2. **White auto-attacks** fire (excluding the piece that moved or healed).
3. **Black auto-attacks** fire.
4. **Black AI** takes its action (spawn, merge, or move).
5. Newborn highlights clear and bishops regain mana; return to step 1.

---

## AI

- **Easy mode** (`easy_rook_rush`): Spawns pawns, merges to knights, merges to a rook, then charges.
- **Hard mode** picks one strategy at random at game start (shown in the log). The strategy decides what to merge and when to spawn:
  - `pawn_troops` -- Swarm with pawns (up to 6), no merging.
  - `knight_attack` -- Merge pawns into up to 3 knights.
  - `pawn_knight` -- Up to 2 knights with pawn support.
  - `bishop_pawn` -- Build up to 2 bishops (and the knights to make them).
  - `rook_pawn` -- Climb the merge chain to a rook and a queen.
- When its strategy has nothing to merge or spawn, Hard mode moves with `hardTacticalAI`: one piece per turn, farthest from your King first so the army arrives together; pieces already in attack range hold position.
- **Campaign** uses `campaignAI`: no spawning; it repositions threatened pieces (to counter-attack or retreat), otherwise advances toward your King (or your nearest piece if there's no King).
- **Reactive behavior** (all modes except the tutorial): When a black piece is hit and the AI cannot attack back from its current position, it either moves a piece that can counter-attack the attacker, or flees from the position under attack. The choice is random, but if the attacking piece's HP is no higher than the victim's, the AI prefers attacking.
- **Claude (optional)**: On Hard, enter an Anthropic API key in the top bar and Claude (`claude-opus-5`, via the Anthropic SDK loaded from a CDN) picks Black's action each turn, guided by the chosen strategy. The reactive behavior still runs first. Refusals fall back server-side (`fallbacks: "default"`); if the key is rejected or a request fails, the built-in Hard AI plays that turn.

---

## Map Themes

Three selectable themes that change visuals, obstacles, ambient wildlife, and background music:

| Theme | Obstacle | Neutral Animal | Aggressive Animal | Special |
|-------|----------|----------------|-------------------|---------|
| **Jungle** | Trees (🌳) | Monkey (🐒, 2HP) | Snake (🐍, 1HP) | -- |
| **Desert** | Sandstone (🟧) | Camel (🐪, 3HP) | Mummy (🧟, 2HP) | One sandstone block is a pyramid the mummy starts next to |
| **Ocean** | Sea Rocks (🪨) | Crab (🦀, 1HP) | Shark (🦈, 2HP) | A tornado (🌪, 3HP) roams and occasionally spawns an enemy 2HP pawn |

- Obstacles are **impassable** and stop bishop, rook and Siege Tower attacks. Queens and knights fire over them.
- Obstacles are placed in small clusters, avoiding the first/last 3 rows (king zones), and the map always keeps a cardinal and a diagonal route between the two King zones.
- Animals roam in real time: two neutral and one aggressive per map. Any piece can attack them; aggressive animals bite adjacent pieces, and animals sometimes bump pieces aside.
- Campaign levels and multiplayer games have no animals.

---

## Campaign

10 hand-built levels, unlocked in order. Progress is saved in the browser (localStorage).

| # | Level | Board | Theme | Goal |
|---|-------|-------|-------|------|
| 1 | Pawn School | 5x5 | Jungle | Destroy all enemies |
| 2 | Narrow Pass | 3x7 | Jungle | Destroy all enemies |
| 3 | Clash in the Dunes | 11x8 | Desert | Destroy the enemy King (no merging) |
| 4 | Desert Crossing | 9x5 | Desert | Destroy all enemies |
| 5 | Island Siege | 5x9 | Ocean | Destroy all enemies |
| 6 | The Maze | 9x9 | Jungle | Destroy all enemies |
| 7 | Twin Forts | 11x7 | Desert | Destroy all enemies |
| 8 | Canyon Battle | 5x11 | Ocean | Destroy all enemies |
| 9 | Open War | 9x9 | Jungle | Destroy all enemies (fog of war on) |
| 10 | Last Stand | 11x11 | Desert | Destroy all enemies |

- You lose if all your pieces (or your King, on levels with Kings) are destroyed.
- Winning within the level's turn limit earns ★★; winning over the limit earns ★☆.

---

## Multiplayer (PvP)

- Uses **PeerJS** (WebRTC) for peer-to-peer connections, with public STUN/TURN servers so players on different networks can connect.
- The host shares their peer ID and the other player pastes it to join. A **BroadcastChannel** lobby also lists rooms open in the same browser.
- Host plays White and deals the board (pieces, terrain and theme); guest plays Black.
- Each turn, the player acts, that player's pieces auto-attack (excluding the piece that moved or healed), and then the game state is sent to the opponent. Each side fires once per round.
- Fog of war applies to both players.
- **Rematch** deals a new board from the host; a guest's Rematch asks the host for one. Going back to the menu ends the match.

---

## Audio

- **Medieval BGM** (`js/music.js`): each map theme has its own dance tune in a medieval mode -- a lively D Dorian estampie (jungle), a slow E Phrygian lament with a darbuka-style groove (desert) and a lilting 6/8 A Aeolian carol (ocean). A small synthesized band plays it: recorder, shawm, fiddle and harp take turns on the melody over lute chords or harp arpeggios, a bass, a drone and bells, with a drum groove (frame drum, rim clicks, woodblock, tambourine, finger cymbals) and fills at phrase ends. The dance's two sections trade instruments each time the tune repeats, and repeats add ornaments and a second voice a fifth below. No audio files needed.
- **SFX**: All sound effects are synthesized in real-time (spawn, move, attack, hit, kill, merge, heal, win, lose, etc.).
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

- **Top bar**: Game title, optional Anthropic API key (Claude plays Black on Hard), status text, turn counter, and ⚙ Audio settings.
- **Left panel**: Merge guide chart and paginated unit reference cards.
- **Center**: The game board with piece range auras, HP pips, bishop mana pips, coordinate labels, and pan arrows when zoomed in.
- **Right panel**: Move hint (Easy mode), action buttons (Spawn, Merge, Skip, Menu), and Map View (minimap, zoom, Map Cheat).
- **Bottom bar**: Game log and an AI "thinking" indicator dot.
- **Mobile**: In portrait, the merge chart becomes a strip above the board and the buttons wrap into finger-sized rows below it (unit cards, minimap and hint are hidden). The status line wraps, and when zoomed in the board leaves room around it for the pan arrows. On short landscape screens the side panels shrink and the layout is centered. Touch devices get touch wording (tap a siege tower twice instead of right-clicking).

### Controls

- Drag a piece onto a highlighted tile. On touch screens you can also tap a piece, then tap a tile.
- Click the King, then an adjacent tile, to spawn.
- Select 2-3 pawns/knights (click them, or drag a box over them from an empty tile) and drag one to move them together.
- Right-click a piece, then click a target, to lock a target. Right-click (or tap twice) a Siege Tower to un-siege.
- **Esc** clears the current selection.

---

## Project Structure

The codebase is split into functional files for maintainability. All JS files use classic `<script>` tags (no ES modules), so it works via `file://` with a double-click.

```
SemunCraft/
  SemunCraft.html       -- Entry point: HTML structure, CSS, loads all scripts
  SemunCraft_Explained.md
  arXiv/
    SemunCraft_old.html -- Original single-file version (untracked backup)
  pieces/               -- Piece artwork, one set per map theme
    pieces.js           -- pieceSVG(): piece silhouettes, team colours with per-type tints,
                           outline/halo, faces
    jungle.js           -- jungle colours and ground (grass, flower)
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
    themes.js           -- THEMES object (jungle/desert/ocean tile types, colors, animals),
                           selectMap(), generateMap()
    render.js           -- render() (rebuilds the visible board DOM: fog, auras, highlights),
                           sqElAt(), flashSq(), spawnFlash(), mergeFlash()
    combat.js           -- sqCenter(), attack animations (emoji projectiles, SVG
                           spear/cannonball), computeActions() (auto-targeting),
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
                           zoom and pan, renderMinimap()
    tutorial.js         -- 7-step interactive tutorial: TUTORIAL_STEPS array, tutBoard(),
                           tutCheckAction(), startTutorial(), tutAutoNext()
    campaign.js         -- CAMPAIGN_LEVELS, level select, startCampaignLevel(),
                           checkCampaignWin(), handleCampaignEnd() (stars, saved progress)
    pvp.js              -- PeerJS multiplayer: myColor(), isMyTurn(), broadcastState(),
                           onPeerData(), lobby (host / find rooms / join by ID),
                           BroadcastChannel discovery
    ai.js               -- Black AI: pickStrategy(), Hard build orders (strategy_*),
                           easy_rook_rush, hardTacticalAI(), reactiveAI(), campaignAI(),
                           fallbackAI(), optional Claude opponent (askClaude, applyBlackMove)
    game.js             -- Core game flow: startGame(), initGame(), startWhiteTurn(),
                           turnUpkeep(), endTurn() (single-player: white attacks -> black
                           attacks -> AI turn; PvP: mover's attacks -> send state),
                           finishBlackTurn()
    drag.js             -- Input handling: mouse/touch drag listeners on the board,
                           box selection (multi-select pieces), ghost element
    resize.js           -- resizeBoard() (responsive desktop/mobile layout), window
                           resize/load/keydown event listeners
    engine.js           -- Headless rules engine (not loaded by the game yet): the same
                           rules with no DOM or timers and seeded randomness, for AI
                           training and tests (see Headless Engine below)
  tests/                -- Node.js tests for the engine
    original-game.js    -- loads the game's rule scripts in Node with a fake DOM and a
                           virtual clock
    parity.test.js      -- plays identical games through the original code and the
                           engine and compares the state after every action
    engine.test.js      -- determinism, rule invariants and speed of the engine
```

### Headless Engine

`js/engine.js` holds the game rules without the browser: no DOM, no timers, and all randomness drawn from a seed stored in the game state, so games can be simulated fast and replayed exactly. It loads as a classic script (global `SemunEngine`) or in Node (`require('./js/engine.js')`). The browser game doesn't use it yet; until it does, the parity tests keep the two in step.

```js
const E = require('./js/engine.js');
const s = E.newGame({ seed: 42, mode: 'pvp' }); // also: difficulty, theme, level, fog, maxTurns
const actions = E.legalActions(s);              // [{ type, from, to }, ...]
E.step(s, actions[0]);                          // applies it plus any end-of-turn attacks; returns events
E.botTurn(s);                                   // classic mode only: Black's turn by the built-in AI
const copy = E.clone(s);
```

- **Modes:** `classic` is the single-player order (White acts, White fires, Black fires, Black acts). In `pvp`, each side acts and then its own pieces fire, the same for both colors, which suits self-play.
- **Actions:** `move`, `merge`, `target` (lock onto an enemy), `heal`, `healLock` (a bishop dropped on a wounded adjacent knight, choosing Heal), `spawn`, `unsiege` and `skip`. After a knight's L-jump merge the same side moves again.
- **Built-in AI:** Easy, the five Hard strategies and the campaign AI are ported with their quirks and draw random numbers in the same order as `ai.js`.
- **Not modelled yet:** animals, group moves and free right-click targeting. The engine also refuses spawns in campaign levels; the game only disables the Spawn button there, so clicking the King still spawns.
- **Tests** (need Node.js, not the game): `node tests/parity.test.js [seeds] [section]` and `node tests/engine.test.js [games]`. Random self-play runs at about 90,000 actions per second on one CPU core.

### Script Load Order

The scripts are loaded in a specific order in `SemunCraft.html` because later files depend on globals/functions from earlier ones:

1. `constants.js` -- everything depends on `idx`, `adj8`, `ROWS`, `COLS`
2. `state.js` -- declares all globals (`pieces`, `turn`, `animals`, etc.)
3. `audio.js` -- `SFX` object and the audio context used by many modules
4. `music.js` -- `startBgm` / `stopBgm` (uses the audio context from audio.js)
5. `pieces/pieces.js`, then `pieces/jungle.js`, `desert.js`, `ocean.js` -- `pieceSVG` used by render, drag, actions, combat and ui
6. `movement.js` -- `isTileBlocked`, `getDragDests` needed by render/combat
7. `themes.js` -- `THEMES`, `generateMap` needed by game init
8. `render.js` -- `render()`, `flashSq()` needed by combat/actions
9. `combat.js` -- `computeActions`, `executeActions` needed by game turn flow
10. `animals.js` -- animal loop functions needed by game init
11. `actions.js` -- `executeDrop`, `handleClick` needed by drag handlers
12. `ui.js` -- `syncUI`, `setStatus` needed by game/tutorial
13. `tutorial.js` -- tutorial system (calls render, actions, UI)
14. `campaign.js` -- level data and campaign flow (calls render, UI)
15. `pvp.js` -- `myColor`, `isMyTurn` needed by game/drag
16. `ai.js` -- AI strategies (calls combat, movement, render)
17. `game.js` -- `initGame`, `endTurn` (orchestrates everything)
18. `drag.js` -- event listeners (calls executeDrop, handleClick)
19. `resize.js` -- window listeners (calls resizeBoard, render)

---

## Other Technical Details

- No build step, no frameworks. Works offline via `file://`, except multiplayer (PeerJS servers) and the optional Claude opponent.
- **Web hosting (GitHub Pages)**: every path is relative, so the game runs under the `/SemunCraft/` subfolder; all external resources use HTTPS; `index.html` forwards the site root to `SemunCraft.html`.
- **Releases**: the local `<script>` tags in `SemunCraft.html` end in `?v=<version>`. Bump it on every release -- GitHub Pages lets browsers cache files for 10 minutes, and the version keeps a returning visitor from mixing old cached scripts with new ones.
- **Browser support**: current Chrome, Edge, Firefox and Safari. The layout needs at least Chrome/Edge 87, Firefox 66 or Safari 14.1 (iOS 14.5). Hiding the game controls behind the mobile title screen needs Chrome 105, Firefox 121 or Safari 15.4 and is simply skipped on older versions. On iPhones, the ring/silent switch mutes the game's Web Audio sound.
- All rendering is **DOM-based** (no canvas) -- each square is a grid cell with CSS classes for highlighting.
- Drag-and-drop is implemented via mouse/touch events with a floating ghost element; on touch screens the drag starts on touchstart so iOS doesn't cancel the gesture.
- Attack animations use flying emoji projectiles, SVG spears and cannonballs, and SVG arrow overlays.
- Board auto-resizes to fit the viewport, with separate portrait and landscape mobile layouts.
- Pieces are drawn as SVG from the `pieces/` folder. Each type has its own cute silhouette and size: a small round pawn, a horse-head knight, a mitred bishop with a green healing cross and a staff, a castle rook, a queen in a wide gown with a spiked crown, a broad bearded king with a cross-topped crown, and a cannon cart for the siege tower. Bodies use the team colour (light White, dark Black) with a slight tint per type -- knights bluish, bishops greenish, rooks brick, queens pink, kings gold, siege towers stone. A dark outline plus a contrasting halo keeps them readable on any tile. Map themes only change crown/gem colours and the ground under each piece: grass and a flower (jungle), sand and a cactus (desert), ripples and bubbles (ocean). Open `pieces/preview.html` to see every set, including a solid-silhouette check.
