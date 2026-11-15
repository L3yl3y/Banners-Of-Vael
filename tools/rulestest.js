const E = require("../src/engine.js");
let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed++;
  } else {
    failed++;
    let text = "";
    if (detail !== undefined) {
      text = JSON.stringify(detail);
    }
    console.log("FAIL:", label, text);
  }
}

function blank(seed) {
  const s = E.createGame({ seed: seed || 5 });
  Object.keys(s.areas).forEach(id => {
    s.areas[id].units = [];
    s.areas[id].order = null;
    s.areas[id].ptoken = null;
    s.areas[id].neutral = 0;
  });
  s.tasks = [];
  s.pending = null;
  s.log = [];
  return s;
}

function put(s, area, house, types) {
  types.forEach(t => s.areas[area].units.push({ t: t, h: house, r: false }));
}

function order(s, area, house, token) {
  s.areas[area].order = { h: house, id: token };
}

function startPhase(s, task) {
  s.tasks = [task];
  s.pending = null;
  E.advance(s);
}

function act(s, house, action) {
  const r = E.applyAction(s, house, action);
  if (!r.ok) {
    console.log("  action rejected:", house, JSON.stringify(action), r.error);
  }
  return r;
}

// A. Battle with defence, castle bonus and own support; attacker wins 8 to 7, no casualties, defender retreats.
(function () {
  const s = blank();
  put(s, "fenwick", "thorne", ["knight", "footman"]);
  order(s, "fenwick", "thorne", "m1");
  put(s, "oldford", "vantar", ["footman"]);
  order(s, "oldford", "vantar", "d1a");
  put(s, "sunhallow", "vantar", ["knight"]);
  order(s, "sunhallow", "vantar", "s0a");
  put(s, "redfield", "vantar", ["footman"]);
  order(s, "redfield", "vantar", "d1b");
  s.areas.highspire.neutral = 7;
  s.areas.stonebridge.neutral = 4;
  s.areas.greyvale.ptoken = "thorne";
  startPhase(s, { t: "marches", turn: 0 });
  check("A pending march for thorne", s.pending && s.pending.kind === "march" && s.pending.houses[0] === "thorne", s.pending);
  act(s, "thorne", { type: "march", from: "fenwick", moves: [{ to: "oldford", units: [0, 1] }] });
  check("A leaders prompt", s.pending && s.pending.kind === "leader", s.pending);
  act(s, "thorne", { type: "leader", card: "t4" });
  act(s, "vantar", { type: "leader", card: "v2b" });
  check("A blade prompt for thorne (Sword leader)", s.pending && s.pending.kind === "blade" && s.pending.houses[0] === "thorne", s.pending);
  check("A thorne total 8", s.combat.sides.thorne.total === 8, s.combat.sides.thorne);
  check("A vantar total 7", s.combat.sides.vantar.total === 7, s.combat.sides.vantar);
  act(s, "thorne", { type: "blade", use: false });
  check("A retreat prompt with redfield and sunhallow", s.pending && s.pending.kind === "retreat" && s.pending.options.slice().sort().join() === "redfield,sunhallow", s.pending);
  act(s, "vantar", { type: "retreat", to: "redfield" });
  check("A thorne holds oldford", s.areas.oldford.units.length === 2 && s.areas.oldford.units[0].h === "thorne");
  check("A retreated footman routed in redfield", s.areas.redfield.units.length === 2 && s.areas.redfield.units.some(u => u.r));
  check("A defender order removed", s.areas.oldford.order === null);
  check("A cards discarded", s.houses.thorne.discard.indexOf("t4") >= 0 && s.houses.vantar.discard.indexOf("v2b") >= 0);
  check("A fenwick empty", s.areas.fenwick.units.length === 0);
})();

