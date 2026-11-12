# Aurora Pay Core API

API do motor de pagamentos da Aurora Pay. Implementa o Sprint 1 com transferências PIX idempotentes, validação de saldo, antifraude, revisão manual e ledger de dupla entrada.

## Stack

- Node.js 18+
- TypeScript
- Express
- TypeORM + PostgreSQL
- Zod
- Vitest + Supertest
- Swagger UI

## Arquitetura

O código segue Clean Architecture:

- `src/domain`: entidades, enums, erros e value objects.
- `src/application`: casos de uso, portas e serviços de aplicação.
- `src/infrastructure`: HTTP, banco, risco, segurança, BaaS mock, migration e seed.
- `tests`: testes unitários e de integração.

## Como rodar

```bash
cp .env.example .env
docker-compose up -d
npm install
npm run migration:run
npm run seed
npm run dev
```

A API e o MVP web ficam em `http://localhost:3000` e o Swagger em `http://localhost:3000/api-docs`.

Para validar sem Docker, use `npm test`. Os testes HTTP usam implementações em memória.

## Variáveis de ambiente

As principais variáveis estão em `.env.example`:

- `DB_*`: conexão PostgreSQL.
- `PII_HMAC_KEY`: chave HMAC para pseudonimizar CPF.
- `PII_ENCRYPTION_KEY`: chave AES-256-GCM com 64 caracteres hexadecimais.
- `ADMIN_API_KEY`: chave do header `x-admin-api-key` para compliance.
- `RISK_ENGINE`: `local` ou `http`.
- `ANTI_FRAUD_SERVICE_URL`: URL do motor antifraude externo.
- `RISK_REVIEW_THRESHOLD_CENTS`: limite de revisão, padrão `500000`.
- `RISK_BLOCK_THRESHOLD_CENTS`: limite de bloqueio, padrão `1000000`.
- `CLEARING_ACCOUNT_NUMBER`: conta contábil interna, padrão `CLEARING-0001`.
- `ENABLE_SANDBOX_ENDPOINTS`: habilita depósitos sandbox.

## Seed

O seed cria dois clientes de demonstração e credita saldo inicial:

| Cliente        | CPF           | Saldo inicial |
| -------------- | ------------- | ------------- |
| João Silva     | `52998224725` | R$ 100,00     |
| Maria Oliveira | `11144477735` | R$ 20,00      |

Execute com:

```bash
npm run seed
```

O seed é idempotente para os clientes e depósitos cadastrados.

## MVP web para demonstração

Com a API iniciada, abra `http://localhost:3000`. A tela permite consultar o saldo e o extrato de uma conta seed e enviar PIX pelo fluxo real da API, incluindo idempotência, validação de saldo e decisão antifraude. O front-end é servido pelo Express em `public/` e não exige dependências adicionais.

Para conectar um perfil de demonstração, execute `npm run seed` e copie o `customerId` e o `accountId` exibidos no resultado para a seção **Configurar conta de demonstração** da tela. O seed disponibiliza João Silva (saldo inicial de R$ 100,00) e Maria Oliveira (R$ 20,00). Esses IDs ficam salvos no navegador para as próximas visitas.

Transferências de R$ 5.000,00 ou mais podem ser encaminhadas para revisão; valores a partir de R$ 10.000,00 são bloqueados pelo motor de risco local. A revisão e as ferramentas de compliance continuam disponíveis pelos endpoints documentados e no Swagger.

## Endpoints

### Clientes e contas

| Método | Rota                               | Descrição            |
| ------ | ---------------------------------- | -------------------- |
| `POST` | `/customers`                       | Cria cliente e conta |
| `GET`  | `/customers/:customerId/balance`   | Consulta saldo       |
| `GET`  | `/customers/:customerId/statement` | Consulta extrato     |

### PIX

| Método | Rota                         | Descrição                |
| ------ | ---------------------------- | ------------------------ |
| `POST` | `/pix/transfers`             | Inicia transferência PIX |
| `GET`  | `/pix/transfers/:transferId` | Consulta transferência   |

O header `Idempotency-Key` é obrigatório em `POST /pix/transfers`. O valor aceita qualquer texto de até 100 caracteres, como `123-abc`.

Exemplo:

```bash
curl -X POST http://localhost:3000/pix/transfers \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 123-abc" \
  -d '{
    "accountId": "00000000-0000-4000-8000-000000000002",
    "targetKey": "destinatario@example.com",
    "amountCents": 5000
  }'
```

Respostas esperadas:

- `202`: transferência aceita. Pode retornar `SETTLED`, `IN_DOUBT` ou `PENDING_REVIEW`.
- `409` `DUPLICATE_IDEMPOTENCY_KEY`: chave já utilizada.
- `422` `INSUFFICIENT_FUNDS`: mensagem exata `Saldo insuficiente`.
- `403` `RISK_BLOCKED`: bloqueio antifraude.
- `400` `VALIDATION_ERROR`: payload ou header inválido.

### Compliance

Protegido pelo header `x-admin-api-key`.

| Método | Rota                                            | Descrição                       |
| ------ | ----------------------------------------------- | ------------------------------- |
| `GET`  | `/compliance/pix/transfers/pending`             | Lista transferências em revisão |
| `POST` | `/compliance/pix/transfers/:transferId/approve` | Aprova e liquida                |
| `POST` | `/compliance/pix/transfers/:transferId/reject`  | Rejeita                         |

```bash
curl -X POST http://localhost:3000/compliance/pix/transfers/SEU_TRANSFER_ID/approve \
  -H "x-admin-api-key: dev_admin_key"
```

### Sandbox

| Método | Rota                | Descrição              |
| ------ | ------------------- | ---------------------- |
| `POST` | `/sandbox/deposits` | Credita saldo de teste |

Exige `Idempotency-Key`. Use apenas em desenvolvimento.

```bash
curl -X POST http://localhost:3000/sandbox/deposits \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: deposito-1" \
  -d '{
    "accountId": "SEU_ACCOUNT_ID",
    "amountCents": 10000
  }'
```

## Regras de risco

O motor local aplica:

- Até `499999` centavos: `APPROVE`.
- De `500000` a `999999` centavos: `REVIEW`.
- A partir de `1000000` centavos: `BLOCK`.

Com `RISK_ENGINE=http`, a API consulta `ANTI_FRAUD_SERVICE_URL` e usa o motor local como fallback em caso de falha.

## Ledger

Toda movimentação gera um `JournalEntry` com dois lançamentos:

- Débito na conta de origem.
- Crédito na conta interna `CLEARING-0001`.

A soma dos lançamentos deve ser zero. Depósitos sandbox debitam a conta clearing e creditam a conta do cliente.

## Scripts

```bash
npm run dev               # desenvolvimento com watch
npm run build             # compila para dist
npm start                 # executa build
npm test                  # testes
npm run test:coverage     # testes com cobertura mínima de 80%
npm run typecheck         # checagem TypeScript
npm run lint              # ESLint
npm run format            # Prettier
npm run migration:run     # aplica migrations
npm run migration:revert  # reverte última migration
npm run seed              # popula dados de demonstração
```

## Limitações do MVP

- Autenticação de clientes é simplificada; o foco é o fluxo PIX.
- O BaaS é simulado internamente.
- Não há conciliação automática de transferências `IN_DOUBT`.
- O endpoint sandbox não possui autenticação e deve ficar desabilitado em produção.
- Estornos e reversão contábil ainda não estão expostos pela API.
