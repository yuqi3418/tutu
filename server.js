import express from "express";
import fetch from "node-fetch";

const app = express();

// 测试主页
app.get("/", (req, res) => {
  res.send("NoveAI Server running");
});

// 生成图片接口
app.get("/generate", async (req, res) => {
  const tag = req.query.tag || "masterpiece";
  const size = req.query.size || "832x1216";
  const steps = parseInt(req.query.steps) || 28;
  const cfg = parseFloat(req.query.cfg) || 5;

  try {
    // 调用 NoveAI 接口
    const response = await fetch("https://image.novelai.net/ai/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_KEY}`
      },
      body: JSON.stringify({
        prompt: tag,
        size: size,
        steps: steps,
        cfg: cfg
      })
    });

    const data = await response.json();

    // 如果 NoveAI 返回 base64
    if (data.images && data.images[0].startsWith("data:image")) {
      const base64 = data.images[0].split(",")[1];
      const imgBuffer = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", "image/png");
      return res.end(imgBuffer);
    }

    // 如果 NoveAI 返回 URL
    if (data.images && data.images[0]) {
      const imageUrl = data.images[0];
      const imageResponse = await fetch(imageUrl);
      res.setHeader("Content-Type", "image/png");
      return imageResponse.body.pipe(res);
    }

    console.error("NoveAI API returned invalid response:", data);
    res.status(500).send("NoveAI API error, check logs");

  } catch (error) {
    console.error(error);
    res.status(500).send(error.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
