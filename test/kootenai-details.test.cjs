const {test}=require('node:test');const assert=require('node:assert/strict');
const {summaryFields,tableRows,mapDetails,fetchKootenaiDetails}=require('../lib/kootenai-details');
const pin='P57150010210';
const summary={summaryData:[{columnData:[{name:{text:'Parcel ID (PIN)'},value:{text:pin}},{name:{text:'Alternate ID (AIN)'},value:{text:'249383'}},{name:{text:'Property Class'},value:{text:'541- Imp Res In-city'}},{name:{text:'Neighborhood'},value:{text:'2526 Montrose'}}]}]};
function table(headers,rows){return {settings:{headers:headers.map(column=>({column,displayName:column}))},data:{groups:[{rows:rows.map(row=>({values:headers.map((column,i)=>({column,value:row[i]}))}))}],totalItems:rows.length}};}
const values=table(['Year','Land Value','Improvement Value','Total Value'],[[2026,200000,261030,461030],[2025,175000,254250,429250]]);
const taxable=table(['Tax Year','Value'],[[2026,336030],[2025,304250]]);
const improvements=table(['Property Record','Improvement ID','Use Code','Description','Year Built','Area','Area Units'],[['R01','D','DWELL','Dwelling',2006,1572,'Fin SF'],['R01','G01','ATTGAR','Attached Garage',2006,550,'SF']]);
const sales=table(['Document Number','Date','Owner','Grantee'],[['2038487','1/1/06','DO NOT EXPOSE','DO NOT EXPOSE']]);
test('parses county summary fields and grouped table response from the saved client schema',()=>{assert.equal(summaryFields(summary).parcelidpin,pin);assert.equal(tableRows(values.data,values.settings)[0].totalvalue,'461030');assert.throws(()=>tableRows({},{}));});
test('keeps finished dwelling and garage separate; transfers have no invented price',()=>{
 const tables=Object.fromEntries(Object.entries({values,taxable,improvements,sales}).map(([name,v])=>[name,tableRows(v.data,v.settings)]));
 const result=mapDetails(pin,summaryFields(summary),tables,{url:'https://id-kootenai.publicaccessnow.com/'});
 assert.equal(result.assessments[0].taxableValue,336030);assert.equal(result.improvements[0].area,1572);assert.equal(result.improvements[1].areaUnits,'SF');assert.equal(result.sales[0].price,null);assert.equal(result.sales[0].date,'2006-01-01');assert.deepEqual(result.taxes,[]);assert(!JSON.stringify(result).includes('DO NOT EXPOSE'));
 assert.throws(()=>mapDetails('P57150010211',summaryFields(summary),tables,{}),{code:'PARCEL_MISMATCH'});
});
test('fetch verifies parcel identity before loading independent details and retains partial results',async()=>{
 const calls=[];
 const fetcher=async(raw,options)=>{const url=new URL(raw);calls.push(url);let result;
 if(url.hostname==='map.kcgov.us')result={features:[{attributes:{PID:pin,Serial:'249383',LRSN:82520}}]};
 else {assert.equal(options.headers.TabId,'39');assert.equal(url.searchParams.get('p'),pin);assert.equal(url.searchParams.get('a'),'82520');const module=url.searchParams.get('_m');if(module==='472')result=summary;else{if(module==='473')throw Error('Sales unavailable');const t={477:values,610:taxable,516:improvements}[module];result=url.pathname.endsWith('GetViewSettings')?t.settings:t.data;}}
 return {ok:true,headers:{get:()=>null},json:async()=>result,text:async()=>JSON.stringify(result)};
 };
 const data=await fetchKootenaiDetails(pin,fetcher);assert.equal(data.assessments.length,2);assert.equal(data.improvements.length,2);assert(data.warnings.some(s=>s.includes('sales')));assert(!data.sections.sales);assert.equal(data.source.url,'https://id-kootenai.publicaccessnow.com/Assessor/PropertySearch/Detail.aspx?p=P57150010210&a=82520');
 let callsBefore=0;await assert.rejects(fetchKootenaiDetails('bad',async()=>{callsBefore++;}),{code:'INVALID_QUERY'});assert.equal(callsBefore,0);
});
