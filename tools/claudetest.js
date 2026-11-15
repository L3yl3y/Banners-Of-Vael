const puppeteer = require("puppeteer-core");
const path = require("path");
const driverStep = require("./driver.js");
const url = process.argv[2] || "http://localhost:8766/dist/artifact.html";

const store = new Map();
const subs = [];

function parentOf(p) {
  const parts = p.split("/");
  parts.pop();
  return parts.join("/");
}

function rowsUnder(col) {
  const rows = [];
  for (const [key, json] of store) {
    if (parentOf(key) === col) {
      rows.push({ id: key.split("/").pop(), json: json });
    }
  }
  return rows;
}

async function deliver(sub) {
  try {
    if (sub.kind === "doc") {
      await sub.page.evaluate((id, json) => window.__push(id, json), sub.id, store.get(sub.path) || null);
    } else {
      await sub.page.evaluate((id, rows) => window.__push(id, rows), sub.id, rowsUnder(sub.path));
    }
  } catch (e) {
    return null;
  }
}

function notify(p) {
  subs.forEach(sub => {
    if ((sub.kind === "doc" && sub.path === p) || (sub.kind === "col" && parentOf(p) === sub.path)) {
      setTimeout(() => deliver(sub), 15);
    }
  });
}

const fakeClaude = uid => `
  (function () {
    var subs = {};
    var nextId = 0;
    function snapDoc(json) {
      var data = null;
      if (json) { data = JSON.parse(json); }
      return { exists: !!json, data: function () { return data; }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    function docRef(p) {
      return {
        path: p,
        id: p.split("/").pop(),
        get: function () { return window.__dbGet(p).then(snapDoc); },
        set: function (data) { return window.__dbSet(p, JSON.stringify(data)); },
        onSnapshot: function (next) { var id = ++nextId; subs[id] = { kind: "doc", next: next }; window.__dbSub(id, "doc", p); return function () { delete subs[id]; }; },
        collection: function (c) { return query(p + "/" + c, null, 0); }
      };
    }
    function shape(rows, order, lim) {
      var list = rows.map(function (r) { var d = JSON.parse(r.json); return { id: r.id, exists: true, data: function () { return d; }, metadata: { fromCache: false } }; });
      if (order) { list.sort(function (a, b) { var x = a.data()[order.f]; var y = b.data()[order.f]; if (order.dir === "desc") { return y - x; } return x - y; }); }
      if (lim) { list = list.slice(0, lim); }
      return list;
    }
    function query(p, order, lim) {
      return {
        path: p,
        orderBy: function (f, dir) { return query(p, { f: f, dir: dir }, lim); },
        limit: function (n) { return query(p, order, n); },
        doc: function (id) { return docRef(p + "/" + id); },
        get: function () { return window.__dbList(p).then(function (rows) { var docs = shape(rows, order, lim); return { docs: docs, size: docs.length, empty: docs.length === 0, docChanges: function () { return []; }, metadata: { fromCache: false } }; }); },
        onSnapshot: function (next) { var id = ++nextId; subs[id] = { kind: "col", next: next, known: {}, order: order, lim: lim }; window.__dbSub(id, "col", p); return function () { delete subs[id]; }; }
      };
    }
    window.__push = function (id, payload) {
      var sub = subs[id];
      if (!sub) { return; }
      if (sub.kind === "doc") { sub.next(snapDoc(payload)); return; }
      var docs = shape(payload, sub.order, sub.lim);
      var changes = [];
      docs.forEach(function (d) {
        var json = JSON.stringify(d.data());
        if (sub.known[d.id] === undefined) { changes.push({ type: "added", doc: d }); }
        else if (sub.known[d.id] !== json) { changes.push({ type: "modified", doc: d }); }
        sub.known[d.id] = json;
      });
      sub.next({ docs: docs, size: docs.length, empty: docs.length === 0, docChanges: function () { return changes; }, metadata: { fromCache: false } });
    };
    var db = { doc: docRef, collection: function (p) { return query(p, null, 0); } };
    var user = { id: function () { return Promise.resolve("${uid}"); } };
    window.claude = { use: function (name) { return new Promise(function (resolve) { setTimeout(function () { if (name === "db") { resolve(db); } else if (name === "user") { resolve(user); } else { resolve(null); } }, 30); }); } };
  })();
`;

