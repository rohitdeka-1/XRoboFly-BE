module.exports = {
  apps: [
    {
      name: 'xrobofly-backend',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      // Startup delay
      wait_ready: true,
      listen_timeout: 5000,
      kill_timeout: 5000,
      
      // Logging
      out_file: '/var/log/xrobofly/out.log',
      error_file: '/var/log/xrobofly/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '500M',
      
      // Graceful shutdown
      shutdown_delay: 5000,
      
      // Monitoring
      merge_logs: true,
    }
  ],
  
  deploy: {
    production: {
      user: 'root',
      host: '64.227.185.66',
      ref: 'origin/main',
      repo: 'https://github.com/rohitdeka-1/XRoboFly-BE.git',
      path: '/home/xrobofly/app',
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js --env production'
    }
  }
};
