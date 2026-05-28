import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Headphones,
  Heart,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react'
import './App.css'

type Choice = {
  hanzi: string
  pinyin: string
  meaning: string
  aliases?: string[]
}

type Exercise = {
  id: string
  focus: string
  target: Choice
  choices: Choice[]
  tip: string
}

type Deck = {
  id: string
  level: string
  title: string
  subtitle: string
  items: Exercise[]
}

type DeckStats = {
  attempts: number
  correct: number
  xp: number
  streak: number
  bestStreak: number
  hearts: number
}

type LessonRun = {
  deckId: string
  exerciseIds: string[]
  choiceOrders: Record<string, string[]>
}

type DrillRow = {
  focus: string
  target: 0 | 1 | 2 | 3
  choices: [Choice, Choice, Choice, Choice]
  tip: string
}

type SavedStats = Record<string, Partial<DeckStats>>
type AppMode = 'listen' | 'speak'
type AnswerStatus = 'idle' | 'correct' | 'wrong'
type MicStatus = 'unknown' | 'checking' | 'ready' | 'blocked' | 'unsupported' | 'insecure'
type SpeechSpeed = 'normal' | 'slow'
type SpeechMark = { char: string; ok: boolean }

type RecognitionAlternative = {
  transcript: string
  confidence?: number
}

type RecognitionResultItem = {
  readonly 0: RecognitionAlternative
  readonly length: number
  isFinal?: boolean
}

type RecognitionEventLike = {
  results: ArrayLike<RecognitionResultItem>
}

type RecognitionErrorEventLike = {
  error?: string
  message?: string
}

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }

function buildListeningDrills(prefix: string, rows: DrillRow[]): Exercise[] {
  return rows.map((row, index) => ({
    id: `${prefix}-${index + 1}`,
    focus: row.focus,
    target: row.choices[row.target],
    choices: row.choices,
    tip: row.tip,
  }))
}

