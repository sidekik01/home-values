const ITEM_ID = '228db1be1d6940a3b5e3f2104e470134';
const CATALOG_URL = `https://gisdatacatalog-spokanecounty.opendata.arcgis.com/datasets/${ITEM_ID}_0`;
const ITEM_URL = `https://www.arcgis.com/sharing/rest/content/items/${ITEM_ID}?f=json`;
const SAFE_FIELDS = ['PID_NUM','parcel','site_address','site_city','site_state','site_zip','site_apartment','prop_use_desc','prop_use_code','acreage','assessed_amt','taxable_amt','land_value','asmt_year','assr_year','tax_year'];
class CountyError extends Error { constructor(code, message, status = 503) { super(message); this.code = code; this.status = status; } }
function normalizeQuery(input) {
  if (typeof input !== 'string' || input.length > 200) throw new CountyError('INVALID_QUERY', 'Enter a street address or parcel number.', 400);
  const value = input.trim().toUpperCase().replace(/\s+/g,' ');
  if (!value || !/^[A-Z0-9\s.,'#\/-]+$/.test(value)) throw new CountyError('INVALID_QUERY', 'Use a street address or a parcel number, such as 35182.4601.', 400);
  if (/^\d{5}\.\d{4}$/.test(value)) return {type:'parcel',value};
  const street = value.split(',')[0].replace(/\s+SPOKANE(?: VALLEY)?(?:\s+(?:WA|WASHINGTON))?(?:\s+\d{5}(?:-\d{4})?)?$/, '').replace(/[.]/g,'');
  const replacements = {NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',NORTHEAST:'NE',NORTHWEST:'NW',SOUTHEAST:'SE',SOUTHWEST:'SW',STREET:'ST',AVENUE:'AVE',ROAD:'RD',DRIVE:'DR',LANE:'LN',COURT:'CT',BOULEVARD:'BLVD',PLACE:'PL',TERRACE:'TER',HIGHWAY:'HWY',CIRCLE:'CIR'};
  const tokens = street.split(/\s+/).map(t=>replacements[t] || t);
  if (!/^\d+[A-Z]?$/.test(tokens[0]) || tokens.length < 2) throw new CountyError('INVALID_QUERY','Start with a house number and street name, or enter a parcel number.',400);
  return {type:'address',value:tokens.join(' '),tokens};
}
const sqlString = value => `'${value.replace(/'/g,"''")}'`;
function buildWhere(query, fields) {
  if (query.type === 'parcel') {
    const names = ['PID_NUM','parcel'].filter(name=>fields.includes(name));
    if (!names.length) throw new CountyError('SCHEMA_UNAVAILABLE','County parcel search is temporarily unavailable.');
    return '('+names.map(name=>`${name} = ${sqlString(query.value)}`).join(' OR ')+')';
  }
  if (!fields.includes('site_address')) throw new CountyError('SCHEMA_UNAVAILABLE','County address search is temporarily unavailable.');
  // Match house number as a whole prefix; return candidates for explicit confirmation.
  return [`UPPER(site_address) LIKE ${sqlString(query.tokens[0]+' %')}`,...query.tokens.slice(1).map(t=>`UPPER(site_address) LIKE ${sqlString('%'+t+'%')}`)].join(' AND ');
}
function safeLayerURL(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !/(^|\.)(spokanecounty\.org|arcgis\.com)$/.test(url.hostname) || !/\/(MapServer|FeatureServer)(\/\d+)?\/?$/i.test(url.pathname)) throw new CountyError('SOURCE_UNAVAILABLE','County source configuration is unavailable.');
  url.search = ''; url.hash = '';
  if (!/\/\d+\/?$/.test(url.pathname)) url.pathname = url.pathname.replace(/\/$/,'')+'/0';
  return url.toString().replace(/\/$/,'');
}
async function getJSON(url, fetcher, signal) {
  const response = await fetcher(url,{signal,redirect:'error',headers:{Accept:'application/json'}});
  if (!response.ok) throw new CountyError('COUNTY_UNAVAILABLE','The county data service is temporarily unavailable. Please try again.');
  const body = await response.json();
  if (body.error) throw new CountyError('COUNTY_UNAVAILABLE','The county data service could not complete this search.');
  return body;
}
function numberOrNull(value) { if(value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }
function textOrNull(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function mapProperty(a, layerURL, fetchedAt) {
  const parcel = textOrNull(a.PID_NUM) || textOrNull(a.parcel);
  if (!parcel || !/^\d{5}\.\d{4}$/.test(parcel)) return null;
  return {parcel,address:textOrNull(a.site_address),city:textOrNull(a.site_city),state:textOrNull(a.site_state),zip:textOrNull(a.site_zip),unit:textOrNull(a.site_apartment),propertyUse:textOrNull(a.prop_use_desc),propertyUseCode:textOrNull(a.prop_use_code),acreage:numberOrNull(a.acreage),assessedValue:numberOrNull(a.assessed_amt),taxableValue:numberOrNull(a.taxable_amt),landValue:numberOrNull(a.land_value),assessmentYear:numberOrNull(a.asmt_year) || numberOrNull(a.assr_year),taxYear:numberOrNull(a.tax_year),source:{name:'Spokane County public parcel data',catalogURL:CATALOG_URL,layerURL,fetchedAt,recordURL:'https://cp.spokanecounty.gov/scout/SCOUTDashboard/'}};
}
function createCountyClient(fetcher = fetch) {
  let metadata;
  async function source(signal) {
    if(metadata && metadata.expires > Date.now()) return metadata;
    const item = await getJSON(ITEM_URL,fetcher,signal);
    if(!item.url) throw new CountyError('SOURCE_UNAVAILABLE','County source configuration is unavailable.');
    const layerURL = safeLayerURL(item.url);
    const layer = await getJSON(layerURL+'?f=json',fetcher,signal);
    const fields = SAFE_FIELDS.filter(name=>layer.fields?.some(field=>field.name===name));
    if(!fields.includes('assessed_amt')) throw new CountyError('SCHEMA_UNAVAILABLE','Assessment data is temporarily unavailable from the county feed.');
    metadata={layerURL,fields,expires:Date.now()+3600000};
    return metadata;
  }
  return async function search(input) {
    const query=normalizeQuery(input);
    const signal=AbortSignal.timeout(12000);
    try {
      const {layerURL,fields}=await source(signal);
      const params = new URLSearchParams({f:'json',where:buildWhere(query,fields),outFields:fields.join(','),returnGeometry:'false',resultRecordCount:'9',orderByFields:'site_address'});
      const data=await getJSON(layerURL+'/query?'+params,fetcher,signal);
      if(!Array.isArray(data.features)) throw new CountyError('COUNTY_UNAVAILABLE','The county returned an unexpected response.');
      const fetchedAt=new Date().toISOString();
      const seen=new Set();
      const properties=data.features.map(f=>mapProperty(f.attributes || {},layerURL,fetchedAt)).filter(p=>p && !seen.has(p.parcel) && seen.add(p.parcel));
      return {properties:properties.slice(0,8),hasMore:!!data.exceededTransferLimit || properties.length>8,source:{name:'Spokane County public parcel data',catalogURL:CATALOG_URL,fetchedAt}};
    } catch(error) {
      if(error instanceof CountyError) throw error;
      throw new CountyError('COUNTY_UNAVAILABLE','We couldn’t reach the county data service. Please try again shortly.');
    }
  };
}
module.exports={createCountyClient,normalizeQuery,buildWhere,mapProperty,safeLayerURL,CountyError};
