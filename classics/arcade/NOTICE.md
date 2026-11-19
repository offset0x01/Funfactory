# Notice

This folder contains a modified copy of **Retro Arcade Collection**.

- Original project: Retro Arcade Collection (Phaser 4 edition)
- Author: Alfredo De Donno ("Sir Alfry")
- Upstream: https://github.com/sirAlfry/retro-arcade-collection-phaser
- Based on commit: `85224fd`
- License: MIT (see `LICENSE`, included unchanged)

## Changes made for Fun Factory

- Translated all player-visible text from Italian to English: launcher, game
  catalog (descriptions, controls, touch help, record labels), pause and
  game-over menus, in-game labels and messages, settings notices, virtual pad
  labels, loading screen, `file://` warning, page title and meta description,
  `manifest.json` name and description, `<html lang="en">`, manifest `lang`.
  Code comments and console messages were left in Italian.
- Changed two display names (display text only; code identifiers, scene keys
  and localStorage keys are untouched): "Tetris" is shown as "Block Drop" and
  "Space Invaders" is shown as "Star Defenders". The 4-line clear call-out
  "TETRIS!" now reads "FOUR LINES!".
- Trimmed the package to what the game needs to run: `index.html`,
  `manifest.json`, `sw.js`, `LICENSE`, `assets/icons/` and `src/`. Left out
  docs, tests, tools, README, CHANGELOG, SECURITY, package and lint config,
  and the unused `assets/retro_arcade_collection.png`.
- Service worker cache name changed to `funfactory-classic-arcade-v1` so it
  cannot collide with other caches.
- The `file://` warning in `index.html` now suggests `bunx serve` or
  `python3 -m http.server` instead of `npm run dev`.
- Credits screen: the author's social media lines were replaced with a
  "SOURCE CODE" line pointing to the author's GitHub, since this is a kids' site.
