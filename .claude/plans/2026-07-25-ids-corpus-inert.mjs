// Measure exactly what our parser does: applicabilityEntityNames is built only from
// <entity> facets whose <name> has a <simpleValue> (parse-ids.ts:145). Empty => matches nothing.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "/root/IfcChecker/packages/ids-validator/node_modules/fast-xml-parser/src/fxp.js";
const A=":@", T="#text";
const p=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",removeNSPrefix:true,parseTagValue:false,preserveOrder:true});
const tag=n=>Object.keys(n).find(k=>k!==A)??null, kids=(n,t)=>Array.isArray(n[t])?n[t]:[];
const desc=(ns,t)=>{const n=ns.find(c=>tag(c)===t);return n?kids(n,t):[]};
const named=(ns,t)=>ns.filter(n=>tag(n)===t);
function walk(d,o=[]){for(const e of readdirSync(d)){const q=join(d,e);let s;try{s=statSync(q)}catch{continue}
  if(s.isDirectory())walk(q,o);else if(e.toLowerCase().endsWith(".ids"))o.push(q)}return o}
const ROOT="/tmp/ids-corpus";
const corpora=[["A",[`${ROOT}/IDS-development/Documentation/ImplementersDocumentation/TestCases`]],
["B",[`${ROOT}/IDS-development/Documentation/Examples`]],
["C",[`${ROOT}/bSJ_IDS-main/bimcim-cost-estimation/令和7年度用（202510_01）`]],
["D",[`${ROOT}/Community-Sample-Test-Files-main`,`${ROOT}/IDS_BimBem-main`,`${ROOT}/OpenAEC-BIM-validator-master`,`${ROOT}/ifc-audit-master`]]];
for(const [label,dirs] of corpora){
  let specs=0, inert=0, widened=0;
  const files=[]; for(const d of dirs){try{files.push(...walk(d))}catch{}}
  for(const f of files){
    let root; try{root=p.parse(readFileSync(f,"utf8"))}catch{continue}
    for(const sp of named(desc(desc(root,"ids"),"specifications"),"specification")){
      specs++;
      const app=desc(kids(sp,"specification"),"applicability");
      const facets=app.filter(n=>tag(n)&&tag(n)!==T);
      const usable=named(facets,"entity").filter(e=>{
        const nm=desc(kids(e,"entity"),"name");
        return nm.some(n=>tag(n)==="simpleValue");
      }).length;
      if(usable===0) inert++;
      else if(usable<facets.length) widened++;
    }
  }
  const pc=n=>`${((n/(specs||1))*100).toFixed(1)}%`;
  console.log(`${label}: specs=${specs}  silently inert (0 usable entity names) = ${inert} (${pc(inert)})   widened (some facets dropped, >=1 entity kept) = ${widened} (${pc(widened)})`);
}
