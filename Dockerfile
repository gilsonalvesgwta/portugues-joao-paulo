# Imagem do aplicativo para rodar na VPS. Três etapas: instalar, compilar e montar a imagem
# final só com o necessário (a pasta "standalone" do Next.js). Nenhuma chave entra na imagem:
# tudo que é da instalação chega por variável de ambiente quando o contêiner sobe.

FROM node:22-bookworm-slim AS pacotes
WORKDIR /app
COPY package.json package-lock.json ./
# Sem os scripts de instalação: o aplicativo não precisa deles, e assim a imagem não baixa
# as ferramentas de teste (Supabase local, navegadores).
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS compilacao
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=pacotes /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS final
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=compilacao --chown=node:node /app/.next/standalone ./
COPY --from=compilacao --chown=node:node /app/.next/static ./.next/static
COPY --from=compilacao --chown=node:node /app/public ./public
# Roda como usuário comum, sem poderes de administrador dentro do contêiner.
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
