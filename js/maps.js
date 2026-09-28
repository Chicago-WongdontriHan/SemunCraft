// ── MAP LIBRARY ──────────────────────────────────────────────────────────────
// A named map only ever fixes two things: the obstacle layout, and the visual theme it's drawn in
// (RESOURCE_SQUARES, animals and everything else generateMap() places stay exactly as they always have —
// placeResourcesAndExtras in js/themes.js). "Random" regenerates a fresh layout every game, the same as
// every game before this file existed; a curated or custom map lays down the same obstacles every time.
// Single Player's map picker (js/game.js's selectSpMap) and Training's "Save as new map" (js/training.js's
// trainSaveMap) are the two things that read and write this.

// A handful of named layouts, one obstacle list each (board indices, 9x9 only — Single Player's only
// board size). Frozen from the same generator every random map still uses (js/themes.js), not hand-drawn,
// so each is already guaranteed a clear rook path and a clear bishop path between the two king zones.
const CURATED_MAPS=[
  {id:'curated-open-plains',name:'Open Plains',theme:'forest',
    blocked:[34,38,42,46]},
  {id:'curated-twin-ridges',name:'Twin Ridges',theme:'jungle',
    blocked:[31,32,34,39,41,46,48,49]},
  {id:'curated-ironwall',name:'Ironwall',theme:'desert',
    blocked:[27,29,30,33,35,36,37,39,41,43,44,45,47,50,51,53]},
  {id:'curated-the-narrows',name:'The Narrows',theme:'ocean',
    blocked:[33,34,37,38,42,43,46,47]},
  {id:'curated-crossfire',name:'Crossfire',theme:'forest',
    blocked:[30,31,33,36,37,43,44,47,49,50]},
];
// one "Random" entry per theme (per the user's ask: random has to stay available under every skin), each
// a map whose `blocked` is null — the signal to loadMap to just call generateMap() as always
const RANDOM_MAPS=['forest','jungle','desert','ocean'].map(t=>({id:'random-'+t,name:'Random',theme:t,blocked:null}));

const CUSTOM_MAPS_KEY='semuncraft-custom-maps';
function getCustomMaps(){
  try{const raw=localStorage.getItem(CUSTOM_MAPS_KEY);const list=raw?JSON.parse(raw):[];return Array.isArray(list)?list:[];}
  catch(e){return[];}
}
function setCustomMaps(list){try{localStorage.setItem(CUSTOM_MAPS_KEY,JSON.stringify(list));}catch(e){}}
// saved from Training's Map tab (trainSaveMap): the board's current obstacles under its current theme,
// 9x9 only — Single Player can't play any other size, so a map built at another size can't be saved
function saveCustomMap(name,theme,blocked){
  const maps=getCustomMaps();
  const id='custom-'+Date.now()+'-'+Math.floor(Math.random()*1000);
  maps.push({id,name,theme,blocked:blocked.slice()});
  setCustomMaps(maps);
  return id;
}
function deleteCustomMap(id){setCustomMaps(getCustomMaps().filter(m=>m.id!==id));}

function allMapGroups(){return{random:RANDOM_MAPS,curated:CURATED_MAPS,custom:getCustomMaps()};}
function findMapById(id){
  const g=allMapGroups();
  return g.random.find(m=>m.id===id)||g.curated.find(m=>m.id===id)||g.custom.find(m=>m.id===id)||g.random[0];
}

// sets mapTheme, tileData and animals for a chosen map. "random-<theme>" just sets the theme and calls
// generateMap() as always; a fixed map lays its own obstacles down directly and shares generateMap's own
// tail (placeResourcesAndExtras: mines, springs, the theme's roaming animals) so it looks and plays like
// any other map beyond its obstacles.
function loadMap(mapId){
  const m=findMapById(mapId);
  mapTheme=m.theme;
  if(m.blocked===null){generateMap();return;}
  tileData=new Array(ROWS*COLS).fill('');
  neutralPieces={};animals=[];
  setBodyTheme(mapTheme);
  const obstacle=themeObstacle(mapTheme);
  if(ROWS===9&&COLS===9)m.blocked.forEach(i=>{if(i>=0&&i<tileData.length)tileData[i]=obstacle;});
  placeResourcesAndExtras();
}
