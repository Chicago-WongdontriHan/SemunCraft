// ── RL WORKER ────────────────────────────────────────────────────────────────
// A Node process hosting game environments for the Python training code
// (rl/semuncraft_env.py). One JSON request per line on stdin, one JSON reply per
// line on stdout:
//   {cmd:'init', grid, encoding, envs:[config,...]} → {grid, encoding, channels, slots, onBoard, actions, envs}
//                                                      (encoding: the rl/encoding.js version, LATEST by default)
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
const {createEncoder,potential,LATEST}=require('./encoding.js');
const campaignLevels=require('./levels.js');
const Scripted=require('./scripted.js');

const THEMES=['forest','jungle','desert','ocean'];
const DRAW_FLOOR=-0.5;   // drawPenalty's floor: a draw's reward never drops below this — half of a loss's -1, so
                          // losing always costs a great deal more than even the most wasted draw, not just a little
const DEFAULTS={
  seed:0,
  mode:'classic',       // turn order: 'classic' (single-player: each side acts, then fires, excluding what it moved) or 'pvp'
  opponent:'auto',      // 'bot' (the built-in AI; classic only, the agent plays White), 'scripted' (rl/scripted.js: plays either
                        // colour in either mode, standard games only), 'random' (chosen here), 'external' (chosen by
                        // Python), or 'auto' (bot in classic, random in pvp)
  agentColor:'random',  // 'w', 'b' or 'random' each game (always White against the bot)
  agentBlack:.5,        // with agentColor 'random', how often the agent is Black (the side the game's AI plays)
  difficulty:'random',  // the bot's level: 'easy', 'hard' or 'random' each game
  theme:'random',       // 'forest', 'jungle', 'desert', 'ocean' or 'random' each game
  levels:null,          // classic only: campaign level indices to draw from each game (null in the list = standard game)
  fog:false,            // limit both sides' observations and attacks to what they see, as Map Cheat off does for a person
  aiSight:true,         // whoever plays a side here is an AI: its attacks reach only what it sees (normal sight), fog or not,
                        // though it still reads where the enemy stands; standard games only, campaign levels keep their rules
  blackOrders:true,     // false: in the classic order Black gives no delayed orders (the agent and its opponent, scripted or a
                        // network alike). Black's orders used to come due at the start of White's turn, a trap for Black,
                        // until the turn order was fixed (2026-09-28); train.py's --black-orders can still hold them back
  scriptedProfile:'random', // the scripted opponent's strategy (rl/scripted.js PROFILES): 'random' draws one each game
  maxTurns:300,         // both sides' turns together; reaching it is a draw
  shaping:0,            // weight of the potential-based shaping reward (0 = win/loss only)
  gamma:0.99,           // the learner's discount, used by the shaping term
  drawPenalty:0,        // subtracted from the terminal reward when the game ends a draw (info.outcome, win rates
                        // and promotion stay 0/1/-1 either way — this only makes a draw cost the learner something,
                        // so it stops preferring a safe stall, sitting on a lead, over pressing for the win).
                        // Games this agent has any material lead in count double: a draw it could plausibly have
                        // won should sting more than one that was always going to end level
  turnPenalty:0,        // subtracted from the reward at each of the agent's own decisions (not each raw engine
                        // turn — a turn that keeps the move, like a knight's L-jump merge, is several decisions),
                        // a small constant cost of taking another move so winning sooner is worth a little more
                        // than winning slowly. Both default to 0 (no effect); see rl/train.py --draw-penalty
                        // and --turn-penalty
  resourceBonus:0,      // paid once per agent turn, at its first decision: this times the mines and springs the
                        // agent holds less those its opponent holds (heldTiles), as they stand once the opponent
                        // has had its turn to contest them. A nudge toward holding the economy long enough to find
                        // out what it's worth; rl/train.py's --resource-bonus fades it out. 0 = off
  mergeBonus:0,         // paid for each merge the agent makes, times what it makes (MERGE_TIER: a Knight or Rook 1, a
                        // Bishop 2, the Queen and the top tier 3); unsieging a Siege takes its 3 back, so splitting and
                        // re-merging it earns nothing. A nudge toward merging at all — a network that never merges
                        // never has a bishop to strip with; rl/train.py's --merge-bonus fades it out. 0 = off
};
const MERGE_TIER={knight:1,rook:1,bishop:2,queen:3,siege:3,guardian:3,paladin:3,mage:3};

