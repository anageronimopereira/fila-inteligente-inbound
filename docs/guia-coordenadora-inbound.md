# Guia da Coordenadora - Fila Inteligente Inbound

Este guia explica como usar a ferramenta Fila Inteligente Inbound, quais planilhas subir e como interpretar as principais abas.

## 1. Para que serve a ferramenta

A Fila Inteligente Inbound consolida as planilhas da operação de implantação Inbound em um painel único.

Ela ajuda a coordenadora a responder rapidamente:

- quais clientes estão ativos na carteira;
- quais clientes estão em risco;
- quais projetos precisam de ação primeiro;
- quanto MRR está em risco;
- quais implanters têm mais projetos críticos;
- quais clientes cancelaram, contraíram ou expandiram;
- quais clientes cancelaram até 6 meses depois da primeira receita.

A ferramenta não altera as planilhas originais. Ela apenas lê os arquivos enviados e monta os indicadores.

## 2. Como usar no dia a dia

1. Abra o aplicativo Fila Inteligente Inbound.
2. Entre na área Gestao da carteira.
3. Clique em Maximizar tabelas na seção Uploads do dashboard executivo.
4. Suba cada planilha no campo correspondente.
5. Aguarde o painel recalcular automaticamente.
6. Use os filtros de implanter e segmento quando quiser analisar uma carteira específica.

As planilhas ficam salvas no próprio aplicativo/navegador até você substituir o arquivo naquele campo.

## 3. Planilha principal obrigatória

### 1. Projetos abertos

Esta é a planilha mais importante. Sem ela, a ferramenta não consegue montar a carteira ativa nem a fila priorizada.

Use no campo:

`1. Projetos abertos`

O que ela alimenta:

- projetos ativos;
- carteira por implanter;
- MRR da carteira;
- Health Score;
- fila inteligente de risco;
- status, fase, último contato e atraso do projeto.

Colunas importantes esperadas:

- `Nome de Projeto`
- `Nome da Conta: Nome da conta`
- `Implantador do projeto: Nome completo`
- `Data do Kick-off`
- `Data prevista de entrega`
- `Status do projeto`
- `Detalhes do tipo de projeto`
- `Por que parado?`
- `Data da última atividade`
- `Classificação da carteira`
- `Valor Total do Contrato`

## 4. Planilhas recomendadas para visão completa

### 2. Nota de finalização

Use no campo:

`2. Nota de finalização`

Serve para acompanhar projetos concluídos e a nota/comentário de finalização.

Alimenta:

- total de concluídos;
- taxa de sucesso;
- nota média;
- voz do cliente na conclusão;
- comparação de concluídos por implanter.

Colunas importantes:

- `Nome da conta`
- `Nome de Projeto`
- `Data de fechamento do projeto`
- `Implantador do projeto: Nome completo`
- `Valor Total do Contrato`
- `Classificação da carteira`
- `Nota da finalização`

### 3. Projetos perdidos

Use no campo:

`3. Projetos perdidos`

Serve para medir perdas e comparar com os concluídos.

Alimenta:

- projetos perdidos;
- taxa de sucesso;
- MRR perdido;
- análise por implanter.

### 4. Oportunidade de cancelamento

Use no campo:

`4. Oportunidade de cancelamento`

Serve para identificar clientes com oportunidade/risco de cancelamento aberto.

Alimenta:

- sinais de cancelamento;
- clientes em negociação de cancelamento;
- motivos de risco;
- impacto de MRR.

Colunas importantes:

- `nome_oportunidade`
- `nome_projeto`
- `nome_parceiro`
- `segmento`
- `name`
- `meses_de_vida`
- `Valor_Final_c`
- `fase_c`
- `tipo_de_projeto_c`
- `motivo_da_solicitacao`
- `observacoes_sobre_a_conta`

### 5. Novos projetos

Use no campo:

`5. Novos projetos`

Serve para acompanhar entrada de carteira e volume novo por implanter.

Alimenta:

- novos projetos;
- evolução da carteira;
- histórico/forecast de entrada.

### 6. Inadimplência / resumo em implantação

Use no campo:

`6. Inadimplência / resumo em implantação`

Serve para enriquecer o Health Score com sinais operacionais do cliente.

Alimenta:

- mensalidade vencida;
- B2B configurado ou não;
- usuários pendentes;
- engajamento de vendedores;
- aplicativos integrados;
- link de detalhe do cliente.

Colunas importantes:

- `Nome Cliente`
- `Implantador Do Projeto C`
- `Fase Do Projeto`
- `Possui Mensalidade Vencida`
- `Aplicativos Integrados`
- `Tem B2B?`
- `Usuarios Com Cadastro Pendente`
- `Usuarios Vendedores`
- `Faixa Engajamento Vendedores Emitindo 5 Pedidos Ou Mais Ult 3 Meses`
- `Detalhar Cliente`

### 7. Valor do contrato

Use no campo:

`7. Valor do contrato`

Serve para corrigir/enriquecer o MRR dos projetos abertos quando a planilha principal não traz o valor correto.

Colunas importantes:

- `Nome da conta`
- `Nome de Projeto`
- `Valor Total do Contrato`

## 5. Planilhas SaaS

As planilhas SaaS devem ser enviadas em CSV.

A ferramenta considera apenas registros em que `Canal de Aquisição` seja `Inbound`.

### 8. SaaS cancelamento

Use no campo:

`8. SaaS cancelamento`

