'use strict';
// Shared footer: differentiate actual online viewers from commit-pinned model archives.
// No unverified model archive is presented as a playable third-party website.
(function renderAnimationFriends(){
  const source='https://github.com/Eikanya/Live2d-model/tree/7e446cbd95ec352cdb0f73c079e4d075d7d528ac/';
  const groups=[
    {label:'在线动态查看器',type:'viewer',items:[
      {name:'胜利女神：妮姬',url:'https://nikke-db.pages.dev/v',description:'NIKKE Spine 动态角色查看器'},
      {name:'蔚蓝档案',url:'https://ba.svdex.moe/',description:'Blue Archive 回忆大厅 / Live2D'},
      {name:'棕色尘埃2',url:'https://jelosus2.github.io/BD2-L2D-Viewer/',description:'Brown Dust 2 动态角色查看器'},
      {name:'碧蓝航线',url:'https://chaoray.github.io/AzurLane-Live2D-Viewer/',description:'Azur Lane Live2D 模型查看器'},
      {name:'明日方舟',url:'https://arknightslive2d.shuaxinjs.cn/',description:'明日方舟角色与动态皮肤预览'},
      {name:'少女前线',url:'https://gfl-live2d.github.io/',description:'Girls Frontline Live2D 查看器（Beta）'}
    ]},
    {label:'新增游戏 · 原模型资源',type:'source',items:[
      {name:'凍京NECRO',url:source+encodeURIComponent('凍京Nerco'),description:'成熟风格科幻 Live2D 模型来源（非在线查看器）'},
      {name:'女仆生活S',url:source+encodeURIComponent('galgame live2d/メイドさんのいる暮らしS'),description:'成熟风格恋爱 Live2D 模型来源（非在线查看器）'},
      {name:'少女次元',url:source+encodeURIComponent('少女次元'),description:'少女次元 Live2D 源文件目录（不是在线查看器）'},
      {name:'sin 七大罪',url:source+encodeURIComponent('sin 七大罪～魔王崇拜～'),description:'sin 七大罪 Live2D 源文件目录（不是在线查看器）'},
      {name:'东方炮弹',url:'https://github.com/n0099/TouhouCannonBall-Live2d-Models',description:'东方炮弹 Cubism 动态角色源文件（不是在线查看器）'},
      {name:'少女咖啡枪',url:source+encodeURIComponent('少女咖啡枪 girls cafe gun'),description:'少女咖啡枪 Live2D 源文件目录（不是在线查看器）'},
      {name:'为美好的世界献上祝福！',url:source+encodeURIComponent('为美好的世界献上祝福！Fantastic Days'),description:'Fantastic Days Live2D 模型来源（不是在线查看器）'}
    ]}
  ];
  for(const root of document.querySelectorAll('[data-friend-links]')){
    const title=document.createElement('strong');
    title.className='archive-friendlinks__title';
    title.textContent='动态立绘 · 友情链接';
    const groupsNode=document.createElement('div');
    groupsNode.className='archive-friendlinks__groups';
    for(const group of groups){
      const wrapper=document.createElement('div');
      wrapper.className='archive-friendlinks__group';
      const label=document.createElement('span');
      label.className='archive-friendlinks__group-title';
      label.textContent=group.label;
      const items=document.createElement('span');
      items.className='archive-friendlinks__items';
      for(const item of group.items){
        const link=document.createElement('a');
        link.href=item.url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent=item.name+' ↗';
        link.title=item.description;
        link.dataset.linkType=group.type;
        items.append(link);
      }
      wrapper.append(label,items);
      groupsNode.append(wrapper);
    }
    root.replaceChildren(title,groupsNode);
  }
})();
