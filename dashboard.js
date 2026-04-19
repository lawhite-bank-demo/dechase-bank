// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("Dashboard JS Loaded");

// ===== FIREBASE INIT =====
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
let dailyLimit = 20000;
let dailyUsed = 0;

let pendingTransfer = null;
let generatedOTP = null;

let eurToUsd = 1.08;
let eurToGbp = 0.86;

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }

function setText(id,val){
  const e = el(id);
  if(e) e.innerText = val ?? "";
}

function setAccountField(id, value){
  const element = el(id);
  if(!element) return;

  if(!value){
    element.parentElement.style.display = "none";
  } else {
    element.innerText = value;
  }
}

function genRef(){
  return "TRX-" + Math.floor(Math.random()*1000000000);
}

function formatMoney(v){
  return Number(v).toLocaleString(undefined,{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  });
}

// ===== RECEIPT SYSTEM =====
window.showReceipt = function(t){

  setText("rAmount",
    (t.amount < 0 ? "-€" : "+€") +
    formatMoney(Math.abs(t.amount || 0))
  );

  setText("rType", t.amount < 0 ? "Debit" : "Credit");

  setText("rNote", t.note || "No description");

  setText("rDate",
    t.date ? new Date(t.date).toLocaleString() : "N/A"
  );

  setText("rRef", t.reference || "N/A");

  el("receiptModal").classList.remove("hidden");
};

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
  location.href = "index.html";
};

// ===== BALANCE =====
function renderBalance(){
  const bal = el("balance");
  if(!bal) return;

  bal.innerText = hidden ? "••••••" : "€" + formatMoney(balance);
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
  await updateDoc(userRef,{ cardFrozen:frozen });
  updateFreezeUI();
};

function updateFreezeUI(){
  const btn = el("cardBtn");
  if(btn) btn.innerText = frozen ? "Unfreeze Card" : "Freeze Card";
}

// ===== TRANSACTIONS =====
function getTx(data){
  if(!data?.transactions) return [];
  return Array.isArray(data.transactions)
    ? data.transactions
    : Object.values(data.transactions);
}

function renderTransactions(){
  const container = el("transactions");
  if(!container) return;

  container.innerHTML = "";

  tx.slice().reverse().forEach(t => {

    const div = document.createElement("div");
    div.className = "tx";
    div.onclick = () => showReceipt(t); // 🔥 CLICK = RECEIPT

    const left = document.createElement("div");
    left.className = "tx-left";

    const title = document.createElement("div");
    title.innerText = t.note;

    const date = document.createElement("small");
    date.innerText = new Date(t.date).toLocaleString();

    left.appendChild(title);
    left.appendChild(date);

    const amount = document.createElement("div");
    amount.className = "tx-amount " + (t.amount < 0 ? "tx-negative" : "tx-positive");
    amount.innerText = (t.amount < 0 ? "-€" : "+€") + formatMoney(Math.abs(t.amount));

    div.appendChild(left);
    div.appendChild(amount);

    container.appendChild(div);
  });
}

// ===== CURRENCY =====
async function fetchRates(){
  try{
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
    const data = await res.json();

    eurToUsd = data.rates.USD || eurToUsd;
    eurToGbp = data.rates.GBP || eurToGbp;
  }catch{}

  updateWallet();
}

function updateWallet(){
  setText("usdWallet","$"+formatMoney(balance * eurToUsd));
  setText("eurWallet","€"+formatMoney(balance));
  setText("gbpWallet","£"+formatMoney(balance * eurToGbp));

  setText("convertedUSD","$"+formatMoney(balance * eurToUsd));
  setText("convertedGBP","£"+formatMoney(balance * eurToGbp));
  setText("convertedEUR","€"+formatMoney(balance));
}

// ===== TRANSFER =====
window.openPinModal = function(){
  const amount = Number(el("amount").value);

  if(!amount || amount <= 0) return notify("Invalid amount");
  if(amount > balance) return notify("Insufficient funds");

  pendingTransfer = {
    amount,
    note: el("description").value,
    category: el("category").value
  };

  generatedOTP = Math.floor(100000 + Math.random()*900000);
  notify("OTP: " + generatedOTP);

  setTimeout(()=> window.confirmOTP(), 500);
};

window.confirmOTP = async function(){
  const input = prompt("Enter OTP");
  if(input != generatedOTP) return notify("Wrong OTP");

  const newTx = {
    amount: -pendingTransfer.amount,
    note: pendingTransfer.note || "Transfer Sent",
    date: new Date().toISOString(),
    reference: genRef()
  };

  balance -= pendingTransfer.amount;

  await updateDoc(userRef,{
    balance,
    transactions:[...tx,newTx]
  });

  notify("Transfer successful");
};

// ===== INIT =====
async function init(){

  const username = localStorage.getItem("user");
  if(!username) return location.href="index.html";

  userRef = doc(db,"users",username);
  const snap = await getDoc(userRef);
  if(!snap.exists()) return location.href="index.html";

  const data = snap.data();

  balance = Number(data.balance || 0);
  tx = getTx(data);
  frozen = data.cardFrozen || false;

  // PROFILE
  setText("welcome","Hi, "+data.fullName);
  setText("nameProfile",data.fullName);
  setText("emailProfile", data.email || "dechasebank@gmail.com");

  // ACCOUNT
  setAccountField("iban", data.iban);
  setAccountField("swift", data.swift);
  setAccountField("accountNumberDisplay", data.accountNumber);
  setAccountField("routingDisplay", data.routingNumber);

  // CARD
  setText("cardName",data.fullName);
  setText("cardNumber","**** **** **** "+(data.card?.cardNumber || "0000").slice(-4));
  setText("cardExpiry",data.card?.expiry);

  realCVV = data.cvv;
  window._realCVV = realCVV;

  updateFreezeUI();
  renderBalance();
  renderTransactions();
  fetchRates();

  onSnapshot(userRef,(snap)=>{
    const d = snap.data();
    if(!d) return;

    balance = Number(d.balance || 0);
    tx = getTx(d);
    frozen = d.cardFrozen || false;

    setText("emailProfile", d.email || "dechasebank@gmail.com");

    updateFreezeUI();
    renderBalance();
    renderTransactions();
    updateWallet();
  });
}

// START
init();