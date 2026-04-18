// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSy...",
  authDomain: "dechase-bank.firebaseapp.com",
  projectId: "dechase-bank"
});

const db = getFirestore(app);

// ===== GLOBAL =====
let balance = 0;
let tx = [];
let frozen = false;
let userRef = null;
let hidden = false;
let realCVV = "";

let dailyLimit = 20000;
let dailyUsed = 0;

let processing = false;

let tier = "Tier 1";
let maxTransfer = 10000;

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }

function setText(id,val){
  const e = el(id);
  if(e) e.innerText = val ?? "";
}

function genRef(){
  return "TRX-" + Math.floor(Math.random()*1000000000);
}

function maskCard(num){
  let clean = (num || "").replace(/\s/g,'');
  return clean ? "**** **** **** " + clean.slice(-4) : "**** **** **** 1122";
}

// ===== NOTIFY =====
function notify(msg){
  const n = document.createElement("div");
  n.innerText = msg;
  n.style.position = "fixed";
  n.style.bottom = "100px";
  n.style.left = "50%";
  n.style.transform = "translateX(-50%)";
  n.style.background = "#111827";
  n.style.padding = "12px 18px";
  n.style.borderRadius = "10px";
  n.style.boxShadow = "0 10px 25px rgba(0,0,0,0.4)";
  n.style.zIndex = "9999";

  document.body.appendChild(n);
  setTimeout(()=> n.remove(), 2500);
}

// ===== ACCOUNT =====
function applyTier(t){
  tier = t;

  if(t === "Tier 2"){
    maxTransfer = 50000;
    dailyLimit = 50000;
  } else if(t === "Tier 3"){
    maxTransfer = 100000;
    dailyLimit = 100000;
  } else {
    maxTransfer = 10000;
    dailyLimit = 20000;
  }
}

// ===== LOGOUT (GLOBAL FIX) =====
window.logoutUser = function(){
  localStorage.removeItem("user");
  localStorage.removeItem("pendingTx");
  localStorage.removeItem("otpCode");
  localStorage.removeItem("appLocked");

  window.location.href = "index.html";
};

// ===== LOCK =====
function lockApp(){
  localStorage.setItem("appLocked", "true");
  window.location.href = "lock.html";
}

// ===== CHECK LOCK =====
if(localStorage.getItem("appLocked") === "true"){
  window.location.href = "lock.html";
}

// ===== BALANCE =====
function renderBalance(){
  const bal = el("balance");
  if(!bal) return;

  bal.innerText = hidden ? "••••••" : "€" + balance.toLocaleString();
  setText("toggleBalance", hidden ? "👁 Show" : "🙈 Hide");
}

window.toggleBalance = function(){
  hidden = !hidden;
  renderBalance();
};

// ===== FREEZE =====
window.toggleCard = async function(){
  if(!userRef) return;

  frozen = !frozen;
  await updateDoc(userRef,{ cardFrozen: frozen });
  updateFreezeUI();
};

function updateFreezeUI(){
  const btn = el("cardBtn");
  if(!btn) return;

  btn.innerText = frozen ? "Unfreeze Card" : "Freeze Card";
  btn.style.background = frozen
    ? "linear-gradient(135deg,#22c55e,#16a34a)"
    : "linear-gradient(135deg,#ef4444,#dc2626)";
}

// ===== TRANSACTIONS =====
function getTx(data){
  if(!data?.transactions) return [];
  return Array.isArray(data.transactions)
    ? data.transactions
    : Object.values(data.transactions);
}

function renderTransactions(){
  const box = el("transactions");
  if(!box) return;

  box.innerHTML = "";

  if(!tx.length){
    box.innerHTML = "<p style='opacity:0.6;'>No transactions yet</p>";
    return;
  }

  const sorted = [...tx].sort((a,b)=>
    new Date(b.date) - new Date(a.date)
  );

  sorted.forEach(t=>{
    const amt = Number(t.amount || 0);

    const div = document.createElement("div");
    div.className = "tx";

    div.onclick = () => {
      notify(`€${Math.abs(amt)} | ${t.category} | Ref: ${t.reference}`);
    };

    div.innerHTML = `
      <strong>${t.note || "Transaction"}</strong><br>
      <small>${new Date(t.date).toLocaleString()}</small><br>
      <b style="color:${amt>=0?"#22c55e":"#ef4444"}">
      ${amt>=0?"+":"-"}€${Math.abs(amt).toLocaleString()}
      </b>
    `;

    box.appendChild(div);
  });
}

// ===== RENDER =====
function renderAll(){
  renderBalance();
  renderTransactions();
}

// ===== INIT =====
async function initDashboard(){

  const username = localStorage.getItem("user");
  if(!username) return location.replace("index.html");

  userRef = doc(db,"users",username);
  const snap = await getDoc(userRef);
  if(!snap.exists()) return location.replace("index.html");

  const data = snap.data();

  applyTier(data.accountTier || "Tier 1");
  balance = Number(data.balance ?? 0);
  tx = getTx(data);
  frozen = data.cardFrozen || false;

  updateFreezeUI();

  setText("welcome","Hi, Welcome " + (data.fullName || "User"));
  setText("nameProfile", data.fullName);
  setText("emailProfile", data.email);

  setText("accountTier","Account: " + tier);
  setText("accountLimit","Limit: €" + maxTransfer.toLocaleString());

  setText("cardNumber", maskCard(data.card?.cardNumber));
  setText("cardExpiry", data.card?.expiry);

  realCVV = data.cvv;
  window._realCVV = realCVV;

  renderAll();

  onSnapshot(userRef,(snap)=>{
    const d = snap.data();
    if(!d) return;

    balance = Number(d.balance ?? 0);
    tx = getTx(d);
    frozen = d.cardFrozen || false;

    updateFreezeUI();
    applyTier(d.accountTier || "Tier 1");

    renderAll();
  });
}

// ✅ RUN ONCE
initDashboard();

// ===== SESSION CONTROL =====
let sessionTimer;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {

    // lock after 10s
    sessionTimer = setTimeout(lockApp, 10000);

    // logout after 60s
    setTimeout(logoutUser, 60000);

  } else {
    clearTimeout(sessionTimer);
  }
});