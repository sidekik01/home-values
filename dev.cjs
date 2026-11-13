const http=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const handler=require('./api/county.js');
const detailsHandler=require('./api/county-details.js');
const root=path.join(__dirname,'public');
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(['/api/county','/api/county-details'].includes(url.pathname)){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>2048){res.writeHead(413);res.end();return;}}
  req.body=body;res.status=code=>{res.statusCode=code;return res};res.json=data=>res.end(JSON.stringify(data));res.setHeader('Content-Type','application/json');return (url.pathname==='/api/county-details'?detailsHandler:handler)(req,res);
 }
 try{const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!filename.startsWith(root+path.sep))throw Error();const data=await readFile(filename);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'};res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end('Not found')}
}).listen(3001,'0.0.0.0',()=>console.log('Home Values: http://localhost:3001'));
