# Banners Of Vael

A strategy game of simultaneous orders, battles and shifting influence for three great houses. Every round each house secretly gives orders to its armies and fleets, the orders are revealed together, and then raids, marches and battles play out. The first house to hold seven castles and strongholds rules the realm of Vael; if nobody manages it, the strongest house after ten rounds wins.

**Play it here:** https://l3yl3y.github.io/Banners-Of-Vael/

## Features

- The full game loop: event phase with three event decks, secret planning with fifteen order tokens per house, raids, marches, battles and consolidation, mustering, supply limits, three influence tracks with blind bidding, and a horde that every house must hold back together.
- Battles with support from neighbouring areas, defence orders, home garrisons, siege engines, seven leader cards per house, the Starsteel Blade and ties broken on the Sword track.
- Bots that place orders, fight, bid and muster on their own, with a little randomness so no two games play alike.
- Online play with a friend through a four-letter room code (peer to peer, no account needed), same-device play with a pass-the-device screen, and solo play against bots.
- Learning notes on every step, a "Suggest" button that shows what a bot would do, and a complete How To Play reference in the game.
- Games save in the browser and can be resumed.

## Playing With A Friend

1. Open the game, choose your house, and set the other houses to **Friend online** or **Bot**.
2. Start the game. A four-letter room code appears at the top of the screen.
3. Your friend opens the same page, types the code under **Join A Friend** and presses **Join**.
4. Keep your page open while you play: your browser hosts the game and runs the bots. If your friend's connection drops, they can rejoin with the same code.

## Running It Locally

The site in `docs/` is a single self-contained page; open `docs/index.html` in a browser for solo or same-device play. Online play needs the page to be served (for example `python3 -m http.server` inside `docs/`) and an internet connection for the peer-to-peer broker.

To rebuild after changing the sources:

```sh
node tools/build.js
```

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/mapdata.js` | The map of Vael: area shapes, names, castles, barrels, crowns and adjacency (generated). |
| `src/rules.js` | Houses, order tokens, supply table, leader cards, event decks and horde cards. |
| `src/engine.js` | The rules engine: a deterministic state machine that validates and applies every decision. |
| `src/bot.js` | The bot players. |
| `src/ui-map.js`, `src/ui.js` | The board renderer and the interface for every decision. |
| `src/net.js`, `src/app.js` | Online play, the lobby, seats, saving and the game loop. |
| `src/style.css`, `src/body.html` | Styling, page layout and the How To Play reference. |
| `tools/genmap.js`, `tools/seeds.js` | Generates the map from seed points with a Voronoi diagram, so the drawn borders and the adjacency always agree. |
| `tools/build.js` | Builds `docs/index.html`. |
| `tools/simulate.js`, `tools/rulestest.js` | Bot-against-bot simulations with invariant checks, and targeted rule scenarios. |
| `tools/uitest.js`, `tools/nettest.js` | Plays complete games through the real interface in headless Chrome, including two browsers playing online. |

## Testing

```sh
cd tools
npm install
node rulestest.js        # rule scenarios
node simulate.js 300     # 300 bot-only games with invariant checks
node uitest.js           # a full game through the interface (needs Google Chrome)
```

## Credits

Made by L3yl3y. Fonts: IM Fell English by Igino Marini, and Alegreya Sans by Juan Pablo del Peral (Google Fonts). Online play uses [PeerJS](https://peerjs.com/).
