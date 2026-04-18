// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore, doc, getDoc, updateDoc,
collection, addDoc, onSnapshot
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

// LIMITS
let dailyLimit = 20000;
let dailyUsed = 0;

// ANTI DUPLICATE
let processing = false;

// ===== ACCOUNT SYSTEM =====
let tier = "Tier 1";
let maxTransfer = 10000;

function applyTier(t){
  tier = t;

  if(t === "Tier 2"){
    maxTransfer = 50000;
    dailyLimit = 50000;
  }
  else if(t === "Tier 3"){
    maxTransfer = 100000;
    dailyLimit = 100000;
  }
  else{
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

// ===== SAFE TRANSACTIONS =====
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
      const txDate = t?.date ? new Date(t.date).toDateString() : "";
      return txDate === today && Number(t.amount) < 0;
    })
    .reduce((sum,t)=> sum + Math.abs(Number(t.amount)),0);
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

  bal.innerText = hidden ? "••••••" : "€" + balance.toLocaleString();
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

  const sortedTx = [...tx].sort((a,b)=>{
    const dateA = a?.date ? new Date(a.date).getTime() : 0;
    const dateB = b?.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  sortedTx.forEach(t=>{
    const amt = Number(t.amount || 0);

    box.innerHTML += `
    <div class="tx">
    <strong>${t.note || "Transaction"}</strong><br>
    <small>Ref: ${t.reference || "-"}</small><br>
    <small>${t.date ? new Date(t.date).toLocaleString() : "-"}</small><br>
    <b style="color:${amt>=0?"#22c55e":"#ef4444"}">
    ${amt>=0?"+":"-"}€${Math.abs(amt).toLocaleString()}
    </b>
    </div>`;
  });
}

// ===== MASTER RENDER =====
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

  let data = snap.data() || {};

  applyTier(data.accountTier || "Tier 1");
  balance = Number(data.balance ?? data.usdBalance ?? 0);
  tx = getTx(data);
  frozen = data.cardFrozen || false;

  // ===== INITIAL LOAD =====
  setText("welcome","Hi, Welcome " + (data.fullName || "User"));
  setText("nameProfile", data.fullName || "User");

  // ✅ FIXED EMAIL (always fallback if missing)
  setText("emailProfile", data.email || "dechasebank@gmail.com");

  // ✅ FIXED ADDRESS
  const addrEl = el("addressProfile");
  if(addrEl){
    addrEl.innerHTML = data.address
      ? "📍 " + data.address.replace(/,/g,"<br>")
      : "No address set";
  }

  setText("accountTier","Account: " + tier);
  setText("accountLimit","Limit: €" + maxTransfer.toLocaleString());

  setText("accountNumberDisplay", data.accountNumber || "DCB-0000000");
  setText("iban", data.iban || "DE89370400440532013000");
  setText("routingDisplay", data.routingNumber || "021069021");
  setText("swift", data.swift || "DEUTDEFF");

  setText("cardNumber", maskCard(data.card?.cardNumber));
  setText("cardExpiry", data.card?.expiry || "07/27");

  realCVV = data.cvv || Math.floor(100 + Math.random()*900).toString();
  window._realCVV = realCVV;
  setText("cardCVV","***");

  // TOGGLE BALANCE
  const toggle = el("toggleBalance");
  if(toggle){
    toggle.onclick = ()=>{
      hidden = !hidden;
      renderBalance();
    };
  }

  // FREEZE CARD
  window.toggleCard = async ()=>{
    frozen = !frozen;
    await updateDoc(userRef,{ cardFrozen: frozen });

    if(el("cardBtn")){
      el("cardBtn").innerText = frozen ? "Unfreeze Card" : "Freeze Card";
    }
  };

  renderAll();

  fetchRates();
  setInterval(fetchRates, 1000 * 60 * 30);

  // ===== REALTIME =====
  onSnapshot(userRef,(snap)=>{
    let d = snap.data();
    if(!d) return;

    balance = Number(d.balance ?? d.usdBalance ?? 0);
    tx = getTx(d);

    applyTier(d.accountTier || "Tier 1");

    // PROFILE
    setText("nameProfile", d.fullName || "User");
    setText("emailProfile", d.email || "dechasebank@gmail.com");

    const addrEl = el("addressProfile");
    if(addrEl){
      addrEl.innerHTML = d.address
        ? "📍 " + d.address.replace(/,/g,"<br>")
        : "No address set";
    }

    // LIMIT FIX
    setText("accountTier","Account: " + tier);
    setText("accountLimit","Limit: €" + maxTransfer.toLocaleString());

    renderAll();
  });

}

initDashboard();