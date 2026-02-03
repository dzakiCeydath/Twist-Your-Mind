import { initializeApp } from 
"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getDatabase, ref, set, update, onValue, get, remove, runTransaction
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
  { text: "Warga ingin hari libur tambahan!", A:{mood:+10, eco:-5}, B:{eco:+5, mood:-5}},
  { text: "Demo WiFi lambat.", A:{mood:+5}, B:{harm:-5}},
  { text: "Subsidi kopi nasional?", A:{mood:+8, eco:-8}, B:{eco:+5}},
  { text: "Transparansi diminta warga.", A:{law:+5}, B:{harm:-5}},
  { text: "Harga jajanan naik.", A:{eco:+5, mood:-5}, B:{mood:+3}},
  { text: "Festival nasional besar.", A:{mood:+7, eco:-5}, B:{eco:+5}},
  { text: "Pajak lupa ditarik.", A:{eco:-10}, B:{eco:+5}},
  { text: "Tagar nasional trending.", A:{mood:+5}, B:{harm:+5}},
  { text: "Rapat terlalu lama.", A:{law:+5}, B:{mood:-5}},
  { text: "Media salah kutip aturan.", A:{law:+5}, B:{mood:-5}}
];

document.getElementById("createBtn").onclick = createRoom;
document.getElementById("joinBtn").onclick = joinRoom;

async function createRoom(){
  roomId = "room_" + Math.floor(Math.random()*1000);

  await set(ref(db,"rooms/"+roomId),{
    gameState:{
      mood:70, eco:70, law:70, harm:70,
      round:1, crisisIndex:0
    },
    players:{},
    votes:{}
  });

  await set(ref(db,"rooms/"+roomId+"/players/"+playerId),true);
  startGame();
}

async function joinRoom(){
  roomId = document.getElementById("roomInput").value;
  await set(ref(db,"rooms/"+roomId+"/players/"+playerId),true);
  startGame();
}

function startGame(){
  document.getElementById("gameArea").style.display="block";
  onValue(ref(db,"rooms/"+roomId+"/gameState"), snap=>{
    if(!snap.exists()) return;
    updateUI(snap.val());
  });
}

function updateUI(data){

  moodBar.style.width=data.mood+"%";
  ecoBar.style.width=data.eco+"%";
  lawBar.style.width=data.law+"%";
  harmBar.style.width=data.harm+"%";

  roundInfo.innerText="Ronde "+data.round+" / 10";

  if(data.round>10){
    showEnding(data);
    return;
  }

  crisisText.innerText=crises[data.crisisIndex].text;
}

window.vote = async function(choice){

  await set(ref(db,"rooms/"+roomId+"/votes/"+playerId),choice);

  checkVotes();
};

async function checkVotes(){

  const playersSnap = await get(ref(db,"rooms/"+roomId+"/players"));
  const votesSnap = await get(ref(db,"rooms/"+roomId+"/votes"));

  if(!playersSnap.exists() || !votesSnap.exists()) return;

  const players = playersSnap.val();
  const votes = votesSnap.val();

  if(Object.keys(votes).length < Object.keys(players).length) return;

  await runTransaction(ref(db,"rooms/"+roomId+"/gameState"), current=>{

    if(current.round>10) return current;

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
      current[key]=Math.max(0,Math.min(100,current[key]));
    }

    current.round+=1;
    current.crisisIndex+=1;

    showResult(result);

    return current;

  });

  await remove(ref(db,"rooms/"+roomId+"/votes"));
}

function showResult(result){
  const overlay=document.getElementById("resultOverlay");
  const box=document.getElementById("resultBox");

  box.innerText="Keputusan bersama: "+result;
  overlay.classList.remove("hidden");

  setTimeout(()=>{
    overlay.classList.add("hidden");
  },1500);
}

function showEnding(data){

  let avg=(data.mood+data.eco+data.law+data.harm)/4;

  let text="";

  if(avg>75) text="🌟 NEGARA AMAN DAN MAJU!";
  else if(avg>50) text="⚖ Negara Stabil.";
  else text="🔥 Negara Krisis!";

  crisisText.innerText=text;
  document.getElementById("voteArea").style.display="none";
}