import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));

  // Initialize Gemini AI SDK (Server-Side only)
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Helper to safely parse JSON from AI outputs (Ollama or Gemini)
  function safeParseJson(text: string, fallback: any = {}) {
    try {
      return JSON.parse(text);
    } catch (e) {
      const firstObj = text.indexOf('{');
      const firstArr = text.indexOf('[');
      if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
        const lastArr = text.lastIndexOf(']');
        if (lastArr > firstArr) {
          try {
            return JSON.parse(text.slice(firstArr, lastArr + 1));
          } catch (_) {}
        }
      } else if (firstObj !== -1) {
        const lastObj = text.lastIndexOf('}');
        if (lastObj > firstObj) {
          try {
            return JSON.parse(text.slice(firstObj, lastObj + 1));
          } catch (_) {}
        }
      }
      return fallback;
    }
  }

  // Unified AI Generation Helper: routes to either Local Ollama or Cloud Gemini
  async function generateJsonWithProvider({
    provider,
    ollamaConfig,
    prompt,
    systemInstruction,
    geminiModel = 'gemini-3.8-flash',
    geminiSchema,
  }: {
    provider?: string;
    ollamaConfig?: { host?: string; model?: string; customModelName?: string };
    prompt: string;
    systemInstruction: string;
    geminiModel?: string;
    geminiSchema?: any;
  }): Promise<string> {
    if (provider === 'ollama') {
      const host = (ollamaConfig?.host || 'http://localhost:11434').replace(/\/+$/, '');
      const model = ollamaConfig?.customModelName?.trim() || ollamaConfig?.model || 'gemma4:e4b';

      const ollamaPrompt = `${systemInstruction}

${prompt}

YÊU CẦU ĐỊNH DẠNG BẮT BUỘC: Hãy trả về DUY NHẤT dữ liệu JSON hợp lệ theo đúng cấu trúc yêu cầu, không kèm giải thích hoặc markdown.`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for local LLMs

      try {
        const response = await fetch(`${host}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: ollamaPrompt,
            stream: false,
            format: 'json',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const textErr = await response.text().catch(() => '');
          throw new Error(`Ollama lỗi (${response.status}): ${textErr || response.statusText}`);
        }

        const resJson: any = await response.json();
        let rawText = resJson.response || resJson.message?.content || '';
        rawText = rawText.trim();
        if (rawText.startsWith('```json')) {
          rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        return rawText;
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          throw new Error(`Ollama (${model}) phản hồi quá lâu (quá 120 giây). Vui lòng kiểm tra tài nguyên máy.`);
        }
        throw new Error(`Không thể kết nối tới Ollama tại ${host}: ${err.message}. Đảm bảo đã chạy 'ollama serve' và pull model '${model}'.`);
      }
    }

    // Default: Gemini API
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
      },
    });

    return response.text || '[]';
  }

  // API endpoint to check Ollama status and list installed local models
  app.post('/api/ollama/check-status', async (req, res) => {
    try {
      const host = (req.body?.host || 'http://localhost:11434').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${host}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(response.status).json({
          online: false,
          error: `Ollama trả về mã lỗi ${response.status}`,
        });
      }

      const data: any = await response.json();
      const installedModels = (data.models || []).map((m: any) => m.name || m.model);
      return res.json({
        online: true,
        models: installedModels,
      });
    } catch (err: any) {
      return res.json({
        online: false,
        error: `Không thể kết nối (${err.message || 'Connection refused'}). Hãy đảm bảo Ollama đang chạy ('ollama serve').`,
      });
    }
  });

  // API endpoint for AI content selection & curation
  app.post('/api/ai/curate-lessons', async (req, res) => {
    try {
      const { lessons, provider, ollamaConfig } = req.body;
      if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
        return res.status(400).json({ error: 'Danh sách bài học không hợp lệ.' });
      }

      // Filter only lessons that have discussion, guided study, or self study periods
      const lessonsToCurate = lessons.map((l: any) => ({
        id: l.id,
        stt: l.stt,
        content: l.content,
        topics: l.topics || [],
        cdr: l.cdr || '',
        theoryPeriods: l.theoryPeriods || 0,
        discussionPeriods: l.discussionPeriods || 0,
        guidedStudyPeriods: l.guidedStudyPeriods || 0,
        selfStudyPeriods: l.selfStudyPeriods || 0,
      }));

      const systemInstruction = `Bạn là chuyên gia sư phạm và cố vấn xây dựng Kế hoạch dạy học theo chuẩn đại học/cao đẳng tại Việt Nam.
Nhiệm vụ của bạn là chọn lọc NỘI DUNG PHÙ HỢP cho từng bài học theo đúng cấu trúc và thời lượng số tiết được phân bổ:
1. PHẦN THẢO LUẬN (discussionTopics):
   - Tuyệt đối KHÔNG đưa nguyên tất cả nội dung bài học.
   - Chọn lọc các vấn đề then chốt, câu hỏi phân tích/tranh luận, tình huống thực tế hoặc chuyên đề thảo luận sâu sắc, trọng tâm nhất.
   - Số lượng nội dung thảo luận phải tương xứng với số tiết thảo luận (discussionPeriods):
     * Nếu 1 tiết thảo luận: chọn 1 - 2 nội dung thảo luận trọng tâm.
     * Nếu 2 tiết thảo luận: chọn 2 - 3 nội dung thảo luận.
     * Nếu 3-4 tiết thảo luận: chọn 3 - 4 nội dung thảo luận.
   - Viết rõ ràng, súc tích, mang tính chất câu hỏi hoặc đề tài thảo luận nhóm.

2. PHẦN TỰ HỌC CÓ HƯỚNG DẪN (guidedStudyTopics):
   - Chọn lọc nội dung phù hợp với số tiết tự học có HD (guidedStudyPeriods).
   - Tập trung vào các nội dung giảng viên cần định hướng cho học viên (như giải bài tập áp dụng, hệ thống hóa sơ đồ kiến thức, chuẩn bị báo cáo hoặc trả lời các câu hỏi ôn tập có gợi ý).
   - Tương xứng với số tiết: 1 tiết chọn 1-2 nội dung, 2-3 tiết chọn 2-3 nội dung.

3. PHẦN TỰ HỌC (selfStudyTopics):
   - Chọn lọc nội dung phù hợp với số tiết tự học (selfStudyPeriods).
   - Tập trung vào nghiên cứu tài liệu giáo trình, tìm hiểu các nội dung bổ trợ, tự làm bài tập nâng cao hoặc mở rộng thực tiễn.
   - Tương xứng với số tiết: 1-2 tiết chọn 1-2 nội dung, 3-6 tiết chọn 2-4 nội dung.

Lưu ý: Nếu một bài có số tiết thảo luận = 0 thì discussionTopics để mảng rỗng []. Tương tự nếu guidedStudyPeriods = 0 thì guidedStudyTopics = [], nếu selfStudyPeriods = 0 thì selfStudyTopics = [].`;

      const prompt = `Dưới đây là danh sách các bài học cần chọn lọc nội dung cho Thảo luận, Tự học có HD và Tự học:
${JSON.stringify(lessonsToCurate, null, 2)}

Hãy chọn lọc nội dung cho từng bài học theo yêu cầu và trả về mảng JSON các đối tượng [{ id, discussionTopics: [], guidedStudyTopics: [], selfStudyTopics: [] }].`;

      const geminiSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER, description: 'ID của bài học' },
            discussionTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Danh sách nội dung thảo luận được chọn lọc phù hợp số tiết TL',
            },
            guidedStudyTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Danh sách nội dung tự học có hướng dẫn phù hợp số tiết HD',
            },
            selfStudyTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Danh sách nội dung tự học phù hợp số tiết Tự học',
            },
          },
          required: ['id', 'discussionTopics', 'guidedStudyTopics', 'selfStudyTopics'],
        },
      };

      const responseText = await generateJsonWithProvider({
        provider,
        ollamaConfig,
        prompt,
        systemInstruction,
        geminiModel: 'gemini-3.8-flash',
        geminiSchema,
      });

      const parsedData = safeParseJson(responseText, []);
      return res.json({ success: true, curatedLessons: Array.isArray(parsedData) ? parsedData : [] });
    } catch (err: any) {
      console.error('Error curating lessons:', err);
      return res.status(500).json({
        error: err.message || 'Lỗi khi xử lý AI chọn lọc nội dung.',
      });
    }
  });

  // API endpoint for parsing arbitrary course structure tables from ANY Word document
  app.post('/api/ai/parse-custom-structure', async (req, res) => {
    try {
      const { tableHtml, rawText, provider, ollamaConfig } = req.body;
      if (!tableHtml && !rawText) {
        return res.status(400).json({ error: 'Nội dung bảng cấu trúc không được để trống.' });
      }

      const systemInstruction = `Bạn là chuyên gia trích xuất dữ liệu chương trình đào tạo đại học/cao đẳng tại Việt Nam.
Nhiệm vụ của bạn là đọc nội dung bảng Cấu trúc học phần bất kỳ (dù có bao nhiêu cột, tiêu đề cột viết tắt hay đầy đủ, thứ tự cột thế nào) và chuẩn hóa về danh sách bài học:
- id: số nguyên 1, 2, 3...
- stt: số thứ tự (ví dụ '1', '2', 'Bài 1')
- content: tên bài học (ví dụ: 'Bài 1: Khái niệm về phương pháp dạy học')
- topics: mảng các mục nội dung chi tiết trong bài (ví dụ: ['1.1 Khái niệm cơ bản', '1.2 Phân loại'])
- totalPeriods: tổng số tiết của bài học (nếu không ghi rõ thì tính tổng các tiết thành phần)
- theoryPeriods: số tiết lý thuyết (LT)
- discussionPeriods: số tiết thảo luận (TL)
- exercisePeriods: số tiết bài tập/thực hành (BT, TH)
- guidedStudyPeriods: số tiết tự học có hướng dẫn (Học có HD, HD)
- selfStudyPeriods: số tiết tự học (Tự học, TH)
- cdr: chuẩn đầu ra tương ứng (ví dụ 'CĐR 1', 'G1.1, G1.2', nếu không có để trống)
- assessment: bài kiểm tra, đánh giá tương ứng (ví dụ 'A1.1', 'ĐG quá trình', nếu không có để trống)
- materials: tài liệu tham khảo nếu có

Hãy trích xuất chính xác tất cả các bài học có trong bảng.`;

      const prompt = `Dưới đây là nội dung bảng Cấu trúc học phần bất kỳ được trích xuất từ file Word:
${(tableHtml || rawText || '').slice(0, 50000)}

Hãy phân tích và trả về mảng JSON các bài học CourseLesson.`;

      const geminiSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            stt: { type: Type.STRING },
            content: { type: Type.STRING },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            totalPeriods: { type: Type.INTEGER },
            theoryPeriods: { type: Type.INTEGER },
            discussionPeriods: { type: Type.INTEGER },
            exercisePeriods: { type: Type.INTEGER },
            guidedStudyPeriods: { type: Type.INTEGER },
            selfStudyPeriods: { type: Type.INTEGER },
            cdr: { type: Type.STRING },
            assessment: { type: Type.STRING },
            materials: { type: Type.STRING },
          },
          required: [
            'id',
            'stt',
            'content',
            'topics',
            'totalPeriods',
            'theoryPeriods',
            'discussionPeriods',
            'exercisePeriods',
            'guidedStudyPeriods',
            'selfStudyPeriods',
          ],
        },
      };

      const responseText = await generateJsonWithProvider({
        provider,
        ollamaConfig,
        prompt,
        systemInstruction,
        geminiModel: 'gemini-3.8-flash',
        geminiSchema,
      });

      const parsedLessons = safeParseJson(responseText, []);
      return res.json({ success: true, lessons: Array.isArray(parsedLessons) ? parsedLessons : [] });
    } catch (err: any) {
      console.error('Error parsing custom structure:', err);
      return res.status(500).json({ error: err.message || 'Lỗi khi AI phân tích cấu trúc bất kỳ.' });
    }
  });

  // API endpoint for analyzing ANY custom Teaching Plan template (.docx)
  app.post('/api/ai/analyze-template', async (req, res) => {
    try {
      const { templateHtml, rawText, provider, ollamaConfig } = req.body;
      if (!templateHtml && !rawText) {
        return res.status(400).json({ error: 'Nội dung file mẫu không được để trống.' });
      }

      const systemInstruction = `Bạn là chuyên gia phân tích biểu mẫu sư phạm tại Việt Nam.
Nhiệm vụ của bạn là phân tích file Word Mẫu kế hoạch phương pháp dạy học bất kỳ do người dùng cung cấp:
1. Xác định tiêu đề chính của mẫu (ví dụ: 'KẾ HOẠCH VÀ PHƯƠNG PHÁP DẠY HỌC', 'KẾ HOẠCH BÀI DẠY', 'KẾ HOẠCH GIẢNG DẠY THEO TIẾT'...)
2. Bảng có 2 hàng tiêu đề gộp ô (hasTwoHeaderRows) hay 1 hàng tiêu đề?
3. Kiểu thể hiện hoạt động dạy học (activityStyle):
   - 'split_teacher_student': Bảng có 2 cột riêng biệt cho 'Giảng viên' (hoặc Giáo viên) và 'Học viên' (hoặc Sinh viên / Học sinh).
   - 'combined_activities': Bảng có 1 cột gộp 'Hoạt động dạy học'.
   - 'section_by_period': Chia thành các phần theo hình thức Lý thuyết, Thảo luận, Tự học có HD, Tự học.
4. Cấu trúc danh sách các cột (columns):
   - id: định danh ngắn (ví dụ 'col_lesson', 'col_content', 'col_cdr', 'col_teacher', 'col_student', 'col_assessment')
   - header: tên tiêu đề ở hàng 1
   - subHeader: tên tiêu đề ở hàng 2 nếu là cột con
   - type: chọn 1 trong ['lesson', 'content', 'cdr', 'teacher_activity', 'student_activity', 'activities_combined', 'assessment', 'other']
   - widthPercent: ước lượng % độ rộng cột phù hợp (tổng các cột bằng 100%)
5. Ghi chú đặc biệt (specialNotes): cách bố cục hoặc lưu ý quan trọng.`;

      const prompt = `Dưới đây là nội dung biểu mẫu Kế hoạch dạy học bất kỳ từ file Word:
${(templateHtml || rawText || '').slice(0, 30000)}

Hãy phân tích và trả về đối tượng JSON cấu trúc mẫu.`;

      const geminiSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          hasTwoHeaderRows: { type: Type.BOOLEAN },
          activityStyle: {
            type: Type.STRING,
            description: 'split_teacher_student hoặc combined_activities hoặc section_by_period',
          },
          specialNotes: { type: Type.STRING },
          columns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                header: { type: Type.STRING },
                subHeader: { type: Type.STRING },
                type: { type: Type.STRING },
                widthPercent: { type: Type.INTEGER },
              },
              required: ['id', 'header', 'type', 'widthPercent'],
            },
          },
        },
        required: ['title', 'hasTwoHeaderRows', 'activityStyle', 'columns'],
      };

      const responseText = await generateJsonWithProvider({
        provider,
        ollamaConfig,
        prompt,
        systemInstruction,
        geminiModel: 'gemini-3.8-flash',
        geminiSchema,
      });

      const analysis = safeParseJson(responseText, {});
      return res.json({ success: true, analysis });
    } catch (err: any) {
      console.error('Error analyzing template:', err);
      return res.status(500).json({ error: err.message || 'Lỗi khi phân tích biểu mẫu bất kỳ.' });
    }
  });

  // In development, hook Vite dev server middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
