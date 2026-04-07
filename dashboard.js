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

function setText(id,val){
if(el(id)) el(id).innerText = val;
}

function genRef(){
return "TRX-" + Math.floor(Math.random()*1000000000);
}

function maskCard(num){
let clean = (num || "").replace(/\s/g,'');
return clean ? "**** **** **** " + clean.slice(-4) : "**** **** **** 1122";
}

// ===== 🔥 FIXED TRANSACTION FORMAT =====
function getTx(data){
return data.transactions
? (Array.isArray(data.transactions)
? data.transactions
: Object.values(data.transactions))
: [];
}

// ===== 🔥 CURRENCY SYSTEM =====
let eurToGbp = 0.86;

function updateWalletUI(){

// USD (main shown)
setText("usdWallet", "$" + balance.toLocaleString());

// EUR
setText("eurWallet", "€" + balance.toLocaleString());

// GBP conversion
const gbp = balance * eurToGbp;
setText("gbpWallet", "£" + gbp.toLocaleString());

// converted section
setText("convertedEUR", "€" + balance.toLocaleString());
setText("convertedGBP", "£" + gbp.toLocaleString());
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

window.closeReceipt = ()=>{
el("receiptModal")?.classList.add("hidden");
};

// ===== BALANCE =====
function renderBalance(){
const balEl = el("balance");
if(!balEl) return;

balEl.innerText = hidden ? "••••••" : "€" + balance.toLocaleString();
}

// ===== TRANSACTIONS =====
function renderTransactions(){
const box = el("transactions");
if(!box) return;

box.innerHTML = "";

tx
.sort((a,b)=> new Date(b.date) - new Date(a.date))
.forEach(t=>{
const amt = Number(t.amount || 0);

box.innerHTML += `
<div class="tx">
<strong>${t.note || "Transaction"}</strong><br>
<small>Ref: ${t.reference || "-"}</small><br>
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
renderTransactions();
updateWalletUI();

showReceipt(name, amount, ref);
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
renderTransactions();
updateWalletUI();

showReceipt(name, amount, ref);
};

// ===== TRANSFER SYSTEM =====
window.openPinModal = async ()=>{
if(frozen) return alert("Card is frozen");

const amount = parseFloat(el("amount").value);

if(isNaN(amount) || amount <= 0){
alert("Enter valid amount");
return;
}

// LIMIT
if(amount > maxTransfer){
alert(`Your ${tier} account limit is €${maxTransfer}`);
return;
}

// BALANCE
if(amount > balance){
alert("Insufficient funds");
return;
}

// ADMIN APPROVAL
if(amount > 70000){
await addDoc(collection(db,"pendingTransfers"),{
sender: userRef.id,
amount: amount,
status:"pending"
});

alert("Transfer submitted for approval");
return;
}

// VERIFICATION
if(amount > 20000){
let code = prompt("Enter verification code (1234)");
if(code !== "1234"){
alert("Verification failed");
return;
}
}

// NORMAL TRANSFER
balance -= amount;

const ref = genRef();

tx.unshift({
amount:-amount,
note:"Transfer Sent",
reference:ref,
date:new Date().toISOString()
});

await updateDoc(userRef,{
usdBalance: balance,
transactions: tx
});

renderBalance();
renderTransactions();
updateWalletUI();

showReceipt("Transfer", amount, ref);
};

// ===== INIT =====
async function initDashboard(){

const username = localStorage.getItem("user");
if(!username) return location.replace("index.html");

userRef = doc(db,"users",username);
const snap = await getDoc(userRef);

if(!snap.exists()) return location.replace("index.html");

let data = snap.data();

// APPLY TIER
applyTier(data.accountTier || "Basic");

// STATE
balance = Number(data.usdBalance ?? 0);
tx = getTx(data);
frozen = data.cardFrozen || false;

// UI
setText("welcome","Hi, Welcome " + (data.fullName || "User"));
setText("accountNumberDisplay", data.accountNumber || "DCB-0000000");

setText("nameProfile", data.fullName || "User");
setText("emailProfile", data.email || "dechasebank@gmail.com");

setText("cardNumber", maskCard(data.cardNumber));
setText("cardName", (data.fullName || "").toUpperCase());
setText("cardExpiry", data.cardExpiry || "07/27");
setText("cardCVV", data.cvv || "123");

setText("accountTier","Tier: " + tier);
setText("accountLimit","Limit: €" + maxTransfer.toLocaleString());

// FREEZE
window.toggleCard = async ()=>{
frozen = !frozen;
await updateDoc(userRef,{ cardFrozen: frozen });

if(el("cardBtn")){
el("cardBtn").innerText = frozen ? "Unfreeze Card" : "Freeze Card";
}
};

// RENDER
renderBalance();
renderTransactions();
updateWalletUI();

// REALTIME
onSnapshot(userRef,(snap)=>{
let d = snap.data();

balance = Number(d.usdBalance ?? 0);
tx = getTx(d);

renderBalance();
renderTransactions();
updateWalletUI();
});

}

initDashboard();