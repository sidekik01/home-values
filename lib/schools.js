const {CountyError}=require('./county.js');
const BASE='https://gismo.spokanecounty.org/arcgis/rest/services/OpenData/Boundary/MapServer';
async function fetchSchools(parcel,fetcher=fetch){
 if(typeof parcel!=='string'||!/^\d{5}\.\d{4}$/.test(parcel))throw new CountyError('INVALID_QUERY','Select a valid county parcel.',400);
 const signal=AbortSignal.timeout(12000);
 async function json(url,params){const response=await fetcher(url,{signal,redirect:'error',...(params?{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)}:{})});if(!response.ok)throw Error('County school service unavailable');const body=await response.json();if(body.error)throw Error('County school query failed');return body;}
 const geometryParams={f:'json',where:`PID_NUM = '${parcel}'`,outFields:'PID_NUM',returnGeometry:'true',outSR:'4326',resultRecordCount:'2'};
 const parcels=await json('https://gismo.spokanecounty.org/arcgis/rest/services/Assessor/Parcels/MapServer/0/query',geometryParams);
 if(parcels.features?.length!==1||parcels.features[0].attributes?.PID_NUM!==parcel||!parcels.features[0].geometry?.rings)throw Error('Parcel boundary unavailable');
 const geometry={...parcels.features[0].geometry,spatialReference:{wkid:4326}};
 async function boundary(id,type){
  const meta=await json(BASE+'/'+id+'?f=json');
  const candidates=meta.fields?.filter(f=>['name','schoolname','districtname','schooldistrict','school','district','schooltype','type'].includes(String(f.alias||f.name).toLowerCase().replace(/[^a-z]/g,''))||['name','schoolname','districtname','schooldistrict','school','district','schooltype','type'].includes(String(f.name).toLowerCase().replace(/[^a-z]/g,'')))||[];
  const nameField=candidates.find(f=>/^(schoolname|districtname|schooldistrict|name)$/i.test(String(f.alias||f.name).replace(/[^a-z]/gi,'')))||candidates.find(f=>f.name===meta.displayField);
  if(!nameField)throw Error('School name field unavailable');
  const typeField=candidates.find(f=>/^(schooltype|type)$/i.test(String(f.alias||f.name).replace(/[^a-z]/gi,'')));
  const fields=[nameField.name,...(typeField?[typeField.name]:[])];
  const data=await json(BASE+'/'+id+'/query',{f:'json',geometry:JSON.stringify(geometry),geometryType:'esriGeometryPolygon',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:fields.join(','),returnGeometry:'false',resultRecordCount:'20'});
  if(!Array.isArray(data.features)||data.exceededTransferLimit)throw Error('School boundaries incomplete');
  return {type,entries:data.features.map(f=>({name:String(f.attributes?.[nameField.name]||'').trim(),type:typeField?String(f.attributes?.[typeField.name]||'').trim():null})).filter(f=>f.name),sourceURL:BASE+'/'+id};
 }
 const outcomes=await Promise.allSettled([boundary(6,'districts'),boundary(22,'schools')]);
 return {districts:outcomes[0].status==='fulfilled'?outcomes[0].value.entries:[],schools:outcomes[1].status==='fulfilled'?outcomes[1].value.entries:[],districtsAvailable:outcomes[0].status==='fulfilled',schoolsAvailable:outcomes[1].status==='fulfilled',sourceURL:BASE,retrievedAt:new Date().toISOString()};
}
module.exports={fetchSchools};
