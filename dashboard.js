// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore, doc, getDoc, updateDoc,
collection, getDocs, addDoc, query,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
apiKey: "AIzaSyBDp6wmJMY8WPyKPNE-bvVSiz4AIUbn71U",
authDomain: "dechase-bank.firebaseapp.com",
projectId: "dechase-bank"
});

const db = getFirestore(app);

// ===== GLOBAL STATE =====
let balance = 0;
let lastBalance = 0;
let tx = [];
let frozen = false;
let userRef = null;
let hidden = false;

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }

function setText(id,val){
if(el(id)) el(id).innerText = val;
}

function getTx(data){
return data.transactions
? (Array.isArray(data.transactions)
? [...data.transactions]
: Object.values(data.transactions))
: [];
}

function genRef(){
return "TRX-" + Math.floor(Math.random()*1000000000);
}

function maskCard(num){
let clean = (num || "").replace(/\s/g,'');
return clean ? "**** **** **** " + clean.slice(-4) : "**** **** **** 1122";
}

function formatAccountNumber(acc){
return acc ? acc.toUpperCase() : "DCB-0000000";
}

// ===== 🔥 RECEIPT =====
function showReceipt(type, amount, ref){
if(!el("receiptModal")) return;

el("receiptModal").classList.remove("hidden");

setText("rType", type);
setText("rAmount", "€" + amount.toLocaleString());
setText("rRef", ref);
setText("rDate", new Date().toLocaleString());
}

window.closeReceipt = ()=>{
if(el("receiptModal")){
el("receiptModal").classList.add("hidden");
}
};

// ===== 🔥 BALANCE ANIMATION =====
function animateBalance(oldVal, newVal){

const balEl = el("balance");
if(!balEl) return;

if(hidden){
balEl.innerText = "••••••";
return;
}

const duration = 600;
const start = performance.now();

function frame(time){
let progress = Math.min((time - start)/duration,1);
let val = oldVal + (newVal-oldVal)*progress;

balEl.innerText = "€" + Math.floor(val).toLocaleString();

if(progress < 1){
requestAnimationFrame(frame);
}else{
balEl.innerText = "€" + newVal.toLocaleString();
}
}

requestAnimationFrame(frame);

// color flash
balEl.style.color = newVal > oldVal ? "#22c55e" : "#ef4444";
setTimeout(()=> balEl.style.color = "white", 500);
}

// ===== BALANCE =====
function renderBalance(){
animateBalance(lastBalance, balance);
lastBalance = balance;

if(el("toggleBalance")){
el("toggleBalance").innerText = hidden ? "👁 Show" : "🙈 Hide";
}
}

// ===== TIME + DATE =====
function updateTime(){
const now = new Date();

setText("time", now.toLocaleTimeString());
setText("date", now.toDateString());

let h = now.getHours();
let greet = h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";

setText("greeting", greet);
}
setInterval(updateTime,1000);

// ===== TRANSACTIONS =====
function renderTransactions(list){
const box = el("transactions");
if(!box) return;

box.innerHTML = "";

list.sort((a,b)=> new Date(b.date) - new Date(a.date));

list.forEach(t=>{
const amt = Number(t.amount || 0);

box.innerHTML += `
<div class="tx">
<strong>${t.note}</strong><br>
<small>Ref: ${t.reference}</small><br>
<small>${new Date(t.date).toLocaleString()}</small><br>
<b style="color:${amt>=0?"#22c55e":"#ef4444"}">
${amt>=0?"+":"-"}€${Math.abs(amt).toLocaleString()}
</b>
</div>`;
});
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
date:new Date().toISOString()
});

await updateDoc(userRef,{ usdBalance: balance, transactions: tx });

renderBalance();
renderTransactions(tx);

showReceipt(name + " Bill", amount, ref);
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
date:new Date().toISOString()
});

await updateDoc(userRef,{ usdBalance: balance, transactions: tx });

renderBalance();
renderTransactions(tx);

showReceipt(name + " Gift Card", amount, ref);
};

// ===== INIT =====
async function initDashboard(){

const username = localStorage.getItem("user");
const savedPassword = localStorage.getItem("password");

if(!username) return location.replace("index.html");

userRef = doc(db,"users",username);
const snap = await getDoc(userRef);
if(!snap.exists()) return location.replace("index.html");

let data = snap.data();

if(savedPassword && data.password !== savedPassword){
localStorage.clear();
location.replace("index.html");
return;
}

// STATE
balance = Number(data.usdBalance ?? data.balance ?? 0);
lastBalance = balance;
tx = getTx(data);
frozen = data.cardFrozen || false;

// UI
setText("welcome","Hi, Welcome " + (data.fullName || "User"));

setText("routingDisplay",data.routingNumber);
setText("swift",data.swift);
setText("bankAddress",data.bankAddress);
setText("accountNumberDisplay", formatAccountNumber(data.accountNumber));

setText("nameProfile", data.fullName);
setText("emailProfile", data.email);

setText("cardNumber", maskCard(data.cardNumber));
setText("cardName", (data.fullName || "").toUpperCase());
setText("cardExpiry", data.cardExpiry);
setText("cardCVV", data.cvv);

// toggle
if(el("toggleBalance")){
el("toggleBalance").onclick = ()=>{
hidden = !hidden;
renderBalance();
};
}

// freeze
window.toggleCard = async ()=>{
frozen = !frozen;
await updateDoc(userRef,{ cardFrozen: frozen });
if(el("cardBtn")){
el("cardBtn").innerText = frozen ? "Unfreeze Card" : "Freeze Card";
}
};

// render
renderBalance();
renderTransactions(tx);
updateTime();

// realtime
onSnapshot(userRef,(snap)=>{
let d = snap.data();

balance = Number(d.usdBalance ?? d.balance ?? 0);
tx = getTx(d);

renderBalance();
renderTransactions(tx);

setText("accountNumberDisplay", formatAccountNumber(d.accountNumber));
setText("nameProfile", d.fullName);
setText("emailProfile", d.email);
});

}

initDashboard();