const decks: Deck[] = [
  {
    id: 'tones',
    level: 'Lv1 · U1',
    title: 'Thanh điệu',
    subtitle: 'Ma, mai, shui: nghe dấu để chọn đúng nghĩa.',
    items: [
      {
        id: 'ma-tones',
        focus: 'mā / má / mǎ / mà',
        target: { hanzi: '马', pinyin: 'mǎ', meaning: 'con ngựa' },
        choices: [
          { hanzi: '妈', pinyin: 'mā', meaning: 'mẹ' },
          { hanzi: '麻', pinyin: 'má', meaning: 'tê / gai dầu' },
          { hanzi: '马', pinyin: 'mǎ', meaning: 'con ngựa' },
          { hanzi: '骂', pinyin: 'mà', meaning: 'mắng' },
        ],
        tip: 'Âm đúng có thanh 3: xuống thấp rồi nhấc lên.',
      },
      {
        id: 'mai-tones',
        focus: 'mǎi / mài',
        target: { hanzi: '买', pinyin: 'mǎi', meaning: 'mua' },
        choices: [
          { hanzi: '埋', pinyin: 'mái', meaning: 'chôn / vùi' },
          { hanzi: '买', pinyin: 'mǎi', meaning: 'mua' },
          { hanzi: '卖', pinyin: 'mài', meaning: 'bán' },
          { hanzi: '马', pinyin: 'mǎ', meaning: 'ngựa' },
        ],
        tip: '买 là thanh 3, khác với 卖 thanh 4 rơi mạnh.',
      },
      {
        id: 'shui-tones',
        focus: 'shuǐ / shuì',
        target: { hanzi: '水', pinyin: 'shuǐ', meaning: 'nước' },
        choices: [
          { hanzi: '水', pinyin: 'shuǐ', meaning: 'nước' },
          { hanzi: '睡', pinyin: 'shuì', meaning: 'ngủ' },
          { hanzi: '书', pinyin: 'shū', meaning: 'sách' },
          { hanzi: '说', pinyin: 'shuō', meaning: 'nói' },
        ],
        tip: '水 có thanh 3; 睡 và 税 là thanh 4.',
      },
      {
        id: 'tang-tones',
        focus: 'tāng / táng / tǎng / tàng',
        target: { hanzi: '糖', pinyin: 'táng', meaning: 'đường' },
        choices: [
          { hanzi: '汤', pinyin: 'tāng', meaning: 'canh' },
          { hanzi: '糖', pinyin: 'táng', meaning: 'đường' },
          { hanzi: '躺', pinyin: 'tǎng', meaning: 'nằm' },
          { hanzi: '烫', pinyin: 'tàng', meaning: 'nóng bỏng' },
        ],
        tip: '糖 là thanh 2, giọng đi lên rõ.',
      },
    ],
  },
  {
    id: 'initials',
    level: 'Lv1 · U2',
    title: 'Âm đầu',
    subtitle: 'zh/ch/sh, z/c/s, j/q/x.',
    items: [
      {
        id: 'zhi-chi-shi',
        focus: 'zhī / chī / shī',
        target: { hanzi: '吃', pinyin: 'chī', meaning: 'ăn' },
        choices: [
          { hanzi: '知', pinyin: 'zhī', meaning: 'biết' },
          { hanzi: '吃', pinyin: 'chī', meaning: 'ăn' },
          { hanzi: '师', pinyin: 'shī', meaning: 'thầy' },
          { hanzi: '西', pinyin: 'xī', meaning: 'phía tây' },
        ],
        tip: 'ch bật hơi rõ hơn zh; cả hai đều cong lưỡi.',
      },
      {
        id: 'zao-cao-sao',
        focus: 'zǎo / cǎo / sǎo',
        target: { hanzi: '早', pinyin: 'zǎo', meaning: 'sớm / chào buổi sáng' },
        choices: [
          { hanzi: '早', pinyin: 'zǎo', meaning: 'sớm / chào buổi sáng' },
          { hanzi: '草', pinyin: 'cǎo', meaning: 'cỏ' },
          { hanzi: '扫', pinyin: 'sǎo', meaning: 'quét' },
          { hanzi: '找', pinyin: 'zhǎo', meaning: 'tìm' },
        ],
        tip: 'z không bật hơi; c bật hơi; s là âm xát.',
      },
      {
        id: 'ji-qi-xi',
        focus: 'jī / qī / xī',
        target: { hanzi: '七', pinyin: 'qī', meaning: 'số bảy' },
        choices: [
          { hanzi: '鸡', pinyin: 'jī', meaning: 'gà' },
          { hanzi: '七', pinyin: 'qī', meaning: 'số bảy' },
          { hanzi: '西', pinyin: 'xī', meaning: 'phía tây' },
          { hanzi: '吃', pinyin: 'chī', meaning: 'ăn' },
        ],
        tip: 'q bật hơi hơn j; x là âm xát nhẹ.',
      },
      {
        id: 'zhong-cong-song',
        focus: 'zhōng / cōng / sōng',
        target: { hanzi: '中', pinyin: 'zhōng', meaning: 'trung / giữa' },
        choices: [
          { hanzi: '中', pinyin: 'zhōng', meaning: 'trung / giữa' },
          { hanzi: '葱', pinyin: 'cōng', meaning: 'hành lá' },
          { hanzi: '松', pinyin: 'sōng', meaning: 'cây thông / lỏng' },
          { hanzi: '从', pinyin: 'cóng', meaning: 'từ / theo' },
        ],
        tip: 'zhōng có âm zh cong lưỡi, không giống z/c/s.',
      },
    ],
  },
  {
    id: 'jqx-drill',
    level: 'Lv2 · U1',
    title: 'j q x',
    subtitle: 'Nghe bật hơi và âm xát trước i/ü.',
    items: [
      {
        id: 'jqx-i',
        focus: 'jī / qī / xī',
        target: { hanzi: '鸡', pinyin: 'jī', meaning: 'gà' },
        choices: [
          { hanzi: '鸡', pinyin: 'jī', meaning: 'gà' },
          { hanzi: '七', pinyin: 'qī', meaning: 'số bảy' },
          { hanzi: '西', pinyin: 'xī', meaning: 'phía tây' },
          { hanzi: '知', pinyin: 'zhī', meaning: 'biết' },
        ],
        tip: 'j không bật hơi; q bật hơi; x là âm xát mảnh.',
      },
      {
        id: 'jqx-ia',
        focus: 'jiā / qiā / xiā',
        target: { hanzi: '虾', pinyin: 'xiā', meaning: 'tôm' },
        choices: [
          { hanzi: '家', pinyin: 'jiā', meaning: 'nhà' },
          { hanzi: '掐', pinyin: 'qiā', meaning: 'véo / bấm' },
          { hanzi: '虾', pinyin: 'xiā', meaning: 'tôm' },
          { hanzi: '下', pinyin: 'xià', meaning: 'xuống / dưới' },
        ],
        tip: 'x nhẹ và xát hơn j/q; q có luồng hơi rõ.',
      },
      {
        id: 'jqx-ie',
        focus: 'jié / qié / xié',
        target: { hanzi: '鞋', pinyin: 'xié', meaning: 'giày' },
        choices: [
          { hanzi: '节', pinyin: 'jié', meaning: 'tiết / lễ' },
          { hanzi: '茄', pinyin: 'qié', meaning: 'cà tím' },
          { hanzi: '鞋', pinyin: 'xié', meaning: 'giày' },
          { hanzi: '切', pinyin: 'qiē', meaning: 'cắt' },
        ],
        tip: 'Nghe kỹ phần đầu: q bật hơi, x không tắc ở đầu.',
      },
      {
        id: 'jqx-iao',
        focus: 'jiāo / qiáo / xiǎo',
        target: { hanzi: '桥', pinyin: 'qiáo', meaning: 'cầu' },
        choices: [
          { hanzi: '教', pinyin: 'jiāo', meaning: 'dạy' },
          { hanzi: '桥', pinyin: 'qiáo', meaning: 'cầu' },
          { hanzi: '小', pinyin: 'xiǎo', meaning: 'nhỏ' },
          { hanzi: '叫', pinyin: 'jiào', meaning: 'gọi' },
        ],
        tip: 'qiáo có q bật hơi và thanh 2 đi lên.',
      },
      {
        id: 'jqx-iu',
        focus: 'jiǔ / qiū / xiū',
        target: { hanzi: '秋', pinyin: 'qiū', meaning: 'mùa thu' },
        choices: [
          { hanzi: '九', pinyin: 'jiǔ', meaning: 'số chín' },
          { hanzi: '秋', pinyin: 'qiū', meaning: 'mùa thu' },
          { hanzi: '修', pinyin: 'xiū', meaning: 'sửa' },
          { hanzi: '旧', pinyin: 'jiù', meaning: 'cũ' },
        ],
        tip: 'q bật hơi; j gần hơn với âm tắc nhẹ.',
      },
      {
        id: 'jqx-ian',
        focus: 'jiàn / qián / xiàn',
        target: { hanzi: '线', pinyin: 'xiàn', meaning: 'sợi dây / tuyến' },
        choices: [
          { hanzi: '见', pinyin: 'jiàn', meaning: 'gặp / thấy' },
          { hanzi: '钱', pinyin: 'qián', meaning: 'tiền' },
          { hanzi: '线', pinyin: 'xiàn', meaning: 'dây / tuyến' },
          { hanzi: '间', pinyin: 'jiān', meaning: 'giữa / phòng' },
        ],
        tip: 'xiàn bắt đầu bằng âm xát x, không có tiếng bật hơi.',
      },
      {
        id: 'jqx-iang',
        focus: 'jiāng / qiáng / xiǎng',
        target: { hanzi: '想', pinyin: 'xiǎng', meaning: 'nghĩ / muốn' },
        choices: [
          { hanzi: '江', pinyin: 'jiāng', meaning: 'sông' },
          { hanzi: '强', pinyin: 'qiáng', meaning: 'mạnh' },
          { hanzi: '想', pinyin: 'xiǎng', meaning: 'nghĩ / muốn' },
          { hanzi: '讲', pinyin: 'jiǎng', meaning: 'nói / giảng' },
        ],
        tip: 'xiǎng có x đầu lưỡi phẳng, khác qiáng bật hơi.',
      },
      {
        id: 'jqx-u',
        focus: 'jū / qū / xū',
        target: { hanzi: '区', pinyin: 'qū', meaning: 'khu vực' },
        choices: [
          { hanzi: '居', pinyin: 'jū', meaning: 'ở / cư trú' },
          { hanzi: '区', pinyin: 'qū', meaning: 'khu vực' },
          { hanzi: '需', pinyin: 'xū', meaning: 'cần' },
          { hanzi: '句', pinyin: 'jù', meaning: 'câu' },
        ],
        tip: 'Sau j/q/x, chữ u trong pinyin đọc như ü.',
      },
      {
        id: 'jqx-ue',
        focus: 'jué / quē / xué',
        target: { hanzi: '学', pinyin: 'xué', meaning: 'học' },
        choices: [
          { hanzi: '决', pinyin: 'jué', meaning: 'quyết' },
          { hanzi: '缺', pinyin: 'quē', meaning: 'thiếu' },
          { hanzi: '学', pinyin: 'xué', meaning: 'học' },
          { hanzi: '雀', pinyin: 'què', meaning: 'chim sẻ' },
        ],
        tip: 'xué mở đầu bằng x, nhẹ hơn q và không bật hơi.',
      },
      {
        id: 'jqx-un',
        focus: 'jūn / qún / xùn',
        target: { hanzi: '群', pinyin: 'qún', meaning: 'nhóm' },
        choices: [
          { hanzi: '军', pinyin: 'jūn', meaning: 'quân đội' },
          { hanzi: '群', pinyin: 'qún', meaning: 'nhóm' },
          { hanzi: '训', pinyin: 'xùn', meaning: 'huấn luyện' },
          { hanzi: '俊', pinyin: 'jùn', meaning: 'tuấn tú' },
        ],
        tip: 'qún có q bật hơi và vần ün ẩn trong chữ un.',
      },
      ...buildListeningDrills('jqx-extra', [
        {
          focus: 'jīn / qīn / xīn / zhēn',
          target: 1,
          choices: [
            { hanzi: '金', pinyin: 'jīn', meaning: 'vàng / kim loại' },
            { hanzi: '亲', pinyin: 'qīn', meaning: 'thân / hôn' },
            { hanzi: '心', pinyin: 'xīn', meaning: 'tim' },
            { hanzi: '真', pinyin: 'zhēn', meaning: 'thật' },
          ],
          tip: 'qīn có bật hơi, jīn không bật hơi, xīn là âm xát.',
        },
        {
          focus: 'jìn / qìn / xìn / xìng',
          target: 2,
          choices: [
            { hanzi: '进', pinyin: 'jìn', meaning: 'vào / tiến' },
            { hanzi: '沁', pinyin: 'qìn', meaning: 'thấm' },
            { hanzi: '信', pinyin: 'xìn', meaning: 'tin / thư' },
            { hanzi: '性', pinyin: 'xìng', meaning: 'tính chất' },
          ],
          tip: 'xìn và xìng đều bắt đầu bằng x; nghe thêm phần vần để phân biệt.',
        },
        {
          focus: 'jiē / qiē / xiē / zhē',
          target: 0,
          choices: [
            { hanzi: '街', pinyin: 'jiē', meaning: 'phố' },
            { hanzi: '切', pinyin: 'qiē', meaning: 'cắt' },
            { hanzi: '些', pinyin: 'xiē', meaning: 'một vài' },
            { hanzi: '遮', pinyin: 'zhē', meaning: 'che' },
          ],
          tip: 'jiē có j đầu âm; qiē bật hơi; xiē xát nhẹ.',
        },
        {
          focus: 'jiě / qiě / xiě / zhě',
          target: 2,
          choices: [
            { hanzi: '姐', pinyin: 'jiě', meaning: 'chị gái' },
            { hanzi: '且', pinyin: 'qiě', meaning: 'vả lại / tạm' },
            { hanzi: '写', pinyin: 'xiě', meaning: 'viết' },
            { hanzi: '者', pinyin: 'zhě', meaning: 'người / kẻ' },
          ],
          tip: 'xiě mở đầu bằng x, không có tiếng bật hơi như qiě.',
        },
        {
          focus: 'jiān / qiān / xiān / zhān',
          target: 1,
          choices: [
            { hanzi: '尖', pinyin: 'jiān', meaning: 'nhọn' },
            { hanzi: '千', pinyin: 'qiān', meaning: 'nghìn' },
            { hanzi: '先', pinyin: 'xiān', meaning: 'trước' },
            { hanzi: '粘', pinyin: 'zhān', meaning: 'dính' },
          ],
          tip: 'qiān bật hơi rõ ngay sau q.',
        },
        {
          focus: 'jiǎn / qiǎn / xiǎn / zhǎn',
          target: 3,
          choices: [
            { hanzi: '减', pinyin: 'jiǎn', meaning: 'giảm' },
            { hanzi: '浅', pinyin: 'qiǎn', meaning: 'nông / nhạt' },
            { hanzi: '显', pinyin: 'xiǎn', meaning: 'rõ / hiện' },
            { hanzi: '展', pinyin: 'zhǎn', meaning: 'triển khai' },
          ],
          tip: 'zhǎn cong lưỡi, khác hẳn j/q/x.',
        },
        {
          focus: 'jīng / qīng / xīng / zēng',
          target: 1,
          choices: [
            { hanzi: '京', pinyin: 'jīng', meaning: 'kinh đô' },
            { hanzi: '青', pinyin: 'qīng', meaning: 'xanh' },
            { hanzi: '星', pinyin: 'xīng', meaning: 'ngôi sao' },
            { hanzi: '增', pinyin: 'zēng', meaning: 'tăng' },
          ],
          tip: 'qīng bật hơi; xīng xát nhẹ hơn.',
        },
        {
          focus: 'jǐng / qǐng / xǐng / zhěng',
          target: 2,
          choices: [
            { hanzi: '井', pinyin: 'jǐng', meaning: 'giếng' },
            { hanzi: '请', pinyin: 'qǐng', meaning: 'mời / xin' },
            { hanzi: '醒', pinyin: 'xǐng', meaning: 'tỉnh dậy' },
            { hanzi: '整', pinyin: 'zhěng', meaning: 'nguyên / sửa' },
          ],
          tip: 'xǐng có x đầu âm, không bật hơi.',
        },
        {
          focus: 'jiāng / qiāng / xiāng / zhāng',
          target: 1,
          choices: [
            { hanzi: '江', pinyin: 'jiāng', meaning: 'sông' },
            { hanzi: '枪', pinyin: 'qiāng', meaning: 'súng' },
            { hanzi: '香', pinyin: 'xiāng', meaning: 'thơm' },
            { hanzi: '张', pinyin: 'zhāng', meaning: 'mở / họ Trương' },
          ],
          tip: 'qiāng bật hơi; zhāng cong lưỡi.',
        },
        {
          focus: 'jiàng / qiàng / xiàng / zhàng',
          target: 2,
          choices: [
            { hanzi: '降', pinyin: 'jiàng', meaning: 'hạ xuống' },
            { hanzi: '呛', pinyin: 'qiàng', meaning: 'sặc' },
            { hanzi: '向', pinyin: 'xiàng', meaning: 'hướng về' },
            { hanzi: '账', pinyin: 'zhàng', meaning: 'sổ nợ' },
          ],
          tip: 'xiàng bắt đầu bằng x, không tắc như j/q.',
        },
        {
          focus: 'jū / qū / xū / zhū',
          target: 0,
          choices: [
            { hanzi: '居', pinyin: 'jū', meaning: 'ở / cư trú' },
            { hanzi: '区', pinyin: 'qū', meaning: 'khu vực' },
            { hanzi: '需', pinyin: 'xū', meaning: 'cần' },
            { hanzi: '猪', pinyin: 'zhū', meaning: 'heo' },
          ],
          tip: 'jū không bật hơi; qū bật hơi; xū xát nhẹ.',
        },
        {
          focus: 'jú / qú / xú / zhú',
          target: 3,
          choices: [
            { hanzi: '菊', pinyin: 'jú', meaning: 'hoa cúc' },
            { hanzi: '渠', pinyin: 'qú', meaning: 'kênh' },
            { hanzi: '徐', pinyin: 'xú', meaning: 'chậm / họ Từ' },
            { hanzi: '竹', pinyin: 'zhú', meaning: 'tre' },
          ],
          tip: 'zhú là âm cong lưỡi, khác j/q/x.',
        },
        {
          focus: 'juǎn / quǎn / xuǎn / zhuǎn',
          target: 2,
          choices: [
            { hanzi: '卷', pinyin: 'juǎn', meaning: 'cuộn' },
            { hanzi: '犬', pinyin: 'quǎn', meaning: 'chó' },
            { hanzi: '选', pinyin: 'xuǎn', meaning: 'chọn' },
            { hanzi: '转', pinyin: 'zhuǎn', meaning: 'chuyển / xoay' },
          ],
          tip: 'xuǎn là x + üan; nghe âm xát ở đầu.',
        },
        {
          focus: 'jué / quē / xué / zhuó',
          target: 1,
          choices: [
            { hanzi: '决', pinyin: 'jué', meaning: 'quyết' },
            { hanzi: '缺', pinyin: 'quē', meaning: 'thiếu' },
            { hanzi: '学', pinyin: 'xué', meaning: 'học' },
            { hanzi: '卓', pinyin: 'zhuó', meaning: 'xuất sắc' },
          ],
          tip: 'quē có q bật hơi; xué nhẹ hơn.',
        },
        {
          focus: 'jùn / qún / xùn / zhǔn',
          target: 3,
          choices: [
            { hanzi: '俊', pinyin: 'jùn', meaning: 'tuấn tú' },
            { hanzi: '群', pinyin: 'qún', meaning: 'nhóm' },
            { hanzi: '训', pinyin: 'xùn', meaning: 'huấn luyện' },
            { hanzi: '准', pinyin: 'zhǔn', meaning: 'chuẩn' },
          ],
          tip: 'zhǔn cong lưỡi; jùn/qún/xùn là nhóm j/q/x.',
        },
        {
          focus: 'jiāo / qiāo / xiāo / zhāo',
          target: 1,
          choices: [
            { hanzi: '交', pinyin: 'jiāo', meaning: 'giao' },
            { hanzi: '敲', pinyin: 'qiāo', meaning: 'gõ' },
            { hanzi: '消', pinyin: 'xiāo', meaning: 'tan / tiêu' },
            { hanzi: '招', pinyin: 'zhāo', meaning: 'gọi / chiêu' },
          ],
          tip: 'qiāo bật hơi, khác jiāo không bật hơi.',
        },
        {
          focus: 'jiǔ / qiú / xiū / zhōu',
          target: 1,
          choices: [
            { hanzi: '九', pinyin: 'jiǔ', meaning: 'số chín' },
            { hanzi: '球', pinyin: 'qiú', meaning: 'quả bóng' },
            { hanzi: '修', pinyin: 'xiū', meaning: 'sửa' },
            { hanzi: '周', pinyin: 'zhōu', meaning: 'tuần / họ Chu' },
          ],
          tip: 'qiú có q bật hơi; zhōu cong lưỡi.',
        },
        {
          focus: 'jù / qù / xù / zhù',
          target: 1,
          choices: [
            { hanzi: '句', pinyin: 'jù', meaning: 'câu' },
            { hanzi: '去', pinyin: 'qù', meaning: 'đi' },
            { hanzi: '续', pinyin: 'xù', meaning: 'tiếp tục' },
            { hanzi: '住', pinyin: 'zhù', meaning: 'ở' },
          ],
          tip: 'qù bật hơi; jù không bật hơi.',
        },
        {
          focus: 'jiǎo / qiǎo / xiào / zhào',
          target: 2,
          choices: [
            { hanzi: '角', pinyin: 'jiǎo', meaning: 'góc / sừng' },
            { hanzi: '巧', pinyin: 'qiǎo', meaning: 'khéo' },
            { hanzi: '笑', pinyin: 'xiào', meaning: 'cười' },
            { hanzi: '照', pinyin: 'zhào', meaning: 'chiếu / chụp' },
          ],
          tip: 'xiào là xát nhẹ, khác qiǎo bật hơi.',
        },
        {
          focus: 'jiān / qián / xiàn / jiàn',
          target: 1,
          choices: [
            { hanzi: '尖', pinyin: 'jiān', meaning: 'nhọn' },
            { hanzi: '前', pinyin: 'qián', meaning: 'phía trước' },
            { hanzi: '现', pinyin: 'xiàn', meaning: 'hiện tại' },
            { hanzi: '件', pinyin: 'jiàn', meaning: 'món / việc' },
          ],
          tip: 'qián bật hơi và thanh 2 đi lên.',
        },
      ]),
    ],
  },
  {
    id: 'zcs-drill',
    level: 'Lv2 · U2',
    title: 'z c s',
    subtitle: 'Âm đầu đầu lưỡi: không cong lưỡi.',
    items: [
      {
        id: 'zcs-i',
        focus: 'zī / cī / sī',
        target: { hanzi: '丝', pinyin: 'sī', meaning: 'tơ / sợi' },
        choices: [
          { hanzi: '资', pinyin: 'zī', meaning: 'vốn / tư' },
          { hanzi: '疵', pinyin: 'cī', meaning: 'khuyết điểm' },
          { hanzi: '丝', pinyin: 'sī', meaning: 'sợi tơ' },
          { hanzi: '知', pinyin: 'zhī', meaning: 'biết' },
        ],
        tip: 'z/c/s không cong lưỡi; s là âm xát rõ.',
      },
      {
        id: 'zcs-a',
        focus: 'zā / cā / sā',
        target: { hanzi: '擦', pinyin: 'cā', meaning: 'lau / chà' },
        choices: [
          { hanzi: '扎', pinyin: 'zā', meaning: 'buộc' },
          { hanzi: '擦', pinyin: 'cā', meaning: 'lau' },
          { hanzi: '撒', pinyin: 'sā', meaning: 'rải' },
          { hanzi: '渣', pinyin: 'zhā', meaning: 'cặn' },
        ],
        tip: 'c bật hơi hơn z; s không có tiếng tắc đầu.',
      },
      {
        id: 'zcs-e',
        focus: 'zé / cè / sè',
        target: { hanzi: '色', pinyin: 'sè', meaning: 'màu sắc' },
        choices: [
          { hanzi: '责', pinyin: 'zé', meaning: 'trách nhiệm' },
          { hanzi: '册', pinyin: 'cè', meaning: 'quyển / tập' },
          { hanzi: '色', pinyin: 'sè', meaning: 'màu sắc' },
          { hanzi: '这', pinyin: 'zhè', meaning: 'này' },
        ],
        tip: 'sè bắt đầu bằng s, không cong lưỡi như sh/zh.',
      },
      {
        id: 'zcs-ai',
        focus: 'zài / cài / sài',
        target: { hanzi: '菜', pinyin: 'cài', meaning: 'rau / món ăn' },
        choices: [
          { hanzi: '在', pinyin: 'zài', meaning: 'ở / đang' },
          { hanzi: '菜', pinyin: 'cài', meaning: 'món ăn' },
          { hanzi: '赛', pinyin: 'sài', meaning: 'thi đấu' },
          { hanzi: '寨', pinyin: 'zhài', meaning: 'trại / làng' },
        ],
        tip: 'cài bật hơi, zài không bật hơi.',
      },
      {
        id: 'zcs-ao',
        focus: 'zǎo / cǎo / sǎo',
        target: { hanzi: '草', pinyin: 'cǎo', meaning: 'cỏ' },
        choices: [
          { hanzi: '早', pinyin: 'zǎo', meaning: 'sớm' },
          { hanzi: '草', pinyin: 'cǎo', meaning: 'cỏ' },
          { hanzi: '扫', pinyin: 'sǎo', meaning: 'quét' },
          { hanzi: '找', pinyin: 'zhǎo', meaning: 'tìm' },
        ],
        tip: 'cǎo có bật hơi ngay đầu âm.',
      },
      {
        id: 'zcs-ou',
        focus: 'zǒu / còu / sōu',
        target: { hanzi: '走', pinyin: 'zǒu', meaning: 'đi bộ' },
        choices: [
          { hanzi: '走', pinyin: 'zǒu', meaning: 'đi' },
          { hanzi: '凑', pinyin: 'còu', meaning: 'gom lại' },
          { hanzi: '搜', pinyin: 'sōu', meaning: 'tìm kiếm' },
          { hanzi: '周', pinyin: 'zhōu', meaning: 'tuần / họ Chu' },
        ],
        tip: 'zǒu không bật hơi; zhōu thì cong lưỡi.',
      },
      {
        id: 'zcs-u',
        focus: 'zū / cù / sù',
        target: { hanzi: '速', pinyin: 'sù', meaning: 'tốc độ' },
        choices: [
          { hanzi: '租', pinyin: 'zū', meaning: 'thuê' },
          { hanzi: '促', pinyin: 'cù', meaning: 'thúc đẩy' },
          { hanzi: '速', pinyin: 'sù', meaning: 'tốc độ' },
          { hanzi: '主', pinyin: 'zhǔ', meaning: 'chủ' },
        ],
        tip: 'sù là âm xát s, không có z/c ở đầu.',
      },
      {
        id: 'zcs-uo',
        focus: 'zuò / cuò / suǒ',
        target: { hanzi: '错', pinyin: 'cuò', meaning: 'sai' },
        choices: [
          { hanzi: '做', pinyin: 'zuò', meaning: 'làm' },
          { hanzi: '错', pinyin: 'cuò', meaning: 'sai' },
          { hanzi: '锁', pinyin: 'suǒ', meaning: 'khóa' },
          { hanzi: '桌', pinyin: 'zhuō', meaning: 'bàn' },
        ],
        tip: 'cuò có luồng hơi rõ sau c.',
      },
      {
        id: 'zcs-ong',
        focus: 'zōng / cōng / sōng',
        target: { hanzi: '松', pinyin: 'sōng', meaning: 'cây thông / lỏng' },
        choices: [
          { hanzi: '宗', pinyin: 'zōng', meaning: 'tông / phái' },
          { hanzi: '葱', pinyin: 'cōng', meaning: 'hành lá' },
          { hanzi: '松', pinyin: 'sōng', meaning: 'cây thông' },
          { hanzi: '中', pinyin: 'zhōng', meaning: 'giữa' },
        ],
        tip: 'sōng không có tiếng tắc như z/c.',
      },
      {
        id: 'zcs-un',
        focus: 'zūn / cún / sūn',
        target: { hanzi: '存', pinyin: 'cún', meaning: 'tồn tại / lưu' },
        choices: [
          { hanzi: '尊', pinyin: 'zūn', meaning: 'tôn trọng' },
          { hanzi: '存', pinyin: 'cún', meaning: 'lưu / tồn tại' },
          { hanzi: '孙', pinyin: 'sūn', meaning: 'cháu' },
          { hanzi: '春', pinyin: 'chūn', meaning: 'mùa xuân' },
        ],
        tip: 'cún bật hơi; chūn cong lưỡi và khác hẳn cún.',
      },
      ...buildListeningDrills('zcs-extra', [
        {
          focus: 'zā / cā / sā / zhā',
          target: 0,
          choices: [
            { hanzi: '扎', pinyin: 'zā', meaning: 'buộc' },
            { hanzi: '擦', pinyin: 'cā', meaning: 'lau' },
            { hanzi: '撒', pinyin: 'sā', meaning: 'rải' },
            { hanzi: '渣', pinyin: 'zhā', meaning: 'cặn' },
          ],
          tip: 'zā không bật hơi; cā bật hơi; zhā cong lưỡi.',
        },
        {
          focus: 'zé / cè / sè / shé',
          target: 1,
          choices: [
            { hanzi: '责', pinyin: 'zé', meaning: 'trách nhiệm' },
            { hanzi: '册', pinyin: 'cè', meaning: 'quyển / tập' },
            { hanzi: '色', pinyin: 'sè', meaning: 'màu sắc' },
            { hanzi: '蛇', pinyin: 'shé', meaning: 'rắn' },
          ],
          tip: 'cè bật hơi, không cong lưỡi như shé.',
        },
        {
          focus: 'zǐ / cǐ / sǐ / zhǐ',
          target: 2,
          choices: [
            { hanzi: '子', pinyin: 'zǐ', meaning: 'con / chữ' },
            { hanzi: '此', pinyin: 'cǐ', meaning: 'này' },
            { hanzi: '死', pinyin: 'sǐ', meaning: 'chết' },
            { hanzi: '只', pinyin: 'zhǐ', meaning: 'chỉ' },
          ],
          tip: 'sǐ là âm xát s, không có tắc đầu như z/c.',
        },
        {
          focus: 'zài / cài / sài / zhài',
          target: 0,
          choices: [
            { hanzi: '在', pinyin: 'zài', meaning: 'ở / đang' },
            { hanzi: '菜', pinyin: 'cài', meaning: 'rau / món ăn' },
            { hanzi: '赛', pinyin: 'sài', meaning: 'thi đấu' },
            { hanzi: '寨', pinyin: 'zhài', meaning: 'trại / làng' },
          ],
          tip: 'zài không bật hơi, khác cài.',
        },
        {
          focus: 'zào / cāo / sǎo / shào',
          target: 3,
          choices: [
            { hanzi: '造', pinyin: 'zào', meaning: 'tạo ra' },
            { hanzi: '操', pinyin: 'cāo', meaning: 'thao tác / luyện' },
            { hanzi: '扫', pinyin: 'sǎo', meaning: 'quét' },
            { hanzi: '哨', pinyin: 'shào', meaning: 'còi / trạm gác' },
          ],
          tip: 'shào cong lưỡi; sào không cong lưỡi.',
        },
        {
          focus: 'zǒu / còu / sōu / zhōu',
          target: 2,
          choices: [
            { hanzi: '走', pinyin: 'zǒu', meaning: 'đi' },
            { hanzi: '凑', pinyin: 'còu', meaning: 'gom lại' },
            { hanzi: '搜', pinyin: 'sōu', meaning: 'tìm kiếm' },
            { hanzi: '周', pinyin: 'zhōu', meaning: 'tuần / họ Chu' },
          ],
          tip: 'sōu là s xát, không bật hơi như c.',
        },
        {
          focus: 'zū / cū / sū / shū',
          target: 1,
          choices: [
            { hanzi: '租', pinyin: 'zū', meaning: 'thuê' },
            { hanzi: '粗', pinyin: 'cū', meaning: 'thô' },
            { hanzi: '苏', pinyin: 'sū', meaning: 'họ Tô' },
            { hanzi: '书', pinyin: 'shū', meaning: 'sách' },
          ],
          tip: 'cū bật hơi, zū không bật hơi.',
        },
        {
          focus: 'zú / cù / sù / chù',
          target: 0,
          choices: [
            { hanzi: '足', pinyin: 'zú', meaning: 'chân / đủ' },
            { hanzi: '促', pinyin: 'cù', meaning: 'thúc đẩy' },
            { hanzi: '速', pinyin: 'sù', meaning: 'tốc độ' },
            { hanzi: '处', pinyin: 'chù', meaning: 'nơi' },
          ],
          tip: 'zú không bật hơi và không cong lưỡi.',
        },
        {
          focus: 'zǎn / cǎn / sǎn / chǎn',
          target: 2,
          choices: [
            { hanzi: '攒', pinyin: 'zǎn', meaning: 'tích góp' },
            { hanzi: '惨', pinyin: 'cǎn', meaning: 'thảm' },
            { hanzi: '散', pinyin: 'sǎn', meaning: 'rời rạc' },
            { hanzi: '产', pinyin: 'chǎn', meaning: 'sản xuất' },
          ],
          tip: 'sǎn là s, không bật hơi và không cong lưỡi.',
        },
        {
          focus: 'zān / cān / sān / shān',
          target: 1,
          choices: [
            { hanzi: '簪', pinyin: 'zān', meaning: 'trâm cài' },
            { hanzi: '餐', pinyin: 'cān', meaning: 'bữa ăn' },
            { hanzi: '三', pinyin: 'sān', meaning: 'số ba' },
            { hanzi: '山', pinyin: 'shān', meaning: 'núi' },
          ],
          tip: 'cān bật hơi; sān xát; shān cong lưỡi.',
        },
        {
          focus: 'zàng / cāng / sāng / zhāng',
          target: 2,
          choices: [
            { hanzi: '藏', pinyin: 'zàng', meaning: 'Tạng / kho' },
            { hanzi: '仓', pinyin: 'cāng', meaning: 'kho' },
            { hanzi: '桑', pinyin: 'sāng', meaning: 'dâu tằm' },
            { hanzi: '张', pinyin: 'zhāng', meaning: 'mở / họ Trương' },
          ],
          tip: 'sāng không tắc đầu; zàng có z không bật hơi.',
        },
        {
          focus: 'zòng / cóng / sòng / zhòng',
          target: 3,
          choices: [
            { hanzi: '纵', pinyin: 'zòng', meaning: 'dọc / thả' },
            { hanzi: '从', pinyin: 'cóng', meaning: 'từ / theo' },
            { hanzi: '送', pinyin: 'sòng', meaning: 'tặng / tiễn' },
            { hanzi: '重', pinyin: 'zhòng', meaning: 'nặng / quan trọng' },
          ],
          tip: 'zhòng cong lưỡi, khác zòng không cong.',
        },
        {
          focus: 'zuǒ / cuò / suǒ / zhuō',
          target: 0,
          choices: [
            { hanzi: '左', pinyin: 'zuǒ', meaning: 'trái' },
            { hanzi: '错', pinyin: 'cuò', meaning: 'sai' },
            { hanzi: '锁', pinyin: 'suǒ', meaning: 'khóa' },
            { hanzi: '桌', pinyin: 'zhuō', meaning: 'bàn' },
          ],
          tip: 'zuǒ không bật hơi; cuò bật hơi; zhuō cong lưỡi.',
        },
        {
          focus: 'zuì / cuì / suì / zhuì',
          target: 1,
          choices: [
            { hanzi: '最', pinyin: 'zuì', meaning: 'nhất' },
            { hanzi: '脆', pinyin: 'cuì', meaning: 'giòn' },
            { hanzi: '岁', pinyin: 'suì', meaning: 'tuổi' },
            { hanzi: '坠', pinyin: 'zhuì', meaning: 'rơi xuống' },
          ],
          tip: 'cuì bật hơi, khác zuì không bật hơi.',
        },
        {
          focus: 'zēng / céng / sēng / zhēng',
          target: 3,
          choices: [
            { hanzi: '增', pinyin: 'zēng', meaning: 'tăng' },
            { hanzi: '曾', pinyin: 'céng', meaning: 'đã từng' },
            { hanzi: '僧', pinyin: 'sēng', meaning: 'nhà sư' },
            { hanzi: '争', pinyin: 'zhēng', meaning: 'tranh' },
          ],
          tip: 'zhēng cong lưỡi; zēng/céng/sēng không cong.',
        },
        {
          focus: 'zǔ / cù / sú / zhǔ',
          target: 0,
          choices: [
            { hanzi: '组', pinyin: 'zǔ', meaning: 'nhóm' },
            { hanzi: '醋', pinyin: 'cù', meaning: 'giấm' },
            { hanzi: '俗', pinyin: 'sú', meaning: 'tục / phổ biến' },
            { hanzi: '主', pinyin: 'zhǔ', meaning: 'chủ' },
          ],
          tip: 'zǔ không bật hơi; zhǔ cong lưỡi.',
        },
        {
          focus: 'zūn / cún / sūn / chūn',
          target: 0,
          choices: [
            { hanzi: '尊', pinyin: 'zūn', meaning: 'tôn trọng' },
            { hanzi: '存', pinyin: 'cún', meaning: 'lưu / tồn tại' },
            { hanzi: '孙', pinyin: 'sūn', meaning: 'cháu' },
            { hanzi: '春', pinyin: 'chūn', meaning: 'mùa xuân' },
          ],
          tip: 'zūn không bật hơi; cún bật hơi; chūn cong lưỡi.',
        },
        {
          focus: 'zāo / cāo / sāo / shāo',
          target: 3,
          choices: [
            { hanzi: '糟', pinyin: 'zāo', meaning: 'tệ / bã' },
            { hanzi: '操', pinyin: 'cāo', meaning: 'luyện / thao tác' },
            { hanzi: '骚', pinyin: 'sāo', meaning: 'quấy rối' },
            { hanzi: '烧', pinyin: 'shāo', meaning: 'đốt / sốt' },
          ],
          tip: 'shāo cong lưỡi; sāo không cong.',
        },
        {
          focus: 'zá / cā / sǎ / chá',
          target: 2,
          choices: [
            { hanzi: '杂', pinyin: 'zá', meaning: 'lẫn lộn' },
            { hanzi: '擦', pinyin: 'cā', meaning: 'lau' },
            { hanzi: '洒', pinyin: 'sǎ', meaning: 'rải / đổ' },
            { hanzi: '茶', pinyin: 'chá', meaning: 'trà' },
          ],
          tip: 'sǎ là âm s; chá cong lưỡi và bật hơi.',
        },
        {
          focus: 'zì / cì / sì / zhì',
          target: 1,
          choices: [
            { hanzi: '字', pinyin: 'zì', meaning: 'chữ' },
            { hanzi: '次', pinyin: 'cì', meaning: 'lần / thứ' },
            { hanzi: '四', pinyin: 'sì', meaning: 'số bốn' },
            { hanzi: '治', pinyin: 'zhì', meaning: 'trị / quản lý' },
          ],
          tip: 'cì bật hơi, khác zì không bật hơi.',
        },
      ]),
    ],
  },
  {
    id: 'retroflex-drill',
    level: 'Lv2 · U3',
    title: 'zh ch sh r',
    subtitle: 'Âm cong lưỡi: nghe rõ zh/ch/sh/r.',
    items: [
      {
        id: 'retro-i',
        focus: 'zhī / chī / shī / rì',
        target: { hanzi: '日', pinyin: 'rì', meaning: 'ngày / mặt trời' },
        choices: [
          { hanzi: '知', pinyin: 'zhī', meaning: 'biết' },
          { hanzi: '吃', pinyin: 'chī', meaning: 'ăn' },
          { hanzi: '师', pinyin: 'shī', meaning: 'thầy' },
          { hanzi: '日', pinyin: 'rì', meaning: 'ngày' },
        ],
        tip: 'rì có âm r cong lưỡi, khác shī và zhī.',
      },
      {
        id: 'retro-ao',
        focus: 'zhǎo / chǎo / shǎo / rǎo',
        target: { hanzi: '少', pinyin: 'shǎo', meaning: 'ít' },
        choices: [
          { hanzi: '找', pinyin: 'zhǎo', meaning: 'tìm' },
          { hanzi: '炒', pinyin: 'chǎo', meaning: 'xào' },
          { hanzi: '少', pinyin: 'shǎo', meaning: 'ít' },
          { hanzi: '扰', pinyin: 'rǎo', meaning: 'quấy rầy' },
        ],
        tip: 'sh là âm xát cong lưỡi, không bật hơi như ch.',
      },
      {
        id: 'retro-e',
        focus: 'zhè / chè / shé / rè',
        target: { hanzi: '热', pinyin: 'rè', meaning: 'nóng' },
        choices: [
          { hanzi: '这', pinyin: 'zhè', meaning: 'này' },
          { hanzi: '撤', pinyin: 'chè', meaning: 'rút / dỡ' },
          { hanzi: '蛇', pinyin: 'shé', meaning: 'rắn' },
          { hanzi: '热', pinyin: 'rè', meaning: 'nóng' },
        ],
        tip: 'rè bắt đầu bằng r, nghe rung/xát hơn sh.',
      },
      {
        id: 'retro-u',
        focus: 'zhù / chù / shù / rù',
        target: { hanzi: '处', pinyin: 'chù', meaning: 'nơi / xử lý' },
        choices: [
          { hanzi: '住', pinyin: 'zhù', meaning: 'ở' },
          { hanzi: '处', pinyin: 'chù', meaning: 'nơi' },
          { hanzi: '树', pinyin: 'shù', meaning: 'cây' },
          { hanzi: '入', pinyin: 'rù', meaning: 'vào' },
        ],
        tip: 'chù bật hơi mạnh hơn zhù.',
      },
      {
        id: 'retro-uo',
        focus: 'zhuō / chuō / shuō / ruò',
        target: { hanzi: '说', pinyin: 'shuō', meaning: 'nói' },
        choices: [
          { hanzi: '桌', pinyin: 'zhuō', meaning: 'bàn' },
          { hanzi: '戳', pinyin: 'chuō', meaning: 'chọc' },
          { hanzi: '说', pinyin: 'shuō', meaning: 'nói' },
          { hanzi: '若', pinyin: 'ruò', meaning: 'nếu / như' },
        ],
        tip: 'shuō là sh cong lưỡi, khác suō không cong lưỡi.',
      },
      {
        id: 'retro-an',
        focus: 'zhàn / chǎn / shān / rán',
        target: { hanzi: '然', pinyin: 'rán', meaning: 'như vậy / đúng' },
        choices: [
          { hanzi: '站', pinyin: 'zhàn', meaning: 'đứng / ga' },
          { hanzi: '产', pinyin: 'chǎn', meaning: 'sản xuất' },
          { hanzi: '山', pinyin: 'shān', meaning: 'núi' },
          { hanzi: '然', pinyin: 'rán', meaning: 'như vậy' },
        ],
        tip: 'rán bắt đầu bằng r; shān là âm xát sh không bật hơi.',
      },
      {
        id: 'retro-ang',
        focus: 'zhāng / cháng / shàng / ràng',
        target: { hanzi: '长', pinyin: 'cháng', meaning: 'dài' },
        choices: [
          { hanzi: '张', pinyin: 'zhāng', meaning: 'họ Trương / mở' },
          { hanzi: '长', pinyin: 'cháng', meaning: 'dài' },
          { hanzi: '上', pinyin: 'shàng', meaning: 'trên' },
          { hanzi: '让', pinyin: 'ràng', meaning: 'để / nhường' },
        ],
        tip: 'cháng bật hơi; zhāng không bật hơi.',
      },
      {
        id: 'retro-en',
        focus: 'zhēn / chén / shēn / rén',
        target: { hanzi: '人', pinyin: 'rén', meaning: 'người' },
        choices: [
          { hanzi: '真', pinyin: 'zhēn', meaning: 'thật' },
          { hanzi: '陈', pinyin: 'chén', meaning: 'họ Trần / cũ' },
          { hanzi: '身', pinyin: 'shēn', meaning: 'thân thể' },
          { hanzi: '人', pinyin: 'rén', meaning: 'người' },
        ],
        tip: 'rén có r đầu âm; không giống zh/ch/sh.',
      },
      {
        id: 'retro-uan',
        focus: 'zhuǎn / chuán / shuān / ruǎn',
        target: { hanzi: '软', pinyin: 'ruǎn', meaning: 'mềm' },
        choices: [
          { hanzi: '转', pinyin: 'zhuǎn', meaning: 'chuyển / xoay' },
          { hanzi: '船', pinyin: 'chuán', meaning: 'thuyền' },
          { hanzi: '栓', pinyin: 'shuān', meaning: 'chốt / nút' },
          { hanzi: '软', pinyin: 'ruǎn', meaning: 'mềm' },
        ],
        tip: 'ruǎn bắt đầu bằng r; shuān bắt đầu bằng sh.',
      },
      ...buildListeningDrills('retro-extra', [
        {
          focus: 'zhā / chā / shā / lā',
          target: 1,
          choices: [
            { hanzi: '扎', pinyin: 'zhā', meaning: 'đâm / châm' },
            { hanzi: '插', pinyin: 'chā', meaning: 'cắm / chèn' },
            { hanzi: '沙', pinyin: 'shā', meaning: 'cát' },
            { hanzi: '拉', pinyin: 'lā', meaning: 'kéo' },
          ],
          tip: 'chā bật hơi và cong lưỡi; shā là âm xát.',
        },
        {
          focus: 'zhí / chí / shí / rì',
          target: 0,
          choices: [
            { hanzi: '直', pinyin: 'zhí', meaning: 'thẳng' },
            { hanzi: '迟', pinyin: 'chí', meaning: 'muộn' },
            { hanzi: '十', pinyin: 'shí', meaning: 'số mười' },
            { hanzi: '日', pinyin: 'rì', meaning: 'ngày' },
          ],
          tip: 'zhí không bật hơi; chí bật hơi.',
        },
        {
          focus: 'zhǐ / chǐ / shǐ / rě',
          target: 2,
          choices: [
            { hanzi: '只', pinyin: 'zhǐ', meaning: 'chỉ' },
            { hanzi: '尺', pinyin: 'chǐ', meaning: 'thước' },
            { hanzi: '使', pinyin: 'shǐ', meaning: 'khiến / dùng' },
            { hanzi: '惹', pinyin: 'rě', meaning: 'chọc / gây' },
          ],
          tip: 'shǐ xát cong lưỡi, không bật hơi như chǐ.',
        },
        {
          focus: 'zhù / chū / shū / rù',
          target: 2,
          choices: [
            { hanzi: '住', pinyin: 'zhù', meaning: 'ở' },
            { hanzi: '出', pinyin: 'chū', meaning: 'ra' },
            { hanzi: '书', pinyin: 'shū', meaning: 'sách' },
            { hanzi: '入', pinyin: 'rù', meaning: 'vào' },
          ],
          tip: 'shū là âm xát sh, khác chū bật hơi.',
        },
        {
          focus: 'zhǎi / chāi / shài / rǎo',
          target: 1,
          choices: [
            { hanzi: '窄', pinyin: 'zhǎi', meaning: 'hẹp' },
            { hanzi: '拆', pinyin: 'chāi', meaning: 'tháo / dỡ' },
            { hanzi: '晒', pinyin: 'shài', meaning: 'phơi nắng' },
            { hanzi: '扰', pinyin: 'rǎo', meaning: 'quấy rầy' },
          ],
          tip: 'chāi bật hơi; zhǎi không bật hơi.',
        },
        {
          focus: 'zhē / chè / shé / rè',
          target: 3,
          choices: [
            { hanzi: '遮', pinyin: 'zhē', meaning: 'che' },
            { hanzi: '撤', pinyin: 'chè', meaning: 'rút / dỡ' },
            { hanzi: '蛇', pinyin: 'shé', meaning: 'rắn' },
            { hanzi: '热', pinyin: 'rè', meaning: 'nóng' },
          ],
          tip: 'rè có âm r, không giống shé.',
        },
        {
          focus: 'zhāo / chāo / shāo / rào',
          target: 0,
          choices: [
            { hanzi: '招', pinyin: 'zhāo', meaning: 'chiêu / gọi' },
            { hanzi: '超', pinyin: 'chāo', meaning: 'vượt' },
            { hanzi: '烧', pinyin: 'shāo', meaning: 'đốt' },
            { hanzi: '绕', pinyin: 'rào', meaning: 'vòng quanh' },
          ],
          tip: 'zhāo không bật hơi, chāo bật hơi.',
        },
        {
          focus: 'zhòu / chōu / shǒu / róu',
          target: 1,
          choices: [
            { hanzi: '皱', pinyin: 'zhòu', meaning: 'nhăn' },
            { hanzi: '抽', pinyin: 'chōu', meaning: 'rút / hút' },
            { hanzi: '手', pinyin: 'shǒu', meaning: 'tay' },
            { hanzi: '柔', pinyin: 'róu', meaning: 'mềm mại' },
          ],
          tip: 'chōu bật hơi; zhòu không bật hơi.',
        },
        {
          focus: 'zhuā / chuāng / shuǎ / ruǎn',
          target: 0,
          choices: [
            { hanzi: '抓', pinyin: 'zhuā', meaning: 'bắt / nắm' },
            { hanzi: '窗', pinyin: 'chuāng', meaning: 'cửa sổ' },
            { hanzi: '耍', pinyin: 'shuǎ', meaning: 'chơi / giỡn' },
            { hanzi: '软', pinyin: 'ruǎn', meaning: 'mềm' },
          ],
          tip: 'zhuā bắt đầu bằng zh; chuāng bật hơi và có âm cuối ng.',
        },
        {
          focus: 'zhuī / chuí / shuǐ / ruì',
          target: 1,
          choices: [
            { hanzi: '追', pinyin: 'zhuī', meaning: 'đuổi theo' },
            { hanzi: '垂', pinyin: 'chuí', meaning: 'rủ xuống' },
            { hanzi: '水', pinyin: 'shuǐ', meaning: 'nước' },
            { hanzi: '锐', pinyin: 'ruì', meaning: 'sắc bén' },
          ],
          tip: 'chuí bật hơi, zhuī không bật hơi.',
        },
        {
          focus: 'zhuō / chuō / shuō / ruò',
          target: 1,
          choices: [
            { hanzi: '桌', pinyin: 'zhuō', meaning: 'bàn' },
            { hanzi: '戳', pinyin: 'chuō', meaning: 'chọc' },
            { hanzi: '说', pinyin: 'shuō', meaning: 'nói' },
            { hanzi: '若', pinyin: 'ruò', meaning: 'nếu / như' },
          ],
          tip: 'chuō bật hơi rõ hơn zhuō.',
        },
        {
          focus: 'zhǔn / chūn / shùn / rùn',
          target: 2,
          choices: [
            { hanzi: '准', pinyin: 'zhǔn', meaning: 'chuẩn' },
            { hanzi: '春', pinyin: 'chūn', meaning: 'mùa xuân' },
            { hanzi: '顺', pinyin: 'shùn', meaning: 'thuận' },
            { hanzi: '润', pinyin: 'rùn', meaning: 'ẩm / nhuận' },
          ],
          tip: 'shùn xát cong lưỡi, khác chūn bật hơi.',
        },
        {
          focus: 'zhǎng / cháng / shàng / ràng',
          target: 0,
          choices: [
            { hanzi: '长', pinyin: 'zhǎng', meaning: 'lớn lên / trưởng' },
            { hanzi: '常', pinyin: 'cháng', meaning: 'thường' },
            { hanzi: '上', pinyin: 'shàng', meaning: 'trên' },
            { hanzi: '让', pinyin: 'ràng', meaning: 'nhường / để' },
          ],
          tip: 'zhǎng không bật hơi, cháng bật hơi.',
        },
        {
          focus: 'zhèng / chéng / shēng / réng',
          target: 2,
          choices: [
            { hanzi: '正', pinyin: 'zhèng', meaning: 'đúng' },
            { hanzi: '成', pinyin: 'chéng', meaning: 'thành' },
            { hanzi: '生', pinyin: 'shēng', meaning: 'sinh / sống' },
            { hanzi: '仍', pinyin: 'réng', meaning: 'vẫn' },
          ],
          tip: 'shēng là sh, không có tiếng bật hơi.',
        },
        {
          focus: 'zhàn / chàn / shàn / rán',
          target: 1,
          choices: [
            { hanzi: '站', pinyin: 'zhàn', meaning: 'đứng / ga' },
            { hanzi: '颤', pinyin: 'chàn', meaning: 'run' },
            { hanzi: '善', pinyin: 'shàn', meaning: 'thiện' },
            { hanzi: '然', pinyin: 'rán', meaning: 'như vậy' },
          ],
          tip: 'chàn bật hơi; zhàn không bật hơi.',
        },
        {
          focus: 'zhǎo / chǎo / shǎo / rǎo',
          target: 3,
          choices: [
            { hanzi: '找', pinyin: 'zhǎo', meaning: 'tìm' },
            { hanzi: '炒', pinyin: 'chǎo', meaning: 'xào' },
            { hanzi: '少', pinyin: 'shǎo', meaning: 'ít' },
            { hanzi: '扰', pinyin: 'rǎo', meaning: 'quấy rầy' },
          ],
          tip: 'rǎo mở đầu bằng r, khác shǎo.',
        },
        {
          focus: 'zhèn / chén / shēn / rén',
          target: 0,
          choices: [
            { hanzi: '镇', pinyin: 'zhèn', meaning: 'thị trấn / trấn' },
            { hanzi: '陈', pinyin: 'chén', meaning: 'họ Trần / cũ' },
            { hanzi: '身', pinyin: 'shēn', meaning: 'thân thể' },
            { hanzi: '人', pinyin: 'rén', meaning: 'người' },
          ],
          tip: 'zhèn không bật hơi, chén bật hơi.',
        },
        {
          focus: 'zhuàng / chuáng / shuāng / ràng',
          target: 2,
          choices: [
            { hanzi: '状', pinyin: 'zhuàng', meaning: 'trạng thái' },
            { hanzi: '床', pinyin: 'chuáng', meaning: 'giường' },
            { hanzi: '双', pinyin: 'shuāng', meaning: 'đôi' },
            { hanzi: '让', pinyin: 'ràng', meaning: 'nhường / để' },
          ],
          tip: 'shuāng là sh, không bật hơi như chuáng.',
        },
      ]),
    ],
  },
  {
    id: 'initial-mix',
    level: 'Lv2 · U4',
    title: 'So sánh chéo',
    subtitle: 'j/q/x vs z/c/s vs zh/ch/sh/r.',
    items: [
      {
        id: 'mix-i',
        focus: 'jī / zī / zhī / qī',
        target: { hanzi: '资', pinyin: 'zī', meaning: 'vốn / tư' },
        choices: [
          { hanzi: '鸡', pinyin: 'jī', meaning: 'gà' },
          { hanzi: '资', pinyin: 'zī', meaning: 'vốn / tư' },
          { hanzi: '知', pinyin: 'zhī', meaning: 'biết' },
          { hanzi: '七', pinyin: 'qī', meaning: 'số bảy' },
        ],
        tip: 'zī không cong lưỡi; zhī cong lưỡi; jī/qī đặt lưỡi cao hơn.',
      },
      {
        id: 'mix-chi-ci-qi',
        focus: 'qī / cī / chī / xī',
        target: { hanzi: '吃', pinyin: 'chī', meaning: 'ăn' },
        choices: [
          { hanzi: '七', pinyin: 'qī', meaning: 'số bảy' },
          { hanzi: '疵', pinyin: 'cī', meaning: 'khuyết điểm' },
          { hanzi: '吃', pinyin: 'chī', meaning: 'ăn' },
          { hanzi: '西', pinyin: 'xī', meaning: 'phía tây' },
        ],
        tip: 'chī cong lưỡi và bật hơi; cī bật hơi nhưng không cong lưỡi.',
      },
      {
        id: 'mix-shi-si-xi',
        focus: 'xī / sī / shī / rì',
        target: { hanzi: '师', pinyin: 'shī', meaning: 'thầy' },
        choices: [
          { hanzi: '西', pinyin: 'xī', meaning: 'phía tây' },
          { hanzi: '丝', pinyin: 'sī', meaning: 'tơ' },
          { hanzi: '师', pinyin: 'shī', meaning: 'thầy' },
          { hanzi: '日', pinyin: 'rì', meaning: 'ngày' },
        ],
        tip: 'shī cong lưỡi; sī không cong; xī mảnh hơn.',
      },
      {
        id: 'mix-zhao-zao-jiao',
        focus: 'jiǎo / zǎo / zhǎo / xiǎo',
        target: { hanzi: '找', pinyin: 'zhǎo', meaning: 'tìm' },
        choices: [
          { hanzi: '角', pinyin: 'jiǎo', meaning: 'góc / sừng' },
          { hanzi: '早', pinyin: 'zǎo', meaning: 'sớm' },
          { hanzi: '找', pinyin: 'zhǎo', meaning: 'tìm' },
          { hanzi: '小', pinyin: 'xiǎo', meaning: 'nhỏ' },
        ],
        tip: 'zhǎo cong lưỡi; zǎo không cong lưỡi.',
      },
      {
        id: 'mix-cao-chao-qiao',
        focus: 'qiáo / cáo / cháo / xiǎo',
        target: { hanzi: '朝', pinyin: 'cháo', meaning: 'triều / hướng về' },
        choices: [
          { hanzi: '桥', pinyin: 'qiáo', meaning: 'cầu' },
          { hanzi: '曹', pinyin: 'cáo', meaning: 'họ Tào' },
          { hanzi: '朝', pinyin: 'cháo', meaning: 'triều / hướng' },
          { hanzi: '小', pinyin: 'xiǎo', meaning: 'nhỏ' },
        ],
        tip: 'cháo cong lưỡi và bật hơi; cáo bật hơi nhưng không cong lưỡi.',
      },
      {
        id: 'mix-su-shu-xu',
        focus: 'xù / sù / shù / rù',
        target: { hanzi: '树', pinyin: 'shù', meaning: 'cây' },
        choices: [
          { hanzi: '续', pinyin: 'xù', meaning: 'tiếp tục' },
          { hanzi: '速', pinyin: 'sù', meaning: 'tốc độ' },
          { hanzi: '树', pinyin: 'shù', meaning: 'cây' },
          { hanzi: '入', pinyin: 'rù', meaning: 'vào' },
        ],
        tip: 'shù cong lưỡi; sù không cong; xù đặt lưỡi cao hơn.',
      },
      {
        id: 'mix-zu-zhu-ju',
        focus: 'jù / zú / zhù / qù',
        target: { hanzi: '住', pinyin: 'zhù', meaning: 'ở' },
        choices: [
          { hanzi: '句', pinyin: 'jù', meaning: 'câu' },
          { hanzi: '足', pinyin: 'zú', meaning: 'chân / đủ' },
          { hanzi: '住', pinyin: 'zhù', meaning: 'ở' },
          { hanzi: '去', pinyin: 'qù', meaning: 'đi' },
        ],
        tip: 'zhù cong lưỡi; zú không cong; jù/qù là nhóm j/q/x.',
      },
      {
        id: 'mix-cuo-chuo-que',
        focus: 'quē / cuò / chuō / suǒ',
        target: { hanzi: '戳', pinyin: 'chuō', meaning: 'chọc' },
        choices: [
          { hanzi: '缺', pinyin: 'quē', meaning: 'thiếu' },
          { hanzi: '错', pinyin: 'cuò', meaning: 'sai' },
          { hanzi: '戳', pinyin: 'chuō', meaning: 'chọc' },
          { hanzi: '锁', pinyin: 'suǒ', meaning: 'khóa' },
        ],
        tip: 'chuō cong lưỡi và bật hơi; cuò bật hơi nhưng không cong.',
      },
      {
        id: 'mix-zong-zhong-xiong',
        focus: 'xiōng / zōng / zhōng / cōng',
        target: { hanzi: '中', pinyin: 'zhōng', meaning: 'giữa' },
        choices: [
          { hanzi: '兄', pinyin: 'xiōng', meaning: 'anh trai' },
          { hanzi: '宗', pinyin: 'zōng', meaning: 'tông / phái' },
          { hanzi: '中', pinyin: 'zhōng', meaning: 'giữa' },
          { hanzi: '葱', pinyin: 'cōng', meaning: 'hành lá' },
        ],
        tip: 'zhōng cong lưỡi; zōng/cōng không cong.',
      },
      ...buildListeningDrills('mix-extra', [
        {
          focus: 'jīn / xīn / zhēn / rén',
          target: 2,
          choices: [
            { hanzi: '金', pinyin: 'jīn', meaning: 'vàng / kim loại' },
            { hanzi: '心', pinyin: 'xīn', meaning: 'tim' },
            { hanzi: '真', pinyin: 'zhēn', meaning: 'thật' },
            { hanzi: '人', pinyin: 'rén', meaning: 'người' },
          ],
          tip: 'zhēn cong lưỡi; jīn/xīn đặt lưỡi cao hơn, rén bắt đầu bằng r.',
        },
        {
          focus: 'qīng / cōng / chōng / xīng',
          target: 2,
          choices: [
            { hanzi: '青', pinyin: 'qīng', meaning: 'xanh' },
            { hanzi: '葱', pinyin: 'cōng', meaning: 'hành lá' },
            { hanzi: '冲', pinyin: 'chōng', meaning: 'xông / lao tới' },
            { hanzi: '星', pinyin: 'xīng', meaning: 'ngôi sao' },
          ],
          tip: 'chōng cong lưỡi và bật hơi; cōng bật hơi nhưng không cong.',
        },
        {
          focus: 'xiǎng / sǎng / shǎng / rǎng',
          target: 2,
          choices: [
            { hanzi: '想', pinyin: 'xiǎng', meaning: 'nghĩ / muốn' },
            { hanzi: '嗓', pinyin: 'sǎng', meaning: 'cổ họng / giọng' },
            { hanzi: '赏', pinyin: 'shǎng', meaning: 'thưởng / ngắm' },
            { hanzi: '攘', pinyin: 'rǎng', meaning: 'xua / đẩy' },
          ],
          tip: 'shǎng cong lưỡi; sǎng không cong; xiǎng thuộc nhóm x.',
        },
        {
          focus: 'jiā / zā / zhā / qiā',
          target: 1,
          choices: [
            { hanzi: '家', pinyin: 'jiā', meaning: 'nhà' },
            { hanzi: '扎', pinyin: 'zā', meaning: 'buộc' },
            { hanzi: '渣', pinyin: 'zhā', meaning: 'cặn' },
            { hanzi: '掐', pinyin: 'qiā', meaning: 'véo / bấm' },
          ],
          tip: 'zā không cong lưỡi và không bật hơi; zhā cong lưỡi.',
        },
        {
          focus: 'qiān / cān / chān / xiān',
          target: 2,
          choices: [
            { hanzi: '千', pinyin: 'qiān', meaning: 'nghìn' },
            { hanzi: '餐', pinyin: 'cān', meaning: 'bữa ăn' },
            { hanzi: '搀', pinyin: 'chān', meaning: 'đỡ / dìu' },
            { hanzi: '先', pinyin: 'xiān', meaning: 'trước' },
          ],
          tip: 'chān và cān đều bật hơi, nhưng chān cong lưỡi.',
        },
        {
          focus: 'xué / sè / shé / jué',
          target: 2,
          choices: [
            { hanzi: '学', pinyin: 'xué', meaning: 'học' },
            { hanzi: '色', pinyin: 'sè', meaning: 'màu sắc' },
            { hanzi: '蛇', pinyin: 'shé', meaning: 'rắn' },
            { hanzi: '决', pinyin: 'jué', meaning: 'quyết' },
          ],
          tip: 'shé cong lưỡi; sè không cong; xué/jué là nhóm j/q/x.',
        },
        {
          focus: 'jù / zú / zhù / rù',
          target: 1,
          choices: [
            { hanzi: '句', pinyin: 'jù', meaning: 'câu' },
            { hanzi: '足', pinyin: 'zú', meaning: 'chân / đủ' },
            { hanzi: '住', pinyin: 'zhù', meaning: 'ở' },
            { hanzi: '入', pinyin: 'rù', meaning: 'vào' },
          ],
          tip: 'zú không cong lưỡi; zhù cong lưỡi; jù thuộc nhóm j/q/x.',
        },
        {
          focus: 'qù / cù / chù / xù',
          target: 2,
          choices: [
            { hanzi: '去', pinyin: 'qù', meaning: 'đi' },
            { hanzi: '醋', pinyin: 'cù', meaning: 'giấm' },
            { hanzi: '处', pinyin: 'chù', meaning: 'nơi / xử lý' },
            { hanzi: '续', pinyin: 'xù', meaning: 'tiếp tục' },
          ],
          tip: 'chù bật hơi và cong lưỡi; cù bật hơi nhưng không cong.',
        },
        {
          focus: 'xū / sū / shū / rù',
          target: 0,
          choices: [
            { hanzi: '需', pinyin: 'xū', meaning: 'cần' },
            { hanzi: '苏', pinyin: 'sū', meaning: 'họ Tô' },
            { hanzi: '书', pinyin: 'shū', meaning: 'sách' },
            { hanzi: '入', pinyin: 'rù', meaning: 'vào' },
          ],
          tip: 'xū đặt lưỡi cao và xát nhẹ; sū/shū là hai nhóm khác nhau.',
        },
        {
          focus: 'jiǎn / zǎn / zhǎn / qiǎn',
          target: 2,
          choices: [
            { hanzi: '减', pinyin: 'jiǎn', meaning: 'giảm' },
            { hanzi: '攒', pinyin: 'zǎn', meaning: 'tích góp' },
            { hanzi: '展', pinyin: 'zhǎn', meaning: 'triển khai' },
            { hanzi: '浅', pinyin: 'qiǎn', meaning: 'nông / nhạt' },
          ],
          tip: 'zhǎn cong lưỡi; zǎn không cong; jiǎn/qiǎn thuộc nhóm j/q/x.',
        },
        {
          focus: 'qiáng / cáng / cháng / xiáng',
          target: 0,
          choices: [
            { hanzi: '强', pinyin: 'qiáng', meaning: 'mạnh' },
            { hanzi: '藏', pinyin: 'cáng', meaning: 'giấu / chứa' },
            { hanzi: '长', pinyin: 'cháng', meaning: 'dài' },
            { hanzi: '详', pinyin: 'xiáng', meaning: 'tường tận' },
          ],
          tip: 'qiáng bật hơi nhưng không cong lưỡi như cháng.',
        },
        {
          focus: 'xiàng / sàng / shàng / jiàng',
          target: 2,
          choices: [
            { hanzi: '向', pinyin: 'xiàng', meaning: 'hướng về' },
            { hanzi: '丧', pinyin: 'sàng', meaning: 'mất / tang' },
            { hanzi: '上', pinyin: 'shàng', meaning: 'trên' },
            { hanzi: '降', pinyin: 'jiàng', meaning: 'hạ xuống' },
          ],
          tip: 'shàng cong lưỡi; sàng không cong; xiàng/jiàng thuộc nhóm j/q/x.',
        },
        {
          focus: 'jiǔ / zǒu / zhōu / qiú',
          target: 2,
          choices: [
            { hanzi: '九', pinyin: 'jiǔ', meaning: 'số chín' },
            { hanzi: '走', pinyin: 'zǒu', meaning: 'đi bộ' },
            { hanzi: '周', pinyin: 'zhōu', meaning: 'tuần / họ Chu' },
            { hanzi: '球', pinyin: 'qiú', meaning: 'quả bóng' },
          ],
          tip: 'zhōu cong lưỡi; zǒu không cong; qiú bật hơi.',
        },
        {
          focus: 'qín / cún / chūn / xún',
          target: 0,
          choices: [
            { hanzi: '秦', pinyin: 'qín', meaning: 'nhà Tần / họ Tần' },
            { hanzi: '存', pinyin: 'cún', meaning: 'lưu / tồn tại' },
            { hanzi: '春', pinyin: 'chūn', meaning: 'mùa xuân' },
            { hanzi: '寻', pinyin: 'xún', meaning: 'tìm kiếm' },
          ],
          tip: 'qín bật hơi trong nhóm j/q/x; cún không cong, chūn cong lưỡi.',
        },
        {
          focus: 'xīn / sēn / shēn / rén',
          target: 2,
          choices: [
            { hanzi: '心', pinyin: 'xīn', meaning: 'tim' },
            { hanzi: '森', pinyin: 'sēn', meaning: 'rừng rậm' },
            { hanzi: '身', pinyin: 'shēn', meaning: 'thân thể' },
            { hanzi: '人', pinyin: 'rén', meaning: 'người' },
          ],
          tip: 'shēn cong lưỡi; sēn không cong; xīn thuộc nhóm x.',
        },
        {
          focus: 'jìng / zòng / zhòng / xìng',
          target: 2,
          choices: [
            { hanzi: '静', pinyin: 'jìng', meaning: 'yên tĩnh' },
            { hanzi: '纵', pinyin: 'zòng', meaning: 'dọc / thả' },
            { hanzi: '重', pinyin: 'zhòng', meaning: 'nặng / quan trọng' },
            { hanzi: '性', pinyin: 'xìng', meaning: 'tính chất' },
          ],
          tip: 'zhòng cong lưỡi; zòng không cong; jìng/xìng thuộc nhóm j/x.',
        },
        {
          focus: 'qiāo / cāo / chāo / xiāo',
          target: 1,
          choices: [
            { hanzi: '敲', pinyin: 'qiāo', meaning: 'gõ' },
            { hanzi: '操', pinyin: 'cāo', meaning: 'thao tác / luyện' },
            { hanzi: '超', pinyin: 'chāo', meaning: 'vượt' },
            { hanzi: '消', pinyin: 'xiāo', meaning: 'tan / tiêu' },
          ],
          tip: 'cāo bật hơi nhưng không cong; chāo bật hơi và cong lưỡi.',
        },
        {
          focus: 'xùn / sūn / shùn / rùn',
          target: 2,
          choices: [
            { hanzi: '训', pinyin: 'xùn', meaning: 'huấn luyện' },
            { hanzi: '孙', pinyin: 'sūn', meaning: 'cháu' },
            { hanzi: '顺', pinyin: 'shùn', meaning: 'thuận' },
            { hanzi: '润', pinyin: 'rùn', meaning: 'ẩm / nhuận' },
          ],
          tip: 'shùn cong lưỡi; sūn không cong; xùn thuộc nhóm x.',
        },
      ]),
    ],
  },
  {
    id: 'finals',
    level: 'Lv1 · U3',
    title: 'Vần',
    subtitle: 'an/ang, en/eng, in/ing, u/ü.',
    items: [
      {
        id: 'ban-bang',
        focus: 'bān / bāng',
        target: { hanzi: '班', pinyin: 'bān', meaning: 'lớp / ca làm' },
        choices: [
          { hanzi: '班', pinyin: 'bān', meaning: 'lớp / ca làm' },
          { hanzi: '帮', pinyin: 'bāng', meaning: 'giúp' },
          { hanzi: '半', pinyin: 'bàn', meaning: 'một nửa' },
          { hanzi: '棒', pinyin: 'bàng', meaning: 'tuyệt / gậy' },
        ],
        tip: 'an kết thúc ngắn hơn ang; ang mở sâu hơn ở cuối.',
      },
      {
        id: 'zhen-zheng',
        focus: 'zhēn / zhèng',
        target: { hanzi: '真', pinyin: 'zhēn', meaning: 'thật' },
        choices: [
          { hanzi: '真', pinyin: 'zhēn', meaning: 'thật' },
          { hanzi: '正', pinyin: 'zhèng', meaning: 'đúng / ngay thẳng' },
          { hanzi: '镇', pinyin: 'zhèn', meaning: 'thị trấn / trấn' },
          { hanzi: '整', pinyin: 'zhěng', meaning: 'nguyên / sửa' },
        ],
        tip: 'en và eng khác ở phần ngân cuối; eng vang hơn.',
      },
      {
        id: 'xin-xing',
        focus: 'xīn / xīng',
        target: { hanzi: '星', pinyin: 'xīng', meaning: 'ngôi sao' },
        choices: [
          { hanzi: '心', pinyin: 'xīn', meaning: 'trái tim' },
          { hanzi: '信', pinyin: 'xìn', meaning: 'thư / tin' },
          { hanzi: '星', pinyin: 'xīng', meaning: 'ngôi sao' },
          { hanzi: '行', pinyin: 'xíng', meaning: 'được / đi' },
        ],
        tip: 'ing kéo dài hơn in và có âm cuối rõ hơn.',
      },
      {
        id: 'yu-lu',
        focus: 'yú / lǜ / lù',
        target: { hanzi: '绿', pinyin: 'lǜ', meaning: 'màu xanh lá' },
        choices: [
          { hanzi: '鱼', pinyin: 'yú', meaning: 'cá' },
          { hanzi: '绿', pinyin: 'lǜ', meaning: 'xanh lá' },
          { hanzi: '路', pinyin: 'lù', meaning: 'đường' },
          { hanzi: '雨', pinyin: 'yǔ', meaning: 'mưa' },
        ],
        tip: 'ü cần tròn môi hơn u; lǜ khác rõ với lù.',
      },
    ],
  },
  {
    id: 'daily',
    level: 'Lv1 · U4',
    title: 'Giao tiếp',
    subtitle: 'Nghe cụm từ thật trong câu ngắn.',
    items: [
      {
        id: 'nihao-niyao',
        focus: 'nǐ hǎo / nǐ yào',
        target: { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào' },
        choices: [
          { hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'xin chào' },
          { hanzi: '你要', pinyin: 'nǐ yào', meaning: 'bạn muốn' },
          { hanzi: '你有', pinyin: 'nǐ yǒu', meaning: 'bạn có' },
          { hanzi: '你也', pinyin: 'nǐ yě', meaning: 'bạn cũng' },
        ],
        tip: '好 là thanh 3, khác với 要 thanh 4.',
      },
      {
        id: 'xiexie-xuexi',
        focus: 'xièxie / xuéxí',
        target: { hanzi: '谢谢', pinyin: 'xièxie', meaning: 'cảm ơn' },
        choices: [
          { hanzi: '谢谢', pinyin: 'xièxie', meaning: 'cảm ơn' },
          { hanzi: '学习', pinyin: 'xuéxí', meaning: 'học tập' },
          { hanzi: '休息', pinyin: 'xiūxi', meaning: 'nghỉ ngơi' },
          { hanzi: '消息', pinyin: 'xiāoxi', meaning: 'tin tức' },
        ],
        tip: '谢谢 có hai âm xie, âm sau nhẹ hơn.',
      },
      {
        id: 'laoshi-laoshi',
        focus: 'lǎoshī / lǎoshí',
        target: { hanzi: '老师', pinyin: 'lǎoshī', meaning: 'giáo viên' },
        choices: [
          { hanzi: '老师', pinyin: 'lǎoshī', meaning: 'giáo viên' },
          { hanzi: '老实', pinyin: 'lǎoshí', meaning: 'thật thà' },
          { hanzi: '考试', pinyin: 'kǎoshì', meaning: 'thi' },
          { hanzi: '超市', pinyin: 'chāoshì', meaning: 'siêu thị' },
        ],
        tip: '师 là thanh 1; 实 là thanh 2.',
      },
      {
        id: 'zhongguo-zhongwen',
        focus: 'Zhōngguó / Zhōngwén',
        target: { hanzi: '中文', pinyin: 'Zhōngwén', meaning: 'tiếng Trung' },
        choices: [
          { hanzi: '中国', pinyin: 'Zhōngguó', meaning: 'Trung Quốc' },
          { hanzi: '中文', pinyin: 'Zhōngwén', meaning: 'tiếng Trung' },
          { hanzi: '中午', pinyin: 'zhōngwǔ', meaning: 'buổi trưa' },
          { hanzi: '中国人', pinyin: 'Zhōngguórén', meaning: 'người Trung Quốc' },
        ],
        tip: '中文 kết thúc bằng wén thanh 2; 中国 kết thúc bằng guó.',
      },
    ],
  },
]

const statsKey = 'mandarin-pronunciation-trainer-v2'
const voiceKey = 'mandarin-pronunciation-voice-v1'
const pinyinAudioBase = 'https://data.kimma.group/interactivepinyinchart'
const emptyDeckStats: DeckStats = {
  attempts: 0,
  correct: 0,
  xp: 0,
  streak: 0,
  bestStreak: 0,
  hearts: 5,
}

const pinyinAudioKeys: Record<string, string[]> = {
  mā: ['ma1'],
  má: ['ma2'],
  mǎ: ['ma3'],
  mà: ['ma4'],
  mǎi: ['mai3'],
  mài: ['mai4'],
  shuǐ: ['shui3'],
  shuì: ['shui4'],
  shuō: ['shuo1'],
  tāng: ['tang1'],
  táng: ['tang2'],
  tǎng: ['tang3'],
  tàng: ['tang4'],
  zhī: ['zhi1'],
  chī: ['chi1'],
  shī: ['shi1'],
  xī: ['xi1'],
  zǎo: ['zao3'],
  cǎo: ['cao3'],
  sǎo: ['sao3'],
  zhǎo: ['zhao3'],
  jī: ['ji1'],
  qī: ['qi1'],
  zhōng: ['zhong1'],
  cōng: ['cong1'],
  sōng: ['song1'],
  cóng: ['cong2'],
  bān: ['ban1'],
  bāng: ['bang1'],
  bàn: ['ban4'],
  bàng: ['bang4'],
  zhēn: ['zhen1'],
  zhèng: ['zheng4'],
  zhěng: ['zheng3'],
  xīn: ['xin1'],
  xīng: ['xing1'],
  xíng: ['xing2'],
  yú: ['yu2'],
  lǜ: ['lv4'],
  lù: ['lu4'],
  yǔ: ['yu3'],
  nǐhǎo: ['ni3', 'hao3'],
  nǐyào: ['ni3', 'yao4'],
  nǐyǒu: ['ni3', 'you3'],
  nǐyě: ['ni3', 'ye3'],
  xièxie: ['xie4', 'xie4'],
  xuéxí: ['xue2', 'xi2'],
  xiūxi: ['xiu1', 'xi1'],
  xiāoxi: ['xiao1', 'xi1'],
  lǎoshī: ['lao3', 'shi1'],
  lǎoshí: ['lao3', 'shi2'],
  kǎoshì: ['kao3', 'shi4'],
  chāoshì: ['chao1', 'shi4'],
  zhōngguó: ['zhong1', 'guo2'],
  zhōngwén: ['zhong1', 'wen2'],
  zhōngwǔ: ['zhong1', 'wu3'],
  zhōngguórén: ['zhong1', 'guo2', 'ren2'],
}

function getInitialStats(): SavedStats {
  try {
    const raw = window.localStorage.getItem(statsKey)
    return raw ? (JSON.parse(raw) as SavedStats) : {}
  } catch {
    return {}
  }
}

function fullDeckStats(stats: SavedStats, deckId: string): DeckStats {
  return { ...emptyDeckStats, ...stats[deckId] }
}

function normalizeSpeech(value: string) {
  return value
    .toLocaleLowerCase('zh-CN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[，。！？、,.!?;:(){}"'\s]/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
}

function isSpeechMatch(spoken: string, expected: Choice) {
  const cleanSpoken = normalizeSpeech(spoken)
  const accepted = [expected.hanzi, expected.pinyin, ...(expected.aliases ?? [])].map(
    normalizeSpeech,
  )

  return accepted.some(
    (candidate) =>
      candidate.length > 0 &&
      (cleanSpoken === candidate ||
        cleanSpoken.includes(candidate) ||
        candidate.includes(cleanSpoken)),
  )
}

function getRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return undefined
  }

  const speechWindow = window as SpeechWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function pinyinParts(pinyin: string) {
  const normalized = pinyin.replaceAll('/', ' ').trim()
  const parts = normalized.split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts : [pinyin]
}