// B. Tie goes to the Sword track; casualties equal swords minus towers.
(function () {
  const s = blank();
  s.tracks.sword = ["vantar", "thorne", "calder"];
  put(s, "fenwick", "thorne", ["footman", "footman"]);
  order(s, "fenwick", "thorne", "m0");
  put(s, "oldford", "vantar", ["footman", "footman"]);
  order(s, "oldford", "vantar", "ca");
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "fenwick", moves: [{ to: "oldford", units: [0, 1] }] });
  act(s, "thorne", { type: "leader", card: "t2a" });
  act(s, "vantar", { type: "leader", card: "v2a" });
  check("B blade offered to vantar", s.pending && s.pending.kind === "blade" && s.pending.houses[0] === "vantar", s.pending);
  act(s, "vantar", { type: "blade", use: false });
  check("B vantar wins the tie on the sword track", s.lastBattle && s.lastBattle.winner === "vantar" && s.lastBattle.tieReason === "sword", s.lastBattle);
  check("B attacker lost 1 unit (1 sword, 0 towers)", s.areas.fenwick.units.length === 1, s.areas.fenwick.units);
  check("B attacker survivors routed back home", s.areas.fenwick.units.every(u => u.r));
})();

// C. Raids: starred raid removes defence; raiding consolidate steals power.
(function () {
  const s = blank();
  put(s, "fenwick", "thorne", ["footman"]);
  order(s, "fenwick", "thorne", "r1");
  put(s, "greyvale", "thorne", ["footman"]);
  order(s, "greyvale", "thorne", "ra");
  put(s, "oldford", "vantar", ["footman"]);
  order(s, "oldford", "vantar", "d1a");
  put(s, "highspire", "calder", ["footman"]);
  order(s, "highspire", "calder", "ca");
  s.houses.thorne.power = 3;
  s.houses.calder.power = 3;
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "raids", turn: 0 });
  check("C star raid can target defence", E.raidTargets(s, "thorne", "fenwick").indexOf("oldford") >= 0);
  check("C plain raid cannot target defence", E.raidTargets(s, "thorne", "greyvale").indexOf("oldford") < 0);
  act(s, "thorne", { type: "raid", from: "fenwick", target: "oldford" });
  check("C defence removed", s.areas.oldford.order === null);
  act(s, "thorne", { type: "raid", from: "greyvale", target: "highspire" });
  check("C consolidate removed", s.areas.highspire.order === null);
  check("C power stolen", s.houses.thorne.power === 4 && s.houses.calder.power === 2, [s.houses.thorne.power, s.houses.calder.power]);
})();

// D. Sea transport and supply limits.
(function () {
  const s = blank();
  put(s, "briarwood", "thorne", ["footman", "knight"]);
  order(s, "briarwood", "thorne", "m0");
  put(s, "greyreach", "thorne", ["ship"]);
  const reach = E.landReach(s, "briarwood", "thorne");
  check("D vineholm reachable by ship", reach.vineholm === "ship", reach);
  check("D sunhallow not reachable", !reach.sunhallow);
  s.houses.thorne.supply = 0;
  put(s, "fenwick", "thorne", ["footman", "footman"]);
  const r = E.analyseMarch(s, "thorne", { type: "march", from: "briarwood", moves: [{ to: "fenwick", units: [0] }] });
  check("D supply 0 forbids an army of 3", !r.ok, r);
  s.houses.thorne.supply = 1;
  const r2 = E.analyseMarch(s, "thorne", { type: "march", from: "briarwood", moves: [{ to: "fenwick", units: [0] }] });
  check("D supply 1 allows armies 3 and 1", r2.ok, r2);
  const r3 = E.analyseMarch(s, "thorne", { type: "march", from: "briarwood", moves: [{ to: "vineholm", units: [0, 1] }] });
  check("D sea transport march legal", r3.ok, r3);
})();

