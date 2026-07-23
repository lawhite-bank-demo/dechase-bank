// ======================================
// DECHASE BANK ADMIN PANEL
// PART 1
// Firebase + Dashboard + Users + Search
// ======================================

// ---------- FIREBASE ----------

import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    where
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---------- CONFIG ----------

const firebaseConfig = {
  apiKey: "AIzaSyBDp6wmJMY8WPyKPNE-bvVSiz4AIUbn71U",
  authDomain: "dechase-bank.firebaseapp.com",
  projectId: "dechase-bank",
  storageBucket: "dechase-bank.firebasestorage.app",
  messagingSenderId: "44428081485",
  appId: "1:44428081485:web:85d993a939d380336e1f04",
  measurementId: "G-YP84F2GQ6Z"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- GLOBALS ----------

let users = [];

let selectedUser = null;

let selectedUserRef = null;

// ---------- HELPER ----------

function el(id){

    return document.getElementById(id);

}

// ---------- NAVIGATION ----------

window.showSection = function(section){

    document.querySelectorAll("section").forEach(sec=>{

        sec.style.display="none";

    });

    const page = el(section);

    if(page){

        page.style.display="block";

    }

};

// ---------- LOAD DASHBOARD ----------

window.loadDashboard = async function(){

    const snap = await getDocs(collection(db,"users"));

    let totalUsers = 0;

    let totalBalance = 0;

    let todayTransactions = 0;

    const today = new Date().toDateString();

    snap.forEach(docSnap=>{

        totalUsers++;

        const user = docSnap.data();

        totalBalance += Number(user.balance || 0);

        if(Array.isArray(user.transactions)){

            user.transactions.forEach(tx=>{

                if(tx.date){

                    const txDate = new Date(tx.date).toDateString();

                    if(txDate===today){

                        todayTransactions++;

                    }

                }

            });

        }

    });

    el("totalUsers").innerText = totalUsers;

    el("bankBalance").innerText =
    "€" +
    totalBalance.toLocaleString(undefined,{
        minimumFractionDigits:2
    });

    el("todayTransactions").innerText =
    todayTransactions;

    try{

        const q = query(
    collection(db, "pendingTransfers"),
    where("status", "==", "pending")
);

const snap = await getDocs(q);

        el("pendingTransfers").innerText =
        pending.size;

    }catch{

        el("pendingTransfers").innerText="0";

    }

};

// ---------- LOAD USERS ----------

window.loadUsers = async function(){

    const snap = await getDocs(collection(db,"users"));

    users = [];

    snap.forEach(docSnap=>{

        users.push({

            id:docSnap.id,

            ...docSnap.data()

        });

    });

    renderUsers(users);

};

// ---------- SEARCH ----------

window.filterUsers = function(){

    const text =

    el("searchUser")

    .value

    .toLowerCase()

    .trim();

    const filtered = users.filter(user=>{

        return (

            (user.fullName||"")

            .toLowerCase()

            .includes(text)

            ||

            (user.email||"")

            .toLowerCase()

            .includes(text)

            ||

            (user.accountNumber||"")

            .toLowerCase()

            .includes(text)

            ||

            (user.iban||"")

            .toLowerCase()

            .includes(text)

        );

    });

    renderUsers(filtered);

};

// ---------- RENDER USERS ----------

function renderUsers(list){

    const container = el("usersTable");

    container.innerHTML = "";

    if(list.length===0){

        container.innerHTML =
        "<h3>No users found.</h3>";

        return;

    }

    list.forEach(user=>{

        container.innerHTML += `

<div class="userCard">

<h3>${user.fullName || "No Name"}</h3>

<p>${user.email || "No Email"}</p>

<p>€${Number(user.balance||0).toLocaleString()}</p>

<p>${user.accountNumber || ""}</p>

<button onclick="manageUser('${user.id}')">

Manage Customer

</button>

</div>

`;

    });

}

// ---------- START ----------

showSection("dashboard");

loadDashboard();

loadUsers();

console.log("Admin Part 1 Loaded");

// ======================================
// PART 2
// CUSTOMER MANAGEMENT
// ======================================

// ---------- OPEN CUSTOMER ----------

window.manageUser = async function(id){

    try{

        selectedUserRef = doc(db,"users",id);

        const snap = await getDoc(selectedUserRef);

        if(!snap.exists()){

            alert("Customer not found.");

            return;

        }

        selectedUser = snap.data();

        showSection("users");

        const panel = el("customerPanel");

        if(panel){

            panel.style.display = "block";

            panel.scrollIntoView({
                behavior:"smooth"
            });

        }

        el("selectedName").innerText =
        selectedUser.fullName || "";

        el("selectedEmail").innerText =
        selectedUser.email || "No Email";

        el("selectedBalance").innerText =
        Number(selectedUser.balance || 0)
        .toLocaleString();

        el("selectedIBAN").innerText =
        selectedUser.iban || "";

        el("selectedSwift").innerText =
        selectedUser.swift || "";

        el("selectedAccount").innerText =
        selectedUser.accountNumber || "";

        el("selectedRouting").innerText =
        selectedUser.routingNumber || "";

        el("selectedStatus").innerText =
        selectedUser.cardFrozen
        ? "Frozen"
        : "Active";

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

};

// ---------- CREDIT CUSTOMER ----------

window.creditUser = async function(){

    if(!selectedUserRef){

        alert("Select a customer first.");

        return;

    }

    const amount =
    Number(el("creditAmount").value);

    if(amount<=0){

        alert("Enter a valid amount.");

        return;

    }

    selectedUser.balance =
    Number(selectedUser.balance || 0)
    + amount;

    await updateDoc(selectedUserRef,{

        balance:selectedUser.balance

    });

    alert("Account credited successfully.");

    el("creditAmount").value="";

    manageUser(selectedUserRef.id);

    loadDashboard();

    loadUsers();

};

// ---------- DEBIT CUSTOMER ----------

window.debitUser = async function(){

    if(!selectedUserRef){

        alert("Select a customer first.");

        return;

    }

    const amount =
    Number(el("debitAmount").value);

    if(amount<=0){

        alert("Enter a valid amount.");

        return;

    }

    selectedUser.balance =
    Number(selectedUser.balance || 0)
    - amount;

    await updateDoc(selectedUserRef,{

        balance:selectedUser.balance

    });

    alert("Account debited successfully.");

    el("debitAmount").value="";

    manageUser(selectedUserRef.id);

    loadDashboard();

    loadUsers();

};

// ---------- FREEZE ACCOUNT ----------

window.toggleFreeze = async function(){

    if(!selectedUserRef){

        alert("Select a customer first.");

        return;

    }

    const frozen =
    !selectedUser.cardFrozen;

    await updateDoc(selectedUserRef,{

        cardFrozen:frozen

    });

    selectedUser.cardFrozen =
    frozen;

    el("selectedStatus").innerText =
    frozen
    ? "Frozen"
    : "Active";

    alert(

        frozen

        ? "Account Frozen"

        : "Account Unfrozen"

    );

};

// ---------- MANUAL TRANSACTION ----------

window.manualTransaction = async function(){

    if(!selectedUserRef){

        alert("Select a customer first.");

        return;

    }

    const note =
    el("manualNote").value.trim();

    if(note===""){

        alert("Enter a transaction note.");

        return;

    }

    const tx = {

        amount:0,

        type:"manual",

        note:note,

        reference:
        "ADM"+
        Date.now(),

        date:
        new Date().toISOString()

    };

    const transactions =

    Array.isArray(selectedUser.transactions)

    ? selectedUser.transactions

    : [];
transactions.unshift(tx);

await updateDoc(selectedUserRef,{

    transactions:transactions

});

selectedUser.transactions = transactions;

el("manualNote").value = "";

alert("Manual transaction added.");

manageUser(selectedUserRef.id);

loadDashboard();

loadUsers();

};

// ======================================
// REFRESH CUSTOMER
// ======================================

window.refreshCustomer = function(){

    if(selectedUserRef){

        manageUser(selectedUserRef.id);

    }

};

// ======================================
// REFRESH DASHBOARD
// ======================================

window.refreshDashboard = async function(){

    await loadDashboard();

    await loadUsers();

    refreshCustomer();

};

// ======================================
// LOAD PENDING TRANSFERS
// ======================================
window.loadPending = async function () {

    const table = el("pendingTable");
    table.innerHTML = "";

    const snap = await getDocs(collection(db, "pendingTransfers"));

    if (snap.empty) {
        table.innerHTML = "<h3>No Pending Transfers</h3>";
        return;
    }

    snap.forEach(docSnap => {

        const data = docSnap.data();

        table.innerHTML += `

<div class="userCard">

<h3>${data.sender || "Unknown User"}</h3>

<p><b>Amount:</b> €${Number(data.amount || 0).toLocaleString()}</p>

<p><b>Account:</b> ${data.accountNumber || ""}</p>

<p><b>Description:</b> ${data.description || ""}</p>

<p><b>Status:</b> ${data.status || "pending"}</p>

<button onclick="approveTransfer('${docSnap.id}')">
✅ Approve
</button>

<button onclick="rejectTransfer('${docSnap.id}')">
❌ Reject
</button>

</div>

`;

    });

};
// ======================================
// APPROVE TRANSFER
// ======================================

window.approveTransfer = async function(id){

    const transferRef = doc(db, "pendingTransfers", id);

    const transferSnap = await getDoc(transferRef);

    if(!transferSnap.exists()){
        alert("Transfer not found.");
        return;
    }

    const transfer = transferSnap.data();

    const userRef = doc(db, "users", transfer.sender);

    const userSnap = await getDoc(userRef);

    if(!userSnap.exists()){
        alert("Customer not found.");
        return;
    }

    const user = userSnap.data();

    const newBalance =
        Number(user.balance || 0) -
        Number(transfer.amount || 0);

    const transactions =
        Array.isArray(user.transactions)
        ? user.transactions
        : [];

    transactions.unshift({
        amount: -Number(transfer.amount || 0),
        note: transfer.description || "Bank Transfer",
        reference: transfer.reference,
        type: "transfer",
        date: new Date().toISOString()
    });

    await updateDoc(userRef,{
        balance: newBalance,
        transactions: transactions
    });

    await updateDoc(transferRef,{
        status: "approved",
        processed: true
    });

    alert("Transfer Approved");

    loadPending();
    loadDashboard();

};

// ======================================
// APPROVE TRANSFER
// ======================================

window.approveTransfer = async function(id){

    const transferRef = doc(db,"pendingTransfers",id);

    const transferSnap = await getDoc(transferRef);

    if(!transferSnap.exists()){
        alert("Transfer not found.");
        return;
    }

    const transfer = transferSnap.data();

    // Sender
    const senderRef = doc(db,"users",transfer.sender);

    const senderSnap = await getDoc(senderRef);

    if(!senderSnap.exists()){
        alert("Sender not found.");
        return;
    }

    const sender = senderSnap.data();

    // Receiver
    let receiverSnap;

    if(transfer.accountNumber){

        const q = query(
            collection(db,"users"),
            where("accountNumber","==",transfer.accountNumber)
        );

        const result = await getDocs(q);

        if(result.empty){
            alert("Receiver not found.");
            return;
        }

        receiverSnap = result.docs[0];

    }else{

        const q = query(
            collection(db,"users"),
            where("iban","==",transfer.iban)
        );

        const result = await getDocs(q);

        if(result.empty){
            alert("Receiver not found.");
            return;
        }

        receiverSnap = result.docs[0];
    }

    const receiver = receiverSnap.data();

    const senderTransactions =
        sender.transactions || [];

    const receiverTransactions =
        receiver.transactions || [];

    senderTransactions.unshift({
        amount:-transfer.amount,
        note:transfer.description,
        type:"transfer",
        reference:transfer.reference,
        date:new Date().toISOString()
    });

    receiverTransactions.unshift({
        amount:transfer.amount,
        note:"Transfer from " + transfer.sender,
        type:"transfer",
        reference:transfer.reference,
        date:new Date().toISOString()
    });

    await updateDoc(senderRef,{
        balance:Number(sender.balance)-Number(transfer.amount),
        transactions:senderTransactions
    });

    await updateDoc(receiverSnap.ref,{
        balance:Number(receiver.balance)+Number(transfer.amount),
        transactions:receiverTransactions
    });

    await deleteDoc(transferRef);

    alert("Transfer Approved");

    loadPending();
    loadDashboard();

};

// ======================================
// REJECT TRANSFER
// ======================================

window.rejectTransfer = async function(id){

    const transferRef = doc(db, "pendingTransfers", id);

    await updateDoc(transferRef, {
        status: "rejected",
        processed: true
    });

    alert("Transfer Rejected");

    loadPending();
    loadDashboard();

};
// ======================================
// LOGOUT
// ======================================

window.logoutAdmin = function(){

    if(confirm("Logout Admin?")){

        localStorage.removeItem("admin");

        location.reload();

    }

};

// ======================================
// AUTO START
// ======================================

window.onload = async function(){

    showSection("dashboard");

    await loadDashboard();

    await loadUsers();

    console.log("Admin Panel Loaded");

};