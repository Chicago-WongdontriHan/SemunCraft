// Loads the browser game's own rule scripts into a Node vm sandbox, with a fake
// DOM and a virtual clock, so tests can drive the original code and compare it
// with js/engine.js. Presentation-only code (rendering, audio, UI text,
// animations) is replaced by stubs; everything that changes game state runs
// unmodified.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');

// rule scripts, in SemunCraft.html order (audio, music, pieces, render, ui,
// tutorial, drag and resize are presentation and replaced by PRELUDE)
const SCRIPTS=['js/constants.js','js/state.js','js/movement.js','js/themes.js','js/combat.js',
  'js/animals.js','js/actions.js','js/campaign.js','js/pvp.js','js/ai.js','js/game.js'];

const PRELUDE=`
var bgmPlaying=false,bgmPaused=true,bgmVol=0,sfxVol=0,audioCtx=null;
const SFX=new Proxy({},{get:()=>function(){}});
function startBgm(){} function stopBgm(){}
function pieceSVG(){return '';}
function render(){} function sqElAt(){return __fakeEl();} function flashSq(){} function spawnFlash(){} function mergeFlash(){}
function setStatus(){} function addLog(m){logLines.push(m);if(logLines.length>4)logLines.shift();}
function syncUI(){} function showMoveHint(){} function showGameOver(){} function hideGameOver(){}
function showFloatingMessage(){} function renderMinimap(){} function updateViewportControls(){}
function renderPcCards(){} function renderMergeGuide(){} function goIntro(){}
function isTutorialActive(){return false;} function tutCheckAction(){} function tutMoveEnemyOnce(){} function tutHighlightPiece(){}
const TUTORIAL_STEPS=[]; var tutStep=0;
var boxSelecting=false,boxMouseDownOnEmpty=false; function clearBoxSelect(){}
function resizeBoard(){}
`;

// animations only decide *when* callbacks run; keep that timing on the virtual clock
const POSTLUDE=`
sqCenter=function(){return{x:0,y:0,sx:0,sy:0};};
attackAnim=function(a,t,type,cb){setTimeout(cb,300);};
emojiAnim=function(e,ax,ay,tx,ty,arc,dur,cb){setTimeout(cb,dur||200);};
showDeath=function(){};
animatePieceMove=function(from,to,type,color,isBlack,cb,dur){setTimeout(cb,dur||180);};
startAnimalLoop=function(){}; stopAnimalLoop=function(){}; renderAnimalOverlay=function(){};
`;

function fakeEl(tag){
  return{tagName:tag||'div',id:'',style:{},dataset:{},children:[],
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    textContent:'',innerHTML:'',value:'',disabled:false,className:'',
    offsetWidth:0,offsetHeight:0,clientWidth:0,clientHeight:0,isConnected:true,
    appendChild(c){this.children.push(c);return c;},removeChild(){},remove(){},
    addEventListener(){},removeEventListener(){},setAttribute(){},getAttribute(){return null;},
    querySelector(){return null;},querySelectorAll(){return[];},contains(){return false;},
    getBoundingClientRect(){return{left:0,top:0,right:360,bottom:360,width:360,height:360};},
    animate(){return{finished:Promise.resolve()};}};
}

function loadOriginalGame(opts){
  opts=opts||{};
  // virtual clock: timers fire in deadline order, ties in scheduling order (like browsers)
  const clock={now:0,seq:0,timers:[]};
  const setTimeoutV=(fn,ms,...args)=>{const id=++clock.seq;clock.timers.push({id,t:clock.now+(+ms||0),fn,args});return id;};
  const clearTimeoutV=id=>{const k=clock.timers.findIndex(x=>x.id===id);if(k>=0)clock.timers.splice(k,1);};
  const created=[];
  const byId=new Map();
  const document={
    body:fakeEl('body'),documentElement:fakeEl('html'),
    getElementById(id){let el=byId.get(id);if(!el){el=fakeEl();el.id=id;byId.set(id,el);}return el;},
    createElement(tag){const el=fakeEl(tag);created.push(el);return el;},
    createElementNS(ns,tag){return fakeEl(tag);},
    querySelector(){return null;},querySelectorAll(){return[];},
    addEventListener(){},removeEventListener(){},
  };
  const store=new Map();
  const ctx={
    console,document,__fakeEl:fakeEl,innerWidth:1200,innerHeight:900,
    setTimeout:setTimeoutV,clearTimeout:clearTimeoutV,setInterval:()=>0,clearInterval(){},
    requestAnimationFrame:fn=>setTimeoutV(()=>fn(clock.now),16),cancelAnimationFrame:clearTimeoutV,
    performance:{now:()=>clock.now},navigator:{userAgent:'node'},
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  };
  ctx.window=ctx;
  vm.createContext(ctx);
  const run=(code,filename)=>vm.runInContext(code,ctx,{filename:filename||'harness'});
  run(PRELUDE,'prelude');
  for(const f of SCRIPTS.concat(opts.extraScripts||[]))run(fs.readFileSync(path.join(ROOT,f),'utf8'),f);
  run(POSTLUDE,'postlude');
  const game={
    ctx,run,created,
    // run every pending timer, advancing the virtual clock
    flush(limit){
      let n=0;
      while(clock.timers.length){
        if(++n>(limit||100000))throw new Error('timer queue never drained');
        let k=0;
        for(let j=1;j<clock.timers.length;j++){const a=clock.timers[j],b=clock.timers[k];if(a.t<b.t||(a.t===b.t&&a.id<b.id))k=j;}
        const x=clock.timers.splice(k,1)[0];
        clock.now=Math.max(clock.now,x.t);
        x.fn(...x.args);
      }
    },
    setRandom(fn){ctx.__rand=fn;run('Math.random=__rand');},
    // set a top-level variable of the original scripts (let/const bindings aren't window properties)
    set(name,value){ctx.__v=value;run(name+'=__v');delete ctx.__v;},
    get(name){return run(name);},
  };
  if(opts.random)game.setRandom(opts.random);
  return game;
}

module.exports={loadOriginalGame};
