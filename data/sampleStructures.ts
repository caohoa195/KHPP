import { CourseLesson, TeachingPlanTemplate, OllamaModelOption } from '../types';

export interface SampleCourseStructure {
  id: string;
  name: string;
  code: string;
  credits: number;
  description: string;
  lessons: CourseLesson[];
}

export const SAMPLE_STRUCTURES: SampleCourseStructure[] = [
  {
    id: 'ppdh-dai-hoc',
    name: 'Phương pháp dạy học đại học',
    code: 'EDU301',
    credits: 3,
    description: 'Chương trình chuẩn đào tạo nghiệp vụ sư phạm đại học (45 tiết)',
    lessons: [
      {
        id: 1,
        stt: '1',
        content: 'Bài 1: Bản chất và đặc điểm của quá trình dạy học đại học',
        topics: [
          '1.1. Khái niệm và bản chất quá trình dạy học đại học',
          '1.2. Mối quan hệ biện chứng giữa hoạt động dạy và hoạt động học',
          '1.3. Đặc điểm tâm lý và phong cách học tập của sinh viên',
          '1.4. Xu thế đổi mới phương pháp dạy học đại học trong kỷ nguyên số'
        ],
        cdr: 'G1.1: Phân tích được bản chất và quy luật quá trình dạy học đại học\nG1.2: Vận dụng đặc điểm người học vào thiết kế bài giảng',
        assessment: 'A1.1: Đánh giá quá trình (chuyên cần, phát biểu)',
        totalPeriods: 8,
        classPeriods: 4,
        theoryPeriods: 3,
        discussionPeriods: 1,
        practiceGroupPeriods: 0,
        practiceIndividualPeriods: 0,
        exercisePeriods: 0,
        guidedStudyPeriods: 2,
        selfStudyPeriods: 2,
        materials: 'Giáo trình Giáo dục học đại học (NXB ĐHQG), Tài liệu tập huấn PPDH',
        discussionTopics: [
          'Thảo luận: Phân tích sự chuyển dịch từ dạy học truyền thống lấy người dạy làm trung tâm sang dạy học tích cực lấy người học làm trung tâm trong giáo dục đại học.'
        ],
        guidedStudyTopics: [
          'Phân tích ma trận phong cách học tập của David Kolb và đề xuất giải pháp sư phạm tương ứng.',
          'Hệ thống hóa các quy luật cơ bản của quá trình dạy học đại học vào sơ đồ tư duy.'
        ],
        selfStudyTopics: [
          'Nghiên cứu tài liệu tham khảo: Chiến lược phát triển giáo dục đại học Việt Nam đến 2030.',
          'Viết bài thu hoạch cá nhân về vai trò của chuyển đổi số trong giáo dục đại học.'
        ],
        aiCurated: true
      },
      {
        id: 2,
        stt: '2',
        content: 'Bài 2: Các phương pháp dạy học tích cực trong giáo dục đại học',
        topics: [
          '2.1. Dạy học giải quyết vấn đề (Problem-Based Learning - PBL)',
          '2.2. Dạy học theo dự án (Project-Based Learning)',
          '2.3. Phương pháp nghiên cứu trường hợp (Case Study)',
          '2.4. Phương pháp đóng vai và mô phỏng sư phạm',
          '2.5. Kỹ thuật tổ chức thảo luận nhóm và tranh biện khoa học'
        ],
        cdr: 'G2.1: Thiết kế được kịch bản dạy học tích cực theo môn học phụ trách\nG2.2: Làm chủ kỹ năng điều phối thảo luận và giải quyết tình huống sư phạm',
        assessment: 'A1.2: Đánh giá bài tập nhóm và báo cáo Case Study',
        totalPeriods: 12,
        classPeriods: 6,
        theoryPeriods: 3,
        discussionPeriods: 2,
        practiceGroupPeriods: 0,
        practiceIndividualPeriods: 0,
        exercisePeriods: 1,
        guidedStudyPeriods: 3,
        selfStudyPeriods: 3,
        materials: 'Cẩm nang Phương pháp dạy học đại học hiện đại',
        discussionTopics: [
          'Chủ đề 1: So sánh ưu - nhược điểm và điều kiện áp dụng của mô hình Dạy học giải quyết vấn đề (PBL) so với Dạy học theo dự án.',
          'Chủ đề 2: Xử lý tình huống sư phạm khi sinh viên thụ động, không tham gia thảo luận nhóm trong giờ học trực tuyến/trực tiếp.'
        ],
        guidedStudyTopics: [
          'Hướng dẫn biên soạn tình huống (Case Study) sư phạm thực tiễn gắn với chuyên ngành giảng dạy.',
          'Thiết kế thang rubric đánh giá hoạt động thảo luận nhóm của sinh viên.'
        ],
        selfStudyTopics: [
          'Đọc chương 4 - Sách Kỹ thuật dạy học tích cực (Bernd Meier & Nguyễn Văn Cường).',
          'Sưu tầm và phân tích 02 bài giảng minh họa sử dụng phương pháp Case Study tại các đại học tiên tiến.'
        ],
        aiCurated: true
      },
      {
        id: 3,
        stt: '3',
        content: 'Bài 3: Thiết kế kế hoạch bài dạy và ma trận mục tiêu Bloom',
        topics: [
          '3.1. Các bước thiết kế kế hoạch dạy học theo chuẩn đầu ra (Outcome-Based Education)',
          '3.2. Vận dụng thang đo nhận thức Bloom cải biên trong xác định mục tiêu',
          '3.3. Xây dựng kế hoạch dạy học chi tiết (Lesson Plan)',
          '3.4. Ứng dụng công nghệ thông tin và AI trong hỗ trợ soạn giảng'
        ],
        cdr: 'G3.1: Soạn thảo hoàn chỉnh một kế hoạch bài dạy đúng quy định\nG3.2: Tích hợp công nghệ và AI vào hoạt động dạy học hiệu quả',
        assessment: 'A2.1: Bài kiểm tra giữa kỳ (Kế hoạch bài dạy)',
        totalPeriods: 10,
        classPeriods: 5,
        theoryPeriods: 3,
        discussionPeriods: 1,
        practiceGroupPeriods: 0,
        practiceIndividualPeriods: 0,
        exercisePeriods: 1,
        guidedStudyPeriods: 2,
        selfStudyPeriods: 3,
        materials: 'Quy định thiết kế đề cương và kế hoạch bài giảng của Bộ GD&ĐT',
        discussionTopics: [
          'Thảo luận: Nguyên tắc tích hợp các công cụ AI tạo sinh (như Gemini, ChatGPT) trong soạn giáo án và kiểm soát đạo văn học thuật.'
        ],
        guidedStudyTopics: [
          'Thực hành chuẩn hóa động từ hành vi theo thang đo Bloom cho các bài giảng chuyên ngành.',
          'Hoàn thiện khung kế hoạch bài dạy 5 bước theo biểu mẫu quy định.'
        ],
        selfStudyTopics: [
          'Tự nghiên cứu các mẫu kế hoạch bài dạy đạt chuẩn kiểm định AUN-QA.',
          'Chuẩn bị slide bài giảng tương ứng với kế hoạch bài dạy đã xây dựng.'
        ],
        aiCurated: true
      },
      {
        id: 4,
        stt: '4',
        content: 'Bài 4: Kiểm tra, đánh giá kết quả học tập theo tiếp cận năng lực',
        topics: [
          '4.1. Khái niệm và chức năng của kiểm tra, đánh giá trong giáo dục đại học',
          '4.2. Đánh giá quá trình (Formative) và đánh giá tổng kết (Summative)',
          '4.3. Kỹ thuật biên soạn câu hỏi trắc nghiệm khách quan và tự luận định hướng năng lực',
          '4.4. Xây dựng tiêu chí và bảng kiểm rubric đánh giá năng lực'
        ],
        cdr: 'G4.1: Thiết kế ma trận đề thi và bảng kiểm rubric theo CĐR\nG4.2: Phân tích kết quả đánh giá để cải tiến liên tục chất lượng giảng dạy',
        assessment: 'A2.2: Bài thi kết thúc học phần',
        totalPeriods: 15,
        classPeriods: 7,
        theoryPeriods: 4,
        discussionPeriods: 2,
        practiceGroupPeriods: 0,
        practiceIndividualPeriods: 0,
        exercisePeriods: 1,
        guidedStudyPeriods: 4,
        selfStudyPeriods: 4,
        materials: 'Kiểm tra đánh giá trong giáo dục đại học (NXB Giáo Dục)',
        discussionTopics: [
          'Chủ đề 1: Đánh giá xác thực (Authentic Assessment) và xu hướng thay thế thi viết truyền thống bằng bài tập lớn/portfolio.',
          'Chủ đề 2: Các thách thức và giải pháp đảm bảo tính khách quan, công bằng khi sinh viên sử dụng AI trong bài kiểm tra.'
        ],
        guidedStudyTopics: [
          'Hướng dẫn xây dựng rubric phân tích (Analytic Rubric) 4 mức độ cho bài tập nhóm.',
          'Kỹ thuật xây dựng ma trận và bản đặc tả đề thi kết thúc học phần.'
        ],
        selfStudyTopics: [
          'Đọc tài liệu về đo lường chuẩn đầu ra cấp độ môn học (Course Learning Outcomes).',
          'Rà soát và tinh chỉnh ngân hàng câu hỏi đánh giá thường xuyên của học phần.'
        ],
        aiCurated: true
      }
    ]
  },
  {
    id: 'ai-digital-pedagogy',
    name: 'Trí tuệ nhân tạo & Sư phạm số',
    code: 'IT402',
    credits: 2,
    description: 'Chương trình ứng dụng AI và công nghệ số trong đổi mới giảng dạy (30 tiết)',
    lessons: [
      {
        id: 1,
        stt: '1',
        content: 'Bài 1: Tổng quan về AI tạo sinh và Chuyển đổi số trong Giáo dục',
        topics: [
          '1.1. Các mô hình AI ngôn ngữ lớn (LLM) và ứng dụng sư phạm',
          '1.2. Đạo đức AI, bản quyền và liêm chính học thuật',
          '1.3. Khung năng lực số cho giảng viên đại học'
        ],
        cdr: 'G1: Hiểu và ứng dụng an toàn các công cụ AI trong giáo dục',
        assessment: 'A1.1: Đánh giá thảo luận và phản xạ sư phạm',
        totalPeriods: 10,
        classPeriods: 4,
        theoryPeriods: 2,
        discussionPeriods: 1,
        practiceGroupPeriods: 0,
        practiceIndividualPeriods: 0,
        exercisePeriods: 1,
        guidedStudyPeriods: 2,
        selfStudyPeriods: 4,
        materials: 'UNESCO AI Competency Framework for Teachers',
        discussionTopics: [
          'Thảo luận: Ranh giới giữa hỗ trợ học tập và vi phạm liêm chính học thuật khi sinh viên dùng AI trong làm bài tập.'
        ],
        guidedStudyTopics: [
          'Thực hành thiết lập quy định sử dụng AI rõ ràng trong đề cương học phần.'
        ],
        selfStudyTopics: [
          'Nghiên cứu tài liệu hướng dẫn của UNESCO về đạo đức AI trong giáo dục.'
        ],
        aiCurated: true
      },
      {
        id: 2,
        stt: '2',
        content: 'Bài 2: Kỹ nghệ Prompt và Thiết kế học liệu đa phương tiện bằng AI',
        topics: [
          '2.1. Kỹ năng thiết kế câu lệnh sư phạm (Prompt Engineering for Educators)',
          '2.2. Tự động hóa tạo câu hỏi trắc nghiệm, tình huống học tập và bài tập tình huống',
          '2.3. Tạo slide, hình ảnh minh họa và video bài giảng ngắn'
        ],
        cdr: 'G2: Tự động hóa sản xuất học liệu chất lượng cao bằng AI',
        assessment: 'A2.1: Bộ học liệu số cá nhân',
        totalPeriods: 20,
        classPeriods: 8,
        theoryPeriods: 3,
        discussionPeriods: 2,
        practiceGroupPeriods: 0,
        practiceIndividualPeriods: 0,
        exercisePeriods: 3,
        guidedStudyPeriods: 4,
        selfStudyPeriods: 8,
        materials: 'Tài liệu Kỹ nghệ Prompt cho giảng viên số',
        discussionTopics: [
          'Chủ đề 1: Đánh giá tính chính xác và hiện tượng "ảo giác" (hallucination) của AI trong học liệu chuyên môn.',
          'Chủ đề 2: Kỹ thuật phản hồi cá nhân hóa (feedback) cho sinh viên quy mô lớn bằng trợ lý ảo.'
        ],
        guidedStudyTopics: [
          'Xây dựng chuỗi prompt chuẩn hóa để tạo ma trận đề thi và đáp án chi tiết.',
          'Tích hợp công cụ tạo video bài giảng tự động phục vụ lớp học đảo ngược (Flipped Classroom).'
        ],
        selfStudyTopics: [
          'Tự thiết kế hoàn chỉnh 1 bài giảng vi mô (Micro-learning) có sự trợ giúp của AI.',
          'Tham khảo các nền tảng MOOCs quốc tế về sư phạm AI.'
        ],
        aiCurated: true
      }
    ]
  }
];

