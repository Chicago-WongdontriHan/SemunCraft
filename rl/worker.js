// ── RL WORKER ────────────────────────────────────────────────────────────────
// A Node process hosting game environments for the Python training code
// (rl/semuncraft_env.py). One JSON request per line on stdin, one JSON reply per
// line on stdout:
//   {cmd:'init', grid, envs:[config,...]}           → {grid, channels, actions, envs}
//   {cmd:'reset', envs:[k,...]}                     → {results:[result,...]}
//   {cmd:'step', envs:[k,...], actions:[index,...]} → {results:[result,...]}
//   {cmd:'configure', envs:[k,...], config}         → {}  (takes effect from each env's next game)
//   {cmd:'close'}
// A result is {seat, obs, legal, reward, done, info}. seat is 'agent', or 'opponent'
// when an external opponent must choose the next move; obs is the base64 of the
// encoded board seen by that seat; legal lists its legal action indices. reward,
// done and info describe the agent's move that just finished; when done is true,
// obs already belongs to the next game.
'use strict';
const readline=require('readline');
const E=require('../js/engine.js');
const {createEncoder,potential}=require('./encoding.js');
const campaignLevels=require('./levels.js');

const THEMES=['forest','jungle','desert','ocean'];
const DEFAULTS={
  seed:0,
  mode:'classic',       // turn order: 'classic' (single-player: White acts and fires, Black fires, Black acts) or 'pvp'
  opponent:'auto',      // 'bot' (the built-in AI; classic only, the agent plays White), 'random' (chosen here),
                        // 'external' (chosen by Python), or 'auto' (bot in classic, random in pvp)
  agentColor:'random',  // 'w', 'b' or 'random' each game (always White against the bot)
  difficulty:'random',  // the bot's level: 'easy', 'hard' or 'random' each game
  theme:'random',       // 'forest', 'jungle', 'desert', 'ocean' or 'random' each game
  levels:null,          // classic only: campaign level indices to draw from each game (null in the list = standard game)
  fog:false,
  maxTurns:300,         // both sides' turns together; reaching it is a draw
  shaping:0,            // weight of the potential-based shaping reward (0 = win/loss only)
  gamma:0.99,           // the learner's discount, used by the shaping term
};

function withDefaults(base,config){
  const c=Object.assign({},base,config);
  for(const k of Object.keys(c))if(!(k in DEFAULTS))throw new Error('unknown config key '+k);
  if(c.mode!=='classic'&&c.mode!=='pvp')throw new Error('mode must be classic or pvp');
  if(!['auto','bot','random','external'].includes(c.opponent))throw new Error('opponent must be auto, bot, random or external');
  if(c.opponent==='bot'&&c.mode!=='classic')throw new Error('the bot opponent needs mode classic');
  if(!['w','b','random'].includes(c.agentColor))throw new Error('agentColor must be w, b or random');
  if(!['easy','hard','random'].includes(c.difficulty))throw new Error('difficulty must be easy, hard or random');
  if(!THEMES.includes(c.theme)&&c.theme!=='random')throw new Error('unknown theme '+c.theme);
  if(c.levels!==null&&!Array.isArray(c.levels))throw new Error('levels must be a list or null');
  if(c.levels&&c.mode==='pvp'&&c.levels.some(l=>l!==null))throw new Error('campaign levels need mode classic');
  return c;
}

let enc=createEncoder({grid:11});
const b64=u8=>Buffer.from(u8.buffer,u8.byteOffset,u8.byteLength).toString('base64');

class Env{
  constructor(index,config){
    this.index=index;
    this.config=withDefaults(DEFAULTS,config);
    this.rand=E.makeRandom(this.config.seed);
    this.nextConfig=null;
  }

  configure(config){this.nextConfig=withDefaults(this.nextConfig||this.config,config);}

