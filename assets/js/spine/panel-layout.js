'use strict';
// Layout-only behavior: no animation identity, catalog, audio or renderer state.
(() => {
  const root=document.body;
  const left=document.getElementById('toggleLeftPanel');
  const right=document.getElementById('toggleRightPanel');
  if(!left||!right)return;

  const isCompact=()=>window.matchMedia('(max-width:850px)').matches;
  const state={
    left:isCompact(),
    right:isCompact()
  };
  const storeKey=()=>isCompact()?'anime-archive-theater-panes-mobile-v1':'anime-archive-theater-panes-desktop-v1';
  try {
    const value=JSON.parse(localStorage.getItem(storeKey())||'null');
    if(value&&typeof value.left==='boolean'&&typeof value.right==='boolean'){
      state.left=value.left;state.right=value.right;
    }
  } catch (_err) { /* Private browsing or disabled storage is fine. */ }
  if(isCompact()&&!state.left&&!state.right)state.right=true;

  function render(){
    root.classList.toggle('theater-left-collapsed',state.left);
    root.classList.toggle('theater-right-collapsed',state.right);
    left.textContent=state.left?'角色 ▶':'角色 ◀';
    right.textContent=state.right?'工具 ◀':'工具 ▶';
    left.setAttribute('aria-expanded',String(!state.left));
    right.setAttribute('aria-expanded',String(!state.right));
    left.setAttribute('aria-label',state.left?'展开左侧角色列表':'收起左侧角色列表');
    right.setAttribute('aria-label',state.right?'展开右侧播放工具':'收起右侧播放工具');
    left.title=left.getAttribute('aria-label');
    right.title=right.getAttribute('aria-label');
  }
  function toggle(which){
    state[which]=!state[which];
    if(isCompact()&&!state[which])state[which==='left'?'right':'left']=true;
    try{localStorage.setItem(storeKey(),JSON.stringify(state))}catch(_err){}
    render();
    // Inform renderers that compute their backing canvas size from its container.
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  left.addEventListener('click',()=>toggle('left'));
  right.addEventListener('click',()=>toggle('right'));
  // Resize across the responsive breakpoint without overlapping two mobile drawers.
  let compact=isCompact();
  window.addEventListener('resize',()=>{
    const next=isCompact();
    if(next===compact)return;
    compact=next;
    state.left=next;state.right=next;
    try {
      const value=JSON.parse(localStorage.getItem(storeKey())||'null');
      if(value&&typeof value.left==='boolean'&&typeof value.right==='boolean'){
        state.left=value.left;state.right=value.right;
      }
    }catch(_err){}
    if(next&&!state.left&&!state.right)state.right=true;
    render();
  });
  render();
})();
