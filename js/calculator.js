
let DB = null;
let lastRows = [];

const RNA = new Set(["A","C","G","U"]);
const MOE = new Set(["H","J","K","L"]);
const DNA = new Set(["dA","dC","dG","dT"]);
const baseOf = {"H":"A","J":"C","K":"G","L":"U","dA":"A","dC":"C","dG":"G","dT":"T","A":"A","C":"C","G":"G","U":"U"};
const compRNA = {"A":"U","C":"G","G":"C","U":"A","H":"U","J":"G","K":"C","L":"A","dA":"U","dC":"G","dG":"C","dT":"A"};
const moeToRNA = {"H":"A","J":"C","K":"G","L":"U"};
const dnaToRNA = {"dA":"A","dC":"C","dG":"G","dT":"U"};
const dnaLetters = {"dA":"A","dC":"C","dG":"G","dT":"T"};
const moeLongToInternal = {"AE":"H","CE":"J","GE":"K","UE":"L"};
const internalToMoeLong = {"H":"Ae","J":"Ce","K":"Ge","L":"Ue"};

function $(id){return document.getElementById(id);}
function fmt(x){return (typeof x==="number" && isFinite(x)) ? x.toFixed(2) : "—";}
function sanitize(s){return (s||"").replace(/\s+/g,"").replace(/’|‘/g,"'");}

function tokenize(seq, allowCompactDNA=false){
  seq = sanitize(seq);
  const out = [];
  for(let i=0;i<seq.length;i++){
    const ch0 = seq[i];

    // User-facing MOE notation: Ae, Ce, Ge, Ue.
    // Internally these are converted to the original parameter symbols H, J, K, L (A,C,G,U = H,J,K,L).
    if(i+1 < seq.length && seq[i+1].toLowerCase() === "e"){
      const key = ch0.toUpperCase() + "E";
      if(moeLongToInternal[key]){
        out.push(moeLongToInternal[key]);
        i += 1;
        continue;
      }
    }

    // DNA notation for user input is dA, dC, dG, or dT.
    // For user input, parse only one DNA residue after each d, so dCGe is read as dC + Ge.
    // For internal parameter keys, compact DNA strings such as dAG or dTT are allowed.
    if((ch0==="d" || ch0==="D") && i+1<seq.length){
      const b = seq[i+1].toUpperCase();
      if(!"ACGT".includes(b)) throw new Error("DNA residues must be written as dA, dC, dG, or dT.");
      if(allowCompactDNA){
        let j=i+1;
        while(j<seq.length && "ACGT".includes(seq[j].toUpperCase())) j++;
        // If the DNA run is followed by e, the last A/C/G/U belongs to an MOE token (e.g., dCGe = dC + Ge).
        if(j<seq.length && seq[j].toLowerCase()==="e" && j>i+2) j--;
        for(let k=i+1;k<j;k++) out.push("d" + seq[k].toUpperCase());
        i = j-1;
        continue;
      }
      out.push("d" + b);
      i += 1;
      continue;
    }

    const ch = ch0.toUpperCase();
    if("ACGUHJKL".includes(ch)) out.push(ch); // H/J/K/L retained as legacy notation
    else if(ch==="T") throw new Error("Single-letter T is not used. Please use dT for DNA.");
    else throw new Error("Unsupported character/token near: "+seq.slice(i,i+4));
  }
  return out;
}

function tokensToString(tokens){return tokens.join("");}
function displayToken(t){return internalToMoeLong[t] || t;}
function displayTokens(tokens){return tokens.map(displayToken).join("");}
function displayKey(key){
  if(!key || key==="—" || key==="not found") return key;
  if(!key.includes("/")) return key;
  const [a,b] = key.split("/");
  try{return displayTokens(tokenize(a,true)) + "/" + displayTokens(tokenize(b,true));}
  catch(e){return key.replace(/[HJKL]/g, m=>internalToMoeLong[m]||m);}
}

function autoFillB(){
  try{
    const a = tokenize($("strandA").value);
    const b = a.map(t => compRNA[t]);
    $("strandB").value = tokensToString(b);
  }catch(e){setMessage(e.message,"bad");}
}

function setMessage(text, type=""){
  const m=$("message"); m.textContent=text; m.className="msg"+(type?" "+type:"");
}

