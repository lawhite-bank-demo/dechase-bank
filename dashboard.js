// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore, doc, getDoc, updateDoc,
collection, addDoc, query, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
apiKey: "AIzaSy...",
authDomain: "dechase-bank.firebaseapp.com",
projectId: "dechase-bank"
});

const db = getFirestore(app);

// ===== GLOBAL =====
let balance = 0;
let lastBalance = 0;
let tx = [];
let frozen = false;
let userRef = null;
let hidden = false;

// 🔥 ACCOUNT SYSTEM
let tier = "Basic";
let maxTransfer = 10000;

function applyTier(t){
tier = t;

if(t === "Premium") maxTransfer = 50000;
else if(t === "VIP") maxTransfer = 100000;
else maxTransfer = 10000;
}

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }
function setText(id,val){ if(el(id)) el(id).innerText = val; }

function genRef(){
return "TRX-" + Math.floor(Math.random()*1000000000);
}

function maskCard(num){
let clean = (num || "").replace(/\s/g,'');
return clean ? "**** **** **** " + clean.slice(-4) : "**** **** **** 1122";
}

// ===== RECEIPT =====
function showReceipt(type, amount, ref){
if(!el("receiptModal")) return;

el("receiptModal").classList.remove("hidden");

setText("rType", type);
setText("rAmount", "€" + amount.toLocaleString());
setText("rRef", ref);
setText("rDate", new Date().toLocaleString());
}

window.closeReceipt = ()=> el("receiptModal")?.classList.add("hidden");

// ===== BALANCE =====
function renderBalance(){
const balEl = el("balance");
if(!balEl) return;

balEl.innerText = hidden ? "••••••" : "€" + balance.toLocaleString();
}

// ===== BILL =====
window.payBill = async (name, amount)=>{
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
showReceipt(name, amount, ref);
};

// ===== GIFT =====
window.buyGiftCard = async (name, amount)=>{
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
showReceipt(name, amount, ref);
};

// ===== 🔥 TRANSFER SYSTEM =====
let pending = null;

window.openPinModal = ()=>{
const amount = parseFloat(el("amount").value);

if(isNaN(amount) || amount <= 0){
alert("Invalid amount");
return;
}

// 🔥 LIMIT CHECK
if(amount > maxTransfer){
alert(`Your ${tier} account limit is €${maxTransfer}`);
return;
}

// 🔥 LARGE TRANSFER → APPROVAL
if(amount > 70000){
pending = { amount, type:"approval" };
alert("Large transfer requires admin approval");
return;
}

// 🔥 MEDIUM → VERIFICATION
if(amount > 20000){
pending = { amount, type:"verify" };
let code = prompt("Enter verification code (1234):");
if(code !== "1234") return alert("Verification failed");
}

pending = { amount, type:"normal" };
confirmTransfer();
};

async function confirmTransfer(){

balance -= pending.amount;

const ref = genRef();

tx.unshift({
amount:-pending.amount,
note:"Transfer Sent",
reference:ref,
date:new Date().toISOString()
});

await updateDoc(userRef,{
usdBalance: balance,
transactions: tx
});

// 🔥 SAVE PENDING APPROVAL
if(pending.type === "approval"){
await addDoc(collection(db,"pendingTransfers"),{
sender: userRef.id,
amount: pending.amount,
status:"pending"
});
alert("Transfer pending approval");
return;
}

renderBalance();
showReceipt("Transfer", pending.amount, ref);
}

// ===== INIT =====
async function initDashboard(){

const username = localStorage.getItem("user");
if(!username) return location.replace("index.html");

userRef = doc(db,"users",username);
const snap = await getDoc(userRef);

let data = snap.data();

// 🔥 APPLY TIER
applyTier(data.accountTier || "Basic");

// ===== STATE
balance = Number(data.usdBalance ?? 0);
tx = data.transactions || [];

// ===== UI
setText("welcome","Hi, Welcome " + data.fullName);
setText("accountNumberDisplay", data.accountNumber);
setText("nameProfile", data.fullName);
setText("emailProfile", data.email);

setText("cardNumber", maskCard(data.cardNumber));
setText("cardName", data.fullName);
setText("cardExpiry", data.cardExpiry);
setText("cardCVV", data.cvv);

// SHOW TIER
if(el("nameProfile")){
el("nameProfile").innerText += ` (${tier})`;
}

renderBalance();

// ===== REALTIME
onSnapshot(userRef,(snap)=>{
let d = snap.data();
balance = Number(d.usdBalance ?? 0);
renderBalance();
});

}

initDashboard();