function withDefaults(base,config){
  const c=Object.assign({},base,config);
  for(const k of Object.keys(c))if(!(k in DEFAULTS))throw new Error('unknown config key '+k);
  if(c.mode!=='classic'&&c.mode!=='pvp')throw new Error('mode must be classic or pvp');
  if(!['auto','bot','scripted','random','external'].includes(c.opponent))throw new Error('opponent must be auto, bot, scripted, random or external');
  if(c.opponent==='bot'&&c.mode!=='classic')throw new Error('the bot opponent needs mode classic');
  if(!['w','b','random'].includes(c.agentColor))throw new Error('agentColor must be w, b or random');
  if(!(typeof c.agentBlack==='number'&&c.agentBlack>=0&&c.agentBlack<=1))throw new Error('agentBlack must be a number from 0 to 1');
  if(typeof c.blackOrders!=='boolean')throw new Error('blackOrders must be true or false');
  if(!['easy','hard','random'].includes(c.difficulty))throw new Error('difficulty must be easy, hard or random');
  if(!THEMES.includes(c.theme)&&c.theme!=='random')throw new Error('unknown theme '+c.theme);
  if(c.levels!==null&&!Array.isArray(c.levels))throw new Error('levels must be a list or null');
  if(c.levels&&c.mode==='pvp'&&c.levels.some(l=>l!==null))throw new Error('campaign levels need mode classic');
  if(typeof c.aiSight!=='boolean')throw new Error('aiSight must be true or false');
  if(!(typeof c.drawPenalty==='number'&&isFinite(c.drawPenalty)&&c.drawPenalty>=0))throw new Error('drawPenalty must be a non-negative number');
  if(!(typeof c.turnPenalty==='number'&&isFinite(c.turnPenalty)&&c.turnPenalty>=0))throw new Error('turnPenalty must be a non-negative number');
  if(!(typeof c.resourceBonus==='number'&&isFinite(c.resourceBonus)&&c.resourceBonus>=0))throw new Error('resourceBonus must be a non-negative number');
  if(!(typeof c.mergeBonus==='number'&&isFinite(c.mergeBonus)&&c.mergeBonus>=0))throw new Error('mergeBonus must be a non-negative number');
  if(c.opponent==='scripted'&&c.levels&&c.levels.some(l=>l!==null))throw new Error('the scripted opponent plays standard games, not campaign levels');
  if(c.scriptedProfile!=='random'&&!Scripted.PROFILES[c.scriptedProfile])throw new Error('unknown scriptedProfile '+c.scriptedProfile);
  return c;
}

