// 🔥 FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
getFirestore,
doc,
getDoc,
updateDoc,
collection,
getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
apiKey: "AIzaSyBDp6wmJMY8WPyKPNE-bvVSiz4AIUbn71U",
authDomain: "dechase-bank.firebaseapp.com",
projectId: "dechase-bank"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================================
// OTP SYSTEM
// ======================================================

let currentOTP = null;
let otpExpiry = null;

const ELASTIC_API_KEY = "1EB4C32D1F5E58D70D026AF84037AEA54D1E2C859A1F092998C4A061092E4F7D7B6A7A83873BEC25441CA45E29A470A6";

async function sendOTP(email){

const otp = Math.floor(100000 + Math.random()*900000);

currentOTP = otp;
otpExpiry = Date.now() + 60000;

const subject = "DeChase Bank Security Code";

const body =
"DeChase Bank Security Verification\n\n" +
"Your OTP code is: " + otp + "\n\n" +
"This code expires in 60 seconds.\n\n" +
"Do not share this code.";

await fetch("https://api.elasticemail.com/v2/email/send",{
method:"POST",
headers:{
"Content-Type":"application/x-www-form-urlencoded"
},
body:
"apikey="+ELASTIC_API_KEY+
"&subject="+encodeURIComponent(subject)+
"&from=dechasebank@gmail.com"+
"&to="+email+
"&bodyText="+encodeURIComponent(body)
});

}

// ======================================================
// INIT DASHBOARD
// ======================================================

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

// ======================================================
// SUCCESS BANNER
// ======================================================

function showSuccess(message){

const banner = document.getElementById("successBanner");

if(!banner) return;

banner.innerText = "✅ "+message;
banner.style.display="block";

setTimeout(()=>{
banner.style.display="none";
},2000);

}

// ======================================================
// USER INFO
// ======================================================

document.getElementById("welcome").innerText =
"Hello, "+(data.fullName || username);

document.getElementById("name").innerText = data.fullName || "-";
document.getElementById("acc").innerText = data.accountNumber || "-";
document.getElementById("iban").innerText = data.iban || "-";
document.getElementById("swift").innerText = data.swift || "-";

if(document.getElementById("nameProfile"))
document.getElementById("nameProfile").innerText =
data.fullName || "-";

if(document.getElementById("emailProfile"))
document.getElementById("emailProfile").innerText =
data.email || "-";

// ======================================================
// BALANCE
// ======================================================

let balanceValue = Number(data.balance || 0);
let hidden = false;

const balanceEl = document.getElementById("balance");
const toggleEl = document.getElementById("toggleBalance");

function renderBalance(){

balanceEl.innerText =
hidden ? "••••••" : "€"+balanceValue.toLocaleString();

toggleEl.innerText =
hidden ? "👁 Show balance" : "👁 Hide balance";

}

toggleEl.onclick = ()=>{
hidden = !hidden;
renderBalance();
};

renderBalance();

// ======================================================
// CARD DISPLAY
// ======================================================

if(document.getElementById("cardNumber")){

document.getElementById("cardNumber").innerText =
data.cardNumber || "0000 0000 0000 0000";

document.getElementById("cardName").innerText =
data.cardName || "-";

document.getElementById("cardExpiry").innerText =
data.cardExpiry || "--/--";

document.getElementById("cardType").innerText =
data.cardType || "CARD";

const cvvEl = document.getElementById("cardCVV");
if(cvvEl) cvvEl.innerText="***";

}

// ======================================================
// CVV REVEAL
// ======================================================

window.revealCVV = ()=>{

const cvvEl = document.getElementById("cardCVV");

cvvEl.innerText = data.cardCVV || "***";

setTimeout(()=>{
cvvEl.innerText="***";
},5000);

};

// ======================================================
// CARD FREEZE
// ======================================================

window.toggleCard = async ()=>{

const newStatus = !data.cardFrozen;

await updateDoc(userRef,{
cardFrozen:newStatus
});

alert(newStatus ? "Card Frozen":"Card Unfrozen");

location.reload();

};

// ======================================================
// VIRTUAL CARD GENERATOR
// ======================================================

window.generateVirtualCard = async ()=>{

function randomBlock(){
return Math.floor(1000 + Math.random()*9000);
}

const cardNumber =
randomBlock()+" "+
randomBlock()+" "+
randomBlock()+" "+
randomBlock();

const month = Math.floor(Math.random()*12)+1;
const year = new Date().getFullYear()+3;

const expiry =
(month<10?"0"+month:month)+"/"+String(year).slice(2);

const cvv = Math.floor(100 + Math.random()*900);

await updateDoc(userRef,{
cardNumber:cardNumber,
cardExpiry:expiry,
cardCVV:String(cvv),
cardType:"MASTERCARD",
cardFrozen:false
});

alert("Virtual card generated");

location.reload();

};

// ======================================================
// TRANSACTIONS
// ======================================================

const box = document.getElementById("transactions");

