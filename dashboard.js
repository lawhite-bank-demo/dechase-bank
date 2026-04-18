// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, onSnapshot
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

let tier = "Tier 1";
let maxTransfer = 10000;

// ===== CURRENCY =====
let eurToGbp = 0.86;
let eurToUsd = 1.08;

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
  n.style.zIndex = "9999";
  document.body.appendChild(n);
  setTimeout(()=> n.remove(), 2500);
}

// ===== LOGOUT =====
window.logoutUser = function(){
  localStorage.clear();
  window.location.href = "index.html";
};

// ===== LOCK =====
function lockApp(){
  localStorage.setItem("appLocked", "true");
  window.location.href = "lock.html";
}

if(localStorage.getItem("appLocked") === "true"){
  window.location.href = "lock.html";
}

// ===== ACCOUNT =====
function applyTier(t){
  tier = t;
  if(t === "Tier 2") maxTransfer = 50000;
  else if(t === "Tier 3") maxTransfer = 100000;
  else maxTransfer = 10000;
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

// ===== FREEZE CARD =====
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

    const title = t.note || "Transfer Sent";
    const ref = t.reference || genRef();
    const date = new Date(t.date).toLocaleString();

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        
        <div>
          <strong style="font-size:16px;">${title}</strong><br>
          <small style="opacity:0.7;">Ref: ${ref}</small><br>
          <small style="opacity:0.7;">${date}</small>
        </div>

        <div style="
          font-weight:bold;
          font-size:16px;
          color:${amt >= 0 ? "#22c55e" : "#ef4444"};
        ">
          ${amt >= 0 ? "+" : "-"}€${Math.abs(amt).toLocaleString()}
        </div>

      </div>
    `;

    div.onclick = () => {
      notify(`€${Math.abs(amt)} | ${t.category} | Ref: ${ref}`);
    };

    box.appendChild(div);
  });
}

// ===== CURRENCY =====
async function fetchRates(){
  try{
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
    const data = await res.json();

    if(data?.rates){
      eurToGbp = data.rates.GBP || eurToGbp;
      eurToUsd = data.rates.USD || eurToUsd;
    }
  }catch{
    console.warn("Using fallback rates");
  }

  updateWalletUI();
}

function updateWalletUI(){
  const usd = balance * eurToUsd;
  const gbp = balance * eurToGbp;

  setText("usdWallet", "$" + usd.toLocaleString());
  setText("eurWallet", "€" + balance.toLocaleString());
  setText("gbpWallet", "£" + gbp.toLocaleString());

  setText("convertedEUR", "€" + balance.toLocaleString());
  setText("convertedUSD", "$" + usd.toLocaleString());
  setText("convertedGBP", "£" + gbp.toLocaleString());
}

// ===== RENDER ALL =====
function renderAll(){
  renderBalance();
  renderTransactions();
  updateWalletUI();
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

  // ===== PROFILE =====
  setText("welcome","Hi, Welcome " + (data.fullName || "User"));
  setText("nameProfile", data.fullName);
  setText("emailProfile", data.email);
  setText("accountTier","Account: " + tier);
  setText("accountLimit","Limit: €" + maxTransfer.toLocaleString());

  // ===== ACCOUNT DETAILS =====
  setText("accountNumberDisplay", data.accountNumber || "Not available");
  setText("iban", data.iban || "Not available");
  setText("routingDisplay", data.routingNumber || "Not available");
  setText("swift", data.swift || "Not available");

  // ===== CARD =====
  setText("cardNumber", maskCard(data.card?.cardNumber));
  setText("cardExpiry", data.card?.expiry);
  setText("cardName", data.fullName || "User");

  realCVV = data.cvv;
  window._realCVV = realCVV;

  renderAll();
  fetchRates();

  // ===== REALTIME =====
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

// ===== START =====
initDashboard();

// ===== SESSION CONTROL =====
let sessionTimer;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sessionTimer = setTimeout(lockApp, 10000);
    setTimeout(logoutUser, 60000);
  } else {
    clearTimeout(sessionTimer);
  }
});