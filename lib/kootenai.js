const {CountyError}=require('./county.js');
const SEARCH_URL='https://id-kootenai.publicaccessnow.com/Assessor/PropertySearch.aspx';
const LAYER_URL='https://map.kcgov.us/arcgis/rest/services/NewServices/Data_Layers/MapServer/8';
// Published county parcel schema. Mailing-address/owner fields are deliberately excluded.
const FIELDS=['PID','Serial','Loc_Addr','Loc_City','Acres','Gross_Val','Net_Val','ZONING'];
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
function normalizeKootenaiQuery(input){
 if(typeof input!=='string'||input.length>200)throw new CountyError('INVALID_QUERY','Enter a property address, PIN, or AIN.',400);
 const value=input.trim().toUpperCase().replace(/\s+/g,' ');
 const pin=value.replace(/-/g,'');
 if(/^[A-Z0-9]{12}$/.test(pin)&&/[0-9]/.test(pin))return {type:'parcel',value:pin};
 if(/^\d{5,6}$/.test(value))return {type:'account',value:value.padStart(6,'0')};
 if(!/^[A-Z0-9\s.,'#\/-]+$/.test(value))throw new CountyError('INVALID_QUERY','Enter a street address or a county PIN without dashes.',400);
 const street=value.split(',')[0].replace(/\s+(?:COEUR D['’]?ALENE|POST FALLS|HAYDEN(?: LAKE)?|RATHDRUM|SPIRIT LAKE|ATHOL|DALTON GARDENS)(?:\s+ID(?:AHO)?)?(?:\s+\d{5})?$/,'').replace(/\./g,'');
 const short={NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',STREET:'ST',AVENUE:'AVE',ROAD:'RD',DRIVE:'DR',LANE:'LN',COURT:'CT',BOULEVARD:'BLVD',PLACE:'PL',HIGHWAY:'HWY',CIRCLE:'CIR',TERRACE:'TER'};
 const tokens=street.split(' ').map(s=>short[s]||s);
 if(!/^\d+[A-Z]?$/.test(tokens[0])||tokens.length<2)throw new CountyError('INVALID_QUERY','Start with the house number and street name, or enter the county PIN or AIN.',400);
 return {type:'address',tokens};
}
function kootenaiWhere(q){
 if(q.type==='parcel')return 'PID = '+quote(q.value);
 if(q.type==='account')return 'Serial = '+quote(q.value);
 return ['UPPER(Loc_Addr) LIKE '+quote(q.tokens[0]+' %'),...q.tokens.slice(1).map(t=>'UPPER(Loc_Addr) LIKE '+quote('%'+t+'%'))].join(' AND ');
}
const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
const number=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))||Number(v)<0?null:Number(v);
function mapKootenaiProperty(a,fetchedAt){
 const parcel=text(a.PID);if(!parcel||!/^[A-Z0-9]{12}$/.test(parcel))return null;
 const account=text(a.Serial);const validAccount=account&&/^\d{5,6}$/.test(account)?account:null;
 const recordURL=SEARCH_URL.replace(/\.aspx$/,'/Detail.aspx')+'?'+new URLSearchParams({p:parcel});
 return {county:'kootenai-id',parcel,account:validAccount,address:text(a.Loc_Addr),city:text(a.Loc_City),state:'ID',zip:null,unit:null,propertyUse:null,propertyUseCode:null,zoning:text(a.ZONING),acreage:number(a.Acres),assessedValue:number(a.Gross_Val),taxableValue:number(a.Net_Val),landValue:null,assessmentYear:null,taxYear:null,source:{name:'Kootenai County public parcel data',catalogURL:LAYER_URL,layerURL:LAYER_URL,recordURL,fetchedAt}};
}
function createKootenaiClient(fetcher=fetch){
 return async function search(input){
  const q=normalizeKootenaiQuery(input);
  const params=new URLSearchParams({f:'json',where:kootenaiWhere(q),outFields:FIELDS.join(','),returnGeometry:'false',resultRecordCount:'9',orderByFields:'Loc_Addr,PID'});
  try{
   const response=await fetcher(LAYER_URL+'/query?'+params,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('County HTTP error');
   const data=await response.json();if(data.error||!Array.isArray(data.features))throw Error('County response error');
   const fetchedAt=new Date().toISOString();const seen=new Set();
   const properties=data.features.map(f=>mapKootenaiProperty(f.attributes||{},fetchedAt)).filter(p=>p&&!seen.has(p.parcel)&&seen.add(p.parcel));
   return {properties:properties.slice(0,8),hasMore:!!data.exceededTransferLimit||properties.length>8,source:{name:'Kootenai County public parcel data',catalogURL:LAYER_URL,fetchedAt}};
  }catch{throw new CountyError('COUNTY_UNAVAILABLE','Kootenai County’s parcel service is temporarily unavailable. Please try again or open the county search.');}
 };
}
module.exports={createKootenaiClient,normalizeKootenaiQuery,kootenaiWhere,mapKootenaiProperty,SEARCH_URL,LAYER_URL};
