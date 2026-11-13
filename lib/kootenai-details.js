const {CountyError}=require('./county.js');
const {createKootenaiClient}=require('./kootenai.js');
const HOST='https://id-kootenai.publicaccessnow.com';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
const number=v=>{const s=clean(v).replace(/[$,]/g,'');return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;};
const year=v=>{const n=number(v);return Number.isInteger(n)&&n>=1800&&n<=2200?n:null;};
function date(v){const s=clean(v);const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s|$)/);if(!m)return null;const y=m[3].length===2?(Number(m[3])>40?'19':'20')+m[3]:m[3];const iso=`${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;const d=new Date(iso+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:null;}
// Shape documented by the county's saved DataDisplay and AccountSummary client bundles.
function summaryFields(data){
 const fields={};for(const group of data?.summaryData||[]){for(const item of group.columnData||[]){const name=key(item.name?.text);if(name)fields[name]=clean(item.value?.text);}}
 return fields;
}
function tableRows(data,settings){
 if(!Array.isArray(data?.groups)||!Array.isArray(settings?.headers))throw Error('Unexpected county table');
 const columns=new Map(settings.headers.map(h=>[h.column,key(h.displayName||h.column)]));
 return data.groups.flatMap(g=>g.rows||[]).slice(0,100).map(row=>{
  const cells=Array.isArray(row)?row:row.values;
  if(!Array.isArray(cells))throw Error('Unexpected county row');
  const result={};for(const c of cells){const name=columns.get(c.column);if(name)result[name]=clean(c.value);}
  return result;
 });
}
function mapDetails(parcel,fields,tables,source){
 if(fields.parcelidpin!==parcel)throw new CountyError('PARCEL_MISMATCH','Kootenai County did not identify the selected parcel.');
 const taxable=new Map((tables.taxable||[]).map(r=>[year(r.taxyear),number(r.value)]));
 const assessments=(tables.values||[]).map(r=>({taxYear:year(r.year),assessedValue:number(r.totalvalue),landValue:number(r.landvalue),structureValue:number(r.improvementvalue),taxableValue:taxable.get(year(r.year))??null})).filter(r=>r.taxYear&&r.assessedValue!==null).sort((a,b)=>b.taxYear-a.taxYear);
 const improvements=(tables.improvements||[]).map(r=>({description:r.description||r.usecode,yearBuilt:year(r.yearbuilt),area:number(r.area),areaUnits:r.areaunits||null,record:r.propertyrecord||null,improvementID:r.improvementid||null})).filter(r=>r.description);
 const sales=(tables.sales||[]).map(r=>({date:date(r.date),price:null,instrument:r.documentnumber||null})).filter(r=>r.date);
 const neighborhood=fields.neighborhood?{description:fields.neighborhood}:null;
 return {county:'kootenai-id',parcel,photos:[],assessments,improvements,structures:[],sales,taxes:[],propertyType:fields.propertyclass||null,neighborhood,schools:null,source,sections:{assessments:!!tables.values,sales:!!tables.sales,taxes:false,structures:!!tables.improvements},warnings:['Kootenai property photos, tax bills, and school boundaries are not connected.'],historyLimited:!!tables.historyLimited};
}
async function fetchKootenaiDetails(parcel,fetcher=fetch){
 if(typeof parcel!=='string'||!/^[A-Z0-9]{12}$/.test(parcel))throw new CountyError('INVALID_QUERY','Select a valid Kootenai PIN.',400);
 const signal=AbortSignal.timeout(18000);
 const search=createKootenaiClient(fetcher);const result=await search(parcel);const property=result.properties.find(p=>p.parcel===parcel);
 if(!property)throw new CountyError('PARCEL_MISMATCH','The selected Kootenai parcel could not be verified.');
 const params=new URL(property.source.recordURL).searchParams;
 async function get(path,module,extra={}){
  const query=new URLSearchParams(params);query.set('_m',String(module));for(const [k,v]of Object.entries(extra))query.set(k,String(v));
  const response=await fetcher(HOST+path+'?'+query,{signal,redirect:'error',headers:{Accept:'application/json',ModuleId:String(module),TabId:'39'}});
  if(!response.ok)throw Error('County HTTP error');
  if(Number(response.headers?.get('content-length'))>2000000)throw Error('County response too large');
  const raw=await response.text();if(raw.length>2000000)throw Error('County response too large');return JSON.parse(raw);
 }
 try{
  const summary=summaryFields(await get('/API/AccountSummary/AccountSummary/GetData',472));
  if(summary.parcelidpin!==parcel)throw new CountyError('PARCEL_MISMATCH','Kootenai County did not identify the selected parcel.');
  const modules={taxable:610,values:477,improvements:516,sales:473};
  const tables={};const warnings=[];
  await Promise.all(Object.entries(modules).map(async([name,id])=>{try{
   const [settings,data]=await Promise.all([get('/API/DataDisplay/DataSources/GetViewSettings',id),get('/API/DataDisplay/DataSources/GetData',id,{itemsPerPage:100,page:1})]);
   tables[name]=tableRows(data,settings);if(Number(data.totalItems)>tables[name].length)tables.historyLimited=true;
  }catch{warnings.push('Kootenai '+name+' details could not be loaded.');}}));
  const data=mapDetails(parcel,summary,tables,{name:'Kootenai County Assessor',url:property.source.recordURL,retrievedAt:new Date().toISOString(),dataAsOf:null});data.warnings.push(...warnings);return data;
 }catch(error){if(error instanceof CountyError)throw error;throw new CountyError('COUNTY_UNAVAILABLE','Kootenai County details are temporarily unavailable. Your basic property record is still available.');}
}
module.exports={summaryFields,tableRows,mapDetails,fetchKootenaiDetails};
