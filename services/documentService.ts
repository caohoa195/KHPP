import mammoth from 'mammoth';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  TextRun,
  BorderStyle,
  VerticalAlign,
  AlignmentType,
  VerticalMergeType,
} from 'docx';
import saveAs from 'file-saver';
import { 
  CourseLesson, 
  TeachingPlanTemplate, 
  CustomTemplateAnalysis, 
  AIProvider, 
  OllamaConfig 
} from '../types';

// Helper to check local Ollama connectivity and models
export const checkOllamaStatus = async (host = 'http://localhost:11434'): Promise<{ online: boolean; models?: string[]; error?: string }> => {
  try {
    const res = await fetch('/api/ollama/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host }),
    });
    if (!res.ok) {
      return { online: false, error: `Máy chủ phản hồi mã lỗi ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return { online: false, error: err.message || 'Không thể kết nối' };
  }
};

// --- PARSING LOGIC ---

// Helper to extract lines from a cell, handling mammoth's HTML output
const getCellLines = (cell: Element | undefined): string[] => {
  if (!cell) return [];
  
  // Try to find paragraphs first
  const ps = Array.from(cell.querySelectorAll('p'));
  if (ps.length > 0) {
    return ps.map(p => p.textContent?.trim() || '').filter(s => s);
  }
  
  // Fallback: split by newlines if textContent joins them (unlikely without separator in DOM)
  // or checks for br
  const clone = cell.cloneNode(true) as Element;
  const brs = clone.querySelectorAll('br');
  brs.forEach(br => br.replaceWith('\n'));
  
  return (clone.textContent?.trim() || '').split('\n').map(s => s.trim()).filter(s => s);
};

const getNum = (text: string | undefined) => {
    return parseInt(text?.trim() || '0', 10) || 0;
};

// Heuristic parser for standard tables
export const parseCourseStructureHeuristic = async (file: File): Promise<CourseLesson[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const parser = new DOMParser();
  const doc = parser.parseFromString(result.value, 'text/html');
  
  const tables = doc.querySelectorAll('table');
  let targetTable: HTMLTableElement | null = null;

  tables.forEach((table) => {
    const text = table.textContent || '';
    if (text.includes('Cấu trúc học phần') || text.includes('Nội dung') || text.includes('Tổng số tiết')) {
      targetTable = table;
    }
  });

  if (!targetTable) targetTable = tables[0];
  if (!targetTable) return [];

  const rows = Array.from(targetTable.querySelectorAll('tr'));
  const lessons: CourseLesson[] = [];
  let currentLesson: CourseLesson | null = null;

  for (let i = 0; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td'));
    if (cells.length < 5) continue; 

    const stt = cells[0]?.textContent?.trim() || '';
    const contentLines = getCellLines(cells[1]);
    const firstLineContent = contentLines[0] || '';
    
    // Check if this is a NEW main lesson
    const isLessonStart = (/^\d+$/.test(stt) && !stt.includes('.')) || firstLineContent.toLowerCase().startsWith('bài');

    if (isLessonStart) {
        if (currentLesson) {
            lessons.push(currentLesson);
        }

        const cellText = (idx: number) => cells[idx]?.textContent?.trim() || '';
        const assessmentLines = getCellLines(cells[11]); 

        currentLesson = {
            id: lessons.length + 1,
            stt: stt,
            content: firstLineContent, 
            topics: contentLines.length > 1 ? contentLines.slice(1) : [],
            cdr: getCellLines(cells[2]).join('\n'),
            assessment: assessmentLines.join('\n'),
            totalPeriods: getNum(cellText(3)),
            classPeriods: getNum(cellText(4)),
            theoryPeriods: getNum(cellText(5)),
            discussionPeriods: getNum(cellText(6)),
            practiceGroupPeriods: getNum(cellText(7)),
            practiceIndividualPeriods: getNum(cellText(8)),
            exercisePeriods: getNum(cellText(9)),
            guidedStudyPeriods: getNum(cellText(10)),
            selfStudyPeriods: getNum(cellText(12)),
            materials: cellText(13)
        };
    } else if (currentLesson) {
        if (contentLines.length > 0) {
            const formattedLines = contentLines.map((line, idx) => {
                if (idx === 0 && stt) {
                    const cleanStt = stt.replace(/\.$/, '');
                    if (!line.startsWith(cleanStt)) {
                        return `${stt}. ${line}`;
                    }
                }
                return line;
            });
            currentLesson.topics.push(...formattedLines);
        }
        const cdrLines = getCellLines(cells[2]);
        if (cdrLines.length > 0) {
             currentLesson.cdr += (currentLesson.cdr ? '\n' : '') + cdrLines.join('\n');
        }
        const assLines = getCellLines(cells[11]);
        if (assLines.length > 0) {
            currentLesson.assessment += (currentLesson.assessment ? '\n' : '') + assLines.join('\n');
        }
    }
  }

  if (currentLesson) {
      lessons.push(currentLesson);
  }

  return lessons;
};

// AI Parser for ANY arbitrary course structure table format (Gemini or Ollama)
export const parseCustomStructureWithAI = async (
  file: File, 
  provider?: AIProvider, 
  ollamaConfig?: OllamaConfig
): Promise<CourseLesson[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  
  const res = await fetch('/api/ai/parse-custom-structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableHtml: result.value,
      rawText: result.value.replace(/<[^>]+>/g, ' '),
      provider,
      ollamaConfig,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi máy chủ (${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !Array.isArray(data.lessons)) {
    throw new Error('Dữ liệu AI trích xuất không hợp lệ');
  }

  return data.lessons;
};

// Unified course structure parser: heuristic first, then AI fallback
export const parseCourseStructure = async (
  file: File, 
  provider?: AIProvider, 
  ollamaConfig?: OllamaConfig
): Promise<CourseLesson[]> => {
  try {
    const heuristicLessons = await parseCourseStructureHeuristic(file);
    if (heuristicLessons.length > 0) {
      return heuristicLessons;
    }
  } catch (err) {
    console.warn('Heuristic table parser found 0 lessons, switching to AI parser for custom structure...', err);
  }

  return await parseCustomStructureWithAI(file, provider, ollamaConfig);
};

// Analyze ANY custom template docx (Gemini or Ollama)
export const analyzeTemplateFile = async (
  file: File, 
  provider?: AIProvider, 
  ollamaConfig?: OllamaConfig
): Promise<CustomTemplateAnalysis> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const res = await fetch('/api/ai/analyze-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateHtml: result.value,
      rawText: result.value.replace(/<[^>]+>/g, ' '),
      provider,
      ollamaConfig,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi phân tích biểu mẫu (${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.analysis) {
    throw new Error('Không phân tích được biểu mẫu.');
  }

  return data.analysis;
};



// --- GENERATION LOGIC ---

const borderStyle = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "000000",
};

const borders = {
  top: borderStyle,
  bottom: borderStyle,
  left: borderStyle,
  right: borderStyle,
  insideHorizontal: borderStyle,
  insideVertical: borderStyle,
};

const pText = (text: string, bold = false, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) => {
  return new Paragraph({
    alignment: alignment,
    children: [new TextRun({ text, bold, font: "Times New Roman", size: 24 })],
    spacing: { after: 60, before: 60 },
  });
};

const formatLines = (lines: string[]) => {
    return lines.map(line => {
        // Bold if line starts with number + dot (e.g., "1.", "2.")
        const isHeader = /^\d+\./.test(line);
        return pText(line, isHeader);
    });
};

interface ActivityBlock {
    teacher: string[];
    student: string[];
}

interface SectionData {
    title: string;
    contentParas: Paragraph[];
    blocks: ActivityBlock[];
}

const getRomanNumeral = (num: number): string => {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return roman[num - 1] || `${num}`;
};

const formatTwoDigits = (num: number): string => {
  return num < 10 ? `0${num}` : `${num}`;
};

export const selectDefaultDiscussionTopics = (topics: string[], periods: number): string[] => {
  if (!topics || topics.length === 0) return ['Nội dung thảo luận trọng tâm theo đề cương'];
  const cleanTopics = topics
    .map(t => t.replace(/^(\d+(\.\d+)*\.?|[-+•])\s+/, '').trim())
    .filter(t => t.length > 0);
  
  if (cleanTopics.length === 0) return ['Nội dung thảo luận trọng tâm theo đề cương'];

  const targetCount = periods <= 1 ? Math.min(2, cleanTopics.length) : Math.min(periods + 1, cleanTopics.length, 4);
  const step = Math.max(1, Math.floor(cleanTopics.length / targetCount));
  const selected: string[] = [];
  for (let i = 0; i < cleanTopics.length && selected.length < targetCount; i += step) {
    selected.push(cleanTopics[i]);
  }
  return selected.length > 0 ? selected : cleanTopics.slice(0, targetCount);
};

export const selectDefaultGuidedTopics = (topics: string[], periods: number): string[] => {
  if (!topics || topics.length === 0) return ['Hướng dẫn ôn tập và thực hành các nội dung trọng tâm'];
  const cleanTopics = topics
    .map(t => t.replace(/^(\d+(\.\d+)*\.?|[-+•])\s+/, '').trim())
    .filter(t => t.length > 0);
  if (cleanTopics.length === 0) return ['Hướng dẫn ôn tập và thực hành các nội dung trọng tâm'];
  const targetCount = periods <= 1 ? Math.min(2, cleanTopics.length) : Math.min(periods + 1, cleanTopics.length, 3);
  return cleanTopics.slice(0, targetCount);
};

export const selectDefaultSelfTopics = (topics: string[], periods: number): string[] => {
  if (!topics || topics.length === 0) return ['Tự nghiên cứu giáo trình và tài liệu tham khảo theo yêu cầu'];
  const cleanTopics = topics
    .map(t => t.replace(/^(\d+(\.\d+)*\.?|[-+•])\s+/, '').trim())
    .filter(t => t.length > 0);
  if (cleanTopics.length === 0) return ['Tự nghiên cứu giáo trình và tài liệu tham khảo theo yêu cầu'];
  const targetCount = periods <= 1 ? Math.min(2, cleanTopics.length) : Math.min(periods + 1, cleanTopics.length, 4);
  return cleanTopics.slice(0, targetCount);
};

export const curateLessonsWithAI = async (
  lessons: CourseLesson[],
  provider?: AIProvider,
  ollamaConfig?: OllamaConfig
): Promise<CourseLesson[]> => {
  try {
    const res = await fetch('/api/ai/curate-lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons, provider, ollamaConfig }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Lỗi máy chủ (${res.status})`);
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.curatedLessons)) {
      throw new Error('Dữ liệu AI trả về không đúng định dạng');
    }

    const curatedMap = new Map<number, {
      discussionTopics?: string[];
      guidedStudyTopics?: string[];
      selfStudyTopics?: string[];
    }>();

    data.curatedLessons.forEach((item: any) => {
      if (item && typeof item.id === 'number') {
        curatedMap.set(item.id, {
          discussionTopics: Array.isArray(item.discussionTopics) ? item.discussionTopics : [],
          guidedStudyTopics: Array.isArray(item.guidedStudyTopics) ? item.guidedStudyTopics : [],
          selfStudyTopics: Array.isArray(item.selfStudyTopics) ? item.selfStudyTopics : [],
        });
      }
    });

    return lessons.map((lesson) => {
      const curated = curatedMap.get(lesson.id);
      return {
        ...lesson,
        discussionTopics: curated?.discussionTopics && curated.discussionTopics.length > 0
          ? curated.discussionTopics
          : selectDefaultDiscussionTopics(lesson.topics, lesson.discussionPeriods),
        guidedStudyTopics: curated?.guidedStudyTopics && curated.guidedStudyTopics.length > 0
          ? curated.guidedStudyTopics
          : selectDefaultGuidedTopics(lesson.topics, lesson.guidedStudyPeriods),
        selfStudyTopics: curated?.selfStudyTopics && curated.selfStudyTopics.length > 0
          ? curated.selfStudyTopics
          : selectDefaultSelfTopics(lesson.topics, lesson.selfStudyPeriods),
        aiCurated: true,
      };
    });
  } catch (err) {
    console.warn('AI curation error, falling back to smart heuristic selection:', err);
    return lessons.map((lesson) => ({
      ...lesson,
      discussionTopics: selectDefaultDiscussionTopics(lesson.topics, lesson.discussionPeriods),
      guidedStudyTopics: selectDefaultGuidedTopics(lesson.topics, lesson.guidedStudyPeriods),
      selfStudyTopics: selectDefaultSelfTopics(lesson.topics, lesson.selfStudyPeriods),
      aiCurated: false,
    }));
  }
};

