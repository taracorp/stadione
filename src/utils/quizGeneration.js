// Quiz Generation & Management Utilities
import { supabase } from '../config/supabase';

/**
 * Generate quiz questions from article content
 * Currently uses manual templates - can be extended with AI later
 */
export const quizTemplates = {
  'Sepakbola': [
    {
      question: "Berapa jumlah pemain dalam satu tim sepakbola di lapangan?",
      option_a: "10 pemain",
      option_b: "11 pemain",
      option_c: "12 pemain",
      option_d: "9 pemain",
      correct_answer: "b",
      explanation: "Tim sepakbola terdiri dari 11 pemain di lapangan (1 kiper dan 10 pemain lapangan)."
    },
    {
      question: "Berapa lama durasi satu pertandingan sepakbola standar?",
      option_a: "80 menit",
      option_b: "90 menit",
      option_c: "100 menit",
      option_d: "75 menit",
      correct_answer: "b",
      explanation: "Pertandingan sepakbola standar terdiri dari 2 babak masing-masing 45 menit, total 90 menit."
    }
  ],
  'Futsal': [
    {
      question: "Berapa jumlah pemain futsal per tim di lapangan?",
      option_a: "4 pemain",
      option_b: "5 pemain",
      option_c: "6 pemain",
      option_d: "7 pemain",
      correct_answer: "b",
      explanation: "Futsal dimainkan dengan 5 pemain per tim di lapangan (1 kiper dan 4 pemain lapangan)."
    }
  ],
  'Tennis': [
    {
      question: "Apa istilah untuk skor 0 dalam tennis?",
      option_a: "Love",
      option_b: "Zero",
      option_c: "Nil",
      option_d: "Empty",
      correct_answer: "a",
      explanation: "Dalam tennis, skor 0 disebut 'Love' yang berasal dari bahasa Prancis 'l'oeuf' (telur)."
    }
  ],
  'Badminton': [
    {
      question: "Berapa tinggi net badminton di tengah lapangan?",
      option_a: "1,55 meter",
      option_b: "1,75 meter",
      option_c: "1,95 meter",
      option_d: "2,0 meter",
      correct_answer: "a",
      explanation: "Tinggi net badminton di tengah lapangan adalah 1,55 meter."
    }
  ],
  'Padel': [
    {
      question: "Pada tahun berapa Padel diciptakan?",
      option_a: "1950",
      option_b: "1965",
      option_c: "1972",
      option_d: "1985",
      correct_answer: "c",
      explanation: "Padel diciptakan oleh Enrique Corcuera di Mexico pada tahun 1972."
    }
  ],
  'default': [
    {
      question: "Pertanyaan ini akan diganti dengan konten artikel",
      option_a: "Pilihan A",
      option_b: "Pilihan B",
      option_c: "Pilihan C",
      option_d: "Pilihan D",
      correct_answer: "a",
      explanation: "Penjelasan akan disesuaikan dengan artikel."
    }
  ]
};