function pairKey(top2, bot2){
  return top2.join("") + "/" + bot2.join("");
}
function splitPair(key){
  const p = key.split("/");
  return [p[0], p[1]];
}
function reverseStr(s){
  // preserve dA tokens where present
  const toks = tokenize(s,true);
  return toks.reverse().join("");
}
function keyVariants(key){
  const [top,bottom]=splitPair(key);
  let vars = [
    key,
    reverseStr(bottom)+"/"+reverseStr(top),  // 5′XY/3′ZW = 5′WZ/3′YX
    bottom+"/"+top,                          // strand-swapped convention
    reverseStr(top)+"/"+reverseStr(bottom)
  ];
  // unique
  return [...new Set(vars)];
}
function getSet(setName){return DB.sets[setName];}

function findParam(setName, key){
  const set=getSet(setName); if(!set) return null;
  const entries=set.entries || {};
  for(const k of keyVariants(key)){
    if(entries[k]) return {param:k, set:setName, rec:entries[k], approx:false};
  }
  return null;
}

function isMOE(t){return MOE.has(t);}
function isDNA(t){return DNA.has(t);}
function isRNA(t){return RNA.has(t);}
function typeOf(t){if(isMOE(t)) return "MOE"; if(isDNA(t)) return "DNA"; if(isRNA(t)) return "RNA"; return "UNK";}

function convertTopForSet(tokens, target){
  if(target==="ALT"){
    return tokens.map(t => isDNA(t) ? dnaToRNA[t] : (isMOE(t) ? t : t));
  }
  if(target==="RRHD"){
    return tokens.map(t => isMOE(t) ? t : (isDNA(t) ? dnaToRNA[t] : t));
  }
  if(target==="RNA"){
    return tokens.map(t => isMOE(t) ? moeToRNA[t] : (isDNA(t) ? dnaToRNA[t] : t));
  }
  if(target==="RNADNA"){
    // RNA/DNA table convention usually RNA/DNA. Construct DNA side in dXY and RNA side as bottom.
    return tokens.map(t => isDNA(t) ? ("d"+dnaLetters[t]) : t);
  }
  return tokens;
}

function compactDNA(tokens){
  // RNA/DNA hybrid parameter tables use compact DNA notation such as dAG, dCT, dTT, not dAdG or dCdT.
  return "d" + tokens.map(t => dnaLetters[t]).join("");
}

function constructRNADNAKey(top2, bot2){
  // Strand A is the DNA/gapmer strand written 5′→3′, whereas Strand B is the RNA complement written 3′→5′.
  // The RNA/DNA hybrid parameter table is stored as RNA(5′→3′)/DNA(5′→3′), e.g. CU/dAG.
  // Therefore dAdG/3′-UC-5′ is converted to 5′-CU-3′/5′-dAG-3′ = CU/dAG.
  const dna5 = compactDNA(top2);
  const rna5 = bot2.slice().reverse().join("");
  return rna5 + "/" + dna5;
}

function chooseMixed(top2, bot2, condition){
  const hasMOE = top2.some(isMOE), hasDNA = top2.some(isDNA), hasRNA = top2.some(isRNA);
  const suffix = condition==="PEG" ? "PEG" : "dilute";

  if(top2.every(isMOE)){
    return {set:"RRHD_"+suffix, key: pairKey(top2, bot2), rule:"RRHD local MOE/MOE"};
  }
  if(top2.every(isDNA)){
    return {set:"RNA_DNA_"+suffix, key: constructRNADNAKey(top2, bot2), rule:"DNA/RNA hybrid"};
  }
  if(hasMOE && (hasDNA || hasRNA)){
    if(hasDNA) return {set:"MOE_DNA_"+suffix, key:pairKey(top2,bot2), rule:"MOE–DNA junction"};
    const conv = convertTopForSet(top2,"ALT");
    return {set:"ALT_"+suffix, key:pairKey(conv,bot2), rule:"ALT local MOE/RNA"};
  }
  if(hasRNA && hasDNA){
    // Mixed RNA-DNA junctions are uncommon in gapmer input; use DNA/RNA first if both residues are DNA, otherwise only approximate as a last resort.
    const conv = top2.map(t => isDNA(t)?dnaToRNA[t]:t);
    return {set:"unmodified_"+suffix, key: pairKey(conv, bot2), rule:"approx RNA-DNA junction: RNA/RNA", approx:true};
  }
  return {set:"unmodified_"+suffix, key: pairKey(convertTopForSet(top2,"RNA"), bot2), rule:"RNA/RNA local"};
}

