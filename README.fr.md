# Fair-Agents domain agents

> Cette traduction a été rédigée par Claude et n'a pas encore été relue par des locuteurs natifs. En cas de divergence, la [README anglaise](README.md) fait foi.

Trente petits agents MCP. Chacun prend en charge **un seul processus métier** (une revue des accès, un rapprochement bancaire, un contrôle de migration ERP, une contestation de remboursement) et ne peut rien faire en dehors. Ils lisent les fichiers que vous exportez déjà, écrivent leurs rapports sur votre machine et attendent une personne nommément désignée avant toute étape importante.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · aucune dépendance

## Essayer

```bash
npx -y fairbooks-access-review demo        # revue des accès sur des données fictives
npx -y fairbooks-erp-migration demo   # préparation d'une migration ERP sur des données fictives
```

Chaque agent a une `demo` qui tourne sur des fichiers fictifs et un serveur MCP (`npx -y <agent> mcp`) pour Claude Desktop, Claude Code, Cursor et les autres hôtes MCP. Les outils de chaque agent sont décrits dans sa README (en anglais).

## Les agents

**Finance et comptabilité**

| Agent | Ce qu'il fait | Attend une personne avant |
|---|---|---|
| `fairbooks-erp-migration` | Compare les exports de l'ancien et du nouveau système (enregistrements manquants, totaux, balances par filiale et par devise, règles de champs) et rédige un rapport de préparation | d'approuver la mise en production (il ne le fait jamais) |
| `fairbooks-bank-reconciliation` | Rapprochement banque et grand livre à partir de CSV, Excel, CAMT.053, MT940, BAI2 ou OFX : rapprochements proposés, suspens, contrôle des soldes, report de fin de mois | de passer une écriture de régularisation |
| `fairbooks-three-way-match` | Rapprochement à trois voies des commandes, réceptions et factures fournisseurs, avec une liste d'anomalies | de comptabiliser ou payer (jamais) |
| `fairbooks-expense-policy` | Notes de frais et textes de reçus contrôlés selon votre politique écrite, avec des constats sourcés | de rembourser ; le paiement est bloqué |
| `fairbooks-vendor-tax-forms` | Préparation des formulaires W-9 de fournisseurs américains, numéros fiscaux masqués, doublons et brouillons de demande | d'envoyer une demande ; ne dépose jamais rien auprès de l'IRS |
| `fairbooks-cycle-counts` | Écarts d'inventaire tournant avec contrôles de date, d'unité de mesure et de recomptage, classés par valeur | de passer les ajustements |
| `fairbooks-board-pack` | Dossier pour le conseil à partir de chiffres arrêtés, avec commentaires sourcés et contrôle des affirmations | la validation et la diffusion |
| `fairbooks-grant-reporting` | Échéances, rythme budgétaire, résultats et justificatifs de subventions dans un projet de rapport | le dépôt |

**Accès, sécurité et informatique**

| Agent | Ce qu'il fait | Attend une personne avant |
|---|---|---|
| `fairbooks-access-review` | Recertification des accès des personnes, agents et comptes de service : départs, comptes inactifs et à privilèges, conflits de séparation des tâches, réviseurs, échéances, dossier de preuves | de retirer un accès (il ne le fait jamais) |
| `fairbooks-saas-seats` | Licences SaaS inutilisées, inactives, en double ou surdimensionnées, avec économies estimées et calendrier de renouvellement | de retirer une licence |
| `fairbooks-onboarding-checklists` | Listes d'intégration pour salariés, prestataires et clients, avec brouillons de demandes d'accès | d'accorder ou retirer un accès |
| `fairbooks-config-drift` | Dérive de configuration et de schéma dans le temps, expliquée avec des niveaux de risque | d'appliquer un correctif en production |
| `fairbooks-certificate-expiry` | Suivi des échéances de certificats TLS, domaines, licences et attestations d'assurance fournisseurs, avec brouillons de relance | les renouvellements payants, les changements en production et les envois |
| `fairbooks-email-domain-audit` | Audit SPF, DKIM, DMARC, MX, MTA-STS et TLS-RPT par requêtes DNS-over-HTTPS en lecture seule | de modifier le DNS (il ne le fait jamais) |
| `fairbooks-mcp-server-review` | Revue statique d'un serveur MCP ou Code Mode, ou d'une configuration MCP, à la recherche de schémas risqués | de l'exécuter (jamais) |

