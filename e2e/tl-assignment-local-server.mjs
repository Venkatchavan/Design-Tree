// Production frontend bundle + disposable native API/MongoDB, loopback only.
import http from 'node:http';
import net from 'node:net';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {startLocalFixture} from './local-fixture.mjs';
const fixture=await startLocalFixture(19520),dist=resolve(import.meta.dirname,'../web/dist');
await fixture.models.Project.findByIdAndUpdate(fixture.project,{jobNumber:'JOB-26-442'});
await fixture.models.Team.updateMany({lead:fixture.cast.tl.employee},{$set:{members:[]}});
await fixture.models.Team.create({name:'Confirmed saved project roster',service:'STR',projects:[fixture.project],lead:fixture.cast.outsider.employee,members:[{employee:fixture.cast.engineer.employee}]});
const fixtureFile='/tmp/designtree-stakeholder-fixture.json';
const {models,stop,...state}=fixture;
await writeFile(fixtureFile,JSON.stringify(state),{mode:0o600});
const connections=new Set();
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')||req.url.startsWith('/socket.io/')){
  const proxy=http.request(new URL(req.url,fixture.base),{method:req.method,headers:req.headers},response=>{
   res.writeHead(response.statusCode,response.headers);response.pipe(res);
  });
  proxy.on('error',()=>{res.writeHead(502);res.end('Local fixture unavailable');});req.pipe(proxy);return;
 }
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1:5173').pathname);
 const file=resolve(dist,pathname.includes('.')?'.'+pathname:'index.html');
 if(!file.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
 try{const content=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webmanifest':'application/manifest+json'})[extname(file)]??'application/octet-stream');res.end(content);}
 catch{res.writeHead(404);res.end();}
});
server.on('connection',socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket));});
server.on('upgrade',(req,socket,head)=>{
 const upstream=net.connect(19520,'127.0.0.1',()=>{
  upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`+Object.entries(req.headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')+'\r\n');
  if(head.length)upstream.write(head);socket.pipe(upstream).pipe(socket);
 });
 upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
});
await new Promise(r=>server.listen(5173,'127.0.0.1',r));
console.log('Isolated production frontend ready at http://127.0.0.1:5173; local fixture saved.');
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{
 if(stopping)return;stopping=true;for(const socket of connections)socket.destroy();server.close();
 await stop();await unlink(fixtureFile).catch(()=>{});process.exit(0);
});
