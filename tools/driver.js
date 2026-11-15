module.exports = function driverStep() {
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
    };
