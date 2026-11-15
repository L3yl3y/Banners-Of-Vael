var RULES = (function () {
  var HOUSES = {
    thorne: { id: "thorne", name: "House Thorne", short: "Thorne", seat: "Thornhold", motto: "We Hold The Briar", colour: "#7a3b69" },
    calder: { id: "calder", name: "House Calder", short: "Calder", seat: "Saltcrest", motto: "The Tide Returns", colour: "#1f7a7a" },
    vantar: { id: "vantar", name: "House Vantar", short: "Vantar", seat: "Sunhallow", motto: "Gold Before Iron", colour: "#b8862b" }
  };

  var HOUSE_ORDER = ["thorne", "calder", "vantar"];

  var START = {
    thorne: {
      units: { thornhold: ["knight", "footman"], greyvale: ["footman"], briarwood: ["footman"], frostmere: ["ship"] },
      power: 5
    },
    calder: {
      units: { saltcrest: ["knight", "footman"], tidegate: ["footman"], kestrelsound: ["ship"], saltsound: ["ship"] },
      power: 5
    },
    vantar: {
      units: { sunhallow: ["knight", "footman"], vineholm: ["footman"], redfield: ["footman"], sunlitsea: ["ship"] },
      power: 5
    }
  };

  var START_TRACKS = {
    crown: ["vantar", "thorne", "calder"],
    sword: ["thorne", "calder", "vantar"],
    court: ["calder", "vantar", "thorne"]
  };

  var TRACK_NAMES = { crown: "Crown", sword: "Sword", court: "Court" };
  var TOKEN_NAMES = { crown: "The Ember Crown", sword: "The Starsteel Blade", court: "The Messenger Hawk" };

  var STAR_LIMITS = [3, 3, 2];

  var SUPPLY_TABLE = [
    [2, 2],
    [3, 2],
    [3, 2, 2],
    [3, 2, 2, 2],
    [3, 3, 2, 2],
    [4, 3, 2, 2],
    [4, 3, 2, 2, 2]
  ];

  var UNIT_POOL = { footman: 10, knight: 5, ship: 6, siege: 2 };
  var UNIT_NAMES = { footman: "Footman", knight: "Knight", ship: "Ship", siege: "Siege Engine" };
  var POWER_TOTAL = 20;
  var VICTORY_CASTLES = 7;
  var LAST_ROUND = 10;

  var ORDERS = [
    { id: "m-1", kind: "march", bonus: -1, star: false, label: "March -1" },
    { id: "m0", kind: "march", bonus: 0, star: false, label: "March +0" },
    { id: "m1", kind: "march", bonus: 1, star: true, label: "March +1" },
    { id: "d1a", kind: "defence", bonus: 1, star: false, label: "Defence +1" },
    { id: "d1b", kind: "defence", bonus: 1, star: false, label: "Defence +1" },
    { id: "d2", kind: "defence", bonus: 2, star: true, label: "Defence +2" },
    { id: "s0a", kind: "support", bonus: 0, star: false, label: "Support +0" },
    { id: "s0b", kind: "support", bonus: 0, star: false, label: "Support +0" },
    { id: "s1", kind: "support", bonus: 1, star: true, label: "Support +1" },
    { id: "ra", kind: "raid", bonus: 0, star: false, label: "Raid" },
    { id: "rb", kind: "raid", bonus: 0, star: false, label: "Raid" },
    { id: "r1", kind: "raid", bonus: 0, star: true, label: "Raid ★" },
    { id: "ca", kind: "consolidate", bonus: 0, star: false, label: "Consolidate Power" },
    { id: "cb", kind: "consolidate", bonus: 0, star: false, label: "Consolidate Power" },
    { id: "c1", kind: "consolidate", bonus: 0, star: true, label: "Consolidate Power ★" }
  ];

  var ORDER_HELP = {
    march: "Move units out of this area into adjacent areas. Entering an enemy area starts a battle. The number is added to your strength when you attack.",
    defence: "Adds its bonus to your strength if this area is attacked.",
    support: "Lends the strength of these units to a battle in an adjacent area. Ships can support land battles; land units cannot support at sea.",
    raid: "Removes an adjacent enemy Support, Raid or Consolidate Power order. The starred raid can also remove a Defence order. Raiding Consolidate Power steals 1 power.",
    consolidate: "Gain 1 power, plus 1 for each crown in this area. The starred order in a castle or stronghold may muster there instead."
  };

  var LEADERS = {
    thorne: [
      { id: "t4", name: "Aldric Thorne", title: "Lord Of Thornwood", strength: 4, swords: 1, forts: 0, ability: null, text: "" },
      { id: "t3", name: "Maren Thorne", title: "The Briar Queen", strength: 3, swords: 0, forts: 1, ability: "defendPlusOne", text: "If you are defending, gain +1 strength." },
      { id: "t2a", name: "Sir Hollis Vane", title: "Master Of The Hunt", strength: 2, swords: 1, forts: 0, ability: "extraKill", text: "If you win, your opponent destroys 1 additional unit." },
      { id: "t2b", name: "Wren Of The Hollows", title: "The Huntress", strength: 2, swords: 0, forts: 1, ability: "ignoreDefence", text: "If you are attacking, ignore your opponent's Defence order." },
      { id: "t1a", name: "Old Gorran", title: "Keeper Of The Pass", strength: 1, swords: 1, forts: 1, ability: "ignoreMarch", text: "If you are defending, the attacker's March +1 bonus is ignored." },
      { id: "t1b", name: "Brother Ivo", title: "The Grey Abbot", strength: 1, swords: 0, forts: 0, ability: "winPowerTwo", text: "If you win, gain 2 power tokens." },
      { id: "t0", name: "Little Tamsin", title: "The Runner", strength: 0, swords: 0, forts: 0, ability: "loseReturn", text: "If you lose, return this card to your hand after the battle." }
    ],
    calder: [
      { id: "c4", name: "Rhosyn Calder", title: "Admiral Of Saltcrest", strength: 4, swords: 1, forts: 0, ability: "seaPlusOne", text: "If this battle is at sea, gain +1 strength." },
      { id: "c3", name: "Corin Calder", title: "The Tidecaller", strength: 3, swords: 1, forts: 0, ability: "ignoreSupport", text: "All support given to your opponent by other houses is ignored." },
      { id: "c2a", name: "Sela Saltborn", title: "The Reaver", strength: 2, swords: 2, forts: 0, ability: null, text: "" },
      { id: "c2b", name: "Captain Dunmore", title: "Warden Of The Sound", strength: 2, swords: 0, forts: 1, ability: "plusPerSupport", text: "Gain +1 strength for each area that supports you." },
      { id: "c1a", name: "Mother Gull", title: "The Wise Woman", strength: 1, swords: 0, forts: 1, ability: "winDiscardRandom", text: "If you win, your opponent discards a random leader card from their hand." },
      { id: "c1b", name: "Fenn The Smuggler", title: "Friend To None", strength: 1, swords: 1, forts: 0, ability: "cancelText", text: "Cancel the text of your opponent's leader card." },
      { id: "c0", name: "Nell Of The Nets", title: "The Fisher Girl", strength: 0, swords: 0, forts: 0, ability: "losePowerReturn", text: "If you lose, gain 1 power token and return this card to your hand." }
    ],
    vantar: [
      { id: "v4", name: "Cassius Vantar", title: "Lord Of Sunhallow", strength: 4, swords: 2, forts: 0, ability: null, text: "" },
      { id: "v3", name: "Iselde Vantar", title: "The Golden Lady", strength: 3, swords: 0, forts: 1, ability: "winStealPower", text: "If you win, your opponent loses 1 power token and you gain 1." },
      { id: "v2a", name: "Sir Bastian Roe", title: "Captain Of Lances", strength: 2, swords: 1, forts: 0, ability: "plusPerKnight", text: "Gain +1 strength for each of your Knights in this battle (at most +2)." },
      { id: "v2b", name: "Marshal Odo", title: "Keeper Of Walls", strength: 2, swords: 0, forts: 2, ability: "castleDefend", text: "If you are defending a castle or stronghold, gain +1 strength." },
      { id: "v1a", name: "Ysolde The Seer", title: "Reader Of Stars", strength: 1, swords: 0, forts: 0, ability: "underdog", text: "If your opponent's leader has a higher printed strength, gain +2 strength." },
      { id: "v1b", name: "Pip Merriweather", title: "The Lucky", strength: 1, swords: 1, forts: 0, ability: "winTies", text: "You win this battle if the strengths are tied." },
      { id: "v0", name: "The Grey Steward", title: "Voice Of Caution", strength: 0, swords: 0, forts: 0, ability: "noCasualties", text: "If you lose, you suffer no casualties." }
    ]
  };

  var EVENT_DECKS = {
    I: [
      { id: "harvest", name: "Harvest Count", count: 3, horde: [1, 0, 0], text: "Every house sets its supply to the barrels it controls, then removes units that break the new limits." },
      { id: "muster", name: "Call To Arms", count: 3, horde: [0, 1, 0], text: "Every house musters new units in the castles and strongholds it controls." },
      { id: "decree", name: "The Crown's Decree", count: 2, horde: [1, 1], text: "The Crown holder chooses: Harvest Count, Call To Arms, or nothing." },
      { id: "quiet1", name: "A Quiet Season", count: 1, horde: [1], text: "Nothing happens. The horde stirs." },
      { id: "turning1", name: "The Turning Year", count: 1, horde: [0], text: "Shuffle this deck and draw again." }
    ],
    II: [
      { id: "contest", name: "Contest Of Influence", count: 3, horde: [0, 0, 1], text: "Houses bid power in secret for each influence track: Crown, Sword, then Court." },
      { id: "tribute", name: "Tribute", count: 3, horde: [0, 1, 0], text: "Every house gains 1 power for each crown in the areas it controls." },
      { id: "whispers", name: "Whispers At Court", count: 2, horde: [1, 1], text: "The Hawk holder chooses: Contest Of Influence, Tribute, or nothing." },
      { id: "quiet2", name: "A Quiet Season", count: 1, horde: [1], text: "Nothing happens. The horde stirs." },
      { id: "turning2", name: "The Turning Year", count: 1, horde: [0], text: "Shuffle this deck and draw again." }
    ],
    III: [
      { id: "assault", name: "The Horde Assaults", count: 3, horde: [0, 0, 0], text: "The horde attacks the Ember Gate at its current strength." },
      { id: "storms", name: "Storm Season", count: 1, horde: [1], text: "No Raid orders may be placed this round.", restrict: "noRaid" },
      { id: "mud", name: "Mud Season", count: 1, horde: [1], text: "The March +1 order may not be placed this round.", restrict: "noMarchPlus" },
      { id: "lean", name: "Lean Harvest", count: 1, horde: [1], text: "No Consolidate Power orders may be placed this round.", restrict: "noConsolidate" },
      { id: "oaths", name: "Broken Oaths", count: 1, horde: [0], text: "No Support orders may be placed this round.", restrict: "noSupport" },
      { id: "fury", name: "Reckless Fury", count: 1, horde: [0], text: "No Defence orders may be placed this round.", restrict: "noDefence" },
      { id: "bladechoice", name: "The Blade's Choice", count: 2, horde: [0, 1], text: "The Blade holder chooses: no Defence orders, no March +1, or no restriction." }
    ]
  };

  var HORDE_CARDS = [
    { id: "burning", name: "The Burning Tide", win: "The highest bidder takes back every discarded leader card.", lowest: "The lowest bidder destroys 2 of their units.", others: "Every other house destroys 1 unit." },
    { id: "witch", name: "The Ash Witch", win: "The highest bidder gets back the power they bid.", lowest: "The lowest bidder loses all available power.", others: "Every other house loses 2 power." },
    { id: "gate", name: "Gatebreakers", win: "The highest bidder moves to the top of one influence track of their choice.", lowest: "The lowest bidder drops to the bottom of the Sword and Court tracks.", others: "Every other house loses 1 power." },
    { id: "famine", name: "The Famine March", win: "The highest bidder raises their supply by 1.", lowest: "The lowest bidder lowers their supply by 2.", others: "Every other house lowers their supply by 1." },
    { id: "oathbreakers", name: "The Oathbreakers", win: "The highest bidder gains 3 power.", lowest: "The lowest bidder discards 2 leader cards from their hand (keeping at least 1).", others: "Every other house discards 1 leader card (keeping at least 1)." },
    { id: "empty", name: "Empty Villages", win: "The highest bidder gains 1 power.", lowest: "The horde finds nothing worth taking. Nothing happens.", others: "Nothing happens." },
    { id: "bones", name: "The Bone Hunters", win: "The highest bidder may upgrade one Footman to a Knight for free.", lowest: "The lowest bidder downgrades 2 Knights to Footmen.", others: "Every other house downgrades 1 Knight to a Footman." },
    { id: "warlord", name: "The Warlord Ascends", win: "The highest bidder musters 2 points of units in their home stronghold.", lowest: "The lowest bidder destroys 2 units and loses 2 power.", others: "Every other house destroys 1 unit." }
  ];

  return {
    HOUSES: HOUSES,
    HOUSE_ORDER: HOUSE_ORDER,
    START: START,
    START_TRACKS: START_TRACKS,
    TRACK_NAMES: TRACK_NAMES,
    TOKEN_NAMES: TOKEN_NAMES,
    STAR_LIMITS: STAR_LIMITS,
    SUPPLY_TABLE: SUPPLY_TABLE,
    UNIT_POOL: UNIT_POOL,
    UNIT_NAMES: UNIT_NAMES,
    POWER_TOTAL: POWER_TOTAL,
    VICTORY_CASTLES: VICTORY_CASTLES,
    LAST_ROUND: LAST_ROUND,
    ORDERS: ORDERS,
    ORDER_HELP: ORDER_HELP,
    LEADERS: LEADERS,
    EVENT_DECKS: EVENT_DECKS,
    HORDE_CARDS: HORDE_CARDS
  };
})();
if (typeof module !== "undefined") {
  module.exports = RULES;
}