// E. Neutral forces and leaving a power token.
(function () {
  const s = blank();
  s.areas.ashgate.neutral = 5;
  put(s, "thornhold", "thorne", ["knight", "footman"]);
  order(s, "thornhold", "thorne", "m1");
  put(s, "frostfell", "thorne", ["footman"]);
  order(s, "frostfell", "thorne", "s0a");
  put(s, "greyvale", "thorne", ["footman"]);
  order(s, "greyvale", "thorne", "m0");
  const weak = E.analyseMarch(s, "thorne", { type: "march", from: "greyvale", moves: [{ to: "ashgate", units: [0] }] });
  check("E 1 footman + support 1 cannot beat 5", !weak.ok, weak);
  const strong = E.analyseMarch(s, "thorne", { type: "march", from: "thornhold", moves: [{ to: "ashgate", units: [0, 1] }] });
  check("E knight+footman+1+support 1 = 5 beats 5", strong.ok, strong);
  s.houses.thorne.power = 2;
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "greyvale", moves: [{ to: "fenwick", units: [0] }], leaveToken: true });
  check("E token left in greyvale", s.areas.greyvale.ptoken === "thorne" && s.houses.thorne.power === 1);
  check("E greyvale still thorne's", E.controller(s, "greyvale") === "thorne");
  act(s, "thorne", { type: "march", from: "thornhold", moves: [{ to: "ashgate", units: [0, 1] }] });
  check("E ashgate captured, neutral gone", s.areas.ashgate.units.length === 2 && s.areas.ashgate.neutral === 0);
  check("E thornhold empty but still thorne's", s.areas.thornhold.units.length === 0 && E.controller(s, "thornhold") === "thorne");
})();

// F. Garrison: attacking an empty enemy home fights its garrison.
(function () {
  const s = blank();
  put(s, "redfield", "thorne", ["knight", "knight"]);
  order(s, "redfield", "thorne", "m0");
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "redfield", moves: [{ to: "sunhallow", units: [0, 1] }] });
  check("F garrison battle asks for leaders", s.pending && s.pending.kind === "leader" && s.combat.def === "vantar", s.pending);
  act(s, "thorne", { type: "leader", card: "t1b" });
  act(s, "vantar", { type: "leader", card: "v1a" });
  if (s.pending && s.pending.kind === "blade") {
    act(s, s.pending.houses[0], { type: "blade", use: false });
  }
  check("F garrison counted 2", s.lastBattle.sides.vantar.garrison === 2, s.lastBattle.sides.vantar);
  check("F thorne 4+1=5 beats 2+1=3", s.lastBattle.winner === "thorne", s.lastBattle.sides);
  check("F garrison destroyed and home taken", s.areas.sunhallow.garrison === 0 && E.controller(s, "sunhallow") === "thorne");
  check("F brother ivo gave 2 power", s.houses.thorne.power === 7, s.houses.thorne.power);
})();

// G. Leader cards return after the seventh is played.
(function () {
  const s = blank();
  s.houses.thorne.hand = ["t0"];
  s.houses.thorne.discard = ["t4", "t3", "t2a", "t2b", "t1a", "t1b"];
  put(s, "fenwick", "thorne", ["footman"]);
  order(s, "fenwick", "thorne", "m0");
  put(s, "oldford", "vantar", ["knight"]);
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "fenwick", moves: [{ to: "oldford", units: [0] }] });
  act(s, "thorne", { type: "leader", card: "t0" });
  act(s, "vantar", { type: "leader", card: "v4" });
  if (s.pending && s.pending.kind === "blade") {
    act(s, s.pending.houses[0], { type: "blade", use: false });
  }
  check("G Little Tamsin returns on a loss", s.houses.thorne.hand.indexOf("t0") >= 0, s.houses.thorne);
  check("G attacker with 1 footman lost it to 2 swords", s.areas.fenwick.units.length === 0);
  const s2 = blank();
  s2.houses.thorne.hand = ["t4"];
  s2.houses.thorne.discard = ["t0", "t3", "t2a", "t2b", "t1a", "t1b"];
  put(s2, "fenwick", "thorne", ["footman"]);
  order(s2, "fenwick", "thorne", "m0");
  put(s2, "oldford", "vantar", ["footman"]);
  s2.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s2, { t: "marches", turn: 0 });
  act(s2, "thorne", { type: "march", from: "fenwick", moves: [{ to: "oldford", units: [0] }] });
  act(s2, "thorne", { type: "leader", card: "t4" });
  act(s2, "vantar", { type: "leader", card: "v0" });
  if (s2.pending && s2.pending.kind === "blade") {
    act(s2, s2.pending.houses[0], { type: "blade", use: false });
  }
  if (s2.pending && s2.pending.kind === "retreat") {
    act(s2, "vantar", { type: "retreat", to: s2.pending.options[0] });
  }
  check("G hand refilled with six, last card stays discarded", s2.houses.thorne.hand.length === 6 && s2.houses.thorne.discard.join() === "t4", s2.houses.thorne);
  check("G Grey Steward: no casualties for the loser", s2.lastBattle.casualties === 0 && s2.lastBattle.winner === "thorne");
})();

