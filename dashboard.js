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

let eurToUsd = 1.08;
let eurToGbp = 0.86;

let pendingTransfer = null;
let generatedOTP = null;

let fullCardNumber = "";
let showFullCard = false;

// ✅ AUTO LOGOUT TIMER
let logoutTimer;

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
element.parentElement.style.display = "flex";
element.innerText = value;
}
}

function genRef(){
return "TRX-" + Math.floor(Math.random()*1000000000);
}

function formatMoney(v){
return Number(v || 0).toLocaleString(undefined,{
minimumFractionDigits:2,
maximumFractionDigits:2
});
}

// ===== RECEIPT =====
window.showReceipt = function(t){
setText("rAmount",(t.amount < 0 ? "-€" : "+€") + formatMoney(Math.abs(t.amount)));

setText("rType",
t.type === "transfer" ? "Transfer" :
t.type === "bill" ? "Bill Payment" :
t.amount < 0 ? "Debit" : "Credit"
);

setText("rNote", t.note || "Transaction");
setText("rDate", new Date(t.date).toLocaleString());
setText("rRef", t.reference || "N/A");

el("receiptModal").classList.remove("hidden");
};

window.closeReceipt = function(){
el("receiptModal").classList.add("hidden");
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
localStorage.removeItem("user");

notify("Logged out");

setTimeout(()=>{
window.location.href = "index.html";
}, 500);
};

// ===== AUTO LOGOUT (1 MIN) =====
function startAutoLogout(){
clearTimeout(logoutTimer);

logoutTimer = setTimeout(()=>{
notify("Session expired");
logoutUser();
}, 60000); // 1 minute
}

// Track activity
["click","touchstart","keypress"].forEach(evt=>{
document.addEventListener(evt, startAutoLogout);
});

// Logout when minimized
document.addEventListener("visibilitychange",()=>{
if(document.hidden){
logoutUser();
}
});

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

