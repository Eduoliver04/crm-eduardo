import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src', 'app.html');
const S = fs.mkdtempSync(path.join(os.tmpdir(), 'caixa-'));
const body = fs.readFileSync(SRC,'utf8');
const doc = (stub) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafaf9}img{max-width:100%}[hidden]{display:none!important}</style><script>${stub}<\/script></head><body>${body}</body></html>`;

// nuvem que REJEITA toda gravação (simula permissão negada)
const HOSTILE = `
(function(){
  const rej = () => Promise.reject({code:'invalid_argument', message:'denied'});
  const snap = (id) => ({id, exists:false, data:()=>undefined, metadata:{}});
  const mkDoc = (path) => ({id:path.split('/').pop(), path, get: async()=>snap(path.split('/').pop()), set:rej, update:rej, delete:rej, onSnapshot:()=>()=>{}, collection:(p)=>mkCol(path+'/'+p)});
  const mkCol = (b) => ({path:b, doc:mkDoc, get: async()=>({docs:[],size:0,empty:true,docChanges:()=>[],metadata:{}}), onSnapshot:()=>()=>{}});
  window.claude = { use: async (n) => n==='db' ? {doc:mkDoc, collection:mkCol} : null };
})();`;

const out = []; let fails = 0;
const check = (n,c,e)=>{ if(!c) fails++; out.push((c?'  ok   ':'  FAIL ')+n+(c?'':'   << '+JSON.stringify(e))); };

(async () => {
  // 1. nuvem hostil
  fs.writeFileSync(S+'/t2.html', doc(HOSTILE));
  let b = await chromium.launch();
  let p = await b.newPage({viewport:{width:1280,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+S+'/t2.html'); await p.waitForTimeout(900);
  out.push('===== nuvem recusando gravação =====');
  await p.click('.rail [data-view="lancamentos"]'); await p.waitForTimeout(200);
  await p.fill('#fValor','321,45'); await p.fill('#fDesc','teste hostil'); await p.click('#fSubmit');
  await p.waitForTimeout(1500);
  check('lançamento continua na tela', (await p.$$eval('#entryRows .row', e=>e.length))===1);
  check('indicador avisa que é só local', /aparelho|aqui/i.test(await p.textContent('#syncPill')), {s: await p.textContent('#syncPill')});
  await p.reload(); await p.waitForTimeout(1500);
  await p.click('.rail [data-view="lancamentos"]'); await p.waitForTimeout(300);
  check('dado sobrevive ao reload mesmo com nuvem recusando', (await p.$$eval('#entryRows .row', e=>e.length))===1, {n: await p.$$eval('#entryRows .row', e=>e.length)});
  check('sem erros de JS', errs.length===0, errs);
  await b.close();

  // 2. celular
  fs.writeFileSync(S+'/t3.html', doc(''));
  b = await chromium.launch();
  p = await b.newPage({viewport:{width:390,height:844}, colorScheme:'dark'});
  const errs2=[]; p.on('pageerror',e=>errs2.push(e.message));
  await p.goto('file://'+S+'/t3.html'); await p.waitForTimeout(800);
  out.push('\n===== celular (390px, escuro) =====');
  check('barra de abas visível', await p.isVisible('.tabbar'));
  await p.click('.tabbar [data-view="lancamentos"]'); await p.waitForTimeout(250);
  await p.fill('#fValor','59,90'); await p.fill('#fDesc','teste celular'); await p.click('#fSubmit'); await p.waitForTimeout(400);
  check('lança pelo celular', (await p.$$eval('#entryRows .row', e=>e.length))===1);
  await p.click('.tabbar [data-view="resumo"]'); await p.waitForTimeout(400);
  check('sem rolagem horizontal', !(await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1)));
  const vb = await p.getAttribute('#flowChart','viewBox');
  check('gráfico adapta a largura', parseInt(vb.split(' ')[2],10) < 460, {vb});
  await p.click('.tabbar [data-view="investimentos"]'); await p.waitForTimeout(300);
  check('sem rolagem horizontal em investimentos', !(await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1)));
  await p.click('.tabbar [data-view="orcamento"]'); await p.waitForTimeout(300);
  check('sem rolagem horizontal em orçamento', !(await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1)));
  check('sem erros de JS no celular', errs2.length===0, errs2);
  await p.click('.tabbar [data-view="resumo"]'); await p.waitForTimeout(400);
  await p.screenshot({path:S+'/final-celular.png', fullPage:true});
  await b.close();

  console.log(out.join('\n'));
  console.log('\n'+(fails?fails+' FALHA(S)':'TUDO PASSOU'));
})();
