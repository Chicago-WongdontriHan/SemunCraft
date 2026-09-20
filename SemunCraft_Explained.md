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
- The other two corners hold the resources: an **Elixir spring on b8** and a **gold mine on h2**. Each is exactly as far from one King as from the other, so the race for them starts even, and the obstacles are mirrored through the board’s centre for the same reason.

---

## Pieces & Stats

| Piece | Glyph | HP | Movement | Attack |
|-------|-------|----|----------|--------|
| **Pawn** | ♙/♟ | 1 | 1 step, any of 8 directions; 2 straight forward on its first move | Adjacent (8 dirs) |
| **Fortified Pawn** | ♙/♟ in a helmet | 3 | As a pawn | As a pawn |
| **Knight** | ♘/♞ | 4 | L-shape jump (2+1), jumps over pieces | L-shape range |
| **Bishop** | ♗/♝ | 2 | Diagonal up to 2 squares (sliding) | Diagonal up to 2 (sliding); also heals allies with mana |
| **Rook** | ♖/♜ | 4 | Cardinal up to 2 squares (sliding) | Cardinal up to 3 squares, **piercing** (goes through pieces) |
| **Queen** | ♛ | 5 | All 8 directions up to 2 squares (sliding) | All 8 directions up to 2 squares (not L-shapes); not blocked by pieces or obstacles |
| **King** | ♔/♚ | 5 | Adjacent 1 step | Adjacent; also **spawns new pawns** |
| **Siege Tower** | 🏰 | 4 | **Cannot move** | Cardinal up to 4 squares, 2 damage, piercing. Right-click it (or tap it twice) to un-siege back into two rooks, each with the tower's current HP (one rook if no tile next to it is free). |
| **Mage** | ✦ | 3 | Diagonal up to 2 squares (sliding), like a bishop | **Any square within 3**, over pieces and obstacles alike; no heal, no merges |

---

## The Merge Chain

The core progression mechanic. Drag one piece onto an adjacent ally to merge them into a stronger unit:

```
♙ + ♙  -->  ♘  (Pawn + Pawn = Knight)
♙ + ♘  -->  ♗  (Pawn + Knight = Bishop)
♘ + ♘  -->  ♖  (Knight + Knight = Rook)
♘ + ♗  -->  ♛  (Knight + Bishop = Queen)
♖ + ♖  -->  🏰  (Rook + Rook = Siege Tower)
♗ + ♖  -->  ✦  (Bishop + Rook = Mage, for 2 Elixir)
```

- Merged pieces spawn at full HP for their new type; a new Bishop starts with 1 mana.
- A Knight can also merge with a piece one L-jump away, and that merge doesn't use up your turn.
- Dragging a Bishop onto a Knight asks whether to heal it or merge into a Queen; onto a Rook, whether to heal it or merge into a **Mage**.
- **The Mage costs 2 Elixir**, paid at the moment of merging (a Bishop and a Rook next to each other, either one dragged onto the other). Without the Elixir the two simply don't merge (`MAGE_ELIXIR` in `js/state.js` and `js/engine.js`). It is drawn as the Bishop rising out of a short tower, the design from the title screen (`pieces/combined/make.js`, shipped to the game in `pieces/units-art.js` by `node pieces/combined/make-game-units.js`), and it fires a violet spark.
- A fortified pawn takes part in no merge.
- The **Merge** button merges the first adjacent pair it finds (Rook + Rook and the Mage are drag-only).

---

## Spawning

