const E = require("../src/engine.js");
const BOT = require("../src/bot.js");
const state = E.createGame({ seed: Number(process.argv[2] || 7) });
let lastRound = 0;
while (!state.winner) {
  const h = state.pending.houses[0];
  E.applyAction(state, h, BOT.act(state, h));
  if (state.round !== lastRound) {
    lastRound = state.round;
  }
}
state.log.forEach(l => console.log("R" + l.r, l.t));
["thorne","calder","vantar"].forEach(h => console.log(h, "castles", E.castleCount(state, h), "supply", state.houses[h].supply, "power", state.houses[h].power));
