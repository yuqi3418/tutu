import express from "express";
import fetch from "node-fetch";
import JSZip from "jszip"; // 引入 JSZip 来处理官方返回的压缩包

const app = express();

// 测试主页
app.get("/", (req, res) => {
  res.send("NovelAI Server running");
});

// 生成图片接口
app.get("/generate", async (req, res) => {
  const tag = req.query.tag || "masterpiece";
  const sizeStr = req.query.size || "823x1216";
  
  // 必须将尺寸字符串拆分为纯数字的 width 和 height
  const sizeArr = sizeStr.split('x');
  const width = parseInt(sizeArr[0]) || 823;
  const height = parseInt(sizeArr[1]) || 1216;
  
  const steps = parseInt(req.query.steps) || 28;
  const cfg = parseFloat(req.query.cfg) || 5;

  try {
    // 建议使用官方端点 api.novelai.net
    const response = await fetch("https://image.novelai.net/ai/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_KEY}`
      },
      // 完全按照官方要求的结构构造 Body
      body: JSON.stringify({
        input: tag,
        model: "nai-diffusion-3", // 必须指定模型
        action: "generate",
        parameters: {
          width: width,
          height: height,
          steps: steps,
          scale: cfg,             // CFG 在这里叫 scale
          sampler: "k_euler"      // 推荐指定采样器
        }
      })
    });

    // 处理请求失败 (例如 400 模型不存在、401 鉴权失败)
    if (!response.ok) {
      const errorText = await response.text();
      console.error("NovelAI API 报错:", errorText);
      return res.status(response.status).send(`API Error: ${errorText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // 【核心修正】官方 API 成功返回的是一个 ZIP 压缩包
    if (contentType.includes("application/zip") || contentType.includes("application/x-zip-compressed")) {
      const arrayBuffer = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // 在压缩包里寻找 .png 文件
      const imageFile = Object.values(zip.files).find(file => file.name.endsWith('.png'));
      
      if (imageFile) {
        // 解压为 Buffer 并直接通过 res 发送回浏览器
        const imgBuffer = await imageFile.async("nodebuffer");
        res.setHeader("Content-Type", "image/png");
        return res.end(imgBuffer);
      } else {
        return res.status(500).send("ZIP 解压失败：未找到图片");
      }
    } 
    
    // 兼容处理：如果你用的 API_KEY 其实是某家第三方代理池（他们通常把返回魔改成 JSON）
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (data.images && data.images[0].startsWith("data:image")) {
        const base64 = data.images[0].split(",")[1];
        const imgBuffer = Buffer.from(base64, "base64");
        res.setHeader("Content-Type", "image/png");
        return res.end(imgBuffer);
      }
      if (data.images && data.images[0]) {
        const imageUrl = data.images[0];
        const imageResponse = await fetch(imageUrl);
        res.setHeader("Content-Type", "image/png");
        return imageResponse.body.pipe(res);
      }
    }

    res.status(500).send("未知的 API 返回格式，请检查日志");

  } catch (error) {
    console.error("服务器内部错误:", error);
    res.status(500).send(error.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