**Clients, fournisseurs et opérations**

| Agent | Ce qu'il fait | Attend une personne avant |
|---|---|---|
| `fairbooks-refunds-and-chargebacks` | Tri des remboursements et rétrofacturations selon votre politique, avec brouillons de dossiers de preuves | de déplacer de l'argent (jamais) |
| `fairbooks-master-data-duplicates` | Fournisseurs et articles en double, aperçu de chaque fusion champ par champ, une fusion approuvée à la fois sur une copie | chaque fusion ; payer un fournisseur demande un clic |
| `fairbooks-crm-hygiene` | Hygiène des listes de contacts : rebonds, adresses génériques, doublons, fiches obsolètes, consentement | les suppressions en masse |
| `fairbooks-outreach-email-gate` | Contrôle des brouillons de prospection : liste d'exclusion, mentions de pied de page, plage d'envoi, longueur | d'envoyer (jamais) |
| `fairbooks-rfi-and-submittals` | Registres de RFI et de visas de chantier comparés à votre index de plans et de cahiers des charges, avec des brouillons de RFI citant vos documents | l'envoi |
| `fairbooks-automation-audit` | Audit des flux n8n, Zapier et Make cassés ou risqués | d'activer ou modifier des flux en production |

**Vie privée, web et juridique**

| Agent | Ce qu'il fait | Attend une personne avant |
|---|---|---|
| `fairbooks-data-erasure-requests` | Demandes d'effacement : où se trouvent les données personnelles, et une liste de contrôle | de supprimer (il ne supprime jamais lui-même) |
| `fairbooks-cookie-consent` | Inventaire des cookies et services tiers à partir de HTML exporté et de captures HAR, comparé à votre politique et à votre bandeau | la publication ; ce n'est pas un outil de gestion du consentement et il n'affirme aucune conformité au RGPD ou au CCPA |
| `fairbooks-web-page-audit` | Liens cassés, bases du SEO et contrôles WCAG automatisables sur du HTML exporté, avec une liste de corrections | la publication ; pas un avis juridique |
| `fairbooks-contract-clauses` | Clauses de contrat contrôlées selon votre propre guide, avec références et une liste de points pour vos avocats | un envoi engageant ; la signature électronique est bloquée ; pas un conseil juridique |
| `fairbooks-open-source-licenses` | Votre politique écrite de licences appliquée aux dépendances npm, avec rapport, SBOM CycloneDX et SARIF | une publication de version ; pas un conseil juridique |
| `fairbooks-audit-evidence` | Dossier de preuves tiré des journaux d'audit des agents ; des preuves, pas une certification | de l'envoyer à un auditeur |

**Construire et tester des agents**

| Agent | Ce qu'il fait | Attend une personne avant |
|---|---|---|
| `fairbooks-core` | Le moteur commun : manifeste, politique autoriser/demander/bloquer, validation des entrées, modes Review/Assist/Auto, plafonds, arrêt d'urgence, journal d'audit signé, page d'approbation, mémoire métier, lecteurs de fichiers, serveur MCP | (les règles ci-dessous) |
| `fairbooks-process-evals` | Évaluations privées d'un processus sur un modèle figé, avec comparaison de régression ; n'appelle aucun modèle | de publier les résultats |
| `fairbooks-docs-drift` | Dérive de documentation : README et SKILL.md comparés à la liste d'outils, aux schémas et au package.json, avec corrections mécaniques sous forme de copies | de publier la documentation |
| `fairbooks-suitescript-inventory` | Inventaire des SuiteScripts NetSuite et classement des risques de migration vers 2.1 | de déployer (jamais) |

