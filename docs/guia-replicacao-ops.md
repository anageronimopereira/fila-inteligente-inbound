# Guia de Replicação da Ferramenta de Visibilidade Operacional

## 1. Objetivo do documento

Este documento explica como a ferramenta foi construída, quais regras de negócio foram aplicadas e como o time de Ops pode replicar a solução em outras áreas da empresa.

O objetivo da ferramenta não é apenas consolidar dados em dashboards.

O objetivo é transformar uma operação guiada por múltiplas planilhas em uma camada de decisão que responda, com rapidez:

- como está a carteira atual
- quais clientes estão saudáveis, em atenção ou em risco
- qual MRR está exposto
- quais clientes cada responsável deve priorizar na semana
- quais sinais de risco justificam ação imediata

---

## 2. O que foi construído

A solução foi construída como uma aplicação web em React + TypeScript, com leitura de planilhas Excel via `xlsx`.

Hoje ela organiza a operação em três visões principais:

### 2.1. Direcionamento estratégico

Visão executiva da carteira atual.

Responde perguntas como:

- quantos projetos estão abertos
- qual o MRR total
- quantos projetos estão em risco
- quantos clientes de carteira A e B estão em risco
- quanto de MRR da carteira A e B está em risco
- quantos projetos estão atrasados
- quantos projetos foram novos, encerrados ou perdidos

### 2.2. Health Score

Visão de saúde da carteira por cliente.

Cada cliente recebe uma nota de `0 a 100` com base em:

- engajamento
- progresso do projeto
- risco
- contexto estratégico

Essa camada foi desenhada para padronizar a leitura da operação e evitar priorização apenas por feeling.

### 2.3. Fila inteligente

Visão operacional de priorização.

Responde:

- quem precisa ser atacado primeiro
- qual o motivo da priorização
- qual o risco executivo daquele cliente
- qual o MRR impactado
- qual ação recomendada para a semana

---

## 3. Fontes de dados usadas

Atualmente a ferramenta lê até 6 bases principais:

1. `Projetos abertos por implanter`
2. `Nota de finalização`
3. `Projetos perdidos`
4. `Projetos com oportunidade de cancelamento`
5. `Novos projetos`
6. `Resumo de clientes em implantação / inadimplência`

Essas bases são carregadas via upload na interface e depois cruzadas por cliente.

### 3.1. Planilhas extraídas do Salesforce

Na prática, a ferramenta foi construída a partir de exportações do Salesforce.

As planilhas utilizadas no projeto foram:

1. `Projetos abertos por implanter`
   - base principal da carteira atual
   - traz responsável, fase, status, valor pago, fator de risco, tempo de projeto e classificação da carteira/projeto

2. `Nota de finalização`
   - usada para medir encerramentos, nota média de finalização e leitura por implanter

3. `Projetos perdidos`
   - usada para contabilizar perdas, MRR perdido e visão de perdidos por implanter

4. `Projetos em aberto com oportunidade de cancelamento`
   - usada para identificar risco de churn, tempo de vida do cliente no cancelamento e MRR ameaçado

5. `Novos projetos`
   - usada para contabilizar entradas recentes na carteira

6. `Resumo de clientes em implantação / inadimplência`
   - usada para sinais de adoção, engajamento, usuários pendentes, inadimplência e link de detalhe do cliente

### 3.2. Papel de cada base no modelo

Nem todas as planilhas têm o mesmo peso no cálculo.

A lógica definida no projeto foi:

- `Projetos abertos por implanter`
  - fonte soberana da carteira atual
  - define quem está ou não está na carteira

- `Resumo de clientes em implantação / inadimplência`
  - principal fonte de engajamento, inadimplência e sinais operacionais

- `Projetos em aberto com oportunidade de cancelamento`
  - adiciona leitura de churn e risco de receita

- `Nota de finalização`
  - mede desfecho e qualidade percebida da implantação

- `Projetos perdidos`
  - mede perdas consolidadas e histórico de contas

- `Novos projetos`
  - mede entradas e renovação da carteira

### 3.3. Recomendação de replicação para outras áreas

Se outra área da empresa quiser replicar a lógica, a melhor prática é preservar essa estrutura:

- uma planilha principal de carteira atual, extraída do Salesforce
- planilhas auxiliares de risco, desfecho, histórico e adoção
- uma regra clara sobre qual planilha é a fonte oficial da carteira

Essa definição evita divergências como:

- clientes aparecendo em painéis sem estarem mais na carteira ativa
- total de clientes maior em uma aba do que em outra
- MRR distorcido por mistura entre carteira atual e histórico

### 3.4. Base principal da carteira

A planilha de `Projetos abertos por implanter` é a base principal da carteira atual.

Ela é a referência para:

