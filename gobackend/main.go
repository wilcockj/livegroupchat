package main

import (
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"os"
	"sync"
)

var activeConnections int = 0

const MAX_MESSAGE_LEN int = 2000

var (
	clients   = make(map[*websocket.Conn]bool) // connected clients
	broadcast = make(chan Message)             // broadcast channel
	upgrader  = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool {
		return true // allow all connections
	}}
	mutex sync.Mutex
)

type Message struct {
	MessageType int
	Message     []byte
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WS:", err)
		return
	}
	activeConnections++
	fmt.Println("Received WS connection request now we have", activeConnections, "connections")
	ip := r.Header.Get("X-FORWARDED-FOR")
	if ip == "" {
		ip = r.RemoteAddr
	}
	log.Println("Came from", ip)
	defer ws.Close()

	// Register the new client
	mutex.Lock()
	clients[ws] = true
	mutex.Unlock()

	for {
		messageType, message, err := ws.ReadMessage()
		if err != nil {
			log.Printf("error: %v", err)
			delete(clients, ws)
			break
		}

		if string(message) == "__ping__" {
			log.Println("sending pong to", ip) // add ip
			if err := ws.WriteMessage(messageType, []byte("__pong__")); err != nil {
				log.Println(err)
				return
			}
		} else {
			// send the received message to the broadcast channel
			broadcast <- Message{MessageType: messageType, Message: message}
		}
	}
}

func handleMessages() {
	for {
		// Grab the next message from the broadcast channel
		msg := <-broadcast

		// Send it out to every client that is currently connected
		for client := range clients {
			err := client.WriteMessage(msg.MessageType, msg.Message)
			if err != nil {
				log.Printf("error: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

func main() {
	var PORT string = "8089"
	if os.Getenv("BACKEND_MODE") == "production" {
		PORT = "443"
	}

	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)

	http.HandleFunc("/ws", wsHandler)

	// start handling broadcast messages
	go handleMessages()

	if os.Getenv("BACKEND_MODE") == "production" {
		fmt.Println("Starting production server on port", PORT)
		log.Fatal(http.ListenAndServeTLS(":"+PORT, "/etc/letsencrypt/live/yourdomain/fullchain.pem", "/etc/letsencrypt/live/yourdomain/privkey.pem", nil))
	} else {
		fmt.Println("Starting dev server on port", PORT)
		log.Fatal(http.ListenAndServe(":"+PORT, nil))
	}
}
