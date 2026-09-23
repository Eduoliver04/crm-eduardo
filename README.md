# Caderno de Caixa

CRM financeiro pessoal: ganhos, despesas, perdas, investimentos e metas de orcamento.
Aplicacao de arquivo unico, sem build, sem dependencias e sem back-end.

## O que faz

- Visao geral: saldo do mes, ganhos, despesas, perdas, caixa acumulado e patrimonio (caixa + carteira), com grafico divergente de 12 meses e quebra das despesas por categoria.
- Lancamentos: ganho, despesa ou perda; lista agrupada por dia; filtros por tipo, categoria e busca; edicao e exclusao.
- Investimentos: carteira com valor aplicado, valor atual e rentabilidade por ativo; aportes; alocacao por tipo.
- Orcamento: limite mensal por categoria com alerta de estouro, meta de economia e saldo inicial.
- Exportacao de todos os lancamentos em CSV.

## Como os dados sao guardados

O app grava primeiro no aparelho (localStorage) e depois, quando disponivel, na nuvem.
Nenhum dos dois lados apaga o outro: cada documento carrega um updatedAt e na sincronizacao
vence o mais recente. Se a nuvem recusar a gravacao, o app continua funcionando e o selo no
topo passa a dizer "So neste aparelho".

## Estrutura

    src/app.html          fonte unica do app (publicada como Artifact no Claude)
    build.mjs             gera index.html standalone a partir de src/app.html
    index.html            saida do build - abre direto no navegador / GitHub Pages
    tests/e2e.mjs         testes ponta a ponta (sem nuvem e com nuvem simulada)
    tests/e2e-extra.mjs   nuvem recusando gravacao + celular em tema escuro

Edite sempre src/app.html e rode `node build.mjs`.

## Licenca

Uso pessoal.