- total de projetos
- responsável do projeto
- status atual
- classificação da carteira/projeto
- MRR atual
- fator de risco

As outras planilhas entram como enriquecimento.

Elas não devem redefinir quem faz parte da carteira aberta.

### 3.5. Diretriz de replicação das extrações

Como essas bases vêm do Salesforce, a recomendação é documentar para cada área:

- nome do relatório no Salesforce
- objetivo do relatório
- frequência de exportação
- colunas obrigatórias
- dono responsável pela integridade da extração

Um formato simples de governança por base pode ser:

- `Nome do relatório`
- `Sistema de origem`
- `Objetivo`
- `Responsável`
- `Periodicidade`
- `Colunas críticas`
- `Usos no dashboard`

---

## 4. Arquitetura lógica da solução

### 4.1. Camadas

A solução foi montada em quatro camadas:

1. `Ingestão`
   - leitura das planilhas Excel
   - identificação das colunas

2. `Padronização`
   - normalização dos nomes dos clientes
   - conversão de datas
   - conversão de números
   - tratamento de campos vazios

3. `Camada de decisão`
   - cálculo do risco executivo
   - cálculo do Health Score
   - ordenação da fila

4. `Visualização`
   - dashboards executivos
   - cards
   - tabelas
   - filtros
   - documento HTML de priorização

### 4.2. Componentes principais do projeto

- [`/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/Dashboard.tsx`](/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/Dashboard.tsx)
  - orquestra uploads, filtros globais e tabs

- [`/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/ExecutiveOverview.tsx`](/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/ExecutiveOverview.tsx)
  - visão executiva da carteira

- [`/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/HealthScorePanel.tsx`](/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/HealthScorePanel.tsx)
  - leitura operacional de saúde da carteira

- [`/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/FunnelPanel.tsx`](/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/components/FunnelPanel.tsx)
  - fila inteligente e priorização semanal

- [`/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/utils/parseExecutiveFiles.ts`](/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/utils/parseExecutiveFiles.ts)
  - parser das planilhas executivas

- [`/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/utils/healthScore.ts`](/Users/pessoal/Documents/priorizacao-implantacao-dashboard/src/utils/healthScore.ts)
  - regras do Health Score, risco executivo e ordenação da fila

---

## 5. Lógica de classificação da carteira

### 5.1. Carteira A, B, C e D

A ferramenta prioriza a coluna de classificação que vier da base principal.

Hoje ela aceita:

- `Classificação da carteira`
- `Classificação do projeto`

Se a planilha vier com `Cliente Carteira A`, `Cliente Carteira B`, `Cliente Carteira C` ou `Cliente Carteira D`, a ferramenta converte internamente para:

- `A`
- `B`
- `C`
- `D`

Se não houver classificação explícita, existe fallback por MRR:

- `A` se MRR >= 2500
- `B` se MRR >= 1200
- `C` se MRR > 0
- `Não classificado` quando não há informação suficiente

### 5.2. Diretriz de replicação

Para replicar em outra área, a recomendação é:

- manter uma coluna oficial de classificação na base principal
- evitar depender de inferência por MRR quando o dado já existe

---

## 6. O que é considerado risco executivo

Existe uma diferença importante entre `Health Score` e `Risco executivo`.

### 6.1. Risco executivo

Risco executivo é uma régua direta, usada para liderança bater carteira rapidamente.

Na versão atual, um cliente entra em risco executivo quando tiver qualquer um destes sinais:

- status `Parado`
- status `Necessita de ação`
- status `Com problemas` ou `Em andamento com problemas`
- qualquer texto preenchido em `Fator de risco`

Em versões anteriores também existia leitura de `Em risco` / `Crítico`.
Essa régua pode continuar ativa quando a operação quiser manter esse sinal como risco explícito.

### 6.2. Por que essa régua existe

Porque a liderança precisa de uma leitura mais objetiva e auditável da carteira.

Ela é útil para responder:

- quantos clientes hoje já exigem atenção operacional
- quantos desses clientes estão na carteira A
- quanto de MRR está exposto

### 6.3. Exemplo prático

Se um cliente da `Carteira A` estiver com:

- status `Parado`

ele entra como:

- `Carteira A em risco`
- `MRR da carteira A em risco`

mesmo que o Health Score total dele ainda dependa de outros blocos.

---

## 7. Lógica do Health Score

O Health Score foi criado para sintetizar a saúde operacional do cliente em uma nota única de `0 a 100`.

### 7.1. Fórmula

Quando o engajamento se aplica:

```text
Health Score =
(Engajamento * 0,30) +
(Progresso * 0,25) +
(Risco * 0,25) +
(Contexto Estratégico * 0,20)
```

### 7.2. Classificação final

