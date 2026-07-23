export type QuestionType =
  | "shortText"
  | "longText"
  | "singleSelect"
  | "multiSelect"
  | "limitedSelect"
  | "rank"
  | "scale"
  | "scales"
  | "references"
  | "antiReferences"
  | "colors"
  | "tags"
  | "repeatable"
  | "ratingGrid"
  | "matrix";

export type ConditionalLogic = {
  questionId: string;
  equals?: string;
  notEquals?: string;
};

export type Question = {
  id: string;
  sectionId: string;
  number: string;
  title: string;
  description?: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  maxSelections?: number;
  maxItems?: number;
  allowCustom?: boolean;
  allowComment?: boolean;
  commentLabel?: string;
  allowFiles?: boolean;
  allowLinks?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  ratingOptions?: string[];
  referencePrompts?: string[];
  validation?: { minLength?: number; maxLength?: number };
  conditionalLogic?: ConditionalLogic;
};

export type BriefSection = {
  id: string;
  number: string;
  title: string;
  kicker: string;
  intro?: string;
  questions: Question[];
};

const q = (
  sectionId: string,
  number: string,
  id: string,
  title: string,
  type: QuestionType,
  extra: Partial<Question> = {},
): Question => ({
  id,
  sectionId,
  number,
  title,
  type,
  required: false,
  ...extra,
});

const other = (options: string[]) => [...options, "Другое"];
const symbolCondition: ConditionalLogic = {
  questionId: "logo-symbol-need",
  notEquals: "достаточно текстового логотипа",
};

const characterScales = [
  ["04.S1", "character-reserved-expressive", "Сдержанный", "Экспрессивный"],
  ["04.S2", "character-premium-accessible", "Премиальный", "Доступный"],
  ["04.S3", "character-tech-human", "Технологичный", "Человечный"],
  ["04.S4", "character-serious-ironic", "Серьёзный", "Ироничный"],
  ["04.S5", "character-minimal-detailed", "Минималистичный", "Детализированный"],
  ["04.S6", "character-rational-emotional", "Рациональный", "Эмоциональный"],
  ["04.S7", "character-classic-experimental", "Классический", "Экспериментальный"],
  ["04.S8", "character-mass-niche", "Массовый", "Нишевый"],
  ["04.S9", "character-corporate-street", "Корпоративный", "Уличный"],
  ["04.S10", "character-stable-changing", "Стабильный", "Изменчивый"],
] as const;

