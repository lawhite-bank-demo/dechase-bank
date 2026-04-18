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
if(e){
e.innerText = val ?? "";
}
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

// ===== SUCCESS REDIRECT =====
function goToSuccess(type, amount, ref, category){
localStorage.setItem("lastReceipt", JSON.stringify({
type,
amount,
reference: ref,
category,
date: new Date().toLocaleString()
}));

window.location.href = "success.html";
}

// ===== BILL =====
window.payBill = async (name, amount)=>{
if(frozen) return alert("Card is frozen");
if(amount > balance) return alert("Insufficient funds");

balance -= amount;

const ref = genRef();

tx.unshift({
amount:-amount,
note:name + " Bill",
reference:ref,
category:"Bills",
date:new Date().toISOString()
});

await updateDoc(userRef,{ balance, usdBalance: balance, transactions: tx });

renderAll();
goToSuccess(name, amount, ref, "Bills");
};

// ===== GIFT =====
window.buyGiftCard = async (name, amount)=>{
if(frozen) return alert("Card is frozen");
if(amount > balance) return alert("Insufficient funds");

balance -= amount;

const ref = genRef();

tx.unshift({
amount:-amount,
note:name + " Gift Card",
reference:ref,
category:"Personal",
date:new Date().toISOString()
});

await updateDoc(userRef,{ balance, usdBalance: balance, transactions: tx });

renderAll();
goToSuccess(name, amount, ref, "Personal");
};

// ===== TRANSFER =====
window.openPinModal = async ()=>{
if(processing) return;
processing = true;

if(frozen){ processing=false; return alert("Card is frozen"); }

const amount = parseFloat(el("amount")?.value);

if(isNaN(amount) || amount <= 0){
processing=false;
return alert("Enter valid amount");
}

if(amount > maxTransfer){
processing=false;
return alert(`Your ${tier} limit is €${maxTransfer}`);
}

if(amount > balance){
processing=false;
return alert("Insufficient funds");
}

calculateDailyUsed();
if(dailyUsed + amount > dailyLimit){
processing=false;
return alert(`Daily limit exceeded (€${dailyLimit})`);
}

if(amount > 70000){
await addDoc(collection(db,"pendingTransfers"),{
sender: userRef.id,
amount,
status:"pending"
});
processing=false;
return alert("Transfer pending approval");
}

if(amount > 20000){
let code = prompt("Enter code (1234)");
if(code !== "1234"){
processing=false;
return alert("Verification failed");
}
}

balance -= amount;

const ref = genRef();
const narration = el("description")?.value || "Transfer";
const category = el("category")?.value || "Personal";

tx.unshift({
amount: -amount,
note: narration,
reference: ref,
category,
date: new Date().toISOString()
});

dailyUsed += amount;

await updateDoc(userRef,{ balance, usdBalance: balance, transactions: tx });

renderAll();
goToSuccess("Transfer", amount, ref, category);

processing = false;
};

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

// INITIAL UI LOAD (IMPORTANT)
setText("welcome","Hi, Welcome " + (data.fullName || "User"));
setText("nameProfile", data.fullName || "User");
setText("emailProfile", data.email || "email@mail.com");
setText("addressProfile", data.address || "No address set");

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

// TOGGLE
const toggle = el("toggleBalance");
if(toggle){
toggle.onclick = ()=>{
hidden = !hidden;
renderBalance();
};
}

// FREEZE
window.toggleCard = async ()=>{
frozen = !frozen;
await updateDoc(userRef,{ cardFrozen: frozen });

if(el("cardBtn")){
el("cardBtn").innerText = frozen ? "Unfreeze Card" : "Freeze Card";
}
};

// RENDER
renderAll();

// FX
fetchRates();
setInterval(fetchRates, 1000 * 60 * 30);

// REALTIME
onSnapshot(userRef,(snap)=>{
let d = snap.data();
if(!d) return;

balance = Number(d.balance ?? d.usdBalance ?? 0);
tx = getTx(d);

setText("emailProfile", d.email || "email@mail.com");
setText("nameProfile", d.fullName || "User");
setText("addressProfile", d.address || "No address set");

renderAll();
});

}

initDashboard();