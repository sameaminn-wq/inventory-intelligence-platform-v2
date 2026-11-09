# Build the NestJS API independently from the web workspace.
FROM node:22-alpine AS build
WORKDIR /app

COPY apps/api/package.json ./package.json
RUN npm install

COPY apps/api/tsconfig.build.json ./tsconfig.build.json
COPY apps/api/src ./src
RUN npm run build

# Keep the runtime image small; only production API dependencies are installed.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY apps/api/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
