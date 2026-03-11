"use strict";

let records = [];

self.onmessage = (event)=>{
  const msg = event.data || {};

  if(msg.type === "init"){
    records = Array.isArray(msg.records) ? msg.records : [];
    self.postMessage({ type: "ready", size: records.length });
    return;
  }

  if(msg.type === "search"){
    const {
      requestId,
      specNorm = "",
      exactSpec = false,
      cityNorm = "",
      visit = "all",
      sortBest = false,
      sortDistance = false,
      sortPrice = false
    } = msg;

    const filtered = [];
    let nfzCount = 0;
    let privateCount = 0;

    for(let i = 0; i < records.length; i++){
      const d = records[i];
      if(specNorm){
        const list = d.specNormList || "";
        if(exactSpec){
          if(!list.includes(`|${specNorm}|`)) continue;
        }
        else if(!list.includes(specNorm)) continue;
      }
      if(cityNorm && d.cityNorm !== cityNorm) continue;
      if(visit === "nfz" && !d.nfz) continue;
      if(visit === "private" && !d.privateVisit) continue;

      if(d.nfz) nfzCount++;
      if(d.privateVisit) privateCount++;
      filtered.push(d);
    }

    filtered.sort((a,b)=>{
      let scoreA = 0;
      let scoreB = 0;

      if(sortBest){
        scoreA += a.rating || 0;
        scoreB += b.rating || 0;
      }
      if(sortDistance){
        scoreA -= Number(a.distance ?? 9999);
        scoreB -= Number(b.distance ?? 9999);
      }
      if(sortPrice){
        scoreA -= (a.price ?? 9999);
        scoreB -= (b.price ?? 9999);
      }
      return scoreB - scoreA;
    });

    self.postMessage({
      type: "result",
      requestId,
      ids: filtered.map((d)=>d.id),
      nfzCount,
      privateCount,
      total: filtered.length
    });
  }
};