export const PRESET_TEMPLATES: TeachingPlanTemplate[] = [
  {
    id: 'mau-f-standard',
    name: 'Mẫu F: Kế hoạch và phương pháp dạy học (Chuẩn hiện hành)',
    badge: 'Mẫu gốc mặc định',
    description: 'Bảng 6 cột gộp ô: Bài (số tiết) | Nội dung | CĐR | Hoạt động GV - HV | KT, ĐG (Phân chia chi tiết theo Lý thuyết, Thảo luận, Tự học có HD, Tự học)',
  },
  {
    id: 'mau-4-cot',
    name: 'Mẫu Kế hoạch bài dạy 4 cột (Chuẩn phát triển phẩm chất & năng lực)',
    badge: 'Bộ GD&ĐT',
    description: 'Bảng 4 cột chuẩn: Bài học & Nội dung | Chuẩn đầu ra (CĐR) | Hoạt động dạy và học (GV - HV) | Phương pháp kiểm tra, đánh giá',
  },
  {
    id: 'mau-aun-qa',
    name: 'Mẫu Kế hoạch giảng dạy chi tiết theo tuần (Chuẩn AUN-QA)',
    badge: 'Đại học / AUN-QA',
    description: 'Bảng theo tuần học: Tuần / Buổi | Nội dung giảng dạy & Mục tiêu | CĐR học phần | Hoạt động dạy - học trên lớp & tự học | Đánh giá',
  },
  {
    id: 'mau-custom',
    name: 'Tải lên Mẫu Word bất kỳ (.docx)',
    badge: 'AI nhận diện mẫu bất kỳ',
    description: 'Tải lên file Word mẫu kế hoạch dạy học bất kỳ của khoa/trường bạn. AI sẽ phân tích cấu trúc bảng và tự động tạo file theo đúng mẫu đó.',
    isCustomUpload: true,
  }
];