function findWithFallback(setName, key, top2, bot2, allowApprox){
  let hit=findParam(setName,key);
  if(hit){hit.rule="direct/equivalent"; return hit;}

  if(!allowApprox) return null;
  const suffix = setName.endsWith("_PEG") ? "PEG" : "dilute";
  // fixed modes fallback rules. DNA/RNA must be attempted before RNA/RNA when DNA residues are present.
  const fallbacks = [];
  if(setName.startsWith("ALT")) fallbacks.push({set:"RRHD_"+suffix, key:pairKey(top2.map(t=>isMOE(t)?t:(isDNA(t)?dnaToRNA[t]:t)), bot2), rule:"approx fallback: RRHD"});
  if(top2.every(isDNA)) fallbacks.push({set:"RNA_DNA_"+suffix, key:constructRNADNAKey(top2, bot2), rule:"approx fallback: DNA/RNA hybrid"});
  fallbacks.push({set:"unmodified_"+suffix, key:pairKey(convertTopForSet(top2,"RNA"), bot2), rule:"approx fallback: RNA/RNA"});
  for(const fb of fallbacks){
    const h=findParam(fb.set, fb.key);
    if(h){h.rule=fb.rule; h.approx=true; return h;}
  }
  return null;
}

function isSelfComplementaryA(tokens){
  // True only when Strand A is self-complementary.
  const comp = tokens.map(t => compRNA[t]);
  if(comp.some(x=>!x)) return false;
  const revcomp = comp.reverse().join("");
  return tokens.join("") === revcomp;
}

function terminalPairType(aTok, bTok){
  // Terminal corrections are defined by terminal base-pair classes, not by one fixed strand order.
  // Therefore both directions are accepted:
  //   AL/UH class: AL, LA, UH, HU
  //   GJ/CK class: GJ, JG, CK, KC
  // Standard RNA classes are also accepted bidirectionally: AU/UA and GC/CG.
  const rawPair = aTok + bTok;
  if(["AL","LA","UH","HU"].includes(rawPair)) return "ALUH";
  if(["GJ","JG","CK","KC"].includes(rawPair)) return "GJCK";

  const aBase = isMOE(aTok) ? moeToRNA[aTok] : (isDNA(aTok) ? dnaToRNA[aTok] : aTok);
  const bBase = isMOE(bTok) ? moeToRNA[bTok] : (isDNA(bTok) ? dnaToRNA[bTok] : bTok);
  const pair = aBase + bBase;
  if(pair==="AU" || pair==="UA") return "AU";
  if(pair==="GC" || pair==="CG") return "GC";
  return "";
}

function correctionRecord(setName, corrName){
  const set=getSet(setName); if(!set) return null;
  return set.corrections[corrName] || null;
}

function addCorrection(rows, label, used, setName, rec, rule){
  if(!rec) return;
  rows.push({pair:label, used:used, source:setName, rule:"correction: "+rule, dH:rec.dH, dS:rec.dS, dG:rec.dG, correction:true});
}