function pinyinLookupKey(pinyin: string) {
  return pinyin.toLocaleLowerCase('zh-CN').replace(/[’'\s-]/g, '')
}

function pinyinSyllableToAudioKey(syllable: string) {
  const toneMarks: Record<string, [string, number]> = {
    ā: ['a', 1],
    á: ['a', 2],
    ǎ: ['a', 3],
    à: ['a', 4],
    ē: ['e', 1],
    é: ['e', 2],
    ě: ['e', 3],
    è: ['e', 4],
    ī: ['i', 1],
    í: ['i', 2],
    ǐ: ['i', 3],
    ì: ['i', 4],
    ō: ['o', 1],
    ó: ['o', 2],
    ǒ: ['o', 3],
    ò: ['o', 4],
    ū: ['u', 1],
    ú: ['u', 2],
    ǔ: ['u', 3],
    ù: ['u', 4],
    ǖ: ['v', 1],
    ǘ: ['v', 2],
    ǚ: ['v', 3],
    ǜ: ['v', 4],
  }

  let tone = 0
  const plain = Array.from(syllable.toLocaleLowerCase('zh-CN'))
    .map((char) => {
      const marked = toneMarks[char]
      if (marked) {
        tone = marked[1]
        return marked[0]
      }

      return char === 'ü' ? 'v' : char
    })
    .join('')
    .replace(/[^a-zv]/g, '')

  return tone > 0 && plain.length > 0 ? `${plain}${tone}` : null
}

function audioKeysForPinyin(pinyin: string) {
  const explicitKeys = pinyinAudioKeys[pinyinLookupKey(pinyin)]
  if (explicitKeys) {
    return explicitKeys
  }

  const inferredKeys = pinyinParts(pinyin).map(pinyinSyllableToAudioKey)
  return inferredKeys.every(Boolean) ? (inferredKeys as string[]) : []
}

function markCharacters(spoken: string, target: string): SpeechMark[] {
  const normalizedSpoken = normalizeSpeech(spoken)
  const targetCharacters = Array.from(target)

  return targetCharacters.map((char) => ({
    char,
    ok: normalizedSpoken.includes(normalizeSpeech(char)),
  }))
}

function scoreChineseVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLocaleLowerCase('en-US')
  const lang = voice.lang.toLocaleLowerCase('en-US').replace('_', '-')

  if (!lang.startsWith('zh')) {
    return -1
  }

  let score = 0
  if (lang === 'zh-cn' || lang.includes('hans')) score += 80
  if (lang.startsWith('zh-cn')) score += 50
  if (voice.localService) score += 12
  if (voice.default) score += 4
  if (/tingting|xiaoxiao|xiaoyi|sandy|flo|meijia|mei-jia/.test(name)) score += 10
  if (/taiwan|hong kong|cantonese|zh-tw|zh-hk/.test(`${name} ${lang}`)) score -= 40

  return score
}

function voiceLabel(voice: SpeechSynthesisVoice) {
  return `${voice.name} · ${voice.lang.replace('_', '-')}`
}

function microphoneErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : ''

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone đang bị chặn. Vào Settings > Safari > Microphone và chuyển sang Allow/Ask, rồi tải lại trang.'
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Không tìm thấy microphone trên thiết bị này.'
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Microphone đang bị app khác dùng. Đóng app gọi/ghi âm khác rồi thử lại.'
  }

  return 'Không mở được microphone. Hãy mở link HTTPS trong Safari, không mở trong webview của Zalo/Messenger.'
}

