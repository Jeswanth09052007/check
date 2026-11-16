// Used only by tests started explicitly with node --require and a private test directory.
const fs=require('node:fs'),path=require('node:path');
const original=global.fetch;
global.fetch=async(url,options)=>{
  if(String(url).startsWith('https://formspree.io/f/')){
    if(!process.env.FORMSPREE_TEST_DIR)throw Error('Missing private mock directory');
    const folder=process.env.FORMSPREE_TEST_DIR;
    const payload=JSON.parse(options.body);
    fs.appendFileSync(path.join(folder,'mail.jsonl'),JSON.stringify({url:String(url),payload})+'\n');
    return new Response(JSON.stringify(fs.existsSync(path.join(folder,'fail'))?{errors:[{message:'Mock failure'}]}:{ok:true}),{status:fs.existsSync(path.join(folder,'fail'))?422:200});
  }
  return original(url,options);
};