// H. Consolidate power, with crowns and the starred choice.
(function () {
  const s = blank();
  put(s, "fenwick", "thorne", ["footman"]);
  order(s, "fenwick", "thorne", "ca");
  put(s, "thornhold", "thorne", ["footman"]);
  order(s, "thornhold", "thorne", "c1");
  put(s, "frostmere", "thorne", ["ship"]);
  order(s, "frostmere", "thorne", "cb");
  s.houses.thorne.power = 0;
  startPhase(s, { t: "consolidate" });
  check("H starred order in stronghold asks", s.pending && s.pending.kind === "consolidateChoice", s.pending);
  act(s, "thorne", { type: "consolidateChoice", choice: "muster" });
  check("H muster prompt with 2 points", s.pending && s.pending.kind === "muster" && s.pending.areas[0].points === 2, s.pending);
  const bad = E.validateMuster(s, "thorne", [{ area: "thornhold", kind: "knight" }, { area: "thornhold", kind: "footman" }], s.pending.areas);
  check("H 3 points rejected", !bad.ok, bad);
  act(s, "thorne", { type: "muster", builds: [{ area: "thornhold", kind: "knight" }] });
  check("H knight mustered", s.areas.thornhold.units.some(u => u.t === "knight"));
  check("H fenwick gives 1+1, sea gives 0, mustering gives none", s.houses.thorne.power === 2 && s.pending === null, s.houses.thorne.power);
})();

// I. Horde attack: the gate holds, tie for highest goes to the Crown holder's pick.
(function () {
  const s = blank();
  s.threat = 6;
  ["thorne", "calder", "vantar"].forEach(h => {
    s.houses[h].power = 5;
  });
  s.hordeDeck = ["witch", "burning", "gate", "famine", "oathbreakers", "empty", "bones", "warlord"];
  startPhase(s, { t: "horde" });
  act(s, "thorne", { type: "hordeBid", amount: 3 });
  act(s, "calder", { type: "hordeBid", amount: 3 });
  act(s, "vantar", { type: "hordeBid", amount: 0 });
  check("I tie pick asked of crown holder", s.pending && s.pending.kind === "tiePick" && s.pending.houses[0] === s.tracks.crown[0], s.pending);
  act(s, s.tracks.crown[0], { type: "tiePick", pick: "calder" });
  check("I threat reset to 0", s.threat === 0);
  check("I calder refunded 3 by the Ash Witch", s.houses.calder.power === 5 && s.houses.thorne.power === 2, [s.houses.calder.power, s.houses.thorne.power]);
  const s2 = blank();
  s2.threat = 10;
  ["thorne", "calder", "vantar"].forEach(h => {
    s2.houses[h].power = 4;
  });
  put(s2, "fenwick", "vantar", ["footman", "footman"]);
  put(s2, "oldford", "thorne", ["knight"]);
  put(s2, "greyvale", "calder", ["knight"]);
  s2.hordeDeck = ["famine", "witch"];
  s2.houses.vantar.supply = 3;
  s2.houses.thorne.supply = 3;
  s2.houses.calder.supply = 3;
  startPhase(s2, { t: "horde" });
  act(s2, "thorne", { type: "hordeBid", amount: 2 });
  act(s2, "calder", { type: "hordeBid", amount: 2 });
  act(s2, "vantar", { type: "hordeBid", amount: 1 });
  check("I2 horde wins, threat drops by 4", s2.threat === 6, s2.threat);
  check("I2 famine: lowest -2, others -1", s2.houses.vantar.supply === 1 && s2.houses.thorne.supply === 2 && s2.houses.calder.supply === 2, [s2.houses.vantar.supply, s2.houses.thorne.supply]);
})();