function addCorrections(rows, strandA, strandB, mode){
  if(!$("doCorr").checked) return;
  const suffix = mode.includes("PEG") ? "PEG" : "dilute";
  let baseSet = mode.startsWith("mixed") ? "ALT_"+suffix : mode;
  if(mode.startsWith("RNA_DNA")) baseSet = mode;
  const set=getSet(baseSet); if(!set) return;

  // Any MOE-containing duplex uses the RRHD initiation of the same solution condition.
  // The latest parameter workbook also makes ALT and RRHD initiation identical.
  const hasMOE = strandA.some(isMOE) || strandB.some(isMOE);
  const initiationSet = hasMOE ? "RRHD_"+suffix : baseSet;
  let init = correctionRecord(initiationSet,"initiation");
  let initName = "initiation";
  if(!init && baseSet.startsWith("RNA_DNA")){
    // Use terminal content to pick RNA/DNA initiation class; otherwise add both? Here choose from terminal pairs.
    const left=terminalPairType(strandA[0], strandB[0]);
    const right=terminalPairType(strandA[strandA.length-1], strandB[strandB.length-1]);
    const key = (left==="GC" || right==="GC") ? "init. rG−dC and rC−dG" : "init. rA−dT or rU−dA";
    init=correctionRecord(baseSet,key); initName=key;
  }
  if(init) addCorrection(rows,"initiation",initName,initiationSet,init,"available initiation");

  // terminal correction for two terminals
  const terminalSets = [];
  for(const [pos, aTok, bTok] of [["5′ terminal",strandA[0],strandB[0]],["3′ terminal",strandA[strandA.length-1],strandB[strandB.length-1]]]){
    const t=terminalPairType(aTok,bTok);
    const rawTerminal = aTok + "/" + bTok;
    let rec=null, name=null;
    if(t==="ALUH"){ name="per terminal AL or UH"; rec=correctionRecord(baseSet,name); }
    if(t==="GJCK"){ name="per terminal GJ or CK"; rec=correctionRecord(baseSet,name); }
    if(!rec && t==="AU"){ name="per terminal AU"; rec=correctionRecord(baseSet,name); }
    if(!rec && t==="GC"){ name="per terminal GC"; rec=correctionRecord(baseSet,name); }
    if(!rec && (t==="AU" || t==="GC")){
      const fallback = baseSet.includes("PEG") ? "unmodified_PEG" : "unmodified_dilute";
      name = t==="AU" ? "per terminal AU" : "per terminal GC";
      rec=correctionRecord(fallback,name);
      if(rec) addCorrection(rows,pos+" "+rawTerminal,name,fallback,rec,"terminal fallback");
    } else if(rec) {
      addCorrection(rows,pos+" "+rawTerminal,name,baseSet,rec,"terminal");
    }
  }

  // self-complementary only for Strand A itself
  if(isSelfComplementaryA(strandA)){
    const sc = correctionRecord(baseSet,"Self-complementary") || correctionRecord("unmodified_"+suffix,"Self-complementary");
    if(sc) addCorrection(rows,"Self-complementary","Self-complementary",baseSet,sc,"Strand A self-complementary");
  }
}


// A single averaged PS factor applies to all selected Strand A linkages.
// Only ΔG°37 is corrected because no PS ΔH° or ΔS° were provided.
function applyPS(rows, A, condition, isBatch=false){
  const prefix=isBatch?"batch":"";
  if(!$(prefix+"PS").checked) return;
  const input=$(prefix+"PSCount").value.trim();
  const count=input===""?A.length-1:Number(input);
  if(!Number.isInteger(count)||count<0||count>A.length-1)
    throw new Error("PS linkage count must be an integer between 0 and L − 1.");
  const selected=$(prefix+"PSType").value;
  const type=selected==="auto"?(A.some(isDNA)?"DNA":"RNA"):selected;
  const factor=DB.ps_correction[type][condition];
  rows.push({pair:"PS backbone ("+count+" linkages)",used:(factor>=0?"+":"")+factor+" × "+count,
    source:"PS "+type+" / "+condition,
    rule:"Empirical ΔG°37 correction only; ΔH°/ΔS° not available",
    dH:null,dS:null,dG:factor*count,correction:true,ps:true});
}

function calculate(options={}){
  try{
    const A=tokenize($("strandA").value);
    let B=tokenize($("strandB").value);
    if(A.length!==B.length) throw new Error("Strand A and Strand B must have the same number of residues/tokens.");
    if(A.length<2) throw new Error("At least two residues are required.");
    const mode=$("mode").value;
    const allowApprox=$("doApprox").checked;
    const rows=[];
    const condition = mode.includes("PEG") ? "PEG" : "dilute";

    for(let i=0;i<A.length-1;i++){
      const top2=[A[i],A[i+1]];
      const bot2=[B[i],B[i+1]];
      let target;
      if(mode.startsWith("mixed")){
        target=chooseMixed(top2,bot2,condition);
      }else{
        let k = pairKey(top2,bot2);
        if(mode.startsWith("unmodified")) k=pairKey(convertTopForSet(top2,"RNA"),bot2);
        if(mode.startsWith("RNA_DNA")) k=constructRNADNAKey(top2.map(t=>isDNA(t)?t:("d"+baseOf[t].replace("U","T"))),bot2);
        target={set:mode, key:k, rule:"selected set"};
      }
      let hit=findParam(target.set,target.key);
      if(hit){hit.rule=target.rule; hit.approx=!!target.approx;}
      else hit=findWithFallback(target.set,target.key,top2,bot2,allowApprox);
      if(hit){
        rows.push({pair:pairKey(top2,bot2), used:hit.param, source:hit.set, rule:hit.rule+(hit.approx?" / approximate":""), dH:hit.rec.dH, dS:hit.rec.dS, dG:hit.rec.dG, approx:!!hit.approx});
      }else{
        rows.push({pair:pairKey(top2,bot2), used:"not found", source:"—", rule:"missing", dH:null,dS:null,dG:null, missing:true});
      }
    }
    addCorrections(rows,A,B,mode);
    applyPS(rows,A,condition,!!options.batch);
    lastRows=rows;
    render(rows);
  }catch(e){setMessage(e.message,"bad");}
}

