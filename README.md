# Transmissao ao Vivo Telegram

Projeto inicial em Node.js, pnpm e TypeScript para um bot de Telegram com fluxo de pagamento simulado e liberacao de acesso a grupo.

## Requisitos

- Node.js 20+
- pnpm 9+
- Token de bot criado pelo BotFather

## Configuracao

```bash
pnpm install
cp .env.example .env
```

Edite `.env` e preencha:

- `TELEGRAM_BOT_TOKEN`: token criado no BotFather
- `TELEGRAM_GROUP_ID`: id do grupo/canal privado que sera liberado
- `APP_BASE_URL`: URL publica da aplicacao para montar links de pagamento
- `PORT`: porta do servidor HTTP
- `PAYMENT_AMOUNT_CENTS`: valor simulado em centavos
- `REDIS_URL`: conexao Redis usada pelo BullMQ
- `RENEWAL_REMINDER_DAYS_BEFORE`: quantos dias antes do vencimento enviar o lembrete

Para criar links de convite, o bot precisa ser admin do grupo com permissao de convidar usuarios.

Para descobrir o `TELEGRAM_GROUP_ID`, adicione o bot ao grupo, envie uma mensagem no grupo e acesse:

```text
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

Procure por `chat.id`. Em supergrupos, normalmente ele comeca com `-100`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm typecheck
```

## Fluxo

1. Usuario chama `/comprar`.
2. Bot gera um pagamento simulado e envia um link.
3. O link abre `GET /payments/simulate/:paymentId`.
4. Ao confirmar, a pagina chama `POST /webhooks/payments/:paymentId/confirm`.
5. O webhook marca o pagamento como confirmado, ativa/renova a assinatura por 30 dias e gera um link unico de convite para o grupo.
6. O usuario clica no link e entra diretamente no grupo.

## Assinaturas

- O armazenamento atual e em memoria, separado por repositorios para facilitar trocar por banco relacional depois.
- Cada pagamento confirmado cria ou renova uma assinatura mensal.
- Renovacao antes do vencimento soma 30 dias ao vencimento atual.
- O BullMQ agenda lembretes de renovacao a cada 30 minutos para assinaturas perto do vencimento.
- O BullMQ tambem roda a cada 1 hora e remove do grupo usuarios com assinatura expirada.

## Comandos do bot

- `/start`: mensagem inicial
- `/help`: lista os comandos disponiveis
- `/comprar`: gera pagamento simulado
- `/assinatura`: consulta o status da assinatura
