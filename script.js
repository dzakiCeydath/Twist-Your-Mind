import { initializeApp } from 
"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getDatabase, ref, set, update, onValue, get, remove, runTransaction, onDisconnect
} from 
"https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvV2OFozlAfBX9Mx7H4yFhnGprjsIFp60",
  authDomain: "twist-your-mind.firebaseapp.com",
  databaseURL: "https://twist-your-mind-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "twist-your-mind",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let roomId = "";
let playerId = "player_" + Math.floor(Math.random()*10000);

const crises = [
  { text:"Warga ingin hari libur tambahan!", A:{mood:+10}, B:{eco:+5}},
  { text:"Demo WiFi lambat.", A:{mood:+5}, B:{harm:-5}},
  { text:"Harga jajanan naik.", A:{eco:+5}, B:{mood:-5}}
];

document.getElementById("createBtn").onclick = createRoom;
document.getElementById("joinBtn").onclick = joinRoom;
document.getElementById("startBtn").onclick = startGameByHost;

async function createRoom(){

  roomId = Math.random().toString(36).substring(2,7);

  await set(ref(db,"rooms/"+roomId),{
    status:"waiting",
    host:playerId,
    players:{
      [playerId]: true
    },
    gameState:{
      mood:70, eco:70,
      round:1, crisisIndex:0
    },
    votes:{}
  });

  enterLobby();
}

async function joinRoom(){

  roomId = document.getElementById("roomInput").value.trim();

  const snap = await get(ref(db,"rooms/"+roomId));
  if(!snap.exists()){
    alert("Room tidak ditemukan!");
    return;
  }

  await set(ref(db,"rooms/"+roomId+"/players/"+playerId),true);

  enterLobby();
}

function enterLobby(){

  document.getElementById("menu").style.display="none";
  document.getElementById("lobby").style.display="block";
  document.getElementById("roomDisplay").innerText="Room ID: "+roomId;

  onDisconnect(ref(db,"rooms/"+roomId+"/players/"+playerId)).remove();

  listenRoom();
}

function listenRoom(){

  onValue(ref(db,"rooms/"+roomId), async (snap)=>{

    if(!snap.exists()) return;

    const room = snap.val();
    const players = room.players ? Object.keys(room.players) : [];

    document.getElementById("playerCount").innerText =
      "Jumlah Player: "+players.length;

    // Ganti host jika host keluar
    if(room.host && !room.players[room.host] && players.length>0){
      await update(ref(db,"rooms/"+roomId),{
        host: players[0]
      });
    }

    // Tampilkan tombol start hanya untuk host
    if(room.host === playerId && room.status==="waiting"){
      document.getElementById("startBtn").style.display="block";
    } else {
      document.getElementById("startBtn").style.display="none";
    }

    if(room.status==="started"){
      startGame();
    }

  });
}

async function startGameByHost(){

  const snap = await get(ref(db,"rooms/"+roomId+"/players"));
  const players = snap.val() ? Object.keys(snap.val()) : [];

  if(players.length < 2){
    alert("Minimal 2 player!");
    return;
  }

  await update(ref(db,"rooms/"+roomId),{
    status:"started"
  });
}

function startGame(){

  document.getElementById("lobby").style.display="none";
  document.getElementById("gameArea").style.display="block";

  onValue(ref(db,"rooms/"+roomId+"/gameState"), snap=>{
    if(!snap.exists()) return;
    updateUI(snap.val());
  });
}

function updateUI(data){

  document.getElementById("roundInfo").innerText=
    "Ronde "+data.round;

  if(data.round>3){
    document.getElementById("crisisText").innerText="Game Selesai!";
    return;
  }

  document.getElementById("crisisText").innerText=
    crises[data.crisisIndex].text;
}

window.vote = async function(choice){

  await set(ref(db,"rooms/"+roomId+"/votes/"+playerId),choice);

  checkVotes();
};

async function checkVotes(){

  const playersSnap = await get(ref(db,"rooms/"+roomId+"/players"));
  const votesSnap = await get(ref(db,"rooms/"+roomId+"/votes"));

  if(!playersSnap.exists() || !votesSnap.exists()) return;

  const players = Object.keys(playersSnap.val());
  const votes = votesSnap.val();

  if(Object.keys(votes).length < players.length) return;

  await runTransaction(ref(db,"rooms/"+roomId+"/gameState"), current=>{

    if(!current) return current;

    let countA=0;
    let countB=0;

    Object.values(votes).forEach(v=>{
      if(v==="A") countA++;
      else countB++;
    });

    const result = countA>=countB ? "A":"B";
    const effect = crises[current.crisisIndex][result];

    for(let key in effect){
      current[key]+=effect[key];
    }

    current.round+=1;
    current.crisisIndex+=1;

    return current;

  });

  await remove(ref(db,"rooms/"+roomId+"/votes"));
}