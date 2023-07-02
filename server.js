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

const express = require('express');
const app = express();
const port = 8080; // Replace with the desired port number

// Serve static files from the "public" directory
app.use(express.static('public'));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
