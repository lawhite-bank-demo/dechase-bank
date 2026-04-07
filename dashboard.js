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

// ===== ACCOUNT SYSTEM =====
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

// ===== SAFE TRANSACTIONS =====
function getTx(data){
if(!data.transactions) return [];
return Array.isArray(data.transactions)
? data.transactions
: Object.values(data.transactions);
}

// ===== CURRENCY =====
let eurToGbp = 0.86;

function updateWalletUI(){
if(!el("usdWallet")) return;

setText("usdWallet", "$" + balance.toLocaleString());
setText("eurWallet", "€" + balance.toLocaleString());

const gbp = balance * eurToGbp;
setText("gbpWallet", "£" + gbp.toLocaleString());

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

balEl.innerText = hidden
? "••••••"
: "€" + balance.toLocaleString();

if(el("toggleBalance")){
el("toggleBalance").innerText = hidden ? "👁 Show" : "🙈 Hide";
}
}

// ===== TRANSACTIONS =====
function renderTransactions(){
const box = el("transactions");
if(!box) return;

box.innerHTML = "";

if(!tx || tx.length === 0){
box.innerHTML = "<p style='opacity:0.6;'>No transactions yet</p>";
return;
}

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

renderAll();
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

renderAll();
showReceipt(name, amount, ref);
};

// ===== TRANSFER =====
window.openPinModal = async ()=>{
if(frozen) return alert("Card is frozen");

const amount = parseFloat(el("amount").value);

if(isNaN(amount) || amount <= 0){
alert("Enter valid amount");
return;
}

if(amount > maxTransfer){
alert(`Your ${tier} limit is €${maxTransfer}`);
return;
}

if(amount > balance){
alert("Insufficient funds");
return;
}

// approval
if(amount > 70000){
await addDoc(collection(db,"pendingTransfers"),{
sender: userRef.id,
amount,
status:"pending"
});
alert("Transfer pending approval");
return;
}

// verification
if(amount > 20000){
let code = prompt("Enter code (1234)");
if(code !== "1234") return alert("Failed");
}

// normal
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

renderAll();
showReceipt("Transfer", amount, ref);
};

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

let data = snap.data();

// state
applyTier(data.accountTier || "Basic");
balance = Number(data.usdBalance ?? 0);
tx = getTx(data);
frozen = data.cardFrozen || false;

// UI
setText("welcome","Hi, Welcome " + (data.fullName || "User"));

setText("accountNumberDisplay", data.accountNumber || "DCB-0000000");
setText("iban", data.iban || "GB29NWBK60161331926819");
setText("routingDisplay", data.routingNumber || "021069021");
setText("swift", data.swift || "DEUTDEFF");
setText("bankAddress", data.bankAddress || "DeChase Bank");

setText("nameProfile", data.fullName || "User");
setText("emailProfile", data.email || "email@mail.com");

setText("cardNumber", maskCard(data.cardNumber));
setText("cardName", (data.fullName || "").toUpperCase());
setText("cardExpiry", data.cardExpiry || "07/27");
const realCVV = data.cvv || Math.floor(100 + Math.random()*900).toString();
setText("cardCVV", "***");

window._realCVV = realCVV;

setText("accountTier","Tier: " + tier);
setText("accountLimit","Limit: €" + maxTransfer.toLocaleString());

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
renderAll();

// realtime
onSnapshot(userRef,(snap)=>{
let d = snap.data();

balance = Number(d.usdBalance ?? 0);
tx = getTx(d);

renderAll();

setText("iban", d.iban || "GB...");
setText("routingDisplay", d.routingNumber || "021...");
setText("swift", d.swift || "DEUT...");
setText("bankAddress", d.bankAddress || "DeChase Bank");
});

}

initDashboard();