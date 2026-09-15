import path from 'node:path';
import {TaoSearchIndex} from '../vendor/taobrowser/core/search-index.mjs';
import {TaoSearchFrontier} from '../vendor/taobrowser/core/search-frontier.mjs';

export class BrowserKnowledgeOrgan {
  constructor(runtimeDir){
    this.index=new TaoSearchIndex(path.join(runtimeDir,'tao-search'));
    this.frontier=new TaoSearchFrontier(path.join(runtimeDir,'tao-search','frontier.json'));
  }
  status(){return {organ:'TaoBrowser Internet Knowledge Organ',index:this.index.stats(),frontier:this.frontier.stats(),liveCrawlerVerified:false};}
  search(query,limit=12){return this.index.search(query,{limit});}
  indexDocument(doc){return this.index.indexDocument({...doc,sourceKind:doc.sourceKind||'manual'});}
  enqueue(url,{priority=70,source='taowind-code'}={}){const entry=this.frontier.enqueue(url,{priority,source});this.frontier.save();return entry;}
}
