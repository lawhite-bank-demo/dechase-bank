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

// ===== UI NOTIFY =====
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

// ===== TOGGLE BALANCE =====
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

  if(frozen){
    btn.innerText = "Unfreeze Card";
    btn.style.background = "linear-gradient(135deg,#22c55e,#16a34a)";
  } else {
    btn.innerText = "Freeze Card";
    btn.style.background = "linear-gradient(135deg,#ef4444,#dc2626)";
  }
}

// ===== TRANSACTIONS SAFE =====
function getTx(data){
  if(!data?.transactions) return [];
  return Array.isArray(data.transactions)
    ? data.transactions
    : Object.values(data.transactions);
}

// ===== DAILY LIMIT =====
function calculateDailyUsed(){
  const today = new Date().toDateString();

  dailyUsed = tx
    .filter(t=>{
      const d = t?.date ? new Date(t.date).toDateString() : "";
      return d === today && Number(t.amount) < 0;
    })
    .reduce((s,t)=> s + Math.abs(Number(t.amount)),0);
}

// ===== CURRENCY =====
let eurToGbp = 0.86;
let eurToUsd = 1.08;

async function fetchRates(){
  try{
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/EUR");
    const data = await res.json();

    eurToGbp = data.rates?.GBP || eurToGbp;
    eurToUsd = data.rates?.USD || eurToUsd;

    updateWalletUI();
  }catch{
    console.warn("Using fallback rates");
  }
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

// ===== BALANCE =====
function renderBalance(){
  const bal = el("balance");
  if(!bal) return;

  if(hidden){
    bal.innerText = "••••••";
  } else {
    bal.innerText = "€" + balance.toLocaleString();
  }

  setText("toggleBalance", hidden ? "👁 Show" : "🙈 Hide");
}

// ===== TRANSACTIONS =====
function renderTransactions(){
  const box = el("transactions");
  if(!box) return;

  box.innerHTML = "";

  if(!tx.length){
    box.innerHTML = "<p style='opacity:0.6;'>No transactions yet</p>";
    return;
  }

  const sorted = [...tx].sort((a,b)=>{
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  sorted.forEach(t=>{
    const amt = Number(t.amount || 0);

    const div = document.createElement("div");
    div.className = "tx";
    div.style.cursor = "pointer";

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
  updateWalletUI();
}

// ===== SUCCESS =====
function goToSuccess(type, amount, ref, category){
  localStorage.setItem("lastReceipt", JSON.stringify({
    type, amount, reference: ref, category,
    date: new Date().toLocaleString()
  }));
  window.location.href = "success.html";
}

// ===== BILL =====
window.payBill = async (name, amount)=>{
  if(frozen) return notify("Card is frozen");
  if(amount > balance) return notify("Insufficient funds");

  balance -= amount;
  const ref = genRef();

  tx.unshift({
    amount:-amount,
    note:name + " Bill",
    reference:ref,
    category:"Bills",
    date:new Date().toISOString()
  });

  await updateDoc(userRef,{ balance, transactions: tx });

  await new Promise(r=>setTimeout(r,1200));

  renderAll();
  goToSuccess(name, amount, ref, "Bills");
};

// ===== GIFT =====
window.buyGiftCard = async (name, amount)=>{
  if(frozen) return notify("Card is frozen");
  if(amount > balance) return notify("Insufficient funds");

  balance -= amount;
  const ref = genRef();

  tx.unshift({
    amount:-amount,
    note:name + " Gift Card",
    reference:ref,
    category:"Personal",
    date:new Date().toISOString()
  });

  await updateDoc(userRef,{ balance, transactions: tx });

  await new Promise(r=>setTimeout(r,1200));

  renderAll();
  goToSuccess(name, amount, ref, "Personal");
};

// ===== TRANSFER (OTP FIRST) =====
window.openPinModal = async ()=>{
  if(processing) return;
  processing = true;

  if(frozen){ processing=false; return notify("Card is frozen"); }

  const amount = parseFloat(el("amount")?.value);

  if(isNaN(amount) || amount <= 0){
    processing=false;
    return notify("Enter valid amount");
  }

  if(amount > maxTransfer){
    processing=false;
    return notify(`Limit: €${maxTransfer}`);
  }

  if(amount > balance){
    processing=false;
    return notify("Insufficient funds");
  }

  calculateDailyUsed();
  if(dailyUsed + amount > dailyLimit){
    processing=false;
    return notify(`Daily limit €${dailyLimit}`);
  }

  // ✅ SAVE ONLY (DO NOT SEND YET)
  const ref = genRef();

  localStorage.setItem("pendingTx", JSON.stringify({
    amount,
    ref,
    category: el("category")?.value || "Personal",
    note: el("description")?.value || "Transfer"
  }));

  // ✅ GENERATE OTP
  const otp = Math.floor(100000 + Math.random()*900000);
  localStorage.setItem("otpCode", otp);

  notify("OTP sent: " + otp); // or alert()

  processing = false;

  // 👉 GO TO OTP PAGE
  window.location.href = "otp.html";
};
// ===== LOGOUT =====
window.logoutUser = function(){
  localStorage.removeItem("user");
  localStorage.removeItem("pendingTx");
  localStorage.removeItem("otpCode");
  localStorage.removeItem("appLocked");

  window.location.href = "index.html";
}

// ===== LOCK APP =====
function lockApp(){
  localStorage.setItem("appLocked", "true");
  window.location.href = "lock.html";
}

// ===== CHECK LOCK FIRST =====
if(localStorage.getItem("appLocked") === "true"){
  window.location.href = "lock.html";
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

  setText("accountNumberDisplay", data.accountNumber);
  setText("iban", data.iban);
  setText("routingDisplay", data.routingNumber);
  setText("swift", data.swift);

  setText("cardNumber", maskCard(data.card?.cardNumber));
  setText("cardExpiry", data.card?.expiry);

  realCVV = data.cvv;
  window._realCVV = realCVV;

  renderAll();
  fetchRates();

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

// ✅ CALL INIT ONLY ONCE
initDashboard();

// ===== SMART SESSION CONTROL =====
let sessionTimer;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // after 10s → lock app
    sessionTimer = setTimeout(() => {
      lockApp();
    }, 10000);

    // after 60s → logout completely
    setTimeout(() => {
      logoutUser();
    }, 60000);

  } else {
    clearTimeout(sessionTimer);
  }
});

// ===== FORCE HOME =====
window.addEventListener("DOMContentLoaded", ()=>{
  if (document.getElementById("homePage")) {
    openPage("homePage");
  }
});