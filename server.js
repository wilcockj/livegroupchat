const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const PORT = 8080;

const serverOptions = {
  cert : fs.readFileSync('cert.pem'),
  key : fs.readFileSync('key.pem')
};

const app = express();
app.use(express.static('public'));
app.get("/", (req, res) => res.sendFile(`/index.html`))

const server = https.createServer(serverOptions, app);

const wss = new WebSocket.WebSocketServer({server});

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

// Serve static files from the "public" directory

// app.listen(port, () => { console.log(`Server is running on port ${port}`);
// });
server.listen(PORT, console.log(`server running on port ${PORT}`));
// Start the server
// app.listen(port, () => { console.log(`Server is running on port ${port}`);
// });

// server.on('request', app);
// server.listen(port, () => { console.log("Server running on port ${port}");
// });
//  https.createServer(serverOptions, app).listen(8443);
