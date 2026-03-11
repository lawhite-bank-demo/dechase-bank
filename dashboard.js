// FIREBASE IMPORTS

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore,
doc,
getDoc,
updateDoc,
collection,
getDocs,
addDoc,
query,
where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// FIREBASE CONFIG

const firebaseConfig = {
apiKey: "AIzaSyBDp6wmJMY8WPyKPNE-bvVSiz4AIUbn71U",
authDomain: "dechase-bank.firebaseapp.com",
projectId: "dechase-bank"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// OTP SYSTEM

let currentOTP = null;
let otpExpiry = null;

async function sendOTP(email){

if(!window.emailjs){
alert("Email system not loaded");
return false;
}

const otp = Math.floor(100000 + Math.random()*900000);

currentOTP = otp;
otpExpiry = Date.now() + 180000;

try{

await emailjs.send(
"service_ab123cd",
"template_x9k21a",
{
to_email: email,
otp: otp
}
);

return true;

}catch(err){

console.error(err);
alert("Failed to send OTP email");
return false;

}

}


// INIT DASHBOARD

async function initDashboard(){

const username = localStorage.getItem("user");

if(!username){
window.location.replace("index.html");
return;
}

const userRef = doc(db,"users",username);
const snap = await getDoc(userRef);

if(!snap.exists()){
alert("User not found");
window.location.replace("index.html");
return;
}

const data = snap.data();


// FIXED SESSION CHECK

const savedSession = Number(localStorage.getItem("session"));
const firebaseSession = Number(data.session);

if(savedSession !== firebaseSession){
localStorage.removeItem("user");
localStorage.removeItem("session");
window.location.replace("index.html");
return;
}


// SUCCESS BANNER

function showSuccess(message){

const banner = document.getElementById("successBanner");

if(!banner) return;

banner.innerText = "✅ " + message;
banner.style.display = "block";

setTimeout(()=>{
banner.style.display = "none";
},2000);

}


// DATE FORMAT

function formatDate(date){

if(!date) return "-";

const d = new Date(date);

if(isNaN(d)) return "-";

return d.toLocaleString();

}


// USER INFO

document.getElementById("welcome").innerText="Hello, "+data.fullName;

document.getElementById("name").innerText=data.fullName;
document.getElementById("acc").innerText=data.accountNumber;
document.getElementById("iban").innerText=data.iban;
document.getElementById("swift").innerText=data.swift;


// BANK ADDRESS

const bankAddressElement = document.getElementById("bankAddress");

if(bankAddressElement){
bankAddressElement.innerText = data.bankAddress || "-";
}

const bankAddressSupport = document.getElementById("bankAddressSupport");

if(bankAddressSupport){
bankAddressSupport.innerText = data.bankAddress || "-";
}


// PROFILE

document.getElementById("nameProfile").innerText=data.fullName;
document.getElementById("emailProfile").innerText=data.email;


// BALANCE

let balanceValue = Number(data.balance||0);
let hidden = false;

const balanceEl = document.getElementById("balance");
const toggleEl = document.getElementById("toggleBalance");

function renderBalance(){

if(hidden){
balanceEl.innerText="••••••";
toggleEl.innerText="👁 Show balance";
}else{
balanceEl.innerText="€"+balanceValue.toLocaleString();
toggleEl.innerText="👁 Hide balance";
}

}

toggleEl.onclick=()=>{
hidden=!hidden;
renderBalance();
};

renderBalance();


// WALLET

document.getElementById("eurWallet").innerText=Number(data.balance||0).toLocaleString();
document.getElementById("usdWallet").innerText=Number(data.usdBalance||0).toLocaleString();
document.getElementById("gbpWallet").innerText=Number(data.gbpBalance||0).toLocaleString();
document.getElementById("audWallet").innerText=Number(data.audBalance||0).toLocaleString();


// CARD

document.getElementById("cardNumber").innerText=data.cardNumber||"0000 0000 0000 0000";
document.getElementById("cardName").innerText=data.cardName||"-";
document.getElementById("cardExpiry").innerText=data.cardExpiry||"--/--";

const cvvElement=document.getElementById("cardCVV");
cvvElement.innerText="***";

window.revealCVV=()=>{
cvvElement.innerText=data.cardCVV;
setTimeout(()=>{cvvElement.innerText="***";},5000);
};


// FREEZE CARD

window.toggleCard=async()=>{

const newStatus=!data.cardFrozen;

await updateDoc(userRef,{cardFrozen:newStatus});

alert(newStatus?"Card Frozen":"Card Unfrozen");

location.reload();

};


// TRANSACTIONS

const box=document.getElementById("transactions");

box.innerHTML="";

let txArray=[];

if(data.transactions){
txArray=Array.isArray(data.transactions)
?data.transactions
:Object.values(data.transactions);
}

if(txArray.length===0){

box.innerHTML=`<div class="tx">No transactions yet</div>`;

}else{

txArray.sort((a,b)=>new Date(b.date)-new Date(a.date));

txArray.slice(0,20).forEach(tx=>{

const amount=Number(tx.amount||0);
const color=amount>=0?"#22c55e":"#ef4444";
const sign=amount>=0?"+":"-";

const reference =
tx.reference || "DCB-"+Math.floor(10000000+Math.random()*90000000);

const div=document.createElement("div");
div.className="tx";

div.innerHTML=`
<strong>${tx.note||"Transaction"}</strong><br>
<span style="color:${color};font-weight:600;">
${sign}€${Math.abs(amount).toLocaleString()}
</span>
<div class="small">Ref: ${reference}</div>
<div class="small">${formatDate(tx.date)}</div>
`;

box.appendChild(div);

});

}


// PENDING TRANSFERS

const pendingBox=document.getElementById("pendingTransactions");

pendingBox.innerHTML="";

const q=query(collection(db,"pendingTransfers"),where("sender","==",username));

const pendingSnap=await getDocs(q);

if(pendingSnap.empty){

pendingBox.innerHTML=`<div class="tx">No pending transfers</div>`;

}else{

pendingSnap.forEach(docu=>{

const p=docu.data();

const div=document.createElement("div");
div.className="tx";

div.innerHTML=`
<strong>🏦 Transfer Pending</strong><br>
€${Number(p.amount).toLocaleString()} → ${p.iban}
<div class="small">Status: Waiting for approval</div>
<div class="small">${formatDate(p.date)}</div>
`;

pendingBox.appendChild(div);

});

}


// TRANSFER

window.askPin=async()=>{

const receiverValue=document.getElementById("receiver").value.trim();
const amountValue=parseFloat(document.getElementById("amount").value);

if(!receiverValue||!amountValue)
return alert("Fill all fields");

if(prompt("Enter PIN")!==data.pin)
return alert("Wrong PIN");

if(balanceValue<amountValue)
return alert("Insufficient funds");

const sent = await sendOTP(data.email);

if(!sent) return;

const enteredOTP=prompt("Enter OTP");

if(Date.now()>otpExpiry)
return alert("OTP expired");

if(enteredOTP!=currentOTP)
return alert("Invalid OTP");

const reference="DCB-"+Math.floor(10000000+Math.random()*90000000);

await addDoc(collection(db,"pendingTransfers"),{

sender:username,
iban:receiverValue,
amount:amountValue,
reference:reference,
date:new Date().toISOString(),
status:"pending"

});

showSuccess("Transfer submitted for approval");

location.reload();

};


// LOGOUT

window.logout=()=>{
localStorage.removeItem("user");
localStorage.removeItem("session");
window.location.replace("index.html");
};

}

initDashboard();