// J. Contest of influence with a tie.
(function () {
  const s = blank();
  s.tracks.crown = ["calder", "thorne", "vantar"];
  ["thorne", "calder", "vantar"].forEach(h => {
    s.houses[h].power = 5;
  });
  startPhase(s, { t: "contest", track: "crown" });
  act(s, "thorne", { type: "bid", amount: 2 });
  act(s, "calder", { type: "bid", amount: 1 });
  act(s, "vantar", { type: "bid", amount: 2 });
  check("J tie decided by the old crown holder", s.pending && s.pending.kind === "tieOrder" && s.pending.houses[0] === "calder", s.pending);
  act(s, "calder", { type: "tieOrder", order: ["vantar", "thorne"] });
  check("J new crown order", s.tracks.crown.join() === "vantar,thorne,calder", s.tracks.crown);
  check("J bids spent", s.houses.thorne.power === 3 && s.houses.calder.power === 4);
})();

// K. Orders: special order limit and restrictions.
(function () {
  const s = blank();
  s.tracks.court = ["calder", "vantar", "thorne"];
  put(s, "fenwick", "thorne", ["footman"]);
  put(s, "greyvale", "thorne", ["footman"]);
  put(s, "thornhold", "thorne", ["footman"]);
  put(s, "oldford", "vantar", ["footman"]);
  put(s, "tidegate", "calder", ["footman"]);
  startPhase(s, { t: "planning" });
  const r = act(s, "thorne", { type: "orders", orders: { fenwick: "m1", greyvale: "d2", thornhold: "s1" } });
  check("K third special order rejected at Court 3", !r.ok);
  s.restrict = { noRaid: true };
  const r2 = act(s, "thorne", { type: "orders", orders: { fenwick: "m1", greyvale: "ra", thornhold: "s0a" } });
  check("K raid forbidden by Storm Season", !r2.ok);
  const r3 = act(s, "thorne", { type: "orders", orders: { fenwick: "m1", greyvale: "d2", thornhold: "s0a" } });
  check("K legal orders accepted", r3.ok);
  check("K still waiting for others", s.pending.houses.indexOf("thorne") < 0 && s.pending.houses.length === 2);
})();

// L. Attacker siege engine destroyed on retreat; siege engine strength 4 against a castle only.
(function () {
  const s = blank();
  const unitsCastle = E.unitStrength({ t: "siege", r: false }, true, false);
  const unitsField = E.unitStrength({ t: "siege", r: false }, false, false);
  check("L siege 4 against castle, 0 elsewhere", unitsCastle === 4 && unitsField === 0);
  put(s, "fenwick", "thorne", ["siege", "footman"]);
  order(s, "fenwick", "thorne", "m-1");
  put(s, "oldford", "vantar", ["knight", "knight"]);
  order(s, "oldford", "vantar", "d2");
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "fenwick", moves: [{ to: "oldford", units: [0, 1] }] });
  act(s, "thorne", { type: "leader", card: "t0" });
  act(s, "vantar", { type: "leader", card: "v3" });
  if (s.pending && s.pending.kind === "blade") {
    act(s, s.pending.houses[0], { type: "blade", use: false });
  }
  check("L attack 4+1-1=4 vs 4+2+3=9 loses", s.lastBattle.winner === "vantar", s.lastBattle.sides);
  check("L siege engine destroyed in the retreat, footman routed home", s.areas.fenwick.units.length === 1 && s.areas.fenwick.units[0].t === "footman" && s.areas.fenwick.units[0].r, s.areas.fenwick.units);
  check("L Iselde steals 1 power", s.houses.vantar.power === 6 && s.houses.thorne.power === 4, [s.houses.vantar.power, s.houses.thorne.power]);
})();

