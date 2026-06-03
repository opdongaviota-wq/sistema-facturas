module.exports = {
  apps: [{
    name: 'facturas-cloud',
    script: 'server.js',
    cwd: '/Users/apincheira/Documents/facturas--v4.5',
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://neondb_owner:npg_ftTNjbF03Jqr@ep-floral-cake-apn5ydfy.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require',
      PORT: 3001
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    log_file: '/tmp/facturas-cloud.log',
    error_file: '/tmp/facturas-cloud-error.log',
    out_file: '/tmp/facturas-cloud-out.log'
  }]
};