export const briefSections: BriefSection[] = [
  {
    id: "development",
    number: "01",
    title: "Точка развития",
    kicker: "Что должен изменить новый фирменный стиль?",
    intro: "Мы уже знаем, чем занимается студия и как она работает. Эта сессия посвящена другому — тому, как TBD должна выглядеть, ощущаться и восприниматься со стороны.",
    questions: [
      q("development", "01.1", "development-current-strengths", "Что в текущем образе TBD уже работает и должно быть сохранено?", "longText"),
      q("development", "01.2", "development-perception-change", "Как должно измениться восприятие студии после появления нового фирменного стиля?", "longText"),
      q("development", "01.3", "development-hidden-qualities", "Какие качества TBD сейчас недостаточно заметны во внешней коммуникации?", "tags"),
      q("development", "01.4", "development-name-meaning", "Должно ли название TBD по-прежнему восприниматься как сокращение от To Be Determined, или оно уже стало самостоятельным именем бренда?", "singleSelect", {
        options: [
          "Важно сохранить связь с To Be Determined",
          "TBD уже является самостоятельным именем",
          "Оба значения должны существовать одновременно",
          "Не могу определить",
          "Другое",
        ],
        allowCustom: true,
        allowComment: true,
      }),
      q("development", "01.5", "development-name-story", "Есть ли у названия TBD внутренняя история, метафора, шутка или дополнительное значение, которое можно использовать в айдентике?", "longText"),
      q("development", "01.6", "development-future-project", "Какой будущий проект или достижение должно наиболее полно отражать новый визуальный образ TBD?", "longText"),
      q("development", "01.7", "development-success-result", "Какой результат разработки фирменного стиля можно будет считать действительно успешным?", "longText"),
    ],
  },
  {
    id: "visual-field",
    number: "02",
    title: "Визуальное поле",
    kicker: "В каком окружении будет существовать бренд?",
    questions: [
      q("visual-field", "02.1", "visual-market-level", "На каком рынке TBD должна восприниматься в первую очередь?", "singleSelect", {
        options: other(["Локальный", "Международный", "Глобальный", "Несколько уровней одновременно"]),
        allowCustom: true,
      }),
      q("visual-field", "02.2", "visual-language-audience", "Должна ли айдентика одинаково хорошо восприниматься русскоязычной и международной аудиторией?", "singleSelect", {
        options: ["Да, это обязательно", "Скорее да", "Приоритет — русскоязычная аудитория", "Приоритет — международная аудитория", "Не могу определить"],
        allowComment: true,
      }),
      q("visual-field", "02.3", "visual-direct-competitors", "Какие студии, продакшены, медиа или киберспортивные бренды являются основными визуальными конкурентами TBD?", "repeatable", {
        description: "Добавьте название и, если есть, ссылку.",
        allowLinks: true,
      }),
      q("visual-field", "02.4", "visual-attention-competitors", "Какие бренды не являются прямыми конкурентами, но борются за внимание той же аудитории?", "repeatable", { allowLinks: true }),
      q("visual-field", "02.5", "visual-difference", "В чём TBD должна визуально отличаться от конкурентов?", "longText"),
      q("visual-field", "02.6", "visual-overused-esports", "Какие визуальные приёмы в киберспорте кажутся слишком распространёнными, устаревшими или шаблонными?", "longText"),
      q("visual-field", "02.7", "visual-underused-directions", "Какие направления, наоборот, пока недостаточно используются в киберспортивном дизайне, по вашему мнению?", "longText"),
      q("visual-field", "02.8", "visual-industry-distance", "Должна ли TBD визуально находиться внутри привычной эстетики киберспорта или выглядеть как бренд из другой индустрии?", "scale", {
        leftLabel: "Внутри эстетики киберспорта",
        rightLabel: "Как бренд из другой индустрии",
      }),
      q("visual-field", "02.9", "visual-esports-references", "Киберспортивные референсы", "references", {
        description: "Приложите 3–5 примеров киберспортивных студий, продакшенов или медиа, чей визуальный стиль кажется удачным.",
        allowFiles: true,
        allowLinks: true,
        referencePrompts: ["Что именно в этом примере работает?", "Что нравится: логотип, типографика, цвет, композиция, эфирная графика, соцсети, 3D, motion или общий характер?"],
      }),
      q("visual-field", "02.10", "visual-other-industries-references", "Референсы из других индустрий", "references", {
        description: "Приложите 3–5 примеров из других индустрий, которые могли бы быть близки TBD по визуальному уровню или характеру.",
        allowFiles: true,
        allowLinks: true,
      }),
      q("visual-field", "02.11", "visual-brand-anti-references", "Есть ли бренды, на которые TBD точно не должна быть похожа?", "antiReferences", { allowFiles: true, allowLinks: true }),
      q("visual-field", "02.12", "visual-competitor-no-copy", "Какие конкретные визуальные решения конкурентов нельзя повторять, даже если они выглядят эффектно?", "longText"),
    ],
  },
  {
    id: "perception",
    number: "03",
    title: "Внешнее восприятие",
    kicker: "Как TBD должна выглядеть для аудитории и партнёров?",
    questions: [
      q("perception", "03.2", "perception-audience-priority", "Чьё восприятие важнее учитывать при разработке айдентики в первую очередь?", "rank", {
        options: ["заказчики и партнёры", "издатели игр", "турнирные операторы", "бренды", "киберспортивная аудитория", "игроки и таланты", "потенциальные сотрудники", "другое"],
        maxSelections: 8,
        allowCustom: true,
      }),
      q("perception", "03.3", "perception-first-impression", "Какое первое впечатление должна производить TBD?", "longText"),
      q("perception", "03.4", "perception-three-qualities", "Какие три качества человек должен считать во внешнем образе студии ещё до знакомства с её проектами?", "tags", { maxSelections: 3 }),
      q("perception", "03.5", "perception-primary-role", "Должна ли TBD выглядеть прежде всего как:", "limitedSelect", {
        options: other(["сильный продакшен", "креативная студия", "технологичная компания", "киберспортивный бренд", "медиа", "экспериментальная команда"]),
        maxSelections: 3,
        allowCustom: true,
      }),
      q("perception", "03.6", "perception-outside-esports", "Насколько важно, чтобы визуальный стиль был понятен людям вне киберспорта?", "scale", {
        leftLabel: "Это неважно",
        rightLabel: "Это критически важно",
      }),
      q("perception", "03.7", "perception-change-direction", "Должен ли бренд выглядеть более статусным, более смелым или более доступным, чем сейчас?", "multiSelect", {
        options: other(["более статусным", "более смелым", "более доступным", "более профессиональным", "более экспериментальным", "текущее восприятие стоит сохранить"]),
        allowCustom: true,
        allowComment: true,
      }),
      q("perception", "03.8", "perception-remove-doubts", "Какие сомнения о TBD новый визуальный стиль должен снять?", "longText"),
      q("perception", "03.9", "perception-forbidden-impression", "Какого впечатления о TBD точно не должно возникать?", "longText"),
      q("perception", "03.10", "perception-first-emotions", "Какие эмоции должен вызывать бренд у человека, который видит его впервые?", "tags", {
        description: "Добавьте собственные ассоциации — список не ограничен готовыми вариантами.",
      }),
    ],
  },
  {
    id: "character-building",
    number: "04",
    title: "Создание персонажа",
    kicker: "Если бы TBD была человеком",
    intro: "Представьте TBD как персонажа. Здесь нет правильных или неправильных ответов: этот блок помогает определить характер бренда и перевести абстрактные качества в визуальные решения.",
    questions: [
      q("character-building", "04.1", "character-age", "Сколько этому персонажу лет?", "shortText", { description: "Можно ответить «около 30», «вне возраста» или указать диапазон." }),
      q("character-building", "04.2", "character-appearance", "Как он выглядит?", "longText"),
      q("character-building", "04.3", "character-clothes", "Как он одевается?", "longText"),
      q("character-building", "04.4", "character-free-time", "Где проводит свободное время?", "longText"),
      q("character-building", "04.5", "character-music", "Какую музыку слушает?", "longText"),
      q("character-building", "04.6", "character-speech", "Как разговаривает?", "longText"),
      q("character-building", "04.9", "character-profession-archetype", "Кем он мог бы быть?", "limitedSelect", {
        options: other(["режиссёром", "игроком", "архитектором", "художником", "инженером", "продюсером", "стратегом", "бунтарём", "исследователем"]),
        maxSelections: 3,
        allowCustom: true,
      }),
      q("character-building", "04.10", "character-three-qualities", "Какие три качества лучше всего описывают этого персонажа?", "tags", { maxSelections: 3 }),
      q("character-building", "04.11", "character-wrong-qualities", "Какие качества ему категорически не подходят?", "tags"),
      q("character-building", "04.12", "character-strength", "В чём его главная сила?", "longText"),
      q("character-building", "04.15", "character-trends", "Как он реагирует на тренды?", "singleSelect", {
        options: other(["следует им", "переосмысливает", "игнорирует", "создаёт собственные", "зависит от ситуации"]),
        allowCustom: true,
        allowComment: true,
      }),
      q("character-building", "04.16", "character-voice-phrase", "Какую фразу он мог бы сказать от лица TBD?", "longText"),
      ...characterScales.map(([number, id, leftLabel, rightLabel]) =>
        q("character-building", number, id, `${leftLabel} — ${rightLabel}`, "scale", { leftLabel, rightLabel })
      ),
      q("character-building", "04.17", "character-person-references", "Назовите несколько реальных или вымышленных персонажей, которые частично напоминают TBD по характеру.", "references", {
        allowFiles: true,
        allowLinks: true,
        description: "Можно указать только имя или название — файл не обязателен.",
      }),
      q("character-building", "04.18", "character-brand-references", "Назовите 3–5 брендов из любых индустрий, характер которых близок TBD.", "references", {
        allowFiles: true,
        allowLinks: true,
        referencePrompts: ["Какое качество хочется перенести в TBD?", "Что нравится только визуально?", "Что точно не стоит заимствовать?"],
      }),
    ],
  },
  {
    id: "dna",
    number: "05",
    title: "Визуальная ДНК",
    kicker: "Из чего должен состоять образ TBD?",
    questions: [
      q("dna", "05.1", "dna-overall-impression", "Каким должно быть общее визуальное впечатление от TBD?", "longText"),
      q("dna", "05.2", "dna-three-definitions", "Какие три определения лучше всего описывают будущий фирменный стиль?", "tags", { maxSelections: 3 }),
      q("dna", "05.3", "dna-priorities", "Что важнее всего?", "rank", {
        description: "Выберите и расположите пять наиболее важных пунктов.",
        options: other(["узнаваемость", "универсальность", "экспериментальность", "технологичность", "премиальность", "эмоциональность", "масштабируемость", "выразительность в motion", "простота использования"]),
        maxSelections: 5,
        allowCustom: true,
      }),
      q("dna", "05.4", "dna-direct-esports", "Должен ли стиль напрямую ассоциироваться с киберспортом?", "singleSelect", {
        options: ["да", "скорее да", "скорее нет", "нет", "не могу определить"],
        allowComment: true,
      }),
      q("dna", "05.5", "dna-avoid-game-cliches", "Насколько важно избегать очевидных игровых клише?", "scale", {
        leftLabel: "Необязательно избегать",
        rightLabel: "Нужно полностью исключить",
      }),
      q("dna", "05.6", "dna-system-flexibility", "Должна ли айдентика быть строгой системой или скорее гибким визуальным конструктором?", "scale", {
        leftLabel: "Строгая система",
        rightLabel: "Гибкий конструктор",
      }),
      q("dna", "05.7", "dna-project-visibility", "Должен ли стиль быть нейтральной основой для разных проектов или сам становиться заметной частью каждого проекта?", "scale", {
        leftLabel: "Нейтральная основа",
        rightLabel: "Заметная часть проекта",
      }),
      q("dna", "05.8", "dna-direction-ratings", "Насколько допустимы следующие визуальные направления?", "ratingGrid", {
        options: ["футуризм", "индустриальная эстетика", "цифровая графика", "интерфейсность", "брутализм", "минимализм", "неон", "хром", "металл", "стекло", "3D", "глитч", "граффити", "спортивная эстетика", "редакционный дизайн", "модная или музыкальная эстетика"],
        ratingOptions: ["Точно нет", "Скорее нет", "Возможно", "Скорее да", "Точно да"],
        allowCustom: true,
      }),
      q("dna", "05.9", "dna-forbidden-techniques", "Какие визуальные приёмы точно не подходят TBD?", "longText"),
      q("dna", "05.10", "dna-organic-colors", "Какие цвета органично ассоциируются с TBD?", "colors", { description: "Добавьте несколько цветов, их названия и пояснения." }),
      q("dna", "05.11", "dna-unwanted-colors", "Какие цвета нежелательны?", "colors"),
      q("dna", "05.12", "dna-competitor-color-distance", "Нужно ли визуально дистанцироваться от цветовых решений конкретных конкурентов?", "longText"),
      q("dna", "05.13", "dna-dark-light", "Должна ли система одинаково хорошо работать в тёмной и светлой версиях?", "singleSelect", {
        options: ["обе версии одинаково важны", "приоритет — тёмная", "приоритет — светлая", "достаточно одной основной версии", "не могу определить"],
      }),
      q("dna", "05.14", "dna-monochrome-importance", "Насколько важна монохромная версия?", "scale", {
        leftLabel: "Почти не важна",
        rightLabel: "Критически важна",
      }),
      q("dna", "05.15", "dna-palette-change", "Может ли цветовая палитра меняться в зависимости от проекта, дисциплины или формата?", "singleSelect", {
        options: ["да, свободно", "да, но в рамках системы", "только через дополнительные акцентные цвета", "нет, палитра должна быть постоянной", "не могу определить"],
      }),
      q("dna", "05.16", "dna-palette-modes", "Нужна ли бренду одна постоянная палитра или базовая палитра с дополнительными цветовыми режимами?", "singleSelect", {
        options: other(["одна постоянная палитра", "основная палитра и дополнительные режимы", "отдельные палитры для разных направлений", "не могу определить"]),
        allowCustom: true,
      }),
      q("dna", "05.17", "dna-typography", "Какой должна быть типографика?", "limitedSelect", {
        options: other(["нейтральной", "технической", "характерной", "экспериментальной", "массивной", "строгой", "редакционной"]),
        maxSelections: 4,
        allowCustom: true,
        allowComment: true,
      }),
      q("dna", "05.18", "dna-graphic-elements", "Какие собственные графические элементы могут понадобиться бренду?", "multiSelect", {
        options: other(["паттерны", "рамки", "пиктограммы", "текстуры", "сетки", "символы", "декоративная типографика", "система контейнеров", "формы для фото и видео"]),
        allowCustom: true,
      }),
      q("dna", "05.19", "dna-motion-3d-use", "Планируется ли активное использование 3D и motion-дизайна?", "singleSelect", {
        options: ["да, это одно из главных направлений", "да, но как дополнительный инструмент", "только в отдельных проектах", "скорее нет", "не могу определить"],
      }),
      q("dna", "05.20", "dna-motion-priority", "Должен ли фирменный стиль эффектно работать в движении, даже если статичная версия будет достаточно простой?", "scale", {
        leftLabel: "Статика важнее",
        rightLabel: "Движение критически важно",
      }),
      q("dna", "05.21", "dna-materials", "Какие материалы, фактуры или физические объекты могли бы ассоциироваться с TBD?", "longText", { allowFiles: true }),
      q("dna", "05.22", "dna-timelessness", "Должна ли айдентика выглядеть актуально прямо сейчас или быть более вневременной?", "scale", {
        leftLabel: "Актуальная и трендовая",
        rightLabel: "Вневременная",
      }),
      q("dna", "05.23", "dna-atmosphere-references", "Атмосфера TBD", "references", {
        description: "Соберите изображения, передающие желаемую атмосферу: логотипы, постеры, титры, обложки, архитектуру, сценографию, интерфейсы, материалы, свет, 3D или motion.",
        allowFiles: true,
        allowLinks: true,
        referencePrompts: ["Что именно нравится?", "Какое настроение хочется перенести?", "Что подходит только как идея?", "Что не стоит повторять буквально?"],
      }),
      q("dna", "05.25", "dna-anti-references", "Антиреференсы", "antiReferences", {
        description: "Соберите примеры того, как TBD выглядеть не должна.",
        allowFiles: true,
        allowLinks: true,
      }),
      q("dna", "05.26", "dna-reference-patterns", "Какие повторяющиеся элементы в собранных референсах кажутся наиболее близкими бренду?", "longText"),
    ],
  },
  {
    id: "logo",
    number: "06",
    title: "Логотип и знак",
    kicker: "Что должно стать главным идентификатором TBD?",
    intro: "Текстовая часть логотипа уже определена — это название TBD. Вопрос заключается в том, нужен ли бренду дополнительный самостоятельный знак и какую роль он должен выполнять.",
    questions: [
      q("logo", "06.1", "logo-wordmark-character", "Какой характер должен быть у написания TBD?", "limitedSelect", {
        options: other(["строгий", "нейтральный", "технологичный", "массивный", "острый", "пластичный", "экспериментальный", "редакционный", "индустриальный"]),
        maxSelections: 4,
        allowCustom: true,
      }),
      q("logo", "06.2", "logo-symbol-need", "Достаточно ли бренду выразительного текстового логотипа TBD или нужен дополнительный самостоятельный символ?", "singleSelect", {
        options: ["достаточно текстового логотипа", "нужен отдельный символ", "желательно предусмотреть оба варианта", "решение должно зависеть от концепции", "не могу определить"],
      }),
      q("logo", "06.3", "logo-symbol-role", "Если символ нужен, какую роль он должен выполнять?", "multiSelect", {
        options: other(["использоваться отдельно от названия", "дополнять текстовую часть", "становиться основой паттернов и графики", "использоваться только в отдельных форматах", "работать как аватар или компактная иконка"]),
        allowCustom: true,
        conditionalLogic: symbolCondition,
      }),
      q("logo", "06.4", "logo-symbol-meaning", "Должен ли символ иметь конкретное значение или может быть абстрактным?", "scale", {
        leftLabel: "Конкретное значение",
        rightLabel: "Абстрактная форма",
        conditionalLogic: symbolCondition,
      }),
      q("logo", "06.5", "logo-symbol-associations", "Какие идеи, понятия, образы или ассоциации могли бы лечь в основу символа TBD?", "longText", { conditionalLogic: symbolCondition }),
      q("logo", "06.6", "logo-internal-metaphors", "Есть ли у бренда внутренние метафоры, рабочие привычки, профессиональные особенности или характерные детали, которые можно было бы преобразовать в знак?", "longText", { conditionalLogic: symbolCondition }),
      q("logo", "06.7", "logo-symbol-interpretation", "Должен ли знак считываться однозначно или допускать разные интерпретации?", "scale", {
        leftLabel: "Однозначный",
        rightLabel: "Открытый для интерпретаций",
        conditionalLogic: symbolCondition,
      }),
      q("logo", "06.8", "logo-complexity", "Насколько простой или сложной может быть конструкция логотипа?", "scale", {
        leftLabel: "Максимально простая",
        rightLabel: "Сложная и детализированная",
      }),
      q("logo", "06.9", "logo-letter-experiments", "Допустимы ли нестандартные формы букв, деформация типографики или экспериментальная работа с сокращением TBD?", "singleSelect", {
        options: ["да, эксперименты приветствуются", "допустимо в умеренной форме", "только если сохраняется хорошая читаемость", "лучше использовать классическое написание", "не могу определить"],
      }),
      q("logo", "06.10", "logo-impression", "Каким должен выглядеть логотип?", "limitedSelect", {
        options: other(["стабильным", "динамичным", "фундаментальным", "интеллектуальным", "агрессивным", "собранным", "живым", "изменчивым"]),
        maxSelections: 3,
        allowCustom: true,
      }),
      q("logo", "06.13", "logo-cliches", "Какие визуальные решения в логотипах кажутся слишком очевидными или избитыми?", "longText"),
      q("logo", "06.14", "logo-forbidden-symbols", "Какие символы, формы или метафоры точно не подходят TBD?", "longText"),
      q("logo", "06.15", "logo-construction-references", "Конструктивные референсы логотипов", "references", {
        description: "Приложите примеры логотипов, которые нравятся именно по конструкции.",
        allowFiles: true,
        allowLinks: true,
        referencePrompts: ["Что здесь работает: пластика букв, пропорции, простота, идея, скрытый смысл, знак, композиция, типографика или анимационный потенциал?"],
      }),
      q("logo", "06.17", "logo-wordmark-references", "Текстовые логотипы", "references", {
        description: "Приложите примеры удачных текстовых логотипов.",
        allowFiles: true,
        allowLinks: true,
      }),
      q("logo", "06.18", "logo-system-references", "Логотип и дополнительный знак", "references", {
        description: "Приложите примеры удачных систем, где текстовый логотип дополнен отдельным знаком.",
        allowFiles: true,
        allowLinks: true,
      }),
      q("logo", "06.19", "logo-beautiful-but-wrong", "Есть ли логотипы, которые кажутся красивыми, но совершенно не подходят TBD? Почему?", "antiReferences", { allowFiles: true, allowLinks: true }),
    ],
  },
  {
    id: "graphic-voice",
    number: "07",
    title: "Голос в графике",
    kicker: "Как характер TBD должен проявляться в шаблонах и визуальной коммуникации?",
    intro: "Этот блок нужен не для разработки полноценной вербальной стратегии, а для понимания характера постов, анонсов, карточек, обложек, титров и других материалов.",
    questions: [
      q("graphic-voice", "07.1", "voice-material-feeling", "Какое ощущение должны создавать графические материалы TBD?", "limitedSelect", {
        options: other(["официальное", "уверенное", "дерзкое", "интеллектуальное", "дружелюбное", "ироничное", "провокационное", "премиальное", "энергичное"]),
        maxSelections: 3,
        allowCustom: true,
      }),
      q("graphic-voice", "07.3", "voice-typography-visibility", "Насколько заметной должна быть типографика?", "scale", {
        leftLabel: "Нейтральной",
        rightLabel: "Главным визуальным элементом",
      }),
      q("graphic-voice", "07.6", "voice-self-irony", "Может ли бренд использовать самоиронию?", "singleSelect", {
        options: ["да", "да, но умеренно", "только в отдельных форматах", "скорее нет", "нет"],
      }),
      q("graphic-voice", "07.7", "voice-provocation", "Насколько допустимы провокационные или намеренно неоднозначные формулировки?", "scale", {
        leftLabel: "Полностью исключить",
        rightLabel: "Активно использовать",
      }),
      q("graphic-voice", "07.8", "voice-message-matrix", "Должны ли разные типы сообщений визуально отличаться друг от друга?", "matrix", {
        options: ["анонс", "результат", "кейс", "новость", "вакансия", "партнёрство", "backstage", "развлекательный контент", "срочное сообщение"],
        ratingOptions: ["отдельная визуальная подача", "вариация внутри общей системы", "единая подача для всех материалов", "не могу определить"],
      }),
      q("graphic-voice", "07.9", "voice-template-freedom", "Нужна ли единая система шаблонов или каждый материал может быть более свободным?", "scale", {
        leftLabel: "Единая строгая система",
        rightLabel: "Максимальная свобода",
      }),
      q("graphic-voice", "07.10", "voice-system-unpredictability", "Должна ли графика выглядеть аккуратно и системно или более живо и непредсказуемо?", "scale", {
        leftLabel: "Аккуратно и системно",
        rightLabel: "Живо и непредсказуемо",
      }),
      q("graphic-voice", "07.11", "voice-big-project-phrase", "Как могла бы звучать короткая фраза от лица TBD в анонсе нового большого проекта?", "longText"),
      q("graphic-voice", "07.12", "voice-short-phrases", "Напишите ещё 2–3 короткие фразы, которые потенциально могли бы появиться в графике или социальных сетях TBD.", "repeatable", { maxItems: 3 }),
      q("graphic-voice", "07.13", "voice-communication-references", "Референсы графической коммуникации", "references", {
        description: "Приложите примеры постов, анонсов, титров или рекламных материалов, в которых хорошо сочетаются текст и графика.",
        allowFiles: true,
        allowLinks: true,
        referencePrompts: ["Что хотелось бы перенести: композицию, масштаб текста, подачу фотографий, ритм, тон, цвет, динамику или плотность информации?"],
      }),
    ],
  },
  {
    id: "assembly",
    number: "08",
    title: "Финальная сборка",
    kicker: "Самые важные ориентиры",
    questions: [
      q("assembly", "08.1", "assembly-style-must", "Новый фирменный стиль TBD должен…", "shortText"),
      q("assembly", "08.2", "assembly-look-more", "После обновления TBD должна выглядеть более…", "shortText"),
      q("assembly", "08.3", "assembly-main-difference", "Главное отличие TBD от других киберспортивных студий — это…", "shortText"),
      q("assembly", "08.4", "assembly-three-words", "В трёх словах визуальный стиль TBD — это…", "tags", { maxSelections: 3 }),
      q("assembly", "08.5", "assembly-never-like", "TBD никогда не должна выглядеть как…", "shortText"),
      q("assembly", "08.6", "assembly-logo-main-message", "Самое важное, что должен передавать логотип, — это…", "shortText"),
      q("assembly", "08.7", "assembly-one-reference", "Если оставить только один визуальный референс, что это будет?", "references", {
        description: "Можно повторно указать один из уже добавленных референсов или добавить новый.",
        allowFiles: true,
        allowLinks: true,
        maxItems: 1,
      }),
      q("assembly", "08.8", "assembly-one-anti-reference", "Если оставить только один антиреференс, что это будет?", "antiReferences", {
        allowFiles: true,
        allowLinks: true,
        maxItems: 1,
      }),
      q("assembly", "08.9", "assembly-recognizable-element", "Какой элемент фирменного стиля должен стать наиболее узнаваемым?", "longText"),
      q("assembly", "08.10", "assembly-worse-extreme", "Что будет хуже?", "singleSelect", {
        options: ["слишком безопасный и нейтральный стиль", "слишком экспериментальный и сложный стиль", "оба варианта одинаково нежелательны", "зависит от реализации", "не могу определить"],
        allowComment: true,
      }),
      q("assembly", "08.11", "assembly-sacrifice", "Чем команда готова пожертвовать ради более сильного визуального образа?", "longText"),
      q("assembly", "08.12", "assembly-invariants", "Что в новой системе должно оставаться неизменным независимо от проекта и формата?", "longText"),
    ],
  },
  {
    id: "review",
    number: "09",
    title: "Проверка и отправка",
    kicker: "Проверьте ответы и передайте визуальный портрет дизайн-лиду.",
    questions: [],
  },
];

export const editableSections = briefSections.slice(0, -1);
export const allQuestions = editableSections.flatMap((section) => section.questions);

function selectedValue(value: unknown) {
  if (value && typeof value === "object" && "selected" in value) {
    return (value as { selected?: unknown }).selected;
  }
  return value;
}

export function isQuestionVisible(question: Question, answers: Record<string, unknown>) {
  if (!question.conditionalLogic) return true;
  const value = selectedValue(answers[question.conditionalLogic.questionId]);
  if (question.conditionalLogic.equals !== undefined) return value === question.conditionalLogic.equals;
  if (question.conditionalLogic.notEquals !== undefined) return value !== question.conditionalLogic.notEquals;
  return true;
}

export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.some(isAnswered);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(isAnswered);
  return false;
}
