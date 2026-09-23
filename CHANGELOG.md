# Histórico

## v3 — 2026-09-18
- **Correção crítica:** a sincronização com a nuvem apagava lançamentos recém-criados.
  O `onSnapshot` substituía o estado local pelo da nuvem; se a nuvem ainda estivesse vazia
  (ou a gravação tivesse falhado), os dados sumiam da tela segundos depois de serem lançados.
  Substituído por leitura sob demanda com mesclagem por `updatedAt`.
- Corrigido: "Registrar aporte" e edição do valor atual falhavam quando havia dados de exemplo.
- Corrigido: editar um lançamento o movia para o fim da lista do dia.
- Corrigido: KPIs arredondavam para reais inteiros (R$ 150,50 virava R$ 151).
- Dados de exemplo deixaram de carregar automaticamente; agora são opcionais e somente leitura.
- Adicionado selo de estado da gravação (Salvando / Sincronizado / Só neste aparelho).

## v2 — 2026-09-17
- Categoria "Cartão de crédito" nas despesas.

## v1 — 2026-09-17
- Versão inicial: visão geral, lançamentos, investimentos e orçamento.