function render(rows){
  const tbody=$("detail").querySelector("tbody"); tbody.innerHTML="";
  let sumH=0,sumS=0,sumG=0,missing=0,approx=0;
  rows.forEach((r,idx)=>{
    if(r.missing) missing++;
    if(typeof r.dH==="number")sumH+=r.dH;
    if(typeof r.dS==="number")sumS+=r.dS;
    if(typeof r.dG==="number")sumG+=r.dG;
    if(r.approx) approx++;
    const tr=document.createElement("tr");
    if(r.approx) tr.classList.add("approx");
    if(r.correction) tr.classList.add("correction");
    tr.innerHTML = `<td>${idx+1}</td><td>${displayKey(r.pair)}</td><td>${displayKey(r.used)}</td><td>${r.source}</td><td>${r.rule}</td><td>${fmt(r.dH)}</td><td>${fmt(r.dS)}</td><td>${fmt(r.dG)}</td>`;
    tbody.appendChild(tr);
  });
  $("sumH").textContent=fmt(sumH);
  $("sumS").textContent=fmt(sumS);
  $("sumG").textContent=fmt(sumG);
  if(missing) setMessage(`Missing parameters: ${missing}. Approximate rows: ${approx}.`,"warn");
  else if(rows.some(r=>r.ps)) setMessage(`Calculation completed. Approximate rows: ${approx}. PS correction changes ΔG°37 only; ΔH°/ΔS° are uncorrected PO estimates.`,"warn");
  else setMessage(`Calculation completed. Approximate rows: ${approx}.`);
}

function downloadCSV(){
  if(!lastRows.length){setMessage("No result to download.","warn"); return;}
  const lines=[["No","NN pair/correction","Used parameter","Source set","Rule","dH","dS","dG37"].join(",")];
  lastRows.forEach((r,i)=>{
    lines.push([i+1,displayKey(r.pair),displayKey(r.used),r.source,r.rule,r.dH??"",r.dS??"",r.dG??""].map(x=>`"${String(x).replace(/"/g,'""')}"`).join(","));
  });
  const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="MOE_NN_calculation.csv"; a.click();
  URL.revokeObjectURL(a.href);
}

async function init(){
  // Bind UI first so Auto-fill works even if a data file cannot be loaded.
  $("autofillB").onclick = autoFillB;
  $("calc").onclick = calculate;
  $("download").onclick = downloadCSV;

  // Use embedded parameters.js first. This avoids the common local-file browser block
  // where fetch("parameters.json") fails after double-clicking index.html.
  if (window.MOE_NN_PARAMETERS) {
    DB = window.MOE_NN_PARAMETERS;
  } else {
    try {
      DB = await fetch("parameters.json").then(r => {
        if (!r.ok) throw new Error("Cannot load parameters.json");
        return r.json();
      });
    } catch (e) {
      setMessage("Parameter database could not be loaded. Auto-fill still works, but calculation needs parameters.js or a local web server.", "bad");
      return;
    }
  }
  autoFillB();
  calculate();
}
init();

