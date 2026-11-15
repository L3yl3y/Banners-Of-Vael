const puppeteer = require("puppeteer-core");
const path = require("path");

const file = process.argv[2] || path.join(__dirname, "..", "docs", "index.html");
const shots = path.join(__dirname, "shots");
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 900);
const maxSteps = Number(process.argv[5] || 4000);

(async () => {
  require("fs").mkdirSync(shots, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => {
    if (m.type() === "error") {
      errors.push("console: " + m.text());
    }
  });
  await page.goto("file://" + file, { waitUntil: "load" });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(shots, "1-lobby.png") });
  await page.select("#opt-speed", "fast");
  if (process.env.SEAT_CALDER) {
    await page.select("#seat-calder", process.env.SEAT_CALDER);
  }
  await page.click('[data-act="start"]');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(shots, "2-first-orders.png") });
  const counts = {};
  let shotMid = false;
  let shotBattle = false;
  let shotMuster = false;
  let idle = 0;
  for (let i = 0; i < maxSteps; i++) {
    const result = await page.evaluate(() => {
      const curtain = document.getElementById("curtain");
      if (!curtain.hidden) {
        document.getElementById("curtain-btn").click();
        return "curtain";
      }
      const prompt = document.getElementById("prompt");
      const q = s => prompt.querySelector(s);
      const click = s => {
        const b = q(s);
        if (b && !b.disabled) {
          b.click();
          return true;
        }
        return false;
      };
      if (q('[data-act="newgame"]')) {
        return "over";
      }
      const pairs = [["suggestOrders", "submitOrders"], ["suggestMuster", "confirmMuster"], ["suggestLeader", "playLeader"], ["suggestBid", "submitBid"]];
      for (const pair of pairs) {
        if (q('[data-act="' + pair[0] + '"]')) {
          click('[data-act="' + pair[0] + '"]');
          if (click('[data-act="' + pair[1] + '"]')) {
            return pair[1];
          }
          return "stuck-" + pair[1];
        }
      }
      if (q('[data-act="suggestMarch"]')) {
        click('[data-act="suggestMarch"]');
        if (click('[data-act="confirmMarch"]')) {
          return "confirmMarch";
        }
        if (click('[data-act="marchBack"]') || true) {
          if (click('[data-act="pickFrom"]') && click('[data-act="confirmMarch"]')) {
            return "marchStay";
          }
        }
        return "stuck-march";
      }
      if (q('[data-act="pickFrom"]')) {
        click('[data-act="pickFrom"]');
        if (click('[data-act="raidTarget"]')) {
          return "raidTarget";
        }
        if (click('[data-act="raidNone"]')) {
          return "raidNone";
        }
        return "stuck-raid";
      }
      if (q('[data-act="toggleCas"]')) {
        const list = prompt.querySelectorAll('[data-act="toggleCas"]:not([disabled])');
        for (const b of list) {
          if (click('[data-act="confirmCas"]')) {
            return "casualties";
          }
          const again = prompt.querySelector('[data-act="toggleCas"][data-idx="' + b.getAttribute("data-idx") + '"]');
          again.click();
        }
        if (click('[data-act="confirmCas"]')) {
          return "casualties";
        }
        return "stuck-cas";
      }
      if (q('[data-act="togglePick"]')) {
        const ids = Array.from(prompt.querySelectorAll('[data-act="togglePick"]')).map(b => [b.getAttribute("data-area"), b.getAttribute("data-idx")]);
        for (const id of ids) {
          if (click('[data-act="confirmPicks"]')) {
            return "picks";
          }
          const b = prompt.querySelector('[data-act="togglePick"][data-area="' + id[0] + '"][data-idx="' + id[1] + '"]');
          if (b) {
            b.click();
          }
        }
        if (click('[data-act="confirmPicks"]')) {
          return "picks";
        }
        if (click('[data-act="skipUpgrade"]')) {
          return "skip";
        }
        return "stuck-picks";
      }
      if (q('[data-act="toggleDiscard"]')) {
        const cards = Array.from(prompt.querySelectorAll('[data-act="toggleDiscard"]')).map(b => b.getAttribute("data-card"));
        for (const c of cards) {
          if (click('[data-act="confirmDiscard"]')) {
            return "discard";
          }
          const b = prompt.querySelector('[data-act="toggleDiscard"][data-card="' + c + '"]');
          b.click();
        }
        if (click('[data-act="confirmDiscard"]')) {
          return "discard";
        }
        return "stuck-discard";
      }
      if (click('[data-act="confirmTieOrder"]')) {
        return "tieOrder";
      }
      const stack = prompt.querySelector(".stack .btn:not([disabled])");
      if (stack) {
        const act = stack.getAttribute("data-act");
        stack.click();
        if (act === "ravenMode") {
          click('[data-act="ravenBack"]');
          click('[data-act="ravenPass"]');
        }
        return "stack-" + act;
      }
      if (click(".btn.primary")) {
        return "primary";
      }
      return "wait";
    });
    counts[result] = (counts[result] || 0) + 1;
    if (result === "over") {
      break;
    }
    if (result.indexOf("stuck") === 0) {
      const html = await page.evaluate(() => document.getElementById("prompt").innerText);
      errors.push("stuck at step " + i + ": " + result + " :: " + html.slice(0, 300));
      if (counts[result] > 3) {
        break;
      }
    }
    if (result === "wait") {
      idle++;
      await new Promise(r => setTimeout(r, 120));
      if (idle > 400) {
        errors.push("waited too long; prompt: " + (await page.evaluate(() => document.getElementById("prompt").innerText)).slice(0, 300));
        break;
      }
    } else {
      idle = 0;
      await new Promise(r => setTimeout(r, 30));
    }
    if (!shotMuster && result === "confirmMuster") {
      shotMuster = true;
    }
    const round = await page.evaluate(() => {
      const now = document.querySelector(".round-track .pip.now");
      if (now) {
        return Number(now.textContent);
      }
      return 0;
    });
    if (!shotMid && round >= 3) {
      shotMid = true;
      await page.screenshot({ path: path.join(shots, "3-round3.png") });
    }
    if (!shotBattle) {
      const hasBattle = await page.evaluate(() => !!document.querySelector("#prompt .battle") && !!document.querySelector('#prompt [data-act="suggestLeader"]'));
      if (hasBattle) {
        shotBattle = true;
        await page.screenshot({ path: path.join(shots, "4-battle.png") });
      }
    }
  }
  await page.screenshot({ path: path.join(shots, "5-end.png") });
  const endText = await page.evaluate(() => document.getElementById("prompt").innerText);
  console.log("steps", counts);
  console.log("end prompt:", endText.slice(0, 200).replace(/\n/g, " | "));
  console.log("errors", errors.length);
  errors.slice(0, 15).forEach(e => console.log("  ", e));
  await browser.close();
})();
