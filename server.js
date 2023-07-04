const WebSocket = require("ws");
const https = require("https");
const http = require("http");
const fs = require("fs");
const express = require("express");
const app = express();
const MAX_MESSAGE_LEN = 2000;
// Variable to keep track of active connections
let activeConnections = 0;
const PORT = process.env.NODE_ENV === "production" ? 443 : 8089;

if (process.env.NODE_ENV === "development") {
  console.log("starting dev server");
  app.use(express.static("public"));
  var server = http.createServer(app);
}

if (process.env.NODE_ENV === "production") {
  console.log("starting production server");
  app.use(express.static("public"));
  const serverOptions = {
    cert: fs.readFileSync("/etc/letsencrypt/live/swiftnotes.net/fullchain.pem"),
    key: fs.readFileSync("/etc/letsencrypt/live/swiftnotes.net/privkey.pem"),
  };
  var server = https.createServer(serverOptions, app);
}

app.get("/", (req, res) => res.sendFile(`/index.html`));

const wss = new WebSocket.WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  activeConnections++;
  const memused = process.memoryUsage().rss / 1024 / 1024;
  console.log(
    "WebSocket connection established. Now have",
    activeConnections,
    "connections, using",
    memused,
    "MB"
  );
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log("Came from", ip);
  ws.on("message", (message) => {
    var strmessage = String.fromCodePoint(...message);
    //console.log("Message in string form:", strmessage);
    var jsonmessage = message;
    try{
        var js = JSON.parse(strmessage);
        if (js.message.length > MAX_MESSAGE_LEN){
            js.message = js.message.slice(0,MAX_MESSAGE_LEN);
        }
        jsonmessage = JSON.stringify(js);
    }
    catch {
    }
    // Process the received message here or broadcast it to other connected
    // clients
    if (strmessage == "__ping__") {
      var time = new Date(Date.now()).toLocaleTimeString("en-US");
      var date = new Date(Date.now()).toLocaleDateString("en-US");
      console.log("sending pong to", ip, "timestamp", time, date);
      ws.send("__pong__");
      return;
    }
    console.log("Sending message to", wss.clients.size, "clients");
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(jsonmessage);
      }
    });
  });

  ws.on("close", () => {
    activeConnections--;
    console.log("WebSocket connection closed.");
  });
});

server.listen(PORT, console.log(`server running on port ${PORT}`));
http
  .createServer(function (req, res) {
    res.writeHead(301, {
      Location: "https://" + req.headers["host"] + req.url,
    });
    res.end();
  })
  .listen(80);
