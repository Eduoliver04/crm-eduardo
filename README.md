# Caderno de Caixa

CRM financeiro pessoal: ganhos, despesas, perdas, investimentos e metas de orçamento.
Aplicação de arquivo único, sem build, sem dependências e sem back-end.

## O que faz

- **Visão geral** — saldo do mês, ganhos, despesas, perdas, caixa acumulado e patrimônio
  (caixa + carteira). Gráfico divergente de 12 meses (entradas acima da linha, saídas abaixo)
  e quebra das despesas por categoria.
- **Lançamentos** — lançamento rápido de ganho, despesa ou perda; lista agrupada por dia com
  total diário; filtros por tipo, categoria e busca livre; edição e exclusão.
- **Investimentos** — carteira com valor aplicado, valor atual e rentabilidade por ativo;
  registro de aportes; alocação por tipo de ativo.
- **Orçamento** — limite mensal por categoria com alerta de "perto do limite" e de estouro,
  meta de economia mensal e saldo inicial.
- **Exportação** — CSV de todos os lançamentos (`;` como separador, BOM UTF-8, pronto para Excel).

## Como os dados são guardados

O app grava **primeiro no aparelho** (`localStorage`) e depois, quando disponível, na nuvem.
Nenhum dos dois lados apaga o outro: cada documento (mês, carteira, configuração) carrega um
`updatedAt`, e na sincronização vence o mais recente. Se a nuvem estiver fora do ar ou recusar
a gravação, o app continua funcionando e o selo no topo passa a dizer **"Só neste aparelho"**.

| Onde roda | Armazenamento |
|---|---|
| Claude Artifact | `localStorage` + capability `db` (privada do dono, sincroniza entre aparelhos) |
| GitHub Pages / arquivo local | apenas `localStorage` (um navegador, um aparelho) |

Layout dos documentos na nuvem:

```
config/main          { orcamentos, metaEconomia, saldoInicial, updatedAt }
portfolio/main       { ativos: [...], updatedAt }
ledger/<AAAA-MM>     { entries: [...], updatedAt }
```

## Estrutura

```
src/app.html      fonte única do app (publicada como Artifact no Claude)
build.mjs         gera index.html standalone a partir de src/app.html
index.html        saída do build — abre direto no navegador / GitHub Pages
tests/e2e.mjs     testes ponta a ponta (sem nuvem e com nuvem simulada)
tests/e2e-extra.mjs  nuvem recusando gravação + celular em tema escuro
```

`src/app.html` não tem `<!doctype>`, `<html>`, `<head>` nem `<body>`: a plataforma de
Artifacts envolve o conteúdo nesse esqueleto ao publicar. O `build.mjs` reproduz o mesmo
esqueleto para a versão standalone. **Edite sempre `src/app.html`** e rode o build.

## Desenvolvimento

```bash
node build.mjs                 # regenera index.html
npx playwright install chromium   # só na primeira vez
node tests/e2e.mjs             # 34 verificações × 2 cenários
node tests/e2e-extra.mjs       # nuvem hostil + celular
```

Os testes abrem o app num Chromium headless, injetam uma nuvem falsa e exercitam os fluxos
reais (lançar, editar, excluir, filtrar, aportar, atualizar valor atual, definir limites,
recarregar a página, abrir num segundo "aparelho" sem cache local).

## Decisões de projeto

- **Sem framework e sem dependências.** Um arquivo, HTML/CSS/JS puro. Os gráficos são SVG
  desenhado à mão, dimensionado em pixels reais do contêiner para o texto nunca encolher.
- **Nenhuma sincronização destrutiva.** Sem `onSnapshot` sobrescrevendo o estado local —
  a nuvem é lida na abertura e quando a aba volta ao foco, sempre por mesclagem.
- **Aportes não saem do caixa.** A carteira é independente do fluxo do mês; para contabilizar
  o dinheiro saindo da conta, lance uma despesa na categoria *Investimento*.
- **Cores dos gráficos validadas** para daltonismo e contraste em tema claro e escuro; o sinal
  do valor é dado pela posição em relação à linha zero, não só pela cor.

## Licença

Uso pessoal.
