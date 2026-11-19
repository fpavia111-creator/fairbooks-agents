# Fairbooks Machine domain agents

> Esta tradução foi feita pelo Claude e ainda não foi revisada por falantes nativos. Em caso de divergência, vale o [README em inglês](README.md).

Trinta agentes MCP pequenos. Cada um cuida de **um único processo de negócio** (uma revisão de acessos, uma conciliação bancária, uma checagem de migração de ERP, uma disputa de reembolso) e não consegue agir fora dele. Eles leem os arquivos que você já exporta, escrevem relatórios na sua máquina e esperam por uma pessoa identificada pelo nome antes de qualquer passo importante.

Licença MIT · Node 20 ou mais recente · somente arquivos locais · sem credenciais · sem dependências

## Experimente

```bash
npx -y fairbooks-access-review demo        # revisão de acessos com dados fictícios
npx -y fairbooks-erp-migration demo   # prontidão de migração de ERP com dados fictícios
```

Cada agente tem uma `demo` que roda com arquivos fictícios e um servidor MCP (`npx -y <agent> mcp`) para Claude Desktop, Claude Code, Cursor e outros hosts MCP. As ferramentas de cada agente estão no README dele (em inglês).

## Os agentes

**Finanças e contabilidade**

| Agente | O que faz | Espera uma pessoa antes de |
|---|---|---|
| `fairbooks-erp-migration` | Compara as exportações do sistema antigo e do novo (registros faltando, totais, balancetes por empresa e moeda, regras de campos) e escreve um relatório de prontidão | aprovar a entrada em produção (nunca faz isso) |
| `fairbooks-bank-reconciliation` | Conciliação entre banco e razão a partir de CSV, Excel, CAMT.053, MT940, BAI2 ou OFX: pareamentos sugeridos, itens de conciliação, conferência de saldos, transporte de fim de mês | lançar um ajuste contábil |
| `fairbooks-three-way-match` | Conciliação em três vias de pedidos, recebimentos e notas de fornecedores, com uma lista de exceções | lançar ou pagar (nunca) |
| `fairbooks-expense-policy` | Relatórios de despesas e textos de recibos verificados contra a sua política escrita, com achados citados | reembolsar; pagar é bloqueado |
| `fairbooks-vendor-tax-forms` | Prontidão de formulários W-9 de fornecedores dos EUA, números fiscais mascarados, fornecedores duplicados e rascunhos de solicitação | enviar uma solicitação; nunca entrega nada ao IRS |
| `fairbooks-cycle-counts` | Diferenças de inventário rotativo com checagens de data, unidade de medida e recontagem, ordenadas por valor | lançar ajustes |
| `fairbooks-board-pack` | Material para o conselho a partir de números fechados, com comentários citados e checagem de afirmações | a aprovação e a distribuição |
| `fairbooks-grant-reporting` | Prazos, ritmo do orçamento, resultados e evidências de subvenções em um rascunho de relatório | o envio |

**Acesso, segurança e TI**

| Agente | O que faz | Espera uma pessoa antes de |
|---|---|---|
| `fairbooks-access-review` | Recertificação de acessos de pessoas, agentes e contas de serviço: desligados, contas inativas e privilegiadas, conflitos de segregação de funções, revisores, prazos, pacote de evidências | remover um acesso (nunca faz isso) |
| `fairbooks-saas-seats` | Licenças SaaS sem uso, ociosas, duplicadas ou em plano acima do necessário, com economia estimada e calendário de renovações | remover uma licença |
| `fairbooks-onboarding-checklists` | Checklists de integração para funcionários, prestadores e clientes, com rascunhos de pedidos de acesso | conceder ou remover acessos |
| `fairbooks-config-drift` | Mudanças de configuração e de esquema ao longo do tempo, explicadas com níveis de risco | aplicar uma correção em produção |
| `fairbooks-certificate-expiry` | Acompanhamento de vencimentos de certificados TLS, domínios, licenças e comprovantes de seguro de fornecedores, com rascunhos de cobrança | renovações pagas, mudanças em produção e envios |
| `fairbooks-email-domain-audit` | Auditoria de SPF, DKIM, DMARC, MX, MTA-STS e TLS-RPT com consultas DNS-over-HTTPS somente leitura | mudar o DNS (nunca faz isso) |
| `fairbooks-mcp-server-review` | Revisão estática de um servidor MCP ou Code Mode, ou de uma configuração MCP, em busca de padrões de risco | executá-lo (nunca) |

