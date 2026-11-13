const {createCountyClient, CountyError} = require('../lib/county.js');
const search = createCountyClient();
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'Use the address search to look up a property.'}}); }
  if(!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({error:{code:'INVALID_BODY',message:'Send a JSON search request.'}});
  try {
    if(Number(req.headers['content-length'])>2048) throw new CountyError('INVALID_BODY','Search request is too large.',413);
    let body=req.body;
    if(typeof body === 'string') { if(body.length>2048) throw new CountyError('INVALID_BODY','Search request is too large.',413); try { body=JSON.parse(body); } catch { throw new CountyError('INVALID_BODY','Enter an address or parcel number.',400); } }
    const result=await search(body?.query);
    return res.status(200).json(result);
  } catch(error) {
    const known=error instanceof CountyError;
    return res.status(known?error.status:503).json({error:{code:known?error.code:'COUNTY_UNAVAILABLE',message:known?error.message:'County search is temporarily unavailable. Please try again.'}});
  }
};
