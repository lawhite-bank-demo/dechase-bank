// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  addDoc
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

let logoutTimer;


// ===== HELPERS =====
function el(id){
  return document.getElementById(id);
}

function setText(id,val){

  const e = el(id);

  if(e){
    e.innerText = val ?? "";
  }
}

function setAccountField(id, value){

  const element = el(id);

  if(!element) return;

  if(!value){

    element.parentElement.style.display = "none";

  }else{

    element.parentElement.style.display = "flex";

    element.innerText = value;
  }
}

function genRef(){

  const now = Date.now();

  const random =
  Math.floor(1000 + Math.random() * 9000);

  return "TRX-" + now + random;
}

function formatMoney(v){

  return Number(v || 0).toLocaleString(undefined,{

    minimumFractionDigits:2,
    maximumFractionDigits:2

  });
}


// ===== RECEIPT =====
window.showReceipt = function(t){

  setText(
    "rAmount",
    (t.amount < 0 ? "-€" : "+€") +
    formatMoney(Math.abs(t.amount))
  );

  setText(

    "rType",

    t.type === "transfer"
    ? "Transfer"

    : t.type === "bill"
    ? "Bill Payment"

    : t.amount < 0
    ? "Debit"

    : "Credit"
  );

  setText("rNote", t.note || "Transaction");

  setText(
    "rDate",
    new Date(t.date).toLocaleString()
  );

  setText(
    "rRef",
    t.reference || "N/A"
  );

  el("receiptModal")
  ?.classList.remove("hidden");
};

window.closeReceipt = function(){

  el("receiptModal")
  ?.classList.add("hidden");
};


// ===== NOTIFY =====
function notify(msg){

  const n =
  document.createElement("div");

  n.innerText = msg;

  n.style.position = "fixed";

  n.style.bottom = "100px";

  n.style.left = "50%";

  n.style.transform =
  "translateX(-50%)";

  n.style.background = "#111827";

  n.style.padding = "12px 18px";

  n.style.borderRadius = "10px";

  n.style.zIndex = "9999";

  n.style.boxShadow =
  "0 10px 30px rgba(0,0,0,0.3)";

  document.body.appendChild(n);

  setTimeout(()=>{
    n.remove();
  },2500);
}


// ===== LOGOUT =====
window.logoutUser = function(){

  localStorage.removeItem("user");

  notify("Logged out");

  setTimeout(()=>{

    window.location.href =
    "index.html";

  },500);
};


// ===== AUTO LOGOUT =====
function startAutoLogout(){

  clearTimeout(logoutTimer);

  logoutTimer = setTimeout(()=>{

    notify("Session expired");

    logoutUser();

  },60000);
}

["click","touchstart","keypress"]

.forEach(evt=>{

  document.addEventListener(
    evt,
    startAutoLogout
  );

});

document.addEventListener(
  "visibilitychange",
  ()=>{

    if(document.hidden){
      logoutUser();
    }
  }
);


// ===== BALANCE =====
function renderBalance(){

  const bal = el("balance");

  if(!bal) return;

  bal.innerText =

    hidden
    ? "••••••"

    : "€" + formatMoney(balance);

  setText(

    "toggleBalance",

    hidden
    ? "👁 Show"

    : "🙈 Hide"
  );
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

  elNum.innerText =

    showFullCard

    ? fullCardNumber

    : "**** **** **** " +
      fullCardNumber.slice(-4);
};
window.flipCard = function(){

    const card = document.getElementById("cardInner");

    if(!card) return;

    card.classList.toggle("flipped");

    const cvv = document.getElementById("cardCVV");

    if(cvv){

        cvv.innerText =

            card.classList.contains("flipped")

            ? realCVV

            : "***";

    }

};

// ===== FREEZE =====
window.toggleCard = async function(){

  if(!userRef) return;

  frozen = !frozen;

  await updateDoc(userRef,{

    cardFrozen:frozen

  });

  updateFreezeUI();
};

function updateFreezeUI(){

  const btn = el("cardBtn");

  if(btn){

    btn.innerText =

      frozen
      ? "Unfreeze Card"
      : "Freeze Card";
  }
}


// ===== TRANSACTIONS =====
function getTx(data){

  if(!data?.transactions){
    return [];
  }

  return Array.isArray(data.transactions)

    ? data.transactions

    : Object.values(data.transactions);
}


