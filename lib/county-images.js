// Only raster images embedded in an identity-verified SCOUT record are accepted.
function rasterInfo(bytes){
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR')return {mime:'image/png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)return null;
 let offset=2;
 while(offset+4<=bytes.length){
  if(bytes[offset++]!==255)return null;
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===217||marker===218)return null;
  if(marker===1||(marker>=208&&marker<=215))continue;
  if(offset+2>bytes.length)return null;
  const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)return null;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   if(length<8)return null;
   return {mime:'image/jpeg',height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};
  }
  offset+=length;
 }
 return null;
}
function extractCountyImages($){
 const images=[];const seen=new Set();let total=0;
 $('img').each((_,element)=>{
  if(images.length>=8)return;
  const img=$(element);
  if(/logo|icon|sketch|diagram|map|seal/i.test([img.attr('id'),img.attr('class'),img.attr('alt')].filter(Boolean).join(' ')))return;
  const raw=img.attr('src')||'';
  const match=raw.match(/^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i);
  if(!match)return;
  const encoded=match[1].replace(/\s/g,'');
  if(encoded.length>1500000||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return;
  const bytes=Buffer.from(encoded,'base64');
  const info=rasterInfo(bytes);
  if(!info||info.width<240||info.height<140||info.width>12000||info.height>12000||info.width*info.height>40000000)return;
  const normalized=`data:${info.mime};base64,${bytes.toString('base64')}`;
  if(seen.has(normalized)||total+normalized.length>2000000)return;
  seen.add(normalized);total+=normalized.length;
  images.push({src:normalized,width:info.width,height:info.height,caption:'County assessor record image'});
 });
 return images;
}
module.exports={extractCountyImages,rasterInfo};