// ---- Batch calculation and classic-layout tabs ----
let batchResultsCache = [];
function q(id){return document.getElementById(id);}
function batchTr(key, fallback){try{return window.I18N_T?window.I18N_T(key):fallback}catch(e){return fallback}}
function parseBatchLine(line, idx){
  const raw=line.trim(); if(!raw) return null;
  const parts = raw.includes('\t') ? raw.split('\t') : raw.split(',');
  const p=parts.map(x=>x.trim()).filter((x,i)=>i<3 || x!=='');
  if(p.length===1) return {name:`Seq${idx}`,a:p[0],b:''};
  if(p.length===2) return {name:p[0]||`Seq${idx}`,a:p[1],b:''};
  return {name:p[0]||`Seq${idx}`,a:p[1],b:p[2]||''};
}
function updateBatchCount(){
  if(!q('batchInput')) return;
  const n=q('batchInput').value.split(/\r?\n/).filter(x=>x.trim()).length;
  q('batchCount').textContent=`${n} input row${n===1?'':'s'}`;
}
function setBatchMessage(text,type=''){const m=q('batchMessage');if(!m)return;m.textContent=text;m.className='msg'+(type?' '+type:'');}
function runBatch(){
  const lines=q('batchInput').value.split(/\r?\n/).filter(x=>x.trim());
  const entries=lines.map((l,i)=>parseBatchLine(l,i+1)).filter(Boolean);
  const tbody=q('batchDetail').querySelector('tbody'); tbody.innerHTML=''; batchResultsCache=[];
  if(!entries.length){setBatchMessage('No input rows.','warn');return;}
  const old={a:q('strandA').value,b:q('strandB').value,mode:q('mode').value,corr:q('doCorr').checked,approx:q('doApprox').checked};
  q('mode').value=q('batchMode').value; q('doCorr').checked=q('batchCorr').checked; q('doApprox').checked=q('batchApprox').checked;
  entries.forEach((e,i)=>{
    q('strandA').value=e.a; q('strandB').value=e.b;
    if(!e.b){try{autoFillB();}catch(_){}}
    calculate({batch:true});
    const isBad=q('message').classList.contains('bad');
    const isWarn=q('message').classList.contains('warn');
    const approxCount=Array.isArray(lastRows)?lastRows.filter(r=>r.approx).length:0;
    const rec={no:i+1,name:e.name,a:e.a,b:q('strandB').value,dH:isBad?'':q('sumH').textContent,dS:isBad?'':q('sumS').textContent,dG:isBad?'':q('sumG').textContent,approx:approxCount,status:isBad?q('message').textContent:(isWarn?'Warning':'OK')};
    batchResultsCache.push(rec);
    const tr=document.createElement('tr'); if(isBad)tr.classList.add('badrow'); else if(isWarn||approxCount)tr.classList.add('approx');
    tr.innerHTML=`<td>${rec.no}</td><td>${rec.name}</td><td>${rec.a}</td><td>${rec.b}</td><td>${rec.dH}</td><td>${rec.dS}</td><td>${rec.dG}</td><td>${rec.approx}</td><td>${rec.status}</td>`;
    tbody.appendChild(tr);
  });
  q('strandA').value=old.a;q('strandB').value=old.b;q('mode').value=old.mode;q('doCorr').checked=old.corr;q('doApprox').checked=old.approx;calculate();
  const ok=batchResultsCache.filter(r=>r.status==='OK').length; const warn=batchResultsCache.length-ok;
  setBatchMessage(`Batch completed: ${batchResultsCache.length} rows (${ok} OK, ${warn} with warnings/errors).`,warn?'warn':'');
}
function downloadBatchCSV(){
  if(!batchResultsCache.length){setBatchMessage('No batch result to download.','warn');return;}
  const header=['No','Name','Strand A 5to3','Strand B 3to5','dH kcal/mol','dS cal/mol/K','dG37 kcal/mol','Approx count','Status'];
  const esc=x=>`"${String(x??'').replace(/"/g,'""')}"`;
  const lines=[header.map(esc).join(',')].concat(batchResultsCache.map(r=>[r.no,r.name,r.a,r.b,r.dH,r.dS,r.dG,r.approx,r.status].map(esc).join(',')));
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='MOE_NN_batch_calculation.csv';a.click();URL.revokeObjectURL(a.href);
}
function showTab(which){
  const single=which==='single';q('singlePanel').classList.toggle('hidden',!single);q('batchPanel').classList.toggle('hidden',single);q('tabSingle').classList.toggle('active',single);q('tabBatch').classList.toggle('active',!single);
}
document.addEventListener('DOMContentLoaded',()=>{
  if(q('tabSingle'))q('tabSingle').addEventListener('click',()=>showTab('single'));
  if(q('tabBatch'))q('tabBatch').addEventListener('click',()=>showTab('batch'));
  if(q('batchCalc'))q('batchCalc').addEventListener('click',runBatch);
  if(q('batchDownload'))q('batchDownload').addEventListener('click',downloadBatchCSV);
  if(q('batchClear'))q('batchClear').addEventListener('click',()=>{q('batchInput').value='';q('batchDetail').querySelector('tbody').innerHTML='';batchResultsCache=[];updateBatchCount();setBatchMessage('Ready for batch calculation.')});
  if(q('batchInput'))q('batchInput').addEventListener('input',updateBatchCount);
  updateBatchCount();
});
