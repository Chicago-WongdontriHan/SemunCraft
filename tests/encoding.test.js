// Tests for the RL encoding (rl/encoding.js) and worker (rl/worker.js): every legal
// action gets an index that decodes back to it, Black's rotated view matches White's
// view of the mirrored board, the observation planes, and the worker protocol.
// Run: node tests/encoding.test.js
'use strict';
const path=require('path'),{spawn}=require('child_process');
const E=require('../js/engine.js');
const {createEncoder,potential,CHANNEL_NAMES,CHANNELS}=require('../rl/encoding.js');
const LEVELS=require('../rl/levels.js')();

const enc=createEncoder({grid:11});
const P=enc.grid*enc.grid;
const FIRST=31; // channel: moves first each round (White in the classic turn order)
let failures=0;
function fail(msg){failures++;if(failures<=10)console.log('  FAIL '+msg);}
async function section(name,fn){
  const before=failures,t0=Date.now();
  const info=await fn();
  console.log((failures===before?'ok  ':'FAIL')+' '+name+' ('+(Date.now()-t0)+' ms)'+(info?' — '+info:''));
}

// positions from random games: pvp; classic against the built-in AI; campaign levels; classic
// with both sides picked at random (so Black is to move as well); some with fog
function* positions(count){
  const pick=E.makeRandom(12345);
  let n=0;
  for(let g=0;n<count;g++){
    const kind=g%5,seed=g+1;
    const s=kind===0?E.newGame({seed,mode:'pvp',fog:g%10===0,maxTurns:200})
      :kind===1?E.newGame({seed,mode:'classic',difficulty:g%3?'hard':'easy',fog:g%10===1,maxTurns:200})
      :kind===2?E.newGame({seed,level:LEVELS[Math.floor(g/5)%LEVELS.length],maxTurns:200})
      :kind===3?E.newGame({seed,mode:'pvp',theme:'desert',maxTurns:200})
      :E.newGame({seed,mode:'classic',fog:g%10===4,maxTurns:200});
    const bot=kind===1||kind===2;
    while(!s.over&&n<count){
      if(bot&&s.turn==='b'){E.botTurn(s);continue;}
      yield s;
      n++;
      // half the time prefer anything but a plain move or skip, so merges, heals and sieges appear
      const acts=E.legalActions(s),special=acts.filter(a=>a.type!=='move'&&a.type!=='skip');
      const pool=special.length&&pick()<0.5?special:acts;
      E.step(s,pool[Math.floor(pick()*pool.length)]);
    }
  }
}

// the same position with colors swapped and the board rotated 180°
function mirror(s){
  const n=s.board.length,rot=i=>n-1-i,swap=c=>c==='w'?'b':'w';
  const m=E.clone(s);
  m.board=s.board.map((_,i)=>{const p=s.board[rot(i)];return p&&Object.assign({},p,{color:swap(p.color)});});
  m.tiles=s.tiles.map((_,i)=>s.tiles[rot(i)]);
  m.blocked=s.blocked.map((_,i)=>s.blocked[rot(i)]);
  const flip=t=>{const o={};for(const k in t)o[rot(+k)]=rot(t[k]);return o;};
  m.targets={w:flip(s.targets.b),b:flip(s.targets.w)};
  m.turn=swap(s.turn);
  m.turnCount={w:s.turnCount.b,b:s.turnCount.w};
  m.spawns={w:s.spawns.b,b:s.spawns.w};
  m.moved=s.moved>=0?rot(s.moved):-1;
  return m;
}

function startWorker(){
  const proc=spawn(process.execPath,[path.join(__dirname,'..','rl','worker.js')],{stdio:['pipe','pipe','inherit']});
  const exited=new Promise(r=>proc.on('exit',()=>r(true)));
  const waiting=[];
  let buf='';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data',d=>{
    buf+=d;
    for(let k;(k=buf.indexOf('\n'))>=0;){const line=buf.slice(0,k);buf=buf.slice(k+1);waiting.shift()(JSON.parse(line));}
  });
  return{proc,exited,call:msg=>new Promise(r=>{waiting.push(r);proc.stdin.write(JSON.stringify(msg)+'\n');})};
}