- `80 a 100`: `Saudável`
- `50 a 79`: `Atenção`
- `0 a 49`: `Risco`

### 7.3. Bloco 1: Engajamento

Peso: `30%`

Fonte principal:

- planilha de resumo de clientes em implantação

Sinais usados:

- faixa de engajamento
- percentual de uso, quando disponível
- usuários ativos vs usuários pendentes

Pontuação atual:

- alto engajamento: `90+`
- médio: `68 a 72`
- baixo: `35 a 40`
- sem uso / sem informação: `10 a 18`

### 7.4. Regra importante de negócio

Engajamento só entra no score quando o cliente está em `Acompanhamento`.

Antes disso:

- o bloco de engajamento fica como `N/A`
- o score é recalculado só com os outros três blocos
- o cliente não é penalizado por ainda não ter go-live

### 7.5. Proteção para projetos muito novos

Projetos com menos de `40 dias`:

- sem mensalidade vencida
- sem status de parado / risco

não são forçados para `Atenção` ou `Risco` apenas por ainda estarem no começo.

Na prática, o modelo protege a leitura para não punir projetos recém-iniciados.

### 7.6. Bloco 2: Progresso do projeto

Peso: `25%`

Sinais usados:

- fase atual
- status
- tempo de vida
- tempo sem atividade
- régua de prazo por perfil operacional

Lógica aplicada hoje:

- fases finais / acompanhamento / resultado: score mais alto
- implantação / treinamento / ativação: score intermediário alto
- kickoff / início: score intermediário
- parado / necessita de ação / risco: score cai

Prazo esperado:

- `MID`: 90 dias
- `SMB`: 60 dias

### 7.7. Bloco 3: Risco

Peso: `25%`

A nota começa em `100` e perde pontos conforme sinais aparecem.

Sinais usados hoje:

- mensalidade vencida: `-30`
- oportunidade de cancelamento: `-25`
- fator de risco preenchido: `-18`
- projeto parado: `-24`
- necessita de ação: `-14`
- projeto com problemas: `-18`
- projeto em risco / crítico: `-18`
- muitos usuários pendentes: `-14`
- alguns usuários pendentes: `-8`
- baixo engajamento: `-14`
- histórico de perdido: `-8`

### 7.8. Bloco 4: Contexto estratégico

Peso: `20%`

Sinais usados:

- MRR
- carteira A/B/C/D
- segmento
- antiguidade do projeto
- oportunidade de cancelamento

Faixas principais de score por MRR:

- MRR >= 4000: score base alto
- MRR >= 2500: score alto
- MRR >= 1500: score intermediário alto
- MRR >= 700: score intermediário
- MRR > 0: score mais baixo

Ajustes adicionais:

- carteira `A`: bônus estratégico
- carteira `B`: bônus intermediário
- cancelamento em cliente mais antigo: penalização

---

## 8. Lógica de priorização da fila

A fila não ordena só por risco.

Ela combina peso de negócio e urgência operacional.

### 8.1. Ordem de priorização

A função de ordenação atual segue esta lógica:

1. `Carteira A` primeiro
2. depois `Carteira B`
3. depois `Carteira C`
4. depois `Carteira D`
5. menor `Health Score` primeiro
6. clientes com oportunidade de cancelamento sobem
7. classificação `Risco` antes de `Atenção` antes de `Saudável`
8. maior MRR primeiro
9. projetos mais antigos primeiro

### 8.2. Motivo da priorização

Além da ordem, a ferramenta monta um campo de justificativa com sinais como:

- carteira A
- Health Score em risco
- oportunidade de cancelamento
- MRR relevante
- projeto parado
- tempo de vida alto

Isso ajuda a liderança a entender não só quem está no topo, mas por quê.

---

## 9. Documento do implanter

A ferramenta gera um documento HTML compartilhável com:

- resumo da carteira
- top 5 clientes priorizados
- MRR total e MRR em risco
- motivadores de prioridade
- ação recomendada
- sugestão de agenda semanal

Esse recurso foi pensado para transformar o dashboard em rotina operacional prática.

Ou seja:

- a liderança analisa a carteira
- o implanter recebe uma lista concreta de ataque da semana

---

## 10. Regras de cruzamento e tratamento de dados

Para a replicação funcionar em outras áreas, esta camada é crítica.

### 10.1. Cruzamento por cliente

As planilhas são cruzadas principalmente por `nome do cliente`.

Hoje existe limpeza básica, como:

- remoção de prefixo numérico do tipo `12345 - Cliente`

### 10.2. Campos vazios

Quando um dado não existe:

- a interface mostra `Sem informação`
- o cálculo tenta seguir sem quebrar

### 10.3. Colunas com nomes diferentes

A ferramenta já aceita mais de um nome possível para algumas colunas.

