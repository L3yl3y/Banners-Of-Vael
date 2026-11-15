var MAPVIEW = (function () {
  var E = ENGINE;
  var R = E.RULES;
  var MAP = E.MAP;
  var NS = "http://www.w3.org/2000/svg";

  var HOUSE_FILL = { thorne: "#9b4f8f", calder: "#2f9e93", vantar: "#dba53c" };
  var HOUSE_DARK = { thorne: "#4d1f47", calder: "#114a45", vantar: "#6b4a10" };

  function pathFrom(points) {
    var d = "M" + points[0][0] + " " + points[0][1];
    for (var i = 1; i < points.length; i++) {
      d += "L" + points[i][0] + " " + points[i][1];
    }
    return d + "Z";
  }

  function smoothLine(points) {
    if (points.length < 3) {
      return "M" + points.map(function (p) {
        return p.join(" ");
      }).join("L");
    }
    var d = "M" + points[0][0] + " " + points[0][1];
    for (var i = 1; i < points.length - 1; i++) {
      var mx = (points[i][0] + points[i + 1][0]) / 2;
      var my = (points[i][1] + points[i + 1][1]) / 2;
      d += "Q" + points[i][0] + " " + points[i][1] + " " + mx.toFixed(1) + " " + my.toFixed(1);
    }
    var last = points[points.length - 1];
    d += "L" + last[0] + " " + last[1];
    return d;
  }

  function flowerPath(cx, cy, r) {
    var d = "";
    for (var k = 0; k < 5; k++) {
      var a = (Math.PI * 2 * k) / 5 - Math.PI / 2;
      var px = cx + Math.cos(a) * r * 0.55;
      var py = cy + Math.sin(a) * r * 0.55;
      d += "M" + (px + r * 0.42).toFixed(2) + " " + py.toFixed(2) + "a" + (r * 0.42).toFixed(2) + " " + (r * 0.42).toFixed(2) + " 0 1 0 " + (-r * 0.84).toFixed(2) + " 0a" + (r * 0.42).toFixed(2) + " " + (r * 0.42).toFixed(2) + " 0 1 0 " + (r * 0.84).toFixed(2) + " 0";
    }
    return d;
  }

  function sunRays(cx, cy, r1, r2, n) {
    var d = "";
    for (var k = 0; k < n; k++) {
      var a = (Math.PI * 2 * k) / n;
      d += "M" + (cx + Math.cos(a) * r1).toFixed(2) + " " + (cy + Math.sin(a) * r1).toFixed(2) + "L" + (cx + Math.cos(a) * r2).toFixed(2) + " " + (cy + Math.sin(a) * r2).toFixed(2);
    }
    return d;
  }

  function emblem(h, colour) {
    if (h === "thorne") {
      return '<path d="' + flowerPath(12, 12, 8) + '" fill="' + colour + '"/><circle cx="12" cy="12" r="2.6" fill="' + HOUSE_DARK.thorne + '"/>';
    }
    if (h === "calder") {
      return '<path d="M4 10c2.7-3 5.3-3 8 0s5.3 3 8 0M4 15.5c2.7-3 5.3-3 8 0s5.3 3 8 0" fill="none" stroke="' + colour + '" stroke-width="2.4" stroke-linecap="round"/>';
    }
    return '<circle cx="12" cy="12" r="4.6" fill="' + colour + '"/><path d="' + sunRays(12, 12, 6.6, 9.6, 8) + '" stroke="' + colour + '" stroke-width="2" stroke-linecap="round"/>';
  }

  var UNIT_ICONS = {
    footman: '<path d="M12 4.5l6 2.4v4.6c0 3.6-2.6 6.2-6 7.8-3.4-1.6-6-4.2-6-7.8V6.9z" fill="currentColor"/>',
    knight: '<path d="M8 19.5h9.5c.3-3.5-.6-6.5-2.6-9.2l1.4-3.6-3 1.2C11.6 6.4 10 5.9 8.6 6.6l.6 1.6-3.2 3.4.9 1.7 2.4-.8c.6 1.2.4 2.4-.6 3.8z" fill="currentColor"/>',
    ship: '<path d="M4 14.5h16l-2.6 4.6H6.6z" fill="currentColor"/><path d="M12.6 4.2v9.2h5.6z" fill="currentColor"/><path d="M11.4 6.2v7.2H7.2z" fill="currentColor" opacity=".8"/>',
    siege: '<path d="M5 19.5h14M7.5 19.5L12 9l4.5 10.5M12 9l6.5-5M5.6 13.6L12 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="18.6" cy="4.2" r="1.8" fill="currentColor"/>'
  };

  var ORDER_ICONS = {
    march: '<path d="M5.5 12h11M12.5 7.5L17 12l-4.5 4.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    defence: '<path d="M12 5l5.5 2.2v4.3c0 3.3-2.3 5.6-5.5 7-3.2-1.4-5.5-3.7-5.5-7V7.2z" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    support: '<path d="M12 6.5v11M6.5 12h11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    raid: '<path d="M12 4.8c.6 3.2 4.6 4.8 4.6 9 0 2.8-2.1 5-4.6 5s-4.6-2.2-4.6-5c0-2 1-3.2 2-4.2.2 1.4.8 2.2 1.6 2.6-.4-2.8.2-5.4 1-7.4z" fill="currentColor"/>',
    consolidate: '<path d="M5.5 16.5h13l1-8-4 3-3.5-5.2L8.5 11.5l-4-3z" fill="currentColor"/>'
  };

  function castleIcon(x, y, size) {
    if (size === 2) {
      return '<g transform="translate(' + (x - 13) + "," + (y - 13) + ')" class="castle-icon"><path d="M2 24V9h4V5h3v4h2V3h4v6h2V5h3v4h4v15z" fill="#3b2d1e"/><path d="M11 24v-6a2 2 0 0 1 4 0v6z" fill="#e8dbb8"/><path d="M2 9h4M20 9h4" stroke="#3b2d1e" stroke-width="2"/></g>';
    }
    return '<g transform="translate(' + (x - 9) + "," + (y - 11) + ')" class="castle-icon"><path d="M2 20V7h3V4h3v3h2V4h3v3h3v13z" fill="#3b2d1e"/><path d="M7.5 20v-4a1.5 1.5 0 0 1 3 0v4z" fill="#e8dbb8"/></g>';
  }

  function barrelIcon(x, y) {
    return '<g transform="translate(' + (x - 5) + "," + (y - 6) + ')"><rect x="0.5" y="0.5" width="9" height="11" rx="3.5" fill="#7a5530" stroke="#3b2d1e" stroke-width="1"/><path d="M0.8 4h8.4M0.8 8h8.4" stroke="#3b2d1e" stroke-width="1"/></g>';
  }

  function crownIcon(x, y) {
    return '<g transform="translate(' + (x - 6) + "," + (y - 5) + ')"><path d="M0.5 9.5h11l.6-7-3.2 2.4L6 0.6 3.1 4.9 0 2.5z" fill="#c9962b" stroke="#5c3f0c" stroke-width="0.9" stroke-linejoin="round"/></g>';
  }

  function defs() {
    var s = "<defs>";
    s += '<pattern id="waves" width="60" height="26" patternUnits="userSpaceOnUse"><path d="M0 13c7.5-6 15-6 22.5 0s15 6 22.5 0" fill="none" stroke="#7fb0c4" stroke-opacity=".13" stroke-width="1.4"/></pattern>';
    s += '<pattern id="vellum" width="140" height="140" patternUnits="userSpaceOnUse"><rect width="140" height="140" fill="#e8dbb8"/><circle cx="30" cy="40" r="26" fill="#d8c79e" opacity=".25"/><circle cx="104" cy="96" r="34" fill="#f2e8cc" opacity=".35"/><circle cx="90" cy="20" r="12" fill="#cfbb8e" opacity=".18"/></pattern>';
    s += '<radialGradient id="seaGlow" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2f566c"/><stop offset="1" stop-color="#172c3a"/></radialGradient>';
    s += '<linearGradient id="waste" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0f13"/><stop offset="1" stop-color="#2a1c17"/></linearGradient>';
    s += '<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>';
    s += '<filter id="lift" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#000" flood-opacity=".55"/></filter>';
    Object.keys(UNIT_ICONS).forEach(function (k) {
      s += '<symbol id="un-' + k + '" viewBox="0 0 24 24">' + UNIT_ICONS[k] + "</symbol>";
    });
    Object.keys(ORDER_ICONS).forEach(function (k) {
      s += '<symbol id="or-' + k + '" viewBox="0 0 24 24">' + ORDER_ICONS[k] + "</symbol>";
    });
    s += "</defs>";
    return s;
  }

  function baseLayer() {
    var s = "";
    s += '<rect x="0" y="0" width="1200" height="900" fill="url(#seaGlow)"/>';
    s += '<rect x="0" y="0" width="1200" height="900" fill="url(#waves)"/>';
    MAP.areas.forEach(function (a) {
      if (a.type === "sea") {
        s += '<path d="' + pathFrom(a.poly) + '" fill="transparent"/>';
      }
    });
    var coast = "";
    MAP.edges.forEach(function (e) {
      if (e.kind === "coast") {
        coast += smoothLine(e.points);
      }
    });
    s += '<path d="' + coast + '" fill="none" stroke="#8fc3cf" stroke-opacity=".35" stroke-width="14" filter="url(#soft)"/>';
    MAP.areas.forEach(function (a) {
      if (a.type === "land") {
        s += '<path d="' + pathFrom(a.poly) + '" fill="url(#vellum)" stroke="url(#vellum)" stroke-width="1.5"/>';
      }
    });
    return s;
  }

  function lineLayer() {
    var s = "";
    var borders = "";
    var seaBorders = "";
    var coast = "";
    MAP.edges.forEach(function (e) {
      if (e.kind === "border") {
        borders += smoothLine(e.points);
      } else if (e.kind === "seaborder") {
        seaBorders += smoothLine(e.points);
      } else {
        coast += smoothLine(e.points);
      }
    });
    s += '<path d="' + seaBorders + '" fill="none" stroke="#a9d2dc" stroke-opacity=".32" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round"/>';
    s += '<path d="' + borders + '" fill="none" stroke="#6b5233" stroke-opacity=".75" stroke-width="1.6" stroke-dasharray="7 4 1.5 4"/>';
    s += '<path d="' + coast + '" fill="none" stroke="#2b1f14" stroke-width="2.6" stroke-linejoin="round"/>';
    s += '<rect x="0" y="0" width="1200" height="60" fill="url(#waste)"/>';
    var wall = "M0 60";
    for (var x = 0; x <= 1200; x += 24) {
      wall += "H" + x + "V54H" + (x + 12) + "V60";
    }
    s += '<path d="' + wall + 'H1200" fill="none" stroke="#a87a52" stroke-width="2.4"/>';
    s += '<text x="600" y="24" class="map-gate">THE EMBER GATE</text>';
    s += '<text x="600" y="44" class="map-waste">beyond lies the Cinderwaste, where the horde gathers</text>';
    return s;
  }

  function labelLayer() {
    var s = "";
    MAP.areas.forEach(function (a) {
      var lx = a.x;
      var ly = a.y - 26;
      if (a.type === "sea") {
        s += '<text x="' + lx + '" y="' + ly + '" class="map-sea">' + a.name + "</text>";
        return;
      }
      var nameClass = "map-land";
      if (a.castle === 2) {
        nameClass += " strong";
      }
      s += '<text x="' + lx + '" y="' + ly + '" class="' + nameClass + '">' + a.name.toUpperCase() + "</text>";
      var icons = [];
      if (a.castle > 0) {
        icons.push({ k: "castle" });
      }
      for (var b = 0; b < a.barrels; b++) {
        icons.push({ k: "barrel" });
      }
      for (var c = 0; c < a.crowns; c++) {
        icons.push({ k: "crown" });
      }
      var width = 0;
      icons.forEach(function (ic) {
        if (ic.k === "castle") {
          if (a.castle === 2) {
            ic.w = 28;
          } else {
            ic.w = 20;
          }
        } else {
          ic.w = 14;
        }
        width += ic.w;
      });
      var cx = lx - width / 2;
      var iy = ly + 15;
      icons.forEach(function (ic) {
        var mid = cx + ic.w / 2;
        if (ic.k === "castle") {
          s += castleIcon(mid, iy, a.castle);
        } else if (ic.k === "barrel") {
          s += barrelIcon(mid, iy);
        } else {
          s += crownIcon(mid, iy);
        }
        cx += ic.w;
      });
    });
    return s;
  }

  var svg = null;
  var layers = {};
  var handlers = { click: null, hover: null };

  function mount(container) {
    var html = '<svg id="board" viewBox="0 0 1200 900" xmlns="' + NS + '" role="img" aria-label="Map of Vael">';
    html += defs();
    html += '<g id="lyr-base">' + baseLayer() + "</g>";
    html += '<g id="lyr-tint"></g>';
    html += '<g id="lyr-lines">' + lineLayer() + "</g>";
    html += '<g id="lyr-labels">' + labelLayer() + "</g>";
    html += '<g id="lyr-tokens"></g>';
    html += '<g id="lyr-units"></g>';
    html += '<g id="lyr-orders"></g>';
    html += '<g id="lyr-hl"></g>';
    html += '<g id="lyr-hit">';
    MAP.areas.forEach(function (a) {
      html += '<path class="hit" data-area="' + a.id + '" d="' + pathFrom(a.poly) + '"><title>' + a.name + "</title></path>";
    });
    html += "</g></svg>";
    container.innerHTML = html;
    svg = container.querySelector("svg");
    ["tint", "tokens", "units", "orders", "hl"].forEach(function (k) {
      layers[k] = svg.querySelector("#lyr-" + k);
    });
    svg.querySelector("#lyr-hit").addEventListener("click", function (ev) {
      var target = ev.target.closest("[data-area]");
      if (target && handlers.click) {
        handlers.click(target.getAttribute("data-area"));
      }
    });
    svg.querySelector("#lyr-hit").addEventListener("mousemove", function (ev) {
      var target = ev.target.closest("[data-area]");
      if (handlers.hover) {
        if (target) {
          handlers.hover(target.getAttribute("data-area"), ev);
        } else {
          handlers.hover(null, ev);
        }
      }
    });
    svg.querySelector("#lyr-hit").addEventListener("mouseleave", function (ev) {
      if (handlers.hover) {
        handlers.hover(null, ev);
      }
    });
  }

  function unitToken(u, x, y) {
    var fill = HOUSE_FILL[u.h];
    var cls = "unit";
    if (u.r) {
      cls += " routed";
    }
    var s = '<g class="' + cls + '" transform="translate(' + x + "," + y + ') scale(1.14)" filter="url(#lift)">';
    if (u.t === "ship") {
      s += '<path d="M-12 -8h24l-4 16h-16z" fill="' + fill + '" stroke="' + HOUSE_DARK[u.h] + '" stroke-width="1.6"/>';
    } else if (u.t === "knight") {
      s += '<rect x="-11.5" y="-11.5" width="23" height="23" rx="5" fill="' + fill + '" stroke="' + HOUSE_DARK[u.h] + '" stroke-width="1.6"/>';
    } else if (u.t === "siege") {
      s += '<path d="M0 -12.5L12.5 10H-12.5z" fill="' + fill + '" stroke="' + HOUSE_DARK[u.h] + '" stroke-width="1.6" stroke-linejoin="round"/>';
    } else {
      s += '<circle r="11" fill="' + fill + '" stroke="' + HOUSE_DARK[u.h] + '" stroke-width="1.6"/>';
    }
    var iconY = -9;
    var iconSize = 18;
    if (u.t === "siege") {
      iconY = -6;
      iconSize = 14;
      s += '<use href="#un-siege" x="' + (-iconSize / 2) + '" y="' + iconY + '" width="' + iconSize + '" height="' + iconSize + '" style="color:#fbf4e2"/>';
    } else {
      s += '<use href="#un-' + u.t + '" x="-9" y="' + iconY + '" width="' + iconSize + '" height="' + iconSize + '" style="color:#fbf4e2"/>';
    }
    s += "</g>";
    return s;
  }

  function orderToken(order, x, y, faceDown, extraClass) {
    var h = order.h;
    var s = '<g class="order ' + (extraClass || "") + '" transform="translate(' + x + "," + y + ')" filter="url(#lift)">';
    if (faceDown) {
      s += '<circle r="13" fill="' + HOUSE_DARK[h] + '" stroke="#f1e4c4" stroke-width="1.4"/>';
      s += '<use href="#em-' + h + '" x="-9" y="-9" width="18" height="18"/>';
      s += "</g>";
      return s;
    }
    var o = E.ORDER_BY_ID[order.id];
    var ring = "#f1e4c4";
    var ringWidth = 1.6;
    if (o.star) {
      ring = "#f2c14e";
      ringWidth = 2.6;
    }
    s += '<circle r="13.5" fill="#211a14" stroke="' + ring + '" stroke-width="' + ringWidth + '"/>';
    s += '<circle r="10.5" fill="' + HOUSE_DARK[h] + '"/>';
    s += '<use href="#or-' + o.kind + '" x="-8.5" y="-8.5" width="17" height="17" style="color:#fbf1d6"/>';
    if (o.kind === "march" || o.kind === "defence" || o.kind === "support") {
      var label = String(o.bonus);
      if (o.bonus > 0) {
        label = "+" + o.bonus;
      }
      s += '<circle cx="10" cy="10" r="6.4" fill="#f1e4c4" stroke="#211a14" stroke-width="1"/><text x="10" y="12.6" class="order-bonus">' + label + "</text>";
    }
    if (o.star) {
      s += '<path d="M0 -19.5l1.6 3.2 3.5.5-2.5 2.5.6 3.5L0 -11.5l-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z" fill="#f2c14e" stroke="#5c3f0c" stroke-width=".6"/>';
    }
    s += "</g>";
    return s;
  }

  function unitRowPositions(n, cx, cy) {
    var gap = 28;
    var list = [];
    var rows = Math.ceil(n / 4);
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / 4);
      var inRow = Math.min(4, n - row * 4);
      var col = i - row * 4;
      var x = cx - ((inRow - 1) * gap) / 2 + col * gap;
      var y = cy + row * 28 - ((rows - 1) * 28) / 2;
      list.push([x, y]);
    }
    return list;
  }

  function render(state, view) {
    var tint = "";
    MAP.areas.forEach(function (a) {
      if (a.type !== "land") {
        return;
      }
      var ctrl = E.controller(state, a.id);
      if (ctrl) {
        tint += '<path d="' + pathFrom(a.poly) + '" fill="' + HOUSE_FILL[ctrl] + '" fill-opacity=".3"/>';
      }
    });
    layers.tint.innerHTML = tint;

    var tokens = "";
    var units = "";
    var orders = "";
    MAP.areas.forEach(function (a) {
      var area = state.areas[a.id];
      var baseY = a.y + 14;
      if (a.type === "land" && (a.castle > 0 || a.barrels > 0 || a.crowns > 0)) {
        baseY = a.y + 20;
      }
      if (a.type === "sea") {
        baseY = a.y + 2;
      }
      var list = area.units.slice();
      var positions = unitRowPositions(list.length, a.x, baseY);
      list.forEach(function (u, i) {
        units += unitToken(u, positions[i][0], positions[i][1]);
      });
      var tokenY = baseY + 28 + Math.max(0, Math.ceil(list.length / 4) - 1) * 12;
      if (area.neutral > 0) {
        tokens += '<g class="neutral" transform="translate(' + a.x + "," + (baseY) + ')" filter="url(#lift)"><path d="M0 -15L13 -7.5V7.5L0 15L-13 7.5V-7.5z" fill="#55585f" stroke="#1d1f24" stroke-width="1.6"/><text y="5" class="neutral-num">' + area.neutral + '</text></g>';
      }
      if (a.home && area.garrison > 0) {
        var gx = a.x - 44;
        tokens += '<g class="garrison" transform="translate(' + gx + "," + (baseY - 2) + ')" filter="url(#lift)"><path d="M0 -12l9 3.6v6.6c0 5-3.8 8.5-9 10.8-5.2-2.3-9-5.8-9-10.8v-6.6z" fill="' + HOUSE_DARK[a.home] + '" stroke="#f1e4c4" stroke-width="1.3"/><text y="4.6" class="garrison-num">' + area.garrison + "</text></g>";
      }
      if (area.ptoken) {
        var px = a.x + 44;
        tokens += '<g class="ptoken" transform="translate(' + px + "," + (baseY - 2) + ')" filter="url(#lift)"><circle r="10" fill="' + HOUSE_FILL[area.ptoken] + '" stroke="' + HOUSE_DARK[area.ptoken] + '" stroke-width="1.6"/><use href="#em-' + area.ptoken + '" x="-7" y="-7" width="14" height="14"/></g>';
      }
      var shown = null;
      var faceDown = false;
      if (area.order) {
        shown = area.order;
      } else if (view.pendingOrders && view.pendingOrders[a.id]) {
        shown = view.pendingOrders[a.id];
        if (view.pendingOrders[a.id].hidden) {
          faceDown = true;
        }
      }
      if (shown) {
        var extra = "";
        if (view.activeOrder === a.id) {
          extra = "active";
        }
        orders += orderToken(shown, a.x, tokenY, faceDown, extra);
      }
    });
    layers.tokens.innerHTML = tokens;
    layers.units.innerHTML = units;
    layers.orders.innerHTML = orders;

    var hl = "";
    var marks = view.highlights || {};
    Object.keys(marks).forEach(function (id) {
      var a = E.AREA[id];
      hl += '<path class="hl hl-' + marks[id] + '" d="' + pathFrom(a.poly) + '"/>';
    });
    if (state.combat) {
      var ca = E.AREA[state.combat.area];
      hl += '<path class="hl hl-battle" d="' + pathFrom(ca.poly) + '"/>';
    }
    if (view.selected) {
      hl += '<path class="hl hl-selected" d="' + pathFrom(E.AREA[view.selected].poly) + '"/>';
    }
    if (view.arrows) {
      view.arrows.forEach(function (ar) {
        var a1 = E.AREA[ar.from];
        var a2 = E.AREA[ar.to];
        var mx = (a1.x + a2.x) / 2;
        var my = (a1.y + a2.y) / 2 - 30;
        hl += '<path class="move-arrow" d="M' + a1.x + " " + (a1.y + 10) + "Q" + mx + " " + my + " " + a2.x + " " + (a2.y + 10) + '" marker-end="url(#arrowhead)"/>';
      });
    }
    layers.hl.innerHTML = '<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#f2c14e"/></marker></defs>' + hl;
  }

  function onClick(fn) {
    handlers.click = fn;
  }

  function onHover(fn) {
    handlers.hover = fn;
  }

  return {
    mount: mount,
    render: render,
    onClick: onClick,
    onHover: onHover,
    HOUSE_FILL: HOUSE_FILL,
    HOUSE_DARK: HOUSE_DARK,
    emblem: emblem,
    UNIT_ICONS: UNIT_ICONS,
    ORDER_ICONS: ORDER_ICONS,
    orderToken: orderToken,
    unitToken: unitToken
  };
})();