function shuffleArray(items) {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function buildQuestion(question, correct, distractors, explanation) {
  const options = shuffleArray([correct, ...distractors]).slice(0, 4);
  const correctIndex = options.findIndex((option) => option === correct);
  return {
    id: `q_${Math.random().toString(36).slice(2, 10)}`,
    question,
    options,
    correctIndex,
    explanation,
  };
}

function parseScore(content) {
  const scoreMatch = content.match(/(\d{1,2})\s*[-:]\s*(\d{1,2})/);
  if (!scoreMatch) return null;
  return `${scoreMatch[1]}-${scoreMatch[2]}`;
}

function parseVenue(content) {
  const venueMatch = content.match(/(Stadion\s+[A-Z][A-Za-z\s-]{3,40}|GOR\s+[A-Z][A-Za-z\s-]{3,40})/);
  if (!venueMatch) return null;
  return venueMatch[1].trim();
}

function parsePercentages(content) {
  const matches = [...content.matchAll(/(\d{1,3})%/g)].map((entry) => Number(entry[1]));
  return matches.filter((value) => value >= 10 && value <= 100);
}

function parseLargeNumbers(content) {
  const matches = [...content.matchAll(/\b(\d{2,4})\b/g)].map((entry) => Number(entry[1]));
  return matches.filter((value) => value >= 10 && value <= 5000);
}

export function generateTriviaQuestionsFromContent(article, paragraphs = [], maxQuestions = 3) {
  const safeParagraphs = Array.isArray(paragraphs) ? paragraphs : [];
  const mergedContent = safeParagraphs.filter(Boolean).join(' ');
  const questions = [];

  const score = parseScore(mergedContent);
  if (score) {
    const [home, away] = score.split('-').map(Number);
    questions.push(buildQuestion(
      'Berapa skor akhir pertandingan pada artikel ini?',
      score,
      [`${home + 1}-${away}`, `${home}-${away + 1}`, `${Math.max(home - 1, 0)}-${away}`],
      `Skor akhir yang disebutkan pada artikel adalah ${score}.`
    ));
  }

  const venue = parseVenue(mergedContent);
  if (venue) {
    questions.push(buildQuestion(
      'Di venue mana pertandingan utama pada artikel ini berlangsung?',
      venue,
      ['Stadion Utama Jakarta', 'GOR Internasional', 'Stadion Nasional'],
      `Artikel menyebutkan venue pertandingan di ${venue}.`
    ));
  }

  const percentages = parsePercentages(mergedContent);
  if (percentages.length > 0) {
    const possession = percentages[0];
    questions.push(buildQuestion(
      'Berapa persentase statistik dominan yang disebut dalam artikel?',
      `${possession}%`,
      [`${Math.max(0, possession - 6)}%`, `${Math.min(100, possession + 7)}%`, `${Math.max(0, possession - 12)}%`],
      `Angka persentase utama yang muncul di artikel adalah ${possession}%.`
    ));
  }

  const largeNumbers = parseLargeNumbers(mergedContent);
  const statNumber = largeNumbers.find((value) => value >= 10 && value <= 150);
  if (statNumber) {
    questions.push(buildQuestion(
      'Berapa angka statistik kunci (non-persentase) yang disebut di artikel?',
      String(statNumber),
      [String(statNumber + 2), String(Math.max(1, statNumber - 3)), String(statNumber + 5)],
      `Artikel mencantumkan angka statistik ${statNumber}.`
    ));
  }

  const filtered = questions.filter((item, index, array) => {
    return array.findIndex((entry) => entry.question === item.question) === index;
  });

  const desiredCount = Math.min(Math.max(maxQuestions, 3), 3);
  const result = shuffleArray(filtered).slice(0, desiredCount);
  if (result.length >= 3) return result;

  return [
    buildQuestion(
      'Apa fokus utama pembahasan dalam artikel ini?',
      'Pertandingan dan performa tim pada laga yang dibahas',
      ['Harga tiket dan promosi tribun', 'Transfer pemain lintas liga', 'Jadwal latihan mingguan komunitas'],
      'Isi artikel menyoroti jalannya laga serta performa tim.'
    ),
    buildQuestion(
      'Bagian mana yang paling ditekankan dari isi artikel?',
      'Momen penting pertandingan dan data statistiknya',
      ['Perubahan logo klub musim ini', 'Diskon merchandise resmi', 'Renovasi fasilitas parkir stadion'],
      'Artikel menekankan momen pertandingan beserta statistik pendukung.'
    ),
    buildQuestion(
      'Nilai utama apa yang paling terasa dari narasi artikel?',
      'Kerja kolektif dan konsistensi performa di lapangan',
      ['Ekspansi bisnis klub ke luar negeri', 'Pergantian warna jersey kandang', 'Rencana tur pramusim internasional'],
      'Narasi artikel menekankan kekompakan tim dan konsistensi permainan.'
    ),
  ].slice(0, desiredCount);
}

/**
 * Create or fetch quiz for an article
 * If quiz doesn't exist, creates one based on article category/sport
 */
export async function getOrCreateArticleQuiz(articleId, articleData) {
  if (!supabase) return null;

  try {
    // Check if quiz already exists
    const { data: existingQuiz, error: fetchError } = await supabase
      .from('article_quiz')
      .select('*')
      .eq('article_id', articleId)
      .limit(1)
      .single();

    if (existingQuiz) {
      return existingQuiz;
    }

    // If no quiz exists, create one
    const templateQuiz = quizTemplates[articleData?.category] || quizTemplates['default'];
    const selectedQuiz = templateQuiz[Math.floor(Math.random() * templateQuiz.length)];

    const { data: newQuiz, error: createError } = await supabase
      .from('article_quiz')
      .insert({
        article_id: articleId,
        question: selectedQuiz.question,
        option_a: selectedQuiz.option_a,
        option_b: selectedQuiz.option_b,
        option_c: selectedQuiz.option_c,
        option_d: selectedQuiz.option_d,
        correct_answer: selectedQuiz.correct_answer,
        explanation: selectedQuiz.explanation
      })
      .select()
      .single();

    if (createError) throw createError;
    return newQuiz;
  } catch (error) {
    console.error('Error getting or creating quiz:', error.message);
    return null;
  }
}

/**
 * Generate quiz from article title and excerpt using AI (Future Implementation)
 * Currently returns null - implement with OpenAI/Claude API
 */
export async function generateQuizFromArticleContent(articleId, title, excerpt) {
  // TODO: Implement AI quiz generation
  // Example structure for future AI integration:
  
  // const response = await fetch('https://api.openai.com/v1/chat/completions', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${OPENAI_API_KEY}`
  //   },
  //   body: JSON.stringify({
  //     model: 'gpt-3.5-turbo',
  //     messages: [{
  //       role: 'user',
  //       content: `Generate a trivia quiz question about this article:\n\nTitle: ${title}\n\nExcerpt: ${excerpt}\n\nReturn JSON with question, option_a, option_b, option_c, option_d, correct_answer (a/b/c/d), and explanation.`
  //     }]
  //   })
  // });
  
  // const quizData = await response.json();
  // Store in database and return

  console.log('AI quiz generation not yet implemented. Using template quiz instead.');
  return null;
}

/**
 * Get quiz statistics for user
 */
export async function getUserQuizStatistics(userId) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    const total = data?.length || 0;
    const correct = data?.filter(q => q.is_correct).length || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pointsEarned = data?.reduce((sum, q) => sum + (q.points_awarded || 0), 0) || 0;

    return {
      totalAttempts: total,
      correctAnswers: correct,
      wrongAnswers: total - correct,
      accuracy,
      pointsEarned,
      averagePointsPerQuiz: total > 0 ? Math.round(pointsEarned / total) : 0
    };
  } catch (error) {
    console.error('Error fetching quiz statistics:', error.message);
    return null;
  }
}

