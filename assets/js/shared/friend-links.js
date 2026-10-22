'use strict';
// One curated, source-verified link list shared by the gallery and theater.
// Only dedicated game animation viewers belong here; never link random image mirrors.
(function renderAnimationFriends(){
  const destinations = [
    {name:'胜利女神：妮姬', url:'https://nikke-db.pages.dev/v', description:'NIKKE Spine 动态角色查看器'},
    {name:'蔚蓝档案', url:'https://ba.svdex.moe/', description:'Blue Archive 回忆大厅 / Live2D'},
    {name:'棕色尘埃2', url:'https://jelosus2.github.io/BD2-L2D-Viewer/', description:'Brown Dust 2 动态角色查看器'},
    {name:'碧蓝航线', url:'https://chaoray.github.io/AzurLane-Live2D-Viewer/', description:'Azur Lane Live2D 模型查看器'},
    {name:'明日方舟', url:'https://arknightslive2d.shuaxinjs.cn/', description:'明日方舟角色与动态皮肤预览'},
    {name:'少女前线', url:'https://gfl-live2d.github.io/', description:'Girls Frontline Live2D 查看器（Beta）'}
  ];
  for (const root of document.querySelectorAll('[data-friend-links]')) {
    const title = document.createElement('span');
    title.className = 'archive-friendlinks__title';
    title.textContent = '友情链接 · 动态立绘';
    const links = document.createElement('span');
    links.className = 'archive-friendlinks__items';
    for (const item of destinations) {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.name + ' ↗';
      link.title = item.description + '（第三方网站）';
      links.appendChild(link);
    }
    root.replaceChildren(title, links);
  }
})();
