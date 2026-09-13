// Campaign level data for Node tools. js/campaign.js keeps the levels next to UI
// code, but its top level only declares data and functions, so it runs on its own.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');

let levels=null;
module.exports=function campaignLevels(){
  if(!levels){
    const src=fs.readFileSync(path.join(__dirname,'..','js','campaign.js'),'utf8');
    levels=JSON.parse(JSON.stringify(vm.runInNewContext(src+'\n;CAMPAIGN_LEVELS',{})));
  }
  return levels;
};
