export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Aurora Pay Core API',
    version: '1.0.0',
    description:
      'MVP do motor de transferências PIX da Aurora Pay com idempotência, validação de saldo, motor antifraude e ledger de dupla entrada.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Desenvolvimento local' }],
  tags: [
    { name: 'Clientes', description: 'Cadastro, saldo e extrato' },
    { name: 'PIX', description: 'Transferências PIX' },
    { name: 'Compliance', description: 'Revisão manual de transações de risco' },
    { name: 'Sandbox', description: 'Apoio ao desenvolvimento local' },
    { name: 'Saúde', description: 'Disponibilidade da API' },
  ],
  components: {
    securitySchemes: {
      AdminApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-admin-api-key',
      },
    },
    headers: {
      IdempotencyKey: {
        description: 'Chave única da requisição para garantir idempotência',
        schema: { type: 'string', maxLength: 100, example: '123-abc' },
        required: true,
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INSUFFICIENT_FUNDS' },
              message: { type: 'string', example: 'Saldo insuficiente' },
              details: { nullable: true },
            },
            required: ['code', 'message'],
          },
          correlationId: { type: 'string', format: 'uuid' },
        },
        required: ['error'],
      },
      CreateCustomerRequest: {
        type: 'object',
        required: ['fullName', 'taxId', 'email', 'phone'],
        properties: {
          fullName: { type: 'string', example: 'João Silva' },
          taxId: { type: 'string', example: '529.982.247-25' },
          email: { type: 'string', format: 'email', example: 'joao@example.com' },
          phone: { type: 'string', example: '+5583999999999' },
        },
      },
      CreateCustomerResponse: {
        type: 'object',
        properties: {
          customerId: { type: 'string', format: 'uuid' },
          accountId: { type: 'string', format: 'uuid' },
          accountNumber: { type: 'string', example: '123456789012' },
          status: { type: 'string', example: 'ACTIVE' },
        },
      },
      BalanceResponse: {
        type: 'object',
        properties: {
          accountId: { type: 'string', format: 'uuid' },
          customerId: { type: 'string', format: 'uuid' },
          accountNumber: { type: 'string' },
          currency: { type: 'string', example: 'BRL' },
          availableBalanceCents: { type: 'integer', example: 10000 },
        },
      },
      StatementResponse: {
        type: 'object',
        properties: {
          accountId: { type: 'string', format: 'uuid' },
          availableBalanceCents: { type: 'integer', example: 5000 },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                postingId: { type: 'string', format: 'uuid' },
                entryId: { type: 'string', format: 'uuid' },
                signedAmountCents: { type: 'integer', example: -5000 },
                referenceType: { type: 'string', example: 'PIX_TRANSFER' },
                referenceId: { type: 'string', format: 'uuid' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
      PixTransferRequest: {
        type: 'object',
        required: ['accountId', 'targetKey', 'amountCents'],
        properties: {
          accountId: { type: 'string', format: 'uuid' },
          targetKey: { type: 'string', example: 'destinatario@example.com' },
          amountCents: { type: 'integer', minimum: 1, example: 5000 },
        },
      },
      PixTransfer: {
        type: 'object',
        properties: {
          transferId: { type: 'string', format: 'uuid' },
          accountId: { type: 'string', format: 'uuid' },
          targetKey: { type: 'string' },
          amountCents: { type: 'integer', example: 5000 },
          idempotencyKey: { type: 'string', example: '123-abc' },
          status: {
            type: 'string',
            enum: ['CREATED', 'PENDING', 'PENDING_REVIEW', 'IN_DOUBT', 'SETTLED', 'REJECTED'],
          },
          riskDecision: {
            type: 'string',
            enum: ['APPROVE', 'CHALLENGE', 'REVIEW', 'BLOCK'],
          },
          riskScore: { type: 'integer', minimum: 0, maximum: 100 },
          riskReason: { type: 'string' },
          baasTransferId: { type: 'string', nullable: true },
          availableBalanceCents: { type: 'integer', example: 5000 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PendingTransfersResponse: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/PixTransfer' } },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
      DepositRequest: {
        type: 'object',
        required: ['accountId', 'amountCents'],
        properties: {
          accountId: { type: 'string', format: 'uuid' },
          amountCents: { type: 'integer', minimum: 1, example: 10000 },
        },
      },
      DepositResponse: {
        type: 'object',
        properties: {
          accountId: { type: 'string', format: 'uuid' },
          entryId: { type: 'string', format: 'uuid' },
          availableBalanceCents: { type: 'integer', example: 10000 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Saúde'],
        summary: 'Verifica a disponibilidade da API',
        responses: { '200': { description: 'API disponível' } },
      },
    },
    '/customers': {
      post: {
        tags: ['Clientes'],
        summary: 'Cadastra cliente PF e cria a conta transacional',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCustomerRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Cliente criado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCustomerResponse' },
              },
            },
          },
          '400': {
            description: 'Dados inválidos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'CPF ou e-mail já cadastrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/customers/{customerId}/balance': {
      get: {
        tags: ['Clientes'],
        summary: 'Consulta o saldo disponível',
        parameters: [
          {
            name: 'customerId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Saldo consultado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BalanceResponse' },
              },
            },
          },
          '404': {
            description: 'Conta não encontrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/customers/{customerId}/statement': {
      get: {
        tags: ['Clientes'],
        summary: 'Consulta o extrato paginado',
        parameters: [
          {
            name: 'customerId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Extrato consultado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatementResponse' },
              },
            },
          },
        },
      },
    },
    '/pix/transfers': {
      post: {
        tags: ['PIX'],
        summary: 'Inicia uma transferência PIX com garantia de idempotência',
        parameters: [
          {
            in: 'header',
            name: 'Idempotency-Key',
            required: true,
            schema: { type: 'string', maxLength: 100, example: '123-abc' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PixTransferRequest' },
            },
          },
        },
        responses: {
          '202': {
            description: 'Transferência aceita, em revisão ou enviada ao processamento.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PixTransfer' },
              },
            },
          },
          '400': {
            description: 'Requisição inválida',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'Operação bloqueada pelo Motor de Risco / Antifraude',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Conflito de idempotência (requisição duplicada)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '422': {
            description: 'Saldo insuficiente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/pix/transfers/{transferId}': {
      get: {
        tags: ['PIX'],
        summary: 'Consulta uma transferência PIX',
        parameters: [
          {
            name: 'transferId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Transferência encontrada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PixTransfer' } },
            },
          },
          '404': {
            description: 'Transferência não encontrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/compliance/pix/transfers/pending': {
      get: {
        tags: ['Compliance'],
        summary: 'Lista transferências aguardando revisão manual',
        security: [{ AdminApiKey: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Fila de revisão',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PendingTransfersResponse' },
              },
            },
          },
          '401': {
            description: 'Chave administrativa inválida',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/compliance/pix/transfers/{transferId}/approve': {
      post: {
        tags: ['Compliance'],
        summary: 'Aprova uma transferência retida e efetiva o débito no ledger',
        security: [{ AdminApiKey: [] }],
        parameters: [
          {
            name: 'transferId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Transferência aprovada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PixTransfer' } },
            },
          },
          '401': {
            description: 'Chave administrativa inválida',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Transferência não está pendente de revisão',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '422': {
            description: 'Saldo insuficiente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/compliance/pix/transfers/{transferId}/reject': {
      post: {
        tags: ['Compliance'],
        summary: 'Rejeita uma transferência retida sem movimentar saldo',
        security: [{ AdminApiKey: [] }],
        parameters: [
          {
            name: 'transferId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Transferência rejeitada',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PixTransfer' } },
            },
          },
          '401': {
            description: 'Chave administrativa inválida',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Transferência não está pendente de revisão',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/sandbox/deposits': {
      post: {
        tags: ['Sandbox'],
        summary: 'Credita saldo de teste na conta (somente ambiente local)',
        parameters: [
          {
            in: 'header',
            name: 'Idempotency-Key',
            required: true,
            schema: { type: 'string', maxLength: 100, example: 'deposit-001' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DepositRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Saldo creditado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DepositResponse' },
              },
            },
          },
          '409': {
            description: 'Idempotency-Key já utilizada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
};
