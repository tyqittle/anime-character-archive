'use strict';
// Improve interpolation of the original full-resolution Spine atlas, not the
// 360x420 catalogue thumbnails. Only Arknights *illustration* rigs opt in.
// A 5-tap GPU unsharp filter can restore perceived edge clarity from bilinear
// magnification. It cannot invent details absent from the original PNG.
function installSpineIllustrationQuality(activePlayer,entry){
 if(!activePlayer||entry?.gameId!=='arknights'
   ||entry?.assetType!=='dynamic-illustration-spine')return false;
 const renderer=activePlayer.sceneRenderer;
 const oldShader=renderer?.batcherShader,batcher=renderer?.batcher;
 const Shader=window.spine?.webgl?.Shader;
 if(!oldShader?.getFragmentSource||!batcher?.flush||!Shader)return false;
 if(renderer._archiveEnhanced)return true;
 const vertex=oldShader.getVertexShaderSource(),fragment=oldShader.getFragmentSource();
 const sample='vec4 texColor = texture2D(u_texture, v_texCoords);';
 if(!fragment.includes(sample)||!fragment.includes('uniform sampler2D u_texture;'))return false;
 const replacement=`vec4 texColor = texture2D(u_texture, v_texCoords);
      vec3 adjacent = (
        texture2D(u_texture, v_texCoords + vec2(u_archiveTexel.x,0.0)).rgb +
        texture2D(u_texture, v_texCoords - vec2(u_archiveTexel.x,0.0)).rgb +
        texture2D(u_texture, v_texCoords + vec2(0.0,u_archiveTexel.y)).rgb +
        texture2D(u_texture, v_texCoords - vec2(0.0,u_archiveTexel.y)).rgb
      ) * 0.25;
      texColor.rgb = clamp(texColor.rgb + (texColor.rgb - adjacent) * (0.45 * texColor.a), 0.0, 1.0);`;
 const updated=fragment.replace('uniform sampler2D u_texture;',
  'uniform sampler2D u_texture;\n      uniform vec2 u_archiveTexel;').replace(sample,replacement);
 let sharp;
 try{
  sharp=new Shader(renderer.context,vertex,updated);
  sharp._archiveSharpIllustration=true;
  const originalFlush=batcher.flush;
  batcher.flush=function(...args){
   if(this.shader===sharp&&this.verticesLength>0){
    const img=this.lastTexture?.getImage?.();
    const w=Number(img?.naturalWidth||img?.width)||1;
    const h=Number(img?.naturalHeight||img?.height)||1;
    sharp.setUniform2f('u_archiveTexel',1/w,1/h);
   }
   return originalFlush.apply(this,args);
  };
  renderer.batcherShader=sharp;
  renderer._archiveEnhanced=true;
  try{oldShader.dispose?.()}catch(error){console.warn('旧版 Spine 着色器释放失败',error)}
  renderer._archiveRenderMinRatio=1.5; // supersampling on normal 1x desktop monitors
  activePlayer._archiveIllustrationQuality={
   mode:'atlas-gpu-sharpen',strength:0.45,source:'original PNG',
   minRenderRatio:1.5
  };
  return true;
 }catch(error){
  try{sharp?.dispose?.()}catch(_){}
  console.warn('高清纹理采样无法启用，继续使用原版 Spine 渲染',error);
  return false;
 }
}