function recognitionErrorMessage(error?: string, message?: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'iPhone chưa cho phép Speech Recognition. Hãy mở link HTTPS trong Safari và cấp quyền microphone/speech recognition.'
  }

  if (error === 'audio-capture') {
    return 'Không lấy được âm thanh từ microphone. Kiểm tra quyền mic trong Safari rồi thử lại.'
  }

  if (error === 'no-speech') {
    return 'Chưa nghe thấy giọng nói. Bấm lại và nói ngay sau khi nút chuyển sang “Đang nghe”.'
  }

  if (error === 'network') {
    return 'Speech Recognition cần mạng để nhận giọng nói. Kiểm tra kết nối rồi thử lại.'
  }

  return message || 'Không nhận được giọng nói. Thử lại ở nơi yên tĩnh hơn.'
}

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

function choiceKey(choice: Choice) {
  return `${choice.hanzi}::${choice.pinyin}`
}

function createLessonRun(deck: Deck): LessonRun {
  return {
    deckId: deck.id,
    exerciseIds: shuffleArray(deck.items.map((item) => item.id)),
    choiceOrders: Object.fromEntries(
      deck.items.map((item) => [
        item.id,
        shuffleArray(item.choices.map((choice) => choiceKey(choice))),
      ]),
    ),
  }
}