## Fichiers et langues

Les agents lisent le CSV, le TSV, le texte séparé par des points-virgules ou des barres verticales, Excel `.xlsx`, JSON et JSONL. Douze d'entre eux reconnaissent 39 exports nommés à leurs colonnes (Okta, Microsoft Entra ID, Google Workspace, NetSuite, QuickBooks Online, Xero, Stripe, Shopify, Salesforce, Ramp, cinq banques américaines et d'autres). Deux de ces formats ont été vérifiés dans la documentation des éditeurs ; les autres ont été écrits à partir de la connaissance de ces exports, et aucun n'a été testé sur un compte réel.

Les fichiers des systèmes français se lisent tels quels : noms de colonnes en français (`Montant`, `Libellé`, `Fournisseur`, `N° TVA`, `Date d'échéance` et d'autres), fichiers en Windows-1252 ou UTF-16, montants comme `1 234,56 €` avec espace insécable, dates comme `14/11/2026` ou `14 novembre 2026`, raisons sociales avec SARL, SAS, SASU ou SA. Les relevés bancaires CAMT.053 et MT940 sont lus aussi. Avec `--lang fr`, la page d'approbation, le rapport de préparation d'Fair-Agents ERP Migration ainsi que le résumé de recertification et la page de preuves de Fair-Agents Access Review s'affichent en français ; les résultats, les codes et les fichiers CSV restent en anglais.

## Les règles que suit chaque agent

- Les outils inconnus sont bloqués. La décision par défaut est le blocage.
- **Auto** est désactivé par défaut et s'active action par action, avec des plafonds de nombre d'étapes et de dépenses, et un arrêt d'urgence.
- La mise en production, le retrait d'accès, la suppression de données personnelles, les mouvements d'argent, les envois juridiquement engageants et les déploiements en production demandent toujours le clic d'une personne nommément désignée, même en Auto. Il en va de même pour toute modification de ce qu'un agent retient.
- Les agents dotés d'une mémoire (Fair-Agents ERP Migration et Fair-Agents Access Review) n'utilisent que des faits acceptés par une personne nommément désignée, indiquent quels faits chaque résultat a utilisés et ne peuvent rien apprendre qui assouplisse un contrôle.
- Chaque décision est inscrite dans un journal d'audit JSONL chaîné par hachage, signé si vous fournissez une clé.
- Le texte de vos fichiers est traité comme des données. Les formules de tableur, le HTML brut et les `../` dans les identifiants sont neutralisés en sortie, et un résultat qui cite un texte adressé à un modèle d'IA (« ignore previous instructions ») est signalé. Ce signalement est une heuristique, pas un filtre.

## Ce qu'ils ne sont pas

- Pas des intégrations en direct : ils lisent des fichiers exportés et ne se connectent jamais à vos systèmes.
- Pas un conseil juridique, fiscal, comptable ou d'audit, ni une certification de quoi que ce soit.
- Pas entièrement autonomes : les étapes ci-dessus attendent une personne, à chaque fois.
- Pas un filtre de confidentialité : ce qu’un outil renvoie va au modèle d’IA de votre assistant, y compris les noms et adresses e-mail de vos fichiers. Seuls les identifiants fiscaux (Vendor Tax Forms, et l’aperçu de fusion de Master Data Duplicates), les secrets et la personne concernée dans Data Erasure Requests sont masqués. Pour les données du personnel, des clients et des fournisseurs, utilisez un modèle couvert par vos propres contrats ou un modèle local.
- Aucune affirmation sur les lois, règles fiscales ou formats de déclaration d'un pays.

## Développer

```bash
npm install
npm test
npm run hostile
npm run release:check
npm run bench
```

Créer un nouvel agent : [docs/build-an-agent.md](docs/build-an-agent.md) (en anglais). Les changements de la 0.2.0 : [UPGRADE-0.2.0.md](UPGRADE-0.2.0.md) (en anglais).

MIT © 2026 Kurt Francisco · <https://mythosmachines.com>
