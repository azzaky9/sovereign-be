module.exports = {
  apps: [
    {
      name: "sovereign-api",
      script: "src/index.ts",
      interpreter: "bun",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      }
    },
    {
      name: "sovereign-worker",
      script: "src/workers/pending-tx-worker.ts",
      interpreter: "bun",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      }
    }
  ]
};
