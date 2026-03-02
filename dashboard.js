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

// CHECK LOGIN
const username = localStorage.getItem("user");
if (!username) location.href = "index.html";

// LOAD USER DATA
const userRef = doc(db, "users", username);
const snap = await getDoc(userRef);

if (!snap.exists()) {
  alert("User not found");
  location.href = "index.html";
}

const data = snap.data();

// DISPLAY USER INFO
document.getElementById("welcome").innerText =
  "Hello, " + (data.fullName || username);

document.getElementById("name").innerText =
  data.fullName ? data.fullName : username;

document.getElementById("acc").innerText =
  data.accountNumber ? data.accountNumber : "N/A";

document.getElementById("iban").innerText =
  data.iban ? data.iban : "N/A";

document.getElementById("swift").innerText =
  data.swift ? data.swift : "DEUTDEFF";
// CALCULATE BALANCE
let balanceValue = Number(data.balance || 0);

if (Array.isArray(data.transactions)) {
  data.transactions.forEach(tx => {
    balanceValue += Number(tx.amount || 0);
  });
}

// SHOW BALANCE
let hidden = false;

function renderBalance() {
  document.getElementById("balance").innerText =
    hidden ? "••••••" : "€" + balanceValue.toLocaleString();

  document.getElementById("toggleBalance").innerText =
    hidden ? "👁 Show balance" : "👁 Hide balance";
}

window.toggleBalance.onclick = () => {
  hidden = !hidden;
  renderBalance();
};

renderBalance();

// SHOW TRANSACTIONS
const box = document.getElementById("transactions");

if (Array.isArray(data.transactions) && data.transactions.length) {
  const sorted = data.transactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  sorted.forEach(tx => {
    const color = tx.amount > 0 ? "green" : "red";

    box.innerHTML += `
      <div class="${color}">
        ${tx.note || "Transaction"} (€${Math.abs(tx.amount).toLocaleString()})
        <div class="small">${tx.date || ""}</div>
      </div>`;
  });
} else {
  box.innerHTML = `<div class="small">No transactions yet</div>`;
}

// SHOW SECTIONS
window.showTransfer = () =>
  (document.getElementById("transferBox").style.display = "block");

window.showBills = () =>
  (document.getElementById("billBox").style.display = "block");

window.showGift = () =>
  (document.getElementById("giftBox").style.display = "block");

// TRANSFER WITH PIN
let transferData = null;

window.askPin = () => {
  transferData = {
    receiver: receiver.value.trim(),
    amount: parseFloat(amount.value)
  };

  if (!transferData.receiver || !transferData.amount)
    return alert("Fill fields");

  pinModal.style.display = "flex";
};

window.closePin = () => (pinModal.style.display = "none");

window.confirmTransfer = async () => {
  if (pinInput.value !== data.pin) return alert("Wrong PIN");

  const users = await getDocs(collection(db, "users"));
  let receiverName = null;
  let receiverData = null;

  users.forEach(d => {
    if (d.id === transferData.receiver || d.data().iban === transferData.receiver) {
      receiverName = d.id;
      receiverData = d.data();
    }
  });

  if (!receiverName) return alert("Receiver not found");
  if (balanceValue < transferData.amount)
    return alert("Insufficient funds");

  const date = new Date().toLocaleString();

  await updateDoc(userRef, {
    balance: balanceValue - transferData.amount,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -transferData.amount,
        note: "Sent to " + receiverName,
        date
      }
    ]
  });

  await updateDoc(doc(db, "users", receiverName), {
    balance:
      Number(receiverData.balance || 0) + transferData.amount,
    transactions: [
      ...(receiverData.transactions || []),
      {
        amount: transferData.amount,
        note: "Received from " + username,
        date
      }
    ]
  });

  alert("Transfer successful");
  location.reload();
};

// PAY BILL
window.payBill = async () => {
  const amt = parseFloat(billAmount.value);

  if (!amt) return alert("Enter amount");
  if (balanceValue < amt) return alert("Insufficient funds");

  const date = new Date().toLocaleString();

  await updateDoc(userRef, {
    balance: balanceValue - amt,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amt,
        note: billType.value + " bill paid",
        date
      }
    ]
  });

  alert("Bill paid");
  location.reload();
};

// BUY GIFT CARD
window.buyGift = async () => {
  const amt = parseFloat(giftAmount.value);

  if (!amt) return alert("Enter amount");
  if (balanceValue < amt) return alert("Insufficient funds");

  const date = new Date().toLocaleString();

  await updateDoc(userRef, {
    balance: balanceValue - amt,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amt,
        note: giftType.value + " gift card",
        date
      }
    ]
  });

  alert("Gift
