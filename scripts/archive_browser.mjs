// Shared automation launch policy. Local work must not silently render on CPU.
import fs from 'node:fs';

export function archiveBrowserOptions(env=process.env){
 const ci=env.CI==='true';
 const mode=env.ARCHIVE_BROWSER_RENDERER||(ci?'software':'hardware');
 if(!['hardware','software'].includes(mode))throw Error('ARCHIVE_BROWSER_RENDERER must be hardware or software');
 const executablePath=[env.CHROME_BIN,'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(fs.existsSync);
 if(!executablePath)throw Error('Chromium missing');
 return {mode,launch:{headless:true,executablePath,timeout:ci?45000:20000,args:['--no-sandbox','--enable-webgl',
  ...(mode==='software'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]}};
}

export function validateArchiveRenderer(info,mode){
 if(!info?.renderer)throw Error('WebGL renderer could not be verified; preview capture stopped');
 const software=/swiftshader|llvmpipe|softpipe|software|basic render|lavapipe/i.test(info.renderer);
 if(mode==='hardware'&&software)throw Error('CPU WebGL renderer detected ('+info.renderer+'); local capture stopped. Use a working hardware driver, or explicitly choose ARCHIVE_BROWSER_RENDERER=software for a single-worker run.');
 return {...info,mode,software};
}

export async function launchArchiveBrowser(chromium,{env=process.env,log=console.log}={}){
 const options=archiveBrowserOptions(env);
 let browser;
 // GitHub's shared runners sometimes stall while several SwiftShader processes start.
 // Retry only a browser-launch timeout, never a renderer or asset validation error.
 for(let attempt=0;attempt<(env.CI==='true'?2:1);attempt++){
  try{browser=await chromium.launch(options.launch);break}
  catch(error){
   if(attempt!==0||!/Timeout(?:Error|\\s+\\d+ms\\s+exceeded)/i.test(String(error?.message||error)))throw error;
   log('ARCHIVE_BROWSER_LAUNCH_RETRY',JSON.stringify({attempt:attempt+1,timeoutMs:options.launch.timeout}));
  }
 }
 try{
  // Probe an empty page only: no model downloads or animation loops.
  const page=await browser.newPage();let info,deadline;
  try{
   const probe=page.evaluate(()=>{
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    if(!gl)return null;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null;
    const vendor=debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();return {renderer,vendor};
   });
   info=await Promise.race([probe,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('WebGL renderer probe timed out; preview capture stopped')),10000)})]);
  }finally{clearTimeout(deadline);await page.close()}
  const renderer=validateArchiveRenderer(info,options.mode);log('ARCHIVE_BROWSER_RENDERER',JSON.stringify(renderer));
  return browser;
 }catch(error){await browser.close();throw error}
}