**Clientes, fornecedores e operações**

| Agente | O que faz | Espera uma pessoa antes de |
|---|---|---|
| `fairbooks-refunds-and-chargebacks` | Triagem de reembolsos e chargebacks conforme a sua política, com rascunhos de pacotes de evidências | movimentar dinheiro (nunca) |
| `fairbooks-master-data-duplicates` | Fornecedores e itens duplicados, prévia de cada mesclagem campo a campo, uma mesclagem aprovada por vez em uma cópia | cada mesclagem; pagar um fornecedor exige um clique |
| `fairbooks-crm-hygiene` | Higiene de listas de contatos: devoluções, endereços genéricos, duplicados, registros antigos, consentimento | exclusões em massa |
| `fairbooks-outreach-email-gate` | Checagem de rascunhos de prospecção: lista de supressão, dados do rodapé, janela de envio, tamanho | enviar (nunca) |
| `fairbooks-rfi-and-submittals` | Registros de RFI e de submissões de obra comparados com o seu índice de plantas e especificações, com rascunhos de RFI que citam os seus documentos | o envio |
| `fairbooks-automation-audit` | Auditoria de fluxos do n8n, Zapier e Make quebrados ou arriscados | ativar ou alterar fluxos em produção |

**Privacidade, web e jurídico**

| Agente | O que faz | Espera uma pessoa antes de |
|---|---|---|
| `fairbooks-data-erasure-requests` | Pedidos de exclusão: onde estão os dados pessoais e um checklist | excluir (nunca exclui por conta própria) |
| `fairbooks-cookie-consent` | Inventário de cookies e serviços de terceiros a partir de HTML exportado e capturas HAR, comparado com a sua política e o seu banner | publicar; não é um gerenciador de consentimento e não afirma conformidade com GDPR ou CCPA |
| `fairbooks-web-page-audit` | Links quebrados, SEO básico e checagens WCAG automatizáveis em HTML exportado, com uma lista de correções | publicar; não é parecer jurídico |
| `fairbooks-contract-clauses` | Cláusulas de contrato verificadas contra o seu próprio manual, com citações e uma lista de pontos para os seus advogados | um envio vinculante; assinatura eletrônica é bloqueada; não é aconselhamento jurídico |
| `fairbooks-open-source-licenses` | A sua política escrita de licenças aplicada às dependências npm, com relatório, SBOM CycloneDX e SARIF | uma publicação de versão; não é aconselhamento jurídico |
| `fairbooks-audit-evidence` | Pasta de evidências a partir dos logs de auditoria dos agentes; evidência, não certificação | enviá-la a um auditor |

**Criar e testar agentes**

| Agente | O que faz | Espera uma pessoa antes de |
|---|---|---|
| `fairbooks-core` | O motor comum: manifesto, política permitir/perguntar/bloquear, validação de entradas, modos Review/Assist/Auto, limites, parada de emergência, log de auditoria assinado, página de aprovações, memória do domínio, leitores de arquivos, servidor MCP | (as regras abaixo) |
| `fairbooks-process-evals` | Avaliações privadas de um processo com um modelo fixo, com comparação de regressões; não chama nenhum modelo | publicar resultados |
| `fairbooks-docs-drift` | Desvios na documentação: README e SKILL.md comparados com a lista de ferramentas, os esquemas e o package.json, com correções mecânicas como cópias | publicar a documentação |
| `fairbooks-suitescript-inventory` | Inventário de SuiteScripts do NetSuite e classificação do risco de migrar para 2.1 | implantar (nunca) |

