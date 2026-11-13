const {fetchScout}=require('../lib/scout.js');
const {fetchSchools}=require('../lib/schools.js');
const {CountyError}=require('../lib/county.js');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:{message:'Use property search to select a parcel.'}});}
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:{message:'Send a JSON parcel request.'}});
 try{let body=req.body;if(Number(req.headers['content-length'])>1024)throw new CountyError('INVALID_BODY','Request too large.',413);if(typeof body==='string'){if(body.length>1024)throw new CountyError('INVALID_BODY','Request too large.',413);try{body=JSON.parse(body);}catch{throw new CountyError('INVALID_BODY','Select a valid parcel.',400);}}const parcel=body?.parcel;if(typeof parcel!=='string'||!/^\d{5}\.\d{4}$/.test(parcel))throw new CountyError('INVALID_QUERY','Select a valid county parcel.',400);
 const [scout,schools]=await Promise.allSettled([fetchScout(parcel),fetchSchools(parcel)]);
 if(scout.status==='rejected'&&schools.status==='rejected')throw scout.reason;
 const data=scout.status==='fulfilled'?scout.value:{parcel,photos:[],assessments:[],sales:[],taxes:[],structures:[],neighborhood:null,propertyType:null,sections:{},source:null};
 data.schools=schools.status==='fulfilled'?schools.value:null;
 data.warnings=[...(scout.status==='rejected'?['SCOUT details could not be loaded.']:[]),...(schools.status==='rejected'?['School boundaries could not be loaded.']:[])];
 return res.status(200).json(data);}catch(error){return res.status(error instanceof CountyError?error.status:503).json({error:{code:error.code||'SCOUT_UNAVAILABLE',message:error instanceof CountyError?error.message:'Full county details are temporarily unavailable.'}});}
};
