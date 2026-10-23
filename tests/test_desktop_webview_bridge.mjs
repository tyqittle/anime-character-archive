import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../assets/js/spine/desktop-webview-bridge.js',import.meta.url),'utf8');
function harness(search='?desktop=1&transport=webview2&game=example&id=role&session=token'){
 const sent=[],events={},commands={},nodes={},state={time:0,id:'role',reads:0,clicked:0};
 const canvas={width:100,height:100,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
 const context2d={clearRect(){},drawImage(){},getImageData(){state.reads++;return {data:new Uint8Array(4)}}};
 const document={hidden:false,head:{append(){}},createElement:type=>type==='canvas'?{getContext:()=>context2d}:{},
  getElementById:id=>nodes[id],querySelector:()=>null};
 nodes.animationPicker={options:[{value:'idle',text:'Idle'}],dispatchEvent(){state.changed=true}};
 nodes.zoomIn={click(){state.clicked++}};
 nodes.voiceEnabled={checked:false,dispatchEvent(){}};
 const window={addEventListener:(name,fn)=>events[name]=fn,
  chrome:{webview:{postMessage:m=>sent.push(m),addEventListener:(name,fn)=>commands[name]=fn}}};
 window.parent=window;
 const context={innerWidth:100,innerHeight:100,window,document,location:{search,origin:'https://archive.test'},
  URLSearchParams,performance:{now:()=>state.time},Event:class {},
  chosen:()=>({id:state.id,gameId:'example',engine:'spine',name:'Role'}),
  localStorage:{getItem:()=>null,setItem(){}},viewZoom:1,viewOffsetX:0,viewOffsetY:0,
  player:{canvas,skeleton:{},_archiveFitPending:0},
  ArchiveDesktopAlphaMask:{runs:()=>[[10,20,30,40]]}};
 runInNewContext(source,context);
 return {api:window.ArchiveDesktopBridge,sent,events,commands,state,canvas,nodes};
}
test('bridge activates only for explicit native WebView2 desktop transport',()=>{
 assert.equal(harness('?desktop=1').api,undefined);
 assert.equal(harness('?transport=webview2').api,undefined);
});
test('ready requires catalog identity and a rendered model; sampling is bounded at 10 Hz',()=>{
 const h=harness();h.api.catalogReady();assert.equal(h.sent.length,0);
 h.api.afterRender(h.canvas);
 assert.deepEqual(h.sent.map(x=>x.kind),['ready','actions','mask']);
 for(let i=1;i<10;i++){h.state.time=i*10;h.api.afterRender(h.canvas)}
 assert.equal(h.state.reads,1);
 assert.equal(h.api.inspect().renderedFrames,10);
 h.state.time=100;h.api.afterRender(h.canvas);assert.equal(h.state.reads,2);
});
test('wrong catalog selection reports failure and never creates clickable input',()=>{
 const h=harness();h.state.id='other';h.api.catalogReady();h.api.afterRender(h.canvas);
 assert.deepEqual(h.sent.map(x=>x.kind),['error']);
 assert.equal(h.api.inspect().failed,true);
});
test('stale commands are ignored and action IDs must belong to current options',()=>{
 const h=harness();
 h.commands.message({data:{session:'old',kind:'command',command:'zoomIn'}});
 assert.equal(h.state.clicked,0);
 h.commands.message({data:{session:'token',kind:'command',command:'zoomIn'}});
 assert.equal(h.state.clicked,1);
 h.commands.message({data:{session:'token',kind:'command',command:'action',value:'missing'}});
 assert.equal(h.state.changed,undefined);
 h.commands.message({data:{session:'token',kind:'command',command:'action',value:'idle'}});
 assert.equal(h.state.changed,true);
});
test('loading clears input and recoverable errors after readiness do not stop animation',()=>{
 const h=harness();h.api.afterRender(h.canvas);h.api.fail('voice unavailable');
 assert.equal(h.sent.at(-1).kind,'warning');assert.equal(h.api.inspect().failed,false);
 h.api.loading();assert.equal(h.sent.at(-1).kind,'mask');
 assert.equal(h.sent.at(-1).rects.length,0);assert.equal(h.api.inspect().ready,false);
 h.api.fail('download failed');assert.equal(h.sent.at(-1).kind,'error');
});