function renderTransactions(){

  const container =
  el("transactions");

  if(!container) return;

  container.innerHTML = "";

  const sortedTx = [...tx].sort(

    (a,b)=>{

      return new Date(b.date)
      - new Date(a.date);
    }
  );

  let currentGroup = "";

  sortedTx.forEach(t=>{

    const txDate =
    new Date(t.date);

    const today =
    new Date();

    const yesterday =
    new Date();

    yesterday.setDate(
      today.getDate() - 1
    );

    let dateLabel =

      txDate.toLocaleDateString(

        "en-GB",

        {
          day:"2-digit",
          month:"short",
          year:"numeric"
        }
      );

    if(

      txDate.toDateString() ===
      today.toDateString()

    ){

      dateLabel = "Today";
    }

    else if(

      txDate.toDateString() ===
      yesterday.toDateString()

    ){

      dateLabel = "Yesterday";
    }

    // DATE HEADER
    if(currentGroup !== dateLabel){

      currentGroup = dateLabel;

      const header =
      document.createElement("div");

      header.className =
      "tx-date-header";

      header.innerText =
      dateLabel;

      container.appendChild(header);
    }

    const formattedTime =

      txDate.toLocaleTimeString(

        "en-GB",

        {

          hour:"2-digit",
          minute:"2-digit",
          second:"2-digit"

        }
      );

    // TRANSACTION
    const div =
    document.createElement("div");

    div.className = "tx";

    div.onclick = ()=>showReceipt(t);

    div.innerHTML = `

      <div class="tx-left">

      <div class="tx-title">

  ${t.note || "Transaction"}

  ${
    t.status === "pending"
      ? '<br><small style="color:#facc15;font-weight:bold;">🟡 Pending Approval</small>'
      : ""
  }

</div>

        <small class="tx-time">

          ${formattedTime}

        </small>

        <small class="tx-ref">

          Ref:
          ${t.reference || genRef()}

        </small>

      </div>

      <div class="
tx-amount
${
    t.status === "pending"
        ? ""
        : t.amount < 0
        ? "tx-negative"
        : "tx-positive"
}
">

        ${t.amount < 0
        ? "-€"
        : "+€"}

        ${formatMoney(
          Math.abs(t.amount)
        )}

      </div>
    `;

    container.appendChild(div);

  });
}


// ===== CURRENCY =====
async function fetchRates(){

  try{

    const res = await fetch(

      "https://api.exchangerate-api.com/v4/latest/EUR"
    );

    const data = await res.json();

    eurToUsd =
    data.rates.USD || eurToUsd;

    eurToGbp =
    data.rates.GBP || eurToGbp;

  }catch{

    console.warn(
      "Fallback rates used"
    );
  }

  updateWallet();
}

function updateWallet(){

  const usd =
  "$" + formatMoney(balance * eurToUsd);

  const eur =
  "€" + formatMoney(balance);

  const gbp =
  "£" + formatMoney(balance * eurToGbp);

  setText("usdWallet", usd);

  setText("eurWallet", eur);

  setText("gbpWallet", gbp);

  setText("convertedEUR", eur);

  setText("convertedUSD", usd);

  setText("convertedGBP", gbp);
}


// ===== BILLS =====
window.payBill = async function(name, amount){

  if(frozen){

    return notify("Card is frozen");
  }

  if(amount > balance){

    return notify(
      "Insufficient balance"
    );
  }

  const newTx = {

    note:name + " Bill",

    amount:-amount,

    date:new Date().toISOString(),

    reference:genRef(),

    type:"bill"
  };

  balance -= amount;

  await updateDoc(userRef,{

    balance,

    transactions:[...tx,newTx]

  });

  notify(name + " paid successfully");
};


// ===== ADD MONEY =====
window.addMoney = async function(){

  const amount = Number(
    el("addMoneyAmount").value
  );

  if(!amount || amount <= 0){

    return notify("Invalid amount");
  }

  const method =
  el("fundMethod").value;

  const newTx = {

    note:"Deposit via " + method,

    amount:amount,

    date:new Date().toISOString(),

    reference:genRef(),

    type:"deposit"
  };

  balance += amount;

  await updateDoc(userRef,{

    balance,

    transactions:[...tx,newTx]
  });

  notify("Funds added successfully");

  showReceipt(newTx);

  el("addMoneyAmount").value = "";
};


