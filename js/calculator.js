
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
const moeLongToInternal = {"AM":"H","CM":"J","GM":"K","UM":"L"};
const internalToMoeLong = {"H":"Am","J":"Cm","K":"Gm","L":"Um"};

function $(id){return document.getElementById(id);}
function fmt(x){return (typeof x==="number" && isFinite(x)) ? x.toFixed(2) : "—";}
function sanitize(s){return (s||"").replace(/\s+/g,"").replace(/’|‘/g,"'");}

function tokenize(seq){
  seq = sanitize(seq);
  const out = [];
  for(let i=0;i<seq.length;i++){
    const ch0 = seq[i];

    // New user-facing MOE notation: Am, Cm, Gm, Um.
    // Internally these are converted to the original parameter symbols H, J, K, L (A,C,G,U = H,J,K,L).
    if(i+1 < seq.length && seq[i+1].toLowerCase() === "m"){
      const key = ch0.toUpperCase() + "M";
      if(moeLongToInternal[key]){
        out.push(moeLongToInternal[key]);
        i += 1;
        continue;
      }
    }

    // DNA notation can be written either as dAdGdT or compact internal keys such as dAG/dTT.
    // Both forms are tokenized to [dA,dG,dT]. Single-letter T remains invalid for user input.
    if((ch0==="d" || ch0==="D") && i+1<seq.length){
      let j = i + 1;
      let consumed = false;
      while(j < seq.length){
        const b = seq[j].toUpperCase();
        if(!"ACGT".includes(b)) break;
        out.push("d" + b);
        consumed = true;
        j++;
      }
      if(!consumed) throw new Error("DNA residues must be written as dA, dC, dG, or dT.");
      i = j - 1;
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
  try{return displayTokens(tokenize(a)) + "/" + displayTokens(tokenize(b));}
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
  const toks = tokenize(s);
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
    const conv = convertTopForSet(top2,"ALT");
    return {set:"ALT_"+suffix, key: pairKey(conv, bot2), rule: hasDNA ? "approx MOE-DNA junction: ALT" : "ALT local MOE/RNA", approx:true};
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

  // initiation
  let init = correctionRecord(baseSet,"initiation");
  let initName = "initiation";
  if(!init && baseSet.startsWith("RNA_DNA")){
    // Use terminal content to pick RNA/DNA initiation class; otherwise add both? Here choose from terminal pairs.
    const left=terminalPairType(strandA[0], strandB[0]);
    const right=terminalPairType(strandA[strandA.length-1], strandB[strandB.length-1]);
    const key = (left==="GC" || right==="GC") ? "init. rG−dC and rC−dG" : "init. rA−dT or rU−dA";
    init=correctionRecord(baseSet,key); initName=key;
  }
  if(init) addCorrection(rows,"initiation",initName,baseSet,init,"available initiation");

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

function calculate(){
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
    lastRows=rows;
    render(rows);
  }catch(e){setMessage(e.message,"bad");}
}

function render(rows){
  const tbody=$("detail").querySelector("tbody"); tbody.innerHTML="";
  let sumH=0,sumS=0,sumG=0,missing=0,approx=0;
  rows.forEach((r,idx)=>{
    if(typeof r.dH==="number"){sumH+=r.dH; sumS+=r.dS; sumG+=r.dG;} else missing++;
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
