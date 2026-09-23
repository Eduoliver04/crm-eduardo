import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src', 'app.html');
const S = fs.mkdtempSync(path.join(os.tmpdir(), 'caixa-'));

const DB_STUB = `
window.__server = JSON.parse(localStorage.getItem('__srv') || '{"docs":{}}');
(function(){
  const listeners = [];
  const persist = () => localStorage.setItem('__srv', JSON.stringify(window.__server));
  function snapDoc(path){ const d = window.__server.docs[path]; return { id: path.split('/').pop(), exists: !!d, data: () => d, metadata:{fromCache:false,hasPendingWrites:false} }; }
  function makeDoc(path){ return {
availableId: 0, id: path.split('/').pop(), path,
    get: async () => snapDoc(path),
    set: async (data) => { window.__server.docs[path] = JSON.parse(JSON.stringify(data)); persist(); },
    update: async (d) => { Object.assign(window.__server.docs[path]||{}, d); persist(); },
    delete: async () => { delete window.__server.docs[path]; persist(); },
    onSnapshot: (next) => { setTimeout(()=>next(snapDoc(path)), 30); return ()=>{}; },
    collection: (p) => makeCol(path + '/' + p) }; }
  function colSnap(base){ const docs = Object.keys(window.__server.docs).filter(p => p.startsWith(base+'/') && p.slice(base.length+1).indexOf('/')<0).map(snapDoc);
    return { docs, size: docs.length, empty: !docs.length, docChanges: ()=>[], metadata:{fromCache:false,hasPendingWrites:false} }; }
  function makeCol(base){ return { path: base, doc: (id) => makeDoc(base + '/' + (id || ('x'+Math.random().toString(36).slice(2)))),
    get: async () => colSnap(base), onSnapshot: (next) => { setTimeout(()=>next(colSnap(base)), 30); return ()=>{}; } }; }
  const db = { doc: makeDoc, collection: makeCol };
  window.claude = { use: async (n) => n === 'db' ? db : (n === 'user' ? { isOwner: ()=>true, canEdit: ()=>true, can: ()=>true } : null) };
})();
`;