if(box){

box.innerHTML="";

if(Array.isArray(data.transactions) && data.transactions.length){

const validTx = data.transactions.filter(tx=>{
if(!tx.date) return false;
const t = new Date(tx.date).getTime();
return !isNaN(t);
});

validTx.sort((a,b)=> new Date(b.date)-new Date(a.date));

validTx.slice(0,20).forEach(tx=>{

const amount = Number(tx.amount || 0);
const color = amount>0?"green":"red";

const formattedDate =
new Date(tx.date).toLocaleString("en-GB");

const div = document.createElement("div");

div.className=color;

div.innerHTML = `
<strong>${tx.note || "Transaction"}</strong><br>
€${Math.abs(amount).toLocaleString()}

<div class="small">${formattedDate}</div>
${tx.ref ? `<div class="small">Ref: ${tx.ref}</div>`:""}
`;box.appendChild(div);

});

}else{

box.innerHTML="<div class='small'>No transactions yet</div>";

}

}

// ======================================================
// RECEIVER LOOKUP
// ======================================================

const receiverInput =
document.getElementById("receiver");

const receiverNameBox =
document.getElementById("receiverName");

if(receiverInput && receiverNameBox){

receiverInput.addEventListener("input",async()=>{

const value = receiverInput.value.trim();

if(!value){
receiverNameBox.innerText="";
return;
}

const users = await getDocs(collection(db,"users"));

let foundName=null;

users.forEach(d=>{

const u=d.data();

if(u.accountNumber===value || u.iban===value)
foundName=u.fullName;

});

receiverNameBox.innerText =
foundName ? "Receiver: "+foundName :
"Account not found";

});

}

// ======================================================
// TRANSFER
// ======================================================

window.askPin = async ()=>{

const receiverValue =
document.getElementById("receiver").value.trim();

const amountValue =
parseFloat(document.getElementById("amount").value);

if(!receiverValue || !amountValue)
return alert("Fill all fields");

if(prompt("Enter PIN") !== data.pin)
return alert("Wrong PIN");

if(balanceValue < amountValue)
return alert("Insufficient funds");

const DAILY_LIMIT = 100000;

const today = new Date().toDateString();

const totalSentToday = (data.transactions || [])
.filter(tx =>
tx.amount < 0 &&
tx.date &&
new Date(tx.date).toDateString()===today
)
.reduce((sum,tx)=>sum+Math.abs(tx.amount),0);

if(totalSentToday + amountValue > DAILY_LIMIT)
return alert("Daily transfer limit exceeded");

await sendOTP(data.email);

const enteredOTP = prompt("Enter OTP sent to email");

if(Date.now() > otpExpiry)
return alert("OTP expired");

if(enteredOTP != currentOTP)
return alert("Invalid OTP");

const users = await getDocs(collection(db,"users"));

let receiverData=null;
let receiverUsername=null;

users.forEach(d=>{

const u=d.data();

if(u.accountNumber===receiverValue || u.iban===receiverValue){
receiverData=u;
receiverUsername=d.id;
}

});

if(!receiverData)
return alert("Receiver not found");

const date = new Date().toISOString();
const ref = "DCB"+Date.now();

await updateDoc(userRef,{
balance:balanceValue-amountValue,
transactions:[
...(data.transactions || []),
{
amount:-amountValue,
note:"SEPA Transfer",
toName:receiverData.fullName,
date,
ref
}
]
});

await updateDoc(doc(db,"users",receiverUsername),{
balance:Number(receiverData.balance || 0)+amountValue,
transactions:[
...(receiverData.transactions || []),
{
amount:amountValue,
note:"SEPA Credit Transfer",
fromName:data.fullName,
date,
ref
}
]
});

showSuccess("Transfer Successful");

setTimeout(()=>location.reload(),1200);

};

// ======================================================
// BILL PAYMENT
// ======================================================

window.payBill = async ()=>{

const amt =
parseFloat(document.getElementById("billAmount").value);

if(!amt) return alert("Enter amount");

if(balanceValue < amt)
return alert("Insufficient funds");

const date = new Date().toISOString();

await updateDoc(userRef,{
balance:balanceValue-amt,
transactions:[
...(data.transactions || []),
{
amount:-amt,
note:document.getElementById("billType").value+" Bill",
date
}
]
});

showSuccess("Bill Payment Successful");

setTimeout(()=>location.reload(),1200);

};

// ======================================================
// GIFT CARD
// ======================================================

window.buyGift = async ()=>{

const amt =
parseFloat(document.getElementById("giftAmount").value);

if(!amt) return alert("Enter amount");

if(balanceValue < amt)
return alert("Insufficient funds");

const date = new Date().toISOString();

await updateDoc(userRef,{
balance:balanceValue-amt,
transactions:[
...(data.transactions || []),
{
amount:-amt,
note:document.getElementById("giftType").value+" Gift Card",
date
}
]
});

showSuccess("Gift Card Purchased");

setTimeout(()=>location.reload(),1200);

};

// ======================================================
// LOGOUT
// ======================================================

window.logout = ()=>{

localStorage.clear();
sessionStorage.clear();

window.location.replace("index.html");

};

}

initDashboard();