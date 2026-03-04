// FIREBASE IMPORTS

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore,
doc,
getDoc,
updateDoc,
collection,
getDocs
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

let currentOTP=null;
let otpExpiry=null;

async function sendOTP(email){

const otp=Math.floor(100000+Math.random()*900000);

currentOTP=otp;
otpExpiry=Date.now()+60000;

console.log("OTP:",otp);

}


// INIT DASHBOARD

async function initDashboard(){

const username=localStorage.getItem("user");

if(!username) return window.location.replace("index.html");

const userRef=doc(db,"users",username);
const snap=await getDoc(userRef);

if(!snap.exists()){
alert("User not found");
return;
}

const data=snap.data();


// SUCCESS BANNER

function showSuccess(message){

const banner=document.getElementById("successBanner");

if(!banner) return;

banner.innerText="✅ "+message;
banner.style.display="block";

setTimeout(()=>{
banner.style.display="none";
},2000);

}


// DATE FORMAT

function formatDate(date){

if(!date) return "-";

const d=new Date(date);

if(isNaN(d)) return "-";

return d.toLocaleString();

}


// USER INFO

document.getElementById("welcome").innerText="Hello, "+data.fullName;

document.getElementById("name").innerText=data.fullName;
document.getElementById("acc").innerText=data.accountNumber;
document.getElementById("iban").innerText=data.iban;
document.getElementById("swift").innerText=data.swift;


// PROFILE

document.getElementById("nameProfile").innerText=data.fullName;
document.getElementById("emailProfile").innerText=data.email;


// BALANCE

let balanceValue=Number(data.balance||0);
let hidden=false;

const balanceEl=document.getElementById("balance");
const toggleEl=document.getElementById("toggleBalance");

function renderBalance(){

balanceEl.innerText=hidden?"••••":"€"+balanceValue.toLocaleString();
toggleEl.innerText=hidden?"👁 Show balance":"👁 Hide balance";

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
document.getElementById("cardType").innerText=data.cardType||"CARD";

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

initDashboard();

};


// TRANSACTIONS

const box=document.getElementById("transactions");

if(box){

box.innerHTML="";

let txArray=[];

if(data.transactions){

txArray=Array.isArray(data.transactions)
?data.transactions:Object.values(data.transactions);

}

txArray.sort((a,b)=>new Date(b.date)-new Date(a.date));

txArray.slice(0,20).forEach(tx=>{

const amount=Number(tx.amount||0);

let icon="💳";

if((tx.note||"").includes("SEPA")) icon="🏦";
if((tx.note||"").includes("ATM")) icon="🏧";
if((tx.note||"").includes("Gift")) icon="🎁";
if((tx.note||"").includes("Bill")) icon="💡";
if((tx.note||"").includes("Crypto")) icon="₿";

const color=amount>=0?"#22c55e":"#ef4444";
const sign=amount>=0?"+":"-";

const reference=
tx.reference || "DCB-"+Math.floor(10000000+Math.random()*90000000);

const div=document.createElement("div");

div.innerHTML=`

<strong>${icon} ${tx.note||"Transaction"}</strong><br>

<span style="color:${color};font-weight:600;">
${sign}€${Math.abs(amount).toLocaleString()}
</span>

<div class="small">Ref: ${reference}</div>

<div class="small">${formatDate(tx.date)}</div>

`;

box.appendChild(div);

});

}


// RECEIVER LOOKUP

const receiverInput=document.getElementById("receiver");
const receiverNameBox=document.getElementById("receiverName");

if(receiverInput){

receiverInput.addEventListener("input",async()=>{

const value=receiverInput.value.trim();

if(!value){
receiverNameBox.innerText="";
return;
}

const users=await getDocs(collection(db,"users"));

let foundName=null;

users.forEach(d=>{
const u=d.data();

if(u.accountNumber===value||u.iban===value)
foundName=u.fullName;

});

receiverNameBox.innerText=
foundName?"Receiver: "+foundName:"Account not found";

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

await sendOTP(data.email);

const enteredOTP=prompt("Enter OTP");

if(Date.now()>otpExpiry)
return alert("OTP expired");

if(enteredOTP!=currentOTP)
return alert("Invalid OTP");


// FIND RECEIVER

const users=await getDocs(collection(db,"users"));

let receiverDoc=null;
let receiverData=null;

users.forEach(d=>{
const u=d.data();

if(u.accountNumber===receiverValue||u.iban===receiverValue){
receiverDoc=d.id;
receiverData=u;
}
});

if(!receiverDoc)
return alert("Receiver not found");


// UPDATE BALANCES

const newSenderBalance=balanceValue-amountValue;

await updateDoc(userRef,{balance:newSenderBalance});

const receiverRef=doc(db,"users",receiverDoc);

const newReceiverBalance=
Number(receiverData.balance||0)+amountValue;

await updateDoc(receiverRef,{balance:newReceiverBalance});


// REFERENCE

const reference=
"DCB-"+Math.floor(10000000+Math.random()*90000000);


// SAVE TX

const tx={
amount:-amountValue,
date:new Date().toISOString(),
note:"SEPA Credit Transfer",
toName:receiverData.fullName,
reference:reference
};

const updatedTx=[...(data.transactions||[]),tx];

await updateDoc(userRef,{transactions:updatedTx});

showSuccess("Transfer Successful");

initDashboard();

};


// LOGOUT

window.logout=()=>{
localStorage.clear();
window.location.replace("index.html");
};

}

initDashboard();