  reset(){
    if(this.nextConfig){this.config=this.nextConfig;this.nextConfig=null;}
    const c=this.config,pick=list=>list[Math.floor(this.rand()*list.length)];
    const seed=Math.floor(this.rand()*2147483647);
    const theme=c.theme==='random'?pick(THEMES):c.theme;
    const opponent=c.opponent==='auto'?(c.mode==='classic'?'bot':'random'):c.opponent;
    let level=c.levels&&c.levels.length?pick(c.levels):null;
    if(level===undefined)level=null;
    if(c.mode==='pvp'){
      this.s=E.newGame({seed,mode:'pvp',theme,fog:c.fog,maxTurns:c.maxTurns});
    }else if(level!==null){
      const lv=campaignLevels()[level];
      if(!lv)throw new Error('no campaign level '+level);
      this.s=E.newGame({seed,level:lv,fog:c.fog,maxTurns:c.maxTurns});
    }else{
      const difficulty=c.difficulty==='random'?pick(['easy','hard']):c.difficulty;
      this.s=E.newGame({seed,mode:'classic',difficulty,theme,fog:c.fog,maxTurns:c.maxTurns});
    }
    const s=this.s,bot=opponent==='bot';
    this.opponent=opponent;
    this.agent=bot?'w':c.agentColor==='random'?pick(['w','b']):c.agentColor;
    this.scenario={mode:c.mode,opponent,level,difficulty:bot&&level===null?s.difficulty:null,
      strategy:bot&&level===null?s.strategy:null,theme:s.theme,seed};
    this.opponentRand=E.makeRandom(seed^0x5bd1e995);
    this.length=0;this.return=0;this.phi=null;
    return this.advance();
  }

  step(index){
    const a=this.legal&&this.legal.get(index);
    if(!a)throw new Error('env '+this.index+': action '+index+' is not legal');
    const side=this.s.turn;
    E.step(this.s,a,{trusted:true});
    if(side===this.agent)this.length++;
    return this.advance();
  }

  // plays the turns that need no decision from Python, then reports who acts next
  advance(){
    const s=this.s,c=this.config;
    while(!s.over&&s.turn!==this.agent){
      if(this.opponent==='bot')E.botTurn(s);
      else if(this.opponent==='random'){
        const acts=E.legalActions(s);
        E.step(s,acts[Math.floor(this.opponentRand()*acts.length)],{trusted:true});
      }else break;
    }
    if(s.over){
      const outcome=s.winner==='draw'?0:s.winner===this.agent?1:-1;
      // the potential of a finished game is 0
      const reward=outcome-(c.shaping&&this.phi!==null?c.shaping*this.phi:0);
      this.return+=reward;
      const info={outcome,winner:s.winner,agent:this.agent,turns:s.turnCount.w+s.turnCount.b,
        truncated:s.winner==='draw',episode:{r:this.return,l:this.length},scenario:this.scenario,
        terminal_obs:b64(enc.observe(s,this.agent))};
      const next=this.reset();
      next.reward=reward;next.done=true;next.info=info;
      return next;
    }
    const seat=s.turn===this.agent?'agent':'opponent';
    let reward=0;
    if(seat==='agent'&&c.shaping){
      const phi=potential(s,this.agent);
      if(this.phi!==null)reward=c.shaping*(c.gamma*phi-this.phi);
      this.phi=phi;
      this.return+=reward;
    }
    this.legal=enc.legalMap(s);
    return{seat,obs:b64(enc.observe(s)),legal:[...this.legal.keys()],reward,done:false,info:null};
  }
}

let envs=[];
function env(k){
  const e=envs[k];
  if(!e)throw new Error('no env '+k);
  return e;
}
function handle(msg){
  const ks=msg.envs||envs.map((_,k)=>k);
  switch(msg.cmd){
    case'init':
      enc=createEncoder({grid:msg.grid||11});
      envs=(msg.envs||[]).map((config,k)=>new Env(k,config));
      return{grid:enc.grid,channels:enc.channels,actions:enc.numActions,envs:envs.length};
    case'reset':
      return{results:ks.map(k=>env(k).reset())};
    case'step':
      if(!Array.isArray(msg.actions)||msg.actions.length!==ks.length)throw new Error('step needs one action per env');
      return{results:ks.map((k,j)=>env(k).step(msg.actions[j]))};
    case'configure':
      ks.forEach(k=>env(k).configure(msg.config||{}));
      return{};
    case'close':
      return{};
  }
  throw new Error('unknown command '+msg.cmd);
}

const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
  if(!line.trim())return;
  let msg=null,reply;
  try{msg=JSON.parse(line);reply=handle(msg);}
  catch(err){reply={error:String(err&&err.message||err),stack:err&&err.stack||''};}
  if(msg&&msg.id!==undefined)reply.id=msg.id;
  const closing=!!(msg&&msg.cmd==='close');
  // exit once the reply is written: an open stdin would otherwise keep the process alive
  process.stdout.write(JSON.stringify(reply)+'\n',()=>{if(closing)process.exit(0);});
});
// the parent closing the pipe also ends the worker
lines.on('close',()=>process.exit(0));
