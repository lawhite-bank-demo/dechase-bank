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
    updateDoc
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---------- CONFIG ----------

const firebaseConfig = {

    apiKey: "YOUR_API_KEY",

    authDomain: "dechase-bank.firebaseapp.com",

    projectId: "dechase-bank"

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

        const pending =
        await getDocs(collection(db,"pendingTransfers"));

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
