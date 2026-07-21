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

getDocs

}

from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({

apiKey:"AIzaSy...",

authDomain:"dechase-bank.firebaseapp.com",

projectId:"dechase-bank"

});

const db=getFirestore(app);


// ======================
// HELPERS
// ======================

function el(id){

return document.getElementById(id);

}

let users=[];


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

async function loadUsers(){

const snapshot=
await getDocs(collection(db,"users"));

users=[];

snapshot.forEach(doc=>{

users.push({

id:doc.id,

...doc.data()

});

});

el("totalUsers").innerText=
users.length;

renderUsers(users);

}
// ======================
// RENDER USERS
// ======================

function renderUsers(list){

const container=
el("usersList");

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

<button>

Manage

</button>

</div>

`;

});

}
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

}