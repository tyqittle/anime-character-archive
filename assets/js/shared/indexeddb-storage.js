(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ArchiveIndexedDBStorage=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // The host supplies the opener; database ownership never depends on page DOM.
 function create({open,store='packs',keyPath='id',openTimeoutMs=4000}){
  if(typeof open!=='function'||!Number.isFinite(openTimeoutMs)||openTimeoutMs<=0||openTimeoutMs>30000)throw Error('Invalid storage configuration');
  function connection(){return new Promise((resolve,reject)=>{
   let request,settled=false;
   const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)};
   const timer=setTimeout(()=>fail(Error('缓存数据库打开超时')),openTimeoutMs);
   try{request=open()}catch(error){fail(error);return}
   request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames?.contains(store))request.result.createObjectStore(store,{keyPath});
   };
   request.onblocked=()=>fail(Error('缓存数据库被其他标签页占用'));
   request.onsuccess=()=>{
    const db=request.result;
    if(settled){db.close();return}
    settled=true;clearTimeout(timer);db.onversionchange=()=>db.close();resolve(db);
   };
   request.onerror=()=>fail(request.error||Error('缓存数据库打开失败'));
  })}
  async function run(mode,operation){
   const db=await connection();
   try{return await new Promise((resolve,reject)=>{
    const transaction=db.transaction(store,mode);let result;
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(transaction.error||Error('缓存事务已中止'));
    transaction.onerror=()=>reject(transaction.error||Error('缓存事务失败'));
    try{
     const request=operation(transaction.objectStore(store));
     request.onsuccess=()=>{result=request.result};request.onerror=()=>reject(request.error);
    }catch(error){transaction.abort();reject(error)}
   })}finally{db.close()}
  }
  return Object.freeze({run});
 }
 return Object.freeze({create});
});
