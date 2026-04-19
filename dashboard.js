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
let dailyLimit = 20000;
let dailyUsed = 0;

// OTP
let pendingTransfer = null;
let generatedOTP = null;

// Currency
let eurToUsd = 1.08;
let eurToGbp = 0.86;

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }

function setText(id,val){
  const e = el(id);
  if(e) e.innerText = val ?? "";
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

// ===== TIER =====
function applyTier(t){
  tier = t;

  if(t === "Tier 2"){
    maxTransfer = 50000;
    dailyLimit = 50000;
  }else if(t === "Tier 3"){
    maxTransfer = 100000;
    dailyLimit = 100000;
  }else{
    maxTransfer = 10000;
    dailyLimit = 20000;
  }
}

// ===== BALANCE =====
function renderBalance(){
  const bal = el("balance");
  if(!bal) return;

  bal.innerText = hidden
    ? "••••••"
    : "€" + formatMoney(balance);

  setText("toggleBalance", hidden ? "👁 Show" : "🙈 Hide");
}

window.toggleBalance = function(){
  hidden = !hidden;
  renderBalance();
};

// ===== FREEZE =====
window.toggleCard = async function(){
  frozen = !frozen;
  await updateDoc(userRef,{ cardFrozen:frozen });
  updateFreezeUI();
};

function updateFreezeUI(){
  const btn = el("cardBtn");
  if(!btn) return;

  btn.innerText = frozen ? "Unfreeze Card" : "Freeze Card";
}

// ===== TRANSACTIONS =====
function getTx(data){
  if(!data?.transactions) return [];
  return Array.isArray(data.transactions)
    ? data.transactions
    : Object.values(data.transactions);
}

function renderBalance(){
  const bal = document.getElementById("balance");
  if(!bal) return;

  if(hidden){
    bal.innerText = "••••••";
  }else{
    bal.innerText = "€" + Number(balance).toLocaleString(undefined,{
      minimumFractionDigits:2,
      maximumFractionDigits:2
    });
  }

  document.getElementById("toggleBalance").innerText =
    hidden ? "👁 Show" : "🙈 Hide";
}

// ===== CURRENCY =====
async function fetchRates(){
  try{
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
    const data = await res.json();

    eurToUsd = data.rates.USD || eurToUsd;
    eurToGbp = data.rates.GBP || eurToGbp;
  }catch{
    console.warn("Fallback rates used");
  }

  updateWallet();
}

function updateWallet(){
  setText("usdWallet","$"+formatMoney(balance * eurToUsd));
  setText("eurWallet","€"+formatMoney(balance));
  setText("gbpWallet","£"+formatMoney(balance * eurToGbp));

  setText("convertedEUR","€"+formatMoney(balance));
  setText("convertedUSD","$"+formatMoney(balance * eurToUsd));
  setText("convertedGBP","£"+formatMoney(balance * eurToGbp));
}

// ===== OTP =====
window.openPinModal = function(){
  const amount = Number(el("amount").value);

  if(!amount || amount <= 0) return notify("Invalid amount");
  if(amount > balance) return notify("Insufficient funds");
  if(amount > maxTransfer) return notify("Limit exceeded");
  if(dailyUsed + amount > dailyLimit) return notify("Daily limit reached");

  pendingTransfer = {
    amount,
    note: el("description").value,
    category: el("category").value
  };

  generatedOTP = Math.floor(100000 + Math.random()*900000);
  notify("OTP: " + generatedOTP);
};

window.confirmOTP = async function(){
  const input = prompt("Enter OTP");

  if(input != generatedOTP) return notify("Wrong OTP");

  const newTx = {
    amount: -pendingTransfer.amount,
    note: pendingTransfer.note || "Transfer Sent",
    category: pendingTransfer.category,
    date: new Date().toISOString(),
    reference: genRef()
  };

  balance -= pendingTransfer.amount;
  dailyUsed += pendingTransfer.amount;

  await updateDoc(userRef,{
    balance,
    transactions:[...tx,newTx]
  });

  showReceipt(newTx);
  pendingTransfer = null;
};

// ===== RECEIPT =====
function showReceipt(t){
  alert(
    `✅ SUCCESS\n\nAmount: €${formatMoney(Math.abs(t.amount))}\nRef: ${t.reference}`
  );
}

// ===== BILLS =====
window.payBill = function(name,amount){
  processQuick("Bill: "+name,amount);
};

// ===== GIFT =====
window.buyGiftCard = function(name,amount){
  processQuick("Gift: "+name,amount);
};

async function processQuick(title,amount){
  if(amount > balance) return notify("Insufficient funds");

  const newTx = {
    amount:-amount,
    note:title,
    date:new Date().toISOString(),
    reference:genRef()
  };

  balance -= amount;

  await updateDoc(userRef,{
    balance,
    transactions:[...tx,newTx]
  });

  notify("Payment successful");
}

// ===== INIT =====
async function init(){

  const username = localStorage.getItem("user");
  if(!username) return location.href="index.html";

  userRef = doc(db,"users",username);
  const snap = await getDoc(userRef);

  const data = snap.data();

  balance = Number(data.balance || 0);
  tx = getTx(data);
  frozen = data.cardFrozen || false;

  applyTier(data.accountTier || "Tier 1");

  setText("welcome","Hi, "+data.fullName);
  setText("nameProfile",data.fullName);
  setText("emailProfile",data.email);

  setText("accountNumberDisplay",data.accountNumber);
  setText("iban",data.iban);
  setText("routingDisplay",data.routingNumber);
  setText("swift",data.swift);

  setText("cardName",data.fullName);
  setText("cardNumber","**** **** **** "+(data.card?.cardNumber || "0000").slice(-4));
  setText("cardExpiry",data.card?.expiry);

  realCVV = data.cvv;
  window._realCVV = realCVV;

  renderBalance();
  renderTransactions();
  fetchRates();

  onSnapshot(userRef,(snap)=>{
    const d = snap.data();
    balance = Number(d.balance || 0);
    tx = getTx(d);
    renderBalance();
    renderTransactions();
    updateWallet();
  });
}

// START
init();