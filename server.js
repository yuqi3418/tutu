import express from "express";
import fetch from "node-fetch";

const app = express();

app.get("/generate", async (req, res) => {

    const tag = req.query.tag || "masterpiece";

    res.send("Server running");

});

app.listen(3000);
