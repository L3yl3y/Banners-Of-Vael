var NET = (function () {
  var LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";

  function makeCode() {
    var code = "";
    for (var i = 0; i < 4; i++) {
      code += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
    }
    return code;
  }

  function cleanCode(text) {
    return String(text || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  }

  var claudeCache = null;

  function claudeCaps() {
    if (claudeCache) {
      return claudeCache;
    }
    claudeCache = new Promise(function (resolve) {
      if (!window.claude || typeof window.claude.use !== "function") {
        resolve(null);
        return;
      }
      Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (caps) {
        var db = caps[0];
        var user = caps[1];
        if (!db) {
          resolve(null);
          return;
        }
        var idPromise = Promise.resolve(null);
        if (user && typeof user.id === "function") {
          idPromise = user.id();
        }
        idPromise.then(function (uid) {
          resolve({ db: db, user: user, uid: uid });
        }, function () {
          resolve({ db: db, user: user, uid: null });
        });
      }, function () {
        resolve(null);
      });
    });
    return claudeCache;
  }

  function detect() {
    return claudeCaps().then(function (caps) {
      if (caps) {
        return "claude";
      }
      if (typeof Peer !== "undefined" && !window.claude) {
        return "peer";
      }
      return "none";
    });
  }

  function roomId(code) {
    return "banners-of-vael-room-" + code.toLowerCase();
  }

  var CHUNK = 12000;
  var sendSeq = 0;

  function sendState(conn, state) {
    var text = JSON.stringify(state);
    sendSeq++;
    var parts = Math.max(1, Math.ceil(text.length / CHUNK));
    for (var i = 0; i < parts; i++) {
      conn.send({ type: "chunk", id: sendSeq, i: i, n: parts, data: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
  }

  function makeAssembler(onComplete) {
    var buffers = {};
    var lastId = 0;
    return function (msg) {
      if (msg.id <= lastId) {
        return;
      }
      if (!buffers[msg.id]) {
        buffers[msg.id] = { n: msg.n, parts: [], got: 0 };
      }
      var buf = buffers[msg.id];
      if (buf.parts[msg.i] === undefined) {
        buf.parts[msg.i] = msg.data;
        buf.got++;
      }
      if (buf.got === buf.n) {
        lastId = msg.id;
        Object.keys(buffers).forEach(function (k) {
          if (Number(k) <= lastId) {
            delete buffers[k];
          }
        });
        var state = null;
        try {
          state = JSON.parse(buf.parts.join(""));
        } catch (e) {
          state = null;
        }
        if (state) {
          onComplete(state);
        }
      }
    };
  }

  function peerHost(code, handlers) {
    var peer = new Peer(roomId(code), { debug: 0 });
    var conns = {};
    var closed = false;
    peer.on("open", function () {
      handlers.onStatus("open");
    });
    peer.on("error", function (err) {
      handlers.onStatus("error", err && err.type);
    });
    peer.on("disconnected", function () {
      if (!closed) {
        try {
          peer.reconnect();
        } catch (e) {
          handlers.onStatus("error", "disconnected");
        }
      }
    });
    peer.on("connection", function (conn) {
      var client = null;
      conn.on("data", function (msg) {
        if (!msg || typeof msg !== "object") {
          return;
        }
        if (msg.type === "hello") {
          client = String(msg.client || "").slice(0, 40);
          var house = handlers.onJoin(client, msg.want);
          conns[client] = { conn: conn, house: house };
          if (house) {
            conn.send({ type: "welcome", house: house });
            handlers.onChange();
          } else {
            conn.send({ type: "full" });
          }
        } else if (msg.type === "ping") {
          var known = conns[client];
          if (known && known.house && handlers.currentVersion() !== msg.v) {
            sendState(conn, handlers.stateFor(known.house));
          }
        } else if (msg.type === "action") {
          var info = conns[client];
          if (!info || !info.house || info.house !== msg.house) {
            conn.send({ type: "error", message: "That seat is not yours." });
            return;
          }
          var result = handlers.onAction(info.house, msg.action, client);
          if (result && !result.ok) {
            conn.send({ type: "error", message: result.error });
          }
        }
      });
      conn.on("close", function () {
        if (client && conns[client] && conns[client].conn === conn) {
          delete conns[client];
          handlers.onLeave(client);
        }
      });
    });
    return {
      kind: "peer",
      code: code,
      broadcast: function (stateFor) {
        Object.keys(conns).forEach(function (c) {
          var info = conns[c];
          if (info.conn.open && info.house) {
            try {
              sendState(info.conn, stateFor(info.house));
            } catch (e) {
              handlers.onStatus("error", "send");
            }
          }
        });
      },
      connected: function () {
        var list = {};
        Object.keys(conns).forEach(function (c) {
          if (conns[c].conn.open && conns[c].house) {
            list[conns[c].house] = true;
          }
        });
        return list;
      },
      close: function () {
        closed = true;
        peer.destroy();
      }
    };
  }

  function peerGuest(code, client, want, handlers) {
    var peer = new Peer({ debug: 0 });
    var conn = null;
    var closed = false;
    var version = -1;
    var assemble = makeAssembler(function (state) {
      version = state.v;
      handlers.onState(state);
    });
    var pinger = setInterval(function () {
      if (conn && conn.open) {
        conn.send({ type: "ping", v: version });
      }
    }, 3000);
    peer.on("open", function () {
      conn = peer.connect(roomId(code), { reliable: true, serialization: "json" });
      conn.on("open", function () {
        handlers.onStatus("connected");
        conn.send({ type: "hello", client: client, want: want });
      });
      conn.on("data", function (msg) {
        if (!msg || typeof msg !== "object") {
          return;
        }
        if (msg.type === "welcome") {
          handlers.onWelcome(msg.house);
        } else if (msg.type === "chunk") {
          assemble(msg);
        } else if (msg.type === "error") {
          handlers.onError(msg.message);
        } else if (msg.type === "full") {
          handlers.onError("Every seat in that game is already taken.");
        }
      });
      conn.on("close", function () {
        if (!closed) {
          handlers.onStatus("closed");
        }
      });
    });
    peer.on("error", function (err) {
      var type = err && err.type;
      if (type === "peer-unavailable") {
        handlers.onError("No game was found with code " + code + ". Check the code, and check that the host still has the game open.");
      } else {
        handlers.onError("Connection problem (" + type + "). Try joining again.");
      }
    });
    return {
      kind: "peer",
      send: function (house, action) {
        if (conn && conn.open) {
          conn.send({ type: "action", client: client, house: house, action: action });
          return true;
        }
        handlers.onError("Not connected to the host.");
        return false;
      },
      close: function () {
        closed = true;
        clearInterval(pinger);
        peer.destroy();
      }
    };
  }

  function claudeHost(code, handlers, startSeqs) {
    return claudeCaps().then(function (caps) {
      var db = caps.db;
      var ref = db.doc("games/" + code);
      var writing = false;
      var queued = null;
      var seqs = Object.assign({}, startSeqs || {});
      var ready = ref.get().then(function (snap) {
        if (snap.exists) {
          var old = {};
          try {
            old = JSON.parse(snap.data().seqs || "{}");
          } catch (e) {
            old = {};
          }
          Object.keys(old).forEach(function (h) {
            seqs[h] = Math.max(seqs[h] || 0, old[h]);
          });
        }
      }, function () {
        return null;
      });
      function flush() {
        if (!queued) {
          return;
        }
        writing = true;
        var data = queued;
        queued = null;
        ref.set(data).then(function () {
          writing = false;
          flush();
        }, function (e) {
          writing = false;
          handlers.onStatus("error", e && e.code);
          if (e && e.code === "unavailable") {
            setTimeout(flush, 800 + Math.random() * 600);
          }
        });
      }
      var unsub = function () {
        return null;
      };
      ready.then(function () {
        unsub = subscribeIntents();
      });
      function subscribeIntents() {
        return db.collection("games/" + code + "/intents").onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === "removed") {
            return;
          }
          var d = change.doc.data();
          var house = change.doc.id;
          if (!d || typeof d.seq !== "number") {
            return;
          }
          if (d.seq <= (seqs[house] || 0)) {
            return;
          }
          seqs[house] = d.seq;
          if (d.claim) {
            handlers.onJoin(d.by, house);
            handlers.onChange();
          } else if (d.action) {
            var action = null;
            try {
              action = JSON.parse(d.action);
            } catch (e) {
              action = null;
            }
            if (action) {
              handlers.onAction(house, action, d.by);
            }
          }
        });
        }, function (e) {
          handlers.onStatus("error", e && e.code);
        });
      }
      handlers.onStatus("open");
      return {
        kind: "claude",
        code: code,
        uid: caps.uid,
        broadcast: function (stateFor, seats) {
          var state = stateFor(null);
          queued = {
            code: code,
            host: caps.uid,
            updated: Date.now(),
            round: state.round,
            over: !!state.winner,
            seats: JSON.stringify(seats),
            seqs: JSON.stringify(seqs),
            state: JSON.stringify(state)
          };
          if (!writing) {
            flush();
          }
        },
        connected: function () {
          return {};
        },
        close: function () {
          unsub();
        }
      };
    });
  }

  function claudeGuest(code, handlers) {
    return claudeCaps().then(function (caps) {
      var db = caps.db;
      var ref = db.doc("games/" + code);
      var loadTimer = setTimeout(function () {
        handlers.onStatus("slow");
      }, 10000);
      var unsub = ref.onSnapshot(function (snap) {
        if (!snap.metadata.fromCache) {
          clearTimeout(loadTimer);
        }
        if (!snap.exists) {
          if (!snap.metadata.fromCache) {
            handlers.onError("That game no longer exists.");
          }
          return;
        }
        var d = snap.data();
        var seats = {};
        var state = null;
        try {
          seats = JSON.parse(d.seats);
          state = JSON.parse(d.state);
        } catch (e) {
          handlers.onError("The game data could not be read.");
          return;
        }
        handlers.onSeats(seats, caps.uid);
        handlers.onState(state);
      }, function (e) {
        clearTimeout(loadTimer);
        handlers.onError("Lost contact with the game (" + (e && e.code) + ").");
      });
      var lastSeq = 0;
      function intent(house, payload) {
        var seq = Math.max(Date.now(), lastSeq + 1);
        lastSeq = seq;
        var body = Object.assign({ seq: seq, by: caps.uid }, payload);
        return db.doc("games/" + code + "/intents/" + house).set(body).then(function () {
          return true;
        }, function (e) {
          if (e && e.code === "invalid_argument") {
            handlers.onError("You can watch this game but not play in it. Ask the host to share the page with you as an Editor, without a public link.");
          } else {
            handlers.onError("Your move could not be sent (" + (e && e.code) + "). Try again.");
          }
          return false;
        });
      }
      return {
        kind: "claude",
        uid: caps.uid,
        claim: function (house) {
          return intent(house, { claim: true });
        },
        send: function (house, action) {
          intent(house, { action: JSON.stringify(action) });
          return true;
        },
        close: function () {
          unsub();
        }
      };
    });
  }

  function claudeList() {
    return claudeCaps().then(function (caps) {
      if (!caps) {
        return [];
      }
      return caps.db.collection("games").orderBy("updated", "desc").limit(8).get().then(function (snap) {
        return snap.docs.map(function (doc) {
          var d = doc.data();
          var seats = {};
          try {
            seats = JSON.parse(d.seats);
          } catch (e) {
            seats = {};
          }
          return { code: doc.id, round: d.round, over: d.over, updated: d.updated, seats: seats, host: d.host, uid: caps.uid };
        });
      });
    });
  }

  return {
    makeCode: makeCode,
    cleanCode: cleanCode,
    detect: detect,
    peerHost: peerHost,
    peerGuest: peerGuest,
    claudeHost: claudeHost,
    claudeGuest: claudeGuest,
    claudeList: claudeList,
    claudeCaps: claudeCaps
  };
})();
