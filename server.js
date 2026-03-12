import express from "express";
import fetch from "node-fetch";

const app = express();

// 测试主页
app.get("/", (req, res) => {
  res.send("Server running");
});

// 生成图片接口
app.get("/generate", async (req, res) => {
  const tag = req.query.tag || "masterpiece";
  const size = req.query.size || 1024;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: tag,
          size: `${size}x${size}`
        })
      }
    );

    const data = await response.json();
    const imageUrl = data.data[0].url;

    const imageResponse = await fetch(imageUrl);
    res.setHeader("Content-Type", "image/png");
    imageResponse.body.pipe(res);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