// Helper: Build structured section data for a lesson with AI-curated topics
export const buildLessonSections = (lesson: CourseLesson): SectionData[] => {
  const sections: SectionData[] = [];
  let sectionCounter = 1;

  // Helper: Get strictly numbered list (1., 2., 3.) for activities
  const getNumberedList = (sourceTopics: string[], limit?: number) => {
    let list = sourceTopics;
    if (list.length === 0) return [pText("1. Nội dung theo đề cương")];
    if (limit && limit > 0) list = list.slice(0, limit);
    return list.map((t, i) => {
      const cleanText = t.replace(/^(\d+(\.\d+)*\.?|[-+•])\s+/, '').trim();
      return pText(`${i + 1}. ${cleanText || t}`);
    });
  };

  const getAllTopics = () => {
    if (lesson.topics.length === 0) return [pText("Nội dung chi tiết theo đề cương")];
    return lesson.topics.map(t => pText(t));
  };

  // 1. THEORY
  if (lesson.theoryPeriods > 0) {
    sections.push({
      title: `${getRomanNumeral(sectionCounter++)}. LÝ THUYẾT: ${formatTwoDigits(lesson.theoryPeriods)} tiết`,
      contentParas: getAllTopics(),
      blocks: [
        {
          teacher: ["1. Hình thức", "Tổ chức dạy học lý thuyết theo đội hình cả lớp"],
          student: ["Ghi nội dung tương ứng với hoạt động của giáo viên"]
        },
        {
          teacher: [
            "2. Phương pháp",
            "- Thuyết trình các khái niệm cơ bản",
            "- Đàm thoại",
            "+ Đưa ra các câu hỏi",
            "+ Giải đáp câu hỏi dựa trên câu trả lời của học viên"
          ],
          student: ["- Lắng nghe, ghi chép", "- Trao đổi, trả lời câu hỏi của GV"]
        },
        {
          teacher: [
            "3. Định hướng nội dung tự học",
            "- Xem lại các nội dung lý thuyết của bài học",
            "- Giải các bài tập"
          ],
          student: ["- Sử dụng giáo trình, bài giảng điện tử, vở ghi.", "- Làm các bài tập theo yêu cầu của GV"]
        }
      ]
    });
  }

  // 2. DISCUSSION
  if (lesson.discussionPeriods > 0) {
    const discussionItems = (lesson.discussionTopics && lesson.discussionTopics.length > 0)
      ? lesson.discussionTopics
      : selectDefaultDiscussionTopics(lesson.topics, lesson.discussionPeriods);

    sections.push({
      title: `${getRomanNumeral(sectionCounter++)}. THẢO LUẬN: ${formatTwoDigits(lesson.discussionPeriods)} tiết`,
      contentParas: [pText("Thảo luận các nội dung:"), ...getNumberedList(discussionItems)],
      blocks: [
        {
          teacher: ["1. Hình thức", "Duy trì theo khối lớp, phân chia nhóm khi thực hiện các nội dung"],
          student: ["Ghi nội dung tương ứng với hoạt động của giáo viên"]
        },
        {
          teacher: [
            "2. Phương pháp",
            "- Yêu cầu HV nghiên cứu nội dung cần thảo luận, những vấn đề trọng tâm.",
            "- Yêu cầu HV trả lời kết quả.",
            "- Kết luận nội dung"
          ],
          student: ["- Tiếp nhận yêu cầu.", "- Trao đổi, trả lời theo yêu cầu của GV", "- Ghi chép"]
        }
      ]
    });
  }

  // 3. EXERCISE (BÀI TẬP)
  if (lesson.exercisePeriods > 0) {
    sections.push({
      title: `${getRomanNumeral(sectionCounter++)}. BÀI TẬP: ${formatTwoDigits(lesson.exercisePeriods)} tiết`,
      contentParas: [pText("Thực hành giải bài tập các nội dung:"), ...getNumberedList(lesson.topics, 4)],
      blocks: [
        {
          teacher: ["1. Hình thức:", "Cả lớp (làm bài cá nhân hoặc theo nhóm)."],
          student: ["Theo điều hành của giáo viên."]
        },
        {
          teacher: [
            "2. Phương pháp:",
            "- Hướng dẫn giải: Giáo viên hướng dẫn chi tiết phương pháp xác định, giải quyết bài toán.",
            "- Theo dõi HV làm bài, nhắc lại lý thuyết nếu cần thiết; Trả lời những nội dung HV thắc mắc."
          ],
          student: ["- Chủ động áp dụng lý thuyết để giải quyết bài tập.", "- Đề nghị GV làm rõ những nội dung chưa hiểu."]
        }
      ]
    });
  }

  // 4. GUIDED STUDY
  if (lesson.guidedStudyPeriods > 0) {
    const guidedItems = (lesson.guidedStudyTopics && lesson.guidedStudyTopics.length > 0)
      ? lesson.guidedStudyTopics
      : selectDefaultGuidedTopics(lesson.topics, lesson.guidedStudyPeriods);

    sections.push({
      title: `${getRomanNumeral(sectionCounter++)}. TỰ HỌC CÓ HD: ${formatTwoDigits(lesson.guidedStudyPeriods)} tiết`,
      contentParas: [pText("Nội dung tự học có hướng dẫn:"), ...getNumberedList(guidedItems)],
      blocks: [
        {
          teacher: ["1. Hình thức", "Duy trì theo khối lớp, phân chia nhóm khi thực hiện các nội dung"],
          student: ["Thực hiện theo yêu cầu của GV."]
        },
        {
          teacher: [
            "2. Phương pháp",
            "- Duy trì nề nếp trong tự học",
            "- Bồi dưỡng, giúp đỡ học viên trong thực hành giải bài tập",
            "- Yêu cầu GV làm rõ những nội dung chưa hiểu và giải đáp các thắc mắc"
          ],
          student: ["- Chấp hành nề nếp", "- Yêu cầu GV làm rõ những nội dung chưa hiểu và giải đáp các thắc mắc"]
        }
      ]
    });
  }

  // 5. SELF STUDY
  if (lesson.selfStudyPeriods > 0) {
    const selfItems = (lesson.selfStudyTopics && lesson.selfStudyTopics.length > 0)
      ? lesson.selfStudyTopics
      : selectDefaultSelfTopics(lesson.topics, lesson.selfStudyPeriods);

    sections.push({
      title: `${getRomanNumeral(sectionCounter++)}. TỰ HỌC: ${formatTwoDigits(lesson.selfStudyPeriods)} tiết`,
      contentParas: [pText("Nội dung tự học:"), ...getNumberedList(selfItems)],
      blocks: [
        {
          teacher: ["1. Hình thức", "Tổ chức tự học theo lớp đơn hoặc lớp ghép"],
          student: ["Thực hiện theo yêu cầu của GV."]
        },
        {
          teacher: [
            "2. Phương pháp",
            "- Cán bộ quản lý đơn vị kết hợp tổ học phụ triển khai nội dung tự học.",
            "- Cán bộ phụ trách lớp duy trì tổ học phụ hoạt động, trao đổi, làm rõ hơn các nội dung."
          ],
          student: [
            "- Tự học các nội dung được lớp và tổ học phụ triển khai.",
            "- Thảo luận, ghi chép các nội dung quan trọng theo ý hiểu của bản thân."
          ]
        }
      ]
    });
  }

  return sections;
};

