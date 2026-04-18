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

let dailyLimit = 20000;
let dailyUsed = 0;

let tier = "Tier 1";
let maxTransfer = 10000;

let eurToUsd = 1.08;
let eurToGbp = 0.86;

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }

function setText(id,val){
  const e = el(id);
  if(e) e.innerText = val ?? "";
}

function formatMoney(v){
  return "€" + Number(v).toLocaleString(undefined,{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
}

function genRef(){
  return "TRX-" + Math.floor(Math.random()*1000000000);
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

// ===== ACCOUNT TIER =====
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

// ===== BALANCE =====
function renderBalance(){
  const bal = el("balance");
  if(!bal) return;

  bal.innerText = hidden ? "••••••" : formatMoney(balance);
  setText("toggleBalance", hidden ? "👁 Show" : "🙈 Hide");
}

window.toggleBalance = function(){
  hidden = !hidden;
  renderBalance();
};

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

  const sorted = [...tx].sort((a,b)=>
    new Date(b.date) - new Date(a.date)
  );

  sorted.forEach(t=>{
    const amt = Number(t.amount || 0);

    const div = document.createElement("div");
    div.className = "tx";

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <div>
          <strong>${t.note || "Transaction"}</strong><br>
          <small>${new Date(t.date).toLocaleString()}</small>
        </div>
        <div style="color:${amt>=0?"#22c55e":"#ef4444"}">
          ${amt>=0?"+":"-"}${formatMoney(Math.abs(amt))}
        </div>
      </div>
    `;

    div.onclick = ()=>{
      notify(`Ref: ${t.reference} | ${t.category}`);
    };

    box.appendChild(div);
  });
}

// ===== DAILY LIMIT =====
function calculateDailyUsed(){
  const today = new Date().toDateString();

  dailyUsed = tx
    .filter(t=>new Date(t.date).toDateString() === today && t.amount < 0)
    .reduce((s,t)=> s + Math.abs(t.amount),0);
}

// ===== WALLET =====
function updateWallet(){
  setText("eurWallet", formatMoney(balance));
  setText("usdWallet", "$"+(balance*eurToUsd).toFixed(2));
  setText("gbpWallet", "£"+(balance*eurToGbp).toFixed(2));

  setText("convertedEUR", formatMoney(balance));
  setText("convertedUSD", "$"+(balance*eurToUsd).toFixed(2));
  setText("convertedGBP", "£"+(balance*eurToGbp).toFixed(2));
}

// ===== FREEZE =====
window.toggleCard = async function(){
  if(!userRef) return;

  frozen = !frozen;
  await updateDoc(userRef,{ cardFrozen:frozen });

  notify(frozen ? "Card Frozen" : "Card Unfrozen");
};

// ===== BILL =====
window.payBill = async (name, amount)=>{
  if(frozen) return notify("Card frozen");
  if(amount > balance) return notify("Insufficient");

  balance -= amount;

  tx.unshift({
    amount:-amount,
    note:name+" Bill",
    reference:genRef(),
    category:"Bills",
    date:new Date().toISOString()
  });

  await updateDoc(userRef,{ balance, transactions:tx });

  renderAll();
};

// ===== GIFT =====
window.buyGiftCard = async (name, amount)=>{
  if(frozen) return notify("Card frozen");
  if(amount > balance) return notify("Insufficient");

  balance -= amount;

  tx.unshift({
    amount:-amount,
    note:name+" Gift",
    reference:genRef(),
    category:"Personal",
    date:new Date().toISOString()
  });

  await updateDoc(userRef,{ balance, transactions:tx });

  renderAll();
};

// ===== TRANSFER (OTP) =====
window.openPinModal = ()=>{
  const amount = parseFloat(el("amount")?.value);

  if(!amount || amount <= 0) return notify("Enter amount");
  if(amount > balance) return notify("Insufficient");

  calculateDailyUsed();
  if(dailyUsed + amount > dailyLimit){
    return notify("Daily limit exceeded");
  }

  if(amount > maxTransfer){
    return notify("Max transfer exceeded");
  }

  const otp = Math.floor(100000 + Math.random()*900000);

  localStorage.setItem("otpCode", otp);
  localStorage.setItem("pendingTx", JSON.stringify({
    amount,
    note:"Transfer",
    category: el("category")?.value || "Personal"
  }));

  notify("OTP: "+otp);

  window.location.href = "otp.html";
};

// ===== LOGOUT =====
window.logoutUser = ()=>{
  localStorage.clear();
  window.location.href = "index.html";
};

// ===== RENDER =====
function renderAll(){
  renderBalance();
  renderTransactions();
  updateWallet();
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

  setText("welcome","Hi, "+data.fullName);
  setText("iban", data.iban);
  setText("routingDisplay", data.routingNumber);
  setText("swift", data.swift);

  setText("cardName", data.fullName);
  setText("cardNumber","**** **** **** "+(data.card?.cardNumber?.slice(-4)||"1122"));
  setText("cardExpiry", data.card?.expiry);

  realCVV = data.cvv;
  window._realCVV = realCVV;

  renderAll();

  // REALTIME
  onSnapshot(userRef,(snap)=>{
    const d = snap.data();
    if(!d) return;

    balance = Number(d.balance ?? 0);
    tx = getTx(d);
    frozen = d.cardFrozen || false;

    renderAll();
  });
}

// START
initDashboard();