// ===== INIT =====
async function init(){

  el("receiptModal")
  ?.classList.add("hidden");

  const username =
  localStorage.getItem("user");

  if(!username){

    return location.href =
    "index.html";
  }

  userRef =
  doc(db,"users",username);

  const snap =
  await getDoc(userRef);

  if(!snap.exists()){

    return location.href =
    "index.html";
  }

 const data = snap.data();

balance = Number(data.balance || 0);

tx = getTx(data);
const pendingQuery = query(
    collection(db, "pendingTransfers"),
    where("sender", "==", username),
    where("status", "==", "pending")
);

const pendingSnap = await getDocs(pendingQuery);

pendingSnap.forEach(doc => {

    const p = doc.data();

    tx.unshift({
        amount: -Number(p.amount),
        note: p.description + " (Pending)",
        reference: p.reference,
        type: "transfer",
        date: p.date,
        status: "pending"
    });

});

frozen = data.cardFrozen || false;

setText("welcome", "Hi, " + (data.fullName || ""));

setText("nameProfile", data.fullName || "");

setText(
    "emailProfile",
    data.email || "dechasebank@gmail.com"
);

window._userEmail = data.email || "";

setAccountField("iban", data.iban);

setAccountField("swift", data.swift);

setAccountField(
    "accountNumberDisplay",
    data.accountNumber
);

setAccountField(
    "routingDisplay",
    data.routingNumber
);

// CARD DETAILS
fullCardNumber =
    data.cardNumber ||
    data.accountNumber ||
    "";

setText(
    "cardNumber",
    fullCardNumber
        ? "**** **** **** " + fullCardNumber.slice(-4)
        : "**** **** **** 0000"
);

setText(
    "cardName",
    data.fullName || ""
);

setText(
    "cardExpiry",
    data.cardExpiry ||
    data.card?.expiry ||
    ""
);

realCVV =
    data.cardCVV ||
    data.card?.cvv ||
    "***";

window._realCVV = realCVV;

  updateFreezeUI();

  renderBalance();

  updateWallet();

  renderTransactions();

  fetchRates();
// =======================
// LIVE PENDING TRANSFERS
// =======================

const pendingQuery = query(
    collection(db, "pendingTransfers"),
    where("sender", "==", username)
);

onSnapshot(pendingQuery, (snapshot) => {

    // Reset transactions to completed ones
    tx = getTx(data);

    // Add pending transfers
    snapshot.forEach(doc => {

        const p = doc.data();

        if (p.status === "pending") {

            tx.unshift({
                amount: -Number(p.amount),
                note: (p.description || "Bank Transfer") + " (Pending)",
                reference: p.reference,
                type: "transfer",
                date: p.date,
                status: "pending"
            });

        }

    });

    renderTransactions();

});

  startAutoLogout();


  onSnapshot(userRef, async (snap)=>{

    const d = snap.data();

    if(!d) return;

    balance =
    Number(d.balance || 0);

    tx = getTx(d);
const username = localStorage.getItem("user");

const pendingQuery = query(
    collection(db, "pendingTransfers"),
    where("sender", "==", username),
    where("status", "==", "pending")
);

const pendingSnap = await getDocs(pendingQuery);

pendingSnap.forEach(doc => {

    const p = doc.data();

    tx.unshift({
        amount: -Number(p.amount),
        note: p.description + " (Pending)",
        reference: p.reference,
        type: "transfer",
        date: p.date,
        status: "pending"
    });

});

    frozen =
    d.cardFrozen || false;

    setText(

      "emailProfile",

      d.email ||

      "dechasebank@gmail.com"
    );

    setText(

      "bankAddress",

      d.bankAddress ||

      "24 Bishopsgate, London"
    );

    setText(

      "addressProfile",

      d.address ||

      "Bucharest, Romania"
    );

    setText(

      "accountTier",

      d.accountTier ||

      "Premium Account"
    );

    setText(

      "accountLimit",

      d.accountLimit ||

      "Daily Limit: €250,000"
    );

    setAccountField(
      "iban",
      d.iban
    );

    setAccountField(
      "swift",
      d.swift
    );

    setAccountField(
      "accountNumberDisplay",
      d.accountNumber
    );

    setAccountField(
      "routingDisplay",
      d.routingNumber
    );

    renderBalance();

    updateWallet();

    renderTransactions();

    updateFreezeUI();

  });
}
// =======================
// OPEN PIN MODAL
// =======================

window.openPinModal = function () {

    if (frozen) {
        notify("Card is frozen");
        return;
    }

    const type = el("transferType").value;
    const amount = Number(el("amount").value);

    if (type === "wire") {

        if (!el("accountNumber").value.trim()) {
            notify("Enter recipient account number");
            return;
        }

    } else {

        if (!el("ibanInput").value.trim()) {
            notify("Enter recipient IBAN");
            return;
        }

        if (!el("swiftInput").value.trim()) {
            notify("Enter SWIFT/BIC");
            return;
        }

    }

    if (!amount || amount <= 0) {
        notify("Enter a valid amount");
        return;
    }

    if (amount > balance) {
        notify("Insufficient balance");
        return;
    }

    el("transferPin").value = "";
    el("pinModal").classList.remove("hidden");
};

// =======================
// CLOSE PIN MODAL
// =======================

window.closePinModal = function () {

    el("pinModal").classList.add("hidden");

};


// =======================
// VERIFY PIN
// =======================

window.verifyTransferPin = async function () {

    const entered = el("transferPin").value.trim();

    if (!entered) {
        notify("Enter your PIN");
        return;
    }

    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        notify("User not found");
        return;
    }

    const user = snap.data();

    if (String(user.pin) !== String(entered)) {
        notify("Incorrect PIN");
        return;
    }

    closePinModal();

    processTransfer();

};


// =======================
// PROCESS TRANSFER
// =======================
async function processTransfer() {

    const amount = Number(el("amount").value);
    const description = el("description").value.trim() || "Bank Transfer";
    const reference = genRef();

    await addDoc(collection(db, "pendingTransfers"), {

        sender: localStorage.getItem("user"),

        amount: amount,

        accountNumber: el("accountNumber")?.value || "",

        routingNumber: el("routingNumber")?.value || "",

        iban: el("ibanInput")?.value || "",

        swift: el("swiftInput")?.value || "",

        description: description,

        status: "pending",

        processed: false,

        reference: reference,

        date: new Date().toISOString()

    });

    notify("Transfer submitted for approval.");

    el("amount").value = "";
    el("description").value = "";
    el("accountNumber").value = "";
    el("routingNumber").value = "";
    el("ibanInput").value = "";
    el("swiftInput").value = "";

    openPage("homePage");

}
// START
init();