Exemplo:

- `Classificação da carteira`
- `Classificação do projeto`

Esse é um ponto importante para replicação:

- sempre mapear sinônimos de coluna
- nunca depender de um único cabeçalho fixo se a operação muda o export

---

## 11. Como replicar em outra área

### 11.1. Passo 1: definir o objeto principal da carteira

Toda replicação precisa começar definindo:

- qual é a entidade principal

Exemplos:

- clientes em implantação
- contas em ativação
- oportunidades em onboarding
- parceiros em setup

Essa base principal precisa ter:

- responsável
- status atual
- data de início
- MRR ou valor relevante
- classificação estratégica

### 11.2. Passo 2: listar as fontes de enriquecimento

Depois da base principal, mapear planilhas auxiliares como:

- churn/cancelamento
- inadimplência
- NPS ou nota de finalização
- adoção/engajamento
- backlog de tarefas
- sinais de risco qualitativos

### 11.3. Passo 3: definir a régua executiva de risco

Antes do Health Score, a operação precisa decidir:

- o que é risco incontestável

Exemplo:

- parado
- com problema
- sem atividade
- inadimplente
- com fator de risco

Essa régua deve ser simples, auditável e fácil de explicar.

### 11.4. Passo 4: definir a fórmula do score

Os quatro blocos usados aqui funcionam bem como referência:

- engajamento
- progresso
- risco
- contexto estratégico

Mas os pesos podem ser ajustados por área.

### 11.5. Passo 5: decidir a regra de priorização

Perguntas-chave:

- peso de negócio vem antes do risco?
- risco vem antes de MRR?
- contas novas precisam de proteção de score?
- oportunidades de cancelamento precisam subir na fila?

### 11.6. Passo 6: validar com o time operacional

A ferramenta só vira padrão quando o time reconhece a lógica como legítima.

Por isso, a recomendação é:

1. mostrar a primeira versão
2. ouvir os casos onde “não bate”
3. transformar esses casos em regras claras
4. versionar a régua

Esse foi exatamente o processo seguido aqui.

---

## 12. Lições aprendidas do projeto

### 12.1. O maior desafio não é técnico

O maior desafio é alinhar regra de negócio.

Quase todas as divergências mais relevantes surgiram de perguntas como:

- o que conta como risco?
- o que é carteira A de verdade?
- quando engajamento se aplica?
- cliente novo deve cair em atenção?

### 12.2. A base principal precisa ser soberana

Quando a fila foi montada usando a união de várias bases, os números inflaram.

A correção foi:

- usar `Projetos abertos` como fonte soberana da carteira atual
- usar as demais planilhas só como enriquecimento

Essa é uma regra importante para qualquer replicação.

### 12.3. Score sem explicação gera desconfiança

Por isso a interface não mostra só a nota.

Ela também mostra:

- sinais de risco
- motivo da priorização
- risco executivo
- ação recomendada

---

## 13. Recomendações para institucionalizar como ferramenta da empresa

### 13.1. Governança

Definir:

- dono da lógica de negócio
- dono da manutenção técnica
- dono da atualização das planilhas

### 13.2. Versionamento de regras

Manter um histórico simples de mudanças de régua:

- o que mudou
- por que mudou
- quando mudou

### 13.3. Padronização mínima das bases

Para escalar para outras áreas, vale criar um padrão de export com:

- identificador do cliente
- responsável
- data de início
- status
- classificação
- valor da conta
- sinal de risco

### 13.4. Ritual operacional

A ferramenta funciona melhor quando vira parte do ritual:

- batida semanal de carteira
- definição de top prioridades
- alinhamento entre liderança e operação
- acompanhamento da semana seguinte

---

## 14. Resumo executivo para apresentar ao time de Ops

Uma forma simples de explicar a ferramenta é:

> Construímos uma camada de visibilidade operacional que transforma várias planilhas da operação em um cockpit de decisão. A base principal é a carteira atual de projetos abertos. As demais bases enriquecem essa leitura com cancelamento, inadimplência, notas e histórico. Em cima disso, aplicamos duas leituras complementares: uma régua executiva de risco, simples e auditável, e um Health Score de 0 a 100 que combina engajamento, progresso, risco e contexto estratégico. O resultado é uma fila priorizada que mostra quem deve ser atacado primeiro, por qual motivo e com qual ação recomendada.

---

## 15. Próximos passos sugeridos para replicação

1. Escolher a próxima área piloto
2. Definir a base principal da carteira dessa área
3. Mapear as planilhas auxiliares
4. Definir a régua executiva de risco local
5. Ajustar pesos do score conforme o contexto
6. Validar com o time operacional em uma primeira rodada
7. Formalizar a régua como padrão da empresa
