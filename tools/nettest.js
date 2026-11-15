const puppeteer = require("puppeteer-core");
const path = require("path");
const driverStep = require("./driver.js");
const url = process.argv[2] || "http://localhost:8765/";
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const ctxA = await browser.createBrowserContext();
  const ctxB = await browser.createBrowserContext();
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();
  for (const p of [host, guest]) {
    await p.setViewport({ width: 1300, height: 860 });
  }
  const errors = [];
  host.on("pageerror", e => errors.push("host pageerror: " + e.message));
  guest.on("pageerror", e => errors.push("guest pageerror: " + e.message));
  host.on("console", m => { if (m.type() === "error") errors.push("host console: " + m.text()); });
  guest.on("console", m => { if (m.type() === "error") errors.push("guest console: " + m.text()); });
  await host.goto(url, { waitUntil: "networkidle2" });
  await host.waitForFunction(() => typeof Peer !== "undefined", { timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));
  await host.select("#seat-calder", "remote");
  await host.select("#opt-speed", "fast");
  await host.click('[data-act="start"]');
  await host.waitForFunction(() => { const b = document.querySelector("#netinfo .code"); return b && b.textContent.length === 4; }, { timeout: 15000 });
  const code = await host.$eval("#netinfo .code", e => e.textContent);
  console.log("room code", code);
  await new Promise(r => setTimeout(r, 2500));
  await guest.goto(url, { waitUntil: "networkidle2" });
  await guest.waitForFunction(() => !!document.getElementById("join-code"), { timeout: 15000 });
  await guest.type("#join-code", code);
  await guest.click('[data-act="joinPeer"]');
  await guest.waitForFunction(() => !document.getElementById("game").hidden, { timeout: 30000 });
  const seat = await guest.$eval("#seat", e => e.textContent);
  console.log("guest seat:", seat.trim());
  await guest.screenshot({ path: path.join(__dirname, "shots", "6-guest.png") });
  await host.screenshot({ path: path.join(__dirname, "shots", "6-host.png") });
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
      if (r.indexOf("stuck") === 0) {
        errors.push(name + " " + r + ": " + (await page.$eval("#prompt", e => e.innerText)).slice(0, 200));
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
      await new Promise(r => setTimeout(r, 60));
    }
  }
  const hostEnd = await host.$eval("#prompt", e => e.innerText);
  const guestEnd = await guest.$eval("#prompt", e => e.innerText);
  console.log("host steps", counts.host);
  console.log("guest steps", counts.guest);
  console.log("host end:", hostEnd.slice(0, 120).replace(/\n/g, " | "));
  console.log("guest end:", guestEnd.slice(0, 120).replace(/\n/g, " | "));
  await guest.screenshot({ path: path.join(__dirname, "shots", "7-guest-end.png") });
  console.log("errors", errors.length);
  errors.slice(0, 12).forEach(e => console.log("  ", e));
  await browser.close();
})();