let enc=createEncoder({grid:11,version:LATEST});
// the mines and springs a side holds (resourceBonus)
const heldResources=(s,color)=>E.heldTiles(s,color,'mine').length+E.heldTiles(s,color,'spring').length;
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
      this.s=E.newGame({seed,mode:'pvp',theme,fog:c.fog,aiSight:c.aiSight,maxTurns:c.maxTurns});
    }else if(level!==null){
      const lv=campaignLevels()[level];
      if(!lv)throw new Error('no campaign level '+level);
      this.s=E.newGame({seed,level:lv,fog:c.fog,maxTurns:c.maxTurns});
    }else{
      const difficulty=c.difficulty==='random'?pick(['easy','hard']):c.difficulty;
      this.s=E.newGame({seed,mode:'classic',difficulty,theme,fog:c.fog,aiSight:c.aiSight,maxTurns:c.maxTurns});
    }
    const s=this.s,bot=opponent==='bot';
    this.opponent=opponent;
    this.agent=bot?'w':c.agentColor==='random'?(this.rand()<c.agentBlack?'b':'w'):c.agentColor;
    this.opponentRand=E.makeRandom(seed^0x5bd1e995);
    // the scripted opponent keeps one strategy for the whole game, drawn from the game's own seed
    this.profile=opponent==='scripted'?Scripted.pickProfile(this.opponentRand,c.scriptedProfile==='random'?null:c.scriptedProfile):null;
    this.scenario={mode:c.mode,opponent,level,difficulty:bot&&level===null?s.difficulty:null,
      strategy:bot&&level===null?s.strategy:this.profile?this.profile.name:null,theme:s.theme,seed};
    this.length=0;this.return=0;this.phi=null;this.paidTurn=0;   // paidTurn: the last agent turn resourceBonus paid for
    this.merged=0;   // mergeBonus earned by the agent's last action, paid with its next reward
    return this.advance();
  }

  step(index){
    const a=this.legal&&this.legal.get(index);
    if(!a)throw new Error('env '+this.index+': action '+index+' is not legal');
    const side=this.s.turn;
    const events=E.step(this.s,a,{trusted:true});
    if(side===this.agent){
      this.length++;
      if(this.config.mergeBonus){
        for(const e of events)if(e.type==='merge'&&MERGE_TIER[e.piece])this.merged+=this.config.mergeBonus*MERGE_TIER[e.piece];
        if(a.type==='unsiege')this.merged-=this.config.mergeBonus*MERGE_TIER.siege;
      }
    }
    return this.advance();
  }

  // plays the turns that need no decision from Python, then reports who acts next
  advance(){
    const s=this.s,c=this.config;
    while(!s.over&&s.turn!==this.agent){
      if(this.opponent==='bot')E.botTurn(s);
      else if(this.opponent==='scripted')Scripted.playTurn(s,{orders:this.ordersAllowed(),profile:this.profile});
      else if(this.opponent==='random'){
        const acts=E.legalActions(s);
        E.step(s,acts[Math.floor(this.opponentRand()*acts.length)],{trusted:true});
      }else break;
    }
    if(s.over){
      const outcome=s.winner==='draw'?0:s.winner===this.agent?1:-1;
      // the potential of a finished game is 0
      let reward=outcome-(c.shaping&&this.phi!==null?c.shaping*this.phi:0)+this.merged;
      this.merged=0;
      // a draw that ends with the agent still ahead on material costs more than a draw that was
      // always going to be level — turtling on a lead instead of finishing it stops paying off. Capped
      // at DRAW_FLOOR, well clear of a loss's -1: losing must always cost far more than any draw, or a
      // big enough lead would make throwing the game look better than a mere draw, backwards from the point
      if(s.winner==='draw'&&c.drawPenalty)reward=Math.max(DRAW_FLOOR,reward-c.drawPenalty*(1+Math.max(0,potential(s,this.agent))));
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
    if(seat==='agent'){
      if(c.shaping){
        const phi=potential(s,this.agent);
        if(this.phi!==null)reward+=c.shaping*(c.gamma*phi-this.phi);
        this.phi=phi;
      }
      if(c.turnPenalty)reward-=c.turnPenalty;   // a small, constant cost of taking another decision
      reward+=this.merged;this.merged=0;         // mergeBonus earned by its last action
      if(c.resourceBonus&&s.turnCount[this.agent]>this.paidTurn){
        this.paidTurn=s.turnCount[this.agent];
        reward+=c.resourceBonus*(heldResources(s,this.agent)-heldResources(s,this.agent==='w'?'b':'w'));
      }
      this.return+=reward;
    }
    this.legal=enc.legalMap(s);
    if(!this.ordersAllowed())for(const[k,a]of this.legal)if(a.type==='order')this.legal.delete(k);
    return{seat,obs:b64(enc.observe(s)),legal:[...this.legal.keys()],reward,done:false,info:null};
  }

  // whether the side to move may give a delayed order (config.blackOrders)
  ordersAllowed(){return this.config.blackOrders||this.s.mode!=='classic'||this.s.turn!=='b';}
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
      enc=createEncoder({grid:msg.grid||11,version:msg.encoding||LATEST});
      envs=(msg.envs||[]).map((config,k)=>new Env(k,config));
      return{grid:enc.grid,encoding:enc.version,channels:enc.channels,slots:enc.slots,onBoard:enc.onBoard,
        actions:enc.numActions,envs:envs.length};
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
