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
// ✅ LOGIN CHECK
// ======================================================

const username = localStorage.getItem("user");

if (!username) {
  window.location.replace("index.html");
}

const userRef = doc(db, "users", username);
const snap = await getDoc(userRef);

if (!snap.exists()) {
  alert("User not found");
  window.location.replace("index.html");
}

const data = snap.data();

// ======================================================
// 🔒 FREEZE BANNER CONTROL
// ======================================================

const freezeBanner = document.getElementById("freezeBanner");

if (freezeBanner) {
  freezeBanner.style.display = data.frozen ? "block" : "none";
}
function showSuccess(message) {
  const banner = document.getElementById("successBanner");
  if (!banner) return;

  banner.innerText = "✅ " + message;
  banner.style.display = "block";

  setTimeout(() => {
    banner.style.display = "none";
  }, 3000);
}
// ======================================================
// 👤 DISPLAY USER INFO
// ======================================================

document.getElementById("welcome").innerText =
  "Hello, " + (data.fullName || username);

document.getElementById("name").innerText =
  data.fullName || "-";

document.getElementById("acc").innerText =
  data.accountNumber || "-";

document.getElementById("iban").innerText =
  data.iban || "-";

document.getElementById("swift").innerText =
  data.swift || "DEUTDEFF";

// ======================================================
// 💰 BALANCE CONTROL
// ======================================================

let balanceValue = Number(data.balance || 0);
let hidden = false;

const balanceEl = document.getElementById("balance");
const toggleEl = document.getElementById("toggleBalance");

function renderBalance() {
  balanceEl.innerText = hidden
    ? "••••••"
    : "€" + balanceValue.toLocaleString();

  toggleEl.innerText = hidden
    ? "👁 Show balance"
    : "👁 Hide balance";
}

toggleEl.onclick = () => {
  hidden = !hidden;
  renderBalance();
};

renderBalance();

// ======================================================
// 🧾 TRANSACTIONS
// ======================================================

const box = document.getElementById("transactions");

if (Array.isArray(data.transactions) && data.transactions.length) {

  const sorted = (data.transactions || [])
    .filter(tx => tx.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  sorted.forEach(tx => {

    const amount = Number(tx.amount || 0);
    const color = amount > 0 ? "green" : "red";

    const formattedDate = tx.date
      ? new Date(tx.date).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })
      : "";

    const details =
      tx.fromName ? "From: " + tx.fromName :
      tx.toName ? "To: " + tx.toName : "";

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
// 🔐 TRANSFER
// ======================================================

window.askPin = async () => {

  if (data.frozen)
    return alert("Account is frozen. Contact bank support.");

  const receiverInput = document.getElementById("receiver").value.trim();
  const amountValue = parseFloat(document.getElementById("amount").value);

  if (!receiverInput || !amountValue)
    return alert("Fill all fields");

  if (!data.pin)
    return alert("PIN not set for this user");

  const pin = prompt("Enter PIN");
  if (pin !== data.pin) return alert("Wrong PIN");

  const users = await getDocs(collection(db,"users"));

  let receiverData = null;
  let receiverUsername = null;

  users.forEach(d => {
    const u = d.data();
    if (u.accountNumber === receiverInput || u.iban === receiverInput) {
      receiverData = u;
      receiverUsername = d.id;
    }
  });

  if (!receiverData) return alert("Receiver not found");
  if (balanceValue < amountValue) return alert("Insufficient funds");

  const date = new Date().toISOString();

  await updateDoc(userRef,{
    balance: balanceValue - amountValue,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amountValue,
        note: "SEPA Transfer",
        toName: receiverData.fullName,
        date
      }
    ]
  });

  await updateDoc(doc(db,"users",receiverUsername),{
    balance: Number(receiverData.balance || 0) + amountValue,
    transactions: [
      ...(receiverData.transactions || []),
      {
        amount: amountValue,
        note: "SEPA Credit Transfer",
        fromName: data.fullName,
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

  if (data.frozen)
    return alert("Account is frozen. Contact bank support.");

  const amt = parseFloat(document.getElementById("billAmount").value);

  if (!amt) return alert("Enter amount");
  if (balanceValue < amt) return alert("Insufficient funds");

  const date = new Date().toISOString();

  await updateDoc(userRef,{
    balance: balanceValue - amt,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amt,
        note: document.getElementById("billType").value + " Direct Debit",
        date
      }
    ]
  });

  showSuccess("Bill Payment Successful");
  location.reload();
};

// ======================================================
// 🎁 BUY GIFT CARD
// ======================================================

window.buyGift = async () => {

  if (data.frozen)
    return alert("Account is frozen. Contact bank support.");

  const amt = parseFloat(document.getElementById("giftAmount").value);

  if (!amt) return alert("Enter amount");
  if (balanceValue < amt) return alert("Insufficient funds");

  const date = new Date().toISOString();

  await updateDoc(userRef,{
    balance: balanceValue - amt,
    transactions: [
      ...(data.transactions || []),
      {
        amount: -amt,
        note: document.getElementById("giftType").value + " Gift Card",
        date
      }
    ]
  });

  showSuccess("Gift Card Purchased");
  location.reload();
};

// ======================================================
// 🚪 LOGOUT
// ======================================================

window.logout = () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("index.html");
};
