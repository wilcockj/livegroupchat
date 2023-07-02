import {delegate, getURLHash, insertHTML, replaceHTML} from "./helpers.js";
// Create WebSocket connection.
// Plan is to send object with uuid, maybe timestamp of start of chat
// and message to server, which can then broadcast the change
// and update the state of the client with the new changes to
// existing chats and new chats
//
// when the user presses enter, clear the text input and generate a new
// uuid/ timestamp to indicate a new chat message

const socket = new WebSocket(`wss://${location.host}`);
const textinput = document.getElementById("chatinput");
const chats = document.querySelector('[data-chat="chats"]')
const userid = crypto.randomUUID()

function newchat() {
  const uuid = crypto.randomUUID()
  let chat = {uuid : uuid, message : "", timestamp : Date.now(), finished : false, userid: userid};
  return chat;
}

function updateoraddchat(thischat){
    const chatElement = document.querySelector(`div[data-id="${thischat.uuid}"]`);
    const insidehtml = `Chatter ${thischat.userid} : ${thischat.message}`;
    if (!chatElement){
        const div = document.createElement("div");
        div.dataset.id = thischat.uuid;
        insertHTML(div, insidehtml
            );
        chats.appendChild(div);
    }
    else{
        chatElement.innerHTML = insidehtml;
    }


}

const ping = function() {
  ws.ping(noop);
}


let chat = newchat();

textinput.addEventListener('keyup', function(e) {
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
  chat.message = textinput.value;
  console.log(chat);
  if (!chat.finished) {

    updateoraddchat(chat);
    socket.send(JSON.stringify(chat));
  }
})

// Connection opened
socket.addEventListener("open", (event) => { console.log("opened websocket"); });
socket.addEventListener("closed", (event) => { console.log("closed websocket"); });

// Listen for messages
socket.addEventListener("message", async (event) => {
  try {
    const blob = event.data; // Assuming event.data contains your Blob object
    const response = new Response(blob);
    const result = await response.json();
    console.log(result); // Access the decoded JSON object
    // if result.uuid not in chats make new chat, and update with text
    // if exists update client chat with new text, or if marked as done, note
    // that
    updateoraddchat(result);
  } catch (error) {
    // Handle any errors that occurred during decoding or parsing
    console.error(error);
  }
});

setInterval(ping, 30000);