function App() {
  const [mode, setMode] = useState<AppMode>('listen')
  const [deckId, setDeckId] = useState(decks[0].id)
  const [lessonRun, setLessonRun] = useState(() => createLessonRun(decks[0]))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle')
  const [speed, setSpeed] = useState<SpeechSpeed>('normal')
  const [showHanziHints, setShowHanziHints] = useState(false)
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(
    () => window.localStorage.getItem(voiceKey) ?? '',
  )
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [stats, setStats] = useState<SavedStats>(getInitialStats)
  const [lastPlayed, setLastPlayed] = useState<string | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionAnswered, setSessionAnswered] = useState(0)
  const [sessionXp, setSessionXp] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [lastGain, setLastGain] = useState(0)
  const [recognitionState, setRecognitionState] = useState<
    'idle' | 'listening' | 'checking'
  >('idle')
  const [recognizedText, setRecognizedText] = useState('')
  const [speechResult, setSpeechResult] = useState<AnswerStatus>('idle')
  const [speechMessage, setSpeechMessage] = useState('')
  const [speechScore, setSpeechScore] = useState<number | null>(null)
  const [speechMarks, setSpeechMarks] = useState<SpeechMark[]>([])
  const [micStatus, setMicStatus] = useState<MicStatus>('unknown')
  const [micMessage, setMicMessage] = useState('')
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioSequenceRef = useRef(0)

  const currentDeck = useMemo(
    () => decks.find((deck) => deck.id === deckId) ?? decks[0],
    [deckId],
  )
  const orderedExercises = useMemo(() => {
    const exerciseMap = new Map(currentDeck.items.map((item) => [item.id, item]))
    const exerciseIds =
      lessonRun.deckId === currentDeck.id
        ? lessonRun.exerciseIds
        : currentDeck.items.map((item) => item.id)
    const ordered = exerciseIds
      .map((id) => exerciseMap.get(id))
      .filter((item): item is Exercise => Boolean(item))

    return ordered.length === currentDeck.items.length ? ordered : currentDeck.items
  }, [currentDeck, lessonRun])
  const currentExercise = orderedExercises[questionIndex % orderedExercises.length]
  const currentChoices = useMemo(() => {
    const choiceOrder =
      lessonRun.deckId === currentDeck.id
        ? lessonRun.choiceOrders[currentExercise.id]
        : undefined

    if (!choiceOrder) {
      return currentExercise.choices
    }

    const choiceMap = new Map(
      currentExercise.choices.map((choice) => [choiceKey(choice), choice]),
    )
    const ordered = choiceOrder
      .map((key) => choiceMap.get(key))
      .filter((choice): choice is Choice => Boolean(choice))

    return ordered.length === currentExercise.choices.length
      ? ordered
      : currentExercise.choices
  }, [currentDeck.id, currentExercise, lessonRun])
  const currentStats = fullDeckStats(stats, currentDeck.id)
  const globalStats = decks.reduce(
    (total, deck) => {
      const deckStats = fullDeckStats(stats, deck.id)
      return {
        xp: total.xp + deckStats.xp,
        correct: total.correct + deckStats.correct,
        attempts: total.attempts + deckStats.attempts,
        bestStreak: Math.max(total.bestStreak, deckStats.bestStreak),
      }
    },
    { xp: 0, correct: 0, attempts: 0, bestStreak: 0 },
  )
  const lessonProgress = ((questionIndex + (answerStatus === 'idle' ? 0 : 1)) / orderedExercises.length) * 100
  const sessionAccuracy =
    sessionAnswered === 0 ? 0 : Math.round((sessionCorrect / sessionAnswered) * 100)
  const recognitionConstructor = getRecognitionConstructor()
  const supportsRecognition = Boolean(recognitionConstructor)
  const isSecure = typeof window === 'undefined' ? true : window.isSecureContext
  const isLastQuestion = questionIndex === orderedExercises.length - 1

  const chineseVoices = useMemo(() => {
    return [...voices]
      .map((voice) => ({ voice, score: scoreChineseVoice(voice) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.voice)
  }, [voices])
  const chineseVoice = useMemo(() => {
    return (
      chineseVoices.find((voice) => voice.voiceURI === selectedVoiceURI) ??
      chineseVoices[0] ??
      null
    )
  }, [chineseVoices, selectedVoiceURI])

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      return
    }

    const syncVoices = () => setVoices(window.speechSynthesis.getVoices())
    syncVoices()
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', syncVoices)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(statsKey, JSON.stringify(stats))
  }, [stats])

  useEffect(() => {
    window.localStorage.setItem(voiceKey, selectedVoiceURI)
  }, [selectedVoiceURI])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      recognitionRef.current?.abort()
      audioRef.current?.pause()
      audioSequenceRef.current += 1
    }
  }, [])

  function resetCurrentPrompt() {
    setSelectedAnswer(null)
    setAnswerStatus('idle')
    setRecognizedText('')
    setSpeechResult('idle')
    setSpeechMessage('')
    setSpeechScore(null)
    setSpeechMarks([])
    setLastGain(0)
    setLastPlayed(null)
  }

  async function requestMicrophoneAccess() {
    if (!isSecure) {
      const message =
        'Microphone trên iPhone chỉ chạy ổn qua HTTPS. Hãy dùng link Cloudflare https://...trycloudflare.com thay vì link http://192...'
      setMicStatus('insecure')
      setMicMessage(message)
      setSpeechResult('wrong')
      setSpeechScore(0)
      setSpeechMessage(message)
      return false
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message =
        'Trình duyệt này không cho web app truy cập microphone. Trên iPhone, hãy mở bằng Safari thật, không mở trong Zalo/Messenger/webview.'
      setMicStatus('unsupported')
      setMicMessage(message)
      setSpeechResult('wrong')
      setSpeechScore(0)
      setSpeechMessage(message)
      return false
    }

    setMicStatus('checking')
    setMicMessage('Đang xin quyền microphone trên iPhone...')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      stream.getTracks().forEach((track) => track.stop())
      setMicStatus('ready')
      setMicMessage('Microphone đã sẵn sàng. Bấm “Bắt đầu nói” và đọc từ đang hiển thị.')
      return true
    } catch (error) {
      const message = microphoneErrorMessage(error)
      setMicStatus('blocked')
      setMicMessage(message)
      setSpeechResult('wrong')
      setSpeechScore(0)
      setSpeechMarks(markCharacters('', currentExercise.target.hanzi))
      setSpeechMessage(message)
      return false
    }
  }

  function resetLessonSession() {
    setLessonRun(createLessonRun(currentDeck))
    setQuestionIndex(0)
    setSessionCorrect(0)
    setSessionAnswered(0)
    setSessionXp(0)
    setSessionComplete(false)
    resetCurrentPrompt()
  }

  function speakText(text = currentExercise.target.hanzi, spokenSpeed = speed, message?: string) {
    if (!('speechSynthesis' in window)) {
      setLastPlayed('Trình duyệt này không hỗ trợ phát âm tự động.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = spokenSpeed === 'slow' ? 0.58 : 0.78
    utterance.pitch = 1
    utterance.volume = 1
    if (chineseVoice) {
      utterance.voice = chineseVoice
    }

    window.speechSynthesis.speak(utterance)
    setLastPlayed(message ?? (spokenSpeed === 'slow' ? 'Đang phát chậm.' : 'Đang phát âm mẫu.'))
  }

  function playChoiceAudio(
    choice = currentExercise.target,
    spokenSpeed = speed,
    message?: string,
  ) {
    const audioKeys = audioKeysForPinyin(choice.pinyin)

    if (audioKeys.length === 0) {
      speakText(choice.hanzi, spokenSpeed, message)
      return
    }

    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    const sequenceId = audioSequenceRef.current + 1
    audioSequenceRef.current = sequenceId
    const playbackRate = spokenSpeed === 'slow' ? 0.76 : 1

    const playAt = (index: number) => {
      if (audioSequenceRef.current !== sequenceId) {
        return
      }

      const audioKey = audioKeys[index]
      if (!audioKey) {
        return
      }

      const audio = new Audio(`${pinyinAudioBase}/${audioKey}.mp3`)
      audioRef.current = audio
      audio.preload = 'auto'
      audio.playbackRate = playbackRate

      audio.onended = () => {
        playAt(index + 1)
      }
      audio.onerror = () => {
        speakText(choice.hanzi, spokenSpeed, message)
      }
      audio.play().catch(() => {
        speakText(choice.hanzi, spokenSpeed, message)
      })
    }

    playAt(0)
    setLastPlayed(
      message ??
        (spokenSpeed === 'slow'
          ? 'Đang phát nguồn Pinyin chậm.'
          : 'Đang phát nguồn Pinyin.'),
    )
  }

  function changeDeck(nextDeckId: string) {
    const nextDeck = decks.find((deck) => deck.id === nextDeckId) ?? decks[0]

    setDeckId(nextDeck.id)
    setLessonRun(createLessonRun(nextDeck))
    setQuestionIndex(0)
    setSessionCorrect(0)
    setSessionAnswered(0)
    setSessionXp(0)
    setSessionComplete(false)
    resetCurrentPrompt()
  }

  function updateDeckStats(isCorrect: boolean, gainedXp: number) {
    setStats((previous) => {
      const previousDeckStats = fullDeckStats(previous, currentDeck.id)
      const nextStreak = isCorrect ? previousDeckStats.streak + 1 : 0
      const nextHearts = isCorrect
        ? Math.min(5, previousDeckStats.hearts + 1)
        : Math.max(0, previousDeckStats.hearts - 1)

      return {
        ...previous,
        [currentDeck.id]: {
          attempts: previousDeckStats.attempts + 1,
          correct: previousDeckStats.correct + (isCorrect ? 1 : 0),
          xp: previousDeckStats.xp + gainedXp,
          streak: nextStreak,
          bestStreak: Math.max(previousDeckStats.bestStreak, nextStreak),
          hearts: nextHearts,
        },
      }
    })
  }

  function chooseAnswer(choice: Choice) {
    if (answerStatus !== 'idle') {
      playChoiceAudio(choice, 'normal', `Đang phát: ${choice.pinyin} · ${choice.hanzi}`)
      return
    }

    const isCorrect = choice.hanzi === currentExercise.target.hanzi
    const gainedXp = isCorrect ? 12 : 3

    setSelectedAnswer(choice.hanzi)
    setAnswerStatus(isCorrect ? 'correct' : 'wrong')
    setSessionAnswered((count) => count + 1)
    setSessionCorrect((count) => count + (isCorrect ? 1 : 0))
    setSessionXp((xp) => xp + gainedXp)
    setLastGain(gainedXp)
    updateDeckStats(isCorrect, gainedXp)
    if (isCorrect) {
      setLastPlayed(`Đúng. +${gainedXp} XP`)
    } else {
      playChoiceAudio(
        choice,
        'normal',
        `Sai: vừa phát âm bạn đã chọn (${choice.pinyin}). Đáp án đúng là ${currentExercise.target.pinyin}. +${gainedXp} XP`,
      )
    }
  }

  function nextQuestion() {
    if (answerStatus === 'idle') {
      playChoiceAudio()
      return
    }

    if (isLastQuestion) {
      setSessionComplete(true)
      return
    }

    const nextIndex = questionIndex + 1
    const nextExercise = orderedExercises[nextIndex]
    resetCurrentPrompt()
    setQuestionIndex(nextIndex)
    playChoiceAudio(nextExercise.target, speed, 'Đang phát âm mẫu câu mới.')
  }

  function goToNextDeck() {
    const currentDeckIndex = decks.findIndex((deck) => deck.id === currentDeck.id)
    const nextDeck = decks[(currentDeckIndex + 1) % decks.length]
    changeDeck(nextDeck.id)
  }

  function resetDeckStats() {
    setStats((previous) => ({
      ...previous,
      [currentDeck.id]: emptyDeckStats,
    }))
    resetLessonSession()
  }

  async function startSpeechCheck() {
    const Recognition = recognitionConstructor
    if (!Recognition) {
      setSpeechResult('wrong')
      setSpeechMessage(
        'Trình duyệt này chưa có Speech Recognition. Trên iPhone hãy mở bằng Safari qua link HTTPS.',
      )
      setSpeechScore(0)
      return
    }

    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    audioSequenceRef.current += 1

    const hasMicAccess = micStatus === 'ready' || (await requestMicrophoneAccess())
    if (!hasMicAccess) {
      return
    }

    recognitionRef.current?.abort()

    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 3

    setRecognizedText('')
    setSpeechMessage('Đang nghe. Nói rõ từ đang hiển thị.')
    setSpeechResult('idle')
    setSpeechScore(null)
    setSpeechMarks([])
    setRecognitionState('listening')

    recognition.onresult = (event) => {
      setRecognitionState('checking')
      const firstResult = event.results[0]
      const transcript = firstResult?.[0]?.transcript ?? ''
      const matched = isSpeechMatch(transcript, currentExercise.target)
      const marks = matched
        ? Array.from(currentExercise.target.hanzi).map((char) => ({ char, ok: true }))
        : markCharacters(transcript, currentExercise.target.hanzi)
      const correctMarks = marks.filter((mark) => mark.ok).length
      const score = matched
        ? 92
        : Math.max(18, Math.round((correctMarks / Math.max(1, marks.length)) * 74))

      setRecognizedText(transcript)
      setSpeechMarks(marks)
      setSpeechScore(score)
      setSpeechResult(matched ? 'correct' : 'wrong')
      setSpeechMessage(
        matched
          ? 'Khớp với từ cần nói. Các ký tự đều ổn.'
          : `Máy nghe thành "${transcript || 'không rõ'}". Hãy luyện lại âm được đánh dấu đỏ.`,
      )
    }

    recognition.onerror = (event) => {
      setRecognitionState('idle')
      setSpeechResult('wrong')
      setSpeechScore(0)
      setSpeechMarks(markCharacters('', currentExercise.target.hanzi))
      setSpeechMessage(recognitionErrorMessage(event.error, event.message))
    }

    recognition.onend = () => {
      setRecognitionState('idle')
    }

    try {
      recognition.start()
    } catch {
      setRecognitionState('idle')
      setSpeechResult('wrong')
      setSpeechScore(0)
      setSpeechMessage('Không khởi động được microphone. Hãy tải lại trang và thử lại.')
    }
  }

  if (sessionComplete && mode === 'listen') {
    return (
      <main className="app-shell">
        <section className="result-screen" aria-labelledby="result-title">
          <div className="result-medal">
            <Trophy size={42} />
          </div>
          <p className="eyebrow">{currentDeck.level}</p>
          <h1 id="result-title">Hoàn thành bài {currentDeck.title}</h1>
          <p className="result-copy">
            Bạn trả lời đúng {sessionCorrect}/{sessionAnswered} câu và nhận {sessionXp} XP.
          </p>

          <div className="result-grid">
            <div>
              <span>{sessionAccuracy}%</span>
              <small>Độ chính xác</small>
            </div>
            <div>
              <span>{currentStats.bestStreak}</span>
              <small>Streak tốt nhất</small>
            </div>
            <div>
              <span>{globalStats.xp}</span>
              <small>Tổng XP</small>
            </div>
          </div>

          <div className="result-actions">
            <button className="secondary-action" type="button" onClick={resetLessonSession}>
              <RotateCcw size={19} />
              Luyện lại
            </button>
            <button className="primary-action" type="button" onClick={goToNextDeck}>
              Bài tiếp
              <ChevronRight size={20} />
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="phone-shell">
        <header className="app-header">
          <div className="brand-chip">
            <BookOpen size={18} />
            <div>
              <strong>{currentDeck.level}</strong>
              <span>Pronunciation path</span>
            </div>
          </div>
          <div className="stat-row" aria-label="Tiến độ học">
            <span className="stat-pill">
              <Heart size={16} fill="currentColor" />
              {currentStats.hearts}
            </span>
            <span className="stat-pill">
              <Flame size={16} fill="currentColor" />
              {currentStats.streak}
            </span>
            <span className="stat-pill">
              <Trophy size={16} />
              {globalStats.xp}
            </span>
          </div>
        </header>

        <section className="course-path" aria-label="Lộ trình bài học">
          <div className="course-path-title">
            <strong>Lesson Progress</strong>
            <span>Current Unit</span>
          </div>
          {decks.map((deck, index) => {
            const deckStats = fullDeckStats(stats, deck.id)
            const completed = deckStats.attempts >= deck.items.length
            const active = deck.id === currentDeck.id

            return (
              <button
                className={`path-node ${active ? 'active' : ''} ${completed ? 'done' : ''}`}
                key={deck.id}
                type="button"
                onClick={() => changeDeck(deck.id)}
              >
                <span>{completed ? <CheckCircle2 size={18} /> : index + 1}</span>
                <strong>{deck.title}</strong>
              </button>
            )
          })}
        </section>

        <nav className="mode-switch" aria-label="Chọn chế độ luyện">
          <button
            className={mode === 'listen' ? 'active' : ''}
            type="button"
            onClick={() => setMode('listen')}
          >
            <Headphones size={18} />
            Nghe chọn
          </button>
          <button
            className={mode === 'speak' ? 'active' : ''}
            type="button"
            onClick={() => setMode('speak')}
          >
            <Mic size={18} />
            Nói kiểm tra
          </button>
        </nav>

        {mode === 'listen' ? (
          <section className="lesson-card" aria-labelledby="listen-title">
            <div className="lesson-topline">
              <div>
                <p className="eyebrow">Listen & choose</p>
                <h1 id="listen-title">{currentDeck.title}</h1>
              </div>
              <button className="icon-button" type="button" onClick={resetDeckStats}>
                <RotateCcw size={18} />
              </button>
            </div>

            <div className="progress-track" aria-label="Tiến độ trong bài">
              <span style={{ width: `${lessonProgress}%` }} />
            </div>

            <div className="lesson-options">
              <button
                className="toggle-button"
                type="button"
                onClick={() => setShowHanziHints((visible) => !visible)}
              >
                {showHanziHints ? <Eye size={17} /> : <EyeOff size={17} />}
                {showHanziHints ? 'Chữ Hán bật' : 'Ẩn chữ Hán'}
              </button>
              <button
                className="toggle-button"
                type="button"
                onClick={() => setSpeed((value) => (value === 'normal' ? 'slow' : 'normal'))}
              >
                <Volume2 size={17} />
                {speed === 'normal' ? 'Tốc độ thường' : 'Tốc độ chậm'}
              </button>
              <label className="voice-picker">
                <span>Nguồn âm: Pinyin chart · giọng dưới đây chỉ dùng khi thiếu file</span>
                <select
                  value={chineseVoice?.voiceURI ?? ''}
                  onChange={(event) => setSelectedVoiceURI(event.target.value)}
                >
                  {chineseVoices.length === 0 ? (
                    <option value="">Giọng mặc định của máy</option>
                  ) : (
                    chineseVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voiceLabel(voice)}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            <div className="prompt-card">
              <div className="speaker-orb">
                <Headphones size={34} />
              </div>
              <p>{currentDeck.subtitle}</p>
              <strong>
                {answerStatus === 'idle'
                  ? 'Nghe âm và chọn pinyin đúng'
                  : `${currentExercise.target.pinyin} · ${currentExercise.target.hanzi}`}
              </strong>
              <button className="play-main" type="button" onClick={() => playChoiceAudio()}>
                <Play size={20} fill="currentColor" />
                {speed === 'normal' ? 'Nghe mẫu' : 'Nghe chậm'}
              </button>
              {lastPlayed ? <span className="status-line">{lastPlayed}</span> : null}
            </div>

            <div className="choice-grid">
              {currentChoices.map((choice) => {
                const isTarget = choice.hanzi === currentExercise.target.hanzi
                const isSelected = selectedAnswer === choice.hanzi
                const className =
                  answerStatus === 'idle'
                    ? 'choice-card'
                    : isTarget
                      ? 'choice-card correct'
                      : isSelected
                        ? 'choice-card wrong'
                        : 'choice-card muted'

                return (
                  <button
                    className={className}
                    key={`${currentExercise.id}-${choice.hanzi}`}
                    type="button"
                    onClick={() => chooseAnswer(choice)}
                  >
                    <span className="choice-pinyin">{choice.pinyin}</span>
                    <span className="meaning">{choice.meaning}</span>
                    {showHanziHints || answerStatus !== 'idle' ? (
                      <span className="choice-hanzi">{choice.hanzi}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className={`feedback ${answerStatus}`}>
              {answerStatus === 'idle' ? (
                <>
                  <strong>Trọng tâm: {currentExercise.focus}</strong>
                  <span>Câu {questionIndex + 1}/{orderedExercises.length}. Bấm nghe trước khi chọn.</span>
                </>
              ) : (
                <>
                  <strong>
                    {answerStatus === 'correct' ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}
                    {answerStatus === 'correct' ? 'Chính xác' : 'Cần nghe lại'} · +
                    {lastGain} XP
                  </strong>
                  <span>
                    {currentExercise.target.pinyin} · {currentExercise.target.hanzi}.{' '}
                    {currentExercise.tip}
                  </span>
                </>
              )}
            </div>

            <button className="next-button" type="button" onClick={nextQuestion}>
              {answerStatus === 'idle'
                ? 'Phát âm'
                : isLastQuestion
                  ? 'Xem kết quả'
                  : 'Tiếp tục'}
              <ChevronRight size={20} />
            </button>
          </section>
        ) : (
          <section className="lesson-card speak-panel" aria-labelledby="speak-title">
            <div className="lesson-topline">
              <div>
                <p className="eyebrow">Read aloud</p>
                <h1 id="speak-title">Nói và xem điểm</h1>
              </div>
              <button className="icon-button" type="button" onClick={resetCurrentPrompt}>
                <RotateCcw size={18} />
              </button>
            </div>

            {!isSecure ? (
              <div className="browser-note" role="status">
                Mở qua HTTP LAN có thể làm microphone bị chặn. Để kiểm tra nói trên iPhone ổn
                định, hãy dùng HTTPS hoặc deploy app lên host HTTPS.
              </div>
            ) : null}

            {!supportsRecognition ? (
              <div className="browser-note warning" role="status">
                Trình duyệt hiện tại không có Speech Recognition. Phần nghe chọn đáp án vẫn chạy
                bình thường.
              </div>
            ) : null}

            {micMessage ? (
              <div
                className={`browser-note ${
                  micStatus === 'ready' ? 'ready' : micStatus === 'checking' ? 'checking' : 'warning'
                }`}
                role="status"
              >
                {micMessage}
              </div>
            ) : null}

            <div className="speak-target">
              <span className="hanzi score-hanzi">
                {speechMarks.length > 0
                  ? speechMarks.map((mark, index) => (
                      <span className={mark.ok ? 'mark-ok' : 'mark-bad'} key={`${mark.char}-${index}`}>
                        {mark.char}
                      </span>
                    ))
                  : currentExercise.target.hanzi}
              </span>
              <span className="pinyin">{currentExercise.target.pinyin}</span>
              <span className="meaning">{currentExercise.target.meaning}</span>
            </div>

            <div className="speech-score-card">
              <div className="score-ring">
                <strong>{speechScore ?? '--'}</strong>
                <span>score</span>
              </div>
              <div>
                <strong>Correct pronunciation</strong>
                <p>{speechMessage || 'Nghe mẫu, đọc lại từ, rồi retry từng âm sai.'}</p>
              </div>
            </div>

            <div className="syllable-list" aria-label="Luyện từng âm">
              {pinyinParts(currentExercise.target.pinyin).map((part, index) => (
                <button
                  className="syllable-chip"
                  key={`${currentExercise.id}-${part}-${index}`}
                  type="button"
                  onClick={() =>
                    speakText(
                      Array.from(currentExercise.target.hanzi)[index] ??
                        currentExercise.target.hanzi,
                      'slow',
                    )
                  }
                >
                  <span>{Array.from(currentExercise.target.hanzi)[index] ?? currentExercise.target.hanzi}</span>
                  <small>{part}</small>
                </button>
              ))}
            </div>

            <div className="speak-actions">
              <button className="secondary-action" type="button" onClick={() => playChoiceAudio()}>
                <Volume2 size={19} />
                Nghe mẫu
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={startSpeechCheck}
                disabled={recognitionState === 'listening' || micStatus === 'checking'}
              >
                <Mic size={20} />
                {micStatus === 'checking'
                  ? 'Đang xin quyền'
                  : recognitionState === 'listening'
                    ? 'Đang nghe'
                    : 'Bắt đầu nói'}
              </button>
            </div>

            <div className={`speech-result ${speechResult}`}>
              <div>
                {speechResult === 'correct' ? <BadgeCheck size={22} /> : <Mic size={22} />}
                <strong>
                  {speechResult === 'idle'
                    ? 'Chưa ghi âm'
                    : speechResult === 'correct'
                      ? 'Phát âm khớp'
                      : 'Cần luyện lại'}
                </strong>
              </div>
              {recognizedText ? <small>Máy nhận: {recognizedText}</small> : null}
            </div>

            <button className="next-button" type="button" onClick={nextQuestion}>
              Từ tiếp theo
              <ChevronRight size={20} />
            </button>
          </section>
        )}

        <footer className="spark-footer">
          <Sparkles size={17} />
          <span>{globalStats.correct}/{globalStats.attempts || 0} câu đúng toàn bộ · Best streak {globalStats.bestStreak}</span>
        </footer>
      </section>
    </main>
  )
}

export default App