Serve para medir cancelamentos ligados à carteira Inbound.

Coluna de valor esperada:

- `Valor Cancelled`

### 9. SaaS expansão

Use no campo:

`9. SaaS expansão`

Serve para medir expansão de MRR em clientes Inbound.

Coluna de valor esperada:

- `Valor Expansion`

### 10. SaaS contraction

Use no campo:

`10. SaaS contraction`

Serve para medir redução de MRR em clientes Inbound.

Coluna de valor esperada:

- `Valor Contraction`

Colunas importantes nas três planilhas SaaS:

- `Mês de Referência`
- `Contrato`
- `Código da Empresa`
- `Segmento Mercos`
- `Modelo de Assinatura`
- `Canal de Aquisição`
- `Faturado Por`
- `1a Receita`
- `Responsável CS`
- `Vendedor`

## 6. Aba Cancelamentos até 6 meses

Esta aba analisa clientes que cancelaram até 6 meses depois da primeira receita.

Use no campo:

`Cancelamentos 6m`

Planilha necessária:

- SaaS cancelamento dos últimos 6 meses, em CSV.

A ferramenta compara:

- mês do cancelamento;
- coluna `1a Receita`;
- valor cancelado;
- responsável CS.

Resultado esperado:

- clientes encontrados;
- MRR cancelado;
- ticket médio;
- cancelamentos durante implantação;
- cancelamentos pós-implantação.

## 7. O que cada aba mostra

### Direcionamento estratégico da carteira

É a visão executiva da operação.

Use para acompanhar:

- projetos ativos;
- MRR total;
- saúde da carteira;
- projetos por implanter;
- concluídos e perdidos;
- cancelamentos, contractions e expansões.

### Health Score da carteira

Mostra a saúde operacional dos clientes.

O Health Score considera sinais como:

- status do projeto;
- atraso;
- falta de atividade recente;
- inadimplência;
- B2B;
- engajamento;
- risco de cancelamento.

Use para entender quais clientes estão saudáveis, em atenção ou em risco.

### Fila inteligente de projetos por risco

É a aba de ação semanal.

Use para decidir:

- quem atacar primeiro;
- qual cliente tem maior risco;
- qual MRR está exposto;
- qual ação recomendar para o implanter.

### Forecast da batida

Ajuda a organizar previsão e movimentações da carteira.

Use para consolidar:

- clientes que podem concluir;
- clientes em risco;
- clientes com expansão/contraction/cancelamento;
- próximos passos por implanter.

### Cancelamentos até 6 meses

Use para investigar churn inicial após a primeira receita.

É útil para entender se o problema ocorreu:

- ainda na implantação;
- logo depois de sair da implantação.

## 8. Rotina recomendada

### Antes da reunião semanal

1. Baixe as planilhas atualizadas.
2. Abra o app.
3. Substitua os arquivos antigos pelos novos.
4. Confira se não apareceu erro em Detalhes dos uploads.
5. Analise primeiro a aba Direcionamento estratégico.
6. Depois use a Fila inteligente para definir prioridades.

### Durante a batida

1. Filtre por implanter.
2. Revise os clientes em risco.
3. Combine a próxima ação.
4. Use a fila como apoio para decidir o foco da semana.

### Depois da batida

1. Atualize as ações combinadas nas planilhas/sistema oficial.
2. Gere relatório se necessário.
3. Substitua as planilhas na próxima atualização.

## 9. Cuidados importantes

- Não renomeie colunas das planilhas antes de subir.
- Prefira baixar os relatórios direto do sistema, sem editar manualmente.
- Se uma planilha não carregar, confira se o arquivo foi colocado no campo certo.
- Se os números parecerem zerados, confira se a planilha tem dados de Inbound.
- Nas planilhas SaaS, confirme se `Canal de Aquisição` está preenchido como `Inbound`.
- Se trocar uma planilha, a ferramenta recalcula os indicadores automaticamente.

## 10. Resumo das planilhas

| Campo no app | Formato | Obrigatória? | Para que serve |
| --- | --- | --- | --- |
| 1. Projetos abertos | XLSX/XLS/CSV | Sim | Carteira ativa, risco, Health Score e fila |
| 2. Nota de finalização | XLSX/XLS/CSV | Recomendada | Concluídos, notas e taxa de sucesso |
| 3. Projetos perdidos | XLSX/XLS/CSV | Recomendada | Perdas e taxa de sucesso |
| 4. Oportunidade de cancelamento | XLSX/XLS/CSV | Recomendada | Risco de churn e MRR exposto |
| 5. Novos projetos | XLSX/XLS/CSV | Recomendada | Entrada de carteira |
| 6. Inadimplência / resumo em implantação | XLSX/XLS/CSV | Recomendada | Sinais operacionais e Health Score |
| 7. Valor do contrato | XLSX/XLS/CSV | Opcional | Ajuste do MRR/contrato |
| 8. SaaS cancelamento | CSV | Recomendada | Cancelamentos Inbound |
| 9. SaaS expansão | CSV | Opcional | Expansões Inbound |
| 10. SaaS contraction | CSV | Opcional | Reduções de MRR Inbound |
| Cancelamentos 6m | CSV | Opcional | Churn até 6 meses após primeira receita |

## 11. Quem está configurado como implanter Inbound

A ferramenta está configurada para a carteira Inbound com estes implanters:

- Alice Hermann
- Ana Carolina Lapa
- Ellen Cristina Moura
- Sara Zanluca
- Tiago Filipe