(async()=>{
  await section('every legal action has an index that decodes back to it',()=>{
    let states=0,actions=0,shadowed=0;
    for(const s of positions(4000)){
      states++;
      const map=enc.legalMap(s);
      if(!map.has(enc.skipIndex))fail('skip is missing');
      for(const[k,a]of map){
        if(!(k>=0&&k<enc.numActions))fail('index out of range: '+k);
        if(!E.isLegal(s,a))fail('index '+k+' decodes to an illegal action');
      }
      for(const a of E.legalActions(s)){
        actions++;
        const k=enc.actionIndex(s,a),b=map.get(k);
        if(k<0||!b){fail('no index for '+JSON.stringify(a));continue;}
        if(b.type===a.type&&b.from===a.from&&b.to===a.to)continue;
        if(a.type==='merge'&&b.type==='healLock'&&b.from===a.from&&b.to===a.to){shadowed++;continue;}
        fail('index '+k+' of '+JSON.stringify(a)+' decodes to '+JSON.stringify(b));
      }
    }
    return states+' positions, '+actions+' actions ('+shadowed+' bishop merges shown as heals)';
  });

  await section('a bishop dropped on a wounded adjacent knight means heal',()=>{
    for(const side of ['w','b']){
      const s=E.newGame({seed:1,mode:'pvp'}),at=(r,c)=>r*s.cols+c;
      s.board=s.board.map(p=>p&&p.type==='king'?p:null);
      const bishop=at(4,4),knight=at(3,5);
      s.board[bishop]={type:'bishop',color:side,hp:2,maxHp:2,mana:1};
      s.board[knight]={type:'knight',color:side,hp:2,maxHp:4};
      s.turn=side;
      const map=enc.legalMap(s);
      const onKnight=map.get(enc.actionIndex(s,{type:'merge',from:bishop,to:knight}));
      const onBishop=map.get(enc.actionIndex(s,{type:'merge',from:knight,to:bishop}));
      if(!onKnight||onKnight.type!=='healLock')fail(side+': bishop onto knight decodes to '+JSON.stringify(onKnight));
      if(!onBishop||onBishop.type!=='merge')fail(side+': knight onto bishop decodes to '+JSON.stringify(onBishop));
    }
  });

  await section('Black sees the board exactly as White sees the mirrored board',()=>{
    let n=0;
    for(const s of positions(3000)){
      if(s.mode!=='pvp')continue;
      n++;
      const m=mirror(s);
      if(Buffer.compare(Buffer.from(enc.observe(s)),Buffer.from(enc.observe(m)))!==0){fail('observations differ ('+s.turn+' to move)');continue;}
      const keys=x=>[...enc.legalMap(x).keys()].sort((a,b)=>a-b).join();
      if(keys(s)!==keys(m))fail('legal action indices differ ('+s.turn+' to move)');
      if(Math.abs(potential(s,s.turn)-potential(m,m.turn))>1e-9)fail('potential differs');
    }
    return n+' pvp positions';
  });

  await section('observation planes',()=>{
    if(CHANNEL_NAMES.length!==CHANNELS||enc.channels!==CHANNELS||CHANNELS!==32)fail('channel count '+CHANNELS);
    let classicBlack=0;
    for(const s of positions(1500)){
      const o=enc.observe(s),count=ch=>{let t=0;for(let g=ch*P;g<(ch+1)*P;g++)t+=o[g]>0;return t;};
      if(o.length!==CHANNELS*P)fail('observation length '+o.length);
      if(count(19)!==s.rows*s.cols)fail('on-board cells: '+count(19));
      const fog=E.fogFor(s,s.turn);
      let own=0,enemy=0;
      for(let ch=0;ch<7;ch++){own+=count(ch);enemy+=count(ch+7);}
      const expOwn=s.board.filter(p=>p&&p.color===s.turn).length;
      const expEnemy=s.board.filter((p,i)=>p&&p.color!==s.turn&&(!fog||E.visible(s,i,s.turn))).length;
      if(own!==expOwn||enemy!==expEnemy)fail('pieces seen '+own+'/'+enemy+', expected '+expOwn+'/'+expEnemy);
      const k=s.board.findIndex(p=>p&&p.color===s.turn&&p.type==='king');
      if(k>=0&&o[5*P+enc.cell(s,k,s.turn)]!==255)fail('own King is not on its cell');
      if(!fog&&count(20)!==s.rows*s.cols)fail('without fog every board cell is visible');
      const first=s.mode==='classic'&&s.turn==='w';
      if(s.mode==='classic'&&s.turn==='b')classicBlack++;
      if(count(FIRST)!==(first?P:0))fail('moves-first channel should be '+(first?'on':'off')+' ('+s.mode+', '+s.turn+' to move)');
    }
    return classicBlack+' positions with Black to move in the classic order';
  });

  await section('the shaping potential is zero-sum',()=>{
    for(const s of positions(500))if(Math.abs(potential(s,'w')+potential(s,'b'))>1e-9)fail('potential is not zero-sum');
  });

  await section('worker protocol',async()=>{
    const w=startWorker(),pick=E.makeRandom(4);
    const init=await w.call({cmd:'init',grid:11,envs:[
      {seed:1,mode:'classic'},
      {seed:2,mode:'pvp',opponent:'external',agentColor:'b'},
      {seed:3,levels:[0,1],shaping:0.1},
      {seed:4,mode:'classic',opponent:'external',agentColor:'b'},
    ]});
    if(init.grid!==11||init.channels!==CHANNELS||init.actions!==enc.numActions||init.envs!==4)fail('init reply '+JSON.stringify(init));
    let res=(await w.call({cmd:'reset'})).results;
    if(res[1].seat!=='opponent')fail('pvp: with the agent as Black the external opponent should move first');
    if(res[3].seat!=='opponent')fail('classic: with the agent as Black the external opponent should move first');
    let games=0,opponentMoves=0;
    for(let n=0;n<3000;n++){
      res.forEach((r,k)=>{
        const obs=Buffer.from(r.obs,'base64');
        if(obs.length!==CHANNELS*P)fail('observation size');
        if(!r.legal.length)fail('no legal actions');
        // White in the classic order moves first: envs 0 and 2 (agent vs bot) and env 3's opponent
        const first=k===1?0:k===3&&r.seat==='agent'?0:255;
        if(obs[FIRST*P]!==first)fail('env '+k+' ('+r.seat+'): moves-first channel is '+obs[FIRST*P]);
        if(r.done){
          games++;
          if(![-1,0,1].includes(r.info.outcome))fail('outcome '+r.info.outcome);
          if(Buffer.from(r.info.terminal_obs,'base64').length!==CHANNELS*P)fail('terminal observation size');
        }
        if(r.seat==='opponent')opponentMoves++;
      });
      res=(await w.call({cmd:'step',actions:res.map(r=>r.legal[Math.floor(pick()*r.legal.length)])})).results;
    }
    const illegal=await w.call({cmd:'step',envs:[0],actions:[-5]});
    if(!String(illegal.error).includes('not legal'))fail('illegal action not reported: '+JSON.stringify(illegal));
    const badKey=await w.call({cmd:'configure',envs:[0],config:{colour:'w'}});
    if(!badKey.error)fail('unknown config key accepted');
    const botInPvp=await w.call({cmd:'configure',envs:[0],config:{mode:'pvp',opponent:'bot'}});
    if(!String(botInPvp.error).includes('classic'))fail('bot opponent accepted in pvp: '+JSON.stringify(botInPvp));
    await w.call({cmd:'close'});
    if(!await Promise.race([w.exited,new Promise(r=>setTimeout(()=>r(false),5000))])){fail('worker did not exit');w.proc.kill();}
    return games+' games finished, '+opponentMoves+' external opponent moves';
  });

  console.log(failures?'\n'+failures+' failure(s)':'\nall encoding tests passed');
  process.exit(failures?1:0);
})();
