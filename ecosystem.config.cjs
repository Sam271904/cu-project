module.exports = {
  apps: [
    {
      name: 'e-cu-dev',
      cwd: '.',
      script: 'backend/dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'sqlite:./data/dev/app.db',
        PORT: '3001',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: 'e-cu-local',
      cwd: '.',
      script: 'backend/dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'sqlite:./data/release/app.db',
        PORT: '3002',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
