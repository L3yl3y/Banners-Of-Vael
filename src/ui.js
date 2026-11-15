var UI = (function () {
  var E = ENGINE;
  var R = E.RULES;
  var app = null;
  var sel = {};
  var selId = null;
  var lastLogLength = 0;

  var LEARN = {
    orders: "Planning. Every area holding your units needs one order, placed face down. All orders are revealed together. Starred orders are stronger, but your place on the Court track limits how many you may use. March where you want to move, Defence where you fear an attack, Support beside a battle, Raid to strip an enemy order, and Consolidate Power to earn power for bidding.",
    raven: "You hold the Messenger Hawk because you lead the Court track. Now that every order is visible you may swap one of your own orders for an unused token, or secretly look at the next horde card and decide whether to bury it.",
    ravenPeek: "Only you can see this card. Burying it sends it to the bottom of the horde deck; leaving it means it will be the next horde attack.",
    raid: "Raids resolve first, one at a time in Crown order. A raid removes an adjacent enemy Support, Raid or Consolidate Power order; the starred raid can also remove Defence. Land units raid only land; ships raid land or sea. Raiding Consolidate Power steals 1 power.",
    march: "Marches resolve one at a time in Crown order. Move some or all units into adjacent areas; land units can also sail across a chain of seas holding your ships. Only one move may start a battle. If every unit leaves a land area you may spend 1 power to leave a token and keep control of it.",
    support: "One of your Support orders touches this battle. Choose a side to lend it the strength of those units (plus the order's bonus), or stay out. Ships can support land battles; land units cannot support at sea.",
    leader: "Both sides choose a leader card in secret. Its strength is added to the battle. If you win, your swords kill enemy units, reduced by their towers. Played leaders stay discarded until all seven are used, so think about which ones to save.",
    blade: "You hold the Starsteel Blade because you lead the Sword track. Once per round you may add +1 to a battle you are fighting.",
    casualties: "You lost the battle. Choose which units fall. The survivors must retreat and become routed (they cannot fight or support until the round ends).",
    retreat: "Your defeated units must retreat to an adjacent area that is empty or yours, never back into the area the attacker came from. Retreating units are routed until the end of the round.",
    muster: "Mustering. Each castle gives 1 point and each stronghold 2, spent only in that area. Footman 1, Knight 2, Ship 1 (placed in an adjacent sea), Siege Engine 2, or upgrade a Footman to a Knight or Siege Engine for 1. You cannot build armies larger than your supply allows.",
    reconcile: "Your supply is too low for your armies. An army is 2 or more units in one area; the supply track sets how many armies you may have and how large. Remove units until you fit.",
    destroyUnits: "The horde has broken through. Choose which of your units are destroyed.",
    downgrade: "The horde has broken through. Choose which Knights are reduced to Footmen.",
    upgradeOne: "You led the defence of the Ember Gate. Choose one Footman to raise to a Knight, free of charge.",
    discardLeaders: "The horde has broken through. Choose leader cards to discard from your hand.",
    chooseTrack: "You led the defence of the Ember Gate. Take first place on one influence track.",
    bid: "Contest Of Influence. Everyone bids power in secret and the highest bid takes first place. Crown decides turn order and ties; Sword wins tied battles and holds the Starsteel Blade; Court allows more starred orders and holds the Messenger Hawk. Spent power is gone.",
    hordeBid: "The horde attacks. Every house bids power in secret and the bids are added together. If the total reaches the horde's strength, the gate holds and the highest bidder is rewarded. If not, the lowest bidder suffers the worst. All bid power is spent either way.",
    tieOrder: "As holder of the Ember Crown (top of the Crown track) you settle tied bids.",
    tiePick: "As holder of the Ember Crown you settle ties in the horde bidding.",
    choice: "This event card lets one track leader decide what happens.",
    consolidateChoice: "A starred Consolidate Power order in a castle or stronghold may muster units there instead of collecting power."
  };

  var WAIT_VERBS = {
    orders: "place their orders",
    raven: "use the Messenger Hawk",
    ravenPeek: "look at the horde card",
    raid: "resolve a raid",
    march: "resolve a march",
    support: "decide whom to support",
    leader: "choose a leader card",
    blade: "decide on the Starsteel Blade",
    casualties: "choose casualties",
    retreat: "choose where to retreat",
    muster: "muster units",
    reconcile: "reduce armies to fit supply",
    destroyUnits: "choose units to lose",
    downgrade: "choose Knights to downgrade",
    upgradeOne: "upgrade a Footman",
    discardLeaders: "discard leader cards",
    chooseTrack: "choose an influence track",
    bid: "bid in secret",
    hordeBid: "bid against the horde",
    tieOrder: "break a tie",
    tiePick: "break a tie",
    choice: "make a choice",
    consolidateChoice: "choose power or mustering"
  };

  var STEP_TITLES = {
    orders: "Place Your Orders",
    raven: "The Messenger Hawk",
    ravenPeek: "The Next Horde Card",
    raid: "Resolve A Raid",
    march: "Resolve A March",
    support: "Lend Your Support",
    leader: "Choose Your Leader",
    blade: "The Starsteel Blade",
    casualties: "Choose Casualties",
    retreat: "Retreat",
    muster: "Muster Your Forces",
    reconcile: "Reduce Your Armies",
    destroyUnits: "The Horde Strikes",
    downgrade: "The Horde Strikes",
    upgradeOne: "Reward Of The Gate",
    discardLeaders: "The Horde Strikes",
    chooseTrack: "Reward Of The Gate",
    bid: "Contest Of Influence",
    hordeBid: "Defend The Ember Gate",
    tieOrder: "Break The Tie",
    tiePick: "Break The Tie",
    choice: "Make A Decision",
    consolidateChoice: "Consolidate Or Muster"
  };

  function el(id) {
    return document.getElementById(id);
  }

  function when(condition, text) {
    if (condition) {
      return text;
    }
    return "";
  }

  function plural(n, one, many) {
    if (n === 1) {
      return one;
    }
    return many;
  }

  function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function hName(h) {
    return R.HOUSES[h].short;
  }

  function chip(h, label) {
    var text = label;
    if (!text) {
      text = hName(h);
    }
    return '<span class="hchip h-' + h + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#em-' + h + '"/></svg>' + esc(text) + "</span>";
  }

  function areaLabel(id) {
    return '<b class="aname">' + esc(E.AREA[id].name) + "</b>";
  }

  function orderIcon(id, h) {
    return '<svg class="otok" viewBox="-17 -22 34 39" aria-hidden="true">' + MAPVIEW.orderToken({ h: h, id: id }, 0, 0, false, "") + "</svg>";
  }

  function unitIcon(t, h, routed) {
    return '<svg class="utok" viewBox="-14 -14 28 28" aria-hidden="true">' + MAPVIEW.unitToken({ t: t, h: h, r: routed }, 0, 0) + "</svg>";
  }

  function init(appRef) {
    app = appRef;
    MAPVIEW.mount(el("map"));
    MAPVIEW.onClick(onMapClick);
    MAPVIEW.onHover(onMapHover);
    el("prompt").addEventListener("click", onPromptClick);
    el("prompt").addEventListener("change", onPromptChange);
    el("prompt").addEventListener("input", onPromptChange);
  }

  function st() {
    return app.state();
  }

  function me() {
    return app.activeHouse();
  }

  function resetSelection() {
    sel = {};
  }

  function render() {
    var state = st();
    if (!state) {
      return;
    }
    var pid = null;
    if (state.pending) {
      pid = state.pending.id + ":" + me();
    }
    if (pid !== selId) {
      selId = pid;
      resetSelection();
    }
    renderTop(state);
    renderMap(state);
    renderPrompt(state);
    renderHouses(state);
    renderTracks(state);
    renderEvents(state);
    renderBattle(state);
    renderLog(state);
  }

  function phaseLabel(state) {
    if (state.winner) {
      return "Game Over";
    }
    var p = state.pending;
    if (state.phase === "westeros") {
      return "Event Phase";
    }
    if (state.phase === "planning") {
      if (p && (p.kind === "raven" || p.kind === "ravenPeek")) {
        return "Planning: Messenger Hawk";
      }
      return "Planning Phase";
    }
    if (state.phase === "action") {
      var kinds = state.tasks.map(function (t) {
        return t.t;
      });
      if (kinds.indexOf("raids") >= 0) {
        return "Action: Raids";
      }
      if (kinds.indexOf("marches") >= 0) {
        return "Action: Marches";
      }
      return "Action: Consolidate Power";
    }
    return "";
  }

  function renderTop(state) {
    var pips = "";
    for (var r = 1; r <= R.LAST_ROUND; r++) {
      var cls = "pip";
      if (r < state.round) {
        cls += " past";
      } else if (r === state.round) {
        cls += " now";
      }
      pips += '<span class="' + cls + '">' + r + "</span>";
    }
    el("round-track").innerHTML = pips;
    el("phase").textContent = phaseLabel(state);
    var who = me();
    var seat = el("seat");
    if (who) {
      seat.innerHTML = "Playing as " + chip(who);
    } else if (app.viewer()) {
      seat.innerHTML = "Viewing as " + chip(app.viewer());
    } else {
      seat.innerHTML = "";
    }
  }

  function myDraftOrders(state, h) {
    var map = {};
    if (sel.draft) {
      Object.keys(sel.draft).forEach(function (id) {
        map[id] = { h: h, id: sel.draft[id] };
      });
    }
    return map;
  }

  function renderMap(state) {
    var view = { highlights: {}, pendingOrders: {}, arrows: [] };
    var h = me();
    var p = state.pending;
    if (state.tasks.length > 0 && state.tasks[0].t === "planning" && state.tasks[0].subs) {
      var subs = state.tasks[0].subs;
      Object.keys(subs).forEach(function (x) {
        if (x === h) {
          return;
        }
        E.areasWithUnits(state, x).forEach(function (id) {
          view.pendingOrders[id] = { h: x, id: "m0", hidden: true };
        });
      });
      if (h && subs[h] && subs[h] !== "hidden") {
        Object.keys(subs[h]).forEach(function (id) {
          view.pendingOrders[id] = { h: h, id: subs[h][id] };
        });
      }
    }
    if (p && h && p.houses.indexOf(h) >= 0) {
      decorateMap(state, p, h, view);
    }
    if (sel.selectedArea) {
      view.selected = sel.selectedArea;
    }
    MAPVIEW.render(state, view);
  }

  function decorateMap(state, p, h, view) {
    var k = p.kind;
    if (k === "orders") {
      var draft = myDraftOrders(state, h);
      Object.keys(draft).forEach(function (id) {
        view.pendingOrders[id] = draft[id];
      });
      E.areasWithUnits(state, h).forEach(function (id) {
        if (!sel.draft || !sel.draft[id]) {
          view.highlights[id] = "need";
        }
      });
    } else if (k === "raven" && sel.mode === "swap") {
      Object.keys(state.areas).forEach(function (id) {
        var o = state.areas[id].order;
        if (o && o.h === h) {
          view.highlights[id] = "pick";
        }
      });
      if (sel.swapArea && sel.swapToken) {
        view.pendingOrders[sel.swapArea] = { h: h, id: sel.swapToken };
      }
    } else if (k === "raid") {
      E.ordersOfKind(state, h, "raid").forEach(function (id) {
        view.highlights[id] = "pick";
      });
      if (sel.from) {
        view.activeOrder = sel.from;
        E.raidTargets(state, h, sel.from).forEach(function (id) {
          view.highlights[id] = "target";
        });
      }
    } else if (k === "march") {
      E.ordersOfKind(state, h, "march").forEach(function (id) {
        view.highlights[id] = "pick";
      });
      if (sel.from) {
        view.activeOrder = sel.from;
        var targets = marchTargets(state, h);
        Object.keys(targets).forEach(function (id) {
          view.highlights[id] = "target";
        });
        (sel.moves || []).forEach(function (m) {
          view.arrows.push({ from: sel.from, to: m.to });
        });
      }
    } else if (k === "retreat") {
      p.options.forEach(function (id) {
        view.highlights[id] = "target";
      });
    } else if (k === "muster") {
      p.areas.forEach(function (a) {
        view.highlights[a.area] = "pick";
      });
    } else if (k === "reconcile" || k === "destroyUnits" || k === "downgrade" || k === "upgradeOne") {
      E.areasWithUnits(state, h).forEach(function (id) {
        view.highlights[id] = "pick";
      });
    } else if (k === "consolidateChoice") {
      view.highlights[p.area] = "target";
    }
  }

  function marchTargets(state, h) {
    if (!sel.from) {
      return {};
    }
    var area = state.areas[sel.from];
    var chosen = sel.picked || [];
    var isShip = false;
    if (chosen.length > 0) {
      isShip = area.units[chosen[0]].t === "ship";
    } else {
      var free = unassignedUnits(state);
      if (free.length > 0) {
        isShip = area.units[free[0]].t === "ship";
      }
    }
    return E.moveTargets(state, sel.from, h, isShip);
  }

  function unassignedUnits(state) {
    var area = state.areas[sel.from];
    var used = {};
    (sel.moves || []).forEach(function (m) {
      m.units.forEach(function (i) {
        used[i] = true;
      });
    });
    var list = [];
    area.units.forEach(function (u, i) {
      if (!used[i] && !u.r) {
        list.push(i);
      }
    });
    return list;
  }

  function promptShell(title, body, kind) {
    var learn = "";
    if (kind && LEARN[kind] && app.learning()) {
      learn = '<details class="learn" open><summary>Learning Notes</summary><p>' + esc(LEARN[kind]) + "</p></details>";
    }
    return '<h2 class="ptitle">' + esc(title) + "</h2>" + body + learn;
  }

  function renderPrompt(state) {
    var box = el("prompt");
    var h = me();
    var p = state.pending;
    if (state.winner) {
      box.innerHTML = gameOverHtml(state);
      return;
    }
    if (!p) {
      box.innerHTML = promptShell("Resolving", '<p class="muted">The realm is moving…</p>');
      return;
    }
    if (h && p.houses.indexOf(h) >= 0) {
      var builder = PROMPTS[p.kind];
      if (builder) {
        box.innerHTML = promptShell(STEP_TITLES[p.kind] || p.kind, builder(state, p, h), p.kind);
      } else {
        box.innerHTML = promptShell(p.kind, "<p>Unknown step.</p>");
      }
      if (sel.error) {
        box.insertAdjacentHTML("beforeend", '<p class="err">' + esc(sel.error) + "</p>");
      }
      return;
    }
    var names = p.houses.map(function (x) {
      return chip(x) + ' <span class="muted">(' + esc(app.seatLabel(x)) + ")</span>";
    }).join(", ");
    var extra = "";
    if (p.kind === "orders" && h && state.tasks[0].subs && state.tasks[0].subs[h]) {
      extra = '<p class="ok">Your orders are sealed. Waiting for the others.</p>';
    }
    if ((p.kind === "bid" || p.kind === "hordeBid") && h && state.tasks[0].bids && state.tasks[0].bids[h] !== undefined) {
      extra = '<p class="ok">Your bid is sealed.</p>';
    }
    if (p.kind === "leader" && h && state.combat && state.combat.cards && state.combat.cards[h]) {
      extra = '<p class="ok">Your leader is chosen.</p>';
    }
    var battle = "";
    if (state.combat && (p.kind === "support" || p.kind === "leader" || p.kind === "blade")) {
      battle = battleBox(state, false);
    }
    box.innerHTML = promptShell("Waiting", extra + '<p class="waiting"><span class="spinner" aria-hidden="true"></span>Waiting for ' + names + " to " + esc(WAIT_VERBS[p.kind] || "act") + ".</p>" + battle);
  }

  function gameOverHtml(state) {
    var rows = (state.finalScores || []).map(function (s, i) {
      var strong = s.strongholds;
      if (strong === undefined) {
        strong = "";
      }
      return "<tr><td>" + (i + 1) + "</td><td>" + chip(s.h) + "</td><td>" + s.castles + "</td><td>" + strong + "</td><td>" + s.supply + "</td><td>" + s.power + "</td></tr>";
    }).join("");
    var body = '<p class="winner">' + chip(state.winner, R.HOUSES[state.winner].name) + " wins the war for Vael.</p>";
    body += '<table class="scores"><thead><tr><th>#</th><th>House</th><th>Castles</th><th>Strongholds</th><th>Supply</th><th>Power</th></tr></thead><tbody>' + rows + "</tbody></table>";
    body += '<div class="row"><button class="btn primary" data-act="newgame">New Game</button></div>';
    return promptShell("Game Over", body);
  }

  function btn(label, act, extra, cls) {
    var attrs = "";
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        attrs += " data-" + k + '="' + esc(extra[k]) + '"';
      });
    }
    var klass = "btn";
    if (cls) {
      klass += " " + cls;
    }
    return '<button class="' + klass + '" data-act="' + act + '"' + attrs + ">" + label + "</button>";
  }

  function disabledBtn(label, why) {
    return '<button class="btn primary" disabled title="' + esc(why) + '">' + label + "</button>";
  }

  var PROMPTS = {};

  function usedDraftTokens() {
    var used = {};
    if (sel.draft) {
      Object.keys(sel.draft).forEach(function (id) {
        used[sel.draft[id]] = id;
      });
    }
    return used;
  }

  function draftStars() {
    var n = 0;
    if (sel.draft) {
      Object.keys(sel.draft).forEach(function (id) {
        if (E.ORDER_BY_ID[sel.draft[id]].star) {
          n++;
        }
      });
    }
    return n;
  }

  function tokenPalette(state, h, used, starsUsed, starLimit, replacingStar) {
    var kinds = ["march", "defence", "support", "raid", "consolidate"];
    var html = '<div class="palette">';
    kinds.forEach(function (kind) {
      html += '<div class="pal-row"><span class="pal-kind">' + esc(kind.charAt(0).toUpperCase() + kind.slice(1)) + "</span>";
      R.ORDERS.forEach(function (o) {
        if (o.kind !== kind) {
          return;
        }
        var reason = "";
        if (!E.tokenAllowed(state, o.id)) {
          reason = "Forbidden by this round's event card";
        } else if (used[o.id]) {
          reason = "Already placed in " + E.AREA[used[o.id]].name;
        } else if (o.star && starsUsed - replacingStar >= starLimit) {
          reason = "Special order limit reached";
        }
        var cls = "tok";
        if (reason) {
          cls += " off";
        }
        var title = o.label;
        var disabled = "";
        if (reason) {
          title += " (" + reason + ")";
          disabled = " disabled";
        }
        html += '<button class="' + cls + '" data-act="pickToken" data-token="' + o.id + '" title="' + esc(title) + '"' + disabled + ">" + orderIcon(o.id, h) + "</button>";
      });
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  PROMPTS.orders = function (state, p, h) {
    if (!sel.draft) {
      sel.draft = {};
    }
    var need = E.areasWithUnits(state, h);
    if (!sel.selectedArea || need.indexOf(sel.selectedArea) < 0) {
      sel.selectedArea = null;
      for (var i = 0; i < need.length; i++) {
        if (!sel.draft[need[i]]) {
          sel.selectedArea = need[i];
          break;
        }
      }
    }
    var limit = E.starLimit(state, h);
    var stars = draftStars();
    var replacing = 0;
    if (sel.selectedArea && sel.draft[sel.selectedArea] && E.ORDER_BY_ID[sel.draft[sel.selectedArea]].star) {
      replacing = 1;
    }
    var html = '<p class="lede">Click one of your highlighted areas, then choose a token. ' + Object.keys(sel.draft).length + " of " + Math.min(need.length, E.usableTokenCount(state, h)) + " placed. Special orders: " + stars + " of " + limit + ".</p>";
    html += restrictionsHtml(state);
    if (sel.selectedArea) {
      html += '<p class="focus">Order for ' + areaLabel(sel.selectedArea) + unitsInline(state, sel.selectedArea) + "</p>";
      html += tokenPalette(state, h, usedDraftTokens(), stars, limit, replacing);
      if (sel.hoverToken) {
        html += '<p class="hint">' + esc(R.ORDER_HELP[E.ORDER_BY_ID[sel.hoverToken].kind]) + "</p>";
      }
    }
    html += '<ul class="draft">';
    need.forEach(function (id) {
      var tok = sel.draft[id];
      var label = '<span class="muted">no order yet</span>';
      if (tok) {
        label = esc(E.ORDER_BY_ID[tok].label);
      }
      var cls = "";
      if (id === sel.selectedArea) {
        cls = ' class="cur"';
      }
      html += "<li" + cls + '><button class="link" data-act="selectArea" data-area="' + id + '">' + esc(E.AREA[id].name) + "</button> " + label + "</li>";
    });
    html += "</ul>";
    var row = '<div class="row">';
    var required = Math.min(need.length, E.usableTokenCount(state, h));
    var complete = Object.keys(sel.draft).length >= required;
    if (required < need.length) {
      html += '<p class="hint">You hold more areas than you have usable order tokens this round, so ' + (need.length - required) + " " + plural(need.length - required, "area goes", "areas go") + " without an order.</p>";
    }
    if (complete) {
      row += btn("Seal Orders", "submitOrders", null, "primary");
    } else {
      row += disabledBtn("Seal Orders", "Give every area an order first");
    }
    row += btn("Suggest", "suggestOrders", null, "ghost");
    row += btn("Clear", "clearOrders", null, "ghost");
    row += "</div>";
    return html + row;
  };

  function restrictionsHtml(state) {
    var list = [];
    var r = state.restrict || {};
    if (r.noRaid) {
      list.push("No Raid orders");
    }
    if (r.noMarchPlus) {
      list.push("No March +1");
    }
    if (r.noConsolidate) {
      list.push("No Consolidate Power");
    }
    if (r.noSupport) {
      list.push("No Support orders");
    }
    if (r.noDefence) {
      list.push("No Defence orders");
    }
    if (list.length === 0) {
      return "";
    }
    return '<p class="restrict">This round: ' + esc(list.join(", ")) + ".</p>";
  }

  function unitsInline(state, id) {
    var html = ' <span class="uline">';
    state.areas[id].units.forEach(function (u) {
      html += unitIcon(u.t, u.h, u.r);
    });
    return html + "</span>";
  }

  PROMPTS.raven = function (state, p, h) {
    if (sel.mode === "swap") {
      var html = '<p class="lede">Click one of your orders on the map, then pick its replacement.</p>';
      if (sel.swapArea) {
        var used = {};
        Object.keys(state.areas).forEach(function (id) {
          var o = state.areas[id].order;
          if (o && o.h === h && id !== sel.swapArea) {
            used[o.id] = id;
          }
        });
        var stars = 0;
        Object.keys(state.areas).forEach(function (id) {
          var o = state.areas[id].order;
          if (o && o.h === h && id !== sel.swapArea && E.ORDER_BY_ID[o.id].star) {
            stars++;
          }
        });
        used[state.areas[sel.swapArea].order.id] = sel.swapArea;
        html += '<p class="focus">Replacing ' + esc(E.ORDER_BY_ID[state.areas[sel.swapArea].order.id].label) + " in " + areaLabel(sel.swapArea) + "</p>";
        html += tokenPalette(state, h, used, stars, E.starLimit(state, h), 0);
      }
      html += '<div class="row">';
      if (sel.swapArea && sel.swapToken) {
        html += btn("Swap To " + esc(E.ORDER_BY_ID[sel.swapToken].label), "ravenSwap", null, "primary");
      }
      html += btn("Back", "ravenBack", null, "ghost") + "</div>";
      return html;
    }
    var body = '<p class="lede">All orders are on the table. You may use the Messenger Hawk once.</p><div class="stack">';
    body += btn("Replace One Of My Orders", "ravenMode", { mode: "swap" });
    body += btn("Look At The Next Horde Card", "ravenPeek");
    body += btn("Do Nothing", "ravenPass", null, "ghost");
    return body + "</div>";
  };

  PROMPTS.ravenPeek = function (state, p) {
    var card = E.HORDE_BY_ID[p.card];
    var html = hordeCardHtml(card);
    html += '<div class="row">' + btn("Bury It", "ravenBury", { bury: "1" }, "primary") + btn("Leave It On Top", "ravenBury", { bury: "0" }, "ghost") + "</div>";
    return html;
  };

  function hordeCardHtml(card) {
    return '<div class="hcard"><h3>' + esc(card.name) + '</h3><p><b>If the gate holds:</b> ' + esc(card.win) + '</p><p><b>If the horde wins:</b> ' + esc(card.lowest) + " " + esc(card.others) + "</p></div>";
  }

  PROMPTS.raid = function (state, p, h) {
    var html = '<p class="lede">Choose one of your Raid orders, then the enemy order to remove.</p>';
    if (!sel.from) {
      html += '<div class="stack">';
      E.ordersOfKind(state, h, "raid").forEach(function (id) {
        var count = E.raidTargets(state, h, id).length;
        html += btn("Raid From " + esc(E.AREA[id].name) + ' <span class="muted">(' + count + " " + plural(count, "target", "targets") + ")</span>", "pickFrom", { area: id });
      });
      html += "</div>";
    }
    if (sel.from) {
      var targets = E.raidTargets(state, h, sel.from);
      html += '<p class="focus">Raiding from ' + areaLabel(sel.from) + "</p>";
      if (targets.length === 0) {
        html += '<p class="muted">No enemy order here can be raided.</p>';
      } else {
        html += '<ul class="choices">';
        targets.forEach(function (id) {
          var o = state.areas[id].order;
          html += "<li>" + btn("Remove " + esc(hName(o.h)) + "'s " + esc(E.ORDER_BY_ID[o.id].label) + " in " + esc(E.AREA[id].name), "raidTarget", { area: id }) + "</li>";
        });
        html += "</ul>";
      }
      html += '<div class="row">' + btn("Discard This Raid Unused", "raidNone", null, "ghost") + "</div>";
    }
    return html;
  };

  function marchPlanAction() {
    return { type: "march", from: sel.from, moves: (sel.moves || []).map(function (m) {
      return { to: m.to, units: m.units.slice() };
    }), leaveToken: !!sel.leaveToken };
  }

  function describeDestination(state, h, to) {
    var dest = state.areas[to];
    var info = E.AREA[to];
    if (dest.neutral > 0) {
      return "neutral force of " + dest.neutral;
    }
    if (dest.units.length > 0 && dest.units[0].h !== h) {
      return "battle against " + hName(dest.units[0].h);
    }
    if (dest.units.length === 0 && info.home && info.home !== h && dest.garrison > 0) {
      return "battle against the " + hName(info.home) + " garrison";
    }
    var ctrl = E.controller(state, to);
    if (ctrl && ctrl !== h) {
      return "take it from " + hName(ctrl);
    }
    if (ctrl === h) {
      return "reinforce";
    }
    return "claim it";
  }

  PROMPTS.march = function (state, p, h) {
    var html = "";
    if (!sel.from) {
      html += '<p class="lede">Choose one of your March orders, on the map or below.</p><div class="stack">';
      E.ordersOfKind(state, h, "march").forEach(function (id) {
        html += btn("March From " + esc(E.AREA[id].name), "pickFrom", { area: id });
      });
      html += '</div><div class="row">' + btn("Suggest", "suggestMarch", null, "ghost") + "</div>";
      return html;
    }
    var area = state.areas[sel.from];
    if (!sel.moves) {
      sel.moves = [];
    }
    if (!sel.picked) {
      sel.picked = unassignedUnits(state);
    }
    var o = E.ORDER_BY_ID[area.order.id];
    html += '<p class="focus">Marching from ' + areaLabel(sel.from) + " with " + esc(o.label) + "</p>";
    html += '<p class="lede">Select units, then click a highlighted area on the map to send them there.</p>';
    html += '<div class="units-pick">';
    var assigned = {};
    sel.moves.forEach(function (m) {
      m.units.forEach(function (i) {
        assigned[i] = m.to;
      });
    });
    area.units.forEach(function (u, i) {
      var cls = "upick";
      var note = "";
      if (u.r) {
        cls += " off";
        note = "routed";
      } else if (assigned[i]) {
        cls += " sent";
        note = "→ " + E.AREA[assigned[i]].name;
      } else if (sel.picked.indexOf(i) >= 0) {
        cls += " on";
      }
      html += '<button class="' + cls + '" data-act="toggleUnit" data-idx="' + i + '"' + when(u.r || assigned[i], " disabled") + ">" + unitIcon(u.t, u.h, u.r) + "<span>" + esc(R.UNIT_NAMES[u.t]) + "</span>" + when(note, "<em>" + esc(note) + "</em>") + "</button>";
    });
    html += "</div>";
    if (sel.moves.length > 0) {
      html += '<ul class="plan">';
      sel.moves.forEach(function (m, k) {
        html += "<li>" + m.units.length + " to " + areaLabel(m.to) + ' <span class="muted">(' + esc(describeDestination(state, h, m.to)) + ')</span> <button class="link" data-act="undoMove" data-k="' + k + '">undo</button></li>';
      });
      html += "</ul>";
    }
    var moved = 0;
    sel.moves.forEach(function (m) {
      moved += m.units.length;
    });
    var info = E.AREA[sel.from];
    if (moved === area.units.length && moved > 0 && info.type === "land" && info.home !== h) {
      var checked = "";
      if (sel.leaveToken) {
        checked = " checked";
      }
      html += '<label class="check"><input type="checkbox" id="leave-token" data-act="leaveToken"' + checked + "> Leave a power token to keep " + esc(info.name) + " (costs 1 power, you have " + state.houses[h].power + ")</label>";
    }
    var check = E.analyseMarch(state, h, marchPlanAction());
    if (!check.ok && sel.moves.length > 0) {
      html += '<p class="err">' + esc(check.error) + "</p>";
    }
    if (check.ok && check.plan.combatTarget) {
      html += battlePreview(state, h, check.plan);
    }
    html += '<div class="row">';
    if (check.ok) {
      var label = "Confirm March";
      if (sel.moves.length === 0) {
        label = "Resolve Without Moving";
      }
      html += btn(label, "confirmMarch", null, "primary");
    }
    html += btn("Choose Another Order", "marchBack", null, "ghost") + btn("Suggest", "suggestMarch", null, "ghost") + "</div>";
    return html;
  }

  function battlePreview(state, h, plan) {
    var target = plan.combatTarget;
    var dest = state.areas[target];
    if (dest.neutral > 0) {
      var units = plan.byTarget[target].map(function (i) {
        return state.areas[plan.from].units[i];
      });
      var s = E.neutralStrength(state, h, plan.from, target, units, plan.bonus);
      return '<p class="preview">Your strength against the neutral force: <b>' + s + "</b> of " + dest.neutral + " needed (units, march bonus and your adjacent support).</p>";
    }
    return '<p class="preview">This move starts a battle in ' + areaLabel(target) + ". Support is declared next, then both sides choose leaders.</p>";
  }

  function computedSides(state) {
    var c = state.combat;
    if (c.sides && c.cards && c.cards[c.att] && c.cards[c.def] && c.cards[c.att] !== "hidden" && c.cards[c.def] !== "hidden") {
      return { sides: c.sides, withCards: true };
    }
    var test = E.clone(state);
    test.combat.cards = {};
    test.combat.bladeUsedBy = null;
    E.computeCombat(test);
    return { sides: test.combat.sides, withCards: false };
  }

  function battleBox(state, showCards) {
    var c = state.combat;
    if (!c) {
      return "";
    }
    var data = computedSides(state);
    var rows = [
      ["Units", "units"],
      ["March / Defence", "order"],
      ["Garrison", "garrison"],
      ["Support", "support"]
    ];
    if (data.withCards) {
      rows.push(["Leader", "card"], ["Card Text", "ability"], ["Starsteel Blade", "blade"]);
    }
    var html = '<div class="battle"><div class="bhead">' + chip(c.att) + ' <span class="vs">attacks</span> ' + chip(c.def) + ' <span class="muted">in</span> ' + areaLabel(c.area) + "</div>";
    html += '<table class="btable"><thead><tr><th></th><th>' + esc(hName(c.att)) + "</th><th>" + esc(hName(c.def)) + "</th></tr></thead><tbody>";
    var ta = 0;
    var td = 0;
    rows.forEach(function (r) {
      var a = data.sides[c.att][r[1]] || 0;
      var d = data.sides[c.def][r[1]] || 0;
      ta += a;
      td += d;
      html += "<tr><td>" + r[0] + "</td><td>" + a + "</td><td>" + d + "</td></tr>";
    });
    html += '<tr class="total"><td>Total</td><td>' + ta + "</td><td>" + td + "</td></tr></tbody></table>";
    if (data.withCards) {
      html += '<div class="cards-row">' + leaderCardHtml(E.LEADER_BY_ID[c.cards[c.att]], false) + leaderCardHtml(E.LEADER_BY_ID[c.cards[c.def]], false) + "</div>";
    }
    var pending = [];
    if (c.supportAsk && c.supportAsk.length > 0) {
      pending.push(hName(c.supportAsk[0]) + " has not yet declared support.");
    }
    if (pending.length > 0) {
      html += '<p class="muted">' + esc(pending.join(" ")) + "</p>";
    }
    html += '<p class="muted small">Ties go to the house higher on the Sword track (' + esc(state.tracks.sword.map(hName).join(" > ")) + ").</p>";
    return html + "</div>";
  }

  function leaderCardHtml(card, selectable, chosen, attrs) {
    if (!card) {
      return "";
    }
    var icons = "";
    for (var s = 0; s < card.swords; s++) {
      icons += '<svg class="ic sword" viewBox="0 0 16 16" aria-label="Sword: kills a unit if you win"><path d="M13.5 1.5L7 8l1 1 6.5-6.5zM5.2 8.6l2.2 2.2-1 1-.9-.4-2.3 2.3-.9-.9 2.3-2.3-.4-.9z" fill="currentColor"/></svg>';
    }
    for (var f = 0; f < card.forts; f++) {
      icons += '<svg class="ic fort" viewBox="0 0 16 16" aria-label="Tower: blocks one sword"><path d="M3 15V5h2V2h2v3h2V2h2v3h2v10z" fill="currentColor"/><path d="M7 15v-3a1 1 0 0 1 2 0v3z" fill="#efe3c4"/></svg>';
    }
    var cls = "lcard h-" + card.house;
    if (chosen) {
      cls += " chosen";
    }
    var tag = "div";
    var extra = "";
    if (selectable) {
      tag = "button";
      extra = ' data-act="pickLeader" data-card="' + card.id + '"';
    }
    if (attrs) {
      extra += attrs;
    }
    var text = card.text;
    if (!text) {
      text = "No special text.";
    }
    return "<" + tag + ' class="' + cls + '"' + extra + '><span class="lstr">' + card.strength + '</span><span class="lname">' + esc(card.name) + '</span><span class="ltitle">' + esc(card.title) + '</span><span class="licons">' + icons + '</span><span class="ltext">' + esc(text) + "</span></" + tag + ">";
  }

  PROMPTS.support = function (state, p, h) {
    var c = state.combat;
    var html = battleBox(state, false);
    var mine = E.supportOrdersFor(state, c.area).filter(function (s) {
      return s.h === h;
    });
    var total = 0;
    var totalDef = 0;
    mine.forEach(function (s) {
      total += E.supportStrength(state, s.area, s.bonus, true, c.area);
      totalDef += E.supportStrength(state, s.area, s.bonus, false, c.area);
    });
    html += '<p class="lede">Your support is worth ' + total + " to the attacker or " + totalDef + " to the defender.</p>";
    html += '<div class="stack">' + btn("Support " + esc(hName(c.att)) + " (Attacker)", "support", { side: "att" }) + btn("Support " + esc(hName(c.def)) + " (Defender)", "support", { side: "def" }) + btn("Support Neither", "support", { side: "none" }, "ghost") + "</div>";
    return html;
  };

  PROMPTS.leader = function (state, p, h) {
    var c = state.combat;
    var opp = c.att;
    if (h === c.att) {
      opp = c.def;
    }
    var html = battleBox(state, false);
    html += '<p class="lede">Choose your leader.</p><div class="cards">';
    state.houses[h].hand.forEach(function (id) {
      html += leaderCardHtml(E.LEADER_BY_ID[id], true, sel.card === id);
    });
    html += "</div>";
    var oppCards = state.houses[opp].hand.map(function (id) {
      var card = E.LEADER_BY_ID[id];
      return card.name + " (" + card.strength + ")";
    });
    html += '<p class="muted small">' + esc(hName(opp)) + " can still play: " + esc(oppCards.join(", ")) + ".</p>";
    html += '<div class="row">';
    if (sel.card) {
      html += btn("Play " + esc(E.LEADER_BY_ID[sel.card].name), "playLeader", null, "primary");
    } else {
      html += disabledBtn("Play Leader", "Choose a card first");
    }
    html += btn("Suggest", "suggestLeader", null, "ghost") + "</div>";
    return html;
  };

  PROMPTS.blade = function (state, p, h) {
    var html = battleBox(state, true);
    html += '<div class="stack">' + btn("Draw The Blade (+1)", "blade", { use: "1" }, "primary") + btn("Keep It For Later", "blade", { use: "0" }, "ghost") + "</div>";
    return html;
  };

  PROMPTS.casualties = function (state, p, h) {
    var units = E.battleUnits(state, h);
    if (!sel.cas) {
      sel.cas = [];
    }
    var html = '<p class="lede">Choose ' + p.count + " unit(s) to lose.</p>";
    html += '<div class="units-pick">';
    units.forEach(function (u, i) {
      var cls = "upick";
      if (sel.cas.indexOf(i) >= 0) {
        cls += " on";
      }
      if (u.r) {
        cls += " off";
      }
      html += '<button class="' + cls + '" data-act="toggleCas" data-idx="' + i + '"' + when(u.r, " disabled") + ">" + unitIcon(u.t, u.h, u.r) + "<span>" + esc(R.UNIT_NAMES[u.t]) + "</span></button>";
    });
    html += "</div><div class=\"row\">";
    if (sel.cas.length === p.count) {
      html += btn("Confirm Casualties", "confirmCas", null, "primary");
    } else {
      html += disabledBtn("Confirm Casualties", "Select exactly " + p.count);
    }
    return html + "</div>";
  };

  PROMPTS.retreat = function (state, p) {
    var html = '<p class="lede">Click a highlighted area on the map, or choose below.</p><div class="stack">';
    p.options.forEach(function (id) {
      html += btn("Retreat To " + esc(E.AREA[id].name), "retreat", { area: id });
    });
    return html + "</div>";
  };

  function supplySummary(state, h, extraCounts) {
    var counts = E.houseUnitCounts(state, h);
    if (extraCounts) {
      Object.keys(extraCounts).forEach(function (id) {
        counts[id] = (counts[id] || 0) + extraCounts[id];
      });
    }
    var sizes = [];
    Object.keys(counts).forEach(function (id) {
      if (counts[id] >= 2) {
        sizes.push(counts[id]);
      }
    });
    sizes.sort(function (a, b) {
      return b - a;
    });
    var allowed = R.SUPPLY_TABLE[state.houses[h].supply];
    var armyText = "none";
    if (sizes.length > 0) {
      armyText = sizes.join(", ");
    }
    return '<p class="muted small">Supply ' + state.houses[h].supply + ": armies allowed " + allowed.join(", ") + ". Your armies: " + armyText + ".</p>";
  }

  PROMPTS.muster = function (state, p, h) {
    if (!sel.builds) {
      sel.builds = [];
    }
    var html = "";
    if (p.free) {
      html += '<p class="lede">A reward: muster up to 2 points of units in your home stronghold.</p>';
    }
    var spent = {};
    sel.builds.forEach(function (b) {
      var cost = 1;
      if (b.kind === "knight" || b.kind === "siege") {
        cost = 2;
      }
      spent[b.area] = (spent[b.area] || 0) + cost;
    });
    p.areas.forEach(function (a) {
      var left = a.points - (spent[a.area] || 0);
      html += '<div class="muster-area"><div class="ma-head">' + areaLabel(a.area) + ' <span class="pts">' + left + " of " + a.points + " " + plural(a.points, "point", "points") + " left</span></div>";
      if (left > 0) {
        html += '<div class="ma-btns">';
        html += btn("+ Footman", "addBuild", { area: a.area, kind: "footman" }, "sm");
        if (left >= 2) {
          html += btn("+ Knight", "addBuild", { area: a.area, kind: "knight" }, "sm");
          html += btn("+ Siege Engine", "addBuild", { area: a.area, kind: "siege" }, "sm");
        }
        var seas = E.ADJ[a.area].filter(function (id) {
          var sea = state.areas[id];
          return E.AREA[id].type === "sea" && !(sea.units.length > 0 && sea.units[0].h !== h);
        });
        seas.forEach(function (sea) {
          html += btn("+ Ship In " + esc(E.AREA[sea].name), "addBuild", { area: a.area, kind: "ship", sea: sea }, "sm");
        });
        state.areas[a.area].units.forEach(function (u, i) {
          if (u.h === h && u.t === "footman") {
            var taken = sel.builds.some(function (b) {
              return b.area === a.area && b.unit === i;
            });
            if (!taken) {
              html += btn("Footman → Knight", "addBuild", { area: a.area, kind: "upKnight", unit: String(i) }, "sm");
              html += btn("Footman → Siege", "addBuild", { area: a.area, kind: "upSiege", unit: String(i) }, "sm");
            }
          }
        });
        html += "</div>";
      }
      html += "</div>";
    });
    if (sel.builds.length > 0) {
      html += '<ul class="plan">';
      sel.builds.forEach(function (b, k) {
        var label = R.UNIT_NAMES[b.kind];
        if (b.kind === "ship") {
          label = "Ship in " + E.AREA[b.sea].name;
        } else if (b.kind === "upKnight") {
          label = "Upgrade Footman to Knight";
        } else if (b.kind === "upSiege") {
          label = "Upgrade Footman to Siege Engine";
        }
        html += "<li>" + esc(label) + " (" + esc(E.AREA[b.area].name) + ') <button class="link" data-act="removeBuild" data-k="' + k + '">remove</button></li>';
      });
      html += "</ul>";
    }
    var extra = {};
    sel.builds.forEach(function (b) {
      if (b.kind === "ship") {
        extra[b.sea] = (extra[b.sea] || 0) + 1;
      } else if (b.kind === "footman" || b.kind === "knight" || b.kind === "siege") {
        extra[b.area] = (extra[b.area] || 0) + 1;
      }
    });
    html += supplySummary(state, h, extra);
    var check = E.validateMuster(state, h, sel.builds, p.areas);
    if (!check.ok) {
      html += '<p class="err">' + esc(check.error) + "</p>";
    }
    html += '<div class="row">';
    if (check.ok) {
      var label2 = "Muster";
      if (sel.builds.length === 0) {
        label2 = "Muster Nothing";
      }
      html += btn(label2, "confirmMuster", null, "primary");
    }
    html += btn("Suggest", "suggestMuster", null, "ghost") + "</div>";
    return html;
  };

  function unitPicker(state, h, filter, picks) {
    var html = '<div class="pick-list">';
    E.areasWithUnits(state, h).forEach(function (id) {
      var units = state.areas[id].units;
      var any = false;
      var row = '<div class="pick-row"><span class="pick-area">' + esc(E.AREA[id].name) + "</span>";
      units.forEach(function (u, i) {
        if (filter && !filter(u)) {
          return;
        }
        any = true;
        var on = picks.some(function (pk) {
          return pk.area === id && pk.idx === i;
        });
        var cls = "upick";
        if (on) {
          cls += " on";
        }
        row += '<button class="' + cls + '" data-act="togglePick" data-area="' + id + '" data-idx="' + i + '">' + unitIcon(u.t, u.h, u.r) + "<span>" + esc(R.UNIT_NAMES[u.t]) + "</span></button>";
      });
      row += "</div>";
      if (any) {
        html += row;
      }
    });
    return html + "</div>";
  }

  PROMPTS.reconcile = function (state, p, h) {
    if (!sel.picks) {
      sel.picks = [];
    }
    var counts = E.houseUnitCounts(state, h);
    sel.picks.forEach(function (pk) {
      counts[pk.area] -= 1;
    });
    var fits = E.supplyFits(counts, state.houses[h].supply);
    var html = '<p class="lede">Remove units until your armies fit supply ' + state.houses[h].supply + " (" + R.SUPPLY_TABLE[state.houses[h].supply].join(", ") + ").</p>";
    html += unitPicker(state, h, null, sel.picks);
    html += '<div class="row">';
    if (fits) {
      html += btn("Remove " + sel.picks.length + " Unit(s)", "confirmPicks", null, "primary");
    } else {
      html += disabledBtn("Remove Units", "Your armies still break the limit");
    }
    return html + "</div>";
  };

  PROMPTS.destroyUnits = function (state, p, h) {
    if (!sel.picks) {
      sel.picks = [];
    }
    var html = '<p class="lede">Choose ' + p.count + " unit(s) to destroy.</p>" + unitPicker(state, h, null, sel.picks) + '<div class="row">';
    if (sel.picks.length === p.count) {
      html += btn("Destroy", "confirmPicks", null, "primary");
    } else {
      html += disabledBtn("Destroy", "Choose exactly " + p.count);
    }
    return html + "</div>";
  };

  PROMPTS.downgrade = function (state, p, h) {
    if (!sel.picks) {
      sel.picks = [];
    }
    var html = '<p class="lede">Choose ' + p.count + " Knight(s) to downgrade.</p>" + unitPicker(state, h, function (u) {
      return u.t === "knight";
    }, sel.picks) + '<div class="row">';
    if (sel.picks.length === p.count) {
      html += btn("Downgrade", "confirmPicks", null, "primary");
    } else {
      html += disabledBtn("Downgrade", "Choose exactly " + p.count);
    }
    return html + "</div>";
  };

  PROMPTS.upgradeOne = function (state, p, h) {
    if (!sel.picks) {
      sel.picks = [];
    }
    var html = '<p class="lede">Choose one Footman to upgrade.</p>' + unitPicker(state, h, function (u) {
      return u.t === "footman";
    }, sel.picks) + '<div class="row">';
    if (sel.picks.length === 1) {
      html += btn("Upgrade", "confirmPicks", null, "primary");
    }
    html += btn("Skip", "skipUpgrade", null, "ghost");
    return html + "</div>";
  };

  PROMPTS.discardLeaders = function (state, p, h) {
    if (!sel.discards) {
      sel.discards = [];
    }
    var html = '<p class="lede">Choose ' + p.count + " card(s) to discard.</p><div class=\"cards\">";
    state.houses[h].hand.forEach(function (id) {
      html += leaderCardHtml(E.LEADER_BY_ID[id], false, sel.discards.indexOf(id) >= 0, ' data-act="toggleDiscard" data-card="' + id + '" role="button" tabindex="0"');
    });
    html += '</div><div class="row">';
    if (sel.discards.length === p.count) {
      html += btn("Discard", "confirmDiscard", null, "primary");
    } else {
      html += disabledBtn("Discard", "Choose exactly " + p.count);
    }
    return html + "</div>";
  };

  PROMPTS.chooseTrack = function () {
    return '<div class="stack">' + btn("Crown Track (Turn Order)", "chooseTrack", { track: "crown" }) + btn("Sword Track (Battle Ties)", "chooseTrack", { track: "sword" }) + btn("Court Track (Special Orders)", "chooseTrack", { track: "court" }) + "</div>";
  };

  function bidBody(state, p, h, what) {
    if (sel.amount === undefined) {
      sel.amount = 0;
    }
    var power = state.houses[h].power;
    var html = "<p class=\"lede\">" + what + "</p>";
    html += '<div class="bidder"><button class="btn sm" data-act="bidStep" data-d="-1" aria-label="Bid one less">−</button><output class="bid-amount">' + sel.amount + '</output><button class="btn sm" data-act="bidStep" data-d="1" aria-label="Bid one more">+</button><span class="muted">of ' + power + " power</span></div>";
    html += '<div class="row">' + btn("Seal Bid", "submitBid", null, "primary") + btn("Suggest", "suggestBid", null, "ghost") + "</div>";
    return html;
  }

  PROMPTS.bid = function (state, p, h) {
    var track = p.track;
    var current = state.tracks[track].map(hName).join(" > ");
    return bidBody(state, p, h, "Bidding for the <b>" + R.TRACK_NAMES[track] + " track</b>. Current order: " + esc(current) + ".");
  };

  PROMPTS.hordeBid = function (state, p, h) {
    return bidBody(state, p, h, "The horde attacks with strength <b>" + p.threat + "</b>. The three bids are added together.");
  };

  PROMPTS.tieOrder = function (state, p) {
    if (!sel.order) {
      sel.order = p.group.slice();
    }
    var html = '<p class="lede">' + esc(p.purpose) + '</p><ol class="reorder">';
    sel.order.forEach(function (x, i) {
      html += "<li>" + chip(x) + " ";
      if (i > 0) {
        html += btn("Move Up", "moveUp", { i: String(i) }, "sm ghost");
      }
      html += "</li>";
    });
    html += "</ol>";
    return html + '<div class="row">' + btn("Confirm Order", "confirmTieOrder", null, "primary") + "</div>";
  };

  PROMPTS.tiePick = function (state, p) {
    var html = '<p class="lede">' + esc(p.purpose) + '</p><div class="stack">';
    p.candidates.forEach(function (x) {
      html += btn(esc(R.HOUSES[x].name), "tiePick", { house: x });
    });
    return html + "</div>";
  };

  PROMPTS.choice = function (state, p) {
    var card = E.EVENT_BY_ID[p.card];
    var html = '<div class="ecard"><h3>' + esc(card.name) + "</h3><p>" + esc(card.text) + '</p></div><div class="stack">';
    p.options.forEach(function (o) {
      html += btn(esc(o.label), "choice", { choice: o.id });
    });
    return html + "</div>";
  };

  PROMPTS.consolidateChoice = function (state, p) {
    var info = E.AREA[p.area];
    return '<p class="lede">Your starred Consolidate Power order in ' + areaLabel(p.area) + " can gain " + (1 + info.crowns) + " power or muster " + info.castle + " point(s) of units there.</p><div class=\"stack\">" + btn("Gain " + (1 + info.crowns) + " Power", "cpChoice", { choice: "power" }) + btn("Muster Here", "cpChoice", { choice: "muster" }) + "</div>";
  };

  function submit(action) {
    sel.error = null;
    var result = app.submit(me(), action);
    if (result && !result.ok) {
      sel.error = result.error;
      render();
    }
  }

  function onPromptChange(ev) {
    var t = ev.target;
    if (t.getAttribute("data-act") === "leaveToken") {
      sel.leaveToken = t.checked;
      render();
    }
  }

  function onPromptClick(ev) {
    var target = ev.target.closest("[data-act]");
    if (!target || target.disabled) {
      return;
    }
    if (target.tagName === "INPUT") {
      return;
    }
    var act = target.getAttribute("data-act");
    var d = target.dataset;
    var state = st();
    var h = me();
    var p = state.pending;
    if (act === "newgame") {
      app.newGame();
      return;
    }
    if (!p || p.houses.indexOf(h) < 0) {
      return;
    }
    sel.error = null;
    var fn = ACTIONS[act];
    if (fn) {
      fn(state, p, h, d);
    }
  }

  var ACTIONS = {};

  ACTIONS.selectArea = function (state, p, h, d) {
    sel.selectedArea = d.area;
    render();
  };

  ACTIONS.pickToken = function (state, p, h, d) {
    if (p.kind === "orders") {
      if (!sel.selectedArea) {
        return;
      }
      sel.draft[sel.selectedArea] = d.token;
      sel.hoverToken = d.token;
      var need = E.areasWithUnits(state, h);
      var next = null;
      for (var i = 0; i < need.length; i++) {
        if (!sel.draft[need[i]]) {
          next = need[i];
          break;
        }
      }
      if (next) {
        sel.selectedArea = next;
      }
      render();
    } else if (p.kind === "raven") {
      sel.swapToken = d.token;
      render();
    }
  };

  ACTIONS.submitOrders = function (state, p, h) {
    submit({ type: "orders", orders: Object.assign({}, sel.draft) });
  };

  ACTIONS.suggestOrders = function (state, p, h) {
    var a = BOT.act(state, h);
    sel.draft = Object.assign({}, a.orders);
    render();
  };

  ACTIONS.clearOrders = function () {
    sel.draft = {};
    sel.selectedArea = null;
    render();
  };

  ACTIONS.ravenMode = function () {
    sel.mode = "swap";
    render();
  };

  ACTIONS.ravenBack = function () {
    sel.mode = null;
    sel.swapArea = null;
    sel.swapToken = null;
    render();
  };

  ACTIONS.ravenSwap = function () {
    submit({ type: "raven", mode: "swap", area: sel.swapArea, token: sel.swapToken });
  };

  ACTIONS.ravenPeek = function () {
    submit({ type: "raven", mode: "peek" });
  };

  ACTIONS.ravenPass = function () {
    submit({ type: "raven", mode: "pass" });
  };

  ACTIONS.ravenBury = function (state, p, h, d) {
    submit({ type: "ravenPeek", bury: d.bury === "1" });
  };

  ACTIONS.pickFrom = function (state, p, h, d) {
    sel.from = d.area;
    if (p.kind === "march") {
      sel.moves = [];
      sel.picked = null;
      sel.leaveToken = false;
    }
    render();
  };

  ACTIONS.raidTarget = function (state, p, h, d) {
    submit({ type: "raid", from: sel.from, target: d.area });
  };

  ACTIONS.raidNone = function () {
    submit({ type: "raid", from: sel.from, target: null });
  };

  ACTIONS.toggleUnit = function (state, p, h, d) {
    var i = Number(d.idx);
    var at = sel.picked.indexOf(i);
    if (at >= 0) {
      sel.picked.splice(at, 1);
    } else {
      var area = state.areas[sel.from];
      var isShip = area.units[i].t === "ship";
      sel.picked = sel.picked.filter(function (j) {
        return (area.units[j].t === "ship") === isShip;
      });
      sel.picked.push(i);
    }
    render();
  };

  ACTIONS.undoMove = function (state, p, h, d) {
    var m = sel.moves.splice(Number(d.k), 1)[0];
    sel.picked = sel.picked.concat(m.units);
    sel.leaveToken = false;
    render();
  };

  ACTIONS.confirmMarch = function () {
    submit(marchPlanAction());
  };

  ACTIONS.marchBack = function () {
    sel.from = null;
    sel.moves = null;
    sel.picked = null;
    sel.leaveToken = false;
    render();
  };

  ACTIONS.suggestMarch = function (state, p, h) {
    var a = BOT.act(state, h);
    sel.from = a.from;
    sel.moves = a.moves.map(function (m) {
      return { to: m.to, units: m.units.slice() };
    });
    sel.leaveToken = !!a.leaveToken;
    sel.picked = [];
    render();
  };

  ACTIONS.support = function (state, p, h, d) {
    submit({ type: "support", side: d.side });
  };

  ACTIONS.pickLeader = function (state, p, h, d) {
    sel.card = d.card;
    render();
  };

  ACTIONS.playLeader = function () {
    submit({ type: "leader", card: sel.card });
  };

  ACTIONS.suggestLeader = function (state, p, h) {
    sel.card = BOT.act(state, h).card;
    render();
  };

  ACTIONS.blade = function (state, p, h, d) {
    submit({ type: "blade", use: d.use === "1" });
  };

  ACTIONS.toggleCas = function (state, p, h, d) {
    var i = Number(d.idx);
    var at = sel.cas.indexOf(i);
    if (at >= 0) {
      sel.cas.splice(at, 1);
    } else if (sel.cas.length < p.count) {
      sel.cas.push(i);
    }
    render();
  };

  ACTIONS.confirmCas = function () {
    submit({ type: "casualties", units: sel.cas.slice() });
  };

  ACTIONS.retreat = function (state, p, h, d) {
    submit({ type: "retreat", to: d.area });
  };

  ACTIONS.addBuild = function (state, p, h, d) {
    var b = { area: d.area, kind: d.kind };
    if (d.sea) {
      b.sea = d.sea;
    }
    if (d.unit !== undefined) {
      b.unit = Number(d.unit);
    }
    sel.builds.push(b);
    render();
  };

  ACTIONS.removeBuild = function (state, p, h, d) {
    sel.builds.splice(Number(d.k), 1);
    render();
  };

  ACTIONS.confirmMuster = function () {
    submit({ type: "muster", builds: sel.builds.slice() });
  };

  ACTIONS.suggestMuster = function (state, p, h) {
    sel.builds = BOT.act(state, h).builds;
    render();
  };

  ACTIONS.togglePick = function (state, p, h, d) {
    var idx = Number(d.idx);
    var at = -1;
    sel.picks.forEach(function (pk, k) {
      if (pk.area === d.area && pk.idx === idx) {
        at = k;
      }
    });
    if (at >= 0) {
      sel.picks.splice(at, 1);
    } else {
      var max = 99;
      if (p.kind === "destroyUnits" || p.kind === "downgrade") {
        max = p.count;
      } else if (p.kind === "upgradeOne") {
        max = 1;
        sel.picks = [];
      }
      if (sel.picks.length < max) {
        sel.picks.push({ area: d.area, idx: idx });
      }
    }
    render();
  };

  ACTIONS.confirmPicks = function (state, p) {
    var picks = sel.picks.slice();
    if (p.kind === "reconcile" || p.kind === "destroyUnits") {
      submit({ type: p.kind, remove: picks });
    } else if (p.kind === "downgrade") {
      submit({ type: "downgrade", picks: picks });
    } else if (p.kind === "upgradeOne") {
      submit({ type: "upgradeOne", pick: picks[0] });
    }
  };

  ACTIONS.skipUpgrade = function () {
    submit({ type: "upgradeOne", pick: null });
  };

  ACTIONS.toggleDiscard = function (state, p, h, d) {
    var at = sel.discards.indexOf(d.card);
    if (at >= 0) {
      sel.discards.splice(at, 1);
    } else if (sel.discards.length < p.count) {
      sel.discards.push(d.card);
    }
    render();
  };

  ACTIONS.confirmDiscard = function () {
    submit({ type: "discardLeaders", cards: sel.discards.slice() });
  };

  ACTIONS.chooseTrack = function (state, p, h, d) {
    submit({ type: "chooseTrack", track: d.track });
  };

  ACTIONS.bidStep = function (state, p, h, d) {
    var next = sel.amount + Number(d.d);
    sel.amount = Math.max(0, Math.min(state.houses[h].power, next));
    render();
  };

  ACTIONS.submitBid = function (state, p) {
    submit({ type: p.kind, amount: sel.amount });
  };

  ACTIONS.suggestBid = function (state, p, h) {
    sel.amount = BOT.act(state, h).amount;
    render();
  };

  ACTIONS.moveUp = function (state, p, h, d) {
    var i = Number(d.i);
    var t = sel.order[i - 1];
    sel.order[i - 1] = sel.order[i];
    sel.order[i] = t;
    render();
  };

  ACTIONS.confirmTieOrder = function () {
    submit({ type: "tieOrder", order: sel.order.slice() });
  };

  ACTIONS.tiePick = function (state, p, h, d) {
    submit({ type: "tiePick", pick: d.house });
  };

  ACTIONS.choice = function (state, p, h, d) {
    submit({ type: "choice", choice: d.choice });
  };

  ACTIONS.cpChoice = function (state, p, h, d) {
    submit({ type: "consolidateChoice", choice: d.choice });
  };

  function onMapClick(id) {
    var state = st();
    var h = me();
    var p = state.pending;
    if (!p || !h || p.houses.indexOf(h) < 0) {
      sel.selectedArea = id;
      render();
      return;
    }
    var k = p.kind;
    if (k === "orders") {
      if (E.areasWithUnits(state, h).indexOf(id) >= 0) {
        sel.selectedArea = id;
        render();
      }
    } else if (k === "raven" && sel.mode === "swap") {
      var o = state.areas[id].order;
      if (o && o.h === h) {
        sel.swapArea = id;
        sel.swapToken = null;
        render();
      }
    } else if (k === "raid") {
      if (E.ordersOfKind(state, h, "raid").indexOf(id) >= 0) {
        sel.from = id;
        render();
      } else if (sel.from && E.raidTargets(state, h, sel.from).indexOf(id) >= 0) {
        submit({ type: "raid", from: sel.from, target: id });
      }
    } else if (k === "march") {
      if (!sel.from || (sel.moves && sel.moves.length === 0 && E.ordersOfKind(state, h, "march").indexOf(id) >= 0 && id !== sel.from)) {
        if (E.ordersOfKind(state, h, "march").indexOf(id) >= 0) {
          sel.from = id;
          sel.moves = [];
          sel.picked = null;
          sel.leaveToken = false;
          render();
        }
        return;
      }
      var targets = marchTargets(state, h);
      if (targets[id] && sel.picked && sel.picked.length > 0) {
        var existing = null;
        sel.moves.forEach(function (m) {
          if (m.to === id) {
            existing = m;
          }
        });
        if (existing) {
          existing.units = existing.units.concat(sel.picked);
        } else {
          sel.moves.push({ to: id, units: sel.picked.slice() });
        }
        sel.picked = unassignedUnits(state);
        render();
      }
    } else if (k === "retreat") {
      if (p.options.indexOf(id) >= 0) {
        submit({ type: "retreat", to: id });
      }
    } else {
      sel.selectedArea = id;
      render();
    }
  }

  function onMapHover(id, ev) {
    var tip = el("tooltip");
    if (!id) {
      tip.hidden = true;
      return;
    }
    var state = st();
    var a = E.AREA[id];
    var area = state.areas[id];
    var lines = [];
    var kind = "Sea";
    if (a.type === "land") {
      kind = "Land";
      if (a.castle === 1) {
        kind = "Castle";
      } else if (a.castle === 2) {
        kind = "Stronghold";
      }
    }
    lines.push("<b>" + esc(a.name) + "</b> <span class=\"muted\">" + kind + "</span>");
    if (a.type === "land") {
      var bits = [];
      if (a.barrels) {
        bits.push(a.barrels + " " + plural(a.barrels, "supply barrel", "supply barrels"));
      }
      if (a.crowns) {
        bits.push(a.crowns + " " + plural(a.crowns, "crown", "crowns"));
      }
      if (bits.length > 0) {
        lines.push(esc(bits.join(", ")));
      }
      var ctrl = E.controller(state, id);
      if (ctrl) {
        lines.push("Held by " + chip(ctrl));
      } else {
        lines.push('<span class="muted">Unclaimed</span>');
      }
    }
    if (area.neutral > 0) {
      lines.push("Neutral force: strength " + area.neutral);
    }
    if (a.home && area.garrison > 0) {
      lines.push("Garrison: +" + area.garrison + " when defending");
    }
    if (area.units.length > 0) {
      var counts = {};
      area.units.forEach(function (u) {
        var key = R.UNIT_NAMES[u.t];
        if (u.r) {
          key += " (routed)";
        }
        counts[key] = (counts[key] || 0) + 1;
      });
      lines.push(Object.keys(counts).map(function (k2) {
        return counts[k2] + " " + k2;
      }).join(", "));
    }
    if (area.order) {
      lines.push("Order: " + esc(E.ORDER_BY_ID[area.order.id].label));
    }
    lines.push('<span class="muted small">Borders: ' + esc(E.ADJ[id].map(function (x) {
      return E.AREA[x].name;
    }).join(", ")) + "</span>");
    tip.innerHTML = lines.join("<br>");
    tip.hidden = false;
    var wrap = el("map").getBoundingClientRect();
    var x = ev.clientX - wrap.left + 16;
    var y = ev.clientY - wrap.top + 16;
    if (x > wrap.width - 240) {
      x = ev.clientX - wrap.left - 250;
    }
    tip.style.left = Math.max(4, x) + "px";
    tip.style.top = y + "px";
  }

  function renderHouses(state) {
    var html = '<h2 class="ptitle">Houses</h2><div class="houses">';
    state.tracks.crown.forEach(function (h) {
      var house = state.houses[h];
      var castles = E.castleCount(state, h);
      var pips = "";
      for (var i = 0; i < R.VICTORY_CASTLES; i++) {
        var cls = "cp";
        if (i < castles) {
          cls += " on";
        }
        pips += '<span class="' + cls + '"></span>';
      }
      var meTag = "";
      if (h === me() || h === app.viewer()) {
        meTag = " me";
      }
      html += '<div class="house h-' + h + meTag + '"><div class="hrow">' + chip(h, R.HOUSES[h].name) + '<span class="seatlbl">' + esc(app.seatLabel(h)) + "</span></div>";
      html += '<div class="castles" title="Castles and strongholds held">' + pips + "<b>" + castles + "/" + R.VICTORY_CASTLES + "</b></div>";
      html += '<dl class="stats"><div><dt>Supply</dt><dd>' + house.supply + '</dd></div><div><dt>Power</dt><dd>' + house.power + '</dd></div><div><dt>Leaders</dt><dd>' + house.hand.length + '</dd></div><div><dt>Special</dt><dd>' + E.starLimit(state, h) + "</dd></div></dl></div>";
    });
    html += "</div>";
    el("houses").innerHTML = html;
  }

  function renderTracks(state) {
    var html = '<h2 class="ptitle">Influence</h2>';
    ["crown", "sword", "court"].forEach(function (t) {
      html += '<div class="track"><span class="tname" title="' + esc(R.TOKEN_NAMES[t]) + '">' + R.TRACK_NAMES[t] + "</span>";
      state.tracks[t].forEach(function (h, i) {
        var tag = "";
        if (i === 0) {
          tag = ' title="Holds ' + esc(R.TOKEN_NAMES[t]) + '"';
        }
        html += '<span class="tslot"' + tag + ">" + (i + 1) + " " + chip(h) + "</span>";
      });
      html += "</div>";
    });
    var cells = "";
    for (var v = 0; v <= 12; v += 2) {
      var cls = "tcell";
      if (v === state.threat) {
        cls += " on";
      }
      if (v === 12) {
        cls += " max";
      }
      cells += '<span class="' + cls + '">' + v + "</span>";
    }
    html += '<div class="threat"><span class="tname">Horde</span><div class="tcells">' + cells + "</div></div>";
    el("tracks").innerHTML = html;
  }

  function renderEvents(state) {
    var html = '<h2 class="ptitle">Events This Round</h2>';
    if (!state.drawn.I) {
      html += '<p class="muted small">No event cards are drawn in round 1. From round 2 one card is drawn from each of the three decks at the start of every round.</p>';
    } else {
      html += '<div class="events">';
      ["I", "II", "III"].forEach(function (deck) {
        var card = state.drawn[deck];
        var info = E.EVENT_BY_ID[card.c];
        var horde = "";
        if (card.w) {
          horde = '<span class="hordemark" title="Raises the horde threat by 2">▲ horde</span>';
        }
        html += '<div class="ecard"><span class="deck">' + deck + "</span><h3>" + esc(info.name) + "</h3><p>" + esc(info.text) + "</p>" + horde + "</div>";
      });
      html += "</div>";
    }
    if (state.peek && state.peek.h === me() && state.peek.round === state.round) {
      html += '<p class="muted small">You saw the next horde card: ' + esc(E.HORDE_BY_ID[state.peek.card].name) + ".</p>";
    }
    el("events").innerHTML = html;
  }

  function renderBattle(state) {
    var b = state.lastBattle;
    var box = el("battle");
    if (!b) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    var html = '<h2 class="ptitle">Last Battle</h2><div class="bhead">' + chip(b.att) + ' <span class="vs">vs</span> ' + chip(b.def) + ' <span class="muted">in</span> ' + areaLabel(b.area) + ' <span class="muted">(round ' + b.round + ")</span></div>";
    html += '<div class="cards-row">' + leaderCardHtml(E.LEADER_BY_ID[b.cards[b.att]], false) + leaderCardHtml(E.LEADER_BY_ID[b.cards[b.def]], false) + "</div>";
    html += '<p class="small">' + esc(hName(b.att)) + " " + b.sides[b.att].total + " – " + b.sides[b.def].total + " " + esc(hName(b.def)) + ". " + chip(b.winner) + " won";
    if (b.tieReason === "sword") {
      html += " the tie on the Sword track";
    } else if (b.tieReason === "card") {
      html += " the tie through a leader's text";
    }
    html += "; " + b.casualties + " " + plural(b.casualties, "casualty", "casualties") + ".</p>";
    box.innerHTML = html;
  }

  function renderLog(state) {
    var list = state.log.slice(-60).reverse();
    var html = '<h2 class="ptitle">Chronicle</h2><ol class="log">';
    list.forEach(function (l) {
      var cls = "";
      if (l.h) {
        cls = ' class="lh-' + l.h + '"';
      }
      html += "<li" + cls + '><span class="lr">R' + l.r + "</span> " + esc(l.t) + "</li>";
    });
    html += "</ol>";
    el("log").innerHTML = html;
    lastLogLength = state.log.length;
  }

  return { init: init, render: render, LEARN: LEARN };
})();