## Arquivos e idiomas

Os agentes leem CSV, TSV, texto separado por ponto e vírgula ou barra vertical, Excel `.xlsx`, JSON e JSONL. Doze deles reconhecem 39 exportações nomeadas pelas colunas (Okta, Microsoft Entra ID, Google Workspace, NetSuite, QuickBooks Online, Xero, Stripe, Shopify, Salesforce, Ramp, cinco bancos dos EUA e outras). Dois desses formatos foram conferidos com a documentação do fabricante; os outros foram escritos a partir do conhecimento dessas exportações, e nenhum foi testado em uma conta real.

Os arquivos de sistemas brasileiros são lidos do jeito que saem: nomes de coluna em português (`Valor`, `Fornecedor`, `CNPJ`, `Histórico`, `Débito`, `Crédito`, `Data de vencimento` e outros), arquivos em Windows-1252 ou UTF-16, valores como `R$ 1.234,56`, datas como `14/11/2026` ou `14 de novembro de 2026`, e razões sociais com Ltda., S/A, ME, EPP ou EIRELI. Extratos em OFX também são lidos. Com `--lang pt`, a página de aprovações, o relatório de prontidão do Fairbooks ERP Migration e o resumo de recertificação e a página de evidências do Fairbooks Access Review aparecem em português; resultados, códigos e arquivos CSV continuam em inglês.

## As regras que todo agente segue

- Ferramentas desconhecidas são bloqueadas. A decisão padrão é bloquear.
- **Auto** vem desligado e é ligado ação por ação, com limites de passos e de gastos e uma parada de emergência.
- Entrada em produção, remoção de acessos, exclusão de dados pessoais, movimentação de dinheiro, envios juridicamente vinculantes e implantações em produção sempre precisam do clique de uma pessoa identificada pelo nome, mesmo em Auto. O mesmo vale para mudar o que um agente lembra.
- Agentes com memória (Fairbooks ERP Migration e Fairbooks Access Review) usam apenas fatos que uma pessoa identificada aceitou, dizem quais fatos cada resultado usou e não conseguem aprender nada que afrouxe uma checagem.
- Cada decisão vai para um log de auditoria JSONL encadeado por hash, assinado se você fornecer uma chave.
- O texto dos seus arquivos é tratado como dado. Fórmulas de planilha, HTML bruto e `../` em identificadores são neutralizados na saída, e um resultado que cite um texto dirigido a um modelo de IA ("ignore previous instructions") é sinalizado. O sinal é uma heurística, não um filtro.

## O que eles não são

- Não são integrações ao vivo: leem arquivos exportados e nunca entram nos seus sistemas.
- Não são aconselhamento jurídico, tributário, contábil ou de auditoria, nem certificam nada.
- Não são totalmente autônomos: os passos acima esperam uma pessoa, sempre.
- Não é um filtro de privacidade: o que uma ferramenta devolve vai para o modelo de IA do seu assistente, inclusive nomes e e-mails dos seus arquivos. Só são mascarados identificadores fiscais (Vendor Tax Forms e a prévia de mesclagem do Master Data Duplicates), segredos e o titular em Data Erasure Requests. Para dados de funcionários, clientes e fornecedores, use um modelo coberto pelos seus próprios contratos ou um modelo local.
- Não afirmam nada sobre leis, regras tributárias ou formatos de declaração de nenhum país.

## Desenvolvimento

```bash
npm install
npm test
npm run hostile
npm run release:check
npm run bench
```

Criar um agente novo: [docs/build-an-agent.md](docs/build-an-agent.md) (em inglês). As mudanças da 0.2.0: [UPGRADE-0.2.0.md](UPGRADE-0.2.0.md) (em inglês).

MIT © 2026 Kurt Francisco · <https://mythosmachines.com>