function buildDoc(stub) {
  const body = fs.readFileSync(SRC, 'utf8');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafaf9}img{max-width:100%}[hidden]{display:none!important}</style><script>${stub}<\/script></head><body>${body}</body></html>`;
}

const out = [];
let fails = 0;
function check(name, cond, extra) { if (!cond) fails++; out.push((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '   << ' + JSON.stringify(extra))); }

async function run(label, stub) {
  fs.writeFileSync(S + '/t.html', buildDoc(stub));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  let p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('JS ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_|favicon/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
  const url = 'file://' + S + '/t.html';
  await p.goto(url); await p.waitForTimeout(800);

  out.push('\n===== ' + label + ' =====');

  // --- estado inicial vazio ---
  check('abre vazio, sem dados de exemplo', await p.isVisible('#demoBanner') && /vazio/i.test(await p.textContent('#demoText')), { t: await p.textContent('#demoText') });

  // --- demo é somente leitura ---
  await p.click('#btnDemoToggle'); await p.waitForTimeout(300);
  check('exemplo carrega', /exemplo/i.test(await p.textContent('#demoText')));
  await p.click('.rail [data-view="lancamentos"]'); await p.waitForTimeout(150);
  const demoRows = await p.$$eval('#entryRows .row', e => e.length);
  await p.fill('#fValor', '10'); await p.click('#fSubmit'); await p.waitForTimeout(300);
  check('exemplo bloqueia lançamento (com aviso)', (await p.$$eval('#entryRows .row', e => e.length)) === demoRows && await p.isVisible('#toast'));
  await p.click('#btnDemoToggle'); await p.waitForTimeout(300);
  check('sair do exemplo volta ao vazio', (await p.$$eval('#entryRows .row', e => e.length)) === 0);

  // --- lançamentos ---
  async function add(tipo, valor, desc, cat) {
    await p.click(`#tipoSeg button[data-t="${tipo}"]`);
    await p.fill('#fValor', valor); await p.fill('#fDesc', desc);
    if (cat) await p.selectOption('#fCategoria', cat);
    await p.click('#fSubmit'); await p.waitForTimeout(350);
  }
  await add('despesa', '150,50', 'compra teste', 'Mercado');
  check('despesa lançada', (await p.$$eval('#entryRows .row', e => e.length)) === 1, { msg: await p.textContent('#fMsg') });
  await add('ganho', '2000', 'salario teste');
  await add('perda', '90', 'perda teste');
  await add('despesa', '480,00', 'fatura do cartao', 'Cartão de crédito');
  check('4 lançamentos na lista', (await p.$$eval('#entryRows .row', e => e.length)) === 4);
  check('categoria cartão de crédito aceita', (await p.textContent('#entryRows')).includes('Cartão de crédito'));

  await p.waitForTimeout(1500);
  check('lançamentos sobrevivem à sincronização', (await p.$$eval('#entryRows .row', e => e.length)) === 4);

  // --- KPIs exatos ---
  await p.click('.rail [data-view="resumo"]'); await p.waitForTimeout(300);
  const kpi = await p.$$eval('#kpis .kpi-val', e => e.map(x => x.textContent.replace(/\s+/g,' ').trim()));
  check('KPIs com centavos corretos', /1\.279,50/.test(kpi[0]) && /2\.000,00/.test(kpi[1]) && /630,50/.test(kpi[2]) && /90,00/.test(kpi[3]), kpi);

  // --- edição mantém posição ---
  await p.click('.rail [data-view="lancamentos"]'); await p.waitForTimeout(150);
  const firstDescBefore = await p.$eval('#entryRows .row .row-desc', e => e.textContent);
  await p.click('#entryRows [data-edit]'); await p.waitForTimeout(250);
  await p.fill('#fValor', '999'); await p.click('#fSubmit'); await p.waitForTimeout(350);
  const firstDescAfter = await p.$eval('#entryRows .row .row-desc', e => e.textContent);
  check('edição não muda a ordem', firstDescBefore === firstDescAfter, { firstDescBefore, firstDescAfter });
  check('edição aplica o novo valor', (await p.textContent('#entryRows')).includes('999,00'));
  check('edição não duplica', (await p.$$eval('#entryRows .row', e => e.length)) === 4);

  // --- exclusão ---
  const delBtns = await p.$$('#entryRows [data-del]');
  await delBtns[0].click(); await p.waitForTimeout(150);
  await (await p.$$('#entryRows [data-del]'))[0].click(); await p.waitForTimeout(350);
  check('exclusão remove uma linha', (await p.$$eval('#entryRows .row', e => e.length)) === 3);

  // --- filtros ---
  await p.selectOption('#flTipo', 'ganho'); await p.waitForTimeout(250);
  check('filtro por tipo', (await p.$$eval('#entryRows .row', e => e.length)) === 1, { n: await p.$$eval('#entryRows .row', e => e.length) });
  await p.selectOption('#flTipo', ''); await p.fill('#flQ', 'cartao'); await p.waitForTimeout(250);
  check('busca por descrição', (await p.$$eval('#entryRows .row', e => e.length)) === 1);
  await p.fill('#flQ', ''); await p.waitForTimeout(200);
  await p.selectOption('#flCat', 'Cartão de crédito'); await p.waitForTimeout(250);
  check('filtro por categoria', (await p.$$eval('#entryRows .row', e => e.length)) === 1);
  await p.selectOption('#flCat', ''); await p.waitForTimeout(200);

  // --- navegação de mês ---
  await p.click('#mPrev'); await p.waitForTimeout(250);
  check('mês anterior fica vazio sem quebrar', (await p.$$eval('#entryRows .empty', e => e.length)) === 1);
  await p.click('#mToday'); await p.waitForTimeout(250);
  check('voltar para hoje restaura', (await p.$$eval('#entryRows .row', e => e.length)) === 3);

  // --- lançamento em outro mês ---
  const other = await p.evaluate(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-10'; });
  await p.click('#tipoSeg button[data-t="despesa"]');
  await p.fill('#fValor', '75'); await p.fill('#fData', other); await p.fill('#fDesc', 'mes passado');
  await p.click('#fSubmit'); await p.waitForTimeout(400);
  check('lançar em outro mês navega para ele', (await p.textContent('#entryRows')).includes('mes passado'));
  await p.fill('#fData', await p.evaluate(() => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }));
  await p.click('#mToday'); await p.waitForTimeout(250);

  // --- investimentos ---
  await p.click('.rail [data-view="investimentos"]'); await p.waitForTimeout(250);
  await p.fill('#aNome', 'Tesouro Teste'); await p.fill('#aValor', '1000');
  await p.click('#assetForm button[type="submit"]'); await p.waitForTimeout(450);
  check('ativo criado', (await p.$$eval('#invTbl tbody tr', e => e.length)) === 2, { msg: await p.textContent('#aMsg') });
  await p.fill('#aNome', 'ITSA4'); await p.fill('#aValor', '500'); await p.selectOption('#aTipo', 'Ações / FIIs');
  await p.click('#assetForm button[type="submit"]'); await p.waitForTimeout(450);
  check('segundo ativo criado', (await p.$$eval('#invTbl tbody tr', e => e.length)) === 3);

  await p.fill('#pValor', '500'); await p.click('#aporteForm button[type="submit"]'); await p.waitForTimeout(450);
  check('aporte soma no aplicado', (await p.textContent('#invTbl')).includes('1.500,00'), { msg: await p.textContent('#pMsg') });

  const inp = (await p.$$('#invTbl [data-atual]'))[0];
  await inp.fill('1800,00'); await inp.press('Enter'); await p.waitForTimeout(450);
  check('valor atual gera resultado', (await p.textContent('#invTbl')).includes('300,00'));
  check('alocação desenha 2 fatias', (await p.$$eval('#allocLegend > span', e => e.length)) === 2);
  await p.waitForTimeout(1200);
  check('carteira sobrevive à sincronização', (await p.$$eval('#invTbl tbody tr', e => e.length)) === 3);

  // excluir ativo
  const db2 = await p.$$('#invTbl [data-delasset]');
  await db2[1].click(); await p.waitForTimeout(150);
  await (await p.$$('#invTbl [data-delasset]'))[1].click(); await p.waitForTimeout(450);
  check('excluir ativo funciona', (await p.$$eval('#invTbl tbody tr', e => e.length)) === 2);

  // --- orçamento ---
  await p.click('.rail [data-view="orcamento"]'); await p.waitForTimeout(250);
  let el = await p.$('#cMeta'); await el.fill('400'); await el.press('Enter'); await p.waitForTimeout(300);
  el = await p.$('#cSaldo'); await el.fill('800'); await el.press('Enter'); await p.waitForTimeout(300);
  check('meta de economia salva', /400,00/.test(await p.textContent('#goalBox')));
  el = await p.$('#budgetTbl [data-orc="Mercado"]'); await el.fill('500'); await el.press('Enter'); await p.waitForTimeout(400);
  check('limite salva e mede', /Mercado/.test(await p.textContent('#budgetList')));
  el = await p.$('#budgetTbl [data-orc="Cartão de crédito"]');
  check('cartão de crédito em definir limites', !!el);
  if (el) { await el.fill('400'); await el.press('Enter'); await p.waitForTimeout(400);
    check('estouro do cartão sinalizado', /estourou/.test(await p.textContent('#budgetList')), { b: (await p.textContent('#budgetList')).replace(/\s+/g,' ').slice(0,300) }); }

  // --- patrimônio ---
  await p.click('.rail [data-view="resumo"]'); await p.waitForTimeout(300);
  check('patrimônio considera saldo inicial', /R\$/.test(await p.textContent('#netWorth')));

  // --- persistência após recarregar ---
  await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(1500);
  await p.click('.rail [data-view="lancamentos"]'); await p.waitForTimeout(350);
  check('lançamentos persistem após recarregar', (await p.$$eval('#entryRows .row', e => e.length)) === 3, { n: await p.$$eval('#entryRows .row', e => e.length) });
  await p.click('.rail [data-view="investimentos"]'); await p.waitForTimeout(300);
  check('carteira persiste após recarregar', (await p.$$eval('#invTbl tbody tr', e => e.length)) === 2);
  await p.click('.rail [data-view="orcamento"]'); await p.waitForTimeout(300);
  check('orçamento persiste após recarregar', /400,00/.test(await p.textContent('#goalBox')));

  // --- nova aba (outro "aparelho") lê da nuvem ---
  if (stub) {
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => { try { localStorage.removeItem('cadernoDeCaixa.v1'); } catch(e){} });
    await p2.goto(url); await p2.waitForTimeout(1600);
    await p2.click('.rail [data-view="lancamentos"]'); await p2.waitForTimeout(400);
    check('outro aparelho (sem cache local) baixa da nuvem', (await p2.$$eval('#entryRows .row', e => e.length)) === 3, { n: await p2.$$eval('#entryRows .row', e => e.length) });
    await p2.close();
  }

  await p.screenshot({ path: S + '/final-' + label + '.png', fullPage: true });
  await b.close();
  if (errs.length) { fails++; out.push('  !! ' + [...new Set(errs)].join('\n  !! ')); }
}

(async () => {
  await run('sem-nuvem', '');
  await run('com-nuvem', DB_STUB);
  console.log(out.join('\n'));
  console.log('\n' + (fails ? fails + ' FALHA(S)' : 'TUDO PASSOU'));
})();
