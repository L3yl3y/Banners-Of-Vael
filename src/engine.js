var ENGINE = (function () {
  var MAP = null;
  var R = null;
  if (typeof module !== "undefined" && typeof require !== "undefined") {
    MAP = require("./mapdata.js");
    R = require("./rules.js");
  } else {
    MAP = MAP_DATA;
    R = RULES;
  }

  var AREA = {};
  MAP.areas.forEach(function (a) {
    AREA[a.id] = a;
  });
  var ADJ = MAP.adjacency;

  var ORDER_BY_ID = {};
  R.ORDERS.forEach(function (o) {
    ORDER_BY_ID[o.id] = o;
  });

  var LEADER_BY_ID = {};
  Object.keys(R.LEADERS).forEach(function (h) {
    R.LEADERS[h].forEach(function (c) {
      LEADER_BY_ID[c.id] = Object.assign({ house: h }, c);
    });
  });

  var EVENT_BY_ID = {};
  Object.keys(R.EVENT_DECKS).forEach(function (deck) {
    R.EVENT_DECKS[deck].forEach(function (c) {
      EVENT_BY_ID[c.id] = Object.assign({ deck: deck }, c);
    });
  });

  var HORDE_BY_ID = {};
  R.HORDE_CARDS.forEach(function (c) {
    HORDE_BY_ID[c.id] = c;
  });

  function GameError(message) {
    this.message = message;
  }

  function fail(message) {
    throw new GameError(message);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function rand(state) {
    var s = state.rng;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s = s >>> 0;
    if (s === 0) {
      s = 2463534242;
    }
    state.rng = s;
    return s / 4294967296;
  }

  function shuffle(state, list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rand(state) * (i + 1));
      var t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  function log(state, text, house) {
    state.log.push({ r: state.round, h: house || null, t: text });
    if (state.log.length > 160) {
      state.log.splice(0, state.log.length - 160);
    }
  }

  function houseName(h) {
    return R.HOUSES[h].short;
  }

  function areaName(id) {
    return AREA[id].name;
  }

  function buildEventDeck(state, deck) {
    var cards = [];
    R.EVENT_DECKS[deck].forEach(function (c) {
      for (var k = 0; k < c.count; k++) {
        cards.push({ c: c.id, w: c.horde[k] || 0 });
      }
    });
    return shuffle(state, cards);
  }

  function createGame(options) {
    var seed = options.seed || Math.floor(Math.random() * 4294967295) + 1;
    var state = {
      v: 0,
      rng: seed >>> 0,
      round: 1,
      phase: "planning",
      seats: {},
      houses: {},
      areas: {},
      tracks: clone(R.START_TRACKS),
      threat: 2,
      decks: {},
      drawn: { I: null, II: null, III: null },
      hordeDeck: [],
      restrict: {},
      bladeUsed: false,
      tasks: [],
      pending: null,
      combat: null,
      lastBattle: null,
      log: [],
      winner: null,
      finalScores: null,
      peek: null
    };
    if (state.rng === 0) {
      state.rng = 1;
    }
    R.HOUSE_ORDER.forEach(function (h) {
      var seatOption = (options.seats && options.seats[h]) || { kind: "bot", name: houseName(h) };
      state.seats[h] = { kind: seatOption.kind, name: seatOption.name || houseName(h), owner: seatOption.owner || null };
      state.houses[h] = {
        power: R.START[h].power,
        supply: 0,
        hand: R.LEADERS[h].map(function (c) {
          return c.id;
        }),
        discard: []
      };
    });
    MAP.areas.forEach(function (a) {
      state.areas[a.id] = { units: [], order: null, ptoken: null, garrison: a.garrison || 0, neutral: a.neutral || 0 };
    });
    R.HOUSE_ORDER.forEach(function (h) {
      var units = R.START[h].units;
      Object.keys(units).forEach(function (areaId) {
        units[areaId].forEach(function (t) {
          state.areas[areaId].units.push({ t: t, h: h, r: false });
        });
      });
    });
    R.HOUSE_ORDER.forEach(function (h) {
      state.houses[h].supply = Math.min(6, barrelCount(state, h));
    });
    state.decks.I = buildEventDeck(state, "I");
    state.decks.II = buildEventDeck(state, "II");
    state.decks.III = buildEventDeck(state, "III");
    state.hordeDeck = shuffle(state, R.HORDE_CARDS.map(function (c) {
      return c.id;
    }));
    state.tasks = [{ t: "round" }];
    log(state, "The war for Vael begins. Round 1.");
    advance(state);
    return state;
  }

  function controller(state, areaId) {
    var area = state.areas[areaId];
    if (area.units.length > 0) {
      return area.units[0].h;
    }
    if (area.ptoken) {
      return area.ptoken;
    }
    var info = AREA[areaId];
    if (info.home) {
      return info.home;
    }
    return null;
  }

  function castleCount(state, h) {
    var n = 0;
    MAP.areas.forEach(function (a) {
      if (a.type === "land" && a.castle > 0 && controller(state, a.id) === h) {
        n++;
      }
    });
    return n;
  }

  function barrelCount(state, h) {
    var n = 0;
    MAP.areas.forEach(function (a) {
      if (a.type === "land" && a.barrels > 0 && controller(state, a.id) === h) {
        n += a.barrels;
      }
    });
    return n;
  }

  function crownCount(state, h) {
    var n = 0;
    MAP.areas.forEach(function (a) {
      if (a.type === "land" && a.crowns > 0 && controller(state, a.id) === h) {
        n += a.crowns;
      }
    });
    return n;
  }

  function tokensOnBoard(state, h) {
    var n = 0;
    Object.keys(state.areas).forEach(function (id) {
      if (state.areas[id].ptoken === h) {
        n++;
      }
    });
    return n;
  }

  function gainPower(state, h, amount) {
    var room = R.POWER_TOTAL - tokensOnBoard(state, h) - state.houses[h].power;
    var gained = Math.max(0, Math.min(amount, room));
    state.houses[h].power += gained;
    return gained;
  }

  function losePower(state, h, amount) {
    var lost = Math.min(amount, state.houses[h].power);
    state.houses[h].power -= lost;
    return lost;
  }

  function houseUnitCounts(state, h) {
    var counts = {};
    Object.keys(state.areas).forEach(function (id) {
      var n = 0;
      state.areas[id].units.forEach(function (u) {
        if (u.h === h) {
          n++;
        }
      });
      if (n > 0) {
        counts[id] = n;
      }
    });
    return counts;
  }

  function supplyFits(counts, supply) {
    var sizes = [];
    Object.keys(counts).forEach(function (id) {
      if (counts[id] >= 2) {
        sizes.push(counts[id]);
      }
    });
    sizes.sort(function (a, b) {
      return b - a;
    });
    var allowed = R.SUPPLY_TABLE[Math.max(0, Math.min(6, supply))].slice().sort(function (a, b) {
      return b - a;
    });
    if (sizes.length > allowed.length) {
      return false;
    }
    for (var i = 0; i < sizes.length; i++) {
      if (sizes[i] > allowed[i]) {
        return false;
      }
    }
    return true;
  }

  function supplyOk(state, h) {
    return supplyFits(houseUnitCounts(state, h), state.houses[h].supply);
  }

  function poolCount(state, h, type) {
    var n = 0;
    Object.keys(state.areas).forEach(function (id) {
      state.areas[id].units.forEach(function (u) {
        if (u.h === h && u.t === type) {
          n++;
        }
      });
    });
    if (state.combat && state.combat.att === h) {
      state.combat.units.forEach(function (u) {
        if (u.t === type) {
          n++;
        }
      });
    }
    return R.UNIT_POOL[type] - n;
  }

  function trackPos(state, track, h) {
    return state.tracks[track].indexOf(h);
  }

  function starLimit(state, h) {
    return R.STAR_LIMITS[trackPos(state, "court", h)];
  }

  function orderInfo(tokenId) {
    return ORDER_BY_ID[tokenId];
  }

  function areasWithUnits(state, h) {
    var list = [];
    Object.keys(state.areas).forEach(function (id) {
      var area = state.areas[id];
      if (area.units.length > 0 && area.units[0].h === h) {
        list.push(id);
      }
    });
    return list;
  }

  function tokenAllowed(state, tokenId) {
    var o = ORDER_BY_ID[tokenId];
    var r = state.restrict;
    if (o.kind === "raid" && r.noRaid) {
      return false;
    }
    if (o.kind === "consolidate" && r.noConsolidate) {
      return false;
    }
    if (o.kind === "support" && r.noSupport) {
      return false;
    }
    if (o.kind === "defence" && r.noDefence) {
      return false;
    }
    if (o.kind === "march" && o.bonus === 1 && r.noMarchPlus) {
      return false;
    }
    return true;
  }

  function hasHouseUnits(area, h) {
    return area.units.length > 0 && area.units[0].h === h;
  }

  function isEnemyArea(state, areaId, h) {
    var area = state.areas[areaId];
    return area.units.length > 0 && area.units[0].h !== h;
  }

  function unitStrength(u, attackingCastle, defending) {
    if (u.r) {
      return 0;
    }
    if (u.t === "footman" || u.t === "ship") {
      return 1;
    }
    if (u.t === "knight") {
      return 2;
    }
    if (u.t === "siege") {
      if (defending) {
        return 0;
      }
      if (attackingCastle) {
        return 4;
      }
      return 0;
    }
    return 0;
  }

  function landReach(state, from, h) {
    var result = {};
    ADJ[from].forEach(function (id) {
      if (AREA[id].type === "land") {
        result[id] = "march";
      }
    });
    var seen = {};
    var queue = [];
    ADJ[from].forEach(function (id) {
      if (AREA[id].type === "sea" && hasHouseUnits(state.areas[id], h)) {
        seen[id] = true;
        queue.push(id);
      }
    });
    while (queue.length > 0) {
      var sea = queue.shift();
      ADJ[sea].forEach(function (id) {
        if (AREA[id].type === "sea") {
          if (!seen[id] && hasHouseUnits(state.areas[id], h)) {
            seen[id] = true;
            queue.push(id);
          }
        } else if (id !== from && !result[id]) {
          result[id] = "ship";
        }
      });
    }
    return result;
  }

  function moveTargets(state, from, h, isShip) {
    if (isShip) {
      var seas = {};
      ADJ[from].forEach(function (id) {
        if (AREA[id].type === "sea") {
          seas[id] = "march";
        }
      });
      return seas;
    }
    return landReach(state, from, h);
  }

  function supportOrdersFor(state, battleArea) {
    var list = [];
    var battleIsSea = AREA[battleArea].type === "sea";
    ADJ[battleArea].forEach(function (id) {
      var area = state.areas[id];
      if (!area.order) {
        return;
      }
      var o = ORDER_BY_ID[area.order.id];
      if (o.kind !== "support") {
        return;
      }
      if (battleIsSea && AREA[id].type === "land") {
        return;
      }
      if (area.units.length === 0) {
        return;
      }
      list.push({ area: id, h: area.order.h, bonus: o.bonus });
    });
    return list;
  }

  function supportStrength(state, supportArea, bonus, forAttacker, battleArea) {
    var castle = AREA[battleArea].type === "land" && AREA[battleArea].castle > 0;
    var total = 0;
    state.areas[supportArea].units.forEach(function (u) {
      total += unitStrength(u, castle && forAttacker, !forAttacker);
    });
    return total + bonus;
  }

  function pushFront(state, tasks) {
    var args = [0, 0].concat(tasks);
    Array.prototype.splice.apply(state.tasks, args);
  }

  function setPending(state, pending) {
    state.pendingSeq = (state.pendingSeq || 0) + 1;
    pending.id = state.pendingSeq;
    state.pending = pending;
  }

  function nextHouseWith(state, startIndex, predicate) {
    var order = state.tracks.crown;
    for (var k = 0; k < order.length; k++) {
      var idx = (startIndex + k) % order.length;
      if (predicate(order[idx])) {
        return idx;
      }
    }
    return -1;
  }

  function ordersOfKind(state, h, kind) {
    var list = [];
    Object.keys(state.areas).forEach(function (id) {
      var area = state.areas[id];
      if (area.order && area.order.h === h && ORDER_BY_ID[area.order.id].kind === kind) {
        list.push(id);
      }
    });
    return list;
  }

  var HANDLERS = {};

  HANDLERS.round = function (state) {
    state.phase = "westeros";
    var list = [];
    if (state.round > 1) {
      list.push({ t: "westeros" });
    }
    list.push({ t: "planning" }, { t: "raven" }, { t: "raids", turn: 0 }, { t: "marches", turn: 0 }, { t: "consolidate" }, { t: "cleanup" });
    pushFront(state, list);
    return true;
  };

  HANDLERS.westeros = function (state, task) {
    state.phase = "westeros";
    if (!task.drawn) {
      task.drawn = true;
      state.restrict = {};
      var icons = 0;
      ["I", "II", "III"].forEach(function (deck) {
        var card = drawEvent(state, deck);
        state.drawn[deck] = card;
        icons += card.w;
      });
      var before = state.threat;
      state.threat = Math.min(12, state.threat + icons * 2);
      log(state, "Event cards: " + EVENT_BY_ID[state.drawn.I.c].name + ", " + EVENT_BY_ID[state.drawn.II.c].name + ", " + EVENT_BY_ID[state.drawn.III.c].name + ".");
      if (icons > 0) {
        log(state, "The horde stirs: threat rises from " + before + " to " + state.threat + ".");
      }
      var list = [];
      if (state.threat >= 12) {
        log(state, "The horde has reached full strength and attacks at once!");
        list.push({ t: "horde" });
      }
      list.push({ t: "event", deck: "I", card: state.drawn.I.c });
      list.push({ t: "event", deck: "II", card: state.drawn.II.c });
      list.push({ t: "event", deck: "III", card: state.drawn.III.c });
      pushFront(state, list);
      return false;
    }
    return true;
  };

  function drawEvent(state, deck) {
    var guard = 0;
    while (guard < 20) {
      guard++;
      if (state.decks[deck].length === 0) {
        state.decks[deck] = buildEventDeck(state, deck);
      }
      var card = state.decks[deck].shift();
      var info = EVENT_BY_ID[card.c];
      if (info.id === "turning1" || info.id === "turning2") {
        log(state, "The Turning Year: deck " + deck + " is reshuffled, this card included.");
        state.decks[deck] = buildEventDeck(state, deck);
        continue;
      }
      return card;
    }
    return state.decks[deck].shift();
  }

  HANDLERS.event = function (state, task) {
    var id = task.card;
    if (id === "harvest") {
      pushFront(state, [{ t: "harvest" }]);
      return true;
    }
    if (id === "muster") {
      pushFront(state, [{ t: "musterAll", turn: 0 }]);
      return true;
    }
    if (id === "contest") {
      pushFront(state, [{ t: "contest", track: "crown" }, { t: "contest", track: "sword" }, { t: "contest", track: "court" }]);
      return true;
    }
    if (id === "tribute") {
      pushFront(state, [{ t: "tribute" }]);
      return true;
    }
    if (id === "assault") {
      pushFront(state, [{ t: "horde" }]);
      return true;
    }
    if (id === "quiet1" || id === "quiet2") {
      log(state, "A Quiet Season: nothing happens.");
      return true;
    }
    var info = EVENT_BY_ID[id];
    if (info.restrict) {
      state.restrict[info.restrict] = true;
      log(state, info.name + ": " + info.text);
      return true;
    }
    if (id === "decree" || id === "whispers" || id === "bladechoice") {
      if (task.choice === undefined) {
        var track = "crown";
        var options = [];
        if (id === "decree") {
          options = [{ id: "harvest", label: "Harvest Count" }, { id: "muster", label: "Call To Arms" }, { id: "none", label: "Nothing" }];
        } else if (id === "whispers") {
          track = "court";
          options = [{ id: "contest", label: "Contest Of Influence" }, { id: "tribute", label: "Tribute" }, { id: "none", label: "Nothing" }];
        } else {
          track = "sword";
          options = [{ id: "noDefence", label: "No Defence orders" }, { id: "noMarchPlus", label: "No March +1" }, { id: "none", label: "No restriction" }];
        }
        setPending(state, { kind: "choice", houses: [state.tracks[track][0]], card: id, options: options });
        return false;
      }
      log(state, info.name + ": " + houseName(task.chooser) + " chose " + task.choiceLabel + ".", task.chooser);
      if (task.choice === "none") {
        return true;
      }
      if (id === "bladechoice") {
        state.restrict[task.choice] = true;
        return true;
      }
      pushFront(state, [{ t: "event", deck: task.deck, card: task.choice }]);
      return true;
    }
    return true;
  };

  HANDLERS.harvest = function (state, task) {
    if (!task.done) {
      task.done = true;
      R.HOUSE_ORDER.forEach(function (h) {
        var before = state.houses[h].supply;
        state.houses[h].supply = Math.min(6, barrelCount(state, h));
        if (before !== state.houses[h].supply) {
          log(state, houseName(h) + " supply " + before + " → " + state.houses[h].supply + ".", h);
        }
      });
      log(state, "Harvest Count: supply updated.");
      var list = [];
      state.tracks.crown.forEach(function (h) {
        list.push({ t: "reconcile", h: h });
      });
      pushFront(state, list);
      return false;
    }
    return true;
  };

  HANDLERS.reconcile = function (state, task) {
    if (supplyOk(state, task.h)) {
      return true;
    }
    setPending(state, { kind: "reconcile", houses: [task.h] });
    return false;
  };

  HANDLERS.musterAll = function (state, task) {
    if (task.turn >= state.tracks.crown.length) {
      return true;
    }
    var h = state.tracks.crown[task.turn];
    task.turn++;
    var areas = musterAreas(state, h, null);
    if (areas.length > 0) {
      pushFront(state, [{ t: "muster", h: h, areas: areas }]);
    }
    return false;
  };

  function musterAreas(state, h, only) {
    var list = [];
    MAP.areas.forEach(function (a) {
      if (a.type !== "land" || a.castle === 0) {
        return;
      }
      if (only && only !== a.id) {
        return;
      }
      if (controller(state, a.id) === h) {
        list.push({ area: a.id, points: a.castle });
      }
    });
    return list;
  }

  HANDLERS.muster = function (state, task) {
    if (!task.asked) {
      task.asked = true;
      setPending(state, { kind: "muster", houses: [task.h], areas: task.areas, free: task.free || false });
      return false;
    }
    return true;
  };

  HANDLERS.tribute = function (state) {
    R.HOUSE_ORDER.forEach(function (h) {
      var n = crownCount(state, h);
      var got = gainPower(state, h, n);
      log(state, "Tribute: " + houseName(h) + " gains " + got + " power.", h);
    });
    return true;
  };

  HANDLERS.contest = function (state, task) {
    if (!task.bids) {
      task.bids = {};
      log(state, "Contest Of Influence: bidding for the " + R.TRACK_NAMES[task.track] + " track.");
      setPending(state, { kind: "bid", houses: R.HOUSE_ORDER.slice(), track: task.track });
      return false;
    }
    if (!task.applied) {
      task.applied = true;
      var parts = [];
      R.HOUSE_ORDER.forEach(function (h) {
        losePower(state, h, task.bids[h]);
        parts.push(houseName(h) + " " + task.bids[h]);
      });
      log(state, "Bids for " + R.TRACK_NAMES[task.track] + ": " + parts.join(", ") + ".");
      var current = state.tracks[task.track].slice();
      var sorted = R.HOUSE_ORDER.slice().sort(function (a, b) {
        return task.bids[b] - task.bids[a];
      });
      task.groups = [];
      var i = 0;
      while (i < sorted.length) {
        var group = [sorted[i]];
        var j = i + 1;
        while (j < sorted.length && task.bids[sorted[j]] === task.bids[sorted[i]]) {
          group.push(sorted[j]);
          j++;
        }
        task.groups.push(group);
        i = j;
      }
      task.current = current;
      task.groupIndex = 0;
    }
    while (task.groupIndex < task.groups.length) {
      var g = task.groups[task.groupIndex];
      if (g.length > 1 && !task.resolvedGroup) {
        var decider = state.tracks.crown[0];
        if (task.track === "crown") {
          decider = task.current[0];
        }
        setPending(state, { kind: "tieOrder", houses: [decider], group: g.slice(), purpose: "Order the tied houses on the " + R.TRACK_NAMES[task.track] + " track (first is highest)." });
        return false;
      }
      task.resolvedGroup = false;
      task.groupIndex++;
    }
    var order = [];
    task.groups.forEach(function (g) {
      g.forEach(function (h) {
        order.push(h);
      });
    });
    state.tracks[task.track] = order;
    log(state, R.TRACK_NAMES[task.track] + " track is now: " + order.map(houseName).join(", ") + ".");
    return true;
  };

  HANDLERS.horde = function (state, task) {
    if (!task.bids) {
      task.bids = {};
      log(state, "The horde attacks the Ember Gate with strength " + state.threat + ". Every house bids power to defend it.");
      setPending(state, { kind: "hordeBid", houses: R.HOUSE_ORDER.slice(), threat: state.threat });
      return false;
    }
    if (!task.totalled) {
      task.totalled = true;
      var total = 0;
      var parts = [];
      R.HOUSE_ORDER.forEach(function (h) {
        losePower(state, h, task.bids[h]);
        total += task.bids[h];
        parts.push(houseName(h) + " " + task.bids[h]);
      });
      task.total = total;
      task.won = total >= state.threat;
      task.card = state.hordeDeck.shift();
      state.hordeDeck.push(task.card);
      var info = HORDE_BY_ID[task.card];
      log(state, "Horde bids: " + parts.join(", ") + " (total " + total + " against " + state.threat + ").");
      if (task.won) {
        log(state, "The Wardens hold the gate! Horde card: " + info.name + ".");
      } else {
        log(state, "The horde breaks through! Horde card: " + info.name + ".");
      }
      state.lastHorde = { card: task.card, won: task.won, total: total, threat: state.threat, bids: clone(task.bids) };
      var values = R.HOUSE_ORDER.map(function (h) {
        return task.bids[h];
      });
      var target = 0;
      if (task.won) {
        target = Math.max.apply(null, values);
      } else {
        target = Math.min.apply(null, values);
      }
      task.candidates = R.HOUSE_ORDER.filter(function (h) {
        return task.bids[h] === target;
      });
    }
    if (!task.chosen) {
      if (task.candidates.length === 1) {
        task.chosen = task.candidates[0];
      } else {
        var purpose = "lowest";
        if (task.won) {
          purpose = "highest";
        }
        setPending(state, { kind: "tiePick", houses: [state.tracks.crown[0]], candidates: task.candidates.slice(), purpose: "Several houses tied for " + purpose + " bidder. Choose who counts as the " + purpose + " bidder." });
        return false;
      }
    }
    if (!task.effects) {
      task.effects = true;
      if (task.won) {
        state.threat = 0;
      } else {
        state.threat = Math.max(0, state.threat - 4);
      }
      pushFront(state, hordeEffects(state, task));
      return false;
    }
    return true;
  };

  function hordeEffects(state, task) {
    var id = task.card;
    var chosen = task.chosen;
    var others = R.HOUSE_ORDER.filter(function (h) {
      return h !== chosen;
    });
    var list = [];
    if (task.won) {
      if (id === "burning") {
        var hand = state.houses[chosen];
        hand.hand = hand.hand.concat(hand.discard);
        hand.discard = [];
        log(state, houseName(chosen) + " takes back all discarded leader cards.", chosen);
      } else if (id === "witch") {
        var got = gainPower(state, chosen, task.bids[chosen]);
        log(state, houseName(chosen) + " regains " + got + " power.", chosen);
      } else if (id === "gate") {
        list.push({ t: "chooseTrack", h: chosen });
      } else if (id === "famine") {
        state.houses[chosen].supply = Math.min(6, state.houses[chosen].supply + 1);
        log(state, houseName(chosen) + " raises supply to " + state.houses[chosen].supply + ".", chosen);
      } else if (id === "oathbreakers") {
        var g3 = gainPower(state, chosen, 3);
        log(state, houseName(chosen) + " gains " + g3 + " power.", chosen);
      } else if (id === "empty") {
        var g1 = gainPower(state, chosen, 1);
        log(state, houseName(chosen) + " gains " + g1 + " power.", chosen);
      } else if (id === "bones") {
        list.push({ t: "upgradeOne", h: chosen });
      } else if (id === "warlord") {
        var home = homeArea(chosen);
        if (controller(state, home) === chosen) {
          list.push({ t: "muster", h: chosen, areas: [{ area: home, points: 2 }], free: true });
        }
      }
      return list;
    }
    if (id === "burning") {
      list.push({ t: "destroyUnits", h: chosen, count: 2 });
      others.forEach(function (h) {
        list.push({ t: "destroyUnits", h: h, count: 1 });
      });
    } else if (id === "witch") {
      var lost = losePower(state, chosen, state.houses[chosen].power);
      log(state, houseName(chosen) + " loses all " + lost + " available power.", chosen);
      others.forEach(function (h) {
        var l2 = losePower(state, h, 2);
        log(state, houseName(h) + " loses " + l2 + " power.", h);
      });
    } else if (id === "gate") {
      ["sword", "court"].forEach(function (track) {
        var t = state.tracks[track].filter(function (h) {
          return h !== chosen;
        });
        t.push(chosen);
        state.tracks[track] = t;
      });
      log(state, houseName(chosen) + " drops to the bottom of the Sword and Court tracks.", chosen);
      others.forEach(function (h) {
        var lg = losePower(state, h, 1);
        log(state, houseName(h) + " loses " + lg + " power.", h);
      });
    } else if (id === "famine") {
      state.houses[chosen].supply = Math.max(0, state.houses[chosen].supply - 2);
      others.forEach(function (h) {
        state.houses[h].supply = Math.max(0, state.houses[h].supply - 1);
      });
      log(state, "Supply falls: " + R.HOUSE_ORDER.map(function (h) {
        return houseName(h) + " " + state.houses[h].supply;
      }).join(", ") + ".");
      state.tracks.crown.forEach(function (h) {
        list.push({ t: "reconcile", h: h });
      });
    } else if (id === "oathbreakers") {
      list.push({ t: "discardLeaders", h: chosen, count: 2 });
      others.forEach(function (h) {
        list.push({ t: "discardLeaders", h: h, count: 1 });
      });
    } else if (id === "empty") {
      log(state, "The horde finds only empty villages.");
    } else if (id === "bones") {
      list.push({ t: "downgrade", h: chosen, count: 2 });
      others.forEach(function (h) {
        list.push({ t: "downgrade", h: h, count: 1 });
      });
    } else if (id === "warlord") {
      var lp = losePower(state, chosen, 2);
      log(state, houseName(chosen) + " loses " + lp + " power.", chosen);
      list.push({ t: "destroyUnits", h: chosen, count: 2 });
      others.forEach(function (h) {
        list.push({ t: "destroyUnits", h: h, count: 1 });
      });
    }
    return list;
  }

  function homeArea(h) {
    for (var i = 0; i < MAP.areas.length; i++) {
      if (MAP.areas[i].home === h) {
        return MAP.areas[i].id;
      }
    }
    return null;
  }

  function allHouseUnits(state, h) {
    var list = [];
    Object.keys(state.areas).forEach(function (id) {
      state.areas[id].units.forEach(function (u, idx) {
        if (u.h === h) {
          list.push({ area: id, idx: idx, t: u.t });
        }
      });
    });
    return list;
  }

  HANDLERS.destroyUnits = function (state, task) {
    if (task.done) {
      return true;
    }
    var units = allHouseUnits(state, task.h);
    var count = Math.min(task.count, units.length);
    if (count === 0) {
      return true;
    }
    if (count === units.length) {
      units.reverse().forEach(function (u) {
        state.areas[u.area].units.splice(u.idx, 1);
      });
      log(state, houseName(task.h) + " loses all remaining units to the horde.", task.h);
      return true;
    }
    setPending(state, { kind: "destroyUnits", houses: [task.h], count: count });
    return false;
  };

  HANDLERS.downgrade = function (state, task) {
    if (task.done) {
      return true;
    }
    var knights = allHouseUnits(state, task.h).filter(function (u) {
      return u.t === "knight";
    });
    var count = Math.min(task.count, knights.length);
    if (count === 0) {
      return true;
    }
    if (count === knights.length) {
      knights.slice().reverse().forEach(function (u) {
        downgradeKnight(state, task.h, u.area, u.idx);
      });
      log(state, houseName(task.h) + " downgrades " + count + " Knight(s).", task.h);
      return true;
    }
    setPending(state, { kind: "downgrade", houses: [task.h], count: count });
    return false;
  };

  function downgradeKnight(state, h, areaId, idx) {
    var unit = state.areas[areaId].units[idx];
    if (poolCount(state, h, "footman") > 0) {
      unit.t = "footman";
    } else {
      state.areas[areaId].units.splice(idx, 1);
    }
  }

  HANDLERS.upgradeOne = function (state, task) {
    var footmen = allHouseUnits(state, task.h).filter(function (u) {
      return u.t === "footman";
    });
    if (footmen.length === 0 || poolCount(state, task.h, "knight") === 0) {
      return true;
    }
    if (task.answered) {
      return true;
    }
    setPending(state, { kind: "upgradeOne", houses: [task.h] });
    return false;
  };

  HANDLERS.discardLeaders = function (state, task) {
    if (task.done) {
      return true;
    }
    var hand = state.houses[task.h].hand;
    var count = Math.min(task.count, hand.length - 1);
    if (count <= 0) {
      return true;
    }
    setPending(state, { kind: "discardLeaders", houses: [task.h], count: count });
    return false;
  };

  HANDLERS.chooseTrack = function (state, task) {
    if (task.done) {
      return true;
    }
    setPending(state, { kind: "chooseTrack", houses: [task.h] });
    return false;
  };

  HANDLERS.planning = function (state, task) {
    state.phase = "planning";
    if (!task.subs) {
      task.subs = {};
      var need = R.HOUSE_ORDER.filter(function (h) {
        return areasWithUnits(state, h).length > 0;
      });
      if (need.length === 0) {
        return true;
      }
      setPending(state, { kind: "orders", houses: need });
      return false;
    }
    Object.keys(task.subs).forEach(function (h) {
      var orders = task.subs[h];
      Object.keys(orders).forEach(function (areaId) {
        state.areas[areaId].order = { h: h, id: orders[areaId] };
      });
    });
    log(state, "Orders are revealed.");
    return true;
  };

  HANDLERS.raven = function (state, task) {
    var holder = state.tracks.court[0];
    if (!task.asked) {
      task.asked = true;
      state.phase = "planning";
      setPending(state, { kind: "raven", houses: [holder] });
      return false;
    }
    if (task.peek && !task.peekDone) {
      setPending(state, { kind: "ravenPeek", houses: [holder], card: state.hordeDeck[0] });
      return false;
    }
    return true;
  };

  HANDLERS.raids = function (state, task) {
    state.phase = "action";
    var idx = nextHouseWith(state, task.turn, function (h) {
      return ordersOfKind(state, h, "raid").length > 0;
    });
    if (idx < 0) {
      return true;
    }
    var h = state.tracks.crown[idx];
    task.turn = idx + 1;
    setPending(state, { kind: "raid", houses: [h] });
    return false;
  };

  HANDLERS.marches = function (state, task) {
    state.phase = "action";
    if (state.winner) {
      return true;
    }
    var idx = nextHouseWith(state, task.turn, function (h) {
      return ordersOfKind(state, h, "march").length > 0;
    });
    if (idx < 0) {
      return true;
    }
    var h = state.tracks.crown[idx];
    task.turn = idx + 1;
    setPending(state, { kind: "march", houses: [h] });
    return false;
  };

  HANDLERS.consolidate = function (state, task) {
    state.phase = "action";
    if (!task.list) {
      task.list = [];
      state.tracks.crown.forEach(function (h) {
        ordersOfKind(state, h, "consolidate").forEach(function (id) {
          task.list.push({ h: h, area: id });
        });
      });
      task.index = 0;
    }
    while (task.index < task.list.length) {
      var item = task.list[task.index];
      var area = state.areas[item.area];
      if (!area.order || area.order.h !== item.h) {
        task.index++;
        continue;
      }
      var o = ORDER_BY_ID[area.order.id];
      var info = AREA[item.area];
      if (o.star && info.type === "land" && info.castle > 0 && !task.choiceMade) {
        setPending(state, { kind: "consolidateChoice", houses: [item.h], area: item.area });
        return false;
      }
      if (task.choiceMade === "muster") {
        task.choiceMade = null;
        area.order = null;
        task.index++;
        pushFront(state, [{ t: "muster", h: item.h, areas: [{ area: item.area, points: info.castle }] }]);
        return false;
      }
      task.choiceMade = null;
      var amount = 0;
      if (info.type === "land") {
        amount = 1 + info.crowns;
      }
      var got = gainPower(state, item.h, amount);
      log(state, houseName(item.h) + " consolidates power in " + info.name + " (+" + got + ").", item.h);
      area.order = null;
      task.index++;
    }
    return true;
  };

  HANDLERS.cleanup = function (state) {
    Object.keys(state.areas).forEach(function (id) {
      var area = state.areas[id];
      area.order = null;
      area.units.forEach(function (u) {
        u.r = false;
      });
    });
    state.bladeUsed = false;
    state.restrict = {};
    checkVictory(state);
    if (state.winner) {
      return true;
    }
    if (state.round >= R.LAST_ROUND) {
      finalScoring(state);
      return true;
    }
    state.round++;
    log(state, "Round " + state.round + " begins.");
    pushFront(state, [{ t: "round" }]);
    return true;
  };

  function strongholdCount(state, h) {
    var n = 0;
    MAP.areas.forEach(function (a) {
      if (a.type === "land" && a.castle === 2 && controller(state, a.id) === h) {
        n++;
      }
    });
    return n;
  }

  function scoreTuple(state, h) {
    return [castleCount(state, h), strongholdCount(state, h), state.houses[h].supply, state.houses[h].power, -trackPos(state, "crown", h)];
  }

  function finalScoring(state) {
    var ranking = R.HOUSE_ORDER.slice().sort(function (a, b) {
      var ta = scoreTuple(state, a);
      var tb = scoreTuple(state, b);
      for (var i = 0; i < ta.length; i++) {
        if (ta[i] !== tb[i]) {
          return tb[i] - ta[i];
        }
      }
      return 0;
    });
    state.winner = ranking[0];
    state.finalScores = ranking.map(function (h) {
      return { h: h, castles: castleCount(state, h), strongholds: strongholdCount(state, h), supply: state.houses[h].supply, power: state.houses[h].power };
    });
    state.phase = "over";
    state.pending = null;
    log(state, "Round 10 is over. " + R.HOUSES[state.winner].name + " wins with " + castleCount(state, state.winner) + " castles and strongholds.", state.winner);
  }

  function checkVictory(state) {
    if (state.winner) {
      return;
    }
    for (var i = 0; i < state.tracks.crown.length; i++) {
      var h = state.tracks.crown[i];
      if (castleCount(state, h) >= R.VICTORY_CASTLES) {
        state.winner = h;
        state.phase = "over";
        state.pending = null;
        state.tasks = [];
        state.finalScores = R.HOUSE_ORDER.map(function (x) {
          return { h: x, castles: castleCount(state, x), strongholds: strongholdCount(state, x), supply: state.houses[x].supply, power: state.houses[x].power };
        }).sort(function (a, b) {
          return b.castles - a.castles;
        });
        log(state, R.HOUSES[h].name + " controls " + R.VICTORY_CASTLES + " castles and strongholds and wins the war!", h);
        return;
      }
    }
  }

  HANDLERS.combat = function (state) {
    var c = state.combat;
    if (!c) {
      return true;
    }
    if (c.stage === "support") {
      if (!c.supportInit) {
        c.supportInit = true;
        c.support = {};
        c.supportAsk = [];
        var orders = supportOrdersFor(state, c.area);
        var seen = {};
        orders.forEach(function (s) {
          if (s.h === c.att) {
            c.support[s.h] = "att";
          } else if (s.h === c.def) {
            c.support[s.h] = "def";
          } else if (!seen[s.h]) {
            seen[s.h] = true;
          }
        });
        state.tracks.crown.forEach(function (h) {
          if (seen[h]) {
            c.supportAsk.push(h);
          }
        });
      }
      if (c.supportAsk.length > 0) {
        setPending(state, { kind: "support", houses: [c.supportAsk[0]] });
        return false;
      }
      c.stage = "leaders";
    }
    if (c.stage === "leaders") {
      if (!c.cards) {
        c.cards = {};
        setPending(state, { kind: "leader", houses: [c.att, c.def] });
        return false;
      }
      c.stage = "blade";
      computeCombat(state);
      log(state, houseName(c.att) + " plays " + LEADER_BY_ID[c.cards[c.att]].name + "; " + houseName(c.def) + " plays " + LEADER_BY_ID[c.cards[c.def]].name + ".");
    }
    if (c.stage === "blade") {
      var holder = state.tracks.sword[0];
      if (!state.bladeUsed && (holder === c.att || holder === c.def) && c.bladeAsked !== true) {
        c.bladeAsked = true;
        setPending(state, { kind: "blade", houses: [holder] });
        return false;
      }
      c.stage = "resolve";
    }
    if (c.stage === "resolve") {
      computeCombat(state);
      resolveCombat(state);
      c.stage = "casualties";
    }
    if (c.stage === "casualties") {
      if (!c.casualtiesDone) {
        var need = casualtyNeed(state);
        if (need.choose) {
          setPending(state, { kind: "casualties", houses: [c.loser], count: need.count });
          return false;
        }
        applyCasualties(state, need.auto);
        c.casualtiesDone = true;
      }
      c.stage = "retreat";
    }
    if (c.stage === "retreat") {
      if (!c.retreatDone) {
        if (c.loser === c.att) {
          attackerRetreat(state);
          c.retreatDone = true;
        } else {
          var survivors = state.areas[c.area].units.filter(function (u) {
            return u.h === c.def;
          });
          if (survivors.length === 0) {
            c.retreatDone = true;
          } else {
            var options = retreatOptions(state, c.def, c.area, c.from, survivors);
            if (options.length === 0) {
              state.areas[c.area].units = state.areas[c.area].units.filter(function (u) {
                return u.h !== c.def;
              });
              log(state, houseName(c.def) + " has nowhere to retreat; the units are destroyed.", c.def);
              c.retreatDone = true;
            } else if (options.length === 1) {
              defenderRetreat(state, options[0]);
              c.retreatDone = true;
            } else {
              setPending(state, { kind: "retreat", houses: [c.def], options: options });
              return false;
            }
          }
        }
      }
      finishCombat(state);
      return true;
    }
    return true;
  };

  function battleUnits(state, h) {
    var c = state.combat;
    if (h === c.att) {
      return c.units;
    }
    return state.areas[c.area].units.filter(function (u) {
      return u.h === c.def;
    });
  }

  function cardAbility(state, h) {
    var c = state.combat;
    var mine = LEADER_BY_ID[c.cards[h]];
    var opp = c.att;
    if (h === c.att) {
      opp = c.def;
    }
    var oppCard = LEADER_BY_ID[c.cards[opp]];
    if (oppCard && oppCard.ability === "cancelText") {
      return null;
    }
    return mine.ability;
  }

  function computeCombat(state) {
    var c = state.combat;
    var info = AREA[c.area];
    var castle = info.type === "land" && info.castle > 0;
    var sides = {};
    [c.att, c.def].forEach(function (h) {
      var attacking = h === c.att;
      var b = { units: 0, order: 0, garrison: 0, support: 0, card: 0, ability: 0, blade: 0, supportAreas: 0 };
      battleUnits(state, h).forEach(function (u) {
        b.units += unitStrength(u, castle && attacking, !attacking);
      });
      sides[h] = b;
    });
    var abilities = {};
    abilities[c.att] = null;
    abilities[c.def] = null;
    if (c.cards && c.cards[c.att] && c.cards[c.def]) {
      abilities[c.att] = cardAbility(state, c.att);
      abilities[c.def] = cardAbility(state, c.def);
    }
    var att = sides[c.att];
    var def = sides[c.def];
    att.order = c.marchBonus;
    if (abilities[c.def] === "ignoreMarch" && att.order > 0) {
      att.order = 0;
    }
    var area = state.areas[c.area];
    if (area.order && area.order.h === c.def && ORDER_BY_ID[area.order.id].kind === "defence") {
      def.order = ORDER_BY_ID[area.order.id].bonus;
      if (abilities[c.att] === "ignoreDefence") {
        def.order = 0;
      }
    }
    if (info.home === c.def && area.garrison > 0) {
      def.garrison = area.garrison;
    }
    supportOrdersFor(state, c.area).forEach(function (s) {
      var side = c.support[s.h];
      if (side !== "att" && side !== "def") {
        return;
      }
      var target = c.att;
      if (side === "def") {
        target = c.def;
      }
      var opp = c.def;
      if (target === c.def) {
        opp = c.att;
      }
      if (abilities[opp] === "ignoreSupport" && s.h !== target) {
        return;
      }
      sides[target].support += supportStrength(state, s.area, s.bonus, side === "att", c.area);
      sides[target].supportAreas += 1;
    });
    if (c.cards && c.cards[c.att] && c.cards[c.def]) {
      [c.att, c.def].forEach(function (h) {
        var b = sides[h];
        var card = LEADER_BY_ID[c.cards[h]];
        var opp = c.def;
        if (h === c.def) {
          opp = c.att;
        }
        var oppCard = LEADER_BY_ID[c.cards[opp]];
        b.card = card.strength;
        var ab = abilities[h];
        if (ab === "defendPlusOne" && h === c.def) {
          b.ability += 1;
        }
        if (ab === "seaPlusOne" && info.type === "sea") {
          b.ability += 1;
        }
        if (ab === "plusPerSupport") {
          b.ability += b.supportAreas;
        }
        if (ab === "plusPerKnight") {
          var knights = 0;
          battleUnits(state, h).forEach(function (u) {
            if (u.t === "knight" && !u.r) {
              knights++;
            }
          });
          b.ability += Math.min(2, knights);
        }
        if (ab === "castleDefend" && h === c.def && castle) {
          b.ability += 1;
        }
        if (ab === "underdog" && oppCard.strength > card.strength) {
          b.ability += 2;
        }
      });
    }
    if (c.bladeUsedBy) {
      sides[c.bladeUsedBy].blade = 1;
    }
    [c.att, c.def].forEach(function (h) {
      var b = sides[h];
      b.total = b.units + b.order + b.garrison + b.support + b.card + b.ability + b.blade;
    });
    c.sides = sides;
    c.abilities = abilities;
  }

  function resolveCombat(state) {
    var c = state.combat;
    var a = c.sides[c.att].total;
    var d = c.sides[c.def].total;
    var winner = null;
    var tieReason = null;
    if (a > d) {
      winner = c.att;
    } else if (d > a) {
      winner = c.def;
    } else {
      if (c.abilities[c.att] === "winTies") {
        winner = c.att;
        tieReason = "card";
      } else if (c.abilities[c.def] === "winTies") {
        winner = c.def;
        tieReason = "card";
      } else if (trackPos(state, "sword", c.att) < trackPos(state, "sword", c.def)) {
        winner = c.att;
        tieReason = "sword";
      } else {
        winner = c.def;
        tieReason = "sword";
      }
    }
    var loser = c.def;
    if (winner === c.def) {
      loser = c.att;
    }
    c.winner = winner;
    c.loser = loser;
    c.tieReason = tieReason;
    var wCard = LEADER_BY_ID[c.cards[winner]];
    var lCard = LEADER_BY_ID[c.cards[loser]];
    var count = Math.max(0, wCard.swords - lCard.forts);
    if (c.abilities[winner] === "extraKill") {
      count += 1;
    }
    if (c.abilities[loser] === "noCasualties") {
      count = 0;
    }
    c.casualties = count;
    var text = houseName(winner) + " wins the battle for " + areaName(c.area) + " (" + c.sides[winner].total + " to " + c.sides[loser].total + ")";
    if (tieReason === "sword") {
      text += ", winning the tie through the Sword track";
    } else if (tieReason === "card") {
      text += ", winning the tie through " + wCard.name;
    }
    log(state, text + ".", winner);
  }

  function casualtyNeed(state) {
    var c = state.combat;
    var units = battleUnits(state, c.loser);
    var healthy = [];
    units.forEach(function (u, i) {
      if (!u.r) {
        healthy.push(i);
      }
    });
    var count = Math.min(c.casualties, healthy.length);
    if (count === 0) {
      return { choose: false, auto: [] };
    }
    if (count === healthy.length) {
      return { choose: false, auto: healthy };
    }
    var types = {};
    healthy.forEach(function (i) {
      types[units[i].t] = true;
    });
    if (Object.keys(types).length === 1) {
      return { choose: false, auto: healthy.slice(0, count) };
    }
    return { choose: true, count: count };
  }

  function applyCasualties(state, indices) {
    var c = state.combat;
    if (indices.length === 0) {
      return;
    }
    var units = battleUnits(state, c.loser);
    var doomed = indices.map(function (i) {
      return units[i];
    });
    var names = doomed.map(function (u) {
      return R.UNIT_NAMES[u.t];
    });
    if (c.loser === c.att) {
      c.units = c.units.filter(function (u) {
        return doomed.indexOf(u) < 0;
      });
    } else {
      state.areas[c.area].units = state.areas[c.area].units.filter(function (u) {
        return doomed.indexOf(u) < 0;
      });
    }
    log(state, houseName(c.loser) + " loses " + names.join(", ") + " as casualties.", c.loser);
  }

  function retreatOptions(state, h, fromArea, attackerFrom, units) {
    var isSea = AREA[fromArea].type === "sea";
    var candidates = {};
    if (isSea) {
      ADJ[fromArea].forEach(function (id) {
        if (AREA[id].type === "sea") {
          candidates[id] = true;
        }
      });
    } else {
      var reach = landReach(state, fromArea, h);
      Object.keys(reach).forEach(function (id) {
        candidates[id] = true;
      });
    }
    var moving = units.filter(function (u) {
      return !u.r && u.t !== "siege";
    }).length;
    var options = [];
    Object.keys(candidates).forEach(function (id) {
      if (id === attackerFrom) {
        return;
      }
      var area = state.areas[id];
      if (area.units.length > 0 && area.units[0].h !== h) {
        return;
      }
      if (area.neutral > 0) {
        return;
      }
      var ctrl = controller(state, id);
      if (ctrl && ctrl !== h) {
        return;
      }
      var counts = houseUnitCounts(state, h);
      delete counts[fromArea];
      counts[id] = (counts[id] || 0) + moving;
      options.push({ id: id, fits: supplyFits(counts, state.houses[h].supply) });
    });
    var fitting = options.filter(function (o) {
      return o.fits;
    });
    if (fitting.length > 0) {
      return fitting.map(function (o) {
        return o.id;
      });
    }
    return options.map(function (o) {
      return o.id;
    });
  }

  function unitValue(t) {
    if (t === "knight") {
      return 3;
    }
    if (t === "siege") {
      return 2;
    }
    return 1;
  }

  function trimToSupply(state, h, areaId, retreating) {
    var removed = [];
    while (!supplyOk(state, h)) {
      var units = state.areas[areaId].units;
      var worst = -1;
      for (var i = 0; i < units.length; i++) {
        if (retreating.indexOf(units[i]) < 0) {
          continue;
        }
        if (worst < 0 || unitValue(units[i].t) < unitValue(units[worst].t)) {
          worst = i;
        }
      }
      if (worst < 0) {
        break;
      }
      removed.push(units[worst].t);
      units.splice(worst, 1);
    }
    if (removed.length > 0) {
      log(state, houseName(h) + " cannot supply every retreating unit and loses " + removed.map(function (t) {
        return R.UNIT_NAMES[t];
      }).join(", ") + ".", h);
    }
  }

  function attackerRetreat(state) {
    var c = state.combat;
    var lost = [];
    var back = [];
    c.units.forEach(function (u) {
      if (u.r || u.t === "siege") {
        lost.push(u);
      } else {
        u.r = true;
        back.push(u);
      }
    });
    if (lost.length > 0) {
      log(state, houseName(c.att) + " loses " + lost.map(function (u) {
        return R.UNIT_NAMES[u.t];
      }).join(", ") + " in the retreat.", c.att);
    }
    var origin = state.areas[c.from];
    back.forEach(function (u) {
      origin.units.push(u);
    });
    c.units = [];
    if (back.length > 0) {
      trimToSupply(state, c.att, c.from, back);
      log(state, houseName(c.att) + " retreats to " + areaName(c.from) + ".", c.att);
    }
  }

  function defenderRetreat(state, to) {
    var c = state.combat;
    var area = state.areas[c.area];
    var mine = area.units.filter(function (u) {
      return u.h === c.def;
    });
    area.units = area.units.filter(function (u) {
      return u.h !== c.def;
    });
    var lost = [];
    var moved = [];
    var dest = state.areas[to];
    mine.forEach(function (u) {
      if (u.r || u.t === "siege") {
        lost.push(u);
      } else {
        u.r = true;
        dest.units.push(u);
        moved.push(u);
      }
    });
    if (lost.length > 0) {
      log(state, houseName(c.def) + " loses " + lost.map(function (u) {
        return R.UNIT_NAMES[u.t];
      }).join(", ") + " in the retreat.", c.def);
    }
    trimToSupply(state, c.def, to, moved);
    log(state, houseName(c.def) + " retreats to " + areaName(to) + ".", c.def);
  }

  function finishCombat(state) {
    var c = state.combat;
    var area = state.areas[c.area];
    var info = AREA[c.area];
    if (c.winner === c.att) {
      area.units = area.units.filter(function (u) {
        return u.h === c.att;
      });
      c.units.forEach(function (u) {
        u.r = false;
        area.units.push(u);
      });
      c.units = [];
      if (area.order && area.order.h === c.def) {
        area.order = null;
      }
      area.ptoken = null;
      if (info.home && info.home !== c.att && area.garrison > 0) {
        area.garrison = 0;
        log(state, "The garrison of " + info.name + " is destroyed.");
      }
    }
    [c.att, c.def].forEach(function (h) {
      var cardId = c.cards[h];
      var hand = state.houses[h];
      hand.hand = hand.hand.filter(function (id) {
        return id !== cardId;
      });
      var ab = c.abilities[h];
      var returned = false;
      if (c.loser === h && (ab === "loseReturn" || ab === "losePowerReturn")) {
        hand.hand.push(cardId);
        returned = true;
        log(state, LEADER_BY_ID[cardId].name + " returns to " + houseName(h) + "'s hand.", h);
      }
      if (!returned) {
        hand.discard.push(cardId);
      }
      if (c.loser === h && ab === "losePowerReturn") {
        gainPower(state, h, 1);
      }
    });
    var w = c.winner;
    var l = c.loser;
    var wab = c.abilities[w];
    if (wab === "winPowerTwo") {
      var g = gainPower(state, w, 2);
      log(state, houseName(w) + " gains " + g + " power from " + LEADER_BY_ID[c.cards[w]].name + ".", w);
    }
    if (wab === "winStealPower") {
      var taken = losePower(state, l, 1);
      if (taken > 0) {
        gainPower(state, w, 1);
      }
      log(state, houseName(w) + " takes " + taken + " power from " + houseName(l) + ".", w);
    }
    if (wab === "winDiscardRandom") {
      var lh = state.houses[l];
      if (lh.hand.length > 1) {
        var pick = Math.floor(rand(state) * lh.hand.length);
        var gone = lh.hand.splice(pick, 1)[0];
        lh.discard.push(gone);
        log(state, houseName(l) + " discards " + LEADER_BY_ID[gone].name + " at random.", l);
      }
    }
    [c.att, c.def].forEach(function (h) {
      var hand = state.houses[h];
      if (hand.hand.length === 0) {
        var last = c.cards[h];
        hand.hand = hand.discard.filter(function (id) {
          return id !== last;
        });
        hand.discard = hand.discard.filter(function (id) {
          return id === last;
        });
        log(state, houseName(h) + " takes back their leader cards.", h);
      }
    });
    state.lastBattle = {
      round: state.round,
      area: c.area,
      att: c.att,
      def: c.def,
      winner: c.winner,
      cards: clone(c.cards),
      sides: clone(c.sides),
      casualties: c.casualties,
      tieReason: c.tieReason,
      abilities: clone(c.abilities)
    };
    state.combat = null;
    checkVictory(state);
  }

  function startCombat(state, h, from, target, units, marchBonus) {
    var area = state.areas[target];
    var def = null;
    if (area.units.length > 0) {
      def = area.units[0].h;
    } else {
      def = AREA[target].home;
    }
    state.combat = {
      att: h,
      def: def,
      area: target,
      from: from,
      units: units,
      marchBonus: marchBonus,
      stage: "support",
      cards: null
    };
    log(state, houseName(h) + " attacks " + houseName(def) + " in " + areaName(target) + "!", h);
    pushFront(state, [{ t: "combat" }]);
  }

  function neutralStrength(state, h, from, target, units, marchBonus) {
    var castle = AREA[target].castle > 0;
    var total = marchBonus;
    units.forEach(function (u) {
      total += unitStrength(u, castle, false);
    });
    supportOrdersFor(state, target).forEach(function (s) {
      if (s.h === h && s.area !== from) {
        total += supportStrength(state, s.area, s.bonus, true, target);
      }
    });
    return total;
  }

  function analyseMarch(state, h, action) {
    var from = action.from;
    var area = state.areas[from];
    if (!area || !area.order || area.order.h !== h || ORDER_BY_ID[area.order.id].kind !== "march") {
      fail("Choose one of your March orders.");
    }
    var bonus = ORDER_BY_ID[area.order.id].bonus;
    var moves = action.moves || [];
    var used = {};
    var byTarget = {};
    moves.forEach(function (m) {
      if (!state.areas[m.to]) {
        fail("Unknown destination.");
      }
      if (m.to === from) {
        fail("Units that stay behind do not need a move.");
      }
      if (!m.units || m.units.length === 0) {
        return;
      }
      m.units.forEach(function (i) {
        if (typeof i !== "number" || i < 0 || i >= area.units.length) {
          fail("Unknown unit.");
        }
        if (used[i]) {
          fail("A unit can only move once.");
        }
        used[i] = true;
        if (area.units[i].r) {
          fail("Routed units cannot march.");
        }
      });
      if (!byTarget[m.to]) {
        byTarget[m.to] = [];
      }
      m.units.forEach(function (i) {
        byTarget[m.to].push(i);
      });
    });
    var combatTarget = null;
    var plain = [];
    Object.keys(byTarget).forEach(function (to) {
      var idxs = byTarget[to];
      var ships = 0;
      idxs.forEach(function (i) {
        if (area.units[i].t === "ship") {
          ships++;
        }
      });
      var isShip = ships > 0;
      if (isShip && ships !== idxs.length) {
        fail("Ships and land units cannot move together.");
      }
      var reach = moveTargets(state, from, h, isShip);
      if (!reach[to]) {
        if (isShip) {
          fail("Ships can only move to an adjacent sea area.");
        }
        fail(areaName(to) + " is not reachable from " + areaName(from) + ".");
      }
      var dest = state.areas[to];
      var enemy = dest.units.length > 0 && dest.units[0].h !== h;
      var garrisonFight = dest.units.length === 0 && AREA[to].home && AREA[to].home !== h && dest.garrison > 0 && controller(state, to) === AREA[to].home;
      if (enemy || garrisonFight || dest.neutral > 0) {
        if (combatTarget && combatTarget !== to) {
          fail("A march can start only one battle.");
        }
        combatTarget = to;
      } else {
        plain.push(to);
      }
    });
    var counts = houseUnitCounts(state, h);
    var moved = Object.keys(used).length;
    counts[from] = (counts[from] || 0) - moved;
    if (counts[from] <= 0) {
      delete counts[from];
    }
    Object.keys(byTarget).forEach(function (to) {
      counts[to] = (counts[to] || 0) + byTarget[to].length;
    });
    if (!supplyFits(counts, state.houses[h].supply)) {
      fail("That move would create an army larger than your supply allows.");
    }
    if (combatTarget && state.areas[combatTarget].neutral > 0) {
      var units = byTarget[combatTarget].map(function (i) {
        return area.units[i];
      });
      var strength = neutralStrength(state, h, from, combatTarget, units, bonus);
      if (strength < state.areas[combatTarget].neutral) {
        fail("The neutral force in " + areaName(combatTarget) + " has strength " + state.areas[combatTarget].neutral + "; your attack only reaches " + strength + ".");
      }
    }
    var allLeave = moved === area.units.length && moved > 0;
    if (action.leaveToken) {
      if (!allLeave) {
        fail("You can only leave a power token when every unit leaves.");
      }
      if (AREA[from].type !== "land" || AREA[from].home === h) {
        fail("You cannot leave a power token there.");
      }
      if (state.houses[h].power < 1 && area.ptoken !== h) {
        fail("You have no power tokens to spare.");
      }
    }
    return { from: from, bonus: bonus, byTarget: byTarget, combatTarget: combatTarget, plain: plain, allLeave: allLeave };
  }

  function doMarch(state, h, action) {
    var plan = analyseMarch(state, h, action);
    var area = state.areas[plan.from];
    var picked = {};
    Object.keys(plan.byTarget).forEach(function (to) {
      picked[to] = plan.byTarget[to].map(function (i) {
        return area.units[i];
      });
    });
    var movedSet = [];
    Object.keys(picked).forEach(function (to) {
      picked[to].forEach(function (u) {
        movedSet.push(u);
      });
    });
    area.units = area.units.filter(function (u) {
      return movedSet.indexOf(u) < 0;
    });
    area.order = null;
    var parts = [];
    plan.plain.forEach(function (to) {
      var dest = state.areas[to];
      picked[to].forEach(function (u) {
        dest.units.push(u);
      });
      if (dest.ptoken && dest.ptoken !== h) {
        log(state, houseName(h) + " removes " + houseName(dest.ptoken) + "'s power token from " + areaName(to) + ".", h);
        dest.ptoken = null;
      }
      parts.push(picked[to].length + " to " + areaName(to));
    });
    if (plan.allLeave && AREA[plan.from].type === "land") {
      if (action.leaveToken && area.ptoken !== h) {
        state.houses[h].power -= 1;
        area.ptoken = h;
        log(state, houseName(h) + " leaves a power token to hold " + areaName(plan.from) + ".", h);
      }
    }
    if (parts.length > 0) {
      log(state, houseName(h) + " marches from " + areaName(plan.from) + ": " + parts.join(", ") + ".", h);
    } else if (!plan.combatTarget) {
      log(state, houseName(h) + " resolves the March order in " + areaName(plan.from) + " without moving.", h);
    }
    if (plan.combatTarget) {
      var target = plan.combatTarget;
      var dest = state.areas[target];
      if (dest.neutral > 0) {
        var units = picked[target];
        log(state, houseName(h) + " defeats the neutral force in " + areaName(target) + ".", h);
        dest.neutral = 0;
        dest.ptoken = null;
        units.forEach(function (u) {
          dest.units.push(u);
        });
        checkVictory(state);
      } else {
        startCombat(state, h, plan.from, target, picked[target], plan.bonus);
      }
    } else {
      checkVictory(state);
    }
  }

  function usableTokenCount(state, h) {
    var plain = 0;
    var stars = 0;
    R.ORDERS.forEach(function (o) {
      if (!tokenAllowed(state, o.id)) {
        return;
      }
      if (o.star) {
        stars++;
      } else {
        plain++;
      }
    });
    return plain + Math.min(stars, starLimit(state, h));
  }

  function validateOrders(state, h, orders) {
    if (!orders || typeof orders !== "object") {
      fail("No orders given.");
    }
    var need = areasWithUnits(state, h);
    var usedTokens = {};
    var stars = 0;
    var placed = 0;
    need.forEach(function (id) {
      if (orders[id]) {
        placed++;
      }
    });
    if (placed < Math.min(need.length, usableTokenCount(state, h))) {
      fail("Place an order in every area where you have units.");
    }
    need.forEach(function (id) {
      var token = orders[id];
      if (!token) {
        return;
      }
      var o = ORDER_BY_ID[token];
      if (!o) {
        fail("Unknown order.");
      }
      if (usedTokens[token]) {
        fail("Each order token can only be used once.");
      }
      usedTokens[token] = true;
      if (!tokenAllowed(state, token)) {
        fail(o.label + " is not allowed this round.");
      }
      if (o.star) {
        stars++;
      }
    });
    Object.keys(orders).forEach(function (id) {
      if (need.indexOf(id) < 0) {
        fail("You can only give orders where you have units.");
      }
    });
    if (stars > starLimit(state, h)) {
      fail("Your Court position allows only " + starLimit(state, h) + " special orders.");
    }
  }

  function validateMuster(state, h, builds, areas) {
    var points = {};
    areas.forEach(function (a) {
      points[a.area] = a.points;
    });
    var counts = houseUnitCounts(state, h);
    var pool = { footman: poolCount(state, h, "footman"), knight: poolCount(state, h, "knight"), ship: poolCount(state, h, "ship"), siege: poolCount(state, h, "siege") };
    var upgraded = {};
    var plan = [];
    (builds || []).forEach(function (b) {
      if (points[b.area] === undefined) {
        fail("You cannot muster in that area.");
      }
      var cost = 0;
      if (b.kind === "footman" || b.kind === "ship") {
        cost = 1;
      } else if (b.kind === "knight" || b.kind === "siege") {
        cost = 2;
      } else if (b.kind === "upKnight" || b.kind === "upSiege") {
        cost = 1;
      } else {
        fail("Unknown unit.");
      }
      points[b.area] -= cost;
      if (points[b.area] < 0) {
        fail(areaName(b.area) + " does not have enough mustering points.");
      }
      if (b.kind === "ship") {
        if (!b.sea || ADJ[b.area].indexOf(b.sea) < 0 || AREA[b.sea].type !== "sea") {
          fail("Ships must be placed in a sea next to " + areaName(b.area) + ".");
        }
        if (isEnemyArea(state, b.sea, h)) {
          fail("Enemy ships hold " + areaName(b.sea) + ".");
        }
        pool.ship -= 1;
        counts[b.sea] = (counts[b.sea] || 0) + 1;
      } else if (b.kind === "upKnight" || b.kind === "upSiege") {
        var unit = state.areas[b.area].units[b.unit];
        var key = b.area + ":" + b.unit;
        if (!unit || unit.h !== h || unit.t !== "footman" || upgraded[key]) {
          fail("Choose one of your Footmen in " + areaName(b.area) + " to upgrade.");
        }
        upgraded[key] = true;
        pool.footman += 1;
        if (b.kind === "upKnight") {
          pool.knight -= 1;
        } else {
          pool.siege -= 1;
        }
      } else {
        if (isEnemyArea(state, b.area, h)) {
          fail("You do not control " + areaName(b.area) + ".");
        }
        pool[b.kind] -= 1;
        counts[b.area] = (counts[b.area] || 0) + 1;
      }
      plan.push(b);
    });
    Object.keys(pool).forEach(function (t) {
      if (pool[t] < 0) {
        fail("You have no " + R.UNIT_NAMES[t] + " pieces left.");
      }
    });
    if (!supplyFits(counts, state.houses[h].supply)) {
      fail("Those units would break your supply limit.");
    }
    return plan;
  }

  function applyMuster(state, h, plan) {
    var names = [];
    plan.forEach(function (b) {
      if (b.kind === "ship") {
        state.areas[b.sea].units.push({ t: "ship", h: h, r: false });
        names.push("Ship in " + areaName(b.sea));
      } else if (b.kind === "upKnight") {
        state.areas[b.area].units[b.unit].t = "knight";
        names.push("Knight upgrade in " + areaName(b.area));
      } else if (b.kind === "upSiege") {
        state.areas[b.area].units[b.unit].t = "siege";
        names.push("Siege Engine upgrade in " + areaName(b.area));
      } else {
        state.areas[b.area].units.push({ t: b.kind, h: h, r: false });
        names.push(R.UNIT_NAMES[b.kind] + " in " + areaName(b.area));
      }
    });
    if (names.length > 0) {
      log(state, houseName(h) + " musters: " + names.join(", ") + ".", h);
    } else {
      log(state, houseName(h) + " musters nothing.", h);
    }
  }

  function validateRemoval(state, h, picks, count, predicate) {
    if (!Array.isArray(picks) || picks.length !== count) {
      fail("Choose exactly " + count + " unit(s).");
    }
    var seen = {};
    picks.forEach(function (p) {
      var area = state.areas[p.area];
      if (!area || !area.units[p.idx] || area.units[p.idx].h !== h) {
        fail("Choose your own units.");
      }
      var key = p.area + ":" + p.idx;
      if (seen[key]) {
        fail("Each unit can only be chosen once.");
      }
      seen[key] = true;
      if (predicate && !predicate(area.units[p.idx])) {
        fail("That unit cannot be chosen here.");
      }
    });
  }

  function removePicks(state, picks) {
    var byArea = {};
    picks.forEach(function (p) {
      if (!byArea[p.area]) {
        byArea[p.area] = [];
      }
      byArea[p.area].push(p.idx);
    });
    var names = [];
    Object.keys(byArea).forEach(function (id) {
      byArea[id].sort(function (a, b) {
        return b - a;
      }).forEach(function (idx) {
        names.push(R.UNIT_NAMES[state.areas[id].units[idx].t] + " in " + areaName(id));
        state.areas[id].units.splice(idx, 1);
      });
    });
    return names;
  }

  function frontTask(state) {
    return state.tasks[0];
  }

  function applyAction(state, h, action) {
    try {
      if (state.winner) {
        fail("The game is over.");
      }
      var p = state.pending;
      if (!p) {
        fail("Nothing to do right now.");
      }
      if (p.houses.indexOf(h) < 0) {
        fail("It is not your turn to act.");
      }
      if (!action || action.type !== p.kind) {
        fail("That action does not fit the current step.");
      }
      var task = frontTask(state);
      var done = true;
      if (p.kind === "orders") {
        validateOrders(state, h, action.orders);
        task.subs[h] = clone(action.orders);
        p.houses = p.houses.filter(function (x) {
          return x !== h;
        });
        done = p.houses.length === 0;
      } else if (p.kind === "raven") {
        if (action.mode === "swap") {
          var area = state.areas[action.area];
          if (!area || !area.order || area.order.h !== h) {
            fail("Choose one of your own orders to replace.");
          }
          var token = ORDER_BY_ID[action.token];
          if (!token) {
            fail("Unknown order.");
          }
          var inUse = false;
          Object.keys(state.areas).forEach(function (id) {
            var o = state.areas[id].order;
            if (o && o.h === h && o.id === action.token) {
              inUse = true;
            }
          });
          if (inUse) {
            fail("That order token is already on the board.");
          }
          if (!tokenAllowed(state, action.token)) {
            fail(token.label + " is not allowed this round.");
          }
          var stars = 0;
          Object.keys(state.areas).forEach(function (id) {
            var o = state.areas[id].order;
            if (o && o.h === h && id !== action.area && ORDER_BY_ID[o.id].star) {
              stars++;
            }
          });
          if (token.star) {
            stars++;
          }
          if (stars > starLimit(state, h)) {
            fail("That would exceed your special order limit.");
          }
          log(state, houseName(h) + " uses the Messenger Hawk to replace the order in " + areaName(action.area) + ".", h);
          area.order = { h: h, id: action.token };
        } else if (action.mode === "peek") {
          task.peek = true;
          state.peek = { h: h, card: state.hordeDeck[0], round: state.round };
        } else {
          log(state, houseName(h) + " keeps the Messenger Hawk in reserve.", h);
        }
      } else if (p.kind === "ravenPeek") {
        if (action.bury) {
          var top = state.hordeDeck.shift();
          state.hordeDeck.push(top);
          log(state, houseName(h) + " looks at the top horde card and buries it.", h);
        } else {
          log(state, houseName(h) + " looks at the top horde card and leaves it there.", h);
        }
        task.peekDone = true;
      } else if (p.kind === "raid") {
        doRaid(state, h, action);
      } else if (p.kind === "march") {
        doMarch(state, h, action);
      } else if (p.kind === "support") {
        var side = action.side;
        if (side !== "att" && side !== "def" && side !== "none") {
          fail("Choose a side.");
        }
        state.combat.support[h] = side;
        state.combat.supportAsk.shift();
        var sideText = "neither side";
        if (side === "att") {
          sideText = houseName(state.combat.att);
        } else if (side === "def") {
          sideText = houseName(state.combat.def);
        }
        log(state, houseName(h) + " supports " + sideText + ".", h);
      } else if (p.kind === "leader") {
        if (state.houses[h].hand.indexOf(action.card) < 0) {
          fail("That leader is not in your hand.");
        }
        state.combat.cards[h] = action.card;
        p.houses = p.houses.filter(function (x) {
          return x !== h;
        });
        done = p.houses.length === 0;
      } else if (p.kind === "blade") {
        if (action.use) {
          state.bladeUsed = true;
          state.combat.bladeUsedBy = h;
          log(state, houseName(h) + " draws the Starsteel Blade for +1 strength.", h);
        }
      } else if (p.kind === "casualties") {
        var c = state.combat;
        var units = battleUnits(state, c.loser);
        var picks = action.units;
        if (!Array.isArray(picks) || picks.length !== p.count) {
          fail("Choose exactly " + p.count + " unit(s) to lose.");
        }
        var seen = {};
        picks.forEach(function (i) {
          if (!units[i] || units[i].r || seen[i]) {
            fail("Choose different, unrouted units.");
          }
          seen[i] = true;
        });
        applyCasualties(state, picks);
        c.casualtiesDone = true;
      } else if (p.kind === "retreat") {
        if (p.options.indexOf(action.to) < 0) {
          fail("You cannot retreat there.");
        }
        defenderRetreat(state, action.to);
        state.combat.retreatDone = true;
      } else if (p.kind === "muster") {
        var plan = validateMuster(state, h, action.builds, p.areas);
        applyMuster(state, h, plan);
      } else if (p.kind === "reconcile" || p.kind === "destroyUnits") {
        var picksR = action.remove || [];
        if (p.kind === "destroyUnits") {
          validateRemoval(state, h, picksR, p.count, null);
        } else {
          validateRemoval(state, h, picksR, picksR.length, null);
          var counts = houseUnitCounts(state, h);
          picksR.forEach(function (pk) {
            counts[pk.area] -= 1;
          });
          if (!supplyFits(counts, state.houses[h].supply)) {
            fail("Your armies still break the supply limit. Remove more units.");
          }
        }
        task.done = true;
        var names = removePicks(state, picksR);
        if (names.length > 0) {
          log(state, houseName(h) + " removes " + names.join(", ") + ".", h);
        }
      } else if (p.kind === "downgrade") {
        var picksD = action.picks || [];
        validateRemoval(state, h, picksD, p.count, function (u) {
          return u.t === "knight";
        });
        picksD.slice().sort(function (a, b) {
          return b.idx - a.idx;
        }).forEach(function (pk) {
          downgradeKnight(state, h, pk.area, pk.idx);
        });
        log(state, houseName(h) + " downgrades " + p.count + " Knight(s).", h);
        task.done = true;
      } else if (p.kind === "upgradeOne") {
        if (action.pick) {
          var ua = state.areas[action.pick.area];
          if (!ua || !ua.units[action.pick.idx] || ua.units[action.pick.idx].h !== h || ua.units[action.pick.idx].t !== "footman") {
            fail("Choose one of your Footmen.");
          }
          ua.units[action.pick.idx].t = "knight";
          log(state, houseName(h) + " upgrades a Footman in " + areaName(action.pick.area) + " to a Knight.", h);
        }
        task.answered = true;
      } else if (p.kind === "discardLeaders") {
        var cards = action.cards || [];
        if (cards.length !== p.count) {
          fail("Choose exactly " + p.count + " leader card(s).");
        }
        var hand = state.houses[h].hand;
        var check = {};
        cards.forEach(function (id) {
          if (hand.indexOf(id) < 0 || check[id]) {
            fail("Choose different cards from your hand.");
          }
          check[id] = true;
        });
        state.houses[h].hand = hand.filter(function (id) {
          return !check[id];
        });
        state.houses[h].discard = state.houses[h].discard.concat(cards);
        task.done = true;
        log(state, houseName(h) + " discards " + cards.map(function (id) {
          return LEADER_BY_ID[id].name;
        }).join(", ") + ".", h);
      } else if (p.kind === "chooseTrack") {
        if (!state.tracks[action.track]) {
          fail("Choose a track.");
        }
        var t = state.tracks[action.track].filter(function (x) {
          return x !== h;
        });
        t.unshift(h);
        state.tracks[action.track] = t;
        task.done = true;
        log(state, houseName(h) + " takes first place on the " + R.TRACK_NAMES[action.track] + " track.", h);
      } else if (p.kind === "bid" || p.kind === "hordeBid") {
        var amount = action.amount;
        if (typeof amount !== "number" || amount < 0 || Math.floor(amount) !== amount || amount > state.houses[h].power) {
          fail("Bid a whole number between 0 and your available power.");
        }
        task.bids[h] = amount;
        p.houses = p.houses.filter(function (x) {
          return x !== h;
        });
        done = p.houses.length === 0;
      } else if (p.kind === "tieOrder") {
        var order = action.order;
        if (!Array.isArray(order) || order.length !== p.group.length) {
          fail("Order every tied house.");
        }
        order.forEach(function (x) {
          if (p.group.indexOf(x) < 0) {
            fail("Order only the tied houses.");
          }
        });
        if (new Set(order).size !== order.length) {
          fail("Each house appears once.");
        }
        task.groups[task.groupIndex] = order.slice();
        task.resolvedGroup = true;
        log(state, houseName(h) + " breaks the tie: " + order.map(houseName).join(", ") + ".", h);
      } else if (p.kind === "tiePick") {
        if (p.candidates.indexOf(action.pick) < 0) {
          fail("Choose one of the tied houses.");
        }
        task.chosen = action.pick;
        log(state, houseName(h) + " names " + houseName(action.pick) + " as the deciding bidder.", h);
      } else if (p.kind === "choice") {
        var opt = null;
        p.options.forEach(function (o) {
          if (o.id === action.choice) {
            opt = o;
          }
        });
        if (!opt) {
          fail("Choose one of the options.");
        }
        task.choice = opt.id;
        task.choiceLabel = opt.label;
        task.chooser = h;
      } else if (p.kind === "consolidateChoice") {
        if (action.choice !== "power" && action.choice !== "muster") {
          fail("Choose power or muster.");
        }
        task.choiceMade = action.choice;
      } else {
        fail("Unknown step.");
      }
      if (done) {
        state.pending = null;
      }
      state.v++;
      advance(state);
      return { ok: true };
    } catch (e) {
      if (e instanceof GameError) {
        return { ok: false, error: e.message };
      }
      throw e;
    }
  }

  function raidTargets(state, h, from) {
    var area = state.areas[from];
    var star = ORDER_BY_ID[area.order.id].star;
    var fromSea = AREA[from].type === "sea";
    var list = [];
    ADJ[from].forEach(function (id) {
      if (!fromSea && AREA[id].type === "sea") {
        return;
      }
      var target = state.areas[id];
      if (!target.order || target.order.h === h) {
        return;
      }
      var kind = ORDER_BY_ID[target.order.id].kind;
      if (kind === "support" || kind === "raid" || kind === "consolidate" || (kind === "defence" && star)) {
        list.push(id);
      }
    });
    return list;
  }

  function doRaid(state, h, action) {
    var area = state.areas[action.from];
    if (!area || !area.order || area.order.h !== h || ORDER_BY_ID[area.order.id].kind !== "raid") {
      fail("Choose one of your Raid orders.");
    }
    if (action.target) {
      var targets = raidTargets(state, h, action.from);
      if (targets.indexOf(action.target) < 0) {
        fail("That order cannot be raided from here.");
      }
      var victim = state.areas[action.target].order;
      var kind = ORDER_BY_ID[victim.id].kind;
      state.areas[action.target].order = null;
      var text = houseName(h) + " raids from " + areaName(action.from) + " and removes " + houseName(victim.h) + "'s " + ORDER_BY_ID[victim.id].label + " in " + areaName(action.target);
      if (kind === "consolidate") {
        var taken = losePower(state, victim.h, 1);
        var gained = gainPower(state, h, 1);
        text += ", stealing power (" + houseName(h) + " +" + gained + ", " + houseName(victim.h) + " -" + taken + ")";
      }
      log(state, text + ".", h);
    } else {
      log(state, houseName(h) + " removes the Raid order in " + areaName(action.from) + " without a target.", h);
    }
    area.order = null;
  }

  function advance(state) {
    var guard = 0;
    while (!state.pending && state.tasks.length > 0 && !state.winner) {
      guard++;
      if (guard > 5000) {
        throw new Error("Engine loop guard tripped at task " + state.tasks[0].t);
      }
      var task = state.tasks[0];
      var finished = HANDLERS[task.t](state, task);
      if (finished) {
        var at = state.tasks.indexOf(task);
        if (at >= 0) {
          state.tasks.splice(at, 1);
        }
      }
    }
    if (state.winner) {
      state.pending = null;
      state.phase = "over";
    }
  }

  function legalTokens(state, h) {
    return R.ORDERS.filter(function (o) {
      return tokenAllowed(state, o.id);
    }).map(function (o) {
      return o.id;
    });
  }

  function visibleState(state, h) {
    var copy = clone(state);
    if (copy.tasks.length > 0) {
      var task = copy.tasks[0];
      if (task.subs) {
        Object.keys(task.subs).forEach(function (x) {
          if (x !== h) {
            task.subs[x] = "hidden";
          }
        });
      }
      if (task.bids) {
        Object.keys(task.bids).forEach(function (x) {
          if (x !== h && copy.pending) {
            task.bids[x] = "hidden";
          }
        });
      }
    }
    if (copy.combat && copy.combat.cards && copy.pending && copy.pending.kind === "leader") {
      Object.keys(copy.combat.cards).forEach(function (x) {
        if (x !== h) {
          copy.combat.cards[x] = "hidden";
        }
      });
    }
    return copy;
  }

  return {
    MAP: MAP,
    AREA: AREA,
    ADJ: ADJ,
    RULES: R,
    ORDER_BY_ID: ORDER_BY_ID,
    LEADER_BY_ID: LEADER_BY_ID,
    EVENT_BY_ID: EVENT_BY_ID,
    HORDE_BY_ID: HORDE_BY_ID,
    createGame: createGame,
    applyAction: applyAction,
    controller: controller,
    castleCount: castleCount,
    strongholdCount: strongholdCount,
    barrelCount: barrelCount,
    crownCount: crownCount,
    tokensOnBoard: tokensOnBoard,
    houseUnitCounts: houseUnitCounts,
    supplyFits: supplyFits,
    supplyOk: supplyOk,
    poolCount: poolCount,
    trackPos: trackPos,
    starLimit: starLimit,
    tokenAllowed: tokenAllowed,
    legalTokens: legalTokens,
    usableTokenCount: usableTokenCount,
    areasWithUnits: areasWithUnits,
    unitStrength: unitStrength,
    moveTargets: moveTargets,
    landReach: landReach,
    raidTargets: raidTargets,
    supportOrdersFor: supportOrdersFor,
    supportStrength: supportStrength,
    analyseMarch: function (state, h, action) {
      try {
        return { ok: true, plan: analyseMarch(state, h, action) };
      } catch (e) {
        if (e instanceof GameError) {
          return { ok: false, error: e.message };
        }
        throw e;
      }
    },
    validateMuster: function (state, h, builds, areas) {
      try {
        validateMuster(state, h, builds, areas);
        return { ok: true };
      } catch (e) {
        if (e instanceof GameError) {
          return { ok: false, error: e.message };
        }
        throw e;
      }
    },
    neutralStrength: neutralStrength,
    battleUnits: battleUnits,
    computeCombat: computeCombat,
    homeArea: homeArea,
    allHouseUnits: allHouseUnits,
    ordersOfKind: ordersOfKind,
    musterAreas: musterAreas,
    visibleState: visibleState,
    clone: clone,
    advance: advance
  };
})();
if (typeof module !== "undefined") {
  module.exports = ENGINE;
}
