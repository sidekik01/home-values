const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createKootenaiClient,normalizeKootenaiQuery,kootenaiWhere,mapKootenaiProperty}=require('../lib/kootenai.js');
const attrs={PID:'P57150010210',Serial:'249383',Loc_Addr:'1456 W TUALATIN DR',Loc_City:'POST FALLS',Acres:0.155,Gross_Val:461030,Net_Val:336030,ZONING:'R1',Name:'DO NOT EXPOSE',Addr1:'DO NOT EXPOSE'};
test('Kootenai accepts PIN with dashes, AIN, or normalized property address',()=>{
 assert.equal(normalizeKootenaiQuery('P5715-001-0210').value,'P57150010210');
 assert.equal(kootenaiWhere(normalizeKootenaiQuery('249383')),"Serial = '249383'");
 assert.match(kootenaiWhere(normalizeKootenaiQuery('1456 West Tualatin Drive, Post Falls, ID')),/1456 %/);
 for(const bad of ['',null,'Tualatin','1456 %',"1456'; DROP TABLE x;--",'x'.repeat(201)])assert.throws(()=>normalizeKootenaiQuery(bad));
 assert.match(kootenaiWhere(normalizeKootenaiQuery("100 O'NEILL RD")),/O''NEILL/);
});
test('Kootenai maps property fields without owner/mailing data or invented dates',()=>{
 const p=mapKootenaiProperty(attrs,'now');assert.equal(p.assessedValue,461030);assert.equal(p.taxableValue,336030);assert.equal(p.acreage,.155);assert.equal(p.assessmentYear,null);assert.equal(p.state,'ID');
 assert(!JSON.stringify(p).includes('DO NOT EXPOSE'));
 // AIN and URL account are distinct identifiers; never substitute AIN for a=.
 assert.equal(new URL(p.source.recordURL).searchParams.get('p'),attrs.PID);assert(!new URL(p.source.recordURL).searchParams.has('a'));
 assert.equal(mapKootenaiProperty({...attrs,Gross_Val:null,Net_Val:0},'now').assessedValue,null);
 assert.equal(mapKootenaiProperty({...attrs,Net_Val:0},'now').taxableValue,0);
 assert.equal(mapKootenaiProperty({...attrs,PID:'bad'},'now'),null);
});
test('Kootenai requests only county property fields and caps candidate results',async()=>{
 let url;const client=createKootenaiClient(async u=>{url=new URL(u);return {ok:true,json:async()=>({features:Array.from({length:9},(_,i)=>({attributes:{...attrs,PID:'P5715001021'+i}}))})};});
 const result=await client('1456 W Tualatin Dr');assert.equal(result.properties.length,8);assert.equal(result.hasMore,true);assert.equal(url.hostname,'map.kcgov.us');assert.equal(url.searchParams.get('returnGeometry'),'false');assert(!/Name|Addr1/.test(url.searchParams.get('outFields')));
});
test('Kootenai handles empty, duplicate and failed county responses',async()=>{
 const search=features=>createKootenaiClient(async()=>({ok:true,json:async()=>({features})}));
 assert.deepEqual((await search([])('249383')).properties,[]);
 assert.equal((await search([{attributes:attrs},{attributes:attrs}])('249383')).properties.length,1);
 for(const data of [{error:{}},{}])await assert.rejects(createKootenaiClient(async()=>({ok:true,json:async()=>data}))('249383'),{code:'COUNTY_UNAVAILABLE'});
 await assert.rejects(createKootenaiClient(async()=>{throw Error('timeout');})('249383'),{code:'COUNTY_UNAVAILABLE'});
});
