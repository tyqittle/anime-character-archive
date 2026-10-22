// Regression: the gallery's hidden <select> is NOT the authoritative game
// when a costume card is selected. No browser or GitHub Pages needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/js/spine/desktop-launch.js',import.meta.url),'utf8');
const trustedNikke='https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/l2d/';
const trustedBd2='https://raw.githubusercontent.com/Zormolo/Brown-Dust-2-Assets/94a3ac97b8fab7ee054e0826de7d912de0a233ef/assets/spine/character/';
const nikke={id:'c015',name:'Anis: Sparkling Summer',gameId:'nikke',base:trustedNikke+'c015/c015_00'};
const bd2={id:'bd2-char000201',name:'Brown Dust 2 costume',gameId:'browndust2',base:trustedBd2+'Sample/Default/char000201'};
const unsupported={id:'azurlane-123',name:'Azurlane Live2D',gameId:'azurlane',modelUrl:'https://example.org/asset.json'};

async function harness(selection,hiddenValue='c015'){
  let onClick;
  const alerts=[];
  const requested=[];
  const button={
    disabled:false,hidden:false,title:'',textContent:'放到桌面 ↗',
    addEventListener(type,listener){assert.equal(type,'click');onClick=listener;}
  };
  const location={search:'',href:'https://example.org/spine.html'};
  const modelBytes=new TextEncoder().encode('4.1.20');
  const binary=Uint8Array.from([...Array(8).fill(0),modelBytes.length+1,...modelBytes]);
  const context={
    document:{
      getElementById(id){return id==='sendToDesktop'?button:id==='characters'?{value:hiddenValue}:null;},
      querySelector(){return null;}
    },
    chosen:()=>selection,
    allCharacters:[nikke,bd2,unsupported],
    window:{location},
    location,
    URLSearchParams,
    TextDecoder,
    alert:msg=>alerts.push(msg),
    console:{warn(){}},
    fetch:async url=>{
      requested.push(url);
      if(url==='./data/spine-bd2-characters.json')
        return {ok:true,json:async()=>({characters:[bd2]})};
      if(url==='./data/spine-characters.json')
        return {ok:true,json:async()=>({characters:[nikke]})};
      if(url.endsWith('.skel'))
        return {ok:true,headers:{get(){return String(binary.length)}},arrayBuffer:async()=>binary.buffer};
      throw Error('Unexpected network request: '+url);
    }
  };
  runInNewContext(source,context,{filename:'desktop-launch.js'});
  assert.equal(typeof onClick,'function');
  await onClick();
  return {alerts,requested,location,button};
}

test('BD2 card selection overrides a stale NIKKE hidden selector and routes exact costume ID',async()=>{
  const result=await harness(bd2,'c015');
  assert.deepEqual(result.alerts,[]);
  assert.equal(result.location.href,'animecharacter://open?game=browndust2&id=bd2-char000201');
  assert.ok(result.requested.includes('./data/spine-bd2-characters.json'));
  assert.ok(!result.requested.includes('./data/spine-characters.json'));
  assert.equal(result.button.disabled,false);
});

test('NIKKE character uses legacy supported protocol format',async()=>{
  const result=await harness(nikke,'');
  assert.deepEqual(result.alerts,[]);
  assert.equal(result.location.href,'animecharacter://open?id=c015');
});

test('unsupported live2d game never sends a false native desktop request',async()=>{
  const result=await harness(unsupported,'c015');
  assert.equal(result.location.href,'https://example.org/spine.html');
  assert.equal(result.requested.length,0);
  assert.match(result.alerts[0],/这个游戏的原生运行时尚未接入/);
  assert.doesNotMatch(result.alerts[0],/请先选择一个《胜利女神/);
});

test('no selected role gives a game-neutral actionable message',async()=>{
  const result=await harness(null,'');
  assert.equal(result.location.href,'https://example.org/spine.html');
  assert.equal(result.requested.length,0);
  assert.match(result.alerts[0],/请先从当前游戏的角色列表选择/);
});
