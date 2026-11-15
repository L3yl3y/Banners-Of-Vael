const E = require("../src/engine.js");
const BOT = require("../src/bot.js");
const R = E.RULES;

const games = Number(process.argv[2] || 200);
const stats = { wins: {}, castleWins: 0, rounds: 0, battles: 0, rejects: 0, kinds: {}, errors: 0 };
const rejectSamples = [];

function checkInvariants(state, label) {
  const problems = [];
  Object.keys(state.areas).forEach(id => {
    const area = state.areas[id];
    const owners = new Set(area.units.map(u => u.h));
    if (owners.size > 1) {
      problems.push("mixed units in " + id);
    }
    if (E.AREA[id].type === "sea" && area.units.some(u => u.t !== "ship")) {
      problems.push("land unit at sea in " + id);
    }
    if (E.AREA[id].type === "land" && area.units.some(u => u.t === "ship")) {
      problems.push("ship on land in " + id);
    }
    if (area.order && area.units.length === 0 && state.phase === "action" && false) {
      problems.push("order without units");
    }
    if (area.ptoken && E.AREA[id].type === "sea") {
      problems.push("power token at sea");
    }
  });
  R.HOUSE_ORDER.forEach(h => {
    const house = state.houses[h];
    if (house.power < 0) {
      problems.push(h + " negative power");
    }
    if (house.power + E.tokensOnBoard(state, h) > R.POWER_TOTAL) {
      problems.push(h + " too many power tokens");
    }
    ["footman", "knight", "ship", "siege"].forEach(t => {
      if (E.poolCount(state, h, t) < 0) {
        problems.push(h + " pool overflow " + t);
      }
    });
    if (house.hand.length + house.discard.length !== 7) {
      problems.push(h + " leader cards " + house.hand.length + "+" + house.discard.length);
    }
    if (house.hand.length === 0) {
      problems.push(h + " empty hand");
    }
    if (state.pending && (state.pending.kind === "orders" || state.pending.kind === "march") && !E.supplyOk(state, h)) {
      problems.push(h + " supply broken during " + state.pending.kind);
    }
    if (house.supply < 0 || house.supply > 6) {
      problems.push(h + " supply out of range");
    }
  });
  if (state.threat < 0 || state.threat > 12) {
    problems.push("threat out of range " + state.threat);
  }
  if (problems.length > 0) {
    throw new Error(label + ": " + problems.join("; "));
  }
}

for (let g = 0; g < games; g++) {
  const state = E.createGame({ seed: (Number(process.env.SEED_BASE) || 1000) + g });
  let steps = 0;
  let lastBattleRound = null;
  try {
    while (!state.winner) {
      steps++;
      if (steps > 20000) {
        throw new Error("game did not finish");
      }
      const p = state.pending;
      if (!p) {
        throw new Error("no pending and no winner; tasks=" + JSON.stringify(state.tasks.map(t => t.t)));
      }
      const h = p.houses[0];
      stats.kinds[p.kind] = (stats.kinds[p.kind] || 0) + 1;
      const action = BOT.act(state, h);
      if (!action) {
        throw new Error("bot returned nothing for " + p.kind);
      }
      const before = JSON.stringify(state.lastBattle);
      const result = E.applyAction(state, h, action);
      if (!result.ok) {
        stats.rejects++;
        if (rejectSamples.length < 12) {
          rejectSamples.push(p.kind + ": " + result.error + " " + JSON.stringify(action).slice(0, 200));
        }
        const fallback = fallbackAction(state, h);
        const second = E.applyAction(state, h, fallback);
        if (!second.ok) {
          throw new Error("fallback rejected for " + p.kind + ": " + second.error);
        }
      }
      if (JSON.stringify(state.lastBattle) !== before && state.lastBattle) {
        stats.battles++;
      }
      checkInvariants(state, "game " + g + " step " + steps + " after " + p.kind);
    }
    stats.wins[state.winner] = (stats.wins[state.winner] || 0) + 1;
    stats.rounds += state.round;
    if (E.castleCount(state, state.winner) >= R.VICTORY_CASTLES) {
      stats.castleWins++;
    }
  } catch (e) {
    stats.errors++;
    console.log("ERROR in game", g, e.message);
    if (stats.errors > 5) {
      break;
    }
  }
}

function fallbackAction(state, h) {
  const p = state.pending;
  if (p.kind === "march") {
    return { type: "march", from: E.ordersOfKind(state, h, "march")[0], moves: [] };
  }
  if (p.kind === "muster") {
    return { type: "muster", builds: [] };
  }
  if (p.kind === "raid") {
    return { type: "raid", from: E.ordersOfKind(state, h, "raid")[0], target: null };
  }
  return BOT.act(state, h);
}

console.log("games", games, "errors", stats.errors, "rejects", stats.rejects);
console.log("wins", stats.wins, "castle victories", stats.castleWins, "avg final round", (stats.rounds / games).toFixed(2), "battles/game", (stats.battles / games).toFixed(1));
console.log("decision counts", stats.kinds);
rejectSamples.forEach(s => console.log("  reject:", s));