export const OLLAMA_MODELS: OllamaModelOption[] = [
  {
    id: 'gemma4:e4b',
    name: 'Gemma 4 (e4b)',
    tag: 'gemma4:e4b',
    badge: 'Gemma 4 e4b',
    description: 'Bản siêu nhẹ chạy mượt trên mọi máy tính, phản hồi nhanh tức thì.',
  },
  {
    id: 'qwen3.6:35b-a3b-q4',
    name: 'Qwen3.6 35B-A3B (Q4)',
    tag: 'qwen3.6:35b-a3b-q4',
    badge: 'Qwen 35B Q4',
    description: 'Model đa nhiệm thông minh mạnh mẽ, suy luận sư phạm và chọn lọc nội dung sâu sắc.',
  },
  {
    id: 'gemma4:12b',
    name: 'Gemma 4 (12B)',
    tag: 'gemma4:12b',
    badge: 'Gemma 4 12B',
    description: 'Model cân bằng hiệu năng cao cho phân tích giáo án và chuẩn đầu ra.',
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder (7B)',
    tag: 'qwen2.5-coder:7b',
    badge: 'Qwen Coder 7B',
    description: 'Chuyên gia xử lý dữ liệu có cấu trúc bảng, trích xuất đề cương chính xác.',
  },
];
