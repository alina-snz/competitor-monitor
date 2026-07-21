import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyAHhzle0TUo_7qN6XRpjLlBB3ejHJfndtE",
    authDomain: "competitor-monitor-cb0f4.firebaseapp.com",
    projectId: "competitor-monitor-cb0f4",
    storageBucket: "competitor-monitor-cb0f4.firebasestorage.app",
    messagingSenderId: "298747654791",
    appId: "1:298747654791:web:a133a4214852fd498e7e22",
    measurementId: "G-9288LK5VJX"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const provider = new GoogleAuthProvider()
export const db = getFirestore(app)