// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLENbYC5uyHlu2Z_w8UdNUmu6l-tvp6yk",
  authDomain: "silentsos-c92dc.firebaseapp.com",
  projectId: "silentsos-c92dc",
  storageBucket: "silentsos-c92dc.appspot.com",
  messagingSenderId: "769041099927",
  appId: "1:769041099927:web:971b5f3d10f6c4199fcdd2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
