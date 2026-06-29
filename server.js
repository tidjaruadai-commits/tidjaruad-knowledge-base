const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const EXPERTS = {
  sop: {
    name: 'ผู้เชี่ยวชาญ SOP',
    emoji: '📋',
    persona: `คุณคือผู้เชี่ยวชาญด้าน SOP และกระบวนการทำงานของบริษัทติดจรวด
เชี่ยวชาญเรื่อง: ขั้นตอนการทำงาน, การ Onboard พนักงาน, การอนุมัติค่าใช้จ่าย, การรายงานผล, การรับลูกค้าใหม่
ตอบเป็นภาษาไทย กระชับ ชัดเจน อ้างอิงขั้นตอนจาก Knowledge Base เสมอ`
  },
  sales: {
    name: 'ผู้เชี่ยวชาญ Sales',
    emoji: '💼',
    persona: `คุณคือผู้เชี่ยวชาญด้านการขายและสินค้าบริการของบริษัทติดจรวด
เชี่ยวชาญเรื่อง: TikTok Ads Management, TikTok Shop, Packages ราคา, การตอบคำถามลูกค้า, การปิดการขาย
ตอบเป็นภาษาไทย กระชับ ชัดเจน ช่วยให้ทีม Sales ตอบคำถามลูกค้าได้อย่างมั่นใจ`
  },
  hr: {
    name: 'ผู้เชี่ยวชาญ HR',
    emoji: '👥',
    persona: `คุณคือผู้เชี่ยวชาญด้าน HR และนโยบายบริษัทติดจรวด
เชี่ยวชาญเรื่อง: การลา วันหยุด สวัสดิการ ค่านิยมองค์กร จรรยาบรรณ การประเมินผล
ตอบเป็นภาษาไทย กระชับ ชัดเจน อ้างอิงนโยบายจาก Knowledge Base เสมอ`
  },
  tiktok: {
    name: 'ผู้เชี่ยวชาญ TikTok',
    emoji: '🎯',
    persona: `คุณคือผู้เชี่ยวชาญด้าน TikTok Marketing ของบริษัทติดจรวด
เชี่ยวชาญเรื่อง: TikTok Ads, Creative Framework, KPI Benchmark, TikTok Live Commerce, Content Strategy, Hook Formula
ตอบเป็นภาษาไทย ให้คำแนะนำที่นำไปใช้ได้จริง อ้างอิง Benchmark และ Best Practice`
  },
  ops: {
    name: 'ผู้เชี่ยวชาญ Operations',
    emoji: '🏢',
    persona: `คุณคือผู้เชี่ยวชาญด้าน Operations และการทำงานร่วมกันของบริษัทติดจรวด
เชี่ยวชาญเรื่อง: โครงสร้างองค์กร สายการรายงาน RACI Workflow ข้ามทีม การแก้ปัญหาการสื่อสาร
ตอบเป็นภาษาไทย กระชับ ชัดเจน ช่วยให้ทีมทำงานร่วมกันได้ลื่นไหลขึ้น`
  }
};

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, expert, articles } = req.body;
  if (!messages || !expert) return res.status(400).json({ error: 'Missing messages or expert' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const expertConfig = EXPERTS[expert] || EXPERTS.tiktok;

  // Build context from relevant articles
  let context = '';
  if (articles && articles.length) {
    context = '\n\n--- ข้อมูลจาก Knowledge Base ---\n' +
      articles.map(a => `[${a.title}]\n${a.content ? a.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800) : a.summary}`).join('\n\n');
  }

  const systemPrompt = expertConfig.persona + context;

  try {
    const client = new Anthropic({ apiKey });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Tidjaruad KB running on port ${PORT}`);
});
