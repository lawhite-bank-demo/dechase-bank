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

// ===== GLOBAL STATE (🔥 FIX) =====
let balance = 0;
let tx = [];
let frozen = false;
let userRef = null;

// ===== HELPERS =====
function el(id){ return document.getElementById(id); }

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

function setText(id,val){
if(el(id)) el(id).innerText = val;
}

function maskCard(num){
let clean = (num || "").replace(/\s/g,'');
return clean ? "**** **** **** " + clean.slice(-4) : "**** **** **** 1122";
}

// ===== AUTO FIX USERS =====
async function fixAllUsers(){
const usersSnap = await getDocs(collection(db,"users"));

usersSnap.forEach(async (u)=>{
let d = u.data();

let bal = (d.usdBalance && d.usdBalance > 0)
  ? d.usdBalance
  : (d.balance ?? 0);

await updateDoc(doc(db,"users",u.id),{
usdBalance: bal,
balance: bal,
gbpBalance: bal * 0.78,
routingNumber: d.routingNumber || "021069021",
swift: d.swift || "BOFAUS3NXXX",
bankAddress: d.bankAddress || "DeChase Bank, United States"
});
});
}

// ===== RENDER =====
function renderTransactions(list){
const box = el("transactions");
if(!box) return;

box.innerHTML = "";

list.sort((a,b)=> new Date(b.date) - new Date(a.date));

list.forEach(t=>{
const amt = Number(t.amount || 0);

box.innerHTML += `
<div class="tx">
<strong>${t.note || "Transaction"}</strong><br>
<small>Ref: ${t.reference || genRef()}</small><br>
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

if(amount > balance){
alert("Insufficient funds");
return;
}

balance -= amount;

tx.unshift({
amount: -amount,
note: name + " Bill",
reference: genRef(),
date: new Date().toISOString()
});

await updateDoc(userRef,{ usdBalance: balance, transactions: tx });

renderBalance();
renderTransactions(tx);

alert(name + " paid successfully");
};

// ===== GIFT =====
window.buyGiftCard = async (name, amount)=>{
if(frozen) return alert("Card is frozen");

if(amount > balance){
alert("Insufficient funds");
return;
}

balance -= amount;

tx.unshift({
amount: -amount,
note: name + " Gift Card",
reference: genRef(),
date: new Date().toISOString()
});

await updateDoc(userRef,{ usdBalance: balance, transactions: tx });

renderBalance();
renderTransactions(tx);

alert(name + " gift card purchased");
};

// ===== BALANCE RENDER =====
function renderBalance(){
setText("balance", "€" + balance.toLocaleString());
}

// ===== INIT =====
async function initDashboard(){

const username = localStorage.getItem("user");
const savedPassword = localStorage.getItem("password");

if(!username) return location.replace("index.html");

if(username === "admin"){
await fixAllUsers();
}

userRef = doc(db,"users",username);
const snap = await getDoc(userRef);
if(!snap.exists()) return location.replace("index.html");

let data = snap.data();

if(savedPassword && data.password !== savedPassword){
alert("Session expired. Login again.");
localStorage.clear();
location.replace("index.html");
return;
}

// ===== STATE =====
balance = Number(
(data.usdBalance && data.usdBalance > 0)
? data.usdBalance
: (data.balance ?? 0)
);

tx = getTx(data);
frozen = data.cardFrozen || false;

// ===== UI =====
setText("welcome","Hello, " + (data.fullName || "User"));
setText("routingDisplay",data.routingNumber || "021069021");
setText("swift",data.swift || "BOFAUS3NXXX");
setText("bankAddress",data.bankAddress || "DeChase Bank, United States");

// PROFILE
setText("nameProfile", data.fullName || "User");
setText("emailProfile", data.email || "dechasebank@gmail.com");

// CARD
setText("cardNumber", maskCard(data.cardNumber));
setText("cardName", (data.fullName || "USER").toUpperCase());
setText("cardExpiry", data.cardExpiry || "12/28");
setText("cardCVV", data.cvv || "123");

// FREEZE
if(el("cardBtn")){
el("cardBtn").innerText = frozen ? "Unfreeze Card" : "Freeze Card";
}

window.toggleCard = async ()=>{
frozen = !frozen;
await updateDoc(userRef,{ cardFrozen: frozen });
el("cardBtn").innerText = frozen ? "Unfreeze Card" : "Freeze Card";
};

// BALANCE
renderBalance();

// WALLET
setText("usdWallet","€" + balance.toLocaleString());
setText("eurWallet","€" + balance.toLocaleString());
setText("gbpWallet","£" + (balance * 0.78).toLocaleString());

// CONVERTER
setText("convertedEUR","€" + balance.toLocaleString());
setText("convertedGBP","£" + (balance * 0.78).toLocaleString());

// TX
renderTransactions(tx);

// REALTIME
onSnapshot(userRef,(snap)=>{
let d = snap.data();

if(savedPassword && d.password !== savedPassword){
localStorage.clear();
location.replace("index.html");
return;
}

balance = Number(
(d.usdBalance && d.usdBalance > 0)
? d.usdBalance
: (d.balance ?? 0)
);

tx = getTx(d);

renderBalance();
renderTransactions(tx);

setText("usdWallet","€" + balance.toLocaleString());
setText("eurWallet","€" + balance.toLocaleString());

setText("nameProfile", d.fullName || "User");
setText("emailProfile", d.email || "dechasebank@gmail.com");
});

// PENDING
const q = query(collection(db,"pendingTransfers"));

onSnapshot(q,(snapshot)=>{
const box = el("pendingTransactions");
if(box) box.innerHTML = "";

snapshot.forEach(d=>{
const p = d.data();

if(p.sender === username && p.status === "pending"){
box.innerHTML += `
<div class="tx">
⏳ Pending<br>
€${Number(p.amount).toLocaleString()}
</div>`;
}
});
});

// TRANSFER
let pending = null;

window.openPinModal = ()=>{
if(frozen) return alert("Card frozen");

const amount = parseFloat(el("amount").value);

if(isNaN(amount) || amount > balance){
alert("Invalid amount");
return;
}

pending = {amount};
el("pinModal").classList.remove("hidden");
};

window.closePin = ()=>{
el("pinModal").classList.add("hidden");
};

window.confirmPin = async ()=>{
const pin = el("pinInput").value;
if(pin !== data.pin) return alert("Wrong PIN");

balance -= pending.amount;

tx.unshift({
amount:-pending.amount,
note:"Transfer Sent",
reference:genRef(),
date:new Date().toISOString()
});

await updateDoc(userRef,{ usdBalance: balance, transactions: tx });

await addDoc(collection(db,"pendingTransfers"),{
sender: username,
amount: pending.amount,
status:"pending"
});

el("pinModal").classList.add("hidden");

renderBalance();
renderTransactions(tx);

alert("Transfer Pending");
};

}

initDashboard();