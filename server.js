const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const app = express();
// Variable to keep track of active connections
let activeConnections = 0;

if (process.env.NODE_ENV === 'development') {
  var PORT = 8089;
  console.log("starting dev server");
  app.use(express.static('public'));
  var server = http.createServer(app);
}

if (process.env.NODE_ENV === 'production'){

    var PORT = 443;
    console.log("starting production server");
    app.use(express.static('public'));
    const serverOptions = {
      cert : fs.readFileSync('/etc/letsencrypt/live/swiftnotes.net/fullchain.pem'),
      key : fs.readFileSync('/etc/letsencrypt/live/swiftnotes.net/privkey.pem'),
    };
    var server = https.createServer(serverOptions, app);
}


app.get("/", (req, res) => res.sendFile(`/index.html`))


const wss = new WebSocket.WebSocketServer({server});

wss.on('connection', (ws,req) => {
  activeConnections++;
  const memused = process.memoryUsage().rss / 1024 / 1024
  console.log('WebSocket connection established. Now have', activeConnections, 'connections, using' , memused, 'MB');
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log("Came from", ip);
  ws.on('message', (message) => {
    var strmessage = String.fromCodePoint(...message);
    console.log('Message in string form:', strmessage);
    // Process the received message here or broadcast it to other connected
    // clients
    if (strmessage == '__ping__'){
        console.log("sending pong to ", ip);
        ws.send('__pong__');
        return;
    }
    console.log("Sending message to", wss.clients.size, "clients");
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => { 
      activeConnections--;
      console.log('WebSocket connection closed.');
    });
});

// Serve static files from the "public" directory

// app.listen(port, () => { console.log(`Server is running on port ${port}`);
// });
server.listen(PORT, console.log(`server running on port ${PORT}`));
http.createServer(function(req, res) {
      res.writeHead(301,
                    {"Location" : "https://" + req.headers['host'] + req.url});
      res.end();
    })
    .listen(80);
// Start the server
// app.listen(port, () => { console.log(`Server is running on port ${port}`);
// });

// server.on('request', app);
// server.listen(port, () => { console.log("Server running on port ${port}");
// });
//  https.createServer(serverOptions, app).listen(8443);
