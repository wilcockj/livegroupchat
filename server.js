const WebSocket = require('ws');

const wss = new WebSocket.Server({port : 8089});

wss.on('connection', (ws) => {
  console.log('WebSocket connection established.');

  ws.on('message', (message) => {
    console.log('Received message:', message);
    console.log('Message in string form:', String.fromCodePoint(...message));
    // Process the received message here or broadcast it to other connected
    // clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => { console.log('WebSocket connection closed.'); });
});