/**
 * Get most popular quiz categories
 */
export async function getPopularQuizCategories() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .rpc('get_popular_quiz_categories', {})
      .limit(10);

    if (error) {
      console.error('Error fetching quiz categories:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error:', error.message);
    return [];
  }
}

/**
 * Clear user quiz history (for testing/reset)
 */
export async function clearUserQuizHistory(userId) {
  if (!supabase || !userId) return false;

  try {
    const { error: deleteError } = await supabase
      .from('quiz_results')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    const { error: updateError } = await supabase
      .from('article_progress')
      .update({
        quiz_attempted: false,
        quiz_correct: false
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error('Error clearing quiz history:', error.message);
    return false;
  }
}

/**
 * Validate quiz answer format
 */
export function validateQuizAnswer(answer) {
  const validAnswers = ['a', 'b', 'c', 'd'];
  return validAnswers.includes(answer?.toLowerCase());
}

/**
 * Get quiz difficulty level
 * Can be enhanced with metadata in future
 */
export function getQuizDifficulty(correctAnswerPercentage) {
  if (correctAnswerPercentage >= 80) return 'Easy';
  if (correctAnswerPercentage >= 50) return 'Medium';
  return 'Hard';
}

/**
 * Batch create quizzes for articles
 * Useful for admin/seed operations
 */
export async function batchCreateQuizzes(articles) {
  if (!supabase) return [];

  const quizzes = articles.map(article => {
    const template = quizTemplates[article.category] || quizTemplates['default'];
    const selected = template[Math.floor(Math.random() * template.length)];

    return {
      article_id: article.id,
      question: selected.question,
      option_a: selected.option_a,
      option_b: selected.option_b,
      option_c: selected.option_c,
      option_d: selected.option_d,
      correct_answer: selected.correct_answer,
      explanation: selected.explanation
    };
  });

  try {
    const { data, error } = await supabase
      .from('article_quiz')
      .insert(quizzes)
      .select();

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error batch creating quizzes:', error.message);
    return [];
  }
}