// ===== CARD =====
window.toggleCardNumber = function(){
const elNum = el("cardNumber");
if(!fullCardNumber) return;

showFullCard = !showFullCard;

elNum.innerText = showFullCard
? fullCardNumber
: "**** **** **** " + fullCardNumber.slice(-4);
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

// SORT BY NEWEST DATE
const sortedTx = [...tx].sort((a,b)=>{
return new Date(b.date) - new Date(a.date);
});

let lastDate = "";

sortedTx.forEach(t => {

const txDate = new Date(t.date);  

// FORMAT DATE HEADER  
const today = new Date();  
const yesterday = new Date();  
yesterday.setDate(today.getDate() - 1);  

let dateLabel = txDate.toLocaleDateString();  

if(txDate.toDateString() === today.toDateString()){  
  dateLabel = "Today";  
}  
else if(txDate.toDateString() === yesterday.toDateString()){  
  dateLabel = "Yesterday";  
}  

// ADD DATE HEADER  
if(lastDate !== dateLabel){  

  const header = document.createElement("div");  

  header.style.margin = "18px 0 10px";  
  header.style.fontSize = "13px";  
  header.style.opacity = "0.6";  
  header.style.fontWeight = "bold";  

  header.innerText = dateLabel;  

  container.appendChild(header);  

  lastDate = dateLabel;  
}  

// TRANSACTION ITEM  
const div = document.createElement("div");  

div.className = "tx";  

div.onclick = () => showReceipt(t);  

div.innerHTML = `  
  <div class="tx-left">  

    <div style="font-weight:600;">  
      ${t.note || "Transaction"}  
    </div>  

    <small style="opacity:0.7;">  
      ${txDate.toLocaleTimeString()}  
    </small>  

    <small style="opacity:0.5;">  
      Ref: ${t.reference || "N/A"}  
    </small>  

  </div>  

  <div class="tx-amount ${t.amount < 0 ? "tx-negative" : "tx-positive"}">  
    ${(t.amount < 0 ? "-€" : "+€") + formatMoney(Math.abs(t.amount))}  
  </div>  
`;  

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

// ===== TRANSFER =====
window.openPinModal = function(){
const amount = Number(el("amount").value);

if(!amount || amount <= 0) return notify("Invalid amount");
if(amount > balance) return notify("Insufficient funds");

pendingTransfer = {
amount,
note: el("description").value
};

generatedOTP = Math.floor(100000 + Math.random()*900000);

emailjs.send("YOUR_SERVICE_ID","YOUR_TEMPLATE_ID",{
to_email: window._userEmail,
otp: generatedOTP
}).then(()=>{
notify("OTP sent to your email");
setTimeout(()=> window.confirmOTP(), 300);
}).catch(()=>{
notify("Failed to send OTP");
});
};

window.confirmOTP = async function(){
const input = prompt("Enter OTP");
if(input != generatedOTP) return notify("Wrong OTP");

const newTx = {
amount: -pendingTransfer.amount,
note: pendingTransfer.note || "Transfer Sent",
date: new Date().toISOString(),
reference: genRef(),
type: "transfer"
};

balance -= pendingTransfer.amount;

await updateDoc(userRef,{
balance,
transactions:[...tx,newTx]
});

notify("Transfer successful");
showReceipt(newTx);

pendingTransfer = null;
};

// ===== BILLS =====
window.payBill = async function(name, amount){
if(frozen) return notify("Card is frozen");
if(amount > balance) return notify("Insufficient balance");

const newTx = {
note: name + " Bill",
amount: -amount,
date: new Date().toISOString(),
reference: genRef(),
type: "bill"
};

balance -= amount;

await updateDoc(userRef,{
balance,
transactions: [...tx, newTx]
});

notify(name + " paid successfully");
};

// ===== INIT =====
async function init(){

el("receiptModal")?.classList.add("hidden");

const username = localStorage.getItem("user");
if(!username) return location.href="index.html";

userRef = doc(db,"users",username);
const snap = await getDoc(userRef);
if(!snap.exists()) return location.href="index.html";

const data = snap.data();

balance = Number(data.balance || 0);
tx = getTx(data);
frozen = data.cardFrozen || false;

setText("welcome","Hi, "+data.fullName);
setText("nameProfile",data.fullName);
setText("emailProfile", data.email || "dechasebank@gmail.com");

window._userEmail = data.email;

setAccountField("iban", data.iban);
setAccountField("swift", data.swift);
setAccountField("accountNumberDisplay", data.accountNumber);
setAccountField("routingDisplay", data.routingNumber);

fullCardNumber = data.card?.cardNumber || "";
setText("cardNumber","**** **** **** " + (fullCardNumber.slice(-4) || "••••"));
setText("cardName",data.fullName);
setText("cardExpiry",data.card?.expiry);

realCVV = data.card?.cvv || data.cvv || "***";
window._realCVV = realCVV;

updateFreezeUI();
renderBalance();
renderTransactions();
fetchRates();
startAutoLogout(); // ✅ START TIMER

onSnapshot(userRef,(snap)=>{
const d = snap.data();
if(!d) return;

balance = Number(d.balance || 0);  
tx = getTx(d);  
frozen = d.cardFrozen || false;  

setText("emailProfile", d.email || "dechasebank@gmail.com");

setText(
"bankAddress",
data.bankAddress || "24 Bishopsgate, London EC2N 4BQ, United Kingdom"
);

setText(
"addressProfile",
data.address || "Bucharest, Romania"
);

setText(
"accountTier",
data.accountTier || "Premium Account"
);

setText(
"accountLimit",
data.accountLimit || "Daily Limit: €250,000"
);

setAccountField("iban", d.iban);  
setAccountField("swift", d.swift);  
setAccountField("accountNumberDisplay", d.accountNumber);  
setAccountField("routingDisplay", d.routingNumber);  

renderBalance();  
renderTransactions();  
updateWallet();  
updateFreezeUI();

});
}

// START
init();

