import {
  delegate,
  getURLHash,
  insertHTML,
  replaceHTML,
  emotes,
} from "./helpers.js";
// Create WebSocket connection.
// Plan is to send object with uuid, maybe timestamp of start of chat
// and message to server, which can then broadcast the change
// and update the state of the client with the new changes to
// existing chats and new chats
//
// when the user presses enter, clear the text input and generate a new
// uuid/ timestamp to indicate a new chat message

const textinput = document.getElementById("chatinput");
const nameinput = document.getElementById("nameinput");
const namedisplay = document.getElementById("curname");
const chats = document.querySelector('[data-chat="chats"]');
const MAX_LENGTH = 2000;
const BACKOFF_NUM = 2;
chats.scrollIntoView(false);
const connstatus = document.querySelector('[data-chat="connectionstatus"]');
let user = { useruuid: crypto.randomUUID(), username: "" };

const darkModeSwitch = document.getElementById("darkModeSwitch");
const body = document.body;
const localStorageKey = "darkModeEnabled";
const linkRegex = /(https?\:\/\/)?(www\.)?[^\s]+\.[^\s]+/g;

var lastpingsent = 0;
var initialbackoff = BACKOFF_NUM; // number of pingintervals to wait before trying new websocket
// initially
var pingIntervalWithJitter = 4800 + Math.floor(Math.random() * 500);
console.log("Ping interval is", pingIntervalWithJitter);

function getSocket() {
  // Need to do ws:// when testing on localhost
  const socketProtocol = location.protocol.includes("https") ? "wss" : "ws";
  const socket = new WebSocket(`${socketProtocol}://${location.host}/ws`);

  // Connection opened
  socket.addEventListener("open", (event) => {
    connstatus.className = "conn";
    connstatus.textContent = "Connected";
    console.log("opened websocket");
  });

  socket.addEventListener("closed", (event) => {
    console.log("closed websocket");
    clearInterval(pingInterval);
  });

  // Listen for messages
  socket.addEventListener("message", async (event) => {
    try {
      const blob = event.data; // Assuming event.data contains your Blob object
      if (blob == "__pong__") {
        console.log("got pong took", Date.now() - lastpingsent, "ms");
        return;
      }
      const response = new Response(blob);
      const result = await response.json();
      // if result.uuid not in chats make new chat, and update with text
      // if exists update client chat with new text, or if marked as done, note
      // that
      updateoraddchat(result);
    } catch (error) {
      // Handle any errors that occurred during decoding or parsing
      console.error(error);
    }
  });
  return socket;
}

var socket = getSocket();

// Function to set the dark mode state
function setDarkModeState(enabled) {
  if (enabled) {
    body.classList.add("dark-mode");
    darkModeSwitch.checked = true;
    localStorage.setItem(localStorageKey, "true");
  } else {
    body.classList.remove("dark-mode");
    darkModeSwitch.checked = false;
    localStorage.setItem(localStorageKey, "false");
  }
}

// Function to toggle the dark mode state
function toggleDarkMode() {
  const darkModeEnabled = localStorage.getItem(localStorageKey) === "true";
  setDarkModeState(!darkModeEnabled);
}

// Event listener for the dark mode switch
darkModeSwitch.addEventListener("change", toggleDarkMode);

// Check the initial dark mode state from the stored preference
const initialDarkModeEnabled = localStorage.getItem(localStorageKey) === "true";
setDarkModeState(initialDarkModeEnabled);

function newchat() {
  const uuid = crypto.randomUUID();
  let chat = {
    uuid: uuid,
    message: "",
    timestamp: Date.now(),
    finished: false,
    userid: user.useruuid,
    username: user.username,
  };
  return chat;
}

function linkreplacer(matched) {
  let withProtocol = matched;

  if (!withProtocol.startsWith("http")) {
    withProtocol = "http://" + matched;
  }

  const newStr = `<a
    class="text-link"
    href="${withProtocol}"
  >
    ${matched}
  </a>`;

  return newStr;
}

function replaceEmoteKeywordWithImage(chatlog) {
  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Replace emote keywords with image tags
  for (const emoteKeyword in emotes) {
    if (emotes.hasOwnProperty(emoteKeyword)) {
      const emoteImagePath = emotes[emoteKeyword];
      const emoteImage = `<img height=19 src="${escapeHtml(
        emoteImagePath
      )}" alt="${escapeHtml(emoteKeyword)}" />`;

      // Use a regular expression to match the emote keyword surrounded by spaces or nothing
      const regex = new RegExp(`${escapeHtml(emoteKeyword)}($|\\s)`, "g");
      chatlog = chatlog.replaceAll(regex, ` ${emoteImage} `);
    }
  }
  return chatlog;
}

function updateoraddchat(thischat) {
  // TODO check message for emotes and if so, add image tags with the emotes
  const chatElement = document.querySelector(`div[data-id="${thischat.uuid}"]`);
  let chatlog = "";

  let now = new Date();

  if (thischat.username != "") {
    chatlog = `${thischat.username} : ${thischat.message}`;
  } else {
    chatlog = `Anon : ${thischat.message}`;
  }

  chatlog = now.toTimeString().slice(0, 8) + " " + chatlog;
  // Function to escape HTML entities
  chatlog = chatlog.replace(linkRegex, linkreplacer);
  chatlog = replaceEmoteKeywordWithImage(chatlog);
  if (!chatElement) {
    const div = document.createElement("div");
    div.dataset.id = thischat.uuid;
    if (thischat.userid == user.useruuid) {
      div.dataset.active = !thischat.finished;
    } else {
      div.dataset.active = false;
    }

    div.innerHTML = chatlog;
    chats.querySelector("div").appendChild(div);
  } else {
    chatElement.innerHTML = chatlog;
    if (thischat.userid == user.useruuid) {
      chatElement.dataset.active = !thischat.finished;
    }
  }
}

const pingInterval = setInterval(() => {
  if (socket.readyState == 1) {
    console.log("sending ping");
    socket.send("__ping__");
    lastpingsent = Date.now();
  } else if (socket.readyState == 0) {
    console.log("socket still connecting");
  } else if (lastpingsent != 0 || initialbackoff == 0) {
    // if initial backoff is 0 we have tried that many
    // times to wait with no communication
    // need to get new socket as errored
    console.log("socket state:", socket.readyState);
    console.log("trying to reconnect");
    connstatus.className = "notconn";
    connstatus.textContent = "Not Connected";
    socket.close(); // close socket before retry
    socket = getSocket();
    initialbackoff = BACKOFF_NUM;
    lastpingsent = 0;
    return;
  }
  if (lastpingsent == 0 && initialbackoff > 0) {
    initialbackoff--;
  }
}, pingIntervalWithJitter);

let chat = newchat();

textinput.addEventListener("keyup", function (e) {
  if (e.key === "Enter" && e.target.value.length) {
    // Message was completed and can be marked as such
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
  if (textinput.value.length >= MAX_LENGTH) {
    alert("message is at max length");
    return;
  }

  if (!chat.finished) {
    chat.message = textinput.value;
    chat.timestamp = Date.now();
    updateoraddchat(chat);

    socket.send(JSON.stringify(chat));
  }
});

nameinput.addEventListener("keyup", function (e) {
  if (e.key === "Enter" && e.target.value.length) {
    // Name was completed and is updated
    user.username = nameinput.value;
    nameinput.value = "";
    chat.username = user.username;

    let nameoutputwithemote = replaceEmoteKeywordWithImage(
      "Your name is: " + user.username
    );
    namedisplay.innerHTML = nameoutputwithemote;
  }
});