// 1. MẪU F (CHUẨN GỐC HIỆN HÀNH) - GIỮ NGUYÊN BẢN
export const generateTeachingPlanStandard = async (lessons: CourseLesson[]) => {
  const tableRows: TableRow[] = [];

  lessons.forEach((lesson) => {
    const sections = buildLessonSections(lesson);
    const totalLessonRows = sections.reduce((acc, sec) => acc + Math.max(sec.blocks.length, 1), 0);
    if (totalLessonRows === 0) return;

    let lessonRowIndex = 0;

    sections.forEach((section) => {
      const sectionRowsCount = Math.max(section.blocks.length, 1);
      
      for (let i = 0; i < sectionRowsCount; i++) {
        const block = section.blocks[i] || { teacher: [], student: [] };
        const isFirstRowOfLesson = (lessonRowIndex === 0);
        const isFirstRowOfSection = (i === 0);
        const cells: TableCell[] = [];

        // Col 1: Lesson Name (Merged)
        if (isFirstRowOfLesson) {
          cells.push(new TableCell({
            children: [pText(`${lesson.content}\n(${formatTwoDigits(lesson.totalPeriods)})`, true, AlignmentType.CENTER)],
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({
            children: [],
            verticalMerge: VerticalMergeType.CONTINUE,
            borders: borders,
          }));
        }

        // Col 2: Content (Merged per section)
        if (isFirstRowOfSection) {
          const contentTitle = pText(section.title, true);
          const contentBody = section.contentParas || [];
          cells.push(new TableCell({
            children: [contentTitle, ...contentBody],
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.TOP,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({
            children: [],
            verticalMerge: VerticalMergeType.CONTINUE,
            borders: borders,
          }));
        }

        // Col 3: CDR (Merged)
        if (isFirstRowOfLesson) {
          const cdrLines = lesson.cdr ? lesson.cdr.split('\n') : ["-"];
          cells.push(new TableCell({
            children: cdrLines.map(c => pText(c, false, AlignmentType.CENTER)),
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({
            children: [],
            verticalMerge: VerticalMergeType.CONTINUE,
            borders: borders,
          }));
        }

        // Col 4: Teacher Activity
        cells.push(new TableCell({
          children: formatLines(block.teacher),
          borders: borders,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.TOP,
        }));

        // Col 5: Student Activity
        cells.push(new TableCell({
          children: formatLines(block.student),
          borders: borders,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.TOP,
        }));

        // Col 6: Assessment (Merged)
        if (isFirstRowOfLesson) {
          const assLines = lesson.assessment ? lesson.assessment.split('\n') : [""];
          cells.push(new TableCell({
            children: assLines.map(c => pText(c, false, AlignmentType.CENTER)),
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({
            children: [],
            verticalMerge: VerticalMergeType.CONTINUE,
            borders: borders,
          }));
        }

        tableRows.push(new TableRow({ children: cells }));
        lessonRowIndex++;
      }
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "F. KẾ HOẠCH VÀ PHƯƠNG PHÁP DẠY HỌC",
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [pText("Bài\n(số tiết)", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [pText("Nội dung", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [pText("CĐR", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [pText("Hoạt động dạy và học", true, AlignmentType.CENTER)], columnSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [pText("Bài\nKT, ĐG", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [pText("Giảng viên", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [pText("Học viên", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                ]
              }),
              ...tableRows
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borders,
          })
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Ke_hoach_day_hoc_Mau_F.docx");
};

// 2. MẪU 4 CỘT CHUẨN PHÁT TRIỂN NĂNG LỰC
export const generateTeachingPlan4Col = async (lessons: CourseLesson[]) => {
  const tableRows: TableRow[] = [];

  lessons.forEach((lesson) => {
    const sections = buildLessonSections(lesson);
    const totalLessonRows = sections.reduce((acc, sec) => acc + Math.max(sec.blocks.length, 1), 0);
    if (totalLessonRows === 0) return;

    let lessonRowIndex = 0;
    sections.forEach((section) => {
      const sectionRowsCount = Math.max(section.blocks.length, 1);
      for (let i = 0; i < sectionRowsCount; i++) {
        const block = section.blocks[i] || { teacher: [], student: [] };
        const isFirstRowOfLesson = (lessonRowIndex === 0);
        const isFirstRowOfSection = (i === 0);
        const cells: TableCell[] = [];

        // Col 1: Bài học & Nội dung (Merged per section)
        if (isFirstRowOfSection) {
          const lessonHead = isFirstRowOfLesson ? [pText(`${lesson.content} (${formatTwoDigits(lesson.totalPeriods)} tiết)`, true)] : [];
          cells.push(new TableCell({
            children: [...lessonHead, pText(section.title, true), ...(section.contentParas || [])],
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.TOP,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        // Col 2: CĐR
        if (isFirstRowOfLesson) {
          const cdrLines = lesson.cdr ? lesson.cdr.split('\n') : ['-'];
          cells.push(new TableCell({
            children: cdrLines.map(c => pText(c, false, AlignmentType.CENTER)),
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        // Col 3: GV Activity
        cells.push(new TableCell({
          children: formatLines(block.teacher),
          borders: borders,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.TOP,
        }));

        // Col 4: SV Activity
        cells.push(new TableCell({
          children: formatLines(block.student),
          borders: borders,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.TOP,
        }));

        // Col 5: Assessment
        if (isFirstRowOfLesson) {
          const assLines = lesson.assessment ? lesson.assessment.split('\n') : [''];
          cells.push(new TableCell({
            children: assLines.map(c => pText(c, false, AlignmentType.CENTER)),
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        tableRows.push(new TableRow({ children: cells }));
        lessonRowIndex++;
      }
    });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "KẾ HOẠCH BÀI DẠY (ĐỊNH HƯỚNG PHÁT TRIỂN NĂNG LỰC)", bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [pText("Bài học & Nội dung", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("CĐR học phần", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("Hoạt động dạy và học", true, AlignmentType.CENTER)], columnSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("Kiểm tra, đánh giá", true, AlignmentType.CENTER)], rowSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [pText("Giảng viên", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("Học viên", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
              ]
            }),
            ...tableRows
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: borders,
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Ke_hoach_bai_day_4_cot.docx");
};

// 3. MẪU AUN-QA (ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN THEO TUẦN)
export const generateTeachingPlanAunQa = async (lessons: CourseLesson[]) => {
  const tableRows: TableRow[] = [];

  lessons.forEach((lesson, lIdx) => {
    const sections = buildLessonSections(lesson);
    const totalLessonRows = sections.reduce((acc, sec) => acc + Math.max(sec.blocks.length, 1), 0);
    if (totalLessonRows === 0) return;

    let lessonRowIndex = 0;
    sections.forEach((section) => {
      const sectionRowsCount = Math.max(section.blocks.length, 1);
      for (let i = 0; i < sectionRowsCount; i++) {
        const block = section.blocks[i] || { teacher: [], student: [] };
        const isFirstRowOfLesson = (lessonRowIndex === 0);
        const isFirstRowOfSection = (i === 0);
        const cells: TableCell[] = [];

        // Col 1: Tuần / Buổi
        if (isFirstRowOfLesson) {
          cells.push(new TableCell({
            children: [pText(`Tuần ${lIdx + 1}\n(${lesson.totalPeriods} tiết)`, true, AlignmentType.CENTER)],
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        // Col 2: Nội dung chi tiết
        if (isFirstRowOfSection) {
          const lessonHead = isFirstRowOfLesson ? [pText(`${lesson.content}`, true)] : [];
          cells.push(new TableCell({
            children: [...lessonHead, pText(section.title, true), ...(section.contentParas || [])],
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.TOP,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        // Col 3: CĐR học phần (CLO)
        if (isFirstRowOfLesson) {
          const cdrLines = lesson.cdr ? lesson.cdr.split('\n') : ['-'];
          cells.push(new TableCell({
            children: cdrLines.map(c => pText(c, false, AlignmentType.CENTER)),
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        // Col 4: Hoạt động dạy - học kết hợp
        const combinedActivities = [
          ...block.teacher.map(t => `GV: ${t}`),
          ...block.student.map(s => `HV: ${s}`)
        ];
        cells.push(new TableCell({
          children: formatLines(combinedActivities),
          borders: borders,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.TOP,
        }));

        // Col 5: Đánh giá
        if (isFirstRowOfLesson) {
          const assLines = lesson.assessment ? lesson.assessment.split('\n') : ['ĐG quá trình'];
          cells.push(new TableCell({
            children: assLines.map(c => pText(c, false, AlignmentType.CENTER)),
            verticalMerge: VerticalMergeType.RESTART,
            verticalAlign: VerticalAlign.CENTER,
            borders: borders,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }));
        } else {
          cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
        }

        tableRows.push(new TableRow({ children: cells }));
        lessonRowIndex++;
      }
    });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "KẾ HOẠCH GIẢNG DẠY HỌC PHẦN (CHUẨN KIỂM ĐỊNH AUN-QA)", bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [pText("Tuần\n(số tiết)", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("Nội dung giảng dạy", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("CĐR học phần\n(CLOs)", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("Hoạt động dạy và học\n(Trên lớp & Tự học)", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                new TableCell({ children: [pText("Phương pháp\nđánh giá", true, AlignmentType.CENTER)], verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
              ]
            }),
            ...tableRows
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: borders,
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Ke_hoach_giang_day_AUN_QA.docx");
};

// 4. MẪU TÙY BIẾN THEO FILE MẪU BẤT KỲ CỦA NGƯỜI DÙNG
export const generateTeachingPlanCustom = async (lessons: CourseLesson[], analysis: CustomTemplateAnalysis) => {
  const tableRows: TableRow[] = [];
  const cols = analysis.columns || [];

  lessons.forEach((lesson) => {
    const sections = buildLessonSections(lesson);
    const totalLessonRows = sections.reduce((acc, sec) => acc + Math.max(sec.blocks.length, 1), 0);
    if (totalLessonRows === 0) return;

    let lessonRowIndex = 0;
    sections.forEach((section) => {
      const sectionRowsCount = Math.max(section.blocks.length, 1);
      for (let i = 0; i < sectionRowsCount; i++) {
        const block = section.blocks[i] || { teacher: [], student: [] };
        const isFirstRowOfLesson = (lessonRowIndex === 0);
        const isFirstRowOfSection = (i === 0);
        const cells: TableCell[] = [];

        cols.forEach((col) => {
          switch (col.type) {
            case 'lesson':
              if (isFirstRowOfLesson) {
                cells.push(new TableCell({
                  children: [pText(`${lesson.content}\n(${formatTwoDigits(lesson.totalPeriods)} tiết)`, true, AlignmentType.CENTER)],
                  verticalMerge: VerticalMergeType.RESTART,
                  verticalAlign: VerticalAlign.CENTER,
                  borders: borders,
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
              } else {
                cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
              }
              break;

            case 'content':
              if (isFirstRowOfSection) {
                cells.push(new TableCell({
                  children: [pText(section.title, true), ...(section.contentParas || [])],
                  verticalMerge: VerticalMergeType.RESTART,
                  verticalAlign: VerticalAlign.TOP,
                  borders: borders,
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
              } else {
                cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
              }
              break;

            case 'cdr':
              if (isFirstRowOfLesson) {
                const cdrLines = lesson.cdr ? lesson.cdr.split('\n') : ['-'];
                cells.push(new TableCell({
                  children: cdrLines.map(c => pText(c, false, AlignmentType.CENTER)),
                  verticalMerge: VerticalMergeType.RESTART,
                  verticalAlign: VerticalAlign.CENTER,
                  borders: borders,
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
              } else {
                cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
              }
              break;

            case 'teacher_activity':
              cells.push(new TableCell({
                children: formatLines(block.teacher),
                borders: borders,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                verticalAlign: VerticalAlign.TOP,
              }));
              break;

            case 'student_activity':
              cells.push(new TableCell({
                children: formatLines(block.student),
                borders: borders,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                verticalAlign: VerticalAlign.TOP,
              }));
              break;

            case 'activities_combined':
              cells.push(new TableCell({
                children: formatLines([...block.teacher, ...block.student]),
                borders: borders,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                verticalAlign: VerticalAlign.TOP,
              }));
              break;

            case 'assessment':
              if (isFirstRowOfLesson) {
                const assLines = lesson.assessment ? lesson.assessment.split('\n') : [''];
                cells.push(new TableCell({
                  children: assLines.map(c => pText(c, false, AlignmentType.CENTER)),
                  verticalMerge: VerticalMergeType.RESTART,
                  verticalAlign: VerticalAlign.CENTER,
                  borders: borders,
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
              } else {
                cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, borders: borders }));
              }
              break;

            default:
              cells.push(new TableCell({
                children: [pText('-')],
                borders: borders,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
              }));
              break;
          }
        });

        tableRows.push(new TableRow({ children: cells }));
        lessonRowIndex++;
      }
    });
  });

  // Header row
  const headerCells = cols.map(c => new TableCell({
    children: [pText(c.header, true, AlignmentType.CENTER)],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: analysis.title || "KẾ HOẠCH VÀ PHƯƠNG PHÁP DẠY HỌC", bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Table({
          rows: [
            new TableRow({ children: headerCells }),
            ...tableRows
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: borders,
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Ke_hoach_day_hoc_Theo_Mau_Tai_Len.docx");
};

// Main dispatcher
export const generateTeachingPlan = async (lessons: CourseLesson[], template?: TeachingPlanTemplate) => {
  if (!template || template.id === 'mau-f-standard') {
    return await generateTeachingPlanStandard(lessons);
  }
  if (template.id === 'mau-4-cot') {
    return await generateTeachingPlan4Col(lessons);
  }
  if (template.id === 'mau-aun-qa') {
    return await generateTeachingPlanAunQa(lessons);
  }
  if (template.isCustomUpload && template.analysis) {
    return await generateTeachingPlanCustom(lessons, template.analysis);
  }
  return await generateTeachingPlanStandard(lessons);
};