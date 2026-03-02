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

// ✅ CHECK LOGIN
const username = localStorage.getItem("user");
if (!username) location.href = "index.html";

// ✅ LOAD USER
const userRef = doc(db, "users", username);
const snap = await getDoc(userRef);

if (!snap.exists()) {
  alert("User not found");
  location.href = "index.html";
}

const data = snap.data();

// ✅ DISPLAY USER INFO
welcome.innerText = "Hello, " + (data.fullName || username);
name.innerText = data.fullName || username;
acc.innerText = data.accountNumber || "N/A";
iban.innerText = data.iban || "N/A";
swift.innerText = data.swift || "DEUTDEFF";

// ======================================================
// 💰 BALANCE
// ======================================================

let balanceValue = Number(data.balance || 0);
let hidden = false;

function renderBalance() {
  balance.innerText = hidden
    ? "••••••"
    : "€" + balanceValue.toLocaleString();

  toggleBalance.innerText = hidden
    ? "👁 Show balance"
    : "👁 Hide balance";
}

toggleBalance.onclick = () => {
  hidden = !hidden;
  renderBalance();
};

renderBalance();

// ======================================================
// 🧾 TRANSACTIONS (EUROPEAN STYLE)
// ======================================================

const box = document.getElementById("transactions");
box.innerHTML = "";

if (Array.isArray(data.transactions) && data.transactions.length) {

  const sorted = data.transactions
    .sort((a,b)=> new Date(b.date) - new Date(a.date))
    .slice(0,5);   // show latest 5

  sorted.forEach(tx => {

    const amount = Number(tx.amount || 0);
    const color = amount > 0 ? "green" : "red";

    const formattedDate = tx.date
      ? new Date(tx.date).toLocaleString("en-GB", {
          day:"2-digit",
          month:"short",
          year:"numeric",
          hour:"2-digit",
          minute:"2-digit"
        })
      : "";

    let details = "";

    if(tx.fromName){
      details = "From: " + tx.fromName;
    }

    if(tx.toName){
      details = "To: " + tx.toName;
    }

    const div = document.createElement("div");
    div.className = color;

    div.innerHTML = `
      <strong>${tx.note || "Transaction"}</strong><br>
      €${Math.abs(amount).toLocaleString()}
      <div class="small">${details}</div>
      <div class="small">${formattedDate}</div>
    `;

    box.appendChild(div);
  });

} else {
  box.innerHTML = "<div class='small'>No transactions yet</div>";
}

// ======================================================
// 📂 SHOW PANELS
// ======================================================

window.showTransfer = () => transferBox.style.display = "block";
window.showBills = () => billBox.style.display = "block";
window.showGift = () => giftBox.style.display = "block";

// ======================================================
// 🔐 TRANSFER
// ======================================================

window.askPin = async () => {

  const receiverName = receiver.value.trim();
  const amountValue = parseFloat(amount.value);

  if (!receiverName || !amountValue)
    return alert("Fill all fields");

  const pin = prompt("Enter PIN");
  if(pin !== data.pin) return alert("Wrong PIN");

  const users = await getDocs(collection(db,"users"));

  let receiverData = null;

  users.forEach(d=>{
    if(d.id === receiverName || d.data().iban === receiverName){
      receiverData = d.data();
    }
  });

  if(!receiverData) return alert("Receiver not found");
  if(balanceValue < amountValue) return alert("Insufficient funds");

  const date = new Date().toISOString();

  await updateDoc(userRef,{
    balance: balanceValue - amountValue,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amountValue,
        note: "SEPA Transfer",
        toName: receiverName,
        date
      }
    ]
  });

  await updateDoc(doc(db,"users",receiverName),{
    balance: Number(receiverData.balance || 0) + amountValue,
    transactions: [
      ...(receiverData.transactions || []),
      {
        amount: amountValue,
        note: "SEPA Credit Transfer",
        fromName: username,
        date
      }
    ]
  });

  alert("Transfer successful");
  location.reload();
};

// ======================================================
// 💡 PAY BILL
// ======================================================

window.payBill = async () => {

  const amt = parseFloat(billAmount.value);
  if (!amt) return alert("Enter amount");
  if (balanceValue < amt) return alert("Insufficient funds");

  const date = new Date().toISOString();

  await updateDoc(userRef,{
    balance: balanceValue - amt,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amt,
        note: billType.value + " Direct Debit",
        date
      }
    ]
  });

  alert("Bill paid");
  location.reload();
};

// ======================================================
// 🎁 BUY GIFT CARD
// ======================================================

window.buyGift = async () => {

  const amt = parseFloat(giftAmount.value);
  if (!amt) return alert("Enter amount");
  if (balanceValue < amt) return alert("Insufficient funds");

  const date = new Date().toISOString();

  await updateDoc(userRef,{
    balance: balanceValue - amt,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amt,
        note: giftType.value + " Gift Card",
        date
      }
    ]
  });

  alert("Gift card purchased");
  location.reload();
};

// ======================================================
// 🚪 LOGOUT
// ======================================================

window.logout = () => {
  localStorage.removeItem("user");
  location.href = "index.html";
};