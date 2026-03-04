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
// 🚀 INIT DASHBOARD
// ======================================================

async function initDashboard() {

  const username = localStorage.getItem("user");

  if (!username) {
    window.location.replace("index.html");
    return;
  }

  const userRef = doc(db, "users", username);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    alert("User not found");
    window.location.replace("index.html");
    return;
  }

  const data = snap.data();

  // ======================================================
  // 🔔 SUCCESS BANNER
  // ======================================================

  window.showSuccess = function (message) {
    const banner = document.getElementById("successBanner");
    if (!banner) return;

    banner.innerText = "✅ " + message;
    banner.style.display = "block";

    setTimeout(() => {
      banner.style.display = "none";
    }, 2000);
  };

  // ======================================================
  // 🔒 FREEZE CHECK
  // ======================================================

  function checkFreeze() {
    if (data.frozen) {
      alert("Account is frozen. Contact bank support.");
      return true;
    }
    return false;
  }

  // ======================================================
  // 👤 DISPLAY USER INFO
  // ======================================================

  document.getElementById("welcome").innerText =
    "Hello, " + (data.fullName || username);

  document.getElementById("name").innerText = data.fullName || "-";
  document.getElementById("acc").innerText = data.accountNumber || "-";
  document.getElementById("iban").innerText = data.iban || "-";
  document.getElementById("swift").innerText = data.swift || "DEUTDEFF";

  // ======================================================
  // 💰 BALANCE
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

    const sorted = data.transactions
      .filter(tx => tx.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);

    sorted.forEach(tx => {

      const amount = Number(tx.amount || 0);
      const color = amount > 0 ? "green" : "red";

      const formattedDate = new Date(tx.date).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });

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
  // 📂 PANEL TOGGLE
  // ======================================================

  const transferBox = document.getElementById("transferBox");
  const billBox = document.getElementById("billBox");
  const giftBox = document.getElementById("giftBox");

  window.showTransfer = () => {
    transferBox.style.display = "block";
    billBox.style.display = "none";
    giftBox.style.display = "none";
  };

  window.showBills = () => {
    billBox.style.display = "block";
    transferBox.style.display = "none";
    giftBox.style.display = "none";
  };

  window.showGift = () => {
    giftBox.style.display = "block";
    transferBox.style.display = "none";
    billBox.style.display = "none";
  };

  // ======================================================
  // 🔎 LIVE RECEIVER NAME PREVIEW
  // ======================================================

  const receiverInput = document.getElementById("receiver");
  const receiverNameBox = document.getElementById("receiverName");

  if (receiverInput && receiverNameBox) {
    receiverInput.addEventListener("input", async () => {

      const value = receiverInput.value.trim();

      if (!value) {
        receiverNameBox.innerText = "";
        return;
      }

      const users = await getDocs(collection(db, "users"));

      let foundName = null;

      users.forEach(d => {
        const u = d.data();
        if (u.accountNumber === value || u.iban === value) {
          foundName = u.fullName;
        }
      });

      if (foundName) {
        receiverNameBox.innerText = "Receiver: " + foundName;
        receiverNameBox.style.color = "#00ffb2";
      } else {
        receiverNameBox.innerText = "Account not found";
        receiverNameBox.style.color = "#ff6b6b";
      }

    });
  }

  // ======================================================
  // 🔐 TRANSFER WITH DAILY LIMIT (€100,000)
  // ======================================================

  window.askPin = async () => {

    if (checkFreeze()) return;

    const receiverValue =
      document.getElementById("receiver").value.trim();

    const amountValue =
      parseFloat(document.getElementById("amount").value);

    if (!receiverValue || !amountValue)
      return alert("Fill all fields");

    if (!data.pin)
      return alert("PIN not set for this user");

    const pin = prompt("Enter PIN");
    if (pin !== data.pin)
      return alert("Wrong PIN");

    if (balanceValue < amountValue)
      return alert("Insufficient funds");

    // 🚫 DAILY LIMIT
    const DAILY_LIMIT = 100000;

    const today = new Date().toISOString().split("T")[0];

    const todaysTransfers = (data.transactions || []).filter(tx => {
      if (!tx.date) return false;
      const txDate = new Date(tx.date).toISOString().split("T")[0];
      return txDate === today && tx.amount < 0;
    });

    const totalSentToday = todaysTransfers.reduce((sum, tx) => {
      return sum + Math.abs(tx.amount);
    }, 0);

    if (totalSentToday + amountValue > DAILY_LIMIT) {
      return alert(
        "Daily limit exceeded.\n\n" +
        "Limit: €100,000\n" +
        "Already sent today: €" + totalSentToday.toLocaleString()
      );
    }

    const users = await getDocs(collection(db, "users"));

    let receiverData = null;
    let receiverUsername = null;

    users.forEach(d => {
      const u = d.data();
      if (u.accountNumber === receiverValue || u.iban === receiverValue) {
        receiverData = u;
        receiverUsername = d.id;
      }
    });

    if (!receiverData)
      return alert("Receiver not found");

    const date = new Date().toISOString();

    await updateDoc(userRef, {
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

    await updateDoc(doc(db, "users", receiverUsername), {
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

    showSuccess("Transfer Successful");

    setTimeout(() => {
      location.reload();
    }, 1200);
  };

  // ======================================================
  // 💡 PAY BILL
  // ======================================================

  window.payBill = async () => {

    if (checkFreeze()) return;

    const amt =
      parseFloat(document.getElementById("billAmount").value);

    if (!amt)
      return alert("Enter amount");

    if (balanceValue < amt)
      return alert("Insufficient funds");

    const date = new Date().toISOString();

    await updateDoc(userRef, {
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

    setTimeout(() => {
      location.reload();
    }, 1200);
  };

  // ======================================================
  // 🎁 BUY GIFT CARD
  // ======================================================

  window.buyGift = async () => {

    if (checkFreeze()) return;

    const amt =
      parseFloat(document.getElementById("giftAmount").value);

    if (!amt)
      return alert("Enter amount");

    if (balanceValue < amt)
      return alert("Insufficient funds");

    const date = new Date().toISOString();

    await updateDoc(userRef, {
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

    setTimeout(() => {
      location.reload();
    }, 1200);
  };

  // ======================================================
  // 🚪 LOGOUT
  // ======================================================

  window.logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("index.html");
  };
}

// START APP
initDashboard();