// M. Third-party support and Corin Calder ignoring it.
(function () {
  const s = blank();
  put(s, "goldmarch", "calder", ["knight"]);
  order(s, "goldmarch", "calder", "m0");
  put(s, "stonebridge", "vantar", ["footman"]);
  order(s, "stonebridge", "vantar", "d1a");
  put(s, "oldford", "thorne", ["knight"]);
  order(s, "oldford", "thorne", "s1");
  s.tracks.crown = ["calder", "thorne", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "calder", { type: "march", from: "goldmarch", moves: [{ to: "stonebridge", units: [0] }] });
  check("M thorne asked for support", s.pending && s.pending.kind === "support" && s.pending.houses[0] === "thorne", s.pending);
  act(s, "thorne", { type: "support", side: "def" });
  act(s, "calder", { type: "leader", card: "c3" });
  act(s, "vantar", { type: "leader", card: "v1b" });
  if (s.pending && s.pending.kind === "blade") {
    act(s, s.pending.houses[0], { type: "blade", use: false });
  }
  check("M thorne's support ignored by Corin", s.lastBattle.sides.vantar.support === 0, s.lastBattle.sides.vantar);
  check("M calder 2+3=5 beats vantar 1+1+1=3", s.lastBattle.winner === "calder", s.lastBattle.sides);
})();

// N. Victory at seven castles ends the game at once.
(function () {
  const s = blank();
  ["thornhold", "greyvale", "ashgate", "gullcliff", "stonebridge", "hollowmere"].forEach(id => put(s, id, "thorne", ["footman"]));
  put(s, "duskmarsh", "thorne", ["footman"]);
  order(s, "duskmarsh", "thorne", "m0");
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "duskmarsh", moves: [{ to: "highspire", units: [0] }] });
  check("N thorne wins with 7", s.winner === "thorne" && s.phase === "over", [s.winner, E.castleCount(s, "thorne")]);
})();


// O. Review fixes: end-game tiebreak on strongholds.
(function () {
  const s = blank();
  ["thornhold", "highspire", "greyvale", "ashgate", "gullcliff"].forEach(id => put(s, id, "thorne", ["footman"]));
  ["saltcrest", "tidegate", "stormwatch", "ravenmoor", "goldmarch"].forEach(id => put(s, id, "calder", ["footman"]));
  s.houses.thorne.supply = 3;
  s.houses.calder.supply = 4;
  s.round = 10;
  startPhase(s, { t: "cleanup" });
  check("O strongholds break the castle tie before supply", s.winner === "thorne", s.finalScores);
})();

// P. Review fixes: a supply-limited retreat destroys only retreating units.
(function () {
  const s = blank();
  s.houses.vantar.supply = 0;
  put(s, "oldford", "vantar", ["knight", "knight"]);
  put(s, "sunhallow", "vantar", ["footman", "footman"]);
  put(s, "redfield", "vantar", ["footman"]);
  put(s, "fenwick", "thorne", ["knight", "knight", "footman"]);
  order(s, "fenwick", "thorne", "m1");
  s.houses.thorne.supply = 2;
  s.areas.highspire.neutral = 7;
  s.areas.stonebridge.neutral = 4;
  s.areas.greyvale.ptoken = "thorne";
  s.tracks.crown = ["thorne", "calder", "vantar"];
  startPhase(s, { t: "marches", turn: 0 });
  act(s, "thorne", { type: "march", from: "fenwick", moves: [{ to: "oldford", units: [0, 1, 2] }] });
  act(s, "thorne", { type: "leader", card: "t3" });
  act(s, "vantar", { type: "leader", card: "v0" });
  if (s.pending && s.pending.kind === "blade") {
    act(s, s.pending.houses[0], { type: "blade", use: false });
  }
  if (s.pending && s.pending.kind === "retreat") {
    act(s, "vantar", { type: "retreat", to: "redfield" });
  }
  const red = s.areas.redfield.units;
  check("P the footman already in Redfield survives", red.some(u => u.t === "footman" && !u.r), red);
  check("P vantar fits supply afterwards", E.supplyOk(s, "vantar"), E.houseUnitCounts(s, "vantar"));
})();

// Q. Review fixes: upgrades in two different castles in one muster.
(function () {
  const s = blank();
  put(s, "thornhold", "thorne", ["footman"]);
  put(s, "greyvale", "thorne", ["footman"]);
  const areas = [{ area: "thornhold", points: 2 }, { area: "greyvale", points: 1 }];
  const r = E.validateMuster(s, "thorne", [{ area: "thornhold", kind: "upKnight", unit: 0 }, { area: "greyvale", kind: "upKnight", unit: 0 }], areas);
  check("Q two upgrades in different castles accepted", r.ok, r);
})();

