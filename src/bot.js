var BOT = (function () {
  var E = null;
  if (typeof module !== "undefined" && typeof require !== "undefined") {
    E = require("./engine.js");
  } else {
    E = ENGINE;
  }
  var R = E.RULES;
  var AREA = E.AREA;
  var ADJ = E.ADJ;

  function chance(p) {
    return Math.random() < p;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function unitPower(u, attackingCastle, defending) {
    return E.unitStrength(u, attackingCastle, defending);
  }

  function areaStrength(state, id, h, defending) {
    var total = 0;
    state.areas[id].units.forEach(function (u) {
      if (u.h === h) {
        total += unitPower(u, false, defending);
      }
    });
    return total;
  }

  function enemyThreat(state, id, h) {
    var worst = 0;
    var seen = {};
    ADJ[id].forEach(function (adj) {
      var area = state.areas[adj];
      if (area.units.length === 0 || area.units[0].h === h) {
        return;
      }
      if (AREA[id].type === "land" && AREA[adj].type === "sea") {
        return;
      }
      var enemy = area.units[0].h;
      var s = 0;
      area.units.forEach(function (u) {
        s += unitPower(u, AREA[id].castle > 0, false);
      });
      seen[enemy] = (seen[enemy] || 0) + s;
    });
    Object.keys(seen).forEach(function (h2) {
      if (seen[h2] > worst) {
        worst = seen[h2];
      }
    });
    return worst;
  }

  function areaValue(state, id, h) {
    var a = AREA[id];
    if (a.type === "sea") {
      return 0.5;
    }
    var v = a.castle * 3 + a.crowns * 1.2 + a.barrels * 1.0;
    if (a.home === h) {
      v += 6;
    }
    return v;
  }

  function leader(state) {
    var best = null;
    var bestCount = -1;
    R.HOUSE_ORDER.forEach(function (h) {
      var n = E.castleCount(state, h);
      if (n > bestCount) {
        bestCount = n;
        best = h;
      }
    });
    return best;
  }

  function targetScore(state, h, from, to, units, bonus) {
    var dest = state.areas[to];
    var info = AREA[to];
    var mine = 0;
    units.forEach(function (u) {
      mine += unitPower(u, info.castle > 0, false);
    });
    mine += bonus;
    var score = 0;
    var ctrl = E.controller(state, to);
    if (dest.neutral > 0) {
      if (mine + 1 >= dest.neutral) {
        score = 4 + info.castle * 2;
      } else {
        return -1;
      }
    } else if (dest.units.length > 0 && dest.units[0].h !== h) {
      var theirs = 0;
      dest.units.forEach(function (u) {
        theirs += unitPower(u, false, true);
      });
      if (info.home && info.home === dest.units[0].h) {
        theirs += dest.garrison;
      }
      if (mine + 1 > theirs) {
        score = 2 + areaValue(state, to, h) * 0.8;
      } else if (mine >= theirs && chance(0.3)) {
        score = 1 + areaValue(state, to, h) * 0.5;
      } else {
        return -1;
      }
    } else if (ctrl !== h) {
      if (info.home && info.home !== h && dest.garrison > 0 && ctrl === info.home) {
        if (mine >= dest.garrison + 2) {
          score = 6;
        } else {
          return -1;
        }
      } else {
        score = 1 + areaValue(state, to, h);
      }
    } else {
      score = 0.2;
    }
    return score;
  }

  function bestMarch(state, h, from) {
    var area = state.areas[from];
    var units = area.units.filter(function (u) {
      return !u.r;
    });
    if (units.length === 0) {
      return null;
    }
    var isShip = units[0].t === "ship";
    var reach = E.moveTargets(state, from, h, isShip);
    var best = null;
    Object.keys(reach).forEach(function (to) {
      var s = targetScore(state, h, from, to, units, 0) + Math.random() * 0.8;
      if (s > 0 && (!best || s > best.score)) {
        best = { to: to, score: s };
      }
    });
    return best;
  }

  function planOrders(state, h) {
    var areas = E.areasWithUnits(state, h);
    var wants = {};
    areas.forEach(function (id) {
      var info = AREA[id];
      var threat = enemyThreat(state, id, h);
      var mine = areaStrength(state, id, h, true);
      var march = bestMarch(state, h, id);
      var options = [];
      if (march) {
        options.push({ kind: "march", score: march.score + 1, target: march.to });
      }
      if (threat > 0) {
        var defScore = 1 + Math.min(4, threat - mine + 2) + areaValue(state, id, h) * 0.3;
        options.push({ kind: "defence", score: defScore });
      }
      var raidable = 0;
      ADJ[id].forEach(function (adj) {
        if (info.type === "land" && AREA[adj].type === "sea") {
          return;
        }
        var a = state.areas[adj];
        if (a.units.length > 0 && a.units[0].h !== h) {
          raidable++;
        }
      });
      if (raidable > 0) {
        options.push({ kind: "raid", score: 1.2 + raidable * 0.4 + Math.random() });
      }
      var friendlyAdj = 0;
      ADJ[id].forEach(function (adj) {
        if (info.type === "land" && AREA[adj].type === "sea") {
          return;
        }
        var a = state.areas[adj];
        if (a.units.length > 0 && a.units[0].h !== h) {
          friendlyAdj += 0.5;
        }
        if (a.neutral > 0) {
          friendlyAdj += 0.7;
        }
      });
      if (friendlyAdj > 0 || info.type === "sea") {
        options.push({ kind: "support", score: 1 + friendlyAdj + Math.random() });
      }
      if (info.type === "land") {
        options.push({ kind: "consolidate", score: 1 + info.crowns * 1.5 + Math.random() * 0.8 });
      }
      options.sort(function (a, b) {
        return b.score - a.score;
      });
      wants[id] = options;
    });
    var tokensByKind = {};
    R.ORDERS.forEach(function (o) {
      if (!E.tokenAllowed(state, o.id)) {
        return;
      }
      if (!tokensByKind[o.kind]) {
        tokensByKind[o.kind] = [];
      }
      tokensByKind[o.kind].push(o);
    });
    Object.keys(tokensByKind).forEach(function (k) {
      tokensByKind[k].sort(function (a, b) {
        if (a.star !== b.star) {
          if (a.star) {
            return -1;
          }
          return 1;
        }
        return b.bonus - a.bonus;
      });
    });
    var starsLeft = E.starLimit(state, h);
    var orders = {};
    var order = areas.slice().sort(function (a, b) {
      var sa = 0;
      var sb = 0;
      if (wants[a].length > 0) {
        sa = wants[a][0].score;
      }
      if (wants[b].length > 0) {
        sb = wants[b][0].score;
      }
      return sb - sa;
    });
    var kinds = ["march", "defence", "support", "raid", "consolidate"];
    order.forEach(function (id) {
      var prefs = wants[id].map(function (w) {
        return w.kind;
      });
      kinds.forEach(function (k) {
        if (prefs.indexOf(k) < 0) {
          prefs.push(k);
        }
      });
      for (var i = 0; i < prefs.length; i++) {
        var list = tokensByKind[prefs[i]] || [];
        var choice = -1;
        for (var j = 0; j < list.length; j++) {
          if (list[j].star && starsLeft <= 0) {
            continue;
          }
          choice = j;
          break;
        }
        if (choice >= 0) {
          var token = list.splice(choice, 1)[0];
          if (token.star) {
            starsLeft--;
          }
          orders[id] = token.id;
          break;
        }
      }
    });
    return { type: "orders", orders: orders };
  }

  function raidAction(state, h) {
    var raids = E.ordersOfKind(state, h, "raid");
    var best = null;
    raids.forEach(function (from) {
      E.raidTargets(state, h, from).forEach(function (to) {
        var kind = E.ORDER_BY_ID[state.areas[to].order.id].kind;
        var score = 1;
        if (kind === "consolidate") {
          score = 4;
        } else if (kind === "support") {
          score = 3;
        } else if (kind === "defence") {
          score = 2.5;
        } else if (kind === "raid") {
          score = 2;
        }
        score += Math.random();
        if (!best || score > best.score) {
          best = { from: from, target: to, score: score };
        }
      });
    });
    if (best) {
      return { type: "raid", from: best.from, target: best.target };
    }
    return { type: "raid", from: raids[0], target: null };
  }

  function marchAction(state, h) {
    var marches = E.ordersOfKind(state, h, "march");
    var candidates = [];
    marches.forEach(function (from) {
      var area = state.areas[from];
      var idxs = [];
      area.units.forEach(function (u, i) {
        if (!u.r) {
          idxs.push(i);
        }
      });
      if (idxs.length === 0) {
        return;
      }
      var isShip = area.units[idxs[0]].t === "ship";
      var reach = E.moveTargets(state, from, h, isShip);
      Object.keys(reach).forEach(function (to) {
        var units = idxs.map(function (i) {
          return area.units[i];
        });
        var bonus = E.ORDER_BY_ID[area.order.id].bonus;
        var s = targetScore(state, h, from, to, units, bonus);
        if (s > 0) {
          candidates.push({ from: from, to: to, idxs: idxs, score: s + Math.random() });
        }
      });
    });
    candidates.sort(function (a, b) {
      return b.score - a.score;
    });
    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      var area = state.areas[cand.from];
      var info = AREA[cand.from];
      var sets = [cand.idxs.slice()];
      if (cand.idxs.length > 1) {
        var keep = cand.idxs.slice(1);
        sets.push(keep);
        if (info.castle > 0 && enemyThreat(state, cand.from, h) > 0) {
          sets.unshift(keep);
        }
        sets.push(cand.idxs.slice(0, 1));
      }
      for (var s = 0; s < sets.length; s++) {
        var moveUnits = sets[s];
        var leave = false;
        if (moveUnits.length === area.units.length && info.type === "land" && info.home !== h && state.houses[h].power >= 2 && areaValue(state, cand.from, h) >= 2 && area.ptoken !== h) {
          leave = true;
        }
        var action = { type: "march", from: cand.from, moves: [{ to: cand.to, units: moveUnits }], leaveToken: leave };
        var check = E.analyseMarch(state, h, action);
        if (check.ok) {
          return action;
        }
        action.leaveToken = false;
        check = E.analyseMarch(state, h, action);
        if (check.ok) {
          return action;
        }
      }
    }
    return { type: "march", from: marches[0], moves: [], leaveToken: false };
  }

  function supportAction(state, h) {
    var c = state.combat;
    var lead = leader(state);
    if (chance(0.15)) {
      return { type: "support", side: "none" };
    }
    if (c.att === lead) {
      return { type: "support", side: "def" };
    }
    if (c.def === lead) {
      return { type: "support", side: "att" };
    }
    return { type: "support", side: pickRandom(["att", "def", "none"]) };
  }

  function leaderAction(state, h) {
    var c = state.combat;
    var test = E.clone(state);
    test.combat.cards = {};
    E.computeCombat(test);
    var opp = c.att;
    if (h === c.att) {
      opp = c.def;
    }
    var mine = test.combat.sides[h].total;
    var theirs = test.combat.sides[opp].total;
    var hand = state.houses[h].hand.map(function (id) {
      return E.LEADER_BY_ID[id];
    });
    var oppHand = state.houses[opp].hand.map(function (id) {
      return E.LEADER_BY_ID[id];
    });
    var oppMax = 0;
    var oppSum = 0;
    oppHand.forEach(function (card) {
      oppMax = Math.max(oppMax, card.strength);
      oppSum += card.strength;
    });
    var oppAvg = oppSum / Math.max(1, oppHand.length);
    hand.sort(function (a, b) {
      return a.strength - b.strength;
    });
    var winsTies = E.trackPos(state, "sword", h) < E.trackPos(state, "sword", opp);
    function beats(card, oppStrength) {
      var total = mine + card.strength;
      if (total > theirs + oppStrength) {
        return true;
      }
      return total === theirs + oppStrength && winsTies;
    }
    var safe = hand.filter(function (card) {
      return beats(card, oppMax);
    });
    if (safe.length > 0 && chance(0.75)) {
      return { type: "leader", card: safe[0].id };
    }
    var likely = hand.filter(function (card) {
      return beats(card, Math.round(oppAvg));
    });
    if (likely.length > 0) {
      return { type: "leader", card: likely[Math.min(likely.length - 1, Math.floor(Math.random() * 2))].id };
    }
    return { type: "leader", card: hand[0].id };
  }

  function bladeAction(state, h) {
    var c = state.combat;
    var opp = c.att;
    if (h === c.att) {
      opp = c.def;
    }
    var mine = c.sides[h].total;
    var theirs = c.sides[opp].total;
    var winsTies = E.trackPos(state, "sword", h) < E.trackPos(state, "sword", opp);
    var winning = mine > theirs || (mine === theirs && winsTies);
    if (winning) {
      return { type: "blade", use: false };
    }
    if (mine + 1 > theirs || (mine + 1 === theirs && winsTies)) {
      return { type: "blade", use: true };
    }
    return { type: "blade", use: false };
  }

  function unitRank(t) {
    if (t === "footman") {
      return 1;
    }
    if (t === "ship") {
      return 1.5;
    }
    if (t === "siege") {
      return 2;
    }
    return 3;
  }

  function casualtiesAction(state, h) {
    var units = E.battleUnits(state, h);
    var idxs = [];
    units.forEach(function (u, i) {
      if (!u.r) {
        idxs.push(i);
      }
    });
    idxs.sort(function (a, b) {
      return unitRank(units[a].t) - unitRank(units[b].t);
    });
    return { type: "casualties", units: idxs.slice(0, state.pending.count) };
  }

  function retreatAction(state, h) {
    var best = null;
    state.pending.options.forEach(function (id) {
      var s = areaValue(state, id, h) - enemyThreat(state, id, h) + Math.random();
      if (state.areas[id].units.length > 0) {
        s += 1;
      }
      if (!best || s > best.s) {
        best = { id: id, s: s };
      }
    });
    return { type: "retreat", to: best.id };
  }

  function musterAction(state, h) {
    var areas = state.pending.areas;
    var builds = [];
    areas.forEach(function (a) {
      var points = a.points;
      var info = AREA[a.area];
      var guard = 0;
      while (points > 0 && guard < 6) {
        guard++;
        var tries = [];
        var seas = ADJ[a.area].filter(function (id) {
          var sea = state.areas[id];
          return AREA[id].type === "sea" && !(sea.units.length > 0 && sea.units[0].h !== h);
        });
        if (points >= 2 && chance(0.6)) {
          tries.push({ area: a.area, kind: "knight" });
        }
        if (seas.length > 0 && chance(0.35)) {
          tries.push({ area: a.area, kind: "ship", sea: pickRandom(seas) });
        }
        if (points >= 2 && info.castle > 0 && chance(0.12)) {
          tries.push({ area: a.area, kind: "siege" });
        }
        tries.push({ area: a.area, kind: "footman" });
        state.areas[a.area].units.forEach(function (u, i) {
          if (u.h === h && u.t === "footman") {
            var already = builds.some(function (b) {
              return b.area === a.area && b.unit === i;
            });
            if (!already) {
              tries.push({ area: a.area, kind: "upKnight", unit: i });
            }
          }
        });
        if (seas.length > 0) {
          tries.push({ area: a.area, kind: "ship", sea: pickRandom(seas) });
        }
        var placed = false;
        for (var t = 0; t < tries.length; t++) {
          var attempt = builds.concat([tries[t]]);
          if (E.validateMuster(state, h, attempt, areas).ok) {
            builds = attempt;
            var cost = 1;
            if (tries[t].kind === "knight" || tries[t].kind === "siege") {
              cost = 2;
            }
            points -= cost;
            placed = true;
            break;
          }
        }
        if (!placed) {
          break;
        }
      }
    });
    return { type: "muster", builds: builds };
  }

  function weakestUnits(state, h, count, filter) {
    var list = E.allHouseUnits(state, h).filter(function (u) {
      if (filter) {
        return filter(u);
      }
      return true;
    });
    list.sort(function (a, b) {
      var va = unitRank(a.t) + areaValue(state, a.area, h) * 0.05;
      var vb = unitRank(b.t) + areaValue(state, b.area, h) * 0.05;
      return va - vb;
    });
    return list.slice(0, count).map(function (u) {
      return { area: u.area, idx: u.idx };
    });
  }

  function reconcileAction(state, h) {
    var removal = [];
    var test = E.clone(state);
    var guard = 0;
    while (!E.supplyOk(test, h) && guard < 40) {
      guard++;
      var counts = E.houseUnitCounts(test, h);
      var biggest = null;
      Object.keys(counts).forEach(function (id) {
        if (counts[id] >= 2 && (!biggest || counts[id] > counts[biggest])) {
          biggest = id;
        }
      });
      if (!biggest) {
        break;
      }
      var units = test.areas[biggest].units;
      var worst = 0;
      for (var i = 1; i < units.length; i++) {
        if (unitRank(units[i].t) < unitRank(units[worst].t)) {
          worst = i;
        }
      }
      var originalIdx = mapIndex(state, test, biggest, worst, removal);
      removal.push({ area: biggest, idx: originalIdx });
      units.splice(worst, 1);
    }
    return { type: "reconcile", remove: removal };
  }

  function mapIndex(state, test, areaId, testIdx, removal) {
    var removedHere = removal.filter(function (r) {
      return r.area === areaId;
    }).map(function (r) {
      return r.idx;
    });
    var count = -1;
    for (var i = 0; i < state.areas[areaId].units.length; i++) {
      if (removedHere.indexOf(i) >= 0) {
        continue;
      }
      count++;
      if (count === testIdx) {
        return i;
      }
    }
    return 0;
  }

  function bidAction(state, h) {
    var power = state.houses[h].power;
    var track = state.pending.track;
    var share = 0.25;
    if (track === "crown") {
      share = 0.35;
    } else if (track === "court") {
      share = 0.3;
    }
    var amount = Math.floor(power * share * (0.4 + Math.random() * 1.2));
    return { type: "bid", amount: Math.max(0, Math.min(power, amount)) };
  }

  function hordeBidAction(state, h) {
    var power = state.houses[h].power;
    var threat = state.pending.threat;
    var amount = Math.ceil(threat / 3);
    if (chance(0.4)) {
      amount += 1;
    }
    if (chance(0.2)) {
      amount -= 1;
    }
    return { type: "hordeBid", amount: Math.max(0, Math.min(power, amount)) };
  }

  function act(state, h) {
    var p = state.pending;
    if (!p) {
      return null;
    }
    var k = p.kind;
    if (k === "orders") {
      return planOrders(state, h);
    }
    if (k === "raven") {
      if (chance(0.5)) {
        return { type: "raven", mode: "peek" };
      }
      return { type: "raven", mode: "pass" };
    }
    if (k === "ravenPeek") {
      var harsh = ["witch", "warlord", "burning", "bones"];
      return { type: "ravenPeek", bury: harsh.indexOf(p.card) >= 0 };
    }
    if (k === "raid") {
      return raidAction(state, h);
    }
    if (k === "march") {
      return marchAction(state, h);
    }
    if (k === "support") {
      return supportAction(state, h);
    }
    if (k === "leader") {
      return leaderAction(state, h);
    }
    if (k === "blade") {
      return bladeAction(state, h);
    }
    if (k === "casualties") {
      return casualtiesAction(state, h);
    }
    if (k === "retreat") {
      return retreatAction(state, h);
    }
    if (k === "muster") {
      return musterAction(state, h);
    }
    if (k === "reconcile") {
      return reconcileAction(state, h);
    }
    if (k === "destroyUnits") {
      return { type: "destroyUnits", remove: weakestUnits(state, h, p.count, null) };
    }
    if (k === "downgrade") {
      return { type: "downgrade", picks: weakestUnits(state, h, p.count, function (u) {
        return u.t === "knight";
      }) };
    }
    if (k === "upgradeOne") {
      var footmen = weakestUnits(state, h, 1, function (u) {
        return u.t === "footman";
      });
      if (footmen.length > 0) {
        return { type: "upgradeOne", pick: footmen[0] };
      }
      return { type: "upgradeOne", pick: null };
    }
    if (k === "discardLeaders") {
      var hand = state.houses[h].hand.slice().sort(function (a, b) {
        return E.LEADER_BY_ID[a].strength - E.LEADER_BY_ID[b].strength;
      });
      return { type: "discardLeaders", cards: hand.slice(0, p.count) };
    }
    if (k === "chooseTrack") {
      if (state.tracks.crown[0] !== h) {
        return { type: "chooseTrack", track: "crown" };
      }
      return { type: "chooseTrack", track: pickRandom(["sword", "court"]) };
    }
    if (k === "bid") {
      return bidAction(state, h);
    }
    if (k === "hordeBid") {
      return hordeBidAction(state, h);
    }
    if (k === "tieOrder") {
      var order = p.group.slice().sort(function (a, b) {
        if (a === h) {
          return -1;
        }
        if (b === h) {
          return 1;
        }
        return 0;
      });
      return { type: "tieOrder", order: order };
    }
    if (k === "tiePick") {
      var wantSelf = p.purpose.indexOf("highest") >= 0;
      var others = p.candidates.filter(function (x) {
        return x !== h;
      });
      if (wantSelf && p.candidates.indexOf(h) >= 0) {
        return { type: "tiePick", pick: h };
      }
      if (!wantSelf && others.length > 0) {
        return { type: "tiePick", pick: pickRandom(others) };
      }
      return { type: "tiePick", pick: p.candidates[0] };
    }
    if (k === "choice") {
      var ids = p.options.map(function (o) {
        return o.id;
      });
      if (p.card === "decree") {
        if (E.barrelCount(state, h) > state.houses[h].supply) {
          return { type: "choice", choice: "harvest" };
        }
        return { type: "choice", choice: pickRandom(["muster", "harvest"]) };
      }
      if (p.card === "whispers") {
        if (E.crownCount(state, h) >= 3) {
          return { type: "choice", choice: "tribute" };
        }
        return { type: "choice", choice: pickRandom(ids) };
      }
      return { type: "choice", choice: pickRandom(ids) };
    }
    if (k === "consolidateChoice") {
      if (state.houses[h].power >= 4 && chance(0.6)) {
        return { type: "consolidateChoice", choice: "muster" };
      }
      return { type: "consolidateChoice", choice: "power" };
    }
    return null;
  }

  return { act: act };
})();
if (typeof module !== "undefined") {
  module.exports = BOT;
}
