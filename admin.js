// ======================
// FIREBASE
// ======================

import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
getFirestore,
collection,
doc,
getDoc,
getDocs,
updateDoc,
setDoc,
deleteDoc,
query,
where,
orderBy
}
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({

apiKey:"AIzaSy...",

authDomain:"dechase-bank.firebaseapp.com",

projectId:"dechase-bank"

});

const db=getFirestore(app);
window.db = db;

(async () => {
    try {
        const snap = await getDocs(collection(db, "users"));
        console.log("Users found:", snap.size);

        snap.forEach(doc => {
            console.log(doc.id, doc.data());
        });

    } catch (e) {
        console.error("Firestore error:", e);
    }
})();
console.log("Firebase connected");
alert("Firebase connected");

// ======================
// HELPERS
// ======================

function el(id){

return document.getElementById(id);

}

let users=[];
let selectedUser = null;
let selectedUserRef = null;

// ======================
// ADMIN LOGIN
// ======================

window.adminLogin=async function(){

const username=
el("adminUsername").value.trim();

const password=
el("adminPassword").value.trim();

if(!username||!password){

alert("Enter username and password");

return;

}

const adminRef=
doc(db,"admins",username);

const snap=
await getDoc(adminRef);

if(!snap.exists()){

alert("Admin not found");

return;

}

const admin=
snap.data();

if(admin.password!==password){

alert("Wrong password");

return;

}

localStorage.setItem(
"admin",
username
);

el("loginPage").classList.add("hidden");

el("dashboardPage").classList.remove("hidden");

loadUsers();

};
// ======================
// LOAD USERS
// ======================

window.loadUsers = async function () {

    const snap = await getDocs(collection(db, "users"));

    users = [];

    snap.forEach(docSnap => {

        users.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    renderUsers(users);

};

// ======================
// RENDER USERS
// ======================

function renderUsers(list){

const container = el("usersTable");

container.innerHTML="";

list.forEach(user=>{

container.innerHTML+=`

<div class="userCard">

<h3>${user.fullName}</h3>

<p>${user.email}</p>

<p>

€${Number(user.balance||0).toLocaleString()}

</p>

<p>

${user.accountNumber||""}

</p>

<button onclick="manageUser('${user.id}')">

Manage

</button>

</div>

`;

});
window.manageUser = function(id) {

    alert("Selected user: " + id);

};
}
window.manageUser = async function(id){

    selectedUserRef = doc(db,"users",id);

    const snap = await getDoc(selectedUserRef);

    if(!snap.exists()){

        alert("Customer not found");

        return;

    }

    selectedUser = snap.data();

    document.getElementById("customerPanel").style.display="block";

    document.getElementById("selectedName").innerText =
    selectedUser.fullName || "";

    document.getElementById("selectedEmail").innerText =
    selectedUser.email || "";

    document.getElementById("selectedBalance").innerText =
    Number(selectedUser.balance || 0).toLocaleString();

    document.getElementById("selectedIBAN").innerText =
    selectedUser.iban || "";

    document.getElementById("selectedSwift").innerText =
    selectedUser.swift || "";

    document.getElementById("selectedAccount").innerText =
    selectedUser.accountNumber || "";

    document.getElementById("selectedRouting").innerText =
    selectedUser.routingNumber || "";

    document.getElementById("selectedStatus").innerText =
    selectedUser.cardFrozen
    ? "Frozen"
    : "Active";

};
// ======================
// LOGOUT
// ======================

window.logoutAdmin=function(){

localStorage.removeItem("admin");

location.reload();

};


// ======================
// AUTO LOGIN
// ======================

if(localStorage.getItem("admin")){

    el("loginPage")
    .classList
    .add("hidden");

    el("dashboardPage")
    .classList
    .remove("hidden");

    loadUsers();

    loadDashboard();

    loadPendingCounter();

}

// ===============================
// LOAD DASHBOARD
// ===============================

window.loadDashboard = async function () {

    try {

        const usersSnap = await getDocs(collection(db, "users"));

        let totalUsers = 0;
        let totalBalance = 0;
        let todayTransactions = 0;

        const today = new Date().toDateString();

        usersSnap.forEach(docSnap => {

            totalUsers++;

            const user = docSnap.data();

            totalBalance += Number(user.balance || 0);

            const transactions = Array.isArray(user.transactions)
                ? user.transactions
                : [];

            transactions.forEach(tx => {

                if (tx.date) {

                    const txDate = new Date(tx.date).toDateString();

                    if (txDate === today) {
                        todayTransactions++;
                    }

                }

            });

        });

        document.getElementById("totalUsers").innerText = totalUsers;

        document.getElementById("bankBalance").innerText =
            "€" + totalBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2
            });

        document.getElementById("todayTransactions").innerText =
            todayTransactions;

        const pendingSnap = await getDocs(collection(db, "pendingTransfers"));

        document.getElementById("pendingTransfers").innerText =
            pendingSnap.size;

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

};
loadDashboard();
loadUsers();