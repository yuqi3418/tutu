import express from "express";
import fetch from "node-fetch";
import JSZip from "jszip";

const app = express();

// 1. 全局配置：允许跨域请求 (防止浏览器或客户端拦截)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get("/", (req, res) => {
  res.send("NovelAI 代理服务已启动并运行正常");
});

app.get("/generate", async (req, res) => {
  // 2. 清洗和组装参数，设置安全的默认值
  const tag = req.query.tag || "1girl, best quality, masterpiece";
  // 默认加入官方标准的负面提示词，防止崩坏
  const negative_prompt = req.query.ntg || "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry";
  const shape = req.query.shape; 
  
  let width = 1024;
  let height = 1024;

  if (shape === "portrait") {
    width = 832; height = 1216;
  } else if (shape === "landscape") {
    width = 1216; height = 832;
  } else if (req.query.size) {
    const sizeArr = req.query.size.split('x');
    width = parseInt(sizeArr[0]) || 832;
    height = parseInt(sizeArr[1]) || 1216;
  }

  // 防御机制：强制将分辨率对齐到 64 的整数倍，防止 NovelAI 报 400 错误
  width = Math.round(width / 64) * 64;
  height = Math.round(height / 64) * 64;

  // 防御机制：限制最大步数，防止请求超时 (Render 免费版对长耗时请求不友好)
  const steps = Math.min(parseInt(req.query.steps) || 28); 
  const cfg = parseFloat(req.query.cfg) || 5.0;

  // 防御机制：检查环境变量
  if (!process.env.API_KEY) {
    return res.status(500).send("服务器未配置 API_KEY，请去 Render 后台设置。");
  }

  try {
    // 3. 发起请求到最新的官方生成端点
    const response = await fetch("https://image.novelai.net/ai/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_KEY}`
      },
      body: JSON.stringify({
        input: tag,
        model: "nai-diffusion-3", // 指定最新的 V3 模型
        action: "generate",
        parameters: {
          width: width,
          height: height,
          steps: steps,
          scale: cfg,
          sampler: "k_euler",
          negative_prompt: negative_prompt
        }
      })
    });

    // 4. 拦截并处理官方报错 (如 401鉴权失败，429限流等)
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NovelAI 接口拒绝了请求 (状态码 ${response.status}):`, errorText);
      return res.status(response.status).send(`请求失败: 状态码 ${response.status}, 详情: ${errorText}`);
    }

    // 5. 核心解压逻辑：只要是 200 成功，就当做二进制 ZIP 流处理
    const arrayBuffer = await response.arrayBuffer();
    
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // 找到压缩包里的所有 png 文件
      const imageFiles = Object.values(zip.files).filter(file => file.name.endsWith('.png'));
      
      if (imageFiles.length > 0) {
        // 取出第一张图片转为 Buffer
        const imgBuffer = await imageFiles[0].async("nodebuffer");
        
        // 禁用浏览器缓存，防止你改了 prompt 看到的还是老图
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Content-Type", "image/png");
        
        // 直接发送图片二进制数据
        return res.send(imgBuffer);
      } else {
        return res.status(500).send("ZIP 解压成功，但里面没有找到 PNG 图片文件。");
      }
    } catch (zipError) {
      console.error("ZIP 解析失败:", zipError);
      return res.status(500).send("无法将返回的数据解析为压缩包，可能账户状态异常或 API 策略变更。");
    }

  } catch (error) {
    console.error("服务器内部错误:", error);
    res.status(500).send(`服务器内部发生致命错误: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
