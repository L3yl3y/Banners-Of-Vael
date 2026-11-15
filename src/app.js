var APP = (function () {
  var E = ENGINE;
  var R = E.RULES;
  var SAVE_KEY = "banners-of-vael-save-v1";
  var PREF_KEY = "banners-of-vael-prefs-v1";

  var game = null;
  var role = "none";
  var seats = {};
  var myHouse = null;
  var net = null;
  var netKind = "none";
  var roomCode = null;
  var clientId = null;
  var botTimer = null;
  var revealed = null;
  var prefs = { learning: true, speed: "normal" };
  var connectedHouses = {};
  var netNote = "";
  var lobbyChoice = { house: "thorne", others: {} };
  var pickingSeat = false;

  function el(id) {
    return document.getElementById(id);
  }

  function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function readStore(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      return false;
    }
    return true;
  }

  function clearStore(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      return false;
    }
    return true;
  }

  function controlled() {
    if (role === "guest") {
      if (myHouse) {
        return [myHouse];
      }
      return [];
    }
    return R.HOUSE_ORDER.filter(function (h) {
      return seats[h] && (seats[h].kind === "me" || seats[h].kind === "local");
    });
  }

  function activeHouse() {
    if (!game || !game.pending || game.winner) {
      return null;
    }
    var p = game.pending;
    var mine = controlled().filter(function (h) {
      return p.houses.indexOf(h) >= 0;
    });
    if (mine.length === 0) {
      return null;
    }
    if (controlled().length > 1) {
      if (revealed && mine.indexOf(revealed) >= 0) {
        return revealed;
      }
      return null;
    }
    return mine[0];
  }

  function nextLocalToReveal() {
    if (!game || !game.pending || game.winner) {
      return null;
    }
    if (controlled().length < 2) {
      return null;
    }
    var p = game.pending;
    var mine = controlled().filter(function (h) {
      return p.houses.indexOf(h) >= 0;
    });
    if (mine.length === 0) {
      return null;
    }
    if (revealed && mine.indexOf(revealed) >= 0) {
      return null;
    }
    return mine[0];
  }

  function viewer() {
    if (role === "guest") {
      return myHouse;
    }
    var mine = controlled();
    if (mine.length === 1) {
      return mine[0];
    }
    return revealed;
  }

  function seatLabel(h) {
    var s = seats[h];
    if (!s) {
      return "";
    }
    if (role === "guest") {
      if (h === myHouse) {
        return "You";
      }
      if (s.kind === "bot") {
        return "Bot";
      }
      if (s.kind === "remote") {
        return "Friend";
      }
      return "Host";
    }
    if (s.kind === "me") {
      return "You";
    }
    if (s.kind === "local") {
      return "Same device";
    }
    if (s.kind === "bot") {
      return "Bot";
    }
    if (s.kind === "remote") {
      if (netKind === "peer" && !connectedHouses[h]) {
        if (s.owner) {
          return "Friend (disconnected)";
        }
        return "Friend (not joined)";
      }
      if (!s.owner) {
        return "Friend (not joined)";
      }
      return "Friend";
    }
    return s.kind;
  }

  function state() {
    return game;
  }

  function learning() {
    return prefs.learning;
  }

  function submit(h, action) {
    if (role === "guest") {
      if (!net) {
        return { ok: false, error: "Not connected." };
      }
      net.send(h, action);
      return { ok: true };
    }
    var result = E.applyAction(game, h, action);
    if (result.ok) {
      changed();
    }
    return result;
  }

  function botDelay(kind) {
    var base = 650;
    if (prefs.speed === "fast") {
      base = 140;
    } else if (prefs.speed === "slow") {
      base = 1300;
    }
    if (kind === "orders" || kind === "bid" || kind === "hordeBid" || kind === "leader") {
      return Math.round(base * 0.4);
    }
    return base;
  }

  function scheduleBots() {
    clearTimeout(botTimer);
    if (role === "guest" || !game || game.winner || !game.pending) {
      return;
    }
    var p = game.pending;
    var bots = p.houses.filter(function (h) {
      return seats[h] && seats[h].kind === "bot";
    });
    if (bots.length === 0) {
      return;
    }
    botTimer = setTimeout(function () {
      stepBot(bots[0]);
    }, botDelay(p.kind));
  }

  function fallbackAction(h) {
    var p = game.pending;
    if (p.kind === "march") {
      return { type: "march", from: E.ordersOfKind(game, h, "march")[0], moves: [] };
    }
    if (p.kind === "muster") {
      return { type: "muster", builds: [] };
    }
    if (p.kind === "raid") {
      return { type: "raid", from: E.ordersOfKind(game, h, "raid")[0], target: null };
    }
    return null;
  }

  function stepBot(h) {
    if (!game || !game.pending || game.pending.houses.indexOf(h) < 0) {
      scheduleBots();
      return;
    }
    var action = BOT.act(game, h);
    var result = E.applyAction(game, h, action);
    if (!result.ok) {
      var fb = fallbackAction(h);
      if (fb) {
        result = E.applyAction(game, h, fb);
      }
      if (!result.ok) {
        console.error("Bot could not act", h, game.pending.kind, result.error);
        return;
      }
    }
    changed();
  }

  function stateFor(h) {
    if (h === null || netKind === "claude") {
      return game;
    }
    return E.visibleState(game, h);
  }

  function seatsForNet() {
    var out = {};
    R.HOUSE_ORDER.forEach(function (h) {
      var kind = seats[h].kind;
      if (kind === "me" || kind === "local") {
        kind = "host";
      }
      out[h] = { kind: kind, owner: seats[h].owner || null };
    });
    return out;
  }

  function save() {
    if (role === "host" || role === "local") {
      writeStore(SAVE_KEY, { role: role, seats: seats, game: game, code: roomCode, netKind: netKind, saved: Date.now() });
    } else if (role === "guest") {
      writeStore(SAVE_KEY, { role: "guest", code: roomCode, client: clientId, house: myHouse, netKind: netKind, saved: Date.now() });
    }
  }

  function changed() {
    save();
    if (net && role === "host") {
      net.broadcast(stateFor, seatsForNet());
    }
    renderAll();
    scheduleBots();
  }

  function renderAll() {
    if (!game) {
      return;
    }
    el("game").hidden = false;
    var reveal = nextLocalToReveal();
    var curtain = el("curtain");
    if (reveal) {
      curtain.hidden = false;
      el("curtain-text").innerHTML = 'Pass the device to <b class="h-text-' + reveal + '">' + esc(R.HOUSES[reveal].name) + "</b>.";
      el("curtain-btn").textContent = "I Am " + R.HOUSES[reveal].short + ", Show My Turn";
      el("curtain-btn").setAttribute("data-house", reveal);
    } else {
      curtain.hidden = true;
    }
    renderNetBanner();
    UI.render();
  }

  function renderNetBanner() {
    var box = el("netinfo");
    if (role === "host" && roomCode) {
      var who = R.HOUSE_ORDER.filter(function (h) {
        return seats[h].kind === "remote";
      }).map(function (h) {
        return R.HOUSES[h].short + ": " + seatLabel(h);
      }).join(" · ");
      if (netKind === "peer") {
        box.innerHTML = 'Room <b class="code">' + esc(roomCode) + "</b> " + esc(who) + ' <button class="btn sm ghost" data-act="copyCode">Copy Code</button>' + netNoteHtml();
      } else {
        box.innerHTML = 'Online game <b class="code">' + esc(roomCode) + "</b> " + esc(who) + netNoteHtml();
      }
      box.hidden = false;
    } else if (role === "guest") {
      box.innerHTML = 'Joined game <b class="code">' + esc(roomCode || "") + "</b>" + netNoteHtml();
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }

  function netNoteHtml() {
    if (!netNote) {
      return "";
    }
    return ' <span class="netnote">' + esc(netNote) + "</span>";
  }

  function onCurtainClick() {
    revealed = el("curtain-btn").getAttribute("data-house");
    renderAll();
  }

  function startGame(config) {
    seats = {};
    R.HOUSE_ORDER.forEach(function (h) {
      var kind = config.seats[h];
      seats[h] = { kind: kind, owner: null, name: R.HOUSES[h].short };
    });
    var engineSeats = {};
    R.HOUSE_ORDER.forEach(function (h) {
      engineSeats[h] = { kind: seats[h].kind, name: R.HOUSES[h].short };
    });
    game = E.createGame({ seats: engineSeats });
    revealed = null;
    var needsNet = R.HOUSE_ORDER.some(function (h) {
      return seats[h].kind === "remote";
    });
    el("lobby").hidden = true;
    if (needsNet) {
      role = "host";
      roomCode = NET.makeCode();
      startHosting();
    } else {
      role = "local";
      roomCode = null;
      netKind = "none";
    }
    changed();
  }

  function hostHandlers() {
    return {
      onStatus: function (status, detail) {
        if (status === "open") {
          netNote = "";
        } else if (status === "error") {
          if (detail === "unavailable-id") {
            netNote = "That room code is busy. Retrying with a new code…";
            roomCode = NET.makeCode();
            setTimeout(startHosting, 400);
          } else {
            netNote = "Network trouble (" + detail + ").";
          }
        }
        renderNetBanner();
      },
      onJoin: function (client, want) {
        var remote = R.HOUSE_ORDER.filter(function (h) {
          return seats[h].kind === "remote";
        });
        var found = null;
        remote.forEach(function (h) {
          if (!found && seats[h].owner === client) {
            found = h;
          }
        });
        if (!found && want && seats[want] && seats[want].kind === "remote" && !seats[want].owner) {
          seats[want].owner = client;
          found = want;
        }
        if (!found) {
          remote.forEach(function (h) {
            if (!found && !seats[h].owner) {
              seats[h].owner = client;
              found = h;
            }
          });
        }
        if (found) {
          connectedHouses[found] = true;
        }
        return found;
      },
      onLeave: function (client) {
        R.HOUSE_ORDER.forEach(function (h) {
          if (seats[h].owner === client) {
            connectedHouses[h] = false;
          }
        });
        renderAll();
      },
      onChange: function () {
        changed();
      },
      currentVersion: function () {
        if (game) {
          return game.v;
        }
        return -1;
      },
      stateFor: stateFor,
      onAction: function (house, action, by) {
        if (!seats[house] || seats[house].kind !== "remote") {
          return { ok: false, error: "That seat is not played online." };
        }
        if (netKind === "claude" && seats[house].owner !== by) {
          return { ok: false, error: "That seat belongs to someone else." };
        }
        var result = E.applyAction(game, house, action);
        if (result.ok) {
          changed();
        }
        return result;
      }
    };
  }

  function startHosting(seqs) {
    if (net) {
      try {
        net.close();
      } catch (e) {
        net = null;
      }
      net = null;
    }
    NET.detect().then(function (kind) {
      netKind = kind;
      if (kind === "peer") {
        net = NET.peerHost(roomCode, hostHandlers());
        changed();
      } else if (kind === "claude") {
        NET.claudeHost(roomCode, hostHandlers(), seqs).then(function (n) {
          net = n;
          changed();
        });
      } else {
        netNote = "Online play is not available here. Use a same-device seat or a bot instead.";
        renderNetBanner();
      }
    });
  }

  function joinPeer(code) {
    code = NET.cleanCode(code);
    if (code.length !== 4) {
      showLobbyError("Room codes have four letters.");
      return;
    }
    var saved = readStore(SAVE_KEY);
    var want = null;
    if (saved && saved.role === "guest" && saved.code === code) {
      want = saved.house;
      clientId = saved.client;
    }
    if (!clientId) {
      clientId = "c" + Math.random().toString(36).slice(2, 12);
    }
    role = "guest";
    roomCode = code;
    netKind = "peer";
    showLobbyError("Connecting to room " + code + "…", true);
    net = NET.peerGuest(code, clientId, want, guestHandlers());
  }

  function guestHandlers() {
    return {
      onStatus: function (status) {
        if (status === "closed") {
          netNote = "The host has left. The game resumes when they return.";
        } else if (status === "connected") {
          netNote = "";
        } else if (status === "slow") {
          netNote = "The game is slow to load. It may be out of date.";
        }
        renderNetBanner();
      },
      onWelcome: function (house) {
        myHouse = house;
        save();
      },
      onSeats: function (netSeats, uid) {
        seats = netSeats;
        var mine = null;
        R.HOUSE_ORDER.forEach(function (h) {
          if (netSeats[h].owner && netSeats[h].owner === uid) {
            mine = h;
          }
        });
        if (mine) {
          myHouse = mine;
          pickingSeat = false;
          save();
        } else if (!myHouse) {
          pickingSeat = showSeatPicker(netSeats);
        }
      },
      onState: function (incoming) {
        game = incoming;
        if (game.seats && netKind === "peer") {
          var merged = {};
          R.HOUSE_ORDER.forEach(function (h) {
            var kind = game.seats[h].kind;
            if (kind === "me" || kind === "local") {
              kind = "host";
            }
            merged[h] = { kind: kind };
          });
          seats = merged;
        }
        if (!pickingSeat) {
          el("lobby").hidden = true;
        }
        renderAll();
      },
      onError: function (message) {
        netNote = message;
        if (!game) {
          showLobbyError(message);
        } else {
          renderNetBanner();
        }
      }
    };
  }

  function showSeatPicker(netSeats) {
    var open = R.HOUSE_ORDER.filter(function (h) {
      return netSeats[h].kind === "remote" && !netSeats[h].owner;
    });
    var box = el("join-result");
    if (open.length === 0) {
      box.innerHTML = '<p class="err">Every friend seat in this game is taken. You can watch.</p>';
      return false;
    }
    var html = "<p>Choose your house:</p><div class=\"row\">";
    open.forEach(function (h) {
      html += '<button class="btn" data-act="claimSeat" data-house="' + h + '">' + esc(R.HOUSES[h].name) + "</button>";
    });
    box.innerHTML = html + "</div>";
    el("lobby").hidden = false;
    return true;
  }

  function joinClaude(code) {
    role = "guest";
    roomCode = code;
    netKind = "claude";
    NET.claudeGuest(code, guestHandlers()).then(function (n) {
      net = n;
    });
  }

  function showLobbyError(message, neutral) {
    var box = el("join-result");
    if (!box) {
      return;
    }
    var cls = "err";
    if (neutral) {
      cls = "muted";
    }
    box.innerHTML = '<p class="' + cls + '">' + esc(message) + "</p>";
  }

  function resume() {
    var saved = readStore(SAVE_KEY);
    if (!saved) {
      return;
    }
    if (saved.role === "guest") {
      if (saved.netKind === "peer") {
        joinPeer(saved.code);
      } else if (saved.netKind === "claude") {
        myHouse = saved.house;
        joinClaude(saved.code);
      }
      return;
    }
    game = saved.game;
    seats = saved.seats;
    role = saved.role;
    roomCode = saved.code;
    revealed = null;
    el("lobby").hidden = true;
    if (role === "host" && roomCode) {
      startHosting();
    }
    changed();
  }

  function newGame() {
    clearTimeout(botTimer);
    if (net) {
      try {
        net.close();
      } catch (e) {
        net = null;
      }
    }
    net = null;
    game = null;
    role = "none";
    myHouse = null;
    roomCode = null;
    netNote = "";
    clearStore(SAVE_KEY);
    el("game").hidden = true;
    el("curtain").hidden = true;
    renderLobby();
    el("lobby").hidden = false;
  }

  function houseCard(h, selected) {
    var info = R.HOUSES[h];
    var cls = "house-pick h-" + h;
    if (selected) {
      cls += " on";
    }
    return '<button class="' + cls + '" data-act="pickHouse" data-house="' + h + '" aria-pressed="' + selected + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#em-' + h + '"/></svg><span class="hp-name">' + esc(info.name) + '</span><span class="hp-seat">' + esc(info.seat) + '</span><span class="hp-motto">“' + esc(info.motto) + '”</span></button>';
  }

  function renderLobby() {
    var saved = readStore(SAVE_KEY);
    var html = "";
    html += '<div class="lobby-grid"><section class="lobby-main">';
    html += '<h2 class="lh">Choose Your House</h2><div class="house-picks">';
    R.HOUSE_ORDER.forEach(function (h) {
      html += houseCard(h, lobbyChoice.house === h);
    });
    html += "</div>";
    html += '<h2 class="lh">Who Commands The Other Houses</h2><div class="seat-rows">';
    R.HOUSE_ORDER.forEach(function (h) {
      if (h === lobbyChoice.house) {
        return;
      }
      var current = lobbyChoice.others[h] || "bot";
      html += '<label class="seat-row"><span class="hchip h-' + h + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#em-' + h + '"/></svg>' + esc(R.HOUSES[h].name) + '</span><select id="seat-' + h + '" data-house="' + h + '">';
      [["bot", "Bot"], ["remote", "Friend online"], ["local", "Friend on this device"]].forEach(function (opt) {
        var s = "";
        if (opt[0] === current) {
          s = " selected";
        }
        html += '<option value="' + opt[0] + '"' + s + ">" + opt[1] + "</option>";
      });
      html += "</select></label>";
    });
    html += "</div>";
    var learnChecked = "";
    if (prefs.learning) {
      learnChecked = " checked";
    }
    html += '<div class="opts"><label class="check"><input type="checkbox" id="opt-learning"' + learnChecked + '> Show learning notes</label><label class="sel">Bot speed <select id="opt-speed">';
    [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]].forEach(function (opt) {
      var s = "";
      if (opt[0] === prefs.speed) {
        s = " selected";
      }
      html += '<option value="' + opt[0] + '"' + s + ">" + opt[1] + "</option>";
    });
    html += "</select></label></div>";
    html += '<div class="row"><button class="btn primary big" data-act="start">Start Game</button>';
    if (saved && (saved.game || saved.role === "guest")) {
      var label = "Resume Saved Game";
      if (saved.game) {
        label += " (Round " + saved.game.round + ")";
      }
      html += '<button class="btn ghost" data-act="resume">' + esc(label) + "</button>";
    }
    html += '<button class="btn ghost" data-act="rules">How To Play</button></div>';
    html += '<p class="muted small" id="online-note">' + onlineNote() + "</p>";
    html += '</section><section class="lobby-join"><h2 class="lh">Join A Friend</h2><div id="join-box"></div><div id="join-result"></div></section></div>';
    el("lobby-body").innerHTML = html;
    renderJoinBox();
  }

  var detected = "none";

  function onlineNote() {
    if (detected === "peer") {
      return "Friend online: you get a four-letter room code. Your friend opens this same page, chooses Join, and types it. Keep your page open while you play; you host the game.";
    }
    if (detected === "claude") {
      return "Friend online: on this claude.ai page, share it with your friend as an Editor (invite them by email in Share, without a public link). They open it, choose Join, and pick your game. Keep your page open while you play.";
    }
    return "Online play needs either the GitHub Pages version or this page on claude.ai. Same-device seats and bots always work.";
  }

  function renderJoinBox() {
    var box = el("join-box");
    if (!box) {
      return;
    }
    if (detected === "peer") {
      box.innerHTML = '<p class="muted">Enter the room code your friend gave you.</p><div class="row"><input id="join-code" class="code-input" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" aria-label="Room code"><button class="btn primary" data-act="joinPeer">Join</button></div>';
    } else if (detected === "claude") {
      box.innerHTML = '<p class="muted">Games hosted on this page:</p><div id="game-list"><p class="muted">Looking for games…</p></div><div class="row"><button class="btn ghost sm" data-act="refreshList">Refresh</button></div>';
      refreshList();
    } else {
      box.innerHTML = '<p class="muted">Joining needs the GitHub Pages version or the claude.ai page.</p>';
    }
  }

  function refreshList() {
    NET.claudeList().then(function (games) {
      var list = el("game-list");
      if (!list) {
        return;
      }
      if (games.length === 0) {
        list.innerHTML = '<p class="muted">No games yet. When your friend starts one with a "Friend online" seat, it appears here.</p>';
        return;
      }
      var html = '<ul class="glist">';
      games.forEach(function (g) {
        var open = R.HOUSE_ORDER.filter(function (h) {
          return g.seats[h] && g.seats[h].kind === "remote" && (!g.seats[h].owner || g.seats[h].owner === g.uid);
        }).map(function (h) {
          return R.HOUSES[h].short;
        });
        var status = "Round " + g.round;
        if (g.over) {
          status = "Finished";
        }
        var mins = Math.max(0, Math.round((Date.now() - g.updated) / 60000));
        html += '<li><b class="code">' + esc(g.code) + "</b> " + esc(status) + ' <span class="muted">(' + mins + " min ago)</span> ";
        if (open.length > 0 && !g.over) {
          html += '<button class="btn sm" data-act="joinClaude" data-code="' + esc(g.code) + '">Join as ' + esc(open.join(" or ")) + "</button>";
        } else {
          html += '<span class="muted">no free seat</span>';
        }
        html += "</li>";
      });
      list.innerHTML = html + "</ul>";
    }, function () {
      var list = el("game-list");
      if (list) {
        list.innerHTML = '<p class="err">Could not read the list of games.</p>';
      }
    });
  }

  function onLobbyClick(ev) {
    var t = ev.target.closest("[data-act]");
    if (!t) {
      return;
    }
    var act = t.getAttribute("data-act");
    if (act === "pickHouse") {
      lobbyChoice.house = t.getAttribute("data-house");
      renderLobby();
    } else if (act === "start") {
      var config = { seats: {} };
      R.HOUSE_ORDER.forEach(function (h) {
        if (h === lobbyChoice.house) {
          config.seats[h] = "me";
        } else {
          config.seats[h] = lobbyChoice.others[h] || "bot";
        }
      });
      startGame(config);
    } else if (act === "resume") {
      resume();
    } else if (act === "rules") {
      openRules();
    } else if (act === "joinPeer") {
      joinPeer(el("join-code").value);
    } else if (act === "joinClaude") {
      joinClaude(t.getAttribute("data-code"));
    } else if (act === "refreshList") {
      refreshList();
    } else if (act === "claimSeat") {
      if (net && net.claim) {
        net.claim(t.getAttribute("data-house"));
        showLobbyError("Asking the host for your seat…", true);
      }
    }
  }

  function onLobbyChange(ev) {
    var t = ev.target;
    if (t.id === "opt-learning") {
      prefs.learning = t.checked;
      writeStore(PREF_KEY, prefs);
    } else if (t.id === "opt-speed") {
      prefs.speed = t.value;
      writeStore(PREF_KEY, prefs);
    } else if (t.getAttribute("data-house")) {
      lobbyChoice.others[t.getAttribute("data-house")] = t.value;
    }
  }

  function openRules() {
    el("rules").hidden = false;
    el("rules-close").focus();
  }

  function closeRules() {
    el("rules").hidden = true;
  }

  function buildLeaderReference() {
    var html = "";
    R.HOUSE_ORDER.forEach(function (h) {
      html += '<h4 class="h-text-' + h + '">' + esc(R.HOUSES[h].name) + '</h4><div class="cards ref">';
      R.LEADERS[h].forEach(function (c) {
        var card = E.LEADER_BY_ID[c.id];
        var icons = "";
        for (var s = 0; s < card.swords; s++) {
          icons += '<svg class="ic sword" viewBox="0 0 16 16" aria-label="Sword"><path d="M13.5 1.5L7 8l1 1 6.5-6.5zM5.2 8.6l2.2 2.2-1 1-.9-.4-2.3 2.3-.9-.9 2.3-2.3-.4-.9z" fill="currentColor"/></svg>';
        }
        for (var f = 0; f < card.forts; f++) {
          icons += '<svg class="ic fort" viewBox="0 0 16 16" aria-label="Tower"><path d="M3 15V5h2V2h2v3h2V2h2v3h2v10z" fill="currentColor"/><path d="M7 15v-3a1 1 0 0 1 2 0v3z" fill="#efe3c4"/></svg>';
        }
        var text = card.text;
        if (!text) {
          text = "No special text.";
        }
        html += '<div class="lcard h-' + h + '"><span class="lstr">' + card.strength + '</span><span class="lname">' + esc(card.name) + '</span><span class="ltitle">' + esc(card.title) + '</span><span class="licons">' + icons + '</span><span class="ltext">' + esc(text) + "</span></div>";
      });
      html += "</div>";
    });
    el("leader-ref").innerHTML = html;
    var horde = "";
    R.HORDE_CARDS.forEach(function (c) {
      horde += '<div class="hcard"><h3>' + esc(c.name) + "</h3><p><b>Gate holds:</b> " + esc(c.win) + "</p><p><b>Horde wins:</b> " + esc(c.lowest) + " " + esc(c.others) + "</p></div>";
    });
    el("horde-ref").innerHTML = horde;
  }

  function onTopClick(ev) {
    var t = ev.target.closest("[data-act]");
    if (!t) {
      return;
    }
    var act = t.getAttribute("data-act");
    if (act === "rules") {
      openRules();
    } else if (act === "menu") {
      el("menu").hidden = !el("menu").hidden;
    } else if (act === "toggleLearning") {
      prefs.learning = !prefs.learning;
      writeStore(PREF_KEY, prefs);
      el("menu").hidden = true;
      renderAll();
    } else if (act === "speed") {
      prefs.speed = t.getAttribute("data-speed");
      writeStore(PREF_KEY, prefs);
      el("menu").hidden = true;
    } else if (act === "leave") {
      el("menu").hidden = true;
      el("confirm-leave").hidden = false;
    } else if (act === "leaveYes") {
      el("confirm-leave").hidden = true;
      newGame();
    } else if (act === "leaveNo") {
      el("confirm-leave").hidden = true;
    } else if (act === "copyCode") {
      var code = roomCode;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () {
          netNote = "Code copied.";
          renderNetBanner();
        }, function () {
          netNote = "Copy failed. The code is " + code + ".";
          renderNetBanner();
        });
      }
    }
  }

  function boot(hotData) {
    var stored = readStore(PREF_KEY);
    if (stored) {
      prefs = Object.assign(prefs, stored);
    }
    UI.init({
      state: state,
      activeHouse: activeHouse,
      viewer: viewer,
      seatLabel: seatLabel,
      submit: submit,
      learning: learning,
      newGame: newGame
    });
    buildLeaderReference();
    el("lobby").addEventListener("click", onLobbyClick);
    el("lobby").addEventListener("change", onLobbyChange);
    el("lobby").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.id === "join-code") {
        joinPeer(ev.target.value);
      }
    });
    document.querySelector(".topbar").addEventListener("click", onTopClick);
    el("netinfo").addEventListener("click", onTopClick);
    el("confirm-leave").addEventListener("click", onTopClick);
    el("curtain-btn").addEventListener("click", onCurtainClick);
    el("rules-close").addEventListener("click", closeRules);
    el("rules").addEventListener("click", function (ev) {
      if (ev.target === el("rules")) {
        closeRules();
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        closeRules();
        el("menu").hidden = true;
      }
    });
    renderLobby();
    NET.detect().then(function (kind) {
      detected = kind;
      renderLobby();
    });
    if (hotData && hotData.game) {
      game = hotData.game;
      seats = hotData.seats;
      role = hotData.role;
      roomCode = hotData.code;
      el("lobby").hidden = true;
      if (role === "host" && roomCode) {
        startHosting();
      }
      changed();
    }
  }

  function snapshot() {
    if (role === "host" || role === "local") {
      return { game: game, seats: seats, role: role, code: roomCode };
    }
    return {};
  }

  return { boot: boot, snapshot: snapshot };
})();

(function () {
  var hot = null;
  if (window.claude && window.claude.hot) {
    hot = window.claude.hot;
  }
  if (hot && typeof hot.snapshot === "function") {
    hot.snapshot(APP.snapshot);
  }
  if (hot && typeof hot.ready === "function") {
    hot.ready(APP.boot);
  } else {
    var data = {};
    if (hot && hot.data) {
      data = hot.data;
    }
    APP.boot(data);
  }
})();
