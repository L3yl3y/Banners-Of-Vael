// Area seeds for the realm of Vael. castle: 0 none, 1 castle, 2 stronghold.
module.exports = {
  box: [0, 60, 1200, 900],
  land: [
    { id: "frostfell", name: "Frostfell", x: 195, y: 125, castle: 0, barrels: 1, crowns: 0 },
    { id: "ashgate", name: "Ashgate", x: 430, y: 118, castle: 1, barrels: 0, crowns: 1, neutral: 5 },
    { id: "cinderfell", name: "Cinderfell", x: 660, y: 125, castle: 0, barrels: 1, crowns: 0 },
    { id: "ravenmoor", name: "Ravenmoor", x: 880, y: 135, castle: 1, barrels: 0, crowns: 1, neutral: 5 },
    { id: "thornhold", name: "Thornhold", x: 300, y: 240, castle: 2, barrels: 1, crowns: 1, home: "thorne", garrison: 2 },
    { id: "greyvale", name: "Greyvale", x: 530, y: 235, castle: 1, barrels: 1, crowns: 0 },
    { id: "hollowmere", name: "Hollowmere", x: 750, y: 255, castle: 1, barrels: 0, crowns: 1, neutral: 5 },
    { id: "stormwatch", name: "Stormwatch", x: 965, y: 260, castle: 1, barrels: 1, crowns: 0, neutral: 4 },
    { id: "briarwood", name: "Briarwood", x: 205, y: 345, castle: 0, barrels: 1, crowns: 0 },
    { id: "fenwick", name: "Fenwick", x: 385, y: 360, castle: 0, barrels: 0, crowns: 1 },
    { id: "highspire", name: "Highspire", x: 630, y: 395, castle: 2, barrels: 0, crowns: 2, neutral: 7 },
    { id: "duskmarsh", name: "Duskmarsh", x: 835, y: 380, castle: 0, barrels: 1, crowns: 0 },
    { id: "saltcrest", name: "Saltcrest", x: 990, y: 440, castle: 2, barrels: 1, crowns: 1, home: "calder", garrison: 2 },
    { id: "gullcliff", name: "Gullcliff", x: 228, y: 490, castle: 1, barrels: 0, crowns: 0 },
    { id: "oldford", name: "Oldford", x: 470, y: 465, castle: 1, barrels: 1, crowns: 0, neutral: 5 },
    { id: "goldmarch", name: "Goldmarch", x: 790, y: 525, castle: 1, barrels: 1, crowns: 0, neutral: 5 },
    { id: "tidegate", name: "Tidegate", x: 960, y: 610, castle: 1, barrels: 1, crowns: 0 },
    { id: "redfield", name: "Redfield", x: 340, y: 575, castle: 0, barrels: 2, crowns: 0 },
    { id: "stonebridge", name: "Stonebridge", x: 590, y: 555, castle: 1, barrels: 0, crowns: 1, neutral: 4 },
    { id: "vineholm", name: "Vineholm", x: 255, y: 690, castle: 1, barrels: 1, crowns: 0 },
    { id: "sunhallow", name: "Sunhallow", x: 465, y: 700, castle: 2, barrels: 1, crowns: 1, home: "vantar", garrison: 2 },
    { id: "amberford", name: "Amberford", x: 640, y: 700, castle: 1, barrels: 0, crowns: 1 },
    { id: "capesorrow", name: "Cape Sorrow", x: 890, y: 680, castle: 0, barrels: 0, crowns: 1 }
  ],
  sea: [
    { id: "frostmere", name: "The Frostmere", x: 50, y: 230 },
    { id: "greyreach", name: "Grey Reach", x: 45, y: 520 },
    { id: "widowsbay", name: "Widow's Bay", x: 170, y: 850 },
    { id: "sunlitsea", name: "Sunlit Sea", x: 520, y: 865 },
    { id: "kingswater", name: "Kingswater", x: 750, y: 670 },
    { id: "amberstrait", name: "Amber Strait", x: 800, y: 865 },
    { id: "saltsound", name: "Saltmarch Sound", x: 1140, y: 760 },
    { id: "kestrelsound", name: "Kestrel Sound", x: 1150, y: 420 },
    { id: "teeth", name: "The Teeth", x: 1140, y: 160 }
  ]
};
