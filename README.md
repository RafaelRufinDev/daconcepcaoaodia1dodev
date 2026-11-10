# daconcepcaoaodia1dodev

Motor principal de pagamentos da Aurora Pay, responsável pelo
processamento de transferências PIX, validação de saldo e integração
com o motor antifraude.
pré-requisitos
- Node.js (v18+)
- Docker e Docker Compose (para o banco de dados I
- Git
Como rodar o projeto localmente (Localhost)
1. Clone o repositório:
git clone https://github.com/RafaelRufinDev/daconcepcaoaodia1dodev/
2. Acesse a pasta do projeto:
cd core-api
3. Configure as variáveis de ambiente:
cp .env.example .env
4. Suba a infraestrutura local (Banco de Dados PostgreSQL):
docker-compose up -d
5. Instale as dependências:
npm install
6. Rode as migrations do banco de dados:
npm run typeorm migration:run
7. Inicie o servidor em modo de desenvolvimento:
npm run dev
A API estará disponível em http://localhost:3000. Acesse
http://localhost:3000/api-docs para visualizar o contrato OpenAPl
(Swagger).

8.3 Variáveis de Ambiente (.env)

# Configurações da Aplicação
PORT-3egg
NODE_ENv-deve10pment
# Banco de Dados (PostgreSQL)
DB_PORTz5432
# Integrações e Segurança
JWT secreta_jwt_ aqui
ANTI_FRAUD_SERVICE_URL-http : / 11 ocai host :aaal ,'verify
BACEN _ PIX_ API _ KE key_ pa r a _desenvolv to _ local
8.4 Guia de Padrões de Código
Arquitetura: Utilizamos Clean Architecture (Arquitetura Limpa). O código
deve ser estritamente dividido nas camadas de Domain (Entidades),
UseCases (Regras de negócio), Adapters (Controladores/lnterfaces) e
Infrastructure (Banco de Dados/APls externas).
Convenção de Nomes:
- Arquivos e Pastas: kebab-case (ex: pix-transfer.controller.ts)
- Classes e Interfaces: PascalCase (ex: PixTransferService)
- Variáveis e Métodos: camelCase (ex: processTransfer())
- Constantes: (ex:
Linting e Formatação: O projeto utiliza ESLint e Prettier. O commit será
bloqueado pelo Husky caso haja erros de lint (comando npm run lint).
Tratamento de Erros: Nunca retorne erros genéricos. Utilize a classe
padrão AppError passando o status HTTP e a mensagem mapeada para o
front-end.

8.5 Git Workflow Definido

Estratégia: Utilizaremos o GitFlow.
Branches Principais:
- main: Código em produção (estável).
- develop: Código em ambiente de staging (integração).
Branches de Trabalho:
- feature/nome-da-feature (ex: feature/pix-idempotency)
- bugfix/nome-do-bug (ex: bugfix/fix-pix-timeout)
Padrão de Commits (Conventional Commits):
- feat: adiciona endpoint de transferência PIX
- fix: corrige validação de saldo insuficiente
- docs: atualiza documentação do swagger
Pull Requests (PRS): Para fazer merge em develop, o PR exige no mínimo
1 aprovação (Code Review) de outro desenvolvedor e que a esteira de Cl
(testes automatizados) passe com sucesso.
8.6 Sprint 1 Detalhada com Critérios de
Aceite
Objetivo da Sprint 1: Implementar o motor básico de processamento de
PIX com garantia de idempotência e validação de risco.
User Story I (USOI): Inicialização de Transferência PD(
História: Como cliente (persona), quero realizar uma transferência PIX
informando a chave de destino e o valor, para pagar terceiros rapidamente.
Critérios de Aceite (BDD):
Cenário 1: Transferência válida.
- Given que o cliente possui saldo de R$ 100,00.
- When ele solicitar um PIX de R$ 50,00 para uma chave válida.
- Then o sistema deve retornar status HTTP 202 (Aceito) e deduzir o saldo.
Cenário 2: Saldo insuficiente.
- Given que o cliente possui saldo de R$ 20,00.
- When ele solicitar um PIX de R$ 50,00.
- Then o sistema deve bloquear a operação e retornar status HTTP 422
com a mensagem "Saldo insuficiente"
User Story 2 (US02): Proteção contra Duplicidade
(Idempotência)
História: Como desenvolvedor back-end, quero garantir que a mesma
requisição PIX não seja processada duas vezes em caso de falha de rede
(retry), para evitar prejuízos financeiros.
Critérios de Aceite (BDD):

Cenário 1: Primeira tentativa.
- Given um payload de transferência com o Idempotency-Key: 123-abc.
- When a API receber a requisição pela primeira vez.
- Then o sistema deve processar o PIX e salvar a chave no banco de
dados.
Cenário 2: Tentativa duplicada.
- Given que a chave 123-abc já foi processada com sucesso há 5
segundos.
- When a API receber um novo payload com a mesma Idempotency-Key.
- Then o sistema não deve refazer a transação financeira e deve retornar o
status HTTP 409 (Conflito), conforme documentado no OpenAPl.


