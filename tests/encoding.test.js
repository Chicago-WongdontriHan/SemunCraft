// Tests for the RL encoding (rl/encoding.js) and worker (rl/worker.js), in both encoding versions: every
// legal action gets an index that decodes back to it (version 1: every action it has a slot for), Black's
// rotated view matches White's view of the mirrored board, the observation planes, and the worker protocol.
// Run: node tests/encoding.test.js
'use strict';
const path=require('path'),{spawn}=require('child_process');
const E=require('../js/engine.js');
const {createEncoder,potential,LATEST,LAYOUTS,CHANNELS,V2_CHANNEL_INDEX:CH2,V2_SLOT}=require('../rl/encoding.js');
const LEVELS=require('../rl/levels.js')();

const enc=createEncoder({grid:11});                 // the latest, version 2
const enc1=createEncoder({grid:11,version:1});      // the networks in models/ today
const ENCODERS=[enc1,enc];
const P=enc.grid*enc.grid;
const V1_FIRST=31;      // version 1's moves-first channel (White in the classic turn order)
const V1_ONLY=new Set(['scry','fortify','order','meteor']);   // actions version 1 has no slot for
let failures=0;
function fail(msg){failures++;if(failures<=10)console.log('  FAIL '+msg);}
async function section(name,fn){
  const before=failures,t0=Date.now();
  const info=await fn();
  console.log((failures===before?'ok  ':'FAIL')+' '+name+' ('+(Date.now()-t0)+' ms)'+(info?' — '+info:''));
}
const count=(o,ch)=>{let n=0;for(let g=ch*P;g<(ch+1)*P;g++)n+=o[g]>0;return n;};

// a pvp board with each side's army scattered at random, top tier included: random games alone seldom
// get as far as a Mage, a Siege or a wounded Knight beside a Bishop
function scatter(s,pick){
  const types=['pawn','pawn','knight','bishop','rook','queen','siege','mage','paladin','guardian'];
  const free=[];s.board.forEach((p,i)=>{if(!p&&!s.blocked[i])free.push(i);});
  for(const color of ['w','b']){
    for(let k=3+Math.floor(pick()*8);k>0&&free.length;k--){
      const i=free.splice(Math.floor(pick()*free.length),1)[0],type=types[Math.floor(pick()*types.length)];
      const p={type,color,hp:1+Math.floor(pick()*E.STATS[type].maxHp),maxHp:E.STATS[type].maxHp};
      if(type==='bishop'||type==='mage')p.mana=pick()<0.6?2:Math.floor(pick()*2);
      if(type==='pawn'&&pick()<0.3){p.fortified=true;p.maxHp=3;p.hp=1+Math.floor(pick()*3);}
      s.board[i]=p;
    }
    s.elixir[color]=Math.floor(pick()*7);
  }
}

// positions from random games: pvp; classic against the built-in AI; campaign levels; classic
// with both sides picked at random (so Black is to move as well); pvp from a scattered army; some with
// fog, some with normal sight
function* positions(count){
  const pick=E.makeRandom(12345);
  let n=0;
  for(let g=0;n<count;g++){
    const kind=g%6,seed=g+1,aiSight=g%3===0;
    const s=kind===0?E.newGame({seed,mode:'pvp',fog:g%10===0,aiSight,maxTurns:200})
      :kind===1?E.newGame({seed,mode:'classic',difficulty:g%3?'hard':'easy',fog:g%10===1,aiSight,maxTurns:200})
      :kind===2?E.newGame({seed,level:LEVELS[Math.floor(g/5)%LEVELS.length],maxTurns:200})
      :kind===3?E.newGame({seed,mode:'pvp',theme:g%2?'desert':'jungle',aiSight,maxTurns:200})
      :kind===4?E.newGame({seed,mode:'classic',fog:g%10===4,aiSight,maxTurns:200})
      :E.newGame({seed,mode:'pvp',theme:['forest','jungle','desert','ocean'][g%4],aiSight,maxTurns:120});
    if(kind===5)scatter(s,pick);
    const bot=kind===1||kind===2;
    while(!s.over&&n<count){
      if(bot&&s.turn==='b'){E.botTurn(s);continue;}
      yield s;
      n++;
      // half the time prefer anything but a plain move or skip, so merges, heals, sieges, orders,
      // Scry and Meteors appear
      const acts=E.legalActions(s),special=acts.filter(a=>a.type!=='move'&&a.type!=='skip');
      const pool=special.length&&pick()<0.5?special:acts;
      E.step(s,pool[Math.floor(pick()*pool.length)]);
    }
  }
}

