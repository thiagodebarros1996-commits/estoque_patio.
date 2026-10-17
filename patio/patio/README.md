# Pátio

Sistema de gestão e vitrine pública para lojas de carro. Cada loja tem sua conta, seu painel e um link público próprio (`/v/nome-da-loja`).

**Painel:** estoque com margem e FIPE, fotos, clientes em funil, vendas com comissão e checklist de documentos, simulador de financiamento.
**Vitrine pública:** só carros disponíveis e reservados, com fotos, preço e WhatsApp. Custos e margens nunca saem do painel.

## Rodar no VS Code

Requisito: Node.js 20.6 ou mais novo.

Execute os comandos a partir da pasta raiz `estoque`:

```bash
npm install
copy .\patio\patio\.env.example .\patio\patio\.env
# edite o .env e troque JWT_SECRET por um texto longo e aleatório
npm run dev
```

Abra http://localhost:3000, clique em **Criar conta da loja** e cadastre o primeiro carro. O link da vitrine aparece na aba **Minha vitrine**.

## Publicar na Railway

O projeto inclui um `Dockerfile` na raiz. Na Railway, crie um projeto a partir do repositório GitHub e configure o serviço:

1. Adicione um **Volume** ao serviço, montado em `/data`.
2. Defina as variáveis `JWT_SECRET` (segredo aleatório com pelo menos 32 caracteres), `DB_FILE=/data/data.db` e `UPLOAD_DIR=/data/uploads`.
3. Faça o deploy e gere um domínio público nas configurações de Networking.

O volume guarda o banco SQLite e as fotos entre deploys. Não remova nem recrie o volume sem antes fazer backup. O `.dockerignore` impede que o `.env`, o banco local, uploads e `node_modules` sejam incluídos na imagem.

## Estrutura

```
server.js        API (Express): login, carros, fotos, clientes, vendas, vitrine pública
db.js            Banco SQLite (arquivo data.db criado sozinho)
public/index.html, app.js   Painel da loja
public/vitrine.html         Página pública do cliente
public/app.css              Visual compartilhado
uploads/                    Fotos enviadas
```

## Antes de colocar no ar

1. **Segredo:** use um `JWT_SECRET` forte e nunca publique o `.env`.
2. **HTTPS:** hospede atrás de HTTPS (Render, Railway, Fly.io ou um VPS com Caddy/Nginx).
3. **Disco persistente:** `data.db` e a pasta `uploads/` precisam ficar em disco que não some a cada deploy. Em hospedagens grátis, isso costuma exigir um volume pago.
4. **Backup:** copie `data.db` e `uploads/` todo dia.
5. **Domínio:** aponte um domínio para o servidor para o link da vitrine ficar profissional.

## O que ainda não existe

- Recuperar senha por e-mail e convidar vendedores com login próprio (hoje cada loja tem uma conta só).
- Cobrança de assinatura (Stripe, Mercado Pago ou Asaas) e limites por plano.
- Consulta automática da tabela FIPE: o valor é digitado à mão.
- Publicação automática nos portais (Webmotors, OLX, iCarros).
- Emissão de nota fiscal e controle de pós-venda.
- Testes automatizados.
- Limite de tentativas de login e de cadastro, e validação mais rígida dos campos.
