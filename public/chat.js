import {delegate, getURLHash, insertHTML, replaceHTML} from "./helpers.js";
// Create WebSocket connection.
// Plan is to send object with uuid, maybe timestamp of start of chat
// and message to server, which can then broadcast the change
// and update the state of the client with the new changes to
// existing chats and new chats
//
// when the user presses enter, clear the text input and generate a new
// uuid/ timestamp to indicate a new chat message

// Need to do ws:// when testing on localhost
if (location.hostname == 'localhost'){
    var socket = new WebSocket(`ws://${location.host}`);
}
else{
    var socket = new WebSocket(`wss://${location.host}`);
}
const textinput = document.getElementById("chatinput");
const nameinput = document.getElementById("nameinput");
const namedisplay = document.getElementById("curname");
const chats = document.querySelector('[data-chat="chats"]')
chats.scrollIntoView(false);
const connstatus = document.querySelector('[data-chat="connectionstatus"]')
let user = {useruuid: crypto.randomUUID(), username:""}

const darkModeSwitch = document.getElementById('darkModeSwitch');
const body = document.body;
const localStorageKey = 'darkModeEnabled';

// Function to set the dark mode state
function setDarkModeState(enabled) {
  if (enabled) {
    body.classList.add('dark-mode');
    darkModeSwitch.checked = true;
    localStorage.setItem(localStorageKey, 'true');
  } else {
    body.classList.remove('dark-mode');
    darkModeSwitch.checked = false;
    localStorage.setItem(localStorageKey, 'false');
  }
}

// Function to toggle the dark mode state
function toggleDarkMode() {
  const darkModeEnabled = localStorage.getItem(localStorageKey) === 'true';
  setDarkModeState(!darkModeEnabled);
}

// Event listener for the dark mode switch
darkModeSwitch.addEventListener('change', toggleDarkMode);

// Check the initial dark mode state from the stored preference
const initialDarkModeEnabled = localStorage.getItem(localStorageKey) === 'true';
setDarkModeState(initialDarkModeEnabled);


function newchat() {
  const uuid = crypto.randomUUID()
  let chat = {uuid : uuid, message : "", timestamp : Date.now(), finished : false, userid: user.useruuid, username: user.username};
  return chat;
}

function updateoraddchat(thischat){
    const chatElement = document.querySelector(`div[data-id="${thischat.uuid}"]`);
    if (thischat.username != ""){
        var chatlog = `${thischat.username}: ${thischat.message}`;
    }
    else{
        var chatlog = `Anon: ${thischat.message}`;
    }
    if (!chatElement){
        const div = document.createElement("div");
        div.dataset.id = thischat.uuid;
        if (thischat.userid == user.useruuid){
            div.dataset.active = !thischat.finished;
        }
        else{
            div.dataset.active = false;
        }

        div.textContent = chatlog;
        chats.querySelector('div').appendChild(div);
    }
    else{
        chatElement.textContent = chatlog;
        if (thischat.userid == user.useruuid){
            chatElement.dataset.active = !thischat.finished;
        }
    }


}

const pingInterval = setInterval(() => {
  socket.send("__ping__");
}, 10000);


let chat = newchat();

textinput.addEventListener('keyup', function(e) {
  if (e.key === 'Enter' && e.target.value.length) {
    // Do something
    chat.finished = true;
    const chatElement = document.querySelector(`div[data-id="${chat.uuid}"]`);
    chatElement.dataset.active = false;
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

nameinput.addEventListener('keyup', function(e) {

  if (e.key === 'Enter' && e.target.value.length) {
    user.username = nameinput.value;
    nameinput.value = "";
    chat.username = user.username;
    namedisplay.innerText = "Your name is: " + user.username;
  }
});

// Connection opened
socket.addEventListener("open", (event) => { 
                                            connstatus.className = "conn";
                                            connstatus.textContent = "Connected";
                                            console.log("opened websocket"); } );
socket.addEventListener("closed", (event) => { console.log("closed websocket"); 
clearInterval(pingInterval);});

// Listen for messages
socket.addEventListener("message", async (event) => {
  try {
    const blob = event.data; // Assuming event.data contains your Blob object
    if (blob == '__pong__'){
        console.log("got pong");
        return;
    }
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


