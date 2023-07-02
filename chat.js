// Create WebSocket connection.
// Plan is to send object with uuid, maybe timestamp of start of chat 
// and message to server, which can then broadcast the change
// and update the state of the client with the new changes to
// existing chats and new chats
//
// when the user presses enter, clear the text input and generate a new 
// uuid/ timestamp to indicate a new chat message
const socket = new WebSocket("ws://localhost:8089");
const textinput = document.getElementById("chatinput");
const chats = document.querySelector('[data-todo="chats"]')

function newchat(){
    const uuid = crypto.randomUUID()
    let chat = {uuid:uuid, text :"", timestamp:Date.now(), finished:false};
    return chat;
}

let chat = newchat();

textinput.addEventListener('keyup', function (e) {
    if (e.key === 'Enter' && e.target.value.length) {
        // Do something
        chat.finished = true;
        console.log("finished chat ", chat.timestamp);
        socket.send(JSON.stringify(chat));
        textinput.value = "";
        chat = newchat();
    }
});

textinput.addEventListener("input", () => {
    chat.text = textinput.value;
    console.log(chat);
    if (!chat.finished){
    socket.send(JSON.stringify(chat));
    }
})


// Connection opened
socket.addEventListener("open", (event) => {
  socket.send("bruh Server!");
});

// Listen for messages
socket.addEventListener("message", async (event) => {
    try {
    const blob = event.data; // Assuming event.data contains your Blob object
    const response = new Response(blob);
    const result = await response.json();
    console.log(result); // Access the decoded JSON object
    // if result.uuid not in chats make new chat, and update with text
    // if exists update client chat with new text, or if marked as done, note that
      
  } catch (error) {
    // Handle any errors that occurred during decoding or parsing
    console.error(error);
  }
});