// the same position with colors swapped and the board rotated 180°
function mirror(s){
  const n=s.board.length,rot=i=>n-1-i,swap=c=>c==='w'?'b':'w',pair=o=>o&&{w:o.b,b:o.w};
  const m=E.clone(s);
  m.board=s.board.map((_,i)=>{
    const p=s.board[rot(i)];if(!p)return null;
    const q=Object.assign({},p,{color:swap(p.color)});
    if(p.order)q.order={to:rot(p.order.to),turns:p.order.turns};
    if(p.exposedAt!==undefined)q.exposedAt=rot(p.exposedAt);
    return q;
  });
  m.tiles=s.tiles.map((_,i)=>s.tiles[rot(i)]);
  m.blocked=s.blocked.map((_,i)=>s.blocked[rot(i)]);
  const flip=t=>{const o={};for(const k in t)o[rot(+k)]=rot(t[k]);return o;};
  m.targets={w:flip(s.targets.b),b:flip(s.targets.w)};
  m.turn=swap(s.turn);
  for(const k of ['turnCount','spawns','elixir','mineTurns','goldSpent','orderLeft','aiSight'])m[k]=pair(s[k]);
  const spells=list=>(list||[]).map(x=>Object.assign({},x,{tiles:x.tiles.map(rot),color:swap(x.color)}));
  m.scans=spells(s.scans);m.meteors=spells(s.meteors);m.flares=spells(s.flares);
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

// an empty 9x9 board with the two Kings in their corners, for hand-built positions
function emptyBoard(opts){
  const s=E.newGame(Object.assign({seed:1,mode:'pvp',theme:'forest'},opts));
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  const at=(r,c)=>r*s.cols+c;
  const put=(r,c,type,color,extra)=>{s.board[at(r,c)]=Object.assign({type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp},extra);return at(r,c);};
  put(8,0,'king','w');put(0,8,'king','b');
  return{s,at,put};
}

(async()=>{
  await section('the layouts: channel and slot counts, and each version\'s own actions',()=>{
    if(LATEST!==2||enc.version!==2||enc1.version!==1)fail('versions '+LATEST+' '+enc.version+' '+enc1.version);
    if(enc1.channels!==32||enc1.slots!==82||enc1.onBoard!==19||enc1.numActions!==11*11*82+1)fail('version 1 changed: '+JSON.stringify(LAYOUTS[1]));
    if(enc.channels!==54||enc.slots!==159||enc.onBoard!==42||enc.numActions!==11*11*159+1||CHANNELS!==54)fail('version 2: '+JSON.stringify(LAYOUTS[2]));
    if(CH2.onBoard!==enc.onBoard||enc.channelNames.length!==enc.channels)fail('version 2 channel names');
    // every unit the engine knows has a channel of its own in version 2
    for(const type of Object.keys(E.STATS)){
      const s=emptyBoard().s;s.board[40]={type,color:'w',hp:1,maxHp:1};
      const o=enc.observe(s,'w');
      let on=0;for(let ch=0;ch<11;ch++)if(o[ch*P+enc.cell(s,40,'w')])on++;
      if(on!==1)fail('version 2 has no channel for a '+type);
    }
  });

  await section('every legal action has an index that decodes back to it',()=>{
    const info=[];
    for(const e of ENCODERS){
      let states=0,actions=0,shadowed=0,casters=0,far=0;const kinds={};
      for(const s of positions(e.version===1?2000:4000)){
        states++;
        const map=e.legalMap(s);
        if(!map.has(e.skipIndex))fail('skip is missing');
        for(const[k,a]of map){
          if(!(k>=0&&k<e.numActions))fail('index out of range: '+k);
          if(!E.isLegal(s,a))fail('index '+k+' decodes to an illegal action');
        }
        for(const a of E.legalActions(s)){
          actions++;
          const k=e.actionIndex(s,a),b=map.get(k);
          if(e.version===1&&V1_ONLY.has(a.type)){if(k>=0)fail('version 1 gives '+a.type+' an index');continue;}
          if(k<0){
            // only a lock on a target more than 4 squares away is out of reach of the slots
            if(a.type!=='target')fail('version '+e.version+': no index for '+JSON.stringify(a));
            far++;continue;
          }
          if(!b){fail('version '+e.version+': index '+k+' of '+JSON.stringify(a)+' is not in the map');continue;}
          kinds[a.type]=(kinds[a.type]||0)+1;
          if(b.type===a.type&&b.from===a.from&&b.to===a.to&&b.turns===a.turns)continue;
          if(a.type==='merge'&&b.type==='healLock'&&b.from===a.from&&b.to===a.to){shadowed++;continue;}
          // two casters that could both Scry or call a Meteor there: one of them is chosen
          if(e.version>1&&(a.type==='scry'||a.type==='meteor')&&b.type===a.type&&b.to===a.to){casters++;continue;}
          fail('version '+e.version+': index '+k+' of '+JSON.stringify(a)+' decodes to '+JSON.stringify(b));
        }
      }
      info.push('v'+e.version+': '+states+' positions, '+actions+' actions ('+shadowed+' bishop merges shown as heals'
        +(e.version>1?', '+casters+' spells cast by the other caster, '+['order','scry','meteor','fortify'].map(t=>(kinds[t]||0)+' '+t).join(' '):'')
        +', '+far+' distant locks)');
      // (a heal-lock is rare at random: the section after this one builds it by hand)
      if(e.version>1)for(const t of ['order','scry','meteor','fortify','unsiege','heal','target'])if(!kinds[t])fail('no '+t+' among the positions');
    }
    return info.join('; ');
  });

  await section('a bishop dropped on a wounded adjacent knight means heal',()=>{
    for(const e of ENCODERS)for(const side of ['w','b']){
      const s=E.newGame({seed:1,mode:'pvp'}),at=(r,c)=>r*s.cols+c;
      s.board=s.board.map(p=>p&&p.type==='king'?p:null);
      const bishop=at(4,4),knight=at(3,5);
      s.board[bishop]={type:'bishop',color:side,hp:2,maxHp:2,mana:1};
      s.board[knight]={type:'knight',color:side,hp:2,maxHp:4};
      s.turn=side;
      const map=e.legalMap(s);
      const onKnight=map.get(e.actionIndex(s,{type:'merge',from:bishop,to:knight}));
      const onBishop=map.get(e.actionIndex(s,{type:'merge',from:knight,to:bishop}));
      if(!onKnight||onKnight.type!=='healLock')fail(side+': bishop onto knight decodes to '+JSON.stringify(onKnight));
      if(!onBishop||onBishop.type!=='merge')fail(side+': knight onto bishop decodes to '+JSON.stringify(onBishop));
    }
  });

  await section('version 2 slots: orders, helmets, Scry and Meteors, as White and as Black',()=>{
    for(const side of ['w','b']){
      const {s,at,put}=emptyBoard();
      s.turn=side;
      const r=side==='w'?6:2;   // a pawn a little way out from its own side
      const pawn=put(r,4,'pawn',side,{firstMove:true});
      const map=enc.legalMap(s),by=a=>map.get(enc.actionIndex(s,a));
      const fwd=side==='w'?-1:1;
      const order={type:'order',from:pawn,to:at(r+fwd,4),turns:3};
      const got=by(order);
      if(!got||got.type!=='order'||got.turns!==3||got.to!==order.to)fail(side+': a pawn order 3 turns ahead decodes to '+JSON.stringify(got));
      if(enc.actionIndex(s,order)%enc.slots<V2_SLOT.order)fail(side+': an order is not in the order slots');
      const helmet=by({type:'fortify',from:pawn,to:pawn});
      if(!helmet||helmet.type!=='fortify')fail(side+': a helmet decodes to '+JSON.stringify(helmet));
      if(enc.actionIndex(s,{type:'fortify',from:pawn,to:pawn})%enc.slots!==V2_SLOT.centre)fail(side+': a helmet is not the centre slot');
      // a Meteor names its 2x2 by its top-left square on the board; as the side sees it, that is the
      // corner at the top left of its own view
      const mage=put(4,4,'mage',side,{mana:2});
      const m=enc.legalMap(s),meteors=E.legalActions(s).filter(a=>a.type==='meteor');
      if(!meteors.length)fail(side+': no Meteor to test');
      for(const a of meteors){
        const k=enc.actionIndex(s,a),c=Math.floor(k/enc.slots),box=[a.to,a.to+1,a.to+s.cols,a.to+s.cols+1].map(j=>enc.cell(s,j,side));
        if(c!==Math.min(...box))fail(side+': Meteor at '+a.to+' is named by cell '+c+', not the top left of '+box);
        const b=m.get(k);if(!b||b.type!=='meteor'||b.to!==a.to||b.from!==mage)fail(side+': Meteor decodes to '+JSON.stringify(b));
      }
      // once called, both sides see it coming on its four squares, as their own or the enemy's
      const c=E.clone(s);E.step(c,meteors[0]);
      const other=side==='w'?'b':'w';
      if(count(enc.observe(c,side),CH2.ownMeteor)!==4)fail(side+': its own Meteor on its way is not on 4 cells');
      if(count(enc.observe(c,other),CH2.enemyMeteor)!==4)fail(side+': the other side does not see the Meteor coming');
    }
    // two bishops could Scry the same square: the one with nothing to shoot at casts it
    const {s,put}=emptyBoard();
    const busy=put(6,2,'bishop','w',{mana:2}),idle=put(8,6,'bishop','w',{mana:2});
    put(5,3,'pawn','b');   // on the busy bishop's diagonal
    const a=enc.legalMap(s).get(enc.actionIndex(s,{type:'scry',from:busy,to:4*9+4}));
    if(!a||a.from!==idle)fail('the Scry went to '+JSON.stringify(a)+', not the bishop with nothing to shoot');
  });

  await section('Black sees the board exactly as White sees the mirrored board',()=>{
    let n=0;
    for(const s of positions(3000)){
      if(s.mode!=='pvp')continue;
      n++;
      const m=mirror(s);
      for(const e of ENCODERS){
        if(Buffer.compare(Buffer.from(e.observe(s)),Buffer.from(e.observe(m)))!==0){fail('v'+e.version+': observations differ ('+s.turn+' to move)');continue;}
        const keys=x=>[...e.legalMap(x).keys()].sort((a,b)=>a-b).join();
        if(keys(s)!==keys(m))fail('v'+e.version+': legal action indices differ ('+s.turn+' to move)');
      }
      if(Math.abs(potential(s,s.turn)-potential(m,m.turn))>1e-9)fail('potential differs');
    }
    return n+' pvp positions';
  });

  await section('observation planes',()=>{
    let classicBlack=0,orders=0,meteors=0,elixir=0,helmets=0;
    for(const s of positions(1500)){
      const fog=E.fogFor(s,s.turn),enemyShown=(p,i)=>p&&p.color!==s.turn&&(!fog||E.visible(s,i,s.turn))&&!E.inCover(s,i,s.turn);
      const expOwn=s.board.filter(p=>p&&p.color===s.turn).length;
      const first=s.mode==='classic'&&s.turn==='w';
      if(s.mode==='classic'&&s.turn==='b')classicBlack++;
      const k=s.board.findIndex(p=>p&&p.color===s.turn&&p.type==='king');
      // version 1
      {
        const o=enc1.observe(s);
        if(o.length!==32*P)fail('v1 observation length '+o.length);
        if(count(o,19)!==s.rows*s.cols)fail('v1 on-board cells: '+count(o,19));
        let own=0,enemy=0;
        for(let ch=0;ch<7;ch++){own+=count(o,ch);enemy+=count(o,ch+7);}
        const expEnemy=s.board.filter((p,i)=>p&&p.color!==s.turn&&(!fog||E.visible(s,i,s.turn))).length;
        if(own!==expOwn||enemy!==expEnemy&&!s.board.some((p,i)=>p&&E.inCover(s,i,s.turn)))fail('v1 pieces seen '+own+'/'+enemy+', expected '+expOwn+'/'+expEnemy);
        if(k>=0&&o[5*P+enc1.cell(s,k,s.turn)]!==255)fail('v1: own King is not on its cell');
        if(count(o,V1_FIRST)!==(first?P:0))fail('v1 moves-first channel');
      }
      // version 2
      const o=enc.observe(s);
      if(o.length!==54*P)fail('v2 observation length '+o.length);
      if(count(o,CH2.onBoard)!==s.rows*s.cols)fail('v2 on-board cells');
      let own=0,enemy=0;
      for(let ch=0;ch<11;ch++){own+=count(o,CH2.own+ch);enemy+=count(o,CH2.enemy+ch);}
      const expEnemy=s.board.filter(enemyShown).length;
      if(own!==expOwn||enemy!==expEnemy)fail('v2 pieces seen '+own+'/'+enemy+', expected '+expOwn+'/'+expEnemy);
      if(k>=0&&o[CH2.own_king*P+enc.cell(s,k,s.turn)]!==255)fail('v2: own King is not on its cell');
      const forts=s.board.filter(p=>p&&p.color===s.turn&&p.type==='pawn'&&p.fortified).length;
      if(count(o,CH2.own_fort)!==forts)fail('v2 helmets: '+count(o,CH2.own_fort)+' vs '+forts);
      helmets+=forts;
      if(count(o,CH2.first)!==(first?P:0))fail('v2 moves-first channel');
      const mines=s.tiles.filter(t=>t==='mine').length,springs=s.tiles.filter(t=>t==='spring').length;
      if(count(o,CH2.mine)!==mines||count(o,CH2.spring)!==springs)fail('v2 mines and springs');
      const ownOrders=s.board.filter(p=>p&&p.color===s.turn&&p.order).length;
      if(count(o,CH2.ownOrder)!==ownOrders)fail('v2 own orders: '+count(o,CH2.ownOrder)+' vs '+ownOrders);
      orders+=ownOrders;
      if((s.meteors||[]).length){meteors++;if(!count(o,CH2.ownMeteor)&&!count(o,CH2.enemyMeteor))fail('v2: a Meteor on its way is not shown');}
      const e=s.elixir[s.turn];if(e){elixir++;if(o[CH2.ownElixir*P]!==Math.round(Math.min(1,e/6)*255))fail('v2 Elixir plane');}
      if(o[CH2.orderLeft*P]!==Math.round(Math.min(1,s.orderLeft[s.turn])*255))fail('v2 order budget plane');
      // the visible plane: fog or normal sight, whichever limits the side more (every cell with neither)
      const limited=E.sightLimited(s,s.turn);
      if(!limited&&!s.tiles.includes('undergrowth')&&count(o,CH2.visible)!==s.rows*s.cols)fail('v2: without fog or aiSight every cell is visible');
    }
    return classicBlack+' positions with Black to move in the classic order; with own orders, Meteors, Elixir, helmets: '
      +orders+', '+meteors+', '+elixir+', '+helmets;
  });

  await section("an AI side's visible plane shows its sight while the enemy stays in the picture",()=>{
    // White's King in one corner, Black's in the other: neither sees the other's
    const plain=enc.observe(emptyBoard({aiSight:false}).s,'w'),limited=enc.observe(emptyBoard({aiSight:true}).s,'w');
    if(count(plain,CH2.visible)!==81)fail('without aiSight every cell is visible: '+count(plain,CH2.visible));
    // the corner within two squares of White's King: 3x3 cells
    if(count(limited,CH2.visible)!==9)fail('with aiSight only what White sees is visible: '+count(limited,CH2.visible));
    if(count(limited,CH2.enemy_king)!==1)fail('the enemy King must still be in the picture');
    if(count(plain,CH2.enemy_king)!==1)fail('the enemy King is missing without aiSight');
    // version 1 with sightPlane false (js/netai.js) keeps the old all-ones plane
    const legacy=createEncoder({grid:11,version:1,sightPlane:false});
    if(count(legacy.observe(emptyBoard({aiSight:true}).s,'w'),20)!==81)fail('sightPlane:false should keep the old visible plane');
  });

  await section('the shaping potential is zero-sum, and buying something leaves it unchanged',()=>{
    for(const s of positions(500))if(Math.abs(potential(s,'w')+potential(s,'b'))>1e-9)fail('potential is not zero-sum');
    // spawning a pawn, putting a helmet on it and merging two pawns only turn Gold into pieces
    const s=E.newGame({seed:3,mode:'pvp'});
    const v0=potential(s,'w'),spawn=E.legalActions(s).find(a=>a.type==='spawn');
    const c=E.clone(s);c.board[spawn.to]={type:'pawn',color:'w',hp:1,maxHp:1};c.spawns.w++;
    if(Math.abs(potential(c,'w')-v0)>1e-9)fail('spawning changed the potential by '+(potential(c,'w')-v0));
    c.board[spawn.to]=Object.assign(c.board[spawn.to],{fortified:true,hp:3,maxHp:3});c.goldSpent.w++;
    if(Math.abs(potential(c,'w')-v0)>1e-9)fail('a helmet changed the potential by '+(potential(c,'w')-v0));
  });

  await section('worker protocol',async()=>{
    const w=startWorker(),pick=E.makeRandom(4);
    const init=await w.call({cmd:'init',grid:11,envs:[
      {seed:1,mode:'classic'},
      {seed:2,mode:'pvp',opponent:'external',agentColor:'b'},
      {seed:3,levels:[0,1],shaping:0.1},
      {seed:4,mode:'classic',opponent:'external',agentColor:'b'},
    ]});
    if(init.grid!==11||init.encoding!==LATEST||init.channels!==CHANNELS||init.slots!==enc.slots||init.onBoard!==enc.onBoard
      ||init.actions!==enc.numActions||init.envs!==4)fail('init reply '+JSON.stringify(init));
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
        if(obs[CH2.first*P]!==first)fail('env '+k+' ('+r.seat+'): moves-first channel is '+obs[CH2.first*P]);
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
    // a worker can still serve version 1, for the networks trained on it
    const w1=startWorker();
    const init1=await w1.call({cmd:'init',grid:11,encoding:1,envs:[{seed:1,mode:'classic'}]});
    if(init1.encoding!==1||init1.channels!==32||init1.slots!==82||init1.onBoard!==19)fail('version 1 init reply '+JSON.stringify(init1));
    const r1=(await w1.call({cmd:'reset'})).results[0];
    if(Buffer.from(r1.obs,'base64').length!==32*P)fail('version 1 observation size');
    await w1.call({cmd:'close'});
    return games+' games finished, '+opponentMoves+' external opponent moves';
  });

  await section('the scripted opponent plays either colour in either mode',async()=>{
    const w=startWorker(),pick=E.makeRandom(8);
    const init=await w.call({cmd:'init',grid:11,envs:[
      {seed:1,mode:'classic',opponent:'scripted',agentColor:'b'},
      {seed:2,mode:'pvp',opponent:'scripted',agentColor:'b'},
      {seed:3,mode:'pvp',opponent:'scripted',agentColor:'w',maxTurns:60},
    ]});
    if(init.envs!==3)fail('init reply '+JSON.stringify(init));
    let res=(await w.call({cmd:'reset'})).results,games=0;
    for(let n=0;n<400;n++){
      res.forEach((r,k)=>{
        if(r.seat!=='agent')fail('env '+k+': the scripted opponent left the turn to '+r.seat);
        if(r.done){games++;if(r.info.scenario.opponent!=='scripted')fail('the game is not recorded against the scripted opponent');}
      });
      res=(await w.call({cmd:'step',actions:res.map(r=>r.legal[Math.floor(pick()*r.legal.length)])})).results;
    }
    const level=await w.call({cmd:'configure',envs:[0],config:{levels:[0]}});
    if(!String(level.error).includes('standard'))fail('a campaign level accepted with the scripted opponent: '+JSON.stringify(level));
    const bad=await w.call({cmd:'configure',envs:[0],config:{aiSight:'yes'}});
    if(!String(bad.error).includes('aiSight'))fail('a non-boolean aiSight accepted: '+JSON.stringify(bad));
    const off=await w.call({cmd:'configure',envs:[0],config:{aiSight:false}});
    if(off.error)fail('aiSight:false rejected: '+JSON.stringify(off));
    await w.call({cmd:'close'});
    if(!games)fail('no game finished');
    return games+' games finished';
  });

  console.log(failures?'\n'+failures+' failure(s)':'\nall encoding tests passed');
  process.exit(failures?1:0);
})();