- The **King** spawns pawns on adjacent empty tiles: click the King, then an empty tile next to it (or press **Spawn** to place one on the free tile closest to the enemy King).
- **Gold** starts at **8** and earns **a sixth a turn**, and a sixth more for every turn that ends with a pawn of yours on the **gold mine** (`8 + (turnCount + mineTurns) / 6`, `GOLD_START` / `GOLD_TURNS` in `js/state.js`, written the same way in `js/engine.js` so both land on the same number — turns are counted as whole numbers and divided once, never summed in sixths). A pawn from the King costs 1 Gold, so spawning waits until a whole Gold is in hand. The AI earns Gold on the same terms.
- **Fortify** spends 1 Gold from the same purse: the selected pawn becomes a **fortified pawn** — the same pawn for moving and attacking, but with **3 HP**; it takes part in **no merge** (the helmet was paid for) and can't work the spring or the mine. Its armour **mends 1 HP five turns after the last hit it took** (`FORTIFIED_MEND`, counted in `turnUpkeep` / the engine's `upkeep` from the turn of the hit, so a pawn left alone climbs back to 3 HP), drawn with an iron helmet and a heater shield in its team’s colour. It takes the pawn’s turn, as spawning takes the King’s, and a pawn is fortified only once (`fortifyAt` in `js/actions.js`, `fortify` in `js/engine.js`; `goldSpent` keeps the count). Levels without spawning have no Gold, so no fortifying either. The AI doesn’t fortify yet.
- Spawning is your only way to create new units -- everything else comes from merging. Campaign levels don't allow spawning.

---

## The Spring and the Mine

Two tiles on the board are worth holding (`RESOURCE_TILES` in `js/state.js`), and only **pawns** work them:

