const { io } = require("socket.io-client");

const socket = io("http://localhost:4000");

socket.on("connect", () => {
    console.log("✅ Connecté !");
    console.log("ID :", socket.id);
});

socket.on("metrics:update", (data) => {
    console.log("📊 Metrics :", data);
});

socket.on("disconnect", () => {
    console.log("❌ Déconnecté");
});