async function wire(page, uid) {
  await page.exposeFunction("__dbGet", p => store.get(p) || null);
  await page.exposeFunction("__dbSet", (p, json) => {
    store.set(p, json);
    notify(p);
    return true;
  });
  await page.exposeFunction("__dbList", col => rowsUnder(col));
  await page.exposeFunction("__dbSub", (id, kind, p) => {
    const sub = { page: page, id: id, kind: kind, path: p };
    subs.push(sub);
    setTimeout(() => deliver(sub), 20);
    return true;
  });
  await page.evaluateOnNewDocument(fakeClaude(uid));
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const host = await (await browser.createBrowserContext()).newPage();
  const guest = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  for (const [name, p] of [["host", host], ["guest", guest]]) {
    await p.setViewport({ width: 1300, height: 860 });
    p.on("pageerror", e => errors.push(name + " pageerror: " + e.message));
    p.on("console", m => { if (m.type() === "error") errors.push(name + " console: " + m.text()); });
  }
  await wire(host, "user-host");
  await wire(guest, "user-friend");
  await host.goto(url, { waitUntil: "load" });
  await new Promise(r => setTimeout(r, 800));
  const note = await host.$eval("#online-note", e => e.textContent);
  console.log("host online note:", note.slice(0, 60));
  await host.select("#seat-calder", "remote");
  await host.select("#opt-speed", "fast");
  await host.click('[data-act="start"]');
  try {
    await host.waitForFunction(() => { const b = document.querySelector("#netinfo .code"); return b && b.textContent.length === 4; }, { timeout: 10000 });
  } catch (e) {
    console.log("host did not show a code. errors:", errors, "netinfo:", await host.$eval("#netinfo", e => e.outerHTML), "game hidden:", await host.$eval("#game", e => e.hidden));
    await browser.close();
    return;
  }
  const code = await host.$eval("#netinfo .code", e => e.textContent);
  console.log("game code", code);
  await new Promise(r => setTimeout(r, 600));
  await guest.goto(url, { waitUntil: "load" });
  await guest.waitForSelector('[data-act="joinClaude"]', { timeout: 10000 });
  await guest.screenshot({ path: path.join(__dirname, "shots", "8-claude-join.png") });
  await guest.click('[data-act="joinClaude"]');
  await guest.waitForSelector('[data-act="claimSeat"]', { timeout: 10000 });
  await guest.click('[data-act="claimSeat"]');
  await guest.waitForFunction(() => !document.getElementById("game").hidden && document.getElementById("lobby").hidden, { timeout: 10000 });
  console.log("guest seat:", (await guest.$eval("#seat", e => e.textContent)).trim());
  const counts = { host: {}, guest: {} };
  let over = false;
  let idle = 0;
  for (let i = 0; i < 6000 && !over; i++) {
    let moved = false;
    for (const [name, page] of [["host", host], ["guest", guest]]) {
      const r = await page.evaluate(driverStep);
      counts[name][r] = (counts[name][r] || 0) + 1;
      if (r === "over") {
        over = true;
      }
      if (r !== "wait" && r !== "over") {
        moved = true;
      }
    }
    if (!moved) {
      idle++;
      await new Promise(r => setTimeout(r, 150));
      if (idle > 300) {
        errors.push("idle too long. host: " + (await host.$eval("#prompt", e => e.innerText)).slice(0, 150) + " || guest: " + (await guest.$eval("#prompt", e => e.innerText)).slice(0, 150));
        break;
      }
    } else {
      idle = 0;
      await new Promise(r => setTimeout(r, 120));
    }
  }
  console.log("guest steps", counts.guest);
  console.log("host end:", (await host.$eval("#prompt", e => e.innerText)).slice(0, 110).replace(/\n/g, " | "));
  console.log("guest end:", (await guest.$eval("#prompt", e => e.innerText)).slice(0, 110).replace(/\n/g, " | "));
  const doc = JSON.parse(store.get("games/" + code));
  console.log("stored game doc bytes", store.get("games/" + code).length, "seats", doc.seats);
  console.log("errors", errors.length);
  errors.slice(0, 10).forEach(e => console.log("  ", e));
  await browser.close();
})();