- The **gold mine** (h2) pays by being held: every turn that ends with a pawn of yours on it adds **another sixth of Gold**, so your income doubles from +0.17 to **+0.33** a turn (`mineTurns`, `pawnOnMine`; credited in `endTurn` / `finishBlackTurn` and in the engine’s `finishTurn`). While a pawn stands there the tile pulses gold with a large **+0.16** badge on its top edge (the extra sixth, shown so that +0.17 and +0.16 add up to the +0.33 in the panel), and the Gold line in the panel lights up with the doubled rate.
- The **Elixir spring** (b8) pays only for work: a pawn standing on it can **spend its whole turn extracting one Elixir**, every turn, with **no limit** on how much is banked — tap the pawn and press **Extract Elixir** on the board (or in the side panel) (`extractAt` in `js/actions.js`, the `extract` action in `js/engine.js`). That is the point of the rule: banking Elixir costs tempo and leaves a pawn standing still in the open, so the side that is ahead cannot extract without giving the other side a turn to come back.
- Elixir is banked on its own (`elixir`) and pays for the **Mage** (Bishop + Rook, 2 Elixir); there is no cap on how much can be banked.
- Both tiles only work for a **plain pawn** (a fortified pawn can't extract or earn), and say so: until one stands on a tile, it carries a badge with **the game's own pawn, in your colour** (white or black), ringed green (spring) or gold (mine) — a knight or a fortified pawn parked there still shows it, because it earns nothing. Under fog the badge sits larger in the middle of the square, as the tile's landmark, and hovering the square explains the tile (`pawnNeededBadge`, `RESOURCE_TIPS` in `js/render.js`).
- Both tiles are **landmarks**: a coloured dot marks each one through the fog, because both sides know where they are from the start.
- Black extracts too: the built-in AI does it before anything else on its turn (`fallbackAI` in `js/ai.js`, `botTurn` in `js/engine.js`), and because the trained networks were trained before the rule existed, the same check runs for them in `netAiChoose` and in AI vs AI (`freeExtract`). The mine pays either side automatically. `extract` and `fortify` are left out of the networks’ action map (`legalMap` in `rl/encoding.js`) until they are trained again. Likewise the networks see a Mage on the queen’s channels (`TYPE_ALIAS` in the same file) until they are trained with one of its own, and Black’s built-in AI treats a Mage like a short-range piece in its own heuristics.

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
- Tiles you've never seen are covered in solid grey. Tiles you've seen before but can't see now are under a see-through grey veil with their terrain faded: terrain shows, enemy pieces don't.
- The grey has a slight tint of each map's colour (`fogCover` in `js/scenery.js`), and the minimap shows fog in the same colours.
- The AI is not affected by fog.
- **Scrying** (`scry` in engine.js, `castScry` in actions.js): a bishop may spend **both** its mana to light **any 3x3 on the board**, seen or not — scrying has no range — for its next **2 turns**. It costs the bishop's turn, like a heal, so its mana is a fork: heal 2 HP, or see nine tiles. The lit squares carry a blue ring and a countdown. To cast, tap the bishop and press **Scry** on the board (or in the panel): the whole board glows, and a tap on any square lights the 3x3 around it. A tap on the board’s edge lights the full 3x3 just inside it rather than a clipped one, and with a mouse the 3x3 is previewed before the click (`scryArea`, `scryCenterFor` in `js/actions.js`). It also sees into the jungle's undergrowth: an enemy hiding in the lit 3x3 shows up and can be hit while the light lasts. The opponent isn't told.
- **Map Cheat** turns fog off. Regular games start with it off; the tutorial and most campaign levels start with it on.

---

## Zoom & Minimap

- Zoom is continuous, from the whole board (1x) up to 4x. Pinch with two fingers, turn the mouse wheel over the board, or press **🔍+ / 🔍−**; the wheel and a pinch zoom around the point under your fingers, the buttons around the middle of the board.
- When the board is bigger than its frame, drag it to slide the view (one finger, or the mouse anywhere that isn't one of your own pieces). The arrows around the board still slide it a square at a time (hold to keep going), and dragging one of your own pieces still moves that piece.
- The whole board is always drawn inside a frame that clips it, so zooming and sliding never change what the game knows; while a pinch or a drag is in progress the board is only moved and scaled, and the squares are laid out again at the new size when it ends (`applyBoardView` / `previewBoardView` / `commitBoardView` in `js/resize.js`, the gestures in `js/drag.js`).
- The minimap in the right panel shows the whole map, your fog, and a box around the part you are looking at. On phones, where that panel is hidden, the same map sits at the left of the button strip under the board at all times, so the strip never changes size; the box appears on it once you zoom in. Tapping either one jumps the view there.

---

## Turn Flow (Single-Player)

1. **White's turn**: Player moves/merges/spawns/heals/sets a target.
2. **White auto-attacks** fire (excluding the piece that moved or healed).
3. **Black auto-attacks** fire.
4. **Black AI** takes its action (spawn, merge, or move).
5. Newborn highlights clear and bishops regain mana; return to step 1.

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
- **Undergrowth** (jungle only): walkable tiles that don't block movement or shots. A piece standing in undergrowth is hidden from the other side until one of that side's pieces is on a tile next to it, or a bishop of that side scries it: it isn't drawn, isn't on the minimap, and can't be targeted or attacked, by drag, right-click, a lock or an auto-attack. It can still attack out of cover. Once an enemy piece is next to it, every enemy piece can see and hit it. This applies to both sides and with or without fog (Map Cheat draws hidden pieces faintly but they still can't be hit). The rule lives in `inCover` / `isConcealedFrom` (movement.js) and `inCover` / `concealed` (engine.js), and the trained AI's observation leaves hidden pieces out too.
- The board is drawn to match the pieces (`js/scenery.js`): flat rounded tiles with a thin gap, a small sticker low on some free tiles (grass, leaves and toadstools in the forest; monstera, vines, puddles and hibiscus in the jungle; dunes and cacti in the desert; ripples, starfish and coral in the ocean) and a drawing that fills each impassable tile. Which sticker a tile gets is a hash of its row and column, so a map always looks the same and no game random numbers are used.
- **Animals are switched off** for now: `ANIMALS_ON` in `js/constants.js` (and the same switch in `js/engine.js`). Map generation still draws the same random numbers for them, so boards and enemy strategies are unchanged, but nothing is placed and the roaming loop never starts. The system stays in `js/animals.js`.
- When switched on, animals roam in real time: two neutral and one aggressive per map. Any piece can attack them; aggressive animals bite adjacent pieces, and animals sometimes bump pieces aside. Campaign levels and multiplayer games never had them.

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

- **Medieval BGM** (`js/music.js`): each map theme has its own dance tune in a medieval mode -- a lively D Dorian estampie (forest; the jungle plays it brighter in D Mixolydian and a little quicker), a slow E Phrygian lament (desert) and a lilting 6/8 A Aeolian carol (ocean). A small synthesized band plays it: recorder, shawm, fiddle and harp take turns on the melody over lute chords or harp arpeggios, a bass, a drone and bells, with a pop drum beat: kick, a snare backbeat and hi-hats (on the beat in the quieter section, every eighth note in the fuller one), tom fills at section ends and crash cymbals on section starts. The dance's two sections trade instruments each time the tune repeats, and repeats add ornaments and a second voice a fifth below. No audio files needed.
- **SFX**: All sound effects are synthesized in real-time (move, attack, hit, heal, win, lose, etc.).
- **Piece voices** (`PIECE_VOICES` in `js/audio.js`): every piece type has its own voice, heard when one arrives (a spawned pawn, a merged piece, the rooks of an unsieged tower) and, sinking, when one falls: a squeaky pip for the pawn, hoofbeats and a whinny for the knight, chapel bells for the bishop, a stone thud and a low horn for the rook, a trumpet fanfare for the queen, a deep horn over a drum for the king and iron clanks with a cannon boom for the siege tower. Both sides' pieces use them, and every heal (a bishop's drop, a locked heal at the end of the turn, Black's heals) plays a warm, rising healing chime.
- **The music starts with the app** (`bgmAutoStart` in `js/audio.js`, called on load): it plays over the title screen, not from the first game, and follows the map theme picked there. A browser only lets sound out after the page has been touched — always so on a phone — so when the audio is held back it starts on the first touch, click or key anywhere, the title screen's own buttons included; notes scheduled meanwhile wait silently, because a held context's clock doesn't run. Coming back to the app resumes the tune, since a phone suspends audio in the background.
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

- **Title screen**: the SemunCraft title over a war scene drawn from the game's own pieces, including the combined-unit designs (Guardian, Paladin, Mage) and cannons: *Battle Lines* on wide screens (two armies on a rolling checkerboard field, each king on its castle roof) and *The Clash* on tall ones (the armies meeting with spears, cannonballs and smoke). The scenes are `img/title-wide.svg` and `img/title-tall.svg`, drawn by `node img/make-title-wallpapers.js`. The menu sits on a translucent card and scales with the screen.
- **Design** (the `--leather-*`, `--gold*`, `--parch*` and `--btn-*` tokens at the top of `SemunCraft.html`): everything outside the board is one system — leather panels in the map's own colour behind a gold frame, section headers on gold ribbons with a notched foot, bevelled plaque buttons (solid gold for the main one on a panel), and sunken boxes for anything that shows a value. A map theme only re-sets the tokens, so the panels, bars, buttons, popups, the settings card, the tutorial card and the overlays all follow it. Button icons are drawn in one line style in `UI_ICONS` (`js/ui.js`) and requested with `data-icon`, so no button falls back to an emoji.
- **Font**: all UI text uses Lilita One (`fonts/LilitaOne.woff2`, SIL Open Font License in `fonts/OFL.txt`) through the `--ui-font` variable; room/peer IDs and the API key field stay monospace so similar characters stay distinct.
- **Top bar**: Game title, optional Anthropic API key (Claude plays Black on Hard), status text, turn counter, and ⚙ Audio settings.
- **Left panel**: The Gold and Elixir counters and paginated unit reference cards (the fortified pawn has a card of its own). The counters are measured after every render (`fitResources` in `js/ui.js`): the panel first takes any width the board isn't using, then the line shrinks a step at a time, and the names go before a number could ever be cut.
- **Resources** (`renderResources` in `js/ui.js`): **Gold** is what the King spends to spawn pawns and what fortifying costs (8 to start, a sixth a turn, a sixth more while a pawn holds the mine, 1 each, so the count is often a fraction), and **Elixir** is what a pawn extracts at the spring — a bishop’s mana is its own heal charge, not this. On desktop each resource has **a line of its own** — icon, name, count, and for Gold this turn’s income (+0.17, or +0.33 lit gold while the mine is held) — and AI vs AI shows White and Black in two columns. On a phone the two sit side by side in the strip above the board, which stays one line.
- **Center**: The game board with HP pips, bishop mana pips, coordinate labels, and pan arrows when zoomed in (the board can also be dragged to slide it).
- **Right panel**: **Menu | Settings** at the top (where the move hint used to be — Settings opens the audio card, so a game needs no ⚙ button of its own; the fixed one stays on the title screen), then the action buttons in pairs — Spawn | Fortify, Merge | the selected piece’s own action — with Skip across the bottom, and Map View (minimap, zoom, Map Cheat). The piece’s own action is whatever the one selected piece can do where it stands: **Extract Elixir** for a pawn on the spring, **Scry (2)** for a bishop holding both its mana. AI vs AI swaps the player’s buttons for Pause, Speed and New Match.
- **Bottom bar**: Game log and an AI "thinking" indicator dot.
- **Mobile**: In portrait, the resource counters become a strip above the board, kept to one line (two in AI vs AI would push the board down), and the status line is clipped to one line for the same reason and the buttons wrap into finger-sized rows below it (unit cards, minimap and hint are hidden). The status line wraps, and the board keeps its full size when zoomed in: the pan arrows are hidden (drag the board instead) and the small map in the button strip below shows where the view is. A double tap never zooms the page (the board has its own pinch zoom). On short landscape screens the side panels shrink and the layout is centered. Touch devices get touch wording (tap a siege tower twice instead of right-clicking).

### Controls

- Drag a piece onto a highlighted tile. On touch screens you can also tap a piece, then tap a tile.
- Click the King, then an adjacent tile, to spawn. The King opens an on-board **Spawn / Move** chooser.
- Dropping (or tapping) a bishop onto one of your knights asks **Heal** or **Merge → Queen** (onto a rook, with the Elixir: **Merge → Mage (2 Elixir)**) on the same kind of on-board chooser (`showDropChoice` in `js/actions.js`); a tap anywhere else puts it away.
- Tapping one of your pawns or bishops opens the same kind of chooser for it: **Extract Elixir** while a pawn stands on the spring, **Fortify (1 Gold)** while it is a plain pawn, **Scry (2 mana)** for a bishop (`syncPieceChooser` in `js/actions.js`). It sits past the piece’s reach (a pawn’s 3x3, a bishop’s 5x5) on its own side of the board, so it never covers a square the piece can act on. The side panel’s buttons follow every tap too (`syncPieceButtons`, called from `render`).
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
                           action, seen from one side; also loads in the browser
    worker.js           -- Node process running games for Python (JSON lines on stdin/stdout)
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
const s = E.newGame({ seed: 42, mode: 'pvp' }); // also: difficulty, theme, level, fog, maxTurns
const actions = E.legalActions(s);              // [{ type, from, to }, ...]
E.step(s, actions[0]);                          // applies it plus any end-of-turn attacks; returns events
E.botTurn(s);                                   // classic mode only: Black's turn by the built-in AI
const copy = E.clone(s);
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
    obs = env.reset()                    # (64, 32, 11, 11) float32 in [0, 1]
    masks = env.action_masks()           # (64, 9923) bool, True = legal
    obs, rewards, dones, infos = env.step(sample_legal(masks, rng))
```

- **Turn order and opponents:** `mode` picks the turn order: `"classic"` is the single-player order (White acts and fires, Black fires, Black acts) and `"pvp"` the symmetric one. `opponent` is `"bot"` (the built-in AI; classic only, with the agent on White; set `difficulty` or campaign `levels`), `"random"`, or `"external"`: a Python function `(obs, masks, env_ids) -> actions` that picks the other side's moves, such as a copy of the network for self-play. `on_new_game(env_index)` runs whenever a game starts, for example to choose its opponent. Against a random or external opponent, `agentColor` picks the agent's side (random by default). Classic games default to the bot, pvp games to a random player.
- **View:** the agent always sees the board from its own side. For Black the board is rotated 180° and own and enemy swap, so one network can play both colors. Boards sit in the top-left corner of an 11×11 grid, so every campaign level fits.
- **Observation** (32 channels): own and enemy pieces by type (14); HP as a fraction and out of 5; bishop mana; pawns that can still double-step; obstacles; board cells; cells the agent can see (all of them without fog; fog hides enemy pieces); own and enemy target locks (the locking piece and the locked square); own and enemy spawns left; turns taken out of the cap; whether merging and spawning are allowed; whether the turn order is classic; and whether the agent moves first each round (White in the classic order, where the two sides don't take their turns the same way).
- **Actions** (11×11×82 + 1 = 9,923): each cell has 81 slots for "act on the square up to 4 rows and 4 columns away" and one slot for "spawn a pawn here", and one last index means skip. What a slot does depends on the target square: move onto an empty tile, merge with a friendly piece, lock onto an enemy, heal a wounded ally, or unsiege when the target is the tower's own square. A bishop on a wounded adjacent knight means heal; to get a Queen, merge the knight onto the bishop. Mask out illegal actions.
- **Rewards:** +1 for a win, −1 for a loss, 0 for a draw at `maxTurns` (both sides' turns together, 300 by default). `shaping` adds a potential-based bonus for gains in material (merge cost × health) and King health; with `gamma` set to the learner's discount it doesn't change which play is best.
- **Tests:** `node tests/encoding.test.js` checks that every legal action gets an index that decodes back to it, that Black's rotated view matches White's view of the mirrored board, and the worker protocol. `python rl/test_env.py` tests the Python side and measures speed: 15,000–18,000 agent moves per second with random actions (64 games on 16 workers).
- **Learning check:** `python rl/ppo.py --levels 0 --minutes 5` trains a small convolutional network (4 residual blocks, about 320,000 parameters) with masked PPO and prints its win rate as it goes. With 64 games in parallel on an RTX 4080 it trains at about 8,000 moves per second. On Pawn School the win rate went from 4% to 100% in about 40 seconds. In the standard game against the Easy AI (`--difficulty easy --shaping 0.5 --minutes 10`) it went from 2% to over 90% in under 2 minutes, and from about 4½ minutes on it won 99–100% of games, in about 19 moves each. The Easy AI is a simple scripted rush with little defense, so this shows the setup learns, not that the agent is strong.

### Training

`rl/train.py` trains one network in three stages, moving on once it wins often enough:

1. **Easy:** White against the Easy AI, until it wins 90% of its last 400 games.
2. **Hard:** White against the Hard AI (a random strategy each game), with a quarter of the games still against Easy, until it wins 75%.
3. **League:** most games are self-play in the single-player turn order, with the agent on either color; the rest stay against Easy (`--league-easy`, 10%) and Hard (`--league-hard`, 40%). The game's AI plays Black in that order, so this is where the agent learns to play Black. A self-play opponent is the current network (`--latest-prob`, half the games), one of the last `--pool` (10) snapshots, or, with `--hall-every N`, a hall of fame of snapshots from every N-th update that are never dropped (`--hall-prob`). Only 4 recent snapshots and 1 hall-of-fame network are in play at a time, swapped every 10 updates (`--active-opponents`, `--refresh-opponents`), so each step runs only a handful of networks.

A stage also ends after 400 updates without reaching its win rate. Shaping starts at 0.5 and fades to 0 over the first 400 league updates, leaving only win/loss rewards. The network has 6 residual blocks of 96 channels (about a million parameters) and plays 192 games at a time. On CUDA it trains in bfloat16 mixed precision with channels-last tensors, about 2.7× faster per minibatch than float32 on an RTX 4080. `--lr-end` and `--entropy-end` lower the learning rate and the entropy bonus linearly over the run's `--minutes`.

```bash
python rl/train.py --minutes 60
python rl/train.py --resume <run folder>/latest.pt --minutes 60
# the 8-hour continuation behind the Hard AI
python rl/train.py --resume <run folder>/latest.pt --minutes 480 --lr-end 5e-5 --entropy-end 0.002 --league-easy 0.05 --league-hard 0.15 --pool 20 --snapshot-every 100 --latest-prob 0.4 --hall-every 1000 --hall-prob 0.2 --eval-every 500
```

- **Output:** a new folder under `%LOCALAPPDATA%\semuncraft-rl\runs` (outside Google Drive) with `log.csv` (win rates by opponent, entropy, learning rate, speed), `eval.csv`, `snapshots/` (every `--snapshot-every` updates, 50 by default, plus `league_start.pt` and `run_start_<update>.pt`), `latest.pt` (everything needed to resume) and `final.pt` (the network's weights).
- **Evaluation:** every 200 updates (`--eval-every`), 100 games from the same seeds each time against Easy and against Hard (with win rates by strategy); in the league stage also, by color, against the network from the start of the league, the network from the start of this run (twice: sampling moves as in training, and with the trained network always playing its most likely move) and the network from the previous evaluation.
- **Stopping:** a run ends after `--minutes`. `latest.pt` is saved with every snapshot, so killing the process loses at most one snapshot interval.
- **The runs behind the browser AIs:** the first run (60 minutes) passed the Easy stage at update 99 and the Hard stage at 365, then played the league until update 929 (11.4M training moves); Easy and Medium are its updates 100 and 400. The 8-hour continuation started from its last network and reached update 10,547 (129.6M training moves, 3.05M games, about 4,200 moves per second). From update 1,500 on, it won 93–100% of its evaluation games against the built-in Hard AI and 90–100% against the network it started from; at its last two evaluations it won every game against Easy and Hard and 98–100% against its starting network.

### Trained AI Opponents

In Single Player a trained network plays Black. **Easy** plays `models/easy.js` (update 100 of the first training run) and **Medium** `models/medium.js` (update 400); both pick moves by sampling their policy, as in training. **Hard** plays `models/ai-1.js`, the last network of the 8-hour run (update 10,547), at temperature 0.25: it leans toward its most likely moves but keeps some variety. Over 1,000 games each against itself playing normally, temperatures 0, 0.05, 0.25, 0.5 and 1 scored within a few points of each other, and 0.25 scored best (53%, counting draws as half); at every temperature it beat the built-in Hard AI in 99.5–99.7% of games. It beats the network the run started from (update 929) in 98.7% of games, Medium and Easy in 99.8–99.9%, and its own checkpoints from updates 10,000, 9,000, 8,000 and 6,000 by 54–36, 57–30, 64–22 and 80–9 (wins–losses per 100 games; the rest were draws).

- **How a turn works:** `js/netai.js` turns the game's variables (pieces, terrain, turn counters, spawns, target locks) into an engine state with `SemunEngine.fromSnapshot`, the network picks a legal move, and `SemunEngine.act` applies just that move. The board and target locks are copied back into the game, the move is animated and logged, and the game's own `finishBlackTurn()` carries on, so attacks and upkeep still run through the original code. After a knight's L-jump merge the network moves again. `tests/netai.test.js` plays games through this path (random moves stand in for the network) and checks the game against the engine after every turn.
- **Who plays Black** (`aiAct()` in `ai.js`): the scripted enemy in the tutorial, the built-in campaign AI in the campaign, Claude on Hard when an API key is entered, and the trained network otherwise. If a network can't load, the built-in AI plays the turn.
- **Loading:** starting a game loads the engine, `rl/encoding.js`, `js/nn.js` and that difficulty's weights (2.8 MB) in the background; if Black's first turn comes first, the status shows "Loading the AI…" until they arrive. A move takes about 100 ms. The network sees the whole board, as in training (no fog of war), and doesn't see animals.
- **Changing the models:** the difficulty → model table is `NETAI_LEVELS` at the top of `js/netai.js`. `python rl/export_web.py --checkpoints <run folder>/snapshots/update_000100.pt <run folder>/snapshots/update_000400.pt --names easy medium` writes Easy and Medium; `--run <run folder>` writes `ai-1` and `ai-2` (see below).

### AI vs AI

**🤖 AI vs AI** on the main menu shows the two most-trained networks playing each other on the selected map theme. They swap colors every match, and the result screen keeps a running score.

- **How it runs:** matches are simulated by `js/engine.js` (the game's rules, checked by the parity tests) and drawn on the normal board: pieces slide, hits flash and the log lists every move. Both AIs play in the single-player turn order and pick moves by sampling their policy, as in training. There's no fog of war and there are no animals.
- **Controls:** Pause, Speed (1×, 2×, 4× or 8×; at 4× and faster, animations and sounds are skipped) and New Match take the place of Spawn, Merge and Skip. Menu ends the match.
- **Files:** `js/aivsai.js` is the mode. The first time it starts, it loads (through `js/netai.js`) `js/engine.js`, `rl/encoding.js`, `js/nn.js` (the network in plain JavaScript, about 100 ms per move) and the weights in `models/ai-1.js` and `models/ai-2.js` (half precision, 2.8 MB each). This works on GitHub Pages and from a double-clicked `SemunCraft.html`.
- **Updating the AIs:** `python rl/export_web.py --run <run folder>` exports a run's two most-trained networks to `models/` (AI #1 is the newer one, and also plays Hard) and checks `js/nn.js` against PyTorch on real positions. Bump the `?v=` version in `SemunCraft.html` when you publish new weights.

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
- Attack animations use flying emoji projectiles, SVG cannonballs and SVG arrow overlays. A pawn (and a fortified pawn, the same drawing in a helmet) swings its own sword instead: the blade sweeps **120°**, from 30° back over the shoulder to 90° forward, and the pawn goes with it — stepping back as the blade lifts and driving forward through the blow, along the line to that enemy whichever way it lies, diagonals included — the sword is drawn and turned on its own (`pieceSword` / `pieceWithoutSword` in `pieces/pieces.js`, turning about the hand). The drawing is mirrored for an enemy on the left, so the sword hand always leads and the shield falls to the hand on the far side (`attackAnim` in `js/combat.js`).
- Board auto-resizes to fit the viewport, with separate portrait and landscape mobile layouts.
- Pieces are drawn as SVG from the `pieces/` folder. Each type has its own cute silhouette and size: a small round pawn holding a sword and a buckler (fortified: an iron helmet and a heater shield in its team’s colour), a horse-head knight, a mitred bishop with a green healing cross and a staff, a castle rook, a slim queen with long hair, a tall three-point crown and a sceptre, a broad bearded king under a flat crown with a cross, and a stub tower with a cannon barrel out of the roof for the siege tower. Bodies use the team colour (light White, dark Black) with a slight tint per type -- knights bluish, bishops greenish, rooks brick, queens pink, kings gold, siege towers stone. A dark outline plus a contrasting halo keeps them readable on any tile. Map themes only change crown/gem colours and the ground under each piece: grass and a flower (jungle), sand and a cactus (desert), ripples and bubbles (ocean). Open `pieces/preview.html` to see every set, including a solid-silhouette check.
