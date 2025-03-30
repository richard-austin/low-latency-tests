const PROXY_CONFIG = [
  {  context: [
      "/ws/",
    ],
    target: "http://localhost:8081/",
    ws: true,
    changeOrigin: false,
    secure: false
  }
]

module.exports = PROXY_CONFIG;
