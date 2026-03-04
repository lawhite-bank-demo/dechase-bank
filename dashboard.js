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
// 🔐 OTP SYSTEM
// ======================================================

let currentOTP = null;
let otpExpiry = null;

const ELASTIC_API_KEY = "PASTE_YOUR_ELASTIC_API_KEY_HERE";

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
// 🚀 INIT DASHBOARD
// ======================================================

async function initDashboard(){

  const username = localStorage.getItem("user");
  if(!username) return window.location.replace("index.html");

  const userRef = doc(db,"users",username);
  const snap = await getDoc(userRef);

  if(!snap.exists()){
    alert("User not found");
    return window.location.replace("index.html");
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
  // FREEZE CHECK
  // ======================================================

  function checkFreeze(){
    if(data.frozen){
      alert("Account is frozen. Contact bank support.");
      return true;
    }
    return false;
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
  // TRANSACTIONS
  // ======================================================

  const box = document.getElementById("transactions");
  box.innerHTML="";

  if(Array.isArray(data.transactions) && data.transactions.length){

    const validTransactions = data.transactions.filter(tx=>{
      if(!tx.date) return false;
      const t = new Date(tx.date).getTime();
      return !isNaN(t);
    });

    validTransactions.sort((a,b)=>{
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    validTransactions.slice(0,20).forEach(tx=>{

      const amount = Number(tx.amount || 0);
      const color = amount>0 ? "green" : "red";

      const formattedDate = new Date(tx.date).toLocaleString("en-GB",{
        day:"2-digit",
        month:"short",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit",
        hour12:false
      });

      const details =
      tx.fromName ? "From: "+tx.fromName :
      tx.toName ? "To: "+tx.toName : "";

      const div = document.createElement("div");
      div.className = color;

      div.innerHTML = `
      <strong>${tx.note || "Transaction"}</strong><br>
      €${Math.abs(amount).toLocaleString()}
      <div class="small">${details}</div>
      <div class="small">${formattedDate}</div>
      ${tx.ref ? `<div class="small">Ref: ${tx.ref}</div>` : ""}
      `;

      box.appendChild(div);

    });

  }else{
    box.innerHTML="<div class='small'>No transactions yet</div>";
  }

  // ======================================================
  // LIVE RECEIVER LOOKUP
  // ======================================================

  const receiverInput = document.getElementById("receiver");
  const receiverNameBox = document.getElementById("receiverName");

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
        const u = d.data();
        if(u.accountNumber===value || u.iban===value)
          foundName = u.fullName;
      });

      receiverNameBox.innerText =
      foundName ? "Receiver: "+foundName : "Account not found";

      receiverNameBox.style.color =
      foundName ? "#00ffb2" : "#ff6b6b";

    });

  }

  // ======================================================
  // TRANSFER WITH OTP
  // ======================================================

  window.askPin = async ()=>{

    if(checkFreeze()) return;

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
      new Date(tx.date).toDateString() === today
    )
    .reduce((sum,tx)=> sum + Math.abs(tx.amount),0);

    if(totalSentToday + amountValue > DAILY_LIMIT)
      return alert("Daily transfer limit exceeded (€100,000)");

    // SEND OTP
    await sendOTP(data.email);

    const enteredOTP = prompt("Enter the 6-digit OTP sent to email");

    if(!enteredOTP)
      return alert("OTP required");

    if(Date.now() > otpExpiry)
      return alert("OTP expired");

    if(enteredOTP != currentOTP)
      return alert("Invalid OTP");

    const users = await getDocs(collection(db,"users"));

    let receiverData=null;
    let receiverUsername=null;

    users.forEach(d=>{
      const u = d.data();
      if(u.accountNumber===receiverValue || u.iban===receiverValue){
        receiverData = u;
        receiverUsername = d.id;
      }
    });

    if(!receiverData)
      return alert("Receiver not found");

    const date = new Date().toISOString();
    const ref = "DCB"+Date.now();

    await updateDoc(userRef,{
      balance: balanceValue - amountValue,
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
      balance:Number(receiverData.balance || 0) + amountValue,
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

    setTimeout(()=>{
      location.reload();
    },1200);

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