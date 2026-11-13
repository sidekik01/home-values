const cheerio=require('cheerio');
const {CountyError}=require('./county.js');
const summaryURL=parcel=>'https://cp.spokanecounty.gov/SCOUT/PropertyInformation/Summary.aspx?PID='+encodeURIComponent(parcel);
const clean=value=>String(value ?? '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const key=value=>clean(value).toLowerCase().replace(/[^a-z0-9]/g,'');
function amount(value){const text=clean(value).replace(/[$,]/g,'');if(!/^\d+(\.\d+)?$/.test(text))return null;const n=Number(text);return Number.isFinite(n)?n:null;}
function year(value){const n=amount(value);return Number.isInteger(n)&&n>=1800&&n<=2200?n:null;}
function date(value){const text=clean(value);const m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return null;const iso=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;const d=new Date(iso+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:null;}
function parseScout(html,parcel){
 const $=cheerio.load(html);$('script,style,noscript,input,textarea').remove();
 const body=clean($('body').text());
 const identity=body.match(/Parcel\s*Number\s*:\s*(\d{5}\.\d{4})/i);
 if(identity?.[1]!==parcel)throw new CountyError('PARCEL_MISMATCH','The county detail page did not identify the selected parcel.');
 const tables=[];
 $('table').each((_,table)=>{
  const rows=$(table).find('tr').filter((_,tr)=>$(tr).closest('table')[0]===table).map((_,tr)=>{
   const cells=$(tr).children('th,td');if(cells.find('table').length)return null;
   const values=[];cells.each((_,cell)=>{const span=Math.min(Number($(cell).attr('colspan'))||1,30);for(let i=1;i<span;i++)values.push('');values.push(clean($(cell).text()));});return [values];
  }).get();
  for(let i=0;i<Math.min(rows.length,8);i++){
   const headers=rows[i].map(key);
   const signatures=[['taxyear','markettotal'],['saledate','saleprice'],['taxyear','chargetype','annualcharges'],['yearbuilt','grosslivingarea'],['neighborhoodcode','neighborhooddesc'],['siteaddress','parceltype']];
   if(signatures.some(sig=>sig.every(h=>headers.includes(h)))){tables.push({headers,rows:rows.slice(i+1).filter(r=>r.length===headers.length).map(r=>Object.fromEntries(headers.map((h,j)=>[h,r[j]])))});break;}
  }
 });
 const find=header=>tables.filter(t=>t.headers.includes(header)).flatMap(t=>t.rows);
 const assessments=find('markettotal').map(r=>({taxYear:year(r.taxyear),assessedValue:amount(r.markettotal),taxableValue:amount(r.taxable),landValue:amount(r.land),structureValue:amount(r.dwellingstructure)})).filter(r=>r.taxYear&&r.assessedValue!==null).sort((a,b)=>b.taxYear-a.taxYear);
 const sales=find('saleprice').filter(r=>!r.parcel||r.parcel===parcel).map(r=>({date:date(r.saledate),price:amount(r.saleprice),instrument:clean(r.saleinstrument)||null})).filter(r=>r.date&&r.price!==null).sort((a,b)=>b.date.localeCompare(a.date));
 const taxRows=find('annualcharges');
 const taxes=taxRows.map(r=>{const m=r.chargetype?.match(/Total Taxes for\s+(\d{4})/i);return m?{taxYear:year(m[1]),totalCharges:amount(r.annualcharges),remainingCharges:amount(r.remainingchargesowing),propertyTax:null}:null;}).filter(r=>r&&r.taxYear&&r.totalCharges!==null);
 for(const tax of taxes){const rows=taxRows.filter(r=>year(r.taxyear)===tax.taxYear&&/^A\/V Property Tax$/i.test(r.chargetype));const values=rows.map(r=>amount(r.annualcharges)).filter(v=>v!==null);if(values.length)tax.propertyTax=values.reduce((a,b)=>a+b,0);}
 taxes.sort((a,b)=>b.taxYear-a.taxYear);
 const structures=find('grosslivingarea').map(r=>({description:clean(r.dwellingstructure)||null,yearBuilt:year(r.yearbuilt),livingArea:amount(r.grosslivingarea),houseType:clean(r.housetype)||null,bedrooms:amount(r.bedroom),fullBaths:amount(r.fullbath),halfBaths:amount(r.halfbath),heat:clean(r.heat)||null,cooling:clean(r.cool)||null,roof:clean(r.roofmaterial)||null})).filter(r=>r.description);
 const neighborhood=find('neighborhooddesc')[0];
 const site=find('parceltype')[0];
 const asOf=body.match(/Data\s+As\s+Of\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
 return {parcel,assessments:assessments.slice(0,30),sales:sales.slice(0,100),taxes:taxes.slice(0,30),structures:structures.slice(0,30),propertyType:clean(site?.description)||null,neighborhood:neighborhood?{code:clean(neighborhood.neighborhoodcode)||null,name:clean(neighborhood.neighborhoodname)||null,description:clean(neighborhood.neighborhooddesc)||null}:null,source:{name:'Spokane County SCOUT',url:summaryURL(parcel),dataAsOf:date(asOf?.[1]),retrievedAt:new Date().toISOString()},sections:{assessments:tables.some(t=>t.headers.includes('markettotal')),sales:tables.some(t=>t.headers.includes('saleprice')),taxes:tables.some(t=>t.headers.includes('annualcharges')),structures:tables.some(t=>t.headers.includes('grosslivingarea'))}};
}
async function fetchScout(parcel,fetcher=fetch){
 if(typeof parcel!=='string'||!/^\d{5}\.\d{4}$/.test(parcel))throw new CountyError('INVALID_QUERY','Select a valid county parcel.',400);
 try{
  const response=await fetcher(summaryURL(parcel),{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'text/html'}});
  if(!response.ok)throw new Error('County HTTP error');
  if(Number(response.headers.get('content-length'))>3000000)throw new Error('County response too large');
  const reader=response.body?.getReader();let html;
  if(reader){const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw new Error('County response too large');}chunks.push(Buffer.from(value));}html=Buffer.concat(chunks).toString('utf8');}else{html=await response.text();if(html.length>3000000)throw new Error('County response too large');}
  return parseScout(html,parcel);
 }catch(error){if(error instanceof CountyError)throw error;throw new CountyError('SCOUT_UNAVAILABLE','The full county record couldn’t be loaded. Your basic parcel details are still available.');}
}
module.exports={parseScout,fetchScout,summaryURL,amount,date};
