package main

import (
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"os"
	"runtime"
	"sync"
	"time"
	"unsafe"
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

func bToMb(b uint64) uint64 {
	return b / 1024 / 1024
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WS:", err)
		return
	}
	activeConnections++
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Println("Received WS connection request now we have", activeConnections, "connections using ", bToMb(m.TotalAlloc), " MiB")
	printMemUsage()
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
			activeConnections--
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
				activeConnections--
				delete(clients, client)
			}
		}
	}
}

func printMemUsage() {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

    fmt.Printf("Memory Usage:\n")
    fmt.Printf("- Alloc: %.2f MB\n", float64(memStats.Alloc)/(1024*1024))
    fmt.Printf("- TotalAlloc: %.2f MB\n", float64(memStats.TotalAlloc)/(1024*1024))
    fmt.Printf("- Sys: %.2f MB\n", float64(memStats.Sys)/(1024*1024))

	sizeOfClientsMap := unsafe.Sizeof(clients)
	fmt.Printf("Clients map is taking: %d\n", sizeOfClientsMap)
    fmt.Printf("Number of active connections: %d\n", activeConnections)

}

func logMemoryUsage() {
	for {
		printMemUsage()
		time.Sleep(30 * time.Second)
	}
}

func enableCoopCoep(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
        w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
        next.ServeHTTP(w, r)
    })
}

func main() {
	var PORT string = "8089"
	if os.Getenv("BACKEND_MODE") == "production" {
		PORT = "443"
	}

	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", enableCoopCoep(fs))

	http.HandleFunc("/ws", wsHandler)

	// start handling broadcast messages
	go logMemoryUsage()
	go handleMessages()

	if os.Getenv("BACKEND_MODE") == "production" {
		fmt.Println("Starting production server on port", PORT)
        go http.ListenAndServe(":80", http.HandlerFunc(redirect))
		log.Fatal(http.ListenAndServeTLS(":"+PORT, "/etc/letsencrypt/live/swiftnotes.net/fullchain.pem", "/etc/letsencrypt/live/swiftnotes.net/privkey.pem", nil))
	} else {
		fmt.Println("Starting dev server on port", PORT)
		log.Fatal(http.ListenAndServe(":"+PORT, nil))
	}
}

// redirect redirects HTTP requests to HTTPS
func redirect(w http.ResponseWriter, req *http.Request) {
    // Use the Host header from the incoming request to construct the redirect URL
    target := "https://" + req.Host + req.URL.Path 
    if len(req.URL.RawQuery) > 0 {
        target += "?" + req.URL.RawQuery
    }
    http.Redirect(w, req, target, http.StatusMovedPermanently)
}