// R. Review fixes: automatic downgrade with no Footmen left destroys the Knights only.
(function () {
  const s = blank();
  ["saltcrest", "tidegate", "stormwatch", "capesorrow", "goldmarch", "hollowmere", "ravenmoor", "cinderfell", "frostfell", "fenwick"].forEach(id => put(s, id, "calder", ["footman"]));
  put(s, "duskmarsh", "calder", ["knight", "knight", "siege"]);
  startPhase(s, { t: "downgrade", h: "calder", count: 2 });
  const left = s.areas.duskmarsh.units.map(u => u.t).join();
  check("R siege engine kept, both knights gone", left === "siege", left);
})();

// S. Review fixes: Gatebreakers penalty for the other houses.
(function () {
  const s = blank();
  s.threat = 8;
  ["thorne", "calder", "vantar"].forEach(h => {
    s.houses[h].power = 4;
  });
  s.tracks.crown = ["thorne", "calder", "vantar"];
  s.hordeDeck = ["gate"];
  startPhase(s, { t: "horde" });
  act(s, "thorne", { type: "hordeBid", amount: 2 });
  act(s, "calder", { type: "hordeBid", amount: 2 });
  act(s, "vantar", { type: "hordeBid", amount: 1 });
  check("S lowest bidder to the bottom of Sword and Court", s.tracks.sword[2] === "vantar" && s.tracks.court[2] === "vantar", s.tracks);
  check("S other houses each lose 1 power", s.houses.thorne.power === 1 && s.houses.calder.power === 1, [s.houses.thorne.power, s.houses.calder.power]);
})();

// T. Review fixes: The Turning Year is shuffled back into its deck.
(function () {
  const s = E.createGame({ seed: 78 });
  s.decks.I = [{ c: "turning1", w: 0 }];
  s.tasks = [{ t: "westeros" }];
  s.pending = null;
  E.advance(s);
  const total = s.decks.I.length + 1;
  const inDeck = s.decks.I.some(c => c.c === "turning1");
  check("T reshuffled deck has all 10 cards, The Turning Year included", total === 10 && inDeck && s.drawn.I.c !== "turning1", [total, inDeck, s.drawn.I]);
  let notLast = 0;
  for (let seed = 100; seed < 140; seed++) {
    const g = E.createGame({ seed: seed });
    g.decks.I = [{ c: "turning1", w: 0 }];
    g.tasks = [{ t: "westeros" }];
    g.pending = null;
    E.advance(g);
    const at = g.decks.I.findIndex(c => c.c === "turning1");
    if (at >= 0 && at < g.decks.I.length - 1) {
      notLast++;
    }
  }
  check("T The Turning Year is shuffled in, not pinned to the bottom", notLast > 20, notLast);
})();


// U. More areas than usable tokens: the engine accepts the maximum it can place.
(function () {
  const s = blank();
  s.restrict = { noConsolidate: true };
  s.tracks.court = ["calder", "vantar", "thorne"];
  const areas = ["saltcrest", "tidegate", "stormwatch", "capesorrow", "goldmarch", "hollowmere", "ravenmoor", "cinderfell", "duskmarsh", "highspire", "teeth", "kestrelsound"];
  areas.forEach(id => {
    if (E.AREA[id].type === "sea") {
      put(s, id, "calder", ["ship"]);
    } else {
      put(s, id, "calder", ["footman"]);
    }
  });
  put(s, "oldford", "vantar", ["footman"]);
  put(s, "fenwick", "thorne", ["footman"]);
  check("U usable tokens is 11 under Lean Harvest at Court 1", E.usableTokenCount(s, "calder") === 11, E.usableTokenCount(s, "calder"));
  startPhase(s, { t: "planning" });
  const tokens = ["m-1", "m0", "m1", "d1a", "d1b", "d2", "s0a", "s0b", "ra", "rb", "s1"];
  const orders = {};
  areas.slice(0, 11).forEach((id, i) => {
    orders[id] = tokens[i];
  });
  const r = act(s, "calder", { type: "orders", orders: orders });
  check("U eleven orders for twelve areas accepted", r.ok, r);
})();

console.log("rule scenarios:", passed, "passed,", failed, "failed");
